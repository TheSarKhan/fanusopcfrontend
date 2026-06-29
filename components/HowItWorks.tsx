"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function HowItWorks() {
  const { t } = useT();
  const STEPS = [
    { n: 1, title: t("how.step1Title"), text: t("how.step1Text"), img: "/images/how/step1.webp" },
    { n: 2, title: t("how.step2Title"), text: t("how.step2Text"), img: "/images/how/step2.webp" },
    { n: 3, title: t("how.step3Title"), text: t("how.step3Text"), img: "/images/how/step3.webp" },
  ];
  return (
    <section className="fanus-how" id="how">
      <div className="fanus-container">
        <div className="fanus-how__head">
          <h2>{t("how.title")}</h2>
        </div>

        <div className="fanus-how__timeline">
          <span className="fanus-how__rail" aria-hidden />

          {STEPS.map((s) => (
            <div key={s.n} className="fanus-how-step">
              <div className="fanus-how-step__node">{s.n}</div>
              <div className="fanus-how-step__card">
                <div className="fanus-how-step__body">
                  <h3 className="fanus-how-step__title">{s.title}</h3>
                  <p className="fanus-how-step__text">{s.text}</p>
                </div>
                <div className="fanus-how-step__visual">
                  <img src={s.img} alt="" loading="lazy" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="fanus-how-cta-card">
          <div className="fanus-how-cta-card__body">
            <h3>{t("how.finalTitle")}</h3>
            <Link href="/register" className="fanus-btn fanus-btn-primary">
              {t("how.cta")} <Arrow />
            </Link>
          </div>
          <div className="fanus-how-cta-card__visual">
            <img src="/images/how/step4.webp" alt="" loading="lazy" />
          </div>
        </div>
      </div>

      <style>{`
        .fanus-how { padding: 96px 0; background: #fff; position: relative; }
        .fanus-how__head { text-align: center; max-width: 720px; margin: 0 auto 48px; }
        .fanus-how__head h2 {
          margin: 0;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(28px, 3.4vw, 44px);
          font-weight: 700; letter-spacing: -0.025em; line-height: 1.12;
          color: var(--fanus-ink);
        }
        .fanus-how__timeline { position: relative; max-width: 880px; margin: 0 auto; }
        .fanus-how__rail {
          position: absolute; left: 26px; top: 30px; bottom: 64px; width: 2px;
          background: linear-gradient(180deg, var(--fanus-primary) 0%, #DCE6F5 100%);
          opacity: .55;
        }
        .fanus-how-step { position: relative; padding-left: 72px; margin-bottom: 20px; }
        .fanus-how-step__node {
          position: absolute; left: 9px; top: 26px;
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--fanus-primary); color: #fff;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 700; z-index: 1;
          box-shadow: 0 0 0 5px #fff, 0 6px 14px rgba(16,81,183,.25);
          transition: transform .25s ease;
        }
        .fanus-how-step:hover .fanus-how-step__node { transform: scale(1.12); }
        .fanus-how-step__card {
          display: flex; align-items: center; gap: 28px;
          background: #fff; border: 1px solid var(--fanus-line, #E8EEF6);
          border-radius: 20px; padding: 24px 26px;
          transition: border-color .2s ease, box-shadow .25s ease;
        }
        .fanus-how-step:hover .fanus-how-step__card {
          border-color: rgba(16,81,183,.28);
          box-shadow: 0 14px 34px rgba(16,81,183,.08);
        }
        .fanus-how-step__body { flex: 1; min-width: 0; }
        .fanus-how-step__title { margin: 0 0 8px; font-size: 19px; font-weight: 700; color: var(--fanus-ink); letter-spacing: -0.01em; }
        .fanus-how-step__text { margin: 0; font-size: 14.5px; line-height: 1.65; color: var(--fanus-ink-2); }
        .fanus-how-step__visual {
          flex-shrink: 0; width: 264px; aspect-ratio: 4 / 3;
          border-radius: 14px; overflow: hidden; background: #EAF2FD;
        }
        .fanus-how-step__visual img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .fanus-how-step__node--end { background: #E0A93B; box-shadow: 0 0 0 5px #fff, 0 6px 14px rgba(224,169,59,.3); }
        .fanus-how-cta-card {
          display: flex; align-items: center; gap: 28px;
          background: linear-gradient(135deg, #FFF8EA 0%, #FCEFCF 100%);
          border: 1px solid #F2E1BB; border-radius: 20px;
          padding: 24px 26px; overflow: hidden;
          max-width: 880px; margin: 24px auto 0;
        }
        .fanus-how-cta-card__body { flex: 1; }
        .fanus-how-cta-card__body h3 {
          margin: 0 0 18px; font-size: 22px; font-weight: 700; line-height: 1.25;
          color: var(--fanus-ink); letter-spacing: -0.02em; max-width: 380px;
        }
        .fanus-how-cta-card__visual {
          flex-shrink: 0; width: 300px; aspect-ratio: 4 / 3;
          border-radius: 14px; overflow: hidden;
        }
        .fanus-how-cta-card__visual img { width: 100%; height: 100%; object-fit: cover; display: block; }
        @media (max-width: 760px) {
          .fanus-how-step__card, .fanus-how-cta-card { flex-direction: column; align-items: stretch; }
          .fanus-how-step__visual, .fanus-how-cta-card__visual { width: 100%; order: -1; }
          .fanus-how-cta-card__body { order: 1; }
        }
      `}</style>
    </section>
  );
}

function Arrow() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function HeartIcon() {
  return <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-6-3.8-6-9a3.4 3.4 0 0 1 6-2.2A3.4 3.4 0 0 1 18 11c0 5.2-6 9-6 9z" /></svg>;
}
