import "../lib/i18n";
import { useEffect, useState } from "react";
import { BackBar, Empty, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { getSpaceAccess, type SpaceAccess } from "../data/spaces";
import { TodayTimeline } from "./today";

type TodayParams = { spaceId: string };

export default function Screen({ params }: ScreenProps<TodayParams>) {
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
    <BackBar title={t("cs.today.title", "Today")} onBack={nav.back} />
    <div className="screen">
      {loading ? <div className="scroll"><div className="sk" style={{ height: 160 }} /></div>
        : access && user?.uid ? <TodayTimeline spaceId={params.spaceId} uid={user.uid} member={access.member} />
        : <div className="scroll"><Empty mood="oops" title={t("cs.space.unavailable.title", "This space is not available")} body={t("cs.space.unavailable.body", "Ask a family admin to check your access.")} /></div>}
    </div>
  </div>;
}
