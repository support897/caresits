import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import { auth, db } from "@cc/core";
import { notificationSchema, type AppNotification } from "../../../../packages/core/src/schemas/notifications";

export type UserNotification = AppNotification & { id: string };
const SAFE_UID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_NOTIFICATIONS = 100;

function timestampDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === "number") return Number.isFinite(value) ? new Date(value) : null;
  if (typeof value === "string") {
    const millis = Date.parse(value);
    return Number.isFinite(millis) ? new Date(millis) : null;
  }
  if (!value || typeof value !== "object") return null;
  const timestamp = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  if (typeof timestamp.toDate === "function") {
    try {
      const date = timestamp.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
    } catch { return null; }
  }
  if (typeof timestamp.seconds === "number") {
    const millis = timestamp.seconds * 1_000 + Math.floor((timestamp.nanoseconds ?? 0) / 1_000_000);
    return Number.isFinite(millis) ? new Date(millis) : null;
  }
  return null;
}

/** Converts a Firestore document into the shared schema shape, dropping malformed rows. */
export function parseNotificationDocument(id: string, value: unknown): UserNotification | null {
  if (!id || id.includes("/") || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const at = timestampDate(data.at);
  if (!at) return null;
  const parsed = notificationSchema.safeParse({ ...data, at });
  return parsed.success ? { ...parsed.data, id } : null;
}

function isOwner(uid: string): boolean {
  return SAFE_UID.test(uid) && auth().currentUser?.uid === uid;
}

export function subscribeToNotifications(
  uid: string,
  onRows: (rows: UserNotification[]) => void,
  onError: (error: Error) => void = () => {},
): () => void {
  if (!isOwner(uid)) {
    onError(new Error("notifications-owner-required"));
    return () => {};
  }
  const rows = query(collection(db, "users", uid, "notifications"), orderBy("at", "desc"), limit(MAX_NOTIFICATIONS));
  return onSnapshot(rows, { includeMetadataChanges: true }, (snapshot) => {
    onRows(snapshot.docs.flatMap((row: QueryDocumentSnapshot<DocumentData>) => {
      const parsed = parseNotificationDocument(row.id, row.data({ serverTimestamps: "estimate" }));
      return parsed ? [parsed] : [];
    }));
  }, onError);
}

export async function markNotificationRead(uid: string, notificationId: string): Promise<void> {
  if (!isOwner(uid)) throw new Error("notifications-owner-required");
  if (!notificationId || notificationId.includes("/")) throw new Error("notifications-invalid-id");
  await updateDoc(doc(db, "users", uid, "notifications", notificationId), { read: true });
}
