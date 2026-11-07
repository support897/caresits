import { t } from "../i18n";

export type PreviewKind = "bookings" | "messages" | "calendar" | "chats";
const SAMPLES: Record<PreviewKind, { who: string; line: string; tag: string; tint: string }[]> = {
  bookings: [
    { who: "Mia", line: "Tue 4 Mar, 3:00 to 6:30 pm", tag: "Accepted", tint: "sage" },
    { who: "Sam", line: "Sat 8 Mar, 9:00 am to 1:00 pm", tag: "Requested", tint: "peach" },
  ],
  messages: [
    { who: "Mia", line: "Hi! I can do Tuesday after school.", tag: "New", tint: "lav" },
    { who: "Sam", line: "Thanks, see you Saturday.", tag: "", tint: "sky" },
  ],
  calendar: [
    { who: "3:00 pm", line: "School pickup with Mia", tag: "Pickup", tint: "peach" },
    { who: "4:00 pm", line: "Painting and snack", tag: "Activity", tint: "lav" },
  ],
  chats: [
    { who: "Nana", line: "Sent a photo from the park", tag: "New", tint: "lav" },
    { who: "Mia (nanny)", line: "Nap done, ate all lunch", tag: "", tint: "sky" },
  ],
};
/** Clearly labelled sample rows so a new, empty screen shows what it will look like. Not real data. */
export function ExamplePreview({ kind }: { kind: PreviewKind }) {
  return <section aria-label={t("preview.label", "Example of how this will look")} style={{ margin: "6px 0 0", opacity: 0.92 }}>
    <p className="muted" style={{ margin: "0 0 8px", textAlign: "center", fontWeight: 700 }}>{t("preview.title", "Here is how it will look")}</p>
    {SAMPLES[kind].map((s) => <div key={s.who} className={`card tint-${s.tint}`} style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, marginBottom: 10, boxShadow: "none" }} aria-hidden="true">
      <span className="av" style={{ background: "#fff" }}>{s.who.slice(0, 1)}</span>
      <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block" }}>{s.who}</b><span>{s.line}</span></span>
      {s.tag && <span className="tag info">{s.tag}</span>}
    </div>)}
    <p className="muted" style={{ margin: 0, textAlign: "center", fontSize: 17 }}>{t("preview.example", "Example only. Your real ones will show here.")}</p>
  </section>;
}
