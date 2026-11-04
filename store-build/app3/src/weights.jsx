// USAGE: <WeightsEditor weights={weights} onChange={setWeights} />; weights is a six-key number map.
import React from "react";
import { WEIGHTS } from "./match6.js";
import { t } from "./tr.js";
import "./weights.css";

const DEFAULT_WEIGHTS = Object.fromEntries(WEIGHTS.map(([id, , value]) => [id, value]));
const KEYS = WEIGHTS.map(([id]) => id);
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

export function normaliseWeights(weights = {}) {
  const values = Object.fromEntries(WEIGHTS.map(([id, , fallback]) => {
    const raw = weights && Object.prototype.hasOwnProperty.call(weights, id) ? Number(weights[id]) : fallback;
    return [id, Number.isFinite(raw) && raw >= 0 ? raw : 0];
  }));
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  if (!total) return { ...DEFAULT_WEIGHTS };

  const exact = Object.fromEntries(KEYS.map((id) => [id, values[id] * 100 / total]));
  const rounded = Object.fromEntries(KEYS.map((id) => [id, Math.floor(exact[id])]));
  let left = 100 - Object.values(rounded).reduce((sum, value) => sum + value, 0);
  const byRemainder = [...KEYS].sort((a, b) => (exact[b] - rounded[b]) - (exact[a] - rounded[a]) || KEYS.indexOf(a) - KEYS.indexOf(b));
  for (let i = 0; i < left; i += 1) rounded[byRemainder[i % byRemainder.length]] += 1;
  return rounded;
}

function changedWeight(current, id, requested) {
  const base = normaliseWeights(current);
  const value = clamp(Number(requested));
  const restKeys = KEYS.filter((key) => key !== id);
  const oldTotal = restKeys.reduce((sum, key) => sum + base[key], 0);
  const remaining = 100 - value;
  const next = { ...base, [id]: value };
  restKeys.forEach((key) => {
    next[key] = oldTotal ? remaining * base[key] / oldTotal : remaining / restKeys.length;
  });
  return normaliseWeights(next);
}

export function WeightsEditor({ weights, onChange }) {
  const current = normaliseWeights(weights);
  const total = Object.values(current).reduce((sum, value) => sum + value, 0);
  return <section className="we-editor" aria-label={t("weights.title", "Match weights")}>
    <header className="we-head">
      <div><h2>{t("weights.title", "Match weights")}</h2><p>{t("weights.help", "Choose what matters most. The total stays at 100%.")}</p></div>
      <strong className="we-total" aria-live="polite">{total}%</strong>
    </header>
    <div className="we-sliders">
      {WEIGHTS.map(([id, name]) => <label className="we-row" key={id}>
        <span className="we-row-label"><span>{t(`weights.${id}`, name)}</span><strong>{current[id]}%</strong></span>
        <input type="range" min="0" max="100" step="1" value={current[id]} aria-label={t(`weights.${id}`, name)} onChange={(event) => onChange?.(changedWeight(current, id, event.target.value))} />
      </label>)}
    </div>
    <button className="we-reset" type="button" onClick={() => onChange?.({ ...DEFAULT_WEIGHTS })}>{t("weights.reset", "Reset")}</button>
  </section>;
}
