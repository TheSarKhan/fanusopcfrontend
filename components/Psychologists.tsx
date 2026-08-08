"use client";

import Link from "next/link";
import type { Psychologist } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import PsychologistCard, { toPsyCardItem, type PsyCardItem } from "@/components/PsychologistCard";
import HorizontalCardRail from "@/components/HorizontalCardRail";

const FALLBACK: PsyCardItem[] = [
  { id: 1, slug: "aysel-memmedova", name: "Aysel Məmmədova", title: "Klinik psixoloq",      specs: ["Narahatlıq", "OKD", "Panik"],  exp: 8,  rating: "4.9", sessions: "210", lang: "AZ, RU",      sessionMinutes: 50 },
  { id: 2, slug: "resad-quliyev",   name: "Rəşad Quliyev",   title: "Travma terapevti",     specs: ["Travma", "TSSP"],              exp: 11, rating: "4.8", sessions: "315", lang: "AZ, EN",      sessionMinutes: 50 },
  { id: 3, slug: "lale-huseynova",  name: "Lalə Hüseynova",  title: "Ailə terapevti",       specs: ["Münasibətlər", "Ailə"],        exp: 6,  rating: "4.7", sessions: "140", lang: "AZ",           sessionMinutes: 50 },
  { id: 4, slug: "elnur-seferov",   name: "Elnur Səfərov",   title: "Klinik psixoloq",      specs: ["Depressiya", "Burnout"],       exp: 9,  rating: "4.9", sessions: "260", lang: "AZ, RU",      sessionMinutes: 50 },
  { id: 5, slug: "nigar-kazimova",  name: "Nigar Kazımova",  title: "Uşaq psixoloqu",       specs: ["Yeniyetmə", "Valideyn"],       exp: 7,  rating: "4.8", sessions: "180", lang: "AZ",           sessionMinutes: 50 },
  { id: 6, slug: "tural-babayev",   name: "Tural Babayev",   title: "Asılılıq mütəxəssisi", specs: ["Asılılıq", "İmpuls"],          exp: 10, rating: "4.7", sessions: "240", lang: "AZ, RU",      sessionMinutes: 50 },
];

export default function Psychologists({ psychologists }: { psychologists?: Psychologist[] }) {
  const { t } = useT();
  const data: PsyCardItem[] = (psychologists && psychologists.length > 0)
    ? psychologists.map((p) => toPsyCardItem(p, String(p.id)))
    : FALLBACK;

  return (
    <section className="fanus-psyc" id="psychologists">
      <div className="fanus-container">
        <div className="fanus-psyc__head">
          <h2>{t("psyList.title")}</h2>
          <p className="fanus-psyc__lead">{t("psyList.lead")}</p>
        </div>

        <HorizontalCardRail className="fanus-psyc__grid">
          {data.map((p) => <PsychologistCard key={p.id} p={p} />)}
        </HorizontalCardRail>

        <div className="fanus-psyc__foot">
          <Link href="/psychologists" className="fanus-btn fanus-btn-ghost">
            {t("psyList.seeAll")}
          </Link>
        </div>
      </div>

      <style>{`
        .fanus-psyc { padding: 68px 0; position: relative; overflow: hidden; }
        .fanus-psyc > .fanus-container { position: relative; z-index: 1; }
        .fanus-psyc__head { margin-bottom: 48px; text-align: center; }
        .fanus-psyc__head h2 {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.1; color: var(--fanus-ink);
          margin: 0;
        }
        .fanus-psyc__lead { margin: 12px auto 0; max-width: 540px; font-size: 17px; color: var(--fanus-ink-3); }
        .fanus-psyc__grid { display: flex; gap: 22px; overflow-x: auto; padding: 2px 2px 18px; scroll-snap-type: x proximity; }
        .fanus-psyc__grid > .pc-card { flex: 0 0 min(300px, calc(100vw - 48px)); min-width: 0; scroll-snap-align: start; }
        .card-rail { scrollbar-width: thin; scrollbar-color: var(--fanus-primary-200) transparent; cursor: grab; touch-action: pan-x; user-select: none; }
        .card-rail--dragging { cursor: grabbing; scroll-snap-type: none; }
        .card-rail--dragging a { pointer-events: none; }
        .card-rail::-webkit-scrollbar { height: 7px; }
        .card-rail::-webkit-scrollbar-thumb { background: var(--fanus-primary-200); border-radius: 999px; }
        .fanus-psyc__foot { display: flex; justify-content: center; margin-top: 40px; }
      `}</style>
    </section>
  );
}
