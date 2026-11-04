import "../lib/i18n";
import { useEffect, useState } from "react";
import { BackBar, Chip, Empty, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { getSpaceAccess, type SpaceAccess } from "../data/spaces";
import { ChatPanel, TodayTimeline } from "./today";

type SpaceParams = { spaceId: string };
type SpaceTab = "today" | "chat";

export default function Screen({ params }: ScreenProps<SpaceParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const [tab, setTab] = useState<SpaceTab>("today");
  const [access, setAccess] = useState<SpaceAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!user?.uid || !params.spaceId) { setLoading(false); return; }
    void getSpaceAccess(user.uid, params.spaceId).then((value) => {
      if (alive) setAccess(value);
    }).catch(() => {
      if (alive) setAccess(null);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params.spaceId, user?.uid]);

  return <div className="app">
    <BackBar title={access?.space.name ?? t("cs.space.title", "Care Space")} onBack={nav.back} right={<span className="tag">{t("cs.space.private", "Private")}</span>} />
    <div className="row" role="tablist" aria-label={t("cs.space.tabs", "Care Space sections")} style={{ padding: "0 16px 10px", gap: 8 }}>
      <Chip on={tab === "today"} role="tab" aria-selected={tab === "today"} onClick={() => setTab("today")}>{t("cs.space.today", "Today")}</Chip>
      <Chip on={tab === "chat"} role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>{t("cs.space.chat", "Chat")}</Chip>
    </div>
    <div className="screen">
      {loading ? <div className="scroll"><div className="sk" style={{ height: 160 }} /></div>
        : !access || !user?.uid ? <div className="scroll"><Empty mood="oops" title={t("cs.space.unavailable.title", "This space is not available")} body={t("cs.space.unavailable.body", "Ask a family admin to check your access.")} /></div>
        : tab === "today" ? <TodayTimeline spaceId={params.spaceId} uid={user.uid} member={access.member} />
        : <ChatPanel spaceId={params.spaceId} uid={user.uid} member={access.member} />}
    </div>
  </div>;
}
