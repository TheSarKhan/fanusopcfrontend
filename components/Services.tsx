"use client";

import { useBooking } from "@/context/BookingContext";

const services = [
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Fərdi Terapiya",
    description: "Özünüzlə baş-başa qalın. Peşəkar psixoloq ilə məxfi, dərin söhbətlər vasitəsilə daxili aləminizi kəşf edin.",
    color: "#002147",
    bg: "#E0EBF7",
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Cütlük Terapiyası",
    description: "Münasibətlərinizdə harmoniya qurun. Ortaq problemləri birlikdə həll etmək üçün peşəkar dəstək alın.",
    color: "#5B3FA5",
    bg: "#EDE9F8",
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 21h8M12 17v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Onlayn Seans",
    description: "Evinizin rahatlığından çıxmadan psixoloji dəstək alın. Video, səs və ya yazılı formatda seans seçimi.",
    color: "#1A6E5B",
    bg: "#E0F2ED",
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2v4l-4-4H9a1.994 1.994 0 0 1-1.414-.586" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 4H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2v4l4-4h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Qrup Terapiyası",
    description: "Oxşar təcrübələri olan insanlarla qrup seanslarına qoşulun. Birlikdə inkişaf edin, bir-birinizi dəstəkləyin.",
    color: "#B45309",
    bg: "#FEF3C7",
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Böhran Dəstəyi",
    description: "Çətin anlarda yanınızdayıq. Kəskin stress, travm və ya böhran vəziyyətlərində tez müdaxilə xidməti.",
    color: "#BE123C",
    bg: "#FFE4E6",
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round" strokeWidth="2.5" />
        <line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
    ),
    title: "Uşaq & Yeniyetmə",
    description: "Gənclərin emosional inkişafı üçün xüsusi yanaşma. Valideynlər üçün də dəstək proqramları mövcuddur.",
    color: "#0369A1",
    bg: "#E0F2FE",
  },
];

export default function Services() {
  const { open } = useBooking();

  return (
    <section id="services" className="section" style={{ background: "#F0F4FA" }}>
      <div className="container">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <p className="section-label">Xidmətlər</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0D1B2E]">
              Xidmətlərimiz
            </h2>
            <p className="mt-3 text-[#52718F] max-w-md text-[0.95rem] leading-relaxed">
              Hər ehtiyac üçün düşünülmüş psixoloji dəstək proqramları.
            </p>
          </div>
          <a href="/xidmetler" className="btn-outline self-start sm:self-auto text-sm py-2.5 px-5">
            Ətraflı bax →
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s) => (
            <div
              key={s.title}
              className="group bg-white rounded-2xl p-6 flex flex-col gap-4 transition-all duration-250 cursor-default"
              style={{ border: "1px solid #E4EDF6" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,33,71,0.10)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: s.bg, color: s.color }}
              >
                {s.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[#0D1B2E] text-[1rem] mb-2">{s.title}</h3>
                <p className="text-sm text-[#52718F] leading-relaxed">{s.description}</p>
              </div>
              <button
                onClick={() => open()}
                className="text-xs font-semibold flex items-center gap-1.5 transition-colors mt-1"
                style={{ color: s.color }}
              >
                Randevu al
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
