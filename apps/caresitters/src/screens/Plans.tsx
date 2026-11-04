import { BackBar, Bunny, t, useNav } from "@cc/core";

/** Everything is free for now. No paywall, no card, no trial timer (owner decision, 4 Nov 2026). */
export default function Plans() {
  const nav = useNav();
  return <div className="app">
    <BackBar title={t("plans.title", "Plans and prices")} onBack={nav.back} />
    <div className="scroll" style={{ textAlign: "center" }}>
      <Bunny mood="celebrate" size={120} />
      <h1>{t("plans.free.title", "Free for everyone, for now")}</h1>
      <p>{t("plans.free.body", "Searching, matching, booking and the Care Space are all free. We will never ask for a card here.")}</p>
      <section className="card" aria-label={t("plans.carers.label", "Carers pay nothing")} style={{ borderInlineStart: "5px solid var(--sage)", textAlign: "start" }}>
        <p className="muted" style={{ margin: 0 }}>{t("plans.carers.kicker", "For carers")}</p>
        <h2 style={{ marginBlockStart: 4 }}>{t("plans.carers.free", "Carers pay nothing, ever")}</h2>
      </section>
    </div>
  </div>;
}
