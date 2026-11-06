/** "Just now", "5 min ago", "Today 3:05 pm"-style short ages. No expiry: old matches stay, they just say "7 days ago". */
export function ageLabel(ms: number, now: number = Date.now()): string {
  if (!ms) return "";
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  const d = Math.floor(hr / 24);
  if (d < 14) return d === 1 ? "1 day ago" : `${d} days ago`;
  const w = Math.floor(d / 7);
  if (d < 60) return `${w} weeks ago`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `${mo} months ago` : mo < 24 ? "1 year ago" : `${Math.floor(mo / 12)} years ago`;
}
export const PAGE = 20;
export function pageSlice<T>(rows: T[], shown: number): { items: T[]; more: number } {
  return { items: rows.slice(0, shown), more: Math.max(0, rows.length - shown) };
}
