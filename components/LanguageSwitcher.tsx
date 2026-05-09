"use client";

import { useT } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/messages";
import { meApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

const LABELS: Record<Locale, string> = { az: "AZ", ru: "RU", en: "EN" };

export default function LanguageSwitcher({ variant = "default" }: { variant?: "default" | "compact" }) {
  const { locale, setLocale } = useT();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const l = e.target.value as Locale;
    setLocale(l);
    if (getStoredUser()) {
      meApi.setLocale(l).catch(() => { /* offline-tolerant */ });
    }
  };

  return (
    <select
      className={`lang-switcher${variant === "compact" ? " lang-switcher--compact" : ""}`}
      value={locale}
      onChange={onChange}
      aria-label="Language"
    >
      {(["az", "ru", "en"] as Locale[]).map(l => (
        <option key={l} value={l}>{LABELS[l]}</option>
      ))}
    </select>
  );
}
