import { test } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDocs, collection } from "firebase/firestore";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const USER_AREAS = ["children", "dayStory", "notifications", "prefs", "emergencyContacts", "documents", "recentlyDeleted", "attachments"];
const PROFILE_AREAS = ["resume", "answers", "devices"];

test("a person can delete their own data areas, user doc and profile (in-app account deletion)", async () => {
  const env = await initializeTestEnvironment({ projectId: "demo-cc-delete", firestore: { rules } });
  try {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users/u1"), { name: "A" });
      await setDoc(doc(db, "profiles/u1"), { side: "family", displayName: "A", postcode: "4000" });
      for (const a of USER_AREAS) await setDoc(doc(db, `users/u1/${a}/${a === "emergencyContacts" ? "main" : "x1"}`), { v: 1 });
      for (const a of PROFILE_AREAS) await setDoc(doc(db, `profiles/u1/${a}/x1`), { v: 1 });
    });
    const db = env.authenticatedContext("u1", { firebase: { sign_in_provider: "password" } }).firestore();
    const bad = [];
    const tryDo = async (label, fn) => { try { await fn(); } catch (e) { bad.push(label + " :: " + (e.code || e.message).slice(0, 40)); } };
    for (const a of USER_AREAS) { await tryDo("list users/" + a, async () => { const rows = await getDocs(collection(db, `users/u1/${a}`)); for (const r of rows.docs) await tryDo("del users/" + a, () => deleteDoc(r.ref)); }); }
    for (const a of PROFILE_AREAS) { await tryDo("list profiles/" + a, async () => { const rows = await getDocs(collection(db, `profiles/u1/${a}`)); for (const r of rows.docs) await tryDo("del profiles/" + a, () => deleteDoc(r.ref)); }); }
    await tryDo("del users/u1", () => deleteDoc(doc(db, "users/u1")));
    await tryDo("del profiles/u1", () => deleteDoc(doc(db, "profiles/u1")));
    if (bad.length) throw new Error("denied: " + bad.join(" ; "));
  } finally { await env.cleanup(); }
});
