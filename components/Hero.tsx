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
      {/* Soft wave at bottom */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 80 }}>
          <path d="M0 40 Q360 80 720 40 Q1080 0 1440 40 L1440 80 L0 80 Z" fill="#ffffff" />
        </svg>
      </div>

      <div className="container relative z-10 flex items-center" style={{ minHeight: "calc(92vh - 80px)", paddingTop: "3rem", paddingBottom: "5rem" }}>
        <div className="grid lg:grid-cols-2 gap-12 items-center w-full">

          {/* Left: Text */}
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
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

            {/* Social proof */}
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
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Dünya genelinde 1000+ seans tamamlandı</p>
              </div>
            </div>
          </div>

          {/* Right: Photo area */}
          <div className="hidden lg:flex justify-end items-center">
            <div className="relative w-[440px] h-[480px]">

              {/* Main photo card */}
              <div
                className="absolute inset-0 rounded-3xl overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(2px)",
                  border: "1.5px solid rgba(255,255,255,0.25)",
                }}
              >
                <img
                  src="/images/hero-main.jpg"
                  alt="Fanus Psixoloji Mərkəz"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Small overlay card — bottom left */}
              <div
                className="absolute -bottom-4 -left-8 bg-white rounded-2xl p-4 min-w-[180px]"
                style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-semibold text-[#1A2535]">İndi onlayn</span>
                </div>
                <p className="text-sm font-bold text-[#1A2535]">6 psixoloq hazırdır</p>
                <p className="text-xs text-[#6B85A0] mt-0.5">Orta gözləmə: 24 saat</p>
              </div>

              {/* Rating pill — top right */}
              <div
                className="absolute -top-3 -right-4 bg-white rounded-2xl px-4 py-2.5"
                style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
              >
                <div className="flex items-center gap-1.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                  <span className="text-sm font-bold text-[#1A2535] ml-1">4.9</span>
                </div>
                <p className="text-[10px] text-[#6B85A0] mt-0.5 text-center">200+ rəy</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
