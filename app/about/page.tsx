"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollReveal } from "@/lib/useScrollReveal";
import { useT } from "@/lib/i18n/LocaleProvider";

// Bütün dəyər kartları əsas brend rəngi (#1051B7) və tonlarında.
const VALUES = [
  {
    color: "var(--brand)",
    bg: "var(--brand-50)",
    title: "Məxfilik",
    desc: "Hər söhbət şifrələnir, hər məlumat sizə aiddir. Etibar — fundamentdir.",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    color: "var(--brand)",
    bg: "var(--brand-50)",
    title: "İnsan mərkəzlilik",
    desc: "Standart deyil, sizin hekayəniz. Tempinizi, dilinizi, sınırlarınızı qoruyuruq.",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    color: "var(--brand)",
    bg: "var(--brand-50)",
    title: "Peşəkarlıq",
    desc: "Sübutla əsaslanan metodlar, davamlı supervizor dəstəyi və beynəlxalq standartlar.",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    color: "var(--brand)",
    bg: "var(--brand-50)",
    title: "Empati",
    desc: "Mühakimə yox, yalnız anlayış. Bəzən ən mühüm söz — \"sizi eşidirəm\".",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function MissionSection() {
  const { ref, visible } = useScrollReveal<HTMLElement>(0.1);

  return (
    <section ref={ref} className="ap-mission">
      <div className="container">
        <div
          className="ap-mission-grid"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(28px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          <div>
            <h2 style={{ color: "var(--brand)" }}>Hər insan <span className="fanus-serif-accent">sağlam,</span><br />xoşbəxt olmağa layiqdir</h2>
            <p>
              Fanus 2019-cu ildə Azərbaycanda psixoloji yardımı ən yüksək standartlarda
              əlçatan etmək məqsədi ilə yaradıldı. "Fanus" — qaranlıqda yol göstərən işıq
              deməkdir. Biz hər insanın öz daxili işığına qovuşmasına dəstək olmağı özümüzə
              missiya bilmişik.
            </p>
            <p>
              Terapiya yalnız "problem olanlar üçün" deyil — özünü daha yaxşı tanımaq,
              emosional güc toplamaq və daha dolu bir həyat qurmaq istəyən hər kəs üçündür.
              Heç bir tələsmə, heç bir mühakimə — sadəcə sizin tempinizdə.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}

function ValuesSection() {
  const { ref, visible } = useScrollReveal<HTMLElement>(0.1);

  return (
    <section ref={ref} className="ap-values">
      <div className="container">
        <div style={{
          maxWidth: 760, margin: "0 auto 72px", textAlign: "center",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(24px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}>
          <h2 style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif", fontSize: "clamp(32px, 3.6vw, 48px)", fontWeight: 700, color: "var(--brand)", lineHeight: 1.15, letterSpacing: "-0.025em" }}>
            Bizi fərqli edən <span className="fanus-serif-accent">dəyərlər</span>
          </h2>
          <p style={{ fontSize: 17, color: "var(--oxford-60)", marginTop: 16, maxWidth: 520, margin: "16px auto 0" }}>
            Hər seansın arxasında, hər söhbətdə, hər qərarda bunlar dayanır.
          </p>
        </div>

        <div className="ap-values-grid">
          {VALUES.map((v, i) => (
            <div
              key={v.title}
              className="ap-value-card"
              style={{
                background: v.bg,
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.6s ease ${i * 80}ms, transform 0.6s ease ${i * 80}ms`,
              }}
            >
              <div className="ap-value-icon" style={{ color: v.color }}>
                {v.icon}
              </div>
              <h3>{v.title}</h3>
              <p>{v.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  const { t } = useT();
  return (
    <div className="fanus-root">
      {/* Hero */}
      <section className="ap-hero abt-hero">
        <div className="ap-hero-blob ap-hero-blob-1" />
        <div className="ap-hero-blob ap-hero-blob-2" />
        <div className="container ap-hero-inner">
          <div className="abt-hero-grid">
            <div className="abt-hero-copy">
              <h1 className="ap-hero-title" style={{ color: "var(--brand)" }}>
                {t("about.pageTitle")}
              </h1>
              <p className="ap-hero-sub">{t("home.heroSub")}</p>
            </div>

            <div className="abt-hero-visual" aria-hidden>
              <div className="abt-hero-glow abt-hero-glow-1" />
              <div className="abt-hero-glow abt-hero-glow-2" />
              { }
              <img
                src="/images/hero-haqqimizda.png"
                alt="Fanus haqqında — psixoloji mərkəz"
                className="abt-hero-img"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </section>

      <MissionSection />
      <ValuesSection />
    </div>
  );
}
