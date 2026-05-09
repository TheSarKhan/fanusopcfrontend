"use client";

import Link from "next/link";
import Image from "next/image";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function Footer() {
  const { t } = useT();
  const COLS = [
    { title: t("footer2.columnFanus"), links: [
      { label: t("footer2.linkAbout"),    href: "/about" },
      { label: t("footer2.linkTeam"),     href: "/about#team" },
      { label: t("footer2.linkCareer"),   href: "/career" },
      { label: t("footer2.linkPress"),    href: "/press" },
      { label: t("footer2.linkPartners"), href: "/partners" },
    ] },
    { title: t("footer2.columnServices"), links: [
      { label: t("footer2.linkServiceIndividual"), href: "/xidmetler" },
      { label: t("footer2.linkServiceCouple"),     href: "/xidmetler" },
      { label: t("footer2.linkServiceTeen"),       href: "/xidmetler" },
      { label: t("footer2.linkServiceCorporate"),  href: "/xidmetler" },
      { label: t("footer2.linkServiceTest"),       href: "/xidmetler" },
    ] },
    { title: t("footer2.columnResources"), links: [
      { label: t("footer2.linkArticles"), href: "/blog" },
      { label: t("footer2.linkPodcast"),  href: "/blog" },
      { label: t("footer2.linkMoodTest"), href: "/#mood" },
      { label: t("footer2.linkGlossary"), href: "/blog" },
      { label: t("footer2.linkFaq"),      href: "/#faq" },
    ] },
  ];
  return (
    <footer className="fanus-ftr" id="contact">
      <div className="fanus-ftr-cta">
        <div className="fanus-container fanus-ftr-cta__inner">
          <div className="fanus-ftr-cta__lantern">
            <Image src="/images/logos/logo-white.png" alt="Fanus" width={72} height={72} style={{ objectFit: "contain" }} />
          </div>
          <div>
            <h3 className="fanus-ftr-cta__title">{t("footer2.ctaTitle")}</h3>
            <p className="fanus-ftr-cta__sub">{t("footer2.ctaSub")}</p>
          </div>
          <div className="fanus-ftr-cta__btns">
            <Link href="/register" className="fanus-btn fanus-btn-light">{t("nav.register")} <Arrow /></Link>
            <Link href="/book" className="fanus-btn fanus-ftr-cta__ghost">{t("footer2.ctaTalkNow")}</Link>
          </div>
        </div>
      </div>

      <div className="fanus-container fanus-ftr__main">
        <div className="fanus-ftr__brand">
          <Link href="/" className="fanus-ftr__lockup">
            <Image src="/images/logos/logo-blue.png" alt="" width={56} height={40} style={{ objectFit: "contain" }} />
            <span className="fanus-ftr__lockup-type">
              <span className="fanus-ftr__lockup-name">FANUS</span>
              <span className="fanus-ftr__lockup-sub">Onlayn psixoloji mərkəz</span>
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
              <PinIcon /> Bakı, Azərbaycan
            </div>
          </div>

          <div className="fanus-ftr__socials">
            {["Instagram", "LinkedIn", "YouTube", "Telegram"].map((s) => (
              <a key={s} href="#" className="fanus-ftr__social" aria-label={s}>{s[0]}</a>
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

        <div className="fanus-ftr__col fanus-ftr__col--news">
          <h4 className="fanus-ftr__col-title">{t("footer2.newsletter")}</h4>
          <p className="fanus-ftr__news-text">{t("footer2.newsletterText")}</p>
          <form className="fanus-ftr__form" onSubmit={(e) => { e.preventDefault(); alert(t("footer2.newsletterThanks")); }}>
            <input type="email" placeholder="email@nümunə.az" required />
            <button type="submit" aria-label={t("common.submit")}><SendIcon /></button>
          </form>
        </div>
      </div>

      <div className="fanus-container fanus-ftr__bottom">
        <div>{t("footer2.rights")}</div>
        <div className="fanus-ftr__bottom-links">
          <Link href="/privacy">{t("footer2.privacy")}</Link>
          <Link href="/terms">{t("footer2.terms")}</Link>
          <Link href="/ethics">{t("footer2.ethics")}</Link>
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
          display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr 1.2fr;
          gap: 40px; padding: 64px 28px 48px;
        }
        .fanus-ftr__lockup { display: inline-flex; align-items: center; gap: 12px; }
        .fanus-ftr__lockup-type { display: flex; flex-direction: column; line-height: 1; }
        .fanus-ftr__lockup-name { font-weight: 800; font-size: 18px; letter-spacing: 0.02em; color: var(--fanus-primary); }
        .fanus-ftr__lockup-sub { font-weight: 500; font-size: 9px; letter-spacing: 0.08em; color: rgba(16,81,183,.7); margin-top: 4px; text-transform: uppercase; }
        .fanus-ftr__tag {
          color: var(--fanus-ink-3);
          font-family: var(--fanus-serif);
          font-style: italic; font-size: 16px;
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
          color: var(--fanus-primary); font-size: 13px; font-weight: 700;
          transition: all .2s;
        }
        .fanus-ftr__social:hover { background: var(--fanus-primary); border-color: var(--fanus-primary); color: white; }

        .fanus-ftr__col-title {
          font-size: 12px; font-weight: 700;
          text-transform: uppercase; letter-spacing: .08em;
          color: var(--fanus-primary); margin: 0 0 18px;
        }
        .fanus-ftr__col ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
        .fanus-ftr__col a { color: var(--fanus-ink-2); font-size: 14px; transition: color .2s; }
        .fanus-ftr__col a:hover { color: var(--fanus-primary); }
        .fanus-ftr__news-text { color: var(--fanus-ink-3); font-size: 14px; margin: 0 0 14px; line-height: 1.5; }
        .fanus-ftr__form {
          display: flex; background: white;
          border: 1px solid var(--fanus-line);
          border-radius: 999px; overflow: hidden; padding: 4px;
        }
        .fanus-ftr__form input {
          flex: 1; min-width: 0;
          background: transparent; border: none;
          padding: 8px 14px; color: var(--fanus-ink);
          font-family: inherit; font-size: 14px; outline: none;
        }
        .fanus-ftr__form input::placeholder { color: var(--fanus-ink-3); }
        .fanus-ftr__form button {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--fanus-primary); color: white;
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0; cursor: pointer; border: none;
        }
        .fanus-ftr__lang { display: inline-flex; align-items: center; gap: 6px; color: var(--fanus-ink-3); font-size: 12px; margin-top: 16px; }

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

function Arrow() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>; }
function PhoneIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-3 2a12 12 0 005 5l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 6a2 2 0 012-2z" /></svg>; }
function MailIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>; }
function PinIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6 7-12a7 7 0 00-14 0c0 6 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>; }
function SendIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3L3 10l7 3 3 7 8-17z" /><path d="M10 13l7-7" /></svg>; }
