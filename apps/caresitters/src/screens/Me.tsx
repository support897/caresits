import { type Person, Bunny, t, useNav } from "@cc/core";

type Params = { me: Person; reload?: () => void };
const CARE_TYPES: Record<string, string> = {
  babysitter: t("me.care.babysitter", "Babysitter"),
  nanny: t("me.care.nanny", "Nanny"),
  au_pair: t("me.care.auPair", "Au pair"),
};
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function scheduleDays(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value as Record<string, unknown>).filter((day) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].includes(day));
}
export default function Me({ params }: { params: Params }) {
  const nav = useNav();
  const { me } = params;
  const headline = typeof me.card.headline === "string" ? me.card.headline : "";
  const location = [me.card.suburb, me.postcode].filter((part): part is string => typeof part === "string" && Boolean(part)).join(" · ");
  const careTypes = strings(me.card.careTypes).map((value) => CARE_TYPES[value] ?? value);
  const languages = strings(me.card.languages);
  const preferences = [...strings(me.card.style), ...strings(me.card.activities)];
  const availability = scheduleDays(me.side === "family" ? me.card.scheduleNeed : me.card.availability);
  const childrenCount = Array.isArray(me.card.kids) ? me.card.kids.length : 0;
  const rate = Number.isFinite(Number(me.card.rate)) && Number(me.card.rate) > 0 ? Number(me.card.rate) : null;
  const experienceYears = Number.isFinite(Number(me.card.experienceYears)) ? Number(me.card.experienceYears) : null;
  const links = [
    { title: t("me.qualifications", "Qualifications"), body: t("me.qualifications.body", "Checks, documents and review dates"), action: () => nav.push("quals", { me }) },
    { title: t("me.safety", "Safety"), body: t("me.safety.body", "Reports, blocks and emergency contacts"), action: () => nav.push("safety", { uid: me.uid }) },
    ...(me.side === "family" ? [{ title: t("me.weights", "Match priorities"), body: t("me.weights.body", "Choose what matters most to your family"), action: () => nav.push("weights", { me }) }] : []),
    { title: t("me.plans", "Plans"), body: t("me.plans.body", "Free for everyone, for now"), action: () => nav.push("plans", { me }) },
    { title: t("me.settings", "Settings"), body: t("me.settings.body", "Notifications, theme and privacy"), action: () => nav.push("settings", { me }) },
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
      <dl aria-label={t("me.profile.details", "Profile details")} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBlock: 14 }}>
        {careTypes.length > 0 && <div><dt className="muted">{t("me.profile.careTypes", "Care types")}</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{careTypes.join(", ")}</dd></div>}
        {languages.length > 0 && <div><dt className="muted">{t("me.profile.languages", "Languages")}</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{languages.join(", ")}</dd></div>}
        {availability.length > 0 && <div><dt className="muted">{t("me.profile.availability", "Usual days")}</dt><dd style={{ margin: 0 }}>{availability.join(", ")}</dd></div>}
        {preferences.length > 0 && <div><dt className="muted">{t("me.profile.preferences", "Care style and activities")}</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{preferences.join(", ")}</dd></div>}
        {me.side === "family" && childrenCount > 0 && <div><dt className="muted">{t("me.profile.children", "Children")}</dt><dd style={{ margin: 0 }}>{t("me.children.count", "{count} children", { count: childrenCount })}</dd></div>}
        {me.side === "family" && Number(me.card.budgetMax) > 0 && <div><dt className="muted">{t("me.profile.budget", "Hourly budget")}</dt><dd style={{ margin: 0 }}>{t("me.profile.money", "A${amount}/hour", { amount: Number(me.card.budgetMax) })}</dd></div>}
        {me.side === "carer" && rate !== null && <div><dt className="muted">{t("me.profile.rate", "Hourly rate")}</dt><dd style={{ margin: 0 }}>{t("me.profile.money", "A${amount}/hour", { amount: rate })}</dd></div>}
        {me.side === "carer" && experienceYears !== null && <div><dt className="muted">{t("me.profile.experience", "Childcare experience")}</dt><dd style={{ margin: 0 }}>{t("onb.experience.years", "{years} years", { years: experienceYears })}</dd></div>}
      </dl>
      <button className="btn" type="button" onClick={() => nav.push("edit-profile", { edit: true })}>{t("me.edit", "Edit profile")}</button>
    </section>
    <nav aria-label={t("me.account.links", "Account links")} style={{ display: "grid", gap: 10, marginBlockStart: 14 }}>
      {links.map((item) => <button key={item.title} type="button" className="card" onClick={item.action} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 72, textAlign: "start" }}>
        <span><strong style={{ display: "block" }}>{item.title}</strong><span className="muted">{item.body}</span></span><span className="flip" aria-hidden="true">›</span>
      </button>)}
    </nav>
  </div>;
}
