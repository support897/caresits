import "../lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { BackBar, Empty, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { createSpaceRequest, decideSpaceRequest, readRequestsForSpaces, type RequestDecision, type SpaceRequest } from "../data/requests";
import { listUserSpaces, type SpaceSummary } from "../data/spaces";
import { loadTeamMembers, type TeamMember } from "../data/team";

type RequestsParams = { uid?: string; spaceId?: string };
type Props = ScreenProps<RequestsParams> & { onBack?: () => void };
type RequestKind = SpaceRequest["kind"];

const KINDS: Array<{ value: RequestKind; key: string; label: string; hint: string }> = [
  { value: "time-off", key: "cs.requests.kind.timeoff", label: "Time off", hint: "Add the dates and hours you need off." },
  { value: "photo", key: "cs.requests.kind.photo", label: "Photo request", hint: "Say what moment or activity you want a photo of." },
  { value: "meal", key: "cs.requests.kind.meal", label: "Meal request", hint: "Say what meal or food change you need." },
  { value: "shopping", key: "cs.requests.kind.shopping", label: "Shopping request", hint: "Say what item is needed and when." },
  { value: "swap", key: "cs.requests.kind.swap", label: "Shift swap", hint: "Add the shift date and the time you suggest." },
];

function requestTime(value: SpaceRequest["at"]): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (value && typeof value === "object") {
    const date = new Date(value.seconds * 1_000 + Math.floor(value.nanoseconds / 1_000_000));
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}

export default function Requests({ params, onBack }: Props) {
  const nav = useNav();
  const { user } = useAuth();
  const uid = params.uid || user?.uid || "";
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [spaceId, setSpaceId] = useState(params.spaceId ?? "");
  const [membersBySpace, setMembersBySpace] = useState<Record<string, TeamMember[]>>({});
  const [requests, setRequests] = useState<SpaceRequest[]>([]);
  const [kind, setKind] = useState<RequestKind>("photo");
  const [text, setText] = useState("");
  const [toUid, setToUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    if (!uid) { setLoading(false); return; }
    void listUserSpaces(uid).then((memberships) => {
      if (!alive) return;
      setSpaces(memberships);
      setSpaceId((current) => memberships.some((space) => space.id === current)
        ? current : memberships.some((space) => space.id === params.spaceId) ? params.spaceId! : memberships[0]?.id ?? "");
    }).catch(() => {
      if (alive) setNotice(t("cs.requests.load.error", "Requests could not load. Check your connection and access."));
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params.spaceId, uid]);

  useEffect(() => {
    let alive = true;
    if (!spaces.length) return;
    void Promise.all(spaces.map(async (space) => [space.id, await loadTeamMembers(space.id)] as const))
      .then((rows) => {
        if (alive) setMembersBySpace(Object.fromEntries(rows));
      }).catch(() => { if (alive) setNotice(t("cs.requests.members.error", "The team list could not load.")); });
    return () => { alive = false; };
  }, [spaces]);

  useEffect(() => {
    let alive = true;
    if (!spaces.length) return;
    const refresh = () => {
      void readRequestsForSpaces(spaces).then((rows) => { if (alive) setRequests(rows); })
        .catch(() => { if (alive) setNotice(t("cs.requests.load.error", "Requests could not load. Check your connection and access.")); });
    };
    refresh();
    window.addEventListener("carespace:requests-changed", refresh);
    return () => {
      alive = false;
      window.removeEventListener("carespace:requests-changed", refresh);
    };
  }, [spaces]);

  const selectedSpace = spaces.find((space) => space.id === spaceId);
  const team = membersBySpace[spaceId] ?? [];
  const recipients = useMemo(() => team.filter((member) => member.status === "active" && member.uid !== uid), [team, uid]);
  useEffect(() => {
    if (!recipients.some((member) => member.uid === toUid)) {
      setToUid(recipients.find((member) => member.role === "admin")?.uid ?? recipients[0]?.uid ?? "");
    }
  }, [recipients, toUid]);

  const visibleRequests = useMemo(() => requests.filter((request) => request.spaceId === spaceId), [requests, spaceId]);
  const openRequests = visibleRequests.filter((request) => request.state === "open");
  const resolvedRequests = visibleRequests.filter((request) => request.state !== "open");
  const currentKind = KINDS.find((entry) => entry.value === kind) ?? KINDS[0]!;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uid || !selectedSpace || busy) return;
    setBusy("new");
    setNotice("");
    try {
      const created = await createSpaceRequest(selectedSpace.id, {
        kind,
        by: uid,
        ...(toUid ? { to: toUid } : {}),
        text,
      }, selectedSpace.name);
      setRequests((current) => [created, ...current]);
      setText("");
      setNotice(created.queued ? t("cs.offline.queued", "Saved here. It will sync when you're back online.") : t("cs.requests.sent", "Request sent to the team."));
    } catch (error) {
      setNotice(error instanceof Error && error.message === "request-offline-storage-unavailable"
        ? t("cs.requests.offline.storage.error", "This device could not save the request offline. Connect and try again.")
        : t("cs.requests.send.error", "This request could not be sent. Check your access and try again."));
    } finally { setBusy(""); }
  }

  async function decide(request: SpaceRequest, state: RequestDecision) {
    const space = spaces.find((entry) => entry.id === request.spaceId);
    if (!space || busy) return;
    setBusy(request.id);
    setNotice("");
    try {
      const updated = await decideSpaceRequest(request, state, uid, space.role);
      setRequests((current) => current.map((row) => row.id === request.id && row.spaceId === request.spaceId ? updated : row));
      setNotice(updated.queued ? t("cs.offline.queued", "Saved here. It will sync when you're back online.")
        : state === "done" ? t("cs.requests.done.success", "Request marked done.") : t("cs.requests.declined.success", "Request declined."));
    } catch {
      setNotice(t("cs.requests.decide.error", "This request could not be updated. Check that it is still open and assigned to you."));
    } finally { setBusy(""); }
  }

  function renderRequest(request: SpaceRequest) {
    const canDecide = selectedSpace?.role === "admin" || request.to === uid;
    const askedBy = team.find((member) => member.uid === request.by)?.displayName ?? t("cs.requests.person.unknown", "Team member");
    const addressedTo = request.to ? team.find((member) => member.uid === request.to)?.displayName : undefined;
    const label = KINDS.find((entry) => entry.value === request.kind)?.label ?? request.kind;
    const happened = requestTime(request.at);
    const resolvedStatus = request.state === "open"
      ? t("cs.requests.state.open", "Open")
      : request.state === "done" ? t("cs.requests.state.done", "Done") : t("cs.requests.state.declined", "Declined");
    const status = request.queued ? `${resolvedStatus} · ${t("cs.offline.waiting", "Waiting to sync")}` : resolvedStatus;
    return <article className="card" key={`${request.spaceId}-${request.id}`}>
      <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <strong>{t(`cs.requests.kind.${request.kind}`, label)}</strong>
        <span className="tag" style={{ fontSize: 17 }}>{status}</span>
      </div>
      <p style={{ margin: "8px 0" }}>{request.text}</p>
      <p className="muted" style={{ margin: 0 }}>
        {t("cs.requests.from", "From")}: {askedBy}{addressedTo ? ` · ${t("cs.requests.to", "To")}: ${addressedTo}` : ""}
        {happened ? ` · ${happened.toLocaleString()}` : ""}
      </p>
      {request.state === "open" && canDecide && <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button type="button" className="btn alt" disabled={busy === request.id} onClick={() => void decide(request, "done")} style={{ minHeight: 44 }}>{t("cs.requests.markDone", "Mark done")}</button>
        <button type="button" className="chip" disabled={busy === request.id} onClick={() => void decide(request, "declined")} style={{ minHeight: 44 }}>{t("cs.requests.decline", "Decline")}</button>
      </div>}
      {request.state === "open" && !canDecide && <p className="muted" style={{ margin: "10px 0 0" }}>{t("cs.requests.waiting", "Only the person asked or a family admin can close this request.")}</p>}
    </article>;
  }

  return <div className="app">
    <BackBar title={t("cs.requests.title", "Requests")} onBack={onBack ?? nav.back} />
    <div className="scroll">
      {notice && <p role="status" style={{ margin: "0 0 12px" }}>{notice}</p>}
      {loading ? <div className="sk" style={{ height: 160 }} /> : !selectedSpace ? <Empty mood="oops" title={t("cs.requests.space.empty.title", "No family space yet")} body={t("cs.requests.space.empty.body", "Join a family space to send and review requests.")} /> : <>
        {spaces.length > 1 && <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ display: "block", marginBottom: 6 }}>{t("cs.requests.family", "Family space")}</span>
          <select className="field" value={spaceId} onChange={(event) => setSpaceId(event.target.value)} aria-label={t("cs.requests.family", "Family space")}>
            {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
          </select>
        </label>}
        <p className="muted" style={{ margin: "0 0 12px" }}>{t("cs.requests.private.note", "Requests stay inside this family space.")}</p>
        <section className="card" style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 24, margin: "0 0 12px" }}>{t("cs.requests.new.heading", "Make a request")}</h2>
          <form onSubmit={(event) => void submit(event)} style={{ display: "grid", gap: 12 }}>
            <label>
              <span style={{ display: "block", marginBottom: 6 }}>{t("cs.requests.kind.label", "Request type")}</span>
              <select className="field" value={kind} onChange={(event) => setKind(event.target.value as RequestKind)} aria-label={t("cs.requests.kind.label", "Request type")}>
                {KINDS.map((entry) => <option key={entry.value} value={entry.value}>{t(entry.key, entry.label)}</option>)}
              </select>
            </label>
            <label>
              <span style={{ display: "block", marginBottom: 6 }}>{t("cs.requests.message.label", "What do you need?")}</span>
              <textarea className="field" value={text} onChange={(event) => setText(event.target.value)} maxLength={300} rows={3} required
                placeholder={t(`cs.requests.hint.${kind}`, currentKind.hint)} />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: 6 }}>{t("cs.requests.recipient", "Send to")}</span>
              <select className="field" value={toUid} onChange={(event) => setToUid(event.target.value)} aria-label={t("cs.requests.recipient", "Send to")}>
                {selectedSpace.role === "admin" && <option value="">{t("cs.requests.recipient.any", "Any admin")}</option>}
                {recipients.map((member) => <option key={member.uid} value={member.uid}>{member.displayName}{member.role === "admin" ? ` · ${t("cs.requests.role.admin", "Admin")}` : ""}</option>)}
              </select>
            </label>
            <button type="submit" className="btn" disabled={busy === "new" || !text.trim()} style={{ minHeight: 44 }}>
              {busy === "new" ? t("cs.requests.sending", "Sending…") : t("cs.requests.send", "Send request")}
            </button>
          </form>
        </section>
        <section>
          <h2 style={{ fontSize: 24, margin: "0 0 10px" }}>{t("cs.requests.open.heading", "Waiting for an answer")}</h2>
          {openRequests.length ? <div style={{ display: "grid", gap: 10 }}>{openRequests.map(renderRequest)}</div>
            : <Empty mood="rest" title={t("cs.requests.open.empty.title", "No open requests")} body={t("cs.requests.open.empty.body", "New photo, meal, shopping and schedule requests will show here.")} />}
        </section>
        {resolvedRequests.length > 0 && <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 24, margin: "0 0 10px" }}>{t("cs.requests.history.heading", "Recent decisions")}</h2>
          <div style={{ display: "grid", gap: 10 }}>{resolvedRequests.map(renderRequest)}</div>
        </section>}
      </>}
    </div>
  </div>;
}
