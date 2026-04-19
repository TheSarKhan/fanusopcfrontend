"use client";

import { useBooking } from "@/context/BookingContext";

export default function Hero() {
  const { open } = useBooking();
  return (
    <section
      className="relative overflow-hidden pt-16"
      style={{
        background: "linear-gradient(135deg, #2A57B0 0%, #5A4FC8 60%, #7B68D8 100%)",
        minHeight: "92vh",
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
        style={{ minHeight: "calc(92vh - 80px)", paddingTop: "3rem", paddingBottom: "5rem" }}
      >
        <div className="grid lg:grid-cols-2 gap-12 items-center w-full">

          {/* Left */}
          <div className="max-w-xl">
            <div
              className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-white/90 tracking-wide">Onlayn psixoloji dəstək</span>
            </div>

            <h1
              className="text-[2.8rem] sm:text-5xl lg:text-[3.4rem] font-bold leading-[1.1] tracking-tight mb-6"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#ffffff" }}
            >
              Daha yaxşı hiss
              <br />
              etməyə{" "}
              <span style={{ color: "#A8CFFF" }}>bu gün</span>
              <br />
              başlayın
            </h1>

            <p className="text-[1.05rem] leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.78)" }}>
              Sertifikatlı psixoloqlarla güvənli, məxfi və rahat mühitdə
              psixoloji dəstək yolculuğunuza başlayın.
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
                href="#how"
                className="font-semibold px-7 py-3.5 rounded-full text-[0.95rem] transition-all duration-200 hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.9)", border: "1.5px solid rgba(255,255,255,0.35)" }}
              >
                Necə işləyir?
              </a>
            </div>

            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-2">
                {["AM", "EH", "LƏ", "RQ"].map((init, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full border-2 border-white/40 flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: ["#3B82F6","#8B5CF6","#0EA5E9","#6366F1"][i], zIndex: 4 - i }}
                  >
                    {init}
                  </div>
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
                  {/* App header */}
                  <div style={{ background: "#2A57B0", padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "rgba(255,255,255,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 13, fontWeight: 700,
                      }}>F</div>
                      <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Fanus</span>
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ADE80" }} />
                        <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>Onlayn</span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ padding: "18px 18px 20px" }}>

                    {/* Section label */}
                    <p style={{ fontSize: 11, color: "#8AAABF", fontWeight: 600, marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Psixoloqlarınız
                    </p>

                    {/* Psychologist rows */}
                    {[
                      { init: "AM", name: "Aynur Məmmədova", role: "Klinik Psixoloq", color: "#3B6FA5", active: true },
                      { init: "EH", name: "Elnur Hüseynov", role: "Psixoterapevt", color: "#6B5CC8", active: false },
                    ].map((p) => (
                      <div
                        key={p.init}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 12px", borderRadius: 12,
                          background: p.active ? "#F0F6FF" : "transparent",
                          marginBottom: 6,
                          border: p.active ? "1px solid #DDE8F5" : "1px solid transparent",
                        }}
                      >
                        <div style={{
                          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                          background: p.color, color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700,
                        }}>{p.init}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#0F1C2E", marginBottom: 1 }}>{p.name}</p>
                          <p style={{ fontSize: 11, color: "#8AAABF" }}>{p.role}</p>
                        </div>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: p.active ? "#4ADE80" : "#D1D5DB",
                        }} />
                      </div>
                    ))}

                    {/* Divider */}
                    <div style={{ height: 1, background: "#F0F4F9", margin: "14px 0" }} />

                    {/* Next session */}
                    <p style={{ fontSize: 11, color: "#8AAABF", fontWeight: 600, marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Növbəti seans
                    </p>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 12,
                      border: "1px solid #DDE8F5", marginBottom: 14,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, background: "#EEF4FF",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <svg width="17" height="17" fill="none" stroke="#3B6FA5" strokeWidth="1.8" viewBox="0 0 24 24">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                          <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#0F1C2E" }}>Bu gün, 15:00</p>
                        <p style={{ fontSize: 11, color: "#8AAABF" }}>45 dəqiqə · Video zəng</p>
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      style={{
                        width: "100%", padding: "11px", borderRadius: 12,
                        background: "#2A57B0", color: "#fff",
                        fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer",
                      }}
                    >
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
