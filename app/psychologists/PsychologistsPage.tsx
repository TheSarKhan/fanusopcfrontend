"use client";

import { useMemo, useState } from "react";
import Deco from "@/components/Deco";
import Breadcrumb from "@/components/Breadcrumb";
import SessionRequestModal from "@/components/SessionRequestModal";
import PsychologistCard, { toPsyCardItem, type PsyCardItem } from "@/components/PsychologistCard";
import type { Psychologist } from "@/lib/api";
import { withSlugs } from "@/lib/slug";
import { useT } from "@/lib/i18n/LocaleProvider";

const FALLBACK_BASE: Omit<PsyCardItem, "slug">[] = [
  { id: 1, name: "Aysel Məmmədova", title: "Klinik psixoloq",      specs: ["Narahatlıq", "OKD", "Panik"],           exp: 8,  rating: "4.9", sessions: "210", lang: "AZ, RU", sessionMinutes: 50 },
  { id: 2, name: "Rəşad Quliyev",   title: "Travma terapevti",     specs: ["Travma", "TSSP", "EMDR"],               exp: 11, rating: "4.8", sessions: "315", lang: "AZ, EN", sessionMinutes: 50 },
  { id: 3, name: "Lalə Hüseynova",  title: "Ailə terapevti",       specs: ["Münasibətlər", "Ailə"],                 exp: 6,  rating: "4.7", sessions: "140", lang: "AZ",     sessionMinutes: 50 },
  { id: 4, name: "Elnur Səfərov",   title: "Klinik psixoloq",      specs: ["Depressiya", "Burnout"],                exp: 9,  rating: "4.9", sessions: "260", lang: "AZ, RU", sessionMinutes: 50 },
  { id: 5, name: "Nigar Kazımova",  title: "Uşaq psixoloqu",       specs: ["Yeniyetmə", "Valideyn"],                exp: 7,  rating: "4.8", sessions: "180", lang: "AZ",     sessionMinutes: 50 },
  { id: 6, name: "Tural Babayev",   title: "Asılılıq mütəxəssisi", specs: ["Asılılıq", "İmpuls"],                   exp: 10, rating: "4.7", sessions: "240", lang: "AZ, RU", sessionMinutes: 50 },
  { id: 7, name: "Səbinə Əliyeva",  title: "Klinik psixoloq",      specs: ["Narahatlıq", "Stress"],                 exp: 5,  rating: "4.6", sessions: "95",  lang: "AZ",     sessionMinutes: 50 },
  { id: 8, name: "Cavid Rəhimli",   title: "Travma terapevti",     specs: ["Travma", "Yas", "EMDR"],                exp: 12, rating: "4.9", sessions: "340", lang: "AZ, EN", sessionMinutes: 50 },
  { id: 9, name: "Günel Həsənli",   title: "Cütlük terapevti",     specs: ["Cütlük", "Boşanma"],                    exp: 8,  rating: "4.7", sessions: "175", lang: "AZ, RU", sessionMinutes: 50 },
];
const FALLBACK: PsyCardItem[] = withSlugs(FALLBACK_BASE);

export default function PsychologistsPage({ psychologists }: { psychologists?: Psychologist[] }) {
  const { t } = useT();
  const [modalOpen, setModalOpen] = useState(false);

  const items: PsyCardItem[] = useMemo(() => {
    if (!psychologists || psychologists.length === 0) return FALLBACK;
    const slugs = withSlugs(psychologists.map((p) => ({ id: p.id, name: p.name })));
    const slugById = new Map(slugs.map((s) => [s.id, s.slug]));
    return psychologists.map((p) => toPsyCardItem(p, slugById.get(p.id) ?? String(p.id)));
  }, [psychologists]);

  return (
    <div className="fanus-root">
      <Breadcrumb items={[{ label: t("nav.psychologists") }]} />
      <PsycHero onApply={() => setModalOpen(true)} />
      <PsycList items={items} />
      <SessionRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function PsycHero({ onApply }: { onApply: () => void }) {
  const { t } = useT();
  return (
    <section className="pp-hero">
      <div className="fanus-container pp-hero__inner">
        <h1>{t("psyList.title")}</h1>
        <p className="pp-hero__lead">{t("psyList.lead")}</p>
        <div className="pp-hero__cta">
          <button type="button" className="fanus-btn fanus-btn-primary fanus-btn-lg" onClick={onApply}>
            {t("pub.applyCta")}
          </button>
          <a href="#list" className="fanus-btn fanus-btn-ghost fanus-btn-lg">
            {t("pub.browseAll")}
          </a>
        </div>
      </div>

      <style>{`
        .pp-hero { padding: 28px 0; text-align: center; }
        .pp-hero__inner { max-width: 720px; margin: 0 auto; }
        .pp-hero h1 {
          margin: 0 0 16px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(32px, 4.6vw, 54px); font-weight: 800;
          letter-spacing: -0.03em; line-height: 1.1; color: var(--fanus-ink);
        }
        .pp-hero__lead {
          font-size: 17px; color: var(--fanus-ink-3); line-height: 1.6;
          max-width: 600px; margin: 0 auto;
        }
        .pp-hero__cta {
          display: flex; justify-content: center; gap: 12px;
          margin-top: 28px; flex-wrap: wrap;
        }
        @media (max-width: 640px) { .pp-hero { padding: 20px 0; } }
      `}</style>
    </section>
  );
}

function PsycList({ items }: { items: PsyCardItem[] }) {
  const { t } = useT();
  return (
    <section className="pp-list" id="list">
      <Deco type="mesh-blob" style={{ top: 60, right: "-5%", width: 400, opacity: .35 }} anim="drift" />
      <Deco type="blob-1" style={{ bottom: 80, left: "-4%", width: 280, opacity: .4 }} anim="drift" />

      <div className="fanus-container">
        <div className="pp-list__head">
          <span className="pp-list__count">{t("pub.specialistCount", { n: items.length })}</span>
        </div>

        <div className="pp-grid">
          {items.map((p) => <PsychologistCard key={p.id} p={p} />)}
        </div>
      </div>

      <style>{`
        .pp-list { padding: 56px 0 110px; position: relative; overflow: hidden; scroll-margin-top: 104px; }
        .pp-list > .fanus-container { position: relative; z-index: 1; }
        .pp-list__head { margin-bottom: 28px; }
        .pp-list__count { font-size: 14px; color: var(--fanus-ink-3); }
        .pp-list__count strong { color: var(--fanus-ink); font-weight: 700; }

        .pp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }

        @media (max-width: 980px) { .pp-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .pp-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
