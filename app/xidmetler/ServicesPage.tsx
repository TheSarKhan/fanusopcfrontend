"use client";

import Link from "next/link";
import { useBooking } from "@/context/BookingContext";
import { useScrollReveal } from "@/lib/useScrollReveal";

const services = [
  {
    key: "ind",
    title: "Fərdi Terapiya",
    tagline: "Özünüzlə baş-başa",
    desc: "Bir psixoloqla, sizə uyğun tempdə işləyin. Narahatlıq, depressiya, özgüvən və həyat dönüşləri üzrə.",
    color: "#002147",
    soft: "rgba(0, 33, 71, 0.07)",
    bullets: ["50 dəq seans", "Sizə uyğun mütəxəssis", "İlk görüş pulsuz", "Həftəlik və ya 2 həftədə bir"],
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    key: "couple",
    title: "Cütlük Terapiyası",
    tagline: "Birlikdə daha güclü",
    desc: "Münasibətdəki gərginliyi yumşaq, neytral məkanda araşdırın. Hər iki tərəf eşidilir.",
    color: "#5B3FA5",
    soft: "rgba(91, 63, 165, 0.08)",
    bullets: ["Hər iki tərəf üçün məkan", "Kommunikasiya alətləri", "Münaqişə həlli", "Etibarın bərpası"],
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: "online",
    title: "Onlayn Seans",
    tagline: "Harada olsanız yanınızdayıq",
    desc: "Brauzer və ya tətbiq. Heç bir quraşdırma yoxdur. Evdən, ofisdən və ya yoldan iştirak edin.",
    color: "#1A6E5B",
    soft: "rgba(26, 110, 91, 0.08)",
    bullets: ["Şifrələnmiş video", "Mobil və masaüstü", "Xatırlatma bildirişləri", "Asan dəyişdirmə"],
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    key: "group",
    title: "Qrup Terapiyası",
    tagline: "Birlikdə sağalın",
    desc: "8-12 nəfərlik kiçik qrup. Eyni mövzunu yaşayan insanlarla peşəkar rəhbərlikdə.",
    color: "#B45309",
    soft: "rgba(180, 83, 9, 0.08)",
    bullets: ["8-12 nəfərlik qrup", "Həftəlik 90 dəq", "Tematik sessiyalar", "Qarşılıqlı dəstək"],
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    key: "crisis",
    title: "Böhran Dəstəyi",
    tagline: "Çətin anlarda yanınızdayıq",
    desc: "Kəskin emosional ağrıda yumşaq, peşəkar müşayiət. Heç bir mühakimə yoxdur — yalnız dəstək.",
    color: "#BE123C",
    soft: "rgba(190, 18, 60, 0.07)",
    bullets: ["24 saat ərzində cavab", "Kəskin sessiyalar", "Davamlı plan", "113 ilə əməkdaşlıq"],
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    key: "kids",
    title: "Uşaq & Yeniyetmə",
    tagline: "Gənclikdən güclü başlanğıc",
    desc: "8-18 yaş üçün xüsusi olaraq hazırlanmış format. Valideyn ilə birlikdə yumşaq yanaşma.",
    color: "#0369A1",
    soft: "rgba(3, 105, 161, 0.08)",
    bullets: ["Yaşa uyğun yanaşma", "Valideyn iclasları", "Oyun terapiyası", "Məktəb əlaqəsi"],
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" />
        <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
      </svg>
    ),
  },
];

function HeroRight() {
  return (
    <div className="sv-hero-right" aria-hidden>
      <div className="sv-orbit" />
      <div className="sv-float sv-float-1">
        <div className="sv-float-icon" style={{ background: "rgba(74,155,127,0.15)", color: "#1A6E5B" }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--oxford)" }}>Yaxşı hiss edirəm</div>
          <div style={{ fontSize: 11, color: "var(--oxford-60)" }}>3 gün ardıcıl</div>
        </div>
      </div>
      <div className="sv-float sv-float-2">
        <div className="sv-float-icon" style={{ background: "rgba(140,125,201,0.15)", color: "#5B3FA5" }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--oxford)" }}>Növbəti seans</div>
          <div style={{ fontSize: 11, color: "var(--oxford-60)" }}>Cümə · 14:00</div>
        </div>
      </div>
      <div className="sv-float sv-float-3">
        <div className="sv-float-icon" style={{ background: "rgba(201,125,46,0.15)", color: "#B45309" }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--oxford)" }}>Nəfəs məşqi</div>
          <div style={{ fontSize: 11, color: "var(--oxford-60)" }}>5 dəq · indi</div>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const { open } = useBooking();
  const { ref: heroRef, visible: heroVisible } = useScrollReveal<HTMLDivElement>(0.05);
  const { ref: gridRef, visible: gridVisible } = useScrollReveal<HTMLElement>(0.05);
  const { ref: stripRef, visible: stripVisible } = useScrollReveal<HTMLElement>(0.1);

  return (
    <main className="sv-page">

      {/* HERO */}
      <section className="sv-hero">
        <div className="sv-hero-blob sv-hero-blob-1" />
        <div className="sv-hero-blob sv-hero-blob-2" />
        <div className="container sv-hero-grid" ref={heroRef}>
          <div
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(24px)",
              transition: "opacity 0.7s ease, transform 0.7s ease",
            }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--oxford-60)" }}>
              Xidmətlər
            </p>
            <h1 className="sv-hero-title" style={{ fontFamily: "var(--serif)", color: "var(--oxford)" }}>
              Hansı dəstəyə<br />ehtiyacınız var?
            </h1>
            <p className="sv-hero-sub">
              Hər ehtiyac üçün düşünülmüş psixoloji proqramlar. Sizin tempinizdə, sizin dilinizdə.
            </p>
            <Link
              href="/register"
              className="btn btn-primary"
              style={{ borderRadius: "var(--r-btn)", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              Pulsuz başla — qeydiyyat
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateX(0)" : "translateX(32px)",
              transition: "opacity 0.7s ease 0.15s, transform 0.7s ease 0.15s",
            }}
          >
            <HeroRight />
          </div>
        </div>
      </section>

      {/* SERVICES GRID */}
      <section className="sv-grid-section" ref={gridRef}>
        <div className="container">
          <div
            className="text-center mb-14"
            style={{
              opacity: gridVisible ? 1 : 0,
              transform: gridVisible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.6s ease, transform 0.6s ease",
            }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--oxford-60)" }}>
              Proqramlar
            </p>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(28px,3.2vw,40px)", color: "var(--oxford)", marginBottom: 12 }}>
              Sizə uyğun olanı seçin
            </h2>
            <p style={{ color: "var(--oxford-60)", fontSize: 16, maxWidth: 520, margin: "0 auto" }}>
              Əmin deyilsiniz? Pulsuz 15 dəqiqəlik uyğunluq görüşü sizə kömək edər.
            </p>
          </div>

          <div className="sv-grid">
            {services.map((s, i) => (
              <div
                className="sv-card"
                key={s.key}
                style={{
                  opacity: gridVisible ? 1 : 0,
                  transform: gridVisible ? "translateY(0)" : "translateY(24px)",
                  transition: `opacity 0.6s ease ${0.05 * i}s, transform 0.6s ease ${0.05 * i}s`,
                }}
              >
                <div className="sv-card-icon" style={{ background: s.soft, color: s.color }}>
                  {s.icon}
                </div>
                <h3>{s.title}</h3>
                <div className="sv-tagline" style={{ color: s.color }}>{s.tagline}</div>
                <p>{s.desc}</p>
                <ul className="sv-bullets">
                  {s.bullets.map((b) => (
                    <li key={b}>
                      <span className="sv-check" style={{ background: s.soft, color: s.color }}>
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="sv-cta"
                  style={{ background: s.soft, color: s.color, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
                >
                  Başla
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHICH SERVICE STRIP */}
      <section className="sv-strip" ref={stripRef}>
        <div
          className="container sv-strip-inner"
          style={{
            opacity: stripVisible ? 1 : 0,
            transform: stripVisible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--oxford-60)" }}>
            Haradan başlamaq lazımdır?
          </p>
          <h2>Hələ əmin deyilsiniz?<br />Psixoloqlarımızla tanış olun</h2>
          <p>
            Sahə, yanaşma və təcrübəyə görə filtirləyin — sizə ən uyğun mütəxəssisi tapın. İlk tanışlıq seansı ödənişsizdir.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/psychologists"
              className="btn btn-primary"
              style={{ borderRadius: "var(--r-btn)", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              Psixoloqlara bax
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="/register" className="btn btn-ghost" style={{ borderRadius: "var(--r-btn)" }}>
              Qeydiyyat
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
