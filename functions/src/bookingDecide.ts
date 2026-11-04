import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { findBookingConflicts, type BookingSlot } from "../../packages/core/src/schemas/availability.js";
import { bookingDecisionSchema } from "../../packages/core/src/schemas/index.js";
import { adminDb } from "./admin.js";
import { enforceRateLimit } from "./rateLimit.js";

export type BookingDecision = "accepted" | "declined" | "cancelled";
export type BookingStatus = "requested" | "accepted" | "declined" | "cancelled" | "completed";

export interface BookingRecord {
  familyUid: string;
  carerUid: string;
  state: BookingStatus;
}

export type InstantBookProfile = {
  side?: unknown;
  card?: unknown;
} | null | undefined;
export type InstantBookCarerCard = Record<string, unknown> | null | undefined;
export type InstantBookRequest = Pick<BookingSlot, "date" | "from" | "to"> & { id?: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function minuteOfDay(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function validRequest(request: InstantBookRequest): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.date)) return false;
  const day = new Date(`${request.date}T00:00:00.000Z`);
  const from = minuteOfDay(request.from);
  const to = minuteOfDay(request.to);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === request.date
    && from !== null && to !== null && to > from;
}

function hasCompleteFamilyProfile(profile: InstantBookProfile): boolean {
  if (!profile || profile.side !== "family") return false;
  const kids = record(profile.card)?.kids;
  return Array.isArray(kids) && kids.length > 0 && kids.every((value) => {
    const age = record(value)?.ageYears;
    return typeof age === "number" && Number.isFinite(age) && age >= 0 && age <= 18;
  });
}

/** Accept only when opt-in, a family has child ages, and the slot has no active clash. */
export function bookingDecide(
  carerCard: InstantBookCarerCard,
  familyProfile: InstantBookProfile,
  existingBookings: readonly BookingSlot[],
  request: InstantBookRequest,
): "accept" | "leave" {
  if (record(carerCard)?.instantBook !== true || !hasCompleteFamilyProfile(familyProfile) || !validRequest(request)) return "leave";
  return findBookingConflicts(request, existingBookings).length === 0 ? "accept" : "leave";
}

export type BookingPatch = { state: BookingDecision; decidedAt?: unknown };

export class BookingDecisionError extends Error {
  constructor(readonly code: "not-found" | "permission-denied" | "failed-precondition") {
    super(code);
    this.name = "BookingDecisionError";
  }
}

export function bookingTransition(
  booking: BookingRecord | undefined,
  actorUid: string,
  decision: BookingDecision,
  decidedAt: unknown,
): BookingPatch {
  if (!booking) throw new BookingDecisionError("not-found");
  if (booking.familyUid === booking.carerUid) throw new BookingDecisionError("failed-precondition");
  if (decision === "accepted" || decision === "declined") {
    if (actorUid !== booking.carerUid) throw new BookingDecisionError("permission-denied");
    if (booking.state !== "requested") throw new BookingDecisionError("failed-precondition");
    return { state: decision, decidedAt };
  }
  if (actorUid !== booking.familyUid && actorUid !== booking.carerUid) {
    throw new BookingDecisionError("permission-denied");
  }
  if (booking.state !== "requested" && booking.state !== "accepted") {
    throw new BookingDecisionError("failed-precondition");
  }
  return { state: "cancelled" };
}

export interface BookingDecisionStore {
  get(path: string): Promise<BookingRecord | undefined>;
  update(path: string, patch: BookingPatch): Promise<void>;
}

export async function applyBookingDecision(
  store: BookingDecisionStore,
  path: string,
  actorUid: string,
  decision: BookingDecision,
  decidedAt: unknown,
): Promise<BookingPatch> {
  const patch = bookingTransition(await store.get(path), actorUid, decision, decidedAt);
  await store.update(path, patch);
  return patch;
}

export const bookingDecisionCallable = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const parsed = bookingDecisionSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Booking decision is not valid.");
  await enforceRateLimit(uid, "booking", 12, 60_000);

  const path = `relationships/${parsed.data.pairId}/bookings/${parsed.data.bookingId}`;
  const db = adminDb();
  const relationshipSnapshot = await db.doc(`relationships/${parsed.data.pairId}`).get();
  const relationship = relationshipSnapshot.data();
  const members = relationship?.members;
  if (!relationshipSnapshot.exists || !relationship || !Array.isArray(members)
      || !members.includes(uid) || !["contact", "hired"].includes(String(relationship.state))) {
    throw new HttpsError("permission-denied", "This booking is not available to this account.");
  }
  const familyUid = relationship.familyUid;
  const carerUid = relationship.carerUid;
  if (typeof familyUid !== "string" || typeof carerUid !== "string") {
    throw new HttpsError("failed-precondition", "The booking relationship is not valid.");
  }
  const [familyBlock, carerBlock] = await Promise.all([
    db.doc(`users/${familyUid}/blocks/${carerUid}`).get(),
    db.doc(`users/${carerUid}/blocks/${familyUid}`).get(),
  ]);
  if (familyBlock.exists || carerBlock.exists) {
    throw new HttpsError("permission-denied", "This booking is not available to this account.");
  }
  const store: BookingDecisionStore = {
    get: async (refPath) => {
      const snapshot = await db.doc(refPath).get();
      if (!snapshot.exists) return undefined;
      const data = snapshot.data();
      if (!data || data.familyUid !== familyUid || data.carerUid !== carerUid) return undefined;
      return {
        familyUid: data.familyUid as string,
        carerUid: data.carerUid as string,
        state: data.state as BookingStatus,
      };
    },
    update: async (refPath, patch) => {
      await db.doc(refPath).update({
        state: patch.state,
        ...(patch.decidedAt === undefined ? {} : { decidedAt: FieldValue.serverTimestamp() }),
      });
    },
  };
  try {
    const result = await applyBookingDecision(store, path, uid, parsed.data.decision, new Date());
    return { state: result.state };
  } catch (error) {
    if (error instanceof BookingDecisionError) {
      throw new HttpsError(error.code, "This booking cannot make that change.");
    }
    throw error;
  }
});

function bookingSlotFromSnapshot(id: string, value: Record<string, unknown>): BookingSlot {
  const knownStates = new Set(["requested", "accepted", "declined", "cancelled", "completed"]);
  const rawState = typeof value.state === "string" && knownStates.has(value.state) ? value.state : "completed";
  return {
    id,
    date: typeof value.date === "string" ? value.date : "",
    from: typeof value.from === "string" ? value.from : "",
    to: typeof value.to === "string" ? value.to : "",
    state: rawState as BookingSlot["state"],
  };
}

/** Trusted Firestore trigger applies instant booking after a family request is committed. */
export const instantBookOnRequestCreated = onDocumentCreated(
  "relationships/{pairId}/bookings/{bookingId}",
  async (event) => {
    const { pairId, bookingId } = event.params;
    const db = adminDb();
    const bookingRef = db.doc(`relationships/${pairId}/bookings/${bookingId}`);
    const relationshipRef = db.doc(`relationships/${pairId}`);

    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(bookingRef);
      if (!current.exists) return;
      const booking = current.data();
      if (!booking || booking.state !== "requested" || typeof booking.familyUid !== "string" || typeof booking.carerUid !== "string") return;
      const familyUid = booking.familyUid;
      const carerUid = booking.carerUid;
      if (familyUid === carerUid) return;

      const relationshipSnapshot = await transaction.get(relationshipRef);
      const familyProfileSnapshot = await transaction.get(db.doc(`profiles/${familyUid}`));
      const carerProfileSnapshot = await transaction.get(db.doc(`profiles/${carerUid}`));
      const familyBlock = await transaction.get(db.doc(`users/${familyUid}/blocks/${carerUid}`));
      const carerBlock = await transaction.get(db.doc(`users/${carerUid}/blocks/${familyUid}`));
      const existingSnapshot = await transaction.get(db.collection(`relationships/${pairId}/bookings`));
      if (!relationshipSnapshot.exists || familyBlock.exists || carerBlock.exists) return;

      const relationship = relationshipSnapshot.data();
      const members = relationship?.members;
      if (!relationship || !Array.isArray(members) || !members.includes(familyUid) || !members.includes(carerUid)
        || relationship.familyUid !== familyUid || relationship.carerUid !== carerUid
        || !["pending", "contact", "hired"].includes(String(relationship.state))) return;

      const familyProfile = familyProfileSnapshot.exists ? familyProfileSnapshot.data() : null;
      const carerProfile = carerProfileSnapshot.exists ? carerProfileSnapshot.data() : null;
      if (!carerProfile || carerProfile.side !== "carer") return;
      const existingBookings = existingSnapshot.docs.map((snapshot) => bookingSlotFromSnapshot(snapshot.id, snapshot.data()));
      const decision = bookingDecide(
        record(carerProfile.card),
        familyProfile ?? null,
        existingBookings,
        {
          id: bookingId,
          date: typeof booking.date === "string" ? booking.date : "",
          from: typeof booking.from === "string" ? booking.from : "",
          to: typeof booking.to === "string" ? booking.to : "",
        },
      );
      if (decision !== "accept") return;

      transaction.update(bookingRef, { state: "accepted", decidedAt: FieldValue.serverTimestamp() });
      if (relationship.state === "pending" && relationship.createdBy === familyUid) {
        transaction.update(relationshipRef, { state: "contact", contactBy: carerUid });
      }
    });
  },
);
