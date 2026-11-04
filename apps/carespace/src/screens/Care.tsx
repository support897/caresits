import { useEffect, useMemo, useState } from "react";
import { BackBar, Bunny, Button, t, useNav, type ScreenProps } from "@cc/core";
import { canReadMedical, DEMO_CHILDREN, DEMO_SPACES, loadCareSpaces, loadChildren, saveChild, type CareSpace, type ChildProfile } from "../data/children";
import { DEMO_MEDICAL, loadMedicalRecord } from "../data/medical";
import { AllergyBanner, CareEmpty, DemoNotice } from "./care/common";
import "./care/care.css";

type Params = { uid?: string; demo?: boolean };
const SECTIONS = { health: { notes: "" }, meals: { notes: "" }, sleep: { notes: "" }, mood: { notes: "" }, learning: { notes: "" }, memories: [] as string[] };
const demoMode = (explicit?: boolean) => explicit === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");

export default function Care({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const demo = demoMode(params.demo);
  const [spaces, setSpaces] = useState<CareSpace[]>([]);
  const [space, setSpace] = useState<CareSpace | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [allergies, setAllergies] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newChild, setNewChild] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("3");
  const [interests, setInterests] = useState("");
  const uid = params.uid ?? "";

  useEffect(() => {
    let live = true;
    setLoading(true);
    (demo ? Promise.resolve(DEMO_SPACES) : uid ? loadCareSpaces(uid) : Promise.resolve([]))
      .then((value) => { if (live) setSpaces(value); })
      .catch(() => { if (live) setError(t("care.loadSpacesError", "Could not load care spaces. Check your connection and try again.")); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [demo, uid]);

  useEffect(() => {
    if (!space) { setChildren([]); setAllergies({}); return; }
    let live = true;
    setLoading(true);
    const childRequest = demo ? Promise.resolve(DEMO_CHILDREN) : loadChildren(space.id);
    childRequest.then(async (items) => {
      if (!live) return;
      setChildren(items);
      const names: Record<string, string[]> = {};
      if (canReadMedical(space)) {
        await Promise.all(items.map(async (child) => {
          try {
            const record = demo ? DEMO_MEDICAL[child.id] : await loadMedicalRecord(space.id, child.id, space);
            names[child.id] = record?.allergies.map((allergy) => allergy.name).filter(Boolean) ?? [];
          } catch { names[child.id] = []; }
        }));
      }
      if (live) setAllergies(names);
    }).catch(() => { if (live) setError(t("care.loadChildrenError", "Could not load children for this space.")); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [space, demo]);

  const sortedSpaces = useMemo(() => spaces, [spaces]);
  async function createChild() {
    if (!space || !name.trim()) return;
    const ageYears = Math.max(0, Math.min(12, Number(age) || 0));
    try {
      const id = await saveChild(space.id, { name: name.trim(), ageYears, interests: interests.split(",").map((value) => value.trim()).filter(Boolean), sections: SECTIONS });
      setChildren((current) => [...current, { id, name: name.trim(), ageYears, interests: interests.split(",").map((value) => value.trim()).filter(Boolean), sections: SECTIONS }]);
      setName(""); setInterests(""); setAge("3"); setNewChild(false);
    } catch { setError(t("care.saveChildError", "Could not save this child profile. Check your access and try again.")); }
  }

  if (loading && !spaces.length) return <div className="scroll"><div className="care-wrap"><div className="sk" style={{ height: 150 }} /></div></div>;
  return <div className="scroll"><div className="care-wrap">
    {!space ? <>
      <div className="care-head"><div><h1>{t("care.title", "Care")}</h1><p>{t("care.pickSpace", "Choose one family space. Its child records stay separate.")}</p></div><Bunny mood="hello" size={70} /></div>
      {demo && <DemoNotice />}
      {error && <div className="care-info care-warning" role="alert">{error}</div>}
      {sortedSpaces.map((item) => <button className="care-space-card" key={item.id} onClick={() => { setError(""); setSpace(item); }}>
        <span className="care-badge" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</span>
        <span className="care-card-copy"><b>{item.name}</b><p>{t("care.spaceRole", "{role} · private family list", { role: item.role })}</p></span><span aria-hidden="true">›</span>
      </button>)}
      {!loading && !sortedSpaces.length && <CareEmpty title={t("care.emptySpaces", "No care spaces yet")} detail={t("care.emptySpacesDetail", "Ask a family admin to invite you to their private space.")} />}
    </> : <>
      <BackBar title={space.name} onBack={() => setSpace(null)} right={<span className="care-badge">{space.role}</span>} />
      {demo && <DemoNotice />}
      {error && <div className="care-info care-warning" role="alert">{error}</div>}
      <div className="care-head"><div><h1>{t("care.childrenTitle", "Children")}</h1><p>{t("care.childrenHint", "Open a profile to see the care notes and daily report.")}</p></div></div>
      {children.map((child) => <button className="care-child-card" key={child.id} onClick={() => nav.push("child", { spaceId: space.id, childId: child.id, childName: child.name, uid, role: space.role, perms: space.perms, ownerUid: space.ownerUid, demo })}>
        <span className="care-badge" aria-hidden="true">{child.name.slice(0, 1).toUpperCase()}</span>
        <span className="care-card-copy"><b>{child.name}</b><p>{t("care.age", "Age {age}", { age: child.ageYears })} · {child.interests.slice(0, 2).join(", ") || t("care.noInterests", "Interests not added")}</p></span>
        {!!allergies[child.id]?.length && <span className="care-badge" role="img" aria-label={t("care.allergyCount", "Has recorded allergies")}>! {allergies[child.id]?.length}</span>}
        <span aria-hidden="true">›</span>
      </button>)}
      {loading && <div className="care-info">{t("care.loadingChildren", "Loading children…")}</div>}
      {!loading && !children.length && <CareEmpty title={t("care.noChildren", "No child profiles here yet")} detail={t("care.noChildrenDetail", "An admin can add a child profile for this family.")} />}
      {space.role === "admin" && <section className="care-section">
        {!newChild ? <Button alt onClick={() => setNewChild(true)}>{t("care.addChild", "Add a child")}</Button> : <div className="care-card">
          <h2>{t("care.newChildTitle", "New child profile")}</h2>
          <label className="care-field"><span>{t("care.nameLabel", "Name or nickname")}</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="off" /></label>
          <label className="care-field"><span>{t("care.ageLabel", "Age in years")}</span><input type="number" min="0" max="12" step="0.25" value={age} onChange={(event) => setAge(event.target.value)} /></label>
          <label className="care-field"><span>{t("care.interestsLabel", "Interests, separated by commas")}</span><input value={interests} onChange={(event) => setInterests(event.target.value)} /></label>
          <div className="care-row"><Button onClick={() => void createChild()} disabled={!name.trim()}>{t("care.saveChild", "Save child")}</Button><Button alt onClick={() => setNewChild(false)}>{t("care.cancel", "Cancel")}</Button></div>
        </div>}
      </section>}
    </>}
  </div></div>;
}
