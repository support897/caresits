// Reference page: someone outside the app writes one reference for a carer or family,
// through a one-time link. They sign in as a guest (anonymous) just to write one document.
import { firebaseConfig } from "./firebase-config.js";
import * as appMod from "../accounts/sdk/firebase-app.js";
import * as authMod from "../accounts/sdk/firebase-auth.js";
import * as fs from "../accounts/sdk/firebase-firestore.js";

const q = new URLSearchParams(location.search);
const target = q.get("c") || "";
const token = q.get("t") || "";
const who = (q.get("n") || "").slice(0, 40);
const $ = (id) => document.getElementById(id);
let stars = 0;

if (who) $("title").textContent = `Write a reference for ${who}`;
if (!/^[A-Za-z0-9_-]{6,128}$/.test(target) || !/^[A-Za-z0-9_-]{8,64}$/.test(token)) {
  $("intro").textContent = "This link is not complete. Ask the person to send it again.";
} else {
  $("form").hidden = false;
}

const row = $("stars");
for (let i = 1; i <= 5; i++) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = "\u2605"; b.setAttribute("aria-label", `${i} star${i > 1 ? "s" : ""}`);
  b.addEventListener("click", () => { stars = i; [...row.children].forEach((c, k) => c.classList.toggle("on", k < i)); });
  row.append(b);
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("msg");
  const text = $("text").value.trim();
  if (!stars) { msg.textContent = "Tap the stars first."; return; }
  if (text.length < 10) { msg.textContent = "Please write a few words."; return; }
  $("go").disabled = true; msg.textContent = "Sending...";
  try {
    const app = appMod.getApps().find((a) => a.name === "[DEFAULT]") || appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    const cred = auth.currentUser ? { user: auth.currentUser } : await authMod.signInAnonymously(auth);
    const db = fs.getFirestore(app);
    const data = { from: cred.user.uid, kind: "link", stars, text, at: fs.serverTimestamp() };
    const name = $("name").value.trim(); const relation = $("rel").value.trim();
    if (name) data.name = name.slice(0, 40);
    if (relation) data.relation = relation.slice(0, 40);
    await fs.setDoc(fs.doc(db, "profiles", target, "reviews", token), data);
    $("form").innerHTML = '<h1>Thank you</h1><p class="refNote">Your reference was sent. You can close this page.</p>';
  } catch (err) {
    $("go").disabled = false;
    msg.textContent = (err && err.code === "permission-denied")
      ? "This link was already used or is no longer valid. Ask for a new one."
      : "Could not send. Check your connection and try again.";
  }
});
