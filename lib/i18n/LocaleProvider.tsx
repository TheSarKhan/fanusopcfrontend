"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readCookie, writeCookie } from "@/lib/crossSiteCookie";
import {
  DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALE_COOKIE_NAME,
  format, resolveMessage,
  type Locale, type MessageKey,
} from "./messages";

const COOKIE_NAME = LOCALE_COOKIE_NAME;
const COOKIE_TTL_DAYS = 365;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function detectInitialLocale(): Locale {
  // Explicit cookie wins; otherwise always default to DEFAULT_LOCALE (az) —
  // we deliberately do NOT fall back to the browser's Accept-Language, since
  // that made the site open in Turkish/English for visitors whose OS/browser
  // language wasn't Azerbaijani even though our audience is Azerbaijan-based.
  const fromCookie = readCookie(COOKIE_NAME);
  if (fromCookie && (SUPPORTED_LOCALES as readonly string[]).includes(fromCookie)) {
    return fromCookie as Locale;
  }
  return DEFAULT_LOCALE;
}

/**
 * `initialLocale` root layout-dan gəlir: server sorğudakı `fanus-locale`
 * kukisini oxuyur. Bu olmadan server hər zaman DEFAULT_LOCALE ilə render edirdi,
 * yəni səhifə əvvəlcə azərbaycanca gəlirdi və yalnız hidratasiyadan sonra
 * seçilmiş dilə keçirdi — server mətni ilə klient mətni uyğunsuz olduğuna görə
 * bəzi bölmələr (məs. FAQ siyahısı) azərbaycanca qalırdı.
 */
export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  useEffect(() => {
    // Kuki varsa server artıq düzgün dili verib — yenidən təyin etməyə ehtiyac yoxdur.
    // Kuki yoxdursa brauzerin dilinə baxırıq (detectInitialLocale-un 2-ci addımı).
    const detected = initialLocale ?? detectInitialLocale();
    if (detected !== locale) setLocaleState(detected);
    // Reflect on <html> so screen readers / SEO get the right hint.
    document.documentElement.lang = detected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeCookie(COOKIE_NAME, next, COOKIE_TTL_DAYS);
    if (typeof document !== "undefined") document.documentElement.lang = next;
  }, []);

  const t = useCallback((key: MessageKey, vars?: Record<string, string | number>) => {
    return format(resolveMessage(locale, key as string), vars);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Returns `t(key)` plus locale + setter. Safe to call outside the provider —
 * falls back to the default locale, which keeps every legacy page working
 * while we migrate them to actual translations.
 */
export function useT() {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => {},
    t: (key: MessageKey, vars?: Record<string, string | number>) =>
      format(resolveMessage(DEFAULT_LOCALE, key as string), vars),
  } as LocaleContextValue;
}
