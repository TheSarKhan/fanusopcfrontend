"use client";

import type { Testimonial } from "@/lib/api";

const certifications = [
  "Azərbaycan Psixoloqlar Assosiasiyası",
  "CBT (Kognitiv-Davranış Terapiyası)",
  "EMDR Sertifikatı",
  "Mindfulness Terapiyası",
  "Ailə Sistemlər Terapiyası",
];

const trustMetrics = [
  {
    value: "4.9/5", label: "Orta reytinq",
    icon: <svg width="18" height="18" fill="#F59E0B" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  },
  {
    value: "100%", label: "Məxfilik",
    icon: <svg width="18" height="18" fill="none" stroke="#002147" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    value: "1200+", label: "Seans",
    icon: <svg width="18" height="18" fill="none" stroke="#7C3AED" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    value: "5 il", label: "Təcrübə",
    icon: <svg width="18" height="18" fill="none" stroke="#0D9488" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" strokeLinecap="round"/></svg>,
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="13" height="13" fill="#F59E0B" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 300,
        background: "#fff",
        borderRadius: "1.25rem",
        padding: "20px",
        boxShadow: "0 2px 16px rgba(26,37,53,0.07)",
        border: "1px solid #EEF4FB",
        marginRight: 16,
      }}
    >
      <Stars count={t.rating} />
      <p className="text-[#1A2535] text-sm leading-relaxed mt-3 mb-4">
        &ldquo;{t.quote}&rdquo;
      </p>
      <div className="flex items-center gap-3" style={{ borderTop: "1px solid #EEF4FB", paddingTop: 14 }}>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: t.gradient }}
        >
          {t.initials}
        </div>
        <div>
          <p className="font-semibold text-[#1A2535] text-sm">{t.authorName}</p>
          <p className="text-xs text-[#52718F]">{t.authorRole}</p>
        </div>
      </div>
    </div>
  );
}

function MarqueeRow({ items, reverse }: { items: Testimonial[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div style={{ overflow: "hidden", WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)" }}>
      <div
        style={{
          display: "flex",
          width: "max-content",
          animation: `marquee${reverse ? "Rev" : ""} ${items.length * 5}s linear infinite`,
        }}
        onMouseEnter={e => (e.currentTarget.style.animationPlayState = "paused")}
        onMouseLeave={e => (e.currentTarget.style.animationPlayState = "running")}
      >
        {doubled.map((t, i) => (
          <TestimonialCard key={i} t={t} />
        ))}
      </div>
    </div>
  );
}

export default function Trust({ testimonials }: { testimonials: Testimonial[] }) {
  const half = Math.ceil(testimonials.length / 2);
  const row1 = testimonials.slice(0, half);
  const row2 = testimonials.slice(half);

  return (
    <section className="section" style={{ background: "#F0F5FB", overflow: "hidden" }}>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes marqueeRev {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
      `}</style>

      <div className="container">
        <div className="text-center mb-10">
          <p className="section-label justify-center">Müştəri rəyləri</p>
          <h2
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
          >
            Onlar bizə güvəndilər
          </h2>
          <p className="text-[#52718F] max-w-sm mx-auto text-sm leading-relaxed">
            Hər müştərimizin hekayəsi bizim üçün xüsusidir.
          </p>
        </div>
      </div>

      {testimonials.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 48 }}>
          <MarqueeRow items={row1.length ? row1 : testimonials} />
          {row2.length > 0 && <MarqueeRow items={row2} reverse />}
        </div>
      )}

      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {trustMetrics.map((m) => (
            <div key={m.label} className="bg-white rounded-2xl py-6 px-4 text-center flex flex-col items-center gap-2"
              style={{ boxShadow: "0 2px 12px rgba(26,37,53,0.06)", border: "1px solid #EEF4FB" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#EEF4FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {m.icon}
              </div>
              <p className="font-bold text-2xl text-[#1A2535]" style={{ fontFamily: "var(--font-playfair, serif)", lineHeight: 1 }}>
                {m.value}
              </p>
              <p className="text-xs text-[#52718F] font-medium">{m.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl px-6 py-5" style={{ boxShadow: "0 2px 12px rgba(26,37,53,0.06)", border: "1px solid #EEF4FB" }}>
          <div className="flex items-center gap-2 mb-4">
            <svg width="14" height="14" fill="none" stroke="#002147" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-xs font-bold text-[#002147] uppercase tracking-wider">
              Sertifikatlar & Akkreditasiyalar
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {certifications.map((c) => (
              <span key={c} className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-full"
                style={{ background: "linear-gradient(135deg, #EEF4FB, #F3EEFF)", color: "#002147", border: "1px solid #DDE8F5" }}>
                <svg width="11" height="11" fill="none" stroke="#002147" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round"/>
                  <path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
