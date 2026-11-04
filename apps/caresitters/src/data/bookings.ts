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
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db } from "@cc/core";
import {
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

type RelDoc = { id: string; familyUid: string; carerUid: string; members: string[] };

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

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(relationshipRef);
    if (existing.exists()) {
      const old = existing.data();
      const members = Array.isArray(old.members) ? old.members.map(String) : [];
      if (!members.includes(input.familyUid) || !members.includes(input.carerUid) || old.state === "blocked") {
        throw new Error("relationship-not-available");
      }
    } else {
      transaction.set(relationshipRef, pair.data);
    }
    transaction.set(bookingRef, booking);
  });
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
  const current = await getDoc(bookingRef);
  if (!current.exists()) throw new Error("booking-not-found");
  const value = current.data();
  const expectedUid = actor === "family" ? value.familyUid : value.carerUid;
  if (expectedUid !== actorUid || !canTransitionBooking(value.state as BookingState, to, actor)) throw new Error("booking-transition-not-allowed");
  await updateDoc(bookingRef, { state: to, decidedAt: serverTimestamp() });
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
  const docs = await getDocs(collection(db, "users", uid, "emergencyContacts"));
  return docs.docs.slice(0, 3).map((row) => row.data()).filter((row) => typeof row.name === "string" && typeof row.phone === "string").map((row) => ({ name: String(row.name), phone: String(row.phone), relation: typeof row.relation === "string" ? row.relation : undefined }));
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
      label: String(record.label ?? record.name ?? record.kind ?? "Check"),
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

export async function createCareSpaceInvite(input: { familyUid: string; familyName: string; carerUid: string; bookingId?: string }): Promise<string> {
  if (auth().currentUser?.uid !== input.familyUid) throw new Error("family-owner-sign-in-required");
  const spaceId = input.familyUid;
  const batch = writeBatch(db);
  const spaceRef = doc(db, "careSpaces", spaceId);
  const familyMemberRef = doc(db, "careSpaces", spaceId, "members", input.familyUid);
  const inviteRef = doc(db, "careSpaces", spaceId, "invites", input.carerUid);
  const [existingSpace, existingFamilyMember] = await Promise.all([getDoc(spaceRef), getDoc(familyMemberRef)]);
  const existingSpaceName = existingSpace.data()?.name;
  batch.set(spaceRef, {
    ownerUid: input.familyUid,
    name: typeof existingSpaceName === "string" && existingSpaceName ? existingSpaceName : `${input.familyName}'s care space`,
    ...(!existingSpace.exists() ? { createdAt: serverTimestamp() } : {}),
  }, { merge: true });
  batch.set(familyMemberRef, {
    role: "admin",
    status: "active",
    perms: { allergies: true, medication: true, photos: true, calendar: true, privateMessages: true },
    displayName: input.familyName,
    ...(!existingFamilyMember.exists() ? { joinedAt: serverTimestamp() } : {}),
    invitedBy: input.familyUid,
  }, { merge: true });
  // DATA-MODEL v2 has no invite path. Keep the pending invitation owner-controlled at careSpaces/{familyUid}/invites/{carerUid}; a rules/backend owner must accept it into members/{uid}.
  batch.set(inviteRef, {
    toUid: input.carerUid,
    role: "regular",
    status: "invited",
    invitedBy: input.familyUid,
    ...(input.bookingId ? { bookingId: input.bookingId } : {}),
    createdAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  return spaceId;
}

export type MediaSigner = (key: string) => Promise<string | null>;
let mediaSigner: MediaSigner | null = null;
/** Gatekeeper adapter stub: returns null until an authorized five-minute R2 signer is configured. */
export function configureMediaSigner(signer: MediaSigner | null): void { mediaSigner = signer; }
export async function mediaUrl(key: string): Promise<string | null> {
  if (!key || !mediaSigner) return null;
  try { return await mediaSigner(key); } catch { return null; }
}
