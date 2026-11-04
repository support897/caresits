import { useState, type FormEvent } from "react";
import { Bunny, t, useAuth } from "@cc/core";
import { joinCareSpaceWithInvite, parseJoinInput } from "../../data/invites";
import "./profile.css";

export type JoinWithCodeProps = {
  onJoined?: (spaceId: string) => void;
  onCancel?: () => void;
};

function errorMessage(error: unknown): string {
  const reason = error instanceof Error ? error.message : "";
  const messages: Record<string, [string, string]> = {
    "invite-invalid": ["csJoin.invalid", "Enter the full join code or invite link."],
    "invite-not-found": ["csJoin.notFound", "This invite was not found. Ask the parent to send a new one."],
    "invite-expired": ["csJoin.expired", "This invite has expired. Ask the parent for a new one."],
    "invite-used": ["csJoin.used", "This invite has already been used."],
    "invite-own-space": ["csJoin.ownInvite", "You cannot join a space you created."],
    "already-a-member": ["csJoin.alreadyMember", "You already belong to this care space."],
  };
  const [key, english] = messages[reason] ?? ["csJoin.failed", "Could not join this care space. Check the code and your connection."];
  return t(key, english);
}

export function JoinWithCode({ onJoined, onCancel }: JoinWithCodeProps) {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.uid || busy) return;
    setError(""); setJoined("");
    const target = parseJoinInput(input);
    if (!target) { setError(errorMessage(new Error("invite-invalid"))); return; }
    setBusy(true);
    try {
      const result = await joinCareSpaceWithInvite(target, user.uid, user.displayName ?? "");
      setJoined(result.spaceName);
      onJoined?.(target.spaceId);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  return <section className="profile-card" aria-labelledby="join-with-code-title">
    <div className="profile-card-head"><h2 id="join-with-code-title">{t("csJoin.title", "Join with code")}</h2><Bunny mood="point" size={64} /></div>
    <p className="muted">{t("csJoin.help", "Paste the full code or invite link from the parent. The code includes the space and invite key.")}</p>
    <form onSubmit={(event) => void submit(event)}>
      <label className="profile-field"><span>{t("csJoin.codeLabel", "Invite code or link")}</span><input className="field" autoComplete="off" value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} required /></label>
      {error && <p className="profile-notice" role="alert">{error}</p>}
      {joined && <p className="profile-notice" role="status">{t("csJoin.success", "You joined {space}.", { space: joined })}</p>}
      <div className="profile-inline" style={{ marginTop: 10 }}>
        <button type="submit" className="btn" disabled={!user?.uid || busy}>{busy ? t("csJoin.working", "Joining…") : t("csJoin.submit", "Join care space")}</button>
        {onCancel && <button type="button" className="btn alt" onClick={onCancel}>{t("csJoin.cancel", "Cancel")}</button>}
      </div>
    </form>
  </section>;
}

export default JoinWithCode;
