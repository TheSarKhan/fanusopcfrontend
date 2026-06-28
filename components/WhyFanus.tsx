"use client";

import { useT } from "@/lib/i18n/LocaleProvider";

export default function WhyFanus() {
  const { t } = useT();
  const REASONS = [
    { icon: "award", title: t("why.expertTitle"),   text: t("why.expertText") },
    { icon: "globe", title: t("why.matchTitle"),    text: t("why.matchText") },
    { icon: "lock",  title: t("why.privacyTitle"),  text: t("why.privacyText") },
    { icon: "gift",  title: t("why.anywhereTitle"), text: t("why.anywhereText") },
  ];
  return (
    <section className="fanus-why" id="about">
      <div className="fanus-container">
        <div className="fanus-why__head">
          <h2>{t("why.title")}</h2>
        </div>

        <div className="fanus-why__grid">
          {REASONS.map((r, i) => (
            <div key={i} className="fanus-why-card">
              <div className="fanus-why-card__icon">
                <Icon name={r.icon} />
              </div>
              <h3 className="fanus-why-card__title">{r.title}</h3>
              <p className="fanus-why-card__text">{r.text}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .fanus-why { padding: 96px 0; position: relative; }
        .fanus-why__head { text-align: center; max-width: 720px; margin: 0 auto 48px; }
        .fanus-why__head h2 {
          margin: 0;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(28px, 3.4vw, 44px);
          font-weight: 700; letter-spacing: -0.025em; line-height: 1.12;
          color: var(--fanus-ink);
        }
        .fanus-why__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; }
        .fanus-why-card {
          display: flex; flex-direction: column; align-items: center; text-align: center;
          padding: 34px 26px 30px;
          background: #fff;
          border: 1px solid var(--fanus-line, #E8EEF6);
          border-radius: 20px;
          transition: border-color .2s ease, box-shadow .25s ease, transform .25s ease;
        }
        .fanus-why-card:hover {
          transform: translateY(-3px);
          border-color: rgba(16,81,183,.28);
          box-shadow: 0 14px 34px rgba(16,81,183,.08);
        }
        .fanus-why-card__icon {
          width: 60px; height: 60px; border-radius: 16px;
          background: #EAF2FD;
          display: inline-flex; align-items: center; justify-content: center;
          margin-bottom: 20px;
        }
        .fanus-why-card__title {
          margin: 0 0 10px; font-size: 18px; font-weight: 700;
          color: var(--fanus-ink); letter-spacing: -0.01em;
        }
        .fanus-why-card__text {
          margin: 0; color: var(--fanus-ink-2); font-size: 14px; line-height: 1.65;
          max-width: 220px;
        }
        @media (max-width: 1000px) { .fanus-why__grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px)  { .fanus-why__grid { grid-template-columns: 1fr; } .fanus-why-card__text { max-width: none; } }
      `}</style>
    </section>
  );
}

function Icon({ name }: { name: string }) {
  const p = {
    width: 26, height: 26, fill: "none", stroke: "var(--fanus-primary)",
    strokeWidth: 1.7, viewBox: "0 0 24 24",
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  if (name === "award")
    return <svg {...p}><circle cx="12" cy="8" r="5" /><path d="M8.5 12.6 7 21l5-2.8L17 21l-1.5-8.4" /></svg>;
  if (name === "globe")
    return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
  if (name === "gift")
    return <svg {...p}><path d="M20 12v9H4v-9" /><rect x="2" y="7" width="20" height="5" rx="1" /><path d="M12 21V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>;
  if (name === "lock")
    return <svg {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
  return null;
}
