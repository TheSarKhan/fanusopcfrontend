"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Deco from "@/components/Deco";
import type { Psychologist } from "@/lib/api";

type Cat = "all" | "anxiety" | "trauma" | "family" | "depression" | "youth" | "addiction";

const FILTERS: { id: Cat; label: string }[] = [
  { id: "all",        label: "Hamısı" },
  { id: "anxiety",    label: "Narahatlıq" },
  { id: "trauma",     label: "Travma" },
  { id: "family",     label: "Münasibət · Ailə" },
  { id: "depression", label: "Depressiya" },
  { id: "youth",      label: "Yeniyetmə" },
  { id: "addiction",  label: "Asılılıq" },
];

interface Item {
  id: number;
  name: string;
  title: string;
  specs: string[];
  exp: number;
  rating: string;
  sessions: string;
  lang: string;
  format: "ONLINE" | "IN_PERSON" | "BOTH" | null;
  sessionMinutes: number;
  cat: Cat;
  photoUrl?: string;
  accentColor: string;
  bgColor: string;
}

const FALLBACK: Item[] = [
  { id: 1, name: "Aysel Məmmədova", title: "Klinik psixoloq", specs: ["Narahatlıq", "OKD", "Panik"],     exp: 8,  rating: "4.9", sessions: "210", lang: "AZ · RU",      format: "ONLINE",    sessionMinutes: 50, cat: "anxiety",    accentColor: "#3B6FA5", bgColor: "#EEF4FB" },
  { id: 2, name: "Rəşad Quliyev",   title: "Travma terapevti",  specs: ["Travma", "TSSP"],                exp: 11, rating: "4.8", sessions: "315", lang: "AZ · EN",      format: "BOTH",      sessionMinutes: 50, cat: "trauma",     accentColor: "#5A4FC8", bgColor: "#EFEDFB" },
  { id: 3, name: "Lalə Hüseynova",  title: "Ailə terapevti",    specs: ["Münasibətlər", "Ailə"],          exp: 6,  rating: "4.7", sessions: "140", lang: "AZ",           format: "ONLINE",    sessionMinutes: 60, cat: "family",     accentColor: "#C97D2E", bgColor: "#FBF1E5" },
  { id: 4, name: "Elnur Səfərov",   title: "Klinik psixoloq",   specs: ["Depressiya", "Burnout"],         exp: 9,  rating: "4.9", sessions: "260", lang: "AZ · RU",      format: "ONLINE",    sessionMinutes: 50, cat: "depression", accentColor: "#2F7A5C", bgColor: "#E9F5EF" },
  { id: 5, name: "Nigar Kazımova",  title: "Uşaq psixoloqu",    specs: ["Yeniyetmə", "Valideyn"],         exp: 7,  rating: "4.8", sessions: "180", lang: "AZ",           format: "ONLINE",    sessionMinutes: 50, cat: "youth",      accentColor: "#3B6FA5", bgColor: "#EEF4FB" },
  { id: 6, name: "Tural Babayev",   title: "Asılılıq mütəxəssisi", specs: ["Asılılıq", "İmpuls"],         exp: 10, rating: "4.7", sessions: "240", lang: "AZ · RU",      format: "BOTH",      sessionMinutes: 60, cat: "addiction",  accentColor: "#5A4FC8", bgColor: "#EFEDFB" },
  { id: 7, name: "Səbinə Əliyeva",  title: "Klinik psixoloq",   specs: ["Narahatlıq", "Stress"],          exp: 5,  rating: "4.8", sessions: "120", lang: "AZ · EN",      format: "ONLINE",    sessionMinutes: 50, cat: "anxiety",    accentColor: "#3B6FA5", bgColor: "#EEF4FB" },
  { id: 8, name: "Cavid Rəhimli",   title: "Travma terapevti",  specs: ["Travma", "Yas", "EMDR"],         exp: 12, rating: "5.0", sessions: "390", lang: "AZ · RU · EN", format: "BOTH",      sessionMinutes: 60, cat: "trauma",     accentColor: "#5A4FC8", bgColor: "#EFEDFB" },
  { id: 9, name: "Günel Həsənli",   title: "Cütlük terapevti",  specs: ["Cütlük", "Boşanma"],             exp: 8,  rating: "4.9", sessions: "200", lang: "AZ",           format: "ONLINE",    sessionMinutes: 60, cat: "family",     accentColor: "#C97D2E", bgColor: "#FBF1E5" },
];

function deriveCategory(specs: string[]): Cat {
  const s = specs.join(" ").toLowerCase();
  if (s.match(/narahat|panik|okd|stress|anksi/)) return "anxiety";
  if (s.match(/travm|tssp|yas|emdr/))            return "trauma";
  if (s.match(/münasib|ailə|cütlük|boşanma/))    return "family";
  if (s.match(/depres|burnout/))                 return "depression";
  if (s.match(/yeniyetm|valideyn|uşaq/))         return "youth";
  if (s.match(/asılıl|impuls/))                  return "addiction";
  return "all";
}

function getInitials(name: string) {
  return name.split(" ").filter(w => w.length > 1).map(w => w[0]).slice(0, 2).join("");
}

function formatLabel(f: Item["format"]) {
  if (f === "ONLINE")    return "Onlayn";
  if (f === "IN_PERSON") return "Əyani";
  if (f === "BOTH")      return "Onlayn & Əyani";
  return null;
}

export default function PsychologistsPage({ psychologists }: { psychologists?: Psychologist[] }) {
  const [filter, setFilter] = useState<Cat>("all");

  const items: Item[] = useMemo(() => {
    if (!psychologists || psychologists.length === 0) return FALLBACK;
    return psychologists.map((p) => {
      const specs = (p.specializations || []).slice(0, 4);
      return {
        id: p.id,
        name: p.name,
        title: p.title,
        specs,
        exp: parseInt(p.experience ?? "5", 10) || 5,
        rating: p.rating ?? "—",
        sessions: p.sessionsCount ?? "0",
        lang: (p.languages || "AZ").split(",").map((l) => l.trim()).filter(Boolean).join(" · ") || "AZ",
        format: (p.activityFormat as Item["format"]) || null,
        sessionMinutes: p.defaultSessionMinutes ?? 50,
        cat: deriveCategory(specs),
        photoUrl: p.photoUrl?.trim() || undefined,
        accentColor: p.accentColor || "#1051B7",
        bgColor: p.bgColor || "#F2F6FD",
      };
    });
  }, [psychologists]);

  const visible = filter === "all" ? items : items.filter((p) => p.cat === filter);

  return (
    <div className="fanus-root">
      <PsycHero count={items.length} />
      <PsycFilters active={filter} onChange={setFilter} />
      <PsycList items={visible} />
      <PsycCTA />
    </div>
  );
}

function PsycHero({ count }: { count: number }) {
  return (
    <section className="pp-hero">
      <Deco type="wave-top" style={{ top: -20, left: "-4%", width: 520, opacity: .55 }} anim="drift" />
      <Deco type="blob-cloud" style={{ top: 40, right: "-6%", width: 360, opacity: .55 }} anim="drift" />
      <Deco type="sphere-blue" style={{ top: "60%", left: "10%", width: 50, opacity: .8 }} anim="floatY" />

      <div className="pp-hero__bg" aria-hidden>
        <svg viewBox="0 0 1440 600" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id="ppHeroBg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#F2F6FD" />
              <stop offset="100%" stopColor="#E4ECFA" />
            </linearGradient>
          </defs>
          <rect width="1440" height="600" fill="url(#ppHeroBg)" />
        </svg>
      </div>

      <div className="fanus-container pp-hero__inner">
        <div className="fanus-eyebrow"><span className="dash" /> Komandamız</div>
        <h1>
          Sizin yolunuzda<br />
          <span className="fanus-serif-accent">birlikdə</span> olacaq mütəxəssislər
        </h1>
        <p className="pp-hero__lead">
          Hər biri sertifikatlı, lisenziyalı və Fanus etika kodeksinə bağlıdır.
          Sahə, yanaşma və dilə görə filtrləyin — sizə uyğun olanı tapın.
        </p>

        <div className="pp-hero__stats">
          <Stat n={`${count}+`} t="Sertifikatlı psixoloq" />
          <Stat n="8 il"  t="Orta təcrübə" />
          <Stat n="12"    t="İxtisas sahəsi" />
          <Stat n="3 dil" t="AZ · RU · EN" />
        </div>
      </div>

      <style>{`
        .pp-hero { position: relative; padding: 56px 0 90px; overflow: hidden; }
        .pp-hero__bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
        .pp-hero__inner { position: relative; z-index: 1; max-width: 760px; }
        .pp-hero h1 {
          margin: 18px 0 18px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(38px, 5.4vw, 68px); font-weight: 800;
          letter-spacing: -0.035em; line-height: 1.1; color: var(--fanus-ink);
        }
        .pp-hero__lead { font-size: 18px; color: var(--fanus-ink-3); line-height: 1.6; max-width: 580px; margin: 0; }
        .pp-hero__stats {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
          margin-top: 40px; max-width: 720px;
        }
        @media (max-width: 720px) { .pp-hero__stats { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </section>
  );
}

function Stat({ n, t }: { n: string; t: string }) {
  return (
    <div className="pp-stat">
      <strong>{n}</strong>
      <span>{t}</span>
      <style>{`
        .pp-stat { background: white; border: 1px solid var(--fanus-line); border-radius: 16px; padding: 18px 20px; }
        .pp-stat strong { display: block; font-size: 26px; font-weight: 800; color: var(--fanus-primary); letter-spacing: -.02em; }
        .pp-stat span { font-size: 12.5px; color: var(--fanus-ink-3); margin-top: 4px; display: block; }
      `}</style>
    </div>
  );
}

function PsycFilters({ active, onChange }: { active: Cat; onChange: (c: Cat) => void }) {
  return (
    <div className="pp-filters">
      <div className="fanus-container pp-filters__inner">
        <div className="pp-filters__chips">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`pp-chip ${active === f.id ? "is-active" : ""}`}
              onClick={() => onChange(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="pp-filters__tools">
          <select className="pp-select" defaultValue="online">
            <option value="online">Onlayn / şəxsən</option>
            <option value="onlineonly">Yalnız onlayn</option>
          </select>
          <select className="pp-select" defaultValue="any">
            <option value="any">İstənilən dil</option>
            <option value="az">Azərbaycanca</option>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <style>{`
        .pp-filters {
          padding: 16px 0; border-bottom: 1px solid var(--fanus-line);
          background: white; position: sticky; top: 70px; z-index: 10;
        }
        .pp-filters__inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .pp-filters__chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .pp-chip {
          padding: 8px 16px; border-radius: 999px;
          font-size: 13.5px; font-weight: 500; color: var(--fanus-ink-2);
          background: var(--fanus-bg); border: 1px solid var(--fanus-line);
          cursor: pointer; transition: all .2s; font-family: inherit;
        }
        .pp-chip:hover { border-color: var(--fanus-primary-300); color: var(--fanus-primary); }
        .pp-chip.is-active { background: var(--fanus-primary); color: white; border-color: var(--fanus-primary); }
        .pp-filters__tools { display: flex; gap: 8px; }
        .pp-select {
          font-family: inherit; font-size: 13.5px;
          padding: 8px 14px; border-radius: 999px;
          border: 1px solid var(--fanus-line); background: var(--fanus-bg);
          color: var(--fanus-ink-2); cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function PsycList({ items }: { items: Item[] }) {
  return (
    <section className="pp-list" id="list">
      <Deco type="mesh-blob" style={{ top: 60, right: "-5%", width: 400, opacity: .35 }} anim="drift" />
      <Deco type="blob-1" style={{ bottom: 80, left: "-4%", width: 280, opacity: .4 }} anim="drift" />

      <div className="fanus-container">
        <div className="pp-list__head">
          <span className="pp-list__count"><strong>{items.length}</strong> mütəxəssis</span>
          <div className="pp-list__sort">
            <span>Sırala:</span>
            <select className="pp-select" defaultValue="rec">
              <option value="rec">Tövsiyə olunan</option>
              <option value="exp">Təcrübəyə görə</option>
              <option value="rating">Reytinqə görə</option>
            </select>
          </div>
        </div>

        <div className="pp-grid">
          {items.map((p) => <PsyCard key={p.id} p={p} />)}
        </div>

        {items.length === 0 && (
          <div className="pp-empty">
            <p>Bu filtrə uyğun nəticə tapılmadı.</p>
          </div>
        )}
      </div>

      <style>{`
        .pp-list { padding: 56px 0 110px; position: relative; overflow: hidden; }
        .pp-list > .fanus-container { position: relative; z-index: 1; }
        .pp-list__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; gap: 16px; flex-wrap: wrap; }
        .pp-list__count { font-size: 14px; color: var(--fanus-ink-3); }
        .pp-list__count strong { color: var(--fanus-ink); font-weight: 700; }
        .pp-list__sort { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--fanus-ink-3); }

        .pp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }

        .pp-empty { text-align: center; padding: 60px 0; color: var(--fanus-ink-3); }

        @media (max-width: 980px) { .pp-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .pp-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function PsyCard({ p }: { p: Item }) {
  const initials = getInitials(p.name);
  const ratingNum = parseFloat(p.rating);
  const filledStars = isFinite(ratingNum) ? Math.round(ratingNum) : 0;
  const hasSessions = p.sessions && p.sessions !== "0" && p.sessions !== "—";
  const fmt = formatLabel(p.format);

  return (
    <article className="pp-card">
      <div
        className="pp-card__accent"
        style={{ background: `linear-gradient(135deg, ${p.bgColor}, ${p.accentColor}1A)` }}
      />

      <Link href={`/psychologists/${p.id}`} className="pp-card__head" aria-label={`${p.name} profili`}>
        <div
          className="pp-card__photo"
          style={{ background: p.bgColor }}
        >
          {p.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photoUrl} alt={p.name} />
          ) : (
            <span className="pp-card__initials" style={{ color: p.accentColor }}>{initials}</span>
          )}
        </div>

        <div className="pp-card__head-body">
          <div className="pp-card__name-row">
            <h3 className="pp-card__name">{p.name}</h3>
            <span
              className="pp-card__verified"
              style={{ color: p.accentColor }}
              title="Doğrulanmış psixoloq"
              aria-label="Doğrulanmış psixoloq"
            >
              <ShieldIcon />
            </span>
          </div>
          <p className="pp-card__title">{p.title}</p>
          {filledStars > 0 && (
            <div className="pp-card__rating">
              <Stars value={filledStars} />
              <strong>{p.rating}</strong>
              {hasSessions && <span className="pp-card__rating-sep">·</span>}
              {hasSessions && <span className="pp-card__rating-sub">{p.sessions} seans</span>}
            </div>
          )}
        </div>
      </Link>

      {p.specs.length > 0 && (
        <div className="pp-card__tags">
          {p.specs.slice(0, 3).map((s, i) => (
            <span
              key={i}
              className="pp-tag"
              style={{ background: `${p.accentColor}14`, color: p.accentColor }}
            >
              {s}
            </span>
          ))}
          {p.specs.length > 3 && (
            <span className="pp-tag pp-tag--ghost">+{p.specs.length - 3}</span>
          )}
        </div>
      )}

      <ul className="pp-card__meta">
        <li><GlobeIcon /> {p.lang}</li>
        {fmt && <li><MonitorIcon /> {fmt}</li>}
        <li><ClockIcon /> {p.exp} il təcrübə</li>
        <li><HourIcon /> {p.sessionMinutes} dəq seans</li>
      </ul>

      <div className="pp-card__foot">
        <Link
          href={`/psychologists/${p.id}`}
          className="pp-btn pp-btn--ghost"
        >
          Profilə bax
          <ArrowRight />
        </Link>
        <Link
          href={`/book/${p.id}`}
          className="pp-btn pp-btn--primary"
          style={{ background: p.accentColor }}
        >
          <CalIcon /> Randevu al
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
          box-shadow: 0 6px 18px rgba(0,33,71,.08);
        }
        .pp-card__photo img {
          width: 100%; height: 100%; object-fit: cover; object-position: top;
          display: block;
        }
        .pp-card__initials {
          font-family: var(--font-playfair), serif;
          font-size: 28px; font-weight: 600; opacity: .8;
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
          color: white;
        }
        .pp-btn--primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(16,81,183,.18);
          filter: brightness(.95);
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
        <svg key={n} width="12" height="12" viewBox="0 0 24 24"
             fill={n <= value ? "#C97D2E" : "#E4ECFA"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function PsycCTA() {
  return (
    <section className="pp-cta">
      <Deco type="circles-mix" style={{ top: 30, right: "6%", width: 220, opacity: .55 }} />
      <Deco type="target" style={{ bottom: 30, left: "8%", width: 130, opacity: .55 }} anim="drift" />
      <div className="fanus-container">
        <div className="pp-cta__head">
          <div className="fanus-eyebrow"><span className="dash" /> Əmin deyilsiniz? <span className="dash" /></div>
          <h2>Sizə uyğun mütəxəssisi <span className="fanus-serif-accent">tapaq</span></h2>
          <p>Bir neçə qısa sual cavablandırın — sizə ən uyğun 3 psixoloqu təklif edək. İlk tanışlıq görüşü ödənişsizdir.</p>
          <div className="pp-cta__btns">
            <Link href="/register" className="fanus-btn fanus-btn-primary">
              Uyğunluq testini başlat <ArrowRight />
            </Link>
            <Link href="/xidmetler" className="fanus-btn fanus-btn-ghost">Xidmətlərə bax</Link>
          </div>
        </div>
      </div>
      <style>{`
        .pp-cta {
          padding: 90px 0;
          background: linear-gradient(180deg, var(--fanus-bg) 0%, var(--fanus-primary-50) 100%);
          position: relative; overflow: hidden;
        }
        .pp-cta > .fanus-container { position: relative; z-index: 1; }
        .pp-cta__head { text-align: center; max-width: 760px; margin: 0 auto; }
        .pp-cta__head .fanus-eyebrow { justify-content: center; }
        .pp-cta__head h2 {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.1; color: var(--fanus-ink);
          margin: 16px 0 14px;
        }
        .pp-cta__head p { font-size: 17px; color: var(--fanus-ink-3); margin: 0; }
        .pp-cta__btns {
          display: flex; justify-content: center; gap: 12px;
          margin-top: 28px; flex-wrap: wrap;
        }
      `}</style>
    </section>
  );
}

function ArrowRight() { return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>; }
function GlobeIcon() { return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>; }
function MonitorIcon() { return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>; }
function ClockIcon() { return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>; }
function HourIcon() { return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.18a2 2 0 00-.59-1.41L13 13l3.41-3.41A2 2 0 0017 8.18V4M7 22v-4.18a2 2 0 01.59-1.41L11 13 7.59 9.59A2 2 0 017 8.18V4" /></svg>; }
function ShieldIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>; }
function CalIcon() { return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>; }
