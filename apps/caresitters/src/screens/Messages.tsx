import { useEffect, useMemo, useRef, useState } from "react";
import { db, MediaImg, loadPeople, type Person, Bunny, t, useNav } from "@cc/core";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { isProfileComplete, pairIdFor, planContact } from "../lib/booking";
import { loadBookingsForUser } from "../data/bookings";
import { loadSavedIds } from "../data/people";
import { Bell } from "../../../../packages/core/src/notifications/Bell";
import { filterChatsByTab, getUnreadCount, messagePreview, timeMs, type ChatFilter, type ChatMessage } from "../../../../packages/core/src/chat/merge";
import { getChatSeenAt, loadChatPeople, loadRelationships, otherUidFor, subscribeToChatSeen, subscribeToMessages, type ChatPerson, type Relationship } from "../data/chat";

type Params = { me: Person };
type PickerInput = {
  people: readonly Person[];
  me: Pick<Person, "uid" | "side">;
  savedIds?: readonly string[];
  bookedIds?: readonly string[];
  relationshipIds?: readonly string[];
  blockedIds?: readonly string[];
  search?: string;
};

export function filterMessagePickerPeople(input: PickerInput): Person[] {
  const saved = new Set(input.savedIds ?? []);
  const booked = new Set(input.bookedIds ?? []);
  const related = new Set(input.relationshipIds ?? []);
  const blocked = new Set(input.blockedIds ?? []);
  const search = (input.search ?? "").trim().toLocaleLowerCase();
  return [...new Map(input.people.map((person) => [person.uid, person])).values()]
    .filter((person) => {
      if (person.uid === input.me.uid || person.side === input.me.side || blocked.has(person.uid)) return false;
      if (search && !person.name.toLocaleLowerCase().includes(search)) return false;
      if (input.me.side === "family") {
        return person.side === "carer" && (search.length > 0 || saved.has(person.uid) || booked.has(person.uid));
      }
      return person.side === "family" && related.has(person.uid);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

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
  const accountName = me.firstName || me.name || t("messages.account.name", "Your account");
  const [tab, setTab] = useState<ChatFilter>("All");
  const [search, setSearch] = useState("");
  const [relations, setRelations] = useState<Relationship[]>([]);
  const [people, setPeople] = useState<Record<string, ChatPerson>>({});
  const [latest, setLatest] = useState<Record<string, ChatMessage | null>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerPeople, setPickerPeople] = useState<Person[]>([]);
  const [pickerSavedIds, setPickerSavedIds] = useState<string[]>([]);
  const [pickerBookedIds, setPickerBookedIds] = useState<string[]>([]);
  const [pickerRelationshipIds, setPickerRelationshipIds] = useState<string[]>([]);
  const [pickerBlockedIds, setPickerBlockedIds] = useState<string[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const pickerSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeToChatSeen(me.uid, (relId) => {
    setUnread((current) => ({ ...current, [relId]: 0 }));
  }), [me.uid]);

  useEffect(() => {
    let alive = true;
    const stops: Array<() => void> = [];
    setLoading(true);
    setError("");
    setLatest({});
    setUnread({});
    setRelations([]);
    setPeople({});
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

  useEffect(() => {
    if (!pickerOpen) return undefined;
    let alive = true;
    setPickerLoading(true);
    setPickerError("");
    setPickerPeople([]);
    void (async () => {
      const blockedSnapshot = await getDocs(collection(db, "users", me.uid, "blocks"));
      const blockedIds = new Set(blockedSnapshot.docs.map((row) => row.id));
      relations.filter((rel) => rel.state === "blocked").forEach((rel) => blockedIds.add(otherUidFor(rel, me.uid)));
      let candidates: Person[] = [];
      let savedIds: string[] = [];
      let bookedIds: string[] = [];
      let relationshipIds: string[] = [];
      if (me.side === "family") {
        const [allPeople, saved, bookings] = await Promise.all([
          loadPeople(me),
          loadSavedIds(me.uid),
          loadBookingsForUser(me.uid, "family").catch(() => []),
        ]);
        candidates = allPeople.filter((person) => person.side === "carer");
        savedIds = saved;
        bookedIds = bookings.map((booking) => booking.carerUid);
      } else {
        const familyRelationships = relations.filter((rel) => rel.state !== "blocked" && rel.state !== "ended");
        const chatPeople = await loadChatPeople(familyRelationships, me.uid);
        candidates = Object.values(chatPeople).flatMap((person) => person.profile?.side === "family" ? [person.profile] : []);
        relationshipIds = familyRelationships.map((rel) => otherUidFor(rel, me.uid)).filter(Boolean);
      }
      if (!alive) return;
      setPickerPeople(candidates);
      setPickerSavedIds(savedIds);
      setPickerBookedIds(bookedIds);
      setPickerRelationshipIds(relationshipIds);
      setPickerBlockedIds([...blockedIds].filter(Boolean));
    })().catch(() => {
      if (alive) setPickerError(t("messages.new.load.error", "People could not load. Check your connection and try again."));
    }).finally(() => { if (alive) setPickerLoading(false); });
    return () => { alive = false; };
  }, [pickerOpen, me.uid, me.side, relations]);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const frame = requestAnimationFrame(() => pickerSearchRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKeyDown); };
  }, [pickerOpen]);

  const pickerRows = useMemo(() => filterMessagePickerPeople({
    people: pickerPeople,
    me,
    savedIds: pickerSavedIds,
    bookedIds: pickerBookedIds,
    relationshipIds: pickerRelationshipIds,
    blockedIds: pickerBlockedIds,
    search: pickerSearch,
  }), [pickerPeople, me.uid, me.side, pickerSavedIds, pickerBookedIds, pickerRelationshipIds, pickerBlockedIds, pickerSearch]);

  async function startConversation(person: Person) {
    if (pickerBusy) return;
    setPickerBusy(true);
    setPickerError("");
    const relId = pairIdFor(me.uid, person.uid);
    try {
      const ownBlock = await getDocs(collection(db, "users", me.uid, "blocks"));
      if (ownBlock.docs.some((row) => row.id === person.uid)) {
        setPickerBlockedIds((current) => [...new Set([...current, person.uid])]);
        return;
      }
      const existing = relations.find((rel) => rel.id === relId);
      if (existing) {
        if (["contact", "hired", "pending"].includes(existing.state)) {
          setPickerOpen(false);
          nav.push("chat", { relId, otherUid: person.uid });
          return;
        }
        if (existing.state === "blocked") {
          setPickerBlockedIds((current) => [...new Set([...current, person.uid])]);
          setPickerError(t("messages.new.unavailable", "This person is not available for messaging."));
          return;
        }
        setPickerError(t("messages.new.existing.error", "This conversation cannot be reopened."));
        return;
      }
      const familyUid = me.side === "family" ? me.uid : person.uid;
      const carerUid = me.side === "carer" ? me.uid : person.uid;
      const plan = planContact({
        familyUid,
        carerUid,
        createdBy: me.uid,
        nowIso: new Date().toISOString(),
        createdDay: new Date().toISOString().slice(0, 10),
        profileComplete: isProfileComplete(me) && isProfileComplete(person),
      });
      if (!plan.ok) {
        setPickerError(t("messages.new.profile.error", "A complete profile is needed before starting a conversation."));
        return;
      }
      await setDoc(doc(db, "relationships", relId), { ...plan.data, state: "contact" });
      setPickerOpen(false);
      nav.push("chat", { relId, otherUid: person.uid });
    } catch (cause) {
      const code = String((cause as { code?: unknown })?.code ?? "");
      if (code.includes("permission-denied")) {
        setPickerBlockedIds((current) => [...new Set([...current, person.uid])]);
        setPickerError(t("messages.new.unavailable", "This person is not available for messaging."));
      } else {
        setPickerError(t("messages.new.create.error", "The conversation could not open. Check your connection and try again."));
      }
    } finally {
      setPickerBusy(false);
    }
  }

  const rows = useMemo(() => {
    const matched = filterChatsByTab(relations, tab, { uid: me.uid, side: me.side }, unread);
    return matched.map((rel) => {
      const otherUid = otherUidFor(rel, me.uid);
      const person = people[otherUid] ?? { uid: otherUid, name: t("chat.partner", "Care partner") };
      const last = latest[rel.id] ?? null;
      const request = rel.state === "pending";
      const preview = request ? (rel.createdBy === me.uid ? t("messages.request.waiting", "Waiting for a reply") : t("messages.request.incoming", "Connection request")) : messagePreview(last);
      const statusLabel = request
        ? rel.createdBy === me.uid ? t("messages.status.sentRequest", "Request sent") : t("messages.status.newRequest", "New request")
        : rel.state === "hired" ? t("messages.status.workingTogether", "Working together") : t("messages.status.connected", "Connected");
      return { rel, otherUid, person, last, preview, statusLabel, unread: unread[rel.id] ?? 0 };
    }).filter((row) => `${row.person.name} ${row.preview}`.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => timeMs(b.last?.at ?? b.rel.createdAt) - timeMs(a.last?.at ?? a.rel.createdAt));
  }, [relations, tab, me.uid, me.side, unread, people, latest, search]);

  const quickPeople = useMemo(() => rows.filter((row) => row.rel.state === "contact" || row.rel.state === "hired").slice(0, 8), [rows]);
  const emptyTitle = tab === "Unread" ? t("messages.empty.title.unread", "All caught up") : t("messages.empty.title", "A quiet space");
  const emptyBody = tab === "Requests" ? t("messages.empty.requests", "Connection requests will show here.") : tab === "Unread" ? t("messages.empty.unread", "New messages will appear here.") : t("messages.empty.all", "When you connect with someone, your chats will show here.");

  return <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--cream)" }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px 8px" }}>
      <div style={{ minWidth: 0 }}><p className="muted" style={{ margin: 0 }}>{t("messages.kicker", "Your care circle")}</p><h1>{t("messages.title", "Messages")}</h1></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
        <Bell uid={me.uid} side={me.side} app="caresitters" />
        <button type="button" onClick={() => nav.push("settings", { me })} aria-label={t("messages.account.open", "Open account settings for {name}", { name: accountName })} style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 24, background: "var(--soft)" }}>
          <span className="av" style={{ width: 40, height: 40 }}>{me.photoUrl ? <MediaImg src={me.photoUrl} alt="" loading="lazy" /> : initials(accountName)}</span>
        </button>
      </div>
    </header>
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 16px 24px" }}>
      <button type="button" className="btn alt" onClick={() => { setPickerSearch(""); setPickerError(""); setPickerOpen(true); }} style={{ width: "100%", minHeight: 48, marginBlockEnd: 10, fontSize: 17 }}>{t("messages.new.button", "New message")}</button>
      <label htmlFor="messages-search" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>{t("messages.search.label", "Search conversations")}</label>
      <input id="messages-search" className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("messages.search.placeholder", "Search families, carers and chats")} style={{ minHeight: 50 }} />
      {quickPeople.length > 0 && <section aria-label={t("messages.circle.label", "Your care circle")} style={{ marginBlock: 16 }}>
        <p className="muted" style={{ margin: "0 0 8px" }}>{t("messages.circle.title", "Your care circle")}</p>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBlock: 3 }}>
          {quickPeople.map(({ rel, otherUid, person, unread: count }) => <button key={rel.id} type="button" onClick={() => nav.push("chat", { relId: rel.id, otherUid })} aria-label={count ? t("messages.quick.unread", "Open {name}, {count} unread", { name: person.name, count }) : t("messages.quick.open", "Open chat with {name}", { name: person.name })} style={{ flex: "0 0 72px", display: "grid", justifyItems: "center", gap: 5, minHeight: 78 }}>
            <span className="av" style={{ width: 54, height: 54, position: "relative" }}>{person.photoUrl ? <MediaImg src={person.photoUrl} alt="" loading="lazy" /> : initials(person.name)}{count > 0 && <span style={{ position: "absolute", insetInlineEnd: -2, insetBlockStart: -2, width: 16, height: 16, borderRadius: 50, background: "var(--danger)", border: "2px solid var(--cream)" }} />}</span>
            <span style={{ maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}</span>
          </button>)}
        </div>
      </section>}
      <nav aria-label={t("messages.filters.label", "Filter conversations")} style={{ display: "flex", gap: 8, overflowX: "auto", marginBlock: 10, paddingBlock: 2 }}>
        {FILTERS.map((filter) => <button key={filter} type="button" className={`chip${tab === filter ? " on" : ""}`} aria-pressed={tab === filter} onClick={() => setTab(filter)} style={{ flex: "0 0 auto" }}>{labels[filter]}</button>)}
      </nav>
      {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      {loading ? <div aria-busy="true" className="stack"><div className="sk" style={{ height: 86 }} /><div className="sk" style={{ height: 86 }} /></div> : rows.length ? <div style={{ display: "grid" }}>
        {rows.map(({ rel, otherUid, person, last, preview, statusLabel, unread: count }) => <button key={rel.id} type="button" onClick={() => nav.push("chat", { relId: rel.id, otherUid })} aria-label={count ? t("messages.row.unread", "{name}. {preview}. {status}. {count} unread", { name: person.name, preview, status: statusLabel, count }) : t("messages.row.label", "{name}. {preview}. {status}", { name: person.name, preview, status: statusLabel })} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minWidth: 0, minHeight: 82, padding: "10px 4px", textAlign: "start", borderBlockEnd: "1px solid var(--line)", overflow: "hidden" }}>
          <span className="av" style={{ width: 54, height: 54 }}>{person.photoUrl ? <MediaImg src={person.photoUrl} alt="" loading="lazy" /> : initials(person.name)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, minWidth: 0 }}><strong style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}</strong><time className="muted" style={{ flex: "0 1 auto", minWidth: 0, fontSize: 17, whiteSpace: "normal", textAlign: "end" }}>{last ? timeLabel(last.at) : rel.state === "pending" ? t("messages.request.label", "Request") : ""}</time></span>
            <span className="muted" style={{ display: "block", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</span>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0, marginBlockStart: 4 }}><span className="tag" style={{ flex: "0 1 auto", minWidth: 0, maxWidth: count > 0 ? "calc(100% - 36px)" : "100%", overflowWrap: "anywhere", whiteSpace: "normal", textAlign: "start", fontSize: 17, color: "var(--text)", background: "var(--soft)" }}>{statusLabel}</span>{count > 0 && <span className="pip" aria-label={t("messages.unread.count", "{count} unread", { count })} style={{ position: "static", flex: "0 0 auto", minWidth: 28, height: 28, padding: "0 6px", display: "grid", placeItems: "center", fontSize: 17, color: "var(--cream)" }}>{count > 99 ? "99+" : count}</span>}</span>
          </span>
        </button>)}
      </div> : <div className="empty" style={{ paddingBlock: 22 }}><Bunny mood="hello" size={94} /><h2>{emptyTitle}</h2><p className="muted">{emptyBody}</p></div>}
      <p className="muted center" style={{ marginBlock: 18 }}>{t("messages.private.note", "Every family has its own private space.")}</p>
    </div>
    {pickerOpen && <div onClick={(event) => { if (event.target === event.currentTarget && !pickerBusy) setPickerOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 12, background: "color-mix(in srgb, var(--ink) 45%, transparent)" }}>
      <section role="dialog" aria-modal="true" aria-labelledby="messages-new-title" aria-busy={pickerLoading || pickerBusy} style={{ width: "min(100%, 560px)", maxHeight: "min(86dvh, 720px)", overflowY: "auto", padding: 16, borderRadius: 20, color: "var(--text)", background: "var(--cream)", boxShadow: "0 16px 56px color-mix(in srgb, var(--ink) 25%, transparent)" }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}><h2 id="messages-new-title" style={{ marginBlock: 0, fontSize: 22 }}>{t("messages.new.title", "New message")}</h2><p className="muted" style={{ marginBlock: "6px 12px", fontSize: 17 }}>{me.side === "family" ? t("messages.new.family.hint", "Choose a saved or booked carer, or search by name.") : t("messages.new.carer.hint", "Choose a family you have a care relationship with.")}</p></div>
          <button type="button" className="chip" onClick={() => setPickerOpen(false)} aria-label={t("messages.new.close", "Close person picker")} style={{ flex: "0 0 48px", width: 48, height: 48, padding: 0, justifyContent: "center", fontSize: 22 }}>×</button>
        </header>
        <label htmlFor="messages-new-search" style={{ display: "block", marginBlockEnd: 6, fontSize: 17 }}>{t("messages.new.search.label", "Search by name")}</label>
        <input ref={pickerSearchRef} id="messages-new-search" className="field" value={pickerSearch} onChange={(event) => setPickerSearch(event.target.value)} placeholder={t("messages.new.search.placeholder", "Type a name")} style={{ minHeight: 50, fontSize: 17 }} />
        {pickerError && <p role="alert" style={{ color: "var(--danger)", fontSize: 17 }}>{pickerError}</p>}
        {pickerLoading ? <p role="status" style={{ fontSize: 17 }}>{t("messages.new.loading", "Loading people…")}</p> : pickerRows.length ? <div role="group" aria-label={t("messages.new.results", "People to message")} style={{ display: "grid", marginBlockStart: 8 }}>
          {pickerRows.map((person) => <button key={person.uid} type="button" onClick={() => void startConversation(person)} disabled={pickerBusy} aria-label={t("messages.new.open", "Start a conversation with {name}", { name: person.name })} style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, minHeight: 64, padding: "8px 4px", borderBlockEnd: "1px solid var(--line)", textAlign: "start" }}>
            <span className="av" style={{ width: 48, height: 48, flex: "0 0 48px" }}>{person.photoUrl ? <MediaImg src={person.photoUrl} alt="" loading="lazy" /> : initials(person.name)}</span>
            <span style={{ minWidth: 0, flex: 1, fontSize: 17, overflowWrap: "anywhere" }}>{person.name}</span>
            {pickerBusy && <span className="muted" style={{ fontSize: 17 }}>{t("messages.new.opening", "Opening…")}</span>}
          </button>)}
        </div> : <div className="empty" style={{ paddingBlock: 18 }}><Bunny mood="think" size={80} /><h3>{t("messages.new.empty.title", "No people found")}</h3><p className="muted" style={{ fontSize: 17 }}>{pickerSearch.trim() ? t("messages.new.empty.search", "Try another name.") : me.side === "family" ? t("messages.new.empty.family", "Saved carers show here.") : t("messages.new.empty.carer", "Families with a care relationship will show here.")}</p></div>}
      </section>
    </div>}
  </div>;
}
