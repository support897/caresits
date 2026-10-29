// Caresitters app2 — the whole view mode (Ilse's ruling,
// 28 Oct 2026): the pure decision (mode.js), the live road
// it rides on this base (the router's mode case, and the
// boot's live pair judgement composed from the base's own
// seam gate), and the shell seam that applies it (the
// switch writes the account route, the boot decision
// lands, the nav set flips with the mode).
import assert from "node:assert/strict";
import { cleanMode, modeFromLegacyPosture, modeFromAppDoc, resolveBootMode } from "./mode.js";

Object.defineProperty(globalThis, "navigator", { value: { language: "en-AU" }, configurable: true });
globalThis.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); } };

let n = 0; const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };

// ---- the pure decision ----
t("cleanMode: only the two modes stand", () => {
  assert.equal(cleanMode("finding"), "finding");
  assert.equal(cleanMode("connected"), "connected");
  assert.equal(cleanMode("days"), null);
  assert.equal(cleanMode(""), null);
  assert.equal(cleanMode(null), null);
});
t("the legacy device posture maps: days meant the daily home", () => {
  assert.equal(modeFromLegacyPosture("days"), "connected");
  assert.equal(modeFromLegacyPosture("finding"), "finding");
  assert.equal(modeFromLegacyPosture("sideways"), null);
});
t("modeFromAppDoc: the account pick rides the meta/app doc", () => {
  assert.equal(modeFromAppDoc({ mode: "connected" }), "connected");
  assert.equal(modeFromAppDoc({ language: "es" }), null);
  assert.equal(modeFromAppDoc(null), null);
});
t("resolveBootMode: the account choice wins over everything", () => {
  assert.deepEqual(resolveBootMode({ accountMode: "finding", deviceMode: "connected", hasLivePair: true }), { mode: "finding", chosen: "finding" });
  assert.deepEqual(resolveBootMode({ accountMode: "connected", deviceMode: "finding", hasLivePair: false }), { mode: "connected", chosen: "connected" });
});
t("resolveBootMode: a past pick on this device stands next", () => {
  assert.deepEqual(resolveBootMode({ accountMode: null, deviceMode: "connected", hasLivePair: false }), { mode: "connected", chosen: "connected" });
});
t("resolveBootMode: never chosen means the standing default, Connected with a live pair", () => {
  assert.deepEqual(resolveBootMode({ accountMode: null, deviceMode: null, hasLivePair: true }), { mode: "connected", chosen: null });
  assert.deepEqual(resolveBootMode({ accountMode: null, deviceMode: null, hasLivePair: false }), { mode: "finding", chosen: null });
  assert.deepEqual(resolveBootMode({}), { mode: "finding", chosen: null });
});

// ---- the live road, on this base's own seams ----
// live.js is imported before any document stands, so its
// browser boot stays off; only its pure seams are read.
const { routeWrite, liveRelsOf, threadSeamFrom } = await import("./live.js");
t("router: the mode write merges the meta/app doc, and only the two modes stand", () => {
  assert.deepEqual(routeWrite("mode", { mode: "connected" }, "member-a"), { ok: true, op: "merge", path: "users/member-a/meta/app", data: { mode: "connected" } });
  assert.equal(routeWrite("mode", { mode: "finding" }, "member-b").path, "users/member-b/meta/app");
  assert.equal(routeWrite("mode", { mode: "days" }, "member-a").ok, false);
  assert.equal(routeWrite("mode", {}, "member-a").ok, false);
});
t("the boot's pair judgement is the base's own seam gate, and the default follows it", () => {
  const mixed = [
    { id: "rel-pending", state: "pending", members: ["u1", "u2"] },
    { id: "rel-contact", state: "contact", members: ["u1", "u3"] },
  ];
  // The thread seam opens the contact pair out of the same
  // list: contact and hired are this base's live states.
  assert.equal(threadSeamFrom({ rels: mixed, names: {}, msgs: [], uid: "u1" }).pairId, "rel-contact");
  assert.equal(liveRelsOf(mixed).length, 1);
  assert.equal(liveRelsOf([{ id: "rel-pending", state: "pending", members: ["u1", "u2"] }]).length, 0);
  // Composed with the resolver the way the boot composes
  // them: a live pair stands the default at Connected, no
  // live pair stands it at Finding.
  assert.equal(resolveBootMode({ hasLivePair: liveRelsOf(mixed).length > 0 }).mode, "connected");
  assert.equal(resolveBootMode({ hasLivePair: liveRelsOf([{ state: "pending" }]).length > 0 }).mode, "finding");
});

// ---- the shell seam, behind a stub DOM ----
class StubNode {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.className = ""; this.textContent = "";
    this.id = ""; this.type = ""; this.value = ""; this.hidden = true;
    this.dataset = {};
    const self = this;
    this.classList = {
      add(c) { if (!self.classList.contains(c)) self.className = (self.className + " " + c).trim(); },
      remove(c) { self.className = self.className.split(" ").filter((x) => x && x !== c).join(" "); },
      toggle(c, force) { const want = force === undefined ? !self.classList.contains(c) : force; want ? self.classList.add(c) : self.classList.remove(c); },
      contains(c) { return self.className.split(" ").includes(c); },
    };
  }
  append(...kids) { for (const k of kids) { if (k != null) this.children.push(k); } }
  replaceChildren() { this.children = []; }
  addEventListener() {}
  setAttribute() {}
  removeAttribute() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const registry = new Map();
const nodeFor = (key) => { if (!registry.has(key)) registry.set(key, new StubNode("div")); return registry.get(key); };
const surfHome = new StubNode("section");
const surfFind = new StubNode("section");
registry.set("#surface-home", surfHome);
registry.set("#surface-find", surfFind);
const homeBtn = new StubNode("button"); homeBtn.dataset = { nav: "home" };
const pickFinding = new StubNode("button"); pickFinding.dataset = { modePick: "finding" };
const pickConnected = new StubNode("button"); pickConnected.dataset = { modePick: "connected" };
globalThis.window = globalThis;
globalThis.document = {
  createElement: (tag) => new StubNode(tag),
  querySelector: (sel) => (sel === '.navBtn[data-nav="home"]' ? homeBtn : nodeFor(sel)),
  querySelectorAll: (sel) => {
    if (sel === ".surface") return [surfHome, surfFind];
    if (sel === "[data-mode-pick]") return [pickFinding, pickConnected];
    if (sel === "[data-nav]") return [homeBtn];
    return [];
  },
  getElementById: (id) => nodeFor("#" + id),
  documentElement: {},
  addEventListener() {},
  readyState: "complete",
};
// A signed in member on the communicate side, so the role
// machinery at shell load arms no navigation of its own and
// the mode seam is judged alone.
globalThis.CARESITS_UID = "mode-user";
globalThis.CARESITS_ME = { uid: "mode-user", side: "family", entryRole: "communicate", activeSide: "communicate" };
const writes = [];
globalThis.CARESITS_WRITE = (kind, payload) => { writes.push([kind, payload]); return { ok: true }; };
await import("./shell.js");
t("shell: with no pick anywhere, the shell stands in Finding", () => {
  assert.equal(globalThis.CARESITS_MODE_STATE.mode, "finding");
  assert.equal(globalThis.CARESITS_MODE_STATE.chosen, false);
  assert.equal(nodeFor("#layout").dataset.mode, "finding");
  assert.equal(homeBtn.textContent, "Home");
});
t("shell: the switch writes the pick through the mode route and flips the whole app", () => {
  globalThis.CARESITS_SET_MODE("connected");
  assert.deepEqual(writes, [["mode", { mode: "connected" }]]);
  assert.equal(globalThis.CARESITS_MODE_STATE.mode, "connected");
  assert.equal(nodeFor("#layout").dataset.mode, "connected");
  assert.equal(globalThis.localStorage.getItem("caresits-app2-mode-mode-user"), "connected");
  assert.equal(homeBtn.textContent, "Today");
  assert.equal(pickConnected.classList.contains("on"), true);
  assert.equal(pickFinding.classList.contains("on"), false);
});
t("shell: in Connected, a Finding only surface lands Home instead", () => {
  surfHome.hidden = true; surfFind.hidden = true;
  globalThis.CARESITS_NAV("find");
  assert.equal(surfHome.hidden, false);
  assert.equal(surfFind.hidden, true);
});
t("shell: the boot's account pick wins over the device pick, and Finding nav opens again", () => {
  globalThis.CARESITS_MODE_BOOT({ accountMode: "finding", hasLivePair: true });
  assert.equal(globalThis.CARESITS_MODE_STATE.mode, "finding");
  surfHome.hidden = true; surfFind.hidden = true;
  globalThis.CARESITS_NAV("find");
  assert.equal(surfFind.hidden, false);
});

globalThis.localStorage._m = {};
await import("./shell.js?boot2");
t("shell: a member who never chose lands Connected with a live pair, Finding without", () => {
  globalThis.CARESITS_MODE_BOOT({ accountMode: null, hasLivePair: true });
  assert.equal(globalThis.CARESITS_MODE_STATE.mode, "connected");
  assert.equal(globalThis.CARESITS_MODE_STATE.chosen, false);
  globalThis.CARESITS_MODE_BOOT({ accountMode: null, hasLivePair: false });
  assert.equal(globalThis.CARESITS_MODE_STATE.mode, "finding");
});

console.log(`\nALL ${n} mode checks passed`);
