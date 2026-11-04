export function moneyLabel(value: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(value);
}

export function dateLabel(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

export function timestampDate(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate().toISOString().slice(0, 10);
  return typeof value === "string" ? value.slice(0, 10) : "";
}
