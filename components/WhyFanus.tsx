"use client";

const PILLARS = [
  {
    color: "#002147",
    bg: "#EBF2FF",
    icon: (
      <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Sertifikatlı Psixoloqlar",
    text: "Beynəlxalq akkreditasiyaya malik, etik standartlara sadiq klinik psixoloqlar.",
  },
  {
    color: "#7C3AED",
    bg: "#F3EEFF",
    icon: (
      <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
        <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
        <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 2l4 4-4 4M22 6h-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Fərdi Yanaşma",
    text: "Sizi anlamağa əsaslanan, tamamilə sizə uyğunlaşdırılmış psixoloji dəstək planı.",
  },
  {
    color: "#0D9488",
    bg: "#EFFAF8",
    icon: (
      <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 21h8M12 17v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Hər Yerdən Əlçatan",
    text: "Evinizin rahatlığından çıxmadan, video və ya yazılı formatda seans keçirin.",
  },
  {
    color: "#BE123C",
    bg: "#FFF1F2",
    icon: (
      <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "100% Məxfilik",
    text: "Söhbətləriniz tamamilə gizlidir. Məlumatlarınız heç bir üçüncü tərəflə paylaşılmaz.",
  },
  {
    color: "#D97706",
    bg: "#FFF8EE",
    icon: (
      <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 4 12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Doğrulanmış Mütəxəssislər",
    text: "Bütün psixoloqlar ətraflı müsahibə, sənəd yoxlaması və qiymətləndirmədən keçir.",
  },
];

export default function WhyFanus() {
  return (
    <section className="section" style={{ background: "#fff" }}>
      <div className="container">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <p className="section-label justify-center">Niyə Fanus?</p>
          <h2
            className="text-3xl sm:text-[2.4rem] font-bold leading-snug mb-4"
            style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
          >
            Psixoloji dəstəkdə fərq yaradan 5 səbəb
          </h2>
          <p className="text-[#52718F] text-[0.97rem] leading-relaxed">
            Hər detalı düşünülmüş, insana hörmətlə yanaşan bir platforma.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PILLARS.map((p, i) => (
            <div
              key={p.title}
              className="rounded-2xl p-6 flex flex-col gap-4 transition-all duration-200"
              style={{
                background: p.bg,
                border: `1px solid ${p.color}18`,
                gridColumn: i === 3 ? "1 / span 1" : undefined,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 10px 32px ${p.color}18`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#fff", color: p.color, boxShadow: `0 4px 14px ${p.color}20` }}
              >
                {p.icon}
              </div>
              <div>
                <h3 className="font-bold text-[#0F1C2E] text-[1rem] mb-1.5">{p.title}</h3>
                <p className="text-sm text-[#52718F] leading-relaxed">{p.text}</p>
              </div>
            </div>
          ))}

          {/* 6th cell: CTA card */}
          <div
            className="rounded-2xl p-6 flex flex-col justify-between"
            style={{
              background: "linear-gradient(135deg, #002147 0%, #2A57B0 100%)",
              border: "none",
            }}
          >
            <p
              className="text-lg font-bold text-white leading-snug mb-4"
              style={{ fontFamily: "var(--font-playfair, serif)" }}
            >
              İlk addımı bu gün atın
            </p>
            <a
              href="/register"
              className="inline-flex items-center gap-2 text-sm font-bold py-3 px-5 rounded-xl transition-all duration-200 hover:opacity-90"
              style={{ background: "#fff", color: "#002147", width: "fit-content" }}
            >
              Başla
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
