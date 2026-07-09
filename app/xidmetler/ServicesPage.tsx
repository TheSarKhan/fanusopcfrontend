"use client";

import Link from "next/link";
import Deco from "@/components/Deco";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function ServicesPage() {
  return (
    <div className="fanus-root">
      <ServicesHero />
      <ServicesPrograms />
    </div>
  );
}

function ServicesHero() {
  const { t } = useT();
  return (
    <section className="svc-hero">
      <div className="fanus-container svc-hero__inner">
        <h1>{t("services.title")}</h1>
        <p className="svc-hero__lead">{t("services.lead")}</p>
      </div>

      <style>{`
        .svc-hero { padding: 72px 0 28px; text-align: center; }
        .svc-hero__inner { max-width: 720px; margin: 0 auto; }
        .svc-hero h1 {
          margin: 0 0 16px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(32px, 4.6vw, 54px); font-weight: 800;
          letter-spacing: -0.03em; line-height: 1.1; color: var(--fanus-ink);
        }
        .svc-hero__lead {
          font-size: 17px; color: var(--fanus-ink-3); line-height: 1.6;
          max-width: 600px; margin: 0 auto;
        }
        @media (max-width: 640px) { .svc-hero { padding: 48px 0 20px; } }
      `}</style>
    </section>
  );
}

const PROGRAMS = [
  {
    icon: "compass",
    title: "Fərdi terapiya",
    tag: "Tək-tək söhbət",
    body: "Narahatlıq, depressiya, özünə güvən, həyat qərarları. Bir psixoloqla, sizə uyğun tempdə.",
    bullets: ["50 dəqiqəlik seans", "İlk görüş pulsuz", "Həftəlik və ya 2 həftədə bir"],
  },
  {
    icon: "people",
    title: "Cütlük və ailə",
    tag: "Birlikdə qoşulun",
    body: "Anlaşılmama, etibar problemi, valideynlik. Hər iki tərəf eşidilir, mütəxəssis tərəf saxlamır.",
    bullets: ["Cütlük və ya ailə birgə", "Münaqişə həlli", "Etibarın bərpası"],
  },
  {
    icon: "chat",
    title: "Qrup seansları",
    tag: "Eyni mövzuda birlikdə",
    body: "Eyni problemi yaşayanlarla 8-12 nəfərlik kiçik qrup. Psixoloq idarə edir.",
    bullets: ["8-12 nəfərlik qrup", "Həftəlik 90 dəq", "Tematik mövzular"],
  },
  {
    icon: "heart",
    title: "Akut dəstək",
    tag: "Çətin anlarda",
    body: "Travma, kəskin stress, panik. Operator komandamız sizə uyğun psixoloqu qısa müddətdə tapır.",
    bullets: ["Tezliklə cavab", "Kəskin sessiyalar", "Davamlı plan"],
  },
  {
    icon: "smile",
    title: "Yeniyetmələr və valideynlər",
    tag: "13–18 yaş",
    body: "13–18 yaş gənclər üçün ayrı yanaşma. Valideynlər üçün də ayrı dəstək.",
    bullets: ["Yaşa uyğun yanaşma", "Valideyn iclasları", "Məktəb əlaqəsi"],
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
          <h2>{t("services.programsTitle")}</h2>
          <p>{t("services.programsSub")}</p>
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
        .svc-prog__grid {
          display: flex;
          flex-wrap: wrap;
          gap: 22px;
          justify-content: center;
        }
        .svc-card {
          flex: 0 0 calc((100% - 44px) / 3);
          max-width: calc((100% - 44px) / 3);
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
        @media (max-width: 1080px) {
          .svc-card {
            flex: 0 0 calc((100% - 22px) / 2);
            max-width: calc((100% - 22px) / 2);
          }
        }
        @media (max-width: 640px) {
          .svc-card {
            flex: 0 0 100%;
            max-width: 100%;
          }
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
