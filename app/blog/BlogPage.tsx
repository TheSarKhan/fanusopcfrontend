"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Deco from "@/components/Deco";
import Breadcrumb from "@/components/Breadcrumb";
import type { BlogPost } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { azFormatDate } from "@/lib/datetime";

type Cat = "all" | "anxiety" | "relations" | "selfcare" | "sleep" | "youth" | "mindful";
type Illu = "sun" | "people" | "flame" | "moon" | "waves" | "compass";

const FILTERS: { id: Cat; labelKey: MessageKey }[] = [
  { id: "all",       labelKey: "blogPage.filterAll" },
  { id: "anxiety",   labelKey: "blogPage.filterAnxiety" },
  { id: "relations", labelKey: "blogPage.filterRelations" },
  { id: "selfcare",  labelKey: "blogPage.filterSelfcare" },
  { id: "sleep",     labelKey: "blogPage.filterSleep" },
  { id: "youth",     labelKey: "blogPage.filterYouth" },
  { id: "mindful",   labelKey: "blogPage.filterMindful" },
];

const ILLU_BY_CAT: Record<Cat, Illu> = {
  all: "sun", anxiety: "sun", relations: "people", selfcare: "flame",
  sleep: "moon", youth: "compass", mindful: "waves",
};

function deriveCat(title: string): Cat {
  const s = title.toLowerCase();
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
  cat: Cat;
  title: string;
  excerpt: string;
  date: string;
  read: string;
  readMinutes: number;
  publishedAt: number;
  author: string;
  authorPhotoUrl?: string;
  /** ADMIN | PSYCHOLOGIST — yalnız API-dən gələn məqalələrdə olur. */
  authorRole?: string;
  /** Psixoloqun peşəkar vəzifəsi (məs. "Klinik psixoloq") — yalnız API-dən gələn məqalələrdə olur. */
  authorTitle?: string;
  illu: Illu;
  coverUrl?: string;
  /** Baxış sayı (V125) — yalnız API-dən gələn məqalələrdə olur. */
  views?: number;
}

const FALLBACK: Item[] = [
  { slug: "narahat-oyananda",  cat: "anxiety",    title: "Səhər yuxudan narahat oyananda nə etməli", excerpt: "Bədəniniz hələ yatağa qalxmadan beyniniz qorxular siyahısı tutursa — bu məqalə sizin üçündür.", date: "12 May 2026", read: "6 dəq", readMinutes: 6, publishedAt: Date.parse("2026-05-12"), author: "Aysel Məmmədova", illu: "sun" },
  { slug: "serhed-qoymaq",     cat: "relations",  title: "Sərhəd qoymaq eqoist olmaq deyil",         excerpt: "Sağlam sərhədlər münasibətləri zəiflətmir — onları daha güclü və davamlı edir.",                          date: "8 May 2026",  read: "8 dəq", readMinutes: 8, publishedAt: Date.parse("2026-05-08"), author: "Lalə Hüseynova",   illu: "people" },
  { slug: "tukenmislik",       cat: "selfcare",   title: "Tükənmişlik — gizli əlamətlər",            excerpt: "Bezginlik və burnout fərqlidir. Ondan əvvəl bədənin verdiyi siqnalları öyrənmək.",                          date: "3 May 2026",  read: "7 dəq", readMinutes: 7, publishedAt: Date.parse("2026-05-03"), author: "Elnur Səfərov",    illu: "flame" },
  { slug: "yuxusuzluq",        cat: "sleep",      title: "Yuxusuzluğun düşüncə tələsi və çıxış yolu", excerpt: "“Yatmalıyam” fikri özü yuxusuzluğun yanacağına çevrilir. Bu dövrəni necə qırmaq olar.",                       date: "28 Apr 2026", read: "5 dəq", readMinutes: 5, publishedAt: Date.parse("2026-04-28"), author: "Rəşad Quliyev",    illu: "moon" },
  { slug: "5deq-nefes",        cat: "mindful",    title: "5 dəqiqəlik nəfəs — günü yenidən başlat",  excerpt: "Stresli anlarda sinir sistemini sakitləşdirmək üçün sadə, sübuta əsaslanan texnika.",                        date: "22 Apr 2026", read: "4 dəq", readMinutes: 4, publishedAt: Date.parse("2026-04-22"), author: "Səbinə Əliyeva",   illu: "waves" },
  { slug: "yeniyetme-qabiq",   cat: "youth",      title: "Yeniyetmə öz qabığına çəkiləndə",          excerpt: "Susqunluq həmişə problem deyil. Lakin nə vaxt diqqət etmək lazımdır?",                                       date: "18 Apr 2026", read: "6 dəq", readMinutes: 6, publishedAt: Date.parse("2026-04-18"), author: "Nigar Kazımova",   illu: "compass" },
  { slug: "panik-atak",        cat: "anxiety",    title: "Panik atak: bədənin yalan həyəcanı",       excerpt: "Panik atak təhlükəli deyil — amma bunu beyninə inandırmaq başqa məsələdir.",                                  date: "14 Apr 2026", read: "6 dəq", readMinutes: 6, publishedAt: Date.parse("2026-04-14"), author: "Aysel Məmmədova", illu: "waves" },
  { slug: "esitmek",           cat: "relations",  title: "Münaqişədə eşitmək — danışmaqdan əvvəl",   excerpt: "Aktiv dinləmə bir bacarıqdır. Sevdiklərinizlə sınamaq üçün 4 sadə addım.",                                    date: "9 Apr 2026",  read: "7 dəq", readMinutes: 7, publishedAt: Date.parse("2026-04-09"), author: "Lalə Hüseynova",   illu: "people" },
  { slug: "dincelmek",         cat: "selfcare",   title: "Niyə dincəlmək də öyrənilməlidir",         excerpt: "Hər kəs istirahətin necə görünməsini bilmir. İnsan üçün dincəlmənin 7 növü.",                                  date: "5 Apr 2026",  read: "5 dəq", readMinutes: 5, publishedAt: Date.parse("2026-04-05"), author: "Elnur Səfərov",    illu: "compass" },
];

type SortBy = "new" | "quick";

export default function BlogPage({ posts }: { posts?: BlogPost[] }) {
  const { t } = useT();
  const items: Item[] = useMemo(() => {
    if (!posts || posts.length === 0) return FALLBACK;
    return posts.map((p) => {
      const cat = deriveCat(p.title);
      return {
        slug: p.slug,
        cat,
        title: p.title,
        excerpt: p.excerpt,
        date: azFormatDate(p.publishedDate),
        read: t("pub.readMinutes", { n: p.readTimeMinutes }),
        readMinutes: p.readTimeMinutes,
        publishedAt: new Date(p.publishedDate).getTime(),
        author: p.authorName ?? t("blogPage.editorial"),
        authorPhotoUrl: p.authorPhotoUrl,
        authorRole: p.authorRole,
        authorTitle: p.authorTitle,
        illu: ILLU_BY_CAT[cat],
        coverUrl: p.coverImageUrl,
        views: p.viewCount ?? 0,
      };
    });
  }, [posts, t]);

  const [filter, setFilter] = useState<Cat>("all");
  const [sortBy, setSortBy] = useState<SortBy>("new");

  const filtered = useMemo(() => {
    const result = filter === "all" ? items : items.filter((a) => a.cat === filter);
    if (sortBy === "quick") {
      return [...result].sort((a, b) => a.readMinutes - b.readMinutes);
    }
    return [...result].sort((a, b) => b.publishedAt - a.publishedAt);
  }, [items, filter, sortBy]);

  const activeKey = filter === "all" ? null : FILTERS.find((f) => f.id === filter)?.labelKey ?? null;
  const activeFilterLabel = activeKey ? t(activeKey) : null;
  const resetFilters = () => setFilter("all");

  return (
    <div className="fanus-root">
      <Breadcrumb items={[{ label: t("pub.crumbBlog") }]} />
      <ArtHero />
      <ArtFilters active={filter} onChange={setFilter} />
      <ArtList
        items={filtered}
        sortBy={sortBy}
        setSortBy={setSortBy}
        activeFilterLabel={activeFilterLabel}
        onReset={resetFilters}
      />
    </div>
  );
}

function ArtHero() {
  const { t } = useT();
  return (
    <section className="blog-hero">
      <div className="fanus-container blog-hero__inner">
        <h1>{t("articles.title")}</h1>
        <p className="blog-hero__lead">{t("articles.lead")}</p>
      </div>

      <style>{`
        /* Ad qəsdən "ap-hero" DEYİL — o sinif globals.css-də ABOUT səhifəsinə
           aiddir (mavi gradient background) və eyni adı paylaşsaydı bura sızardı. */
        .blog-hero { padding: 28px 0; text-align: center; background: transparent; }
        .blog-hero__inner { max-width: 720px; margin: 0 auto; }
        .blog-hero h1 {
          margin: 0 0 16px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(32px, 4.6vw, 54px); font-weight: 800;
          letter-spacing: -0.03em; line-height: 1.1; color: var(--fanus-ink);
        }
        .blog-hero__lead {
          font-size: 17px; color: var(--fanus-ink-3); line-height: 1.6;
          max-width: 600px; margin: 0 auto;
        }
        @media (max-width: 640px) { .blog-hero { padding: 20px 0; } }
      `}</style>
    </section>
  );
}

function ArtFilters({ active, onChange }: { active: Cat; onChange: (c: Cat) => void }) {
  const { t } = useT();
  return (
    <div className="ap-filters">
      <div className="fanus-container">
        <div className="ap-filters__chips">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`ap-chip ${active === f.id ? "is-active" : ""}`}
              onClick={() => onChange(f.id)}
            >
              {t(f.labelKey)}
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
  onReset,
}: {
  items: Item[];
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;
  activeFilterLabel: string | null;
  onReset: () => void;
}) {
  const { t } = useT();
  return (
    <section className="ap-list">
      <Deco type="mesh-blob" style={{ top: 60, right: "-5%", width: 400, opacity: .35 }} anim="drift" />
      <Deco type="blob-1" style={{ bottom: 80, left: "-4%", width: 280, opacity: .4 }} anim="drift" />
      <div className="fanus-container">
        <div className="ap-list__head">
          <div className="ap-list__head-left">
            <div className="ap-list__count">
              {t("blogPage.articleCount", { n: items.length })}
            </div>
            {activeFilterLabel && (
              <div className="ap-list__active">
                <span className="ap-list__chip">
                  {activeFilterLabel}
                </span>
                <button className="ap-list__reset" onClick={onReset}>
                  {t("blogPage.resetFilter")}
                </button>
              </div>
            )}
          </div>
          <select
            className="ap-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="new">{t("blogPage.sortNewest")}</option>
            <option value="quick">{t("blogPage.sortQuick")}</option>
          </select>
        </div>

        {items.length === 0 ? (
          <div className="ap-empty">
            <div className="ap-empty__icon"><SparkleIcon /></div>
            <h3>{t("blogPage.emptyTitle")}</h3>
            <p>{t("blogPage.emptyBody")}</p>
            {activeFilterLabel && (
              <button className="fanus-btn fanus-btn-light fanus-btn-sm" onClick={onReset}>
                {t("blogPage.showAll")}
              </button>
            )}
          </div>
        ) : (
          <div className="ap-grid">
            {items.map((a) => (
              <Link key={a.slug} className="ap-card" href={`/blog/${a.slug}`}>
                <div className="ap-card__cover">
                  {a.coverUrl ? (
                    <img src={a.coverUrl} alt={a.title} className="ap-card__cover-img" />
                  ) : (
                    <ArtCover type={a.illu} color="#1051B7" />
                  )}
                </div>
                <div className="ap-card__body">
                  <div className="ap-card__date">
                    <span className="ap-card__meta-item"><CalendarIcon />{a.date}</span>
                    {a.views != null && a.views > 0 && (
                      <span className="ap-card__meta-item"><EyeIcon />{t("pub.viewsCount", { n: a.views })}</span>
                    )}
                  </div>
                  <h3 className="ap-card__title">{a.title}</h3>
                  <p className="ap-card__excerpt">{a.excerpt}</p>
                  <div className="ap-card__author">
                    {a.authorPhotoUrl ? (
                      <img className="ap-card__avatar ap-card__avatar--photo" src={a.authorPhotoUrl} alt={a.author} />
                    ) : (
                      <span className="ap-card__avatar">{a.author.split(" ").map((n) => n[0]).join("")}</span>
                    )}
                    <div>
                      <div className="ap-card__author-name">{a.author}</div>
                      <div className="ap-card__author-role">
                        {a.authorTitle || (a.authorRole === "PSYCHOLOGIST" ? t("pub.authorRole") : t("blogPage.editorial"))}
                      </div>
                    </div>
                    <span className="ap-card__cta">{t("blogPage.readCta")} <Arrow /></span>
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
        .ap-card__cover-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s ease; }
        .ap-card:hover .ap-card__cover-img { transform: scale(1.05); }
        .ap-card__body { padding: 20px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .ap-card__date {
          display: inline-flex; align-items: center; gap: 14px;
          font-size: 12px; color: var(--fanus-ink-3); font-weight: 500;
        }
        .ap-card__meta-item { display: inline-flex; align-items: center; gap: 5px; }
        .ap-card__meta-item svg { width: 13px; height: 13px; flex-shrink: 0; color: var(--fanus-ink-3); }
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
        .ap-card__avatar--photo { object-fit: cover; }
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
function CalendarIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="2.4" y="3.4" width="11.2" height="10.2" rx="1.6" /><path d="M2.4 6.6h11.2M5.6 2.4v2M10.4 2.4v2" strokeLinecap="round" /></svg>; }
function EyeIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M1.2 8S3.4 3.4 8 3.4 14.8 8 14.8 8 12.6 12.6 8 12.6 1.2 8 1.2 8Z" strokeLinejoin="round" /><circle cx="8" cy="8" r="2.2" /></svg>; }
function SparkleIcon() { return <svg width="16" height="16" fill="none" stroke="var(--fanus-primary)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.5 5.5l4 4M14.5 14.5l4 4M18.5 5.5l-4 4M9.5 14.5l-4 4" /></svg>; }
