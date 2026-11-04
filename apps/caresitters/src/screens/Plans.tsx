import { BackBar, Bunny, t, useNav } from "@cc/core";

type Plan = { name: string; price: string; note: string };
const plans: Plan[] = [
  { name: t("plans.finding", "Finding"), price: "A$14.95", note: t("plans.finding.note", "For families finding care") },
  { name: t("plans.familyPlus", "Family Plus"), price: "A$24.95", note: t("plans.familyPlus.note", "For families who need more") },
  { name: t("plans.searchPass", "Search Pass"), price: "A$49", note: t("plans.searchPass.note", "For an extended search") },
];
export default function Plans() {
  const nav = useNav();
  return <div className="app">
    <BackBar title={t("plans.title", "Plans and prices")} onBack={nav.back} />
    <div className="scroll">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBlockEnd: 16 }}><div><p className="muted" style={{ margin: 0 }}>{t("plans.kicker", "Plain prices")}</p><h1>{t("plans.title", "Plans and prices")}</h1></div><Bunny mood="point" size={74} /></header>
      <p>{t("plans.intro", "Choose a family plan when you are ready to search for care.")}</p>
      <div style={{ display: "grid", gap: 12, marginBlock: 18 }}>
        {plans.map((plan) => <article key={plan.name} className="card" style={{ borderInlineStart: "5px solid var(--sage)" }}>
          <h2>{plan.name}</h2><p className="muted">{plan.note}</p><p style={{ marginBlock: 8, font: "700 30px/1.1 Newsreader,serif" }}>{plan.price}</p>
        </article>)}
      </div>
      <section className="card" aria-label={t("plans.carers.label", "Carers pay nothing") }>
        <p className="muted" style={{ margin: 0 }}>{t("plans.carers.kicker", "For carers")}</p>
        <h2 style={{ marginBlockStart: 4 }}>{t("plans.carers.free", "Carers pay nothing, ever")}</h2>
      </section>
    </div>
  </div>;
}
