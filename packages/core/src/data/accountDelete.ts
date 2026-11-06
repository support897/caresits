import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import * as A from "firebase/auth";
import { auth } from "../auth";
import { db } from "../firebase";

/** Private areas that belong to the signed-in person. Deleted from their own device, then the sign-in itself is removed. */
export const OWN_USER_COLLECTIONS = ["children", "dayStory", "notifications", "prefs", "emergencyContacts", "documents", "recentlyDeleted", "attachments"] as const;
export const OWN_PROFILE_COLLECTIONS = ["resume", "answers", "devices"] as const;
export type DeleteResult = { ok: true } | { ok: false; reason: "sign-in-again" | "failed" };

/** Pure: the exact document paths this wipe touches, so tests can pin them. */
export function ownDocPaths(uid: string): string[] {
  return [`profiles/${uid}`, `users/${uid}`, ...OWN_USER_COLLECTIONS.map((c) => `users/${uid}/${c}/*`), ...OWN_PROFILE_COLLECTIONS.map((c) => `profiles/${uid}/${c}/*`)];
}
async function wipe(path: string[]): Promise<void> {
  try { const rows = await getDocs(collection(db, path[0]!, ...path.slice(1))); await Promise.all(rows.docs.map((r) => deleteDoc(r.ref).catch(() => undefined))); } catch { /* a missing or locked area must not stop the rest */ }
}
/** Deletes the caller's own data and then the account. Confirmed by the screen before this is called. */
export async function deleteMyAccountNow(): Promise<DeleteResult> {
  const user = auth().currentUser; if (!user) return { ok: false, reason: "failed" };
  const uid = user.uid;
  try {
    for (const c of OWN_USER_COLLECTIONS) await wipe(["users", uid, c]);
    for (const c of OWN_PROFILE_COLLECTIONS) await wipe(["profiles", uid, c]);
    await deleteDoc(doc(db, "profiles", uid)).catch(() => undefined);
    await deleteDoc(doc(db, "users", uid)).catch(() => undefined);
    await A.deleteUser(user);
    try { Object.keys(localStorage).filter((k) => k.startsWith("caresits-")).forEach((k) => localStorage.removeItem(k)); } catch { /* storage may be blocked */ }
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    return { ok: false, reason: code === "auth/requires-recent-login" ? "sign-in-again" : "failed" };
  }
}
