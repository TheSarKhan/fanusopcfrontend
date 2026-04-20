"use client";

import { useEffect, useRef, useState } from "react";
import { useBooking } from "@/context/BookingContext";

const STATS = [
  { value: 500,  suffix: "+", label: "Aktiv müştəri",         sub: "Platforma üzərindən"  },
  { value: 1200, suffix: "+", label: "Tamamlanmış seans",     sub: "Uğurla başa çatıb"    },
  { value: 98,   suffix: "%", label: "Müştəri məmnuniyyəti",  sub: "Ortalama reytinq"     },
  { value: 15,   suffix: "+", label: "Sertifikatlı psixoloq", sub: "Müxtəlif ixtisaslar"  },
];

function useCountUp(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [start, target, duration]);
  return count;
}

function StatItem({ value, suffix, label, sub, started, delay }: {
  value: number; suffix: string; label: string; sub: string;
  started: boolean; delay: number;
}) {
  const [go, setGo] = useState(false);
  const count = useCountUp(value, 2000, go);

  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setGo(true), delay);
    return () => clearTimeout(t);
  }, [started, delay]);

  return (
    <div style={{
      textAlign: "center", flex: 1,
      opacity: started ? 1 : 0,
      transform: started ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {/* Big number */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 2, marginBottom: 10 }}>
        <span style={{
          fontFamily: "var(--font-playfair, serif)",
          fontSize: "clamp(3rem, 6vw, 4rem)",
          fontWeight: 800, color: "#ffffff",
          lineHeight: 1, letterSpacing: "-0.03em",
        }}>
          {go ? count : value}
        </span>
        <span style={{
          fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
          fontWeight: 700, color: "rgba(255,255,255,0.5)",
          marginTop: "0.3em",
        }}>
          {suffix}
        </span>
      </div>

      {/* Animated underline */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <div style={{
          height: 2, borderRadius: 2,
          background: "rgba(255,255,255,0.9)",
          width: go ? 40 : 0,
          transition: "width 0.8s cubic-bezier(0.25,1,0.5,1)",
        }} />
      </div>

      <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.38)" }}>
        {sub}
      </p>
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
      {/* White wave at top */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, lineHeight: 0, zIndex: 1, pointerEvents: "none" }}>
        <svg viewBox="0 0 1440 80" fill="none" preserveAspectRatio="none"
          style={{ display: "block", width: "100%", height: 80 }}>
          <path d="M0 0 L1440 0 L1440 40 Q1080 0 720 40 Q360 80 0 40 Z" fill="#ffffff" />
        </svg>
      </div>

      <div className="container" style={{ position: "relative", zIndex: 2, paddingBottom: "3.5rem" }}>

        {/* Header */}
        <div className="text-center mb-14">
          <p style={{
            fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.5)",
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
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.93rem", maxWidth: 360, margin: "0 auto" }}>
            2019-cu ildən minlərlə insanın həyatına toxunduq
          </p>
        </div>

        {/* Stats row */}
        <div style={{
          display: "flex", flexWrap: "wrap",
          gap: "2rem 0",
          marginBottom: "3rem",
          position: "relative",
        }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{ flex: "1 1 50%", display: "flex", alignItems: "stretch" }}>
              {/* Vertical divider — right side except last in row */}
              {i % 2 === 0 && (
                <div style={{ flex: 1, display: "flex" }}>
                  <StatItem {...s} started={started} delay={i * 120} />
                  <div style={{ width: 1, background: "rgba(255,255,255,0.12)", margin: "8px 0", flexShrink: 0 }} />
                </div>
              )}
              {i % 2 !== 0 && (
                <div style={{ flex: 1 }}>
                  <StatItem {...s} started={started} delay={i * 120} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.13)",
          borderRadius: "1.25rem",
          padding: "16px 24px",
          opacity: started ? 1 : 0,
          transform: started ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.6s ease 600ms, transform 0.6s ease 600ms",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#4ADE80", display: "inline-block",
              boxShadow: "0 0 8px #4ADE80",
            }} />
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.88rem" }}>
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

      {/* Wave at bottom */}
      <div style={{ lineHeight: 0, position: "relative", zIndex: 2 }}>
        <svg viewBox="0 0 1440 80" fill="none" preserveAspectRatio="none"
          style={{ display: "block", width: "100%", height: 80 }}>
          <path d="M0 40 Q360 80 720 40 Q1080 0 1440 40 L1440 80 L0 80 Z" fill="#ffffff" />
        </svg>
      </div>
    </section>
  );
}
