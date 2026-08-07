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
import type { Psychologist } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

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
              <span className="pc-verified" title={t("pub.verifiedPsy")} aria-label={t("pub.verifiedPsy")}>
                <ShieldIcon />
              </span>
            )}
          </div>
          <p className="pc-title">{p.title}</p>
        </div>
      </Link>

      {p.specs.length > 0 && (
        <div className="pc-tags-scroll">
          <div className="pc-tags">
            {p.specs.map((s, i) => (
              <span key={i} className="pc-tag">{s}</span>
            ))}
          </div>
        </div>
      )}

      <div className="pc-divider" />

      <div className="pc-meta-row">
        {hasRating ? (
          <span className="pc-meta-item pc-meta-item--rating">
            <StarIcon />{p.rating}
            {p.ratingCount != null && p.ratingCount > 0 && <span className="pc-meta-sub"> ({p.ratingCount})</span>}
          </span>
        ) : null}
        <span className="pc-meta-item"><ClockIcon />{p.exp} {t("psyList.yearsExp")}</span>
        <span className="pc-meta-item"><HourIcon />{t("psyList.minutes", { n: p.sessionMinutes })}</span>
      </div>

      {langs.length > 0 && (
        <div className="pc-langs">
          {langs.map((l, i) => (
            <span key={i} className="pc-lang-pill">{l}</span>
          ))}
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
          border-radius: 18px;
          padding: 16px;
          display: flex; flex-direction: column; gap: 10px;
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .pc-card:hover {
          border-color: var(--fanus-primary-200);
          box-shadow: var(--fanus-shadow-md);
        }

        .pc-head {
          display: flex; gap: 14px; align-items: center;
          text-decoration: none; color: inherit;
        }
        .pc-head:hover .pc-name { color: var(--fanus-primary); }

        .pc-avatar {
          flex-shrink: 0;
          width: 56px; height: 56px; border-radius: 50%;
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: var(--fanus-primary-50);
          color: var(--fanus-primary);
          font-family: var(--font-poppins), sans-serif;
          font-size: 18px; font-weight: 700;
        }
        .pc-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }

        .pc-head-body { flex: 1; min-width: 0; }
        .pc-name-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .pc-name {
          font-size: 17px; line-height: 1.25; margin: 0; font-weight: 700;
          color: var(--fanus-ink); transition: color .2s ease;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pc-verified { display: inline-flex; flex-shrink: 0; color: var(--fanus-primary); }
        .pc-title {
          font-size: 13px; color: var(--fanus-ink-3); margin: 2px 0 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .pc-tags-scroll {
          margin: 0 -16px; padding: 0 16px;
          overflow-x: auto; scrollbar-width: none;
        }
        .pc-tags-scroll::-webkit-scrollbar { display: none; }
        .pc-tags { display: flex; flex-wrap: nowrap; gap: 8px; width: max-content; }
        .pc-tag {
          flex-shrink: 0; white-space: nowrap;
          font-size: 12.5px; font-weight: 600; letter-spacing: .01em;
          padding: 6px 13px; border-radius: 999px;
          background: var(--fanus-primary-50);
          color: var(--fanus-primary);
        }

        .pc-divider { height: 1px; background: var(--fanus-line); }

        .pc-meta-row {
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
          font-size: 12.5px; color: var(--fanus-ink-3);
        }
        .pc-meta-item { display: inline-flex; align-items: center; gap: 5px; }
        .pc-meta-item svg { flex-shrink: 0; color: var(--fanus-ink-3); }
        .pc-meta-item--rating { color: var(--fanus-ink); font-weight: 700; }
        .pc-meta-item--rating svg { color: #C97D2E; }
        .pc-meta-sub { color: var(--fanus-ink-3); font-weight: 500; }
        .pc-langs { display: flex; flex-wrap: wrap; gap: 8px; }
        .pc-lang-pill {
          font-size: 12px; font-weight: 500; color: var(--fanus-ink-2);
          padding: 5px 12px; border-radius: 999px;
          border: 1px solid var(--fanus-line); background: white;
        }

        .pc-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .pc-btn {
          display: inline-flex; align-items: center; justify-content: center;
          height: 42px; padding: 0 14px; border-radius: 11px;
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
function ShieldIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>; }
