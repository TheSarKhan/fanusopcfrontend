const testimonials = [
  {
    quote: "Fanus ilə ilk seanstan sonra özümü çox yüngül hiss etdim. Psixoloq məni tam anladı, mühakimə etmədi. Həyatımın ən yaxşı qərarlarından biri idi.",
    name: "Aytən M.",
    role: "2 ildir müştəri",
    initials: "AM",
    rating: 5,
    gradient: "linear-gradient(135deg, #1E4070, #3B6FA5)",
  },
  {
    quote: "Ailə problemlərimizə həll yolu tapmaqda böyük kömək etdilər. Artıq münasibətimiz çox daha sağlam bir yerdədir. Tövsiyə edirəm.",
    name: "Tural H.",
    role: "1 ildir müştəri",
    initials: "TH",
    rating: 5,
    gradient: "linear-gradient(135deg, #1a1f4d, #7B85C8)",
  },
  {
    quote: "Onlayn seans imkanı mənim üçün çox əlverişli oldu. Rahatlığım yerindədir, məxfilik tam qorunur. Psixoloq çox peşəkardır.",
    name: "Ləman K.",
    role: "8 aydır müştəri",
    initials: "LK",
    rating: 5,
    gradient: "linear-gradient(135deg, #1C3555, #5B8FCA)",
  },
];

const certifications = [
  "Azərbaycan Psixoloqlar Assosiasiyası",
  "CBT (Kognitiv-Davranış Terapiyası)",
  "EMDR Sertifikatı",
  "Mindfulness Terapiyası",
  "Ailə Sistemlər Terapiyası",
];

const trustMetrics = [
  { value: "4.9/5", label: "Orta reytinq" },
  { value: "100%", label: "Məxfilik" },
  { value: "1200+", label: "Seans" },
  { value: "5 il", label: "Təcrübə" },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="14" height="14" fill="#F59E0B" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export default function Trust() {
  return (
    <section className="section" style={{ background: "#F0F5FB" }}>
      <div className="container">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="section-label justify-center">Müştəri rəyləri</p>
          <h2
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
          >
            Onlar bizə güvəndilər
          </h2>
          <p className="text-[#6B85A0] max-w-sm mx-auto text-sm leading-relaxed">
            Hər müştərimizin hekayəsi bizim üçün xüsusidir.
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white rounded-2xl p-6 flex flex-col gap-4"
              style={{ boxShadow: "0 2px 12px rgba(26,37,53,0.07)" }}
            >
              {/* Stars */}
              <Stars count={t.rating} />

              {/* Quote */}
              <p className="text-[#1A2535] text-sm leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4" style={{ borderTop: "1px solid #EEF4FB" }}>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: t.gradient }}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="font-semibold text-[#1A2535] text-sm">{t.name}</p>
                  <p className="text-xs text-[#6B85A0]">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust metrics row */}
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow: "0 2px 12px rgba(26,37,53,0.07)" }}
        >
          {/* Top row: metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: "#EEF4FB" }}>
            {trustMetrics.map((m) => (
              <div key={m.label} className="py-6 px-6 text-center bg-white">
                <p
                  className="font-bold text-2xl text-[#3B6FA5] mb-1"
                  style={{ fontFamily: "var(--font-playfair, serif)" }}
                >
                  {m.value}
                </p>
                <p className="text-xs text-[#6B85A0]">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Bottom row: certifications */}
          <div className="px-6 py-5" style={{ borderTop: "1px solid #EEF4FB" }}>
            <p className="text-xs font-semibold text-[#6B85A0] uppercase tracking-wider mb-4">
              Sertifikatlar & Akkreditasiyalar
            </p>
            <div className="flex flex-wrap gap-2">
              {certifications.map((c) => (
                <span
                  key={c}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{ background: "#EEF4FB", color: "#3B6FA5" }}
                >
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
