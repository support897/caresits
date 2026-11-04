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

export function experienceYearsOf(person: Person): number | undefined {
  const years = asNumber(asRecord(person.card).experienceYears);
  return years !== undefined && years >= 0 ? years : undefined;
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

const DAY_CODES: Record<string, string> = { mon: "Mon", monday: "Mon", tue: "Tue", tues: "Tue", tuesday: "Tue", wed: "Wed", wednesday: "Wed", thu: "Thu", thur: "Thu", thurs: "Thu", thursday: "Thu", fri: "Fri", friday: "Fri", sat: "Sat", saturday: "Sat", sun: "Sun", sunday: "Sun" };
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function activeEntry(value: unknown): boolean {
  if (value === true) return true;
  if (Array.isArray(value)) return value.length > 0;
  const row = asRecord(value);
  if (row.available === false || row.isAvailable === false) return false;
  const slots = row.slots ?? row.times;
  return row.available === true || row.isAvailable === true || (Array.isArray(slots) ? slots.length > 0 : Boolean(row.from ?? row.start ?? row.to ?? row.end));
}
function localDate(date: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return value.getFullYear() === year && value.getMonth() === (month ?? 1) - 1 && value.getDate() === day ? value : undefined;
}
function addDateDay(available: Set<string>, value: string, now: Date): void {
  const date = localDate(value);
  if (!date) return;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const delta = (target - today) / 86400000;
  if (delta >= 0 && delta < 7) available.add(WEEK_DAYS[date.getDay()] ?? "");
}
function availabilityHasExactDate(value: unknown, date: string): boolean {
  if (Array.isArray(value)) return value.some((item) => {
    const row = asRecord(item);
    return row.date === date && activeEntry(row);
  });
  const row = asRecord(value);
  if (activeEntry(row[date])) return true;
  return row.date === date && activeEntry(row);
}

export function availabilityDays(value: unknown, now = new Date()): string[] {
  const available = new Set<string>();
  const add = (day: string) => { const normalized = DAY_CODES[day.trim().toLowerCase()]; if (normalized) available.add(normalized); };
  const addEntry = (key: string | undefined, entry: unknown) => {
    const row = asRecord(entry);
    const dayKey = key ?? (typeof row.day === "string" ? row.day : undefined);
    if (typeof row.date === "string" && activeEntry(entry)) { addDateDay(available, row.date, now); return; }
    const nested = row.slots ?? row.times;
    if (Array.isArray(nested)) {
      for (const slot of nested) {
        const slotRow = asRecord(slot);
        if (typeof slotRow.date === "string" && activeEntry(slot)) addDateDay(available, slotRow.date, now);
        else if (typeof slotRow.day === "string" && activeEntry(slot)) add(slotRow.day);
        else if (activeEntry(slot) && dayKey) add(dayKey);
        else if (typeof slot === "string" && dayKey) add(dayKey);
      }
      return;
    }
    if (Array.isArray(entry)) {
      for (const slot of entry) {
        const slotRow = asRecord(slot);
        if (typeof slotRow.date === "string" && activeEntry(slot)) addDateDay(available, slotRow.date, now);
        else if (typeof slotRow.day === "string" && activeEntry(slot)) add(slotRow.day);
        else if (activeEntry(slot) && dayKey) add(dayKey);
        else if (typeof slot === "string" && dayKey) add(dayKey);
      }
      return;
    }
    if (activeEntry(entry) && dayKey) add(dayKey);
  };
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") add(item);
      else addEntry(undefined, item);
    }
  } else if (value && typeof value === "object") {
    const top = asRecord(value);
    if (typeof top.date === "string" && activeEntry(top)) addDateDay(available, top.date, now);
    for (const [key, entry] of Object.entries(top)) {
      if (key === "days" && Array.isArray(entry)) { entry.forEach((item) => { if (typeof item === "string") add(item); }); continue; }
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) { if (activeEntry(entry)) addDateDay(available, key, now); continue; }
      addEntry(key, entry);
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

export function isAvailableOnDate(person: Person, date: string, now = new Date()): boolean {
  const parsed = localDate(date);
  if (!parsed) return false;
  if (availabilityHasExactDate(person.card.availability, date)) return true;
  const day = WEEK_DAYS[parsed.getDay()];
  return Boolean(day && availabilityDays(person.card.availability, now).includes(day));
}

export function isAvailableThisWeek(person: Person, now = new Date()): boolean {
  return availabilityDays(person.card.availability, now).length > 0;
}

export type ApproximateMapPin = { uid: string; inlineStart: number; blockStart: number };
export function approximateMapPins(people: Person[]): ApproximateMapPin[] {
  const points = people.flatMap((person) => {
    const location = coords(person);
    return location ? [{ uid: person.uid, lat: Math.round(location.lat * 100) / 100, lng: Math.round(location.lng * 100) / 100 }] : [];
  });
  if (!points.length) return [];
  const minLat = Math.min(...points.map((point) => point.lat));
  const maxLat = Math.max(...points.map((point) => point.lat));
  const minLng = Math.min(...points.map((point) => point.lng));
  const maxLng = Math.max(...points.map((point) => point.lng));
  return points.map((point) => ({
    uid: point.uid,
    inlineStart: maxLng === minLng ? 50 : 12 + ((point.lng - minLng) / (maxLng - minLng)) * 76,
    blockStart: maxLat === minLat ? 50 : 88 - ((point.lat - minLat) / (maxLat - minLat)) * 76,
  }));
}

export type SavedDiscoverSearch = {
  id: string;
  label: string;
  radiusKm: number;
  suburb: string;
  requirements: unknown;
  date: string;
  from: string;
  to: string;
};
const savedSearchKey = (uid: string) => `cc.discover.searches.${uid}`;
export function loadSavedSearches(uid: string): SavedDiscoverSearch[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(savedSearchKey(uid)) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      const row = asRecord(entry);
      if (typeof row.id !== "string" || typeof row.label !== "string") return [];
      const radiusKm = asNumber(row.radiusKm);
      if (radiusKm === undefined) return [];
      return [{
        id: row.id,
        label: row.label.slice(0, 120),
        radiusKm: Math.max(0, Math.min(100, radiusKm)),
        suburb: typeof row.suburb === "string" ? row.suburb.slice(0, 80) : "",
        requirements: row.requirements ?? {},
        date: typeof row.date === "string" && localDate(row.date) ? row.date : "",
        from: typeof row.from === "string" ? row.from : "",
        to: typeof row.to === "string" ? row.to : "",
      }];
    }).slice(0, 20);
  } catch { return []; }
}
export function saveDiscoverSearch(uid: string, search: Omit<SavedDiscoverSearch, "id">, id?: string): SavedDiscoverSearch[] {
  const searchId = id ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const next = [{ ...search, id: searchId }, ...loadSavedSearches(uid)].slice(0, 20);
  try { localStorage.setItem(savedSearchKey(uid), JSON.stringify(next)); } catch { /* device storage may be unavailable */ }
  return next;
}
export function deleteDiscoverSearch(uid: string, id: string): SavedDiscoverSearch[] {
  const next = loadSavedSearches(uid).filter((search) => search.id !== id);
  try { localStorage.setItem(savedSearchKey(uid), JSON.stringify(next)); } catch { /* device storage may be unavailable */ }
  return next;
}

export function verifiedBadgeText(person: DiscoveryPerson): "Verified" | "ID sighted" | undefined {
  if (person.verifiedLevel === "register" || person.verifiedLevel === "verified") return "Verified";
  if (person.verifiedLevel === "sighted" || person.verifiedLevel === "document sighted") return "ID sighted";
  return undefined;
}
