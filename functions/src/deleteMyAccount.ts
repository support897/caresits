import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { adminAuth, adminDb } from "./admin.js";
import { enforceRateLimit } from "./rateLimit.js";

export interface AccountDeletionStore {
  removeUserData(uid: string): Promise<void>;
  deleteAuthUser(uid: string): Promise<void>;
}

export function requireConfirmedSelfDelete(callerUid: string | undefined, confirmed: unknown): string {
  if (!callerUid) throw new Error("UNAUTHENTICATED");
  if (confirmed !== true) throw new Error("CONFIRMATION_REQUIRED");
  return callerUid;
}

export async function deleteMyAccountWithStore(
  store: AccountDeletionStore,
  callerUid: string | undefined,
  confirmed: unknown,
): Promise<void> {
  const uid = requireConfirmedSelfDelete(callerUid, confirmed);
  await store.removeUserData(uid);
  await store.deleteAuthUser(uid);
}

async function removeMembershipsAndRelationships(db: Firestore, uid: string): Promise<void> {
  const spaces = await db.collection("careSpaces").get();
  for (const spaceSnapshot of spaces.docs) {
    const spaceRef = spaceSnapshot.ref;
    const memberRef = spaceRef.collection("members").doc(uid);
    const member = await memberRef.get();
    if (!member.exists) continue;
    const data = spaceSnapshot.data();
    const owner = data.ownerUid === uid;
    const activeAdmins = await spaceRef.collection("members")
      .where("role", "==", "admin")
      .where("status", "==", "active")
      .get();
    const successor = activeAdmins.docs.find((candidate) => candidate.id !== uid);
    if (owner && successor) {
      await db.runTransaction(async (transaction) => {
        transaction.update(spaceRef, { ownerUid: successor.id, updatedAt: FieldValue.serverTimestamp() });
        transaction.update(memberRef, { status: "removed", removedAt: FieldValue.serverTimestamp() });
      });
    } else if (owner) {
      await db.recursiveDelete(spaceRef);
    } else {
      await memberRef.update({ status: "removed", removedAt: FieldValue.serverTimestamp() });
    }
  }

  const relationships = await db.collection("relationships").where("members", "array-contains", uid).get();
  const batch = db.batch();
  for (const relationship of relationships.docs) {
    if (relationship.get("state") !== "ended") {
      batch.update(relationship.ref, { state: "ended", endedAt: FieldValue.serverTimestamp() });
    }
  }
  if (!relationships.empty) await batch.commit();
}

export async function removeAccountRecords(db: Firestore, uid: string): Promise<void> {
  await removeMembershipsAndRelationships(db, uid);
  for (const path of [
    `users/${uid}`,
    `profiles/${uid}`,
    `verified/${uid}`,
    `verifyRequests/${uid}`,
    `_entitlements/${uid}`,
    `_activity/${uid}`,
  ]) {
    await db.recursiveDelete(db.doc(path));
  }
}

export const deleteMyAccount = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  try {
    requireConfirmedSelfDelete(uid, request.data?.confirm);
  } catch (error) {
    throw new HttpsError("failed-precondition", "Confirm account deletion in the app first.");
  }
  await enforceRateLimit(uid, "delete-account", 1, 24 * 60 * 60_000);
  const db = adminDb();
  const store: AccountDeletionStore = {
    removeUserData: (userUid) => removeAccountRecords(db, userUid),
    deleteAuthUser: async (userUid) => {
      await adminAuth().deleteUser(userUid);
    },
  };
  await deleteMyAccountWithStore(store, uid, true);
  return { deleted: true };
});
