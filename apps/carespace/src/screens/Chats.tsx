import "../lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Chip, Empty, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { readCalendar } from "../data/calendar";
import { readSpaceChatPreview, type SpaceMessage } from "../data/chatSpace";
import { createCareSpace, listUserSpaces, type SpaceSummary } from "../data/spaces";

type ChatsParams = { uid: string; name: string };
type Filter = "All" | "Families" | "Carers" | "Unread" | "Requests";
type SpaceRow = { space: SpaceSummary; last: SpaceMessage | null; unread: number; hasRequest: boolean };
const FILTERS: Array<[Filter, string, string]> = [
  ["All", "cs.chats.filter.all", "All"],
  ["Families", "cs.chats.filter.families", "Families"],
  ["Carers", "cs.chats.filter.carers", "Carers"],
  ["Unread", "cs.chats.filter.unread", "Unread"],
  ["Requests", "cs.chats.filter.requests", "Requests"],
];
const COLORS = ["var(--soft)", "var(--sage)", "var(--blush)", "var(--butter)"];

export default function Screen({ params }: ScreenProps<ChatsParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const uid = params.uid || user?.uid || "";
  const name = params.name || user?.displayName || "";
  const [filter, setFilter] = useState<Filter>("All");
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
        const [preview, calendar] = await Promise.all([
          readSpaceChatPreview(space.id, uid, space.role, space.perms).catch(() => ({ last: null, unread: 0 })),
          readCalendar(space.id).catch(() => ({ events: [], fromCache: false })),
        ]);
        return {
          space,
          last: preview.last,
          unread: preview.unread,
          hasRequest: space.role === "admin" && calendar.events.some((event) => event.kind === "timeoff" && event.state === "requested" && event.ownerUid !== uid),
        };
      }));
      if (alive) setSpaces(rows);
    })().catch(() => { if (alive) setSpaces([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid]);

  const shown = useMemo(() => {
    const queryText = search.trim().toLocaleLowerCase();
    return spaces.filter((row) => {
      if (queryText && !row.space.name.toLocaleLowerCase().includes(queryText)) return false;
      if (filter === "Families") return row.space.role === "admin";
      if (filter === "Carers") return row.space.role !== "admin";
      if (filter === "Unread") return row.unread > 0;
      if (filter === "Requests") return row.hasRequest;
      return true;
    });
  }, [filter, search, spaces]);

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
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
      <div>
        <p className="muted" style={{ margin: "0 0 3px" }}>{t("cs.chats.eyebrow", "Your care circle")}</p>
        <h1>{t("cs.chats.title", "Chats")}</h1>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="chip" onClick={() => nav.push("join", {})}>{t("cs.chats.join", "Join with code")}</button>
        <button type="button" className="chip" onClick={() => nav.push("notifications", { uid })} aria-label={t("cs.chats.notifications", "Notifications")}>{t("cs.chats.notifications.short", "Notifications")}</button>
        <Avatar name={name || t("cs.chats.you", "You")} size={44} />
      </div>
    </header>
    <p style={{ margin: "0 0 14px" }}>{t("cs.chats.subtitle", "Every family has its own private space.")}</p>
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
        {shown.map((row) => <button key={row.space.id} type="button" className="card" onClick={() => nav.push("space", { spaceId: row.space.id })}
          aria-label={`${row.space.name}. ${previewText(row)}`} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, textAlign: "start", padding: 14 }}>
          <div className="av" style={{ width: 52, height: 52, fontSize: 21, background: COLORS[row.space.colorIndex] }}>{row.space.name.slice(0, 1).toUpperCase()}</div>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="row" style={{ justifyContent: "space-between", gap: 8 }}>
              <strong style={{ overflowWrap: "anywhere" }}>{row.space.name}</strong>
              <span className="tag" style={{ background: COLORS[row.space.colorIndex], color: "var(--text)", whiteSpace: "nowrap" }}>{row.space.role === "admin" ? t("cs.chats.tag.family", "Family") : t("cs.chats.tag.carer", "Carer")}</span>
            </span>
            <span style={{ display: "block", color: "var(--muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewText(row)}</span>
            {row.hasRequest && <span className="tag good" style={{ display: "inline-block", marginTop: 6 }}>{t("cs.chats.request", "Request to review")}</span>}
          </span>
          {row.unread > 0 && <span className="pip" style={{ position: "static", flex: "none" }} aria-label={t("cs.chats.unread", "Unread messages")}>{row.unread > 99 ? "99+" : row.unread}</span>}
        </button>)}
      </div> : <Empty mood="hello" title={t("cs.chats.empty.title", "A quiet place to start")} body={filter === "Requests" ? t("cs.chats.empty.requests", "Requests for your family will show here.") : t("cs.chats.empty.body", "Invite your own nanny, grandparent or au pair to begin.")} />}
  </div>;
}
