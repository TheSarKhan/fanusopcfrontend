"use client";

// Özün doldurduğun testin nəticə detalı: bal, şkala zolaqları üzərində mövqe,
// izah və verilən cavablar.
//
// Cavablar yalnız V136-dan sonrakı doldurmalar üçün saxlanılır — köhnə nəticələrdə
// siyahı boş olur və bunu istifadəçiyə dürüst yazırıq, boş blok göstərmirik.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { patientApi, type PublicTestResultDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azFormatDate } from "@/lib/datetime";

export default function PatientTestResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useT();
  const [r, setR] = useState<PublicTestResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    patientApi.publicTestResultDetail(Number(id))
      .then(setR)
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="pgoals"><div className="pgoals__loading">{t("common.loading")}</div></div>;
  if (err || !r) {
    return (
      <div className="pgoals">
        <div className="pgoals__error">{err ?? t("testsPage.errorTitle")}</div>
        <Link href="/patient/tests" className="pgoal-card__action">{t("patTests.backToTests")}</Link>
      </div>
    );
  }

  const pct = r.maxScore > 0 ? Math.round((r.totalScore / r.maxScore) * 100) : 0;

  return (
    <div className="pgoals">
      <PageHeader
        title={r.testTitle ?? t("patTests.selfFallbackTitle")}
        subtitle={t("patTests.takenAt", { date: azFormatDate(r.submittedAt) })}
      />

      <div style={{ marginBottom: 16 }}>
        <Link href="/patient/tests" className="pgoal-card__action">{t("patTests.backToTests")}</Link>
      </div>

      {/* Bal + səviyyə */}
      <section className="pgoals__section">
        <article className="pgoal-card">
          <div style={{ textAlign: "center", padding: "8px 0 14px" }}>
            <div style={{ fontSize: 38, fontWeight: 800, color: "var(--oxford)", lineHeight: 1 }}>
              {r.totalScore}
              <span style={{ fontSize: 19, color: "var(--oxford-60)", fontWeight: 700 }}> / {r.maxScore}</span>
            </div>
            {r.scaleLabel && (
              <div style={{ display: "inline-block", marginTop: 10, padding: "5px 14px", borderRadius: 999,
                            background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 14, fontWeight: 700 }}>
                {r.scaleLabel}
              </div>
            )}
          </div>

          <div style={{ height: 10, background: "#F1F5FC", borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#1051B7,#3A74D6)" }} />
          </div>

          {r.scaleDescription && (
            <p style={{ fontSize: 14.5, color: "var(--oxford)", lineHeight: 1.65, margin: 0 }}>
              {r.scaleDescription}
            </p>
          )}
        </article>
      </section>

      {/* Şkala zolaqları — balın hansı aralığa düşdüyü göründüyü üçün nəticə mənalanır */}
      {r.scales.length > 0 && (
        <section className="pgoals__section">
          <div className="pgoals__section-head"><h2>{t("patTests.scalesTitle")}</h2></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {r.scales.map(sc => {
              const active = r.totalScore >= sc.minScore && r.totalScore <= sc.maxScore;
              return (
                <div key={sc.id}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10,
                           border: active ? "2px solid var(--brand)" : "1px solid var(--brand-100)",
                           background: active ? "var(--brand-50)" : "#fff" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                                 background: sc.color || "var(--brand)" }} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: active ? 800 : 600, color: "var(--oxford)" }}>
                      {sc.label}
                    </span>
                    {sc.description && (
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--oxford-60)", lineHeight: 1.5 }}>
                        {sc.description}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {sc.minScore}–{sc.maxScore}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Cavablar */}
      <section className="pgoals__section">
        <div className="pgoals__section-head">
          <h2>{t("patTests.answersTitle")}</h2>
          {r.answers.length > 0 && <span className="pgoals__section-n">{r.answers.length}</span>}
        </div>
        {r.answers.length === 0 ? (
          <p className="pgoals__empty-body" style={{ margin: 0 }}>{t("patTests.answersUnavailable")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {r.answers.map((a, i) => (
              <div key={a.questionId}
                style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--brand-100)", background: "#fff" }}>
                <div style={{ fontSize: 13.5, color: "var(--oxford)", fontWeight: 600, marginBottom: 6 }}>
                  {i + 1}. {a.questionText}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 13.5, color: "var(--brand-700)", fontWeight: 700 }}>{a.selectedLabel}</span>
                  <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {t("patTests.pointsShort", { n: a.pointsAwarded })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p style={{ fontSize: 13, color: "var(--oxford-60)", lineHeight: 1.6, marginTop: 16,
                  background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 10, padding: 14 }}>
        {t("testsPage.disclaimer")}
      </p>
    </div>
  );
}
