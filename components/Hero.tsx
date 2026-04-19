"use client";

import { useBooking } from "@/context/BookingContext";

export default function Hero() {
  const { open } = useBooking();
  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden pt-20"
      style={{ background: "#FAFCFF" }}
    >
      {/* Single subtle top-right accent — not a blob, just a clean shape */}
      <div
        className="absolute top-0 right-0 w-[520px] h-[520px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at top right, #E4EEF8 0%, transparent 65%)",
        }}
      />

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-6 animate-fadeUp">
              <div className="w-1.5 h-1.5 rounded-full bg-[#3B6FA5]" />
              <span className="text-xs font-semibold tracking-widest uppercase text-[#3B6FA5]">
                Psixoloji Yardım Mərkəzi
              </span>
            </div>

            <h1
              className="text-[2.75rem] sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight mb-6 animate-fadeUp delay-100"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#0F1C2E" }}
            >
              Özünüzü
              <br />
              <span style={{ color: "#3B6FA5" }}>güvəndə</span> hiss
              <br />
              etmək üçün.
            </h1>

            <p className="text-[1.05rem] text-[#5A7490] leading-relaxed mb-10 animate-fadeUp delay-200">
              Sertifikatlı mütəxəssislərimiz sizinlə birlikdə hər addımda.
              Peşəkar, məxfi, empatik dəstək.
            </p>

            <div className="flex flex-wrap gap-3 animate-fadeUp delay-300">
              <button onClick={() => open()} className="btn-primary">
                Randevu al
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <a href="#psychologists" className="btn-outline">
                Psixoloq seç
              </a>
            </div>

            {/* Simple trust row */}
            <div className="mt-12 flex flex-wrap items-center gap-6 animate-fadeUp delay-400">
              <div className="flex items-center gap-2">
                <svg width="15" height="15" fill="none" stroke="#3B6FA5" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm text-[#5A7490]">Sertifikatlı mütəxəssislər</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="15" height="15" fill="none" stroke="#3B6FA5" strokeWidth="2.5" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" />
                </svg>
                <span className="text-sm text-[#5A7490]">Tam məxfilik</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="15" height="15" fill="none" stroke="#3B6FA5" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
                </svg>
                <span className="text-sm text-[#5A7490]">1000+ uğurlu seans</span>
              </div>
            </div>
          </div>

          {/* Right: Editorial block */}
          <div className="hidden lg:flex flex-col gap-4 animate-fadeUp delay-200">
            {/* Testimonial */}
            <div
              className="bg-white rounded-2xl p-7"
              style={{ border: "1px solid #E0EAF4", boxShadow: "0 2px 20px rgba(15,28,46,0.05)" }}
            >
              <div className="flex gap-0.5 mb-5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#3B6FA5">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <blockquote
                className="text-[#0F1C2E] text-[1.05rem] leading-relaxed mb-6"
                style={{ fontFamily: "var(--font-playfair, serif)" }}
              >
                "Həyatımın ən çətin dövründə Fanus məni düzgün istiqamətə yönəltdi. İlk seansdan sonra fərqi hiss etdim."
              </blockquote>
              <div
                className="flex items-center gap-3 pt-4"
                style={{ borderTop: "1px solid #EEF4FB" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: "#3B6FA5" }}
                >
                  LM
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F1C2E]">Leyla M.</p>
                  <p className="text-xs text-[#5A7490]">Bakı · Fərdi terapiya</p>
                </div>
                <p className="ml-auto text-xs text-[#8AAABF]">2 həftə əvvəl</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { num: "500+", label: "Aktiv müştəri" },
                { num: "4.9", label: "Ortalama reytinq" },
                { num: "5 il", label: "Bazarda" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded-xl p-4 text-center"
                  style={{ border: "1px solid #E0EAF4" }}
                >
                  <p
                    className="text-xl font-bold text-[#3B6FA5]"
                    style={{ fontFamily: "var(--font-playfair, serif)" }}
                  >
                    {s.num}
                  </p>
                  <p className="text-[11px] text-[#5A7490] mt-1 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Online now */}
            <div
              className="flex items-center gap-3 bg-white rounded-xl px-5 py-4"
              style={{ border: "1px solid #E0EAF4" }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0"
                style={{ boxShadow: "0 0 0 4px rgba(52,211,153,0.18)" }}
              />
              <div>
                <p className="text-sm font-semibold text-[#0F1C2E]">İndi onlayn seans mövcuddur</p>
                <p className="text-xs text-[#5A7490]">6 psixoloq hazırdır</p>
              </div>
              <button
                onClick={() => open()}
                className="ml-auto text-xs font-semibold text-[#3B6FA5] hover:text-[#1E4070] transition-colors"
              >
                Randevu al →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
