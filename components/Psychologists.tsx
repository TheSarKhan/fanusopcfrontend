"use client";

import Link from "next/link";
import type { Psychologist, PackageSummary } from "@/lib/api";
import Deco from "@/components/Deco";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatAzn } from "@/lib/money";

interface CardItem {
  id: number;
  slug: string;
  name: string;
  title: string;
  specs: string[];
  exp: number;
  rating: string;
  sessions: string;
  lang: string;
  sessionMinutes: number;
  photoUrl?: string;
  individualPrice?: number | null;
  currency?: string;
  packages?: PackageSummary[];
  statsSource?: "FANUS_PLATFORM" | "PRIOR_EXPERIENCE";
  displayedSessionCount?: number;
}

const FALLBACK: CardItem[] = [
  { id: 1, slug: "aysel-memmedova", name: "Aysel Məmmədova", title: "Klinik psixoloq",      specs: ["Narahatlıq", "OKD", "Panik"],  exp: 8,  rating: "4.9", sessions: "210", lang: "AZ · RU",      sessionMinutes: 50 },
  { id: 2, slug: "resad-quliyev",   name: "Rəşad Quliyev",   title: "Travma terapevti",     specs: ["Travma", "TSSP"],              exp: 11, rating: "4.8", sessions: "315", lang: "AZ · EN",      sessionMinutes: 50 },
  { id: 3, slug: "lale-huseynova",  name: "Lalə Hüseynova",  title: "Ailə terapevti",       specs: ["Münasibətlər", "Ailə"],        exp: 6,  rating: "4.7", sessions: "140", lang: "AZ",           sessionMinutes: 50 },
  { id: 4, slug: "elnur-seferov",   name: "Elnur Səfərov",   title: "Klinik psixoloq",      specs: ["Depressiya", "Burnout"],       exp: 9,  rating: "4.9", sessions: "260", lang: "AZ · RU",      sessionMinutes: 50 },
  { id: 5, slug: "nigar-kazimova",  name: "Nigar Kazımova",  title: "Uşaq psixoloqu",       specs: ["Yeniyetmə", "Valideyn"],       exp: 7,  rating: "4.8", sessions: "180", lang: "AZ",           sessionMinutes: 50 },
  { id: 6, slug: "tural-babayev",   name: "Tural Babayev",   title: "Asılılıq mütəxəssisi", specs: ["Asılılıq", "İmpuls"],          exp: 10, rating: "4.7", sessions: "240", lang: "AZ · RU",      sessionMinutes: 50 },
];

function getInitials(name: string) {
  return name.split(" ").filter(w => w.length > 1).map(w => w[0]).slice(0, 2).join("");
}

export default function Psychologists({ psychologists }: { psychologists?: Psychologist[] }) {
  const { t } = useT();
  const data: CardItem[] = (psychologists && psychologists.length > 0)
    ? psychologists.slice(0, 6).map((p) => ({
        id: p.id,
        slug: String(p.id),
        name: p.name,
        title: p.title,
        specs: (p.specializations || []).slice(0, 4),
        exp: parseInt(p.experience ?? "5", 10) || 5,
        rating: p.rating ?? "—",
        sessions: p.sessionsCount ?? "0",
        lang: (p.languages || "AZ").split(",").map((l) => l.trim()).filter(Boolean).join(" · ") || "AZ",
        sessionMinutes: p.defaultSessionMinutes ?? 50,
        photoUrl: p.photoUrl?.trim() || undefined,
        individualPrice: p.individualPrice ?? null,
        currency: p.currency,
        packages: p.packages || [],
        statsSource: p.statsSource,
        displayedSessionCount: p.displayedSessionCount,
      }))
    : FALLBACK;

  return (
    <section className="fanus-psyc" id="psychologists">
      <Deco type="wave-top-2" style={{ top: -30, right: "-6%", width: 460, opacity: .5 }} anim="drift" />
      <Deco type="target" style={{ bottom: 80, left: "4%", width: 140, opacity: .65 }} />
      <div className="fanus-container">
        <div className="fanus-psyc__head">
          <div>
            <h2>{t("psyList.title")}</h2>
            <p className="fanus-psyc__lead">{t("psyList.lead")}</p>
          </div>
          <Link href="/psychologists" className="fanus-btn fanus-btn-ghost">
            {t("psyList.seeAll")} <Arrow />
          </Link>
        </div>

        <div className="fanus-psyc__grid">
          {data.map((p) => <PsyCard key={p.id} p={p} />)}
        </div>
      </div>

      <style>{`
        .fanus-psyc { padding: 100px 0; position: relative; overflow: hidden; }
        .fanus-psyc > .fanus-container { position: relative; z-index: 1; }
        .fanus-psyc__head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 48px; gap: 24px; flex-wrap: wrap; }
        .fanus-psyc__head h2 {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.1; color: var(--fanus-ink);
          margin: 14px 0 0;
        }
        .fanus-psyc__lead { margin-top: 12px; max-width: 540px; font-size: 17px; color: var(--fanus-ink-3); }
        .fanus-psyc__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
        @media (max-width: 980px) { .fanus-psyc__grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .fanus-psyc__grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function PsyCard({ p }: { p: CardItem }) {
  const { t } = useT();
  const initials = getInitials(p.name);
  const ratingNum = parseFloat(p.rating);
  const filledStars = isFinite(ratingNum) ? Math.round(ratingNum) : 0;
  const hasSessions = p.sessions && p.sessions !== "0" && p.sessions !== "—";

  return (
    <article className="pp-card">
      <div className="pp-card__accent" />

      <Link href={`/psychologists/${p.slug}`} className="pp-card__head" aria-label={`${p.name} profili`}>
        <div className="pp-card__photo">
          {p.photoUrl ? (
             
            <img src={p.photoUrl} alt={p.name} />
          ) : (
            <span className="pp-card__initials">{initials}</span>
          )}
        </div>

        <div className="pp-card__head-body">
          <div className="pp-card__name-row">
            <h3 className="pp-card__name">{p.name}</h3>
            <span className="pp-card__verified" title="Doğrulanmış psixoloq" aria-label="Doğrulanmış psixoloq">
              <ShieldIcon />
            </span>
          </div>
          <p className="pp-card__title">{p.title}</p>
          {filledStars > 0 && (
            <div className="pp-card__rating">
              <Stars value={filledStars} />
              <strong>{p.rating}</strong>
              {hasSessions && <span className="pp-card__rating-sep">·</span>}
              {hasSessions && <span className="pp-card__rating-sub">{t("psyList.sessionsCount", { count: p.sessions })}</span>}
            </div>
          )}
        </div>
      </Link>

      {p.specs.length > 0 && (
        <div className="pp-card__tags">
          {p.specs.slice(0, 3).map((s, i) => (
            <span key={i} className="pp-tag">{s}</span>
          ))}
          {p.specs.length > 3 && (
            <span className="pp-tag pp-tag--ghost">+{p.specs.length - 3}</span>
          )}
        </div>
      )}

      <ul className="pp-card__meta">
        <li><GlobeIcon /> {p.lang}</li>
        <li><ClockIcon /> {p.exp} {t("psyList.yearsExp")}</li>
        <li><HourIcon /> {t("psyList.minutes", { n: p.sessionMinutes })}</li>
      </ul>

      {p.displayedSessionCount != null && p.displayedSessionCount > 0 && (
        <div className="pp-card__stats">
          <span className="pp-tag pp-tag--stats">
            {p.statsSource === "FANUS_PLATFORM"
              ? `${t("psyStats.fanusSessions")}: ${p.displayedSessionCount}`
              : `${t("psyStats.priorSessions")}: ${p.displayedSessionCount}`}
          </span>
        </div>
      )}

      {(p.individualPrice != null || (p.packages && p.packages.length > 0)) && (
        <div className="pp-card__pricing">
          {p.individualPrice != null && (
            <div className="pp-card__price">
              <TagIcon />
              <span className="pp-card__price-label">{t("pricing.individual")}</span>
              <strong className="pp-card__price-val">{formatAzn(p.individualPrice)}</strong>
            </div>
          )}
          {p.packages && p.packages.length > 0 && (
            <div className="pp-card__packs">
              {p.packages.map((pk) => (
                <span key={pk.id} className="pp-pack">
                  {pk.name} — {formatAzn(pk.packagePrice)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pp-card__foot">
        <Link href={`/psychologists/${p.slug}`} className="pp-btn pp-btn--ghost">
          {t("psyList.profile")}
          <Arrow />
        </Link>
        <Link href={`/book/${p.slug}`} className="pp-btn pp-btn--primary">
          <CalIcon /> {t("psyList.bookCta")}
        </Link>
      </div>

      <style>{`
        .pp-card {
          position: relative;
          background: white;
          border: 1px solid var(--fanus-line);
          border-radius: 22px;
          padding: 22px 22px 18px;
          display: flex; flex-direction: column; gap: 14px;
          overflow: hidden;
          transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease;
        }
        .pp-card::before {
          content: ""; position: absolute; left: 0; right: 0; top: 0; height: 4px;
          background: linear-gradient(90deg, transparent, currentColor, transparent);
          color: var(--fanus-primary-200);
          opacity: 0; transition: opacity .25s ease;
        }
        .pp-card:hover {
          transform: translateY(-4px);
          border-color: var(--fanus-primary-200);
          box-shadow: 0 22px 50px rgba(16,81,183,.10);
        }
        .pp-card:hover::before { opacity: 1; }

        .pp-card__accent {
          position: absolute; top: -60px; right: -60px;
          width: 180px; height: 180px; border-radius: 50%;
          background: linear-gradient(135deg, var(--fanus-primary-50), var(--fanus-primary-100));
          opacity: .55; pointer-events: none; filter: blur(12px);
        }

        .pp-card__head {
          display: flex; gap: 14px; align-items: flex-start;
          text-decoration: none; color: inherit;
          position: relative; z-index: 1;
        }
        .pp-card__head:hover .pp-card__name { color: var(--fanus-primary); }

        .pp-card__photo {
          position: relative; flex-shrink: 0;
          width: 76px; height: 76px; border-radius: 18px;
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: var(--fanus-primary-50);
          box-shadow: 0 6px 18px rgba(16,81,183,.10);
        }
        .pp-card__photo img {
          width: 100%; height: 100%; object-fit: cover; object-position: top;
          display: block;
        }
        .pp-card__initials {
          font-family: var(--font-playfair), serif;
          font-size: 28px; font-weight: 600; color: var(--fanus-primary);
        }

        .pp-card__head-body { flex: 1; min-width: 0; }
        .pp-card__name-row {
          display: flex; align-items: center; gap: 6px;
          margin: 2px 0 4px;
        }
        .pp-card__verified {
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          width: 18px; height: 18px;
          color: var(--fanus-primary);
        }
        .pp-card__name {
          font-size: 17px; line-height: 1.2;
          margin: 0; font-weight: 700;
          color: var(--fanus-ink);
          transition: color .2s ease;
          overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          min-width: 0;
        }
        .pp-card__title {
          font-size: 13px; color: var(--fanus-ink-3);
          margin: 0 0 8px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pp-card__rating {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12.5px; color: var(--fanus-ink-3);
        }
        .pp-card__rating strong { color: var(--fanus-ink); font-weight: 700; }
        .pp-card__rating-sep { opacity: .5; }
        .pp-card__rating-sub { color: var(--fanus-ink-3); }

        .pp-card__tags {
          display: flex; flex-wrap: wrap; gap: 6px;
          position: relative; z-index: 1;
        }
        .pp-tag {
          font-size: 11.5px; padding: 4px 10px; border-radius: 999px;
          font-weight: 600; letter-spacing: .01em;
          background: var(--fanus-primary-50);
          color: var(--fanus-primary);
        }
        .pp-tag--ghost {
          background: var(--fanus-bg) !important;
          color: var(--fanus-ink-3) !important;
        }

        .pp-card__meta {
          list-style: none; padding: 0; margin: 0;
          display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px;
          position: relative; z-index: 1;
        }
        .pp-card__meta li {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; color: var(--fanus-ink-3);
        }
        .pp-card__meta li :first-child { color: var(--fanus-primary); flex-shrink: 0; }

        .pp-card__stats {
          display: flex; flex-wrap: wrap; gap: 6px;
          position: relative; z-index: 1;
        }
        .pp-tag--stats {
          background: var(--fanus-bg);
          color: var(--fanus-ink);
          border: 1px solid var(--fanus-line);
        }

        .pp-card__pricing {
          display: flex; flex-direction: column; gap: 8px;
          position: relative; z-index: 1;
        }
        .pp-card__price {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; color: var(--fanus-ink-3);
        }
        .pp-card__price :first-child { color: var(--fanus-primary); flex-shrink: 0; }
        .pp-card__price-label { color: var(--fanus-ink-3); }
        .pp-card__price-val { color: var(--fanus-ink); font-weight: 700; margin-left: auto; }
        .pp-card__packs {
          display: flex; flex-wrap: wrap; gap: 6px;
        }
        .pp-pack {
          font-size: 11.5px; padding: 4px 10px; border-radius: 999px;
          font-weight: 600; letter-spacing: .01em;
          background: var(--fanus-bg);
          color: var(--fanus-ink);
          border: 1px solid var(--fanus-line);
        }

        .pp-card__foot {
          margin-top: auto; display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px; padding-top: 14px;
          border-top: 1px dashed var(--fanus-line);
          position: relative; z-index: 1;
        }
        .pp-btn {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 6px;
          height: 40px; padding: 0 16px; border-radius: 12px;
          font-size: 13px; font-weight: 600;
          font-family: inherit; cursor: pointer;
          text-decoration: none;
          border: 1px solid transparent;
          transition: transform .2s ease, box-shadow .2s ease, background .2s ease, color .2s ease;
          white-space: nowrap;
        }
        .pp-btn--ghost {
          background: var(--fanus-bg);
          color: var(--fanus-ink);
          border-color: var(--fanus-line);
        }
        .pp-btn--ghost:hover {
          background: white;
          border-color: var(--fanus-primary-300);
          color: var(--fanus-primary);
        }
        .pp-btn--primary {
          background: var(--fanus-primary);
          color: white;
        }
        .pp-btn--primary:hover {
          background: var(--fanus-primary-600, #0B3F90);
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(16,81,183,.22);
        }

        @media (max-width: 420px) {
          .pp-card__foot { grid-template-columns: 1fr; }
        }
      `}</style>
    </article>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }} aria-label={`${value} ulduz`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width="12" height="12" viewBox="0 0 24 24" fill={n <= value ? "#C97D2E" : "#E4ECFA"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function Arrow() { return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>; }
function GlobeIcon() { return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>; }
function ClockIcon() { return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>; }
function HourIcon() { return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.18a2 2 0 00-.59-1.41L13 13l3.41-3.41A2 2 0 0017 8.18V4M7 22v-4.18a2 2 0 01.59-1.41L11 13 7.59 9.59A2 2 0 017 8.18V4" /></svg>; }
function ShieldIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>; }
function CalIcon() { return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>; }
function TagIcon() { return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>; }
