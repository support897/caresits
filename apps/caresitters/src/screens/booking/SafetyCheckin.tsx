import { useState } from "react";
import { Button, t } from "@cc/core";
import { loadEmergencyContacts, writeCheckIn, type BookingRecord, type EmergencyContact } from "../../data/bookings";

type Props = { booking: BookingRecord; uid: string };
export function SafetyCheckin({ booking, uid }: Props) {
  const [saving, setSaving] = useState(false);
  const [help, setHelp] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function checkIn(kind: "arrived" | "leaving" | "help") {
    if (saving) return;
    setSaving(true);
    setError("");
    if (kind === "help") {
      setHelp(true);
      void loadEmergencyContacts(uid).then(setContacts).catch(() => setContacts([]));
    }
    try {
      await writeCheckIn(booking.pairId, booking.id, uid, kind);
      setStatus(kind === "help" ? t("safety.helpSaved", "Help check-in saved.") : kind === "arrived" ? t("safety.arrivedSaved", "Arrival check-in saved.") : t("safety.leavingSaved", "Leaving check-in saved."));
    } catch {
      setError(kind === "help" ? t("safety.helpSaveError", "Emergency details are shown, but the help check-in could not be saved.") : t("safety.checkinError", "Check-in could not be saved. Check your connection."));
    } finally { setSaving(false); }
  }

  return <section className="booking-safety" aria-label={t("safety.checkinTitle", "Booking safety check-in")}>
    <div><h3>{t("safety.checkinTitle", "Safety check-in")}</h3><p className="booking-meta">{t("safety.checkinBody", "Let your care team know when you arrive or leave.")}</p></div>
    <div className="booking-actions"><Button small alt onClick={() => void checkIn("arrived")} disabled={saving}>{t("safety.arrived", "I arrived")}</Button><Button small alt onClick={() => void checkIn("leaving")} disabled={saving}>{t("safety.leaving", "I'm leaving")}</Button><Button small onClick={() => void checkIn("help")} disabled={saving}>{t("safety.needHelp", "Need help")}</Button></div>
    {status && <p role="status">{status}</p>}{error && <p className="booking-error" role="alert">{error}</p>}
    {help && <div className="booking-help"><h3>{t("safety.emergencyTitle", "Get help now")}</h3><p>{t("safety.emergencyBody", "If someone is in danger, call emergency services yourself. This app never calls for you.")}</p><p><a href="tel:000">{t("safety.call000", "Call 000")}</a></p><h3>{t("safety.contactsTitle", "Your emergency contacts")}</h3>{contacts.length ? contacts.map((contact, index) => <p key={`${contact.phone}-${index}`}><b>{contact.name}</b>{contact.relation ? ` · ${contact.relation}` : ""} · <a href={`tel:${contact.phone}`}>{contact.phone}</a></p>) : <p className="booking-meta">{t("safety.noContacts", "No saved emergency contacts are available on this device account.")}</p>}</div>}
  </section>;
}
