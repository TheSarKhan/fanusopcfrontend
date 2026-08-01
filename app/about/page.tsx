"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollReveal } from "@/lib/useScrollReveal";
import { useT } from "@/lib/i18n/LocaleProvider";
import Breadcrumb from "@/components/Breadcrumb";
import type { MessageKey } from "@/lib/i18n/messages";

// Bütün dəyər kartları əsas brend rəngi (#1051B7) və tonlarında.
const VALUES = [
  {
    color: "var(--brand)",
    bg: "var(--brand-50)",
    titleKey: "aboutPage.v1Title" as MessageKey,
    descKey: "aboutPage.v1Desc" as MessageKey,
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
    titleKey: "aboutPage.v2Title" as MessageKey,
    descKey: "aboutPage.v2Desc" as MessageKey,
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
    titleKey: "aboutPage.v3Title" as MessageKey,
    descKey: "aboutPage.v3Desc" as MessageKey,
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    color: "var(--brand)",
    bg: "var(--brand-50)",
    titleKey: "aboutPage.v4Title" as MessageKey,
    descKey: "aboutPage.v4Desc" as MessageKey,
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function MissionSection() {
  const { t } = useT();
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
            <h2 style={{ color: "var(--brand)" }}>{t("aboutPage.missionTitle1")} <span className="fanus-serif-accent">{t("aboutPage.missionTitleAccent")}</span><br />{t("aboutPage.missionTitle2")}</h2>
            <p>{t("aboutPage.missionP1")}</p>
            <p>{t("aboutPage.missionP2")}</p>
          </div>

        </div>
      </div>
    </section>
  );
}

function ValuesSection() {
  const { t } = useT();
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
            {t("aboutPage.valuesTitle")} <span className="fanus-serif-accent">{t("aboutPage.valuesTitleAccent")}</span>
          </h2>
          <p style={{ fontSize: 17, color: "var(--oxford-60)", marginTop: 16, maxWidth: 520, margin: "16px auto 0" }}>
            {t("aboutPage.valuesLead")}
          </p>
        </div>

        <div className="ap-values-grid">
          {VALUES.map((v, i) => (
            <div
              key={v.titleKey}
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
              <h3>{t(v.titleKey)}</h3>
              <p>{t(v.descKey)}</p>
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
      <Breadcrumb items={[{ label: t("about.pageTitle") }]} />
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
                alt={t("aboutPage.heroImgAlt")}
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
