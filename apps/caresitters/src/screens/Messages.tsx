import { useEffect, useMemo, useState } from "react";
import { type Person, Bunny, t, useNav } from "@cc/core";
import { Bell } from "../../../../packages/core/src/notifications/Bell";
import { filterChatsByTab, getUnreadCount, messagePreview, timeMs, type ChatFilter, type ChatMessage } from "../../../../packages/core/src/chat/merge";
import { getChatSeenAt, loadChatPeople, loadRelationships, otherUidFor, subscribeToChatSeen, subscribeToMessages, type ChatPerson, type Relationship } from "../data/chat";

type Params = { me: Person };
const FILTERS: ChatFilter[] = ["All", "Families", "Carers", "Unread", "Requests"];
const labels: Record<ChatFilter, string> = {
  All: t("messages.filter.all", "All"), Families: t("messages.filter.families", "Families"), Carers: t("messages.filter.carers", "Carers"), Unread: t("messages.filter.unread", "Unread"), Requests: t("messages.filter.requests", "Requests"),
};
function initials(name: string): string { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase(); }
function timeLabel(value: unknown): string {
  const ms = timeMs(value);
  return ms ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(ms)) : "";
}

export default function Messages({ params }: { params: Params }) {
  const nav = useNav();
  const { me } = params;
  const [tab, setTab] = useState<ChatFilter>("All");
  const [search, setSearch] = useState("");
  const [relations, setRelations] = useState<Relationship[]>([]);
  const [people, setPeople] = useState<Record<string, ChatPerson>>({});
  const [latest, setLatest] = useState<Record<string, ChatMessage | null>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => subscribeToChatSeen(me.uid, (relId) => {
    setUnread((current) => ({ ...current, [relId]: 0 }));
  }), [me.uid]);

  useEffect(() => {
    let alive = true;
    const stops: Array<() => void> = [];
    setLoading(true);
    setError("");
    void loadRelationships(me.uid, me.side).then(async (rows) => {
      if (!alive) return;
      setRelations(rows);
      const personRows = await loadChatPeople(rows, me.uid);
      if (!alive) return;
      setPeople(personRows);
      rows.filter((rel) => rel.state === "contact" || rel.state === "hired").forEach((rel) => {
        stops.push(subscribeToMessages(rel.id, (messages) => {
          if (!alive) return;
          const last = messages[messages.length - 1] ?? null;
          setLatest((current) => ({ ...current, [rel.id]: last }));
          setUnread((current) => ({ ...current, [rel.id]: getUnreadCount(messages, me.uid, getChatSeenAt(me.uid, rel.id)) }));
        }, () => { if (alive) setUnread((current) => ({ ...current, [rel.id]: 0 })); }));
      });
    }).catch(() => { if (alive) setError(t("messages.load.error", "Messages could not load. Check your connection and try again.")); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; stops.forEach((stop) => stop()); };
  }, [me.uid, me.side]);

  const rows = useMemo(() => {
    const matched = filterChatsByTab(relations, tab, { uid: me.uid, side: me.side }, unread);
    return matched.map((rel) => {
      const otherUid = otherUidFor(rel, me.uid);
      const person = people[otherUid] ?? { uid: otherUid, name: t("chat.partner", "Care partner") };
      const last = latest[rel.id] ?? null;
      const request = rel.state === "pending";
      const preview = request ? (rel.createdBy === me.uid ? t("messages.request.waiting", "Waiting for a reply") : t("messages.request.incoming", "Connection request")) : messagePreview(last);
      return { rel, otherUid, person, last, preview, unread: unread[rel.id] ?? 0 };
    }).filter((row) => `${row.person.name} ${row.preview}`.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => timeMs(b.last?.at ?? b.rel.createdAt) - timeMs(a.last?.at ?? a.rel.createdAt));
  }, [relations, tab, me.uid, me.side, unread, people, latest, search]);

  const quickPeople = useMemo(() => rows.filter((row) => row.rel.state === "contact" || row.rel.state === "hired").slice(0, 8), [rows]);
  const emptyTitle = tab === "Unread" ? t("messages.empty.title.unread", "All caught up") : t("messages.empty.title", "A quiet space");
  const emptyBody = tab === "Requests" ? t("messages.empty.requests", "Connection requests will show here.") : tab === "Unread" ? t("messages.empty.unread", "New messages will appear here.") : t("messages.empty.all", "When you connect with someone, your chats will show here.");

  return <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--cream)" }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px 8px" }}>
      <div><p className="muted" style={{ margin: 0 }}>{t("messages.kicker", "Your care circle")}</p><h1>{t("messages.title", "Messages")}</h1></div>
      <Bell uid={me.uid} side={me.side} app="caresitters" />
    </header>
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 16px 24px" }}>
      <label htmlFor="messages-search" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>{t("messages.search.label", "Search conversations")}</label>
      <input id="messages-search" className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("messages.search.placeholder", "Search families, carers and chats")} style={{ minHeight: 50 }} />
      {quickPeople.length > 0 && <section aria-label={t("messages.circle.label", "Your care circle")} style={{ marginBlock: 16 }}>
        <p className="muted" style={{ margin: "0 0 8px" }}>{t("messages.circle.title", "Your care circle")}</p>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBlock: 3 }}>
          {quickPeople.map(({ rel, otherUid, person, unread: count }) => <button key={rel.id} type="button" onClick={() => nav.push("chat", { relId: rel.id, otherUid })} aria-label={`${person.name}${count ? `, ${count} unread` : ""}`} style={{ flex: "0 0 72px", display: "grid", justifyItems: "center", gap: 5, minHeight: 78 }}>
            <span className="av" style={{ width: 54, height: 54, position: "relative" }}>{person.photoUrl ? <img src={person.photoUrl} alt="" loading="lazy" /> : initials(person.name)}{count > 0 && <span style={{ position: "absolute", insetInlineEnd: -2, insetBlockStart: -2, width: 16, height: 16, borderRadius: 50, background: "var(--danger)", border: "2px solid var(--cream)" }} />}</span>
            <span style={{ maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}</span>
          </button>)}
        </div>
      </section>}
      <nav aria-label={t("messages.filters.label", "Filter conversations")} style={{ display: "flex", gap: 8, overflowX: "auto", marginBlock: 10, paddingBlock: 2 }}>
        {FILTERS.map((filter) => <button key={filter} type="button" className={`chip${tab === filter ? " on" : ""}`} aria-pressed={tab === filter} onClick={() => setTab(filter)} style={{ flex: "0 0 auto" }}>{labels[filter]}</button>)}
      </nav>
      {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      {loading ? <div aria-busy="true" className="stack"><div className="sk" style={{ height: 86 }} /><div className="sk" style={{ height: 86 }} /></div> : rows.length ? <div style={{ display: "grid" }}>
        {rows.map(({ rel, otherUid, person, last, preview, unread: count }) => <button key={rel.id} type="button" onClick={() => nav.push("chat", { relId: rel.id, otherUid })} aria-label={`${person.name}. ${preview}${count ? `, ${count} unread` : ""}`} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 82, padding: "10px 4px", textAlign: "start", borderBlockEnd: "1px solid var(--line)" }}>
          <span className="av" style={{ width: 54, height: 54 }}>{person.photoUrl ? <img src={person.photoUrl} alt="" loading="lazy" /> : initials(person.name)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}><strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}</strong><time className="muted" style={{ flex: "0 0 auto", fontSize: 15 }}>{last ? timeLabel(last.at) : rel.state === "pending" ? t("messages.request.label", "Request") : ""}</time></span>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</span>{count > 0 && <span className="pip" aria-label={`${count} unread`}>{count > 99 ? "99+" : count}</span>}</span>
          </span>
        </button>)}
      </div> : <div className="empty" style={{ paddingBlock: 22 }}><Bunny mood="hello" size={94} /><h2>{emptyTitle}</h2><p className="muted">{emptyBody}</p></div>}
      <p className="muted center" style={{ marginBlock: 18 }}>{t("messages.private.note", "Every family has its own private space.")}</p>
    </div>
  </div>;
}
