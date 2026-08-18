"use client";

import Link from "next/link";
import type { Psychologist } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import PsychologistCard, { toPsyCardItem, type PsyCardItem } from "@/components/PsychologistCard";

export default function Psychologists({ psychologists }: { psychologists?: Psychologist[] }) {
  const { t } = useT();
  if (!psychologists || psychologists.length === 0) return null;
  const data: PsyCardItem[] = psychologists.map((p) => toPsyCardItem(p, String(p.id)));

  return (
    <section className="fanus-psyc" id="psychologists">
      <div className="fanus-container">
        <div className="fanus-psyc__head">
          <h2>{t("psyList.title")}</h2>
          <p className="fanus-psyc__lead">{t("psyList.lead")}</p>
        </div>

        <div className="fanus-psyc__grid">
          {data.map((p) => <PsychologistCard key={p.id} p={p} />)}
        </div>

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
        .fanus-psyc__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 22px; }
        .fanus-psyc__foot { display: flex; justify-content: center; margin-top: 40px; }
      `}</style>
    </section>
  );
}
