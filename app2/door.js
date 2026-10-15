// Caresits app2 — door v4 (founder approved shape, 15 Oct 2026).
// The first page holds ONLY the sign up, big and centred:
// the big heart mark, the icon doors, one email field and
// the round next arrow. The password lives on step two.
// Signing in lands inside the app, where the bunny tour
// waits. The demo door stays its own quiet entry.
import { firebaseConfig } from "./firebase-config.js";

const $ = (s) => document.querySelector(s);
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
  if (!email || !email.includes("@")) { msg("That email looks unfinished. One more look?"); return; }
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
  if (!pw) { msg("Add your password, then tap Join."); return; }
  try {
    const a = await layer();
    await a.signInEmail(email, pw, "");
  } catch {
    msg("Email or password did not match. Have another go, or use Forgot below.");
  }
});
$("#googleBtn").addEventListener("click", async () => { try { const a = await layer(); await a.signInGoogle(); } catch { msg("That door did not open. Try the email way below."); } });
$("#appleBtn").addEventListener("click", async () => { try { const a = await layer(); await a.signInApple(); } catch { msg("That door did not open. Try the email way below."); } });
$("#forgotBtn").addEventListener("click", async () => {
  const email = $("#emailIn").value.trim();
  if (!email) { msg("Add your email above first, then tap Forgot."); return; }
  try {
    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const authMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(firebaseConfig);
    await authMod.sendPasswordResetEmail(authMod.getAuth(app), email);
    msg("A reset link is on its way to your email.");
  } catch { msg("We could not send that just now. Try again in a moment."); }
});
$("#demoBtn").addEventListener("click", () => { location.href = "index.html"; });
