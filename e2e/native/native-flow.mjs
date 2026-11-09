// Replays, write for write, what the SwiftUI app sends to Firestore, against the real rules in the emulator.
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, collection, query, where, limit, writeBatch, serverTimestamp, Timestamp, addDoc, orderBy, updateDoc } from "firebase/firestore";
const mk = async (name) => {
  const app = initializeApp({ apiKey: "x", projectId: "demo-cc" }, name);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const c = await createUserWithEmailAndPassword(auth, `${name}${Date.now()}@x.com`, "pw123456");
  return { db, uid: c.user.uid };
};
let pass = 0, fail = 0;
const ok = async (label, fn) => { try { await fn(); pass++; console.log("PASS", label); } catch (e) { fail++; console.log("FAIL", label, String(e.message || e).slice(0, 160)); } };
const pairId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const roles = { nanny: "nanny", babysitter: "babysitter", au_pair: "au_pair" };
const carers = {};
for (const svc of Object.values(roles)) {
  carers[svc] = await mk("c" + svc.replace("_", ""));
  await ok(`${svc}: create carer profile`, () => setDoc(doc(carers[svc].db, "profiles", carers[svc].uid), {
    side: "carer", displayName: "Test " + svc, postcode: "4000", about: "Warm and calm.", updatedAt: serverTimestamp(), looking: { musts: {}, prefs: {} },
    card: { suburb: "Teneriffe", careTypes: [svc], headline: "Calm care", languages: ["English"], experienceYears: 3, rate: 32.5, maxDistanceKm: 10, availability: { Mon: { from: "08:00", to: "17:00" }, Tue: { from: "08:00", to: "17:00" } } } }));
}
const fam = await mk("fam");
await ok("family: create profile", () => setDoc(doc(fam.db, "profiles", fam.uid), {
  side: "family", displayName: "Test Family", postcode: "4000", about: "", updatedAt: serverTimestamp(), looking: { musts: {}, prefs: {} },
  card: { suburb: "Teneriffe", careTypes: ["nanny", "babysitter", "au_pair"], kids: [{ name: "Mia", ageYears: 4 }], scheduleNeed: { Mon: { from: "08:00", to: "17:00" } }, budgetMax: 40, maxDistanceKm: 10 } }));
for (const svc of Object.values(roles)) {
  await ok(`family discovers ${svc}`, async () => {
    const s = await getDocs(query(collection(fam.db, "profiles"), where("side", "==", "carer"), where("card.careTypes", "array-contains", svc), limit(100)));
    if (!s.docs.some((d) => d.id === carers[svc].uid)) throw new Error("not found");
  });
  await ok(`${svc} discovers families`, async () => {
    const s = await getDocs(query(collection(carers[svc].db, "profiles"), where("side", "==", "family"), where("card.careTypes", "array-contains", svc), limit(100)));
    if (!s.docs.some((d) => d.id === fam.uid)) throw new Error("not found");
  });
}
// booking flow with the nanny: create, accept, chat, complete, review
const n = carers.nanny; const pid = pairId(fam.uid, n.uid);
const bookingPast = async (date, from, to, withEnd = true) => {
  const relRef = doc(fam.db, "relationships", pid); const bRef = doc(collection(fam.db, "relationships", pid, "bookings"));
  const existing = await getDoc(relRef).catch(() => null);
  const batch = writeBatch(fam.db);
  if (!existing?.exists()) { const iso = new Date().toISOString(); batch.set(relRef, { members: [fam.uid, n.uid].sort(), familyUid: fam.uid, carerUid: n.uid, state: "pending", createdBy: fam.uid, createdAt: iso, createdDay: iso.slice(0, 10) }); }
  batch.set(bRef, { familyUid: fam.uid, carerUid: n.uid, date, from, to, ...(withEnd ? { endAt: Timestamp.fromDate(new Date(new Date(`${date}T${to}:00.000Z`).getTime() - 8 * 3600 * 1000)) } : {}), rate: 32.5, estimate: 130, recurring: "none", weekdays: [], childIds: [], shareAddress: false, note: "Please bring snacks", state: "requested", createdBy: fam.uid, createdAt: serverTimestamp() });
  await batch.commit(); return bRef.id;
};
let bid;
await ok("family: send booking request (relationship + booking)", async () => { bid = await bookingPast("2026-12-01", "09:00", "13:00"); });
await ok("family: reads own bookings", async () => { const s = await getDocs(collection(fam.db, "relationships", pid, "bookings")); if (s.empty) throw new Error("empty"); });
await ok("nanny: sees the request", async () => { const s = await getDocs(query(collection(n.db, "relationships"), where("carerUid", "==", n.uid))); if (s.empty) throw new Error("no rel"); const b = await getDocs(collection(n.db, "relationships", pid, "bookings")); if (b.empty) throw new Error("no booking"); });
await ok("chat blocked before accept", async () => { let blocked = false; try { await addDoc(collection(fam.db, "relationships", pid, "messages"), { from: fam.uid, kind: "text", text: "hi", at: serverTimestamp() }); } catch { blocked = true; } if (!blocked) throw new Error("chat should be closed"); });
await ok("nanny: accepts (booking + relationship to contact)", async () => {
  const batch = writeBatch(n.db);
  batch.update(doc(n.db, "relationships", pid, "bookings", bid), { state: "accepted", decidedAt: serverTimestamp() });
  batch.update(doc(n.db, "relationships", pid), { state: "contact", contactBy: n.uid });
  await batch.commit();
});
await ok("family sends chat message", () => addDoc(collection(fam.db, "relationships", pid, "messages"), { from: fam.uid, kind: "text", text: "Hello!", at: serverTimestamp() }));
await ok("nanny replies and reads thread", async () => { await addDoc(collection(n.db, "relationships", pid, "messages"), { from: n.uid, kind: "text", text: "Hi, see you Monday", at: serverTimestamp() }); const s = await getDocs(query(collection(n.db, "relationships", pid, "messages"), orderBy("at"))); if (s.size !== 2) throw new Error("expected 2, got " + s.size); });
await ok("second booking on existing relationship", async () => { await bookingPast("2026-12-05", "10:00", "12:00"); });
let pastId;
await ok("old booking (no endAt) accepted then done", async () => {
  pastId = await bookingPast("2026-10-01", "09:00", "13:00", false);
  await updateDoc(doc(n.db, "relationships", pid, "bookings", pastId), { state: "accepted", decidedAt: serverTimestamp() });
});
await ok("nanny: future booking cannot be marked done early", async () => { let blocked = false; try { await updateDoc(doc(n.db, "relationships", pid, "bookings", bid), { state: "completed" }); } catch { blocked = true; } if (!blocked) throw new Error("allowed too early"); });
await ok("nanny: marks past booking done", () => updateDoc(doc(n.db, "relationships", pid, "bookings", pastId), { state: "completed" }));
await ok("family: cancels future booking", () => updateDoc(doc(fam.db, "relationships", pid, "bookings", bid), { state: "cancelled" }));
await ok("family: leaves review", () => setDoc(doc(fam.db, "reviews", `${pid}_${pastId}`), { relId: pid, bookingId: pastId, familyUid: fam.uid, carerUid: n.uid, rating: 5, text: "Wonderful", at: serverTimestamp() }));
await ok("review cannot be edited", async () => { let blocked = false; try { await setDoc(doc(fam.db, "reviews", `${pid}_${pastId}`), { relId: pid, bookingId: pastId, familyUid: fam.uid, carerUid: n.uid, rating: 1, text: "x", at: serverTimestamp() }); } catch { blocked = true; } if (!blocked) throw new Error("edit allowed"); });
await ok("carer cannot review a family", async () => { let blocked = false; try { await setDoc(doc(n.db, "reviews", `${pid}_zz`), { relId: pid, bookingId: "zz", familyUid: fam.uid, carerUid: n.uid, rating: 5, text: "x", at: serverTimestamp() }); } catch { blocked = true; } if (!blocked) throw new Error("allowed"); });
await ok("carer saves resume", () => setDoc(doc(n.db, "profiles", n.uid, "resume", "main"), { summary: "Nanny", jobs: ["Nanny 2019-2022"], education: [], skills: ["First aid"], certificates: [], updatedAt: serverTimestamp() }));
await ok("family reads carer resume", async () => { const s = await getDoc(doc(fam.db, "profiles", n.uid, "resume", "main")); if (!s.exists()) throw new Error("missing"); });
await ok("carer updates availability + photo key + gallery", async () => {
  const cur = (await getDoc(doc(n.db, "profiles", n.uid))).data();
  await setDoc(doc(n.db, "profiles", n.uid), { side: cur.side, displayName: cur.displayName, postcode: cur.postcode, about: cur.about, looking: cur.looking, photoUrl: `users/${n.uid}/photos/avatar-abcdef0123456789abcd.jpg`, updatedAt: serverTimestamp(), card: { ...cur.card, gallery: [`users/${n.uid}/gallery/photo-abcdef0123456789abcd.jpg`], mainPhotoIndex: 0, availability: { Wed: { from: "09:00", to: "15:00" } } } });
});
await ok("saved list write", () => setDoc(doc(fam.db, "users", fam.uid, "saved", n.uid), { at: serverTimestamp() }));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
