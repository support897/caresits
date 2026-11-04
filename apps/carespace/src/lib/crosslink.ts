const CARESITTERS_ROUTE = "https://caresits.xyz/caresitters";
const CARESITTERS_APP_STORE = "https://apps.apple.com/au/app/id6823577907";
const FALLBACK_DELAY_MS = 1200;

function universalUrl(path: string): string {
  const target = new URL(CARESITTERS_ROUTE);
  const incoming = new URL(path.replace(/^\/+/, ""), "https://path.invalid/");
  const segments = incoming.pathname.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment));
  target.pathname = segments.length ? `${target.pathname}/${segments.join("/")}` : target.pathname;
  target.search = incoming.search;
  target.hash = incoming.hash;
  return target.toString();
}

export function openOtherApp(path: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let handedOff = false;
  let timer = 0;
  const cleanup = () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onHidden);
  };
  const onHidden = () => {
    if (document.visibilityState === "hidden") {
      handedOff = true;
      cleanup();
    }
  };

  document.addEventListener("visibilitychange", onHidden);
  try {
    window.location.assign(universalUrl(path));
  } catch {
    cleanup();
    window.location.assign(CARESITTERS_APP_STORE);
    return;
  }

  timer = window.setTimeout(() => {
    const shouldFallback = !handedOff && document.visibilityState !== "hidden";
    cleanup();
    if (shouldFallback) window.location.assign(CARESITTERS_APP_STORE);
  }, FALLBACK_DELAY_MS);
}
