import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@cc/core";
import { canPost, canSeePhotos, type MemberPermissions, type SpaceRole } from "../lib/permissions";
import { isConnectivityError, readSnapshot, saveSnapshot, writeSpaceDocument } from "./offline";

export type SpaceMessage = {
  id: string;
  from: string;
  text: string;
  at: string;
  kind: "text" | "photo";
  img?: string;
  queued?: boolean;
};
export type SpaceChatRead = { messages: SpaceMessage[]; fromCache: boolean };
export type InboxFilter = "All" | "Families" | "Carers" | "Unread" | "Requests";
type InboxRowLike = { space: { ownerUid: string }; unread: number; hasRequest: boolean };
const chatKey = (spaceId: string) => `chat:${spaceId}`;
const seenKey = (uid: string, spaceId: string) => `caresits-cs-seen:${uid}:${spaceId}`;
const makeId = () => globalThis.crypto?.randomUUID?.().replaceAll("-", "") ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function isCareSpaceGalleryPhotoKey(spaceId: string, photoKey: string): boolean {
  const parts = photoKey.split("/");
  return parts.length === 4 && parts[0] === "spaces" && parts[1] === spaceId && parts[2] === "gallery"
    && /^photo-[A-Za-z0-9_-]+\.jpg$/.test(parts[3] ?? "");
}

export function filterInboxRows<T extends InboxRowLike>(rows: readonly T[], filter: InboxFilter, uid: string): T[] {
  return rows.filter((row) => {
    if (filter === "Families") return row.space.ownerUid !== uid;
    if (filter === "Carers") return row.space.ownerUid === uid;
    if (filter === "Unread") return row.unread > 0;
    if (filter === "Requests") return row.hasRequest;
    return true;
  });
}

function messageTimestamp(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
    } catch { return ""; }
  }
  return "";
}

export function normalizeSpaceMessage(id: string, data: Record<string, unknown>): SpaceMessage {
  return {
    id,
    from: typeof data.from === "string" ? data.from : "",
    text: typeof data.text === "string" ? data.text : "",
    at: messageTimestamp(data.at),
    kind: data.kind === "photo" ? "photo" : "text",
    ...(typeof data.img === "string" ? { img: data.img } : {}),
    ...(data.queued === true ? { queued: true } : {}),
  };
}

function sortMessages(messages: SpaceMessage[]): SpaceMessage[] {
  return messages.sort((left, right) => left.at.localeCompare(right.at));
}

export async function readSpaceMessages(spaceId: string): Promise<SpaceChatRead> {
  const cached = readSnapshot<SpaceMessage[]>(chatKey(spaceId));
  if (typeof navigator !== "undefined" && !navigator.onLine) return { messages: cached?.data ?? [], fromCache: cached !== null };
  try {
    const result = await getDocs(collection(db, "careSpaces", spaceId, "messages"));
    const messages = sortMessages(result.docs.map((snapshot) => normalizeSpaceMessage(snapshot.id, snapshot.data())));
    saveSnapshot(chatKey(spaceId), messages);
    return { messages, fromCache: false };
  } catch (error) {
    if (!isConnectivityError(error)) throw error;
    return { messages: cached?.data ?? [], fromCache: cached !== null };
  }
}

export function watchSpaceMessages(
  spaceId: string,
  onMessages: (messages: SpaceMessage[]) => void,
  onError: () => void = () => {},
): () => void {
  return onSnapshot(collection(db, "careSpaces", spaceId, "messages"), (snapshot) => {
    const messages = sortMessages(snapshot.docs.map((row) => normalizeSpaceMessage(row.id, row.data())));
    saveSnapshot(chatKey(spaceId), messages);
    onMessages(messages);
  }, () => onError());
}

export async function postSpaceMessage(
  spaceId: string,
  uid: string,
  role: SpaceRole,
  text: string,
): Promise<{ message: SpaceMessage; queued: boolean }> {
  if (!canPost(role)) throw new Error("Family viewers cannot post messages.");
  const clean = text.trim();
  if (!clean) throw new Error("Write a message first.");
  if (clean.length > 1000) throw new Error("Messages must be 1,000 characters or fewer.");
  const message: SpaceMessage = { id: makeId(), from: uid, text: clean, at: new Date().toISOString(), kind: "text" };
  const { id, ...data } = message;
  const result = await writeSpaceDocument({ path: `careSpaces/${spaceId}/messages/${id}`, method: "set", data });
  const cached = readSnapshot<SpaceMessage[]>(chatKey(spaceId));
  const saved = { ...message, ...(result.queued ? { queued: true } : {}) };
  saveSnapshot(chatKey(spaceId), sortMessages([...(cached?.data ?? []), saved]));
  return { message: saved, queued: result.queued };
}

export async function postSpacePhoto(
  spaceId: string,
  uid: string,
  role: SpaceRole,
  photoKey: string,
  perms?: MemberPermissions,
): Promise<{ message: SpaceMessage; queued: boolean }> {
  if (!canPost(role) || !canSeePhotos(role, perms)) throw new Error("This role cannot share photos.");
  if (!isCareSpaceGalleryPhotoKey(spaceId, photoKey)) {
    throw new Error("Choose a photo uploaded to this Care Space.");
  }
  const message: SpaceMessage = { id: makeId(), from: uid, text: "", at: new Date().toISOString(), kind: "photo", img: photoKey };
  const { id, ...data } = message;
  const result = await writeSpaceDocument({ path: `careSpaces/${spaceId}/messages/${id}`, method: "set", data });
  const cached = readSnapshot<SpaceMessage[]>(chatKey(spaceId));
  const saved = { ...message, ...(result.queued ? { queued: true } : {}) };
  saveSnapshot(chatKey(spaceId), sortMessages([...(cached?.data ?? []), saved]));
  return { message: saved, queued: result.queued };
}

export function getSpaceSeenAt(uid: string, spaceId: string): string {
  try { return localStorage.getItem(seenKey(uid, spaceId)) ?? ""; }
  catch { return ""; }
}

export function markSpaceSeen(uid: string, spaceId: string, at: string): void {
  try { localStorage.setItem(seenKey(uid, spaceId), at); }
  catch { /* Seen time is a local convenience only. */ }
}

export async function readSpaceChatPreview(spaceId: string, uid: string, role: SpaceRole, perms?: MemberPermissions): Promise<{ last: SpaceMessage | null; unread: number }> {
  if (role === "viewer" || (role !== "admin" && perms?.privateMessages === false)) return { last: null, unread: 0 };
  const { messages } = await readSpaceMessages(spaceId);
  const seenAt = getSpaceSeenAt(uid, spaceId);
  return {
    last: messages.at(-1) ?? null,
    unread: messages.filter((message) => message.from !== uid && message.at > seenAt).length,
  };
}
