import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bunny, Button, Chip, Empty, haptic, t, useNav, type ScreenProps } from "@cc/core";
import type { Person } from "@cc/core";
import { removeSavedPerson, savePerson, subscribeDiscoveryPeople, subscribeSavedIds, type DiscoveryPerson } from "../data/people";
import { PersonCard } from "./discover/PersonCard";
import { WhyMatchSheet } from "./discover/WhyMatchSheet";
import { approximateMapPins, deleteDiscoverSearch, distanceKmBetween, isAvailableOnDate, isAvailableThisWeek, lastActiveTime, loadSavedSearches, saveDiscoverSearch, suburbOf, type SavedDiscoverSearch } from "./discover/helpers";
import { parseNeeds, requirementsFromSuggestions, scoreMatch, type MatchRequirements, type MatchResult, type MatchWeights, type RequirementSuggestion } from "../../../../packages/core/src/match";

type ScreenParams = ScreenProps["params"] & { me: Person; people?: DiscoveryPerson[]; savedUids?: string[] };
type Row = { person: DiscoveryPerson; km: number | null; result: MatchResult };
const RADIUS_OPTIONS = [5, 10, 15, 25, 50, 100, 0];

export default function Discover({ params }: ScreenProps) {
  const { me, people: fakePeople, savedUids: fakeSaved } = params as ScreenParams;
  const nav = useNav();
  const [people, setPeople] = useState<DiscoveryPerson[]>(fakePeople ?? []);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(fakeSaved ?? []));
  const [loading, setLoading] = useState(!fakePeople);
  const [loadError, setLoadError] = useState(false);
  const [radiusKm, setRadiusKm] = useState(25);
  const [suburb, setSuburb] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [dateError, setDateError] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedDiscoverSearch[]>([]);
  const [suggestions, setSuggestions] = useState<RequirementSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [confirmedSuggestions, setConfirmedSuggestions] = useState<RequirementSuggestion[]>([]);
  const [requirements, setRequirements] = useState<MatchRequirements>({});
  const [matchWeights, setMatchWeights] = useState<Partial<MatchWeights> | undefined>(undefined);
  const [deckMode, setDeckMode] = useState(false);
  const [deckIndex, setDeckIndex] = useState(0);
  const [why, setWhy] = useState<Row | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [savedCelebration, setSavedCelebration] = useState(false);

  useEffect(() => {
    setSavedSearches(loadSavedSearches(me.uid));
    if (fakePeople) {
      setPeople(fakePeople);
      setSavedIds(new Set(fakeSaved ?? []));
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    const stopPeople = subscribeDiscoveryPeople(me, (loaded) => {
      setPeople(loaded);
      setLoading(false);
    }, () => {
      setLoadError(true);
      setLoading(false);
    });
    const stopSaved = subscribeSavedIds(me.uid, (saved) => setSavedIds(new Set(saved)), () => setSaveError(true));
    return () => { stopPeople(); stopSaved(); };
  }, [fakePeople, fakeSaved, me, me.uid]);

  useEffect(() => {
    const onWeightsSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string; weights?: Partial<MatchWeights> }>).detail;
      if (detail?.uid === me.uid && detail.weights) setMatchWeights(detail.weights);
    };
    window.addEventListener("cc:match-weights-updated", onWeightsSaved);
    return () => window.removeEventListener("cc:match-weights-updated", onWeightsSaved);
  }, [me.uid]);

  const rows = useMemo<Row[]>(() => people.map((person) => {
    const km = distanceKmBetween(me, person);
    const result = scoreMatch({ viewer: me, candidate: person, km, radiusKm, requirements, weights: matchWeights });
    return { person, km, result };
  }), [me, people, radiusKm, requirements, matchWeights]);
  const matchesSuburb = (person: DiscoveryPerson) => !suburb.trim() || suburbOf(person).toLowerCase().includes(suburb.trim().toLowerCase());
  const radiusRows = rows.filter((row) => (radiusKm <= 0 || (row.km !== null && row.km <= radiusKm)) && matchesSuburb(row.person));
  const eligibleRows = radiusRows.filter((row) => row.result.eligible).sort((a, b) => (b.result.score ?? -1) - (a.result.score ?? -1));
  const needsReviewRows = radiusRows.filter((row) => !row.result.eligible);
  const activeSearchDate = requirements.availability?.find((need) => need.date)?.date;
  const availableRows = eligibleRows.filter((row) => activeSearchDate ? isAvailableOnDate(row.person, activeSearchDate) : isAvailableThisWeek(row.person));
  const verifiedRows = eligibleRows.filter((row) => row.person.verifiedLevel === "register" || row.person.verifiedLevel === "verified").sort((a, b) => (b.person.verifiedAt ?? 0) - (a.person.verifiedAt ?? 0)).slice(0, 12);
  const activeRows = eligibleRows.filter((row) => lastActiveTime(row.person) !== undefined).sort((a, b) => (lastActiveTime(b.person) ?? 0) - (lastActiveTime(a.person) ?? 0)).slice(0, 12);
  const savedRows = radiusRows.filter((row) => savedIds.has(row.person.uid));
  const nearest = rows.filter((row) => row.km !== null && row.km > radiusKm && matchesSuburb(row.person)).sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity)).slice(0, 3);
  const bestMatches = eligibleRows.slice(0, 12);

  useEffect(() => { setDeckIndex(0); }, [bestMatches.map((row) => row.person.uid).join("|")]);

  function toggleSuggestion(id: string) {
    setSelectedSuggestions((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function makeSuggestions() {
    const parsed = parseNeeds(searchText);
    setSuggestions(parsed);
    setSelectedSuggestions(new Set());
    setRequirements({});
    setConfirmedSuggestions([]);
  }
  function confirmRequirements() {
    const chosen = suggestions.filter((item) => selectedSuggestions.has(item.id));
    setRequirements(requirementsFromSuggestions(suggestions, [...selectedSuggestions]));
    setConfirmedSuggestions(chosen);
    haptic();
  }
  function clearRequirements() {
    setRequirements({});
    setSuggestions([]);
    setSelectedSuggestions(new Set());
    setConfirmedSuggestions([]);
    setSearchText("");
    setSearchDate("");
    setTimeFrom("");
    setTimeTo("");
    setDateError(false);
  }
  function addDateTimeNeed() {
    if (!searchDate || Boolean(timeFrom) !== Boolean(timeTo)) { setDateError(true); return; }
    const need = { date: searchDate, ...(timeFrom ? { from: timeFrom, to: timeTo } : {}) };
    setRequirements((previous) => ({ ...previous, availability: [...(previous.availability ?? []).filter((item) => item.date !== searchDate), need] }));
    setDateError(false);
    haptic();
  }
  function saveCurrentSearch() {
    const label = searchDate ? t("disc.savedSearchDate", "{date} search", { date: searchDate }) : suburb.trim() || t("disc.savedSearchGeneric", "{radius} km search", { radius: radiusKm || t("disc.anyDistance", "Any distance") });
    setSavedSearches(saveDiscoverSearch(me.uid, { label, radiusKm, suburb: suburb.trim(), requirements, date: searchDate, from: timeFrom, to: timeTo }));
    haptic();
  }
  function applySavedSearch(search: SavedDiscoverSearch) {
    setRadiusKm(search.radiusKm);
    setSuburb(search.suburb);
    setSearchText("");
    setRequirements(search.requirements && typeof search.requirements === "object" && !Array.isArray(search.requirements) ? search.requirements as MatchRequirements : {});
    setSearchDate(search.date);
    setTimeFrom(search.from);
    setTimeTo(search.to);
    setSuggestions([]);
    setSelectedSuggestions(new Set());
    setConfirmedSuggestions([]);
    setDateError(false);
    haptic();
  }
  function removeSearch(search: SavedDiscoverSearch) {
    setSavedSearches(deleteDiscoverSearch(me.uid, search.id));
    haptic();
  }
  async function toggleSave(row: Row) {
    const wasSaved = savedIds.has(row.person.uid);
    setSaveError(false);
    setSavedIds((previous) => {
      const next = new Set(previous);
      if (wasSaved) next.delete(row.person.uid); else next.add(row.person.uid);
      return next;
    });
    haptic();
    try {
      if (wasSaved) await removeSavedPerson(me.uid, row.person.uid);
      else {
        await savePerson(me.uid, row.person.uid);
        setSavedCelebration(true);
        window.setTimeout(() => setSavedCelebration(false), 1800);
      }
    } catch {
      setSavedIds((previous) => {
        const next = new Set(previous);
        if (wasSaved) next.add(row.person.uid); else next.delete(row.person.uid);
        return next;
      });
      setSaveError(true);
    }
  }
  function openPerson(row: Row) { nav.push("person", { uid: row.person.uid }); }
  function openDeckWhy(row: Row) { setWhy(row); }
  function nextCard() { setDeckIndex((index) => Math.min(index + 1, Math.max(0, bestMatches.length))); }
  function card(row: Row) {
    return <PersonCard key={row.person.uid} person={row.person} km={row.km} result={row.result} saved={savedIds.has(row.person.uid)} onSave={() => void toggleSave(row)} onWhy={() => setWhy(row)} onOpen={() => openPerson(row)} />;
  }
  function section(title: string, hint: string, items: Row[], emptyText: string) {
    return <section key={title} aria-label={title} style={{ marginBlock: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 8, flexWrap: "wrap", paddingInline: 2 }}>
        <h2 style={{ fontSize: 24 }}>{title}</h2>
        <span className="muted">{hint}</span>
      </div>
      {items.length ? <div role="region" aria-label={title} tabIndex={0} style={{ display: "flex", gap: 14, overflowX: "auto", padding: "12px 4px 18px", marginInline: -4, scrollSnapType: "x mandatory" }}>
        {items.map((row) => <div key={row.person.uid} style={{ scrollSnapAlign: "start" }}>{card(row)}</div>)}
      </div> : <p className="muted" style={{ margin: "12px 2px" }}>{emptyText}</p>}
    </section>;
  }

  const nearestText = nearest.length
    ? t("disc.nearest", "Nearest: {people}", { people: nearest.map((row) => `${row.person.firstName}, ${(row.km ?? 0).toFixed(1)} km`).join(" · ") })
    : t("disc.noneNearby", "No profiles with a known distance are within this radius.");
  const currentDeckCard = bestMatches[deckIndex];
  const mapRows = availableRows.slice(0, 12);
  const mapPins = approximateMapPins(mapRows.map((row) => row.person));
  const title = me.side === "family" ? t("disc.titleFamily", "Discover care") : t("disc.titleCarer", "Find families");

  return <div className="app">
    <header style={{ padding: "10px 16px 12px", display: "grid", gap: 8, borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h1 style={{ fontSize: 30 }}>{title}</h1>
        <Button type="button" alt small onClick={() => nav.push("weights", { me })} aria-label={t("disc.editWeights", "Change match weights")}>{t("disc.weights", "Weights")}</Button>
      </div>
      <div className="row"><Button type="button" alt small onClick={() => nav.push("aupair", { me })}>{t("disc.auPairWorld", "Au pair world")}</Button></div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(100px, 0.8fr) minmax(130px, 1.2fr)", gap: 8 }}>
        <label style={{ display: "grid", gap: 4 }}><span>{t("disc.radius", "Radius")}</span>
          <select className="field" aria-label={t("disc.radius", "Radius")} value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} style={{ paddingInline: 10 }}>
            {RADIUS_OPTIONS.map((value) => <option key={value} value={value}>{value ? t("disc.radiusKm", "{km} km", { km: value }) : t("disc.anyDistance", "Any distance")}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}><span>{t("disc.suburb", "Suburb")}</span>
          <input className="field" aria-label={t("disc.suburb", "Suburb")} value={suburb} onChange={(event) => setSuburb(event.target.value)} placeholder={t("disc.suburbPlaceholder", "Search a suburb")} />
        </label>
      </div>
    </header>

    <div className="scroll">
      <section aria-label={t("disc.quickSearch", "Quick search")} className="card" style={{ display: "grid", gap: 10, padding: 14 }}>
        <div><h2 style={{ fontSize: 22 }}>{t("disc.quickTitle", "Tell us what you need")}</h2><p className="muted" style={{ margin: "4px 0 0" }}>{t("disc.quickHelp", "Suggestions are rule-based. Review and confirm before matching.")}</p></div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "center" }}>
          <input className="field" value={searchText} onChange={(event) => setSearchText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") makeSuggestions(); }} placeholder={t("disc.searchPlaceholder", "e.g. available Friday from 4pm, can cook")} aria-label={t("disc.searchPlaceholder", "Describe what you need")} />
          <Button type="button" small onClick={makeSuggestions} style={{ width: "auto", paddingInline: 16 }}>{t("disc.suggest", "Suggest")}</Button>
        </div>
        {suggestions.length > 0 && <div style={{ display: "grid", gap: 8 }}>
          <div className="row" aria-label={t("disc.confirmNeeds", "Confirm needs")}>{suggestions.map((suggestion) => <Chip key={suggestion.id} type="button" on={selectedSuggestions.has(suggestion.id)} onClick={() => toggleSuggestion(suggestion.id)} aria-label={t("disc.confirmChip", "Confirm {kind}: {label}", { kind: suggestion.kind, label: suggestion.label })}>{suggestion.label} · {suggestion.kind === "essential" ? t("disc.essential", "Essential") : t("disc.preference", "Preference")}</Chip>)}</div>
          <div className="row"><Button type="button" alt small disabled={!selectedSuggestions.size} onClick={confirmRequirements}>{t("disc.applyNeeds", "Apply confirmed needs")}</Button><Button type="button" alt small onClick={clearRequirements}>{t("disc.clearNeeds", "Clear")}</Button></div>
        </div>}
        {confirmedSuggestions.length > 0 && <p role="status" className="muted" style={{ margin: 0 }}>{t("disc.confirmed", "Confirmed for this search: {needs}", { needs: confirmedSuggestions.map((item) => item.label).join(" · ") })}</p>}
        <div style={{ display: "grid", gap: 10, borderTop: "1px solid var(--line)", paddingBlockStart: 12 }}>
          <div><h3 style={{ fontSize: 19 }}>{t("disc.dateSearchTitle", "Search by date and time")}</h3><p className="muted" style={{ margin: "4px 0 0" }}>{t("disc.dateSearchHelp", "Choose a date and optional time window. Add it to use it as an essential.")}</p></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 8 }}>
            <label style={{ display: "grid", gap: 4 }}><span>{t("disc.date", "Date")}</span><input className="field" type="date" value={searchDate} onChange={(event) => setSearchDate(event.target.value)} aria-label={t("disc.date", "Date")} /></label>
            <label style={{ display: "grid", gap: 4 }}><span>{t("disc.from", "From")}</span><input className="field" type="time" value={timeFrom} onChange={(event) => setTimeFrom(event.target.value)} aria-label={t("disc.from", "From")} /></label>
            <label style={{ display: "grid", gap: 4 }}><span>{t("disc.to", "To")}</span><input className="field" type="time" value={timeTo} onChange={(event) => setTimeTo(event.target.value)} aria-label={t("disc.to", "To")} /></label>
          </div>
          <div className="row"><Button type="button" alt small onClick={addDateTimeNeed} disabled={!searchDate}>{t("disc.addDateNeed", "Add date and time")}</Button><Button type="button" alt small onClick={saveCurrentSearch}>{t("disc.saveSearch", "Save this search")}</Button></div>
          {dateError && <p role="alert" style={{ margin: 0, color: "var(--danger)" }}>{t("disc.dateError", "Choose a date and enter both times, or leave both times blank.")}</p>}
          {activeSearchDate && <p role="status" className="muted" style={{ margin: 0 }}>{t("disc.dateApplied", "Date requirement added: {date}", { date: activeSearchDate })}</p>}
        </div>
        <div style={{ display: "grid", gap: 8, borderTop: "1px solid var(--line)", paddingBlockStart: 12 }}>
          <h3 style={{ fontSize: 19 }}>{t("disc.savedSearches", "Saved searches")}</h3>
          {savedSearches.length ? savedSearches.map((search) => <div key={search.id} className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <span>{search.label}</span><div className="row"><Button type="button" alt small onClick={() => applySavedSearch(search)}>{t("disc.applySearch", "Apply")}</Button><Button type="button" alt small onClick={() => removeSearch(search)} aria-label={t("disc.deleteSearch", "Delete saved search: {label}", { label: search.label })}>{t("disc.delete", "Delete")}</Button></div>
          </div>) : <p className="muted" style={{ margin: 0 }}>{t("disc.noSavedSearches", "Saved searches stay on this device until you remove them.")}</p>}
        </div>
      </section>

      {loading && <div style={{ paddingBlock: 24 }}><Empty mood="rest" title={t("disc.loading", "Finding profiles…")} /></div>}
      {!loading && loadError && <Empty mood="oops" title={t("disc.loadError", "Profiles could not load")} body={t("disc.tryAgain", "Check your connection and try again.")} />}
      {!loading && !loadError && saveError && <p role="alert" style={{ color: "var(--danger)" }}>{t("disc.saveError", "Could not update saved profiles. Try again.")}</p>}

      {!loading && !loadError && <>
        <div className="row" style={{ marginBlock: 18 }}>
          <Chip type="button" on={deckMode} onClick={() => setDeckMode(true)}>{t("disc.swipeMode", "Swipe deck")}</Chip>
          <Chip type="button" on={!deckMode} onClick={() => setDeckMode(false)}>{t("disc.sectionMode", "Sections")}</Chip>
        </div>

        {deckMode && <section aria-label={t("disc.swipeMode", "Swipe deck")} style={{ display: "grid", justifyItems: "center", gap: 12, marginBlock: 16 }}>
          {currentDeckCard ? <>
            <p className="muted" style={{ margin: 0 }}>{t("disc.deckCount", "Profile {current} of {total}", { current: deckIndex + 1, total: bestMatches.length })}</p>
            <AnimatePresence mode="wait"><motion.div key={currentDeckCard.person.uid} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.82} onDragEnd={(_, info) => { if (info.offset.x > 90) { if (savedIds.has(currentDeckCard.person.uid)) haptic(); else void toggleSave(currentDeckCard); nextCard(); } else if (info.offset.x < -90) { haptic(); nextCard(); } }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 160, rotate: 8 }} transition={{ type: "spring", stiffness: 320, damping: 28 }} style={{ touchAction: "pan-y", cursor: "grab" }}>{card(currentDeckCard)}</motion.div></AnimatePresence>
            <div className="row" style={{ justifyContent: "center" }}><Button type="button" alt small onClick={() => { haptic(); nextCard(); }}>{t("disc.skip", "Next")}</Button><Button type="button" small onClick={() => void toggleSave(currentDeckCard)}>{savedIds.has(currentDeckCard.person.uid) ? t("disc.saved", "Saved") : t("disc.saveHeart", "Save with heart")}</Button></div>
          </> : <Empty mood="celebrate" title={t("disc.deckDone", "You saw all best matches")} body={t("disc.deckDoneBody", "Switch to sections to browse more.")} />}
        </section>}

        {!deckMode && <>
          {eligibleRows.length > 0 ? section(t("disc.best", "Best matches"), t("disc.bestHint", "Profiles that meet stated essentials"), bestMatches, t("disc.noBest", "No profiles match all confirmed essentials yet.")) : <Empty mood="point" title={t("disc.noMatches", "No matches in this area yet")} body={nearestText} />}
          {eligibleRows.length > 0 && section(t("disc.available", activeSearchDate ? "Available on this date" : "Available this week"), t("disc.availableHint", "From shared schedules"), availableRows, t("disc.noAvailability", "No matching availability is listed for this week."))}
          <section className="card" aria-labelledby="disc-map-title" style={{ display: "grid", gap: 10, padding: 14, marginBlock: 20 }}>
            <div><h2 id="disc-map-title" style={{ fontSize: 22 }}>{t("disc.mapTitle", "Availability nearby")}</h2><p className="muted" style={{ margin: "4px 0 0" }}>{t("disc.mapPrivacy", "Pins show only an approximate area, never an exact address.")}</p></div>
            <div role="group" aria-label={t("disc.mapPins", "Approximate available profile locations")} style={{ position: "relative", minHeight: 210, border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden", backgroundColor: "var(--soft)", backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)", backgroundSize: "32px 32px" }}>
              {mapPins.length ? mapPins.map((pin) => {
                const row = mapRows.find((item) => item.person.uid === pin.uid);
                if (!row) return null;
                return <button key={pin.uid} type="button" onClick={() => openPerson(row)} aria-label={t("disc.mapOpenProfile", "Open {name}, {distance} km away", { name: row.person.firstName, distance: (row.km ?? 0).toFixed(1) })} style={{ position: "absolute", insetInlineStart: `${pin.inlineStart}%`, insetBlockStart: `${pin.blockStart}%`, transform: "translate(-50%, -50%)", width: 48, height: 48, borderRadius: 99, border: "2px solid var(--card)", background: "var(--ink)", color: "var(--cream)", fontWeight: 700, boxShadow: "var(--shadow)" }}>{row.person.firstName.charAt(0).toUpperCase()}</button>;
              }) : <p className="muted" style={{ padding: 14 }}>{t("disc.mapNoPins", "No available profiles with a shared approximate location yet.")}</p>}
            </div>
            <p className="muted" style={{ margin: 0 }}>{t("disc.mapCount", "Showing {count} available profiles. Tap a pin to open the profile.", { count: mapPins.length })}</p>
          </section>
          {eligibleRows.length > 0 && section(t("disc.newVerified", "New verified"), t("disc.verifiedHint", "Real check records only"), verifiedRows, t("disc.noVerified", "No verified profiles in this area yet."))}
          {activeRows.length > 0 && section(t("disc.recentlyActive", "Recently active"), t("disc.activeHint", "Based on profile timestamps"), activeRows, "")}
          {section(t("disc.savedSection", "Saved"), t("disc.savedHint", "Profiles you hearted"), savedRows, t("disc.noSaved", "Saved profiles appear here."))}
          {needsReviewRows.length > 0 && section(t("disc.needsReview", "Needs a check"), t("disc.needsReviewHint", "Essentials stay visible"), needsReviewRows, "")}
          {radiusRows.length === 0 && people.length > 0 && <div className="card" role="status" style={{ marginBlock: 16 }}>{nearestText}</div>}
        </>}

        {people.length === 0 && <Empty mood="rest" title={t("disc.emptyTitle", "No profiles yet")} body={t("disc.emptyBody", "New profiles will show here when they fit your search.")} />}
        {radiusRows.length === 0 && people.length > 0 && nearest.length > 0 && <section aria-label={t("disc.nearestTitle", "Nearest profiles")}><h2>{t("disc.nearestTitle", "Nearest profiles")}</h2><ul style={{ paddingInlineStart: 24 }}>{nearest.map((row) => <li key={row.person.uid}>{row.person.firstName} · {row.km?.toFixed(1)} km</li>)}</ul></section>}
      </>}
    </div>
    {why && <WhyMatchSheet viewer={me} candidate={why.person} result={why.result} onClose={() => setWhy(null)} />}
    {savedCelebration && <div role="status" style={{ position: "fixed", insetInlineEnd: 18, insetBlockEnd: 20, zIndex: 90, pointerEvents: "none" }}><Bunny mood="celebrate" size={76} caption={t("disc.savedThanks", "Saved to your list")} /></div>}
  </div>;
}
