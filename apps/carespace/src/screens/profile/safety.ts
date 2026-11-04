import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@cc/core";
import type { CalendarKind } from "../../data/calendar";

export type SafetyCheckinKind = "arrived" | "leaving" | "help";
export type SafetyReportCategory = "spam_scam" | "rude_abusive" | "fake_profile" | "child_safety" | "inappropriate" | "other";

export async function blockTeamMember(uid: string, otherUid: string): Promise<void> {
  if (!uid || !otherUid || uid === otherUid) throw new Error("invalid-block-target");
  await setDoc(doc(db, "users", uid, "blocks", otherUid), { createdAt: serverTimestamp() });
}

export async function reportTeamMember(input: {
  reporterUid: string;
  reportedUid: string;
  category: SafetyReportCategory;
  words: string;
  name: string;
}): Promise<void> {
  const words = input.words.trim().slice(0, 1000);
  if (!input.reporterUid || !input.reportedUid || input.reporterUid === input.reportedUid || !words) throw new Error("invalid-report");
  await addDoc(collection(db, "safetyReports"), {
    reporterUid: input.reporterUid,
    reportedUid: input.reportedUid,
    surface: "profile",
    category: input.category,
    reporterWords: words,
    snapshot: { items: [], text: words, title: input.name.slice(0, 120) },
    state: "open",
    createdAt: serverTimestamp(),
  });
}

export async function sendBookingCheckin(input: {
  spaceId: string;
  uid: string;
  bookingId: string;
  kind: SafetyCheckinKind;
}): Promise<void> {
  if (!input.spaceId || !input.uid || !input.bookingId) throw new Error("booking-required");
  await addDoc(collection(db, "careSpaces", input.spaceId, "checkins"), {
    by: input.uid,
    kind: input.kind,
    bookingId: input.bookingId,
    at: serverTimestamp(),
  });
}

export function isActiveBookingToday(kind: CalendarKind, state: string, start: string, now = new Date()): boolean {
  if (kind !== "booking" || state !== "active") return false;
  const startDate = new Date(start);
  return Number.isFinite(startDate.getTime()) && startDate.toDateString() === now.toDateString();
}
