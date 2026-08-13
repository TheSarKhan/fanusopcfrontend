import { az } from "./dictionaries/az";
import { ru } from "./dictionaries/ru";
import { en } from "./dictionaries/en";
import { tr } from "./dictionaries/tr";

export const SUPPORTED_LOCALES = ["az", "ru", "en", "tr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "az";

/**
 * Seçilmiş dilin saxlandığı kuki. Bu fayl «use client» deyil, ona görə həm
 * root layout (server), həm də LocaleProvider (klient) eyni adı oxuya bilir —
 * sabiti klient modulundan idxal etsək, serverdə sətir yox, modul-referens gəlir
 * və kuki heç vaxt tapılmır.
 */
export const LOCALE_COOKIE_NAME = "fanus-locale";

/** Kuki dəyərini təhlükəsiz Locale-ə çevirir; tanınmayan dəyər → null. */
export function parseLocale(value: string | undefined | null): Locale | null {
  if (value && (SUPPORTED_LOCALES as readonly string[]).includes(value)) {
    return value as Locale;
  }
  return null;
}

/**
 * Kuki yoxdursa (ilk ziyarət) — Cloudflare-in `cf-ipcountry` header-inə görə
 * dil təxmin edilir. Əvvəllər brauzerin Accept-Language-inə baxılmırdı (OS dili
 * ilə real auditoriya üst-üstə düşmürdü); ölkə əsaslı təxmin daha etibarlıdır və
 * istifadəçi əl ilə dil seçən kimi kuki bunu həmişəlik üstələyir.
 */
export function mapCountryToLocale(countryCode: string | undefined | null): Locale {
  switch ((countryCode ?? "").toUpperCase()) {
    case "AZ": return "az";
    case "RU": return "ru";
    case "TR": return "tr";
    case "US": case "GB": return "en";
    default: return DEFAULT_LOCALE;
  }
}

/** AZ is the source of truth — keys defined there are guaranteed to exist. */
export type Messages = typeof az;
export type MessageKey = NestedKeyOf<Messages>;

type NestedKeyOf<T extends object> = {
  [K in keyof T & (string | number)]: T[K] extends object
    ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
    : `${K}`;
}[keyof T & (string | number)];

const dictionaries: Record<Locale, unknown> = { az, ru, en, tr };

export function getDictionary(locale: Locale): unknown {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

/**
 * Resolves a dotted key against a locale's dictionary, falling back to AZ if
 * the key is missing in the chosen locale (common during incremental
 * translation) and finally returning the key itself for visibility.
 */
export function resolveMessage(locale: Locale, key: string): string {
  const dict = getDictionary(locale) as Record<string, unknown>;
  const fallback = dictionaries[DEFAULT_LOCALE] as Record<string, unknown>;
  const fromLocale = walk(dict, key);
  if (typeof fromLocale === "string") return fromLocale;
  const fromAz = walk(fallback, key);
  if (typeof fromAz === "string") return fromAz;
  return key;
}

function walk(obj: Record<string, unknown> | undefined, dottedKey: string): unknown {
  if (!obj) return undefined;
  let cur: unknown = obj;
  for (const seg of dottedKey.split(".")) {
    if (cur && typeof cur === "object" && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** {name} placeholders → values. Numbers and strings are inlined as-is. */
export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`
  );
}
