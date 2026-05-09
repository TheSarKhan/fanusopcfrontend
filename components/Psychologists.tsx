"use client";

import Link from "next/link";
import type { Psychologist } from "@/lib/api";
import Deco from "@/components/Deco";
import { useT } from "@/lib/i18n/LocaleProvider";

const FALLBACK: Array<{ name: string; spec: string; exp: number; tags: string[]; color: string; online: boolean }> = [
  { name: "Aysel Məmmədova", spec: "Narahatlıq · OKD · Panik", exp: 8, tags: ["KDT", "Sxem"], color: "#5089E0", online: true },
  { name: "Rəşad Quliyev", spec: "Travma · TSSP", exp: 11, tags: ["EMDR", "KDT"], color: "#F5B946", online: true },
  { name: "Lalə Hüseynova", spec: "Münasibətlər · Ailə", exp: 6, tags: ["Sistemli"], color: "#1051B7", online: false },
  { name: "Elnur Səfərov", spec: "Depressiya · Burnout", exp: 9, tags: ["KDT", "ACT"], color: "#0B3F90", online: true },
  { name: "Nigar Kazımova", spec: "Yeniyetmə · Valideyn", exp: 7, tags: ["Oyun terapiyası"], color: "#88AEEC", online: true },
  { name: "Tural Babayev", spec: "Asılılıq · İmpuls", exp: 10, tags: ["Motivasiya"], color: "#2A6BD0", online: false },
];

export default function Psychologists({ psychologists }: { psychologists?: Psychologist[] }) {
  const { t } = useT();
  const data = (psychologists && psychologists.length > 0)
    ? psychologists.slice(0, 6).map((p) => ({
        id: p.id,
        name: p.name,
        spec: (p.specializations || []).slice(0, 3).join(" · ") || (p.title ?? ""),
        exp: parseInt(p.experience ?? "5", 10) || 5,
        tags: (p.specializations || []).slice(0, 2),
        color: p.accentColor || "#1051B7",
        online: p.active,
        photoUrl: p.photoUrl,
      }))
    : FALLBACK.map((f, i) => ({ ...f, id: i + 1, photoUrl: undefined as string | undefined }));

  return (
    <section className="fanus-psyc" id="psychologists">
      <Deco type="wave-top-2" style={{ top: -30, right: "-6%", width: 460, opacity: .5 }} anim="drift" />
      <Deco type="target" style={{ bottom: 80, left: "4%", width: 140, opacity: .65 }} />
      <div className="fanus-container">
        <div className="fanus-psyc__head">
          <div>
            <div className="fanus-eyebrow"><span className="dash" /> {t("psyList.eyebrow")}</div>
            <h2 style={{ marginTop: 14 }}>{t("psyList.title")}</h2>
            <p className="fanus-psyc__lead">{t("psyList.lead")}</p>
          </div>
          <Link href="/psychologists" className="fanus-btn fanus-btn-ghost">
            {t("psyList.seeAll")} <Arrow />
          </Link>
        </div>

        <div className="fanus-psyc__grid">
          {data.map((p) => (
            <article key={p.id} className="fanus-psyc-card">
              <div className="fanus-psyc-card__top">
                <div className="fanus-psyc-card__avatar" style={{ background: p.color }}>
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt={p.name} width={60} height={60} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    p.name.split(" ").map((n: string) => n[0]).join("")
                  )}
                  <span className={`fanus-psyc-card__status ${p.online ? "on" : "off"}`} />
                </div>
                <div className="fanus-psyc-card__exp">
                  <strong>{p.exp}</strong>
                  <span>{t("psyList.yearsExp")}</span>
                </div>
              </div>
              <h3 className="fanus-psyc-card__name">{p.name}</h3>
              <p className="fanus-psyc-card__spec">{p.spec}</p>
              <div className="fanus-psyc-card__tags">
                {p.tags.map((t: string, j: number) => <span key={j} className="fanus-psyc-tag">{t}</span>)}
              </div>
              <div className="fanus-psyc-card__foot">
                <Link href={`/psychologists/${p.id}`} className="fanus-btn fanus-btn-light fanus-btn-sm">{t("psyList.profile")}</Link>
                <Link href={`/book?psychologist=${p.id}`} className="fanus-btn fanus-btn-primary fanus-btn-sm" style={{ flex: 1, justifyContent: "center" }}>
                  <CalIcon /> {t("psyList.bookCta")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      <style>{`
        .fanus-psyc { padding: 100px 0; position: relative; overflow: hidden; }
        .fanus-psyc > .fanus-container { position: relative; z-index: 1; }
        .fanus-psyc__head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 48px; gap: 24px; flex-wrap: wrap; }
        .fanus-psyc__head h2 {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.1; color: var(--fanus-ink);
          margin: 14px 0 0;
        }
        .fanus-psyc__lead { margin-top: 12px; max-width: 540px; font-size: 17px; color: var(--fanus-ink-3); }
        .fanus-psyc__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .fanus-psyc-card {
          background: white; border: 1px solid var(--fanus-line);
          border-radius: 22px; padding: 24px;
          transition: all .25s ease; position: relative; overflow: hidden;
        }
        .fanus-psyc-card::before {
          content: ""; position: absolute; left: 0; top: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--fanus-primary), var(--fanus-accent));
          transform: scaleX(0); transform-origin: left; transition: transform .4s ease;
        }
        .fanus-psyc-card:hover {
          transform: translateY(-3px);
          border-color: var(--fanus-primary-300);
          box-shadow: 0 18px 40px rgba(16,81,183,.1);
        }
        .fanus-psyc-card:hover::before { transform: scaleX(1); }
        .fanus-psyc-card__top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .fanus-psyc-card__avatar {
          position: relative; width: 60px; height: 60px; border-radius: 50%;
          color: white; font-weight: 700; font-size: 18px;
          display: inline-flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .fanus-psyc-card__status {
          position: absolute; right: 0; bottom: 2px;
          width: 14px; height: 14px; border-radius: 50%;
          border: 2.5px solid white;
        }
        .fanus-psyc-card__status.on { background: #16a34a; }
        .fanus-psyc-card__status.off { background: #c5cad4; }
        .fanus-psyc-card__exp { text-align: right; }
        .fanus-psyc-card__exp strong { display: block; font-size: 22px; color: var(--fanus-primary); font-weight: 800; }
        .fanus-psyc-card__exp span { font-size: 11px; color: var(--fanus-ink-3); text-transform: uppercase; letter-spacing: .04em; }
        .fanus-psyc-card__name { font-size: 18px; margin: 0 0 4px; color: var(--fanus-ink); font-weight: 600; }
        .fanus-psyc-card__spec { font-size: 14px; color: var(--fanus-ink-3); margin: 0 0 14px; }
        .fanus-psyc-card__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
        .fanus-psyc-tag { font-size: 11px; padding: 4px 10px; border-radius: 999px; background: var(--fanus-primary-50); color: var(--fanus-primary); font-weight: 600; }
        .fanus-psyc-card__foot { display: flex; align-items: center; gap: 8px; padding-top: 16px; border-top: 1px dashed var(--fanus-line); }
        @media (max-width: 980px) { .fanus-psyc__grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .fanus-psyc__grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function Arrow() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
function CalIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
}
