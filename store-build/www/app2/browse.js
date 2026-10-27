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
import { matchPair, rank, topFive, viewMore, labelFor } from "../next-phase/engine/engine.mjs";
import { learningMatchDetails } from "./activities.js";

export function kmBetween(a, b) {
  if (a?.latE2 == null || a?.lngE2 == null || b?.latE2 == null || b?.lngE2 == null) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const lat1 = rad(a.latE2 / 100), lat2 = rad(b.latE2 / 100);
  const dLat = rad((b.latE2 - a.latE2) / 100), dLng = rad((b.lngE2 - a.lngE2) / 100);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(12742 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

// Postcode AREA centroids (hundredths of a degree), the
// map's geography of record: pins sit at postcode area
// level, never at a home address, so a member's position
// is their postcode's area centre, looked up by the first
// two digits with a state fallback on the first. A
// postcode the table cannot place carries no coordinates:
// no pin is drawn and no distance is claimed, the standing
// honest states. (Polar device round, build 114 C1: no
// production save ever wrote coordinates, so the map
// stood empty for every real member while the suite
// fixtures, which carried them, passed.)
const AREA2 = {
  "08": [-1246, 13084], "09": [-1246, 13084],
  "20": [-3387, 15121], "21": [-3387, 15121], "22": [-3427, 15087], "23": [-3289, 15178], "24": [-3143, 15291],
  "25": [-3405, 15081], "26": [-3528, 14913], "27": [-3375, 15069], "28": [-3328, 14910], "29": [-3226, 14862],
  "30": [-3781, 14496], "31": [-3781, 14496], "32": [-3815, 14436], "33": [-3814, 14512], "34": [-3676, 14428],
  "35": [-3638, 14540], "36": [-3612, 14688], "37": [-3820, 14678], "38": [-3816, 14593], "39": [-3838, 14248],
  "40": [-2747, 15303], "41": [-2747, 15303], "42": [-2802, 15343], "43": [-2756, 15195], "44": [-2561, 15268],
  "45": [-2665, 15305], "46": [-2487, 15235], "47": [-2338, 15051], "48": [-2114, 14918], "49": [-1925, 14677],
  "50": [-3493, 13860], "51": [-3493, 13860], "52": [-3459, 13874], "53": [-3417, 14075], "54": [-3383, 13861],
  "55": [-3319, 13801], "56": [-3302, 13756], "57": [-3249, 13777], "58": [-3783, 14077], "59": [-3493, 13860],
  "60": [-3195, 11586], "61": [-3195, 11586], "62": [-3253, 11574], "63": [-3333, 11564], "64": [-3502, 11788],
  "65": [-3075, 12147], "66": [-2878, 11460], "67": [-2074, 11685], "68": [-3195, 11586], "69": [-3195, 11586],
  "70": [-4288, 14733], "71": [-4288, 14733], "72": [-4144, 14714], "73": [-4118, 14636], "74": [-4106, 14591],
  "75": [-4288, 14733], "76": [-4288, 14733], "77": [-4288, 14733], "78": [-4288, 14733], "79": [-4288, 14733],
};
const AREA1 = { "0": [-1246, 13084], "1": [-3387, 15121], "2": [-3387, 15121], "3": [-3781, 14496], "4": [-2747, 15303], "5": [-3493, 13860], "6": [-3195, 11586], "7": [-4288, 14733], "8": [-3781, 14496], "9": [-3781, 14496] };
export function areaCoordsFor(postcode) {
  const pc = String(postcode || "").replace(/\D/g, "");
  if (pc.length !== 4) return null;
  const hit = AREA2[pc.slice(0, 2)] || AREA1[pc.slice(0, 1)];
  return hit ? { latE2: hit[0], lngE2: hit[1] } : null;
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
      const learning = learningMatchDetails(familyDoc.learningPlan || familyDoc.card?.learningPlan, carerDoc.learningPlan || carerDoc.card?.learningPlan);
      result.pair = Math.min(100, result.pair + learning.boost);
      result.label = labelFor(result.pair, result.familyScore, result.carerScore);
      if (result.qualifier && result.label === "Perfect Pair") result.label = "Strong Fit";
      result.learningReasons = learning.reasons;
      result.learningMatches = learning.reasons;
    }
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
