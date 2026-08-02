"use client";

// Paneldəki publik test kataloqu. Əvvəl bu testləri yalnız saytdan doldurmaq olurdu
// və nəticəni hesaba bağlamaq üçün ayrıca "sahiblənmə" addımı lazım gəlirdi.
// Buradan doldurulanda istifadəçi onsuz da girişlidir — nəticə birbaşa hesaba yazılır.

import Link from "next/link";
import { useEffect, useState } from "react";
import { patientApi, type PublicTestCard } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function PatientTestCatalogPage() {
  const { t } = useT();
  const [items, setItems] = useState<PublicTestCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    patientApi.testCatalog()
      .then(setItems)
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pgoals">
      <PageHeader title={t("patTests.catalogTitle")} subtitle={t("patTests.catalogSub")} />

      <div style={{ marginBottom: 16 }}>
        <Link href="/patient/tests" className="pgoal-card__action">{t("patTests.backToTests")}</Link>
      </div>

      {loading ? (
        <div className="pgoals__loading">{t("common.loading")}</div>
      ) : err ? (
        <div className="pgoals__error">{err}</div>
      ) : items.length === 0 ? (
        <div className="pgoals__empty">
          <div className="pgoals__empty-title">{t("patTests.catalogEmptyTitle")}</div>
          <p className="pgoals__empty-body">{t("patTests.catalogEmptyBody")}</p>
        </div>
      ) : (
        <section className="pgoals__section">
          <div className="pgoals__list">
            {items.map(c => (
              <article key={c.id} className="pgoal-card">
                <div className="pgoal-card__top">
                  <div className="pgoal-card__title">{c.title}</div>
                  <span className="pgoal-card__status"
                    style={{ background: "var(--brand-50)", color: "var(--brand-700)", borderColor: "var(--brand-100)" }}>
                    {t("patTests.questionCount", { n: c.questionCount })}
                  </span>
                </div>
                {c.description && <div className="pgoal-card__desc">{c.description}</div>}
                <div className="pgoal-card__meta">
                  <Link
                    href={`/patient/tests/catalog/${c.id}`}
                    className="pgoal-card__action"
                    style={{ color: "#fff", background: "var(--brand)", border: "none", padding: "6px 14px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
                    {t("patTests.takeCta")}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
