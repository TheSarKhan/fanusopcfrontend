"use client";

import type { ReactElement } from "react";
import type { Announcement } from "@/lib/api";

const ICON_MAP: Record<string, ReactElement> = {
  GROUP: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  ),
  STAR: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
    </svg>
  ),
  VIDEO: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("az-AZ", { day: "numeric", month: "long", year: "numeric" });
}

export default function Announcements({ announcements }: { announcements: Announcement[] }) {
  return (
    <section
      className="section"
      style={{ background: "linear-gradient(180deg, #E0EBF7 0%, #F0F4FA 100%)" }}
    >
      <div className="container">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <p className="section-label">Xəbərlər</p>
            <h2
              className="text-3xl sm:text-4xl font-bold"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
            >
              Elanlar & Yeniliklər
            </h2>
          </div>
          <a href="/announcements" className="btn-outline self-start sm:self-auto">
            Hamısına bax →
          </a>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {announcements.map((a) => (
            <div key={a.id} className="card flex flex-col" style={{ background: "#ffffff" }}>
              <div className="p-5 pb-0">
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: a.categoryBg, color: a.categoryColor }}
                  >
                    {ICON_MAP[a.iconType] ?? ICON_MAP.STAR}
                    {a.category}
                  </span>
                  <span className="text-xs text-[#52718F]">{formatDate(a.publishedDate)}</span>
                </div>

                <h3 className="font-bold text-[#1A2535] text-[1rem] leading-snug mb-3">
                  {a.title}
                </h3>
                <p className="text-sm text-[#52718F] leading-relaxed">{a.excerpt}</p>
              </div>

              <div className="p-5 pt-4 mt-auto">
                <button
                  className="flex items-center gap-2 text-sm font-semibold transition-colors"
                  style={{ color: a.categoryColor }}
                >
                  Ətraflı oxu
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
