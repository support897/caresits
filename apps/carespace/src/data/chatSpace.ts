import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@cc/core";
import { canPost, type MemberPermissions, type SpaceRole } from "../lib/permissions";
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
const chatKey = (spaceId: string) => `chat:${spaceId}`;
const seenKey = (uid: string, spaceId: string) => `caresits-cs-seen:${uid}:${spaceId}`;
const makeId = () => globalThis.crypto?.randomUUID?.().replaceAll("-", "") ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function sortMessages(messages: SpaceMessage[]): SpaceMessage[] {
  return messages.sort((left, right) => left.at.localeCompare(right.at));
}

export async function readSpaceMessages(spaceId: string): Promise<SpaceChatRead> {
  const cached = readSnapshot<SpaceMessage[]>(chatKey(spaceId));
  if (typeof navigator !== "undefined" && !navigator.onLine) return { messages: cached?.data ?? [], fromCache: cached !== null };
  try {
    const result = await getDocs(collection(db, "careSpaces", spaceId, "messages"));
    const messages = sortMessages(result.docs.map((snapshot) => ({ ...snapshot.data(), id: snapshot.id } as SpaceMessage)));
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
    const messages = sortMessages(snapshot.docs.map((row) => ({ ...row.data(), id: row.id } as SpaceMessage)));
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
  const message: SpaceMessage = { id: makeId(), from: uid, text: clean, at: new Date().toISOString(), kind: "text" };
  const { id, ...data } = message;
  const cached = readSnapshot<SpaceMessage[]>(chatKey(spaceId));
  saveSnapshot(chatKey(spaceId), sortMessages([...(cached?.data ?? []), message]));
  const result = await writeSpaceDocument({ path: `careSpaces/${spaceId}/messages/${id}`, method: "set", data });
  return { message: { ...message, queued: result.queued }, queued: result.queued };
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
