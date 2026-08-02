import { azOrdinal } from "@/lib/datetime";
import type { Locale } from "@/lib/i18n/messages";

/**
 * Sıra sayı — AZ-də sait ahəngli şəkilçi ("3-cü"), digər dillərdə sadə rəqəm,
 * çünki lüğətdəki ifadə formatı özü verir: "Session #3", "3. seans", "Сессия №3".
 *
 * Ayrıca modulda saxlanılır: əvvəl iki səhifədə təkrarlanmışdı və biri `page.tsx`
 * faylından export edilirdi. Next.js səhifə fayllarında yalnız müəyyən export-lara
 * icazə verir, ona görə həmin export bütün frontend build-ini sındırırdı.
 */
export function ordinalFor(locale: Locale, n: number): string {
  return locale === "az" ? azOrdinal(n) : String(n);
}
