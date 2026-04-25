"use client";

import { useState } from "react";
import type { BlogPost } from "@/lib/api";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("az-AZ", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogPage({ posts }: { posts: BlogPost[] }) {
  const [activeCategory, setActiveCategory] = useState("Hamısı");

  const categories = ["Hamısı", ...Array.from(new Set(posts.map((p) => p.category)))];

  const filtered = activeCategory === "Hamısı"
    ? posts
    : posts.filter((p) => p.category === activeCategory);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #002147 0%, #1A4A8A 100%)", paddingTop: "calc(64px + 4rem)", paddingBottom: "3rem" }}>
        <div className="container">
          <p className="section-label" style={{ color: "rgba(255,255,255,0.65)" }}>Bloq</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Məqalələr & Tövsiyələr</h1>
          <p className="text-[rgba(255,255,255,0.75)] max-w-xl text-[1.05rem] leading-relaxed">
            Mental sağlamlıq, özünüinkişaf və psixologiya haqqında mütəxəssis fikirlər.
          </p>
        </div>
      </div>

      <div className="section" style={{ background: "#ffffff" }}>
        <div className="container">
          {/* Category filter */}
          <div className="flex flex-wrap gap-2 mb-10">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className="text-xs font-medium px-3.5 py-2 rounded-full transition-all duration-200"
                style={activeCategory === c
                  ? { background: "#002147", color: "#fff" }
                  : { background: "#F0F4FA", color: "#52718F", border: "1px solid #C0D2E6" }
                }
              >
                {c}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-[#52718F]">Bu kateqoriyada məqalə yoxdur.</div>
          ) : (
            <>
              {/* Featured */}
              {featured && (
                <div className="card flex flex-col md:flex-row gap-0 mb-8 overflow-hidden cursor-pointer group">
                  <div className="md:w-64 h-48 md:h-auto flex items-center justify-center text-8xl flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #E0EBF7, #EDE9F8)" }}>
                    {featured.emoji}
                  </div>
                  <div className="p-7 flex flex-col justify-center flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full"
                        style={{ background: featured.categoryBg, color: featured.categoryColor }}>
                        {featured.category}
                      </span>
                      <span className="text-xs text-[#52718F]">{featured.readTimeMinutes} dəq oxuma</span>
                      <span className="text-xs text-[#52718F]">{formatDate(featured.publishedDate)}</span>
                    </div>
                    <h2 className="text-2xl font-bold text-[#0D1B2E] mb-2 group-hover:text-[#002147] transition-colors">
                      {featured.title}
                    </h2>
                    <p className="text-[#52718F] text-sm leading-relaxed mb-4">{featured.excerpt}</p>
                    <button className="text-sm font-semibold flex items-center gap-1.5 w-fit" style={{ color: "#002147" }}>
                      Oxu
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Rest */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {rest.map((post) => (
                  <div key={post.id} className="card p-5 flex flex-col gap-4 cursor-pointer group">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
                      style={{ background: post.categoryBg }}>
                      {post.emoji}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: post.categoryBg, color: post.categoryColor }}>
                          {post.category}
                        </span>
                        <span className="text-xs text-[#52718F]">{post.readTimeMinutes} dəq</span>
                      </div>
                      <h3 className="font-bold text-[#0D1B2E] mb-1.5 group-hover:text-[#002147] transition-colors leading-snug">
                        {post.title}
                      </h3>
                      <p className="text-xs text-[#52718F] leading-relaxed line-clamp-3">{post.excerpt}</p>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: "1px solid #E4EDF6" }}>
                      <span className="text-xs text-[#52718F]">{formatDate(post.publishedDate)}</span>
                      <button className="text-xs font-semibold flex items-center gap-1" style={{ color: "#002147" }}>
                        Oxu
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
