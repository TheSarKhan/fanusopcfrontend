"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { buildPanelUrl, getStoredUser } from "@/lib/auth";
import { tryGetMe } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const { t } = useT();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [panelUrl, setPanelUrl] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  // Şəffaf/ağ variant yalnız tablet+ ekranlarda: mobildə hero adi ağ-fonlu mətn bloku ilə başlayır.
  const light = isHome && !scrolled && isDesktop;

  const navLinks = [
    { label: t("nav.about"),         href: "/about" },
    { label: t("nav.services"),      href: "/xidmetler" },
    { label: t("nav.psychologists"), href: "/psychologists" },
    { label: t("nav.blog"),          href: "/blog" },
    { label: t("nav.contact"),       href: "/contact" },
  ];

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(prev => {
        if (!prev && y > 80) return true;
        if (prev && y < 60) return false;
        return prev;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    // Optimistic: render panel link from the cached user record immediately…
    const cached = getStoredUser();
    if (cached?.role) setPanelUrl(buildPanelUrl(cached.role));

    // …then verify the cookie is still valid; clear if not.
    let cancelled = false;
    tryGetMe().then(me => {
      if (cancelled) return;
      if (!me) { setPanelUrl(null); return; }
      setPanelUrl(buildPanelUrl(me.role));
    });
    return () => { cancelled = true; };
  }, []);

  const isLoggedIn = panelUrl !== null;

  return (
    <header className={`fanus-nav ${scrolled ? "is-scrolled" : ""} ${light ? "fanus-nav--light" : ""}`}>
      <div className="fanus-container fanus-nav__inner">
        <Link href="/" className="fanus-nav__brand" aria-label="Fanus">
          <span className="fanus-nav__mark">
            <Image src={light ? "/images/logos/logo-white.png" : "/images/logos/logo-blue.png"} alt="" width={56} height={40} priority />
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
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          background: transparent;
          border-bottom: 1px solid transparent;
          transition: background .3s, border-color .3s, box-shadow .3s;
        }
        .fanus-nav.is-scrolled {
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(16px) saturate(1.3);
          -webkit-backdrop-filter: blur(16px) saturate(1.3);
          border-bottom-color: var(--fanus-line);
          box-shadow: 0 2px 16px rgba(10,26,51,.07);
        }

        /* ── Light (transparent-over-hero) variant — homepage, not scrolled.
           Yalnız tablet/desktopda: mobildə hero adi ağ-fonlu mətn bloku ilə başlayır. ── */
        @media (min-width: 768px) {
          .fanus-nav--light .fanus-nav__type-name { color: #fff; }
          .fanus-nav--light .fanus-nav__type-sub { color: rgba(255,255,255,.75); }
          .fanus-nav--light .fanus-nav__link { color: rgba(255,255,255,.92); }
          .fanus-nav--light .fanus-nav__link:hover { color: #fff; }
          .fanus-nav--light .fanus-nav__glow { background: rgba(255,255,255,.16); }
          .fanus-nav--light .fanus-nav__login { color: #fff; border-color: rgba(255,255,255,.5); }
          .fanus-nav--light .fanus-nav__login:hover { color: #fff; border-color: #fff; }
          .fanus-nav--light .fanus-nav__menu { color: #fff; }
          .fanus-nav--light .lsw__btn { color: #fff; border-color: rgba(255,255,255,.5); }
          .fanus-nav--light .lsw__btn:hover { background: rgba(255,255,255,.14); border-color: #fff; }
        }

        /* ── Inner ── */
        .fanus-nav__inner {
          display: flex; align-items: center; justify-content: space-between;
          gap: 24px; padding: 20px 72px;
          transition: padding .3s ease;
        }
        .fanus-nav.is-scrolled .fanus-nav__inner { padding: 10px 72px; }
        @media (max-width: 1100px) {
          .fanus-nav__inner { padding: 20px 40px; }
          .fanus-nav.is-scrolled .fanus-nav__inner { padding: 10px 40px; }
        }

        /* ── Brand ── */
        .fanus-nav__brand { display: inline-flex; align-items: center; gap: 8px; }
        .fanus-nav__mark { display: inline-flex; align-items: center; }
        .fanus-nav__mark img {
          object-fit: contain; height: 64px; width: auto;
          transition: height .3s ease;
        }
        .fanus-nav.is-scrolled .fanus-nav__mark img { height: 40px; }

        .fanus-nav__type { display: flex; flex-direction: column; line-height: 1; }
        .fanus-nav__type-name {
          font-weight: 800; letter-spacing: 0.02em;
          color: var(--fanus-primary); font-size: 22px;
          transition: font-size .3s ease;
        }
        .fanus-nav.is-scrolled .fanus-nav__type-name { font-size: 17px; }
        .fanus-nav__type-sub {
          font-weight: 500; font-size: 9px; letter-spacing: 0.08em;
          color: rgba(16,81,183,.7); margin-top: 5px; text-transform: uppercase;
          max-height: 16px; opacity: 1;
          transition: max-height .3s ease, opacity .2s ease, margin-top .3s ease;
          overflow: hidden;
        }
        .fanus-nav.is-scrolled .fanus-nav__type-sub {
          max-height: 0; opacity: 0; margin-top: 0;
        }

        /* ── Links ── */
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

        /* ── CTA ── */
        .fanus-nav__cta { display: flex; gap: 10px; align-items: center; }
        .fanus-nav__login {
          font-size: 14px; font-weight: 500; color: var(--fanus-ink-2);
          padding: 9px 18px; border-radius: 999px;
          border: 1px solid var(--fanus-line);
        }
        .fanus-nav__login:hover { color: var(--fanus-primary); border-color: var(--fanus-primary); }

        /* ── Mobile ── */
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
          .fanus-nav__inner { padding: 12px 20px; }
          .fanus-nav.is-scrolled .fanus-nav__inner { padding: 8px 20px; }
          .fanus-nav__links, .fanus-nav__cta { display: none; }
          .fanus-nav__menu { display: inline-flex; }
          .fanus-nav__mobile { display: flex; }
        }
      `}</style>
    </header>
  );
}
