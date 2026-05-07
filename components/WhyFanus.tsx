"use client";

import Deco from "@/components/Deco";

const REASONS = [
  {
    icon: "shield",
    title: "Tam məxfilik",
    text: "Bütün seanslar uçdan-uca şifrələnir. Hekayəniz yalnız sizin və psixoloqunuzun arasındadır.",
    tag: "01",
    bg: "#F2F6FD",
  },
  {
    icon: "sparkle",
    title: "Sizə uyğun psixoloq",
    text: "Qısa anketdən sonra ehtiyacınıza, dilinizə və tempinizə uyğun mütəxəssis təqdim edirik.",
    tag: "02",
    bg: "#FFF7E8",
  },
  {
    icon: "heart",
    title: "Hər yerdən, rahatca",
    text: "Telefon və ya kompüterdən. Trafik yox, gözləmə yox — sadəcə sizə ayrılmış bir saat.",
    tag: "03",
    bg: "#E4ECFA",
  },
];

export default function WhyFanus() {
  return (
    <section className="fanus-why" id="about">
      <Deco type="mesh-blob" style={{ top: 40, right: "-4%", width: 420, opacity: .55 }} anim="drift" />
      <Deco type="sphere" style={{ bottom: 60, left: "-3%", width: 240, opacity: .6 }} anim="drift" />
      <div className="fanus-container">
        <div className="fanus-why__head">
          <div className="fanus-eyebrow"><span className="dash" /> Niyə Fanus? <span className="dash" /></div>
          <h2>
            İçərideki <span className="fanus-serif-accent">işıq</span> üçün<br />
            doğru məkan.
          </h2>
        </div>

        <div className="fanus-why__grid">
          {REASONS.map((r, i) => (
            <div key={i} className="fanus-why-card" style={{ ["--card-bg" as string]: r.bg }}>
              <div className="fanus-why-card__num">{r.tag}</div>
              <div className="fanus-why-card__icon">
                <Icon name={r.icon} />
              </div>
              <h3 className="fanus-why-card__title">{r.title}</h3>
              <p className="fanus-why-card__text">{r.text}</p>
              <div className="fanus-why-card__shine" />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .fanus-why { padding: 100px 0; position: relative; overflow: hidden; }
        .fanus-why > .fanus-container { position: relative; z-index: 1; }
        .fanus-why__head { text-align: center; max-width: 720px; margin: 0 auto 56px; }
        .fanus-why__head .fanus-eyebrow { justify-content: center; }
        .fanus-why__head h2 {
          margin: 14px 0 0;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px);
          font-weight: 700; letter-spacing: -0.025em; line-height: 1.1;
          color: var(--fanus-ink);
        }
        .fanus-why__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .fanus-why-card {
          position: relative; padding: 36px 30px 32px;
          background: var(--card-bg);
          border-radius: 24px; overflow: hidden;
          transition: transform .3s ease, box-shadow .3s ease;
        }
        .fanus-why-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 24px 50px rgba(16,81,183,.12);
        }
        .fanus-why-card__num {
          position: absolute; top: 24px; right: 28px;
          font-family: var(--fanus-serif);
          font-size: 56px; font-weight: 300; line-height: 1;
          color: var(--fanus-primary); opacity: .15;
        }
        .fanus-why-card__icon {
          width: 56px; height: 56px; border-radius: 16px;
          background: white;
          display: inline-flex; align-items: center; justify-content: center;
          margin-bottom: 22px;
          box-shadow: 0 4px 12px rgba(16,81,183,.1);
        }
        .fanus-why-card__title { margin: 0 0 10px; font-size: 22px; color: var(--fanus-ink); font-weight: 600; letter-spacing: -0.02em; }
        .fanus-why-card__text { color: var(--fanus-ink-2); font-size: 15px; line-height: 1.6; margin: 0; }
        .fanus-why-card__shine {
          position: absolute; left: -40%; bottom: -40%;
          width: 220px; height: 220px;
          background: radial-gradient(circle, rgba(245,185,70,.18) 0%, transparent 60%);
          opacity: 0; transition: opacity .4s, transform .6s;
        }
        .fanus-why-card:hover .fanus-why-card__shine { opacity: 1; transform: translate(40px, -40px); }
        @media (max-width: 860px) { .fanus-why__grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function Icon({ name }: { name: string }) {
  const p = { width: 26, height: 26, fill: "none", stroke: "var(--fanus-primary)", strokeWidth: 1.7, viewBox: "0 0 24 24", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "shield") return <svg {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>;
  if (name === "sparkle") return <svg {...p}><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.5 5.5l4 4M14.5 14.5l4 4M18.5 5.5l-4 4M9.5 14.5l-4 4" /></svg>;
  if (name === "heart") return <svg {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z" /></svg>;
  return null;
}
