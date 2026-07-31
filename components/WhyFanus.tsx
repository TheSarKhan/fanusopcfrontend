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
        .fanus-why { padding: 64px 0; position: relative; }
        .fanus-why__head { max-width: 720px; margin: 0 auto 48px; text-align: center; }
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
        }
        /* Fon QƏSDƏN yoxdur — ikonlar şəffafdır, bölmənin öz fonu üzərində durur. */
        .fanus-why-card__icon {
          width: 96px; height: 96px; background: none; border: none;
          display: inline-flex; align-items: center; justify-content: center;
          margin-bottom: 20px;
        }
        .fanus-why-card__title {
          margin: 0 0 10px; font-size: 18px; font-weight: 700;
          font-family: var(--font-poppins), system-ui, sans-serif;
          color: var(--fanus-ink); letter-spacing: -0.01em;
        }
        .fanus-why-card__text {
          margin: 0; color: var(--fanus-ink-2); font-size: 14px; line-height: 1.65;
          max-width: 220px; min-height: calc(3 * 1.65em);
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @media (max-width: 1000px) { .fanus-why__grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px)  { .fanus-why__grid { grid-template-columns: 1fr; } .fanus-why-card__text { max-width: none; } }
      `}</style>
    </section>
  );
}

/**
 * "Niyə Fanus" ikonları — iki tonlu xətt üslubu: əsas kontur brend göy
 * (--fanus-primary), vurğu detalları açıq mavi (ACCENT). Fon YOXDUR — ikonlar
 * şəffafdır və kartın öz fonunun üstündə durur.
 */
const ACCENT = "#3B9EFF";

function Icon({ name }: { name: string }) {
  const p = {
    width: 84, height: 84, fill: "none", stroke: "var(--fanus-primary)",
    strokeWidth: 1.6, viewBox: "0 0 48 48",
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };

  // Sertifikatlı psixoloqlar — sənəd + medal (açıq mavi tik) + şəxs
  if (name === "award")
    return (
      <svg {...p}>
        <path d="M13 21V11a1.5 1.5 0 0 1 1.5-1.5h12L30 13v3" />
        <path d="M17 14h8M17 17.5h9M17 21h6" />
        <circle cx="18" cy="28.5" r="6" />
        <path d="M15.5 33.5 14 40l4-2.6 4 2.6-1.5-6.5" />
        <path d="M15.6 28.6l1.9 1.9 3.4-3.6" stroke={ACCENT} strokeWidth="2.1" />
        <circle cx="31.5" cy="26" r="4.2" />
        <path d="M25 37.5a6.5 6.5 0 0 1 13 0z" />
      </svg>
    );

  // Hər yerdən əlçatan — noutbuk + telefon + wi-fi dalğaları (açıq mavi)
  if (name === "globe")
    return (
      <svg {...p}>
        <path d="M11 19.5a1.8 1.8 0 0 1 1.8-1.8h13.4a1.8 1.8 0 0 1 1.8 1.8V31H11z" />
        <path d="M8.5 31h23l-.6 1.6a2.6 2.6 0 0 1-2.4 1.6H11.5a2.6 2.6 0 0 1-2.4-1.6z" />
        <path d="M17.5 31l1.2 1.4h2.6L22.5 31" />
        <rect x="33" y="21.5" width="9" height="14" rx="2" />
        <path d="M36 24h3" />
        <circle cx="37.5" cy="32.2" r="1.1" fill={ACCENT} stroke="none" />
        <path d="M32.6 15.4a7 7 0 0 1 9.8 0" stroke={ACCENT} strokeWidth="2" />
        <path d="M34.4 18a4.4 4.4 0 0 1 6.2 0" stroke={ACCENT} strokeWidth="2" />
      </svg>
    );

  // Təhlükəsizlik — qalxan + kilid (açıq mavi tik)
  if (name === "lock")
    return (
      <svg {...p}>
        <path d="M24 8.5 37 14v10.5c0 7.4-5 12.9-13 15.5-8-2.6-13-8.1-13-15.5V14z" />
        <rect x="18" y="22.5" width="12" height="9.5" rx="2" />
        <path d="M20.6 22.5v-3a3.4 3.4 0 0 1 6.8 0v3" />
        <path d="M21.3 27.4l2 2 3.4-3.7" stroke={ACCENT} strokeWidth="2.1" />
      </svg>
    );

  // Ödənişsiz tanışlıq görüşü — hədiyyə qutusu (lent açıq mavi)
  if (name === "gift")
    return (
      <svg {...p}>
        <path d="M38 22v16H10V22" />
        <rect x="8" y="15" width="32" height="7" rx="1.6" />
        <path d="M24 38V15" stroke={ACCENT} strokeWidth="2.1" />
        <path d="M24 15h-6.6a3.4 3.4 0 0 1 0-6.8C21.6 8.2 24 15 24 15z" />
        <path d="M24 15h6.6a3.4 3.4 0 0 0 0-6.8C26.4 8.2 24 15 24 15z" />
      </svg>
    );

  return null;
}
