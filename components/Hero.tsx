"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleProvider";
import SessionRequestModal from "@/components/SessionRequestModal";
import MoodCheckIn from "@/components/MoodCheckIn";

export default function Hero() {
  const { t } = useT();
  const [modalOpen, setModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const heroTitle = t("home.heroTitle");
  const heroSub = t("home.heroSub");
  const heroCta = t("home.heroCta");

  // Mobil brauzerlərdə React-in `muted` atributu bəzən DOM property kimi düşmür
  // və autoplay bloklanır (yalnız poster görünür). muted-i zorla təyin edib
  // play() çağırırıq ki, telefonda da video tam-ekran arxa fon kimi oynasın.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, []);

  return (
    <section id="hero">
      {/* Bütün ekranlarda: tam-ekran video arxa fonu */}
      <div className="fanus-hero fanus-hero--full">
        <video
          ref={videoRef}
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

      <SessionRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <style>{`
        /* ══════════ Tam-ekran video hero (mobil-first) ══════════ */
        .fanus-hero--full {
          display: flex;
          position: relative;
          min-height: 100svh;
          min-height: 100dvh;
          overflow: hidden;
        }

        .fanus-hero__video {
          position: absolute; inset: 0; z-index: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          /* Mobildə sağa fokus — kompüter ekranı kadra düşsün. */
          object-position: 78% center;
        }

        .fanus-hero__scrim {
          position: absolute; inset: 0; z-index: 1;
          background:
            /* Yuxarıdan tündləşdirmə — navbar (AZ / Daxil ol / Qeydiyyat) ağ yazıları
               videonun açıq hissələrində də oxunsun (bütün en boyu). */
            linear-gradient(180deg, rgba(6,14,28,.62) 0%, rgba(6,14,28,.30) 12%, rgba(6,14,28,0) 28%),
            linear-gradient(90deg, rgba(6,14,28,.85) 0%, rgba(6,14,28,.58) 40%, rgba(6,14,28,.22) 70%, rgba(6,14,28,.08) 100%),
            linear-gradient(0deg, rgba(6,14,28,.7) 0%, rgba(6,14,28,.15) 40%, rgba(6,14,28,0) 60%);
        }

        /* Konteyner tam hündürlüyü tutur; içində flex sütun — başlıq/CTA bloku
           ortada (margin:auto), mood paneli isə aşağıda qalır. */
        .fanus-hero__inner {
          position: relative; z-index: 2;
          align-self: stretch;
          width: 100%;
          display: flex; flex-direction: column;
          padding-top: 92px; padding-bottom: 28px;
        }

        .fanus-hero__copy--light {
          margin: auto 0;
          max-width: 620px;
        }
        .fanus-hero__copy--light h1 {
          margin: 0 0 14px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(32px, 8.5vw, 62px);
          line-height: 1.08; letter-spacing: -0.025em;
          color: #fff; font-weight: 800;
          text-wrap: balance;
        }
        .fanus-hero__hl { color: #9DC3FB; }
        .fanus-hero__lead--light {
          font-size: 16px; line-height: 1.6; color: rgba(255,255,255,.88);
          max-width: 460px; margin: 0;
          text-wrap: balance;
        }

        /* Aşağı qrup: düymələr + mood paneli. */
        .fanus-hero__bottom { display: flex; flex-direction: column; gap: 16px; align-items: flex-start; width: 100%; }

        /* Mobildə iki düymə yan-yana, eni tam doldurur. */
        .fanus-hero__cta { display: flex; gap: 10px; margin: 0; flex-wrap: nowrap; align-items: stretch; width: 100%; }
        .fanus-hero__cta .fanus-btn {
          flex: 1 1 0; min-width: 0;
          white-space: normal; text-align: center;
          padding: 14px 12px; font-size: 13.5px;
        }
        .fanus-hero__cta .fanus-btn-primary { box-shadow: 0 12px 30px rgba(0,0,0,.3); }
        .fanus-hero__ghost {
          color: #fff; border-color: rgba(255,255,255,.55);
          background: rgba(255,255,255,.08);
          backdrop-filter: blur(4px);
        }
        .fanus-hero__ghost:hover { border-color: #fff; color: #fff; background: rgba(255,255,255,.18); }

        .fanus-hero__mood {
          width: 100%; max-width: 100%; margin: 0;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(255,255,255,.2);
          backdrop-filter: blur(12px);
          border-radius: 20px; padding: 16px 18px;
        }
        .fanus-hero__mood .fanus-mood__head h2 { color: #fff; }
        .fanus-hero__mood .fanus-mood__head p { color: rgba(255,255,255,.75); }

        /* Şüşə çiplər — buzlu panel + ghost düymə görünüşü ilə uyğun. */
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

        /* ══════════ Tablet/Desktop ══════════ */
        @media (min-width: 768px) {
          .fanus-hero__video { object-position: center; }
          .fanus-hero__inner { padding-top: 120px; padding-bottom: 48px; }

          .fanus-hero__copy--light { max-width: 620px; }
          .fanus-hero__copy--light h1 {
            margin: 0 0 18px;
            font-size: clamp(36px, 4.6vw, 62px);
            line-height: 1.07;
          }
          .fanus-hero__lead--light { font-size: 18px; line-height: 1.65; }

          .fanus-hero__bottom { gap: 20px; }
          .fanus-hero__cta { flex-wrap: wrap; gap: 14px; align-items: center; width: auto; }
          .fanus-hero__cta .fanus-btn { flex: 0 0 auto; padding: 16px 28px; font-size: 15px; white-space: nowrap; }
          .fanus-hero__mood { width: fit-content; padding: 18px 22px; }
        }

        @media (min-width: 768px) and (max-width: 980px) {
          .fanus-hero__inner { padding-top: 96px; padding-bottom: 36px; }
        }
      `}</style>
    </section>
  );
}
