"use client";

import { useEffect, useRef, useState } from "react";
import type { Stat } from "@/lib/api";

function useCountUp(target: number, duration = 1800, start = false) {
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

function StatItem({ stat, started, delay }: { stat: Stat; started: boolean; delay: number }) {
  const [go, setGo] = useState(false);
  const count = useCountUp(stat.statValue, 1800, go);

  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setGo(true), delay);
    return () => clearTimeout(t);
  }, [started, delay]);

  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 24px",
        opacity: started ? 1 : 0,
        transform: started ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      <p style={{
        fontFamily: "var(--serif)",
        fontSize: "clamp(40px, 4.5vw, 56px)",
        fontWeight: 500,
        color: "var(--oxford)",
        lineHeight: 1,
        letterSpacing: "-0.025em",
        marginBottom: 10,
      }}>
        {go ? count : stat.statValue}
        <span style={{ fontSize: "55%", fontWeight: 400, color: "var(--oxford-40)" }}>
          {stat.suffix}
        </span>
      </p>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--oxford)", marginBottom: 4 }}>
        {stat.label}
      </p>
      <p style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>
        {stat.subLabel}
      </p>
    </div>
  );
}

export default function Stats({ stats }: { stats: Stat[] }) {
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

  if (!stats.length) return null;

  return (
    <section
      className="stats-section"
      ref={ref}
      style={{ background: "var(--bg-blue)", position: "relative", overflow: "hidden" }}
    >
      {/* Decorative blobs */}
      <div style={{
        position: "absolute", width: 400, height: 400, borderRadius: "50%",
        background: "rgba(74,155,127,0.07)", filter: "blur(80px)",
        top: -100, left: -80, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: 360, height: 360, borderRadius: "50%",
        background: "rgba(140,125,201,0.07)", filter: "blur(80px)",
        bottom: -80, right: -60, pointerEvents: "none",
      }} />

      <div className="container" style={{ position: "relative" }}>
        <p style={{
          textAlign: "center",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "var(--oxford-60)",
          marginBottom: 8,
        }}>
          Rəqəmlərlə Fanus
        </p>
        <p
          style={{
            textAlign: "center", fontSize: 15,
            color: "var(--oxford-60)", marginBottom: 48,
            opacity: started ? 1 : 0,
            transition: "opacity 0.6s ease",
          }}
        >
          Azərbaycanda mental sağlamlıq sahəsindəki nailiyyətlərimiz
        </p>

        <div
          className="stats-grid"
          style={{
            background: "white",
            borderRadius: "var(--r-xl)",
            border: "1px solid #DDE6F0",
            overflow: "hidden",
            boxShadow: "0 4px 24px rgba(0,33,71,0.05)",
          }}
        >
          {stats.map((s, i) => (
            <div key={s.id} className="stats-grid-item">
              <StatItem stat={s} started={started} delay={i * 100} />
            </div>
          ))}
        </div>

        {/* Trust line */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, marginTop: 32,
          opacity: started ? 1 : 0,
          transition: "opacity 0.6s ease 500ms",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--sage)", display: "inline-block",
          }} />
          <p style={{ fontSize: 13.5, color: "var(--oxford-60)" }}>
            <span style={{ color: "var(--oxford)", fontWeight: 600 }}>İş saatları:</span>
            {" "}B.ertəsi – Şənbə, 09:00–20:00 · Onlayn 7/24
          </p>
        </div>
      </div>
    </section>
  );
}
