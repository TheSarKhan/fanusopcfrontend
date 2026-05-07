"use client";

import Link from "next/link";
import Deco from "@/components/Deco";

type Service = {
  icon: "user" | "couple" | "video" | "group" | "shield" | "child";
  title: string;
  text: string;
  tag: string;
  bg: string;
};

const SERVICES: Service[] = [
  { icon: "user",   title: "Fərdi terapiya",       text: "Özünüzlə baş-başa qalın. Peşəkar psixoloq ilə məxfi, dərin söhbətlər vasitəsilə daxili aləminizi kəşf edin.", tag: "01", bg: "#F2F6FD" },
  { icon: "couple", title: "Cütlük terapiyası",    text: "Münasibətlərinizdə harmoniya qurun. Ortaq problemləri birlikdə həll etmək üçün peşəkar dəstək alın.",         tag: "02", bg: "#FFF7E8" },
  { icon: "video",  title: "Onlayn seans",         text: "Evinizin rahatlığından çıxmadan psixoloji dəstək alın. Video, səs və ya yazılı formatda seans seçimi.",        tag: "03", bg: "#E4ECFA" },
  { icon: "group",  title: "Qrup terapiyası",      text: "Oxşar təcrübələri olan insanlarla qrup seanslarına qoşulun. Birlikdə inkişaf edin, bir-birinizi dəstəkləyin.", tag: "04", bg: "#F2F6FD" },
  { icon: "shield", title: "Böhran dəstəyi",       text: "Çətin anlarda yanınızdayıq. Kəskin stress, travma və ya böhran vəziyyətlərində tez müdaxilə xidməti.",        tag: "05", bg: "#FFF7E8" },
  { icon: "child",  title: "Uşaq & yeniyetmə",     text: "Gənclərin emosional inkişafı üçün xüsusi yanaşma. Valideynlər üçün də dəstək proqramları mövcuddur.",          tag: "06", bg: "#E4ECFA" },
];

export default function Services() {
  return (
    <section className="fanus-svc" id="services">
      <Deco type="cards" style={{ top: 60, right: "-3%", width: 280, opacity: .55 }} anim="drift" />
      <Deco type="blob-3" style={{ bottom: 60, left: "-4%", width: 320, opacity: .55 }} anim="drift" />

      <div className="fanus-container">
        <div className="fanus-svc__head">
          <div>
            <div className="fanus-eyebrow"><span className="dash" /> Xidmətlərimiz</div>
            <h2 style={{ marginTop: 14 }}>
              Hər ehtiyac üçün <span className="fanus-serif-accent">düşünülmüş</span> dəstək.
            </h2>
            <p className="fanus-svc__lead">
              Fərdi terapiyadan qrup seanslarına, böhran dəstəyindən uşaq psixologiyasına — sizə uyğun proqramı seçin.
            </p>
          </div>
          <Link href="/xidmetler" className="fanus-btn fanus-btn-ghost">
            Ətraflı bax <Arrow />
          </Link>
        </div>

        <div className="fanus-svc__grid">
          {SERVICES.map((s) => (
            <article key={s.title} className="fanus-svc-card" style={{ ["--card-bg" as string]: s.bg }}>
              <div className="fanus-svc-card__num">{s.tag}</div>
              <div className="fanus-svc-card__icon"><Icon name={s.icon} /></div>
              <h3 className="fanus-svc-card__title">{s.title}</h3>
              <p className="fanus-svc-card__text">{s.text}</p>
              <Link href="/book" className="fanus-svc-card__link">
                Randevu al <Arrow size={14} />
              </Link>
              <div className="fanus-svc-card__shine" />
            </article>
          ))}
        </div>
      </div>

      <style>{`
        .fanus-svc { padding: 100px 0; position: relative; overflow: hidden; background: var(--fanus-paper); }
        .fanus-svc > .fanus-container { position: relative; z-index: 1; }
        .fanus-svc__head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 48px; gap: 24px; flex-wrap: wrap; }
        .fanus-svc__head h2 {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.1; color: var(--fanus-ink);
          margin: 14px 0 0;
        }
        .fanus-svc__lead { margin-top: 12px; max-width: 540px; font-size: 17px; color: var(--fanus-ink-3); }
        .fanus-svc__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .fanus-svc-card {
          position: relative; padding: 32px 28px 28px;
          background: var(--card-bg);
          border-radius: 22px; overflow: hidden;
          transition: transform .3s ease, box-shadow .3s ease;
          display: flex; flex-direction: column;
        }
        .fanus-svc-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 22px 46px rgba(16,81,183,.12);
        }
        .fanus-svc-card__num {
          position: absolute; top: 22px; right: 24px;
          font-family: var(--fanus-serif);
          font-size: 48px; font-weight: 300; line-height: 1;
          color: var(--fanus-primary); opacity: .15;
        }
        .fanus-svc-card__icon {
          width: 52px; height: 52px; border-radius: 14px;
          background: white;
          display: inline-flex; align-items: center; justify-content: center;
          margin-bottom: 18px;
          box-shadow: 0 4px 12px rgba(16,81,183,.1);
        }
        .fanus-svc-card__title {
          font-size: 20px; margin: 0 0 10px;
          color: var(--fanus-ink); font-weight: 600; letter-spacing: -0.02em;
        }
        .fanus-svc-card__text {
          font-size: 14.5px; color: var(--fanus-ink-2); line-height: 1.6;
          margin: 0 0 16px; flex: 1;
        }
        .fanus-svc-card__link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 600;
          color: var(--fanus-primary);
          padding-top: 12px;
          border-top: 1px dashed rgba(16,81,183,.2);
          transition: gap .2s;
        }
        .fanus-svc-card:hover .fanus-svc-card__link { gap: 10px; }
        .fanus-svc-card__shine {
          position: absolute; left: -40%; bottom: -40%;
          width: 220px; height: 220px;
          background: radial-gradient(circle, rgba(245,185,70,.18) 0%, transparent 60%);
          opacity: 0; transition: opacity .4s, transform .6s;
        }
        .fanus-svc-card:hover .fanus-svc-card__shine { opacity: 1; transform: translate(40px, -40px); }
        @media (max-width: 980px) { .fanus-svc__grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .fanus-svc__grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function Arrow({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function Icon({ name }: { name: Service["icon"] }) {
  const p = { width: 26, height: 26, fill: "none", stroke: "var(--fanus-primary)", strokeWidth: 1.7, viewBox: "0 0 24 24", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "user")   return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
  if (name === "couple") return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === "video")  return <svg {...p}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></svg>;
  if (name === "group")  return <svg {...p}><path d="M17 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2v4l-4-4H9a1.994 1.994 0 0 1-1.414-.586" /><path d="M15 4H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2v4l4-4h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /></svg>;
  if (name === "shield") return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
  if (name === "child")  return <svg {...p}><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><circle cx="9" cy="9" r="1.2" fill="var(--fanus-primary)" /><circle cx="15" cy="9" r="1.2" fill="var(--fanus-primary)" /></svg>;
  return null;
}
