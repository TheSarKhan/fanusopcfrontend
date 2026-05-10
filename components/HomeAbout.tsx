"use client";

import Link from "next/link";
import { useScrollReveal } from "@/lib/useScrollReveal";

const PILLARS = [
  { color: "var(--oxford)", bg: "var(--bg-blue)", label: "Klinik psixologiya" },
  { color: "#7C3AED", bg: "rgba(124,58,237,0.08)", label: "CBT & EMDR" },
  { color: "var(--sage)", bg: "var(--sage-soft)", label: "Ailə terapiyası" },
  { color: "var(--amber)", bg: "var(--amber-soft)", label: "Uşaq psixologiyası" },
  { color: "#1A6E5B", bg: "rgba(26,110,91,0.08)", label: "Travma terapiyası" },
  { color: "var(--rose)", bg: "var(--rose-soft)", label: "Akut dəstək" },
];

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
        <div
          style={{
            maxWidth: 760, margin: "0 auto", textAlign: "center",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          <p style={{
            fontSize: 12, fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 16,
          }}>
            Haqqımızda
          </p>

          <h2 style={{
            fontFamily: "var(--serif)",
            fontSize: "clamp(32px, 3.8vw, 48px)",
            lineHeight: 1.12, letterSpacing: "-0.02em",
            color: "var(--oxford)", marginBottom: 20,
          }}>
            Azərbaycanda{" "}
            <span style={{
              background: "linear-gradient(135deg, var(--sage) 0%, #7C3AED 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              onlayn psixoloji yardım
            </span>
          </h2>

          <p style={{
            fontSize: 16, lineHeight: 1.75,
            color: "var(--oxford-60)", marginBottom: 28, maxWidth: 560,
            margin: "0 auto 28px",
          }}>
            Fanus, peşəkar psixoloji yardımı əlçatan və insani şəkildə göstərmək üçün
            yaradılıb. Hər insan dinlənilməyə, anlaşılmağa və dəstəklənməyə layiqdir.
          </p>

          {/* Expertise pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 36, justifyContent: "center" }}>
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
      </div>
    </section>
  );
}
