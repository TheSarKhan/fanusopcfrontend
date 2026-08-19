"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Psychologist } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import PsychologistCard, { toPsyCardItem, type PsyCardItem } from "@/components/PsychologistCard";

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

export default function Psychologists({ psychologists }: { psychologists?: Psychologist[] }) {
  const { t } = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateScrollState = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [psychologists]);

  if (!psychologists || psychologists.length === 0) return null;
  const data: PsyCardItem[] = psychologists.map((p) => toPsyCardItem(p, String(p.id)));

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="fanus-psyc" id="psychologists">
      <div className="fanus-container">
        <div className="fanus-psyc__head">
          <h2>{t("psyList.title")}</h2>
          <p className="fanus-psyc__lead">{t("psyList.lead")}</p>
        </div>

        <div className="fanus-psyc__carousel">
          <button
            type="button"
            className="fanus-psyc__nav fanus-psyc__nav--prev"
            onClick={() => scrollByPage(-1)}
            aria-label={t("psyList.scrollPrev")}
            style={{ opacity: canPrev ? 1 : 0, pointerEvents: canPrev ? "auto" : "none" }}
          >
            <ChevronIcon dir="left" />
          </button>

          <div className="fanus-psyc__track" ref={trackRef}>
            {data.map((p) => (
              <div className="fanus-psyc__slide" key={p.id}>
                <PsychologistCard p={p} />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="fanus-psyc__nav fanus-psyc__nav--next"
            onClick={() => scrollByPage(1)}
            aria-label={t("psyList.scrollNext")}
            style={{ opacity: canNext ? 1 : 0, pointerEvents: canNext ? "auto" : "none" }}
          >
            <ChevronIcon dir="right" />
          </button>
        </div>

        <div className="fanus-psyc__foot">
          <Link href="/psychologists" className="fanus-btn fanus-btn-ghost">
            {t("psyList.seeAll")}
          </Link>
        </div>
      </div>

      <style>{`
        .fanus-psyc { padding: 68px 0; position: relative; overflow: hidden; }
        .fanus-psyc > .fanus-container { position: relative; z-index: 1; }
        .fanus-psyc__head { margin-bottom: 48px; text-align: center; }
        .fanus-psyc__head h2 {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.1; color: var(--fanus-ink);
          margin: 0;
        }
        .fanus-psyc__lead { margin: 12px auto 0; max-width: 540px; font-size: 17px; color: var(--fanus-ink-3); }

        .fanus-psyc__carousel { position: relative; }
        .fanus-psyc__track {
          display: flex; gap: 22px;
          overflow-x: auto; scroll-snap-type: x proximity;
          scrollbar-width: none; padding: 4px 2px 12px;
        }
        .fanus-psyc__track::-webkit-scrollbar { display: none; }
        .fanus-psyc__slide { flex: 0 0 300px; max-width: 300px; scroll-snap-align: start; }

        .fanus-psyc__nav {
          position: absolute; top: 45%; transform: translateY(-50%);
          width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
          background: #fff; border: 1px solid var(--fanus-line);
          box-shadow: 0 8px 24px rgba(10,26,51,.12);
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--fanus-primary); cursor: pointer; z-index: 2;
          transition: opacity .2s, box-shadow .2s;
        }
        .fanus-psyc__nav:hover { box-shadow: 0 10px 28px rgba(10,26,51,.18); }
        .fanus-psyc__nav--prev { left: 4px; }
        .fanus-psyc__nav--next { right: 4px; }
        @media (min-width: 860px) {
          .fanus-psyc__nav--prev { left: -24px; }
          .fanus-psyc__nav--next { right: -24px; }
        }
        @media (max-width: 640px) {
          .fanus-psyc__slide { flex: 0 0 82%; max-width: 82%; }
        }

        .fanus-psyc__foot { display: flex; justify-content: center; margin-top: 40px; }
      `}</style>
    </section>
  );
}
