// Caresitters app2 — the files road (gatekeeper client).
// Design of record: next-phase/FILES-SERVER-DESIGN.md.
// Files live in the private bucket under the gatekeeper;
// this module is the app's only way to them:
//
//   upload  photo.js's CARESITS_UPLOAD seam: ask the
//           gatekeeper for a signed PUT door (the caller's
//           Firebase ID token rides along), send the
//           bytes, then confirm; the gatekeeper verifies
//           size and magic from the bucket itself. The
//           stored reference is the internal path
//           (profile-photos/<uid>/<name>), never a URL.
//   read    readers ask for a short lived GET door at
//           render and swap the img src when it lands.
//   delete  photo.js's CARESITS_DELETE_FILE seam: a
//           signed DELETE door; the object itself goes.
//
// The base is the design host, files.caresits.xyz. A
// window.CARESITS_FILES_BASE override exists for the
// test twin drives only. When the road is not up yet,
// every call fails soft exactly as photo.js already
// expects: uploads answer not-ok and readers keep their
// placeholder.

const SDK = "../accounts/sdk";
const DEFAULT_BASE = "https://files.caresits.xyz";

export function filesBase() {
  try {
    if (typeof window !== "undefined" && typeof window.CARESITS_FILES_BASE === "string" && window.CARESITS_FILES_BASE) {
      return window.CARESITS_FILES_BASE.replace(/\/$/, "");
    }
  } catch { /* fall through to the design host */ }
  return DEFAULT_BASE;
}

// Two shapes name the same object:
//   the photo.js planner path  profile-photos/<uid>/<name>
//   the gatekeeper key         <uid>/profile-photos/<name>
// The KEY is the stored reference: the gatekeeper only
// ever serves a GET for a key the owner's profile slot
// names exactly (Q6 iii), so uploadFile answers the key
// and profiles carry it. Anything else (an http URL, a
// data URL) is not a bucket reference and rides through
// untouched.
export function parseFilePath(path) {
  if (typeof path !== "string") return null;
  let m = path.match(/^(profile-photos|certificates|day-story)\/([^/]+)\/([^/]+)$/);
  if (m) return { cls: m[1], ownerUid: m[2], name: m[3] };
  m = path.match(/^([^/]+)\/(profile-photos|certificates|day-story)\/([^/]+)$/);
  if (m) return { cls: m[2], ownerUid: m[1], name: m[3] };
  return null;
}

export function keyFor(parsed) {
  return `${parsed.ownerUid}/${parsed.cls}/${parsed.name}`;
}

export function isFilePath(value) {
  return parseFilePath(value) !== null;
}

async function idToken() {
  const cfgMod = await import("./firebase-config.js");
  const appMod = await import(`${SDK}/firebase-app.js`);
  const authMod = await import(`${SDK}/firebase-auth.js`);
  const existing = typeof appMod.getApps === "function"
    ? appMod.getApps().find((a) => a.name === "[DEFAULT]")
    : null;
  const app = existing || appMod.initializeApp(cfgMod.firebaseConfig);
  const auth = authMod.getAuth(app);
  const user = auth.currentUser;
  if (!user) throw new Error("signed-out");
  return user.getIdToken();
}

async function callGatekeeper(route, body) {
  const token = await idToken();
  const res = await fetch(`${filesBase()}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => null);
  if (!res.ok || !out) throw new Error(`gatekeeper ${res.status}${out && out.error ? " " + out.error : ""}`);
  return out;
}

// uploadFile(path, blob) -> the stored reference (the
// gatekeeper key) once the gatekeeper confirms it.
export async function uploadFile(path, blob) {
  const parsed = parseFilePath(path);
  if (!parsed || !blob) throw new Error("bad-file");
  const door = await callGatekeeper("/v1/link", { op: "put", class: parsed.cls, name: parsed.name, bytes: blob.size, ownerUid: parsed.ownerUid });
  const put = await fetch(door.url, { method: "PUT", headers: door.headers, body: blob });
  if (!put.ok) throw new Error(`upload ${put.status}`);
  await callGatekeeper("/v1/confirm", { class: parsed.cls, name: parsed.name, ownerUid: parsed.ownerUid });
  return keyFor(parsed);
}

export async function deleteFile(path) {
  const parsed = parseFilePath(path);
  if (!parsed) throw new Error("bad-file");
  const door = await callGatekeeper("/v1/link", { op: "del", class: parsed.cls, name: parsed.name, ownerUid: parsed.ownerUid });
  const res = await fetch(door.url, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`delete ${res.status}`);
}

// resolveFileSrc(value) -> a displayable src. Plain
// values (URLs, data URLs) pass through; a stored
// reference trades for a short lived GET door. A failed
// trade answers "" so the placeholder stands.
export async function resolveFileSrc(value) {
  const parsed = parseFilePath(value);
  if (!parsed) return typeof value === "string" ? value : "";
  try {
    const door = await callGatekeeper("/v1/link", { op: "get", class: parsed.cls, name: parsed.name, ownerUid: parsed.ownerUid });
    return door.url || "";
  } catch {
    return "";
  }
}

// paintFileImg(img, value): the readers' one move. A
// plain value paints at once; a stored reference paints
// when its GET door lands, and only if the img still
// wants that same reference.
export function paintFileImg(img, value) {
  if (!img || !value) return;
  if (!isFilePath(value)) { img.src = value; return; }
  img.dataset.fileRef = value;
  resolveFileSrc(value).then((src) => {
    if (src && img.dataset.fileRef === value && img.isConnected) img.src = src;
  }).catch(() => { /* the placeholder stands */ });
}

// installFileRoads(): live.js calls this at boot so
// photo.js's seams ride the gatekeeper instead of the
// Firebase Storage SDK (production has no bucket, F13).
export function installFileRoads() {
  if (typeof window === "undefined") return;
  window.CARESITS_UPLOAD = (path, blob) => uploadFile(path, blob);
  window.CARESITS_DELETE_FILE = (path) => deleteFile(path);
}
