// USAGE: render <ChatList me={me} rels={rels} people={people} onOpen={(other, relId, rel) => ...} /> or <ChatThread me={me} other={other} relId={relId} onBack={...} />.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bunny } from "./bunny.jsx";
import { t } from "./tr.js";
import {
  filterChatsByTab,
  flushChatOutbox,
  getChatSeenAt,
  getUnreadCount,
  listenChatOutbox,
  listenToMessages,
  markChatSeen,
  mergeMessageStreams,
  timeMs,
  watchChat,
  sendChatMessage,
} from "./chat-data.js";
import "./chat.css";

const FILTERS = [
  ["All", "chat.filter.all", "All"],
  ["Families", "chat.filter.families", "Families"],
  ["Carers", "chat.filter.carers", "Carers"],
  ["Unread", "chat.filter.unread", "Unread"],
  ["Requests", "chat.filter.requests", "Requests"],
];
const ACTIVE = new Set(["contact", "hired"]);
const EMPTY_REL = "";

const otherUid = (rel, uid) => {
  if (rel.familyUid && rel.familyUid !== uid) return rel.familyUid;
  if (rel.carerUid && rel.carerUid !== uid) return rel.carerUid;
  return (rel.members || []).find((member) => member !== uid) || "";
};
const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
const formatTime = (value) => {
  const ms = timeMs(value);
  if (!ms) return "";
  try { return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(ms)); }
  catch { return ""; }
};
const formatDay = (value) => {
  const ms = timeMs(value);
  if (!ms) return "";
  try { return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(ms)); }
  catch { return ""; }
};

function Avatar({ person, name, small = false }) {
  const photo = person && person.photoUrl;
  return <span className={"chat-avatar" + (small ? " chat-avatar-small" : "")} aria-hidden="true">
    {photo ? <img src={photo} alt="" loading="lazy" /> : initials(name)}
  </span>;
}

function previewText(message) {
  if (!message) return t("chat.preview.start", "Start a conversation");
  if (message.text) return message.text;
  if (message.kind === "photo") return t("chat.preview.photo", "Photo");
  if (message.kind === "photoAsk") return t("chat.preview.photoRequest", "Photo update request");
  return t("chat.preview.message", "Message");
}

export function ChatList({ me, rels = [], people = [], onOpen }) {
  const [tab, setTab] = useState("All");
  const [unread, setUnread] = useState({});
  const [latest, setLatest] = useState({});
  const uid = me && me.uid;
  const relationList = Array.isArray(rels) ? rels : [];
  const activeRelations = relationList.filter((rel) => rel && ACTIVE.has(rel.state) && rel.id);
  const activeKey = activeRelations.map((rel) => rel.id).sort().join("|");

  useEffect(() => {
    let alive = true;
    setUnread({});
    setLatest({});
    if (!uid) return () => { alive = false; };
    const stops = activeRelations.map((rel) => listenToMessages(rel.id, (messages) => {
      if (!alive) return;
      setLatest((current) => ({ ...current, [rel.id]: messages.length ? messages[messages.length - 1] : null }));
      setUnread((current) => ({
        ...current,
        [rel.id]: getUnreadCount(messages, uid, getChatSeenAt(uid, rel.id)),
      }));
    }, () => {
      if (!alive) return;
      setUnread((current) => ({ ...current, [rel.id]: 0 }));
    }));
    return () => { alive = false; stops.forEach((stop) => stop()); };
  }, [uid, me && me.side, activeKey]);

  const rows = useMemo(() => {
    const matching = filterChatsByTab(relationList, tab, me || {}, unread);
    return matching.map((rel) => {
      const uidOther = otherUid(rel, uid);
      const person = (people || []).find((item) => item && item.uid === uidOther) || {};
      const name = person.name || person.displayName || (person.card && person.card.firstName) || t("chat.partner", "Care partner");
      return { rel, uidOther, person, name, message: latest[rel.id] || null, unreadCount: unread[rel.id] || 0 };
    }).sort((a, b) => timeMs(b.message && b.message.at || b.rel.createdAt) - timeMs(a.message && a.message.at || a.rel.createdAt));
  }, [relationList, tab, me, people, uid, unread, latest]);

  const emptyCopy = tab === "Requests"
    ? t("chat.empty.requests", "Connection requests will show here.")
    : tab === "Unread"
      ? t("chat.empty.unread", "No unread messages. You are all caught up.")
      : tab === "Families"
        ? t("chat.empty.families", "Chats with families will show here.")
        : tab === "Carers"
          ? t("chat.empty.carers", "Chats with carers will show here.")
          : t("chat.empty.all", "When you connect with someone, your chats will show here.");

  return <section className="chat-list" aria-label={t("chat.list.label", "Chats")}>
    <header className="chat-list-head">
      <p className="chat-eyebrow">{t("chat.eyebrow", "Your care circle")}</p>
      <h1>{t("chat.title", "Chats")}</h1>
      <p className="chat-subtitle">{t("chat.subtitle", "Small updates, kept together.")}</p>
    </header>
    <nav className="chat-filters" aria-label={t("chat.filters.label", "Filter chats")}>
      {FILTERS.map(([id, key, label]) => <button
        className={"chat-filter" + (tab === id ? " is-active" : "")}
        type="button"
        key={id}
        aria-pressed={tab === id}
        onClick={() => setTab(id)}
      >{t(key, label)}</button>)}
    </nav>
    {rows.length ? <div className="chat-rows">
      {rows.map(({ rel, uidOther, person, name, message, unreadCount }) => {
        const isRequest = rel.state === "pending";
        const requestText = rel.createdBy === uid
          ? t("chat.request.waiting", "Waiting for a reply")
          : t("chat.request.incoming", "Wants to connect");
        const label = isRequest ? requestText : previewText(message);
        return <button
          className="chat-row"
          type="button"
          key={rel.id || `${rel.familyUid}_${rel.carerUid}`}
          onClick={() => onOpen && onOpen({ ...person, uid: uidOther, name }, rel.id || EMPTY_REL, rel)}
          aria-label={`${name}. ${label}${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Avatar person={person} name={name} />
          <span className="chat-row-copy">
            <span className="chat-row-top">
              <strong>{name}</strong>
              <span className="chat-row-time">{message ? formatTime(message.at) : isRequest ? t("chat.request.label", "Request") : ""}</span>
            </span>
            <span className="chat-row-bottom">
              <span className="chat-preview">{label}</span>
              {unreadCount > 0 && <span className="chat-unread" aria-label={`${unreadCount} unread`}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </span>
          </span>
        </button>;
      })}
    </div> : <div className="chat-empty">
      <Bunny mood="hello" size={104} />
      <h2>{tab === "Unread" ? t("chat.empty.title.unread", "All caught up") : t("chat.empty.title", "A quiet space")}</h2>
      <p>{emptyCopy}</p>
    </div>}
  </section>;
}

export function ChatThread({ me, other, relId, onBack }) {
  const [connectionState, setConnectionState] = useState("loading");
  const [messages, setMessages] = useState([]);
  const [queued, setQueued] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState("");
  const listRef = useRef(null);
  const uid = me && me.uid;
  const name = other && (other.name || other.displayName || (other.card && other.card.firstName)) || t("chat.partner", "Care partner");
  const visibleMessages = useMemo(() => mergeMessageStreams(messages, queued), [messages, queued]);
  const canChat = ACTIVE.has(connectionState) && !loadError;

  useEffect(() => {
    setMessages([]);
    setConnectionState("loading");
    setLoadError(false);
    if (!uid || !relId) {
      setConnectionState("missing");
      return undefined;
    }
    const stopChat = watchChat(relId, {
      uid,
      onState: (state) => {
        setConnectionState(state);
        setLoadError(false);
        if (ACTIVE.has(state)) flushChatOutbox(uid).catch(() => {});
      },
      onMessages: (items) => {
        setMessages(items);
        const last = items[items.length - 1];
        if (last) markChatSeen(uid, relId, last.at);
      },
      onError: () => setLoadError(true),
    });
    const stopOutbox = listenChatOutbox(uid, relId, setQueued);
    const retryOutbox = () => { flushChatOutbox(uid).catch(() => {}); };
    globalThis.addEventListener?.("online", retryOutbox);
    return () => {
      stopChat();
      stopOutbox();
      globalThis.removeEventListener?.("online", retryOutbox);
    };
  }, [uid, relId]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return undefined;
    const frame = requestAnimationFrame(() => { node.scrollTop = node.scrollHeight; });
    return () => cancelAnimationFrame(frame);
  }, [visibleMessages.length, visibleMessages[visibleMessages.length - 1] && visibleMessages[visibleMessages.length - 1].id]);

  async function submit(event) {
    if (event) event.preventDefault();
    const text = draft.trim();
    if (!text || !canChat || sending) return;
    setSending(true);
    setNotice("");
    const result = await sendChatMessage(me, relId, text);
    setSending(false);
    if (result.ok) {
      setDraft("");
      if (result.queued) setNotice(t("chat.queued.notice", "Saved here. It will send when you are back online."));
    } else {
      setNotice(t("chat.send.error", "Message did not send. Check your connection and try again."));
    }
  }

  const stateCopy = connectionState === "contact" || connectionState === "hired"
    ? t("chat.connected", "Connected")
    : connectionState === "pending"
      ? t("chat.pending", "Chat opens after the request is accepted.")
      : connectionState === "ended"
        ? t("chat.ended", "This connection has ended.")
        : connectionState === "missing"
          ? t("chat.missing", "This chat is not available.")
          : t("chat.loading", "Opening chat…");

  return <section className="chat-thread" aria-label={`${t("chat.thread.label", "Chat with")} ${name}`}>
    <header className="chat-thread-head">
      <button className="chat-back" type="button" onClick={() => onBack && onBack()} aria-label={t("chat.back", "Back to chats")}>‹</button>
      <Avatar person={other} name={name} small />
      <span className="chat-thread-person"><strong>{name}</strong><small>{stateCopy}</small></span>
    </header>
    {loadError && <p className="chat-error" role="alert">{t("chat.load.error", "Messages could not load. Check your connection and access.")}</p>}
    {connectionState === "pending" || connectionState === "ended" || connectionState === "missing" ? <div className="chat-gate" role="status"><p>{stateCopy}</p></div> : <>
      <div className="chat-message-list" ref={listRef} aria-live="polite" aria-relevant="additions text">
        {visibleMessages.length ? visibleMessages.map((message, index) => {
          const own = message.from === uid;
          const time = formatTime(message.at);
          const previous = visibleMessages[index - 1];
          const newDay = !previous || new Date(timeMs(previous.at)).toDateString() !== new Date(timeMs(message.at)).toDateString();
          return <React.Fragment key={message.id || `${message.from}-${timeMs(message.at)}-${index}`}>
            {newDay && <div className="chat-day"><span>{formatDay(message.at)}</span></div>}
            <article className={"chat-message" + (own ? " is-own" : " is-other")}>
              {message.img && <img className="chat-photo" src={message.img} alt={t("chat.photo.alt", "Shared photo")} loading="lazy" />}
              {message.text ? <p>{message.text}</p> : message.kind === "photoAsk" ? <p>{t("chat.photo.request", "Photo update requested")}</p> : null}
              <footer><time>{time}</time>{own && <span className="chat-delivery">{message.queued ? t("chat.delivery.queued", "Waiting to send") : message.pending ? t("chat.delivery.sending", "Sending") : t("chat.delivery.sent", "Sent")}</span>}</footer>
            </article>
          </React.Fragment>;
        }) : <div className="chat-first-message"><p>{t("chat.first.message", "Say hello when you are ready.")}</p></div>}
      </div>
      {queued.length > 0 && typeof navigator !== "undefined" && navigator.onLine && <div className="chat-retry">
        <span>{t("chat.retry.note", "Some messages are still waiting to send.")}</span>
        <button type="button" onClick={() => flushChatOutbox(uid)}>{t("chat.retry.button", "Try again")}</button>
      </div>}
      <form className="chat-compose" onSubmit={submit}>
        <label className="chat-compose-label" htmlFor="chat-message-input">{t("chat.compose.label", "Write a message")}</label>
        <textarea
          id="chat-message-input"
          value={draft}
          maxLength={1000}
          rows={1}
          placeholder={t("chat.compose.placeholder", "Write a message…")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(event); } }}
          disabled={!canChat || sending}
        />
        <button className="chat-send" type="submit" disabled={!canChat || sending || !draft.trim()}>{sending ? t("chat.send.sending", "Sending") : t("chat.send.button", "Send")}</button>
      </form>
      {notice && <p className="chat-notice" role="status">{notice}</p>}
    </>}
  </section>;
}
