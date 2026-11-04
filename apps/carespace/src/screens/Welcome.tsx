import "../lib/i18n";
import { APP2, Bunny, Button, t, type ScreenProps, useNav } from "@cc/core";

type WelcomeParams = { onDone?: () => void };

export default function Screen({ params }: ScreenProps<WelcomeParams>) {
  const nav = useNav();
  return <div className="app">
    <main className="scroll" style={{ display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 520, width: "100%", alignSelf: "center" }}>
      <div className="card center" style={{ padding: 24 }}>
        <Bunny mood="hello" size={132} caption={t("cs.welcome.hello", "Hello")}/>
        <p className="muted" style={{ margin: "10px 0 4px" }}>{APP2}</p>
        <h1 style={{ fontSize: 32 }}>{t("cs.welcome.title", "Your care day, together")}</h1>
        <p style={{ margin: "16px 0 24px" }}>{t("cs.welcome.dayOne", "Useful on day one: invite your own nanny, grandparent or au pair - no marketplace account needed")}</p>
        <Button onClick={() => params.onDone ? params.onDone() : nav.back()}>{t("cs.welcome.done", "Let’s begin")}</Button>
      </div>
    </main>
  </div>;
}
