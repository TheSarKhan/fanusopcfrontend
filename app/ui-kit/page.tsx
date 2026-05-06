"use client";

import { useState } from "react";

/* ---- Mood SVG icons (same as Hero) ---- */
function IconLeaf({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}
function IconMoon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function IconWave({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5s2.5 2 5 2 2.5-2 5-2" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2" />
    </svg>
  );
}
function IconSun({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
function IconSpark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/* ---- Section wrapper ---- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 72 }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 16,
          marginBottom: 32, paddingBottom: 16,
          borderBottom: "1px dashed var(--ink-15)",
        }}
      >
        <span
          style={{
            width: 6, height: 22, borderRadius: 4,
            background: "var(--ember)", display: "block", flexShrink: 0,
          }}
        />
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22, fontWeight: 400,
            color: "var(--ink)", letterSpacing: "-0.015em",
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/* ---- Color swatch ---- */
function Swatch({ name, value, dark }: { name: string; value: string; dark?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 100 }}>
      <div
        style={{
          width: "100%", height: 56,
          background: value,
          borderRadius: "var(--r-sm)",
          border: "1px solid rgba(0,33,71,0.08)",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)",
        }}
      />
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", letterSpacing: "0.02em" }}>
        {name}
      </div>
      <div style={{ fontSize: 10, color: "var(--ink-60)", fontFamily: "monospace" }}>
        {value}
      </div>
    </div>
  );
}

/* ---- Mood chip demo (interactive) ---- */
const MOODS = [
  { id: "yaxsi", label: "Yaxsıyam", Icon: IconLeaf },
  { id: "keceli", label: "Kədərliyəm", Icon: IconMoon },
  { id: "narahat", label: "Narahatam", Icon: IconWave },
  { id: "yorgun", label: "Yorğunam", Icon: IconSun },
  { id: "neytral", label: "Neytralam", Icon: IconSpark },
];

export default function UIKitPage() {
  const [activeMood, setActiveMood] = useState<string | null>("yaxsi");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--canvas)",
        paddingTop: 100,
        paddingBottom: 80,
      }}
    >
      {/* Lantern rails */}
      <div className="lantern-rail lantern-rail-l" aria-hidden />
      <div className="lantern-rail lantern-rail-r" aria-hidden />

      <div className="container" style={{ position: "relative" }}>

        {/* Header */}
        <div style={{ marginBottom: 72, paddingBottom: 40, borderBottom: "1px solid var(--ink-10)" }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>UI Kit — Sandbox</div>
          <h1
            className="display"
            style={{ fontSize: "clamp(40px, 5vw, 68px)", marginBottom: 18 }}
          >
            Fanus <em>Dizayn Sistemi</em>
          </h1>
          <p className="lede" style={{ maxWidth: 560, marginBottom: 28 }}>
            Rəng paleti, tipografiya, komponentlər və imza motiflərin tam baxışı.
            Bəyəndiyinizi bildirin — davam edək.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 16px",
                background: "var(--ember-mist)", borderRadius: "var(--r-pill)",
                border: "1px solid var(--ember-soft)",
                fontSize: 13, color: "var(--ember-deep)", fontWeight: 500,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ember)", display: "block", boxShadow: "0 0 6px var(--ember)" }} />
              v2 — Fənər Motifi
            </div>
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 16px",
                background: "var(--paper)", borderRadius: "var(--r-pill)",
                border: "1px solid var(--ink-10)",
                fontSize: 13, color: "var(--ink-60)", fontWeight: 500,
              }}
            >
              Fraunces + Inter
            </div>
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 16px",
                background: "var(--paper)", borderRadius: "var(--r-pill)",
                border: "1px solid var(--ink-10)",
                fontSize: 13, color: "var(--ink-60)", fontWeight: 500,
              }}
            >
              Oxford Blue + Ember Gold
            </div>
          </div>
        </div>

        {/* ===== COLORS ===== */}
        <Section title="Rəng Paleti">

          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 16 }}>
              Dominant — Ink (Oxford Blue)
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Swatch name="ink" value="#002147" />
              <Swatch name="ink-90" value="#14315a" />
              <Swatch name="ink-80" value="#2c4769" />
              <Swatch name="ink-70" value="#475c79" />
              <Swatch name="ink-60" value="#62748b" />
              <Swatch name="ink-50" value="#7d8da0" />
              <Swatch name="ink-40" value="#99a5b5" />
              <Swatch name="ink-30" value="#b6becb" />
              <Swatch name="ink-20" value="#d2d8e0" />
              <Swatch name="ink-15" value="#dfe3ea" />
              <Swatch name="ink-10" value="#ebeef3" />
              <Swatch name="ink-05" value="#f6f7fa" />
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 16 }}>
              Canvas — İsti Krem
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Swatch name="canvas" value="#FBF7EE" />
              <Swatch name="canvas-2" value="#F7F2E6" />
              <Swatch name="canvas-3" value="#F2EBDA" />
              <Swatch name="paper" value="#FFFFFF" />
            </div>
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 16 }}>
              Ember — Fənər Işığı (accent, az istifadə)
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Swatch name="ember" value="#C8923B" />
              <Swatch name="ember-90" value="#B07F2E" />
              <Swatch name="ember-deep" value="#8C6520" />
              <Swatch name="ember-soft" value="#F4E4BF" />
              <Swatch name="ember-mist" value="#FBF1D8" />
            </div>
          </div>
        </Section>

        {/* ===== TYPOGRAPHY ===== */}
        <Section title="Tipografiya">

          <div style={{ marginBottom: 40 }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 20 }}>
              Fraunces — Display / Başlıqlar
            </p>
            <div
              style={{
                background: "var(--paper)", borderRadius: "var(--r-lg)",
                border: "1px solid var(--ink-10)", padding: 32,
              }}
            >
              <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px,5vw,72px)", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.028em", lineHeight: 1.04, fontVariationSettings: '"SOFT" 80, "opsz" 144', marginBottom: 16 }}>
                Psixoloji <em style={{ fontStyle: "italic", color: "var(--ember-deep)", fontVariationSettings: '"SOFT" 100, "opsz" 144' }}>dəstək</em>
              </p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.1, fontVariationSettings: '"SOFT" 80, "opsz" 72', marginBottom: 14 }}>
                H2 — Başlıq ikinci
              </p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.015em", lineHeight: 1.2, marginBottom: 14 }}>
                H3 — Başlıq üçüncü
              </p>
              <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18, color: "var(--ember-deep)", fontVariationSettings: '"SOFT" 100, "opsz" 24' }}>
                Fraunces italic — serif imza tərzi
              </p>
            </div>
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 20 }}>
              Inter — Gövdə / UI
            </p>
            <div
              style={{
                background: "var(--paper)", borderRadius: "var(--r-lg)",
                border: "1px solid var(--ink-10)", padding: 32,
                display: "flex", flexDirection: "column", gap: 16,
              }}
            >
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 400, color: "var(--ink-70)", lineHeight: 1.65 }}>
                Lede — 18px regular. Azərbaycan dilinde danışan, mədəniyyətimizi anlayan onlayn psixologiya platforması.
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 400, color: "var(--ink)", lineHeight: 1.6 }}>
                Body — 16px regular. Platformamızda peşəkar psixoloqlarla rahat, məxfi sessiyalar keçirə bilərsiniz.
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, color: "var(--ink-70)", lineHeight: 1.55 }}>
                Small — 14px medium. Hər sessiya 50 dəqiqədir. Онlayn və ya ev şəraitindəki görüşlər.
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink-60)" }}>
                Eyebrow / Label — 12px. PSIXOLOJI YARDIM
              </p>
            </div>
          </div>
        </Section>

        {/* ===== BUTTONS ===== */}
        <Section title="Düymə Variantları">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <button className="btn btn-primary">
              Seans Rezerv Et
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button className="btn btn-ember">
              Psixoloq Tap
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
            </button>

            <button className="btn btn-soft">
              Daha Çox
            </button>

            <button className="btn btn-ghost">
              Haqqımızda
            </button>

            <button className="btn btn-primary btn-sm">
              Kiçik btn-sm
            </button>

            <a className="btn-link" href="#">
              Bütün psixoloqlar
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>

          <div
            style={{
              marginTop: 24, padding: 24,
              background: "var(--ink)", borderRadius: "var(--r-lg)",
              display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Tünd fon üstündə:
            </span>
            <button className="btn btn-ember btn-sm">Başla</button>
            <button
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                height: 44, padding: "0 22px",
                borderRadius: "var(--r-btn)",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "white", fontSize: 14, fontWeight: 500,
                fontFamily: "var(--font-sans)",
              }}
            >
              Daxil ol
            </button>
          </div>
        </Section>

        {/* ===== CARDS ===== */}
        <Section title="Kart Variantları">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 20,
            }}
          >
            {/* Card Lantern */}
            <div className="card-lantern" style={{ padding: 24 }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: "var(--ember-mist)", color: "var(--ember-deep)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
              </div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 400, color: "var(--ink)", marginBottom: 8, letterSpacing: "-0.01em" }}>
                card-lantern
              </h3>
              <p style={{ fontSize: 14, color: "var(--ink-60)", lineHeight: 1.6, margin: 0 }}>
                Kart üzərindəki köşə ornament hover zamanı görünür. Ember-soft rəngi ilə.
              </p>
            </div>

            {/* Stat cell */}
            <div
              style={{
                background: "var(--ink)", borderRadius: "var(--r-lg)",
                padding: 28, position: "relative", overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute", left: 0, top: 16, bottom: 16,
                  width: 3, borderRadius: "0 3px 3px 0",
                  background: "linear-gradient(180deg, var(--ember), transparent)",
                }}
              />
              <div
                style={{
                  fontFamily: "var(--font-display)", fontSize: 48,
                  fontWeight: 400, color: "#fff",
                  letterSpacing: "-0.028em", lineHeight: 1,
                  marginBottom: 8,
                  animation: "count-in 0.8s var(--ease-out) both",
                }}
              >
                1,200+
              </div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                Aktiv Müştəri
              </div>
            </div>

            {/* Feature card */}
            <div
              style={{
                background: "var(--paper)", borderRadius: "var(--r-lg)",
                border: "1px solid var(--ink-10)", padding: 24,
                position: "relative", overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: 52, height: 52,
                  borderRadius: "14px",
                  background: "transparent",
                  border: "1.5px solid var(--ink-15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 18,
                  position: "relative",
                  color: "var(--ink-70)",
                }}
              >
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 400, color: "var(--ink)", marginBottom: 8, letterSpacing: "-0.01em" }}>
                Xüsusiyyət Kartı
              </h3>
              <p style={{ fontSize: 14, color: "var(--ink-60)", lineHeight: 1.6, margin: 0 }}>
                Feature kartları .btn-link CTA ilə tamamlanır.
              </p>
            </div>

            {/* Testimonial card */}
            <div
              className="card-lantern"
              style={{
                padding: "32px 28px 24px",
                position: "relative",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)", fontStyle: "italic",
                  fontSize: 72, lineHeight: 0.8,
                  color: "var(--ember-soft)",
                  position: "absolute", top: 18, left: 22,
                  fontVariationSettings: '"SOFT" 100, "opsz" 144',
                  pointerEvents: "none",
                }}
                aria-hidden
              >
                &ldquo;
              </div>
              <p
                style={{
                  fontFamily: "var(--font-display)", fontStyle: "italic",
                  fontSize: 15.5, color: "var(--ink-70)", lineHeight: 1.65,
                  marginTop: 24, marginBottom: 20, position: "relative",
                }}
              >
                Həyatımda ilk dəfə birisi mənə elə qulaq verdi ki, özümdə böyük bir yüngüllük hiss etdim.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 14, borderTop: "1px dashed var(--ink-15)" }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "var(--ember-mist)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--ember-deep)",
                    fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 15,
                  }}
                >
                  L
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Leyla H.</div>
                  <div style={{ fontSize: 12, color: "var(--ink-60)" }}>Bakı</div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ===== MOOD CHIPS ===== */}
        <Section title="Mood Picker (interaktiv)">
          <div
            style={{
              background: "rgba(255,255,255,0.65)",
              border: "1px solid var(--ink-10)",
              borderRadius: "var(--r-lg)",
              padding: "18px 20px",
              maxWidth: 540,
              backdropFilter: "blur(8px)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -1, left: 28, right: 28, height: 1,
                background: "linear-gradient(90deg, transparent, var(--ember), transparent)",
                opacity: 0.6,
              }}
            />
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10,
                fontSize: 12, color: "var(--ink-60)",
                letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 500,
                marginBottom: 14,
              }}
            >
              <span style={{ width: 14, height: 1, background: "var(--ember)", display: "block" }} />
              Bu gün özünüzü necə hiss edirsiniz?
            </div>
            <div className="mood-options">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mood-chip${activeMood === m.id ? " active" : ""}`}
                  onClick={() => setActiveMood(m.id)}
                >
                  <span className="mood-chip-icon">
                    <m.Icon size={18} />
                  </span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ===== LANTERN MOTIF ===== */}
        <Section title="Fənər Motifləri (imza elementlər)">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 20,
            }}
          >
            {/* Eyebrow */}
            <div style={{ background: "var(--paper)", borderRadius: "var(--r-md)", border: "1px solid var(--ink-10)", padding: 24 }}>
              <p style={{ fontSize: 11, color: "var(--ink-50)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.1em" }}>eyebrow</p>
              <div className="eyebrow">Xidmətlər</div>
            </div>

            {/* Section divider */}
            <div style={{ background: "var(--paper)", borderRadius: "var(--r-md)", border: "1px solid var(--ink-10)", padding: 24, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <p style={{ fontSize: 11, color: "var(--ink-50)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.1em" }}>section-divider</p>
              <div className="section-divider">
                <span className="lantern-dot" />
              </div>
            </div>

            {/* Corner ornament */}
            <div style={{ background: "var(--paper)", borderRadius: "var(--r-md)", border: "1px solid var(--ink-10)", padding: 24, position: "relative" }}>
              <span className="lantern-corner lantern-corner-tl" aria-hidden />
              <span className="lantern-corner lantern-corner-tr" aria-hidden />
              <span className="lantern-corner lantern-corner-bl" aria-hidden />
              <span className="lantern-corner lantern-corner-br" aria-hidden />
              <p style={{ fontSize: 11, color: "var(--ink-50)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>lantern-corner</p>
              <p style={{ fontSize: 13, color: "var(--ink-60)", margin: 0 }}>Dörd köşə ornament</p>
            </div>

            {/* Motes */}
            <div style={{ background: "var(--paper)", borderRadius: "var(--r-md)", border: "1px solid var(--ink-10)", padding: 24, position: "relative", overflow: "hidden", minHeight: 100 }}>
              <p style={{ fontSize: 11, color: "var(--ink-50)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em", position: "relative", zIndex: 1 }}>lantern-motes</p>
              <p style={{ fontSize: 13, color: "var(--ink-60)", margin: 0, position: "relative", zIndex: 1 }}>Üzən qıvılcım hissəcikləri</p>
              <div className="lantern-motes">
                <span className="lantern-mote" style={{ left: "20%", top: "60%" }} />
                <span className="lantern-mote" style={{ left: "50%", top: "30%" }} />
                <span className="lantern-mote" style={{ left: "80%", top: "70%" }} />
              </div>
            </div>

            {/* Ember dot pulse */}
            <div style={{ background: "var(--paper)", borderRadius: "var(--r-md)", border: "1px solid var(--ink-10)", padding: 24, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <p style={{ fontSize: 11, color: "var(--ink-50)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.1em" }}>ember pulse dot</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="eyebrow-dot" style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--ember)", boxShadow: "0 0 0 5px var(--ember-mist)", animation: "pulse-dot 2s ease-in-out infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--ink-70)" }}>Online indikator</span>
              </div>
            </div>

            {/* Grid bg */}
            <div style={{ background: "var(--paper)", borderRadius: "var(--r-md)", border: "1px solid var(--ink-10)", padding: 24, position: "relative", overflow: "hidden" }}>
              <div className="lantern-grid-bg" />
              <p style={{ fontSize: 11, color: "var(--ink-50)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em", position: "relative", zIndex: 1 }}>lantern-grid-bg</p>
              <p style={{ fontSize: 13, color: "var(--ink-60)", margin: 0, position: "relative", zIndex: 1 }}>Nöqtəli şəbəkə fon</p>
            </div>
          </div>
        </Section>

        {/* ===== SHADOWS ===== */}
        <Section title="Kölgə Sistemi">
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
            {[
              { name: "shadow-xs", label: "xs" },
              { name: "shadow-sm", label: "sm" },
              { name: "shadow-md", label: "md" },
              { name: "shadow-lg", label: "lg" },
              { name: "shadow-xl", label: "xl" },
              { name: "shadow-glow", label: "glow" },
            ].map((s) => (
              <div key={s.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 80, height: 80,
                    background: "var(--paper)",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--ink-05)",
                    boxShadow: `var(--${s.name})`,
                  }}
                />
                <span style={{ fontSize: 11, color: "var(--ink-60)", fontFamily: "monospace" }}>--{s.name}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ===== BORDER RADII ===== */}
        <Section title="Radius Sistemi">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            {[
              { name: "r-xs", value: "6px" },
              { name: "r-sm", value: "10px" },
              { name: "r-md", value: "14px" },
              { name: "r-btn", value: "10px" },
              { name: "r-card", value: "16px" },
              { name: "r-lg", value: "20px" },
              { name: "r-xl", value: "28px" },
              { name: "r-2xl", value: "40px" },
              { name: "r-pill", value: "999px" },
            ].map((r) => (
              <div key={r.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 64, height: 64,
                    background: "var(--ember-mist)",
                    border: "1.5px solid var(--ember-soft)",
                    borderRadius: `var(--${r.name})`,
                  }}
                />
                <span style={{ fontSize: 10, color: "var(--ink-60)", fontFamily: "monospace", textAlign: "center" }}>
                  --{r.name}<br />{r.value}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ===== SECTION DARK ===== */}
        <Section title="Tünd Fon Variantı (About/Stats)">
          <div
            style={{
              background: "var(--ink)",
              borderRadius: "var(--r-xl)",
              padding: "40px 36px",
              position: "relative", overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute", inset: 0,
                backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: -100, right: -80,
                width: 360, height: 360, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(200,146,59,0.12), transparent 60%)",
                filter: "blur(40px)", pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div className="eyebrow eyebrow-light" style={{ marginBottom: 18 }}>Haqqımızda</div>
              <h2
                style={{
                  fontFamily: "var(--font-display)", fontWeight: 400,
                  fontSize: "clamp(28px, 3.5vw, 44px)",
                  color: "#fff", letterSpacing: "-0.025em", lineHeight: 1.1,
                  fontVariationSettings: '"SOFT" 80, "opsz" 144',
                  marginBottom: 16,
                }}
              >
                Azərbaycanda ilk <em style={{ fontStyle: "italic", color: "var(--ember-soft)", fontVariationSettings: '"SOFT" 100, "opsz" 144' }}>onlayn</em><br />psixologiya platforması
              </h2>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, marginBottom: 28, maxWidth: 480 }}>
                Tünd fon üstündə Fraunces başlıq, eyebrow-light, ember accent rəngləri.
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-ember btn-sm">Daha çox</button>
                <button
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    height: 44, padding: "0 20px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "rgba(255,255,255,0.8)", borderRadius: "var(--r-btn)",
                    fontSize: 14, fontWeight: 500, fontFamily: "var(--font-sans)",
                    cursor: "pointer",
                  }}
                >
                  Əlaqə
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* ===== BLOG CARD PREVIEW ===== */}
        <Section title="Blog Kartı (compact)">
          <div style={{ maxWidth: 440 }}>
            <article
              className="card-lantern"
              style={{ padding: 20, display: "flex", gap: 16, cursor: "pointer" }}
            >
              <div
                style={{
                  width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                  background: "var(--ember-mist)", color: "var(--ember-deep)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h7a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-7a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h8z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center",
                      padding: "3px 10px",
                      background: "var(--ember-mist)", color: "var(--ember-deep)",
                      borderRadius: "var(--r-pill)", fontSize: 11, fontWeight: 600,
                      letterSpacing: "0.04em",
                    }}
                  >
                    Stress
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--ink-60)" }}>4 dəq</span>
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 400,
                    color: "var(--ink)", marginBottom: 6, lineHeight: 1.3, letterSpacing: "-0.01em",
                  }}
                >
                  Narahatlıqla baş başa: 5 praktik üsul
                </h3>
                <p style={{ fontSize: 13, color: "var(--ink-60)", lineHeight: 1.55, margin: 0 }}>
                  Gündəlik stresin azaldılması üçün sadə, effektiv texnikalar.
                </p>
              </div>
            </article>
          </div>
        </Section>

        {/* ===== FAQ ITEM ===== */}
        <Section title="FAQ Elementi">
          <div style={{ maxWidth: 600 }}>
            <div
              style={{
                background: "var(--paper)", borderRadius: "var(--r-md)",
                border: "1px solid var(--ink-10)", overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "20px 24px",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)", fontStyle: "italic",
                    fontSize: 14, color: "var(--ember-deep)", opacity: 0.7, minWidth: 24,
                  }}
                >
                  01
                </span>
                <span
                  style={{
                    flex: 1, fontFamily: "var(--font-display)", fontSize: 17,
                    fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.005em", lineHeight: 1.4,
                  }}
                >
                  Psixoloqla sessiya necə işləyir?
                </span>
                <span
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: "var(--ink)", color: "var(--ember-soft)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </span>
              </div>
              <div
                style={{
                  paddingLeft: 64, paddingRight: 24, paddingBottom: 22,
                }}
              >
                <p style={{ fontSize: 14.5, color: "var(--ink-70)", lineHeight: 1.7, margin: 0 }}>
                  Psixoloq seçdikdən sonra uyğun bir vaxt slot seçirsiniz. Sessiya video zəng vasitəsilə keçirilir, tam məxfi saxlanılır.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* ===== FOOTER NOTE ===== */}
        <div
          style={{
            marginTop: 40, paddingTop: 32,
            borderTop: "1px dashed var(--ink-15)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12,
          }}
        >
          <div className="section-divider" style={{ flex: 1, maxWidth: 260, margin: 0 }}>
            <span className="lantern-dot" />
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-60)", fontFamily: "var(--font-display)", fontStyle: "italic" }}>
            Fanus UI Kit — sandbox preview. Bu səhifə production-da görünməyəcək.
          </p>
        </div>

      </div>
    </div>
  );
}
