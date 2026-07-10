"use client";

import Link from "next/link";
import type { BlogPost } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azFormatDate } from "@/lib/datetime";

const COLORS = ["#5089E0", "#1051B7", "#0B3F90", "#2A6BD0"];

export default function Articles({ posts }: { posts?: BlogPost[] }) {
  const { t } = useT();
  const data = (posts && posts.length > 0)
    ? posts.slice(0, 4).map((p, i) => ({
        slug: p.slug,
        tag: p.category,
        title: p.title,
        date: azFormatDate(p.publishedDate),
        read: t("articles.minutes", { n: p.readTimeMinutes }),
        bg: p.categoryBg || COLORS[i % COLORS.length],
        fg: p.categoryColor || "#fff",
        coverUrl: p.coverImageUrl,
      }))
    : [
        { slug: "narahatliq", tag: "Narahatlıq",   title: "Səhər yuxudan narahat oyananda nə etməli", date: "12 May 2025", read: "6 dəq", bg: COLORS[0], fg: "#fff", coverUrl: undefined as string | undefined },
        { slug: "munasibetler", tag: "Münasibətlər", title: "Sərhəd qoymaq eqoist olmaq deyil",        date: "8 May 2025",  read: "8 dəq", bg: COLORS[1], fg: "#fff", coverUrl: undefined },
        { slug: "ozune-qayim", tag: "Özünəqayım",   title: "Tükənmişlik (burnout) — gizli əlamətlər",   date: "3 May 2025",  read: "7 dəq", bg: COLORS[2], fg: "#fff", coverUrl: undefined },
        { slug: "yuxu", tag: "Yuxu",           title: "Yuxusuzluğun düşüncə tələsi və çıxış yolu", date: "28 Apr 2025", read: "5 dəq", bg: COLORS[3], fg: "#fff", coverUrl: undefined },
      ];

  return (
    <section className="fanus-art" id="articles">
      <div className="fanus-container">
        <div className="fanus-art__head">
          <h2>{t("articles.title")}</h2>
          <p className="fanus-art__lead">{t("articles.lead")}</p>
        </div>

        <div className="fanus-art__grid">
          {data.map((a, i) => (
            <Link key={i} className="fanus-art-card" href={`/blog/${a.slug}`}>
              <div className="fanus-art-card__cover" style={{ background: a.bg }}>
                {a.coverUrl ? (

                  <img src={a.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <CoverArt color={a.bg} variant={i % 4} />
                )}
                <span className="fanus-art-card__tag" style={{ background: a.bg, color: a.fg }}>{a.tag}</span>
              </div>
              <div className="fanus-art-card__body">
                <div className="fanus-art-card__date">
                  {a.date}
                  <span className="fanus-art-card__sep" />
                  {a.read}
                </div>
                <h3 className="fanus-art-card__title">{a.title}</h3>
              </div>
            </Link>
          ))}
        </div>

        <div className="fanus-art__foot">
          <Link href="/blog" className="fanus-btn fanus-btn-ghost">
            {t("articles.seeAll")}
          </Link>
        </div>
      </div>

      <style>{`
        .fanus-art { padding: 68px 0; background: var(--fanus-paper); position: relative; overflow: hidden; }
        .fanus-art > .fanus-container { position: relative; z-index: 1; }
        .fanus-art__head { margin-bottom: 48px; text-align: center; }
        .fanus-art__head h2 {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.1; color: var(--fanus-ink);
          margin: 0;
        }
        .fanus-art__lead { margin: 12px auto 0; max-width: 540px; font-size: 17px; color: var(--fanus-ink-3); }
        .fanus-art__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; }
        .fanus-art__foot { display: flex; justify-content: center; margin-top: 40px; }
        .fanus-art-card {
          display: flex; flex-direction: column;
          background: white; border: 1px solid var(--fanus-line);
          border-radius: 20px; overflow: hidden;
          transition: all .3s ease;
        }
        .fanus-art-card:hover {
          transform: translateY(-4px);
          border-color: var(--fanus-primary-300);
          box-shadow: 0 22px 46px rgba(16,81,183,.12);
        }
        .fanus-art-card__cover { position: relative; aspect-ratio: 16/9; overflow: hidden; }
        .fanus-art-card__tag {
          position: absolute; top: 12px; left: 12px;
          padding: 5px 11px; border-radius: 999px;
          font-size: 11px; font-weight: 700; color: white;
          text-transform: uppercase; letter-spacing: .06em;
          backdrop-filter: blur(6px);
          box-shadow: 0 4px 12px rgba(0,0,0,.15);
        }
        .fanus-art-card__body {
          padding: 18px 18px 20px;
          display: flex; flex-direction: column; gap: 12px;
          flex: 1;
        }
        .fanus-art-card__date {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; color: var(--fanus-ink-3); font-weight: 500;
        }
        .fanus-art-card__sep {
          width: 3px; height: 3px; border-radius: 50%; background: var(--fanus-ink-3);
          margin: 0 4px;
        }
        .fanus-art-card__title {
          font-size: 16px; line-height: 1.3; font-weight: 700;
          color: var(--fanus-ink); margin: 0; flex: 1;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @media (max-width: 1100px) { .fanus-art__grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .fanus-art__grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function CoverArt({ color, variant }: { color: string; variant: number }) {
  if (variant === 0) {
    return (
      <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="180" fill={color} />
        <circle cx="240" cy="70" r="38" fill="#F5B946" opacity=".95" />
        <circle cx="240" cy="70" r="56" fill="#F5B946" opacity=".18" />
        <path d="M0 130 Q80 110 160 125 T320 120 L320 180 L0 180 Z" fill="rgba(255,255,255,.22)" />
        <path d="M0 150 Q80 135 160 145 T320 140 L320 180 L0 180 Z" fill="rgba(255,255,255,.12)" />
      </svg>
    );
  }
  if (variant === 1) {
    return (
      <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="180" fill={color} />
        <circle cx="80" cy="180" r="120" fill="rgba(255,255,255,.1)" />
        <circle cx="240" cy="180" r="120" fill="rgba(255,255,255,.08)" />
        <circle cx="120" cy="80" r="22" fill="#F4D2B0" />
        <circle cx="200" cy="80" r="22" fill="#EAB890" />
        <path d="M85 180 Q85 130 120 120 Q155 130 155 180 Z" fill="#F5B946" />
        <path d="M165 180 Q165 130 200 120 Q235 130 235 180 Z" fill="#88AEEC" />
      </svg>
    );
  }
  if (variant === 2) {
    return (
      <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="180" fill={color} />
        <g transform="translate(140 40)">
          <rect x="0" y="20" width="40" height="48" rx="4" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2" />
          <path d="M-4 16 L44 16 L40 22 L0 22 Z" fill="rgba(255,255,255,.85)" />
          <circle cx="20" cy="44" r="12" fill="#F5B946" />
          <circle cx="20" cy="44" r="20" fill="#F5B946" opacity=".25" />
        </g>
      </svg>
    );
  }
  return (
    <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill={color} />
      {[[40, 30], [70, 55], [280, 40], [260, 80], [100, 25], [220, 30], [300, 110], [50, 90]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.4 + (i % 3) * 0.6} fill="#FFF" opacity={0.4 + (i % 3) * 0.2} />
      ))}
      <g transform="translate(220 60)">
        <circle cx="0" cy="0" r="34" fill="#F5B946" opacity=".18" />
        <path d="M-8 -28 A30 30 0 1 0 -8 28 A22 22 0 0 1 -8 -28 Z" fill="#F5B946" />
      </g>
      <path d="M0 160 Q80 130 160 150 T320 140 L320 180 L0 180 Z" fill="rgba(255,255,255,.14)" />
    </svg>
  );
}
