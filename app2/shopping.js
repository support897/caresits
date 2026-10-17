// Caresitters app2 — the shared shopping list planners (the
// two homes build). One list per pair, held in the pair's own
// lists space: relationships/{pairId}/lists/shoppingList, one
// document shaped exactly {items, updatedAt, updatedBy} (the
// shape from Security's ruling, 17 Oct 2026). Both pair members
// can add and tick; every change is planned here first, so the
// surface never writes a shape the pair fold would refuse.

export function cleanItems(items, fallbackBy) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((it, i) => ({
      id: String((it && it.id) || `s${i + 1}`),
      text: String((it && it.text) || "").trim().slice(0, 80),
      done: !!(it && it.done),
      by: String((it && it.by) || fallbackBy || ""),
    }))
    .filter((it) => it.text.length > 0)
    .slice(0, 100);
}

export function planShoppingSave({ pairId, items, uid, nowIso }) {
  if (!pairId) return { ok: false, reason: "no-pair" };
  if (!uid) return { ok: false, reason: "signed-out" };
  return {
    ok: true,
    kind: "shopping",
    path: `relationships/${pairId}/lists/shoppingList`,
    data: { items: cleanItems(items, uid), updatedAt: nowIso, updatedBy: uid },
  };
}

function itemIdFor(text, items) {
  let h = 2166136261;
  const seed = `${text}|${items.length}|${Date.now()}`;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "s" + (h >>> 0).toString(16);
}

export function addItem(items, text, uid) {
  const clean = String(text || "").trim().slice(0, 80);
  const base = cleanItems(items, uid);
  if (!clean) return base;
  return [...base, { id: itemIdFor(clean, base), text: clean, done: false, by: uid || "" }];
}

export function toggleItem(items, id, uid) {
  return cleanItems(items, uid).map((it) => (it.id === id ? { ...it, done: !it.done } : it));
}
