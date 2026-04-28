import Link from "next/link";
import About from "@/components/About";
import Stats from "@/components/Stats";
import { getStats } from "@/lib/api";

export const metadata = {
  title: "Haqqımızda | Fanus",
  description: "2019-cu ildən insanlara emosional sağlamlıq sahəsində peşəkar, məxfi və insan mərkəzli dəstək göstəririk.",
};

const VALUES = [
  {
    icon: (
      <img src="/images/logos/logo-blue.png" alt="Fanus" style={{ width: 28, height: 28, objectFit: "contain" }} />
    ),
    color: "#002147",
    bg: "#EBF2FF",
    title: "Məxfilik",
    text: "Müştərilərimizin hər sözü, hər hissi tamamilə gizli qalır. Güvən — terapiyamızın təməlidir.",
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="#7C3AED" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "#7C3AED",
    bg: "#F3EEFF",
    title: "İnsan mərkəzlilik",
    text: "Hər insan unikaldır. Biz standart həlllər deyil, sizə xas yanaşma tətbiq edirik.",
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="#0D9488" strokeWidth="1.6" viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "#0D9488",
    bg: "#EFFAF8",
    title: "Peşəkarlıq",
    text: "Komandamız beynəlxalq sertifikatlara malik, daim inkişaf edən psixoloqlardan ibarətdir.",
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="#D97706" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "#D97706",
    bg: "#FFF8EE",
    title: "Empati",
    text: "Mühakimə etmədən, hörmətlə dinləyirik. Sizin hissləriniz burada dəyərlidir.",
  },
];

const TEAM = [
  {
    name: "Dr. Leyla Əliyeva",
    role: "Klinik psixoloq, Kurucu",
    initials: "LƏ",
    gradient: "linear-gradient(135deg, #002147, #3B6FA5)",
    desc: "10 ildən artıq klinik təcrübəsi olan, travma və depressiya sahəsinin mütəxəssisi.",
  },
  {
    name: "Nigar Hüseynova",
    role: "Ailə terapisti",
    initials: "NH",
    gradient: "linear-gradient(135deg, #7C3AED, #5A4FC8)",
    desc: "Ailə daxili kommunikasiya və uşaq psixologiyası üzrə ixtisaslaşmış terapist.",
  },
  {
    name: "Rauf Məmmədov",
    role: "CBT mütəxəssisi",
    initials: "RM",
    gradient: "linear-gradient(135deg, #0D9488, #0891B2)",
    desc: "Koqnitiv-davranış terapiyası və narahatlıq pozuntuları üzrə sertifikatlı mütəxəssis.",
  },
];

export default async function AboutPage() {
  const stats = await getStats().catch(() => []);

  return (
    <>
      {/* Hero */}
      <section
        className="pt-32 pb-20"
        style={{ background: "linear-gradient(135deg, #0F1C2E 0%, #1E3A5F 55%, #2A57B0 100%)" }}
      >
        <div className="container text-center max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
            Fanus Psixologiya Mərkəzi
          </p>
          <h1
            className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight"
            style={{ fontFamily: "var(--font-playfair, serif)" }}
          >
            İnsana inanan bir mərkəz
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            2019-cu ildən Azərbaycanda emosional sağlamlığı daha əlçatan, daha insani
            və daha effektiv etmək üçün çalışırıq.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="section" style={{ background: "#fff" }}>
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="section-label">Missiyamız</p>
              <h2
                className="text-3xl sm:text-4xl font-bold mb-6 leading-snug"
                style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
              >
                Hər insan sağlam,<br />xoşbəxt olmağa layiqdir
              </h2>
              <p className="text-[#52718F] leading-relaxed mb-5">
                Fanus 2019-cu ildə Azərbaycanda psixoloji yardımı ən yüksək standartlarda
                əlçatan etmək məqsədi ilə yaradıldı. "Fanus" — qaranlıqda yol göstərən işıq
                deməkdir. Biz hər bir insanın öz daxili işığına qovuşmasına dəstək olmağı özümüzə
                missiya bilmişik.
              </p>
              <p className="text-[#52718F] leading-relaxed">
                Terapiya yalnız "problem olanlar üçün" deyil — özünü daha yaxşı tanımaq,
                emosional güc toplamaq və daha dolu bir həyat qurmaq istəyən hər kəs üçündür.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "İl təcrübə", value: "6+" },
                { label: "Məmnun müştəri", value: "2000+" },
                { label: "Mütəxəssis", value: "15+" },
                { label: "Seans növü", value: "8+" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl p-6 text-center"
                  style={{ background: "#F3F6FB", border: "1px solid #E2EBF5" }}
                >
                  <div
                    className="text-3xl font-bold mb-1"
                    style={{ color: "#002147", fontFamily: "var(--font-playfair, serif)" }}
                  >
                    {item.value}
                  </div>
                  <div className="text-sm text-[#52718F] font-medium">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      {stats.length > 0 && <Stats stats={stats} />}

      {/* Values */}
      <section className="section" style={{ background: "#F8FAFD" }}>
        <div className="container">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="section-label">Dəyərlərimiz</p>
            <h2
              className="text-3xl sm:text-4xl font-bold"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
            >
              Bizi fərqli edən dəyərlər
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl p-6"
                style={{ background: v.bg, border: `1px solid ${v.color}22` }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "#fff", boxShadow: `0 4px 14px ${v.color}20` }}
                >
                  {v.icon}
                </div>
                <h3
                  className="text-base font-bold mb-2"
                  style={{ color: "#1A2535" }}
                >
                  {v.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#52718F" }}>
                  {v.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Journey (existing animated section) */}
      <About />

      {/* Team */}
      <section className="section" style={{ background: "#F8FAFD" }}>
        <div className="container">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="section-label">Komandamız</p>
            <h2
              className="text-3xl sm:text-4xl font-bold"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
            >
              Sizə dəstək olan mütəxəssislər
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {TEAM.map((member) => (
              <div
                key={member.name}
                className="rounded-2xl p-6 text-center"
                style={{ background: "#fff", border: "1px solid #E2EBF5", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-4"
                  style={{ background: member.gradient }}
                >
                  {member.initials}
                </div>
                <h3 className="font-bold text-[#1A2535] mb-1">{member.name}</h3>
                <p className="text-xs font-semibold mb-3" style={{ color: "#3B6FA5" }}>{member.role}</p>
                <p className="text-sm text-[#52718F] leading-relaxed">{member.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-20"
        style={{ background: "linear-gradient(135deg, #002147 0%, #1E3A5F 60%, #2A57B0 100%)" }}
      >
        <div className="container text-center max-w-2xl mx-auto">
          <h2
            className="text-3xl sm:text-4xl font-bold text-white mb-5"
            style={{ fontFamily: "var(--font-playfair, serif)" }}
          >
            İlk addımı indi atın
          </h2>
          <p className="mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            Sizə ən uyğun psixoloqula tanış olmaq üçün bir randevu kifayətdir.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/psychologists"
              className="py-3 px-7 rounded-full text-sm font-bold text-white transition-all"
              style={{ background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)" }}
            >
              Psixoloqlarımız
            </Link>
            <Link
              href="/register"
              className="py-3 px-7 rounded-full text-sm font-bold transition-all"
              style={{ background: "#fff", color: "#002147" }}
            >
              Qeydiyyat
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
