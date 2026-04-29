"use client";

import Link from "next/link";
import { useScrollReveal } from "@/lib/useScrollReveal";

const STATS = [
  { value: "2000+", label: "Müştəriyə dəstək verdik" },
  { value: "15+",   label: "Sertifikatlı psixoloq" },
  { value: "4.9/5", label: "Orta müştəri reytinqi" },
  { value: "6 il",  label: "Sahədə təcrübə" },
];

const PILLARS = [
  { color: "var(--oxford)", bg: "var(--bg-blue)", label: "Klinik psixologiya" },
  { color: "#7C3AED", bg: "rgba(124,58,237,0.08)", label: "CBT & EMDR" },
  { color: "var(--sage)", bg: "var(--sage-soft)", label: "Ailə terapiyası" },
  { color: "var(--amber)", bg: "var(--amber-soft)", label: "Uşaq psixologiyası" },
  { color: "#1A6E5B", bg: "rgba(26,110,91,0.08)", label: "Travma terapiyası" },
  { color: "var(--rose)", bg: "var(--rose-soft)", label: "Böhran müdaxiləsi" },
];

const CERTS = ["APA üzvü", "CBT Sertifikatlı", "EMDR Akkreditasiyası", "Mindfulness", "ISO 27001"];

export default function HomeAbout() {
  const { ref: sectionRef, visible } = useScrollReveal<HTMLElement>(0.08);

  return (
    <section
      className="home-about-section"
      ref={sectionRef}
      style={{ background: "white", overflow: "hidden", position: "relative" }}
    >
      {/* Subtle background accent */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 600, height: 600,
        background: "radial-gradient(circle, var(--bg-blue) 0%, transparent 70%)",
        opacity: 0.5, pointerEvents: "none",
      }} />

      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <div className="home-about-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>

          {/* ── Left ── */}
          <div
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateX(0)" : "translateX(-28px)",
              transition: "opacity 0.7s ease, transform 0.7s ease",
            }}
          >
            <p style={{
              fontSize: 12, fontWeight: 700, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 16,
            }}>
              2019-cu ildən bəri
            </p>

            <h2 style={{
              fontFamily: "var(--serif)",
              fontSize: "clamp(32px, 3.8vw, 48px)",
              lineHeight: 1.12, letterSpacing: "-0.02em",
              color: "var(--oxford)", marginBottom: 20,
            }}>
              Azərbaycanda emosional{" "}
              <span style={{
                background: "linear-gradient(135deg, var(--sage) 0%, #7C3AED 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                sağlamlığın öncüsüyük
              </span>
            </h2>

            <p style={{
              fontSize: 16, lineHeight: 1.75,
              color: "var(--oxford-60)", marginBottom: 28, maxWidth: 480,
            }}>
              Fanus, psixoloji yardımı ən yüksək standartlarda, əlçatan və insani şəkildə
              göstərmək məqsədi ilə yaradılıb. Hər insan — dinlənilməyə,
              anlaşılmağa və dəstəklənməyə layiqdir.
            </p>

            {/* Expertise pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 36 }}>
              {PILLARS.map((p) => (
                <span
                  key={p.label}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "8px 14px",
                    background: p.bg,
                    borderRadius: 100,
                    fontSize: 13, fontWeight: 500,
                    color: "var(--oxford-80)",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                  {p.label}
                </span>
              ))}
            </div>

            <Link
              href="/about"
              className="btn btn-primary"
              style={{ borderRadius: "var(--r-btn)", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              Haqqımızda daha çox
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* ── Right: Stats + Certs ── */}
          <div
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateX(0)" : "translateX(28px)",
              transition: "opacity 0.7s ease 0.15s, transform 0.7s ease 0.15s",
            }}
          >
            <div className="home-about-stats-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {STATS.map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "var(--bg)",
                    border: "1px solid #DDE6F0",
                    borderRadius: "var(--r-lg)",
                    padding: "28px 24px",
                    transition: "all 0.4s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,33,71,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  }}
                >
                  <p style={{
                    fontFamily: "var(--serif)",
                    fontSize: 42, fontWeight: 500,
                    color: "var(--oxford)", lineHeight: 1,
                    letterSpacing: "-0.02em", marginBottom: 10,
                  }}>
                    {s.value}
                  </p>
                  <p style={{ fontSize: 13, color: "var(--oxford-60)", lineHeight: 1.4 }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Certifications */}
            <div style={{
              background: "var(--bg)",
              border: "1px solid #DDE6F0",
              borderRadius: "var(--r-lg)",
              padding: "20px 24px",
            }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
                textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 14,
              }}>
                Akkreditasiyalar
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CERTS.map((cert) => (
                  <span
                    key={cert}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "7px 14px",
                      background: "white",
                      border: "1px solid #DDE6F0",
                      borderRadius: 100,
                      fontSize: 12.5, fontWeight: 500,
                      color: "var(--oxford-80)",
                    }}
                  >
                    <svg width="10" height="10" fill="none" stroke="var(--sage)" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
