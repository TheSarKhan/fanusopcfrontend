"use client";

import { useState } from "react";
import type { BlogPost } from "@/lib/api";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Yan","Fev","Mart","Apr","May","İyun","İyul","Avq","Sen","Okt","Noy","Dek"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const GRADIENTS = [
  "linear-gradient(135deg,#002147,#5A4FC8)",
  "linear-gradient(135deg,#1a5276,#2e86c1)",
  "linear-gradient(135deg,#145a32,#27ae60)",
  "linear-gradient(135deg,#6e2f8a,#a569bd)",
  "linear-gradient(135deg,#943126,#e74c3c)",
  "linear-gradient(135deg,#1a4d5c,#1abc9c)",
];

function catGradient(cat: string) {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) & 0xffff;
  return GRADIENTS[h % GRADIENTS.length];
}

function catInitials(cat: string) {
  return cat.slice(0, 2).toUpperCase();
}

export default function BlogPage({ posts }: { posts: BlogPost[] }) {
  const [active, setActive] = useState("Hamısı");

  const categories = ["Hamısı", ...Array.from(new Set(posts.map((p) => p.category)))];
  const filtered = active === "Hamısı" ? posts : posts.filter((p) => p.category === active);

  return (
    <main className="bl-page">

      {/* PAGE HEADER */}
      <div className="bl-page-header">
        <div className="container">
          <p className="bl-page-eyebrow">Məqalələr</p>
          <h1 className="bl-page-title">Mental Sağlamlıq &amp; Özünüinkişaf</h1>
          <p className="bl-page-sub">Mütəxəssislərimizdən seçilmiş yazılar</p>
        </div>
      </div>

      {/* STORIES BAR */}
      <div className="bl-stories-bar">
        <div className="container bl-stories-inner">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`bl-story${active === cat ? " active" : ""}`}
              onClick={() => setActive(cat)}
            >
              <div
                className="bl-story-circle"
                style={{ background: catGradient(cat) }}
              >
                {catInitials(cat)}
              </div>
              <span className="bl-story-label">{cat}</span>
            </button>
          ))}
        </div>
      </div>

      {/* FEED */}
      <section className="bl-content">
        <div className="container">
          {filtered.length === 0 ? (
            <div className="bl-empty">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ margin: "0 auto 16px", display: "block", opacity: 0.4 }}>
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
            <div className="bl-grid">
              {filtered.map((post, i) => (
                <a
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="bl-card bl-card-link"
                  style={{
                    animationDelay: `${i * 0.06}s`,
                  }}
                >
                  <div className="bl-card-visual">
                    {post.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.coverImageUrl} alt={post.title} className="bl-card-img" />
                    ) : (
                      <div className="bl-card-gradient-bg" style={{ background: catGradient(post.category) }}>
                        <span className="bl-card-gradient-label">{post.category}</span>
                      </div>
                    )}
                    <span className="bl-card-cat-badge">{post.category}</span>
                  </div>
                  <div className="bl-card-body">
                    <h3 className="bl-card-title">{post.title}</h3>
                    {post.excerpt && <p className="bl-card-excerpt">{post.excerpt}</p>}
                    <div className="bl-card-author">
                      <div className="bl-author-avatar" style={{ background: "linear-gradient(135deg,#002147,#5A4FC8)" }}>
                        {(post.authorName ?? "F").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="bl-author-name">{post.authorName ?? "Fanus Redaksiyası"}</div>
                        <div className="bl-author-date">{post.readTimeMinutes} dəq · {formatDate(post.publishedDate)}</div>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* NEWSLETTER STRIP */}
      <section className="bl-newsletter-strip">
        <div className="container bl-strip-inner">
          <p>Mental sağlamlıq haqqında həftəlik yazılar — spam yox.</p>
          <form className="bl-strip-form" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="email@nümunə.com" />
            <button type="submit" className="btn btn-primary" style={{ borderRadius: 8, height: 44 }}>
              Abunə ol
            </button>
          </form>
        </div>
      </section>

    </main>
  );
}
