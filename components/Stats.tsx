"use client";

import { useEffect, useRef, useState } from "react";
import { useBooking } from "@/context/BookingContext";

function useCountUp(target: number, duration = 2200, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return count;
}

const STATS = [
  { value: 500,  suffix: "+", label: "Aktiv müştəri",         sub: "Platforma üzərindən" },
  { value: 1200, suffix: "+", label: "Tamamlanmış seans",     sub: "Uğurla başa çatıb"  },
  { value: 98,   suffix: "%", label: "Müştəri məmnuniyyəti",  sub: "Ortalama reytinq"   },
  { value: 15,   suffix: "+", label: "Sertifikatlı psixoloq", sub: "Müxtəlif ixtisaslar" },
];

function StatNum({ value, suffix, label, sub, started, delay }: {
  value: number; suffix: string; label: string; sub: string; started: boolean; delay: number;
}) {
  const [go, setGo] = useState(false);
  const count = useCountUp(value, 2200, go);
  useEffect(() => {
    if (started) {
      const t = setTimeout(() => setGo(true), delay);
      return () => clearTimeout(t);
    }
  }, [started, delay]);

  return (
    <div style={{
      textAlign: "center",
      padding: "2rem 1rem",
      borderRadius: "1.25rem",
      background: "rgba(255,255,255,0.12)",
      border: "1px solid rgba(255,255,255,0.18)",
      backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2, marginBottom: 6 }}>
        <span style={{
          fontSize: "clamp(2.4rem, 5vw, 3.2rem)",
          fontWeight: 800, color: "#ffffff",
          fontFamily: "var(--font-playfair, serif)",
          letterSpacing: "-0.02em", lineHeight: 1,
        }}>{count}</span>
        <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>{suffix}</span>
      </div>
      <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "rgba(255,255,255,0.92)", marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>{sub}</p>
    </div>
  );
}

export default function Stats() {
  const { open } = useBooking();
  const ref = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        background: "linear-gradient(135deg, #2A57B0 0%, #5A4FC8 60%, #7B68D8 100%)",
        paddingTop: "7rem",
        paddingBottom: "0",
        overflow: "hidden",
      }}
    >
      {/* White wave at top — sits over the gradient, creates curved edge from About */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, lineHeight: 0, zIndex: 1, pointerEvents: "none" }}>
        <svg viewBox="0 0 1440 80" fill="none" preserveAspectRatio="none"
          style={{ display: "block", width: "100%", height: 80 }}>
          <path d="M0 0 L1440 0 L1440 40 Q1080 0 720 40 Q360 80 0 40 Z" fill="#ffffff" />
        </svg>
      </div>

      <div className="container" style={{ position: "relative", zIndex: 2, paddingBottom: "3.5rem" }}>

        {/* Header */}
        <div className="text-center mb-12">
          <p style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.55)",
            marginBottom: "1rem",
          }}>
            Rəqəmlərlə Fanus
          </p>
          <h2 style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            fontWeight: 700, color: "#ffffff",
            marginBottom: "0.75rem", lineHeight: 1.2,
          }}>
            Güvən rəqəmlərlə ölçülür
          </h2>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.93rem", maxWidth: 360, margin: "0 auto" }}>
            2019-cu ildən minlərlə insanın həyatına toxunduq
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {STATS.map((s, i) => (
            <StatNum key={s.label} {...s} started={started} delay={i * 130} />
          ))}
        </div>

        {/* CTA bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "1.25rem",
          padding: "16px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#4ADE80", display: "inline-block",
              boxShadow: "0 0 8px #4ADE80",
            }} />
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.88rem" }}>
              <span style={{ fontWeight: 600, color: "#fff" }}>İş saatları:</span>
              {"  "}B.ertəsi – Şənbə, 09:00 – 20:00 · Onlayn 7/24
            </p>
          </div>
          <button
            onClick={() => open()}
            style={{
              background: "#ffffff", color: "#2A57B0",
              border: "none", borderRadius: 9999,
              padding: "10px 24px", fontWeight: 700,
              fontSize: "0.9rem", cursor: "pointer",
            }}
          >
            Randevu al →
          </button>
        </div>

      </div>

      {/* Wave at bottom — transitions to next section (white) */}
      <div style={{ lineHeight: 0, position: "relative", zIndex: 2 }}>
        <svg viewBox="0 0 1440 80" fill="none" preserveAspectRatio="none"
          style={{ display: "block", width: "100%", height: 80 }}>
          <path d="M0 40 Q360 80 720 40 Q1080 0 1440 40 L1440 80 L0 80 Z" fill="#ffffff" />
        </svg>
      </div>

    </section>
  );
}
