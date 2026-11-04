// USAGE: import watchChat, sendChatMessage, and the pure helpers below from chat.jsx.
// Storage follows the current app2 pair path; the private users/{uid}/messages path is not shared.
// Do not call data.js flushOutbox: it drains caresits-outbox into that owner-only path.
const OUTBOX_KEY = "caresits-chat-outbox-v1";
const OUTBOX_EVENT = "caresits-chat-outbox-change";
const ACTIVE_STATES = new Set(["contact", "hired"]);
const FLUSHING_UIDS = new Set();

export const messageCollectionPath = (relId) => `relationships/${relId}/messages`;

export function timeMs(value) {
  if (value == null) return 0;
  try {
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();
  } catch { return 0; }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mergeMessageStreams(first = [], second = []) {
  const byKey = new Map();
  let sequence = 0;
  for (const message of [...(first || []), ...(second || [])]) {
    if (!message) continue;
    const key = message.id != null
      ? `id:${message.id}`
      : `fallback:${message.from || ""}:${message.kind || ""}:${message.text || ""}:${timeMs(message.at)}`;
    if (!byKey.has(key)) byKey.set(key, { message, sequence: sequence++ });
  }
  return [...byKey.values()]
    .sort((a, b) => timeMs(a.message.at) - timeMs(b.message.at) || a.sequence - b.sequence)
    .map(({ message }) => message);
}

export function getUnreadCount(messages = [], uid, lastSeenAt = 0) {
  const seenAt = timeMs(lastSeenAt);
  return (messages || []).filter((message) =>
    message && message.from !== uid && timeMs(message.at) > seenAt
  ).length;
}

function otherSide(rel, me) {
  const uid = me && me.uid;
  if (rel.familyUid && rel.familyUid !== uid) return "family";
  if (rel.carerUid && rel.carerUid !== uid) return "carer";
  if (me && me.side === "family") return "carer";
  if (me && me.side === "carer") return "family";
  return "";
}

export function filterChatsByTab(rels = [], tab = "All", me = {}, unreadCounts = {}) {
  const seen = new Set();
  const unique = (rels || []).filter((rel) => {
    if (!rel) return false;
    const key = rel.id || `${rel.familyUid || ""}_${rel.carerUid || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (tab === "Requests") return unique.filter((rel) => rel.state === "pending");
  if (tab === "Unread") return unique.filter((rel) => ACTIVE_STATES.has(rel.state) && Number(unreadCounts[rel.id] || 0) > 0);
  if (tab === "Families" || tab === "Carers") {
    const wanted = tab === "Families" ? "family" : "carer";
    return unique.filter((rel) => ACTIVE_STATES.has(rel.state) && otherSide(rel, me) === wanted);
  }
  return unique.filter((rel) => ACTIVE_STATES.has(rel.state));
}

export function getChatSeenAt(uid, relId) {
  try { return Number(localStorage.getItem(`caresits-seen-${uid}-${relId}`) || 0); }
  catch { return 0; }
}

export function markChatSeen(uid, relId, at) {
  if (!uid || !relId) return;
  try {
    const next = Math.max(getChatSeenAt(uid, relId), timeMs(at));
    localStorage.setItem(`caresits-seen-${uid}-${relId}`, String(next));
  } catch { /* local read state is best-effort */ }
}

function readOutbox() {
  try {
    const rows = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

function writeOutbox(rows) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(rows)); } catch { /* keep app usable if storage is full */ }
  try { globalThis.dispatchEvent(new Event(OUTBOX_EVENT)); } catch { /* no browser event target */ }
}

function makeId() {
  try { if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID(); }
  catch { /* use the local fallback */ }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function queueMessage(uid, relId, text) {
  const item = { id: makeId(), meUid: uid, relId, text, queuedAt: Date.now() };
  writeOutbox([...readOutbox(), item]);
  return { ok: true, queued: true, message: { ...item, from: uid, kind: "text", at: item.queuedAt, queued: true } };
}

export function getQueuedMessages(uid, relId) {
  return readOutbox().filter((item) => item.meUid === uid && (!relId || item.relId === relId))
    .map((item) => ({ ...item, from: uid, kind: "text", at: item.queuedAt, queued: true }));
}

export function listenChatOutbox(uid, relId, callback) {
  const refresh = () => callback(getQueuedMessages(uid, relId));
  globalThis.addEventListener?.(OUTBOX_EVENT, refresh);
  globalThis.addEventListener?.("storage", refresh);
  refresh();
  return () => {
    globalThis.removeEventListener?.(OUTBOX_EVENT, refresh);
    globalThis.removeEventListener?.("storage", refresh);
  };
}

async function firestoreDeps() {
  const [{ db, auth }, fs] = await Promise.all([import("./data.js"), import("firebase/firestore")]);
  return { db, auth, fs };
}

function validRelId(relId) {
  return typeof relId === "string" && relId.length > 0 && !relId.includes("/");
}

function toMessageDocs(snapshot) {
  return snapshot.docs.map((docSnap) => ({
    ...docSnap.data({ serverTimestamps: "estimate" }),
    id: docSnap.id,
    pending: Boolean(docSnap.metadata && docSnap.metadata.hasPendingWrites),
  }));
}

export function listenToMessages(relId, onMessages, onError = () => {}) {
  if (!validRelId(relId)) { onError(new Error("Invalid relationship id")); return () => {}; }
  let stopped = false;
  let unsubscribe = () => {};
  firestoreDeps().then(({ db, fs }) => {
    if (stopped) return;
    const query = fs.query(
      fs.collection(db, "relationships", relId, "messages"),
      fs.orderBy("at", "asc"),
    );
    unsubscribe = fs.onSnapshot(query, { includeMetadataChanges: true }, (snapshot) => {
      const all = toMessageDocs(snapshot);
      // The shared pair stream contains both senders; sorting uses the same pure merge helper as tests.
      onMessages(mergeMessageStreams(all, []));
    }, onError);
  }).catch(onError);
  return () => { stopped = true; unsubscribe(); };
}

export function watchChat(relId, { uid, onState = () => {}, onMessages = () => {}, onError = () => {} } = {}) {
  if (!validRelId(relId)) { onError(new Error("Invalid relationship id")); return () => {}; }
  let stopped = false;
  let unsubscribeRel = () => {};
  let unsubscribeMessages = () => {};
  let messagesActive = false;
  const stopMessages = () => {
    unsubscribeMessages();
    unsubscribeMessages = () => {};
    messagesActive = false;
  };
  firestoreDeps().then(({ db, fs, auth }) => {
    if (stopped) return;
    unsubscribeRel = fs.onSnapshot(fs.doc(db, "relationships", relId), (snapshot) => {
      if (!snapshot.exists()) {
        stopMessages();
        onState("missing"); onMessages([]); return;
      }
      const state = snapshot.data().state || "unknown";
      onState(state);
      if (ACTIVE_STATES.has(state)) {
        if (messagesActive) return;
        const query = fs.query(
          fs.collection(db, "relationships", relId, "messages"),
          fs.orderBy("at", "asc"),
        );
        unsubscribeMessages = fs.onSnapshot(query, { includeMetadataChanges: true }, (messagesSnap) => {
          const all = toMessageDocs(messagesSnap);
          const who = auth().currentUser && auth().currentUser.uid || uid || "";
          onMessages(mergeMessageStreams(
            all.filter((message) => message.from === who),
            all.filter((message) => message.from !== who),
          ));
        }, onError);
        messagesActive = true;
      } else {
        stopMessages();
        onMessages([]);
      }
    }, onError);
  }).catch(onError);
  return () => {
    stopped = true;
    stopMessages();
    unsubscribeRel();
  };
}

export async function sendChatMessage(me, relId, value) {
  const text = String(value || "").trim();
  if (!me || !me.uid || !validRelId(relId)) return { ok: false, code: "invalid-chat" };
  if (!text || text.length > 1000) return { ok: false, code: "invalid-message" };
  try {
    const { db, auth, fs } = await firestoreDeps();
    if (!auth().currentUser || auth().currentUser.uid !== me.uid) return { ok: false, code: "signed-out" };
    if (typeof navigator !== "undefined" && !navigator.onLine) return queueMessage(me.uid, relId, text);
    await fs.addDoc(fs.collection(db, "relationships", relId, "messages"), {
      from: me.uid,
      kind: "text",
      text,
      at: fs.serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    const code = String(error && error.code || "");
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    if (offline || ["unavailable", "deadline-exceeded", "network-request-failed"].some((part) => code.includes(part))) {
      return queueMessage(me.uid, relId, text);
    }
    return { ok: false, code: code || "send-failed" };
  }
}

export async function flushChatOutbox(uid) {
  if (!uid || (typeof navigator !== "undefined" && !navigator.onLine)) return { sent: 0, remaining: getQueuedMessages(uid).length };
  if (FLUSHING_UIDS.has(uid)) return { sent: 0, remaining: getQueuedMessages(uid).length };
  const mine = readOutbox().filter((item) => item.meUid === uid);
  if (!mine.length) return { sent: 0, remaining: 0 };
  FLUSHING_UIDS.add(uid);
  try {
    const { db, auth, fs } = await firestoreDeps();
    if (!auth().currentUser || auth().currentUser.uid !== uid) return { sent: 0, remaining: mine.length };
    const sentIds = new Set();
    let sent = 0;
    for (const item of mine) {
      try {
        await fs.addDoc(fs.collection(db, "relationships", item.relId, "messages"), {
          from: uid,
          kind: "text",
          text: item.text,
          at: fs.serverTimestamp(),
        });
        sent += 1;
        sentIds.add(item.id);
      } catch { /* keep failed messages for another retry */ }
    }
    const latest = readOutbox().filter((item) => !sentIds.has(item.id));
    writeOutbox(latest);
    return { sent, remaining: latest.filter((item) => item.meUid === uid).length };
  } catch {
    return { sent: 0, remaining: mine.length };
  } finally {
    FLUSHING_UIDS.delete(uid);
  }
}
