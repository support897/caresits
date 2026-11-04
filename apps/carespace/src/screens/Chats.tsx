import "../lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Chip, Empty, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { readCalendar } from "../data/calendar";
import { filterInboxRows, readSpaceChatPreview, type InboxFilter, type SpaceMessage } from "../data/chatSpace";
import { loadChildren } from "../data/children";
import { loadTeamMembers } from "../data/team";
import { createCareSpace, listUserSpaces, type SpaceSummary } from "../data/spaces";

type ChatsParams = { uid: string; name: string };
type SpaceRow = { space: SpaceSummary; last: SpaceMessage | null; unread: number; hasRequest: boolean; childCount: number; memberCount: number };
const FILTERS: Array<[InboxFilter, string, string]> = [
  ["All", "cs.chats.filter.all", "All"],
  ["Families", "cs.chats.filter.families", "Families"],
  ["Carers", "cs.chats.filter.carers", "Carers"],
  ["Unread", "cs.chats.filter.unread", "Unread"],
  ["Requests", "cs.chats.filter.requests", "Requests"],
];
const COLORS = ["var(--soft)", "var(--sage)", "var(--blush)", "var(--butter)"];
const spaceColor = (index: number) => typeof document !== "undefined" && document.body.dataset.theme === "dark"
  ? "var(--soft)" : COLORS[index] ?? "var(--soft)";

function lastActivityTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Screen({ params }: ScreenProps<ChatsParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const uid = params.uid || user?.uid || "";
  const name = params.name || user?.displayName || "";
  const [filter, setFilter] = useState<InboxFilter>("All");
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!uid) { setLoading(false); return; }
    void (async () => {
      const memberships = await listUserSpaces(uid);
      const rows = await Promise.all(memberships.map(async (space): Promise<SpaceRow> => {
        const [preview, calendar, children, members] = await Promise.all([
          readSpaceChatPreview(space.id, uid, space.role, space.perms).catch(() => ({ last: null, unread: 0 })),
          readCalendar(space.id).catch(() => ({ events: [], fromCache: false })),
          loadChildren(space.id).catch(() => []),
          loadTeamMembers(space.id).catch(() => []),
        ]);
        return {
          space,
          last: preview.last,
          unread: preview.unread,
          hasRequest: space.role === "admin" && calendar.events.some((event) => event.kind === "timeoff" && event.state === "requested" && event.ownerUid !== uid),
          childCount: children.length,
          memberCount: members.filter((member) => member.status === "active").length,
        };
      }));
      if (alive) setSpaces(rows);
    })().catch(() => { if (alive) setSpaces([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid]);

  const shown = useMemo(() => {
    const queryText = search.trim().toLocaleLowerCase();
    return filterInboxRows(spaces, filter, uid).filter((row) =>
      !queryText || row.space.name.toLocaleLowerCase().includes(queryText),
    );
  }, [filter, search, spaces, uid]);

  async function newSpace() {
    if (!uid || creating) return;
    setCreating(true);
    setNotice("");
    try {
      const result = await createCareSpace(uid, name);
      if (result.created) nav.push("invite", { spaceId: result.spaceId });
      else nav.push("space", { spaceId: result.spaceId });
    } catch {
      setNotice(t("cs.chats.create.error", "Care Space could not be created. Check your connection and try again."));
    } finally { setCreating(false); }
  }

  const previewText = (row: SpaceRow) => row.last?.text || (row.last?.kind === "photo"
    ? t("cs.chats.photo.preview", "Photo update")
    : t("cs.chats.space.preview", "Your family’s private space"));

  return <div className="scroll">
    <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
      <div>
        <p className="muted" style={{ margin: "0 0 3px" }}>{t("cs.chats.eyebrow", "Your care circle")}</p>
        <h1>{t("cs.chats.title", "Chats")}</h1>
      </div>
      <div className="row" role="group" aria-label={t("cs.chats.actions", "Chat actions")} style={{ gap: 8 }}>
        <button type="button" className="chip" onClick={() => nav.push("join", {})}>{t("cs.chats.join", "Join with code")}</button>
        <button type="button" className="chip" onClick={() => nav.push("notifications", { uid })} aria-label={t("cs.chats.notifications", "Notifications")}>{t("cs.chats.notifications.short", "Alerts")}</button>
        <button type="button" onClick={() => nav.push("profile", { uid, name, email: user?.email ?? "" })}
          aria-label={t("cs.chats.account", "Open profile and account settings")}
          style={{ width: 44, height: 44, borderRadius: "50%", padding: 0, flex: "none" }}>
          <Avatar name={name || t("cs.chats.you", "You")} url={user?.photoURL ?? undefined} size={44} />
        </button>
      </div>
    </header>
    <p style={{ margin: "0 0 14px" }}>{t("cs.chats.subtitle", "Every family has its own private space.")}</p>
    {spaces.length > 0 && <div role="list" aria-label={t("cs.chats.quick.label", "Quick access to care spaces")} style={{ display: "flex", flexWrap: "nowrap", gap: 10, overflowX: "auto", maxWidth: "100%", margin: "0 -16px 14px", padding: "2px 16px 8px" }}>
      {spaces.map((row) => <div key={row.space.id} role="listitem" style={{ flex: "0 0 84px" }}>
        <button type="button" onClick={() => nav.push("space", { spaceId: row.space.id })}
          aria-label={t("cs.chats.quick.open", "Open {name}", { name: row.space.name })}
          style={{ width: "100%", minHeight: 84, display: "grid", justifyItems: "center", alignContent: "center", gap: 4, padding: 8, borderRadius: 16, background: "var(--card)", border: "1px solid var(--line)" }}>
          <span className="av" aria-hidden="true" style={{ width: 44, height: 44, color: "var(--text)", background: spaceColor(row.space.colorIndex) }}>{row.space.name.slice(0, 1).toUpperCase()}</span>
          <span style={{ width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{row.space.name}</span>
        </button>
      </div>)}
    </div>}
    <label htmlFor="care-space-search" style={{ display: "block", marginBottom: 12 }}>
      <span className="muted" style={{ display: "block", marginBottom: 6 }}>{t("cs.chats.search.label", "Search spaces")}</span>
      <input id="care-space-search" className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("cs.chats.search.placeholder", "Search family names")} />
    </label>
    <div className="row" role="tablist" aria-label={t("cs.chats.filter.label", "Filter spaces")} style={{ gap: 8, marginBottom: 14 }}>
      {FILTERS.map(([value, key, label]) => <Chip key={value} on={filter === value} role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}>{t(key, label)}</Chip>)}
    </div>
    {notice && <p role="status" style={{ color: "var(--danger)", margin: "0 0 12px" }}>{notice}</p>}
    <Button alt onClick={() => void newSpace()} disabled={creating} style={{ marginBottom: 14 }}>{creating ? t("cs.chats.creating", "Creating space…") : t("cs.chats.new", "New Care Space")}</Button>
    {loading ? <div className="sk" style={{ height: 120, marginTop: 8 }} />
      : shown.length ? <div style={{ display: "grid", gap: 10 }}>
        {shown.map((row) => {
          const side = row.space.ownerUid === uid ? t("cs.chats.tag.carer", "Carer") : t("cs.chats.tag.family", "Family");
          const childCount = row.childCount === 1 ? t("cs.chats.count.oneChild", "1 child") : t("cs.chats.count.children", "{count} children", { count: row.childCount });
          const memberCount = row.memberCount === 1 ? t("cs.chats.count.oneMember", "1 team member") : t("cs.chats.count.members", "{count} team members", { count: row.memberCount });
          const summary = t("cs.chats.summary", "{children} · {members}", { children: childCount, members: memberCount });
          const unreadLabel = row.unread ? t("cs.chats.unread.count", "{count} unread messages", { count: row.unread }) : t("cs.chats.unread.none", "No unread messages");
          return <button key={row.space.id} type="button" className="card" onClick={() => nav.push("space", { spaceId: row.space.id })}
            aria-label={t("cs.chats.card.label", "{name}. {side}. {summary}. {last}. Active. {unread}", { name: row.space.name, side, summary, last: previewText(row), unread: unreadLabel })}
            style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, textAlign: "start", padding: 14 }}>
            <div className="av" aria-hidden="true" style={{ width: 52, height: 52, fontSize: 21, color: "var(--text)", background: spaceColor(row.space.colorIndex) }}>{row.space.name.slice(0, 1).toUpperCase()}</div>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                <strong style={{ overflowWrap: "anywhere" }}>{row.space.name}</strong>
                <span className="tag" style={{ background: spaceColor(row.space.colorIndex), color: "var(--text)", whiteSpace: "nowrap", fontSize: 17 }}>{side}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap", gap: 8, marginTop: 4 }}>
                <span style={{ minWidth: 0, flex: 1, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewText(row)}</span>
                {row.last && <time className="muted" dateTime={row.last.at} style={{ flex: "none" }}>{lastActivityTime(row.last.at)}</time>}
              </span>
              <span className="muted" style={{ display: "block", marginTop: 4 }}>{summary}</span>
              <span className="tag good" style={{ display: "inline-block", marginTop: 6, fontSize: 17 }}>{t("cs.chats.active", "Active")}</span>
              {row.hasRequest && <span className="tag good" style={{ display: "inline-block", marginTop: 6, marginInlineStart: 6, fontSize: 17 }}>{t("cs.chats.request", "Request to review")}</span>}
            </span>
            {row.unread > 0 && <span className="pip" style={{ position: "static", flex: "none", fontSize: 17, minWidth: 32, minHeight: 32, height: "auto" }} aria-label={unreadLabel}>{row.unread > 99 ? "99+" : row.unread}</span>}
          </button>;
        })}
      </div> : <Empty mood="hello" title={t("cs.chats.empty.title", "A quiet place to start")} body={filter === "Requests" ? t("cs.chats.empty.requests", "Requests for your family will show here.") : t("cs.chats.empty.body", "Invite your own nanny, grandparent or au pair to begin.")} />}
  </div>;
}
