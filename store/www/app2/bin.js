// Caresitters app2 Recently Deleted bin
// Deleted children and day story entries rest here for 30 days.
// The owner can bring one back or delete it for good.
// Pure planners shape every write first. The surface then asks
// the live layer to carry the plan out through CARESITS_WRITE.
// A record leaves the bin for good only when the owner says so
// or when its 30 days are up. The purge pass in bootBin handles
// the second case and the buttons handle the first.
import { t as tr } from "./lang.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const KINDS = ["child", "dayStory"];

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const winOf = () => (typeof window !== "undefined" ? window : globalThis);
const write = (kind, payload) => {
  const w = winOf();
  if (typeof w.CARESITS_WRITE === "function") w.CARESITS_WRITE(kind, payload);
};

function hashText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function binIdFor(kind, record) {
  if (record && record.id != null && String(record.id) !== "") {
    return kind + "-" + String(record.id);
  }
  return kind + "-" + hashText(JSON.stringify(record ?? null));
}

export function planBinMove(input) {
  const { uid, kind, record, nowIso } = input || {};
  if (!uid || !kind || !record) return { ok: false, reason: "missing" };
  if (!KINDS.includes(kind)) return { ok: false, reason: "badkind" };
  const binId = binIdFor(kind, record);
  return {
    ok: true,
    binId,
    path: `users/${uid}/recentlyDeleted/${binId}`,
    data: { kind, data: record, deletedAt: nowIso },
  };
}

export function planRestore(input) {
  const { uid, item } = input || {};
  if (!uid || !item || !item.kind || !item.data) return { ok: false, reason: "missing" };
  if (!KINDS.includes(item.kind)) return { ok: false, reason: "badkind" };
  const collection = item.kind === "child" ? "children" : "dayStory";
  const binPath = `users/${uid}/recentlyDeleted/${item.id}`;
  const hasId = item.data.id != null && String(item.data.id) !== "";
  const originId = hasId ? item.data.id : null;
  const originPath = hasId
    ? `users/${uid}/${collection}/${item.data.id}`
    : `users/${uid}/${collection}`;
  return { ok: true, binId: item.id, binPath, originPath, originId };
}

export function planBinDelete(input) {
  const { uid, binId } = input || {};
  if (!uid || !binId) return { ok: false, reason: "missing" };
  return { ok: true, path: `users/${uid}/recentlyDeleted/${binId}` };
}

export function purgeList(items, nowIso) {
  const now = Date.parse(nowIso);
  if (!Array.isArray(items) || Number.isNaN(now)) return [];
  const out = [];
  for (const item of items) {
    if (!item) continue;
    const at = Date.parse(item.deletedAt);
    if (Number.isNaN(at)) continue;
    if (now - at > 30 * DAY_MS) out.push(item.id);
  }
  return out;
}

export function daysLeft(item, nowIso) {
  const now = Date.parse(nowIso);
  const at = Date.parse(item && item.deletedAt);
  if (Number.isNaN(now) || Number.isNaN(at)) return 30;
  const used = Math.floor((now - at) / DAY_MS);
  const left = 30 - used;
  if (left < 0) return 0;
  if (left > 30) return 30;
  return left;
}

export function renderBin(root, items) {
  const rows = Array.isArray(items) ? items : [];
  root.replaceChildren();
  root.append(el("h2", "findTitle", tr("shell.bin")));
  root.append(el("p", "findPool", tr("bin.lead")));
  if (!rows.length) {
    const box = el("div", "cardIn");
    const img = el("img", "bunnyBig");
    img.src = "bunny/bunny-rest-calm.png";
    img.alt = "";
    box.append(img, el("h3", null, tr("bin.emptyTitle")), el("p", null, tr("bin.emptyBody")));
    root.append(box);
    return;
  }
  const list = el("div", "findList");
  for (const item of rows) {
    const card = el("article", "findCard");
    let title = "";
    if (item.kind === "child") {
      title = item.data && item.data.name ? String(item.data.name) : "";
    } else {
      const parts = [tr("bin.dayStory")];
      if (item.data && item.data.day) parts.push(String(item.data.day));
      if (item.data && item.data.tile) parts.push(String(item.data.tile));
      title = parts.join(" ");
    }
    card.append(el("h3", "findName", title));
    card.append(el("p", "findPlace", tr("bin.daysLeft", undefined, { n: daysLeft(item, new Date().toISOString()) })));
    const restore = el("button", "quietBtn", tr("bin.restore"));
    restore.type = "button";
    restore.addEventListener("click", () => {
      const w = winOf();
      const uid = w.CARESITS_ME && w.CARESITS_ME.uid;
      if (!uid) return;
      const plan = planRestore({ uid, item });
      if (!plan.ok) return;
      write("bin-restore", { ...plan, data: item.data });
      // The restore never passes through family.js, so its
      // mirror would miss the record until the next boot. The
      // family module's own seam folds it back in at once.
      if (typeof w.CARESITS_FAMILY_RESTORE === "function") w.CARESITS_FAMILY_RESTORE(item.kind, item.data);
      card.remove();
    });
    const forever = el("button", "quietBtn", tr("bin.forever"));
    forever.type = "button";
    forever.addEventListener("click", () => {
      const w = winOf();
      const uid = w.CARESITS_ME && w.CARESITS_ME.uid;
      if (!uid) return;
      write("bin-delete", planBinDelete({ uid, binId: item.id }));
      card.remove();
    });
    card.append(restore, forever);
    list.append(card);
  }
  root.append(list);
}

export function bootBin() {
  if (typeof document === "undefined") return;
  const root = document.getElementById("binRoot");
  if (!root) return;
  const w = winOf();
  const all = Array.isArray(w.CARESITS_BIN) ? w.CARESITS_BIN : [];
  const nowIso = new Date().toISOString();
  const purgeIds = purgeList(all, nowIso);
  const uid = w.CARESITS_ME && w.CARESITS_ME.uid;
  for (const id of purgeIds) {
    write("bin-delete", planBinDelete({ uid, binId: id }));
  }
  const kept = all.filter((item) => !purgeIds.includes(item && item.id));
  renderBin(root, kept);
}

if (typeof document !== "undefined") {
  winOf().CARESITS_BIN_OPEN = bootBin;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootBin);
  else bootBin();
}
