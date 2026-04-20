"use client";

import { useState, useEffect, useRef } from "react";
import { useBooking } from "@/context/BookingContext";
import { useMood, MoodId } from "@/context/MoodContext";

const CHAT_MESSAGES = [
  { from: "psixoloq" as const, text: "Salam! Fanus ilə ilk addımınızı atmağa hazırsınız? 🌿" },
  { from: "siz" as const,      text: "Bəli, özümü daha yaxşı hiss etmək istəyirəm." },
  { from: "psixoloq" as const, text: "Əla! Sizi dinləyən biri hazırdır — bu gün ilk addımı birlikdə ataq 💙" },
];

function TherapyVisual({ color, accent }: { color: string; accent: string }) {
  const [breathPhase, setBreathPhase] = useState<"in" | "out">("in");
  const [messages, setMessages] = useState<typeof CHAT_MESSAGES>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingFrom, setTypingFrom] = useState<"psixoloq" | "siz">("psixoloq");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setBreathPhase(p => p === "in" ? "out" : "in"), 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let stopped = false;
    let idx = 0;

    const after = (fn: () => void, ms: number) => {
      const id = setTimeout(() => { if (!stopped) fn(); }, ms);
      timers.push(id);
    };

    const addMessage = () => {
      if (idx >= CHAT_MESSAGES.length) {
        after(() => { setMessages([]); setIsTyping(false); idx = 0; after(addMessage, 600); }, 3200);
        return;
      }
      setTypingFrom(CHAT_MESSAGES[idx].from);
      setIsTyping(true);
      after(() => {
        const msg = CHAT_MESSAGES[idx];
        idx += 1;
        setIsTyping(false);
        setMessages(prev => [...prev, msg]);
        after(addMessage, 900);
      }, 1400);
    };

    after(addMessage, 1000);
    return () => { stopped = true; timers.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, isTyping]);

  return (
    <div style={{ perspective: "1100px", perspectiveOrigin: "50% 50%" }}>
      <div style={{ position: "relative", width: 320, height: 440 }}>
        {/* Ghost cards */}
        {[1, 2].map((offset) => (
          <div key={offset} style={{
            position: "absolute", inset: 0, borderRadius: "1.5rem",
            background: `rgba(255,255,255,${0.1 + offset * 0.04})`,
            border: "1px solid rgba(255,255,255,0.2)",
            transform: `rotateY(-14deg) rotateX(6deg) translateX(${offset * 14}px) translateY(${offset * 10}px) translateZ(${offset * -26}px)`,
            boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
          }} />
        ))}

        {/* Main card */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "1.5rem",
          background: "#ffffff",
          transform: "rotateY(-14deg) rotateX(6deg)",
          boxShadow: "40px 40px 80px rgba(0,0,0,0.25)",
          overflow: "hidden", display: "flex", flexDirection: "column",
        }}>

          {/* ── Breathing section ── */}
          <div style={{
            height: 196, flexShrink: 0,
            background: `linear-gradient(150deg, ${accent}55 0%, ${accent}22 100%)`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
          }}>
            {/* Pulsing rings */}
            {[96, 68, 46].map((size, i) => (
              <div key={i} style={{
                position: "absolute", width: size, height: size, borderRadius: "50%",
                border: `1.5px solid ${color}`,
                opacity: breathPhase === "in" ? 0.18 - i * 0.04 : 0.07,
                transform: `scale(${breathPhase === "in" ? 1.5 - i * 0.15 : 1})`,
                transition: "all 4s ease-in-out",
              }} />
            ))}
            {/* Center circle */}
            <div style={{
              width: 62, height: 62, borderRadius: "50%", zIndex: 1,
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: `scale(${breathPhase === "in" ? 1.18 : 1})`,
              transition: "transform 4s ease-in-out, box-shadow 4s ease-in-out",
              boxShadow: `0 0 ${breathPhase === "in" ? 36 : 14}px ${color}55`,
            }}>
              <svg width="22" height="22" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{
              marginTop: 13, fontSize: 13, fontWeight: 700, color, zIndex: 1,
              transition: "opacity 0.6s ease", letterSpacing: "0.03em",
            }}>
              {breathPhase === "in" ? "Nəfəs al..." : "Burax..."}
            </p>
            <p style={{ fontSize: 10, color: `${color}99`, zIndex: 1, marginTop: 3 }}>
              Sakitliyi hiss et
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "#EEF4FB", flexShrink: 0 }} />

          {/* ── Chat section ── */}
          <div
            ref={chatRef}
            style={{
              flex: 1, padding: "10px 12px 12px",
              display: "flex", flexDirection: "column", gap: 7,
              overflowY: "auto", scrollBehavior: "smooth",
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, color: "#B0C4D8", textAlign: "center", marginBottom: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Psixoloq ilə söhbət
            </p>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.from === "siz" ? "flex-end" : "flex-start", animation: "msgIn 0.3s ease both" }}>
                <div style={{
                  maxWidth: "82%", padding: "7px 11px",
                  borderRadius: msg.from === "psixoloq" ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
                  background: msg.from === "psixoloq" ? "#F0F6FF" : color,
                  color: msg.from === "psixoloq" ? "#0F1C2E" : "#fff",
                  fontSize: 11, lineHeight: 1.55,
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ display: "flex", justifyContent: typingFrom === "siz" ? "flex-end" : "flex-start" }}>
                <div style={{
                  display: "flex", gap: 4, padding: "8px 12px",
                  background: typingFrom === "siz" ? color : "#F0F6FF",
                  borderRadius: typingFrom === "siz" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: typingFrom === "siz" ? "rgba(255,255,255,0.75)" : color,
                      animation: `typingDot 1.2s ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating badge */}
        <div style={{ position: "absolute", bottom: -16, left: -28, background: "#fff", borderRadius: 14, padding: "10px 14px", boxShadow: "0 6px 24px rgba(0,0,0,0.12)", transform: "rotateY(-14deg) rotateX(6deg)", minWidth: 150 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80" }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: "#0F1C2E" }}>İndi onlayn</span>
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#0F1C2E" }}>6 psixoloq hazırdır</p>
        </div>
      </div>
    </div>
  );
}

const MOOD_CONFIG: Record<MoodId, { gradient: string; headline: string[]; sub: string; accent: string; color: string; badge: string }> = {
  sad: {
    gradient: "135deg, #92400E 0%, #D97706 60%, #F59E0B 100%",
    headline: ["Siz yalnız", "deyilsiniz"],
    sub: "Kədər hər insanın həyatının bir hissəsidir. Burada sizi dinləyən, anlayan biri var.",
    accent: "#FDE68A",
    color: "#D97706",
    badge: "Empatik psixoloji dəstək",
  },
  anxious: {
    gradient: "135deg, #0F766E 0%, #0D9488 60%, #2DD4BF 100%",
    headline: ["Nəfəs alın,", "buradayıq"],
    sub: "Narahatçılıq keçici bir hal ola bilər. Peşəkar dəstəklə sakitliyi yenidən tapın.",
    accent: "#99F6E4",
    color: "#0D9488",
    badge: "Sakitləşdirici psixoloji dəstək",
  },
  neutral: {
    gradient: "135deg, #2A57B0 0%, #5A4FC8 60%, #7B68D8 100%",
    headline: ["Daha yaxşı hiss", "etməyə bu gün başlayın"],
    sub: "Sertifikatlı psixoloqlarla güvənli, məxfi və rahat mühitdə psixoloji dəstək alın.",
    accent: "#A8CFFF",
    color: "#3B6FA5",
    badge: "Onlayn psixoloji dəstək",
  },
  tired: {
    gradient: "135deg, #4C1D95 0%, #7C3AED 60%, #A78BFA 100%",
    headline: ["Özünüzə qulluq", "etməyin vaxtıdır"],
    sub: "Yorğunluq bir işarədir. Özünüzü yenidən kəşf etmək üçün buradayıq.",
    accent: "#DDD6FE",
    color: "#7C3AED",
    badge: "Bərpa və özünüqulluq dəstəyi",
  },
  good: {
    gradient: "135deg, #1E40AF 0%, #2563EB 60%, #0EA5E9 100%",
    headline: ["Bu hissi daha", "da gücləndirin"],
    sub: "Yaxşı hiss etmək — böyümək üçün ən yaxşı zamandır. Potensialınızı birlikdə açaq.",
    accent: "#BAE6FD",
    color: "#0284C7",
    badge: "Şəxsi inkişaf və coaching",
  },
};

export default function Hero() {
  const { open } = useBooking();
  const { mood } = useMood();
  const cfg = MOOD_CONFIG[mood ?? "neutral"];
  return (
    <section
      className="relative overflow-hidden pt-16"
      style={{
        background: `linear-gradient(${cfg.gradient})`,
        minHeight: "92vh",
        transition: "background 0.8s ease",
      }}
    >
      {/* Wave bottom */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <svg viewBox="0 0 1440 80" fill="none" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 80 }}>
          <path d="M0 40 Q360 80 720 40 Q1080 0 1440 40 L1440 80 L0 80 Z" fill="#ffffff" />
        </svg>
      </div>

      <div
        className="container relative z-10 flex items-center"
        style={{ minHeight: "calc(92vh - 80px)", paddingTop: "clamp(2rem, 6vw, 3rem)", paddingBottom: "clamp(4rem, 8vw, 5rem)" }}
      >
        <div className="grid lg:grid-cols-2 gap-12 items-center w-full">

          {/* Left */}
          <div className="max-w-xl">
            <div
              className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <span className="text-xs font-semibold text-white/90 tracking-wide">{cfg.badge}</span>
            </div>

            <h1
              className="text-[2.8rem] sm:text-5xl lg:text-[3.4rem] font-bold leading-[1.1] tracking-tight mb-6"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#ffffff", transition: "all 0.5s ease" }}
            >
              {cfg.headline[0]}
              <br />
              <span style={{ color: cfg.accent }}>{cfg.headline[1]}</span>
            </h1>

            <p className="text-[1.05rem] leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.78)", transition: "all 0.5s ease" }}>
              {cfg.sub}
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => open()}
                className="font-bold px-7 py-3.5 rounded-full text-[0.95rem] transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: "#ffffff", color: "#2A57B0" }}
              >
                Randevu al
              </button>
              <a
                href="#psychologists"
                className="font-semibold px-7 py-3.5 rounded-full text-[0.95rem] transition-all duration-200 hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.9)", border: "1.5px solid rgba(255,255,255,0.35)" }}
              >
                Psixoloqları gör
              </a>
            </div>

            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-2">
                {["/images/avatar-1.jpg", "/images/avatar-2.jpg", "/images/avatar-3.jpg", "/images/avatar-4.jpg"].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt="müştəri"
                    className="w-9 h-9 rounded-full object-cover border-2"
                    style={{ borderColor: "rgba(255,255,255,0.5)", zIndex: 4 - i }}
                  />
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">500+ aktiv müştəri</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>1000+ seans tamamlandı</p>
              </div>
            </div>
          </div>

          {/* Right: Therapy visual */}
          <div className="hidden lg:flex justify-center items-center">
            <TherapyVisual color={cfg.color} accent={cfg.accent} />
          </div>

        </div>
      </div>
    </section>
  );
}
