import { APP1, Bunny, t, type ScreenProps } from "@cc/core";
import "./builder/builder.css";

type WelcomeParams = { onPick: (side: "family" | "carer") => void };
export default function Welcome({ params }: ScreenProps) {
  const { onPick } = params as WelcomeParams;
  function pick(side: "family" | "carer") {
    try { localStorage.setItem("caresits-side", side); } catch { /* the app callback keeps the pick in memory */ }
    onPick(side);
  }
  return <main className="onb-welcome">
    <header className="onb-welcome-heading"><h1 aria-label={APP1} style={{ margin: 0 }}><img src="/brand/lockup-tight.png" alt={APP1} style={{ width: "min(86vw, 340px)", height: "auto", display: "block", margin: "0 auto" }} /></h1><p className="onb-welcome-tagline">{t("onb.welcome.tagline", "Find your perfect match.")}</p></header>
    <div className="onb-welcome-cards" role="group" aria-label={t("onb.welcome.choose", `Choose how you will use ${APP1}`)}>
      <button className="onb-welcome-card" type="button" aria-label={t("onb.welcome.family", "I need care")} onClick={() => pick("family")}><span className="onb-welcome-icon" aria-hidden="true">⌂</span><span className="onb-welcome-copy"><strong>{t("onb.welcome.family", "I need care")}</strong></span></button>
      <button className="onb-welcome-card" type="button" aria-label={t("onb.welcome.carer", "I give care")} onClick={() => pick("carer")}><span className="onb-welcome-icon" aria-hidden="true">♡</span><span className="onb-welcome-copy"><strong>{t("onb.welcome.carer", "I give care")}</strong></span></button>
    </div>
  </main>;
}
