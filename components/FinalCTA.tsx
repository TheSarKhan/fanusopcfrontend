"use client";

import { useBooking } from "@/context/BookingContext";

const signals = [
  {
    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    text: "100% məxfi",
  },
  {
    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" strokeLinecap="round"/></svg>,
    text: "24 saat ərzində cavab",
  },
  {
    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    text: "Sertifikatlı psixoloqlar",
  },
  {
    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round"/></svg>,
    text: "Öhdəlik tələb olunmur",
  },
];

export default function FinalCTA() {
  const { open } = useBooking();

  return (
    <section
      id="cta"
      style={{
        position: "relative",
        background: "linear-gradient(135deg, #1E3A6E 0%, #2A57B0 50%, #5A4FC8 100%)",
        overflow: "hidden",
        paddingTop: "5rem",
        paddingBottom: "5rem",
      }}
    >
      {/* White wave at top */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, lineHeight: 0, pointerEvents: "none" }}>
        <svg viewBox="0 0 1440 80" fill="none" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 70 }}>
          <path d="M0 0 L1440 0 L1440 40 Q1080 0 720 40 Q360 80 0 40 Z" fill="#ffffff" />
        </svg>
      </div>

      {/* Decorative blobs */}
      <div style={{ position: "absolute", top: "10%", left: "-8%", width: 340, height: 340, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "5%", right: "-6%", width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "40%", left: "30%", width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />

      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-2xl mx-auto text-center">

          {/* Label */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 999, padding: "6px 16px", marginBottom: 24,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ADE80", boxShadow: "0 0 8px #4ADE80" }} />
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "0.06em" }}>
              İndi 6 psixoloq onlayndır
            </span>
          </div>

          {/* Heading */}
          <h2
            className="text-3xl sm:text-4xl lg:text-[2.8rem] font-bold text-white leading-tight mb-5"
            style={{ fontFamily: "var(--font-playfair, serif)" }}
          >
            İlk addımı atmağa<br />
            <span style={{ color: "#A8CFFF" }}>hazırsınız?</span>
          </h2>

          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "1rem", lineHeight: 1.7, marginBottom: 36, maxWidth: 460, margin: "0 auto 36px" }}>
            Özünüzə qulluq etmək — ən güclü qərardır. Peşəkar dəstəklə həyatınızı daha yaxşı istiqamətə yönəldin.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <button
              onClick={() => open()}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#ffffff", color: "#1E3A6E",
                fontWeight: 700, fontSize: "0.95rem",
                padding: "14px 32px", borderRadius: 9999, border: "none",
                cursor: "pointer", transition: "all 0.2s",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 28px rgba(0,0,0,0.25)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.2)"; }}
            >
              <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round"/><line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Randevu al
            </button>
            <a
              href="#psychologists"
              style={{
                display: "flex", alignItems: "center", gap: 8,
                color: "rgba(255,255,255,0.88)", fontWeight: 600, fontSize: "0.95rem",
                padding: "14px 28px", borderRadius: 9999,
                border: "1.5px solid rgba(255,255,255,0.28)",
                textDecoration: "none", transition: "all 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round"/>
              </svg>
              Psixoloq seç
            </a>
          </div>

          {/* Trust signals */}
          <div style={{
            display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 20px",
            paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.12)",
          }}>
            {signals.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, color: "rgba(255,255,255,0.55)", fontSize: "0.82rem" }}>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>{s.icon}</span>
                {s.text}
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
