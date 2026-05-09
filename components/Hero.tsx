"use client";

import Link from "next/link";
import Deco from "@/components/Deco";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function Hero() {
  const { t } = useT();
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

      <Deco type="wave-top" style={{ top: -20, left: "-4%", width: 520, opacity: .55 }} anim="drift" />
      <Deco type="blob-cloud" style={{ top: 40, right: "-6%", width: 360, opacity: .55 }} anim="drift" />
      <Deco type="wavy-lines" style={{ bottom: -40, left: "40%", width: 520, opacity: .5 }} anim="drift" />
      <Deco type="sphere-blue" style={{ top: "38%", left: "6%", width: 70, opacity: .8 }} anim="floatY" />

      <div className="fanus-container fanus-hero__inner">
        <div className="fanus-hero__copy">
          <h1>
            <span className="fanus-hero__eyebrow-line">{t("home.heroEyebrow")}</span><br />
            <span className="fanus-hero__hl">{t("home.heroTitle")}</span>
          </h1>
          <p className="fanus-hero__lead">
            {t("home.heroSub")}
          </p>

          <div className="fanus-hero__cta">
            <Link href="/psychologists" className="fanus-btn fanus-btn-primary fanus-btn-lg">
              {t("home.heroCta")} <Arrow />
            </Link>
            <Link href="#how" className="fanus-hero__text-cta">
              <span className="fanus-hero__play">
                <svg width="11" height="11" fill="var(--fanus-primary)" viewBox="0 0 24 24"><path d="M7 5l12 7-12 7V5z" /></svg>
              </span>
              {t("home.heroSecondaryCta")}
            </Link>
          </div>
        </div>

        <div className="fanus-hero__art">
          <HeroIllustration />
        </div>
      </div>

      <style>{`
        .fanus-hero { position: relative; padding: 56px 0 96px; overflow: hidden; }
        .fanus-hero__bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
        .fanus-hero__inner {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 1fr 1.1fr;
          gap: 56px; align-items: center;
        }
        .fanus-hero__copy h1 {
          margin: 0 0 22px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(40px, 5vw, 64px);
          line-height: 1.04; letter-spacing: -0.025em;
          color: #0B1A35; font-weight: 800;
        }
        .fanus-hero__hl { color: var(--fanus-primary); }
        .fanus-hero__lead {
          font-size: 17px; line-height: 1.6; color: var(--fanus-ink-2);
          max-width: 480px; margin: 0;
        }
        .fanus-hero__cta {
          display: flex; gap: 18px; margin: 32px 0 44px;
          flex-wrap: wrap; align-items: center;
        }
        .fanus-hero__text-cta {
          background: none; border: none; padding: 4px 0;
          color: var(--fanus-ink); font-weight: 600; cursor: pointer;
          font-size: 15px; display: inline-flex; align-items: center; gap: 10px;
        }
        .fanus-hero__play {
          width: 32px; height: 32px; border-radius: 50%;
          background: white; border: 1px solid var(--fanus-line);
          display: inline-flex; align-items: center; justify-content: center;
          padding-left: 2px; box-shadow: var(--fanus-shadow-sm);
        }
        .fanus-hero__features {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 22px; padding-top: 28px;
          border-top: 1px solid var(--fanus-line);
          max-width: 580px;
        }
        .fanus-hero__art { position: relative; }
        @media (max-width: 1100px) { .fanus-hero__inner { gap: 36px; } .fanus-hero__features { gap: 14px; } }
        @media (max-width: 980px) {
          .fanus-hero { padding: 40px 0 64px; }
          .fanus-hero__inner { grid-template-columns: 1fr; gap: 40px; }
          .fanus-hero__features { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px) { .fanus-hero__features { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function Arrow() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function HeroIllustration() {
  return (
    <div className="fanus-hart">
      <div className="fanus-hart__glow fanus-hart__glow--1" />
      <div className="fanus-hart__glow fanus-hart__glow--2" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/hero-main.png"
        alt="Onlayn psixoloji seans — Fanus"
        className="fanus-hart__img"
        draggable={false}
      />

      <style>{`
        .fanus-hart { position: relative; width: 100%; aspect-ratio: 16/10; min-height: 360px; }
        .fanus-hart__img {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: contain;
          z-index: 2;
          animation: heroFloat 6s ease-in-out infinite;
          user-select: none;
        }
        @keyframes heroFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .fanus-hart__glow { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(40px); z-index: 1; }
        .fanus-hart__glow--1 {
          top: -8%; right: 6%; width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(245,185,70,.35), transparent 65%);
          animation: heroFlicker 3.5s ease-in-out infinite;
        }
        .fanus-hart__glow--2 {
          bottom: -6%; left: 8%; width: 240px; height: 240px;
          background: radial-gradient(circle, rgba(16,81,183,.18), transparent 65%);
          animation: heroFlicker 4.5s ease-in-out infinite -2s;
        }
        @keyframes heroFlicker { 0%, 100% { opacity: .9; transform: scale(1); } 50% { opacity: .55; transform: scale(1.08); } }
        @media (max-width: 980px) { .fanus-hart { min-height: 320px; } }
      `}</style>
    </div>
  );
}
