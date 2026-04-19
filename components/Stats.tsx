"use client";

import { useEffect, useRef, useState } from "react";
import { useBooking } from "@/context/BookingContext";

function useCountUp(target: number, duration = 2000, start = false) {
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

const stats = [
  {
    value: 500,
    suffix: "+",
    label: "Aktiv müştəri",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: 1200,
    suffix: "+",
    label: "Tamamlanmış seans",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: 15,
    suffix: "+",
    label: "Sertifikatlı psixoloq",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: 5,
    suffix: " il",
    label: "Fəaliyyət dövrü",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" strokeLinecap="round" />
      </svg>
    ),
  },
];

function StatCard({
  value, suffix, label, icon, started, delay,
}: {
  value: number; suffix: string; label: string; icon: React.ReactNode; started: boolean; delay: number;
}) {
  const [go, setGo] = useState(false);
  const count = useCountUp(value, 2000, go);

  useEffect(() => {
    if (started) {
      const t = setTimeout(() => setGo(true), delay);
      return () => clearTimeout(t);
    }
  }, [started, delay]);

  return (
    <div
      className="bg-white rounded-2xl p-6 flex flex-col gap-4"
      style={{ boxShadow: "0 2px 12px rgba(26,37,53,0.07)" }}
    >
      {/* Icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-[#3B6FA5] flex-shrink-0"
        style={{ background: "#EEF4FB" }}
      >
        {icon}
      </div>

      {/* Number */}
      <div className="flex items-baseline gap-0.5">
        <span
          className="font-bold leading-none"
          style={{
            fontSize: "2.625rem",
            color: "#1A2535",
            fontFamily: "var(--font-playfair, serif)",
            letterSpacing: "-0.02em",
          }}
        >
          {count}
        </span>
        <span className="font-bold text-[#3B6FA5] text-xl ml-0.5">{suffix}</span>
      </div>

      {/* Label */}
      <p className="text-sm text-[#6B85A0] font-medium leading-snug">{label}</p>
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
    <section ref={ref} className="section" style={{ background: "#F0F5FB" }}>
      <div className="container">
        <div className="text-center mb-10">
          <p className="section-label justify-center">Rəqəmlərlə Fanus</p>
          <h2
            className="text-3xl sm:text-4xl font-bold"
            style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
          >
            Güvən rəqəmlərlə ölçülür
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <StatCard key={s.label} {...s} started={started} delay={i * 120} />
          ))}
        </div>

        {/* Working hours bar */}
        <div
          className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl px-6 py-4"
          style={{ boxShadow: "0 2px 12px rgba(26,37,53,0.07)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-sm text-[#1A2535]">
              <span className="font-semibold">İş saatları:</span>
              <span className="text-[#6B85A0] ml-2">B.ertəsi – Şənbə, 09:00 – 20:00</span>
            </p>
          </div>
          <div className="hidden sm:block w-px h-4 bg-[#D5E3F0]" />
          <p className="text-sm text-[#6B85A0]">Onlayn seanslar həftənin 7 günü mövcuddur</p>
          <button onClick={() => open()} className="btn-primary py-2.5 px-5 text-sm">
            Randevu al →
          </button>
        </div>
      </div>
    </section>
  );
}
