import { useNav, BackBar, t } from "@cc/core";
import { JoinWithCode } from "./profile/JoinWithCode";
export default function Screen() {
  const nav = useNav();
  return <div className="scroll"><BackBar title={t("cs.join.title", "Join with code")} onBack={() => nav.back()} />
    <JoinWithCode onJoined={(spaceId) => nav.push("space", { spaceId })} onCancel={() => nav.back()} /></div>;
}
