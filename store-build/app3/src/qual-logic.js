// USAGE: import qualificationStatus and qualificationDates to show conservative, date-aware qualification states.
const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (typeof value.toDate === "function") return isoDay(value.toDate());
    if (typeof value.seconds === "number") return isoDay(new Date(value.seconds * 1000));
  }
  if (typeof value === "number") return isoDay(new Date(value));
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = text.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const my = text.match(/^(\d{1,2})[/. -](\d{4})$/);
  if (my) {
    const month = Number(my[1]);
    if (month < 1 || month > 12) return "";
    return `${my[2]}-${String(month).padStart(2, "0")}-${new Date(Number(my[2]), month, 0).getDate()}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

export function qualificationDates(doc = {}) {
  return {
    checkedOn: doc.checkedOn ?? doc.dateChecked ?? doc.checkedAt ?? doc.verifiedOn ?? doc.verifiedAt ?? null,
    expiresOn: doc.expiresOn ?? doc.expiry ?? doc.expiryDate ?? doc.expiryAt ?? doc.expiresAt ?? null,
  };
}

export function qualificationStatus(doc = {}, today = new Date()) {
  const { checkedOn, expiresOn } = qualificationDates(doc);
  const todayDay = isoDay(today) || new Date().toISOString().slice(0, 10);
  const expiryDay = isoDay(expiresOn);
  if (expiryDay && expiryDay < todayDay) return "expired";
  if (expiryDay && (Date.parse(`${expiryDay}T00:00:00Z`) - Date.parse(`${todayDay}T00:00:00Z`)) / DAY_MS <= 30) return "needs renewal";

  const raw = String(doc.status || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (["under review", "in review", "reviewing", "review"].includes(raw)) return "under review";
  if (raw === "expired") return raw;
  if (["needs renewal", "renew"].includes(raw)) return "needs renewal";

  const hasCheckEvidence = Boolean(checkedOn || doc.verifiedBy);
  if (raw === "verified") return hasCheckEvidence ? "verified" : "under review";
  if (hasCheckEvidence) return "verified";
  return "submitted";
}

export function qualificationDateDay(value) {
  return isoDay(value);
}
