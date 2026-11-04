import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db, schemas, t } from "@cc/core";
import { loadEmergencyContacts as loadSafeEmergencyContacts } from "./safety";
import {
  bookingAcceptanceRelationshipPatch,
  bookingUpdateFor,
  canRequestOnExistingRelationship,
  canTransitionBooking,
  pairIdFor,
  planContact,
  type BookingSide,
  type BookingState,
  type BookingTargetState,
} from "../lib/booking";

export type BookingRecord = {
  id: string;
  pairId: string;
  familyUid: string;
  carerUid: string;
  date: string;
  from: string;
  to: string;
  rate: number;
  estimate: number;
  recurring: "none" | "weekly";
  weekdays: string[];
  childIds?: string[];
  shareAddress?: boolean;
  seriesId?: string;
  endAt?: unknown;
  note?: string;
  state: BookingState;
  createdBy?: string;
  createdAt?: unknown;
  decidedAt?: unknown;
};

export type BookingSeriesState = "requested" | "active" | "paused" | "ended";
export type BookingSeriesRecord = {
  id: string;
  pairId: string;
  familyUid: string;
  carerUid: string;
  weekdays: string[];
  from: string;
  to: string;
  startDate: string;
  endDate?: string;
  rate: number;
  state: BookingSeriesState;
  createdAt?: unknown;
  decidedAt?: unknown;
};
export type FamilyChild = { id: string; name: string };

export type BookingRequestInput = {
  familyUid: string;
  carerUid: string;
  profileComplete: boolean;
  date: string;
  from: string;
  to: string;
  rate: number;
  estimate: number;
  recurring: "none" | "weekly";
  weekdays: string[];
  endDate?: string;
  childIds?: string[];
  shareAddress?: boolean;
  note?: string;
};

export type QualificationRecord = {
  id: string;
  label: string;
  status: "submitted" | "under_review" | "verified" | "expired" | "needs_renewal";
  checkedOn?: string;
  verifiedBy?: string;
  expires?: string;
};

export type EmergencyContact = { name: string; phone: string; relation?: string };

function asBooking(snap: QueryDocumentSnapshot<DocumentData>, pairId: string): BookingRecord {
  const value = snap.data();
  return {
    id: snap.id,
    pairId,
    familyUid: String(value.familyUid ?? ""),
    carerUid: String(value.carerUid ?? ""),
    date: String(value.date ?? ""),
    from: String(value.from ?? ""),
    to: String(value.to ?? ""),
    rate: Number(value.rate ?? 0),
    estimate: Number(value.estimate ?? 0),
    recurring: value.recurring === "weekly" ? "weekly" : "none",
    weekdays: Array.isArray(value.weekdays) ? value.weekdays.map(String) : [],
    childIds: Array.isArray(value.childIds) ? value.childIds.map(String) : [],
    shareAddress: value.shareAddress === true,
    seriesId: typeof value.seriesId === "string" ? value.seriesId : undefined,
    endAt: value.endAt,
    note: typeof value.note === "string" ? value.note : undefined,
    state: value.state as BookingState,
    createdBy: typeof value.createdBy === "string" ? value.createdBy : undefined,
    createdAt: value.createdAt,
    decidedAt: value.decidedAt,
  };
}

function asSeries(snap: QueryDocumentSnapshot<DocumentData>, pairId: string): BookingSeriesRecord {
  const value = snap.data();
  return {
    id: snap.id,
    pairId,
    familyUid: String(value.familyUid ?? ""),
    carerUid: String(value.carerUid ?? ""),
    weekdays: Array.isArray(value.weekdays) ? value.weekdays.map(String) : [],
    from: String(value.from ?? ""),
    to: String(value.to ?? ""),
    startDate: String(value.startDate ?? ""),
    endDate: typeof value.endDate === "string" ? value.endDate : undefined,
    rate: Number(value.rate ?? 0),
    state: value.state as BookingSeriesState,
    createdAt: value.createdAt,
    decidedAt: value.decidedAt,
  };
}

function mapRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).map(([key, record]) => ({ ...(record && typeof record === "object" ? record as Record<string, unknown> : {}), label: (record as Record<string, unknown> | null)?.label ?? key }));
}

function dayString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value.slice(0, 10);
  if (typeof value === "number") return new Date(value).toISOString().slice(0, 10);
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") return value.toDate().toISOString().slice(0, 10);
  return undefined;
}

export function bookingEndAtMillis(dateValue: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(to)) return null;
  const wallTime = new Date(`${dateValue}T${to}:00.000Z`);
  if (!Number.isFinite(wallTime.getTime()) || wallTime.toISOString().slice(0, 10) !== dateValue) return null;
  // UTC+8 is the earliest Australian local offset. This stored cutoff is after the booking end across Australian time zones.
  return wallTime.getTime() - 8 * 60 * 60 * 1000;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const SERIES_HORIZON_DAYS = 83;

function addDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function seriesDates(startDate: string, endDate: string, weekdays: string[]): string[] {
  const selected = new Set(weekdays);
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const last = new Date(`${endDate}T12:00:00Z`);
  for (; cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = WEEKDAYS[(cursor.getUTCDay() + 6) % 7];
    if (day && selected.has(day)) dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

export async function createBookingRequest(input: BookingRequestInput): Promise<{ bookingId: string; bookingIds: string[]; pairId: string; seriesId?: string }> {
  const now = new Date();
  const pair = planContact({
    familyUid: input.familyUid,
    carerUid: input.carerUid,
    createdBy: input.familyUid,
    nowIso: now.toISOString(),
    createdDay: now.toISOString().slice(0, 10),
    profileComplete: input.profileComplete,
  });
  if (!pair.ok) throw new Error(pair.reason);

  const extras = schemas.bookingExtrasSchema.parse({ childIds: input.childIds ?? [], shareAddress: input.shareAddress ?? false });
  const recurring = input.recurring === "weekly";
  const weekdays = recurring ? [...new Set(input.weekdays)] : [];
  if (recurring && !weekdays.length) throw new Error("repeat-days-required");
  const endDate = recurring ? (input.endDate ?? addDays(input.date, SERIES_HORIZON_DAYS)) : undefined;
  if (endDate && (endDate < input.date || endDate > addDays(input.date, SERIES_HORIZON_DAYS))) throw new Error("repeat-range-invalid");
  const dates = recurring && endDate ? seriesDates(input.date, endDate, weekdays) : [input.date];
  if (!dates.length) throw new Error("repeat-dates-empty");
  if (dates.some((date) => bookingEndAtMillis(date, input.to) === null)) throw new Error("booking-time-invalid");

  // The series is finite and visible: each weekly occurrence in the next twelve weeks is a separate request.
  const pairId = pairIdFor(input.familyUid, input.carerUid);
  const relationshipRef = doc(db, "relationships", pairId);
  const seriesRef = recurring ? doc(collection(db, "relationships", pairId, "series")) : null;
  const bookingRefs = dates.map(() => doc(collection(db, "relationships", pairId, "bookings")));
  const seriesData = recurring && seriesRef && endDate ? schemas.bookingSeriesSchema.parse({
    familyUid: input.familyUid,
    carerUid: input.carerUid,
    weekdays,
    from: input.from,
    to: input.to,
    startDate: input.date,
    endDate,
    rate: input.rate,
    state: "requested",
    createdAt: now,
  }) : null;

  const writes = async (createRelationship: boolean) => {
    const batch = writeBatch(db);
    if (createRelationship) batch.set(relationshipRef, pair.data);
    if (seriesRef && seriesData) batch.set(seriesRef, { ...seriesData, createdAt: serverTimestamp() });
    dates.forEach((date, index) => {
      const bookingRef = bookingRefs[index];
      if (!bookingRef) return;
      batch.set(bookingRef, {
        familyUid: input.familyUid,
        carerUid: input.carerUid,
        date,
        from: input.from,
        to: input.to,
        endAt: Timestamp.fromDate(new Date(bookingEndAtMillis(date, input.to)!)),
        rate: input.rate,
        estimate: input.estimate,
        recurring: recurring ? "weekly" : "none",
        weekdays,
        childIds: extras.childIds,
        shareAddress: extras.shareAddress,
        ...(seriesRef ? { seriesId: seriesRef.id } : {}),
        ...(input.note?.trim() ? { note: input.note.trim().slice(0, 1000) } : {}),
        state: "requested" as const,
        createdBy: input.familyUid,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  };

  const existing = await getDoc(relationshipRef).catch(() => null);
  if (existing?.exists()) {
    if (!canRequestOnExistingRelationship(existing.data(), input.familyUid, input.carerUid)) throw new Error("relationship-not-available");
    await writes(false);
  } else {
    try {
      // The first relationship, series, and generated requests commit together under the pair rules.
      await writes(true);
    } catch (firstWriteError) {
      const raced = await getDoc(relationshipRef).catch(() => null);
      if (!raced?.exists() || !canRequestOnExistingRelationship(raced.data(), input.familyUid, input.carerUid)) throw firstWriteError;
      await writes(false);
    }
  }
  const bookingId = bookingRefs[0]?.id;
  if (!bookingId) throw new Error("booking-write-empty");
  return { bookingId, bookingIds: bookingRefs.map((reference) => reference.id), pairId, ...(seriesRef ? { seriesId: seriesRef.id } : {}) };
}

export async function loadBookingsForUser(uid: string, side: BookingSide): Promise<BookingRecord[]> {
  const field = side === "family" ? "familyUid" : "carerUid";
  const relationships = await getDocs(query(collection(db, "relationships"), where(field, "==", uid)));
  const nested = await Promise.all(relationships.docs.map(async (relationship) => {
    const rows = await getDocs(collection(db, "relationships", relationship.id, "bookings"));
    return rows.docs.map((row) => asBooking(row, relationship.id));
  }));
  return nested.flat().sort((a, b) => `${a.date} ${a.from}`.localeCompare(`${b.date} ${b.from}`));
}

export async function loadBookingSeriesForUser(uid: string, side: BookingSide): Promise<BookingSeriesRecord[]> {
  const field = side === "family" ? "familyUid" : "carerUid";
  const relationships = await getDocs(query(collection(db, "relationships"), where(field, "==", uid)));
  const nested = await Promise.all(relationships.docs.map(async (relationship) => {
    const rows = await getDocs(collection(db, "relationships", relationship.id, "series"));
    return rows.docs.map((row) => asSeries(row, relationship.id));
  }));
  return nested.flat().sort((a, b) => `${a.startDate} ${a.from}`.localeCompare(`${b.startDate} ${b.from}`));
}

export async function loadBookingContextForPair(familyUid: string, carerUid: string): Promise<{ bookings: BookingRecord[]; series: BookingSeriesRecord[] }> {
  if (auth().currentUser?.uid !== familyUid) return { bookings: [], series: [] };
  const pairId = pairIdFor(familyUid, carerUid);
  const relationship = await getDoc(doc(db, "relationships", pairId));
  if (!relationship.exists() || !canRequestOnExistingRelationship(relationship.data(), familyUid, carerUid)) return { bookings: [], series: [] };
  const [bookingRows, seriesRows] = await Promise.all([
    getDocs(collection(db, "relationships", pairId, "bookings")),
    getDocs(collection(db, "relationships", pairId, "series")),
  ]);
  return {
    bookings: bookingRows.docs.map((row) => asBooking(row, pairId)),
    series: seriesRows.docs.map((row) => asSeries(row, pairId)),
  };
}

export async function loadFamilyChildren(uid: string): Promise<FamilyChild[]> {
  if (auth().currentUser?.uid !== uid) return [];
  const rows = await getDocs(collection(db, "users", uid, "children"));
  return rows.docs.map((row) => {
    const value = row.data();
    const name = String(value.name ?? value.nickname ?? value.firstName ?? t("book.childFallback", "Child"));
    return { id: row.id, name };
  });
}

export async function loadBookingById(uid: string, bookingId: string, pairId?: string): Promise<BookingRecord | null> {
  if (pairId) {
    const snap = await getDoc(doc(db, "relationships", pairId, "bookings", bookingId));
    return snap.exists() ? { ...snap.data(), id: snap.id, pairId } as BookingRecord : null;
  }
  const relationships = await getDocs(query(collection(db, "relationships"), where("members", "array-contains", uid)));
  const found = await Promise.all(relationships.docs.map(async (relationship) => {
    const snap = await getDoc(doc(db, "relationships", relationship.id, "bookings", bookingId));
    return snap.exists() ? { ...snap.data(), id: snap.id, pairId: relationship.id } as BookingRecord : null;
  }));
  return found.find((row): row is BookingRecord => row !== null) ?? null;
}

export async function transitionBooking(pairId: string, bookingId: string, to: BookingTargetState, actor: BookingSide, actorUid: string): Promise<void> {
  const currentUid = auth().currentUser?.uid;
  if (!currentUid || currentUid !== actorUid) throw new Error("sign-in-required");
  const bookingRef = doc(db, "relationships", pairId, "bookings", bookingId);
  const relationshipRef = doc(db, "relationships", pairId);
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(bookingRef);
    if (!current.exists()) throw new Error("booking-not-found");
    const value = current.data();
    const expectedUid = actor === "family" ? value.familyUid : value.carerUid;
    if (expectedUid !== actorUid || !canTransitionBooking(value.state as BookingState, to, actor)) throw new Error("booking-transition-not-allowed");
    const scheduledEnd = bookingEndAtMillis(String(value.date ?? ""), String(value.to ?? ""));
    if (to === "completed" && (actor !== "carer" || scheduledEnd === null || scheduledEnd > Date.now())) {
      throw new Error("booking-not-ended");
    }
    const relationship = to === "accepted" && actor === "carer" ? await transaction.get(relationshipRef) : null;
    const relationshipPatch = relationship?.exists()
      ? bookingAcceptanceRelationshipPatch(relationship.data(), String(value.familyUid ?? ""), String(value.carerUid ?? ""), actorUid)
      : null;
    const update = to === "completed" ? { state: to } : bookingUpdateFor(to, serverTimestamp());
    transaction.update(bookingRef, update);
    if (relationshipPatch) transaction.update(relationshipRef, relationshipPatch);
  });
}

export async function transitionBookingSeries(pairId: string, seriesId: string, to: BookingSeriesState, actor: BookingSide, actorUid: string): Promise<void> {
  const currentUid = auth().currentUser?.uid;
  if (!currentUid || currentUid !== actorUid) throw new Error("sign-in-required");
  const seriesRef = doc(db, "relationships", pairId, "series", seriesId);
  const seriesSnap = await getDoc(seriesRef);
  if (!seriesSnap.exists()) throw new Error("series-not-found");
  const series = seriesSnap.data();
  const expectedUid = actor === "family" ? series.familyUid : series.carerUid;
  if (expectedUid !== actorUid) throw new Error("series-transition-not-allowed");
  const deciding = series.state === "requested" && actor === "carer" && (to === "active" || to === "ended");
  const managing = series.state === "active" && (to === "paused" || to === "ended")
    || series.state === "paused" && (to === "active" || to === "ended");
  if (!deciding && !managing) throw new Error("series-transition-not-allowed");

  const batch = writeBatch(db);
  batch.update(seriesRef, deciding ? { state: to, decidedAt: serverTimestamp() } : { state: to });
  if (deciding) {
    const rows = await getDocs(collection(db, "relationships", pairId, "bookings"));
    rows.docs.forEach((row) => {
      const booking = row.data();
      if (booking.seriesId === seriesId && booking.state === "requested") {
        batch.update(row.ref, { state: to === "active" ? "accepted" : "declined", decidedAt: serverTimestamp() });
      }
    });
    if (to === "active") {
      const relationshipRef = doc(db, "relationships", pairId);
      const relationship = await getDoc(relationshipRef);
      const patch = relationship.exists()
        ? bookingAcceptanceRelationshipPatch(relationship.data(), String(series.familyUid ?? ""), String(series.carerUid ?? ""), actorUid)
        : null;
      if (patch) batch.update(relationshipRef, patch);
    }
  }
  await batch.commit();
}

export async function writeCheckIn(pairId: string, bookingId: string, by: string, kind: "arrived" | "leaving" | "help"): Promise<void> {
  if (auth().currentUser?.uid !== by) throw new Error("sign-in-required");
  const booking = await getDoc(doc(db, "relationships", pairId, "bookings", bookingId));
  if (!booking.exists()) throw new Error("booking-not-found");
  const value = booking.data();
  if (value.state !== "accepted" || (value.familyUid !== by && value.carerUid !== by)) throw new Error("check-in-not-allowed");
  await addDoc(collection(db, "relationships", pairId, "checkins"), { by, kind, bookingId, at: serverTimestamp() });
}

export async function loadEmergencyContacts(uid: string): Promise<EmergencyContact[]> {
  if (auth().currentUser?.uid !== uid) return [];
  return loadSafeEmergencyContacts(uid);
}

export async function loadVerifiedQualifications(uid: string): Promise<QualificationRecord[]> {
  // Only server-written verified/{uid} records can show a qualification as verified.
  const snap = await getDoc(doc(db, "verified", uid));
  if (!snap.exists()) return [];
  const root = snap.data();
  const records = [...mapRecords(root.qualifications), ...mapRecords(root.checks), ...mapRecords(root.documents)];
  if (!records.length && (root.label || root.name || root.kind || root.status)) records.push(root);
  const today = new Date().toISOString().slice(0, 10);
  return records.map((record, index) => {
    const rawStatus = String(record.status ?? record.state ?? "submitted").toLowerCase().replace(/[\s-]+/g, "_");
    const checkedOn = dayString(record.checkedOn);
    const expires = dayString(record.expires ?? record.expiryDate);
    let status: QualificationRecord["status"] = ["submitted", "under_review", "verified", "expired", "needs_renewal"].includes(rawStatus) ? rawStatus as QualificationRecord["status"] : "submitted";
    if (status === "verified" && (!(checkedOn && record.verifiedBy) || (expires && expires < today))) status = expires && expires < today ? "expired" : "under_review";
    if (status === "needs_renewal" && expires && expires < today) status = "expired";
    return {
      id: String(record.id ?? `${uid}-check-${index}`),
      label: String(record.label ?? record.name ?? record.kind ?? t("booking.checkLabel", "Check")),
      status,
      ...(checkedOn ? { checkedOn } : {}),
      ...(typeof record.verifiedBy === "string" ? { verifiedBy: record.verifiedBy } : {}),
      ...(expires ? { expires } : {}),
    };
  });
}

export async function savePerson(uid: string, personUid: string, saved: boolean): Promise<void> {
  const savedRef = doc(db, "users", uid, "saved", personUid);
  if (saved) await setDoc(savedRef, { at: serverTimestamp() });
  else await deleteDoc(savedRef);
}

export async function isPersonSaved(uid: string, personUid: string): Promise<boolean> {
  return (await getDoc(doc(db, "users", uid, "saved", personUid))).exists();
}

const HANDOFF_INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const HANDOFF_INVITE_DAYS = 7;

function makeHandoffInviteCode(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error("secure-random-unavailable");
  const values = new Uint32Array(8);
  cryptoApi.getRandomValues(values);
  return [...values].map((value) => HANDOFF_INVITE_ALPHABET[Math.floor((value / 0x1_0000_0000) * HANDOFF_INVITE_ALPHABET.length)]!).join("");
}

export async function createCareSpaceInvite(input: { familyUid: string; familyName: string; carerUid: string; bookingId?: string }): Promise<string> {
  if (auth().currentUser?.uid !== input.familyUid) throw new Error("family-owner-sign-in-required");
  if (!input.bookingId || !input.carerUid || input.carerUid === input.familyUid) throw new Error("accepted-booking-required");
  const spaceId = input.familyUid;
  const relationshipId = pairIdFor(input.familyUid, input.carerUid);
  const relationshipRef = doc(db, "relationships", relationshipId);
  const bookingRef = doc(db, "relationships", relationshipId, "bookings", input.bookingId);
  const spaceRef = doc(db, "careSpaces", spaceId);
  const familyMemberRef = doc(db, "careSpaces", spaceId, "members", input.familyUid);
  const indexRef = doc(db, "users", input.familyUid, "spaces", spaceId);
  const displayName = input.familyName.trim() || "Family";
  const expiry = new Date(Date.now() + HANDOFF_INVITE_DAYS * 24 * 60 * 60 * 1000);
  const perms = { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteId = makeHandoffInviteCode();
    const inviteRef = doc(db, "careSpaceInvites", inviteId);
    try {
      await runTransaction(db, async (transaction) => {
        const [relationshipSnapshot, bookingSnapshot, memberSnapshot, inviteSnapshot] = await Promise.all([
          transaction.get(relationshipRef), transaction.get(bookingRef), transaction.get(familyMemberRef), transaction.get(inviteRef),
        ]);
        if (inviteSnapshot.exists()) throw new Error("invite-code-collision");
        if (!relationshipSnapshot.exists() || !bookingSnapshot.exists()) throw new Error("accepted-booking-required");
        const relationship = relationshipSnapshot.data();
        const booking = bookingSnapshot.data();
        if (relationship.familyUid !== input.familyUid || relationship.carerUid !== input.carerUid
          || relationship.state === "ended" || booking.familyUid !== input.familyUid
          || booking.carerUid !== input.carerUid || booking.state !== "accepted") {
          throw new Error("accepted-booking-required");
        }
        if (memberSnapshot.exists()) {
          const member = memberSnapshot.data();
          if (member.status !== "active" || member.role !== "admin") throw new Error("family-space-admin-required");
        }
        const existingSpace = memberSnapshot.exists() ? await transaction.get(spaceRef) : null;
        if (existingSpace && !existingSpace.exists()) throw new Error("family-space-missing");
        const existingName = existingSpace?.data()?.name;
        const name = typeof existingName === "string" && existingName.trim()
          ? existingName
          : `${displayName}'s care space`;
        transaction.set(spaceRef, {
          ownerUid: input.familyUid,
          name,
          ...(!existingSpace ? { createdAt: serverTimestamp() } : {}),
        }, { merge: true });
        transaction.set(familyMemberRef, {
          role: "admin",
          status: "active",
          perms: { allergies: true, medication: true, photos: true, calendar: true, privateMessages: true },
          displayName,
          ...(!memberSnapshot.exists() ? { joinedAt: serverTimestamp() } : {}),
          invitedBy: input.familyUid,
        }, { merge: true });
        transaction.set(indexRef, { spaceId, name, memberRole: "admin", joinedAt: serverTimestamp() }, { merge: true });
        transaction.set(inviteRef, {
          spaceId,
          role: "regular",
          createdBy: input.familyUid,
          createdAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(expiry),
          usedBy: null,
          perms,
          targetUid: input.carerUid,
          bookingId: input.bookingId,
        });
      });
      return spaceId;
    } catch (error) {
      if (error instanceof Error && error.message === "invite-code-collision") continue;
      throw error;
    }
  }
  throw new Error("invite-code-unavailable");
}

export type MediaSigner = (key: string) => Promise<string | null>;
let mediaSigner: MediaSigner | null = null;
/** Gatekeeper adapter stub: returns null until an authorized five-minute R2 signer is configured. */
export function configureMediaSigner(signer: MediaSigner | null): void { mediaSigner = signer; }
export async function mediaUrl(key: string): Promise<string | null> {
  if (!key || !mediaSigner) return null;
  try { return await mediaSigner(key); } catch { return null; }
}
