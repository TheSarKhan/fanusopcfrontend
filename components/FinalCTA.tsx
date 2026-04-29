"use client";

import { useState, useEffect } from "react";
import { useBooking } from "@/context/BookingContext";
import { useScrollReveal } from "@/lib/useScrollReveal";
import Link from "next/link";

const PROMPTS = [
  "Bu gün özümə demək istədiyim bir söz...",
  "Növbəti həftə özümə yumşaq olmaq istəyirəm.",
  "Daha yaxşı yatmaq istəyirəm.",
  "Sakitləşməyi öyrənmək istəyirəm.",
];

export default function FinalCTA() {
  const { open } = useBooking();
  const { ref, visible } = useScrollReveal<HTMLElement>(0.1);
  const [note, setNote] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const [stamped, setStamped] = useState(false);

  useEffect(() => {
    if (note) return;
    const t = setInterval(() => setPhIdx(i => (i + 1) % PROMPTS.length), 3200);
    return () => clearInterval(t);
  }, [note]);

  const today = new Date().toLocaleDateString("az-AZ", { day: "numeric", month: "long", year: "numeric" });

  const onSeal = () => {
    if (!note.trim()) return;
    setStamped(true);
    setTimeout(() => setStamped(false), 2400);
  };

  return (
    <section ref={ref} className="final-cta">
      {/* Textures */}
      <div className="cta-paper-grain" aria-hidden />
      <div className="cta-warm-light" aria-hidden />

      <div className="container cta-stack">
        {/* Eyebrow */}
        <div
          className="cta-eyebrow-row"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          <span className="cta-rule" />
          <span className="cta-eyebrow-word">Dəvət</span>
          <span className="cta-rule" />
        </div>

        {/* 3-column stage */}
        <div
          className="cta-stage"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(32px)",
            transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s",
          }}
        >
          {/* Postcard */}
          <div className={`cta-postcard${stamped ? " stamped" : ""}`}>
            <div className="cta-pc-header">
              <span className="cta-pc-from">Kimdən: <em>özünüz</em></span>
              <span className="cta-pc-date">{today}</span>
            </div>

            <div className="cta-pc-lines" aria-hidden>
              <span /><span /><span /><span />
            </div>

            <textarea
              className="cta-pc-input"
              placeholder={PROMPTS[phIdx]}
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 120))}
              maxLength={120}
              rows={4}
            />

            <div className="cta-pc-foot">
              <span className="cta-pc-counter">{note.length}/120</span>
              <button className="cta-pc-seal" onClick={onSeal} disabled={!note.trim()}>
                <span className="cta-pc-seal-wax">
                  <span className="cta-pc-seal-letter">F</span>
                </span>
                <span>Möhürlə və saxla</span>
              </button>
            </div>

            <div className={`cta-stamp${stamped ? " show" : ""}`} aria-hidden>
              <span className="cta-stamp-ring" />
              <span className="cta-stamp-text">QƏBUL · {today.toUpperCase()}</span>
            </div>
          </div>

          {/* Center */}
          <div className="cta-center">
            <h2 className="cta-head">
              <span className="cta-h-line">Bir kağız.</span>
              <span className="cta-h-line cta-h-italic">Bir cümlə.</span>
              <span className="cta-h-line">Bir başlanğıc.</span>
            </h2>

            <p className="cta-lede">
              Özünüzə bir not yazın. Biz ona bir psixoloq, bir vaxt, bir məkan
              əlavə edək — qalanını birlikdə yazaq.
            </p>

            <div className="cta-actions">
              <button className="cta-cta-primary" onClick={() => open()}>
                <span>İlk seansı təyin et</span>
                <span className="cta-cta-arrow">
                  <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
              <Link href="/psychologists" className="cta-cta-link">
                və ya — sadəcə baxım
              </Link>
            </div>
          </div>

          {/* Ticket */}
          <div className="cta-ticket" aria-hidden>
            <div className="cta-tk-perf cta-tk-perf-top" />
            <div className="cta-tk-row1">
              <span className="cta-tk-label">Seans · 50 dəqiqə</span>
              <span className="cta-tk-no">№ 0001</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", margin: "18px 0 14px" }}>
              <span className="cta-tk-day">CÜMƏ</span>
              <span className="cta-tk-hour">14:00</span>
              <span className="cta-tk-tz">GMT+4</span>
            </div>
            <div className="cta-tk-divider">
              {[0,1,2,3,4,5,6,7].map(i => <span key={i} />)}
            </div>
            <div className="cta-tk-with">
              <span className="cta-tk-avatar">L</span>
              <div>
                <div className="cta-tk-name">Dr. Leyla Ə.</div>
                <div className="cta-tk-role">Klinik psixoloq</div>
              </div>
            </div>
            <div className="cta-tk-row2">
              <span>İlk görüş</span>
              <strong>Pulsuz</strong>
            </div>
            <div className="cta-tk-perf cta-tk-perf-bot" />
          </div>
        </div>

        {/* Trust strip */}
        <div
          className="cta-trust-row"
          style={{
            opacity: visible ? 1 : 0,
            transition: "opacity 0.6s ease 0.3s",
          }}
        >
          <span>
            <svg width="13" height="13" fill="none" stroke="rgba(0,33,71,0.55)" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Söhbətlər sizinlə qalır
          </span>
          <span className="cta-trust-sep" />
          <span>
            <svg width="13" height="13" fill="none" stroke="rgba(0,33,71,0.55)" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            Heç bir kart, heç bir öhdəlik
          </span>
          <span className="cta-trust-sep" />
          <span>
            <svg width="13" height="13" fill="none" stroke="rgba(0,33,71,0.55)" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" strokeLinecap="round" />
            </svg>
            İstədiyiniz mütəxəssisə keç
          </span>
        </div>
      </div>
    </section>
  );
}
