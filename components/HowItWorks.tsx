"use client";

const steps = [
  {
    num: "1",
    title: "Psixoloqla tanış ol",
    desc: "Ehtiyaclarınıza, gözləntilərinizə və büdcənizə uyğun psixoloqu seçin. Qısa profil məlumatları ilə sizə ən uyğun mütəxəssisi tapın.",
    image: "/images/how-1.jpg",
    imageAlt: "Psixoloq seçimi",
  },
  {
    num: "2",
    title: "Pulsuz ilk görüşü planla",
    desc: "Seçdiyiniz psixoloqla 15 dəqiqəlik pulsuz tanışlıq görüşü edin. Uyğunluğunuzu yoxlayın, suallarınızı verin — heç bir öhdəlik yoxdur.",
    image: "/images/how-2.jpg",
    imageAlt: "Görüş planla",
  },
  {
    num: "3",
    title: "Psixoloji dəstəyinə başla",
    desc: "Onlayn video zəng və ya üz-üzə format seçin. Rahat, məxfi mühitdə peşəkar psixoloji dəstək alın.",
    image: "/images/how-3.jpg",
    imageAlt: "Seans başla",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="section" style={{ background: "#EDF2FB" }}>
      <div className="container">
        <div className="text-center mb-12">
          <h2
            className="text-3xl sm:text-[2.4rem] font-bold mb-3"
            style={{ fontFamily: "var(--font-playfair, serif)", color: "#0F1C2E" }}
          >
            Necə işləyir?
          </h2>
          <p className="text-[#5A7490] max-w-md mx-auto text-[0.9375rem] leading-relaxed">
            Cəmi 3 addımda psixoloji dəstək almağa başlaya bilərsiniz.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {steps.map((step) => (
            <div key={step.num} className="flex items-stretch gap-5 sm:gap-8">
              {/* Step number — outside card */}
              <div className="hidden sm:flex flex-col items-end justify-start pt-7 w-14 flex-shrink-0">
                <span
                  className="font-bold leading-none"
                  style={{
                    fontFamily: "var(--font-playfair, serif)",
                    fontSize: "2.75rem",
                    color: "#3B6FA5",
                    lineHeight: 1,
                  }}
                >
                  {step.num}.
                </span>
              </div>

              {/* Card */}
              <div
                className="flex-1 bg-white rounded-2xl overflow-hidden flex flex-col sm:flex-row items-stretch"
                style={{ border: "1px solid #DDE8F5" }}
              >
                {/* Text side */}
                <div className="flex-1 p-7 sm:p-8 flex flex-col justify-center">
                  {/* Mobile step number */}
                  <span
                    className="sm:hidden font-bold mb-2"
                    style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "1.75rem", color: "#3B6FA5" }}
                  >
                    {step.num}.
                  </span>
                  <h3
                    className="text-xl font-bold mb-3 text-[#0F1C2E]"
                    style={{ fontFamily: "var(--font-playfair, serif)" }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-[#5A7490] text-[0.925rem] leading-relaxed">{step.desc}</p>
                </div>

                {/* Image side */}
                <div
                  className="sm:w-[260px] h-[180px] sm:h-auto flex-shrink-0 overflow-hidden"
                >
                  <img
                    src={step.image}
                    alt={step.imageAlt}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
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
          <p className="text-xs text-[#8AAABF] mt-3">Öhdəlik tələb olunmur · Pulsuz ilk görüş</p>
        </div>
      </div>
    </section>
  );
}
