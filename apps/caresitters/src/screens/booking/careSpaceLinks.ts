import { APP2 } from "@cc/core";

export function careSpaceUrls(spaceId?: string) {
  const suffix = spaceId ? `?spaceId=${encodeURIComponent(spaceId)}` : "";
  const route = spaceId ? `/${encodeURIComponent(spaceId)}` : "";
  return {
    universal: `https://caresits.xyz/carespace${suffix}`,
    custom: `carespace://space${route}`,
    appStore: `https://apps.apple.com/au/search?term=${encodeURIComponent(APP2)}`,
  };
}

export function openCareSpace(spaceId?: string): void {
  const links = careSpaceUrls(spaceId);
  let opened = false;
  const markOpened = () => { if (document.visibilityState === "hidden") opened = true; };
  document.addEventListener("visibilitychange", markOpened);
  try { window.location.assign(links.custom); } catch { window.location.assign(links.appStore); return; }
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", markOpened);
    if (!opened && document.visibilityState === "visible") window.location.assign(links.appStore);
  }, 1100);
}
