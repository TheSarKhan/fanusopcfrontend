"use client";

import React, { useState, useEffect, useRef } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/messages";
import { meApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { FlagAZ, FlagRU, FlagEN, FlagTR } from "@/components/FlagIcons";

const FLAGS: Record<Locale, () => React.ReactElement> = {
  az: FlagAZ,
  ru: FlagRU,
  en: FlagEN,
  tr: FlagTR,
};
const LABELS: Record<Locale, string> = { az: "AZ", ru: "RU", en: "EN", tr: "TR" };

export default function LanguageSwitcher({
  variant = "default",
  align = "right",
}: {
  variant?: "default" | "compact";
  /** Which edge the dropdown anchors to. Use "left" inside the narrow sidebar so
   *  it opens toward the content instead of off-screen. */
  align?: "left" | "right";
}) {
  const { locale, setLocale } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (l: Locale) => {
    setLocale(l);
    setOpen(false);
    if (getStoredUser()) meApi.setLocale(l).catch(() => {});
  };

  const CurrentFlag = FLAGS[locale];

  return (
    <div className={`lsw${variant === "compact" ? " lsw--compact" : ""}${align === "left" ? " lsw--left" : ""}`} ref={ref}>
      <button
        className="lsw__btn"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        type="button"
      >
        <CurrentFlag />
        <span className="lsw__code">{LABELS[locale]}</span>
        <svg className={`lsw__chevron${open ? " is-open" : ""}`} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="lsw__menu" role="listbox">
          {(["az", "ru", "en", "tr"] as Locale[]).map(l => {
            const F = FLAGS[l];
            return (
              <button
                key={l}
                className={`lsw__opt${l === locale ? " is-active" : ""}`}
                onClick={() => select(l)}
                role="option"
                aria-selected={l === locale}
                type="button"
              >
                <F />
                <span className="lsw__code">{LABELS[l]}</span>
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        .lsw { position: relative; }
        .lsw__btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 9px 18px; border-radius: 999px;
          background: transparent; border: 1px solid var(--fanus-line);
          color: var(--fanus-ink); cursor: pointer;
          transition: background .15s, border-color .15s;
          white-space: nowrap; font-weight: 600;
        }
        /* Compact (panel topbar / sidebar): flag-only square button that mirrors
           the logo / notification bell — 40px, 12px radius, bordered. */
        .lsw--compact .lsw__btn {
          width: 40px; height: 40px; padding: 0; gap: 0;
          justify-content: center; border-radius: 12px;
        }
        /* Yalnız trigger düyməsində gizlə — açılan menyudakı AZ/RU/EN etiketləri qalsın. */
        .lsw--compact .lsw__btn .lsw__code,
        .lsw--compact .lsw__btn .lsw__chevron { display: none; }
        .lsw__btn:hover { background: var(--fanus-primary-50); border-color: var(--fanus-primary-300); }
        .lsw__code { font-size: 14px; font-weight: 600; }
        .lsw__chevron { transition: transform .2s; flex-shrink: 0; color: var(--fanus-ink-3); }
        .lsw__chevron.is-open { transform: rotate(180deg); }

        .lsw__menu {
          position: absolute; top: calc(100% + 8px); right: 0;
          background: #fff; border: 1px solid var(--fanus-line);
        }
        .lsw--left .lsw__menu { left: 0; right: auto; }
        .lsw__menu {
          border-radius: 14px; box-shadow: 0 8px 28px rgba(10,26,51,.12);
          padding: 6px; min-width: 100px; z-index: 200;
          display: flex; flex-direction: column; gap: 2px;
          animation: lswIn .15s ease;
        }
        @keyframes lswIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lsw__opt {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 12px; border-radius: 9px;
          background: transparent; border: none; cursor: pointer;
          font-size: 14px; font-weight: 500; color: var(--fanus-ink);
          text-align: left; transition: background .12s; width: 100%;
        }
        .lsw__opt:hover { background: var(--fanus-primary-50); }
        .lsw__opt.is-active { background: #EAF2FD; color: var(--fanus-primary); font-weight: 700; }
      `}</style>
    </div>
  );
}
