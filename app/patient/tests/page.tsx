"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { patientApi, type TestAssignment, type PublicTestResult } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { azFormatDate } from "@/lib/datetime";

function isDone(a: TestAssignment): boolean {
  return a.status === "COMPLETED" || a.hasResult;
}

const STATUS_META: Record<string, { labelKey: MessageKey; bg: string; fg: string; border: string }> = {
  ASSIGNED:    { labelKey: "patTests.statusAssigned",   bg: "var(--brand-50)", fg: "var(--brand-700)", border: "var(--brand-100)" },
  IN_PROGRESS: { labelKey: "patTests.statusInProgress", bg: "#FEF3C7",         fg: "#92400E",          border: "#FDE68A" },
  COMPLETED:   { labelKey: "patTests.statusCompleted",  bg: "#D1FAE5",         fg: "#065F46",          border: "#A7F3D0" },
};

function statusMeta(a: TestAssignment) {
  if (isDone(a)) return STATUS_META.COMPLETED;
  return STATUS_META[a.status] ?? STATUS_META.ASSIGNED;
}

export default function PatientTestsPage() {
  const { t } = useT();
  const [items, setItems] = useState<TestAssignment[]>([]);
  // Saytda özü doldurduğu və hesabına bağladığı testlərin nəticələri. Psixoloqun
  // təyin etdiyi testlərdən ayrı siyahıdır — mənbəyi və axını fərqlidir.
  const [selfResults, setSelfResults] = useState<PublicTestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      patientApi.myTestAssignments(),
      patientApi.myPublicTestResults(),
    ]).then(([a, r]) => {
      if (a.status === "fulfilled") setItems(a.value);
      else setErr((a.reason as Error).message);
      // Publik nəticələr ikinci dərəcəlidir — alınmasa səhifə yenə işləməlidir.
      if (r.status === "fulfilled") setSelfResults(r.value);
    }).finally(() => setLoading(false));
  }, []);

  // Panel açılan anda gözləyən test tokeni sahiblənilirsə, siyahını yenilə.
  useEffect(() => {
    const onClaimed = () => {
      patientApi.myPublicTestResults().then(setSelfResults).catch(() => { /* ikinci dərəcəli */ });
    };
    window.addEventListener("fanus:test-claimed", onClaimed);
    return () => window.removeEventListener("fanus:test-claimed", onClaimed);
  }, []);

  const selfSection = selfResults.length > 0 && (
    <section className="pgoals__section">
      <div className="pgoals__section-head">
        <h2>{t("patTests.selfTitle")}</h2>
        <span className="pgoals__section-n">{selfResults.length}</span>
      </div>
      <div className="pgoals__list">
        {selfResults.map((r, i) => (
          <article key={`${r.testId}-${i}`} className="pgoal-card">
            <div className="pgoal-card__top">
              <div className="pgoal-card__title">{r.testTitle ?? t("patTests.selfFallbackTitle")}</div>
              {r.scaleLabel && (
                <span className="pgoal-card__status"
                  style={{ background: "var(--brand-50)", color: "var(--brand-700)", borderColor: "var(--brand-100)" }}>
                  {r.scaleLabel}
                </span>
              )}
            </div>
            {r.scaleDescription && <div className="pgoal-card__desc">{r.scaleDescription}</div>}
            <div className="pgoal-card__meta">
              <span className="pgoal-card__date">{t("patTests.takenAt", { date: azFormatDate(r.submittedAt) })}</span>
              <span style={{ fontWeight: 700, color: "var(--oxford)" }}>
                {t("patTests.scoreOf", { score: r.totalScore, max: r.maxScore })}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  return (
    <div className="pgoals">
      <PageHeader title={t("patTests.title")} subtitle={t("patTests.sub")} />

      {loading ? (
        <div className="pgoals__loading">{t("common.loading")}</div>
      ) : err ? (
        <div className="pgoals__error">{err}</div>
      ) : items.length === 0 && selfResults.length === 0 ? (
        <div className="pgoals__empty">
          <div className="pgoals__empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 2h6a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z" /><path d="M5 4h2v18a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm14 0h-2v18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
            </svg>
          </div>
          <div className="pgoals__empty-title">{t("patTests.emptyTitle")}</div>
          <p className="pgoals__empty-body">
            {t("patTests.emptyBody")}
          </p>
          <Link href="/patient/appointments" className="pgoals__empty-cta">{t("patTests.emptyCta")}</Link>
        </div>
      ) : (
        <>
        {selfSection}
        {items.length > 0 && (
        <section className="pgoals__section">
          <div className="pgoals__section-head">
            <h2>{t("patTests.allTests")}</h2>
            <span className="pgoals__section-n">{items.length}</span>
          </div>
          <div className="pgoals__list">
            {items.map(a => {
              const meta = statusMeta(a);
              const done = isDone(a);
              return (
                <article key={a.id} className="pgoal-card">
                  <div className="pgoal-card__top">
                    <div className="pgoal-card__title">{a.testTitle}</div>
                    <span className="pgoal-card__status"
                      style={{ background: meta.bg, color: meta.fg, borderColor: meta.border }}>
                      {t(meta.labelKey)}
                    </span>
                  </div>

                  {a.note && <div className="pgoal-card__desc">{a.note}</div>}

                  <div className="pgoal-card__meta">
                    <span className="pgoal-card__date">{t("patTests.assignedAt", { date: azFormatDate(a.assignedAt) })}</span>
                    {done && a.completedAt && (
                      <span style={{ color: "#065F46", fontWeight: 600 }}>
                        {t("patTests.completedAt", { date: azFormatDate(a.completedAt) })}
                      </span>
                    )}
                    <Link
                      href={`/patient/tests/${a.id}`}
                      className="pgoal-card__action"
                      style={done ? undefined : { color: "#fff", background: "var(--brand)", border: "none", padding: "6px 14px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
                      {done ? t("patTests.resultCta") : t("patTests.takeCta")}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        )}
        </>
      )}
    </div>
  );
}
