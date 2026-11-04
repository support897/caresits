import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, where, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { auth, db, loadProfile, t, type Person } from "@cc/core";
import { filterChatsByTab, getUnreadCount, mergeMessageStreams, messageCollectionPath, timeMs, type ChatFilter, type ChatMessage, type RelationshipRow } from "../../../../packages/core/src/chat/merge";

export type Relationship = RelationshipRow & { members: string[]; state: string; [key: string]: unknown };
export type ChatPerson = { uid: string; name: string; photoUrl?: string; side?: string; profile?: Person | null };
export type ChatRow = { rel: Relationship; otherUid: string; person: ChatPerson; latest: ChatMessage | null; unread: number };
const OUTBOX_KEY = "caresits-chat-outbox-v1";
const OUTBOX_EVENT = "caresits-chat-outbox-change";
const CHAT_SEEN_EVENT = "caresits-chat-seen-change";
const ACTIVE_STATES = new Set(["contact", "hired"]);
const FLUSHING_UIDS = new Set<string>();
type QueuedMessage = { id: string; meUid: string; relId: string; text: string; queuedAt: number };

function asRelationship(snap: QueryDocumentSnapshot<DocumentData>): Relationship {
  const value = snap.data();
  return { ...value, id: snap.id, members: Array.isArray(value.members) ? value.members.map(String) : [], state: String(value.state ?? "pending") } as Relationship;
}
export function otherUidFor(rel: RelationshipRow, uid: string): string {
  if (rel.familyUid && rel.familyUid !== uid) return rel.familyUid;
  if (rel.carerUid && rel.carerUid !== uid) return rel.carerUid;
  return rel.members?.find((member) => member !== uid) ?? "";
}

export async function loadRelationships(uid: string, side: "family" | "carer"): Promise<Relationship[]> {
  if (!uid) return [];
  const paths = await Promise.all([
    getDocs(query(collection(db, "relationships"), where(`${side}Uid`, "==", uid))),
    getDocs(query(collection(db, "relationships"), where("members", "array-contains", uid))),
  ]);
  const byId = new Map<string, Relationship>();
  for (const snap of paths.flatMap((path) => path.docs)) byId.set(snap.id, asRelationship(snap));
  return [...byId.values()].sort((a, b) => timeMs(b.createdAt) - timeMs(a.createdAt));
}

export async function loadChatPeople(rels: Relationship[], uid: string): Promise<Record<string, ChatPerson>> {
  const otherUids = [...new Set(rels.map((rel) => otherUidFor(rel, uid)).filter(Boolean))];
  const profiles = await Promise.all(otherUids.map(async (otherUid) => {
    const profile = await loadProfile(otherUid).catch(() => null);
    const person: ChatPerson = {
      uid: otherUid,
      name: profile?.firstName || profile?.name || t("chat.partner", "Care partner"),
      ...(profile?.photoUrl ? { photoUrl: profile.photoUrl } : {}),
      ...(profile?.side ? { side: profile.side } : {}),
      profile,
    };
    return [otherUid, person] as const;
  }));
  return Object.fromEntries(profiles);
}

function fromSnapshot(snap: QueryDocumentSnapshot<DocumentData>): ChatMessage {
  const value = snap.data({ serverTimestamps: "estimate" });
  return { ...value, id: snap.id, from: String(value.from ?? ""), kind: value.kind === "photo" || value.kind === "photoAsk" ? value.kind : "text", pending: snap.metadata.hasPendingWrites } as ChatMessage;
}
export function subscribeToMessages(relId: string, onMessages: (messages: ChatMessage[]) => void, onError: (error: Error) => void = () => {}): () => void {
  try { messageCollectionPath(relId); } catch { onError(new Error("Invalid relationship id")); return () => {}; }
  const q = query(collection(db, "relationships", relId, "messages"), orderBy("at", "asc"));
  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => onMessages(mergeMessageStreams(snapshot.docs.map(fromSnapshot))), (error) => onError(error));
}

export function watchRelationship(relId: string, onState: (state: string) => void, onError: (error: Error) => void = () => {}): () => void {
  if (!relId || relId.includes("/")) { onError(new Error("Invalid relationship id")); return () => {}; }
  return onSnapshot(doc(db, "relationships", relId), (snapshot) => onState(snapshot.exists() ? String(snapshot.data().state ?? "unknown") : "missing"), (error) => onError(error));
}

function readOutbox(): QueuedMessage[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]"); return Array.isArray(value) ? value as QueuedMessage[] : []; }
  catch { return []; }
}
function writeOutbox(rows: QueuedMessage[]) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(rows)); } catch { /* keep the screen usable if local storage is full */ }
  try { globalThis.dispatchEvent(new Event(OUTBOX_EVENT)); } catch { /* browser event target is optional */ }
}
function queueText(uid: string, relId: string, text: string): ChatMessage {
  const item: QueuedMessage = { id: globalThis.crypto?.randomUUID?.() ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`, meUid: uid, relId, text, queuedAt: Date.now() };
  writeOutbox([...readOutbox(), item]);
  return { id: item.id, from: uid, relId, kind: "text", text, at: item.queuedAt, queued: true } as ChatMessage;
}
export function getQueuedMessages(uid: string, relId?: string): ChatMessage[] {
  return readOutbox().filter((item) => item.meUid === uid && (!relId || item.relId === relId)).map((item) => ({ id: item.id, from: uid, kind: "text", text: item.text, at: item.queuedAt, queued: true }));
}
export function subscribeToOutbox(uid: string, relId: string, callback: (messages: ChatMessage[]) => void): () => void {
  const update = () => callback(getQueuedMessages(uid, relId));
  globalThis.addEventListener?.(OUTBOX_EVENT, update);
  globalThis.addEventListener?.("storage", update);
  update();
  return () => { globalThis.removeEventListener?.(OUTBOX_EVENT, update); globalThis.removeEventListener?.("storage", update); };
}
export function getChatSeenAt(uid: string, relId: string): number {
  try { return Number(localStorage.getItem(`caresits-seen-${uid}-${relId}`) ?? 0); } catch { return 0; }
}
export function markChatSeen(uid: string, relId: string, at: unknown): void {
  if (!uid || !relId) return;
  try {
    localStorage.setItem(`caresits-seen-${uid}-${relId}`, String(Math.max(getChatSeenAt(uid, relId), timeMs(at))));
    if (typeof CustomEvent !== "undefined") globalThis.dispatchEvent(new CustomEvent(CHAT_SEEN_EVENT, { detail: { uid, relId } }));
  } catch { /* read state is best effort */ }
}

export function subscribeToChatSeen(uid: string, callback: (relId: string) => void): () => void {
  const prefix = `caresits-seen-${uid}-`;
  const onSeen = (event: Event) => {
    const detail = (event as CustomEvent<{ uid?: string; relId?: string }>).detail;
    if (detail?.uid === uid && detail.relId) callback(detail.relId);
  };
  const onStorage = (event: Event) => {
    const key = (event as StorageEvent).key;
    if (key?.startsWith(prefix)) callback(key.slice(prefix.length));
  };
  globalThis.addEventListener?.(CHAT_SEEN_EVENT, onSeen);
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    globalThis.removeEventListener?.(CHAT_SEEN_EVENT, onSeen);
    globalThis.removeEventListener?.("storage", onStorage);
  };
}

export async function sendChatMessage(uid: string, relId: string, message: { text?: string; kind?: "text" | "photo"; img?: string }): Promise<{ ok: boolean; queued?: boolean; message?: ChatMessage }> {
  if (!uid || !relId || relId.includes("/")) return { ok: false };
  const kind = message.kind ?? "text";
  const text = String(message.text ?? "").trim();
  if (kind === "text" && (!text || text.length > 1000)) return { ok: false };
  if (kind === "photo" && !message.img) return { ok: false };
  if (auth().currentUser?.uid !== uid) return { ok: false };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (kind === "text") return { ok: true, queued: true, message: queueText(uid, relId, text) };
    return { ok: false };
  }
  try {
    const saved = await addDoc(collection(db, "relationships", relId, "messages"), {
      from: uid,
      kind,
      ...(text ? { text } : {}),
      ...(message.img ? { img: message.img } : {}),
      at: serverTimestamp(),
    });
    return { ok: true, message: { id: saved.id, from: uid, kind, ...(text ? { text } : {}), ...(message.img ? { img: message.img } : {}), at: Date.now(), pending: true } };
  } catch (error) {
    const code = String((error as { code?: string }).code ?? "");
    if ((typeof navigator !== "undefined" && !navigator.onLine) || ["unavailable", "deadline-exceeded", "network-request-failed"].some((part) => code.includes(part))) {
      return kind === "text" ? { ok: true, queued: true, message: queueText(uid, relId, text) } : { ok: false };
    }
    return { ok: false };
  }
}

export async function flushChatOutbox(uid: string): Promise<{ sent: number; remaining: number }> {
  const mine = readOutbox().filter((item) => item.meUid === uid);
  if (!uid || !mine.length || FLUSHING_UIDS.has(uid) || (typeof navigator !== "undefined" && !navigator.onLine)) return { sent: 0, remaining: mine.length };
  if (auth().currentUser?.uid !== uid) return { sent: 0, remaining: mine.length };
  FLUSHING_UIDS.add(uid);
  try {
    const sentIds = new Set<string>();
    for (const item of mine) {
      try {
        await addDoc(collection(db, "relationships", item.relId, "messages"), { from: uid, kind: "text", text: item.text, at: serverTimestamp() });
        sentIds.add(item.id);
      } catch { /* keep unsent rows for the next online event */ }
    }
    const remaining = readOutbox().filter((item) => !sentIds.has(item.id));
    writeOutbox(remaining);
    return { sent: sentIds.size, remaining: remaining.filter((item) => item.meUid === uid).length };
  } finally { FLUSHING_UIDS.delete(uid); }
}

export { filterChatsByTab, getUnreadCount, mergeMessageStreams, timeMs };
export type { ChatFilter, ChatMessage, RelationshipRow };
