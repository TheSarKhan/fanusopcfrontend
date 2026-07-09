"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Deco from "@/components/Deco";
import { getBlogPosts, getPsychologists, trackFunnelEvent, type BlogPost, type Psychologist } from "@/lib/api";
import { withSlugs } from "@/lib/slug";
import { MOOD_TO_CAT, deriveCategory, type MoodId } from "@/lib/moodMap";
import { useT } from "@/lib/i18n/LocaleProvider";

export type Mood = { id: MoodId; label: string; color: string };

export const MOOD_COLORS: Record<MoodId, string> = {
  anxious: "#88AEEC",
  sad:     "#5089E0",
  tired:   "#2A6BD0",
  angry:   "#1051B7",
  mixed:   "#0B3F90",
  lonely:  "#1A3B7A",
};

export function MoodIcon({ id, size = 30 }: { id: MoodId; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "anxious": return <svg {...p}><path d="M9 18 Q4 18 4 14 Q4 10 8 10 Q9 6 13 6 Q19 6 20 11 Q26 11 26 16 Q26 20 22 20 L9 20 Z" fill="currentColor" opacity=".18"/><path d="M9 18 Q4 18 4 14 Q4 10 8 10 Q9 6 13 6 Q19 6 20 11 Q26 11 26 16 Q26 20 22 20 L9 20 Z"/><path d="M11 24 L10 27 M16 24 L15 27 M21 24 L20 27"/></svg>;
    case "sad": return <svg {...p}><path d="M16 4 Q24 14 24 20 A8 8 0 0 1 8 20 Q8 14 16 4 Z" fill="currentColor" opacity=".18"/><path d="M16 4 Q24 14 24 20 A8 8 0 0 1 8 20 Q8 14 16 4 Z"/><path d="M12 19 Q12 23 15 24"/></svg>;
    case "tired": return <svg {...p}><path d="M22 19 A9 9 0 1 1 13 8 A7 7 0 0 0 22 19 Z" fill="currentColor" opacity=".18"/><path d="M22 19 A9 9 0 1 1 13 8 A7 7 0 0 0 22 19 Z"/><path d="M22 6 L26 6 L22 10 L26 10" strokeWidth="1.4"/></svg>;
    case "angry": return <svg {...p}><path d="M17 3 L7 18 L14 18 L11 29 L23 13 L16 13 L19 3 Z" fill="currentColor" opacity=".18"/><path d="M17 3 L7 18 L14 18 L11 29 L23 13 L16 13 L19 3 Z"/></svg>;
    case "mixed": return <svg {...p}><circle cx="12" cy="16" r="7" fill="currentColor" opacity=".18"/><circle cx="20" cy="16" r="7" fill="currentColor" opacity=".18"/><circle cx="12" cy="16" r="7"/><circle cx="20" cy="16" r="7"/></svg>;
    case "lonely": return <svg {...p}><path d="M5 26 Q16 14 27 26" opacity=".4"/><circle cx="16" cy="14" r="3.2" fill="currentColor" opacity=".18"/><circle cx="16" cy="14" r="3.2"/><path d="M11 26 Q16 19 21 26"/></svg>;
  }
}

/** Generic (non-mood-specific) smiley used on the collapsed hero trigger chip. */
function TriggerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <circle cx="9" cy="9.5" r="1" fill="currentColor" />
      <circle cx="15" cy="9.5" r="1" fill="currentColor" />
    </svg>
  );
}

/* Chip visuals shared between the standalone section and the compact (hero-embedded) variant. */
const MOOD_CHIP_CSS = `
  .fanus-mood-chip {
    position: relative;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 22px 16px; background: white;
    border-radius: 18px; border: 1px solid var(--fanus-line);
    transition: all .25s ease; overflow: hidden; cursor: pointer;
    font-family: inherit;
  }
  .fanus-mood-chip:hover {
    transform: translateY(-3px);
    border-color: var(--mood-color);
    box-shadow: 0 12px 30px rgba(16,81,183,.1);
  }
  .fanus-mood-chip.is-on {
    background: var(--mood-color); color: white; border-color: var(--mood-color);
  }
  .fanus-mood-chip__icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 52px; height: 52px; border-radius: 14px;
    background: var(--fanus-primary-50);
    transition: all .25s ease;
  }
  .fanus-mood-chip:hover .fanus-mood-chip__icon {
    background: white; box-shadow: 0 0 0 2px var(--mood-color);
  }
  .fanus-mood-chip.is-on .fanus-mood-chip__icon {
    background: rgba(255,255,255,.18); color: white !important; box-shadow: none;
  }
  .fanus-mood-chip__label { font-size: 14px; font-weight: 600; color: var(--fanus-ink); }
  .fanus-mood-chip.is-on .fanus-mood-chip__label { color: white; }
  .fanus-mood-chip__ring {
    position: absolute; inset: -2px; border-radius: 18px;
    border: 2px solid var(--mood-color); opacity: 0;
    transition: opacity .2s;
  }
  .fanus-mood-chip:hover .fanus-mood-chip__ring { opacity: .25; }
`;

/* Compact = embedded in the Hero, over the video — a slim head + a horizontally scrollable chip row. */
const MOOD_COMPACT_CSS = `
  .fanus-mood--compact {
    display: flex; align-items: center; gap: 22px;
  }
  .fanus-mood--compact .fanus-mood__head { max-width: 230px; margin: 0; flex-shrink: 0; }
  .fanus-mood--compact .fanus-mood__head h2 {
    font-family: var(--font-poppins), system-ui, sans-serif;
    font-size: 16px; font-weight: 700; line-height: 1.25;
    margin: 0 0 4px;
  }
  .fanus-mood--compact .fanus-mood__head p { font-size: 12px; line-height: 1.4; margin: 0; }
  .fanus-mood--compact .fanus-mood__chips {
    display: flex; flex-wrap: nowrap; gap: 10px;
    overflow-x: auto; margin: 0; max-width: none;
    scrollbar-width: none;
  }
  .fanus-mood--compact .fanus-mood__chips::-webkit-scrollbar { display: none; }
  .fanus-mood--compact .fanus-mood-chip {
    flex: 0 0 82px; padding: 12px 6px; border-radius: 14px; gap: 6px;
  }
  .fanus-mood--compact .fanus-mood-chip__icon { width: 36px; height: 36px; border-radius: 10px; }
  .fanus-mood--compact .fanus-mood-chip__label { font-size: 11px; text-align: center; line-height: 1.2; }

  @media (max-width: 640px) {
    .fanus-mood--compact { flex-direction: column; align-items: stretch; gap: 12px; }
    .fanus-mood--compact .fanus-mood__head { max-width: 100%; }
  }
`;

/* Trigger = a small floating chip (e.g. over a video/image card) that opens the normal mood popup on tap — it never resizes itself. */
const MOOD_TRIGGER_CSS = `
  .fanus-mood-trigger {
    position: absolute; left: 16px; bottom: 16px; z-index: 1;
    display: flex; align-items: center; gap: 10px;
    background: rgba(255,255,255,.96); backdrop-filter: blur(6px);
    border: none; border-radius: 14px; padding: 10px 14px;
    box-shadow: 0 10px 28px rgba(10,26,51,.18);
    font-family: inherit; font-size: 13px; font-weight: 700; color: var(--fanus-ink);
    cursor: pointer; text-align: left; line-height: 1.3;
    max-width: calc(100% - 32px);
  }
  .fanus-mood-trigger__icon {
    flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%;
    background: var(--fanus-primary-50); color: var(--fanus-primary);
    display: inline-flex; align-items: center; justify-content: center;
  }

  /* Picker popup — same chrome as the suggestions popup (MOOD_MODAL_CHROME_CSS): centered backdrop, fixed card. */
  .fanus-mood-picker-modal { max-width: 600px; padding: 32px 32px 28px; }
  .fanus-mood-picker-body .fanus-mood__head { max-width: 100%; margin: 0 0 24px; }
  .fanus-mood-picker-body .fanus-mood__head h2 {
    font-family: var(--font-poppins), system-ui, sans-serif;
    font-size: 22px; font-weight: 700; margin: 0 0 6px; color: var(--fanus-ink);
  }
  .fanus-mood-picker-body .fanus-mood__head p { font-size: 14px; color: var(--fanus-ink-3); margin: 0; }
  .fanus-mood-picker-body .fanus-mood__chips {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 12px; max-width: none; margin: 0;
  }
  @media (max-width: 520px) {
    .fanus-mood-picker-body .fanus-mood__chips { grid-template-columns: repeat(2, 1fr); }
  }
`;

/* Shared "normal popup" chrome — centered backdrop + white card — used by every mood popup (picker and suggestions alike). */
const MOOD_MODAL_CHROME_CSS = `
  .fanus-mm-backdrop {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(8,47,109,.5); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn .2s ease;
  }
  .fanus-mm-modal {
    background: white; border-radius: 24px;
    width: 100%; max-width: 760px; max-height: 92vh; overflow: auto;
    box-shadow: 0 40px 80px rgba(0,0,0,.3);
    animation: slideUp .3s ease; position: relative;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .fanus-mm-close {
    position: absolute; top: 16px; right: 16px;
    width: 36px; height: 36px; border-radius: 50%;
    background: var(--fanus-bg); color: var(--fanus-ink-2);
    display: inline-flex; align-items: center; justify-content: center;
    z-index: 2; border: none; cursor: pointer;
  }
  .fanus-mm-close:hover { background: var(--fanus-primary-100); color: var(--fanus-primary); }
`;

export default function MoodCheckIn({ compact = false, trigger = false }: { compact?: boolean; trigger?: boolean } = {}) {
  const { t } = useT();
  const [selected, setSelected] = useState<Mood | null>(null);
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const MOODS: Mood[] = [
    { id: "anxious", label: t("mood.moodAnxious"), color: MOOD_COLORS.anxious },
    { id: "sad",     label: t("mood.moodSad"),     color: MOOD_COLORS.sad },
    { id: "tired",   label: t("mood.moodTired"),   color: MOOD_COLORS.tired },
    { id: "angry",   label: t("mood.moodAngry"),   color: MOOD_COLORS.angry },
    { id: "mixed",   label: t("mood.moodMixed"),   color: MOOD_COLORS.mixed },
    { id: "lonely",  label: t("mood.moodLonely"),  color: MOOD_COLORS.lonely },
  ];

  const onPick = (m: Mood) => {
    setSelected(m);
    setPickerOpen(false);
    trackFunnelEvent("MOOD_SELECTED", m.id); // GAP-08: conversion counter
    setTimeout(() => setOpen(true), 250);
  };

  const chips = (
    <div className="fanus-mood__chips">
      {MOODS.map((m) => (
        <button
          key={m.id}
          className={`fanus-mood-chip ${selected?.id === m.id ? "is-on" : ""}`}
          onClick={() => onPick(m)}
          style={{ ["--mood-color" as string]: m.color }}
        >
          <span className="fanus-mood-chip__icon" style={{ color: m.color }}>
            <MoodIcon id={m.id} size={compact ? 24 : 32} />
          </span>
          <span className="fanus-mood-chip__label">{m.label}</span>
          <span className="fanus-mood-chip__ring" aria-hidden />
        </button>
      ))}
    </div>
  );

  const modal = open && selected && (
    <MoodModal mood={selected} onClose={() => { setOpen(false); setSelected(null); }} />
  );

  if (trigger) {
    return (
      <>
        <button type="button" className="fanus-mood-trigger" onClick={() => setPickerOpen(true)}>
          <span className="fanus-mood-trigger__icon"><TriggerIcon size={18} /></span>
          <span>{t("mood.title")}</span>
        </button>

        {pickerOpen && createPortal(
          <div className="fanus-mm-backdrop" onClick={() => setPickerOpen(false)}>
            <div className="fanus-mm-modal fanus-mood-picker-modal" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="fanus-mm-close" onClick={() => setPickerOpen(false)} aria-label={t("common.close")}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
              <div className="fanus-mood-picker-body">
                <div className="fanus-mood__head">
                  <h2>{t("mood.title")}</h2>
                  <p>{t("mood.sub")}</p>
                </div>
                {chips}
              </div>
            </div>
          </div>,
          document.body
        )}

        {modal}
        <style>{`${MOOD_CHIP_CSS}${MOOD_MODAL_CHROME_CSS}${MOOD_TRIGGER_CSS}`}</style>
      </>
    );
  }

  const body = (
    <>
      <div className="fanus-mood__head">
        <h2>{t("mood.title")}</h2>
        <p>{t("mood.sub")}</p>
      </div>

      {chips}
    </>
  );

  return compact ? (
    <div className="fanus-mood fanus-mood--compact">
      {body}
      {modal}
      <style>{`${MOOD_CHIP_CSS}${MOOD_COMPACT_CSS}`}</style>
    </div>
  ) : (
    <section className="fanus-mood" id="mood">
      <Deco type="blob-1" style={{ top: 60, left: "-3%", width: 280, opacity: .55 }} anim="drift" />
      <Deco type="circles-mix" style={{ top: 120, right: "-2%", width: 260, opacity: .65 }} />
      <Deco type="dot-small" style={{ bottom: 80, left: "8%", width: 50, opacity: .9 }} anim="floatY" />
      <div className="fanus-mood__bg" aria-hidden>
        <div className="fanus-mood__glow" />
      </div>
      <div className="fanus-container">
        {body}
      </div>

      {modal}

      <style>{`
        .fanus-mood { padding: 100px 0; position: relative; overflow: hidden; }
        .fanus-mood > .fanus-container { position: relative; z-index: 1; }
        .fanus-mood__bg { position: absolute; inset: 0; pointer-events: none; }
        .fanus-mood__glow {
          position: absolute; left: 50%; top: 0; transform: translateX(-50%);
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(245,185,70,.12) 0%, rgba(245,185,70,0) 50%);
        }
        .fanus-mood__head { max-width: 720px; margin: 0 0 48px; }
        .fanus-mood__head h2 {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.1; color: var(--fanus-ink);
          margin: 14px 0;
        }
        .fanus-mood__head p { font-size: 17px; color: var(--fanus-ink-3); margin: 0; }
        .fanus-mood__head .fanus-eyebrow { justify-content: center; }
        .fanus-mood__chips {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 14px; max-width: 880px; margin: 0 auto;
        }
        @media (max-width: 720px) { .fanus-mood__chips { grid-template-columns: repeat(2, 1fr); } }
        ${MOOD_CHIP_CSS}
      `}</style>
    </section>
  );
}

export function MoodModal({ mood, onClose }: { mood: Mood; onClose: () => void }) {
  const { t } = useT();
  // GAP-08: real psychologists matched to the selected mood's category.
  const [allPsy, setAllPsy] = useState<(Psychologist & { slug: string })[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const cat = MOOD_TO_CAT[mood.id];
  const matchHref = cat === "all" ? "/psychologists" : `/psychologists?filter=${cat}`;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    getPsychologists()
      .then(list => setAllPsy(withSlugs(list.filter(p => p.active !== false))))
      .catch(() => setAllPsy([]));
  }, []);

  useEffect(() => {
    getBlogPosts().then(setPosts).catch(() => setPosts([]));
  }, []);

  const matched = useMemo(() => {
    const byRating = [...allPsy].sort(
      (a, b) => parseFloat(b.rating ?? "0") - parseFloat(a.rating ?? "0"));
    if (cat === "all") return byRating.slice(0, 3);
    const inCat = byRating.filter(p => deriveCategory(p.specializations ?? []) === cat);
    // Top up with best-rated others when the category is thin.
    const rest = byRating.filter(p => !inCat.includes(p));
    return [...inCat, ...rest].slice(0, 3);
  }, [allPsy, cat]);

  // Real blog posts matched to the mood's category (top up with latest when thin).
  const matchedArticles = useMemo(() => {
    if (cat === "all") return posts.slice(0, 3);
    const catOf = (p: BlogPost) => deriveCategory([p.category, p.title, p.excerpt].filter(Boolean) as string[]);
    const inCat = posts.filter(p => catOf(p) === cat);
    const rest = posts.filter(p => !inCat.includes(p));
    return [...inCat, ...rest].slice(0, 3);
  }, [posts, cat]);

  const MESSAGE_KEYS: Record<MoodId, "mood.msgAnxious" | "mood.msgSad" | "mood.msgTired" | "mood.msgAngry" | "mood.msgMixed" | "mood.msgLonely"> = {
    anxious: "mood.msgAnxious",
    sad:     "mood.msgSad",
    tired:   "mood.msgTired",
    angry:   "mood.msgAngry",
    mixed:   "mood.msgMixed",
    lonely:  "mood.msgLonely",
  };

  return createPortal(
    <div className="fanus-mm-backdrop" onClick={onClose}>
      <div className="fanus-mm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="fanus-mm-close" onClick={onClose} aria-label={t("common.close")}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="fanus-mm-head">
          <div className="fanus-eyebrow" style={{ color: mood.color }}>
            <MoodIcon id={mood.id} size={18} /> {t("mood.feeling", { mood: mood.label })}
          </div>
          <h3 className="fanus-mm-quote">
            <span className="fanus-serif-accent">&ldquo;</span>
            {t(MESSAGE_KEYS[mood.id])}
            <span className="fanus-serif-accent">&rdquo;</span>
          </h3>
        </div>
        <div className="fanus-mm-body">
          <div>
            <div className="fanus-mm-title">{t("mood.suggestedArticles")}</div>
            <div className="fanus-mm-articles">
              {matchedArticles.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--fanus-ink-3)", padding: "10px 4px", gridColumn: "1 / -1" }}>
                  {t("common.loading")}
                </div>
              ) : matchedArticles.map((a) => (
                <Link key={a.id} className="fanus-mm-article" href={`/blog/${a.slug}`}>
                  <span className="fanus-mm-article__tag">{a.category}</span>
                  <span className="fanus-mm-article__title">{a.title}</span>
                  <span className="fanus-mm-article__meta">{t("articles.minutes", { n: a.readTimeMinutes })} →</span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="fanus-mm-title">{t("mood.suggestedPsychologists")}</div>
            <div className="fanus-mm-psyc">
              {matched.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--fanus-ink-3)", padding: "10px 4px" }}>
                  {t("common.loading")}
                </div>
              ) : matched.map((p) => (
                <div key={p.id} className="fanus-mm-psyc-card">
                  <div className="fanus-mm-psyc-card__avatar" style={{ background: p.accentColor || "#1051B7" }}>
                    {p.photoUrl
                      ? <img src={p.photoUrl} alt={p.name} className="fanus-mm-psyc-card__img" />
                      : p.name.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fanus-mm-psyc-card__name">{p.name}</div>
                    <div className="fanus-mm-psyc-card__spec">
                      {(p.specializations ?? []).slice(0, 2).join(", ") || p.title}
                      {p.experience ? ` · ${p.experience} ${t("psyList.yearsExp")}` : ""}
                    </div>
                    {p.sessionTypes && (
                      <div className="fanus-mm-psyc-card__types">
                        {p.sessionTypes.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3).map((st) => (
                          <span key={st} className="fanus-mm-psyc-card__type">{st}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/book/${p.slug}`}
                    className="fanus-btn fanus-btn-light fanus-btn-sm"
                    onClick={() => trackFunnelEvent("MOOD_BOOKING_CLICK", mood.id)}
                  >
                    {t("mood.sessionShort")}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="fanus-mm-foot">
          <button className="fanus-btn fanus-btn-ghost" onClick={onClose}>{t("mood.later")}</button>
          <Link
            href={matchHref}
            className="fanus-btn fanus-btn-primary"
            onClick={() => trackFunnelEvent("MOOD_MATCH_CLICK", mood.id)}
          >
            {t("mood.findMatch")}
          </Link>
        </div>
      </div>

      <style>{`
        ${MOOD_MODAL_CHROME_CSS}
        .fanus-mm-head {
          padding: 36px 36px 28px;
          background: linear-gradient(180deg, #F2F6FD, white);
          border-bottom: 1px solid var(--fanus-line);
        }
        .fanus-mm-quote {
          font-family: var(--fanus-serif); font-size: 22px; font-weight: 500;
          font-style: italic; line-height: 1.4;
          margin: 12px 0 0; color: var(--fanus-ink);
        }
        .fanus-mm-body { padding: 24px 36px; display: flex; flex-direction: column; gap: 28px; }
        .fanus-mm-title {
          font-size: 13px; font-weight: 700;
          letter-spacing: .06em; color: var(--fanus-ink-2);
          margin-bottom: 14px;
        }
        .fanus-mm-articles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .fanus-mm-article {
          display: flex; flex-direction: column; gap: 6px;
          padding: 16px; background: var(--fanus-primary-50);
          border-radius: 14px; transition: background .2s;
        }
        .fanus-mm-article:hover { background: var(--fanus-primary-100); }
        .fanus-mm-article__tag {
          font-size: 11px; font-weight: 700; color: var(--fanus-primary);
          text-transform: uppercase; letter-spacing: .06em;
        }
        .fanus-mm-article__title { font-size: 14px; font-weight: 600; color: var(--fanus-ink); line-height: 1.35; }
        .fanus-mm-article__meta { margin-top: auto; font-size: 12px; color: var(--fanus-ink-3); }
        .fanus-mm-psyc { display: flex; flex-direction: column; gap: 8px; }
        .fanus-mm-psyc-card {
          display: flex; align-items: center; gap: 14px;
          padding: 12px; border: 1px solid var(--fanus-line); border-radius: 14px;
          transition: border-color .2s;
        }
        .fanus-mm-psyc-card:hover { border-color: var(--fanus-primary-300); }
        .fanus-mm-psyc-card__avatar {
          width: 44px; height: 44px; border-radius: 50%;
          color: white; font-weight: 700; font-size: 14px;
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0; overflow: hidden;
        }
        .fanus-mm-psyc-card__img {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        .fanus-mm-psyc-card__name { font-size: 14px; font-weight: 600; color: var(--fanus-ink); }
        .fanus-mm-psyc-card__spec { font-size: 12px; color: var(--fanus-ink-3); }
        .fanus-mm-psyc-card__types { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
        .fanus-mm-psyc-card__type {
          font-size: 10.5px; font-weight: 600; color: var(--fanus-primary);
          background: var(--fanus-primary-50); border-radius: 6px; padding: 2px 7px;
        }
        .fanus-mm-foot {
          padding: 20px 36px 28px;
          display: flex; justify-content: flex-end; gap: 10px;
          border-top: 1px solid var(--fanus-line);
        }
        @media (max-width: 720px) {
          .fanus-mm-head { padding: 28px 20px 20px; }
          .fanus-mm-body { padding: 20px; }
          .fanus-mm-articles { grid-template-columns: 1fr; }
          .fanus-mm-foot { padding: 16px 20px 20px; flex-direction: column; }
          .fanus-mm-foot .fanus-btn { width: 100%; }
        }
      `}</style>
    </div>,
    document.body
  );
}
