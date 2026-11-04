export type QueueMethod = "set" | "update";
export type QueuedWrite = {
  id: string;
  path: string;
  method: QueueMethod;
  data: Record<string, unknown>;
  merge?: boolean;
  queuedAt: string;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem">;
export type WriteSender = (write: QueuedWrite) => Promise<void>;
export const OFFLINE_QUEUE_KEY = "caresits-cs-offline-writes-v1";

function browserStorage(): StorageLike | undefined {
  try { return typeof localStorage === "undefined" ? undefined : localStorage; }
  catch { return undefined; }
}

function isSpacePath(path: string): boolean {
  const parts = path.split("/");
  return parts[0] === "careSpaces" && parts.length >= 3 && parts.every(Boolean);
}

export function readQueuedWrites(storage: StorageLike | undefined = browserStorage()): QueuedWrite[] {
  if (!storage) return [];
  try {
    const value: unknown = JSON.parse(storage.getItem(OFFLINE_QUEUE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((row): row is QueuedWrite => Boolean(
      row && typeof row === "object" && typeof row.id === "string" &&
      typeof row.path === "string" && isSpacePath(row.path) &&
      (row.method === "set" || row.method === "update") &&
      row.data && typeof row.data === "object" && !Array.isArray(row.data),
    ));
  } catch { return []; }
}

function saveQueuedWrites(rows: readonly QueuedWrite[], storage: StorageLike | undefined): void {
  if (!storage) return;
  try { storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(rows)); }
  catch { /* Keep the app usable when device storage is full. */ }
}

export function enqueueWrite(
  write: Omit<QueuedWrite, "id" | "queuedAt"> & Partial<Pick<QueuedWrite, "id" | "queuedAt">>,
  storage: StorageLike | undefined = browserStorage(),
): QueuedWrite {
  if (!isSpacePath(write.path)) throw new Error("Offline writes must stay inside a Care Space.");
  const next: QueuedWrite = {
    ...write,
    id: write.id ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    queuedAt: write.queuedAt ?? new Date().toISOString(),
  };
  const rows = readQueuedWrites(storage);
  saveQueuedWrites([...rows, next], storage);
  return next;
}

export async function flushQueuedWrites(
  send: WriteSender,
  options: { storage?: StorageLike; online?: boolean } = {},
): Promise<number> {
  const storage = options.storage ?? browserStorage();
  const online = options.online ?? (typeof navigator === "undefined" || navigator.onLine);
  if (!online || !storage) return 0;
  const rows = readQueuedWrites(storage);
  let sent = 0;
  while (rows.length) {
    try {
      await send(rows[0]!);
      rows.shift();
      sent += 1;
      saveQueuedWrites(rows, storage);
    } catch {
      break;
    }
  }
  return sent;
}
