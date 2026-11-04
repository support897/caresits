import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, where, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { auth, db, loadProfile, t, type Person } from "@cc/core";
import type { BookingRecord } from "./bookings";
import { mediaAttachmentKind } from "../../../../packages/core/src/media/upload";
import { filterChatsByTab, getUnreadCount, mergeMessageStreams, messageCollectionPath, timeMs, type ChatFilter, type ChatMessage, type RelationshipRow } from "../../../../packages/core/src/chat/merge";

export type Relationship = RelationshipRow & { members: string[]; state: string; [key: string]: unknown };
export type ChatPerson = { uid: string; name: string; photoUrl?: string; side?: string; profile?: Person | null };
export type ChatRow = { rel: Relationship; otherUid: string; person: ChatPerson; latest: ChatMessage | null; unread: number };
const OUTBOX_KEY = "caresits-chat-outbox-v1";
const OUTBOX_EVENT = "caresits-chat-outbox-change";
const CHAT_SEEN_EVENT = "caresits-chat-seen-change";
const ACTIVE_STATES = new Set(["contact", "hired"]);
const FLUSHING_UIDS = new Set<string>();
export function canSendChat(state: string, blocked: boolean, blockStatusReady: boolean): boolean {
  return blockStatusReady && !blocked && ACTIVE_STATES.has(state);
}
export type QueuedMessage = { id: string; meUid: string; relId: string; text: string; queuedAt: number };
const SAFE_UID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_REL_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_QUEUE_ID = /^[A-Za-z0-9_-]{1,160}$/;
const BOOKING_STATES = new Set(["requested", "accepted", "declined", "cancelled", "completed"]);

export function isSafeChatMediaKey(key: string, uid: string): boolean {
  if (!SAFE_UID.test(uid) || !mediaAttachmentKind(key)) return false;
  const ownerPrefix = `users/${uid}/`;
  if (!key.startsWith(ownerPrefix)) return false;
  return /^users\/[A-Za-z0-9_-]{1,128}\/gallery\/photo-[A-Za-z0-9_-]{1,80}\.jpg$/.test(key)
    || /^users\/[A-Za-z0-9_-]{1,128}\/attachments\/attachment-[A-Za-z0-9_-]{1,80}\.(?:jpg|pdf)$/.test(key);
}

export function normalizeChatOutbox(value: unknown): QueuedMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): QueuedMessage[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<QueuedMessage>;
    if (typeof row.id !== "string" || !SAFE_QUEUE_ID.test(row.id)
      || typeof row.meUid !== "string" || !SAFE_UID.test(row.meUid)
      || typeof row.relId !== "string" || !SAFE_REL_ID.test(row.relId)
      || typeof row.text !== "string" || !row.text.trim() || row.text.length > 1000
      || typeof row.queuedAt !== "number" || !Number.isFinite(row.queuedAt) || row.queuedAt <= 0) return [];
    return [{ id: row.id, meUid: row.meUid, relId: row.relId, text: row.text, queuedAt: row.queuedAt }];
  }).slice(0, 100);
}

export function mapChatBooking(id: string, pairId: string, value: Record<string, unknown>): BookingRecord {
  const rawState = String(value.state ?? "requested");
  const parsedRate = Number(value.rate ?? 0);
  const parsedEstimate = Number(value.estimate ?? 0);
  return {
    id,
    pairId,
    familyUid: String(value.familyUid ?? ""),
    carerUid: String(value.carerUid ?? ""),
    date: String(value.date ?? ""),
    from: String(value.from ?? ""),
    to: String(value.to ?? ""),
    rate: Number.isFinite(parsedRate) ? parsedRate : 0,
    estimate: Number.isFinite(parsedEstimate) ? parsedEstimate : 0,
    recurring: value.recurring === "weekly" ? "weekly" : "none",
    weekdays: Array.isArray(value.weekdays) ? value.weekdays.map(String).slice(0, 7) : [],
    ...(typeof value.note === "string" ? { note: value.note.slice(0, 1000) } : {}),
    state: BOOKING_STATES.has(rawState) ? rawState as BookingRecord["state"] : "requested",
    ...(typeof value.createdBy === "string" ? { createdBy: value.createdBy } : {}),
    createdAt: value.createdAt,
    decidedAt: value.decidedAt,
  };
}

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
  // Rules can prove membership from the role-specific field, but not from a members-only query.
  const path = await getDocs(query(collection(db, "relationships"), where(`${side}Uid`, "==", uid)));
  const byId = new Map<string, Relationship>();
  for (const snap of path.docs) byId.set(snap.id, asRelationship(snap));
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

export async function loadRelationshipBookings(uid: string, otherUid: string, relId: string): Promise<BookingRecord[]> {
  if (!SAFE_UID.test(uid) || auth().currentUser?.uid !== uid || !SAFE_UID.test(otherUid) || uid === otherUid || !SAFE_REL_ID.test(relId)) return [];
  const relationship = await getDoc(doc(db, "relationships", relId));
  if (!relationship.exists()) return [];
  const data = relationship.data();
  const members = Array.isArray(data.members) ? data.members.map(String) : [String(data.familyUid ?? ""), String(data.carerUid ?? "")];
  const pair = [String(data.familyUid ?? ""), String(data.carerUid ?? "")];
  if (!members.includes(uid) || !members.includes(otherUid) || !pair.includes(uid) || !pair.includes(otherUid)) return [];
  const rows = await getDocs(collection(db, "relationships", relId, "bookings"));
  return rows.docs.map((row) => mapChatBooking(row.id, relId, row.data())).filter((row) => row.familyUid === pair[0] && row.carerUid === pair[1])
    .sort((a, b) => `${b.date} ${b.from}`.localeCompare(`${a.date} ${a.from}`));
}

export function watchBlockedPerson(uid: string, otherUid: string, callback: (blocked: boolean | null) => void): () => void {
  if (!SAFE_UID.test(uid) || !SAFE_UID.test(otherUid) || uid === otherUid || auth().currentUser?.uid !== uid) { callback(null); return () => {}; }
  return onSnapshot(doc(db, "users", uid, "blocks", otherUid), (snapshot) => callback(snapshot.exists()), () => callback(null));
}

function readOutbox(): QueuedMessage[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]"); return normalizeChatOutbox(value); }
  catch { return []; }
}
function writeOutbox(rows: QueuedMessage[]): boolean {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(normalizeChatOutbox(rows))); }
  catch { return false; }
  try { globalThis.dispatchEvent(new Event(OUTBOX_EVENT)); } catch { /* browser event target is optional */ }
  return true;
}
function queueText(uid: string, relId: string, text: string): ChatMessage | null {
  const item: QueuedMessage = { id: globalThis.crypto?.randomUUID?.() ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`, meUid: uid, relId, text, queuedAt: Date.now() };
  if (!writeOutbox([...readOutbox(), item])) return null;
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
  if (!SAFE_UID.test(uid) || !SAFE_REL_ID.test(relId)) return { ok: false };
  const kind = message.kind ?? "text";
  const text = String(message.text ?? "").trim();
  if (text.length > 1000 || (kind === "text" && !text)) return { ok: false };
  if (kind === "photo" && (!message.img || !isSafeChatMediaKey(message.img, uid))) return { ok: false };
  if (auth().currentUser?.uid !== uid) return { ok: false };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (kind === "text") {
      const queuedMessage = queueText(uid, relId, text);
      return queuedMessage ? { ok: true, queued: true, message: queuedMessage } : { ok: false };
    }
    return { ok: false };
  }
  try {
    const saved = await addDoc(collection(db, "relationships", relId, "messages"), {
      from: uid,
      kind,
      text,
      ...(message.img ? { img: message.img } : {}),
      at: serverTimestamp(),
    });
    return { ok: true, message: { id: saved.id, from: uid, kind, text, ...(message.img ? { img: message.img } : {}), at: Date.now(), pending: true } };
  } catch (error) {
    const code = String((error as { code?: string }).code ?? "");
    if ((typeof navigator !== "undefined" && !navigator.onLine) || ["unavailable", "deadline-exceeded", "network-request-failed"].some((part) => code.includes(part))) {
      if (kind !== "text") return { ok: false };
      const queuedMessage = queueText(uid, relId, text);
      return queuedMessage ? { ok: true, queued: true, message: queuedMessage } : { ok: false };
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
