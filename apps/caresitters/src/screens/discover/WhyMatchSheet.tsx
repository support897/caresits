import { Button, Sheet, t } from "@cc/core";
import type { MatchProfile, MatchResult } from "../../../../../packages/core/src/match/types";
import { explain } from "../../../../../packages/core/src/match/engine";

export function WhyMatchSheet({ viewer, candidate, result, onClose }: { viewer: MatchProfile; candidate: MatchProfile; result: MatchResult; onClose: () => void }) {
  const sentences = explain(viewer, candidate, result);
  const visaLine = sentences.find((sentence) => sentence.startsWith("Visa status:"));
  const detailLines = sentences.filter((sentence) => !sentence.startsWith("Visa status:") && !sentence.startsWith("Unmet essential:"));
  return <Sheet label={t("disc.whyTitle", "Why this match")} onClose={onClose}>
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2>{t("disc.whyTitle", "Why this match")}</h2>
        <Button type="button" alt small onClick={onClose}>{t("disc.close", "Close")}</Button>
      </div>
      <div className="card" style={{ display: "grid", gap: 8 }}>
        <b>{result.score === null ? t("disc.scoreUnavailable", "Match score not available yet") : t("disc.matchScore", "{score}% match", { score: result.score })}</b>
        {result.unmetEssentials.length > 0 && <div role="alert" style={{ color: "var(--danger)", fontWeight: 700 }}>{t("disc.unmetHeading", "This profile does not meet every essential.")}</div>}
        <h3>{t("disc.addsUp", "How it adds up")}</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {result.criteria.map((row) => <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, borderBottom: "1px solid var(--line)", paddingBlock: 6 }}>
            <span>{row.label}</span><b>{row.weight}%</b>
            <span className="muted">{row.fit === null ? t("disc.notStated", "Not stated") : t("disc.fitPercent", "{fit}% fit", { fit: Math.round(row.fit * 100) })}</span><span />
          </div>)}
        </div>
      </div>
      <section aria-labelledby="disc-why-details">
        <h3 id="disc-why-details">{t("disc.details", "What we know")}</h3>
        <ul style={{ paddingInlineStart: 24, marginBlock: 8, display: "grid", gap: 8 }}>
          {detailLines.map((sentence, index) => <li key={`${index}-${sentence}`}>{sentence}</li>)}
        </ul>
      </section>
      {result.unmetEssentials.length > 0 && <section aria-labelledby="disc-unmet-heading">
        <h3 id="disc-unmet-heading">{t("disc.unmetHeading", "Unmet essentials")}</h3>
        <ul style={{ paddingInlineStart: 24, marginBlock: 8, display: "grid", gap: 8, color: "var(--danger)" }}>
          {result.unmetEssentials.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>}
      {visaLine && <p className="card" style={{ margin: 0 }}><b>{t("disc.visaTitle", "Visa status")}</b><br />{visaLine}</p>}
    </div>
  </Sheet>;
}
