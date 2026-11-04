import { APP1, Bunny, TAGLINE, t, type ScreenProps } from "@cc/core";
import "./builder/builder.css";

type WelcomeParams = { onPick: (side: "family" | "carer") => void };
export default function Welcome({ params }: ScreenProps) {
  const { onPick } = params as WelcomeParams;
  function pick(side: "family" | "carer") {
    try { localStorage.setItem("caresits-side", side); } catch { /* the app callback keeps the pick in memory */ }
    onPick(side);
  }
  return <main className="onb-welcome">
    <Bunny mood="hello" size={148} className="onb-welcome-bunny" />
    <header><h1>{t("onb.welcome.title", APP1)}</h1><p className="onb-welcome-tagline">{t("onb.welcome.tagline", TAGLINE)}</p></header>
    <div className="onb-welcome-cards" aria-label={t("onb.welcome.choose", `Choose how you will use ${APP1}`)}>
      <button className="onb-welcome-card" type="button" onClick={() => pick("family")}><span className="onb-welcome-icon" aria-hidden="true">⌂</span><span>{t("onb.welcome.family", "I need care")}</span></button>
      <button className="onb-welcome-card" type="button" onClick={() => pick("carer")}><span className="onb-welcome-icon" aria-hidden="true">♡</span><span>{t("onb.welcome.carer", "I give care")}</span></button>
    </div>
  </main>;
}
