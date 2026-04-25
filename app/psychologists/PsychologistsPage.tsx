"use client";

import { useState } from "react";
import { useBooking } from "@/context/BookingContext";
import type { Psychologist } from "@/lib/api";

const specializations = [
  "Hamısı", "Depressiya", "Narahatlıq", "Münasibətlər", "Travma",
  "Stress", "Özünüinkişaf", "Ailə", "Uşaq psixologiyası",
];

function PsychologistCard({ p }: { p: Psychologist }) {
  const { open } = useBooking();
  return (
    <div
      className="group flex flex-col bg-white rounded-2xl overflow-hidden transition-all duration-250"
      style={{ border: "1px solid #E4EDF6" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,33,71,0.10)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "#C5D8ED";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "#E4EDF6";
      }}
    >
      <div className="relative overflow-hidden" style={{ height: 220 }}>
        <img
          src={p.photoUrl}
          alt={p.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
        />
        <div className="absolute bottom-3 left-3 bg-white rounded-full px-2.5 py-1" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}>
          <span className="text-[10px] font-semibold" style={{ color: p.accentColor }}>{p.experience} təcrübə</span>
        </div>
      </div>
      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h3 className="font-bold text-[#0F1C2E] text-[0.975rem] leading-snug">{p.name}</h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="text-xs font-semibold text-[#0F1C2E]">{p.rating}</span>
          </div>
        </div>
        <p className="text-xs text-[#5A7490] font-medium mb-3">{p.title}</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {p.specializations.map((s) => (
            <span key={s} className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: p.bgColor, color: p.accentColor }}>{s}</span>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 mt-auto" style={{ borderTop: "1px solid #F0F4F9" }}>
          <span className="text-xs text-[#8AAABF]">{p.sessionsCount} seans</span>
          <button
            onClick={() => open(p.name)}
            className="text-xs font-semibold text-white px-3.5 py-1.5 rounded-full transition-all duration-200"
            style={{ background: p.accentColor }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            Randevu al
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PsychologistsPage({ psychologists }: { psychologists: Psychologist[] }) {
  const [activeFilter, setActiveFilter] = useState("Hamısı");
  const [search, setSearch] = useState("");

  const filtered = psychologists.filter((p) => {
    const matchesSpec = activeFilter === "Hamısı" || p.specializations.includes(activeFilter);
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.title.toLowerCase().includes(search.toLowerCase());
    return matchesSpec && matchesSearch;
  });

  return (
    <div>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #002147 0%, #1A4A8A 100%)", paddingTop: "calc(64px + 4rem)", paddingBottom: "3rem" }}>
        <div className="container">
          <p className="section-label" style={{ color: "rgba(255,255,255,0.65)" }}>Komandamız</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Psixoloqlarımız</h1>
          <p className="text-[rgba(255,255,255,0.75)] max-w-xl text-[1.05rem] leading-relaxed">
            Hər biri öz sahəsinin mütəxəssisi olan peşəkar psixoloqlarımızla tanış olun.
          </p>
        </div>
      </div>

      <div className="section" style={{ background: "#F0F4FA" }}>
        <div className="container">
          {/* Search + Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#52718F]" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Ad və ya ixtisas axtar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white outline-none"
                style={{ border: "1px solid #C0D2E6", color: "#0D1B2E" }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {specializations.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveFilter(s)}
                  className="text-xs font-medium px-3.5 py-2 rounded-full transition-all duration-200"
                  style={activeFilter === s
                    ? { background: "#002147", color: "#fff" }
                    : { background: "#fff", color: "#52718F", border: "1px solid #C0D2E6" }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-[#52718F]">Heç bir psixoloq tapılmadı.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((p) => <PsychologistCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
