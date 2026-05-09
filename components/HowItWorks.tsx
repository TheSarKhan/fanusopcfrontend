"use client";

import Link from "next/link";
import Deco from "@/components/Deco";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function HowItWorks() {
  const { t } = useT();
  const STEPS = [
    { n: "01", title: t("how.step1Title"), text: t("how.step1Text"), icon: "send" },
    { n: "02", title: t("how.step2Title"), text: t("how.step2Text"), icon: "users" },
    { n: "03", title: t("how.step3Title"), text: t("how.step3Text"), icon: "video" },
  ];
  return (
    <section className="fanus-how" id="how">
      <Deco type="wave-line" style={{ top: "20%", left: "-8%", width: 600, opacity: .55 }} anim="drift" />
      <Deco type="blob-3" style={{ bottom: 40, right: "-3%", width: 320, opacity: .55 }} anim="drift" />
      <div className="fanus-container">
        <div className="fanus-how__head">
          <div className="fanus-eyebrow"><span className="dash" /> {t("how.eyebrow")} <span className="dash" /></div>
          <h2>{t("how.title")}</h2>
        </div>

        <div className="fanus-how__steps">
          <svg className="fanus-how__line" viewBox="0 0 1000 100" preserveAspectRatio="none">
            <path d="M 80 50 Q 250 -10 500 50 T 920 50" stroke="var(--fanus-primary)" strokeWidth="1.5" strokeDasharray="4 6" fill="none" opacity=".4" />
          </svg>

          {STEPS.map((s, i) => (
            <div key={i} className="fanus-step">
              <div className="fanus-step__bubble">
                <Icon name={s.icon} />
                <div className="fanus-step__num">{s.n}</div>
              </div>
              <h3 className="fanus-step__title">{s.title}</h3>
              <p className="fanus-step__text">{s.text}</p>
            </div>
          ))}
        </div>

        <div className="fanus-how__cta">
          <Link href="/register" className="fanus-btn fanus-btn-primary">
            {t("how.cta")} <Arrow />
          </Link>
          <span style={{ color: "var(--fanus-ink-3)", fontSize: 14 }}>{t("how.ctaNote")}</span>
        </div>
      </div>

      <style>{`
        .fanus-how { padding: 100px 0; background: linear-gradient(180deg, var(--fanus-bg) 0%, var(--fanus-primary-50) 100%); position: relative; overflow: hidden; }
        .fanus-how > .fanus-container { position: relative; z-index: 1; }
        .fanus-how__head { text-align: center; max-width: 720px; margin: 0 auto 64px; }
        .fanus-how__head .fanus-eyebrow { justify-content: center; }
        .fanus-how__head h2 {
          margin: 14px 0 0;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px);
          font-weight: 700; letter-spacing: -0.025em; line-height: 1.1;
          color: var(--fanus-ink);
        }
        .fanus-how__steps {
          position: relative;
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px;
          margin-bottom: 56px;
        }
        .fanus-how__line {
          position: absolute; left: 0; right: 0; top: 32px;
          width: 100%; height: 100px; z-index: 0;
        }
        .fanus-step { position: relative; z-index: 1; text-align: center; padding: 0 16px; }
        .fanus-step__bubble {
          position: relative; width: 88px; height: 88px;
          margin: 0 auto 24px;
          background: var(--fanus-primary); border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          box-shadow: 0 16px 32px rgba(16,81,183,.25);
        }
        .fanus-step__bubble::before {
          content: ""; position: absolute; inset: -10px;
          border-radius: 50%;
          border: 2px dashed var(--fanus-primary-300);
          opacity: .6; animation: fanusSpin 18s linear infinite;
        }
        @keyframes fanusSpin { to { transform: rotate(360deg); } }
        .fanus-step__num {
          position: absolute; top: -8px; right: -8px;
          background: white; color: var(--fanus-primary);
          width: 32px; height: 32px; border-radius: 50%;
          font-size: 12px; font-weight: 800;
          display: inline-flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 10px rgba(0,0,0,.08);
        }
        .fanus-step__title { font-size: 24px; margin: 0 0 10px; color: var(--fanus-ink); font-weight: 600; }
        .fanus-step__text { font-size: 15px; color: var(--fanus-ink-3); max-width: 280px; margin: 0 auto; }
        .fanus-how__cta { display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; }
        @media (max-width: 860px) {
          .fanus-how__steps { grid-template-columns: 1fr; gap: 36px; }
          .fanus-how__line { display: none; }
        }
      `}</style>
    </section>
  );
}

function Arrow() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function Icon({ name }: { name: string }) {
  const p = { width: 28, height: 28, fill: "none", stroke: "white", strokeWidth: 1.7, viewBox: "0 0 24 24", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "send") return <svg {...p}><path d="M21 3L3 10l7 3 3 7 8-17z" /><path d="M10 13l7-7" /></svg>;
  if (name === "users") return <svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M15 14c2 .3 4 1.7 4.5 4.5" /></svg>;
  if (name === "video") return <svg {...p}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></svg>;
  return null;
}
