"use client";

import { useBooking } from "@/context/BookingContext";

const STEPS = [
  {
    num: 1,
    color: "#002147",
    accent: "#3B6FA5",
    bg: "#fff",
    badgeBg: "#EBF2FF",
    title: "Psixoloqunu seç",
    text: "Sertifikatlı mütəxəssislər arasından ixtisasına, yanaşmasına və rəylərinə görə sizə uyğun psixoloqu seçin.",
    badge: "Uyğun eşləşmə",
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    num: 2,
    color: "#7C3AED",
    accent: "#9B5CF0",
    bg: "#fff",
    badgeBg: "#F3EEFF",
    title: "Pulsuz tanışlıq seansı",
    text: "Seçdiyiniz psixoloqula 15 dəqiqəlik pulsuz konsultasiya keçirin. Uyğunluğu yoxlayın, suallarınızı soruşun.",
    badge: "Pulsuz · 15 dəqiqə",
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    num: 3,
    color: "#0D9488",
    accent: "#14B8A6",
    bg: "#fff",
    badgeBg: "#EFFAF8",
    title: "Şəxsi dəstəyinizi alın",
    text: "Sizə xas terapiya planı ilə emosional sağlamlığınıza doğru addım atın. Video, səs və ya yazılı formatda.",
    badge: "Onlayn · 7/24",
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const { open } = useBooking();

  return (
    <section className="section" style={{ background: "#F8FAFD" }}>
      <div className="container">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <p className="section-label justify-center">Necə işləyir?</p>
          <h2
            className="text-3xl sm:text-[2.4rem] font-bold leading-snug mb-4"
            style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
          >
            3 addımda psixoloji dəstəyə başla
          </h2>
          <p className="text-[#52718F] text-[0.97rem] leading-relaxed">
            Qeydiyyatdan seansa qədər — sadə, sürətli və tam məxfi proses.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="rounded-2xl p-7 flex flex-col gap-5"
              style={{
                background: step.bg,
                border: "1px solid #E4EDF6",
                boxShadow: "0 2px 16px rgba(0,33,71,0.05)",
              }}
            >
              {/* Step number pill + icon */}
              <div className="flex items-center justify-between">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: step.badgeBg,
                    color: step.color,
                  }}
                >
                  {step.icon}
                </div>
                <span
                  className="text-5xl font-black leading-none select-none"
                  style={{ color: "#E8EFF7", fontFamily: "var(--font-playfair, serif)" }}
                >
                  {step.num < 10 ? `0${step.num}` : step.num}
                </span>
              </div>

              {/* Badge */}
              <span
                className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full w-fit"
                style={{ background: step.badgeBg, color: step.color }}
              >
                {step.badge}
              </span>

              {/* Text */}
              <div>
                <h3
                  className="text-[1.05rem] font-bold mb-2"
                  style={{ color: "#0F1C2E" }}
                >
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#52718F" }}>
                  {step.text}
                </p>
              </div>

              {/* Bottom accent line */}
              <div
                className="h-0.5 rounded-full mt-auto"
                style={{ background: `linear-gradient(90deg, ${step.color}, ${step.accent}44)` }}
              />
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => open()}
            className="inline-flex items-center gap-2.5 font-bold py-4 px-8 rounded-full text-white text-[0.95rem] transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, #002147, #2A57B0)",
              boxShadow: "0 8px 28px rgba(0,33,71,0.22)",
            }}
          >
            İndi başla — pulsuz tanışlıq seansı al
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="mt-3 text-xs" style={{ color: "#8AACCA" }}>Kredit kartı tələb olunmur</p>
        </div>
      </div>
    </section>
  );
}
