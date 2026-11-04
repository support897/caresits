import "../../lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { Empty, t } from "@cc/core";
import { markSpaceSeen, postSpaceMessage, readSpaceMessages, watchSpaceMessages, type SpaceMessage } from "../../data/chatSpace";
import { flushOfflineQueue } from "../../data/offline";
import { canPost, type SpaceRole } from "../../lib/permissions";
import type { SpaceMember } from "../../data/spaces";

export type ChatPanelProps = { spaceId: string; uid: string; member: SpaceMember; previewMessages?: SpaceMessage[] };

function messageTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function ChatPanel({ spaceId, uid, member, previewMessages }: ChatPanelProps) {
  const [messages, setMessages] = useState<SpaceMessage[]>(previewMessages ?? []);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const role: SpaceRole = member.role;
  const mayRead = role !== "viewer" && (role === "admin" || member.perms?.privateMessages !== false);
  const mayPost = canPost(role) && mayRead;

  const load = useCallback(async () => {
    if (!mayRead) return;
    try {
      const result = await readSpaceMessages(spaceId);
      setMessages(result.messages);
      const latest = result.messages.at(-1);
      if (latest) markSpaceSeen(uid, spaceId, latest.at);
      setNotice("");
    } catch {
      setMessages([]);
      setNotice(t("cs.chat.load.error", "Messages could not load. Check your connection and access."));
    }
  }, [mayRead, spaceId, uid]);

  useEffect(() => {
    if (!mayRead) return;
    if (previewMessages) { setMessages(previewMessages); return; }
    void load();
    const stop = watchSpaceMessages(spaceId, (rows) => {
      setMessages(rows);
      const latest = rows.at(-1);
      if (latest) markSpaceSeen(uid, spaceId, latest.at);
    }, () => {
      setMessages([]);
      setNotice(t("cs.chat.load.error", "Messages could not load. Check your connection and access."));
    });
    const onlineHandler = () => { void flushOfflineQueue(); void load(); };
    window.addEventListener("online", onlineHandler);
    return () => {
      stop();
      window.removeEventListener("online", onlineHandler);
    };
  }, [load, mayRead, previewMessages, spaceId, uid]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => { node.scrollTop = node.scrollHeight; });
    return () => cancelAnimationFrame(frame);
  }, [messages.length]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !mayPost || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await postSpaceMessage(spaceId, uid, role, text);
      setMessages((current) => current.some((message) => message.id === result.message.id) ? current : [...current, result.message]);
      markSpaceSeen(uid, spaceId, result.message.at);
      setDraft("");
      if (result.queued) setNotice(t("cs.chat.queued", "Saved here. It will send when you are back online."));
    } catch {
      setNotice(t("cs.chat.send.error", "Message did not send. Check your connection and try again."));
    } finally { setBusy(false); }
  }

  if (!mayRead) return <div className="scroll" style={{ padding: 16 }}>
    <Empty mood="rest" title={t("cs.chat.private.title", "Private messages are not shared with this role")} body={t("cs.chat.private.body", "A family admin can change this access.")} />
  </div>;

  return <div className="app" style={{ minHeight: 0 }}>
    <div ref={listRef} className="scroll" aria-live="polite" aria-label={t("cs.chat.messages", "Messages")} style={{ flex: 1, minHeight: 0, paddingBottom: 12 }}>
      {messages.length ? <div style={{ display: "grid", gap: 10 }}>
        {messages.map((message) => {
          const own = message.from === uid;
          return <article key={message.id} style={{ justifySelf: own ? "end" : "start", maxWidth: "min(86%, 420px)", background: own ? "var(--soft)" : "var(--card)", border: "1px solid var(--line)", borderRadius: 20, padding: "10px 14px" }}>
            {message.text && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{message.text}</p>}
            {message.img && <img src={message.img} alt={t("cs.chat.photo.alt", "Shared photo")} loading="lazy" style={{ width: "100%", borderRadius: 12 }} />}
            <footer className="muted" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4, fontSize: 15 }}>
              <time>{messageTime(message.at)}</time>
              {own && message.queued && <span>{t("cs.chat.waiting", "Waiting to send")}</span>}
            </footer>
          </article>;
        })}
      </div> : <Empty mood="hello" title={t("cs.chat.empty.title", "A quiet space to talk")} body={t("cs.chat.empty.body", "Messages for this family stay in this private space.")} />}
    </div>
    {notice && <p role="status" style={{ margin: "0 14px 8px", color: "var(--muted)" }}>{notice}</p>}
    {mayPost ? <form onSubmit={(event) => void send(event)} style={{ display: "flex", gap: 8, padding: "8px 12px calc(12px + var(--safe-b))", borderTop: "1px solid var(--line)", background: "var(--cream)" }}>
      <input className="field" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("cs.chat.placeholder", "Write a message")} aria-label={t("cs.chat.placeholder", "Write a message")} />
      <button type="submit" className="btn sm" disabled={!draft.trim() || busy} style={{ flex: "none" }}>{t("cs.chat.send", "Send")}</button>
    </form> : <p className="muted" style={{ margin: "0 14px 12px" }}>{t("cs.chat.readOnly", "You can read this chat but cannot post.")}</p>}
  </div>;
}
