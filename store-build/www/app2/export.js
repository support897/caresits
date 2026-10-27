// Caresitters app2: data export.
// gatherExport is pure. It takes the spaces it is given and
// builds one copy of what is there. It invents nothing. A
// space that is not given becomes null, or an empty list for
// children, day story and sent messages, and the summary
// says plainly that the section is not in this copy.
// downloadExport is the browser side. It reads the window
// seams and the saved questionnaire bundle, builds the copy
// with gatherExport, and saves it as a file. The family state
// comes through the live getter family.js keeps (the static
// CARESITS_FAMILY hook is assigned once at boot and goes
// stale inside a session), and when no finished questionnaire
// exists the in progress draft supplies the answers.

import { doneKey, draftKey } from "./storage-keys.js";

const cleanWords = (value) => String(value)
  .split("-").join(" ")
  .split("—").join(" ")
  .split("–").join(" ")
  .trim();

const countOf = (value) => {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  if (value == null) return 0;
  return 1;
};

export function gatherExport(spaces) {
  const s = spaces || {};
  const me = s.me ?? null;
  const profileIn = s.profile ?? null;
  let profile = null;
  if (
    me && profileIn &&
    typeof me === "object" && typeof profileIn === "object" &&
    !Array.isArray(me) && !Array.isArray(profileIn)
  ) {
    profile = { ...me, ...profileIn };
  } else {
    profile = profileIn ?? me ?? null;
  }

  const answers = s.questionnaire?.answers ?? null;
  const hasProfile = profile != null;
  const hasAnswers = answers != null;
  const hasChildren = s.children != null;
  const hasDayStory = s.dayStory != null;
  const hasMessages = s.messages != null;
  const hasCalendar = s.calendar != null;

  const children = hasChildren ? s.children : [];
  const dayStory = hasDayStory ? s.dayStory : [];
  const messagesSent = hasMessages ? s.messages : [];
  const calendar = hasCalendar ? s.calendar : null;

  const summary = [];
  if (s.nowIso) {
    // Date separators are slashes so the line carries no dash.
    summary.push("Made on " + String(s.nowIso).split("-").join("/"));
  }
  if (!hasProfile) {
    summary.push("Profile: not in this copy");
  } else {
    const name = profile && typeof profile === "object" ? (profile.name || profile.displayName || "") : "";
    const side = profile && typeof profile === "object" ? (profile.side || "") : "";
    if (name && side) summary.push("Profile: " + cleanWords(name) + ", " + cleanWords(side));
    else if (name) summary.push("Profile: " + cleanWords(name));
    else if (side) summary.push("Profile: " + cleanWords(side));
    else summary.push("Profile: saved");
  }
  summary.push(hasAnswers ? "Answers: " + countOf(answers) + " saved" : "Answers: not in this copy");
  summary.push(hasChildren ? "Children: " + countOf(children) : "Children: not in this copy");
  if (!hasDayStory) {
    summary.push("Day Story: not in this copy");
  } else {
    const dayCount = countOf(dayStory);
    summary.push("Day Story: " + dayCount + (dayCount === 1 ? " note" : " notes"));
  }
  summary.push(hasMessages ? "Messages sent: " + countOf(messagesSent) : "Messages sent: not in this copy");
  summary.push(hasCalendar ? "Pair calendar: in this copy" : "Pair calendar: not in this copy");

  return { profile, answers, children, dayStory, messagesSent, calendar, summary };
}

export function exportFilename() {
  return "CaresittersMyData.json";
}

export function downloadExport() {
  if (typeof document === "undefined") return null;
  const w = typeof window !== "undefined" ? window : {};
  const me = w.CARESITS_ME ?? undefined;
  const trustMe = w.CARESITS_TRUST?.me ?? null;
  const extraProfile = w.CARESITS_EXPORT_DATA?.profile ?? null;
  let profile;
  if (
    trustMe && extraProfile &&
    typeof trustMe === "object" && typeof extraProfile === "object" &&
    !Array.isArray(trustMe) && !Array.isArray(extraProfile)
  ) {
    profile = { ...trustMe, ...extraProfile };
  } else {
    profile = extraProfile ?? trustMe ?? undefined;
  }

  let questionnaire = null;
  try {
    const key = doneKey();
    const raw = key && typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    questionnaire = raw ? JSON.parse(raw) : null;
  } catch {
    questionnaire = null;
  }
  if (!questionnaire) questionnaire = w.CARESITS_EXPORT_DATA?.questionnaire ?? undefined;
  if (!questionnaire) {
    // No finished questionnaire: the in progress draft still
    // holds the user's answers, so they ride in the copy. A
    // finished bundle always wins (it is read first, above).
    try {
      const key = draftKey();
      const rawDraft = key && typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
      const draft = rawDraft ? JSON.parse(rawDraft) : null;
      if (draft && draft.answers) questionnaire = { answers: draft.answers };
    } catch {
      // A broken draft never blocks the rest of the copy.
    }
  }

  // The live getter first: CARESITS_FAMILY is assigned once at
  // boot and goes stale the moment the user adds a child or a
  // Day Story note in this session. family.js keeps the getter
  // current at every commit, so the copy holds what is on
  // screen now. The static hook stays as the fallback.
  const liveFamily = typeof w.CARESITS_FAMILY_NOW === "function" ? w.CARESITS_FAMILY_NOW() : null;
  const family = liveFamily ?? w.CARESITS_FAMILY ?? null;
  const children = family?.children ?? undefined;
  const dayStory = family?.entries ?? undefined;
  const messages = w.CARESITS_EXPORT_DATA?.messages ?? (
    w.CARESITS_THREAD
      ? (Array.isArray(w.CARESITS_THREAD.messages) ? w.CARESITS_THREAD.messages.filter((m) => m && m.mine === true) : [])
      : []
  );
  const calendar = w.CARESITS_EXPORT_DATA?.calendar ?? null;

  const data = gatherExport({
    me,
    profile,
    questionnaire,
    children,
    dayStory,
    messages,
    calendar,
    nowIso: new Date().toISOString(),
  });

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFilename();
  if (document.body) document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return data;
}
