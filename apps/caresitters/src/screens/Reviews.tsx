import { useCallback, useEffect, useState } from "react";
import { Button, t } from "@cc/core";
import {
  createReview,
  loadReviewForBooking,
  loadReviewsForCarer,
  loadReviewSummary,
  saveReviewReply,
  type MarketplaceReview,
  type MarketplaceReviewSummary,
} from "../data/reviews";

const reviewStyles = `
.review-ui{display:grid;gap:12px;min-width:0;font-size:17px;line-height:1.45}
.review-ui *{box-sizing:border-box}
.review-summary{display:grid;gap:4px;padding:14px;border-radius:16px;background:var(--soft)}
.review-summary strong{font-size:23px;color:var(--ink)}
.review-card{display:grid;gap:10px;min-width:0;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--card)}
.review-line{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.review-muted{margin:0;color:var(--muted)}
.review-body{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}
.review-form{display:grid;gap:10px;min-width:0}
.review-form label{display:grid;gap:6px;font-weight:700}
.review-stars{display:flex;flex-wrap:wrap;gap:6px}
.review-stars button{min-width:48px;min-height:48px;border:1px solid var(--line);border-radius:14px;background:var(--card);color:var(--ink);font:inherit;cursor:pointer}
.review-stars button[aria-pressed=true]{background:var(--soft);border-color:var(--ink)}
.review-input{width:100%;min-width:0;min-height:52px;padding:10px 12px;border:1.5px solid var(--line);border-radius:14px;background:var(--card);color:var(--text);font:inherit}
.review-input.textarea{min-height:96px;resize:vertical}
.review-actions{display:flex;flex-wrap:wrap;gap:8px}
.review-error{margin:0;padding:10px;border:1px solid var(--danger);border-radius:12px;color:var(--danger)}
.review-ui button:focus-visible,.review-ui textarea:focus-visible{outline:3px solid var(--ink);outline-offset:2px}
@media(max-width:360px){.review-card{padding:12px}.review-stars{gap:4px}.review-stars button{min-width:44px;min-height:44px}}
`;

type LeaveReviewProps = {
  relId: string;
  bookingId: string;
  familyUid: string;
  carerUid: string;
};

export function LeaveReview({ relId, bookingId, familyUid, carerUid }: LeaveReviewProps) {
  const [existing, setExisting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    setChecking(true);
    void loadReviewForBooking(relId, bookingId)
      .then((review) => { if (live) setExisting(Boolean(review)); })
      .catch(() => { if (live) setError(t("reviews.checkError", "Could not check for a review. You can still try to save one.")); })
      .finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, [relId, bookingId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (rating < 1 || rating > 5) {
      setError(t("reviews.chooseRating", "Choose a rating from 1 to 5."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createReview({ relId, bookingId, familyUid, carerUid, rating, text });
      setExisting(true);
      setSaved(true);
      setOpen(false);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "";
      setError(reason === "review-already-submitted" ? t("reviews.alreadyLeft", "A review is already saved for this booking.")
        : reason === "completed-booking-required" ? t("reviews.completedOnly", "A review can be left after a booking is completed.")
          : t("reviews.saveError", "Review could not be saved. Check your connection and try again."));
    } finally { setBusy(false); }
  }

  return <div className="review-ui">
    <style>{reviewStyles}</style>
    {checking ? <p className="review-muted" role="status">{t("reviews.checking", "Checking this booking…")}</p>
      : existing || saved ? <p className="review-muted" role="status">{t("reviews.thankYou", "You left a review for this booking.")}</p>
        : <>
          <p className="review-muted">{t("reviews.optionalNote", "Optional. Share only what you feel comfortable sharing.")}</p>
          {!open ? <Button alt onClick={() => { setOpen(true); setError(""); }}>{t("reviews.leaveReview", "Leave a review")}</Button>
            : <form className="review-form" onSubmit={(event) => void submit(event)}>
              <div><b id={`review-rating-${bookingId}`}>{t("reviews.ratingLabel", "Your rating")}</b>
                <span className="review-stars" role="group" aria-labelledby={`review-rating-${bookingId}`}>
                  {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-pressed={rating === value}
                    aria-label={t("reviews.starChoice", "{rating} out of 5 stars", { rating: value })}
                    onClick={() => { setRating(value); setError(""); }}>{rating >= value ? "★" : "☆"}</button>)}
                </span>
              </div>
              <label htmlFor={`review-text-${bookingId}`}>{t("reviews.textLabel", "Review (optional)")}
                <textarea id={`review-text-${bookingId}`} className="review-input textarea" maxLength={600} value={text}
                  onChange={(event) => setText(event.target.value)} />
              </label>
              <p className="review-muted" aria-live="polite">{t("reviews.charCount", "{count} of 600 characters", { count: text.length })}</p>
              {error && <p className="review-error" role="alert">{error}</p>}
              <div className="review-actions"><Button type="submit" disabled={busy}>{busy ? t("reviews.saving", "Saving…") : t("reviews.save", "Save review")}</Button>
                <Button alt type="button" onClick={() => { setOpen(false); setError(""); }}>{t("reviews.cancel", "Not now")}</Button></div>
            </form>}
          {error && !open && <p className="review-error" role="alert">{error}</p>}
        </>}
  </div>;
}

type ReviewsListProps = { carerUid: string; viewerUid: string };

export function ReviewsList({ carerUid, viewerUid }: ReviewsListProps) {
  const [reviews, setReviews] = useState<MarketplaceReview[]>([]);
  const [summary, setSummary] = useState<MarketplaceReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    const [rows, total] = await Promise.all([loadReviewsForCarer(carerUid), loadReviewSummary(carerUid)]);
    setReviews(rows);
    setSummary(total);
  }, [carerUid]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void refresh().catch(() => { if (live) setError(t("reviews.loadError", "Reviews could not load. Check your connection and try again.")); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [refresh]);

  return <section className="booking-card booking-section review-ui" aria-labelledby={`reviews-title-${carerUid}`}>
    <style>{reviewStyles}</style>
    <h2 id={`reviews-title-${carerUid}`}>{t("reviews.title", "Reviews")}</h2>
    {summary && summary.count > 0 && summary.avg >= 1 && summary.avg <= 5 && <div className="review-summary">
      <strong>{summary.avg.toFixed(1)} / 5</strong>
      <span>{t("reviews.averageLabel", "Average rating from completed bookings")}</span>
      <span>{t("reviews.reviewCount", "{count} reviews", { count: summary.count })}</span>
    </div>}
    {loading ? <p className="review-muted" role="status">{t("reviews.loading", "Loading reviews…")}</p>
      : error ? <><p className="review-error" role="alert">{error}</p><Button alt onClick={() => { setLoading(true); void refresh().catch(() => setError(t("reviews.loadError", "Reviews could not load. Check your connection and try again."))).finally(() => setLoading(false)); }}>{t("reviews.tryAgain", "Try again")}</Button></>
        : reviews.length ? reviews.map((review) => <ReviewCard key={review.id} review={review} canReply={viewerUid === carerUid}
          onReplySaved={async () => { await refresh(); }} />)
          : <p className="review-muted">{t("reviews.empty", "No reviews yet.")}</p>}
  </section>;
}

type ReviewCardProps = { review: MarketplaceReview; canReply: boolean; onReplySaved: () => Promise<void> };

function ReviewCard({ review, canReply, onReplySaved }: ReviewCardProps) {
  const date = dateLabel(review.at);
  return <article className="review-card">
    <div className="review-line"><b>{t("reviews.familyLabel", "Family review")}</b>
      <span aria-label={t("reviews.ratingDisplay", "Rating {rating} out of 5", { rating: review.rating })}>★ {review.rating}/5</span></div>
    {date && <p className="review-muted">{date}</p>}
    {review.text ? <p className="review-body">{review.text}</p> : <p className="review-muted">{t("reviews.ratingOnly", "Rating only")}</p>}
    {review.reply ? <div className="review-card"><b>{t("reviews.carerReply", "Carer reply")}</b><p className="review-body">{review.reply.text}</p></div>
      : canReply && <ReviewReplyForm reviewId={review.id} carerUid={review.carerUid} onSaved={onReplySaved} />}
  </article>;
}

type ReviewReplyFormProps = { reviewId: string; carerUid: string; onSaved: () => Promise<void> };

function ReviewReplyForm({ reviewId, carerUid, onSaved }: ReviewReplyFormProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await saveReviewReply(reviewId, carerUid, text);
      setText("");
      await onSaved();
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "";
      setError(reason === "review-reply-already-added" ? t("reviews.replyExists", "A reply is already saved for this review.")
        : t("reviews.replyError", "Reply could not be saved. Check your connection and try again."));
    } finally { setBusy(false); }
  }
  return <form className="review-form" onSubmit={(event) => void submit(event)}>
    <label htmlFor={`review-reply-${reviewId}`}>{t("reviews.replyLabel", "Reply to this review (optional)")}
      <textarea id={`review-reply-${reviewId}`} className="review-input textarea" maxLength={600} value={text}
        onChange={(event) => setText(event.target.value)} /></label>
    <p className="review-muted">{t("reviews.replyPublicNote", "Your reply will appear with this review.")}</p>
    <p className="review-muted" aria-live="polite">{t("reviews.charCount", "{count} of 600 characters", { count: text.length })}</p>
    {error && <p className="review-error" role="alert">{error}</p>}
    <Button type="submit" disabled={busy || !text.trim()}>{busy ? t("reviews.replySaving", "Saving…") : t("reviews.replyAction", "Reply")}</Button>
  </form>;
}

function dateLabel(value: unknown): string {
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (typeof value === "number") date = new Date(value);
  else if (typeof value === "string") date = new Date(value);
  else if (value && typeof value === "object") {
    const timestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof timestamp.toDate === "function") date = timestamp.toDate();
    else if (typeof timestamp.seconds === "number") date = new Date(timestamp.seconds * 1000);
  }
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date) : "";
}
