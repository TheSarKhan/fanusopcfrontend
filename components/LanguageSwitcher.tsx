"use client";

import React, { useState, useEffect, useRef } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/messages";
import { meApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

/* ── Inline SVG flags (emoji unreliable on Windows) ── */
function FlagAZ() {
  return (
    <svg width="20" height="14" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, display: "block", flexShrink: 0 }}>
      <rect width="30" height="20" fill="#0092BC" />
      <rect y="6.67" width="30" height="6.66" fill="#EF3340" />
      <rect y="13.33" width="30" height="6.67" fill="#00B050" />
      <circle cx="14" cy="10" r="3.4" fill="white" />
      <circle cx="15.1" cy="10" r="2.7" fill="#EF3340" />
      <polygon points="19,10 18.55,10.38 18.73,10.91 18.22,10.64 17.82,11 17.91,10.45 17.45,10.12 18,10.06 18.2,9.55 18.46,10.04" fill="white" />
    </svg>
  );
}

function FlagRU() {
  return (
    <svg width="20" height="14" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, display: "block", flexShrink: 0 }}>
      <rect width="30" height="20" fill="#fff" />
      <rect y="6.67" width="30" height="6.66" fill="#0039A6" />
      <rect y="13.33" width="30" height="6.67" fill="#D52B1E" />
    </svg>
  );
}

function FlagEN() {
  return (
    <svg width="20" height="14" viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, display: "block", flexShrink: 0 }}>
      <rect width="60" height="40" fill="#012169" />
      {/* White saltire (wide) */}
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="12" />
      {/* Red saltire (narrow) */}
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="7" />
      {/* White cross */}
      <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="16" />
      {/* Red cross */}
      <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="10" />
    </svg>
  );
}

const FLAGS: Record<Locale, () => React.ReactElement> = {
  az: FlagAZ,
  ru: FlagRU,
  en: FlagEN,
};
const LABELS: Record<Locale, string> = { az: "AZ", ru: "RU", en: "EN" };

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
          {(["az", "ru", "en"] as Locale[]).map(l => {
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
        .lsw--compact .lsw__code,
        .lsw--compact .lsw__chevron { display: none; }
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
