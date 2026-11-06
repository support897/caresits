import { useState } from "react";
import { deleteMyAccountNow } from "./data/accountDelete";
import { t } from "./i18n";

export const PRIVACY_URL = "https://caresits.xyz/privacy.html";
export const TERMS_URL = "https://caresits.xyz/terms.html";
export const SUPPORT_EMAIL = "hello@caresits.xyz";

/** Privacy, terms, support and in-app account deletion. Shared by both apps (App Store guideline 5.1.1). */
export function LegalAndDelete() {
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  async function remove() {
    if (text.trim().toUpperCase() !== "DELETE" || busy) return; setBusy(true); setMsg("");
    const r = await deleteMyAccountNow(); setBusy(false);
    if (r.ok) setMsg(t("legal.deleted", "Your account and your data on this device were deleted."));
    else setMsg(r.reason === "sign-in-again" ? t("legal.signInAgain", "For your safety, sign out, sign in again, then delete straight away.") : t("legal.deleteFail", "Could not delete the account. Check your connection and try again."));
  }
  return <section className="card" aria-labelledby="legal-title" data-testid="legal-delete" style={{ display: "grid", gap: 10 }}>
    <h2 id="legal-title">{t("legal.title", "Privacy, terms and your account")}</h2>
    <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">{t("legal.privacy", "Privacy policy")}</a>
    <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">{t("legal.terms", "Terms of use")}</a>
    <a href={`mailto:${SUPPORT_EMAIL}`}>{t("legal.support", "Contact support")}</a>
    <label>{t("legal.confirm", "Type DELETE to permanently delete your account")}<input className="field" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="characters" aria-label={t("legal.confirmAria", "Type DELETE to confirm")} /></label>
    <button type="button" className="btn" disabled={busy || text.trim().toUpperCase() !== "DELETE"} onClick={() => void remove()} style={{ background: "var(--danger)", color: "#fff" }}>{busy ? t("legal.deleting", "Deleting") : t("legal.delete", "Delete my account")}</button>
    <p className="muted">{t("legal.note", "This removes your profile and private records and ends your sign-in. Messages in shared conversations stay with the other person.")}</p>
    {msg && <p role="status">{msg}</p>}
  </section>;
}
