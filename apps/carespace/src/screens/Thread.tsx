import "../lib/i18n";
import { useEffect, useState } from "react";
import { BackBar, Empty, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { getSpaceAccess, type SpaceAccess } from "../data/spaces";
import { ChatPanel } from "./today";

type ThreadParams = { spaceId: string };

export default function Screen({ params }: ScreenProps<ThreadParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const [access, setAccess] = useState<SpaceAccess | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    if (!user?.uid || !params.spaceId) { setLoading(false); return; }
    void getSpaceAccess(user.uid, params.spaceId).then((value) => { if (alive) setAccess(value); })
      .catch(() => { if (alive) setAccess(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params.spaceId, user?.uid]);
  return <div className="app">
    <BackBar title={access?.space.name ?? t("cs.thread.title", "Chat")} onBack={nav.back} right={<span className="av" role="img" aria-label={t("cs.thread.space.image", "Private family space")}
      style={{ color: "var(--text)", background: "var(--soft)", fontSize: 20 }}>{access?.space.name.slice(0, 1).toUpperCase() ?? "C"}</span>} />
    {access && user?.uid && <nav className="row" aria-label={t("cs.thread.sections", "Care Space sections")} style={{ padding: "0 16px 10px", gap: 8 }}>
      <button type="button" className="chip on" aria-current="page">{t("cs.thread.chat", "Chat")}</button>
      <button type="button" className="chip" onClick={() => nav.push("today", { spaceId: params.spaceId })}>{t("cs.space.updates", "Updates")}</button>
      <button type="button" className="chip" onClick={() => nav.push("space", { spaceId: params.spaceId, section: "photos" })}>{t("cs.space.photos", "Photos")}</button>
      <button type="button" className="chip" onClick={() => nav.push("space", { spaceId: params.spaceId, section: "children" })}>{t("cs.space.children", "Children")}</button>
      <button type="button" className="chip" onClick={() => nav.push("calendar-space", { uid: user.uid, spaceId: params.spaceId })}>{t("cs.space.calendar", "Calendar")}</button>
      <button type="button" className="chip" onClick={() => nav.push("timeoff", { uid: user.uid, spaceId: params.spaceId })}>{t("cs.space.requests", "Requests")}</button>
      <button type="button" className="chip" onClick={() => nav.push("space", { spaceId: params.spaceId })}>{t("cs.thread.openSpace", "Open Care Space")}</button>
    </nav>}
    <div className="screen">
      {loading ? <div className="scroll"><div className="sk" style={{ height: 160 }} /></div>
        : access && user?.uid ? <ChatPanel spaceId={params.spaceId} uid={user.uid} member={access.member} />
        : <div className="scroll"><Empty mood="oops" title={t("cs.space.unavailable.title", "This space is not available")} body={t("cs.space.unavailable.body", "Ask a family admin to check your access.")} /></div>}
    </div>
  </div>;
}
