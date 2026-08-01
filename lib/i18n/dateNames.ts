/**
 * Publik səhifələr üçün lokallaşdırılmış tarix mətnləri.
 *
 * Ay adları qəsdən lüğətdən götürülür (Intl-dən yox): `lib/datetime.ts`-də
 * qeyd olunduğu kimi bəzi runtime-larda `az-AZ` ICU datası olmur və ay adı
 * ISO formatına düşür. Lüğət yanaşması dörd dildə də determinikdir.
 */
import type { MessageKey } from "./messages";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** "12 Yanvar 2026" / "12 January 2026" / "12 января 2026" / "12 Ocak 2026" */
export function formatDateLong(t: Translate, dateStr?: string | null): string {
  const d = parse(dateStr);
  if (!d) return "";
  return `${d.getDate()} ${t(`months.m${d.getMonth() + 1}` as MessageKey)} ${d.getFullYear()}`;
}

/** Qısa ay adı ilə — kartlar üçün ("12 Yan 2026"). */
export function formatDateShort(t: Translate, dateStr?: string | null): string {
  const d = parse(dateStr);
  if (!d) return "";
  return `${d.getDate()} ${t(`months.s${d.getMonth() + 1}` as MessageKey)} ${d.getFullYear()}`;
}

/** "bu gün" / "3 gün öncə" / "2 həftə öncə" / "5 ay öncə" — 1 ildən sonra tam tarix. */
export function formatRelative(t: Translate, dateStr?: string | null): string {
  const d = parse(dateStr);
  if (!d) return "";
  const diffMs = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return t("rel.today");
  const days = Math.floor(diffMs / day);
  if (days < 7) return t("rel.daysAgo", { n: days });
  if (days < 30) return t("rel.weeksAgo", { n: Math.floor(days / 7) });
  if (days < 365) return t("rel.monthsAgo", { n: Math.floor(days / 30) });
  return formatDateLong(t, dateStr);
}

function parse(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}
