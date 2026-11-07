import { t } from "../i18n";

export type SniffedImage = "jpeg" | "png" | "webp" | "gif" | "heic" | null;

/** Decide the real image type from the first bytes. The browser's MIME type and the file name are never trusted. */
export function sniffImageType(head: Uint8Array): SniffedImage {
  const b = head;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "gif";
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!);
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1", "avif"].includes(brand)) return "heic";
  }
  return null;
}

export async function assertRealImage(file: Blob): Promise<SniffedImage> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const kind = sniffImageType(head);
  if (!kind) throw new Error(t("media.notImage", "This file is not a photo we can use. Choose a JPG, PNG, WebP or iPhone photo."));
  return kind;
}

export function isTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /reach the file service|try again later|had a problem|Could not upload this file/i.test(message);
}

/** Retries only transient failures (offline, 5xx, dropped upload). Never retries validation or permission errors. */
export async function withRetry<T>(run: (attempt: number) => Promise<T>, { retries = 2, baseMs = 600, signal, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) }: { retries?: number; baseMs?: number; signal?: AbortSignal; sleep?: (ms: number) => Promise<void> } = {}): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new Error(t("media.uploadStopped", "Upload stopped. Choose the file again."));
    try { return await run(attempt); } catch (error) {
      last = error;
      if (attempt === retries || !isTransientError(error)) throw error;
      await sleep(baseMs * 2 ** attempt);
    }
  }
  throw last;
}

const inFlight = new Map<string, Promise<unknown>>();
/** Ignores duplicate taps: the same file object, kind and uid share one upload. */
export function dedupeUpload<T>(key: string, start: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = start().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}
