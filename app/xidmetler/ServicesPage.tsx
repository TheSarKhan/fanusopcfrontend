"use client";

import { useBooking } from "@/context/BookingContext";

const services = [
  {
    icon: (
      <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Fərdi Terapiya",
    tagline: "Özünüzlə baş-başa",
    description: "Peşəkar psixoloq ilə məxfi, dərin söhbətlər vasitəsilə daxili aləminizi kəşf edin. Hər seans sizin sürətinizlə irəliləyir.",
    features: ["Həftəlik seans planlaması", "Məxfi və etibarlı mühit", "Fərdi yanaşma", "İrəliləmə izləmə"],
    color: "#002147",
    bg: "#E0EBF7",
  },
  {
    icon: (
      <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Cütlük Terapiyası",
    tagline: "Birlikdə daha güclü",
    description: "Münasibətlərinizdə harmoniya qurun. Ortaq problemləri, ünsiyyət çətinliklərini və emosional məsafəni birlikdə aşın.",
    features: ["Birgə seans formatı", "Ünsiyyət texnikaları", "Münaqişə həlli", "Yenidən bağlılıq"],
    color: "#5B3FA5",
    bg: "#EDE9F8",
  },
  {
    icon: (
      <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 21h8M12 17v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Onlayn Seans",
    tagline: "Harada olsanız yanınızdayıq",
    description: "Evinizin rahatlığından çıxmadan psixoloji dəstək alın. Video, səs və ya yazılı formatda seans seçimi sizin ixtiyarınızdadır.",
    features: ["Video/səs/yazılı format", "Çevik cədvəl", "Şifrəli əlaqə", "Bütün cihazlardan giriş"],
    color: "#1A6E5B",
    bg: "#E0F2ED",
  },
  {
    icon: (
      <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M17 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2v4l-4-4H9a1.994 1.994 0 0 1-1.414-.586" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 4H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2v4l4-4h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Qrup Terapiyası",
    tagline: "Birlikdə sağalın",
    description: "Oxşar təcrübələri olan insanlarla qrup seanslarına qoşulun. Qarşılıqlı dəstək, empatiya və paylaşma mühiti.",
    features: ["6-8 nəfərlik qruplar", "Mövzu üzrə seans", "Moderasiya edilmiş mühit", "Aylıq proqram"],
    color: "#B45309",
    bg: "#FEF3C7",
  },
  {
    icon: (
      <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Böhran Dəstəyi",
    tagline: "Çətin anlarda yanınızdayıq",
    description: "Kəskin stress, travma və ya böhran vəziyyətlərində tez müdaxilə. 24 saat ərzində ilkin qiymətləndirmə.",
    features: ["Tez cavab verən komanda", "Fövqəladə seans", "Davamı üçün yönləndirmə", "Anonim müraciət"],
    color: "#BE123C",
    bg: "#FFE4E6",
  },
  {
    icon: (
      <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round" strokeWidth="2.5" />
        <line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
    ),
    title: "Uşaq & Yeniyetmə",
    tagline: "Gənclikdən güclü başlanğıc",
    description: "Uşaqların emosional inkişafı, məktəb stresi, davranış problemləri üçün xüsusi yanaşma. Valideyn konsultasiyası daxildir.",
    features: ["6-18 yaş qrupu", "Oyun terapiyası", "Valideyn birgə seans", "Məktəbəqədər proqram"],
    color: "#0369A1",
    bg: "#E0F2FE",
  },
];

export default function ServicesPage() {
  const { open } = useBooking();

  return (
    <div>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #002147 0%, #1A4A8A 100%)", paddingTop: "calc(64px + 4rem)", paddingBottom: "3rem" }}>
        <div className="container">
          <p className="section-label" style={{ color: "rgba(255,255,255,0.65)" }}>Xidmətlər</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Xidmətlərimiz</h1>
          <p className="text-[rgba(255,255,255,0.75)] max-w-xl text-[1.05rem] leading-relaxed">
            Hər ehtiyac üçün düşünülmüş psixoloji dəstək proqramları. Peşəkar psixoloqlarımız sizinlə birlikdə doğru yolu tapır.
          </p>
          <button
            onClick={() => open()}
            className="btn-primary mt-6"
            style={{ background: "#ffffff", color: "#002147" }}
          >
            İndi Randevu Al
          </button>
        </div>
      </div>

      {/* Services grid */}
      <div className="section" style={{ background: "#F0F4FA" }}>
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {services.map((s) => (
              <div
                key={s.title}
                className="bg-white rounded-2xl overflow-hidden flex flex-col transition-all duration-250"
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
                {/* Color band */}
                <div className="h-1.5 w-full" style={{ background: s.color }} />

                <div className="p-7 flex flex-col flex-1 gap-5">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: s.bg, color: s.color }}>
                      {s.icon}
                    </div>
                    <div>
                      <h2 className="font-bold text-[#0D1B2E] text-lg leading-snug">{s.title}</h2>
                      <p className="text-sm font-medium" style={{ color: s.color }}>{s.tagline}</p>
                    </div>
                  </div>

                  <p className="text-sm text-[#52718F] leading-relaxed">{s.description}</p>

                  <ul className="flex flex-col gap-2 flex-1">
                    {s.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-[#0D1B2E]">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: s.bg }}>
                          <svg width="8" height="8" viewBox="0 0 10 10" fill={s.color}>
                            <path d="M1.5 5.5l2.5 2.5 4.5-5" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          </svg>
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => open()}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 mt-2"
                    style={{ background: s.bg, color: s.color }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.8")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
                  >
                    Randevu al
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA band */}
      <div style={{ background: "#002147", padding: "4rem 0" }}>
        <div className="container text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Hansı xidmət sizə uyğundur?</h2>
          <p className="text-[rgba(255,255,255,0.7)] mb-6 max-w-md mx-auto">
            Psixoloqlarımız ilk görüşdə sizə ən uyğun dəstək proqramını müəyyən etməyə kömək edər.
          </p>
          <button
            onClick={() => open()}
            className="btn-primary"
            style={{ background: "#ffffff", color: "#002147" }}
          >
            Pulsuz ilk görüş
          </button>
        </div>
      </div>
    </div>
  );
}
