import { useEffect, useRef, useState } from "react";
import { auth, Bunny, loadProfile, t, useNav, type Person } from "@cc/core";
import { Composer } from "../../../../packages/core/src/chat/Composer";
import { MessageList } from "../../../../packages/core/src/chat/MessageList";
import { MediaPicker } from "../../../../packages/core/src/media/MediaPicker";
import { canSendChat, flushChatOutbox, getQueuedMessages, markChatSeen, sendChatMessage, subscribeToMessages, subscribeToOutbox, watchBlockedPerson, watchRelationship } from "../data/chat";
import { mergeMessageStreams, type ChatMessage } from "../../../../packages/core/src/chat/merge";

type Params = { relId: string; otherUid: string };
const activeStates = new Set(["contact", "hired"]);

export default function Chat({ params }: { params: Params }) {
  const nav = useNav();
  const uid = auth().currentUser?.uid ?? "";
  const { relId, otherUid } = params;
  const [other, setOther] = useState<Person | null>(null);
  const [state, setState] = useState("loading");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [queued, setQueued] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockStatusReady, setBlockStatusReady] = useState(false);
  const [blockStatusError, setBlockStatusError] = useState(false);
  const messageStop = useRef<(() => void) | null>(null);
  const name = other?.firstName || other?.name || t("chat.partner", "Care partner");

  useEffect(() => {
    let live = true;
    setOther(null);
    if (otherUid) void loadProfile(otherUid).then((profile) => { if (live) setOther(profile); }).catch(() => { if (live) setOther(null); });
    return () => { live = false; };
  }, [otherUid]);

  useEffect(() => {
    let live = true;
    setMessages([]);
    setQueued(getQueuedMessages(uid, relId));
    setState("loading");
    setBlocked(false);
    setBlockStatusReady(false);
    setBlockStatusError(false);
    setError("");
    if (!uid || !relId || !otherUid) { setState("missing"); setBlockStatusReady(true); return undefined; }
    const stopOutbox = subscribeToOutbox(uid, relId, (items) => { if (live) setQueued(items); });
    const stopBlocked = watchBlockedPerson(uid, otherUid, (value) => {
      if (!live) return;
      setBlockStatusReady(true);
      setBlocked(value !== false);
      setBlockStatusError(value === null);
    });
    const stopRelation = watchRelationship(relId, (next) => {
      if (!live) return;
      setState(next);
      if (activeStates.has(next)) {
        if (!messageStop.current) messageStop.current = subscribeToMessages(relId, (items) => {
          if (!live) return;
          setMessages(items);
          const last = items[items.length - 1];
          if (last) markChatSeen(uid, relId, last.at);
        }, () => { if (live) setError(t("chat.load.error", "Messages could not load. Check your connection and access.")); });
      } else {
        messageStop.current?.();
        messageStop.current = null;
        setMessages([]);
      }
    }, () => { if (live) setError(t("chat.load.error", "Messages could not load. Check your connection and access.")); });
    return () => {
      live = false;
      stopRelation();
      stopOutbox();
      stopBlocked();
      messageStop.current?.();
      messageStop.current = null;
    };
  }, [uid, relId, otherUid]);

  useEffect(() => {
    if (!uid || !relId || !canSendChat(state, blocked, blockStatusReady)) return undefined;
    void flushChatOutbox(uid);
    const retry = () => { void flushChatOutbox(uid); };
    globalThis.addEventListener?.("online", retry);
    return () => globalThis.removeEventListener?.("online", retry);
  }, [uid, relId, blockStatusReady, blocked, state]);

  async function sendText(text: string) {
    if (busy || !canSendChat(state, blocked, blockStatusReady)) return;
    setBusy(true);
    setNotice("");
    const result = await sendChatMessage(uid, relId, { text });
    setBusy(false);
    if (result.ok && result.queued && result.message) {
      setQueued((current) => [...current.filter((row) => row.id !== result.message?.id), result.message!]);
      setNotice(t("chat.queued.notice", "Message saved on this device and will send when you are back online."));
    } else if (!result.ok) setNotice(t("chat.send.error", "Message did not send. Check your connection and try again."));
  }

  async function sendAttachment(key: string, fileName?: string) {
    if (!canSendChat(state, blocked, blockStatusReady)) return;
    const isPdf = /\.pdf$/i.test(key);
    const result = await sendChatMessage(uid, relId, { kind: "photo", img: key, ...(isPdf ? { text: (fileName || t("chat.file.defaultName", "Shared PDF")).slice(0, 180) } : {}) });
    setShowPicker(false);
    setNotice(result.ok ? isPdf ? t("chat.file.sent", "PDF shared securely in this conversation.") : t("chat.photo.sent", "Photo shared in this conversation.") : isPdf ? t("chat.file.error", "PDF could not be shared. Check your connection.") : t("chat.photo.error", "Photo could not be shared. Check your connection."));
  }

  async function retryQueued() {
    if (!canSendChat(state, blocked, blockStatusReady)) return;
    const result = await flushChatOutbox(uid);
    setQueued(getQueuedMessages(uid, relId));
    setNotice(result.remaining ? t("chat.queue.remaining", "{count} messages still need a connection. Try again when online.", { count: result.remaining }) : t("chat.queue.sent", "Saved messages sent."));
  }

  const visible = mergeMessageStreams(messages, queued);
  const stateLabel = blockStatusError ? t("chat.block.status.error", "Safety status could not be checked. Messaging is paused.") : !blockStatusReady ? t("chat.block.status.checking", "Checking safety settings…") : blocked ? t("chat.blocked", "You blocked this person. New messages are stopped.") : activeStates.has(state) ? t("chat.connected", "Connected") : state === "pending" ? t("chat.pending", "Chat opens after the request is accepted.") : state === "missing" ? t("chat.missing", "This chat is not available.") : t("chat.loading", "Opening chat…");

  return <div className="app" style={{ height: "100%", minHeight: 0, minWidth: 0, overflow: "hidden" }}>
    <header aria-label={t("chat.header.label", "Conversation header")} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 56, padding: "8px 12px", borderBlockEnd: "1px solid var(--line)" }}>
      <button type="button" className="chip" onClick={nav.back} aria-label={t("chat.back", "Back")} style={{ flex: "0 0 48px", width: 48, minWidth: 48, minHeight: 48, padding: 0, justifyContent: "center" }}><span className="flip" aria-hidden="true">‹</span></button>
      <h1 style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 18, overflowWrap: "anywhere" }}>{t("chat.header.title", "Chat")}</h1>
      <button type="button" className="chip" aria-label={t("chat.safety.open", "Open safety tools")} onClick={() => nav.push("safety", { uid, otherUid, relId })} style={{ flex: "0 1 auto", minWidth: 48, minHeight: 48, paddingInline: 12, whiteSpace: "normal", overflowWrap: "anywhere" }}>{t("chat.safety.button", "Safety")}</button>
    </header>
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, padding: "8px 14px", borderBlockEnd: "1px solid var(--line)" }}>
      <span className="av">{other?.photoUrl ? <img src={other.photoUrl} alt="" /> : name.slice(0, 1).toUpperCase()}</span>
      <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}><strong>{name}</strong><div className="muted" role={blocked ? "status" : undefined} style={{ overflowWrap: "anywhere" }}>{stateLabel}</div></div>
    </div>
    {error && <p role="alert" style={{ margin: "8px 14px", color: "var(--danger)" }}>{error}</p>}
    {!activeStates.has(state) ? <div className="empty" role="status"><Bunny mood="rest" size={80} /><p>{stateLabel}</p><p className="muted">{t("chat.connection.info", "Messages are shared with both people in this care relationship.")}</p></div> : <>
      <MessageList uid={uid} messages={visible} label={t("chat.thread.messages", "Conversation messages")} />
      <div style={{ paddingInline: 12, paddingBlock: 4 }}>
        <button type="button" className="btn alt" onClick={() => setShowPicker((value) => !value)} aria-expanded={showPicker} aria-label={t("chat.media.toggle", "Share a photo or PDF")} disabled={!canSendChat(state, blocked, blockStatusReady)} style={{ minHeight: 48 }}>{t("chat.media.share", "Share a photo or PDF")}</button>
        {showPicker && canSendChat(state, blocked, blockStatusReady) && <div style={{ marginBlockStart: 8 }}><MediaPicker kind="attachment" uid={uid} onDone={(key, fileName) => void sendAttachment(key, fileName)} buttonLabel={t("chat.media.choose", "Choose a photo or PDF")} /></div>}
        {queued.length > 0 && canSendChat(state, blocked, blockStatusReady) && typeof navigator !== "undefined" && navigator.onLine && <button type="button" className="chip" onClick={() => void retryQueued()} aria-label={t("chat.queue.retryButton", "Retry sending {count} saved messages", { count: queued.length })} style={{ minHeight: 48, marginBlockStart: 8 }}>{t("chat.queue.retry", "Retry saved messages ({count})", { count: queued.length })}</button>}
      </div>
      <Composer onSend={sendText} sending={busy} disabled={!canSendChat(state, blocked, blockStatusReady)} />
      {notice && <p role="status" style={{ margin: "0 14px 10px", color: "var(--muted)" }}>{notice}</p>}
    </>}
  </div>;
}

