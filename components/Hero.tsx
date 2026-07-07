"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleProvider";
import SessionRequestModal from "@/components/SessionRequestModal";

export default function Hero() {
  const { t } = useT();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="fanus-hero" id="hero">
      <div className="fanus-hero__bg" aria-hidden>
        <svg viewBox="0 0 1440 700" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id="heroBg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#F2F6FD" />
              <stop offset="100%" stopColor="#E4ECFA" />
            </linearGradient>
          </defs>
          <rect width="1440" height="700" fill="url(#heroBg)" />
          {Array.from({ length: 36 }).map((_, i) => (
            <circle key={i} cx={50 + (i % 12) * 120} cy={80 + Math.floor(i / 12) * 180} r="2" fill="#1051B7" opacity=".06" />
          ))}
        </svg>
      </div>

      {/* ── Main two-column content ── */}
      <div className="fanus-container fanus-hero__inner">
        <div className="fanus-hero__copy">
          <h1><span className="fanus-hero__hl">{t("home.heroTitle")}</span></h1>
          <p className="fanus-hero__lead">{t("home.heroSub")}</p>

          <div className="fanus-hero__cta">
            <Link href="/psychologists" className="fanus-btn fanus-btn-primary fanus-btn-lg">
              {t("home.heroCta")}
            </Link>
            <button type="button" onClick={() => setModalOpen(true)} className="fanus-btn fanus-btn-ghost fanus-btn-lg">
              Seans üçün müraciət et
            </button>
          </div>
        </div>

        <div className="fanus-hero__art">
          <div className="fanus-hart">
            <img
              src="/images/hero-main.webp"
              alt="Onlayn video seansda psixoloq və klient — Fanus"
              className="fanus-hart__img"
              draggable={false}
            />
          </div>
        </div>
      </div>

      <SessionRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <style>{`
        @keyframes heroFloat { 0%,100%{transform:translateY(0)}    50%{transform:translateY(-7px)} }
        @keyframes fcFloatA  { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-8px) rotate(-2deg)} }
        @keyframes fcFloatB  { 0%,100%{transform:translateY(0) rotate(1.5deg)} 50%{transform:translateY(-6px) rotate(1.5deg)} }

        .fanus-hero {
          position: relative;
          min-height: 640px;
          display: flex; flex-direction: column;
          padding-top: 14px;
          overflow: hidden;
        }
        .fanus-hero__bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; }

        /* Content grid — grows to fill available space */
        .fanus-hero__inner {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 1fr 1.15fr;
          gap: 60px; align-items: center;
          flex: 1; padding-bottom: 40px;
        }

        /* ── Copy ── */
        .fanus-hero__copy h1 {
          margin: 0 0 18px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(36px, 4.4vw, 60px);
          line-height: 1.06; letter-spacing: -0.025em;
          color: #0B1A35; font-weight: 800;
        }
        .fanus-hero__hl { color: var(--fanus-primary); }
        .fanus-hero__lead {
          font-size: 17px; line-height: 1.65; color: var(--fanus-ink-2);
          max-width: 440px; margin: 0;
          text-wrap: balance;
        }
        .fanus-hero__cta { display: flex; gap: 14px; margin: 28px 0 24px; flex-wrap: wrap; align-items: center; }
        .fanus-hero__cta .fanus-btn-primary { box-shadow: none; }
        .fanus-hero__cta .fanus-btn-primary:hover { box-shadow: none; }
        .fanus-hero__cta .fanus-btn-ghost { border-color: var(--fanus-ink-3); }
        .fanus-hero__cta .fanus-btn-ghost:hover { border-color: var(--fanus-primary); }

        /* ── Art + floating cards ── */
        .fanus-hero__art { position: relative; }
        .h-fc {
          position: absolute; z-index: 3;
          background: #fff; border-radius: 18px; padding: 13px 15px;
          box-shadow: 0 10px 40px rgba(16,81,183,.14);
          border: 1px solid rgba(16,81,183,.07);
          pointer-events: none;
        }
        .h-fc--match {
          top: 6%; left: -24px; width: 210px;
          display: flex; gap: 10px; align-items: flex-start;
          animation: fcFloatA 7s ease-in-out infinite;
        }
        .h-fc--session {
          bottom: 8%; right: -12px; width: 180px;
          animation: fcFloatB 8s ease-in-out infinite 1.4s;
        }
        .h-fc__check-wrap {
          width: 26px; height: 26px; border-radius: 50%; background: var(--fanus-primary);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
        }
        .h-fc__content { flex: 1; min-width: 0; }
        .h-fc__top-label { font-size: 11px; font-weight: 600; color: var(--fanus-ink-3); margin: 0 0 7px; text-transform: uppercase; letter-spacing: .04em; }
        .h-fc__user { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
        .h-fc__avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg,#1051B7,#082F6D);
          color: #fff; font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .h-fc__name { font-size: 13px; font-weight: 700; color: var(--fanus-ink); margin: 0; }
        .h-fc__role { font-size: 11px; color: var(--fanus-ink-3); margin: 1px 0 0; }
        .h-fc__stars { display: flex; align-items: center; gap: 2px; }
        .h-fc__stars span { font-size: 11px; font-weight: 700; color: var(--fanus-ink); margin-left: 4px; }
        .h-fc__session-head { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
        .h-fc__session-head .h-fc__top-label { margin: 0; }
        .h-fc__session-time { font-size: 17px; font-weight: 800; color: var(--fanus-ink); margin: 0 0 8px; letter-spacing: -.02em; font-family: var(--font-poppins), system-ui, sans-serif; }
        .h-fc__confirmed {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 600; color: #16A34A;
          background: #F0FDF4; border-radius: 999px; padding: 4px 10px;
        }

        /* ── Illustration ── */
        .fanus-hart {
          position: relative; width: 100%; aspect-ratio: 3 / 2;
          border-radius: 24px; overflow: hidden;
          animation: heroFloat 6s ease-in-out infinite;
        }
        .fanus-hart__img {
          display: block; width: 100%; height: 100%;
          object-fit: cover; object-position: center;
          user-select: none;
        }

        /* ── Responsive ── */
        @media (max-width: 1100px) { .fanus-hero__inner { gap: 40px; } }
        @media (max-width: 980px) {
          .fanus-hero { padding-top: 32px; }
          .fanus-hero__inner { grid-template-columns: 1fr; gap: 32px; padding-bottom: 32px; }
          .h-fc { display: none; }
        }
      `}</style>
    </section>
  );
}
