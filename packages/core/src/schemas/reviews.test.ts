import { describe, expect, it } from "vitest";
import { reviewReplySubmissionSchema, reviewSubmissionSchema } from "./reviews.js";

const review = {
  relId: "family_carer",
  bookingId: "booking-1",
  familyUid: "family",
  carerUid: "carer",
  rating: 5,
  text: "Kind, calm care.",
};

describe("review submission schemas", () => {
  it("accepts a one-to-five rating and up to 600 characters", () => {
    expect(reviewSubmissionSchema.parse(review)).toEqual(review);
    expect(reviewSubmissionSchema.parse({ ...review, rating: 1, text: "x".repeat(600) }).text).toHaveLength(600);
  });

  it("rejects invalid ratings, oversized text, path IDs, and same-side users", () => {
    expect(reviewSubmissionSchema.safeParse({ ...review, rating: 0 }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ ...review, rating: 6 }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ ...review, text: "x".repeat(601) }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ ...review, relId: "family/carer" }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ ...review, carerUid: "family" }).success).toBe(false);
  });

  it("requires a non-empty reply of at most 600 characters", () => {
    expect(reviewReplySubmissionSchema.parse({ text: "Thanks for sharing." }).text).toBe("Thanks for sharing.");
    expect(reviewReplySubmissionSchema.safeParse({ text: "  " }).success).toBe(false);
    expect(reviewReplySubmissionSchema.safeParse({ text: "x".repeat(601) }).success).toBe(false);
  });
});
