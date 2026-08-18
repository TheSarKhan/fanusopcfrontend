"use client";

/**
 * Psixoloq kartı — həm ana səhifədəki "Psixoloqlar" bölməsində, həm də
 * `/psychologists` tam siyahı səhifəsində eyni komponent istifadə olunur ki,
 * iki yerdə fərqli kartlar görünməsin.
 *
 * Dizayn: DESIGN-PROMPT-psixoloq-karti.md ilə yaradılan eskizlərdən "Variant D"
 * (sıx, məlumat yönümlü siyahı) əsasında. İxtisas taqları sabit sayda deyil —
 * kartın öz eninə görə tək sətirdə neçə taq sığırsa o qədəri göstərilir (bax
 * useSingleRowFit), qalanları "+N" nişanına yığılır və klikləndikdə popup-da
 * tam siyahı açılır. Sətrə sığmayıb kəsilmək əvəzinə kart hündürlüyü sabit qalır.
 */

import Link from "next/link";
import { createPortal } from "react-dom";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Psychologist } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import { toast } from "@/components/Toast";
import { FlagIcon, langCode } from "@/components/FlagIcons";

export { FlagIcon } from "@/components/FlagIcons";

/** "+N" nişanı üçün ehtiyat en (px) — sığım hesablananda son taqdan sonra
 *  yer qalmasa "+N" özü kəsilib qırağa çıxa bilər, ona görə əvvəlcədən ayrılır. */
const MORE_BADGE_RESERVE = 46;
const TAG_GAP = 8;

/**
 * Verilmiş mətn siyahısının neçəsi konteynerin bir sətrinə sığdığını real DOM
 * ölçüsü ilə hesablayır (font/padding fərqli ekranlarda kəsilmə nöqtəsi də
 * dəyişdiyi üçün sabit ədədlə deyil, ölçmə ilə). Görünməz "ölçmə sırası" eyni
 * `.pc-tag` stilində göstərilir ki, hər elementin təbii eni dəqiq bilinsin.
 */
function useSingleRowFit(items: string[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const recalc = () => {
      const available = container.offsetWidth;
      const nodes = Array.from(measure.children) as HTMLElement[];
      let used = 0;
      let fit = 0;
      for (let i = 0; i < nodes.length; i++) {
        const w = nodes[i].offsetWidth;
        const gap = fit > 0 ? TAG_GAP : 0;
        const hasMoreAfter = i < nodes.length - 1;
        const reserve = hasMoreAfter ? MORE_BADGE_RESERVE + TAG_GAP : 0;
        if (used + gap + w + reserve > available) break;
        used += gap + w;
        fit++;
      }
      setVisibleCount(items.length > 0 ? Math.max(fit, 1) : 0);
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(container);
    return () => ro.disconnect();
  }, [items]);

  return { containerRef, measureRef, visibleCount };
}

export interface PsyCardItem {
  id: number;
  slug: string;
  name: string;
  title: string;
  specs: string[];
  exp: number;
  rating: string;
  ratingCount?: number;
  sessions: string;
  lang: string;
  sessionMinutes: number;
  photoUrl?: string;
  statsSource?: "FANUS_PLATFORM" | "PRIOR_EXPERIENCE";
  displayedSessionCount?: number;
  verified?: boolean;
}

/** Backend `Psychologist` cavabını kart görünüşünə çevirir — hər iki səhifə eyni məntiqi işlədir. */
export function toPsyCardItem(p: Psychologist, slug: string): PsyCardItem {
  return {
    id: p.id,
    slug,
    name: p.name,
    title: p.title,
    specs: p.specializations || [],
    exp: parseInt(p.experience ?? "5", 10) || 5,
    rating: p.rating ?? "—",
    ratingCount: p.ratingCount,
    sessions: p.sessionsCount ?? "0",
    lang: (p.languages || "AZ").split(",").map((l) => l.trim()).filter(Boolean).join(", ") || "AZ",
    sessionMinutes: p.defaultSessionMinutes ?? 50,
    photoUrl: p.photoUrl?.trim() || undefined,
    statsSource: p.statsSource,
    displayedSessionCount: p.displayedSessionCount,
    verified: p.verified,
  };
}

function getInitials(name: string) {
  return name.split(" ").filter((w) => w.length > 1).map((w) => w[0]).slice(0, 2).join("");
}

export default function PsychologistCard({ p }: { p: PsyCardItem }) {
  const { t } = useT();
  const initials = getInitials(p.name);
  const ratingNum = parseFloat(p.rating);
  const hasRating = isFinite(ratingNum) && ratingNum > 0;
  const langs = p.lang.split(",").map((l) => l.trim()).filter(Boolean);
  // Qısa taqlar əvvəl göstərilir ki, sətrə daha çoxu sığsın — uzun taqlar
  // (sığmayanda) "+N" arxasına, popup-a düşür.
  const sortedSpecs = useMemo(() => [...p.specs].sort((a, b) => a.length - b.length), [p.specs]);
  const { containerRef: tagsRef, measureRef: tagsMeasureRef, visibleCount: visibleTagCount } = useSingleRowFit(sortedSpecs);
  const hiddenTagCount = sortedSpecs.length - visibleTagCount;
  const [tagsPopupOpen, setTagsPopupOpen] = useState(false);
  const [langsPopupOpen, setLangsPopupOpen] = useState(false);
  // Dil pilləri də ixtisas taqları kimi konteynerin öz eninə görə ölçülür —
  // sabit ədədlə kəsilmir, sətrə sığan qədəri göstərilir, qalanı "+N" popup-a düşür.
  const { containerRef: langsRef, measureRef: langsMeasureRef, visibleCount: visibleLangCount } = useSingleRowFit(langs);
  const hiddenLangCount = langs.length - visibleLangCount;

  return (
    <article className="pc-card">
      <Link href={`/psychologists/${p.slug}`} className="pc-head" aria-label={t("pub.profileAria", { name: p.name })}>
        <div className="pc-avatar">
          {p.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photoUrl} alt={p.name} />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="pc-head-body">
          <div className="pc-name-row">
            <h3 className="pc-name">{p.name}</h3>
            {/* Nişan yalnız admin təsdiqləyəndə görünür (V140). Təsdiqlənməyən
                psixoloq üçün heç nə yazılmır — «təsdiqlənməyib» etiketi mütəxəssisin
                nüfuzuna zərbə vurardı. */}
            {p.verified && (
              <button
                type="button"
                className="pc-verified"
                title={t("pub.verifiedPsy")}
                aria-label={t("pub.verifiedPsy")}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toast(t("psyList.verifiedNoteBody"), "info"); }}
              >
                <VerifiedBadgeIcon size={13} />
              </button>
            )}
          </div>
          <p className="pc-title">{p.title}</p>
        </div>
      </Link>

      {p.specs.length > 0 && (
        <>
          <div className="pc-tags" ref={tagsRef}>
            {sortedSpecs.slice(0, visibleTagCount).map((s, i) => (
              <span key={i} className="pc-tag" title={s}>{s}</span>
            ))}
            {hiddenTagCount > 0 && (
              <button
                type="button"
                className="pc-tag pc-tag--more"
                onClick={(e) => { e.preventDefault(); setTagsPopupOpen(true); }}
                aria-label={t("psyList.showAllTags", { n: p.specs.length })}
              >
                +{hiddenTagCount}
              </button>
            )}
          </div>
          {/* Görünməz ölçmə sırası — kartın öz eninə görə neçə taqın bir sətrə
              sığdığını bilmək üçün, heç bir vizual/skroll izi qoymadan. */}
          <div style={{ position: "relative", width: 0, height: 0, overflow: "hidden" }} aria-hidden>
            <div ref={tagsMeasureRef} style={{ position: "absolute", display: "flex", gap: TAG_GAP, whiteSpace: "nowrap" }}>
              {sortedSpecs.map((s, i) => <span key={i} className="pc-tag">{s}</span>)}
            </div>
          </div>
          {tagsPopupOpen && createPortal(
            <div className="pc-tags-backdrop" onClick={() => setTagsPopupOpen(false)}>
              <div className="pc-tags-modal" onClick={(e) => e.stopPropagation()}>
                <div className="pc-tags-modal__head">
                  <span>{t("psyList.allTagsTitle", { name: p.name })}</span>
                  <button type="button" className="pc-tags-modal__close" onClick={() => setTagsPopupOpen(false)} aria-label={t("common.close")}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
                <div className="pc-tags-modal__body">
                  {sortedSpecs.map((s, i) => <span key={i} className="pc-tag">{s}</span>)}
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}

      <div className="pc-divider" />

      <div className="pc-meta-row">
        <span className="pc-meta-item pc-meta-item--rating">
          <StarIcon />
          {hasRating ? (
            <>
              {p.rating}
              {p.ratingCount != null && p.ratingCount > 0 && <span className="pc-meta-sub"> ({p.ratingCount})</span>}
            </>
          ) : (
            <span className="pc-meta-sub">{t("psyList.noRating")}</span>
          )}
        </span>
        <span className="pc-meta-item"><ClockIcon />{p.exp} {t("psyList.yearsExp")}</span>
        <span className="pc-meta-item"><HourIcon />{t("psyList.minutes", { n: p.sessionMinutes })}</span>
      </div>

      {langs.length > 0 && (
        <>
          <div className="pc-langs" ref={langsRef}>
            {langs.slice(0, visibleLangCount).map((l, i) => (
              <span key={i} className="pc-lang-pill" title={l}>
                <span className="pc-flag"><FlagIcon lang={l} /></span>
                {langCode(l)}
              </span>
            ))}
            {hiddenLangCount > 0 && (
              <button
                type="button"
                className="pc-lang-pill pc-lang-pill--more"
                onClick={(e) => { e.preventDefault(); setLangsPopupOpen(true); }}
                aria-label={t("psyList.showAllLangs", { n: langs.length })}
              >
                +{hiddenLangCount}
              </button>
            )}
          </div>
          {/* Görünməz ölçmə sırası — dil pillərinin təbii enini bilmək üçün. */}
          <div style={{ position: "relative", width: 0, height: 0, overflow: "hidden" }} aria-hidden>
            <div ref={langsMeasureRef} style={{ position: "absolute", display: "flex", gap: TAG_GAP, whiteSpace: "nowrap" }}>
              {langs.map((l, i) => (
                <span key={i} className="pc-lang-pill">
                  <span className="pc-flag"><FlagIcon lang={l} /></span>
                  {langCode(l)}
                </span>
              ))}
            </div>
          </div>
          {langsPopupOpen && createPortal(
            <div className="pc-tags-backdrop" onClick={() => setLangsPopupOpen(false)}>
              <div className="pc-tags-modal" onClick={(e) => e.stopPropagation()}>
                <div className="pc-tags-modal__head">
                  <span>{t("psyList.allLangsTitle", { name: p.name })}</span>
                  <button type="button" className="pc-tags-modal__close" onClick={() => setLangsPopupOpen(false)} aria-label={t("common.close")}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
                <div className="pc-tags-modal__body">
                  {langs.map((l, i) => (
                    <span key={i} className="pc-lang-pill" title={l}>
                      <span className="pc-flag"><FlagIcon lang={l} /></span>
                      {langCode(l)}
                    </span>
                  ))}
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}

      <div className="pc-actions">
        <Link href={`/psychologists/${p.slug}`} className="pc-btn pc-btn--ghost">
          {t("psyList.profile")}
        </Link>
        <Link href={`/book/${p.slug}`} className="pc-btn pc-btn--primary">
          {t("psyList.bookCta")}
        </Link>
      </div>

      <style>{`
        .pc-card {
          background: white;
          border: 1px solid var(--fanus-line);
          border-radius: 16px;
          padding: 20px;
          display: flex; flex-direction: column; gap: 13px;
          /* min-width:0 sındırır flex-item-in default "min-width:auto" davranışını —
             onsuz kart daxilindəki pillər sırası (məzmun eni) kartı öz flex-basis-dən
             (300px) enli edirdi, kart "uzun/enli" görünürdü. */
          min-width: 0; max-width: 100%;
          overflow: hidden;
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .pc-card:hover {
          border-color: var(--fanus-primary-200);
          box-shadow: var(--fanus-shadow-md);
        }

        .pc-head {
          display: flex; gap: 12px; align-items: center;
          text-decoration: none; color: inherit;
        }
        .pc-head:hover .pc-name { color: var(--fanus-primary); }

        .pc-avatar {
          flex-shrink: 0;
          width: 58px; height: 58px; border-radius: 50%;
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: var(--fanus-primary-50);
          color: var(--fanus-primary);
          font-family: var(--font-poppins), sans-serif;
          font-size: 19px; font-weight: 700;
        }
        .pc-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }

        .pc-head-body { flex: 1; min-width: 0; }
        .pc-name-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .pc-name {
          font-size: 17px; line-height: 1.3; margin: 0; font-weight: 700;
          color: var(--fanus-ink); transition: color .2s ease;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pc-verified {
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
          width: 20px; height: 20px; border-radius: 999px;
          background: var(--fanus-primary); color: #fff;
          border: none; padding: 0; margin: 0;
          cursor: pointer; font-family: inherit;
        }
        .pc-title {
          font-size: 13px; color: var(--fanus-ink-3); margin: 3px 0 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .pc-tags { display: flex; flex-wrap: nowrap; gap: 8px; width: 100%; min-width: 0; overflow: hidden; }
        .pc-tag {
          flex-shrink: 0; white-space: nowrap;
          font-size: 12.5px; font-weight: 600; letter-spacing: .01em;
          padding: 6px 13px; border-radius: 999px;
          background: var(--fanus-primary-50);
          color: var(--fanus-primary);
        }
        /* Ən uzun taq belə "+N" nişanını kənara sıxışdırıb kəsdirməsin deyə —
           sətirdəki taqlar özləri də lazım gələndə "…" ilə kəsilir (popup-dakı
           tam siyahıda bu limit yoxdur). */
        .pc-tags .pc-tag { max-width: calc(100% - 54px); overflow: hidden; text-overflow: ellipsis; }
        .pc-tag--more {
          border: none; cursor: pointer; font-family: inherit;
          background: var(--fanus-bg); color: var(--fanus-ink-3);
          transition: background .15s, color .15s;
        }
        .pc-tag--more:hover { background: var(--fanus-primary-50); color: var(--fanus-primary); }

        .pc-tags-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(15,28,46,.5); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .pc-tags-modal {
          background: #fff; border-radius: 18px; width: min(420px, 100%);
          max-height: 80vh; overflow: auto;
          box-shadow: 0 24px 60px rgba(10,26,51,.28);
        }
        .pc-tags-modal__head {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 18px 20px; border-bottom: 1px solid var(--fanus-line);
          font-size: 14px; font-weight: 700; color: var(--fanus-ink);
        }
        .pc-tags-modal__close {
          flex-shrink: 0; width: 30px; height: 30px; border-radius: 999px;
          border: none; background: var(--fanus-bg); color: var(--fanus-ink-2);
          display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .pc-tags-modal__close:hover { background: var(--fanus-primary-100); color: var(--fanus-primary); }
        .pc-tags-modal__body { display: flex; flex-wrap: wrap; gap: 8px; padding: 18px 20px; }

        .pc-divider { height: 1px; background: var(--fanus-line); }

        .pc-meta-row {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          font-size: 12.5px; color: var(--fanus-ink-3);
        }
        .pc-meta-item { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
        .pc-meta-item svg { flex-shrink: 0; color: var(--fanus-ink-3); }
        .pc-meta-item--rating { color: var(--fanus-ink); font-weight: 700; }
        .pc-meta-item--rating svg { color: #C97D2E; }
        .pc-meta-sub { color: var(--fanus-ink-3); font-weight: 500; }

        .pc-langs { display: flex; flex-wrap: nowrap; gap: 8px; width: 100%; min-width: 0; overflow: hidden; }
        .pc-lang-pill {
          flex-shrink: 0; white-space: nowrap;
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12.5px; font-weight: 500; color: var(--fanus-ink-2);
          padding: 5px 12px 5px 7px; border-radius: 999px;
          border: 1px solid var(--fanus-line); background: white;
        }
        .pc-lang-pill--more {
          cursor: pointer; font-family: inherit; padding: 5px 12px;
          color: var(--fanus-ink-3);
          transition: background .15s, color .15s, border-color .15s;
        }
        .pc-lang-pill--more:hover { background: var(--fanus-primary-50); color: var(--fanus-primary); border-color: var(--fanus-primary-200); }
        .pc-flag {
          display: inline-flex; flex-shrink: 0;
          width: 18px; height: 12px; border-radius: 2px; overflow: hidden;
          background: var(--fanus-bg); color: var(--fanus-ink-3);
          box-shadow: inset 0 0 0 1px rgba(10,26,51,.1);
        }

        .pc-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: auto; }
        .pc-btn {
          display: inline-flex; align-items: center; justify-content: center;
          height: 40px; padding: 0 10px; border-radius: 10px;
          font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
          text-decoration: none; border: 1px solid transparent;
          transition: transform .2s ease, box-shadow .2s ease, background .2s ease, color .2s ease, border-color .2s ease;
          white-space: nowrap;
        }
        .pc-btn--ghost {
          background: white; color: var(--fanus-ink); border-color: var(--fanus-line);
        }
        .pc-btn--ghost:hover { border-color: var(--fanus-primary-300); color: var(--fanus-primary); }
        .pc-btn--primary { background: var(--fanus-primary); color: white; }
        .pc-btn--primary:hover {
          background: var(--fanus-primary-600, #0B3F90);
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(16,81,183,.22);
        }
      `}</style>
    </article>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#C97D2E">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
function ClockIcon() { return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>; }
function HourIcon() { return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.18a2 2 0 00-.59-1.41L13 13l3.41-3.41A2 2 0 0017 8.18V4M7 22v-4.18a2 2 0 01.59-1.41L11 13 7.59 9.59A2 2 0 017 8.18V4" /></svg>; }
/** Universal "verified" simvolu — dairə + tik (Twitter/Instagram üslubu), qalxan
 *  formasından daha aydındır: hər kəs bunu dərhal "doğrulanıb" kimi tanıyır. */
export function VerifiedBadgeIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.3" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></svg>; }
