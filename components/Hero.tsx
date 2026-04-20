"use client";

import { useBooking } from "@/context/BookingContext";
import { useMood, MoodId } from "@/context/MoodContext";

const MOOD_CONFIG: Record<MoodId, { gradient: string; headline: string[]; sub: string; accent: string; badge: string }> = {
  sad: {
    gradient: "135deg, #92400E 0%, #D97706 60%, #F59E0B 100%",
    headline: ["Siz yalnız", "deyilsiniz"],
    sub: "Kədər hər insanın həyatının bir hissəsidir. Burada sizi dinləyən, anlayan biri var.",
    accent: "#FDE68A",
    badge: "Empatik psixoloji dəstək",
  },
  anxious: {
    gradient: "135deg, #0F766E 0%, #0D9488 60%, #2DD4BF 100%",
    headline: ["Nəfəs alın,", "buradayıq"],
    sub: "Narahatçılıq keçici bir hal ola bilər. Peşəkar dəstəklə sakitliyi yenidən tapın.",
    accent: "#99F6E4",
    badge: "Sakitləşdirici psixoloji dəstək",
  },
  neutral: {
    gradient: "135deg, #2A57B0 0%, #5A4FC8 60%, #7B68D8 100%",
    headline: ["Daha yaxşı hiss", "etməyə bu gün başlayın"],
    sub: "Sertifikatlı psixoloqlarla güvənli, məxfi və rahat mühitdə psixoloji dəstək alın.",
    accent: "#A8CFFF",
    badge: "Onlayn psixoloji dəstək",
  },
  tired: {
    gradient: "135deg, #4C1D95 0%, #7C3AED 60%, #A78BFA 100%",
    headline: ["Özünüzə qulluq", "etməyin vaxtıdır"],
    sub: "Yorğunluq bir işarədir. Özünüzü yenidən kəşf etmək üçün buradayıq.",
    accent: "#DDD6FE",
    badge: "Bərpa və özünüqulluq dəstəyi",
  },
  good: {
    gradient: "135deg, #1E40AF 0%, #2563EB 60%, #0EA5E9 100%",
    headline: ["Bu hissi daha", "da gücləndirin"],
    sub: "Yaxşı hiss etmək — böyümək üçün ən yaxşı zamandır. Potensialınızı birlikdə açaq.",
    accent: "#BAE6FD",
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

          {/* Right: 3D floating cards */}
          <div className="hidden lg:flex justify-center items-center">
            <div style={{ perspective: "1100px", perspectiveOrigin: "50% 50%" }}>
              <div style={{ position: "relative", width: 340, height: 460 }}>

                {/* Back ghost card */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "1.5rem",
                    background: "rgba(255,255,255,0.10)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    transform: "rotateY(-14deg) rotateX(6deg) translateX(28px) translateY(18px) translateZ(-50px)",
                    boxShadow: "0 30px 60px rgba(0,0,0,0.18)",
                  }}
                />

                {/* Second ghost card */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "1.5rem",
                    background: "rgba(255,255,255,0.16)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    transform: "rotateY(-14deg) rotateX(6deg) translateX(14px) translateY(9px) translateZ(-25px)",
                    boxShadow: "0 30px 60px rgba(0,0,0,0.14)",
                  }}
                />

                {/* Main card */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "1.5rem",
                    background: "#ffffff",
                    transform: "rotateY(-14deg) rotateX(6deg)",
                    boxShadow: "40px 40px 80px rgba(0,0,0,0.28), -4px -4px 20px rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  {/* Mood check-in — top section */}
                  <div style={{ height: 255, position: "relative", overflow: "hidden", background: "linear-gradient(150deg, #EBF2FF 0%, #EEE9FF 55%, #E8F5F0 100%)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 18px 18px" }}>
                    {/* Decorative blobs */}
                    <div style={{ position: "absolute", top: -36, right: -36, width: 130, height: 130, borderRadius: "50%", background: "rgba(123,133,200,0.15)" }} />
                    <div style={{ position: "absolute", top: 30, left: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(42,87,176,0.07)" }} />

                    {/* Logo pill top-left */}
                    <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "5px 12px 5px 8px", display: "flex", alignItems: "center", gap: 7 }}>
                      <img src="/images/hero-main.png" alt="Fanus" style={{ height: 22, width: "auto", objectFit: "contain" }} />
                    </div>
                    {/* Online badge top-right */}
                    <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ADE80" }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#0F1C2E" }}>Onlayn</span>
                    </div>

                    {/* Mood question */}
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#3B6FA5", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 10, textAlign: "center" }}>Bu gün özünüzü necə hiss edirsiniz?</p>

                    {/* Mood circles */}
                    <div style={{ display: "flex", gap: 7, justifyContent: "center", marginBottom: 14 }}>
                      {[
                        { emoji: "😔", label: "Kədərli" },
                        { emoji: "😕", label: "Narahat" },
                        { emoji: "😐", label: "Neytral" },
                        { emoji: "🙂", label: "Yaxşı", active: true },
                        { emoji: "😊", label: "Əla" },
                      ].map((item) => (
                        <div key={item.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: "50%",
                            background: item.active ? "#2A57B0" : "rgba(255,255,255,0.85)",
                            border: item.active ? "none" : "1.5px solid rgba(221,232,245,0.9)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18,
                            boxShadow: item.active ? "0 4px 14px rgba(42,87,176,0.4)" : "0 2px 6px rgba(0,0,0,0.05)",
                          }}>{item.emoji}</div>
                          {item.active && <span style={{ fontSize: 8, color: "#2A57B0", fontWeight: 700 }}>{item.label}</span>}
                        </div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(221,232,245,0.8)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <span style={{ fontSize: 10, color: "#0F1C2E", fontWeight: 600 }}>Tərəqqi Yolunuz</span>
                        <span style={{ fontSize: 10, color: "#3B6FA5", fontWeight: 700 }}>4 / 8 seans</span>
                      </div>
                      <div style={{ height: 5, background: "#E8EFFA", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: "50%", background: "linear-gradient(90deg, #2A57B0, #7B85C8)", borderRadius: 3 }} />
                      </div>
                      <p style={{ fontSize: 9, color: "#8AAABF", marginTop: 4 }}>Yaxşı gedir! Davam edin 💙</p>
                    </div>
                  </div>

                  {/* Bottom content */}
                  <div style={{ padding: "4px 16px 18px" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 12,
                      background: "#F0F6FF", border: "1px solid #DDE8F5", marginBottom: 10,
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                        background: "#3B6FA5", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700,
                      }}>AM</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#0F1C2E", marginBottom: 1 }}>Aynur Məmmədova</p>
                        <p style={{ fontSize: 11, color: "#8AAABF" }}>Klinik Psixoloq · 8 il</p>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ADE80" }} />
                    </div>

                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 12,
                      border: "1px solid #EEF4F9", marginBottom: 12,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: "#EEF4FF",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <svg width="15" height="15" fill="none" stroke="#3B6FA5" strokeWidth="1.8" viewBox="0 0 24 24">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                          <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#0F1C2E" }}>Bu gün, 15:00</p>
                        <p style={{ fontSize: 10, color: "#8AAABF" }}>45 dəq · Video zəng</p>
                      </div>
                    </div>

                    <button style={{
                      width: "100%", padding: "10px", borderRadius: 10,
                      background: "#2A57B0", color: "#fff",
                      fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer",
                    }}>
                      Seansa qoşul →
                    </button>
                  </div>
                </div>

                {/* Floating badge — bottom left */}
                <div
                  style={{
                    position: "absolute",
                    bottom: -18,
                    left: -32,
                    background: "#fff",
                    borderRadius: 16,
                    padding: "12px 16px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
                    minWidth: 160,
                    transform: "rotateY(-14deg) rotateX(6deg)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ADE80" }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#0F1C2E" }}>İndi onlayn</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0F1C2E" }}>6 psixoloq hazırdır</p>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
