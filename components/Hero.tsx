"use client";

import { useState } from "react";
import Link from "next/link";
import Deco from "@/components/Deco";
import { useT } from "@/lib/i18n/LocaleProvider";
import SessionRequestModal from "@/components/SessionRequestModal";
import { MoodIcon, MoodModal, MOOD_COLORS, type Mood } from "@/components/MoodCheckIn";
import { trackFunnelEvent } from "@/lib/api";
import type { MoodId } from "@/lib/moodMap";

function HeroMoodStrip() {
  const { t } = useT();
  const [selected, setSelected] = useState<Mood | null>(null);
  const [open, setOpen]         = useState(false);

  const MOODS: Mood[] = [
    { id: "anxious", label: t("mood.moodAnxious"), color: MOOD_COLORS.anxious },
    { id: "sad",     label: t("mood.moodSad"),     color: MOOD_COLORS.sad },
    { id: "tired",   label: t("mood.moodTired"),   color: MOOD_COLORS.tired },
    { id: "angry",   label: t("mood.moodAngry"),   color: MOOD_COLORS.angry },
    { id: "mixed",   label: t("mood.moodMixed"),   color: MOOD_COLORS.mixed },
    { id: "lonely",  label: t("mood.moodLonely"),  color: MOOD_COLORS.lonely },
    { id: "hopeful", label: t("mood.moodHopeful"), color: MOOD_COLORS.hopeful },
    { id: "happy",   label: t("mood.moodHappy"),   color: MOOD_COLORS.happy },
  ];

  const onPick = (m: Mood) => {
    setSelected(m);
    trackFunnelEvent("MOOD_SELECTED", m.id as MoodId);
    setTimeout(() => setOpen(true), 200);
  };

  return (
    <>
      <div className="h-mood-strip">
        <div className="fanus-container h-mood-strip__inner">
          <p className="h-mood-strip__q">{t("mood.title")}</p>
          <div className="h-mood-strip__chips">
            {MOODS.map(m => (
              <button
                key={m.id}
                type="button"
                className={`h-mood-chip${selected?.id === m.id ? " is-sel" : ""}`}
                style={{ ["--mc" as string]: m.color }}
                onClick={() => onPick(m)}
              >
                <span className="h-mood-chip__icon" style={{ color: m.color }}>
                  <MoodIcon id={m.id as MoodId} size={26} />
                </span>
                <span className="h-mood-chip__lbl">{m.label}</span>
                <span className="h-mood-chip__ring" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      {open && selected && (
        <MoodModal mood={selected} onClose={() => { setOpen(false); setSelected(null); }} />
      )}
    </>
  );
}

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

      <Deco type="wave-top"    style={{ top: -20,    left: "-4%",  width: 520, opacity: .5  }} anim="drift" />
      <Deco type="blob-cloud"  style={{ top: 40,     right: "-6%", width: 360, opacity: .5  }} anim="drift" />
      <Deco type="wavy-lines"  style={{ bottom: 60,  left: "40%",  width: 520, opacity: .4  }} anim="drift" />
      <Deco type="sphere-blue" style={{ top: "35%",  left: "6%",   width: 70,  opacity: .8  }} anim="floatY" />

      {/* ── Main two-column content ── */}
      <div className="fanus-container fanus-hero__inner">
        <div className="fanus-hero__copy">
          <h1><span className="fanus-hero__hl">{t("home.heroTitle")}</span></h1>
          <p className="fanus-hero__lead">{t("home.heroSub")}</p>

          <div className="fanus-hero__cta">
            <Link href="/psychologists" className="fanus-btn fanus-btn-primary fanus-btn-lg">
              {t("home.heroCta")} <ArrowIcon />
            </Link>
            <button type="button" onClick={() => setModalOpen(true)} className="fanus-btn fanus-btn-ghost fanus-btn-lg">
              Seans üçün müraciət et
            </button>
          </div>

          <div className="fanus-hero__trust">
            <span className="fanus-hero__trust-item"><StarIcon /> 4.9/5 reytinq</span>
            <span className="fanus-hero__trust-dot" aria-hidden />
            <span className="fanus-hero__trust-item"><UsersIcon /> 50+ psixoloq</span>
            <span className="fanus-hero__trust-dot" aria-hidden />
            <span className="fanus-hero__trust-item"><GiftIcon /> Pulsuz tanışlıq</span>
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

      {/* ── Mood strip at bottom ── */}
      <HeroMoodStrip />

      <SessionRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <style>{`
        @keyframes heroFloat { 0%,100%{transform:translateY(0)}    50%{transform:translateY(-7px)} }
        @keyframes fcFloatA  { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-8px) rotate(-2deg)} }
        @keyframes fcFloatB  { 0%,100%{transform:translateY(0) rotate(1.5deg)} 50%{transform:translateY(-6px) rotate(1.5deg)} }

        .fanus-hero {
          position: relative;
          min-height: calc(100vh - 104px);
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
        }
        .fanus-hero__cta { display: flex; gap: 14px; margin: 28px 0 24px; flex-wrap: wrap; align-items: center; }

        /* ── Trust bar ── */
        .fanus-hero__trust { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .fanus-hero__trust-item {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 500; color: var(--fanus-ink-3);
        }
        .fanus-hero__trust-dot {
          width: 3px; height: 3px; border-radius: 50%;
          background: var(--fanus-ink-3); opacity: .45; flex-shrink: 0;
        }

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
        .fanus-hart { position: relative; width: 100%; }
        .fanus-hart__img {
          display: block; width: 100%; height: auto;
          animation: heroFloat 6s ease-in-out infinite; user-select: none;
        }

        /* ── Mood strip ── */
        .h-mood-strip {
          position: relative; z-index: 1;
          border-top: 1px solid rgba(16,81,183,.08);
          background: rgba(255,255,255,.55);
          backdrop-filter: blur(8px);
          padding: 24px 0;
          margin-top: auto;
        }
        .h-mood-strip__inner {
          display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
        }
        .h-mood-strip__q {
          font-size: 14px; font-weight: 600; color: var(--fanus-ink);
          margin: 0; white-space: nowrap; flex-shrink: 0;
        }
        .h-mood-strip__chips {
          display: flex; gap: 8px; flex-wrap: wrap;
        }
        .h-mood-chip {
          position: relative;
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 14px; border-radius: 999px;
          background: #fff; border: 1.5px solid var(--fanus-line);
          font-size: 13px; font-weight: 500; color: var(--fanus-ink);
          cursor: pointer; transition: border-color .18s, background .18s, transform .18s, box-shadow .18s;
          overflow: hidden; font-family: inherit;
        }
        .h-mood-chip:hover {
          border-color: var(--mc);
          background: #fff;
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(16,81,183,.1);
        }
        .h-mood-chip.is-sel {
          background: var(--mc); border-color: var(--mc); color: #fff;
        }
        .h-mood-chip.is-sel .h-mood-chip__icon { color: #fff !important; }
        .h-mood-chip__icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; flex-shrink: 0;
        }
        .h-mood-chip__lbl { font-size: 13px; }
        .h-mood-chip__ring {
          position: absolute; inset: -2px; border-radius: 999px;
          border: 2px solid var(--mc); opacity: 0; transition: opacity .18s;
        }
        .h-mood-chip:hover .h-mood-chip__ring { opacity: .3; }

        /* ── Responsive ── */
        @media (max-width: 1100px) { .fanus-hero__inner { gap: 40px; } }
        @media (max-width: 980px) {
          .fanus-hero { padding-top: 32px; }
          .fanus-hero__inner { grid-template-columns: 1fr; gap: 32px; padding-bottom: 32px; }
          .h-fc { display: none; }
          .h-mood-strip__inner { flex-direction: column; align-items: flex-start; gap: 14px; }
          .h-mood-strip__chips { gap: 6px; }
        }
        @media (max-width: 560px) {
          .h-mood-chip { padding: 7px 11px; font-size: 12px; }
          .h-mood-chip__icon { width: 22px; height: 22px; }
        }
      `}</style>
    </section>
  );
}

function ArrowIcon() {
  return <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
function StarIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="#F5B946"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
}
function UsersIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function GiftIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/></svg>;
}
