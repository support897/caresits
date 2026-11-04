// USAGE: run with node --test tests/qual.test.mjs from store-build/app3.
import assert from "node:assert/strict";
import test from "node:test";
import { qualificationDateDay, qualificationDates, qualificationStatus } from "../src/qual-logic.js";

test("expiry dates override a saved verified label when already past", () => {
  assert.equal(qualificationStatus({ status: "verified", checkedOn: "2026-04-01", expiry: "2026-10-31" }, "2026-11-04"), "expired");
});

test("expiry within 30 days needs renewal, including day 30", () => {
  assert.equal(qualificationStatus({ expiry: "2026-12-04" }, "2026-11-04"), "needs renewal");
  assert.equal(qualificationStatus({ expiry: "2026-12-05" }, "2026-11-04"), "submitted");
});

test("a verified label without check evidence stays under review", () => {
  assert.equal(qualificationStatus({ status: "verified" }, "2026-11-04"), "under review");
});

test("checked date or verifier can support verified status", () => {
  assert.equal(qualificationStatus({ checkedOn: "2026-10-31" }, "2026-11-04"), "verified");
  assert.equal(qualificationStatus({ verifiedBy: "reviewer-1" }, "2026-11-04"), "verified");
});

test("under review stays distinct until it is verified", () => {
  assert.equal(qualificationStatus({ status: "under_review", checkedOn: null }, "2026-11-04"), "under review");
});

test("qualification date fields accept common date shapes", () => {
  assert.deepEqual(qualificationDates({ dateChecked: "2026-10-01", expiresOn: "2027-01-01" }), { checkedOn: "2026-10-01", expiresOn: "2027-01-01" });
  assert.equal(qualificationDateDay("04/11/2026"), "2026-11-04");
  assert.equal(qualificationDateDay("11/2026"), "2026-11-30");
});
