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
import { auth, db, t } from "@cc/core";
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
  note?: string;
  state: BookingState;
  createdBy?: string;
  createdAt?: unknown;
  decidedAt?: unknown;
};

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
    note: typeof value.note === "string" ? value.note : undefined,
    state: value.state as BookingState,
    createdBy: typeof value.createdBy === "string" ? value.createdBy : undefined,
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

export async function createBookingRequest(input: BookingRequestInput): Promise<{ bookingId: string; pairId: string }> {
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

  // Instant-book is never accepted by this client. A completed family profile may qualify for a future server decision, but only the server may accept; every client write stays requested.
  const pairId = pairIdFor(input.familyUid, input.carerUid);
  const relationshipRef = doc(db, "relationships", pairId);
  const bookingRef = doc(collection(db, "relationships", pairId, "bookings"));
  const booking = {
    familyUid: input.familyUid,
    carerUid: input.carerUid,
    date: input.date,
    from: input.from,
    to: input.to,
    rate: input.rate,
    estimate: input.estimate,
    recurring: input.recurring,
    weekdays: input.recurring === "weekly" ? input.weekdays : [],
    ...(input.note?.trim() ? { note: input.note.trim().slice(0, 1000) } : {}),
    state: "requested" as const,
    createdBy: input.familyUid,
    createdAt: serverTimestamp(),
  };

  const existing = await getDoc(relationshipRef).catch(() => null);
  if (existing?.exists()) {
    if (!canRequestOnExistingRelationship(existing.data(), input.familyUid, input.carerUid)) {
      throw new Error("relationship-not-available");
    }
    await setDoc(bookingRef, booking);
  } else {
    try {
      // A missing relationship is not readable under the deployed rules. Write the first relationship and request together; rules verify both with getAfter().
      const batch = writeBatch(db);
      batch.set(relationshipRef, pair.data);
      batch.set(bookingRef, booking);
      await batch.commit();
    } catch (firstWriteError) {
      // If another request created the relationship between the read and batch, only retry for an already-open, matching pair.
      const raced = await getDoc(relationshipRef).catch(() => null);
      if (!raced?.exists() || !canRequestOnExistingRelationship(raced.data(), input.familyUid, input.carerUid)) throw firstWriteError;
      await setDoc(bookingRef, booking);
    }
  }
  return { bookingId: bookingRef.id, pairId };
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
    const relationship = to === "accepted" && actor === "carer" ? await transaction.get(relationshipRef) : null;
    const relationshipPatch = relationship?.exists()
      ? bookingAcceptanceRelationshipPatch(relationship.data(), String(value.familyUid ?? ""), String(value.carerUid ?? ""), actorUid)
      : null;
    transaction.update(bookingRef, bookingUpdateFor(to, serverTimestamp()));
    if (relationshipPatch) transaction.update(relationshipRef, relationshipPatch);
  });
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
