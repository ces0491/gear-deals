/** Dates as YYYY-MM-DD strings in South African time, which is UTC+2 all year. */

const SA_ZONE = "Africa/Johannesburg";
const DAY_MS = 24 * 60 * 60 * 1000;

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SA_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayInSouthAfrica(now: Date = new Date()): string {
  return isoFormatter.format(now);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const displayFormatter = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "18 Nov 2026". */
export function formatDisplayDate(date: string): string {
  return displayFormatter.format(new Date(`${date}T00:00:00Z`));
}

const timeFormatter = new Intl.DateTimeFormat("en-ZA", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: SA_ZONE,
});

/** "05:12", South African time. */
export function formatTimeInSouthAfrica(iso: string): string {
  return timeFormatter.format(new Date(iso));
}
