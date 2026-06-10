"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Deco from "@/components/Deco";
import type { BlogPost } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

type Cat = "all" | "anxiety" | "relations" | "selfcare" | "sleep" | "youth" | "mindful";
type Illu = "sun" | "people" | "flame" | "moon" | "waves" | "compass";

const FILTERS: { id: Cat; label: string }[] = [
  { id: "all",       label: "Hamısı" },
  { id: "anxiety",   label: "Narahatlıq" },
  { id: "relations", label: "Münasibətlər" },
  { id: "selfcare",  label: "Özünəqayğı" },
  { id: "sleep",     label: "Yuxu" },
  { id: "youth",     label: "Yeniyetmə" },
  { id: "mindful",   label: "Mindfulness" },
];

const ILLU_BY_CAT: Record<Cat, Illu> = {
  all: "sun", anxiety: "sun", relations: "people", selfcare: "flame",
  sleep: "moon", youth: "compass", mindful: "waves",
};

function deriveCat(category: string, title: string): Cat {
  const s = (category + " " + title).toLowerCase();
  if (s.match(/narahat|panik|stress|anksi/))    return "anxiety";
  if (s.match(/münasib|sərhəd|ailə|cüt/))       return "relations";
  if (s.match(/özünə|burnout|tükən|dincə/))     return "selfcare";
  if (s.match(/yuxu|insomni/))                   return "sleep";
  if (s.match(/yeniyet|valideyn|uşaq/))          return "youth";
  if (s.match(/mindful|nəfəs|meditasiya/))       return "mindful";
  return "all";
}

interface Item {
  slug: string;
  tag: string;
  cat: Cat;
  title: string;
  excerpt: string;
  date: string;
  read: string;
  readMinutes: number;
  publishedAt: number;
  author: string;
  illu: Illu;
}

const FALLBACK: Item[] = [
  { slug: "narahat-oyananda",  tag: "Narahatlıq",   cat: "anxiety",    title: "Səhər yuxudan narahat oyananda nə etməli", excerpt: "Bədəniniz hələ yatağa qalxmadan beyniniz qorxular siyahısı tutursa — bu məqalə sizin üçündür.", date: "12 May 2026", read: "6 dəq", readMinutes: 6, publishedAt: Date.parse("2026-05-12"), author: "Aysel Məmmədova", illu: "sun" },
  { slug: "serhed-qoymaq",     tag: "Münasibətlər", cat: "relations",  title: "Sərhəd qoymaq eqoist olmaq deyil",         excerpt: "Sağlam sərhədlər münasibətləri zəiflətmir — onları daha güclü və davamlı edir.",                          date: "8 May 2026",  read: "8 dəq", readMinutes: 8, publishedAt: Date.parse("2026-05-08"), author: "Lalə Hüseynova",   illu: "people" },
  { slug: "tukenmislik",       tag: "Özünəqayğı",   cat: "selfcare",   title: "Tükənmişlik — gizli əlamətlər",            excerpt: "Bezginlik və burnout fərqlidir. Ondan əvvəl bədənin verdiyi siqnalları öyrənmək.",                          date: "3 May 2026",  read: "7 dəq", readMinutes: 7, publishedAt: Date.parse("2026-05-03"), author: "Elnur Səfərov",    illu: "flame" },
  { slug: "yuxusuzluq",        tag: "Yuxu",         cat: "sleep",      title: "Yuxusuzluğun düşüncə tələsi və çıxış yolu", excerpt: "“Yatmalıyam” fikri özü yuxusuzluğun yanacağına çevrilir. Bu dövrəni necə qırmaq olar.",                       date: "28 Apr 2026", read: "5 dəq", readMinutes: 5, publishedAt: Date.parse("2026-04-28"), author: "Rəşad Quliyev",    illu: "moon" },
  { slug: "5deq-nefes",        tag: "Mindfulness",  cat: "mindful",    title: "5 dəqiqəlik nəfəs — günü yenidən başlat",  excerpt: "Stresli anlarda sinir sistemini sakitləşdirmək üçün sadə, sübuta əsaslanan texnika.",                        date: "22 Apr 2026", read: "4 dəq", readMinutes: 4, publishedAt: Date.parse("2026-04-22"), author: "Səbinə Əliyeva",   illu: "waves" },
  { slug: "yeniyetme-qabiq",   tag: "Yeniyetmə",    cat: "youth",      title: "Yeniyetmə öz qabığına çəkiləndə",          excerpt: "Susqunluq həmişə problem deyil. Lakin nə vaxt diqqət etmək lazımdır?",                                       date: "18 Apr 2026", read: "6 dəq", readMinutes: 6, publishedAt: Date.parse("2026-04-18"), author: "Nigar Kazımova",   illu: "compass" },
  { slug: "panik-atak",        tag: "Narahatlıq",   cat: "anxiety",    title: "Panik atak: bədənin yalan həyəcanı",       excerpt: "Panik atak təhlükəli deyil — amma bunu beyninə inandırmaq başqa məsələdir.",                                  date: "14 Apr 2026", read: "6 dəq", readMinutes: 6, publishedAt: Date.parse("2026-04-14"), author: "Aysel Məmmədova", illu: "waves" },
  { slug: "esitmek",           tag: "Münasibətlər", cat: "relations",  title: "Münaqişədə eşitmək — danışmaqdan əvvəl",   excerpt: "Aktiv dinləmə bir bacarıqdır. Sevdiklərinizlə sınamaq üçün 4 sadə addım.",                                    date: "9 Apr 2026",  read: "7 dəq", readMinutes: 7, publishedAt: Date.parse("2026-04-09"), author: "Lalə Hüseynova",   illu: "people" },
  { slug: "dincelmek",         tag: "Özünəqayğı",   cat: "selfcare",   title: "Niyə dincəlmək də öyrənilməlidir",         excerpt: "Hər kəs istirahətin necə görünməsini bilmir. İnsan üçün dincəlmənin 7 növü.",                                  date: "5 Apr 2026",  read: "5 dəq", readMinutes: 5, publishedAt: Date.parse("2026-04-05"), author: "Elnur Səfərov",    illu: "compass" },
];

type SortBy = "new" | "quick";

export default function BlogPage({ posts }: { posts?: BlogPost[] }) {
  const items: Item[] = useMemo(() => {
    if (!posts || posts.length === 0) return FALLBACK;
    return posts.map((p) => {
      const cat = deriveCat(p.category, p.title);
      return {
        slug: p.slug,
        tag: p.category,
        cat,
        title: p.title,
        excerpt: p.excerpt,
        date: new Date(p.publishedDate).toLocaleDateString("az-AZ", { day: "numeric", month: "short", year: "numeric" }),
        read: `${p.readTimeMinutes} dəq`,
        readMinutes: p.readTimeMinutes,
        publishedAt: new Date(p.publishedDate).getTime(),
        author: p.authorName ?? "Fanus redaksiya",
        illu: ILLU_BY_CAT[cat],
      };
    });
  }, [posts]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Cat>("all");
  const [sortBy, setSortBy] = useState<SortBy>("new");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = items.filter((a) => {
      const matchCat = filter === "all" || a.cat === filter;
      const matchSearch = !q || (a.title + " " + a.excerpt + " " + a.tag).toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
    if (sortBy === "quick") {
      return [...result].sort((a, b) => a.readMinutes - b.readMinutes);
    }
    return [...result].sort((a, b) => b.publishedAt - a.publishedAt);
  }, [items, filter, search, sortBy]);

  const activeFilterLabel =
    filter === "all" ? null : FILTERS.find((f) => f.id === filter)?.label ?? null;
  const hasActiveQuery = filter !== "all" || search.trim().length > 0;
  const resetFilters = () => { setFilter("all"); setSearch(""); };

  return (
    <div className="fanus-root">
      <ArtHero search={search} setSearch={setSearch} />
      <ArtFilters active={filter} onChange={setFilter} />
      <ArtList
        items={filtered}
        sortBy={sortBy}
        setSortBy={setSortBy}
        activeFilterLabel={activeFilterLabel}
        searchTerm={search.trim()}
        hasActiveQuery={hasActiveQuery}
        onReset={resetFilters}
      />
      <ArtNewsletter />
    </div>
  );
}

function ArtHero({ search, setSearch }: { search: string; setSearch: (v: string) => void }) {
  const { t } = useT();
  return (
    <section className="ap-hero">
      <Deco type="wave-top" style={{ top: -20, left: "-4%", width: 520, opacity: .55 }} anim="drift" />
      <Deco type="sphere-blue" style={{ top: "65%", left: "8%", width: 44, opacity: .8 }} anim="floatY" />

      <div className="ap-hero__bg" aria-hidden>
        <svg viewBox="0 0 1440 600" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id="apHeroBg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#F2F6FD" />
              <stop offset="100%" stopColor="#E4ECFA" />
            </linearGradient>
          </defs>
          <rect width="1440" height="600" fill="url(#apHeroBg)" />
        </svg>
      </div>

      <div className="fanus-container ap-hero__inner">
        <div className="ap-hero__copy">
          <div className="fanus-eyebrow"><span className="dash" /> {t("articles.eyebrow")}</div>
          <h1>{t("articles.title")}</h1>
          <p className="ap-hero__lead">{t("articles.lead")}</p>

          <div className="ap-search">
            <SparkleIcon />
            <input
              type="text"
              placeholder={t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="ap-search__clear" onClick={() => setSearch("")} aria-label={t("common.close")}>
                <CloseIcon />
              </button>
            )}
          </div>
        </div>

        <div className="ap-hero__visual" aria-hidden>
          <div className="ap-hero__glow ap-hero__glow--1" />
          <div className="ap-hero__glow ap-hero__glow--2" />
          { }
          <img
            src="/images/hero-meqaleler.png"
            alt="Fanus məqalələri"
            className="ap-hero__img"
            draggable={false}
          />
        </div>
      </div>

      <style>{`
        .ap-hero { position: relative; padding: 56px 0 80px; overflow: hidden; }
        .ap-hero__bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
        .ap-hero__inner {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 1.05fr 1fr;
          gap: 48px; align-items: center;
          min-height: 460px;
        }
        .ap-hero__copy { min-width: 0; }
        .ap-hero h1 {
          margin: 18px 0 18px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(34px, 4.8vw, 60px); font-weight: 800;
          letter-spacing: -0.035em; line-height: 1.1; color: var(--fanus-ink);
        }
        .ap-hero__lead { font-size: 17px; color: var(--fanus-ink-3); line-height: 1.6; max-width: 540px; margin: 0; }
        .ap-search {
          margin-top: 32px; max-width: 520px;
          display: flex; align-items: center; gap: 12px;
          background: white; border: 1px solid var(--fanus-line);
          border-radius: 999px; padding: 14px 22px;
          box-shadow: 0 10px 28px rgba(16,81,183,.08);
        }
        .ap-search input {
          flex: 1; border: none; outline: none; background: transparent;
          font-family: inherit; font-size: 15px; color: var(--fanus-ink);
        }
        .ap-search input::placeholder { color: var(--fanus-ink-3); }
        .ap-search__clear {
          width: 26px; height: 26px; border-radius: 50%;
          background: var(--fanus-primary-50); color: var(--fanus-primary);
          display: inline-flex; align-items: center; justify-content: center;
          border: none; cursor: pointer;
        }

        .ap-hero__visual {
          position: relative;
          width: 100%; aspect-ratio: 16/12; min-height: 380px;
        }
        .ap-hero__img {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: contain;
          z-index: 2;
          animation: apHeroFloat 6s ease-in-out infinite;
          user-select: none;
        }
        @keyframes apHeroFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        .ap-hero__glow { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(40px); z-index: 1; }
        .ap-hero__glow--1 {
          top: -6%; right: 6%; width: 240px; height: 240px;
          background: radial-gradient(circle, rgba(245,185,70,.28), transparent 65%);
          animation: apHeroFlicker 3.5s ease-in-out infinite;
        }
        .ap-hero__glow--2 {
          bottom: -8%; left: 4%; width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(16,81,183,.22), transparent 65%);
          animation: apHeroFlicker 4.5s ease-in-out infinite -2s;
        }
        @keyframes apHeroFlicker {
          0%, 100% { opacity: .9; transform: scale(1); }
          50%      { opacity: .55; transform: scale(1.08); }
        }

        @media (max-width: 980px) {
          .ap-hero__inner { grid-template-columns: 1fr; gap: 32px; min-height: auto; }
          .ap-hero__visual { min-height: 280px; aspect-ratio: 16/9; max-width: 540px; margin: 0 auto; }
        }
      `}</style>
    </section>
  );
}

function ArtFilters({ active, onChange }: { active: Cat; onChange: (c: Cat) => void }) {
  return (
    <div className="ap-filters">
      <div className="fanus-container">
        <div className="ap-filters__chips">
          {FILTERS.map((t) => (
            <button
              key={t.id}
              className={`ap-chip ${active === t.id ? "is-active" : ""}`}
              onClick={() => onChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <style>{`
        .ap-filters {
          padding: 16px 0; border-bottom: 1px solid var(--fanus-line);
          background: white; position: sticky; top: 70px; z-index: 10;
        }
        .ap-filters__chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .ap-chip {
          padding: 8px 16px; border-radius: 999px;
          font-size: 13.5px; font-weight: 500; color: var(--fanus-ink-2);
          background: var(--fanus-bg); border: 1px solid var(--fanus-line);
          cursor: pointer; transition: all .2s; font-family: inherit;
        }
        .ap-chip:hover { border-color: var(--fanus-primary-300); color: var(--fanus-primary); }
        .ap-chip.is-active { background: var(--fanus-primary); color: white; border-color: var(--fanus-primary); }
      `}</style>
    </div>
  );
}

function ArtList({
  items,
  sortBy,
  setSortBy,
  activeFilterLabel,
  searchTerm,
  hasActiveQuery,
  onReset,
}: {
  items: Item[];
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;
  activeFilterLabel: string | null;
  searchTerm: string;
  hasActiveQuery: boolean;
  onReset: () => void;
}) {
  return (
    <section className="ap-list">
      <Deco type="mesh-blob" style={{ top: 60, right: "-5%", width: 400, opacity: .35 }} anim="drift" />
      <Deco type="blob-1" style={{ bottom: 80, left: "-4%", width: 280, opacity: .4 }} anim="drift" />
      <div className="fanus-container">
        <div className="ap-list__head">
          <div className="ap-list__head-left">
            <div className="ap-list__count">
              <strong>{items.length}</strong> məqalə
            </div>
            {(activeFilterLabel || searchTerm) && (
              <div className="ap-list__active">
                {activeFilterLabel && (
                  <span className="ap-list__chip">
                    {activeFilterLabel}
                  </span>
                )}
                {searchTerm && (
                  <span className="ap-list__chip">
                    “{searchTerm}”
                  </span>
                )}
                <button className="ap-list__reset" onClick={onReset}>
                  Filtri sıfırla
                </button>
              </div>
            )}
          </div>
          <select
            className="ap-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="new">Ən yeni</option>
            <option value="quick">Qısa oxunuş</option>
          </select>
        </div>

        {items.length === 0 ? (
          <div className="ap-empty">
            <div className="ap-empty__icon"><SparkleIcon /></div>
            <h3>Heç bir məqalə tapılmadı</h3>
            <p>Bu filtrə uyğun nəticə yoxdur. Başqa kateqoriya seçin və ya axtarışı dəyişin.</p>
            {hasActiveQuery && (
              <button className="fanus-btn fanus-btn-light fanus-btn-sm" onClick={onReset}>
                Hamısını göstər
              </button>
            )}
          </div>
        ) : (
          <div className="ap-grid">
            {items.map((a) => (
              <Link key={a.slug} className="ap-card" href={`/blog/${a.slug}`}>
                <div className="ap-card__cover">
                  <ArtCover type={a.illu} color="#1051B7" />
                  <span className="ap-card__tag">{a.tag}</span>
                </div>
                <div className="ap-card__body">
                  <div className="ap-card__date">
                    <span>{a.date}</span>
                    <span className="ap-card__sep" />
                    <span className="ap-card__read"><ClockIcon /> {a.read}</span>
                  </div>
                  <h3 className="ap-card__title">{a.title}</h3>
                  <p className="ap-card__excerpt">{a.excerpt}</p>
                  <div className="ap-card__author">
                    <span className="ap-card__avatar">{a.author.split(" ").map((n) => n[0]).join("")}</span>
                    <div>
                      <div className="ap-card__author-name">{a.author}</div>
                      <div className="ap-card__author-role">Psixoloq · Fanus</div>
                    </div>
                    <span className="ap-card__cta">Oxu <Arrow /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .ap-list { padding: 48px 0 110px; position: relative; overflow: hidden; }
        .ap-list > .fanus-container { position: relative; z-index: 1; }
        .ap-list__head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 26px; gap: 16px; flex-wrap: wrap;
        }
        .ap-list__head-left {
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
        }
        .ap-list__count { font-size: 14px; color: var(--fanus-ink-3); }
        .ap-list__count strong { color: var(--fanus-ink); font-weight: 700; }
        .ap-list__active { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ap-list__chip {
          font-size: 12px; font-weight: 600;
          color: var(--fanus-primary);
          background: var(--fanus-primary-50);
          padding: 4px 11px; border-radius: 999px;
        }
        .ap-list__reset {
          font-family: inherit; font-size: 12px; font-weight: 500;
          color: var(--fanus-ink-3); background: transparent; border: none;
          cursor: pointer; padding: 4px 6px;
          text-decoration: underline; text-decoration-style: dotted;
          text-underline-offset: 3px;
        }
        .ap-list__reset:hover { color: var(--fanus-primary); }
        .ap-select { font-family: inherit; font-size: 13.5px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--fanus-line); background: var(--fanus-bg); color: var(--fanus-ink-2); cursor: pointer; }

        .ap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
        .ap-card {
          display: flex; flex-direction: column;
          background: white; border: 1px solid var(--fanus-line);
          border-radius: 20px; overflow: hidden;
          transition: transform .25s, border-color .25s, box-shadow .25s;
        }
        .ap-card:hover { transform: translateY(-4px); border-color: var(--fanus-primary-200); box-shadow: 0 22px 46px rgba(16,81,183,.1); }
        .ap-card__cover { position: relative; aspect-ratio: 16/9; overflow: hidden; background: var(--fanus-primary-50); }
        .ap-card__cover svg { display: block; transition: transform .5s ease; }
        .ap-card:hover .ap-card__cover svg { transform: scale(1.05); }
        .ap-card__tag {
          position: absolute; top: 12px; left: 12px;
          padding: 5px 11px; border-radius: 999px;
          font-size: 11px; font-weight: 700; color: var(--fanus-primary);
          background: rgba(255,255,255,.92);
          text-transform: uppercase; letter-spacing: .06em;
          backdrop-filter: blur(6px);
        }
        .ap-card__body { padding: 20px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .ap-card__date {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 12px; color: var(--fanus-ink-3); font-weight: 500;
        }
        .ap-card__sep { width: 3px; height: 3px; border-radius: 50%; background: var(--fanus-ink-3); }
        .ap-card__read {
          display: inline-flex; align-items: center; gap: 4px;
          color: var(--fanus-primary); font-weight: 600;
        }
        .ap-card__read svg { width: 11px; height: 11px; }
        .ap-card__title { font-size: 17px; line-height: 1.3; font-weight: 700; color: var(--fanus-ink); margin: 0; }
        .ap-card__excerpt {
          font-size: 13.5px; color: var(--fanus-ink-3); line-height: 1.5; margin: 0; flex: 1;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .ap-card__author {
          display: flex; align-items: center; gap: 10px;
          padding-top: 14px; border-top: 1px dashed var(--fanus-line);
          margin-top: auto;
        }
        .ap-card__avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--fanus-primary); color: white; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ap-card__author-name { font-size: 12.5px; font-weight: 600; color: var(--fanus-ink); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ap-card__author-role { font-size: 11px; color: var(--fanus-ink-3); margin-top: 1px; }
        .ap-card__cta {
          margin-left: auto; display: inline-flex; align-items: center; gap: 4px;
          font-size: 12px; font-weight: 600; color: var(--fanus-primary);
          opacity: 0; transform: translateX(-4px);
          transition: opacity .2s, transform .2s;
        }
        .ap-card:hover .ap-card__cta { opacity: 1; transform: translateX(0); }

        .ap-empty {
          text-align: center; padding: 64px 24px;
          background: white; border: 1px dashed var(--fanus-line);
          border-radius: 20px;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
        }
        .ap-empty__icon {
          width: 56px; height: 56px; border-radius: 16px;
          background: var(--fanus-primary-50); color: var(--fanus-primary);
          display: inline-flex; align-items: center; justify-content: center;
          margin-bottom: 6px;
        }
        .ap-empty h3 {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: 18px; font-weight: 700; color: var(--fanus-ink); margin: 0;
        }
        .ap-empty p {
          font-size: 14px; color: var(--fanus-ink-3);
          margin: 0 0 8px; max-width: 380px;
        }
        @media (max-width: 1100px) { .ap-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) {
          .ap-grid { grid-template-columns: 1fr; }
          .ap-list__head { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </section>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function ArtNewsletter() {
  return (
    <section className="ap-news">
      <Deco type="circles-mix" style={{ top: 30, right: "6%", width: 220, opacity: .55 }} />
      <Deco type="target" style={{ bottom: 30, left: "8%", width: 130, opacity: .55 }} anim="drift" />
      <div className="fanus-container">
        <div className="ap-news__head">
          <div className="fanus-eyebrow"><span className="dash" /> E-bülleten <span className="dash" /></div>
          <h2>Aylıq məqalə bülletenimizə <span className="fanus-serif-accent">abunə olun</span></h2>
          <p>Hər ay Fanus psixoloqlarının seçilmiş yazıları birbaşa e-poçtunuza gəlsin.</p>
          <form className="ap-news__form" onSubmit={(e) => { e.preventDefault(); alert("Təşəkkürlər!"); }}>
            <input type="email" placeholder="email@nümunə.az" required />
            <button type="submit" className="fanus-btn fanus-btn-primary">
              Abunə ol <Arrow />
            </button>
          </form>
        </div>
      </div>
      <style>{`
        .ap-news {
          padding: 90px 0;
          background: linear-gradient(180deg, var(--fanus-bg) 0%, var(--fanus-primary-50) 100%);
          position: relative; overflow: hidden;
        }
        .ap-news > .fanus-container { position: relative; z-index: 1; }
        .ap-news__head { text-align: center; max-width: 760px; margin: 0 auto; }
        .ap-news__head .fanus-eyebrow { justify-content: center; }
        .ap-news__head h2 {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.1; color: var(--fanus-ink);
          margin: 16px 0 14px;
        }
        .ap-news__head p { font-size: 17px; color: var(--fanus-ink-3); margin: 0; }
        .ap-news__form {
          display: flex; gap: 8px;
          max-width: 480px; margin: 28px auto 0;
          flex-wrap: wrap; justify-content: center;
        }
        .ap-news__form input {
          flex: 1; min-width: 240px;
          padding: 14px 22px; border-radius: 999px;
          border: 1px solid var(--fanus-line); background: white;
          font-family: inherit; font-size: 14px; color: var(--fanus-ink);
        }
        .ap-news__form input:focus { outline: none; border-color: var(--fanus-primary); }
      `}</style>
    </section>
  );
}

function ArtCover({ type, color }: { type: Illu; color: string }) {
  const tint = (a: number) => `rgba(255,255,255,${a})`;
  const id = `${type}-${color.replace("#", "")}`;
  if (type === "sun") return (
    <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={`bs-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="#0B3F90" /></linearGradient></defs>
      <rect width="320" height="180" fill={`url(#bs-${id})`} />
      <circle cx="240" cy="70" r="38" fill="#F5B946" opacity=".95" />
      <circle cx="240" cy="70" r="56" fill="#F5B946" opacity=".18" />
      <path d="M0 130 Q80 110 160 125 T320 120 L320 180 L0 180 Z" fill={tint(.22)} />
      <path d="M0 150 Q80 135 160 145 T320 140 L320 180 L0 180 Z" fill={tint(.12)} />
    </svg>
  );
  if (type === "people") return (
    <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill={color} />
      <circle cx="80" cy="180" r="120" fill={tint(.1)} />
      <circle cx="240" cy="180" r="120" fill={tint(.08)} />
      <g><circle cx="120" cy="80" r="22" fill="#F4D2B0" /><path d="M85 180 Q85 130 120 120 Q155 130 155 180 Z" fill="#F5B946" /></g>
      <g><circle cx="200" cy="80" r="22" fill="#EAB890" /><path d="M165 180 Q165 130 200 120 Q235 130 235 180 Z" fill="#88AEEC" /></g>
      <path d="M140 90 Q160 75 180 90" stroke="#F5B946" strokeWidth="2" fill="none" strokeDasharray="3 4" />
    </svg>
  );
  if (type === "flame") return (
    <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <defs><radialGradient id={`fl-${id}`} cx="50%" cy="80%" r="60%"><stop offset="0%" stopColor="#F5B946" stopOpacity=".4" /><stop offset="100%" stopColor={color} stopOpacity="0" /></radialGradient></defs>
      <rect width="320" height="180" fill={color} />
      <rect width="320" height="180" fill={`url(#fl-${id})`} />
      <g transform="translate(140 40)">
        <rect x="0" y="20" width="40" height="48" rx="4" fill="none" stroke={tint(.85)} strokeWidth="2" />
        <path d="M-4 16 L44 16 L40 22 L0 22 Z" fill={tint(.85)} />
        <circle cx="20" cy="44" r="12" fill="#F5B946" />
        <circle cx="20" cy="44" r="20" fill="#F5B946" opacity=".25" />
      </g>
    </svg>
  );
  if (type === "moon") return (
    <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={`bm-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0B3F90" /><stop offset="100%" stopColor={color} /></linearGradient></defs>
      <rect width="320" height="180" fill={`url(#bm-${id})`} />
      {[[40, 30], [70, 55], [280, 40], [260, 80], [100, 25], [220, 30], [300, 110], [50, 90]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.4 + (i % 3) * .6} fill="#FFF" opacity={.4 + (i % 3) * .2} />
      ))}
      <g transform="translate(220 60)">
        <circle cx="0" cy="0" r="34" fill="#F5B946" opacity=".18" />
        <path d="M-8 -28 A30 30 0 1 0 -8 28 A22 22 0 0 1 -8 -28 Z" fill="#F5B946" />
      </g>
      <path d="M0 160 Q80 130 160 150 T320 140 L320 180 L0 180 Z" fill={tint(.14)} />
    </svg>
  );
  if (type === "waves") return (
    <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill={color} />
      <path d="M0 60 Q80 40 160 60 T320 60 L320 80 Q240 60 160 80 T0 80 Z" fill={tint(.18)} />
      <path d="M0 100 Q80 80 160 100 T320 100 L320 120 Q240 100 160 120 T0 120 Z" fill={tint(.14)} />
      <path d="M0 140 Q80 120 160 140 T320 140 L320 160 Q240 140 160 160 T0 160 Z" fill={tint(.1)} />
      <circle cx="60" cy="40" r="4" fill="#F5B946" />
      <circle cx="260" cy="30" r="3" fill="#F5B946" opacity=".7" />
    </svg>
  );
  return (
    <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill={color} />
      <circle cx="160" cy="90" r="70" fill="none" stroke={tint(.3)} strokeWidth="1" strokeDasharray="4 4" />
      <circle cx="160" cy="90" r="44" fill={tint(.12)} />
      <circle cx="160" cy="90" r="44" fill="none" stroke={tint(.6)} strokeWidth="1.5" />
      <path d="M160 60 L168 90 L160 120 L152 90 Z" fill="#F5B946" />
      <circle cx="160" cy="90" r="3" fill={tint(.9)} />
    </svg>
  );
}

function Arrow() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>; }
function CloseIcon() { return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>; }
function SparkleIcon() { return <svg width="16" height="16" fill="none" stroke="var(--fanus-primary)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.5 5.5l4 4M14.5 14.5l4 4M18.5 5.5l-4 4M9.5 14.5l-4 4" /></svg>; }
