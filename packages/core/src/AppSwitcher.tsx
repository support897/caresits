import { APP1, APP2, type AppId } from "./brand";
import { t } from "./i18n"; import { Bunny } from "./Bunny";

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
  try { window.location.assign(url); } catch { window.open(STORE[target], "_blank", "noopener"); return; }
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!handedOff && document.visibilityState === "visible") window.open(STORE[target], "_blank", "noopener");
  }, 1300);
}

export function AppMark({ app, size = 30 }: { app: AppId; size?: number }) {
  return <img src={`/brand/icon-${app}.png`} width={size} height={size} alt="" aria-hidden="true" style={{ borderRadius: Math.round(size * 0.22), display: "block" }} />;
}

/** The app name in the fun title font: two calm colour halves and one yellow dot. Never yellow text. */
export function Wordmark({ app, size = 26 }: { app: AppId; size?: number }) {
  const name = NAME[app].toLowerCase();
  const cut = app === "caresitters" ? 4 : 5;
  return <span className="wordmark" style={{ fontSize: size }} aria-label={NAME[app]}>
    <span aria-hidden="true" style={{ color: "var(--pink-deep)" }}>{name.slice(0, cut)}</span>
    <span aria-hidden="true" style={{ color: "var(--sky-deep)" }}>{name.slice(cut)}</span>
    <i className="wm-dot" aria-hidden="true" />
  </span>;
}

/** Slim top bar: this app's fun name on the left, only the other app's icon on the right (like Messenger inside Facebook). */
export function AppTopBar({ current }: { current: AppId }) {
  const other: AppId = current === "caresitters" ? "carespace" : "caresitters";
  return <header className="topbar">
    {current === "caresitters" ? <Bunny mood="hello" size={44} /> : <Wordmark app={current} />}
    <button type="button" className="topbar-switch" onClick={() => openSisterApp(other)} aria-label={t("switch.open", "Open {app}", { app: NAME[other] })}>
      <AppMark app={other} size={36} /><span className="topbar-label">{NAME[other]}</span>
    </button>
  </header>;
}
