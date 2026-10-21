// Caresitters app2 — the two homes build checks: the activity
// planner (determinism, band fit, loves preference, the week
// rule), the connect link planners (the sealed relationship
// shape), the shopping planners, and the child repair.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
Object.defineProperty(globalThis, "navigator", { value: { language: "en-AU" }, configurable: true });
globalThis.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = v; } };

const { BANK, BANK_BY_ID, INTEREST_IDS, bandForAge, normaliseChild, planDay, planWeek, mondayOfISO } = await import("./activities.js");
const { CODE_ALPHABET, isCode, makeCode, planInviteCreate, planInviteAccept, inviteLinkText } = await import("./invites.js");
const { cleanItems, planShoppingSave, addItem, toggleItem } = await import("./shopping.js");
const { repairChild } = await import("./family.js");
const { pairIdFor } = await import("./pair-actions.js");
const { areaCoordsFor, pinLayout } = await import("./browse.js");
const { planSave } = await import("./account-save.js");

let n = 0; const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };

// ---- the child repair (module 1) ----
t("repair: an old record without the new fields keeps working", () => {
  const r = repairChild({ id: "k1", name: "Mila", theme: "fairies" });
  assert.equal(r.name, "Mila"); assert.equal(r.theme, "fairies");
  assert.equal(r.ageYears, null); assert.deepEqual(r.loves, []);
});
t("repair: a good age and loves ride through, unknown loves fall away", () => {
  const r = repairChild({ name: "Leo", ageYears: 2, loves: ["music", "flying", "music"] });
  assert.equal(r.ageYears, 2); assert.deepEqual(r.loves, ["music"]);
});
t("repair: a bad age becomes no age, never a lost record", () => {
  assert.equal(repairChild({ name: "X", ageYears: 42 }).ageYears, null);
  assert.equal(repairChild({ name: "X", ageYears: "four" }).ageYears, null);
  assert.equal(repairChild(null).ageYears, null);
});

// ---- the activity planner ----
const miaLeo = [
  { id: "k1", name: "Mia", ageYears: 4, loves: ["water", "drawing", "dancing"] },
  { id: "k2", name: "Leo", ageYears: 2, loves: ["music", "blocks", "park"] },
];
t("planner: the same children on the same date always get the same plan", () => {
  assert.deepEqual(planDay(miaLeo, "2026-10-19"), planDay(miaLeo, "2026-10-19"));
  assert.deepEqual(planWeek(miaLeo, "2026-10-19"), planWeek(miaLeo, "2026-10-19"));
});
t("planner: a day has three slots at the visual's times", () => {
  const day = planDay(miaLeo, "2026-10-19");
  assert.equal(day.length, 3);
  assert.deepEqual(day.map((s) => s.time), ["09:00", "11:00", "15:30"]);
});
t("planner: every slot fits at least one child's band and names them", () => {
  for (const date of ["2026-10-19", "2026-10-20", "2026-11-02", "2027-01-15"]) {
    for (const slot of planDay(miaLeo, date)) {
      assert.ok(slot.kids.length >= 1, `${date} ${slot.id}`);
      for (const k of slot.kids) {
        const band = bandForAge(k.id === "k1" ? 4 : 2);
        assert.ok(BANK_BY_ID[slot.id].bands.includes(band), `${slot.id} fits ${band}`);
      }
    }
  }
});
t("planner: a baby only ever gets baby band activities", () => {
  const baby = [{ id: "b1", name: "Noa", ageYears: 0, loves: [] }];
  for (let d = 19; d < 26; d += 1) {
    for (const slot of planDay(baby, `2026-10-${d}`)) {
      assert.ok(BANK_BY_ID[slot.id].bands.includes("0-1"), slot.id);
      assert.deepEqual(slot.kids.map((k) => k.name), ["Noa"]);
    }
  }
});
t("planner: loves steer the week (a water lover swims in the week)", () => {
  const week = planWeek([{ id: "k1", name: "Mia", ageYears: 4, loves: ["water"] }], "2026-10-19");
  const ids = week.flatMap((d) => d.slots.map((s) => s.id));
  assert.ok(ids.includes("swim"), ids.join(","));
  assert.ok(ids.every((id) => BANK_BY_ID[id].bands.includes("4-5")), ids.join(","));
});
t("planner: no title repeats within a day where the bank allows", () => {
  for (const d of planWeek(miaLeo, "2026-10-19")) {
    const ids = d.slots.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, d.date);
  }
});
t("planner: no title repeats on consecutive days for the same slot", () => {
  const week = planWeek(miaLeo, "2026-10-19");
  for (let s = 0; s < 3; s += 1) {
    for (let d = 1; d < 7; d += 1) {
      assert.notEqual(week[d].slots[s].id, week[d - 1].slots[s].id, `slot ${s} day ${d}`);
    }
  }
});
t("planner: the week runs Monday to Sunday from the Monday given", () => {
  const week = planWeek(miaLeo, "2026-10-19");
  assert.equal(week.length, 7);
  assert.equal(week[0].date, "2026-10-19");
  assert.equal(week[6].date, "2026-10-25");
  assert.equal(mondayOfISO("2026-10-22"), "2026-10-19");
  assert.equal(mondayOfISO("2026-10-19"), "2026-10-19");
});
t("planner: no children, no plan (the empty state is the surface's job)", () => {
  assert.deepEqual(planDay([], "2026-10-19"), []);
  assert.deepEqual(planDay(null, "2026-10-19"), []);
});
t("planner: legacy kids with no age still get a full day", () => {
  const day = planDay([{ id: "k1", name: "Mila", theme: "fairies" }], "2026-10-19");
  assert.equal(day.length, 3);
});

// ---- the connect link planners ----
t("invites: a made code is 8 unambiguous characters", () => {
  for (let i = 0; i < 40; i += 1) {
    const c = makeCode();
    assert.equal(c.length, 8);
    assert.ok(isCode(c), c);
    assert.ok(!/[ILO01]/.test(c), c);
  }
  assert.ok(CODE_ALPHABET.length >= 30);
});
t("invites: plan create shapes the invite doc Security ruled", () => {
  const p = planInviteCreate({ familyUid: "fam1", code: "K7P2Q9AB", label: "The Smiths", nowIso: "2026-10-17T00:00:00.000Z" });
  assert.equal(p.ok, true);
  assert.equal(p.path, "invites/K7P2Q9AB");
  assert.deepEqual(p.data, { familyUid: "fam1", label: "The Smiths", createdAt: "2026-10-17T00:00:00.000Z", usedBy: null });
});
t("invites: plan create refuses a bad code and a signed out maker", () => {
  assert.equal(planInviteCreate({ familyUid: "f", code: "ILO0188X", nowIso: "x" }).reason, "bad-code");
  assert.equal(planInviteCreate({ familyUid: "", code: "K7P2Q9AB", nowIso: "x" }).reason, "signed-out");
});
const invite = { familyUid: "fam1", label: "", createdAt: "2026-10-17T00:00:00.000Z", usedBy: null };
t("invites: accept builds the relationship in the sealed shape, stamp moves usedBy only", () => {
  const p = planInviteAccept({ code: "K7P2Q9AB", invite, accepterUid: "carer9", nowIso: "2026-10-18T10:00:00.000Z" });
  assert.equal(p.ok, true);
  assert.equal(p.relPath, `relationships/${pairIdFor("fam1", "carer9")}`);
  assert.deepEqual(p.relData, {
    members: ["carer9", "fam1"],
    familyUid: "fam1", carerUid: "carer9",
    state: "pending", createdBy: "carer9",
    createdAt: "2026-10-18T10:00:00.000Z", createdDay: "2026-10-18",
  });
  assert.deepEqual(p.stamp, { usedBy: "carer9" });
  assert.equal(p.invitePath, "invites/K7P2Q9AB");
});
t("invites: accept refuses a used code, your own link, a bad code and no invite", () => {
  assert.equal(planInviteAccept({ code: "K7P2Q9AB", invite: { ...invite, usedBy: "someone" }, accepterUid: "carer9", nowIso: "x" }).reason, "already-used");
  assert.equal(planInviteAccept({ code: "K7P2Q9AB", invite, accepterUid: "fam1", nowIso: "x" }).reason, "own-link");
  assert.equal(planInviteAccept({ code: "bad code!", invite, accepterUid: "carer9", nowIso: "x" }).reason, "bad-code");
  assert.equal(planInviteAccept({ code: "K7P2Q9AB", invite: null, accepterUid: "carer9", nowIso: "x" }).reason, "not-found");
});
t("invites: the link text is display only and carries the cleaned code", () => {
  assert.equal(inviteLinkText(" k7p2q9ab "), "caresitters.app/connect/K7P2Q9AB");
});

// ---- the shopping planners ----
t("shopping: the save plan shapes the pair doc", () => {
  const p = planShoppingSave({ pairId: "a_b", items: [{ id: "s1", text: "Milk", done: true, by: "a" }], uid: "a", nowIso: "2026-10-17T00:00:00.000Z" });
  assert.equal(p.ok, true);
  assert.equal(p.path, "relationships/a_b/lists/shoppingList");
  assert.deepEqual(p.data, { items: [{ id: "s1", text: "Milk", done: true, by: "a" }], updatedAt: "2026-10-17T00:00:00.000Z", updatedBy: "a" });
});
t("shopping: the save refuses no pair and signed out", () => {
  assert.equal(planShoppingSave({ pairId: "", items: [], uid: "a", nowIso: "x" }).reason, "no-pair");
  assert.equal(planShoppingSave({ pairId: "a_b", items: [], uid: "", nowIso: "x" }).reason, "signed-out");
});
t("shopping: cleaning trims, drops blanks and stamps the writer", () => {
  const items = cleanItems([{ text: "  Bananas  " }, { text: "   " }, { text: "Milk", done: 1 }], "u7");
  assert.equal(items.length, 2);
  assert.equal(items[0].text, "Bananas");
  assert.equal(items[0].by, "u7");
  assert.equal(items[1].done, true);
});
t("shopping: add and tick keep the rest of the list whole", () => {
  const start = [{ id: "s1", text: "Milk", done: false, by: "a" }];
  const added = addItem(start, "Nappies size 5", "b");
  assert.equal(added.length, 2);
  assert.equal(added[1].text, "Nappies size 5");
  assert.equal(added[1].by, "b");
  const ticked = toggleItem(added, "s1", "b");
  assert.equal(ticked[0].done, true);
  assert.equal(ticked[1].done, false);
  assert.equal(addItem(start, "   ", "b").length, 1);
});

// ---- the week strip render (the film defect: day.dateISO) ----
// homes.js renders on import when #homeRoot exists; drive the
// real renderer behind a stub DOM so the strip itself is pinned,
// not just the planner under it.
class StubNode {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.className = ""; this.textContent = "";
    this.id = ""; this.type = ""; this.placeholder = ""; this.value = ""; this.checked = false;
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
  scrollIntoView() {}
  click() {}
}
const homeRoot = new StubNode("div"); homeRoot.id = "homeRoot";
globalThis.window = globalThis;
globalThis.document = {
  createElement: (tag) => new StubNode(tag),
  getElementById: (id) => (id === "homeRoot" ? homeRoot : null),
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.localStorage.setItem("caresits-home-posture", "days");
globalThis.CARESITS_FAMILY = { side: "family", children: miaLeo };
await import("./homes.js");
const findByClass = (node, cls, out = []) => {
  if (node.className && node.className.split(" ").includes(cls)) out.push(node);
  for (const c of node.children || []) findByClass(c, cls, out);
  return out;
};
t("week strip: the seven day labels are the day words, not journey.day.undefined", () => {
  const cells = findByClass(homeRoot, "weekCell");
  assert.equal(cells.length, 7);
  const labels = cells.map((c) => findByClass(c, "weekDay")[0]?.textContent || "");
  assert.deepEqual(labels, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  for (const label of labels) {
    assert.ok(!label.includes("undefined") && !label.includes("journey.day."), `bad label: ${label}`);
  }
  const todayCells = cells.filter((c) => c.className.split(" ").includes("today"));
  assert.equal(todayCells.length, 1);
  const dayKeys = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  assert.equal(findByClass(todayCells[0], "weekDay")[0].textContent, dayKeys[new Date().getDay()]);
});

// ---- the source shape: the copy button speaks when the copy is refused ----
t("source: the copy catch speaks homes.copyFail, and the share catch stays silent on purpose", () => {
  const src = readFileSync(new URL("./homes.js", import.meta.url), "utf8");
  const copyLine = src.split("\n").find((l) => l.includes("clipboard.writeText"));
  assert.ok(copyLine && copyLine.includes('catch { state.linkMsg = tr("homes.copyFail"); renderHome(); }'), "the copy catch speaks");
  const shareLine = src.split("\n").find((l) => l.includes("navigator.share"));
  assert.ok(shareLine && shareLine.includes("catch { /* share closed */ }"), "the share catch stays silent");
});

// Polar C1 (build 114): the map stood empty for every real
// member — no production save ever wrote card coordinates,
// so pinLayout filtered the whole pool out. The area table
// + the save write + the read derivation are the cure.
t("area: a known postcode resolves to its area centroid", () => {
  assert.deepEqual(areaCoordsFor("4217"), { latE2: -2802, lngE2: 15343 });
  assert.deepEqual(areaCoordsFor("2000"), { latE2: -3387, lngE2: 15121 });
});
t("area: an unlisted prefix falls back to its state area, and an unplaceable postcode resolves null", () => {
  assert.deepEqual(areaCoordsFor("2350"), { latE2: -3289, lngE2: 15178 });
  assert.equal(areaCoordsFor("123"), null);
  assert.equal(areaCoordsFor(""), null);
  assert.equal(areaCoordsFor(null), null);
});
t("area: pins stand over postcode-derived cards, and coord-less cards honestly draw none", () => {
  const mk = (pc) => ({ doc: { uid: pc, displayName: "X", card: { postcode: pc, ...areaCoordsFor(pc) } } });
  assert.ok(pinLayout(null, [mk("4217"), mk("4220")]).length >= 1);
  assert.equal(pinLayout(null, [{ doc: { uid: "z", card: {} } }]).length, 0);
});
t("area: the save writes the area coordinates onto the card from its postcode", () => {
  const plan = planSave({ side: "carer", answers: {}, card: { postcode: "4217" }, looking: { musts: {}, prefs: {} } }, { uid: "u1", displayName: "Ana", nowIso: "2026-10-21T00:00:00.000Z" });
  assert.equal(plan.card.data.card.latE2, -2802);
  assert.equal(plan.card.data.card.lngE2, 15343);
  const bare = planSave({ side: "carer", answers: {}, card: {}, looking: { musts: {}, prefs: {} } }, { uid: "u1", displayName: "Ana", nowIso: "2026-10-21T00:00:00.000Z" });
  assert.ok(!("latE2" in bare.card.data.card));
});

// F-CS-RT-1 (QA, real-account round trip on 114): a fresh
// boot's Home could stand on "0% answered" for a completed
// member when the seam landed after the first paint, and
// nothing re-derived it. The card now asserts nothing
// numeric before the seam, and the seam re-renders Home.
const treeText = () => {
  const texts = [];
  (function walk(node) { if (node.textContent) texts.push(node.textContent); for (const c of node.children || []) walk(c); })(homeRoot);
  return texts.join(" | ");
};
globalThis.localStorage.setItem("caresits-home-posture", "finding");
delete globalThis.localStorage._m["caresits-app2-draft"];
delete globalThis.localStorage._m["caresits-app2-questionnaire"];
delete globalThis.CARESITS_QUESTIONS;
await import("./homes.js?fcsrt1");
t("F-CS-RT-1: before the seam lands, the finding home's card asserts no false 0%", () => {
  const joined = treeText();
  assert.ok(joined.includes("Reading your answers..."), "the reading line stands");
  assert.ok(!joined.includes("0% answered"), "no false zero stands");
});
t("F-CS-RT-1: when the seam lands complete, the re-rendered card agrees with it", () => {
  globalThis.CARESITS_QUESTIONS = { answered: 51, level: "full", side: "family" };
  globalThis.window.CARESITS_RENDER_HOME();
  const joined = treeText();
  assert.ok(joined.includes("Your questions are answered"), "the done title stands");
  assert.ok(!joined.includes("0% answered"), "no false zero stands");
  delete globalThis.CARESITS_QUESTIONS;
});

console.log(`\nALL ${n} homes checks passed`);
