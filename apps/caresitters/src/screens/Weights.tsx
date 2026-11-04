import { useEffect, useState } from "react";
import { BackBar, Bunny, Button, t, useNav, type ScreenProps } from "@cc/core";
import type { Person } from "@cc/core";
import { saveProfile } from "@cc/core";
import { DEFAULT_WEIGHTS, MATCH_CRITERIA, normalizeWeights, type MatchWeights } from "../../../../packages/core/src/match";

type ScreenParams = ScreenProps["params"] & { me: Person };
const LABELS: Record<keyof MatchWeights, string> = {
  experience: "Experience",
  personality: "Personality and care style",
  availability: "Availability",
  budget: "Budget",
  location: "Location",
  activities: "Activities",
};

export default function Weights({ params }: ScreenProps) {
  const { me } = params as ScreenParams;
  const nav = useNav();
  const [weights, setWeights] = useState<MatchWeights>(() => normalizeWeights(me.card.weights as Partial<MatchWeights> | undefined));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => { setWeights(normalizeWeights(me.card.weights as Partial<MatchWeights> | undefined)); }, [me.uid, me.card.weights]);
  function changeWeight(id: keyof MatchWeights, value: number) {
    setWeights((previous) => normalizeWeights({ ...previous, [id]: value }));
    setSaved(false);
  }
  async function save() {
    setSaving(true);
    setError(false);
    setSaved(false);
    try {
      await saveProfile(me.uid, { card: { weights } });
      window.dispatchEvent(new CustomEvent("cc:match-weights-updated", { detail: { uid: me.uid, weights } }));
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return <div className="app">
    <BackBar title={t("weights.title", "Match weights")} onBack={nav.back} />
    <div className="scroll">
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <h2>{t("weights.heading", "Choose what matters most")}</h2>
        <p className="muted" style={{ margin: 0 }}>{t("weights.help", "Move a slider. All weights always add up to 100%.")}</p>
        {MATCH_CRITERIA.map((id) => <label key={id} style={{ display: "grid", gap: 6, borderTop: "1px solid var(--line)", paddingBlockStart: 12 }}>
          <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><b>{t(`weights.${id}`, LABELS[id])}</b><b aria-live="polite">{weights[id]}%</b></span>
          <input type="range" min={0} max={100} step={1} value={weights[id]} aria-label={t(`weights.${id}`, LABELS[id])} aria-valuetext={`${weights[id]} percent`} onChange={(event) => changeWeight(id, Number(event.target.value))} style={{ width: "100%", minHeight: 44, accentColor: "var(--ink)" }} />
        </label>)}
        <div role="status" aria-live="polite" className="tag" style={{ justifySelf: "start" }}>{t("weights.total", "Total: {total}%", { total: Object.values(weights).reduce((sum, value) => sum + value, 0) })}</div>
        <div className="row"><Button type="button" alt small onClick={() => { setWeights({ ...DEFAULT_WEIGHTS }); setSaved(false); }}>{t("weights.reset", "Reset defaults")}</Button><Button type="button" small disabled={saving} onClick={() => void save()}>{saving ? t("weights.saving", "Saving…") : t("weights.save", "Save weights")}</Button></div>
        {saved && <div role="status" className="row" style={{ alignItems: "center" }}><Bunny mood="celebrate" size={68} caption={t("weights.saved", "Weights saved to your profile.")} /><p style={{ margin: 0 }}>{t("weights.saved", "Weights saved to your profile.")}</p></div>}
        {error && <p role="alert" style={{ margin: 0, color: "var(--danger)" }}>{t("weights.error", "Could not save weights. Try again.")}</p>}
      </div>
    </div>
  </div>;
}
