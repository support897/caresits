import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bunny } from "../Bunny"; import { useAuth } from "../hooks"; import { signInGoogle, signInApple, signInEmail, sendReset } from "../auth"; import { t } from "../i18n"; import { spring } from "./index";
/** One sign-in for both apps: Google, Apple, email. Session is remembered on the phone (see session.ts). */
export function SignIn({ title, tagline }: { title: string; tagline: string }) {
  const { user } = useAuth(), reduced = useReducedMotion();
  const [e, setE] = useState(""), [p, setP] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false), [mail, setMail] = useState(false);
  const fail = (er: unknown) => { setBusy(false); const c = ((er as { code?: string })?.code ?? "") + ((er as Error)?.message ?? ""); setMsg(/cancel|1001|popup-closed/i.test(c) ? "" : /weak/.test(c) ? t("auth.weak", "Password needs 6+ characters.") : /invalid|wrong|not-found/.test(c) ? t("auth.bad", "Email or password is not right.") : /network|timeout/.test(c) ? t("auth.net", "No connection. Try again.") : t("auth.fail", "Could not sign in. Try again.")); };
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setMsg(""); try { await fn(); setBusy(false); } catch (x) { fail(x); } };
  if (user) return null; // never show sign-in to someone who is already in
  return <div className="scroll" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, textAlign: "center", minHeight: "100%" }}>
    <h1 style={{ margin: 0 }}><img src="/brand/lockup-tight.png" alt={title} style={{ width: "min(86vw, 340px)", height: "auto", display: "block", margin: "0 auto" }} /></h1><p className="muted" style={{ margin: "0 0 8px" }}>{tagline}</p>
    <button className="btn alt" disabled={busy} onClick={() => run(signInGoogle)}><b aria-hidden="true">G</b> {t("auth.google", "Continue with Google")}</button>
    <button className="btn apple" disabled={busy} onClick={() => run(signInApple)}>{t("auth.apple", "Continue with Apple")}</button>
    {!mail ? <button className="btn alt" disabled={busy} onClick={() => setMail(true)}>{t("auth.email", "Continue with email")}</button> : <>
      <input className="field" type="email" placeholder={t("auth.emailPh", "you@example.com")} aria-label={t("auth.emailLabel", "Email")} value={e} onChange={(x) => setE(x.target.value)} autoComplete="email" />
      <input className="field" type="password" placeholder={t("auth.pwPh", "Your password")} aria-label={t("auth.pwLabel", "Password")} value={p} onChange={(x) => setP(x.target.value)} autoComplete="current-password" />
      <button className="btn" disabled={busy || !e || !p} onClick={() => run(() => signInEmail(e.trim(), p))}>{busy ? t("auth.wait", "One moment…") : t("auth.continue", "Continue")}</button>
      <button className="chip" style={{ alignSelf: "center" }} onClick={async () => { if (!e.includes("@")) return setMsg(t("auth.typeEmail", "Type your email first.")); try { await sendReset(e.trim()); setMsg(t("auth.resetSent", "Check your email for a reset link.")); } catch { setMsg(t("auth.resetFail", "Could not send. Try again.")); } }}>{t("auth.forgot", "Forgot password?")}</button></>}
    <p role="alert" style={{ color: "var(--danger)", minHeight: 24, margin: 0 }}>{msg}</p><p className="muted" style={{ fontSize: 17, margin: 0 }}>{t("auth.stay", "You stay signed in on this phone until you sign out.")}</p></div>;
}
