import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Bunny, t, useNav } from "@cc/core";
import { readCalendarForSpaces, type CalendarEvent } from "../../data/calendar";
import { loadChildren, type ChildProfile } from "../../data/children";
import type { SpaceSummary } from "../../data/spaces";
import { loadTeamMembers, type TeamMember } from "../../data/team";
import { can } from "@cc/core/src/permissions";
import { blockTeamMember, isActiveBookingToday, reportTeamMember, sendBookingCheckin, type SafetyCheckinKind, type SafetyReportCategory } from "./safety";
import "./profile.css";

const REPORT_CATEGORIES: Array<[SafetyReportCategory, string, string]> = [
  ["child_safety", "csSafety.category.child", "Child safety"],
  ["fake_profile", "csSafety.category.fake", "Fake profile"],
  ["spam_scam", "csSafety.category.spam", "Spam or scam"],
  ["rude_abusive", "csSafety.category.abusive", "Abusive behaviour"],
  ["inappropriate", "csSafety.category.inappropriate", "Inappropriate content"],
  ["other", "csSafety.category.other", "Other"],
];
const CHECKINS: Array<[SafetyCheckinKind, string, string]> = [
  ["arrived", "csSafety.checkin.arrived", "Arrived"],
  ["leaving", "csSafety.checkin.leaving", "Leaving"],
  ["help", "csSafety.checkin.help", "Need help"],
];
type SafetyMember = TeamMember & { spaceId: string };

export function SafetyTools({ uid, spaces }: { uid: string; spaces: SpaceSummary[] }) {
  const nav = useNav();
  const [selectedSpaceId, setSelectedSpaceId] = useState(spaces[0]?.id ?? "");
  const [members, setMembers] = useState<SafetyMember[]>([]);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [targetUid, setTargetUid] = useState("");
  const [reportCategory, setReportCategory] = useState<SafetyReportCategory>("child_safety");
  const [reportWords, setReportWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedSpace = spaces.find((space) => space.id === selectedSpaceId) ?? null;
  const activeMembers = useMemo(() => members.filter((member) => member.spaceId === selectedSpaceId && member.status === "active" && member.uid !== uid), [members, selectedSpaceId, uid]);
  const currentChildAccess = selectedSpace && can(selectedSpace.role, selectedSpace.perms, "readAllergies") && can(selectedSpace.role, selectedSpace.perms, "readMedication");
  const todaysBookings = useMemo(() => events.filter((event) => event.spaceId === selectedSpaceId && isActiveBookingToday(event.kind, event.state, event.start)), [events, selectedSpaceId]);

  useEffect(() => {
    let alive = true;
    const nextIds = spaces.map((space) => space.id);
    if (!nextIds.length) { setMembers([]); setChildren([]); setEvents([]); return; }
    setSelectedSpaceId((current) => nextIds.includes(current) ? current : nextIds[0] ?? "");
    void Promise.all([
      Promise.all(spaces.map((space) => loadTeamMembers(space.id).catch(() => []))),
      Promise.all(spaces.map((space) => loadChildren(space.id).catch(() => []))),
      readCalendarForSpaces(spaces).catch(() => ({ events: [], fromCache: false })),
    ]).then(([memberLists, childLists, calendar]) => {
      if (!alive) return;
      setMembers(memberLists.flatMap((list, index) => list.map((member) => ({ ...member, spaceId: spaces[index]?.id ?? "" }))));
      setChildren(childLists.flatMap((list, index) => list.map((child) => ({ ...child, id: `${spaces[index]?.id ?? ""}::${child.id}` }))));
      setEvents(calendar.events);
    });
    return () => { alive = false; };
  }, [spaces]);

  async function blockSelected() {
    const target = activeMembers.find((member) => member.uid === targetUid);
    if (!target || !uid) return;
    if (!window.confirm(t("csSafety.blockConfirm", "Block {name}? You can review access with a parent later.", { name: target.displayName }))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await blockTeamMember(uid, target.uid);
      setNotice(t("csSafety.blocked", "This person was blocked."));
    } catch { setError(t("csSafety.blockError", "This person could not be blocked. Try again.")); }
    finally { setBusy(false); }
  }

  async function reportSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = activeMembers.find((member) => member.uid === targetUid);
    if (!target || !uid || !reportWords.trim() || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await reportTeamMember({ reporterUid: uid, reportedUid: target.uid, category: reportCategory, words: reportWords, name: target.displayName });
      setReportWords("");
      setNotice(t("csSafety.reportSent", "Your report was sent for review."));
    } catch { setError(t("csSafety.reportError", "Your report could not be sent. Try again.")); }
    finally { setBusy(false); }
  }

  async function checkIn(booking: CalendarEvent, kind: SafetyCheckinKind) {
    if (!selectedSpaceId || !uid || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await sendBookingCheckin({ spaceId: selectedSpaceId, uid, bookingId: booking.id, kind });
      setNotice(t("csSafety.checkinSent", "Safety check-in sent."));
    } catch { setError(t("csSafety.checkinError", "Check-in could not be sent. Check your booking access.")); }
    finally { setBusy(false); }
  }

  return <section className="profile-card">
    <div className="profile-card-head"><h2>{t("csSafety.title", "Safety and help")}</h2><span className="tag">{t("csSafety.private", "Private")}</span></div>
    <p className="muted">{t("csSafety.intro", "Keep care inside the app. Report a concern, block a person, or check in during a booking.")}</p>
    {error && <p className="profile-notice" role="alert">{error}</p>}
    {notice && <p className="profile-notice" role="status">{notice}</p>}
    {spaces.length > 0 && <label className="profile-field"><span>{t("csSafety.space", "Care space")}</span><select value={selectedSpaceId} onChange={(event) => { setSelectedSpaceId(event.target.value); setNotice(""); }}>
      {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
    </select></label>}
    {selectedSpace && currentChildAccess && children.filter((child) => child.id.startsWith(`${selectedSpace.id}::`)).map((child) => {
      const childId = child.id.split("::").at(-1) ?? child.id;
      return <button type="button" className="profile-row" key={child.id} onClick={() => nav.push("emergency", { spaceId: selectedSpace.id, childId, childName: child.name, uid, role: selectedSpace.role, perms: selectedSpace.perms })}>
        <span className="profile-row-copy"><strong>{t("csSafety.emergencyFor", "Emergency sheet · {name}", { name: child.name })}</strong><span>{t("csSafety.emergencyHint", "Allergies, medication and emergency contacts")}</span></span><span className="flip" aria-hidden="true">›</span>
      </button>;
    })}
    {todaysBookings.length > 0 ? <div className="profile-items" style={{ marginTop: 8 }}>
      <h3>{t("csSafety.bookingTitle", "Today’s booking check-in")}</h3>
      {todaysBookings.map((booking) => <article className="profile-card" key={`${booking.spaceId}-${booking.id}`} style={{ boxShadow: "none", padding: 12 }}>
        <strong>{booking.title}</strong><span className="muted">{new Date(booking.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
        <div className="profile-safety-row" style={{ marginTop: 8 }}>
          {CHECKINS.map(([kind, key, english]) => <button key={kind} type="button" className="profile-action" disabled={busy} onClick={() => void checkIn(booking, kind)}>{t(key, english)}</button>)}
        </div>
      </article>)}
    </div> : <p className="muted">{t("csSafety.noBooking", "An active booking today will show a check-in here.")}</p>}
    {activeMembers.length > 0 ? <>
      <label className="profile-field" style={{ marginTop: 8 }}><span>{t("csSafety.person", "Team member")}</span><select value={targetUid} onChange={(event) => setTargetUid(event.target.value)}>
        <option value="">{t("csSafety.choosePerson", "Choose a person")}</option>
        {activeMembers.map((member) => <option key={member.uid} value={member.uid}>{member.displayName}</option>)}
      </select></label>
      <div className="profile-safety-row" style={{ marginTop: 8 }}>
        <button type="button" className="profile-action profile-danger" disabled={!targetUid || busy} onClick={() => void blockSelected()}>{t("csSafety.block", "Block")}</button>
        <a className="profile-action" href="#safety-report" onClick={(event) => { event.preventDefault(); document.getElementById("safety-report-details")?.setAttribute("open", ""); }}>{t("csSafety.report", "Report")}</a>
      </div>
      <details id="safety-report-details" style={{ marginTop: 10 }}><summary className="profile-action">{t("csSafety.reportTitle", "Report a concern")}</summary>
        <form id="safety-report" onSubmit={(event) => void reportSelected(event)} className="profile-items" style={{ marginTop: 10 }}>
          <label className="profile-field"><span>{t("csSafety.categoryLabel", "What happened?")}</span><select value={reportCategory} onChange={(event) => setReportCategory(event.target.value as SafetyReportCategory)}>
            {REPORT_CATEGORIES.map(([value, key, english]) => <option key={value} value={value}>{t(key, english)}</option>)}
          </select></label>
          <label className="profile-field"><span>{t("csSafety.wordsLabel", "Tell us what happened")}</span><textarea value={reportWords} onChange={(event) => setReportWords(event.target.value)} maxLength={1000} required /></label>
          <button type="submit" className="btn" disabled={!targetUid || !reportWords.trim() || busy}>{busy ? t("csSafety.sending", "Sending…") : t("csSafety.sendReport", "Send report")}</button>
        </form>
      </details>
    </> : <div className="empty"><Bunny mood="rest" size={68} /><p>{t("csSafety.noOtherMembers", "Other team members will appear here.")}</p></div>}
    <p className="muted profile-permission-note">{t("csSafety.payments", "Keep booking payments in the app. Never send bank or card details in a message.")}</p>
  </section>;
}
