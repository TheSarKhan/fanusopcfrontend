"use client";

import { useState } from "react";
import { useScrollReveal } from "@/lib/useScrollReveal";
import type { BlogPost } from "@/lib/api";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Yan", "Fev", "Mart", "Apr", "May", "İyun", "İyul", "Avq", "Sen", "Okt", "Noy", "Dek"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function ArrowIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export default function BlogPage({ posts }: { posts: BlogPost[] }) {
  const [active, setActive] = useState("Hamısı");
  const { ref: heroRef, visible: heroVisible } = useScrollReveal<HTMLDivElement>(0.05);
  const { ref: contentRef, visible: contentVisible } = useScrollReveal<HTMLElement>(0.05);
  const { ref: newsRef, visible: newsVisible } = useScrollReveal<HTMLElement>(0.1);

  const categories = ["Hamısı", ...Array.from(new Set(posts.map((p) => p.category)))];

  const allFiltered = active === "Hamısı" ? posts : posts.filter((p) => p.category === active);
  const featured = allFiltered.find((p) => p.featured) ?? allFiltered[0] ?? null;
  const regular = allFiltered.filter((p) => p !== featured);
  const showEmpty = allFiltered.length === 0;

  return (
    <main className="bl-page">

      {/* HERO */}
      <section className="bl-hero">
        <div className="ap-hero-blob ap-hero-blob-1" />
        <div className="ap-hero-blob ap-hero-blob-2" />
        <div
          className="container"
          ref={heroRef}
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--oxford-60)" }}>
            Bloq
          </p>
          <h1 className="bl-hero-title">
            Məqalələr<br />&amp; Tövsiyələr
          </h1>
          <p className="bl-hero-sub">
            Mental sağlamlıq, özünüinkişaf və psixologiya haqqında mütəxəssis fikirlər.
          </p>
          <div className="bl-hero-cats">
            {["Depressiya", "Narahatlıq", "Münasibətlər", "Stress", "Özünüinkişaf"].map((c) => (
              <span key={c} className="bl-hero-cat">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORY FILTER */}
      <div className="bl-filters">
        <div className="container bl-filters-inner">
          {categories.map((c) => (
            <button
              key={c}
              className={`bl-cat-pill${active === c ? " active" : ""}`}
              onClick={() => setActive(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <section className="bl-content" ref={contentRef}>
        <div className="container">
          {showEmpty ? (
            <div className="bl-empty">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ margin: "0 auto 16px", display: "block", opacity: 0.5 }}>
                <path d="M14 18 L14 56 Q14 60 18 60 L36 60 L36 18 Q36 14 32 14 L18 14 Q14 14 14 18 Z" stroke="var(--oxford-20)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M36 18 L36 60 L54 60 Q58 60 58 56 L58 18 Q58 14 54 14 L40 14 Q36 14 36 18 Z" stroke="var(--oxford-20)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <line x1="20" y1="24" x2="30" y2="24" stroke="var(--oxford-10)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="20" y1="30" x2="30" y2="30" stroke="var(--oxford-10)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="42" y1="24" x2="52" y2="24" stroke="var(--oxford-10)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="42" y1="30" x2="52" y2="30" stroke="var(--oxford-10)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <h3>Bu kateqoriyada məqalə hələ yoxdur.</h3>
              <button
                className="btn btn-ghost"
                style={{ borderRadius: "var(--r-btn)" }}
                onClick={() => setActive("Hamısı")}
              >
                Bütün yazıları göstər
              </button>
            </div>
          ) : (
            <>
              {/* Featured */}
              {featured && (
                <article
                  className="bl-featured"
                  style={{
                    borderLeftColor: featured.categoryColor,
                    opacity: contentVisible ? 1 : 0,
                    transform: contentVisible ? "translateY(0)" : "translateY(20px)",
                    transition: "opacity 0.7s ease, transform 0.7s ease",
                  }}
                >
                  <div
                    className="bl-featured-img"
                    style={{ background: `linear-gradient(135deg, ${featured.categoryBg} 0%, rgba(238,244,255,0.6) 100%)` }}
                  >
                    <div className="bl-featured-emoji">{featured.emoji}</div>
                  </div>
                  <div className="bl-featured-body">
                    <div className="bl-meta">
                      <span className="bl-cat-tag" style={{ background: featured.categoryBg, color: featured.categoryColor }}>
                        {featured.category}
                      </span>
                      <span className="bl-meta-text">{featured.readTimeMinutes} dəq · {formatDate(featured.publishedDate)}</span>
                    </div>
                    <h2 className="bl-featured-title">{featured.title}</h2>
                    <p className="bl-featured-excerpt">{featured.excerpt}</p>
                    <button className="bl-link">
                      Oxu <ArrowIcon size={14} />
                    </button>
                  </div>
                </article>
              )}

              {/* Grid */}
              <div className="bl-grid">
                {regular.map((post, i) => (
                  <article
                    className="bl-card"
                    key={post.id}
                    style={{
                      opacity: contentVisible ? 1 : 0,
                      transform: contentVisible ? "translateY(0)" : "translateY(24px)",
                      transition: `opacity 0.6s ease ${0.08 * i}s, transform 0.6s ease ${0.08 * i}s`,
                    }}
                  >
                    <div className="bl-card-emoji" style={{ background: post.categoryBg }}>
                      {post.emoji}
                    </div>
                    <div className="bl-card-meta">
                      <span className="bl-cat-tag" style={{ background: post.categoryBg, color: post.categoryColor }}>
                        {post.category}
                      </span>
                      <span className="bl-meta-text">{post.readTimeMinutes} dəq</span>
                    </div>
                    <h3 className="bl-card-title">{post.title}</h3>
                    <p className="bl-card-excerpt">{post.excerpt}</p>
                    <div className="bl-card-foot">
                      <span className="bl-meta-text">{formatDate(post.publishedDate)}</span>
                      <button className="bl-link bl-link-sm">
                        Oxu <ArrowIcon size={12} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="bl-newsletter" ref={newsRef}>
        <div
          className="container bl-news-inner"
          style={{
            opacity: newsVisible ? 1 : 0,
            transform: newsVisible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--oxford-60)" }}>
            Abunə ol
          </p>
          <h2>Mental sağlamlıq haqqında<br />həftəlik yazılar</h2>
          <p>
            Mütəxəssislərimizin tövsiyələri birbaşa e-poçtunuza. Spam yox, yalnız faydalı oxu.
          </p>
          <form className="bl-news-form" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="email@nümunə.com" />
            <button type="submit" className="btn btn-primary" style={{ borderRadius: 10, height: 52 }}>
              Abunə ol
            </button>
          </form>
          <div className="bl-news-trust">
            <svg width="12" height="12" fill="none" stroke="var(--oxford-60)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            İstədiyiniz vaxt abunəlikdən çıxa bilərsiniz
          </div>
        </div>
      </section>

    </main>
  );
}
