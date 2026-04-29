"use client";

import { useState, useEffect } from "react";
import { useBooking } from "@/context/BookingContext";
import { useScrollReveal } from "@/lib/useScrollReveal";
import type { Psychologist } from "@/lib/api";

const specializations = [
  "Hamısı", "Depressiya", "Narahatlıq", "Münasibətlər", "Travma",
  "Stress", "Özünüinkişaf", "Ailə", "Uşaq psixologiyası",
];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter((w) => w.length > 1)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--amber)" stroke="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="var(--sage)" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function PsychologistCard({ p }: { p: Psychologist }) {
  const { open } = useBooking();
  const initials = getInitials(p.name);
  const hasPhoto = p.photoUrl && p.photoUrl.trim() !== "";

  return (
    <div className="psy-page-card">
      <div className="psy-page-photo" style={{ background: p.bgColor || "var(--bg-blue)" }}>
        {hasPhoto ? (
          <img src={p.photoUrl} alt={p.name} />
        ) : (
          <div className="psy-page-initials">{initials}</div>
        )}
        <div className="psy-page-exp" style={{ color: p.accentColor }}>
          {p.experience} təcrübə
        </div>
      </div>
      <div className="psy-page-body">
        <div className="psy-page-row1">
          <div className="psy-page-name">{p.name}</div>
          <div className="psy-page-rating">
            <StarIcon />
            <span>{p.rating}</span>
          </div>
        </div>
        <div className="psy-page-role">{p.title}</div>
        <div className="psy-page-tags">
          {p.specializations.slice(0, 3).map((t) => (
            <span
              key={t}
              className="psy-page-tag"
              style={{ background: p.bgColor, color: p.accentColor }}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="psy-page-foot">
          <span className="psy-page-sessions">{p.sessionsCount} seans</span>
          <button
            className="psy-page-cta"
            style={{ background: p.bgColor, color: p.accentColor }}
            onClick={() => open(p.name)}
          >
            Randevu al
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PsychologistsPage({ psychologists }: { psychologists: Psychologist[] }) {
  const [activeFilter, setActiveFilter] = useState("Hamısı");
  const [search, setSearch] = useState("");
  const [stuck, setStuck] = useState(false);
  const { ref: heroRef, visible: heroVisible } = useScrollReveal<HTMLDivElement>(0.05);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filtered = psychologists.filter((p) => {
    const matchesSpec = activeFilter === "Hamısı" || p.specializations.includes(activeFilter);
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.specializations.some((s) => s.toLowerCase().includes(search.toLowerCase()));
    return matchesSpec && matchesSearch;
  });

  return (
    <main className="psy-page">

      {/* HERO */}
      <section className="psy-page-hero">
        <div className="ap-hero-blob ap-hero-blob-1" />
        <div className="ap-hero-blob ap-hero-blob-2" />
        <div
          className="container"
          ref={heroRef}
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--oxford-60)" }}>
            Komandamız
          </p>
          <h1 className="psy-page-title">
            Sizə ən uyğun<br />psixoloqu tapın.
          </h1>
          <p className="psy-page-sub">
            Hər biri öz sahəsinin mütəxəssisi — sizi dinləmək, anlamaq və dəstəkləmək üçün buradalar.
          </p>
          <div className="psy-trust-row">
            <div className="psy-trust-pill"><CheckIcon /> Sertifikatlı</div>
            <div className="psy-trust-pill"><CheckIcon /> Pulsuz ilk seans</div>
            <div className="psy-trust-pill"><CheckIcon /> 100% məxfi</div>
          </div>
        </div>
      </section>

      {/* STICKY FILTER BAR */}
      <div className={`psy-filters${stuck ? " stuck" : ""}`}>
        <div className="container psy-filters-inner">
          <div className="psy-search">
            <svg width="16" height="16" fill="none" stroke="var(--oxford-60)" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Ad və ya ixtisas axtar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="psy-spec-pills">
            {specializations.map((s) => (
              <button
                key={s}
                className={`psy-spec-pill${activeFilter === s ? " active" : ""}`}
                onClick={() => setActiveFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* GRID */}
      <section className="psy-grid-section">
        <div className="container">
          <p className="psy-result-count">
            <strong>{filtered.length}</strong> psixoloq tapıldı
            {activeFilter !== "Hamısı" && <span> · <em>{activeFilter}</em></span>}
          </p>

          {filtered.length === 0 ? (
            <div className="psy-empty">
              <svg width="64" height="64" fill="none" viewBox="0 0 64 64" style={{ margin: "0 auto 16px", display: "block", opacity: 0.5 }}>
                <circle cx="28" cy="28" r="18" stroke="var(--oxford-20)" strokeWidth="2" />
                <path d="M42 42l10 10" stroke="var(--oxford-20)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <h3>Heç bir psixoloq tapılmadı</h3>
              <p>Filtrlərinizi dəyişdirməyi sınayın və ya bütün mütəxəssislərimizə baxın.</p>
              <button
                className="btn btn-ghost"
                style={{ borderRadius: "var(--r-btn)" }}
                onClick={() => { setActiveFilter("Hamısı"); setSearch(""); }}
              >
                Filtrləri təmizlə
              </button>
            </div>
          ) : (
            <div className="psy-page-grid">
              {filtered.map((p) => (
                <PsychologistCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </section>

    </main>
  );
}
