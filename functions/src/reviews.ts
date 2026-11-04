import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { adminDb } from "./admin.js";

export interface ReviewRatingRow {
  rating?: unknown;
}

export interface ReviewsSummary {
  count: number;
  avg: number;
}

/** Pure rollup so review summaries can be checked without Firestore. */
export function recomputeReviewsSummary(reviews: readonly ReviewRatingRow[]): ReviewsSummary {
  const ratings = reviews
    .map((review) => review.rating)
    .filter((rating): rating is number => typeof rating === "number"
      && Number.isInteger(rating) && rating >= 1 && rating <= 5);
  const count = ratings.length;
  if (count === 0) return { count: 0, avg: 0 };
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return { count, avg: Math.round((total / count) * 100) / 100 };
}

/** Rebuilds the server-only summary after each immutable review is created. */
export const reviewsSummaryOnCreate = onDocumentCreated("reviews/{reviewId}", async (event) => {
  const review = event.data?.data();
  const carerUid = review?.carerUid;
  if (typeof carerUid !== "string" || !carerUid) return;

  const db = adminDb();
  const snapshot = await db.collection("reviews").where("carerUid", "==", carerUid).get();
  const summary = recomputeReviewsSummary(snapshot.docs.map((document) => ({ rating: document.get("rating") })));
  await db.doc(`reviewSummaries/${carerUid}`).set(summary);
});
