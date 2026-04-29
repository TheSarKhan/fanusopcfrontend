"use client";

import { useBooking } from "@/context/BookingContext";
import type { Psychologist } from "@/lib/api";

function PsychologistCard({ p }: { p: Psychologist }) {
  const { open } = useBooking();
  return (
    <div
      className="group flex flex-col bg-white rounded-2xl overflow-hidden transition-all duration-250 cursor-pointer"
      style={{ border: "1px solid #E4EDF6" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(15,28,46,0.10)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "#C5D8ED";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "#E4EDF6";
      }}
    >
      <div className="relative overflow-hidden" style={{ height: 200 }}>
        <img
          src={p.photoUrl}
          alt={p.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
        />
        <div
          className="absolute bottom-3 left-3 bg-white rounded-full px-2.5 py-1"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}
        >
          <span className="text-[10px] font-semibold" style={{ color: p.accentColor }}>
            {p.experience} təcrübə
          </span>
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
            <span
              key={s}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={{ background: p.bgColor, color: p.accentColor }}
            >
              {s}
            </span>
          ))}
        </div>

        <div
          className="flex items-center justify-between pt-3 mt-auto"
          style={{ borderTop: "1px solid #F0F4F9" }}
        >
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

export default function Psychologists({ psychologists }: { psychologists: Psychologist[] }) {
  return (
    <section id="psychologists" style={{ background: "#ffffff", padding: "6rem 0" }}>
      <div className="container">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <h2
              className="text-3xl sm:text-4xl font-bold text-[#0F1C2E]"
              style={{  }}
            >
              Psixoloqlarımızla tanış olun
            </h2>
          </div>
          <a href="/psychologists" className="btn-outline self-start sm:self-auto text-sm py-2.5 px-5">
            Hamısını gör →
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {psychologists.map((p) => (
            <PsychologistCard key={p.id} p={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
