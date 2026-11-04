import { Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { adminDb } from "./admin.js";
import { enforceRateLimit } from "./rateLimit.js";

const verifyRequestSchema = z.object({
  uid: z.string().min(1).max(128).regex(/^[^/]+$/),
  qualificationId: z.string().min(1).max(128).regex(/^[^/]+$/),
}).strict();

export class VerificationError extends Error {
  constructor(readonly code: "permission-denied" | "not-found" | "failed-precondition") {
    super(code);
    this.name = "VerificationError";
  }
}

export interface VerificationStore {
  verifySubmittedQualification(
    uid: string,
    qualificationId: string,
    verifiedBy: string,
    checkedOn: Date,
  ): Promise<void>;
}

export async function verifyCarerWithStore(
  store: VerificationStore,
  callerUid: string,
  isAdmin: boolean,
  uid: string,
  qualificationId: string,
  checkedOn = new Date(),
): Promise<void> {
  if (!isAdmin || callerUid === uid) throw new VerificationError("permission-denied");
  await store.verifySubmittedQualification(uid, qualificationId, callerUid, checkedOn);
}

export const verifyCarer = onCall({ enforceAppCheck: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in first.");
  const parsed = verifyRequestSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Verification request is not valid.");
  const isAdmin = request.auth?.token.admin === true;
  if (!isAdmin) throw new HttpsError("permission-denied", "Admin access is required.");
  await enforceRateLimit(callerUid, "verify-carer", 5, 60_000);

  const store: VerificationStore = {
    verifySubmittedQualification: async (uid, qualificationId, verifiedBy, checkedOn) => {
      const db = adminDb();
      const qualificationRef = db.doc(`users/${uid}/documents/${qualificationId}`);
      const verifiedRef = db.doc(`verified/${uid}`);
      const stamp = Timestamp.fromDate(checkedOn);
      await db.runTransaction(async (transaction) => {
        const submission = await transaction.get(qualificationRef);
        if (!submission.exists) throw new VerificationError("not-found");
        if (submission.get("status") !== "submitted") throw new VerificationError("failed-precondition");
        transaction.update(qualificationRef, {
          status: "verified",
          checkedOn: stamp,
          verifiedBy,
        });
        transaction.set(verifiedRef, {
          uid,
          status: "verified",
          checkedOn: stamp,
          verifiedBy,
          updatedAt: stamp,
          qualifications: {
            [qualificationId]: { status: "verified", checkedOn: stamp, verifiedBy },
          },
        }, { merge: true });
      });
    },
  };
  try {
    await verifyCarerWithStore(store, callerUid, true, parsed.data.uid, parsed.data.qualificationId);
    return { verified: true };
  } catch (error) {
    if (error instanceof VerificationError) {
      throw new HttpsError(error.code, "This qualification cannot be verified.");
    }
    throw error;
  }
});
