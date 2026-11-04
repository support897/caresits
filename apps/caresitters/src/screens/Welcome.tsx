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
    <header className="onb-welcome-heading"><p className="onb-kicker">{t("onb.welcome.brand", APP1)}</p><h1>{t("onb.welcome.title", "Your childcare community")}</h1><p className="onb-welcome-tagline">{t("onb.welcome.tagline", "Find your perfect match.")}</p><p className="onb-welcome-support">{t("onb.welcome.support", "Trusted childcare starts with the right connection.")}</p><p className="onb-welcome-brandline">{t("onb.welcome.brandline", TAGLINE)}</p></header>
    <div className="onb-welcome-cards" role="group" aria-label={t("onb.welcome.choose", `Choose how you will use ${APP1}`)}>
      <button className="onb-welcome-card" type="button" aria-label={t("onb.welcome.family", "I need care")} onClick={() => pick("family")}><span className="onb-welcome-icon" aria-hidden="true">⌂</span><span className="onb-welcome-copy"><strong>{t("onb.welcome.family", "I need care")}</strong><small>{t("onb.welcome.family.detail", "Find a carer who fits your family, schedule and values.")}</small></span></button>
      <button className="onb-welcome-card" type="button" aria-label={t("onb.welcome.carer", "I give care")} onClick={() => pick("carer")}><span className="onb-welcome-icon" aria-hidden="true">♡</span><span className="onb-welcome-copy"><strong>{t("onb.welcome.carer", "I give care")}</strong><small>{t("onb.welcome.carer.detail", "Share your experience and meet families who fit your work.")}</small></span></button>
    </div>
  </main>;
}
