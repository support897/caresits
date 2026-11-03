import { initializeApp } from "firebase/app";
import * as authMod from "firebase/auth";
import * as fs from "firebase/firestore";
import { firebaseConfig } from "../../www/app2/firebase-config.js";
import { sharedAuth, restoreSessionMirror, waitForSession } from "../../www/app2/auth-shared.js";
import { areaCoordsFor, kmBetween } from "../../www/app2/browse.js";
import { planContact, pairIdFor } from "../../www/app2/pair-actions.js";
import { scoreFit } from "../../www/app2/fit.js";

export const app = initializeApp(firebaseConfig, "app3");
export const db = fs.getFirestore(app);
let _auth;
export const auth = () => (_auth ||= sharedAuth(authMod, app));
export const { signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } = authMod;
export { restoreSessionMirror, waitForSession };

const shape = (id, d) => {
  const card = { ...(d.card || {}) };
  if (card.latE2 == null) { const a = areaCoordsFor(card.postcode || d.postcode || ""); if (a) Object.assign(card, a); }
  return { uid: id, side: d.side, name: d.displayName || d.name || card.firstName || "Member", photoUrl: d.photoUrl || "", about: d.about || card.about || "", postcode: d.postcode || card.postcode || "", card, looking: d.looking || {}, raw: d };
};

export async function loadMe(uid) {
  if (globalThis.__C3_TEST) return globalThis.__C3_TEST.me;
  const s = await fs.getDoc(fs.doc(db, "profiles", uid));
  return s.exists() ? shape(uid, s.data()) : null;
}

export async function loadPeople(me) {
  if (globalThis.__C3_TEST) return globalThis.__C3_TEST.people;
  const want = me.side === "family" ? "carer" : "family";
  const pc = String(me.postcode || "").replace(/\D/g, "");
  let docs = [];
  if (pc.length >= 2) {
    const lo = pc.slice(0, 2);
    try { docs = (await fs.getDocs(fs.query(fs.collection(db, "profiles"), fs.where("postcode", ">=", lo), fs.where("postcode", "<", lo + "\uffff"), fs.limit(120)))).docs; } catch { docs = []; }
  }
  docs = docs.filter((d) => d.id !== me.uid && (d.data().side || want) === want);
  if (docs.length < 5) docs = (await fs.getDocs(fs.query(fs.collection(db, "profiles"), fs.limit(100)))).docs.filter((d) => d.id !== me.uid && (d.data().side || want) === want);
  return docs.slice(0, 60).map((d) => shape(d.id, d.data()));
}

export function rank(me, people, prefs, radiusKm) {
  return people.map((p) => {
    const km = kmBetween(me.card, p.card);
    const fit = scoreFit({ viewer: { side: me.side, card: me.card }, other: { side: p.side, card: p.card }, prefs, radiusKm, km });
    return { ...p, km, fit };
  }).sort((a, b) => b.fit.pct - a.fit.pct);
}

export async function loadRels(uid) {
  if (globalThis.__C3_TEST) return globalThis.__C3_TEST.rels;
  const q = await fs.getDocs(fs.query(fs.collection(db, "relationships"), fs.where("members", "array-contains", uid)));
  return q.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function like(me, other) {
  const familyUid = me.side === "family" ? me.uid : other.uid, carerUid = me.side === "family" ? other.uid : me.uid;
  const now = new Date().toISOString();
  const plan = planContact({ familyUid, carerUid, createdBy: me.uid, nowIso: now, createdDay: now.slice(0, 10), profileComplete: true });
  if (!plan.ok) return { ok: false };
  const ref = fs.doc(db, plan.path);
  const ex = await fs.getDoc(ref);
  if (ex.exists()) return { ok: true, match: ex.data().createdBy !== me.uid, existed: true };
  await fs.setDoc(ref, plan.data);
  return { ok: true, match: false };
}

export async function acceptRel(id) { await fs.updateDoc(fs.doc(db, "relationships", id), { state: "contact", contactBy: auth().currentUser.uid }); }
export async function saveProfile(uid, patch) {
  await fs.setDoc(fs.doc(db, "profiles", uid), patch, { merge: true });
}
export { pairIdFor };

export const resumeText = (me, other) => {
  const c = me.card || {}; const L = [`Hi ${other.name || "there"}, I'm ${me.name}. Here is my resume from my profile.`];
  const yrs = c.experience && Object.values(c.experience).map(Number).filter((n) => !isNaN(n));
  if (c.age) L.push("Age: " + c.age);
  if (yrs && yrs.length) L.push("Experience: " + Math.max(...yrs) + "+ years");
  const ages = c.agesAccepted || c.agesPreferred || []; if (ages.length) L.push("Ages I care for: " + ages.join(", "));
  if ((c.languages || []).length) L.push("Languages: " + c.languages.join(", "));
  L.push("Checks: " + (c.checksLevel === "register" ? "Background checked" : c.checksLevel === "sighted" ? "ID sighted" : "Self-reported, not yet checked"));
  if (c.payFloor) L.push("Rate from: $" + c.payFloor + " / hour");
  if (me.about) L.push("", me.about);
  return L.join("\n");
};
export async function sendMsg(me, other, text) {
  if (globalThis.__C3_TEST) return { ok: true };
  await like(me, other).catch(() => {});
  await fs.addDoc(fs.collection(db, "users", me.uid, "messages"), { pairId: pairIdFor(me.uid, other.uid), text, at: new Date().toISOString(), mine: true });
  return { ok: true };
}
