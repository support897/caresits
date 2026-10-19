// Caresitters app2 — Phase B: browse assembly on the engine.
// Takes profile docs in the published shape ({side, displayName,
// suburb, card, looking}) and returns what the Find screen
// renders: the live pool count, the Top 5, View more, and — for
// a family viewer only — the nearly list naming the failed gate
// in the engine's own plain words. A carer viewer never gets a
// nearly list: the carer is never told they failed, or why.
// Distance comes from the cards' hundredthed coordinates; when
// either side has none, distance is unknown: it never blocks a
// gate and no distance is ever claimed on the card.
import { matchPair, rank, topFive, viewMore } from "../next-phase/engine/engine.mjs";

export function kmBetween(a, b) {
  if (a?.latE2 == null || a?.lngE2 == null || b?.latE2 == null || b?.lngE2 == null) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const lat1 = rad(a.latE2 / 100), lat2 = rad(b.latE2 / 100);
  const dLat = rad((b.latE2 - a.latE2) / 100), dLng = rad((b.lngE2 - a.lngE2) / 100);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(12742 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

const engineFamily = (doc) => ({ ...(doc.card || {}), musts: doc.looking?.musts || {}, prefs: doc.looking?.prefs || {} });
const engineCarer = (doc) => ({ ...(doc.card || {}), musts: doc.looking?.musts || {}, prefs: doc.looking?.prefs || {} });

export function pinLayout(viewerCard, entries) {
  const pts = entries.filter((e) => e.doc.card?.latE2 != null && e.doc.card?.lngE2 != null);
  if (!pts.length) return [];
  const cLat = viewerCard?.latE2 ?? pts.reduce((s, e) => s + e.doc.card.latE2, 0) / pts.length;
  const cLng = viewerCard?.lngE2 ?? pts.reduce((s, e) => s + e.doc.card.lngE2, 0) / pts.length;
  const spread = Math.max(50, ...pts.map((e) => Math.max(Math.abs(e.doc.card.latE2 - cLat), Math.abs(e.doc.card.lngE2 - cLng))));
  return pts.map((e) => ({
    uid: e.doc.uid || e.doc.displayName,
    x: Math.min(96, Math.max(4, 50 + ((e.doc.card.lngE2 - cLng) / spread) * 46)),
    y: Math.min(92, Math.max(6, 50 - ((e.doc.card.latE2 - cLat) / spread) * 42)),
  }));
}

export function assembleBrowse(viewerDoc, candidateDocs) {
  const viewerIsFamily = viewerDoc.side === "family";
  // A swept carer (the photo lifecycle, Ilse's ruling of
  // 19 Oct 2026) is out of family search until they return
  // and add a fresh photo, which clears the stamp at the
  // photo write. The exclusion is this one filter: entries
  // and the nearly list both draw from the pool.
  const pool = candidateDocs.filter((d) => d.side !== viewerDoc.side && !(d.side === "carer" && d.photoClearedAt));
  const viewerCard = viewerDoc.card || {};
  const entries = [];
  const nearly = [];
  for (const doc of pool) {
    const familyDoc = viewerIsFamily ? viewerDoc : doc;
    const carerDoc = viewerIsFamily ? doc : viewerDoc;
    const km = kmBetween(viewerCard, doc.card || {});
    const result = matchPair(engineFamily(familyDoc), engineCarer(carerDoc), km ?? 0, { family: familyDoc.level, carer: carerDoc.level });
    // Honest by level, at the render: a Quick side makes the
    // pair rough, and that word rides OUTSIDE the reasons so it
    // can never be sliced away; an Explore viewer (a doc whose
    // level is still explore) sees no personal score at all.
    result.qualifier = (familyDoc.level === "quick" || carerDoc.level === "quick") ? "Quick profile, rough match" : null;
    result.personal = viewerDoc.level !== "explore";
    if (result.shown) {
      entries.push({ doc, result, distanceKm: km, family: engineFamily(familyDoc), carer: engineCarer(carerDoc) });
    } else if (viewerIsFamily && viewerDoc.level !== "explore") {
      nearly.push({ doc, failedGate: result.failedGate, failedGateCode: result.failedGateCode || null });
    }
  }
  const ranked = rank(entries);
  return {
    poolCount: pool.length,
    shownCount: ranked.length,
    top: topFive(ranked),
    more: viewMore(ranked),
    nearly,
  };
}

// The deep answers live as their own documents (the fallback
// construction); this stitches them back into the card shape
// the engine reads: looking[bucket].deep[code] = {v, s, feed}.
export function stitchAnswers(doc, answerDocs) {
  const out = { ...doc, looking: { musts: { ...(doc.looking?.musts || {}) }, prefs: { ...(doc.looking?.prefs || {}) } } };
  for (const a of answerDocs || []) {
    const bucket = a.data?.bucket === "prefs" ? "prefs" : "musts";
    const val = { v: a.data?.v };
    if (a.data?.s) val.s = a.data.s;
    if (a.data?.feed) val.feed = a.data.feed;
    (out.looking[bucket].deep ||= {})[a.code] = val;
  }
  return out;
}
