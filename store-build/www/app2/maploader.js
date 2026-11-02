// Makes sure Leaflet is there. The app ships its own copy (maplib/leaflet);
// if that file is somehow missing from a build, fall back to the public copy.
let pending = null;
export function ensureLeaflet() {
  if (window.L) return Promise.resolve(true);
  if (pending) return pending;
  const load = (src) => new Promise((ok) => { const s = document.createElement("script"); s.src = src; s.onload = () => ok(!!window.L); s.onerror = () => ok(false); document.head.append(s); });
  pending = load("maplib/leaflet/leaflet.js").then((ok) => ok || load("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"));
  return pending;
}
