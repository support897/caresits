import { useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { Bunny, MediaImg, agentSay, haptic, t } from "@cc/core";
import type { DiscoveryPerson } from "../../data/people";
import type { MatchResult } from "../../../../../packages/core/src/match/types";
import { availabilitySummary, experienceYearsOf, introOf, rateOf, reviewsOf, suburbOf, verifiedBadgeText } from "./helpers";
import { MiniMap } from "../map/MiniMap";
import "./deck.css";

export type DeckRow = { person: DiscoveryPerson; km: number | null; result: MatchResult };
type Props = { rows: DeckRow[]; savedIds: Set<string>; onSave: (row: DeckRow) => void; onOpen: (row: DeckRow) => void; onWhy: (row: DeckRow) => void; onList: () => void; onMap?: (row: DeckRow) => void };

const ageOf = (p: DiscoveryPerson) => (typeof p.card.age === "number" && p.card.age >= 18 ? p.card.age : undefined);
const heroKey = (p: DiscoveryPerson): string | undefined => {
  const g = Array.isArray(p.card.gallery) ? p.card.gallery.filter((x): x is string => typeof x === "string") : [];
  const i = typeof p.card.mainPhotoIndex === "number" ? p.card.mainPhotoIndex : 0;
  return g[i] ?? g[0] ?? p.photoUrl;
};
const tagsOf = (p: DiscoveryPerson): string[] => {
  const raw = [...(Array.isArray(p.card.careTypes) ? p.card.careTypes : []), ...(Array.isArray(p.card.languages) ? p.card.languages : [])];
  return raw.filter((x): x is string => typeof x === "string").map((x) => x.replace(/_/g, " ")).slice(0, 3);
};

function Card({ row, top, onSwipe, onOpen }: { row: DeckRow; top: boolean; onSwipe: (dir: 1 | -1) => void; onOpen: () => void }) {
  const p = row.person; const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);
  const like = useTransform(x, [20, 120], [0, 1]); const nope = useTransform(x, [-120, -20], [1, 0]);
  const badge = verifiedBadgeText(p); const rating = reviewsOf(p); const rate = rateOf(p); const age = ageOf(p); const years = experienceYearsOf(p); const sub = suburbOf(p);
  const meta = [sub, row.km !== null ? `${row.km.toFixed(1)} km` : ""].filter(Boolean).join(" · ");
  return <motion.article className="deck-card" aria-label={p.firstName}
    style={{ x, rotate, zIndex: top ? 2 : 1 }} drag={top ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.9}
    onDragEnd={(_, info) => { if (info.offset.x > 110 || info.velocity.x > 600) onSwipe(1); else if (info.offset.x < -110 || info.velocity.x < -600) onSwipe(-1); }}
    initial={{ scale: top ? 0.96 : 0.92, opacity: 0 }} animate={{ scale: top ? 1 : 0.94, opacity: 1, y: top ? 0 : 14 }}
    exit={{ x: 420, opacity: 0, rotate: 18, transition: { duration: 0.25 } }} transition={{ type: "spring", stiffness: 300, damping: 26 }}>
    <button type="button" className="deck-hit" onClick={onOpen} aria-label={t("deck.open", "Open {name}", { name: p.firstName })}>
      <div className="deck-photo"><span className="deck-initial" aria-hidden="true">{p.firstName.slice(0, 1).toUpperCase()}</span><MediaImg src={heroKey(p)} alt="" className="deck-img" draggable={false} /></div>
      <div className="deck-scrim" />
      {badge && <span className="deck-badge">{badge === "Verified" ? t("deck.verified", "Verified") : t("deck.idSighted", "ID seen")}</span>}
      <div className="deck-info">
        <h2 className="deck-name">{p.firstName}{age ? <span className="deck-age"> {age}</span> : null}</h2>
        {meta && <p className="deck-meta">{meta}</p>}
        <div className="deck-tags">
          {typeof row.result.score === "number" && <span className="deck-tag pct">{Math.round(row.result.score)}% {t("deck.match", "match")}</span>}
          {rate !== undefined && <span className="deck-tag">A${rate}/hr</span>}
          {rating?.rating !== undefined && <span className="deck-tag">★ {rating.rating.toFixed(1)}</span>}
          {years !== undefined && <span className="deck-tag">{years}y</span>}
          {tagsOf(p).map((tag) => <span key={tag} className="deck-tag">{tag}</span>)}
        </div>
      </div>
    </button>
    {top && <><motion.span className="deck-stamp like" style={{ opacity: like }} aria-hidden="true">♥</motion.span><motion.span className="deck-stamp nope" style={{ opacity: nope }} aria-hidden="true">✕</motion.span></>}
  </motion.article>;
}

/** Tinder-style deck: swipe right to save, left to skip, tap to open. */
export function SwipeDeck({ rows, savedIds, onSave, onOpen, onWhy, onList, onMap }: Props) {
  const [detail, setDetail] = useState<DeckRow | null>(null); const [i, setI] = useState(0); const [last, setLast] = useState<number | null>(null); const [burst, setBurst] = useState(false);
  const cur = rows[i]; const next = rows[i + 1];
  function go(dir: 1 | -1) {
    if (!cur) return; haptic();
    if (dir === 1) { if (!savedIds.has(cur.person.uid)) { onSave(cur); agentSay("save"); } else agentSay("rematch"); setBurst(true); window.setTimeout(() => setBurst(false), 900); } else agentSay("pass");
    setLast(i); setI((n) => n + 1);
  }
  if (!cur) { agentSay("deck-empty"); }
  if (!cur) return <div className="deck-empty"><Bunny mood="celebrate" size={120} /><h2>{t("deck.done", "You saw everyone")}</h2>
    <button type="button" className="btn" onClick={() => setI(0)}>{t("deck.again", "Start again")}</button><button type="button" className="btn alt" onClick={onList}>{t("deck.list", "See list")}</button></div>;
  return <div className="deck">
    <div className="deck-stack" data-testid="deck">
      {next && <Card key={next.person.uid} row={next} top={false} onSwipe={() => {}} onOpen={() => {}} />}
      <AnimatePresence initial={false}><Card key={cur.person.uid} row={cur} top onSwipe={go} onOpen={() => { agentSay("open-profile"); setDetail(cur); }} /></AnimatePresence>
      <span className="deck-peek" aria-hidden="true"><Bunny mood="point" size={72} /></span>
      {burst && <div className="deck-burst" aria-hidden="true"><Bunny mood="celebrate" size={110} /></div>}
    </div>
    <div className="deck-actions">
      <button type="button" className="deck-btn small" disabled={last === null || i === 0} onClick={() => { setI((n) => Math.max(0, n - 1)); setLast(null); agentSay("undo"); haptic(); }} aria-label={t("deck.undo", "Undo")}>↺</button>
      <button type="button" className="deck-btn nope" onClick={() => go(-1)} aria-label={t("deck.skip", "Pass")}>✕</button>
      <button type="button" className="deck-btn like" onClick={() => go(1)} aria-label={t("deck.save", "Save")}>♥</button>
      <button type="button" className="deck-btn small" onClick={() => onWhy(cur)} aria-label={t("deck.why", "Why this match")}>i</button>
    </div>

    {detail && <div className="deck-detail" role="dialog" aria-modal="true" aria-label={detail.person.firstName}>
      <div className="deck-detail-card">
        <button type="button" className="deck-x" onClick={() => setDetail(null)} aria-label={t("deck.close", "Close")}>✕</button>
        <div className="deck-detail-photo"><span aria-hidden="true">{detail.person.firstName.slice(0, 1).toUpperCase()}</span><MediaImg src={heroKey(detail.person)} alt="" className="deck-img" draggable={false} /></div>
        <h2 className="deck-dname">{detail.person.firstName}{ageOf(detail.person) ? <span> {ageOf(detail.person)}</span> : null}</h2>
        <p className="muted" style={{ margin: "0 0 8px" }}>{[suburbOf(detail.person), detail.km !== null ? `${detail.km.toFixed(1)} km` : ""].filter(Boolean).join(" · ")}</p>
        <div className="deck-dtags">
          {typeof detail.result.score === "number" && <span className="dtag pink">{Math.round(detail.result.score)}% {t("deck.match", "match")}</span>}
          {verifiedBadgeText(detail.person) && <span className="dtag sage">{verifiedBadgeText(detail.person) === "Verified" ? t("deck.verified", "Verified") : t("deck.idSighted", "ID seen")}</span>}
          {rateOf(detail.person) !== undefined && <span className="dtag butter">A${rateOf(detail.person)}/hr</span>}
          {reviewsOf(detail.person)?.rating !== undefined && <span className="dtag lav">★ {reviewsOf(detail.person)!.rating!.toFixed(1)}</span>}
          {experienceYearsOf(detail.person) !== undefined && <span className="dtag peach">{experienceYearsOf(detail.person)} {t("deck.years", "years")}</span>}
          {tagsOf(detail.person).map((tag) => <span key={tag} className="dtag sky">{tag}</span>)}
        </div>
        {introOf(detail.person) && <p className="deck-dintro">{introOf(detail.person)}</p>}
        <p><b>{t("deck.avail", "Availability")}:</b> {availabilitySummary(detail.person) ?? t("disc.notStated", "Not stated")}</p>
        <MiniMap person={detail.person} />
        <div className="deck-dactions">
          {onMap && <button type="button" className="btn alt" onClick={() => { const r = detail; setDetail(null); onMap(r); }}>🌍 {t("deck.seeMap", "See on the world map")}</button>}
          <button type="button" className="btn alt" onClick={() => onWhy(detail)}>{t("deck.why", "Why this match")}</button>
          <button type="button" className="btn" onClick={() => { const r = detail; setDetail(null); onOpen(r); }}>{t("deck.fullProfile", "Open full profile")}</button>
          <button type="button" className="btn alt" onClick={() => { if (!savedIds.has(detail.person.uid)) onSave(detail); setDetail(null); }}>♥ {t("deck.save", "Save")}</button>
        </div>
      </div>
    </div>}
  </div>;
}
