"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { buildPanelUrl, decodeAccessToken, isTokenExpired } from "@/lib/auth";
import { useT } from "@/lib/i18n/LocaleProvider";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const { t } = useT();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [panelUrl, setPanelUrl] = useState<string | null>(null);

  const navLinks = [
    { label: t("nav.about"),          href: "/about" },
    { label: t("home.heroSecondaryCta"), href: "/xidmetler" },
    { label: t("nav.psychologists"),  href: "/psychologists" },
    { label: t("nav.blog"),           href: "/blog" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const cookieMatch = document.cookie.match(/(?:^|;\s*)accessToken=([^;]+)/);
    const token = cookieMatch ? decodeURIComponent(cookieMatch[1]) : localStorage.getItem("accessToken");
    if (!token || isTokenExpired(token)) { setPanelUrl(null); return; }
    const payload = decodeAccessToken(token);
    if (payload?.role) {
      const rt = localStorage.getItem("refreshToken");
      setPanelUrl(buildPanelUrl(payload.role, token, rt ?? undefined));
    }
  }, []);

  const isLoggedIn = panelUrl !== null;

  return (
    <header className={`fanus-nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="fanus-container fanus-nav__inner">
        <Link href="/" className="fanus-nav__brand" aria-label="Fanus">
          <span className="fanus-nav__mark">
            <Image src="/images/logos/logo-blue.png" alt="" width={56} height={40} priority />
          </span>
          <span className="fanus-nav__type">
            <span className="fanus-nav__type-name">FANUS</span>
            <span className="fanus-nav__type-sub">Onlayn psixoloji mərkəz</span>
          </span>
        </Link>

        <nav className="fanus-nav__links" aria-label="Əsas naviqasiya">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="fanus-nav__link">
              <span>{l.label}</span>
              <span className="fanus-nav__glow" aria-hidden="true" />
            </Link>
          ))}
        </nav>

        <div className="fanus-nav__cta">
          <LanguageSwitcher variant="compact" />
          {isLoggedIn ? (
            <a href={panelUrl!} className="fanus-btn fanus-btn-primary fanus-btn-sm">
              {t("nav.myAccount")}
            </a>
          ) : (
            <>
              <Link href="/login" className="fanus-nav__login">{t("nav.login")}</Link>
              <Link href="/register" className="fanus-btn fanus-btn-primary fanus-btn-sm">
                {t("nav.register")}
                <ArrowRight />
              </Link>
            </>
          )}
        </div>

        <button
          className="fanus-nav__menu"
          aria-label="Menyu"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          ) : (
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          )}
        </button>
      </div>

      {open && (
        <div className="fanus-nav__mobile">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="fanus-nav__link" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <LanguageSwitcher variant="compact" />
            {isLoggedIn ? (
              <a href={panelUrl!} className="fanus-btn fanus-btn-primary" style={{ flex: 1 }}>{t("nav.myAccount")}</a>
            ) : (
              <>
                <Link href="/login" className="fanus-btn fanus-btn-ghost" style={{ flex: 1 }} onClick={() => setOpen(false)}>{t("nav.login")}</Link>
                <Link href="/register" className="fanus-btn fanus-btn-primary" style={{ flex: 1 }} onClick={() => setOpen(false)}>{t("nav.register")}</Link>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .fanus-nav {
          position: sticky; top: 0; z-index: 50;
          backdrop-filter: blur(14px) saturate(1.2);
          -webkit-backdrop-filter: blur(14px) saturate(1.2);
          background: rgba(255,255,255,0.72);
          border-bottom: 1px solid transparent;
          transition: background .3s, border-color .3s, box-shadow .3s;
        }
        .fanus-nav.is-scrolled {
          background: rgba(255,255,255,0.92);
          border-bottom-color: var(--fanus-line);
          box-shadow: 0 2px 12px rgba(10,26,51,.04);
        }
        .fanus-nav__inner {
          display: flex; align-items: center; justify-content: space-between;
          gap: 24px; padding: 14px 28px;
        }
        .fanus-nav__brand {
          display: inline-flex; align-items: center; gap: 12px;
        }
        .fanus-nav__mark { display: inline-flex; align-items: center; }
        .fanus-nav__mark img { object-fit: contain; height: 40px; width: auto; }
        .fanus-nav__type { display: flex; flex-direction: column; line-height: 1; }
        .fanus-nav__type-name {
          font-weight: 800; font-size: 18px; letter-spacing: 0.02em;
          color: var(--fanus-primary);
        }
        .fanus-nav__type-sub {
          font-weight: 500; font-size: 9px; letter-spacing: 0.08em;
          color: rgba(16,81,183,.7); margin-top: 4px; text-transform: uppercase;
        }
        .fanus-nav__links { display: flex; align-items: center; gap: 4px; }
        .fanus-nav__link {
          position: relative; padding: 10px 16px;
          font-size: 14px; font-weight: 500; color: var(--fanus-ink-2);
          border-radius: 999px; transition: color .2s;
        }
        .fanus-nav__link:hover { color: var(--fanus-primary); }
        .fanus-nav__glow {
          position: absolute; inset: 6px; border-radius: 999px;
          background: var(--fanus-primary-50); opacity: 0;
          transition: opacity .2s; z-index: -1;
        }
        .fanus-nav__link:hover .fanus-nav__glow { opacity: 1; }
        .fanus-nav__cta { display: flex; gap: 10px; align-items: center; }
        .fanus-nav__login {
          font-size: 14px; font-weight: 500; color: var(--fanus-ink-2);
          padding: 8px 14px; border-radius: 999px;
        }
        .fanus-nav__login:hover { color: var(--fanus-primary); }
        .fanus-nav__menu {
          display: none; padding: 8px; color: var(--fanus-ink);
          background: transparent; border: none; cursor: pointer;
        }
        .fanus-nav__mobile {
          display: none; flex-direction: column;
          padding: 12px 20px 20px; background: white;
          border-top: 1px solid var(--fanus-line); gap: 4px;
        }
        @media (max-width: 980px) {
          .fanus-nav__links, .fanus-nav__cta { display: none; }
          .fanus-nav__menu { display: inline-flex; }
          .fanus-nav__mobile { display: flex; }
        }
      `}</style>
    </header>
  );
}

function ArrowRight() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
