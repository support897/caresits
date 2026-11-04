import { describe, expect, it } from "vitest";
import { recomputeReviewsSummary } from "./reviews.js";

describe("recomputeReviewsSummary", () => {
  it("counts valid ratings and computes their average", () => {
    expect(recomputeReviewsSummary([{ rating: 5 }, { rating: 4 }, { rating: 3 }]))
      .toEqual({ count: 3, avg: 4 });
  });

  it("rounds the average to two decimal places", () => {
    expect(recomputeReviewsSummary([{ rating: 5 }, { rating: 2 }, { rating: 1 }]))
      .toEqual({ count: 3, avg: 2.67 });
  });

  it("ignores invalid rows and returns a zero summary when empty", () => {
    expect(recomputeReviewsSummary([{ rating: 5 }, { rating: 0 }, { rating: 6 }, { rating: 2.5 }, {}]))
      .toEqual({ count: 1, avg: 5 });
    expect(recomputeReviewsSummary([])).toEqual({ count: 0, avg: 0 });
  });
});
