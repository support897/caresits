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
const msg = (t) => { $("#doorMsg").textContent = t || ""; };
let accounts = null;

async function layer() {
  if (accounts) return accounts;
  accounts = await import("../accounts/account.js");
  await accounts.initAccounts(firebaseConfig, (u) => {
    if (u && !u.isAnonymous) {
      sessionStorage.setItem("caresits-tour", "1");
      location.href = "index.html";
    }
  });
  return accounts;
}
layer().catch(() => {});

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
  try {
    const a = await layer();
    await a.signInEmail(email, pw, "");
  } catch {
    msg(tr("door.mismatch"));
  }
});
$("#googleBtn").addEventListener("click", async () => { try { const a = await layer(); await a.signInGoogle(); } catch { msg(tr("door.doorFail")); } });
$("#appleBtn").addEventListener("click", async () => { try { const a = await layer(); await a.signInApple(); } catch { msg(tr("door.doorFail")); } });
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
$("#demoBtn").addEventListener("click", () => { location.href = "index.html"; });
