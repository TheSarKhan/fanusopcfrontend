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

const FALLBACK = [
  { id: 1, name: "Aysel Məmmədova", spec: "Narahatlıq · OKD · Panik", exp: 8,  tags: ["KDT", "Sxem"],         lang: "AZ · RU",      online: true,  cat: "anxiety" as Cat,    price: 60 },
  { id: 2, name: "Rəşad Quliyev",   spec: "Travma · TSSP",            exp: 11, tags: ["EMDR", "KDT"],         lang: "AZ · EN",      online: true,  cat: "trauma" as Cat,     price: 75 },
  { id: 3, name: "Lalə Hüseynova",  spec: "Münasibətlər · Ailə",      exp: 6,  tags: ["Sistemli"],            lang: "AZ",           online: false, cat: "family" as Cat,     price: 55 },
  { id: 4, name: "Elnur Səfərov",   spec: "Depressiya · Burnout",     exp: 9,  tags: ["KDT", "ACT"],          lang: "AZ · RU",      online: true,  cat: "depression" as Cat, price: 65 },
  { id: 5, name: "Nigar Kazımova",  spec: "Yeniyetmə · Valideyn",     exp: 7,  tags: ["Oyun terapiyası"],     lang: "AZ",           online: true,  cat: "youth" as Cat,      price: 60 },
  { id: 6, name: "Tural Babayev",   spec: "Asılılıq · İmpuls",        exp: 10, tags: ["Motivasiya"],          lang: "AZ · RU",      online: false, cat: "addiction" as Cat,  price: 70 },
  { id: 7, name: "Səbinə Əliyeva",  spec: "Narahatlıq · Stress",      exp: 5,  tags: ["KDT", "Mindfulness"],  lang: "AZ · EN",      online: true,  cat: "anxiety" as Cat,    price: 50 },
  { id: 8, name: "Cavid Rəhimli",   spec: "Travma · Yas",             exp: 12, tags: ["EMDR", "Sxem"],        lang: "AZ · RU · EN", online: true,  cat: "trauma" as Cat,     price: 80 },
  { id: 9, name: "Günel Həsənli",   spec: "Cütlük · Boşanma",         exp: 8,  tags: ["Gottman"],             lang: "AZ",           online: true,  cat: "family" as Cat,     price: 70 },
];

type Item = typeof FALLBACK[number];

function deriveCategory(spec: string): Cat {
  const s = spec.toLowerCase();
  if (s.match(/narahat|panik|okd|stress|anksi/)) return "anxiety";
  if (s.match(/travm|tssp|yas|emdr/))            return "trauma";
  if (s.match(/münasib|ailə|cütlük|boşanma/))    return "family";
  if (s.match(/depres|burnout/))                 return "depression";
  if (s.match(/yeniyetm|valideyn|uşaq/))         return "youth";
  if (s.match(/asılıl|impuls/))                  return "addiction";
  return "all";
}

export default function PsychologistsPage({ psychologists }: { psychologists?: Psychologist[] }) {
  const [filter, setFilter] = useState<Cat>("all");

  const items: Item[] = useMemo(() => {
    if (!psychologists || psychologists.length === 0) return FALLBACK;
    return psychologists.map((p, i) => {
      const spec = (p.specializations || []).slice(0, 3).join(" · ") || (p.title ?? "");
      return {
        id: p.id,
        name: p.name,
        spec,
        exp: parseInt(p.experience ?? "5", 10) || 5,
        tags: (p.specializations || []).slice(0, 2),
        lang: (p.languages || "AZ").split(",").map((l: string) => l.trim()).join(" · ") || "AZ",
        online: !!p.active,
        cat: deriveCategory(spec),
        price: 60 + (i % 4) * 10,
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
              <option value="price">Qiymətə görə</option>
            </select>
          </div>
        </div>

        <div className="pp-grid">
          {items.map((p) => (
            <article key={p.id} className="pp-card">
              <div className="pp-card__top">
                <div className="pp-card__avatar">
                  {p.name.split(" ").map((n) => n[0]).join("")}
                  <span className={`pp-card__status ${p.online ? "on" : "off"}`} />
                </div>
                <div className="pp-card__exp">
                  <strong>{p.exp}</strong>
                  <span>il təcrübə</span>
                </div>
              </div>

              <h3 className="pp-card__name">{p.name}</h3>
              <p className="pp-card__spec">{p.spec}</p>

              <div className="pp-card__meta">
                <span className="pp-card__metaitem"><GlobeIcon /> {p.lang}</span>
                <span className="pp-card__metaitem"><BadgeIcon /> Sertifikatlı</span>
              </div>

              <div className="pp-card__tags">
                {p.tags.map((t, j) => <span key={j} className="pp-tag">{t}</span>)}
              </div>

              <div className="pp-card__foot">
                <div className="pp-card__price">
                  <span>50 dəq seans</span>
                  <strong>{p.price} ₼</strong>
                </div>
                <Link href={`/book/${p.id}`} className="fanus-btn fanus-btn-primary fanus-btn-sm">
                  <CalIcon /> Randevu
                </Link>
              </div>
            </article>
          ))}
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

        .pp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }

        .pp-card {
          background: white; border: 1px solid var(--fanus-line);
          border-radius: 22px; padding: 24px;
          display: flex; flex-direction: column; gap: 12px;
          transition: transform .25s, border-color .25s, box-shadow .25s;
        }
        .pp-card:hover { transform: translateY(-3px); border-color: var(--fanus-primary-200); box-shadow: 0 18px 40px rgba(16,81,183,.08); }

        .pp-card__top { display: flex; align-items: center; justify-content: space-between; }
        .pp-card__avatar {
          position: relative;
          width: 60px; height: 60px; border-radius: 50%;
          background: var(--fanus-primary);
          color: white; font-weight: 700; font-size: 18px;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .pp-card__status {
          position: absolute; right: 0; bottom: 2px;
          width: 14px; height: 14px; border-radius: 50%;
          border: 2.5px solid white;
        }
        .pp-card__status.on { background: #16a34a; }
        .pp-card__status.off { background: #c5cad4; }
        .pp-card__exp { text-align: right; }
        .pp-card__exp strong { display: block; font-size: 22px; color: var(--fanus-primary); font-weight: 800; }
        .pp-card__exp span { font-size: 11px; color: var(--fanus-ink-3); text-transform: uppercase; letter-spacing: .04em; }

        .pp-card__name { font-size: 18px; margin: 0; font-weight: 700; color: var(--fanus-ink); }
        .pp-card__spec { font-size: 14px; color: var(--fanus-ink-3); margin: 0; }

        .pp-card__meta { display: flex; flex-wrap: wrap; gap: 12px; padding: 6px 0; }
        .pp-card__metaitem { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fanus-ink-3); }
        .pp-card__metaitem :first-child { color: var(--fanus-primary); }

        .pp-card__tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .pp-tag { font-size: 11px; padding: 4px 10px; border-radius: 999px; background: var(--fanus-primary-50); color: var(--fanus-primary); font-weight: 600; }

        .pp-card__foot {
          margin-top: auto;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding-top: 16px; border-top: 1px dashed var(--fanus-line);
        }
        .pp-card__price span { display: block; font-size: 11px; color: var(--fanus-ink-3); text-transform: uppercase; letter-spacing: .04em; }
        .pp-card__price strong { font-size: 18px; font-weight: 800; color: var(--fanus-ink); }

        .pp-empty { text-align: center; padding: 60px 0; color: var(--fanus-ink-3); }

        @media (max-width: 980px) { .pp-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .pp-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
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
              Uyğunluq testini başlat <Arrow />
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

function Arrow() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>; }
function GlobeIcon() { return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>; }
function BadgeIcon() { return <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.5 2.2 3.3-.4.9 3.2 2.8 1.7-1.4 3 1.4 3-2.8 1.7-.9 3.2-3.3-.4L12 21l-2.5-2.2-3.3.4-.9-3.2L2.5 14l1.4-3-1.4-3 2.8-1.7.9-3.2 3.3.4L12 3z" /><path d="M9 12l2 2 4-4" /></svg>; }
function CalIcon() { return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>; }
