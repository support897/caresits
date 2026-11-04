import { type Person, Bunny, t, useNav } from "@cc/core";

type Params = { me: Person; reload?: () => void };
export default function Me({ params }: { params: Params }) {
  const nav = useNav();
  const { me } = params;
  const headline = typeof me.card.headline === "string" ? me.card.headline : "";
  const location = [me.card.suburb, me.postcode].filter((part): part is string => typeof part === "string" && Boolean(part)).join(" · ");
  const links = [
    { title: t("me.qualifications", "Qualifications"), body: t("me.qualifications.body", "Checks, documents and review dates"), action: () => nav.push("quals", { me }) },
    { title: t("me.safety", "Safety"), body: t("me.safety.body", "Reports, blocks and emergency contacts"), action: () => nav.push("safety", { uid: me.uid }) },
    ...(me.side === "family" ? [{ title: t("me.weights", "Match priorities"), body: t("me.weights.body", "Choose what matters most to your family"), action: () => nav.push("weights", { me }) }] : []),
    { title: t("me.plans", "Plans"), body: t("me.plans.body", "Clear prices for families"), action: () => nav.push("plans", { me }) },
    { title: t("me.settings", "Settings"), body: t("me.settings.body", "Language, notifications and privacy"), action: () => nav.push("settings", { me }) },
  ];
  return <div style={{ height: "100%", minHeight: 0, overflowY: "auto", padding: 16, background: "var(--cream)" }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBlockEnd: 16 }}><div><p className="muted" style={{ margin: 0 }}>{t("me.kicker", "Your account")}</p><h1>{t("me.title", "Me")}</h1></div><Bunny mood="hello" size={74} /></header>
    <section className="card" aria-label={t("me.profile.summary", "Profile summary")}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="av" style={{ width: 72, height: 72, fontSize: 27 }}>{me.photoUrl ? <img src={me.photoUrl} alt="" /> : me.firstName.slice(0, 1).toUpperCase()}</span>
        <div style={{ minWidth: 0 }}><h2 style={{ fontSize: 25, overflowWrap: "anywhere" }}>{me.name}</h2><p className="muted" style={{ margin: "4px 0" }}>{me.side === "carer" ? t("me.role.carer", "Carer") : t("me.role.family", "Family")}</p></div>
      </div>
      {headline && <h3 style={{ marginBlockStart: 14 }}>{headline}</h3>}
      {me.about && <p style={{ overflowWrap: "anywhere" }}>{me.about}</p>}
      {location && <p className="muted">{location}</p>}
      {me.side === "carer" && <div style={{ marginBlock: 12 }}><button className="btn alt" type="button" onClick={() => nav.push("quals", { me })}>{t("me.viewChecks", "View qualifications")}</button></div>}
      <button className="btn" type="button" onClick={() => nav.push("edit-profile", { edit: true })}>{t("me.edit", "Edit profile")}</button>
    </section>
    <nav aria-label={t("me.account.links", "Account links")} style={{ display: "grid", gap: 10, marginBlockStart: 14 }}>
      {links.map((item) => <button key={item.title} type="button" className="card" onClick={item.action} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 72, textAlign: "start" }}>
        <span><strong style={{ display: "block" }}>{item.title}</strong><span className="muted">{item.body}</span></span><span className="flip" aria-hidden="true">›</span>
      </button>)}
    </nav>
  </div>;
}
