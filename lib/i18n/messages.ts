import { az } from "./dictionaries/az";
import { ru } from "./dictionaries/ru";
import { en } from "./dictionaries/en";

export const SUPPORTED_LOCALES = ["az", "ru", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "az";

/** AZ is the source of truth — keys defined there are guaranteed to exist. */
export type Messages = typeof az;
export type MessageKey = NestedKeyOf<Messages>;

type NestedKeyOf<T extends object> = {
  [K in keyof T & (string | number)]: T[K] extends object
    ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
    : `${K}`;
}[keyof T & (string | number)];

const dictionaries: Record<Locale, unknown> = { az, ru, en };

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
