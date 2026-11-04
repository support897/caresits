import { useEffect, useState } from "react";
import { Button, Empty, haptic, t, useNav, type ScreenProps } from "@cc/core";
import type { Person } from "@cc/core";
import { loadSavedPeople, removeSavedPerson, type DiscoveryPerson } from "../data/people";
import { PersonCard } from "./discover/PersonCard";
import { WhyMatchSheet } from "./discover/WhyMatchSheet";
import { distanceKmBetween } from "./discover/helpers";
import { scoreMatch, type MatchResult, type MatchWeights } from "../../../../packages/core/src/match";

type ScreenParams = ScreenProps["params"] & { me: Person; people?: DiscoveryPerson[] };
type Row = { person: DiscoveryPerson; km: number | null; result: MatchResult };

export default function Saved({ params }: ScreenProps) {
  const { me, people: fakePeople } = params as ScreenParams;
  const nav = useNav();
  const [people, setPeople] = useState<DiscoveryPerson[]>(fakePeople ?? []);
  const [loading, setLoading] = useState(!fakePeople);
  const [error, setError] = useState(false);
  const [why, setWhy] = useState<Row | null>(null);
  const [matchWeights, setMatchWeights] = useState<Partial<MatchWeights> | undefined>(undefined);

  useEffect(() => {
    let current = true;
    if (fakePeople) { setPeople(fakePeople); setLoading(false); return () => { current = false; }; }
    setLoading(true);
    setError(false);
    void loadSavedPeople(me).then((loaded) => { if (current) { setPeople(loaded); setLoading(false); } }).catch(() => { if (current) { setError(true); setLoading(false); } });
    return () => { current = false; };
  }, [fakePeople, me, me.uid]);

  useEffect(() => {
    const onWeightsSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string; weights?: Partial<MatchWeights> }>).detail;
      if (detail?.uid === me.uid && detail.weights) setMatchWeights(detail.weights);
    };
    window.addEventListener("cc:match-weights-updated", onWeightsSaved);
    return () => window.removeEventListener("cc:match-weights-updated", onWeightsSaved);
  }, [me.uid]);

  const rows: Row[] = people.map((person) => {
    const km = distanceKmBetween(me, person);
    return { person, km, result: scoreMatch({ viewer: me, candidate: person, km, radiusKm: 0, weights: matchWeights }) };
  });
  async function remove(person: DiscoveryPerson) {
    setPeople((previous) => previous.filter((item) => item.uid !== person.uid));
    haptic();
    try { await removeSavedPerson(me.uid, person.uid); }
    catch { setError(true); setPeople((previous) => previous.some((item) => item.uid === person.uid) ? previous : [...previous, person]); }
  }

  return <div className="app">
    <header style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)" }}>
      <h1>{t("saved.title", "Saved profiles")}</h1>
      <Button type="button" alt small onClick={() => nav.push("weights", { me })}>{t("saved.weights", "Weights")}</Button>
    </header>
    <div className="scroll">
      {loading && <Empty mood="rest" title={t("saved.loading", "Loading saved profiles…")} />}
      {error && <p role="alert" style={{ color: "var(--danger)" }}>{t("saved.error", "Saved profiles could not update. Try again.")}</p>}
      {!loading && rows.length === 0 && <Empty mood="rest" title={t("saved.emptyTitle", "No saved profiles yet")} body={t("saved.emptyBody", "Tap the heart on a profile to keep it here.")} />}
      {!loading && rows.length > 0 && <section aria-label={t("saved.title", "Saved profiles")} style={{ display: "flex", gap: 14, overflowX: "auto", padding: "12px 4px 18px", marginInline: -4 }}>
        {rows.map((row) => <div key={row.person.uid} style={{ flex: "0 0 auto" }}><PersonCard person={row.person} km={row.km} result={row.result} saved onSave={() => void remove(row.person)} onWhy={() => setWhy(row)} onOpen={() => nav.push("person", { uid: row.person.uid })} /></div>)}
      </section>}
    </div>
    {why && <WhyMatchSheet viewer={me} candidate={why.person} result={why.result} onClose={() => setWhy(null)} />}
  </div>;
}
