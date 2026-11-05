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
    ? <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
  <defs><linearGradient id="ccg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFC9D6"/><stop offset="1" stopColor="#F4A9BC"/></linearGradient></defs>
  <rect width="1024" height="1024" rx="230" fill="url(#ccg1)"/>
  <circle cx="190" cy="190" r="26" fill="#FFD966"/><circle cx="850" cy="215" r="18" fill="#A9D4F5"/><circle cx="880" cy="820" r="24" fill="#FFD966"/><circle cx="150" cy="780" r="16" fill="#A9D4F5"/>
  <path fill="#fff" d="M512 860C285 700 182 566 182 413c0-120 85-205 197-205 64 0 108 30 133 82 25-52 69-82 133-82 112 0 197 85 197 205 0 153-103 287-330 447Z"/>
<g transform="translate(512 470) scale(.84) translate(-512 -600)">
  <ellipse cx="370" cy="765" rx="150" ry="95" fill="#8EC5E8"/><ellipse cx="650" cy="790" rx="105" ry="70" fill="#FFD966"/>
  <circle cx="385" cy="520" r="128" fill="#8EC5E8"/>
  <path d="M262 500c4-86 64-140 130-140 62 0 118 38 130 100-52-8-112-30-150-76-26 52-66 100-110 116Z" fill="#6FB1DE"/>
  <g transform="rotate(-10 590 400)"><ellipse cx="585" cy="385" rx="34" ry="104" fill="#F4A9BC"/><ellipse cx="585" cy="390" rx="16" ry="74" fill="#FFE1E9"/></g>
  <g transform="rotate(12 700 400)"><ellipse cx="700" cy="390" rx="34" ry="100" fill="#F4A9BC"/><ellipse cx="700" cy="395" rx="16" ry="70" fill="#FFE1E9"/></g>
  <circle cx="645" cy="565" r="100" fill="#FFD966"/>
  <g fill="#3B2A33"><circle cx="350" cy="540" r="13"/><circle cx="420" cy="540" r="13"/><circle cx="615" cy="575" r="11"/><circle cx="676" cy="575" r="11"/></g>
  <path d="M355 585q30 30 62 0" stroke="#3B2A33" strokeWidth="12" fill="none" strokeLinecap="round"/><path d="M622 612q23 22 46 0" stroke="#3B2A33" strokeWidth="10" fill="none" strokeLinecap="round"/>
  <circle cx="318" cy="580" r="18" fill="#F4A9BC" opacity=".7"/><circle cx="452" cy="580" r="18" fill="#F4A9BC" opacity=".7"/>
</g>
</svg>
    : <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
  <defs><linearGradient id="ccg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#CBE6FA"/><stop offset="1" stopColor="#8EC5E8"/></linearGradient></defs>
  <rect width="1024" height="1024" rx="230" fill="url(#ccg2)"/>
  <circle cx="200" cy="200" r="26" fill="#FFD966"/><circle cx="840" cy="190" r="18" fill="#FFC9D6"/><circle cx="870" cy="830" r="24" fill="#FFD966"/><circle cx="160" cy="790" r="16" fill="#FFC9D6"/>
  <path fill="#fff" d="M512 190 150 500v310c0 28 22 50 50 50h624c28 0 50-22 50-50V500Z"/>
  <path fill="#FFD966" d="M512 190 110 520c-14 12-16 32-4 46 12 14 32 16 46 4L512 270l360 300c14 12 34 10 46-4 12-14 10-34-4-46Z"/>
  <path fill="#F4A9BC" d="M512 770C390 690 335 625 335 555c0-58 42-100 96-100 36 0 64 19 81 51 17-32 45-51 81-51 54 0 96 42 96 100 0 70-55 135-177 215Z"/>
  <rect x="440" y="800" width="144" height="60" rx="14" fill="#8EC5E8" opacity="0"/>
</svg>;
}

/** The app name in the fun title font, letters in pink and blue with a little bounce. Never yellow text. */
export function Wordmark({ app, size = 26 }: { app: AppId; size?: number }) {
  const name = NAME[app];
  const colors = ["var(--pink-deep)", "var(--sky-deep)"];
  return <span className="wordmark" style={{ fontSize: size }} aria-label={name}>
    {[...name.toLowerCase()].map((ch, i) => <span key={i} aria-hidden="true" style={{ color: colors[i % 2], transform: `translateY(${[0, -2, 1, -1][i % 4]}px) rotate(${[-4, 3, -2, 4][i % 4]}deg)` }}>{ch}</span>)}
  </span>;
}

/** Slim top bar: this app's fun name on the left, only the other app's icon on the right (like Messenger inside Facebook). */
export function AppTopBar({ current }: { current: AppId }) {
  const other: AppId = current === "caresitters" ? "carespace" : "caresitters";
  return <header className="topbar">
    <Wordmark app={current} />
    <button type="button" className="topbar-switch" onClick={() => openSisterApp(other)} aria-label={t("switch.open", "Open {app}", { app: NAME[other] })}>
      <AppMark app={other} size={36} />
    </button>
  </header>;
}
