"use client";

import { useState } from "react";
import { useMood, MoodId } from "@/context/MoodContext";

const MOODS: { id: MoodId; emoji: string; label: string; desc: string; color: string; bg: string }[] = [
  { id: "sad",     emoji: "😔", label: "Kədərli",  desc: "Ağır bir hiss var içimdə",         color: "#D97706", bg: "#FFF8EE" },
  { id: "anxious", emoji: "😰", label: "Narahat",  desc: "Nigarançılıq hiss edirəm",         color: "#0D9488", bg: "#EFFAF8" },
  { id: "neutral", emoji: "😐", label: "Neytral",  desc: "Nə yaxşı, nə pis",                color: "#002147", bg: "#EBF2FF" },
  { id: "tired",   emoji: "😮‍💨", label: "Yorğun",   desc: "Özümü tükənmiş hiss edirəm",      color: "#7C3AED", bg: "#F3EEFF" },
  { id: "good",    emoji: "😊", label: "Yaxşı",    desc: "Özümü inkişaf etdirmək istəyirəm", color: "#0284C7", bg: "#EBF8FF" },
];

export default function MoodGate() {
  const { mood, setMood, isLoaded } = useMood();
  const [closing, setClosing] = useState(false);
  const [hovered, setHovered] = useState<MoodId | null>(null);

  if (!isLoaded || mood !== null) return null;

  const select = (id: MoodId) => {
    setClosing(true);
    setTimeout(() => setMood(id), 550);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "linear-gradient(160deg, #F0F6FF 0%, #F4F0FF 50%, #F0F9F6 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "clamp(1rem, 4vw, 2rem)",
        opacity: closing ? 0 : 1,
        transition: "opacity 0.55s ease",
        overflowY: "auto",
      }}
    >
      {/* Decorative blobs */}
      <div style={{ position: "fixed", top: -80, left: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(59,111,165,0.07)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -60, right: -60, width: 260, height: 260, borderRadius: "50%", background: "rgba(123,133,200,0.07)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", top: "40%", right: "10%", width: 140, height: 140, borderRadius: "50%", background: "rgba(13,148,136,0.05)", pointerEvents: "none" }} />

      {/* Logo */}
      <img src="/images/hero-main.png" alt="Fanus" style={{ height: 38, marginBottom: 36, objectFit: "contain", position: "relative" }} />

      {/* Heading */}
      <h1 style={{
        fontSize: "clamp(1.5rem, 4vw, 2.1rem)", fontWeight: 700, color: "#0F1C2E",
        textAlign: "center", marginBottom: 10,
        fontFamily: "Playfair Display, Georgia, serif", lineHeight: 1.2,
      }}>
        Bu gün özünüzü necə hiss edirsiniz?
      </h1>
      <p style={{ color: "#52718F", fontSize: "0.93rem", textAlign: "center", marginBottom: 40, maxWidth: 380, lineHeight: 1.6 }}>
        Cavabınız sizə ən uyğun dəstəyi tapmağımıza kömək edəcək
      </p>

      {/* Mood cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, width: "100%", maxWidth: 640, marginBottom: 32 }}>
        {MOODS.map((m) => {
          const active = hovered === m.id;
          return (
            <button
              key={m.id}
              onClick={() => select(m.id)}
              onMouseEnter={() => setHovered(m.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: active ? m.bg : "#ffffff",
                border: `2px solid ${active ? m.color : "#E0EAF4"}`,
                borderRadius: "1.25rem",
                padding: "18px 12px",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s ease",
                transform: active ? "translateY(-4px) scale(1.03)" : "none",
                boxShadow: active ? `0 10px 28px ${m.color}28` : "0 2px 10px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontSize: 34, marginBottom: 7, lineHeight: 1 }}>{m.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: active ? m.color : "#0F1C2E", marginBottom: 4, transition: "color 0.2s" }}>{m.label}</div>
              <div style={{ fontSize: 10, color: "#52718F", lineHeight: 1.45 }}>{m.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Skip */}
      <button
        onClick={() => select("neutral")}
        style={{ background: "none", border: "none", color: "#AAC0D5", fontSize: "0.82rem", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
      >
        Keç →
      </button>
    </div>
  );
}
