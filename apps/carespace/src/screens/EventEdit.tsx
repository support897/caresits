import "../lib/i18n";
import { useEffect, useState } from "react";
import { BackBar, Empty, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { createCalendarEvent, getCalendarEvent, saveCalendarEvent, type CalendarEvent, type CalendarKind } from "../data/calendar";
import { getSpaceAccess, type SpaceAccess } from "../data/spaces";
import { canPost } from "../lib/permissions";

type EventEditParams = { uid?: string; spaceId: string; eventId?: string };
type FormState = { title: string; kind: Exclude<CalendarKind, "booking">; date: string; from: string; to: string };
const localDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const localTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "09:00" : `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
const localISO = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();
const EVENT_KINDS: Array<[FormState["kind"], string, string]> = [
  ["shift", "cs.event.kind.shift", "Shift"], ["school", "cs.event.kind.school", "School"],
  ["activity", "cs.event.kind.activity", "Activity"], ["pickup", "cs.event.kind.pickup", "Pickup"],
];

export default function Screen({ params }: ScreenProps<EventEditParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const uid = params.uid || user?.uid || "";
  const [access, setAccess] = useState<SpaceAccess | null>(null);
  const [existing, setExisting] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<FormState>({ title: "", kind: "shift", date: localDate(new Date().toISOString()), from: "09:00", to: "17:00" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    if (!uid || !params.spaceId) { setLoading(false); return; }
    void (async () => {
      const [spaceAccess, event] = await Promise.all([
        getSpaceAccess(uid, params.spaceId),
        params.eventId ? getCalendarEvent(params.spaceId, params.eventId) : Promise.resolve(null),
      ]);
      if (!alive) return;
      setAccess(spaceAccess);
      setExisting(event);
      if (event) setForm({
        title: event.title,
        kind: event.kind === "booking" ? "shift" : event.kind,
        date: localDate(event.start),
        from: localTime(event.start),
        to: localTime(event.end),
      });
    })().catch(() => { if (alive) setNotice(t("cs.event.load.error", "This event could not load.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params.eventId, params.spaceId, uid]);

  const role = access?.member.role;
  const editable = canPost(role) && existing?.kind !== "booking";

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uid || !params.spaceId || !editable || !form.title.trim() || !form.date || !form.from || !form.to || busy) return;
    const start = localISO(form.date, form.from);
    const end = localISO(form.date, form.to);
    if (end <= start) { setNotice(t("cs.event.time.error", "End time must be after start time.")); return; }
    setBusy(true);
    setNotice("");
    try {
      if (existing) {
        const updated: CalendarEvent = { ...existing, title: form.title.trim(), kind: form.kind, start, end };
        await saveCalendarEvent(params.spaceId, updated);
      } else {
        await createCalendarEvent(params.spaceId, {
          title: form.title.trim(), kind: form.kind, start, end, ownerUid: uid, state: "active",
        });
      }
      nav.back();
    } catch { setNotice(t("cs.event.save.error", "Event could not be saved. Check your access and try again.")); }
    finally { setBusy(false); }
  }

  return <div className="app">
    <BackBar title={existing ? t("cs.event.edit.title", "Edit event") : t("cs.event.new.title", "New event")} onBack={nav.back} />
    <div className="scroll">
      {loading ? <div className="sk" style={{ height: 180 }} />
        : !access ? <Empty mood="oops" title={t("cs.space.unavailable.title", "This space is not available")} body={t("cs.space.unavailable.body", "Ask a family admin to check your access.")} />
        : existing?.kind === "booking" ? <div className="card">
          <h2 style={{ fontSize: 24 }}>{existing.title}</h2>
          <p>{t("cs.event.booking.readonly", "Booking status is managed separately. This screen never cancels a booking.")}</p>
          <p className="muted">{t(`cs.calendar.state.${existing.state}`, existing.state)}</p>
        </div>
        : <form onSubmit={(event) => void save(event)} className="card" style={{ display: "grid", gap: 12 }}>
          <label><span style={{ display: "block", marginBottom: 6 }}>{t("cs.event.name", "Event name")}</span><input className="field" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={120} required /></label>
          <label><span style={{ display: "block", marginBottom: 6 }}>{t("cs.event.kind", "Type")}</span>
            <select className="field" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as FormState["kind"] }))}>
              {EVENT_KINDS.map(([kind, key, label]) => <option key={kind} value={kind}>{t(key, label)}</option>)}
            </select>
          </label>
          <label><span style={{ display: "block", marginBottom: 6 }}>{t("cs.event.date", "Date")}</span><input className="field" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required /></label>
          <div className="row" style={{ gap: 10 }}>
            <label style={{ flex: 1 }}><span style={{ display: "block", marginBottom: 6 }}>{t("cs.event.from", "From")}</span><input className="field" type="time" value={form.from} onChange={(event) => setForm((current) => ({ ...current, from: event.target.value }))} required /></label>
            <label style={{ flex: 1 }}><span style={{ display: "block", marginBottom: 6 }}>{t("cs.event.to", "To")}</span><input className="field" type="time" value={form.to} onChange={(event) => setForm((current) => ({ ...current, to: event.target.value }))} required /></label>
          </div>
          {notice && <p role="alert" style={{ margin: 0, color: "var(--danger)" }}>{notice}</p>}
          {!editable && <p className="muted" style={{ margin: 0 }}>{t("cs.event.readonly", "This role cannot edit calendar events.")}</p>}
          <button type="submit" className="btn" disabled={!editable || busy}>{busy ? t("cs.event.saving", "Saving…") : t("cs.event.save", "Save changes")}</button>
        </form>}
      {notice && loading === false && existing?.kind === "booking" && <p role="status">{notice}</p>}
    </div>
  </div>;
}
