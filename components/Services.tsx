"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function Services() {
  const { t } = useT();
  const ITEMS = [
    t("services.individualTitle"),
    t("services.coupleTitle"),
    t("services.groupTitle"),
    t("services.crisisTitle"),
    t("services.childTitle"),
    t("services.corporateTitle"),
  ];
  return (
    <section className="fanus-svc" id="services">
      <div className="fanus-container">
        <div className="fanus-svc__panel">
          <div className="fanus-svc__copy">
            <h2>{t("services.title")}</h2>
            <p className="fanus-svc__lead">{t("services.lead")}</p>
            <ul className="fanus-svc__list">
              {ITEMS.map((label) => (
                <li key={label}><Check />{label}</li>
              ))}
            </ul>
            <Link href="/xidmetler" className="fanus-btn fanus-btn-ghost fanus-svc__cta">
              {t("services.allCta")}
            </Link>
          </div>
          <div className="fanus-svc__media">
            <img src="/images/services.webp" alt="" loading="lazy" />
          </div>
        </div>
      </div>

      <style>{`
        .fanus-svc { padding: 96px 0; background: #fff; }
        .fanus-svc__panel {
          display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 40px; align-items: center;
          background: #EDF3FC; border-radius: 28px;
          padding: clamp(28px, 4vw, 56px);
        }
        .fanus-svc__copy h2 {
          margin: 0;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(26px, 3.2vw, 40px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.15; color: var(--fanus-ink);
        }
        .fanus-svc__lead { margin: 8px 0 0; font-size: 16px; line-height: 1.6; color: var(--fanus-ink-2); max-width: 460px; }
        .fanus-svc__list {
          list-style: none; margin: 44px 0 28px; padding: 0;
          display: grid; grid-template-columns: 1fr 1fr; gap: 14px 22px;
        }
        .fanus-svc__list li { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 500; color: var(--fanus-ink); }
        .fanus-svc__check {
          flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
          background: #DCEAFB; display: inline-flex; align-items: center; justify-content: center;
        }
        .fanus-svc__cta { border-color: var(--fanus-ink-3); }
        .fanus-svc__cta:hover { border-color: var(--fanus-primary); }
        .fanus-svc__media { aspect-ratio: 4 / 3; border-radius: 18px; overflow: hidden; }
        .fanus-svc__media img { width: 100%; height: 100%; object-fit: cover; display: block; }
        @media (max-width: 860px) {
          .fanus-svc__panel { grid-template-columns: 1fr; gap: 28px; }
          .fanus-svc__media { order: -1; }
        }
        @media (max-width: 420px) {
          .fanus-svc__list { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}

function Check() {
  return (
    <span className="fanus-svc__check">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--fanus-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}
