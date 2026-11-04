import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
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

export const bookingDecide = onCall({ enforceAppCheck: true }, async (request) => {
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
