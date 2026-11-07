import { test } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { readFileSync } from "node:fs";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const P = (side, careTypes) => ({ side, displayName: side + careTypes.join(""), postcode: "4000", card: { careTypes }, looking: {} });
const people = {
  fN: P("family", ["nanny"]), fB: P("family", ["babysitter"]), fA: P("family", ["au_pair"]),
  cN: P("carer", ["nanny"]), cB: P("carer", ["babysitter"]), cA: P("carer", ["au_pair"]),
  fNone: P("family", []), cNone: P("carer", []),
};

test("reciprocal profile discovery is enforced by Firestore rules", { concurrency: 1 }, async (t) => {
  const env = await initializeTestEnvironment({ projectId: "demo-cc", firestore: { rules, host: "127.0.0.1", port: 8085 } });
  const cache = {};
  const as = (uid) => (cache[uid] ??= env.authenticatedContext(uid, { firebase: { sign_in_provider: "password" } }).firestore());
  await env.withSecurityRulesDisabled(async (ctx) => { const fs = ctx.firestore(); for (const [uid, d] of Object.entries(people)) await setDoc(doc(fs, "profiles", uid), d); });
  const listOther = async (uid, svc) => {
    const other = people[uid].side === "family" ? "carer" : "family";
    const rows = await getDocs(query(collection(as(uid), "profiles"), where("side", "==", other), where("card.careTypes", "array-contains", svc)));
    return rows.docs.map((d) => d.id).sort();
  };
  await t.test("list per service", async () => {
    for (const [uid, svc, want] of [["cB","babysitter",["fB"]],["fB","babysitter",["cB"]],["cN","nanny",["fN"]],["fN","nanny",["cN"]],["cA","au_pair",["fA"]],["fA","au_pair",["cA"]]]) { const got = await listOther(uid, svc); if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(uid + " got " + got); }
    await assertFails(listOther("cB", "nanny"));
    await assertFails(listOther("fN", "au_pair"));
  });
  await t.test("(probe) query result for family nanny", async () => {
    await assertFails(getDocs(query(collection(as("fN"), "profiles"), where("side", "==", "carer"))));
  });
  await t.test("own and unrelated gets", async () => {
    await assertSucceeds(getDoc(doc(as("fN"), "profiles/fN")));
    await assertSucceeds(getDoc(doc(as("fN"), "profiles/cN")));
    await assertFails(getDoc(doc(as("fN"), "profiles/cB")));
    await assertFails(getDoc(doc(as("fN"), "profiles/cA")));
    await assertFails(getDoc(doc(as("cB"), "profiles/fN")));
    await assertSucceeds(getDoc(doc(as("cB"), "profiles/fB")));
    await assertFails(getDoc(doc(as("fNone"), "profiles/cN")));
    await assertFails(getDoc(doc(as("fN"), "profiles/cNone")));
  });
  await t.test("unfiltered list is denied", async () => {
    await assertFails(getDocs(collection(as("fN"), "profiles")));
  });
  await t.test("relationship partners may still read each other", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), "relationships/cB_fN"), { members: ["cB", "fN"], familyUid: "fN", carerUid: "cB", state: "contact", createdBy: "fN" }));
    await assertSucceeds(getDoc(doc(as("fN"), "profiles/cB")));
    await assertSucceeds(getDoc(doc(as("cB"), "profiles/fN")));
  });
  await env.cleanup();
});

test("service answers subcollection", { concurrency: 1 }, async (t) => {
  const env = await initializeTestEnvironment({ projectId: "demo-cc", firestore: { rules, host: "127.0.0.1", port: 8085 } });
  const as = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "password" } }).firestore();
  const own = as("sd1"), fam = as("sdF"), other = as("sdO");
  await env.withSecurityRulesDisabled(async (ctx) => { const fs = ctx.firestore();
    await setDoc(doc(fs, "profiles/sd1"), P("carer", ["babysitter"]));
    await setDoc(doc(fs, "profiles/sdF"), P("family", ["babysitter"]));
    await setDoc(doc(fs, "profiles/sdO"), P("family", ["nanny"])); });
  const body = (svc) => ({ service: svc, side: "carer", values: { minBookingHours: 3 }, updatedAt: new Date() });
  await t.test("owner writes valid service doc", async () => assertSucceeds(setDoc(doc(own, "profiles/sd1/service/babysitter"), body("babysitter"))));
  await t.test("unknown service denied", async () => assertFails(setDoc(doc(own, "profiles/sd1/service/housekeeper"), body("housekeeper"))));
  await t.test("mismatched service field denied", async () => assertFails(setDoc(doc(own, "profiles/sd1/service/nanny"), body("babysitter"))));
  await t.test("others cannot write", async () => assertFails(setDoc(doc(fam, "profiles/sd1/service/babysitter"), body("babysitter"))));
  await t.test("eligible family reads, ineligible family denied", async () => {
    await assertSucceeds(getDoc(doc(fam, "profiles/sd1/service/babysitter")));
    await assertFails(getDoc(doc(other, "profiles/sd1/service/babysitter")));
  });
  await env.cleanup();
});
