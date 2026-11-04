import "../../lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { Empty, t } from "@cc/core";
import { MediaPicker } from "@cc/core/src/media/MediaPicker";
import { getPrivateMediaUrl } from "@cc/core/src/media/upload";
import { markSpaceSeen, postSpaceMessage, postSpacePhoto, readSpaceMessages, watchSpaceMessages, type SpaceMessage } from "../../data/chatSpace";
import { loadTeamMembers, type TeamMember } from "../../data/team";
import { flushOfflineQueue } from "../../data/offline";
import { canPost, canSeePhotos, type SpaceRole } from "../../lib/permissions";
import type { SpaceMember } from "../../data/spaces";

export type ChatPanelProps = { spaceId: string; uid: string; member: SpaceMember; previewMessages?: SpaceMessage[]; previewMembers?: TeamMember[] };

function messageTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function MessagePhoto({ photoKey }: { photoKey: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    void getPrivateMediaUrl(photoKey).then((value) => { if (alive && value) setUrl(value); }).catch(() => {});
    return () => { alive = false; };
  }, [photoKey]);
  return url
    ? <img src={url} alt={t("cs.chat.photo.alt", "Shared photo")} loading="lazy" style={{ display: "block", width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12, marginTop: 6 }} />
    : <p className="muted" role="status" style={{ margin: "6px 0 0" }}>{t("cs.chat.photo.loading", "Loading private photo…")}</p>;
}

export function ChatPanel({ spaceId, uid, member, previewMessages, previewMembers }: ChatPanelProps) {
  const [messages, setMessages] = useState<SpaceMessage[]>(previewMessages ?? []);
  const [team, setTeam] = useState<TeamMember[]>(previewMembers ?? []);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" || navigator.onLine);
  const listRef = useRef<HTMLDivElement>(null);
  const role: SpaceRole = member.role;
  const mayRead = role !== "viewer" && (role === "admin" || member.perms?.privateMessages !== false);
  const mayPost = canPost(role) && mayRead;
  const maySharePhotos = mayPost && canSeePhotos(role, member.perms);

  useEffect(() => {
    if (!mayRead) { setTeam([]); return; }
    if (previewMembers) { setTeam(previewMembers); return; }
    let alive = true;
    void loadTeamMembers(spaceId).then((rows) => { if (alive) setTeam(rows); }).catch(() => { if (alive) setTeam([]); });
    return () => { alive = false; };
  }, [mayRead, previewMembers, spaceId]);

  const load = useCallback(async () => {
    if (!mayRead) return;
    try {
      const result = await readSpaceMessages(spaceId);
      setMessages(result.messages);
      setFromCache(result.fromCache);
      setOnline((typeof navigator === "undefined" || navigator.onLine) && !result.fromCache);
      const latest = result.messages.at(-1);
      if (latest) markSpaceSeen(uid, spaceId, latest.at);
      setNotice("");
    } catch {
      setOnline(typeof navigator === "undefined" || navigator.onLine);
      setNotice(t("cs.chat.load.error", "Messages could not load. Check your connection and access."));
    }
  }, [mayRead, spaceId, uid]);

  useEffect(() => {
    if (!mayRead) return;
    if (previewMessages) { setMessages(previewMessages); setFromCache(false); setOnline(true); return; }
    void load();
    const stop = watchSpaceMessages(spaceId, (rows) => {
      setMessages(rows);
      setFromCache(false);
      setOnline(true);
      setNotice("");
      const latest = rows.at(-1);
      if (latest) markSpaceSeen(uid, spaceId, latest.at);
    }, () => {
      setOnline(typeof navigator === "undefined" || navigator.onLine);
      setNotice(t("cs.chat.load.error", "Messages could not load. Check your connection and access."));
    });
    const onlineHandler = () => { setOnline(true); void flushOfflineQueue(); void load(); };
    const offlineHandler = () => { setOnline(false); void load(); };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      stop();
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
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

  async function sendPhoto(photoKey: string) {
    if (!maySharePhotos || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await postSpacePhoto(spaceId, uid, role, photoKey, member.perms);
      setMessages((current) => current.some((message) => message.id === result.message.id) ? current : [...current, result.message]);
      markSpaceSeen(uid, spaceId, result.message.at);
      if (result.queued) setNotice(t("cs.chat.queued", "Saved here. It will send when you are back online."));
    } catch {
      setNotice(t("cs.chat.photo.send.error", "Photo did not share. Check your access and try again."));
    } finally { setBusy(false); }
  }

  if (!mayRead) return <div className="scroll" style={{ padding: 16 }}>
    <Empty mood="rest" title={t("cs.chat.private.title", "Private messages are not shared with this role")} body={t("cs.chat.private.body", "A family admin can change this access.")} />
  </div>;

  return <div className="app" style={{ minHeight: 0 }}>
    {!online && fromCache && <p role="status" className="card" style={{ margin: "8px 12px 0", padding: 12, background: "var(--soft)" }}>{t("cs.offline.banner", "You're offline - showing saved copy")}</p>}
    {!online && !fromCache && <p role="status" className="card" style={{ margin: "8px 12px 0", padding: 12, background: "var(--soft)" }}>{t("cs.offline.empty", "You're offline. No saved copy is on this device yet.")}</p>}
    <div ref={listRef} className="scroll" aria-live="polite" aria-label={t("cs.chat.messages", "Messages")} style={{ flex: 1, minHeight: 0, paddingBottom: 12 }}>
      {messages.length ? <div style={{ display: "grid", gap: 10 }}>
        {messages.map((message) => {
          const own = message.from === uid;
          const sender = own ? t("cs.chat.you", "You") : team.find((person) => person.uid === message.from)?.displayName ?? t("cs.chat.teamMember", "Care team member");
          return <article key={message.id} style={{ justifySelf: own ? "end" : "start", maxWidth: "min(86%, 420px)", background: own ? "var(--soft)" : "var(--card)", border: "1px solid var(--line)", borderRadius: 20, padding: "10px 14px" }}>
            <p className="muted" style={{ margin: "0 0 4px", fontSize: 17 }}>{sender}</p>
            {message.text && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{message.text}</p>}
            {message.img && (maySharePhotos
              ? <MessagePhoto photoKey={message.img} />
              : <p className="muted" style={{ margin: "6px 0 0" }}>{t("cs.chat.photo.hidden", "Photo not shared with this role")}</p>)}
            <footer className="muted" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4, fontSize: 17 }}>
              <time dateTime={message.at}>{messageTime(message.at)}</time>
              {own && message.queued && <span>{t("cs.chat.waiting", "Waiting to send")}</span>}
            </footer>
          </article>;
        })}
      </div> : <Empty mood="hello" title={t("cs.chat.empty.title", "A quiet space to talk")} body={t("cs.chat.empty.body", "Messages for this family stay in this private space.")} />}
    </div>
    {notice && <p role="status" style={{ margin: "0 14px 8px", color: "var(--muted)" }}>{notice}</p>}
    {mayPost ? <div style={{ padding: "8px 12px calc(12px + var(--safe-b))", borderTop: "1px solid var(--line)", background: "var(--cream)" }}>
      <form onSubmit={(event) => void send(event)} style={{ display: "flex", gap: 8 }}>
        <input className="field" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("cs.chat.placeholder", "Write a message")} aria-label={t("cs.chat.placeholder", "Write a message")} maxLength={1000} style={{ minWidth: 0, flex: 1 }} />
        <button type="submit" className="btn sm" disabled={!draft.trim() || busy} style={{ flex: "none" }}>{t("cs.chat.send", "Send")}</button>
      </form>
      {maySharePhotos && <div style={{ marginTop: 8 }}><MediaPicker kind="gallery" uid={uid} spaceId={spaceId} buttonLabel={t("cs.chat.addPhoto", "Share a photo")} onDone={(key) => void sendPhoto(key)} /></div>}
    </div> : <p className="muted" style={{ margin: "0 14px 12px" }}>{t("cs.chat.readOnly", "You can read this chat but cannot post.")}</p>}
  </div>;
}
