"use client";

import { useBooking } from "@/context/BookingContext";

export default function FinalCTA() {
  const { open } = useBooking();
  return (
    <section
      id="cta"
      className="section"
      style={{ background: "linear-gradient(160deg, #1E4070 0%, #3B6FA5 100%)" }}
    >
      <div className="container">
        <div className="relative max-w-3xl mx-auto text-center">
          {/* Decorative shapes */}
          <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full opacity-10 border-2 border-white pointer-events-none" />
          <div className="absolute -bottom-8 -right-8 w-24 h-24 opacity-10 border-2 border-white pointer-events-none"
               style={{ borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%" }} />

          <div className="relative z-10">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-8"
              style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
            >
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Psixoloqlarımız hazırdır
            </div>

            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6"
              style={{ fontFamily: "var(--font-playfair, serif)" }}
            >
              İlk addımı atmağa hazırsınız?
            </h2>

            <p className="text-lg text-white/75 leading-relaxed mb-10 max-w-xl mx-auto">
              Özünüzə qulluq etmək güclüdür. Peşəkar dəstəklə həyatınızı daha
              yaxşı bir istiqamətə yönləndirib bilərsiniz.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => open()}
                className="flex items-center gap-2 bg-white text-[#1E4070] font-bold px-8 py-4 rounded-full text-base hover:bg-[#F4F8FC] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                  <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Randevu al
              </button>
              <a
                href="#psychologists"
                className="flex items-center gap-2 text-white/85 font-semibold px-6 py-4 rounded-full border border-white/30 hover:bg-white/10 transition-all duration-200"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
                </svg>
                Psixoloq seç
              </a>
            </div>

            {/* Micro trust signals */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-white/60 text-sm">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Öhdəlik tələb olunmur
              </div>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" />
                </svg>
                100% məxfi
              </div>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" strokeLinecap="round" />
                </svg>
                24 saat ərzində cavab
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
