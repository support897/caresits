// Caresitters app2 — door v4 (founder approved shape, 15 Oct 2026).
// The first page holds ONLY the sign up, big and centred:
// the big heart mark, the icon doors, one email field and
// the round next arrow. The password lives on step two.
// Signing in lands inside the app, where the bunny tour
// waits. The demo door stays its own quiet entry.
import { firebaseConfig } from "./firebase-config.js";

const $ = (s) => document.querySelector(s);
import { t as tr, applyI18n } from "./lang.js";
applyI18n();
const syncNextDirection = () => { const next = $("#nextBtn"); if (next) next.textContent = document.documentElement.dir === "rtl" ? "←" : "→"; };
syncNextDirection();
const msg = (t) => { $("#doorMsg").textContent = t || ""; };
const ENTRY_ROLE_SESSION_KEY = "caresits-entry-role";
const ENTRY_ROLES = new Set(["career", "family", "communicate"]);
const ROLE_HEADING_KEYS = {
  career: "door.roleCareerHeading",
  family: "door.roleFamilyHeading",
  communicate: "door.roleCommunicateHeading",
};
let selectedRole = null;
function chooseRole(role, remember = true) {
  if (!ENTRY_ROLES.has(role)) return;
  selectedRole = role;
  document.documentElement.dataset.entryRole = role;
  $("#entryRoleHeading").textContent = tr(ROLE_HEADING_KEYS[role]);
  $("#entryRoleHeading").hidden = false;
  $("#roleChooser").hidden = true;
  $("#authDoor").hidden = false;
  document.querySelectorAll(".roleOption").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.role === role));
  });
  if (remember) {
    try { sessionStorage.setItem(ENTRY_ROLE_SESSION_KEY, role); } catch { /* session storage off */ }
  }
}
let accounts = null;
// The email join holds the walk in until it knows whether the
// sign in created the account: a creation is announced out loud
// at the door first (HQ ruling on Leg 19), never silent.
let joinHold = false;

// A stalled module load must speak, never spin (fleet
// census cure): the door's layer load races a bound, and
// the expiry carries the timeout code the lines map on.
// DRIFT WATCH (Efficiency's condition): this is the local
// twin of accounts/account.js's withTimeout — the bounds
// or the shape change in BOTH copies in the same change.
function bounded(promise, ms) {
  let timer;
  const bound = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error("door layer timed out");
      e.code = "auth/timeout";
      reject(e);
    }, ms);
  });
  return Promise.race([promise, bound]).finally(() => clearTimeout(timer));
}
const layerFast = () => bounded(layer(), 15000);

// One walk in, two drivers (the door bisect of record,
// 21 Oct 2026): the auth state listener is the backstop, and
// each social handler drives the same entry from its own
// resolved credential, so a listener that never settles can
// no longer strand a signed in user at a silent door.
let walkedIn = false;
function walkIn() {
  if (walkedIn) return;
  walkedIn = true;
  try { sessionStorage.setItem("caresits-tour", "1"); } catch { /* storage off */ }
  location.href = "index.html";
}

async function layer() {
  if (accounts) return accounts;
  accounts = await import("../accounts/account.js");
  await accounts.initAccounts(firebaseConfig, (u) => {
    if (u && !u.isAnonymous) {
      if (joinHold) return;
      walkIn();
    }
  });
  return accounts;
}
layer().catch(() => {});

document.querySelectorAll(".roleOption").forEach((button) => {
  button.addEventListener("click", () => chooseRole(button.dataset.role));
});
$("#changeRoleBtn").addEventListener("click", () => {
  selectedRole = null;
  try { sessionStorage.removeItem(ENTRY_ROLE_SESSION_KEY); } catch { /* storage off */ }
  delete document.documentElement.dataset.entryRole;
  $("#authDoor").hidden = true;
  $("#entryRoleHeading").hidden = true;
  $("#roleChooser").hidden = false;
  document.querySelectorAll(".roleOption").forEach((button) => button.setAttribute("aria-pressed", "false"));
});
try {
  const rememberedRole = sessionStorage.getItem(ENTRY_ROLE_SESSION_KEY);
  if (rememberedRole) chooseRole(rememberedRole, false);
} catch { /* session storage off */ }

$("#nextBtn").addEventListener("click", () => {
  const email = $("#emailIn").value.trim();
  if (!email || !email.includes("@")) { msg(tr("door.badEmail")); return; }
  msg("");
  $("#emailEcho").textContent = email;
  $("#step1").hidden = true;
  $("#step2").hidden = false;
  $("#pwIn").focus();
});
$("#changeBtn").addEventListener("click", () => { $("#step2").hidden = true; $("#step1").hidden = false; $("#emailIn").focus(); });

$("#joinBtn").addEventListener("click", async () => {
  const email = $("#emailIn").value.trim();
  const pw = $("#pwIn").value;
  if (!pw) { msg(tr("door.needPw")); return; }
  joinHold = true;
  try {
    const a = await layerFast();
    const cred = await a.signInEmail(email, pw, "");
    if (cred && cred.createdAccount) {
      msg(tr("door.madeAccount"));
      await new Promise((r) => setTimeout(r, 2200));
    }
    joinHold = false;
    sessionStorage.setItem("caresits-tour", "1");
    location.href = "index.html";
  } catch (e) {
    joinHold = false;
    const noNet = e && (e.code === "auth/network-request-failed" || e.code === "auth/timeout");
    msg(tr(noNet ? "door.noNet" : "door.mismatch"));
  }
});
$("#googleBtn").addEventListener("click", async () => { msg(tr("door.working")); try { const a = await layerFast(); const cred = await a.signInGoogle(); if (cred && cred.user) walkIn(); } catch { msg(tr("door.doorFail")); } });
$("#appleBtn").addEventListener("click", async () => { msg(tr("door.working")); try { const a = await layerFast(); const cred = await a.signInApple(); if (cred && cred.user) walkIn(); } catch { msg(tr("door.doorFail")); } });
$("#forgotBtn").addEventListener("click", async () => {
  const email = $("#emailIn").value.trim();
  if (!email) { msg(tr("door.forgotNeed")); return; }
  try {
    const appMod = await import("../accounts/sdk/firebase-app.js");
    const authMod = await import("../accounts/sdk/firebase-auth.js");
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(firebaseConfig);
    await authMod.sendPasswordResetEmail(authMod.getAuth(app), email);
    msg(tr("door.resetSent"));
  } catch { msg(tr("door.resetFail")); }
});
$("#demoBtn").addEventListener("click", () => {
  try { sessionStorage.removeItem(ENTRY_ROLE_SESSION_KEY); } catch { /* session storage off */ }
  // The demo entry is deliberate: it carries the session marker
  // the shell's signed out gate exempts (browsing was never gated).
  try { sessionStorage.setItem("caresits-demo", "1"); } catch { /* storage off */ }
  location.href = "index.html";
});
