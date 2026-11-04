import { useState, type FormEvent } from "react";
import { useNav, BackBar, t, type ScreenProps, useAuth } from "@cc/core";
import { joinCareSpaceWithInvite, parseJoinInput } from "../data/invites";
import { JoinWithCode } from "./profile/JoinWithCode";

type JoinParams = { initialInput?: string; onDone?: () => void };

export default function Screen({ params }: ScreenProps<JoinParams>) {
  const nav = useNav();
  if (!params.initialInput) return <div className="scroll"><BackBar title={t("cs.join.title", "Join with code")} onBack={() => nav.back()} />
    <JoinWithCode onJoined={(spaceId) => nav.push("space", { spaceId })} onCancel={() => nav.back()} /></div>;
  return <LinkedInvite params={params} />;
}

function LinkedInvite({ params }: { params: JoinParams }) {
  const nav = useNav();
  const { user } = useAuth();
  const [input, setInput] = useState(params.initialInput ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.uid || busy) return;
    const target = parseJoinInput(input);
    if (!target) { setError(t("csJoin.invalid", "Enter the full join code or invite link.")); return; }
    setBusy(true);
    setError("");
    try {
      await joinCareSpaceWithInvite(target, user.uid, user.displayName ?? "");
      params.onDone?.();
      nav.push("space", { spaceId: target.spaceId });
    } catch {
      setError(t("csJoin.failed", "Could not join this care space. Check the invite and your connection."));
    } finally { setBusy(false); }
  }

  return <div className="app">
    <BackBar title={t("cs.join.title", "Join with code")} onBack={nav.back} />
    <div className="scroll"><section className="profile-card" aria-labelledby="join-link-title">
      <h2 id="join-link-title">{t("csJoin.title", "Join with code")}</h2>
      <p className="muted">{t("csJoin.help", "Paste the full code or invite link from the parent. The code includes the space and invite key.")}</p>
      <form onSubmit={(event) => void submit(event)}>
        <label className="profile-field"><span>{t("csJoin.codeLabel", "Invite code or link")}</span>
          <input className="field" autoComplete="off" value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} required />
        </label>
        {error && <p className="profile-notice" role="alert">{error}</p>}
        <div className="profile-inline" style={{ marginTop: 10 }}>
          <button type="submit" className="btn" disabled={!user?.uid || busy}>{busy ? t("csJoin.working", "Joining…") : t("csJoin.submit", "Join care space")}</button>
          <button type="button" className="btn alt" onClick={nav.back}>{t("csJoin.cancel", "Cancel")}</button>
        </div>
      </form>
    </section></div>
  </div>;
}
