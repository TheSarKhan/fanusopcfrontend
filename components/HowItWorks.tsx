"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useScrollReveal } from "@/lib/useScrollReveal";

const STEPS = [
  {
    num: "01",
    color: "#002147",
    accentBg: "#EBF2FF",
    title: "Psixoloqunu seç",
    text: "Sertifikatlı mütəxəssislər arasından ixtisasına, yanaşmasına və rəylərinə görə sizə uyğun psixoloqu seçin.",
    badge: "Uyğun eşləşmə",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    num: "02",
    color: "#4A9B7F",
    accentBg: "#EDFAF4",
    title: "Pulsuz tanışlıq seansı",
    text: "Seçdiyiniz psixoloqula 15 dəqiqəlik pulsuz konsultasiya keçirin. Uyğunluğu yoxlayın, suallarınızı soruşun.",
    badge: "Pulsuz · 15 dəqiqə",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    num: "03",
    color: "#E8901A",
    accentBg: "#FFF4E6",
    title: "Şəxsi dəstəyinizi alın",
    text: "Sizə xas terapiya planı ilə emosional sağlamlığınıza doğru addım atın. Video, səs və ya yazılı formatda.",
    badge: "Onlayn · 7/24",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const { ref, visible } = useScrollReveal<HTMLElement>(0.1);

  return (
    <section ref={ref} className="hiw-section" style={{ background: "#F4F7FB" }}>
      <div className="container">

        {/* Header */}
        <div
          className="text-center mb-14 max-w-xl mx-auto"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          <p style={{
            fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "#6B7280", marginBottom: "0.75rem",
          }}>
            Necə işləyir?
          </p>
          <h2 style={{
            fontSize: "clamp(1.9rem, 3.5vw, 2.6rem)",
            fontWeight: 700, color: "#1A2535",
            lineHeight: 1.25, marginBottom: "1rem",
          }}>
            3 addımda psixoloji dəstəyə başla
          </h2>
          <p style={{ color: "#52718F", fontSize: "0.97rem", lineHeight: 1.7 }}>
            Qeydiyyatdan seansa qədər — sadə, sürətli, tam məxfi.
          </p>
        </div>

        {/* Steps with arrow connectors */}
        <div className="flex flex-col md:flex-row items-stretch mb-10" style={{ gap: 0 }}>
          {STEPS.map((step, i) => (
            <Fragment key={step.num}>
              {/* Step card */}
              <div
                style={{
                  flex: 1,
                  background: "#fff",
                  borderRadius: 14,
                  padding: "2rem",
                  border: "1px solid #EDF2F7",
                  boxShadow: "0 1px 3px rgba(0,33,71,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(28px)",
                  transition: `opacity 0.55s ease ${i * 130}ms, transform 0.55s ease ${i * 130}ms`,
                }}
              >
                {/* Top row: icon + number */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: step.accentBg,
                    color: step.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {step.icon}
                  </div>
                  <span style={{
                    fontSize: "2.5rem", fontWeight: 800, lineHeight: 1,
                    color: "#EDF2F7",
                    userSelect: "none",
                  }}>
                    {step.num}
                  </span>
                </div>

                {/* Badge */}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: "0.72rem", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  color: step.color,
                  background: step.accentBg,
                  borderRadius: 999,
                  padding: "4px 10px",
                  width: "fit-content",
                }}>
                  {step.badge}
                </span>

                {/* Text */}
                <div>
                  <h3 style={{
                    fontSize: "1rem", fontWeight: 700,
                    color: "#1A2535", marginBottom: "0.5rem",
                  }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: "0.875rem", color: "#52718F", lineHeight: 1.7, margin: 0 }}>
                    {step.text}
                  </p>
                </div>
              </div>

              {/* Connector arrow between steps */}
              {i < STEPS.length - 1 && (
                <div
                  className="hidden md:flex"
                  style={{
                    width: 52, flexShrink: 0,
                    alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: 6,
                    opacity: visible ? 1 : 0,
                    transition: `opacity 0.5s ease ${i * 130 + 180}ms`,
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="#C0D2E6" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: "0.6rem", color: "#B0C4D8", fontWeight: 600, letterSpacing: "0.05em" }}>sonra</span>
                </div>
              )}

              {/* Mobile vertical connector */}
              {i < STEPS.length - 1 && (
                <div
                  className="flex md:hidden"
                  style={{
                    justifyContent: "center", padding: "8px 0",
                    opacity: visible ? 1 : 0,
                    transition: `opacity 0.5s ease ${i * 130 + 180}ms`,
                  }}
                >
                  <svg width="16" height="24" fill="none" stroke="#C0D2E6" strokeWidth="2" viewBox="0 0 16 24">
                    <path d="M8 0v18M2 12l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </Fragment>
          ))}
        </div>

        {/* CTA */}
        <div style={{
          textAlign: "center",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease 480ms, transform 0.5s ease 480ms",
        }}>
          <Link
            href="/register"
            className="btn btn-primary"
            style={{ fontSize: "0.95rem", padding: "14px 32px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            Qeydiyyatdan keç — pulsuz başla
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <p style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#8AACCA" }}>
            İlk tanışlıq seansı ödənişsiz · Kredit kartı tələb olunmur
          </p>
        </div>

      </div>
    </section>
  );
}
