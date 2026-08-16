"use client";

import { useMemo, useState } from "react";
import Deco from "@/components/Deco";
import Breadcrumb from "@/components/Breadcrumb";
import SessionRequestModal from "@/components/SessionRequestModal";
import PsychologistCard, { toPsyCardItem, VerifiedBadgeIcon, type PsyCardItem } from "@/components/PsychologistCard";
import HorizontalCardRail from "@/components/HorizontalCardRail";
import type { Psychologist } from "@/lib/api";
import { withSlugs } from "@/lib/slug";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function PsychologistsPage({ psychologists }: { psychologists?: Psychologist[] }) {
  const { t } = useT();
  const [modalOpen, setModalOpen] = useState(false);

  const items: PsyCardItem[] = useMemo(() => {
    if (!psychologists || psychologists.length === 0) return [];
    const slugs = withSlugs(psychologists.map((p) => ({ id: p.id, name: p.name })));
    const slugById = new Map(slugs.map((s) => [s.id, s.slug]));
    return psychologists.map((p) => toPsyCardItem(p, slugById.get(p.id) ?? String(p.id)));
  }, [psychologists]);

  return (
    <div className="fanus-root">
      <Breadcrumb items={[{ label: t("nav.psychologists") }]} />
      <PsycHero onApply={() => setModalOpen(true)} />
      <VerifiedNote />
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

/** Kartlarda görünən "Fanus təsdiqli" nişanının nə demək olduğunu izah edir —
 *  siyahının yuxarısında, ilk dəfə görən pasiyent nişanın mənasını bilsin. */
function VerifiedNote() {
  const { t } = useT();
  return (
    <div className="fanus-container">
      <div className="pp-verified-note">
        <span className="pp-verified-note__icon"><VerifiedBadgeIcon size={20} /></span>
        <div>
          <strong>{t("psyList.verifiedNoteTitle")}</strong>
          <p>{t("psyList.verifiedNoteBody")}</p>
        </div>
      </div>

      <style>{`
        .pp-verified-note {
          display: flex; align-items: flex-start; gap: 14px;
          max-width: 720px; margin: 0 auto 8px;
          padding: 16px 18px; border-radius: 14px;
          background: var(--fanus-primary-50); border: 1px solid var(--fanus-primary-100);
        }
        .pp-verified-note__icon {
          flex-shrink: 0; width: 38px; height: 38px; border-radius: 10px;
          display: inline-flex; align-items: center; justify-content: center;
          background: #fff; color: var(--fanus-primary);
        }
        .pp-verified-note strong { display: block; font-size: 14.5px; color: var(--fanus-ink); margin-bottom: 3px; }
        .pp-verified-note p { margin: 0; font-size: 13.5px; color: var(--fanus-ink-3); line-height: 1.5; }
      `}</style>
    </div>
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

        {items.length > 0 ? (
          <HorizontalCardRail className="pp-grid">
            {items.map((p) => <PsychologistCard key={p.id} p={p} />)}
          </HorizontalCardRail>
        ) : (
          <p className="pp-list__empty">{t("pub.noPsychologists")}</p>
        )}
      </div>

      <style>{`
        .pp-list { padding: 56px 0 110px; position: relative; overflow: hidden; scroll-margin-top: 104px; }
        .pp-list > .fanus-container { position: relative; z-index: 1; }
        .pp-list__head { margin-bottom: 28px; }
        .pp-list__count { font-size: 14px; color: var(--fanus-ink-3); }
        .pp-list__count strong { color: var(--fanus-ink); font-weight: 700; }
        .pp-list__empty { padding: 40px 0; text-align: center; color: var(--fanus-ink-3); font-size: 15px; }

        .pp-grid { display: flex; gap: 22px; overflow-x: auto; padding: 2px 2px 18px; scroll-snap-type: x proximity; }
        .pp-grid > .pc-card { flex: 0 0 min(300px, calc(100vw - 48px)); min-width: 0; scroll-snap-align: start; }
        .card-rail { scrollbar-width: thin; scrollbar-color: var(--fanus-primary-200) transparent; cursor: grab; touch-action: pan-x; user-select: none; }
        .card-rail--dragging { cursor: grabbing; scroll-snap-type: none; }
        .card-rail--dragging a { pointer-events: none; }
        .card-rail::-webkit-scrollbar { height: 7px; }
        .card-rail::-webkit-scrollbar-thumb { background: var(--fanus-primary-200); border-radius: 999px; }
      `}</style>
    </section>
  );
}
