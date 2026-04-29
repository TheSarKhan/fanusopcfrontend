"use client";

import Link from "next/link";
import { useScrollReveal } from "@/lib/useScrollReveal";

const PILLARS = [
  {
    color: "sage",
    title: "Tam məxfilik",
    desc: "Bütün seanslar end-to-end şifrələnir. Məlumatlarınız Azərbaycan və AB qaydalarına uyğun saxlanılır.",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    color: "amber",
    title: "Sertifikatlı mütəxəssislər",
    desc: "Sənədli psixoloqlar, hər biri ən az 5 il təcrübəyə malik, davamlı superviziya ilə.",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" />
        <path d="M22 4 12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    color: "lilac",
    title: "Hər yerdən əlçatan",
    desc: "Evinizin rahatlığından çıxmadan video, səs və ya yazılı formatda seans.",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 21h8M12 17v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    color: "rose",
    title: "Fərdi yanaşma",
    desc: "Sizi anlamağa əsaslanan, sizə uyğunlaşdırılmış psixoloji dəstək planı.",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.2 6L12 18l-3.8-3C6.3 13.7 5 11.5 5 9a7 7 0 0 1 7-7z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    color: "sage",
    title: "Büdcəyə uyğun",
    desc: "Fərqli qiymət variantları və paket seçimləri ilə hər büdcəyə uyğun psixoloji dəstək.",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <line x1="12" y1="1" x2="12" y2="23" strokeLinecap="round" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    color: "amber",
    title: "Doğrulanmış mütəxəssislər",
    desc: "Bütün psixoloqlar ətraflı müsahibə, sənəd yoxlaması və qiymətləndirmədən keçir.",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function WhyFanus() {
  const { ref, visible } = useScrollReveal<HTMLElement>(0.1);

  return (
    <section ref={ref} className="why-fanus-section" style={{ background: "#ffffff" }}>
      <div className="container">

        {/* Section head */}
        <div
          style={{
            maxWidth: 760, margin: "0 auto 72px", textAlign: "center",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          <p className="label" style={{ display: "block", marginBottom: 16 }}>
            Niyə Fanus?
          </p>
          <h2 style={{
            fontFamily: "var(--serif)",
            fontSize: "clamp(36px, 4vw, 52px)",
            fontWeight: 500,
            color: "var(--oxford)",
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            marginBottom: 20,
          }}>
            Psixoloji dəstəkdə fərq yaradan 6 səbəb
          </h2>
          <p style={{ fontSize: 17, color: "var(--oxford-60)", maxWidth: 580, margin: "0 auto" }}>
            Hər detalı düşünülmüş, insana hörmətlə yanaşan bir platforma.
          </p>
        </div>

        {/* Features grid */}
        <div className="features-grid">
          {PILLARS.map((p, i) => (
            <div
              key={p.title}
              className={`feature-card feature-${p.color}`}
              style={{
                opacity: visible ? 1 : 0,
                transition: `opacity 0.5s ease ${i * 70}ms`,
              }}
            >
              <div className="feature-icon">
                {p.icon}
              </div>
              <div>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
              {/* Arrow appears on hover via CSS */}
              <div className="feature-arrow">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* CTA link */}
        <div
          style={{
            textAlign: "center", marginTop: 56,
            opacity: visible ? 1 : 0,
            transition: "opacity 0.6s ease 0.4s",
          }}
        >
          <Link
            href="/about"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: "0.9rem", fontWeight: 600, color: "var(--oxford)",
              textDecoration: "none",
              borderBottom: "1.5px solid var(--oxford-20)",
              paddingBottom: 2,
              transition: "border-color 0.2s",
            }}
          >
            Haqqımızda daha çox
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

      </div>
    </section>
  );
}
