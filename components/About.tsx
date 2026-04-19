export default function About() {
  const values = [
    {
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: "Empatiya",
      desc: "Hər bir insanı unikal olaraq qəbul edir, mühakimə etmədən dinləyirik.",
    },
    {
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" />
        </svg>
      ),
      title: "Məxfilik",
      desc: "Bütün məlumatlarınız tam gizlilik altında qorunur. Əminliklə danışın.",
    },
    {
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: "Peşəkarlıq",
      desc: "Hər psixoloqumuz sertifikatlı, sürekli öyrənən və təcrübəli mütəxəssisdir.",
    },
    {
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: "Dəyişim",
      desc: "Kiçik addımlarla böyük həyat dəyişikliklərinə birlikdə nail oluruq.",
    },
  ];

  return (
    <section id="about" className="section" style={{ background: "#ffffff" }}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: visual */}
          <div className="relative order-2 lg:order-1">
            <div
              className="rounded-[2rem] overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #E4EEF8 0%, #EDE9F8 100%)",
                aspectRatio: "4/5",
                maxHeight: 520,
              }}
            >
              {/* Abstract warm illustration */}
              <div className="relative w-full h-full p-8 flex flex-col justify-between">
                <div className="flex justify-end">
                  <div
                    className="w-24 h-24 rounded-full opacity-40"
                    style={{ background: "#3B6FA5" }}
                  />
                </div>
                <div className="space-y-4">
                  <div className="h-2 rounded-full bg-[#3B6FA5] opacity-30 w-3/4" />
                  <div className="h-2 rounded-full bg-[#7B85C8] opacity-40 w-1/2" />
                  <div className="h-2 rounded-full bg-[#3B6FA5] opacity-20 w-5/6" />
                </div>
                <div className="flex items-end justify-between">
                  <div
                    className="w-32 h-32 rounded-[2rem] opacity-30"
                    style={{ background: "#7B85C8" }}
                  />
                  <div
                    className="w-16 h-16 rounded-full opacity-25"
                    style={{ background: "#1E4070" }}
                  />
                </div>
              </div>
            </div>

            {/* Floating quote */}
            <div
              className="absolute -bottom-6 -right-4 lg:-right-8 bg-white rounded-2xl shadow-xl p-5 max-w-[220px]"
              style={{ border: "1px solid #D5E3F0" }}
            >
              <p className="text-sm text-[#1A2535] font-medium leading-snug">
                "Sağlamlığınız bizim prioritetimizdir."
              </p>
              <p className="text-xs text-[#6B85A0] mt-2">— Fanus Komandası</p>
            </div>

            {/* Founding year badge */}
            <div
              className="absolute -top-4 -left-4 w-20 h-20 rounded-full flex flex-col items-center justify-center text-center"
              style={{ background: "#3B6FA5", color: "white" }}
            >
              <span className="text-xs opacity-80">Yaranıb</span>
              <span className="text-lg font-bold leading-tight">2019</span>
            </div>
          </div>

          {/* Right: text */}
          <div className="order-1 lg:order-2">
            <p className="section-label">Haqqımızda</p>
            <h2
              className="text-3xl sm:text-4xl font-bold leading-tight mb-6"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
            >
              Fanus — işığı olan bir yer
            </h2>
            <p className="text-[#6B85A0] text-lg leading-relaxed mb-5">
              Fanus Psixoloji Mərkəzi 2019-cu ildə insanlara emosional
              sağlamlıq sahəsində peşəkar, məxfi və insan mərkəzli dəstək
              göstərmək məqsədi ilə yaradılmışdır.
            </p>
            <p className="text-[#6B85A0] leading-relaxed mb-10">
              Biz hesab edirik ki, hər insan güvənli bir mühitdə özünü ifadə
              etməyə, dərk edilməyə və dəstəklənməyə layiqdir. Mütəxəssislərimiz
              müasir terapevtik yanaşmalarla hər bir müştəriyə fərdi yol xəritəsi
              təqdim edir.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {values.map((v) => (
                <div
                  key={v.title}
                  className="p-5 rounded-2xl group"
                  style={{ background: "#F4F8FC", border: "1px solid #D5E3F0" }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 text-[#3B6FA5]"
                    style={{ background: "#E4EEF8" }}
                  >
                    {v.icon}
                  </div>
                  <h3 className="font-semibold text-[#1A2535] mb-1">{v.title}</h3>
                  <p className="text-sm text-[#6B85A0] leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
