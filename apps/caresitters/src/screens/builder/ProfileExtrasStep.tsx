import { useEffect, useState } from "react";
import { Button, getPrivateMediaUrl, t, uploadMediaFile } from "@cc/core";
import { ChoiceCards, type Choice } from "./ChoiceCards";

type RecordValue = Record<string, unknown>;
type Props = { uid: string; side: "family" | "carer"; extras: RecordValue; familyAuPair: boolean; carerAuPair: boolean; onChange: (next: RecordValue) => void };
const AGE_GROUPS = ["newborn", "infant", "toddler", "preschool", "school"] as const;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const ageChoices: Choice[] = AGE_GROUPS.map((age) => ({ value: age, label: t(`onb.extras.age.${age}`, { newborn: "Newborn", infant: "Infant", toddler: "Toddler", preschool: "Preschool", school: "School age" }[age]) }));
const dayChoices: Choice[] = DAYS.map((day) => ({ value: day, label: t(`onb.day.${day.toLowerCase()}`, day) }));
const asRecord = (value: unknown): RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const asText = (value: unknown): string => typeof value === "string" ? value : "";
const asList = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function ProfileExtrasStep({ uid, side, extras, familyAuPair, carerAuPair, onChange }: Props) {
  const [galleryError, setGalleryError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const gallery = asList(extras.gallery);
  const galleryKey = gallery.join("|");
  const mainIndex = typeof extras.mainPhotoIndex === "number" ? extras.mainPhotoIndex : gallery.length ? 0 : -1;
  const pair = asRecord(extras.auPair);
  const host = asRecord(extras.auPairHost);
  const household = asRecord(extras.householdPrefs);
  const essentials = asRecord(extras.essentials);

  useEffect(() => {
    let live = true;
    void Promise.all(gallery.map(async (key) => [key, await getPrivateMediaUrl(key)] as const)).then((rows) => {
      if (live) setPhotoUrls(Object.fromEntries(rows.filter((row): row is readonly [string, string] => Boolean(row[1]))));
    });
    return () => { live = false; };
  }, [galleryKey]);

  const setRoot = (key: string, value: unknown) => onChange({ ...extras, [key]: value });
  const setNested = (key: string, child: string, value: unknown) => {
    const current = asRecord(extras[key]);
    const [first, second] = child.split(".");
    const next = second ? { ...current, [first!]: { ...asRecord(current[first!]), [second]: value } } : { ...current, [child]: value };
    onChange({ ...extras, [key]: next });
  };
  const setNestedListText = (key: string, child: string, text: string, limit: number) => setNested(key, child, text.split(",").map((part) => part.trim()).filter(Boolean).slice(0, limit));
  const field = (label: string, key: string, value: unknown, maxLength: number, multiline = false) => <label className="onb-field-stack" key={key}><span className="onb-label">{t(`onb.extras.label.${key}`, label)}</span>{multiline ? <textarea className="field" maxLength={maxLength} value={asText(value)} onChange={(event) => setRoot(key, event.target.value)} /> : <input className="field" maxLength={maxLength} value={asText(value)} onChange={(event) => setRoot(key, event.target.value)} />}</label>;
  const nestedField = (label: string, key: string, child: string, value: unknown, maxLength: number, multiline = false) => <label className="onb-field-stack" key={`${key}-${child}`}><span className="onb-label">{t(`onb.extras.label.${key}.${child}`, label)}</span>{multiline ? <textarea className="field" maxLength={maxLength} value={asText(value)} onChange={(event) => setNested(key, child, event.target.value)} /> : <input className="field" maxLength={maxLength} value={asText(value)} onChange={(event) => setNested(key, child, event.target.value)} />}</label>;
  const nestedListField = (label: string, key: string, child: string, value: unknown, maxItems: number) => <label className="onb-field-stack" key={`${key}-${child}`}><span className="onb-label">{t(`onb.extras.label.${key}.${child}`, label)}</span><input className="field" value={asList(value).join(", ")} onChange={(event) => setNestedListText(key, child, event.target.value, maxItems)} aria-describedby={`extras-${key}-${child}-help`} /><span className="muted onb-note" id={`extras-${key}-${child}-help`}>{t("onb.extras.commaHelp", "Separate each item with a comma.")}</span></label>;
  const nestedToggle = (label: string, key: string, child: string, value: unknown) => <label className="onb-check-row" key={`${key}-${child}`}><input type="checkbox" checked={value === true} onChange={(event) => setNested(key, child, event.target.checked)} />{t(`onb.extras.label.${key}.${child}`, label)}</label>;
  const addPhotos = async (files: File[]) => {
    if (!files.length || uploading) return;
    setGalleryError("");
    setUploading(true);
    try {
      let next = gallery.slice(0, 6);
      for (const file of files.slice(0, 6 - next.length)) next = [...next, await uploadMediaFile({ uid, kind: "gallery", file })];
      onChange({ ...extras, gallery: next, mainPhotoIndex: mainIndex < 0 ? 0 : mainIndex });
    } catch (reason) {
      setGalleryError(reason instanceof Error ? reason.message : t("onb.extras.gallery.uploadError", "Could not save this photo. The photo service may be unavailable."));
    } finally { setUploading(false); }
  };
  const removePhoto = (index: number) => {
    const next = gallery.filter((_, item) => item !== index);
    const selected = mainIndex === index ? (next.length ? 0 : undefined) : mainIndex > index ? mainIndex - 1 : mainIndex;
    onChange({ ...extras, gallery: next, ...(selected === undefined ? { mainPhotoIndex: undefined } : { mainPhotoIndex: selected }) });
  };
  const movePhoto = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= gallery.length) return;
    const next = gallery.slice();
    [next[index], next[target]] = [next[target]!, next[index]!];
    const selected = mainIndex === index ? target : mainIndex === target ? index : mainIndex;
    onChange({ ...extras, gallery: next, mainPhotoIndex: selected });
  };

  return <div className="onb-field-stack">
    {side === "family" ? <>
      <section className="onb-extra-section"><h2>{t("onb.extras.familyTitle", "Family details")}</h2><p className="muted onb-note">{t("onb.extras.familyHelp", "Share first names only. You choose what to share with a carer.")}</p>
        {asList(extras.parentNames).map((name, index) => <div className="onb-extra-row" key={`parent-${index}`}><input className="field" maxLength={40} value={name} aria-label={t("onb.extras.parentNameNumber", "Parent first name {number}", { number: index + 1 })} onChange={(event) => setRoot("parentNames", asList(extras.parentNames).map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><Button type="button" alt small onClick={() => setRoot("parentNames", asList(extras.parentNames).filter((_, itemIndex) => itemIndex !== index))}>{t("onb.extras.removeParent", "Remove")}</Button></div>)}
        {asList(extras.parentNames).length < 4 && <Button type="button" alt onClick={() => setRoot("parentNames", [...asList(extras.parentNames), ""])}>{t("onb.extras.addParent", "Add parent first name")}</Button>}
        <div className="onb-extra-grid">{nestedToggle("Pets live in our home", "householdPrefs", "pets", household.pets)}{nestedToggle("Smoking in the home", "householdPrefs", "smoking", household.smoking)}</div>
        {nestedListField("Languages spoken at home", "householdPrefs", "languagesAtHome", household.languagesAtHome, 20)}
        <label className="onb-field-stack"><span className="onb-label">{t("onb.extras.houseRules", "House rules")}</span><textarea className="field" maxLength={300} value={asText(household.houseRules)} onChange={(event) => setNested("householdPrefs", "houseRules", event.target.value)} /></label>
        <p className="muted onb-note">{t("onb.extras.houseRulesCount", "{count}/300 characters", { count: asText(household.houseRules).length })}</p>
      </section>
      <section className="onb-extra-section"><h2>{t("onb.extras.essentialsTitle", "What needs to fit?")}</h2>
        <span className="onb-label">{t("onb.extras.scheduleEssential", "Schedule")}</span><ChoiceCards items={[{ value: "essential", label: t("onb.extras.essential", "Essential") }, { value: "flexible", label: t("onb.extras.flexible", "Flexible") }]} value={typeof essentials.schedule === "string" ? [essentials.schedule] : []} onChange={(items) => setNested("essentials", "schedule", items[0])} />
        <span className="onb-label">{t("onb.extras.budgetEssential", "Budget")}</span><ChoiceCards items={[{ value: "essential", label: t("onb.extras.essential", "Essential") }, { value: "flexible", label: t("onb.extras.flexible", "Flexible") }]} value={typeof essentials.budget === "string" ? [essentials.budget] : []} onChange={(items) => setNested("essentials", "budget", items[0])} />
        <label className="onb-check-row"><input type="checkbox" checked={essentials.minAgeGroupsOk === true} onChange={(event) => setNested("essentials", "minAgeGroupsOk", event.target.checked)} />{t("onb.extras.ageGroupsEssential", "The accepted child age groups are essential")}</label>
      </section>
    </> : <>
      <section className="onb-extra-section"><h2>{t("onb.extras.carerTitle", "Your profile photos and care")}</h2>
        <p className="muted onb-note">{t("onb.extras.galleryHelp", "Add up to six photos of yourself. Do not add children you cared for without permission.")}</p>
        <label className="onb-file-label">{t("onb.extras.galleryAdd", "Add profile photos")}<input className="field" type="file" accept="image/*" multiple disabled={uploading || gallery.length >= 6} aria-label={t("onb.extras.galleryInput", "Choose up to six profile photos")} onChange={(event) => { void addPhotos(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} /></label>
        {uploading && <p className="muted onb-note" role="status">{t("onb.extras.galleryUploading", "Saving photo…")}</p>}
        {galleryError && <p className="onb-error" role="alert">{galleryError}</p>}
        {gallery.length > 0 && <ol className="onb-gallery-list">{gallery.map((key, index) => <li className="onb-gallery-item" key={key}>
          {photoUrls[key] ? <img src={photoUrls[key]} alt={t("onb.extras.galleryPhotoAlt", "Profile photo {number}", { number: index + 1 })} /> : <span className="onb-gallery-placeholder">{t("onb.extras.galleryPreviewUnavailable", "Preview unavailable")}</span>}
          <div className="onb-gallery-controls"><span className="onb-note">{index === mainIndex ? t("onb.extras.galleryMain", "Main photo") : t("onb.extras.galleryNumber", "Photo {number}", { number: index + 1 })}</span><div className="onb-chip-row">
            {index !== mainIndex && <Button type="button" alt small onClick={() => setRoot("mainPhotoIndex", index)}>{t("onb.extras.galleryChooseMain", "Make main")}</Button>}
            {index > 0 && <Button type="button" alt small aria-label={t("onb.extras.galleryMoveEarlier", "Move photo {number} earlier", { number: index + 1 })} onClick={() => movePhoto(index, -1)}>{t("onb.extras.galleryMoveEarlierShort", "Move earlier")}</Button>}
            {index < gallery.length - 1 && <Button type="button" alt small aria-label={t("onb.extras.galleryMoveLater", "Move photo {number} later", { number: index + 1 })} onClick={() => movePhoto(index, 1)}>{t("onb.extras.galleryMoveLaterShort", "Move later")}</Button>}
            <Button type="button" alt small onClick={() => removePhoto(index)}>{t("onb.extras.galleryRemove", "Remove")}</Button>
          </div></div>
        </li>)}</ol>}
        <span className="onb-label">{t("onb.extras.ageGroupsLabel", "Age groups you can care for")}</span><ChoiceCards items={ageChoices} value={asList(extras.ageGroups)} onChange={(items) => setRoot("ageGroups", items)} multiple />
        {field("Describe your ideal family", "idealFamily", extras.idealFamily, 300, true)}
        <p className="muted onb-note">{t("onb.extras.idealFamilyHelp", "{count}/300 characters", { count: asText(extras.idealFamily).length })}</p>
      </section>
      {carerAuPair && <section className="onb-extra-section"><h2>{t("onb.extras.auPairTitle", "Au pair profile")}</h2>
        {nestedField("Home country", "auPair", "homeCountry", pair.homeCountry, 80)}{nestedField("Preferred arrival time", "auPair", "arrival", pair.arrival, 200)}
        <label className="onb-field-stack"><span className="onb-label">{t("onb.extras.label.auPair.durationMonths", "Preferred stay in months")}</span><input className="field" type="number" min="1" max="36" step="1" value={pair.durationMonths == null ? "" : String(pair.durationMonths)} onChange={(event) => setNested("auPair", "durationMonths", event.target.value ? Number(event.target.value) : undefined)} /></label>
        {nestedField("English level", "auPair", "english", pair.english, 60)}{nestedListField("Countries you hope to visit", "auPair", "destinations", pair.destinations, 20)}{nestedListField("Languages you speak", "auPair", "languages", pair.languages, 20)}
        <span className="onb-label">{t("onb.extras.auPairAges", "Child age groups you prefer")}</span><ChoiceCards items={ageChoices} value={asList(pair.ageGroups ?? pair.preferredAges)} onChange={(items) => onChange({ ...extras, auPair: { ...pair, ageGroups: items, preferredAges: items } })} multiple />
        {nestedField("Preferred accommodation", "auPair", "accommodation", pair.accommodation, 300)}{nestedField("Pocket money expectation", "auPair", "pocketMoneyExpectation", pair.pocketMoneyExpectation, 160)}{nestedListField("Cultural interests", "auPair", "culturalInterests", pair.culturalInterests, 30)}{nestedField("What matters to you in a host family?", "auPair", "expectations", pair.expectations, 300, true)}{nestedField("Visa notes or questions", "auPair", "visaNotes", pair.visaNotes, 300, true)}
        <p className="onb-privacy">{t("onb.extras.visaCaution", "Visa guidance is separate. A profile does not prove work permission, and eligibility may be unknown.")}</p>
        <div className="onb-extra-grid">{nestedToggle("Infant-care experience", "auPair", "infant", pair.infant)}{nestedToggle("Can drive", "auPair", "drives", pair.drives)}{nestedToggle("Can swim", "auPair", "swim", pair.swim)}</div>
      </section>}
    </>}
    {side === "family" && familyAuPair && <section className="onb-extra-section"><h2>{t("onb.extras.hostTitle", "Au pair host family details")}</h2>
      {nestedField("Country", "auPairHost", "country", host.country, 80)}{nestedField("Room offered", "auPairHost", "room", host.room, 300, true)}{nestedField("Accommodation", "auPairHost", "accommodation", host.accommodation, 300, true)}{nestedField("Meals", "auPairHost", "meals", host.meals, 300, true)}
      <span className="onb-label">{t("onb.extras.hostDaysOff", "Usual days off")}</span><ChoiceCards items={dayChoices} value={asList(host.daysOff)} onChange={(items) => setNested("auPairHost", "daysOff", items)} multiple />
      {nestedField("City", "auPairHost", "location.city", asRecord(host.location).city, 80)}{nestedField("Suburb", "auPairHost", "location.suburb", asRecord(host.location).suburb, 80)}
      <label className="onb-field-stack"><span className="onb-label">{t("onb.extras.hostDuration", "Intended stay in months")}</span><input className="field" type="number" min="1" max="36" step="1" value={host.durationMonths == null ? "" : String(host.durationMonths)} onChange={(event) => setNested("auPairHost", "durationMonths", event.target.value ? Number(event.target.value) : undefined)} /></label>
      <label className="onb-field-stack"><span className="onb-label">{t("onb.extras.hostPocketMoney", "Pocket money per week (A$)")}</span><input className="field" type="number" min="0" step="1" value={host.pocketMoneyPerWeek == null ? "" : String(host.pocketMoneyPerWeek)} onChange={(event) => setNested("auPairHost", "pocketMoneyPerWeek", event.target.value ? Number(event.target.value) : undefined)} /></label>
      <label className="onb-field-stack"><span className="onb-label">{t("onb.extras.hostHours", "Care hours per week")}</span><input className="field" type="number" min="0" max="168" step="1" value={host.hoursPerWeek == null ? "" : String(host.hoursPerWeek)} onChange={(event) => setNested("auPairHost", "hoursPerWeek", event.target.value ? Number(event.target.value) : undefined)} /></label>
      {nestedListField("Childcare duties", "auPairHost", "childcareDuties", host.childcareDuties, 30)}{nestedListField("Other housework", "auPairHost", "otherHousework", host.otherHousework, 30)}{nestedListField("Languages spoken at home", "auPairHost", "languages", host.languages, 20)}{nestedField("What you expect from an au pair", "auPairHost", "expectations", host.expectations, 300, true)}
      <p className="onb-privacy">{t("onb.extras.hostDutiesCaution", "Childcare duties and unrelated housework stay in separate lists.")}</p>
      <div className="onb-extra-grid">{nestedToggle("Visa help offered", "auPairHost", "visaHelp", host.visaHelp)}{nestedToggle("Visa support offered", "auPairHost", "visaSupport", host.visaSupport)}{nestedToggle("Infant care needed", "auPairHost", "infantCareNeeded", host.infantCareNeeded)}</div>
    </section>}
    {side === "family" && <section className="onb-extra-section"><h2>{t("onb.extras.familyGalleryTitle", "Family photo gallery")}</h2><p className="muted onb-note">{t("onb.extras.familyGalleryPrivacy", "Only add family photos you choose to share. Do not add child photos here.")}</p><label className="onb-file-label">{t("onb.extras.galleryAdd", "Add profile photos")}<input className="field" type="file" accept="image/*" multiple disabled={uploading || gallery.length >= 6} aria-label={t("onb.extras.galleryInput", "Choose up to six profile photos")} onChange={(event) => { void addPhotos(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} /></label>{galleryError && <p role="alert" className="onb-error">{galleryError}</p>}{gallery.length > 0 && <ol className="onb-gallery-list">{gallery.map((key, index) => <li className="onb-gallery-item" key={key}>{photoUrls[key] ? <img src={photoUrls[key]} alt={t("onb.extras.galleryPhotoAlt", "Profile photo {number}", { number: index + 1 })} /> : <span className="onb-gallery-placeholder">{t("onb.extras.galleryPreviewUnavailable", "Preview unavailable")}</span>}<div className="onb-gallery-controls"><span className="onb-note">{index === mainIndex ? t("onb.extras.galleryMain", "Main photo") : t("onb.extras.galleryNumber", "Photo {number}", { number: index + 1 })}</span><div className="onb-chip-row">{index !== mainIndex && <Button type="button" alt small onClick={() => setRoot("mainPhotoIndex", index)}>{t("onb.extras.galleryChooseMain", "Make main")}</Button>}{index > 0 && <Button type="button" alt small onClick={() => movePhoto(index, -1)}>{t("onb.extras.galleryMoveEarlierShort", "Move earlier")}</Button>}{index < gallery.length - 1 && <Button type="button" alt small onClick={() => movePhoto(index, 1)}>{t("onb.extras.galleryMoveLaterShort", "Move later")}</Button>}<Button type="button" alt small onClick={() => removePhoto(index)}>{t("onb.extras.galleryRemove", "Remove")}</Button></div></div></li>)}</ol>}</section>}
  </div>;
}
