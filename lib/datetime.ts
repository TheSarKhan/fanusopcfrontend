/**
 * Azerbaijan timezone helpers — fixed UTC+4 (no DST since 2016).
 *
 * MODEL (QA-2026-06-23 P0 düzəlişi): backend bütün vaxtları **naive
 * `LocalDateTime`** kimi saxlayır və offsetsiz (Z olmadan) qaytarır — yəni
 * saxlanan dəyər artıq **Asia/Baku divar-saatıdır (wall-clock)**. Ona görə
 * heç bir yerdə UTC çevrilməsi etmirik:
 *   • `azLocalToISO` datetime-local dəyərini OLDUĞU KİMİ (offsetsiz) göndərir —
 *     əvvəlki −4 saat sürüşməsi (14:00 → 10:00Z → naive 10:00) aradan qalxır.
 *   • Göstərmə naive stringi Asia/Baku divar-saatı kimi qəbul edir, brauzerin
 *     öz timezone-undan asılı OLMAYARAQ (Date.UTC ilə qurulur).
 * Z/offset daşıyan ISO (məs. `new Date().toISOString()`) həqiqi instant kimi
 * qəbul olunur və AZT-yə çevrilir.
 */

const AZ_OFFSET_HOURS = 4;
const AZ_OFFSET_MS = AZ_OFFSET_HOURS * 60 * 60 * 1000;

/** Naive datetime stringi (offsetsiz) komponentlərə ayırır. Z/offset varsa null. */
function naiveParts(s: string): { y: number; mo: number; d: number; hh: number; mm: number; ss: number } | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], hh: +m[4], mm: +m[5], ss: m[6] ? +m[6] : 0 };
}

/**
 * Göstərmə üçün instant qurur. Naive string (AZ divar-saatı) → Date.UTC ilə
 * UTC+4 instant-a çevrilir ki, sonra Asia/Baku-da formatlananda eyni divar-saatı
 * çıxsın (brauzer timezone-undan asılı deyil). Z/offset daşıyan string və ya
 * Date olduğu kimi qaytarılır.
 */
function toInstant(input: string | Date): Date {
  if (typeof input !== "string") return input;
  const p = naiveParts(input);
  if (p) return new Date(Date.UTC(p.y, p.mo - 1, p.d, p.hh - AZ_OFFSET_HOURS, p.mm, p.ss));
  return new Date(input);
}

/**
 * datetime-local input dəyəri (YYYY-MM-DDTHH:mm, AZ divar-saatı) → backend
 * payload-u. Offsetsiz, OLDUĞU KİMİ göndərilir (saniyə tamamlanır) ki, backend
 * `LocalDateTime` eyni divar-saatını saxlasın.
 */
export function azLocalToISO(localStr: string): string {
  if (!localStr) return "";
  const m = localStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return localStr;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}`;
}

/**
 * Backend dəyərini datetime-local input üçün hazırlayır (YYYY-MM-DDTHH:mm).
 * Naive (offsetsiz) → AZ divar-saatı kimi olduğu kimi; Z/offset daşıyan ISO →
 * AZT-yə çevrilir.
 */
export function isoToAzLocal(iso: string): string {
  if (!iso) return "";
  const p = naiveParts(iso);
  if (p) {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}`;
  }
  const az = new Date(new Date(iso).getTime() + AZ_OFFSET_MS);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${az.getUTCFullYear()}-${pad(az.getUTCMonth() + 1)}-${pad(az.getUTCDate())}T${pad(az.getUTCHours())}:${pad(az.getUTCMinutes())}`;
}

/**
 * İstənilən ISO/Date-i Asia/Baku-da göstərir. Naive backend stringləri AZ
 * divar-saatı kimi qəbul olunur (brauzer timezone-undan asılı deyil).
 */
export function azFormat(input: string | Date, opts: Intl.DateTimeFormatOptions = {}): string {
  return toInstant(input).toLocaleString("az-AZ", { timeZone: "Asia/Baku", ...opts });
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
