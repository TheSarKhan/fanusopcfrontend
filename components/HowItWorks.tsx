"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";
import SessionRequestModal from "@/components/SessionRequestModal";

export default function HowItWorks() {
  const { t } = useT();
  const STEPS = [
    { n: 1, title: t("how.step1Title"), text: t("how.step1Text"), img: "/images/how/step1.jpg" },
    { n: 2, title: t("how.step2Title"), text: t("how.step2Text"), img: "/images/how/step2.jpg" },
    { n: 3, title: t("how.step3Title"), text: t("how.step3Text"), img: "/images/how/step3.jpg" },
  ];
  const [active, setActive] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="fanus-how" id="how">
      <div className="fanus-container">
        <div className="fanus-how__head">
          <h2>{t("how.title")}</h2>
        </div>

        <div className="fanus-how__stepper">
          <div className="fanus-how__steps">
            <span className="fanus-how__rail" aria-hidden />
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className={`fanus-how-step${active === i ? " is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => setActive(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setActive(i); }}
              >
                <div className="fanus-how-step__node">{s.n}</div>
                <div className="fanus-how-step__body">
                  <h3 className="fanus-how-step__title">{s.title}</h3>
                  <p className="fanus-how-step__text">{s.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="fanus-how__visual">
            <div className="fanus-how__visual-frame">
              <img src={STEPS[active].img} alt="" />
            </div>
            <button type="button" onClick={() => setModalOpen(true)} className="fanus-btn fanus-btn-primary fanus-how__visual-cta">
              {t("how.cta")}
            </button>
          </div>
        </div>
      </div>

      <SessionRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <style>{`
        .fanus-how { padding: 64px 0; background: #fff; position: relative; }
        .fanus-how .fanus-container { max-width: 1100px; }
        .fanus-how__head { max-width: 720px; margin: 0 auto 48px; text-align: center; }
        .fanus-how__head h2 {
          margin: 0;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(28px, 3.4vw, 44px);
          font-weight: 700; letter-spacing: -0.025em; line-height: 1.12;
          color: var(--fanus-ink);
        }

        .fanus-how__stepper {
          display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 56px;
          align-items: start; max-width: 1040px;
        }

        /* ── Left: always-visible steps on a rail ── */
        .fanus-how__steps { position: relative; }
        .fanus-how__rail {
          position: absolute; left: 17px; top: 8px; bottom: 8px; width: 2px;
          background: linear-gradient(180deg, var(--fanus-primary) 0%, #DCE6F5 100%);
          opacity: .55;
        }
        .fanus-how-step {
          position: relative; padding: 14px 0 14px 56px;
          cursor: pointer; border-radius: 12px;
          transition: background .2s ease;
        }
        .fanus-how-step:hover { background: var(--fanus-primary-50, #F2F6FD); }
        .fanus-how-step__node {
          position: absolute; left: 0; top: 12px;
          width: 36px; height: 36px; border-radius: 50%;
          background: #DCE6F5; color: var(--fanus-primary);
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 700; z-index: 1;
          box-shadow: 0 0 0 5px #fff;
          transition: background .25s ease, color .25s ease, transform .25s ease;
        }
        .fanus-how-step.is-active .fanus-how-step__node {
          background: var(--fanus-primary); color: #fff;
          box-shadow: 0 0 0 5px #fff, 0 6px 14px rgba(16,81,183,.25);
          transform: scale(1.08);
        }
        .fanus-how-step__body { min-width: 0; }
        .fanus-how-step__title {
          margin: 0 0 6px; font-size: 18px; font-weight: 700;
          color: var(--fanus-ink-3); letter-spacing: -0.01em;
          transition: color .2s ease;
        }
        .fanus-how-step.is-active .fanus-how-step__title { color: var(--fanus-ink); }
        .fanus-how-step__text {
          margin: 0; font-size: 14.5px; line-height: 1.6; color: var(--fanus-ink-3);
          transition: color .2s ease;
        }
        .fanus-how-step.is-active .fanus-how-step__text { color: var(--fanus-ink-2); }

        /* ── Right: single large photo + CTA ── */
        .fanus-how__visual { position: sticky; top: 110px; }
        .fanus-how__visual-frame {
          width: 100%; aspect-ratio: 4 / 3; border-radius: 20px; overflow: hidden;
          background: #EAF2FD; margin-bottom: 20px;
        }
        .fanus-how__visual-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .fanus-how__visual-cta { width: 100%; }

        @media (max-width: 760px) {
          .fanus-how__stepper { grid-template-columns: 1fr; gap: 28px; }
          .fanus-how__visual { position: static; order: -1; }
        }
      `}</style>
    </section>
  );
}
