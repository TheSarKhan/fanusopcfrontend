"use client";

const steps = [
  {
    num: "1",
    title: "Psixoloq seç",
    desc: "İxtisas, yanaşma tərzi və qiymətə görə sizə uyğun psixoloqu seçin. Filtrlər vasitəsilə axtarışı asanlaşdırın.",
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
      </svg>
    ),
    color: "#3B6FA5",
    bg: "#EEF4FB",
  },
  {
    num: "2",
    title: "Müraciət göndər",
    desc: "Seçdiyiniz psixoloqa müraciət edin. Əlverişli vaxt seçin — sistem sizin üçün xatırlatma göndərəcəkdir.",
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M8 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6M9 13h6M9 17h4" strokeLinecap="round" />
      </svg>
    ),
    color: "#7B85C8",
    bg: "#ECEEF8",
  },
  {
    num: "3",
    title: "Seansa başla",
    desc: "Onlayn video zəng və ya üz-üzə formatda rahat, məxfi mühitdə psixoloji yardım alın.",
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "#3B6FA5",
    bg: "#EEF4FB",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="section" style={{ background: "#ffffff" }}>
      <div className="container">
        <div className="text-center mb-12">
          <p className="section-label justify-center">Sadə proses</p>
          <h2
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
          >
            Necə işləyir?
          </h2>
          <p className="text-[#6B85A0] max-w-md mx-auto text-[0.9375rem] leading-relaxed">
            Cəmi 3 addımda psixoloji dəstək almağa başlaya bilərsiniz.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="relative bg-white rounded-2xl p-7 flex flex-col gap-5 group transition-all duration-300"
              style={{
                boxShadow: "0 2px 12px rgba(26,37,53,0.07)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(26,37,53,0.12)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(26,37,53,0.07)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
              }}
            >
              {/* Step number — top right, subtle */}
              <span
                className="absolute top-5 right-6 font-bold tabular-nums"
                style={{
                  fontSize: "3.5rem",
                  color: step.bg,
                  fontFamily: "var(--font-playfair, serif)",
                  lineHeight: 1,
                  userSelect: "none",
                }}
              >
                {step.num}
              </span>

              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 relative z-10"
                style={{ background: step.bg, color: step.color }}
              >
                {step.icon}
              </div>

              {/* Content */}
              <div className="relative z-10">
                <h3 className="font-bold text-[#1A2535] text-lg mb-2">{step.title}</h3>
                <p className="text-[#6B85A0] text-sm leading-relaxed">{step.desc}</p>
              </div>

              {/* Arrow connector (between cards, desktop only) */}
              {i < steps.length - 1 && (
                <div
                  className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full items-center justify-center bg-white"
                  style={{ boxShadow: "0 2px 8px rgba(26,37,53,0.12)" }}
                >
                  <svg width="14" height="14" fill="none" stroke="#3B6FA5" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <a href="#psychologists" className="btn-primary">
            İndi başla
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <p className="text-xs text-[#6B85A0] mt-3">Öhdəlik tələb olunmur · Pulsuz ilk məsləhət</p>
        </div>
      </div>
    </section>
  );
}
