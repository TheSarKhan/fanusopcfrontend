"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";

const CARDS = [
  { key: "psychologists", label: "Psixoloqlar", icon: "👤", color: "#002147", bg: "#EEF5FF" },
  { key: "announcements", label: "Elanlar",      icon: "📢", color: "#7B85C8", bg: "#EDE9F8" },
  { key: "blogPosts",     label: "Bloq yazıları", icon: "📝", color: "#1E7A6E", bg: "#E8F7F5" },
  { key: "faqs",          label: "FAQ",           icon: "❓", color: "#002147", bg: "#EEF5FF" },
  { key: "testimonials",  label: "Rəylər",        icon: "⭐", color: "#D97706", bg: "#FFF3EC" },
  { key: "appointments",  label: "Randevular",    icon: "📅", color: "#1A5C8A", bg: "#E6F2FA" },
];

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getDashboard().then(setCounts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1A2535]" style={{ fontFamily: "var(--font-playfair, serif)" }}>
          Dashboard
        </h1>
        <p className="text-[#52718F] text-sm mt-1">Fanus platformasına xoş gəlmisiniz</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
        {CARDS.map(card => (
          <a
            key={card.key}
            href={`/admin/${card.key === "blogPosts" ? "blog" : card.key}`}
            style={{
              background: "#fff",
              borderRadius: "1.25rem",
              padding: "1.5rem",
              border: "1px solid #E4EDF6",
              textDecoration: "none",
              display: "block",
              transition: "all 0.2s",
              boxShadow: "0 2px 8px rgba(15,28,46,0.04)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(15,28,46,0.10)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(15,28,46,0.04)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                style={{
                  width: 44, height: 44, borderRadius: "0.75rem",
                  background: card.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.25rem",
                }}
              >
                {card.icon}
              </div>
              {!loading && (
                <span
                  className="text-3xl font-bold"
                  style={{ color: card.color, fontFamily: "var(--font-playfair, serif)" }}
                >
                  {counts[card.key] ?? 0}
                </span>
              )}
            </div>
            <p className="font-semibold text-[#1A2535] text-sm">{card.label}</p>
            <p className="text-xs text-[#52718F] mt-0.5">İdarə et →</p>
          </a>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-2xl p-6" style={{ border: "1px solid #E4EDF6" }}>
        <h2 className="font-bold text-[#1A2535] mb-3">Sürətli keçidlər</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/admin/psychologists", label: "+ Psixoloq əlavə et" },
            { href: "/admin/announcements", label: "+ Elan əlavə et" },
            { href: "/admin/blog",          label: "+ Bloq yazısı əlavə et" },
            { href: "/admin/appointments",  label: "📅 Randevulara bax" },
          ].map(link => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold px-4 py-2 rounded-full transition-all"
              style={{ background: "#EEF5FF", color: "#002147", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#D5E8FF"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#EEF5FF"}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
