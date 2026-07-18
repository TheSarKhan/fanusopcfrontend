"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleProvider";
import SessionRequestModal from "@/components/SessionRequestModal";
import MoodCheckIn from "@/components/MoodCheckIn";

export default function Hero() {
  const { t } = useT();
  const [modalOpen, setModalOpen] = useState(false);

  const heroTitle = t("home.heroTitle");
  const heroSub = t("home.heroSub");
  const heroCta = t("home.heroCta");

  return (
    <section id="hero">
      {/* ── Desktop/tablet: tam-ekran video arxa fonu ── */}
      <div className="fanus-hero fanus-hero--full">
        <video
          className="fanus-hero__video"
          src="/videos/hero-session.mp4"
          poster="/videos/hero-session-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
        />
        <div className="fanus-hero__scrim" aria-hidden />

        <div className="fanus-container fanus-hero__inner">
          <div className="fanus-hero__copy fanus-hero__copy--light">
            <h1><span className="fanus-hero__hl">{heroTitle}</span></h1>
            <p className="fanus-hero__lead fanus-hero__lead--light">{heroSub}</p>
          </div>

          <div className="fanus-hero__bottom">
            <div className="fanus-hero__cta">
              <Link href="/psychologists" className="fanus-btn fanus-btn-primary fanus-btn-lg">
                {heroCta}
              </Link>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="fanus-btn fanus-btn-ghost fanus-btn-lg fanus-hero__ghost"
              >
                Seans üçün müraciət et
              </button>
            </div>

            <div className="fanus-hero__mood">
              <MoodCheckIn compact />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobil: adi mətn bloku + altında video/şəkil kartı (üzərində üzən çip) ── */}
      <div className="fanus-hero fanus-hero--stacked">
        <div className="fanus-container">
          <div className="fanus-hero__copy">
            <h1><span className="fanus-hero__hl fanus-hero__hl--dark">{heroTitle}</span></h1>
            <p className="fanus-hero__lead">{heroSub}</p>

            <div className="fanus-hero__cta">
              <Link href="/psychologists" className="fanus-btn fanus-btn-primary fanus-btn-lg">
                {heroCta}
              </Link>
              <button type="button" onClick={() => setModalOpen(true)} className="fanus-btn fanus-btn-ghost fanus-btn-lg">
                Seans üçün müraciət et
              </button>
            </div>
          </div>
        </div>

        <div className="fanus-hero__card">
          <video
            className="fanus-hero__card-img"
            src="/videos/hero-session.mp4"
            poster="/videos/hero-session-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden
          />
          <MoodCheckIn trigger />
        </div>
      </div>

      <SessionRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <style>{`
        .fanus-hero--full { display: none; }

        /* ══════════ Mobil: stacked ══════════ */
        .fanus-hero--stacked { padding: 24px 0 48px; }
        .fanus-hero--stacked .fanus-hero__copy { max-width: 100%; margin-bottom: 28px; }
        .fanus-hero--stacked .fanus-hero__copy h1 {
          margin: 0 0 14px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 8vw, 40px);
          line-height: 1.1; letter-spacing: -0.02em;
          color: #0B1A35; font-weight: 800;
          text-wrap: balance;
        }
        .fanus-hero__hl--dark { color: var(--fanus-primary); }
        .fanus-hero--stacked .fanus-hero__lead {
          font-size: 16px; line-height: 1.6; color: var(--fanus-ink-2);
          max-width: 100%; margin: 0;
        }
        .fanus-hero--stacked .fanus-hero__cta { display: flex; gap: 10px; margin: 22px 0 0; flex-wrap: nowrap; align-items: stretch; }
        .fanus-hero--stacked .fanus-hero__cta .fanus-btn {
          flex: 1 1 0; min-width: 0;
          white-space: normal; text-align: center;
          padding: 14px 12px; font-size: 13.5px;
        }

        .fanus-hero__card {
          position: relative; width: 100%; aspect-ratio: 16 / 9;
          margin: 0;
        }
        .fanus-hero__card-img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }

        /* ══════════ Tablet/Desktop: tam-ekran video ══════════ */
        @media (min-width: 768px) {
          .fanus-hero--stacked { display: none; }
          .fanus-hero--full {
            display: flex;
            position: relative;
            min-height: 100svh;
            min-height: 100vh;
            overflow: hidden;
          }

          .fanus-hero__video {
            position: absolute; inset: 0; z-index: 0;
            width: 100%; height: 100%;
            object-fit: cover; object-position: center;
          }

          .fanus-hero__scrim {
            position: absolute; inset: 0; z-index: 1;
            background:
              /* Yuxarıdan tündləşdirmə — navbar (AZ / Daxil ol / Qeydiyyat) ağ yazıları
                 videonun açıq hissələrində də oxunsun (bütün en boyu). */
              linear-gradient(180deg, rgba(6,14,28,.62) 0%, rgba(6,14,28,.28) 10%, rgba(6,14,28,0) 24%),
              linear-gradient(90deg, rgba(6,14,28,.85) 0%, rgba(6,14,28,.58) 36%, rgba(6,14,28,.18) 64%, rgba(6,14,28,0) 82%),
              linear-gradient(0deg, rgba(6,14,28,.6) 0%, rgba(6,14,28,0) 42%);
          }

          /* Konteyner tam hündürlüyü tutur; içində flex sütun — başlıq/CTA bloku
             ortada (margin:auto), mood paneli isə aşağıda sabit qalır. */
          .fanus-hero__inner {
            position: relative; z-index: 2;
            align-self: stretch;
            width: 100%;
            display: flex; flex-direction: column;
            padding-top: 120px; padding-bottom: 48px;
          }

          .fanus-hero__copy--light {
            margin: auto 0;
            max-width: 620px;
          }
          .fanus-hero__copy--light h1 {
            margin: 0 0 18px;
            font-family: var(--font-poppins), system-ui, sans-serif;
            font-size: clamp(36px, 4.6vw, 62px);
            line-height: 1.07; letter-spacing: -0.025em;
            color: #fff; font-weight: 800;
            text-wrap: balance;
          }
          .fanus-hero__hl { color: #9DC3FB; }
          .fanus-hero__lead--light {
            font-size: 18px; line-height: 1.65; color: rgba(255,255,255,.86);
            max-width: 460px; margin: 0;
            text-wrap: balance;
          }

          /* Aşağı qrup: düymələr + mood paneli, birlikdə hero-nun altında. */
          .fanus-hero__bottom { display: flex; flex-direction: column; gap: 20px; align-items: flex-start; }
          .fanus-hero--full .fanus-hero__cta { display: flex; gap: 14px; margin: 0; flex-wrap: wrap; align-items: center; }
          .fanus-hero--full .fanus-hero__cta .fanus-btn-primary { box-shadow: 0 12px 30px rgba(0,0,0,.3); }
          .fanus-hero__ghost {
            color: #fff; border-color: rgba(255,255,255,.55);
            background: rgba(255,255,255,.08);
            backdrop-filter: blur(4px);
          }
          .fanus-hero__ghost:hover { border-color: #fff; color: #fff; background: rgba(255,255,255,.18); }

          .fanus-hero__mood {
            width: fit-content; max-width: 100%; margin: 0;
            background: rgba(255,255,255,.10);
            border: 1px solid rgba(255,255,255,.2);
            backdrop-filter: blur(12px);
            border-radius: 20px; padding: 18px 22px;
          }
          .fanus-hero__mood .fanus-mood__head h2 { color: #fff; }
          .fanus-hero__mood .fanus-mood__head p { color: rgba(255,255,255,.75); }

          /* Glass chips instead of solid white — matches the frosted panel + ghost button look. */
          .fanus-hero__mood .fanus-mood-chip {
            background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.2);
          }
          .fanus-hero__mood .fanus-mood-chip:hover {
            background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.4);
            box-shadow: none;
          }
          /* İkonlar ağ — SVG currentColor işlədir; inline color-u əvəz etmək üçün !important. */
          .fanus-hero__mood .fanus-mood-chip__icon { background: rgba(255,255,255,.14); color: #fff !important; }
          .fanus-hero__mood .fanus-mood-chip:hover .fanus-mood-chip__icon { background: rgba(255,255,255,.22); box-shadow: none; }
          .fanus-hero__mood .fanus-mood-chip__label { color: #fff; }
          .fanus-hero__mood .fanus-mood-chip__ring { display: none; }
        }

        @media (min-width: 768px) and (max-width: 980px) {
          .fanus-hero__inner { padding-top: 96px; padding-bottom: 36px; }
        }
      `}</style>
    </section>
  );
}
