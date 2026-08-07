"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { buildPanelUrl, getStoredUser, clearUser } from "@/lib/auth";
import { verifyMe } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import LanguageSwitcher from "./LanguageSwitcher";

// Xidmətlər səhifəsindəki kartların id-ləri ilə üst-üstə düşür (bax: app/xidmetler/ServicesPage.tsx)
// ki, dropdown-dan klikləndikdə həmin xidmətə scroll etsin.
const SERVICE_KEYS: ("p1" | "p2" | "p3" | "p4" | "p5" | "p6")[] = ["p1", "p2", "p3", "p4", "p5", "p6"];

export default function Navbar() {
  const { t } = useT();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [svcOpen, setSvcOpen] = useState(false);
  const svcRef = useRef<HTMLDivElement>(null);
  // undefined = sessiya hələ yoxlanılmayıb (server render + hidrasiyaya qədər),
  // null = giriş edilməyib, string = panel ünvanı. Üç vəziyyət lazımdır: SiteChrome
  // artıq serverdə render olunduğu üçün, iki vəziyyətlə giriş etmiş istifadəçi bir an
  // "Daxil ol" görüb sonra "Hesabım"a keçərdi.
  const [panelUrl, setPanelUrl] = useState<string | null | undefined>(undefined);
  // Şəffaf/ağ variant: ana səhifədə yuxarıda (hero videonun üstündə) — mobil daxil,
  // çünki mobil hero da artıq tam-ekran tünd videodur.
  // Mobil menyu açıqdırsa light SÖNÜR: açıq menyu ağ paneldir, ağ loqo/burger ağ fonda
  // itirdi (yuxarıda, scroll=0 halında görünmürdülər).
  const light = isHome && !scrolled && !open;

  const navLinks = [
    { label: t("nav.psychologists"), href: "/psychologists" },
    { label: t("nav.tests"),         href: "/tests" },
    { label: t("nav.blog"),          href: "/blog" },
    { label: t("nav.contact"),       href: "/contact" },
  ];

  useEffect(() => {
    if (!svcOpen) return;
    const onClick = (e: MouseEvent) => {
      if (svcRef.current && !svcRef.current.contains(e.target as Node)) setSvcOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [svcOpen]);

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
    // Optimistic: render panel link from the cached user record immediately…
    const cached = getStoredUser();
    if (cached?.role) setPanelUrl(buildPanelUrl(cached.role));

    // Heç vaxt giriş etməmiş ziyarətçi üçün yoxlamağa sessiya yoxdur: sorğu
    // göndərsək /me 401 verir, o da refresh cəhdi doğurur və o da 401 —
    // brauzerin konsolunda iki qırmızı sətir qalır, halbuki heç nə sınmayıb.
    // `storeUser` girişdə yazılır, çıxışda silinir, ona görə onun olmaması
    // «bu brauzerdə sessiya yoxdur» deməkdir.
    //
    // Panel guard-da bu qısayol İŞLƏMƏZ: localStorage origin-ə bağlıdır, yəni
    // khansoft.az-da giriş edən istifadəçi üçün patient.khansoft.az-da cache boş
    // olur — orada yoxlama mütləq getməlidir.
    if (!cached) { setPanelUrl(null); return; }

    // …then STRICTLY verify the session. verifyMe (unlike tryGetMe) never falls
    // back to the cached identity — so an expired session reliably resolves to
    // null and "Hesabım" disappears in favour of Daxil ol / Qeydiyyat. We also
    // wipe the stale cache so the next load doesn't even optimistically show it.
    let cancelled = false;
    verifyMe().then(me => {
      if (cancelled) return;
      if (!me) { setPanelUrl(null); clearUser(); return; }
      setPanelUrl(buildPanelUrl(me.role));
    });
    return () => { cancelled = true; };
  }, []);

  const authKnown = panelUrl !== undefined;
  const isLoggedIn = authKnown && panelUrl !== null;

  return (
    <header className={`fanus-nav ${scrolled ? "is-scrolled" : ""} ${open ? "is-open" : ""} ${light ? "fanus-nav--light" : ""}`}>
      <div className="fanus-container fanus-nav__inner">
        <Link href="/" className="fanus-nav__brand" aria-label="Fanus">
          <span className="fanus-nav__logo">
            <span className="fanus-nav__mark">
              <Image src={light ? "/images/logos/logo-mark-white.png" : "/images/logos/logo-mark.png"} alt="Fanus" width={1035} height={1856} priority />
            </span>
            {/* Panel loqosu ilə eyni yazı bloku — brand-rəngli (light-da ağ). */}
            <span className="fanus-nav__logo-text">
              <span className="fanus-nav__logo-name">FANUS</span>
              <span className="fanus-nav__logo-sub">
                <span>Online</span>
                <span>Psychology</span>
                <span>Center</span>
              </span>
            </span>
          </span>
        </Link>

        <nav className="fanus-nav__links" aria-label="Əsas naviqasiya">
          <div className="fanus-nav__dropdown" ref={svcRef}>
            <button
              type="button"
              className="fanus-nav__link fanus-nav__dropdown-trigger"
              aria-expanded={svcOpen}
              onClick={() => setSvcOpen((o) => !o)}
            >
              <span>{t("nav.services")}</span>
              <svg
                className={`fanus-nav__chevron ${svcOpen ? "is-open" : ""}`}
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
              <span className="fanus-nav__glow" aria-hidden="true" />
            </button>
            {svcOpen && (
              <div className="fanus-nav__dropdown-menu">
                <Link href="/xidmetler" className="fanus-nav__dropdown-item fanus-nav__dropdown-item--all" onClick={() => setSvcOpen(false)}>
                  {t("nav.servicesAll")}
                </Link>
                {SERVICE_KEYS.map((key) => (
                  <Link key={key} href={`/xidmetler#${key}`} className="fanus-nav__dropdown-item" onClick={() => setSvcOpen(false)}>
                    {t(`svcPrograms.${key}Title` as MessageKey)}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="fanus-nav__link">
              <span>{l.label}</span>
              <span className="fanus-nav__glow" aria-hidden="true" />
            </Link>
          ))}
        </nav>

        <div className="fanus-nav__cta">
          <LanguageSwitcher variant="default" />
          {!authKnown ? (
            // Yer tutucu: eni giriş düymələri ilə eynidir ki, sessiya bilinəndə
            // navbar sıçramasın.
            <span aria-hidden style={{ display: "inline-block", width: 168, height: 38 }} />
          ) : isLoggedIn ? (
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
          <button
            type="button"
            className="fanus-nav__link fanus-nav__dropdown-trigger fanus-nav__dropdown-trigger--mobile"
            aria-expanded={svcOpen}
            onClick={() => setSvcOpen((o) => !o)}
          >
            <span>{t("nav.services")}</span>
            <svg
              className={`fanus-nav__chevron ${svcOpen ? "is-open" : ""}`}
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {svcOpen && (
            <div className="fanus-nav__dropdown-menu fanus-nav__dropdown-menu--mobile">
              <Link href="/xidmetler" className="fanus-nav__dropdown-item fanus-nav__dropdown-item--all" onClick={() => { setSvcOpen(false); setOpen(false); }}>
                {t("nav.servicesAll")}
              </Link>
              {SERVICE_KEYS.map((key) => (
                <Link key={key} href={`/xidmetler#${key}`} className="fanus-nav__dropdown-item" onClick={() => { setSvcOpen(false); setOpen(false); }}>
                  {t(`svcPrograms.${key}Title` as MessageKey)}
                </Link>
              ))}
            </div>
          )}
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="fanus-nav__link" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <LanguageSwitcher variant="default" />
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
        /* Mobil menyu açıqdır: açılan panel ağdır, ona görə üst zolaq da bərk ağ olmalıdır
           (əks halda yuxarıda şəffaf qalır və tünd loqo/burger video üzərinə düşür). */
        .fanus-nav.is-open {
          background: #fff;
          border-bottom-color: var(--fanus-line);
          box-shadow: 0 2px 16px rgba(10,26,51,.07);
        }

        /* ── Light (transparent-over-hero) variant — homepage, not scrolled.
           Yalnız tablet/desktopda: mobildə hero adi ağ-fonlu mətn bloku ilə başlayır. ── */
        @media (min-width: 768px) {
          /* Scoped to the inline desktop nav/cta (hidden ≤980px) — must NOT leak into
             .fanus-nav__mobile, which sits on a solid white panel and needs dark ink text. */
          .fanus-nav--light .fanus-nav__links .fanus-nav__link { color: rgba(255,255,255,.92); }
          .fanus-nav--light .fanus-nav__links .fanus-nav__link:hover { color: #fff; }
          .fanus-nav--light .fanus-nav__links .fanus-nav__glow { background: rgba(255,255,255,.16); }
          .fanus-nav--light .fanus-nav__login { color: #fff; border-color: rgba(255,255,255,.5); }
          .fanus-nav--light .fanus-nav__login:hover { color: #fff; border-color: #fff; }
          .fanus-nav--light .fanus-nav__menu { color: #fff; }
          .fanus-nav--light .fanus-nav__cta .lsw__btn { color: #fff; border-color: rgba(255,255,255,.5); }
          .fanus-nav--light .fanus-nav__cta .lsw__btn:hover { background: rgba(255,255,255,.14); border-color: #fff; }
          /* .lsw__chevron sets its own color (breaks currentColor inheritance from
             .lsw__btn) — without this it stays --fanus-ink-3 (grayish-blue) and is
             unreadable over the dark hero. */
          .fanus-nav--light .fanus-nav__cta .lsw__btn .lsw__chevron { color: #fff; }
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
        .fanus-nav__brand { display: inline-flex; align-items: center; }
        .fanus-nav__logo { display: inline-flex; align-items: center; gap: 5px; }
        .fanus-nav__mark { display: inline-flex; align-items: center; }
        .fanus-nav__mark img {
          object-fit: contain; height: 58px; width: auto;
          transition: height .3s ease;
        }
        .fanus-nav.is-scrolled .fanus-nav__mark img { height: 40px; }

        /* Panellə eyni yazı bloku: sol brand-xətt + FANUS + kiçik alt-yazı. */
        .fanus-nav__logo-text {
          display: flex; flex-direction: column; justify-content: center;
          border-left: 2px solid var(--brand);
          padding-left: 11px;
          transition: border-color .3s ease, padding-left .3s ease;
        }
        .fanus-nav__logo-name {
          font-size: 20px; font-weight: 800; line-height: 1;
          letter-spacing: .04em; color: var(--brand);
          transition: color .3s ease, font-size .3s ease;
        }
        .fanus-nav__logo-sub {
          display: flex; flex-direction: column; margin-top: 5px;
          font-size: 8px; font-weight: 700; line-height: 1.28;
          letter-spacing: .14em; text-transform: uppercase; color: var(--brand);
          transition: color .3s ease, font-size .3s ease, margin-top .3s ease;
        }
        /* Light (hero videonun üstündə, mobil daxil): ağ lockup. */
        .fanus-nav--light .fanus-nav__logo-text { border-left-color: rgba(255,255,255,.6); }
        .fanus-nav--light .fanus-nav__logo-name,
        .fanus-nav--light .fanus-nav__logo-sub { color: #fff; }
        /* Burger yuxarıda hero videonun üstündədir. Video sağ kənarda scrim zəif
           olduğundan (horizontal gradient orada ~.08) ağ ikon parlaq kadrlarda
           itə bilir — tünd drop-shadow halosu istənilən kadrda onu görünən saxlayır. */
        .fanus-nav--light .fanus-nav__menu {
          color: #fff;
          filter: drop-shadow(0 1px 4px rgba(6,14,28,.75)) drop-shadow(0 0 1px rgba(6,14,28,.6));
        }

        /* Scroll edəndə yazı da ikonla birlikdə kiçilir (hündürlüklər eyni qalsın). */
        .fanus-nav.is-scrolled .fanus-nav__logo-text { padding-left: 9px; }
        .fanus-nav.is-scrolled .fanus-nav__logo-name { font-size: 15px; }
        .fanus-nav.is-scrolled .fanus-nav__logo-sub { font-size: 6px; margin-top: 3px; letter-spacing: .12em; }

        /* ── Links ── */
        .fanus-nav__links { display: flex; align-items: center; gap: 4px; }
        .fanus-nav__link {
          position: relative; padding: 10px 16px;
          font-size: 14px; font-weight: 500; color: var(--fanus-ink-2);
          border-radius: 999px; transition: color .2s;
          background: transparent; border: none; cursor: pointer;
          font-family: inherit;
        }
        .fanus-nav__link:hover { color: var(--fanus-primary); }
        .fanus-nav__glow {
          position: absolute; inset: 6px; border-radius: 999px;
          background: var(--fanus-primary-50); opacity: 0;
          transition: opacity .2s; z-index: -1;
        }
        .fanus-nav__link:hover .fanus-nav__glow { opacity: 1; }

        /* ── Services dropdown ── */
        .fanus-nav__dropdown { position: relative; }
        .fanus-nav__dropdown-trigger { display: inline-flex; align-items: center; gap: 5px; }
        .fanus-nav__chevron { transition: transform .2s ease; flex-shrink: 0; }
        .fanus-nav__chevron.is-open { transform: rotate(180deg); }
        .fanus-nav__dropdown-menu {
          position: absolute; top: calc(100% + 10px); left: 0;
          min-width: 240px; background: #fff;
          border: 1px solid var(--fanus-line); border-radius: 16px;
          box-shadow: 0 20px 44px rgba(10,26,51,.14);
          padding: 8px; display: flex; flex-direction: column; gap: 2px;
          z-index: 60;
        }
        .fanus-nav__dropdown-item {
          padding: 10px 14px; border-radius: 10px;
          font-size: 13.5px; font-weight: 500; color: var(--fanus-ink-2);
          transition: background .15s, color .15s;
        }
        .fanus-nav__dropdown-item:hover { background: var(--fanus-primary-50); color: var(--fanus-primary); }
        .fanus-nav__dropdown-item--all {
          font-weight: 700; color: var(--fanus-primary);
          border-bottom: 1px solid var(--fanus-line); border-radius: 10px 10px 0 0;
          margin-bottom: 4px; padding-bottom: 12px;
        }
        .fanus-nav__dropdown-menu--mobile {
          position: static; box-shadow: none; border: none;
          background: var(--fanus-primary-50); margin: 2px 0 6px; padding: 6px;
        }
        .fanus-nav__dropdown-trigger--mobile { width: 100%; justify-content: space-between; }

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
          /* Lockup mobildə bir az kiçik — hamburgerlə yan-yana sığsın. */
          .fanus-nav__logo { gap: 4px; }
          .fanus-nav__mark img { height: 46px; }
          .fanus-nav.is-scrolled .fanus-nav__mark img { height: 38px; }
          .fanus-nav__logo-text { padding-left: 9px; }
          .fanus-nav__logo-name { font-size: 17px; }
          .fanus-nav__logo-sub { font-size: 7px; letter-spacing: .12em; }
        }
      `}</style>
    </header>
  );
}
