import { useEffect, useRef, useState } from "react";
import { auth, BackBar, Bunny, loadProfile, t, useNav, type Person } from "@cc/core";
import { Composer } from "../../../../packages/core/src/chat/Composer";
import { MessageList } from "../../../../packages/core/src/chat/MessageList";
import { MediaPicker } from "../../../../packages/core/src/media/MediaPicker";
import { flushChatOutbox, getQueuedMessages, markChatSeen, sendChatMessage, subscribeToMessages, subscribeToOutbox, watchRelationship } from "../data/chat";
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
    setError("");
    if (!uid || !relId || !otherUid) { setState("missing"); return undefined; }
    const stopOutbox = subscribeToOutbox(uid, relId, (items) => { if (live) setQueued(items); });
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
        void flushChatOutbox(uid);
      } else {
        messageStop.current?.();
        messageStop.current = null;
        setMessages([]);
      }
    }, () => { if (live) setError(t("chat.load.error", "Messages could not load. Check your connection and access.")); });
    const retry = () => { void flushChatOutbox(uid); };
    globalThis.addEventListener?.("online", retry);
    return () => {
      live = false;
      stopRelation();
      stopOutbox();
      messageStop.current?.();
      messageStop.current = null;
      globalThis.removeEventListener?.("online", retry);
    };
  }, [uid, relId, otherUid]);

  async function sendText(text: string) {
    if (busy || !activeStates.has(state)) return;
    setBusy(true);
    setNotice("");
    const result = await sendChatMessage(uid, relId, { text });
    setBusy(false);
    if (result.ok && result.queued && result.message) {
      setQueued((current) => [...current.filter((row) => row.id !== result.message?.id), result.message!]);
      setNotice(t("chat.queued.notice", "Message saved on this device and will send when you are back online."));
    } else if (!result.ok) setNotice(t("chat.send.error", "Message did not send. Check your connection and try again."));
  }

  async function sendPhoto(key: string) {
    if (!activeStates.has(state)) return;
    const result = await sendChatMessage(uid, relId, { kind: "photo", img: key });
    setShowPicker(false);
    setNotice(result.ok ? t("chat.photo.sent", "Photo shared in this conversation.") : t("chat.photo.error", "Photo could not be shared. Check your connection."));
  }

  const visible = mergeMessageStreams(messages, queued);
  const stateLabel = activeStates.has(state) ? t("chat.connected", "Connected") : state === "pending" ? t("chat.pending", "Chat opens after the request is accepted.") : state === "missing" ? t("chat.missing", "This chat is not available.") : t("chat.loading", "Opening chat…");

  return <div className="app" style={{ height: "100%", minHeight: 0 }}>
    <BackBar title={name} onBack={nav.back} right={<button type="button" className="chip" onClick={() => nav.push("safety", { uid, otherUid })}>{t("chat.safety.button", "Safety")}</button>} />
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px 8px", borderBlockEnd: "1px solid var(--line)" }}>
      <span className="av">{other?.photoUrl ? <img src={other.photoUrl} alt="" /> : name.slice(0, 1).toUpperCase()}</span>
      <div style={{ minWidth: 0 }}><strong>{name}</strong><div className="muted">{stateLabel}</div></div>
    </div>
    {error && <p role="alert" style={{ margin: "8px 14px", color: "var(--danger)" }}>{error}</p>}
    {!activeStates.has(state) ? <div className="empty" role="status"><Bunny mood="rest" size={80} /><p>{stateLabel}</p><p className="muted">{t("chat.connection.info", "Messages are shared with both people in this care relationship.")}</p></div> : <>
      <MessageList uid={uid} messages={visible} label={t("chat.thread.messages", "Conversation messages")} />
      <div style={{ paddingInline: 12, paddingBlock: 4 }}>
        <button type="button" className="chip" onClick={() => setShowPicker((value) => !value)} aria-expanded={showPicker}>{t("chat.photo.add", "Share a photo")}</button>
        {showPicker && <div style={{ marginBlockStart: 8 }}><MediaPicker kind="gallery" uid={uid} onDone={(key) => void sendPhoto(key)} /></div>}
      </div>
      <Composer onSend={sendText} sending={busy} />
      {notice && <p role="status" style={{ margin: "0 14px 10px", color: "var(--muted)" }}>{notice}</p>}
    </>}
  </div>;
}

