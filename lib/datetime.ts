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

/**
 * Asia/Baku divar-saatının rəqəm hissələrini locale-dən ASILI OLMADAN çıxarır.
 * `toLocaleString("az-AZ", …)` bəzi runtime-larda (ICU az-AZ datası yoxdursa)
 * tarixi ISO "2026-07-13" kimi qaytarırdı — ona görə formatı əl ilə qururuq.
 * `formatToParts` yalnız rəqəm dəyərlərini verir, sıralama bizim əlimizdədir.
 */
function azNumericParts(input: string | Date): { d: string; mo: string; y: string; hh: string; mm: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(toInstant(input));
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  // en-GB hour12:false gecəyarını bəzən "24" verir — 00-a normallaşdırırıq.
  const hh = get("hour") === "24" ? "00" : get("hour");
  return { d: get("day"), mo: get("month"), y: get("year"), hh, mm: get("minute") };
}

/** Tarix — həmişə gg.aa.iiii (məs. 13.07.2026), locale-dən asılı deyil. */
export function azFormatDate(input: string | Date) {
  const p = azNumericParts(input);
  return `${p.d}.${p.mo}.${p.y}`;
}

export function azFormatTime(input: string | Date) {
  const p = azNumericParts(input);
  return `${p.hh}:${p.mm}`;
}

/** Tarix + saat — gg.aa.iiii ss:dd (məs. 13.07.2026 12:00). */
export function azFormatDateTime(input: string | Date) {
  const p = azNumericParts(input);
  return `${p.d}.${p.mo}.${p.y} ${p.hh}:${p.mm}`;
}

export function azFormatWeekday(input: string | Date) {
  return azFormat(input, { weekday: "long" });
}

/**
 * Sərbəst mətn içindəki naive ISO tarix/datetime sətirlərini istifadəçi üçün
 * oxunaqlı yerli formata çevirir:
 *   "2026-06-29T11:00" → "29.06.2026 11:00"
 *   "2026-06-29"       → "29.06.2026"
 * Bildiriş mətnləri (məs. backend `LocalDateTime` interpolasiyası) Asia/Baku
 * divar-saatını naive saxladığı üçün sadəcə yenidən düzülüş kifayətdir — TZ
 * çevrilməsi YOXDUR. Z/offset daşıyan həqiqi instant-lara toxunmur.
 */
export function humanizeDates(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(
    /(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?(?![\d:TZ+-])/g,
    (_m, y, mo, d, hh, mm) => (hh != null ? `${d}.${mo}.${y} ${hh}:${mm}` : `${d}.${mo}.${y}`)
  );
}

/**
 * Verilən vaxtdan (seans başlama/bitmə) indiyə qədər keçən REAL saat sayını
 * qaytarır. Naive Asia/Baku stringi `toInstant` ilə həqiqi instant-a çevrilir,
 * sonra `Date.now()` ilə müqayisə olunur — brauzer timezone-undan asılı deyil.
 * Mənfi nəticə vaxtın hələ gələcəkdə olduğunu bildirir. Rəy 24-saat
 * pəncərəsini hesablamaq üçün istifadə olunur.
 */
export function hoursSince(input: string | Date): number {
  return (Date.now() - toInstant(input).getTime()) / 3_600_000;
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

/** Bu gün (Asia/Baku) "YYYY-MM-DD" — DatePicker `min` üçün. */
export function azTodayIso(): string {
  return azNowLocal().slice(0, 10);
}

/** İndiki saat (Asia/Baku) "HH:MM" — TimePicker `min` üçün. */
export function azNowTime(): string {
  return azNowLocal().slice(11, 16);
}

/**
 * Üstünlük verilən tarix/saat keçmişdədirsə xəta mətni, əks halda null.
 * Seans müraciəti formalarında (Fanus təyin etsin, sürətli müraciət) istifadə
 * olunur — keçmiş vaxta müraciət göndərmək mümkün olmamalıdır.
 */
export function pastPreferredError(date?: string | null, time?: string | null): string | null {
  if (!date) return null;
  const today = azTodayIso();
  if (date < today) return "Keçmiş tarixə seans müraciəti göndərmək mümkün deyil";
  if (date === today && time && time < azNowTime()) {
    return "Seçilmiş saat artıq keçib — bu gün üçün daha gec saat seçin";
  }
  return null;
}

// Sıra sayı şəkilçisi — son rəqəmə görə sait ahəngi:
// 0→cı  1→ci  2→ci  3→cü  4→cü  5→ci  6→cı  7→ci  8→ci  9→cu
const AZ_ORDINAL: Record<number, string> = {
  0: "cı", 1: "ci", 2: "ci", 3: "cü", 4: "cü",
  5: "ci", 6: "cı", 7: "ci", 8: "ci", 9: "cu",
};

/** `azOrdinal(3)` → `"3-cü"`, `azOrdinal(6)` → `"6-cı"` */
export function azOrdinal(n: number): string {
  const lastDigit = Math.abs(n) % 10;
  return `${n}-${AZ_ORDINAL[lastDigit]}`;
}
