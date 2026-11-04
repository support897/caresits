import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@cc/core";
import {
  enqueueWrite,
  flushQueuedWrites,
  type QueuedWrite,
  type StorageLike,
  type WriteSender,
} from "../lib/offlineQueue";

const SNAPSHOT_PREFIX = "caresits-cs-snapshot-v1:";

function browserStorage(): StorageLike | undefined {
  try { return typeof localStorage === "undefined" ? undefined : localStorage; }
  catch { return undefined; }
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") return maybeTimestamp.toDate().toISOString();
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalize(child)]));
  }
  return value;
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

export function saveSnapshot<T>(key: string, data: T, storage = browserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(`${SNAPSHOT_PREFIX}${key}`, JSON.stringify({ savedAt: new Date().toISOString(), data: normalize(data) }));
  } catch { /* Local snapshots are best-effort. */ }
}

export function readSnapshot<T>(key: string, storage = browserStorage()): { savedAt: string; data: T } | null {
  if (!storage) return null;
  try {
    const value: unknown = JSON.parse(storage.getItem(`${SNAPSHOT_PREFIX}${key}`) ?? "null");
    if (!value || typeof value !== "object" || !("data" in value)) return null;
    const record = value as { savedAt?: unknown; data: T };
    return { savedAt: typeof record.savedAt === "string" ? record.savedAt : "", data: record.data };
  } catch { return null; }
}

async function sendToFirestore(write: QueuedWrite): Promise<void> {
  const ref = doc(db, write.path);
  if (write.method === "update") await updateDoc(ref, write.data);
  else await setDoc(ref, write.data, { merge: write.merge ?? false });
}

export function isConnectivityError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && ["unavailable", "deadline-exceeded", "network-request-failed", "cancelled"].includes(code);
}

export async function writeSpaceDocument(
  write: Omit<QueuedWrite, "id" | "queuedAt">,
): Promise<{ queued: boolean }> {
  if (!isOnline()) {
    enqueueWrite(write);
    return { queued: true };
  }
  try {
    await sendToFirestore({ ...write, id: "online", queuedAt: new Date().toISOString() });
    return { queued: false };
  } catch (error) {
    if (!isConnectivityError(error)) throw error;
    enqueueWrite(write);
    return { queued: true };
  }
}

export async function flushOfflineQueue(): Promise<number> {
  return flushQueuedWrites(sendToFirestore);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void flushOfflineQueue(); });
}

export { enqueueWrite, flushQueuedWrites } from "../lib/offlineQueue";
