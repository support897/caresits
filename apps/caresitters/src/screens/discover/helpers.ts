import type { Person } from "@cc/core";
import type { DiscoveryPerson } from "../../data/people";

type LooseRecord = Record<string, unknown>;
export type ReviewSummary = { rating?: number; count: number };

function asRecord(value: unknown): LooseRecord { return value !== null && typeof value === "object" ? value as LooseRecord : {}; }
function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}
function firstNumber(...values: unknown[]): number | undefined { return values.map(asNumber).find((value) => value !== undefined); }
function coords(person: Person): { lat: number; lng: number } | undefined {
  const card = asRecord(person.card);
  const raw = asRecord(person.raw);
  const location = asRecord(raw.location ?? card.location);
  const lat = firstNumber(card.lat, raw.lat, location.lat);
  const lng = firstNumber(card.lng, raw.lng, location.lng);
  return lat === undefined || lng === undefined ? undefined : { lat, lng };
}

export function distanceKmBetween(me: Person, other: Person): number | null {
  const otherCard = asRecord(other.card);
  const otherRaw = asRecord(other.raw);
  const saved = firstNumber(otherCard.distanceKm, otherRaw.distanceKm);
  if (saved !== undefined) return saved;
  const a = coords(me);
  const b = coords(other);
  if (!a || !b) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(b.lat - a.lat);
  const deltaLng = radians(b.lng - a.lng);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function suburbOf(person: Person): string {
  const card = asRecord(person.card);
  const raw = asRecord(person.raw);
  return String(card.suburb ?? raw.suburb ?? "").trim();
}

export function rateOf(person: Person): number | undefined {
  const card = asRecord(person.card);
  return firstNumber(card.rate, card.payFloor, card.payOffered);
}

export function reviewsOf(person: Person): ReviewSummary | null {
  const card = asRecord(person.card);
  const raw = asRecord(person.raw);
  const reviews = Array.isArray(raw.reviews) ? raw.reviews : Array.isArray(card.reviews) ? card.reviews : [];
  const count = firstNumber(raw.reviewCount, card.reviewCount) ?? reviews.length;
  if (count <= 0) return null;
  const rating = firstNumber(raw.rating, raw.avgStars, card.rating, card.avgStars);
  return { ...(rating !== undefined ? { rating } : {}), count };
}

export function introOf(person: Person): string {
  const card = asRecord(person.card);
  const text = String(card.headline ?? person.about ?? card.about ?? "").trim();
  return text.length > 120 ? `${text.slice(0, 117).trimEnd()}…` : text;
}

export function availabilityDays(value: unknown): string[] {
  const dayNames: Record<string, string> = { mon: "Mon", monday: "Mon", tue: "Tue", tues: "Tue", tuesday: "Tue", wed: "Wed", wednesday: "Wed", thu: "Thu", thur: "Thu", thurs: "Thu", thursday: "Thu", fri: "Fri", friday: "Fri", sat: "Sat", saturday: "Sat", sun: "Sun", sunday: "Sun" };
  const available = new Set<string>();
  const add = (day: string) => { const normalized = dayNames[day.trim().toLowerCase()]; if (normalized) available.add(normalized); };
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") add(item);
      else if (item && typeof item === "object") {
        const row = item as LooseRecord;
        if (typeof row.day === "string") add(row.day);
      }
    }
  } else if (value && typeof value === "object") {
    for (const [day, entry] of Object.entries(value as LooseRecord)) {
      if (day === "days" && Array.isArray(entry)) { entry.forEach((item) => { if (typeof item === "string") add(item); }); continue; }
      if (entry === true || (Array.isArray(entry) && entry.length > 0)) { add(day); continue; }
      if (entry && typeof entry === "object") {
        const row = entry as LooseRecord;
        const slots = row.slots ?? row.times;
        if (row.available === true || (Array.isArray(slots) ? slots.length > 0 : Boolean(row.from ?? row.start ?? row.to ?? row.end))) add(day);
      }
    }
  }
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].filter((day) => available.has(day));
}

export function availabilitySummary(person: Person): string | undefined {
  const days = availabilityDays(person.card.availability);
  if (days.length) return days.join(", ");
  const card = asRecord(person.card);
  const availability = card.availability;
  if (typeof availability === "string" && availability.trim()) return availability.trim();
  return undefined;
}

export function lastActiveTime(person: Person): number | undefined {
  const card = asRecord(person.card);
  const raw = asRecord(person.raw);
  const values = [card.lastActive, raw.lastActive];
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
      const millis = (value as { toMillis: () => number }).toMillis();
      if (Number.isFinite(millis)) return millis;
    }
  }
  return undefined;
}

export function isAvailableThisWeek(person: Person, now = new Date()): boolean {
  const days = availabilityDays(person.card.availability);
  if (!days.length) return false;
  const dayCodes = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return Array.from({ length: 7 }, (_, offset) => dayCodes[(now.getDay() + offset) % 7] ?? "").some((day) => days.includes(day));
}

export function verifiedBadgeText(person: DiscoveryPerson): "Verified" | "ID sighted" | undefined {
  if (person.verifiedLevel === "register" || person.verifiedLevel === "verified") return "Verified";
  if (person.verifiedLevel === "sighted" || person.verifiedLevel === "document sighted") return "ID sighted";
  return undefined;
}
