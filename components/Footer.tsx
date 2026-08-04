"use client";

import Link from "next/link";
import Image from "next/image";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function Footer() {
  const { t } = useT();
  // Yalnız real mövcud bölmələrə keçidlər — saxta səhifə (karyera, mətbuat,
  // podkast, lüğət) və işləməyən bülleten formu footer-dən çıxarılıb.
  const COLS = [
    { title: t("footer2.columnPlatform"), links: [
      { label: t("footer2.linkAbout"),    href: "/about" },
      { label: t("nav.services"),         href: "/xidmetler" },
      { label: t("nav.psychologists"),    href: "/psychologists" },
      { label: t("nav.tests"),            href: "/tests" },
      { label: t("nav.blog"),             href: "/blog" },
    ] },
    { title: t("footer2.columnAccount"), links: [
      { label: t("nav.register"),         href: "/register" },
      { label: t("nav.login"),            href: "/login" },
      { label: t("footer2.linkJoinPsy"),  href: "/register?role=psychologist" },
    ] },
    { title: t("footer2.columnSupport"), links: [
      { label: t("nav.contact"),          href: "/contact" },
      { label: t("footer2.linkFaq"),      href: "/#faq" },
      { label: t("footer2.terms"),        href: "/terms" },
      { label: t("footer2.privacy"),      href: "/privacy" },
    ] },
  ];
  return (
    <footer className="fanus-ftr" id="contact">

      <div className="fanus-container fanus-ftr__main">
        <div className="fanus-ftr__brand">
          <Link href="/" className="fanus-ftr__lockup" aria-label="Fanus">
            <span className="fanus-ftr__mark">
              <Image src="/images/logos/logo-mark.png" alt="Fanus" width={1035} height={1856} priority />
            </span>
            {/* Navbar-dakı loqo ilə eyni yazı bloku. */}
            <span className="fanus-ftr__logo-text">
              <span className="fanus-ftr__logo-name">FANUS</span>
              <span className="fanus-ftr__logo-sub">
                <span>Online</span>
                <span>Psychology</span>
                <span>Center</span>
              </span>
            </span>
          </Link>
          <p className="fanus-ftr__tag">{t("footer2.tag")}</p>

          <div className="fanus-ftr__contact">
            <a href="tel:+994121234567" className="fanus-ftr__contact-row">
              <PhoneIcon /> +994 12 123 45 67
            </a>
            <a href="mailto:salam@fanus.az" className="fanus-ftr__contact-row">
              <MailIcon /> salam@fanus.az
            </a>
            <div className="fanus-ftr__contact-row">
              <PinIcon /> {t("pub.location")}
            </div>
          </div>

          <div className="fanus-ftr__socials">
            {SOCIALS.map(({ label, Icon }) => (
              <a key={label} href="#" className="fanus-ftr__social" aria-label={label}><Icon /></a>
            ))}
          </div>
        </div>

        {COLS.map((c) => (
          <div key={c.title} className="fanus-ftr__col">
            <h4 className="fanus-ftr__col-title">{c.title}</h4>
            <ul>
              {c.links.map((l) => (
                <li key={l.href + l.label}><Link href={l.href}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}

      </div>

      {/* Böhran xəbərdarlığı — Fanus təcili yardım xidməti deyil (112 / 103). */}
      <div className="fanus-ftr__crisis" role="note">
        <div className="fanus-container fanus-ftr__crisis-inner">
          <span className="fanus-ftr__crisis-icon" aria-hidden="true"><AlertIcon /></span>
          <p>{t("footer2.crisis")}</p>
        </div>
      </div>

      <div className="fanus-container fanus-ftr__bottom">
        <div>{t("footer2.rights")}</div>
        {/* Etika kodeksi səhifəsi hazır olanda /ethics keçidi bura qayıdacaq. */}
        <div className="fanus-ftr__bottom-links">
          <Link href="/privacy">{t("footer2.privacy")}</Link>
          <Link href="/terms">{t("footer2.terms")}</Link>
        </div>
      </div>

      <style>{`
        .fanus-ftr {
          background: linear-gradient(180deg, #FFFFFF 0%, #F2F6FD 100%);
          color: var(--fanus-ink); position: relative; overflow: hidden;
          border-top: 1px solid var(--fanus-line);
        }
        .fanus-ftr-cta {
          background: linear-gradient(135deg, var(--fanus-primary), var(--fanus-primary-600));
          border-bottom: 1px solid rgba(255,255,255,.1);
          position: relative; overflow: hidden;
        }
        .fanus-ftr-cta::before {
          content: ""; position: absolute; right: -10%; top: -50%;
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(245,185,70,.25), transparent 60%);
        }
        .fanus-ftr-cta__inner {
          display: flex; align-items: center; gap: 32px;
          padding: 48px 28px;
          flex-wrap: wrap; position: relative;
        }
        .fanus-ftr-cta__lantern { flex-shrink: 0; filter: drop-shadow(0 0 24px rgba(245,185,70,.35)); }
        .fanus-ftr-cta__title { font-size: 30px; font-weight: 700; color: white; margin: 0 0 4px; letter-spacing: -.02em; }
        .fanus-ftr-cta__sub { color: rgba(255,255,255,.75); margin: 0; }
        .fanus-ftr-cta__btns { margin-left: auto; display: flex; gap: 10px; flex-wrap: wrap; }
        .fanus-ftr-cta__ghost {
          background: transparent; color: white;
          border: 1px solid rgba(255,255,255,.3);
        }
        .fanus-ftr-cta__ghost:hover { background: rgba(255,255,255,.1); }

        .fanus-ftr__main {
          display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: 40px; padding: 64px 28px 48px;
        }
        .fanus-ftr__lockup { display: inline-flex; align-items: center; gap: 5px; }
        .fanus-ftr__mark { display: inline-flex; align-items: center; }
        .fanus-ftr__mark img { object-fit: contain; height: 58px; width: auto; }
        /* Navbar-dakı loqo yazı bloku ilə eyni (bax Navbar.tsx .fanus-nav__logo-text). */
        .fanus-ftr__logo-text {
          display: flex; flex-direction: column; justify-content: center;
          border-left: 2px solid var(--fanus-primary);
          padding-left: 11px;
        }
        .fanus-ftr__logo-name {
          font-size: 20px; font-weight: 800; line-height: 1;
          letter-spacing: .04em; color: var(--fanus-primary);
        }
        .fanus-ftr__logo-sub {
          display: flex; flex-direction: column; margin-top: 5px;
          font-size: 8px; font-weight: 700; line-height: 1.28;
          letter-spacing: .14em; text-transform: uppercase; color: var(--fanus-primary);
        }
        .fanus-ftr__tag {
          color: var(--fanus-ink-3);
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-weight: 500; font-size: 16px;
          margin: 16px 0 24px; max-width: 240px;
        }
        .fanus-ftr__contact { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
        .fanus-ftr__contact-row { display: inline-flex; align-items: center; gap: 10px; color: var(--fanus-ink-2); font-size: 14px; }
        .fanus-ftr__contact-row:hover { color: var(--fanus-primary); }
        .fanus-ftr__socials { display: flex; gap: 8px; }
        .fanus-ftr__social {
          width: 36px; height: 36px; border-radius: 50%;
          background: white; border: 1px solid var(--fanus-line);
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--fanus-primary);
          transition: all .2s;
        }
        .fanus-ftr__social:hover { background: var(--fanus-primary); border-color: var(--fanus-primary); color: white; }

        .fanus-ftr__col-title {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: 12px; font-weight: 500;
          text-transform: uppercase; letter-spacing: .08em;
          color: var(--fanus-primary); margin: 0 0 18px;
        }
        .fanus-ftr__col ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
        .fanus-ftr__col a { color: var(--fanus-ink-2); font-size: 14px; transition: color .2s; }
        .fanus-ftr__col a:hover { color: var(--fanus-primary); }
        .fanus-ftr__lang { display: inline-flex; align-items: center; gap: 6px; color: var(--fanus-ink-3); font-size: 12px; margin-top: 16px; }

        .fanus-ftr__crisis {
          background: #FFF7EC;
          border-top: 1px solid #F3E3C8;
        }
        .fanus-ftr__crisis-inner {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 14px 28px;
        }
        .fanus-ftr__crisis-icon {
          color: #B45309; flex-shrink: 0; display: inline-flex; margin-top: 2px;
        }
        .fanus-ftr__crisis p {
          margin: 0; font-size: 13px; line-height: 1.55;
          color: #7C5A1E;
        }

        .fanus-ftr__bottom {
          display: flex; align-items: center; justify-content: space-between;
          padding: 24px 28px;
          border-top: 1px solid var(--fanus-line);
          color: var(--fanus-ink-3); font-size: 13px;
          flex-wrap: wrap; gap: 16px;
        }
        .fanus-ftr__bottom-links { display: flex; gap: 24px; }
        .fanus-ftr__bottom-links a { color: var(--fanus-ink-3); }
        .fanus-ftr__bottom-links a:hover { color: var(--fanus-primary); }

        @media (max-width: 980px) {
          .fanus-ftr__main { grid-template-columns: 1fr 1fr; }
          .fanus-ftr__brand { grid-column: 1 / -1; }
          .fanus-ftr-cta__btns { margin-left: 0; }
        }
        @media (max-width: 600px) {
          .fanus-ftr__main { grid-template-columns: 1fr; }
          .fanus-ftr__bottom { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </footer>
  );
}

function AlertIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9L2.5 17.5a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13.5" /><circle cx="12" cy="16.8" r="0.6" fill="currentColor" stroke="none" /></svg>; }
function PhoneIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-3 2a12 12 0 005 5l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 6a2 2 0 012-2z" /></svg>; }
function MailIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>; }
function PinIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6 7-12a7 7 0 00-14 0c0 6 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>; }
function SendIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3L3 10l7 3 3 7 8-17z" /><path d="M10 13l7-7" /></svg>; }
function InstagramIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" /></svg>; }
function LinkedInIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><line x1="7.5" y1="10.5" x2="7.5" y2="16.5" /><circle cx="7.5" cy="7" r="0.6" fill="currentColor" stroke="none" /><path d="M11.5 16.5v-6" /><path d="M11.5 13c0-1.7 1-2.8 2.3-2.8 1.4 0 2.2 1.1 2.2 2.8v3.5" /></svg>; }
function YoutubeIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10.3 9.3l5 2.7-5 2.7z" fill="currentColor" stroke="none" /></svg>; }

const SOCIALS = [
  { label: "Instagram", Icon: InstagramIcon },
  { label: "LinkedIn",  Icon: LinkedInIcon },
  { label: "YouTube",   Icon: YoutubeIcon },
  { label: "Telegram",  Icon: SendIcon },
];
