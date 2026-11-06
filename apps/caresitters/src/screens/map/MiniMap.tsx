import { t } from "@cc/core";
import type { Person } from "@cc/core";
import { coords, suburbOf } from "../discover/helpers";
import { WORLD_PATH, project } from "./worldGeo";
import { fuzz } from "./WorldMap";
import "./map.css";

/** Small, still map for a profile. Shows the general area only (blurred to a coarse grid). */
export function MiniMap({ person }: { person: Person }) {
  const c = coords(person);
  if (!c) return null;
  const p = project(fuzz(c.lat), fuzz(c.lng));
  const k = 14, w = 300, h = 150;
  const place = suburbOf(person);
  return <section className="booking-card booking-section" data-testid="mini-map">
    <h2>{t("person.whereTitle", "Where")}</h2>
    <svg className="mini-map" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t("person.whereAlt", "General area on the map")}>
      <rect width={w} height={h} fill="#EEF7FE" />
      <g transform={`translate(${w / 2 - p.x * k} ${h / 2 - p.y * k}) scale(${k})`}><path d={WORLD_PATH} fill="#FFF5F8" stroke="#F4A9BC" strokeWidth={0.5} /></g>
      <circle cx={w / 2} cy={h / 2} r={26} fill="#F4A9BC" opacity={0.28} />
      <circle cx={w / 2} cy={h / 2} r={9} fill="#FFD966" stroke="#C2335A" strokeWidth={2.5} />
    </svg>
    {place && <p className="booking-meta">{place}</p>}
  </section>;
}
