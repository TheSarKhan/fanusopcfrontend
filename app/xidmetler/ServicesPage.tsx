"use client";

import Link from "next/link";
import Deco from "@/components/Deco";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function ServicesPage() {
  return (
    <div className="fanus-root">
      <ServicesHero />
      <ServicesPrograms />
      <ServicesMatch />
    </div>
  );
}

function ServicesHero() {
  const { t } = useT();
  return (
    <section className="svc-hero">
      <Deco type="wave-top" style={{ top: -20, left: "-4%", width: 520, opacity: .55 }} anim="drift" />
      <Deco type="blob-cloud" style={{ top: 40, right: "-6%", width: 360, opacity: .55 }} anim="drift" />
      <Deco type="sphere-blue" style={{ top: "55%", left: "8%", width: 60, opacity: .8 }} anim="floatY" />
      <Deco type="dot-small" style={{ top: "20%", right: "15%", width: 38, opacity: .8 }} />

      <div className="svc-hero__bg" aria-hidden>
        <svg viewBox="0 0 1440 600" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id="svcHeroBg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#F2F6FD" />
              <stop offset="100%" stopColor="#E4ECFA" />
            </linearGradient>
          </defs>
          <rect width="1440" height="600" fill="url(#svcHeroBg)" />
        </svg>
      </div>

      <div className="fanus-container svc-hero__inner">
        <div className="svc-hero__copy">
          <div className="fanus-eyebrow"><span className="dash" /> {t("services.eyebrow")}</div>
          <h1>{t("services.title")}</h1>
          <p className="svc-hero__lead">{t("services.lead")}</p>
          <div className="svc-hero__cta">
            <Link href="#programs" className="fanus-btn fanus-btn-primary fanus-btn-lg">
              {t("how.cta")} <Arrow />
            </Link>
          </div>
        </div>

        <div className="svc-hero__visual" aria-hidden>
          <div className="svc-hero__glow svc-hero__glow--1" />
          <div className="svc-hero__glow svc-hero__glow--2" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-xidmetler.png"
            alt="Fanus xidmətləri — psixoloji dəstək"
            className="svc-hero__img"
            draggable={false}
          />
        </div>
      </div>

      <style>{`
        .svc-hero { position: relative; padding: 56px 0 110px; overflow: hidden; }
        .svc-hero__bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
        .svc-hero__inner {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 48px; align-items: center;
          min-height: 460px;
        }
        .svc-hero__copy h1 {
          margin: 18px 0 18px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(38px, 5.4vw, 68px);
          font-weight: 800; letter-spacing: -0.035em; line-height: 1.1;
          color: var(--fanus-ink);
        }
        .svc-hero__lead { font-size: 18px; color: var(--fanus-ink-3); line-height: 1.6; max-width: 480px; margin: 0; }
        .svc-hero__cta { margin-top: 32px; }

        .svc-hero__visual {
          position: relative;
          width: 100%; aspect-ratio: 16/10; min-height: 380px;
        }
        .svc-hero__img {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: contain;
          z-index: 2;
          animation: svcHeroFloat 6s ease-in-out infinite;
          user-select: none;
        }
        @keyframes svcHeroFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        .svc-hero__glow { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(40px); z-index: 1; }
        .svc-hero__glow--1 {
          top: -8%; right: 8%; width: 220px; height: 220px;
          background: radial-gradient(circle, rgba(245,185,70,.30), transparent 65%);
          animation: svcHeroFlicker 3.5s ease-in-out infinite;
        }
        .svc-hero__glow--2 {
          bottom: -6%; left: 6%; width: 260px; height: 260px;
          background: radial-gradient(circle, rgba(16,81,183,.22), transparent 65%);
          animation: svcHeroFlicker 4.5s ease-in-out infinite -2s;
        }
        @keyframes svcHeroFlicker {
          0%, 100% { opacity: .9; transform: scale(1); }
          50%      { opacity: .55; transform: scale(1.08); }
        }

        @media (max-width: 980px) {
          .svc-hero__inner { grid-template-columns: 1fr; }
          .svc-hero__visual { min-height: 320px; }
        }
      `}</style>
    </section>
  );
}

const PROGRAMS = [
  {
    icon: "compass",
    title: "Fərdi terapiya",
    tag: "Özünüzlə baş-başa",
    body: "Bir psixoloqla, sizə uyğun tempdə işləyin. Narahatlıq, depressiya, özgüvən və həyat dönüşləri üzrə.",
    bullets: ["50 dəq seans", "Sizə uyğun mütəxəssis", "İlk görüş pulsuz", "Həftəlik və ya 2 həftədə bir"],
  },
  {
    icon: "people",
    title: "Cütlük terapiyası",
    tag: "Birlikdə daha güclü",
    body: "Münasibətdəki gərginliyi yumşaq, neytral məkanda araşdırın. Hər iki tərəf eşidilir.",
    bullets: ["Hər iki tərəf üçün məkan", "Kommunikasiya alətləri", "Münaqişə həlli", "Etibarın bərpası"],
  },
  {
    icon: "monitor",
    title: "Onlayn seans",
    tag: "Harada olsanız yanınızdayıq",
    body: "Brauzer və ya tətbiq. Heç bir quraşdırma yoxdur. Evdən, ofisdən və ya yoldan iştirak edin.",
    bullets: ["Şifrələnmiş video", "Mobil və masaüstü", "Xatırlatma bildirişləri", "Asan dəyişdirmə"],
  },
  {
    icon: "chat",
    title: "Qrup terapiyası",
    tag: "Birlikdə sağalın",
    body: "8-12 nəfərlik kiçik qrup. Eyni mövzunu yaşayan insanlarla peşəkar rəhbərlikdə.",
    bullets: ["8-12 nəfərlik qrup", "Həftəlik 90 dəq", "Tematik sessiyalar", "Qarşılıqlı dəstək"],
  },
  {
    icon: "heart",
    title: "Böhran dəstəyi",
    tag: "Çətin anlarda yanınızdayıq",
    body: "Kəskin emosional ağrıda yumşaq, peşəkar müşaiət. Heç bir mühakimə yoxdur — yalnız dəstək.",
    bullets: ["24 saat ərzində cavab", "Kəskin sessiyalar", "Davamlı plan", "113 ilə əməkdaşlıq"],
  },
  {
    icon: "smile",
    title: "Uşaq & yeniyetmə",
    tag: "Gənclikdən güclü başlanğıc",
    body: "8-18 yaş üçün xüsusi olaraq hazırlanmış format. Valideyn ilə birlikdə yumşaq yanaşma.",
    bullets: ["Yaşa uyğun yanaşma", "Valideyn iclasları", "Oyun terapiyası", "Məktəb əlaqəsi"],
  },
];

function ServicesPrograms() {
  const { t } = useT();
  return (
    <section className="svc-prog" id="programs">
      <Deco type="mesh-blob" style={{ top: 60, right: "-5%", width: 400, opacity: .45 }} anim="drift" />
      <Deco type="blob-1" style={{ bottom: 80, left: "-4%", width: 280, opacity: .5 }} anim="drift" />

      <div className="fanus-container">
        <div className="svc-head">
          <div className="fanus-eyebrow"><span className="dash" /> {t("services.eyebrow")} <span className="dash" /></div>
          <h2>{t("services.title")}</h2>
          <p>{t("psyList.matchCtaSub")}</p>
        </div>

        <div className="svc-prog__grid">
          {PROGRAMS.map((p, i) => (
            <article key={i} className="svc-card">
              <div className="svc-card__icon"><PgmIcon name={p.icon} /></div>
              <h3 className="svc-card__title">{p.title}</h3>
              <div className="svc-card__tag">{p.tag}</div>
              <p className="svc-card__body">{p.body}</p>
              <ul className="svc-card__list">
                {p.bullets.map((b, j) => (
                  <li key={j}>
                    <span className="svc-card__check"><CheckIcon /></span>
                    {b}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="svc-card__btn">
                {t("how.cta")} <Arrow size={14} />
              </Link>
            </article>
          ))}
        </div>
      </div>

      <style>{`
        .svc-prog { padding: 110px 0; position: relative; overflow: hidden; }
        .svc-prog > .fanus-container { position: relative; z-index: 1; }
        .svc-head { text-align: center; max-width: 760px; margin: 0 auto 56px; }
        .svc-head .fanus-eyebrow { justify-content: center; }
        .svc-head h2 {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.1; color: var(--fanus-ink);
          margin: 16px 0 14px;
        }
        .svc-head p { font-size: 17px; color: var(--fanus-ink-3); margin: 0; }
        .svc-prog__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
        .svc-card {
          background: white; border: 1px solid var(--fanus-line);
          border-radius: 22px; padding: 28px;
          display: flex; flex-direction: column; gap: 14px;
          transition: transform .3s ease, box-shadow .3s ease, border-color .3s ease;
        }
        .svc-card:hover {
          transform: translateY(-4px);
          border-color: var(--fanus-primary-200);
          box-shadow: 0 24px 50px rgba(16,81,183,.1);
        }
        .svc-card__icon {
          width: 48px; height: 48px; border-radius: 14px;
          background: var(--fanus-primary-50); color: var(--fanus-primary);
          display: inline-flex; align-items: center; justify-content: center;
        }
        .svc-card__title { font-size: 22px; font-weight: 700; margin: 0; line-height: 1.2; color: var(--fanus-ink); }
        .svc-card__tag { font-size: 13px; font-weight: 600; color: var(--fanus-primary); }
        .svc-card__body { font-size: 14.5px; color: var(--fanus-ink-3); line-height: 1.6; margin: 0; }
        .svc-card__list { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 8px; }
        .svc-card__list li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fanus-ink-2); }
        .svc-card__check {
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--fanus-primary-50); color: var(--fanus-primary);
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .svc-card__btn {
          margin-top: auto;
          padding: 12px 18px; border-radius: 12px;
          font-weight: 600; font-size: 14px;
          background: var(--fanus-primary-50); color: var(--fanus-primary);
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          transition: background .2s, color .2s, transform .2s;
        }
        .svc-card__btn:hover { background: var(--fanus-primary); color: white; transform: translateY(-1px); }
        @media (max-width: 1080px) { .svc-prog__grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .svc-prog__grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function ServicesMatch() {
  const { t } = useT();
  return (
    <section className="svc-match">
      <Deco type="circles-mix" style={{ top: 30, right: "6%", width: 220, opacity: .55 }} />
      <Deco type="target" style={{ bottom: 30, left: "8%", width: 130, opacity: .55 }} anim="drift" />

      <div className="fanus-container">
        <div className="svc-head">
          <div className="fanus-eyebrow"><span className="dash" /> {t("psyList.matchCtaTitle")} <span className="dash" /></div>
          <h2>{t("psyList.title")}</h2>
          <p>{t("psyList.matchCtaSub")}</p>
          <div className="svc-match__cta">
            <Link href="/psychologists" className="fanus-btn fanus-btn-primary">
              {t("psyList.seeAll")} <Arrow />
            </Link>
            <Link href="/register" className="fanus-btn fanus-btn-ghost">{t("nav.register")}</Link>
          </div>
        </div>
      </div>

      <style>{`
        .svc-match {
          padding: 90px 0;
          background: linear-gradient(180deg, var(--fanus-bg) 0%, var(--fanus-primary-50) 100%);
          position: relative; overflow: hidden;
        }
        .svc-match > .fanus-container { position: relative; z-index: 1; }
        .svc-match .svc-head { margin: 0 auto; }
        .svc-match__cta {
          display: flex; justify-content: center; gap: 12px;
          margin-top: 28px; flex-wrap: wrap;
        }
      `}</style>
    </section>
  );
}

function Arrow({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
function CheckIcon() { return <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4L19 6" /></svg>; }

function PgmIcon({ name }: { name: string }) {
  const p = { width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 1.7, viewBox: "0 0 24 24", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "compass") return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M16 8l-2 6-6 2 2-6 6-2z" /></svg>;
  if (name === "people")  return <svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M15 14c2 .3 4 1.7 4.5 4.5" /></svg>;
  if (name === "monitor") return <svg {...p}><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
  if (name === "chat")    return <svg {...p}><path d="M4 5h16v11H8l-4 4V5z" /></svg>;
  if (name === "heart")   return <svg {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z" /></svg>;
  if (name === "smile")   return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><circle cx="9" cy="9" r="1.2" fill="currentColor" /><circle cx="15" cy="9" r="1.2" fill="currentColor" /></svg>;
  return null;
}
