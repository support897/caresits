import { APP1, APP2, type AppId } from "./brand";
import { t } from "./i18n";

const STORE: Record<AppId, string> = {
  caresitters: "https://apps.apple.com/au/app/id6823577907",
  carespace: "https://apps.apple.com/au/app/id6830173345",
};
const SCHEME: Record<AppId, string> = { caresitters: "caresitters://open", carespace: "carespace://open" };
const NAME: Record<AppId, string> = { caresitters: APP1, carespace: APP2 };

/** Opens the sister app. Tries the app's own link first, then falls back to its App Store page. */
export function openSisterApp(target: AppId, path = ""): void {
  if (typeof window === "undefined") return;
  const url = `${SCHEME[target]}${path ? `/${path.replace(/^\/+/, "")}` : ""}`;
  const hook = (window as unknown as { __ccOpenHook?: (u: string) => void }).__ccOpenHook;
  if (hook) { hook(url); return; }
  let handedOff = false;
  const onHide = () => { if (document.visibilityState === "hidden") handedOff = true; };
  document.addEventListener("visibilitychange", onHide);
  try { window.location.assign(url); } catch { window.location.assign(STORE[target]); return; }
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!handedOff && document.visibilityState === "visible") window.location.assign(STORE[target]);
  }, 1300);
}

export function AppMark({ app, size = 30 }: { app: AppId; size?: number }) {
  return app === "caresitters"
    ? <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#F4A9BC" /><path fill="#fff" d="M16 25.5C9 20.8 6.5 17 6.5 13.4c0-2.8 2.1-4.9 4.8-4.9 1.9 0 3.7 1 4.7 2.7 1-1.7 2.8-2.7 4.7-2.7 2.7 0 4.8 2.1 4.8 4.9 0 3.6-2.5 7.4-9.5 12.1z" /></svg>
    : <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#FFD966" /><path fill="#fff" d="M5.5 16 16 6.5 26.5 16v9.5h-21z" /><path fill="#F4A9BC" d="M16 23.2c-3.6-2.4-4.9-4.3-4.9-6.1 0-1.4 1.1-2.5 2.4-2.5 1 0 1.9.5 2.5 1.4.6-.9 1.5-1.4 2.5-1.4 1.3 0 2.4 1.1 2.4 2.5 0 1.8-1.3 3.7-4.9 6.1z" /></svg>;
}

/** Slim top bar: this app's name on the left, a button to jump to the other app on the right (like Messenger inside Facebook). */
export function AppTopBar({ current }: { current: AppId }) {
  const other: AppId = current === "caresitters" ? "carespace" : "caresitters";
  const name = NAME[other];
  return <header className="topbar">
    <span className="topbar-brand"><AppMark app={current} size={26} /><span>{NAME[current]}</span></span>
    <button type="button" className="topbar-switch" onClick={() => openSisterApp(other)} aria-label={t("switch.open", "Open {app}", { app: name })}>
      <AppMark app={other} size={28} /><span>{name}</span>
    </button>
  </header>;
}
