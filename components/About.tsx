"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const JOURNEY = [
  {
    num: "01",
    phase: "İlk addım",
    title: "Psixoloqunuzla tanış olun",
    quote: "Kömək istəmək — cəsarətin ən böyük formasıdır.",
    color: "#002147",
    bg: "#EBF2FF",
    border: "rgba(59,111,165,0.15)",
    icon: (
      <img src="/images/logos/logo-blue.png" alt="Fanus" style={{ width: 26, height: 26, objectFit: "contain" }} />
    ),
  },
  {
    num: "02",
    phase: "Fərkinə varma",
    title: "Özünüzü kəşf edin",
    quote: "Niyə belə hiss etdiyimi anlamağa başladım — bu hər şeyi dəyişdi.",
    color: "#7C3AED",
    bg: "#F3EEFF",
    border: "rgba(124,58,237,0.15)",
    icon: (
      <svg width="26" height="26" fill="none" stroke="#7C3AED" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.2 6L12 18l-3.8-3C6.3 13.7 5 11.5 5 9a7 7 0 0 1 7-7z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    num: "03",
    phase: "Dəyişim",
    title: "Addım-addım irəliləyin",
    quote: "Kiçik dəyişikliklər böyük azadlığın başlanğıcıdır.",
    color: "#0D9488",
    bg: "#EFFAF8",
    border: "rgba(13,148,136,0.15)",
    icon: (
      <svg width="26" height="26" fill="none" stroke="#0D9488" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M12 22V12M12 12C12 7 17 4 17 4S14 9 12 12zM12 12C12 7 7 4 7 4S10 9 12 12z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 20c2-2 4-3 7-3s5 1 7 3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    num: "04",
    phase: "Azadlıq",
    title: "Özünüzü yenidən tapın",
    quote: "İndi özümü daha güclü, daha azad, daha tam hiss edirəm.",
    color: "#D97706",
    bg: "#FFF8EE",
    border: "rgba(217,119,6,0.15)",
    icon: (
      <svg width="26" height="26" fill="none" stroke="#D97706" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M12 3L9.5 8.5 3 9.27l4.5 4.38L6.36 20 12 17.27 17.64 20 16.5 13.65 21 9.27l-6.5-.77L12 3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];


function TiltCard({ item, visible, delay }: { item: typeof JOURNEY[0]; visible: boolean; delay: number }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale(1.02)`;
    el.style.boxShadow = `${-x * 12}px ${-y * 12}px 32px ${item.color}22`;
  }, [item.color]);

  const onMouseLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "perspective(600px) rotateY(0deg) rotateX(0deg) scale(1)";
    el.style.boxShadow = "none";
  }, []);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(36px)",
        transition: `opacity 0.65s ease ${delay}s, transform 0.65s ease ${delay}s`,
      }}
    >
      {/* Circle node — desktop only */}
      <div className="hidden lg:flex justify-center mb-5">
        <div style={{ position: "relative", display: "inline-flex" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: item.bg, border: `2px solid ${item.color}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 16px ${item.color}28`,
          }}>
            {item.icon}
          </div>
          <span style={{
            position: "absolute", top: -6, right: -8,
            background: item.color, color: "white",
            borderRadius: 6, padding: "2px 6px",
            fontSize: 9, fontWeight: 800, letterSpacing: "0.04em",
          }}>{item.num}</span>
        </div>
      </div>

      {/* Card */}
      <div
        ref={cardRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          background: item.bg, borderRadius: "1.25rem", padding: "20px",
          border: `1px solid ${item.border}`,
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
          willChange: "transform",
        }}
      >
        {/* Circle inside card — mobile/tablet only */}
        <div className="flex items-center gap-3 mb-4 lg:hidden">
          <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", background: "white",
              border: `2px solid ${item.color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 12px ${item.color}22`,
            }}>
              {item.icon}
            </div>
            <span style={{
              position: "absolute", top: -5, right: -7,
              background: item.color, color: "white",
              borderRadius: 5, padding: "1px 5px", fontSize: 8, fontWeight: 800,
            }}>{item.num}</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, color: item.color, textTransform: "uppercase", letterSpacing: "0.1em" }}>{item.phase}</span>
        </div>

        <span className="hidden lg:block" style={{
          fontSize: 10, fontWeight: 800, color: item.color,
          textTransform: "uppercase", letterSpacing: "0.1em",
          marginBottom: 8, display: "block",
        }}>{item.phase}</span>

        <h3 style={{ fontSize: "0.97rem", fontWeight: 700, color: "#0F1C2E", marginBottom: 10, fontFamily: "var(--font-playfair, serif)" }}>{item.title}</h3>
        <p style={{ fontSize: "0.82rem", color: "#5A7490", lineHeight: 1.65, fontStyle: "italic" }}>"{item.quote}"</p>
      </div>
    </div>
  );
}

export default function About() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [lineProgress, setLineProgress] = useState(0);

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Animate line when visible
  useEffect(() => {
    if (!visible) return;
    let frame: number;
    let start: number | null = null;
    const duration = 1200;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setLineProgress(p);
      if (p < 1) frame = requestAnimationFrame(animate);
    };
    const delay = setTimeout(() => { frame = requestAnimationFrame(animate); }, 300);
    return () => { clearTimeout(delay); cancelAnimationFrame(frame); };
  }, [visible]);

  return (
    <section id="about" className="section" style={{ background: "#ffffff" }}>
      <div className="container">

        {/* Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <p className="section-label">Haqqımızda</p>
          <h2
            className="text-3xl sm:text-[2.4rem] font-bold leading-tight mb-5"
            style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
          >
            Fanus — işığı olan bir yer
          </h2>
          <p className="text-[#52718F] leading-relaxed text-[0.97rem]">
            2019-cu ildən insanlara emosional sağlamlıq sahəsində peşəkar,
            məxfi və insan mərkəzli dəstək göstəririk. Hər yolculuq unikaldır —
            sizinki də belədir.
          </p>
        </div>

        {/* Journey Timeline */}
        <div ref={timelineRef} className="relative mb-20">

          {/* Animated connector line — desktop only */}
          <div className="hidden lg:block absolute" style={{ top: 28, left: "calc(12.5% + 28px)", right: "calc(12.5% + 28px)", height: 2, pointerEvents: "none", borderRadius: 2, overflow: "hidden", background: "#E5EDF5" }}>
            <div style={{
              height: "100%",
              width: `${lineProgress * 100}%`,
              background: "linear-gradient(90deg, #002147 0%, #7C3AED 33%, #0D9488 66%, #D97706 100%)",
              borderRadius: 2,
              transition: "none",
            }} />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {JOURNEY.map((item, i) => (
              <TiltCard key={item.num} item={item} visible={visible} delay={i * 0.14} />
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}
