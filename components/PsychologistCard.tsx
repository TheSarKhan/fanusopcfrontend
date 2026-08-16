"use client";

/**
 * Psixoloq kartı — həm ana səhifədəki "Psixoloqlar" bölməsində, həm də
 * `/psychologists` tam siyahı səhifəsində eyni komponent istifadə olunur ki,
 * iki yerdə fərqli kartlar görünməsin.
 *
 * Dizayn: DESIGN-PROMPT-psixoloq-karti.md ilə yaradılan eskizlərdən "Variant D"
 * (sıx, məlumat yönümlü siyahı) əsasında. Taqlar (ixtisas) sabit sayda kəsilmir —
 * hamısı göstərilir, tək sətirdə üfüqi sürüşən (scroll) zolaqla.
 */

import Link from "next/link";
import { useState } from "react";
import type { Psychologist } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import { toast } from "@/components/Toast";

/** Kart daralarkən ixtisas taqları/dillər bu saydan çoxdursa "+N" ilə kəsilir —
 *  klikləndikdə hamısı açılır (taqlar/dillər itmir, sadəcə defolt görünüş
 *  yığcamdır, istəyən "+N"-ə klikləyib hamısını görür, "Daha az göstər"ə
 *  klikləyib geri yığır). */
const TAG_CAP = 4;
const LANG_CAP = 3;

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
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const visibleSpecs = tagsExpanded ? p.specs : p.specs.slice(0, TAG_CAP);
  const hiddenTagCount = p.specs.length - TAG_CAP;
  const [langsExpanded, setLangsExpanded] = useState(false);
  const visibleLangs = langsExpanded ? langs : langs.slice(0, LANG_CAP);
  const hiddenLangCount = langs.length - LANG_CAP;

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
                <ShieldIcon size={12} />
                {t("psyProfile.verified")}
              </button>
            )}
          </div>
          <p className="pc-title">{p.title}</p>
        </div>
      </Link>

      {p.specs.length > 0 && (
        <div className="pc-tags">
          {visibleSpecs.map((s, i) => (
            <span key={i} className="pc-tag">{s}</span>
          ))}
          {!tagsExpanded && hiddenTagCount > 0 && (
            <button
              type="button"
              className="pc-tag pc-tag--more"
              onClick={() => setTagsExpanded(true)}
              aria-label={t("psyList.showAllTags", { n: p.specs.length })}
            >
              +{hiddenTagCount}
            </button>
          )}
          {tagsExpanded && p.specs.length > TAG_CAP && (
            <button
              type="button"
              className="pc-tag pc-tag--less"
              onClick={() => setTagsExpanded(false)}
            >
              {t("psyList.showFewerTags")}
            </button>
          )}
        </div>
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
        <div className="pc-langs">
          {visibleLangs.map((l, i) => (
            <span key={i} className="pc-lang-pill" title={l}>
              <span className="pc-flag"><FlagIcon lang={l} /></span>
              {langCode(l)}
            </span>
          ))}
          {!langsExpanded && hiddenLangCount > 0 && (
            <button
              type="button"
              className="pc-lang-pill pc-lang-pill--more"
              onClick={() => setLangsExpanded(true)}
              aria-label={t("psyList.showAllLangs", { n: langs.length })}
            >
              +{hiddenLangCount}
            </button>
          )}
          {langsExpanded && langs.length > LANG_CAP && (
            <button
              type="button"
              className="pc-lang-pill pc-lang-pill--more"
              onClick={() => setLangsExpanded(false)}
            >
              {t("psyList.showFewerTags")}
            </button>
          )}
        </div>
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
          display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
          background: var(--fanus-primary); color: #fff;
          border: none; border-radius: 999px; padding: 3px 9px 3px 7px; margin: 0;
          font-size: 10.5px; font-weight: 700; letter-spacing: .02em; white-space: nowrap;
          cursor: pointer; font-family: inherit;
        }
        .pc-title {
          font-size: 13px; color: var(--fanus-ink-3); margin: 3px 0 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .pc-tags { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
        .pc-tag {
          flex-shrink: 0; white-space: nowrap;
          font-size: 12.5px; font-weight: 600; letter-spacing: .01em;
          padding: 6px 13px; border-radius: 999px;
          background: var(--fanus-primary-50);
          color: var(--fanus-primary);
        }
        .pc-tag--more, .pc-tag--less {
          border: none; cursor: pointer; font-family: inherit;
          background: var(--fanus-bg); color: var(--fanus-ink-3);
          transition: background .15s, color .15s;
        }
        .pc-tag--more:hover, .pc-tag--less:hover { background: var(--fanus-primary-50); color: var(--fanus-primary); }
        .pc-tag--less { padding-left: 14px; padding-right: 14px; line-height: 1; }

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

        .pc-langs { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
        .pc-lang-pill {
          white-space: nowrap;
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
function GlobeIcon() { return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>; }
function HourIcon() { return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.18a2 2 0 00-.59-1.41L13 13l3.41-3.41A2 2 0 0017 8.18V4M7 22v-4.18a2 2 0 01.59-1.41L11 13 7.59 9.59A2 2 0 017 8.18V4" /></svg>; }
export function ShieldIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>; }

/** Qeydiyyat formasındakı sabit dil siyahısına uyğun bayraqlar (LANGUAGE_OPTIONS,
 *  bax app/(public)/register/page.tsx). Tanınmayan dil üçün qlobus ikonuna düşür —
 *  emoji bayraq işlətmirik (platforma qaydası: heç bir emoji, platformalar arası
 *  fərqli/qırıq görünə bilər). */
export function FlagIcon({ lang }: { lang: string }) {
  const l = lang.toLowerCase();
  if (l.startsWith("az")) return <FlagAZ />;
  if (l.includes("rus")) return <FlagRU />;
  if (l.includes("ngilis") || l.includes("english")) return <FlagGB />;
  if (l.includes("türk") || l.includes("turk")) return <FlagTR />;
  if (l.includes("alman") || l.includes("german")) return <FlagDE />;
  if (l.includes("frans") || l.includes("french")) return <FlagFR />;
  return <GlobeIcon />;
}

/** Dil adını qısa 2-hərfli koda çevirir (kartda pill yer tutmasın deyə) —
 *  eyni açar sözlər `FlagIcon`-la üst-üstə düşür. Naməlum dil ilk iki hərflə. */
function langCode(lang: string): string {
  const l = lang.toLowerCase();
  if (l.startsWith("az")) return "AZ";
  if (l.includes("rus")) return "RU";
  if (l.includes("ngilis") || l.includes("english")) return "EN";
  if (l.includes("türk") || l.includes("turk")) return "TR";
  if (l.includes("alman") || l.includes("german")) return "DE";
  if (l.includes("frans") || l.includes("french")) return "FR";
  if (l.includes("fars") || l.includes("persian") || l.includes("farsi")) return "FA";
  return lang.trim().slice(0, 2).toUpperCase();
}
const flagSvgProps = { width: "100%", height: "100%", viewBox: "0 0 20 14", preserveAspectRatio: "none" as const };
function FlagAZ() {
  return (
    <svg {...flagSvgProps}>
      <rect width="20" height="4.67" fill="#00B9E4" />
      <rect y="4.67" width="20" height="4.67" fill="#EF3340" />
      <rect y="9.33" width="20" height="4.67" fill="#509E2F" />
    </svg>
  );
}
function FlagRU() {
  return (
    <svg {...flagSvgProps}>
      <rect width="20" height="4.67" fill="#fff" />
      <rect y="4.67" width="20" height="4.67" fill="#0039A6" />
      <rect y="9.33" width="20" height="4.67" fill="#D52B1E" />
    </svg>
  );
}
function FlagDE() {
  return (
    <svg {...flagSvgProps}>
      <rect width="20" height="14" fill="#FFCE00" />
      <rect width="20" height="9.33" fill="#DD0000" />
      <rect width="20" height="4.67" fill="#000" />
    </svg>
  );
}
function FlagFR() {
  return (
    <svg {...flagSvgProps}>
      <rect width="20" height="14" fill="#fff" />
      <rect width="6.67" height="14" fill="#0055A4" />
      <rect x="13.33" width="6.67" height="14" fill="#EF4135" />
    </svg>
  );
}
function FlagTR() {
  return (
    <svg {...flagSvgProps}>
      <rect width="20" height="14" fill="#E30A17" />
      <circle cx="8" cy="7" r="3.6" fill="#fff" />
      <circle cx="9.3" cy="7" r="2.9" fill="#E30A17" />
      <circle cx="12.2" cy="7" r="0.9" fill="#fff" />
    </svg>
  );
}
function FlagGB() {
  return (
    <svg {...flagSvgProps}>
      <rect width="20" height="14" fill="#00247D" />
      <path d="M0,0 L20,14 M20,0 L0,14" stroke="#fff" strokeWidth="2.8" />
      <path d="M0,0 L20,14 M20,0 L0,14" stroke="#CF142B" strokeWidth="1.2" />
      <path d="M10,0 V14 M0,7 H20" stroke="#fff" strokeWidth="4.6" />
      <path d="M10,0 V14 M0,7 H20" stroke="#CF142B" strokeWidth="2.6" />
    </svg>
  );
}
