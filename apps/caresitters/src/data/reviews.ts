import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db, schemas } from "@cc/core";
import { pairIdFor } from "../lib/booking";

export type MarketplaceReview = schemas.Review & { id: string; reply?: schemas.ReviewReply };
export type MarketplaceReviewSummary = schemas.ReviewSummary;

export function reviewDocumentId(relId: string, bookingId: string): string {
  if (!relId || !bookingId || relId.includes("/") || bookingId.includes("/")) {
    throw new Error("invalid-review-path");
  }
  return `${relId}_${bookingId}`;
}

function mapReview(id: string, data: unknown): MarketplaceReview | null {
  const parsed = schemas.reviewSchema.safeParse(data);
  return parsed.success ? { ...parsed.data, id } : null;
}

export async function loadReviewForBooking(relId: string, bookingId: string): Promise<MarketplaceReview | null> {
  if (!auth().currentUser) return null;
  const snapshot = await getDoc(doc(db, "reviews", reviewDocumentId(relId, bookingId)));
  return snapshot.exists() ? mapReview(snapshot.id, snapshot.data()) : null;
}

export async function loadReviewSummary(carerUid: string): Promise<MarketplaceReviewSummary | null> {
  if (!auth().currentUser || !carerUid) return null;
  const snapshot = await getDoc(doc(db, "reviewSummaries", carerUid));
  if (!snapshot.exists()) return null;
  const parsed = schemas.reviewSummarySchema.safeParse(snapshot.data());
  return parsed.success ? parsed.data : null;
}

export async function loadReviewsForCarer(carerUid: string): Promise<MarketplaceReview[]> {
  if (!auth().currentUser || !carerUid) return [];
  const snapshot = await getDocs(query(collection(db, "reviews"), where("carerUid", "==", carerUid)));
  const reviews = snapshot.docs
    .map((row) => mapReview(row.id, row.data()))
    .filter((row): row is MarketplaceReview => row !== null)
    .sort((a, b) => reviewTime(b.at) - reviewTime(a.at));
  return Promise.all(reviews.map(async (review) => {
    const replySnapshot = await getDoc(doc(db, "reviews", review.id, "replies", review.carerUid));
    if (!replySnapshot.exists()) return review;
    const parsed = schemas.reviewReplySchema.safeParse(replySnapshot.data());
    return parsed.success && parsed.data.by === review.carerUid ? { ...review, reply: parsed.data } : review;
  }));
}

function reviewTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value && typeof value === "object") {
    const timestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof timestamp.toDate === "function") return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === "number") return timestamp.seconds * 1000;
  }
  return 0;
}

export async function createReview(input: schemas.ReviewSubmission): Promise<void> {
  const review = schemas.reviewSubmissionSchema.parse(input);
  const uid = auth().currentUser?.uid;
  if (!uid || uid !== review.familyUid) throw new Error("family-sign-in-required");
  if (pairIdFor(review.familyUid, review.carerUid) !== review.relId) throw new Error("review-relationship-mismatch");

  const relationshipRef = doc(db, "relationships", review.relId);
  const bookingRef = doc(db, "relationships", review.relId, "bookings", review.bookingId);
  const reviewRef = doc(db, "reviews", reviewDocumentId(review.relId, review.bookingId));
  await runTransaction(db, async (transaction) => {
    const [relationship, booking, existing] = await Promise.all([
      transaction.get(relationshipRef),
      transaction.get(bookingRef),
      transaction.get(reviewRef),
    ]);
    if (!relationship.exists() || !booking.exists()) throw new Error("completed-booking-required");
    if (existing.exists()) throw new Error("review-already-submitted");
    const relationshipData = relationship.data();
    const bookingData = booking.data();
    if (relationshipData.familyUid !== uid || relationshipData.carerUid !== review.carerUid
      || bookingData.familyUid !== uid || bookingData.carerUid !== review.carerUid
      || bookingData.state !== "completed") {
      throw new Error("completed-booking-required");
    }
    transaction.set(reviewRef, { ...review, at: serverTimestamp() });
  });
}

export async function saveReviewReply(reviewId: string, carerUid: string, text: string): Promise<void> {
  const reply = schemas.reviewReplySubmissionSchema.parse({ text });
  const uid = auth().currentUser?.uid;
  if (!uid || uid !== carerUid) throw new Error("carer-sign-in-required");
  const reviewRef = doc(db, "reviews", reviewId);
  const replyRef = doc(db, "reviews", reviewId, "replies", carerUid);
  await runTransaction(db, async (transaction) => {
    const [review, existingReply] = await Promise.all([transaction.get(reviewRef), transaction.get(replyRef)]);
    if (!review.exists() || review.data().carerUid !== uid) throw new Error("review-reply-not-allowed");
    if (existingReply.exists()) throw new Error("review-reply-already-added");
    transaction.set(replyRef, { by: uid, text: reply.text, at: serverTimestamp() });
  });
}
