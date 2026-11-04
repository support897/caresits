import { Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "./admin.js";
import { enforceRateLimit } from "./rateLimit.js";

export function requireOwnDataRequest(callerUid: string | undefined, requestedUid?: string): string {
  if (!callerUid) throw new Error("UNAUTHENTICATED");
  if (requestedUid && requestedUid !== callerUid) throw new Error("PERMISSION_DENIED");
  return callerUid;
}

export interface ExportDataStore {
  load(uid: string): Promise<unknown>;
}

export async function exportOwnData(
  store: ExportDataStore,
  callerUid: string | undefined,
  requestedUid?: string,
): Promise<unknown> {
  const uid = requireOwnDataRequest(callerUid, requestedUid);
  return store.load(uid);
}

function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") {
      return (value.toDate as () => Date)().toISOString();
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialize(child)]));
  }
  return value;
}

async function exportDocumentTree(reference: DocumentReference): Promise<Record<string, unknown> | null> {
  const snapshot = await reference.get();
  if (!snapshot.exists) return null;
  const result: Record<string, unknown> = { ...(snapshot.data() ?? {}) };
  for (const collection of await reference.listCollections()) {
    const rows = await collection.get();
    result[collection.id] = await Promise.all(rows.docs.map((row) => exportDocumentTree(row.ref)));
  }
  return result;
}

async function collectionData(db: Firestore, path: string): Promise<Record<string, unknown>[]> {
  const snapshot = await db.collection(path).get();
  return snapshot.docs.map((row) => ({ id: row.id, ...(row.data() ?? {}) }));
}

async function exportCareSpace(db: Firestore, spaceId: string, uid: string): Promise<Record<string, unknown> | undefined> {
  const space = db.doc(`careSpaces/${spaceId}`);
  const memberSnapshot = await space.collection("members").doc(uid).get();
  if (!memberSnapshot.exists || memberSnapshot.get("status") !== "active") return undefined;
  const member = memberSnapshot.data() ?? {};
  const permissions = member.perms ?? {};
  const admin = member.role === "admin";
  const result: Record<string, unknown> = {
    id: spaceId,
    ...((await space.get()).data() ?? {}),
    member,
  };
  for (const collection of ["children", "dayStory", "shopping", "alerts"]) {
    let rows = await collectionData(db, `careSpaces/${spaceId}/${collection}`);
    if (collection === "dayStory" && !admin && permissions.photos !== true) {
      rows = rows.filter((row) => row.kind !== "photo" && !("photoKey" in row));
    }
    result[collection] = rows;
  }
  if (admin || permissions.calendar === true) {
    result.calendar = await collectionData(db, `careSpaces/${spaceId}/calendar`);
  }
  if (member.role !== "viewer" && (admin || permissions.privateMessages === true)) {
    result.messages = await collectionData(db, `careSpaces/${spaceId}/messages`);
  }
  const medicalRoot = await collectionData(db, `careSpaces/${spaceId}/medical`);
  if (admin || (permissions.allergies === true && permissions.medication === true)) {
    result.medical = medicalRoot;
  } else {
    result.medical = [];
  }
  const medical: Record<string, unknown>[] = [];
  for (const child of medicalRoot) {
    const childId = typeof child.id === "string" ? child.id : "";
    const sections: Record<string, unknown> = {};
    if (admin || permissions.allergies === true) {
      sections.allergies = await collectionData(db, `careSpaces/${spaceId}/medical/${childId}/allergies`);
    }
    if (admin || permissions.medication === true) {
      sections.medication = await collectionData(db, `careSpaces/${spaceId}/medical/${childId}/medication`);
    }
    if (admin) {
      sections.emergency = await collectionData(db, `careSpaces/${spaceId}/medical/${childId}/emergency`);
    }
    medical.push({ childId, sections });
  }
  if (admin || permissions.allergies === true || permissions.medication === true) result.medicalSections = medical;
  return result;
}

export async function loadFirestoreExport(db: Firestore, uid: string): Promise<Record<string, unknown>> {
  const profile = await exportDocumentTree(db.doc(`profiles/${uid}`));
  const privateData = await exportDocumentTree(db.doc(`users/${uid}`));
  const verified = await exportDocumentTree(db.doc(`verified/${uid}`));
  const entitlements = await exportDocumentTree(db.doc(`_entitlements/${uid}`));
  const verifyRequest = await exportDocumentTree(db.doc(`verifyRequests/${uid}`));
  const relationshipRows = await db.collection("relationships").where("members", "array-contains", uid).get();
  const relationships = await Promise.all(relationshipRows.docs.map((row) => exportDocumentTree(row.ref)));
  const spaceRows = await db.collection("careSpaces").get();
  const careSpaces = (await Promise.all(spaceRows.docs.map((row) => exportCareSpace(db, row.id, uid))))
    .filter((space): space is Record<string, unknown> => space !== undefined);
  const safetyReports = await db.collection("safetyReports").where("reporterUid", "==", uid).get();
  return serialize({
    exportedAt: new Date().toISOString(),
    profile,
    privateData,
    verified,
    entitlements,
    verifyRequest,
    relationships,
    careSpaces,
    safetyReports: safetyReports.docs.map((report) => ({ id: report.id, ...report.data() })),
  }) as Record<string, unknown>;
}

export const exportMyData = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  await enforceRateLimit(uid, "export", 2, 60 * 60_000);
  try {
    return await exportOwnData({ load: (userUid) => loadFirestoreExport(adminDb(), userUid) }, uid);
  } catch (error) {
    if (error instanceof Error && error.message === "PERMISSION_DENIED") {
      throw new HttpsError("permission-denied", "Only your own data can be exported.");
    }
    throw error;
  }
});
