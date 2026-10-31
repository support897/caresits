// Plain node tests for the track data (no browser needed): node app2/tracks-tests.mjs
import assert from "node:assert/strict";
import { packAuPair, unpackAuPair, auPairFit, monthChoices, monthToYm, ymToMonth, isTrack, sideOfTrack, TRACK_IDS, countryPoint } from "./tracks.js";
import { packByName, checkFor } from "./countries.js";

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log("ok", name); };

t("four tracks", () => { assert.equal(TRACK_IDS.length, 4); assert.ok(isTrack("aupair")); assert.ok(!isTrack("x")); });
t("sides", () => { assert.equal(sideOfTrack("family-nanny"), "family"); assert.equal(sideOfTrack("aupair"), "carer"); });
t("month round trip", () => { const ym = monthToYm("Dec 2026"); assert.equal(ym, "2026-12"); assert.equal(ymToMonth(ym), "Dec 2026"); assert.ok(monthChoices().length >= 12); });

const ap = { homeCountry: "Brazil", arrivalFrom: "Dec 2026", destinations: { worldwide: false, list: ["Germany", "Spain"] }, stayMonths: "12", english: "Good", infantOk: true, drivesCar: "I do not drive", swim: true };
const host = { country: "Germany", hostRules: "", hoursWeek: "30", hostRoom: true, wantArrive: "Dec 2026", wantStay: "12" };
t("pack au pair fits the 255 style string", () => {
  const p = packAuPair("aupair", ap);
  assert.equal(p.on, true);
  const u = unpackAuPair(p);
  assert.equal(u.track, "aupair");
  assert.deepEqual(u.dest, ["DE", "ES"]);
  assert.equal(u.stay, 12);
  assert.equal(u.ym, "2026-12");
  assert.equal(u.drives, false);
});
t("pack host", () => {
  const u = unpackAuPair(packAuPair("family-aupair", host));
  assert.equal(u.track, "host");
  assert.equal(u.hours, 30);
  assert.equal(u.room, true);
});
t("worldwide", () => {
  const u = unpackAuPair(packAuPair("aupair", { ...ap, destinations: { worldwide: true, list: [] } }));
  assert.equal(u.worldwide, true);
});
t("fit: country match scores, other country does not", () => {
  const me = unpackAuPair(packAuPair("aupair", ap));
  const good = unpackAuPair(packAuPair("family-aupair", host));
  const bad = { ...good, country: "Japan" };
  assert.equal(auPairFit(me, good).ok, true);
  assert.equal(auPairFit(me, bad).ok, false);
});
t("empty input never throws", () => { assert.equal(unpackAuPair(undefined).track, ""); assert.equal(unpackAuPair({}).track, ""); });
t("rules fence: arrival string stays short", () => { assert.ok(packAuPair("aupair", { ...ap, destinations: { worldwide: false, list: ["Germany", "Spain", "France", "Italy", "Australia", "Canada", "Ireland", "Austria", "Belgium", "Denmark"] } }).arrival.length <= 120); });
t("country point exists for common countries", () => { assert.ok(countryPoint("Germany")); assert.equal(countryPoint("Nowhere"), null); });
t("Australia check by postcode", () => {
  const au = packByName("Australia");
  assert.match(checkFor(au, "4000").name, /Blue Card/);
  assert.match(checkFor(au, "2031").name, /Working With Children/);
});
console.log(`${n} passed`);
