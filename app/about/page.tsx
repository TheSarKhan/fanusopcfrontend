"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollReveal } from "@/lib/useScrollReveal";

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

const TIMELINE = [
  { year: "2019", text: "Fanus quruldu. İlk 3 psixoloq Bakıda kiçik bir kabinetdən başladı." },
  { year: "2020", text: "İlk 100 müştəri. Pandemiya boyu pulsuz dəstək xətti açıldı." },
  { year: "2021", text: "Onlayn seanslar başladı. Platforma istənilən şəhərdən əlçatan oldu." },
  { year: "2022", text: "10 mütəxəssisə qədər böyüdük. Cütlük və ailə terapiyası əlavə edildi." },
  { year: "2023", text: "1000+ tamamlanmış seans. APA və ISO 27001 sertifikatları alındı." },
  { year: "2024", text: "EMDR, uşaq terapiyası və qrup formatları platformaya əlavə olundu." },
];

const TEAM = [
  {
    name: "Dr. Leyla Əliyeva",
    role: "Klinik psixoloq, Qurucusu",
    initials: "LƏ",
    gradient: "linear-gradient(135deg, var(--brand-700) 0%, var(--brand) 100%)",
    bio: "12 il təcrübə. Travma, narahatlıq pozğunluqları və CBT üzrə ixtisaslaşma. Fanus-un baş ideyaçısı.",
  },
  {
    name: "Nigar Hüseynova",
    role: "Ailə terapisti",
    initials: "NH",
    gradient: "linear-gradient(135deg, var(--brand) 0%, var(--brand-400) 100%)",
    bio: "Münasibətlər, valideynlik və ailə dinamikası üzrə sertifikatlı mütəxəssis. Bonn Universiteti.",
  },
  {
    name: "Rauf Məmmədov",
    role: "CBT mütəxəssisi",
    initials: "RM",
    gradient: "linear-gradient(135deg, var(--brand-600) 0%, var(--brand-300) 100%)",
    bio: "9 il təcrübə. Depressiya, panik atak və yuxu pozğunluqları üzrə sübutla əsaslanan terapiya.",
  },
];

const CERTS = ["APA üzvü", "CBT Sertifikatlı", "EMDR Akkreditasiyası", "Mindfulness", "ISO 27001", "GDPR uyğun"];

const STATS = [
  { value: "6+", label: "il təcrübə" },
  { value: "2000+", label: "məmnun müştəri" },
  { value: "15+", label: "mütəxəssis" },
  { value: "8+", label: "seans növü" },
];

function TimelineSection() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [lineProgress, setLineProgress] = useState(0);

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let frame: number;
    let start: number | null = null;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      setLineProgress(p);
      if (p < 1) frame = requestAnimationFrame(animate);
    };
    const t = setTimeout(() => { frame = requestAnimationFrame(animate); }, 300);
    return () => { clearTimeout(t); cancelAnimationFrame(frame); };
  }, [visible]);

  return (
    <section className="ap-journey">
      <div className="container">
        <div style={{ maxWidth: 760, margin: "0 auto 72px", textAlign: "center" }}>
          <div className="fanus-eyebrow" style={{ marginBottom: 16, justifyContent: "center" }}><span className="dash" /> Yolumuz</div>
          <h2 className="ap-hero-title" style={{ fontSize: "clamp(32px, 3.6vw, 48px)", margin: "0 0 16px", textAlign: "center", color: "var(--brand)" }}>
            Bir niyyətdən bir <span className="fanus-serif-accent">mərkəzə</span>
          </h2>
          <p style={{ fontSize: 17, color: "var(--oxford-60)", maxWidth: 520, margin: "0 auto" }}>
            Fanus-un böyüməsi sayılarla deyil, hekayələrlə ölçülür.
          </p>
        </div>

        <div ref={timelineRef} className="ap-timeline">
          {/* Animated spine */}
          <div className="ap-timeline-line">
            <div style={{
              height: `${lineProgress * 100}%`,
              background: "linear-gradient(180deg, var(--brand-700) 0%, var(--brand) 50%, var(--brand-300) 100%)",
              transition: "none",
            }} />
          </div>

          {TIMELINE.map((t, i) => (
            <div
              key={t.year}
              className={`ap-tl-item ${i % 2 === 0 ? "left" : "right"}`}
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.6s ease ${i * 0.1}s, transform 0.6s ease ${i * 0.1}s`,
              }}
            >
              <div className="ap-tl-node" />
              <div className="ap-tl-card">
                <div className="ap-tl-year">{t.year}</div>
                <div className="ap-tl-text">{t.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
            <div className="fanus-eyebrow" style={{ marginBottom: 12 }}><span className="dash" /> Missiyamız</div>
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

          <div className="ap-mission-stats">
            {STATS.map((s) => (
              <div key={s.label} className="ap-stat">
                <div className="ap-stat-value">{s.value}</div>
                <div className="ap-stat-label">{s.label}</div>
              </div>
            ))}
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
          <div className="fanus-eyebrow" style={{ marginBottom: 16, justifyContent: "center" }}><span className="dash" /> Dəyərlərimiz</div>
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

function TeamSection() {
  const { ref, visible } = useScrollReveal<HTMLElement>(0.1);

  return (
    <section ref={ref} className="ap-team">
      <div className="container">
        <div style={{
          maxWidth: 760, margin: "0 auto 72px", textAlign: "center",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(24px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}>
          <div className="fanus-eyebrow" style={{ marginBottom: 16, justifyContent: "center" }}><span className="dash" /> Komanda</div>
          <h2 style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif", fontSize: "clamp(32px, 3.6vw, 48px)", fontWeight: 700, color: "var(--brand)", lineHeight: 1.15, letterSpacing: "-0.025em" }}>
            Sizə dəstək olan <span className="fanus-serif-accent">mütəxəssislər</span>
          </h2>
          <p style={{ fontSize: 17, color: "var(--oxford-60)", marginTop: 16, maxWidth: 520, margin: "16px auto 0" }}>
            Hər biri ən az 5 il klinik təcrübəyə və beynəlxalq sertifikata malikdir.
          </p>
        </div>

        <div className="ap-team-grid" style={{ maxWidth: 960, margin: "0 auto" }}>
          {TEAM.map((m, i) => (
            <div
              key={m.name}
              className="ap-team-card"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(28px)",
                transition: `opacity 0.65s ease ${i * 100}ms, transform 0.65s ease ${i * 100}ms`,
              }}
            >
              <div className="ap-team-avatar" style={{ background: m.gradient }}>
                {m.initials}
              </div>
              <h3>{m.name}</h3>
              <div className="ap-team-role">{m.role}</div>
              <p>{m.bio}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustBand() {
  const { ref, visible } = useScrollReveal<HTMLElement>(0.2);

  return (
    <section ref={ref} className="ap-trust">
      <div className="container">
        <div className="ap-trust-label">Sertifikat və üzvlüklər</div>
        <div
          className="ap-trust-pills"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          {CERTS.map((c) => (
            <div key={c} className="ap-trust-pill">
              <svg width="14" height="14" fill="none" stroke="var(--brand)" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" />
                <path d="M22 4 12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {c}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="fanus-root">
      {/* Hero */}
      <section className="ap-hero abt-hero">
        <div className="ap-hero-blob ap-hero-blob-1" />
        <div className="ap-hero-blob ap-hero-blob-2" />
        <div className="container ap-hero-inner">
          <div className="abt-hero-grid">
            <div className="abt-hero-copy">
              <div className="fanus-eyebrow"><span className="dash" /> Fanus Psixologiya Mərkəzi</div>
              <h1 className="ap-hero-title" style={{ color: "var(--brand)" }}>
                İnsana <span className="fanus-serif-accent">inanan</span><br />bir mərkəz.
              </h1>
              <p className="ap-hero-sub">
                2019-cu ildən Azərbaycanda emosional sağlamlığı daha əlçatan,
                daha insani etmək üçün çalışırıq.
              </p>
            </div>

            <div className="abt-hero-visual" aria-hidden>
              <div className="abt-hero-glow abt-hero-glow-1" />
              <div className="abt-hero-glow abt-hero-glow-2" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
      <TimelineSection />
      <TeamSection />
      <TrustBand />
    </div>
  );
}
