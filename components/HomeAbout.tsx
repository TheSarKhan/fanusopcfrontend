"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const STATS = [
  { value: 2000, suffix: "+", label: "Müştəriyə dəstək verdik" },
  { value: 15,   suffix: "+", label: "Sertifikatlı psixoloq" },
  { value: 4.9,  suffix: "/5", label: "Orta müştəri reytinqi", decimal: true },
  { value: 6,    suffix: " il", label: "Sahədə təcrübə" },
];

const PILLARS = [
  { color: "#002147", label: "Klinik psixologiya" },
  { color: "#7C3AED", label: "CBT & EMDR" },
  { color: "#0D9488", label: "Ailə terapiyası" },
  { color: "#E8901A", label: "Uşaq psixologiyası" },
  { color: "#4A9B7F", label: "Travma terapiyası" },
  { color: "#BE123C", label: "Böhran müdaxiləsi" },
];

function CountUp({ to, decimal, suffix }: { to: number; decimal?: boolean; suffix: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const dur = 1400;
        const fps = 60;
        const steps = Math.round((dur / 1000) * fps);
        let i = 0;
        const id = setInterval(() => {
          i++;
          const progress = i / steps;
          const ease = 1 - Math.pow(1 - progress, 3);
          setVal(parseFloat((ease * to).toFixed(decimal ? 1 : 0)));
          if (i >= steps) { setVal(to); clearInterval(id); }
        }, 1000 / fps);
      }
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, decimal]);

  return <span ref={ref}>{decimal ? val.toFixed(1) : Math.round(val)}{suffix}</span>;
}

export default function HomeAbout() {
  return (
    <section
      className="section"
      style={{
        background: "linear-gradient(160deg, #0F1C2E 0%, #1a2f4e 50%, #1E3A5F 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative blobs */}
      <div style={{
        position: "absolute", top: -120, right: -120,
        width: 480, height: 480, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(90,79,200,0.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -80, left: -60,
        width: 360, height: 360, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(74,155,127,0.14) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* ── Left: Mission + Pillars ────────────── */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: "rgba(255,255,255,0.4)" }}>
              2019-cu ildən bəri
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold text-white leading-snug mb-6"
              style={{ fontFamily: "var(--font-playfair, serif)" }}
            >
              Azərbaycanda emosional
              <br />
              <span style={{
                background: "linear-gradient(90deg, #A78BFA, #4A9B7F)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                sağlamlığın öncüsüyük
              </span>
            </h2>
            <p className="leading-relaxed mb-8 text-[0.97rem]"
              style={{ color: "rgba(255,255,255,0.65)" }}>
              Fanus, psixoloji yardımı ən yüksək standartlarda, əlçatan və insani şəkildə
              göstərmək məqsədi ilə yaradılıb. Hər insan — dinlənilməyə,
              anlaşılmağa və dəstəklənməyə layiqdir.
            </p>

            {/* Expertise pills */}
            <div className="flex flex-wrap gap-2 mb-10">
              {PILLARS.map((p) => (
                <span
                  key={p.label}
                  className="text-xs font-semibold px-3.5 py-2 rounded-full flex items-center gap-2"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: p.color }}
                  />
                  {p.label}
                </span>
              ))}
            </div>

            <Link
              href="/about"
              className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-full transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
              }}
            >
              Haqqımızda daha çox
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          {/* ── Right: Stats grid ─────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl p-6 flex flex-col gap-2"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <p
                  className="text-3xl sm:text-4xl font-black leading-none"
                  style={{
                    fontFamily: "var(--font-playfair, serif)",
                    background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  <CountUp to={s.value} suffix={s.suffix} decimal={s.decimal} />
                </p>
                <p className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {s.label}
                </p>
              </div>
            ))}

            {/* Certifications card — spans 2 cols */}
            <div
              className="col-span-2 rounded-2xl p-5 flex flex-col gap-3"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(8px)",
              }}
            >
              <p className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.35)" }}>
                Akkreditasiyalar
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "APA üzvü",
                  "CBT Sertifikatlı",
                  "EMDR Akkreditasiyası",
                  "Mindfulness",
                  "ISO 27001",
                ].map((cert) => (
                  <span
                    key={cert}
                    className="text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    <svg width="10" height="10" fill="none" stroke="#4A9B7F" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" />
                      <path d="M22 4 12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
