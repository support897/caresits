import "../lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { BackBar, Empty, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { createTimeOffRequest, decideTimeOffRequest, readCalendarForSpaces, type CalendarEvent } from "../data/calendar";
import { listUserSpaces, type SpaceSummary } from "../data/spaces";
import { canPost } from "../lib/permissions";

type TimeOffParams = { uid?: string; spaceId?: string; eventId?: string };
type SwapDraft = { start: string; end: string };
const localField = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const toISO = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();

export default function Screen({ params }: ScreenProps<TimeOffParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const uid = params.uid || user?.uid || "";
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [spaceId, setSpaceId] = useState(params.spaceId ?? "");
  const [date, setDate] = useState(localField(new Date()));
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const [swaps, setSwaps] = useState<Record<string, SwapDraft>>({});
  const [openSwap, setOpenSwap] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    if (!uid) { setLoading(false); return; }
    void (async () => {
      const memberships = (await listUserSpaces(uid)).filter((space) => space.role === "admin" || space.perms?.calendar !== false);
      const result = await readCalendarForSpaces(memberships);
      if (!alive) return;
      setSpaces(memberships);
      setEvents(result.events);
      const requestedSpace = memberships.find((space) => space.id === params.spaceId && space.role !== "admin" && canPost(space.role));
      setSpaceId((current) => current && memberships.some((space) => space.id === current && space.role !== "admin" && canPost(space.role))
        ? current
        : requestedSpace?.id ?? memberships.find((space) => space.role !== "admin" && canPost(space.role))?.id ?? "");
      setOpenSwap(params.eventId ?? "");
    })().catch(() => { if (alive) setNotice(t("cs.timeoff.load.error", "Time-off requests could not load.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params.eventId, params.spaceId, uid]);

  const requestSpaces = useMemo(() => spaces.filter((space) => space.role !== "admin" && canPost(space.role)), [spaces]);
  const requested = useMemo(() => events.filter((event) => event.kind === "timeoff" && event.state === "requested"), [events]);
  const selectedSpace = spaces.find((space) => space.id === spaceId);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uid || !spaceId || !date || !from || !to || !selectedSpace || selectedSpace.role === "admin" || !canPost(selectedSpace.role) || busy) return;
    setBusy("new");
    setNotice("");
    try {
      const created = await createTimeOffRequest({
        spaceId,
        ownerUid: uid,
        start: toISO(date, from),
        end: toISO(date, to),
        title: t("cs.timeoff.request.title", "Time-off request"),
      });
      setEvents((current) => [...current, { ...created, spaceName: selectedSpace.name }]);
      setNotice(t("cs.timeoff.request.sent", "Request sent to the family."));
    } catch { setNotice(t("cs.timeoff.request.error", "The request could not be sent. Check your access and try again.")); }
    finally { setBusy(""); }
  }

  async function decide(event: CalendarEvent, action: "approve" | "decline" | "swap") {
    const space = spaces.find((entry) => entry.id === event.spaceId);
    if (!space || space.role !== "admin" || busy) return;
    const draft = swaps[event.id];
    const swap = action === "swap" && draft?.start && draft.end
      ? { start: new Date(draft.start).toISOString(), end: new Date(draft.end).toISOString() }
      : undefined;
    if (action === "swap" && !swap) return;
    setBusy(event.id);
    try {
      const updated = await decideTimeOffRequest(space.id, event, action, space.role, swap);
      setEvents((current) => current.map((row) => row.id === event.id && row.spaceId === space.id ? { ...row, ...updated } : row));
      setOpenSwap("");
      setNotice(action === "approve" ? t("cs.timeoff.approved", "Time off approved.") : action === "decline" ? t("cs.timeoff.declined", "Time off declined.") : t("cs.timeoff.swap.sent", "Swap proposal sent to the carer."));
    } catch { setNotice(t("cs.timeoff.action.error", "This request could not be updated.")); }
    finally { setBusy(""); }
  }

  return <div className="app">
    <BackBar title={t("cs.timeoff.title", "Time off")} onBack={nav.back} />
    <div className="scroll">
      <p className="card" style={{ margin: "0 0 14px", background: "var(--soft)" }}>{t("cs.timeoff.safety", "A request does not cancel a booking. The family chooses what happens next.")}</p>
      {notice && <p role="status" style={{ margin: "0 0 12px" }}>{notice}</p>}
      {!loading && requestSpaces.length > 0 && <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>{t("cs.timeoff.request.heading", "Ask for time off")}</h2>
        <form onSubmit={(event) => void submitRequest(event)} style={{ display: "grid", gap: 10 }}>
          <label>
            <span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.family", "Family")}</span>
            <select className="field" value={spaceId} onChange={(event) => setSpaceId(event.target.value)} aria-label={t("cs.timeoff.family", "Family")}>
              {requestSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
            </select>
          </label>
          <label><span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.date", "Date")}</span><input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <div className="row" style={{ gap: 10 }}>
            <label style={{ flex: 1 }}><span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.from", "From")}</span><input className="field" type="time" value={from} onChange={(event) => setFrom(event.target.value)} required /></label>
            <label style={{ flex: 1 }}><span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.to", "To")}</span><input className="field" type="time" value={to} onChange={(event) => setTo(event.target.value)} required /></label>
          </div>
          <button type="submit" className="btn" disabled={busy === "new" || !spaceId}>{busy === "new" ? t("cs.timeoff.sending", "Sending…") : t("cs.timeoff.send", "Send request")}</button>
        </form>
      </section>}
      <h2 style={{ fontSize: 24, margin: "0 0 10px" }}>{t("cs.timeoff.review.heading", "Family requests")}</h2>
      {loading ? <div className="sk" style={{ height: 130 }} /> : requested.length ? <div style={{ display: "grid", gap: 10 }}>
        {requested.map((event) => {
          const space = spaces.find((entry) => entry.id === event.spaceId);
          const admin = space?.role === "admin";
          const swap = swaps[event.id] ?? { start: "", end: "" };
          const dateLabel = new Date(event.start).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
          return <article key={`${event.spaceId}-${event.id}`} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><strong>{event.title}</strong><span className="tag">{space?.name ?? event.spaceName}</span></div>
            <p style={{ margin: "8px 0" }}>{dateLabel}</p>
            <p className="muted" style={{ margin: "0 0 10px" }}>{t("cs.timeoff.requested.status", "Waiting for the family")}</p>
            {admin && <div className="row" style={{ gap: 8 }}>
              <button type="button" className="chip" disabled={busy === event.id} onClick={() => void decide(event, "approve")}>{t("cs.timeoff.approve", "Approve")}</button>
              <button type="button" className="chip" disabled={busy === event.id} onClick={() => void decide(event, "decline")}>{t("cs.timeoff.decline", "Decline")}</button>
              <button type="button" className="chip" onClick={() => setOpenSwap((current) => current === event.id ? "" : event.id)}>{t("cs.timeoff.propose", "Propose a swap")}</button>
            </div>}
            {!admin && event.ownerUid === uid && <p className="muted" style={{ margin: 0 }}>{t("cs.timeoff.sent.status", "Your request is with the family.")}</p>}
            {admin && openSwap === event.id && <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label><span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.swap.start", "Proposed start")}</span><input className="field" type="datetime-local" value={swap.start} onChange={(input) => setSwaps((current) => ({ ...current, [event.id]: { ...swap, start: input.target.value } }))} /></label>
              <label><span style={{ display: "block", marginBottom: 6 }}>{t("cs.timeoff.swap.end", "Proposed end")}</span><input className="field" type="datetime-local" value={swap.end} onChange={(input) => setSwaps((current) => ({ ...current, [event.id]: { ...swap, end: input.target.value } }))} /></label>
              <button type="button" className="btn sm" disabled={!swap.start || !swap.end || busy === event.id} onClick={() => void decide(event, "swap")}>{t("cs.timeoff.swap.send", "Send swap proposal")}</button>
            </div>}
          </article>;
        })}
      </div> : <Empty mood="rest" title={t("cs.timeoff.empty.title", "No requests waiting")} body={t("cs.timeoff.empty.body", "Requests stay with the family they affect.")} />}
    </div>
  </div>;
}
