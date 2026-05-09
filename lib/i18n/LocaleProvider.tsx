"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LOCALE, SUPPORTED_LOCALES,
  format, resolveMessage,
  type Locale, type MessageKey,
} from "./messages";

const COOKIE_NAME = "fanus-locale";
const COOKIE_TTL_DAYS = 365;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const exp = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}

function detectInitialLocale(): Locale {
  // 1) explicit cookie wins
  const fromCookie = readCookie(COOKIE_NAME);
  if (fromCookie && (SUPPORTED_LOCALES as readonly string[]).includes(fromCookie)) {
    return fromCookie as Locale;
  }
  // 2) Accept-Language fallback (browser only — SSR pass uses default)
  if (typeof navigator !== "undefined") {
    const lang = (navigator.language || "").toLowerCase().split("-")[0];
    if ((SUPPORTED_LOCALES as readonly string[]).includes(lang)) return lang as Locale;
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Server pass renders with DEFAULT_LOCALE, then we hydrate from cookie/nav.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const detected = detectInitialLocale();
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
