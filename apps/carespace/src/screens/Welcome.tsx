import "../lib/i18n";
import { useState } from "react";
import { APP2, Bunny, Button, t, type ScreenProps, useNav } from "@cc/core";
import { createCareSpace } from "../data/spaces";

type WelcomeParams = { uid?: string; name?: string; onDone?: () => void };

export default function Screen({ params }: ScreenProps<WelcomeParams>) {
  const nav = useNav();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function startSpace() {
    if (!params.uid || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await createCareSpace(params.uid, params.name ?? "");
      params.onDone?.();
      nav.push(result.created ? "invite" : "space", { spaceId: result.spaceId });
    } catch {
      setNotice(t("cs.welcome.create.error", "Your Care Space could not start. Check your connection and try again."));
    } finally { setBusy(false); }
  }

  function skip() {
    params.onDone?.();
    if (!params.onDone) nav.back();
  }

  return <div className="app">
    <main className="scroll" style={{ display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 520, width: "100%", alignSelf: "center" }}>
      <div className="card center" style={{ padding: 24 }}>
        <Bunny mood="hello" size={132} caption={t("cs.welcome.hello", "Hello")}/>
        <p className="muted" style={{ margin: "10px 0 4px" }}>{APP2}</p>
        <h1 style={{ fontSize: 32 }}>{t("cs.welcome.title", "Your care day, together")}</h1>
        <p style={{ margin: "16px 0 24px" }}>{t("cs.welcome.dayOne", "Invite your nanny, grandparent or au pair. No marketplace account needed.")}</p>
        {notice && <p role="alert" style={{ color: "var(--danger)" }}>{notice}</p>}
        <Button onClick={() => void startSpace()} disabled={busy || !params.uid}>{busy ? t("cs.welcome.starting", "Starting your space…") : t("cs.welcome.start", "Set up my Care Space")}</Button>
        <Button alt onClick={skip} style={{ marginTop: 10 }}>{t("cs.welcome.later", "I’ll do this later")}</Button>
      </div>
    </main>
  </div>;
}
