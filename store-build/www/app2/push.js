// Caresitters app2 push notifications (Security PASS,
// 17 Oct 2026, fences as construction requirements).
// Pure planners shape every device write first. The browser
// seam talks to the Capacitor PushNotifications plugin when
// the native shell provides it, and stands quiet when it does
// not: the web build shows no push controls that cannot work.
//
// The fences this file is built under:
//   - Device docs live at profiles/{uid}/devices/{deviceId},
//     the owner's alone (the rules fold fences them so).
//   - The token follows the session, not the device: sign out
//     stamps this device inactive before the session ends.
//   - Settings switches exist only when the seam is live, and
//     the device doc is the contract the sender checks at
//     send time.
//   - Nothing here ever sends a push. Sending is the server
//     worker's job (push-sender/), never the client's.
import { t as tr } from "./lang.js";

export const PUSH_KINDS = ["message", "reminder"];
export const PUSH_PLATFORMS = ["ios", "android", "web"];
export const DEVICE_STORAGE_KEY = "caresits-app2-device";

const winOf = () => (typeof window !== "undefined" ? window : globalThis);
const write = (kind, payload) => {
  const w = winOf();
  if (typeof w.CARESITS_WRITE === "function") w.CARESITS_WRITE(kind, payload);
};

// ---------- Pure planners ----------

export function devicePath(uid, deviceId) {
  if (!uid || !deviceId) return null;
  return `profiles/${uid}/devices/${deviceId}`;
}

function cleanKinds(kinds) {
  const out = { message: true, reminder: true };
  if (kinds && typeof kinds === "object") {
    for (const k of PUSH_KINDS) if (typeof kinds[k] === "boolean") out[k] = kinds[k];
  }
  return out;
}

// Register and refresh are the same plan: the same doc is
// rewritten in place, the first createdAt stands, and the
// member's own kind switches survive a token refresh.
export function planDeviceRegister(input) {
  const { uid, deviceId, token, platform, existing, nowIso } = input || {};
  if (!uid || !deviceId) return { ok: false, reason: "missing-device" };
  if (!token || typeof token !== "string") return { ok: false, reason: "missing-token" };
  if (!PUSH_PLATFORMS.includes(platform)) return { ok: false, reason: "bad-platform" };
  return {
    ok: true,
    path: devicePath(uid, deviceId),
    data: {
      token,
      platform,
      active: true,
      kinds: cleanKinds(existing && existing.kinds),
      createdAt: (existing && existing.createdAt) || nowIso,
      lastSeenAt: nowIso,
      updatedAt: nowIso,
    },
  };
}

// Sign out hygiene (Security fence 2): the stamp lands while
// the session is still alive, so a signed out device can
// never receive the previous account's pushes.
export function planDeviceDeactivate(input) {
  const { uid, deviceId, nowIso } = input || {};
  if (!uid || !deviceId) return { ok: false, reason: "missing-device" };
  return { ok: true, path: devicePath(uid, deviceId), patch: { active: false, updatedAt: nowIso } };
}

export function planKindToggle(input) {
  const { uid, deviceId, kind, on, current, nowIso } = input || {};
  if (!uid || !deviceId) return { ok: false, reason: "missing-device" };
  if (!PUSH_KINDS.includes(kind)) return { ok: false, reason: "bad-kind" };
  const kinds = cleanKinds(current);
  kinds[kind] = !!on;
  return { ok: true, path: devicePath(uid, deviceId), data: { kinds, updatedAt: nowIso } };
}

// ---------- This install's device id (stable per install) ----------

export function storedDeviceId() {
  try {
    const raw = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (raw) { const parsed = JSON.parse(raw); if (parsed && parsed.deviceId) return parsed.deviceId; }
  } catch { /* storage may be closed */ }
  return null;
}

export function deviceIdForInstall() {
  const existing = storedDeviceId();
  if (existing) return existing;
  let id = "";
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") id = crypto.randomUUID();
  } catch { /* fall through to the hand rolled id */ }
  if (!id) id = "dev-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
  try { localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify({ deviceId: id })); } catch { /* the id still serves this session */ }
  return id;
}

// ---------- The native seam ----------

// Module state for this install only: what the Settings
// switches show is this device's own doc, nothing wider.
const state = { token: null, deviceId: null, registered: false, kinds: { message: true, reminder: true } };

export function pushPlugin() {
  const w = winOf();
  const cap = w.Capacitor;
  if (!cap || !cap.Plugins || !cap.Plugins.PushNotifications) return null;
  return cap.Plugins.PushNotifications;
}

export function pushAvailable() {
  return !!pushPlugin();
}

export function getPushState() {
  return { available: pushAvailable(), registered: state.registered, kinds: { ...state.kinds }, deviceId: state.deviceId };
}

function platformOf() {
  const w = winOf();
  const p = w.Capacitor && typeof w.Capacitor.getPlatform === "function" ? w.Capacitor.getPlatform() : "web";
  return PUSH_PLATFORMS.includes(p) ? p : "web";
}

async function sendRegistration(token) {
  const w = winOf();
  const uid = w.CARESITS_ME && w.CARESITS_ME.uid;
  state.token = token;
  state.deviceId = deviceIdForInstall();
  if (!uid) return { state: "waiting-signin", deviceId: state.deviceId };
  const plan = planDeviceRegister({
    uid, deviceId: state.deviceId, token, platform: platformOf(),
    existing: { kinds: state.kinds }, nowIso: new Date().toISOString(),
  });
  if (!plan.ok) return { state: "error", reason: plan.reason };
  write("device", { path: plan.path, data: plan.data });
  state.registered = true;
  return { state: "registered", deviceId: state.deviceId };
}

// window.CARESITS_PUSH_REGISTER: asks the OS, registers with
// the push service, and writes this device's doc through the
// live bridge. Without the plugin it answers "unavailable"
// and the app stands quiet. A refused OS permission is
// respected silently (Security fence 6, layer one).
export async function registerPush() {
  const plugin = pushPlugin();
  if (!plugin) return { state: "unavailable" };
  try {
    let perm = await plugin.checkPermissions();
    if (perm && perm.receive === "prompt") perm = await plugin.requestPermissions();
    if (!perm || perm.receive !== "granted") return { state: "denied" };
    const got = await new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      plugin.addListener("registration", (t) => finish({ token: t && t.value }));
      plugin.addListener("registrationError", () => finish({ error: true }));
      Promise.resolve(plugin.register()).catch(() => finish({ error: true }));
      setTimeout(() => finish({ timeout: true }), 15000);
    });
    if (!got.token) return { state: "error" };
    return sendRegistration(got.token);
  } catch {
    return { state: "error" };
  }
}

// Quiet boot: only when the OS already granted permission on
// an earlier visit. Boot never prompts.
export async function bootPush() {
  const plugin = pushPlugin();
  if (!plugin) return { state: "unavailable" };
  try {
    const perm = await plugin.checkPermissions();
    if (!perm || perm.receive !== "granted") return { state: "not-granted" };
    return registerPush();
  } catch {
    return { state: "error" };
  }
}

export async function togglePushKind(kind, on) {
  const w = winOf();
  const uid = w.CARESITS_ME && w.CARESITS_ME.uid;
  const deviceId = state.deviceId || storedDeviceId();
  state.kinds = cleanKinds({ ...state.kinds, [kind]: !!on });
  if (!uid || !deviceId) return { ok: false, reason: "not-registered" };
  const plan = planKindToggle({ uid, deviceId, kind, on, current: state.kinds, nowIso: new Date().toISOString() });
  if (!plan.ok) return plan;
  write("device", { path: plan.path, data: plan.data });
  return { ok: true, kinds: { ...state.kinds } };
}

// Called by the account layer before sign out completes,
// while this session's writes are still allowed. Fail soft:
// hygiene never blocks a sign out.
export async function deactivateThisDevice() {
  try {
    const w = winOf();
    const uid = w.CARESITS_ME && w.CARESITS_ME.uid;
    const deviceId = state.deviceId || storedDeviceId();
    state.registered = false;
    if (!uid || !deviceId) return { ok: false, reason: "nothing-to-stamp" };
    const plan = planDeviceDeactivate({ uid, deviceId, nowIso: new Date().toISOString() });
    if (!plan.ok) return plan;
    write("device-off", { deviceId, patch: plan.patch });
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

if (typeof window !== "undefined") {
  window.CARESITS_PUSH_REGISTER = registerPush;
  window.CARESITS_PUSH_DEACTIVATE = deactivateThisDevice;
  window.CARESITS_PUSH_STATE = getPushState;
  // Labels the Settings card reads (kept beside the seam so
  // the wording rides the language layer like every surface).
  window.CARESITS_PUSH_LABELS = () => ({
    title: tr("push.title"), body: tr("push.body"),
    message: tr("push.messages"), reminder: tr("push.reminders"), note: tr("push.note"),
  });
  bootPush().catch(() => {});
}
