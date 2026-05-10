/**
 * Azerbaijan timezone helpers — fixed UTC+4 (no DST since 2016).
 *
 * Always treat datetime-local inputs and displays as Asia/Baku, regardless of
 * the browser's or server's local timezone. Backend stores everything as UTC ISO.
 */

const AZ_OFFSET_HOURS = 4;
const AZ_OFFSET_MS = AZ_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Convert a `datetime-local` input value (YYYY-MM-DDTHH:mm), treated as
 * Asia/Baku wall-clock time, into a UTC ISO string suitable for the API.
 */
export function azLocalToISO(localStr: string): string {
  if (!localStr) return "";
  const [datePart, timePart = "00:00"] = localStr.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm = 0] = timePart.split(":").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh - AZ_OFFSET_HOURS, mm);
  return new Date(utcMs).toISOString();
}

/**
 * Convert a UTC ISO string to a `datetime-local` value in Asia/Baku, for
 * populating <input type="datetime-local"> elements.
 */
export function isoToAzLocal(iso: string): string {
  if (!iso) return "";
  const az = new Date(new Date(iso).getTime() + AZ_OFFSET_MS);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${az.getUTCFullYear()}-${pad(az.getUTCMonth() + 1)}-${pad(az.getUTCDate())}T${pad(az.getUTCHours())}:${pad(az.getUTCMinutes())}`;
}

/**
 * Format any ISO/Date for display in Asia/Baku.
 */
export function azFormat(input: string | Date, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleString("az-AZ", { timeZone: "Asia/Baku", ...opts });
}

export function azFormatDate(input: string | Date) {
  return azFormat(input, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function azFormatTime(input: string | Date) {
  return azFormat(input, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function azFormatDateTime(input: string | Date) {
  return azFormat(input, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function azFormatWeekday(input: string | Date) {
  return azFormat(input, { weekday: "long" });
}

/**
 * "now" in Asia/Baku, returned as a Date whose UTC fields equal AZ wall-clock.
 * Useful for `min`/`max` attrs on datetime-local inputs.
 */
export function azNow(): Date {
  return new Date(Date.now() + AZ_OFFSET_MS);
}

/**
 * "now" formatted for datetime-local min/max attribute (Asia/Baku).
 */
export function azNowLocal(): string {
  return isoToAzLocal(new Date().toISOString());
}
