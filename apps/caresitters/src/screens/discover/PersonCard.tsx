import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { Button, t } from "@cc/core";
import type { Person } from "@cc/core";
import type { DiscoveryPerson } from "../../data/people";
import type { MatchResult } from "../../../../../packages/core/src/match/types";
import { availabilitySummary, experienceYearsOf, introOf, rateOf, reviewsOf, suburbOf, verifiedBadgeText } from "./helpers";

type Props = {
  person: DiscoveryPerson;
  km: number | null;
  result: MatchResult;
  saved: boolean;
  onSave: () => void;
  onWhy: () => void;
  onOpen: () => void;
};

const cardBox: CSSProperties = { width: "min(82vw, 320px)", minWidth: "min(260px, calc(100vw - 48px))", flex: "0 0 auto", overflow: "hidden", padding: 0 };

function currency(value: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}
function ageOf(person: Person): number | undefined {
  const value = person.card.age;
  return typeof value === "number" && value >= 18 ? value : undefined;
}

export function PersonCard({ person, km, result, saved, onSave, onWhy, onOpen }: Props) {
  const badge = verifiedBadgeText(person);
  const rating = reviewsOf(person);
  const rate = rateOf(person);
  const availability = availabilitySummary(person);
  const suburb = suburbOf(person);
  const age = ageOf(person);
  const experienceYears = experienceYearsOf(person);
  const description = introOf(person);
  const distance = km === null ? t("disc.distanceUnknown", "Distance not stated") : t("disc.distanceKm", "{km} km away", { km: km.toFixed(1) });

  return <article className="card" style={cardBox} aria-label={t("disc.personCard", "Profile for {name}", { name: person.firstName })}>
    <button type="button" onClick={onOpen} aria-label={t("disc.openProfile", "Open {name}'s profile", { name: person.firstName })} style={{ display: "block", width: "100%", textAlign: "start" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1.42", background: "var(--soft)", display: "grid", placeItems: "center", overflow: "hidden" }}>
        {person.photoUrl ? <img src={person.photoUrl} alt={t("disc.photoAlt", "{name}'s profile photo", { name: person.firstName })} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span aria-hidden="true" style={{ fontFamily: "Newsreader,serif", fontSize: 68, color: "var(--muted)" }}>{person.firstName.charAt(0).toUpperCase()}</span>}
        {badge && <span className="tag good" style={{ position: "absolute", insetInlineStart: 12, insetBlockStart: 12, fontSize: 17, background: "var(--good)", color: "var(--cream)" }}>{t(badge === "Verified" ? "disc.verified" : "disc.idSighted", badge)}</span>}
      </div>
      <div style={{ padding: 16, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <h3>{person.firstName}</h3>{age && <span className="muted">{t("disc.age", "{age} years old", { age })}</span>}{experienceYears !== undefined && <span className="muted">{t(experienceYears === 1 ? "disc.experienceYear" : "disc.experienceYears", experienceYears === 1 ? "1 year of experience" : "{years} years of experience", { years: experienceYears })}</span>}
        </div>
        <div className="muted">{suburb ? `${suburb} · ` : ""}{distance}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <b>{rate === undefined ? t("disc.rateUnknown", "Rate not stated") : t("disc.rate", "{rate}/hr", { rate: currency(rate) })}</b>
          {rating && <span aria-label={rating.rating === undefined ? t("disc.reviewCount", "{count} reviews", { count: rating.count }) : t("disc.ratingCount", "{rating} stars, {count} reviews", { rating: rating.rating.toFixed(1), count: rating.count })}>
            {rating.rating !== undefined && <><span aria-hidden="true">★</span> {rating.rating.toFixed(1)} · </>}{t("disc.reviewCount", "{count} reviews", { count: rating.count })}
          </span>}
        </div>
        <div className="muted">{t("disc.availability", "Availability: {value}", { value: availability ?? t("disc.notStated", "Not stated") })}</div>
        <div style={{ minHeight: 48 }}>{description || <span className="muted">{t("disc.introNotStated", "Introduction not stated")}</span>}</div>
      </div>
    </button>
    <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 48px", gap: 8, alignItems: "center" }}>
      <Button type="button" alt onClick={onWhy} aria-label={t("disc.whyButton", "Why this match for {name}", { name: person.firstName })}>
        {result.score === null ? t("disc.why", "Why this match") : t("disc.matchScore", "{score}% match", { score: result.score })}
      </Button>
      <motion.button type="button" aria-label={saved ? t("disc.unsave", "Remove {name} from saved", { name: person.firstName }) : t("disc.save", "Save {name}", { name: person.firstName })} aria-pressed={saved} onClick={onSave} whileTap={{ scale: 0.82 }} transition={{ type: "spring", stiffness: 420, damping: 18 }} style={{ width: 48, height: 48, borderRadius: 99, background: saved ? "var(--blush)" : "var(--soft)", display: "grid", placeItems: "center", color: "var(--text)" }}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z" /></svg>
      </motion.button>
    </div>
    {result.unmetEssentials.length > 0 && <div role="status" style={{ padding: "0 16px 16px", color: "var(--danger)", fontWeight: 700 }}>{t("disc.unmetCount", "Does not meet {count} essential(s)", { count: result.unmetEssentials.length })}</div>}
  </article>;
}
