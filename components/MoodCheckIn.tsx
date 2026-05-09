"use client";

import { useEffect, useState } from "react";
import Deco from "@/components/Deco";
import { useT } from "@/lib/i18n/LocaleProvider";

type MoodId = "anxious" | "sad" | "tired" | "angry" | "mixed" | "lonely" | "hopeful" | "happy";
type Mood = { id: MoodId; label: string; color: string };

const MOOD_COLORS: Record<MoodId, string> = {
  anxious: "#88AEEC",
  sad:     "#5089E0",
  tired:   "#2A6BD0",
  angry:   "#1051B7",
  mixed:   "#0B3F90",
  lonely:  "#1A3B7A",
  hopeful: "#3D70C8",
  happy:   "#1051B7",
};

function MoodIcon({ id, size = 30 }: { id: MoodId; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "anxious": return <svg {...p}><path d="M9 18 Q4 18 4 14 Q4 10 8 10 Q9 6 13 6 Q19 6 20 11 Q26 11 26 16 Q26 20 22 20 L9 20 Z" fill="currentColor" opacity=".18"/><path d="M9 18 Q4 18 4 14 Q4 10 8 10 Q9 6 13 6 Q19 6 20 11 Q26 11 26 16 Q26 20 22 20 L9 20 Z"/><path d="M11 24 L10 27 M16 24 L15 27 M21 24 L20 27"/></svg>;
    case "sad": return <svg {...p}><path d="M16 4 Q24 14 24 20 A8 8 0 0 1 8 20 Q8 14 16 4 Z" fill="currentColor" opacity=".18"/><path d="M16 4 Q24 14 24 20 A8 8 0 0 1 8 20 Q8 14 16 4 Z"/><path d="M12 19 Q12 23 15 24"/></svg>;
    case "tired": return <svg {...p}><path d="M22 19 A9 9 0 1 1 13 8 A7 7 0 0 0 22 19 Z" fill="currentColor" opacity=".18"/><path d="M22 19 A9 9 0 1 1 13 8 A7 7 0 0 0 22 19 Z"/><path d="M22 6 L26 6 L22 10 L26 10" strokeWidth="1.4"/></svg>;
    case "angry": return <svg {...p}><path d="M17 3 L7 18 L14 18 L11 29 L23 13 L16 13 L19 3 Z" fill="currentColor" opacity=".18"/><path d="M17 3 L7 18 L14 18 L11 29 L23 13 L16 13 L19 3 Z"/></svg>;
    case "mixed": return <svg {...p}><circle cx="12" cy="16" r="7" fill="currentColor" opacity=".18"/><circle cx="20" cy="16" r="7" fill="currentColor" opacity=".18"/><circle cx="12" cy="16" r="7"/><circle cx="20" cy="16" r="7"/></svg>;
    case "lonely": return <svg {...p}><path d="M5 26 Q16 14 27 26" opacity=".4"/><circle cx="16" cy="14" r="3.2" fill="currentColor" opacity=".18"/><circle cx="16" cy="14" r="3.2"/><path d="M11 26 Q16 19 21 26"/></svg>;
    case "hopeful": return <svg {...p}><circle cx="16" cy="18" r="5" fill="currentColor" opacity=".22"/><circle cx="16" cy="18" r="5"/><path d="M4 24 L28 24"/><path d="M16 9 L16 6 M9 12 L7 10 M23 12 L25 10 M5 18 L3 18 M27 18 L29 18"/></svg>;
    case "happy": return <svg {...p}><path d="M6 20 Q16 8 26 20" fill="currentColor" opacity=".18"/><path d="M6 20 Q16 8 26 20"/><circle cx="11" cy="15" r="1.4" fill="currentColor"/><circle cx="21" cy="15" r="1.4" fill="currentColor"/></svg>;
  }
}

export default function MoodCheckIn() {
  const { t } = useT();
  const [selected, setSelected] = useState<Mood | null>(null);
  const [open, setOpen] = useState(false);

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
    setTimeout(() => setOpen(true), 250);
  };

  return (
    <section className="fanus-mood" id="mood">
      <Deco type="blob-1" style={{ top: 60, left: "-3%", width: 280, opacity: .55 }} anim="drift" />
      <Deco type="circles-mix" style={{ top: 120, right: "-2%", width: 260, opacity: .65 }} />
      <Deco type="dot-small" style={{ bottom: 80, left: "8%", width: 50, opacity: .9 }} anim="floatY" />
      <div className="fanus-mood__bg" aria-hidden>
        <div className="fanus-mood__glow" />
      </div>
      <div className="fanus-container">
        <div className="fanus-mood__head">
          <div className="fanus-eyebrow"><span className="dash" /> {t("mood.eyebrow")} <span className="dash" /></div>
          <h2>{t("mood.title")}</h2>
          <p>{t("mood.sub")}</p>
        </div>

        <div className="fanus-mood__chips">
          {MOODS.map((m) => (
            <button
              key={m.id}
              className={`fanus-mood-chip ${selected?.id === m.id ? "is-on" : ""}`}
              onClick={() => onPick(m)}
              style={{ ["--mood-color" as string]: m.color }}
            >
              <span className="fanus-mood-chip__icon" style={{ color: m.color }}>
                <MoodIcon id={m.id} size={32} />
              </span>
              <span className="fanus-mood-chip__label">{m.label}</span>
              <span className="fanus-mood-chip__ring" aria-hidden />
            </button>
          ))}
        </div>
      </div>

      {open && selected && (
        <MoodModal mood={selected} onClose={() => { setOpen(false); setSelected(null); }} />
      )}

      <style>{`
        .fanus-mood { padding: 100px 0; position: relative; overflow: hidden; }
        .fanus-mood > .fanus-container { position: relative; z-index: 1; }
        .fanus-mood__bg { position: absolute; inset: 0; pointer-events: none; }
        .fanus-mood__glow {
          position: absolute; left: 50%; top: 0; transform: translateX(-50%);
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(245,185,70,.12) 0%, rgba(245,185,70,0) 50%);
        }
        .fanus-mood__head { text-align: center; max-width: 720px; margin: 0 auto 48px; }
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
        .fanus-mood-chip__label { font-size: 14px; font-weight: 600; }
        .fanus-mood-chip__ring {
          position: absolute; inset: -2px; border-radius: 18px;
          border: 2px solid var(--mood-color); opacity: 0;
          transition: opacity .2s;
        }
        .fanus-mood-chip:hover .fanus-mood-chip__ring { opacity: .25; }
        @media (max-width: 720px) { .fanus-mood__chips { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </section>
  );
}

function MoodModal({ mood, onClose }: { mood: Mood; onClose: () => void }) {
  const { t } = useT();
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const MESSAGE_KEYS: Record<MoodId, "mood.msgAnxious" | "mood.msgSad" | "mood.msgTired" | "mood.msgAngry" | "mood.msgMixed" | "mood.msgLonely" | "mood.msgHopeful" | "mood.msgHappy"> = {
    anxious: "mood.msgAnxious",
    sad:     "mood.msgSad",
    tired:   "mood.msgTired",
    angry:   "mood.msgAngry",
    mixed:   "mood.msgMixed",
    lonely:  "mood.msgLonely",
    hopeful: "mood.msgHopeful",
    happy:   "mood.msgHappy",
  };

  const articles = [
    { tag: t("psyList.filterAnxiety"), title: t("articles.title"),       read: t("articles.minutes", { n: 6 }) },
    { tag: t("how.eyebrow"),           title: t("how.step1Text"),        read: t("articles.minutes", { n: 4 }) },
    { tag: t("psyList.filterAnxiety"), title: t("home.heroSub"),         read: t("articles.minutes", { n: 8 }) },
  ];
  const psyc = [
    { name: "Aysel Məmmədova", spec: t("psyList.filterAnxiety"),  exp: `8 ${t("psyList.yearsExp")}`,  color: "#5089E0" },
    { name: "Rəşad Quliyev",   spec: t("psyList.filterTrauma"),   exp: `11 ${t("psyList.yearsExp")}`, color: "#F5B946" },
    { name: "Lalə Hüseynova",  spec: t("psyList.filterFamily"),   exp: `6 ${t("psyList.yearsExp")}`,  color: "#1051B7" },
  ];

  return (
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
              {articles.map((a, i) => (
                <a key={i} className="fanus-mm-article" href="/blog">
                  <span className="fanus-mm-article__tag">{a.tag}</span>
                  <span className="fanus-mm-article__title">{a.title}</span>
                  <span className="fanus-mm-article__meta">{a.read} →</span>
                </a>
              ))}
            </div>
          </div>
          <div>
            <div className="fanus-mm-title">{t("mood.suggestedPsychologists")}</div>
            <div className="fanus-mm-psyc">
              {psyc.map((p, i) => (
                <div key={i} className="fanus-mm-psyc-card">
                  <div className="fanus-mm-psyc-card__avatar" style={{ background: p.color }}>
                    {p.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fanus-mm-psyc-card__name">{p.name}</div>
                    <div className="fanus-mm-psyc-card__spec">{p.spec} · {p.exp}</div>
                  </div>
                  <button className="fanus-btn fanus-btn-light fanus-btn-sm">{t("mood.sessionShort")}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="fanus-mm-foot">
          <button className="fanus-btn fanus-btn-ghost" onClick={onClose}>{t("mood.later")}</button>
          <a href="/psychologists" className="fanus-btn fanus-btn-primary">{t("mood.findMatch")}</a>
        </div>
      </div>

      <style>{`
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
          flex-shrink: 0;
        }
        .fanus-mm-psyc-card__name { font-size: 14px; font-weight: 600; color: var(--fanus-ink); }
        .fanus-mm-psyc-card__spec { font-size: 12px; color: var(--fanus-ink-3); }
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
    </div>
  );
}
