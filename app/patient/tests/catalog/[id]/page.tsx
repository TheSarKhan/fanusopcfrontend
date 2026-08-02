"use client";

// Publik testin paneldən doldurulması. Saytdakı variantdan fərqi: istifadəçi girişlidir,
// ona görə nəticə dərhal hesaba yazılır və tamamlananda detal səhifəsinə keçirilir —
// token/sahiblənmə addımı ümumiyyətlə yoxdur.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { patientApi, type TakeTest } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function PatientTakeCatalogTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const testId = Number(id);
  const { t } = useT();
  const router = useRouter();

  const [test, setTest] = useState<TakeTest | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    patientApi.takeCatalogTest(testId)
      .then(setTest)
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [testId]);

  const total = test?.questions.length ?? 0;
  const answered = Object.keys(answers).length;
  const ready = total > 0 && answered === total;

  const submit = async () => {
    if (!ready || busy || !test) return;
    setBusy(true);
    try {
      const r = await patientApi.submitCatalogTest(testId, {
        answers: test.questions.map(q => ({ questionId: q.id, selectedOptionId: answers[q.id] })),
      });
      router.push(`/patient/tests/result/${r.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("testsPage.submitFailed"));
      setBusy(false);
    }
  };

  if (loading) return <div className="pgoals"><div className="pgoals__loading">{t("common.loading")}</div></div>;
  if (err || !test) {
    return (
      <div className="pgoals">
        <div className="pgoals__error">{err ?? t("testsPage.errorTitle")}</div>
        <Link href="/patient/tests/catalog" className="pgoal-card__action">{t("patTests.backToCatalog")}</Link>
      </div>
    );
  }

  return (
    <div className="pgoals">
      <PageHeader title={test.title} subtitle={test.instructions ?? undefined} />

      <div style={{ marginBottom: 16 }}>
        <Link href="/patient/tests/catalog" className="pgoal-card__action">{t("patTests.backToCatalog")}</Link>
      </div>

      <section className="pgoals__section">
        <div className="pgoals__list">
          {test.questions.map((q, qi) => (
            <article key={q.id} className="pgoal-card">
              <div className="pgoal-card__title" style={{ marginBottom: 10 }}>
                {qi + 1}. {q.text}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {q.options.map(o => {
                  const selected = answers[q.id] === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setAnswers(p => ({ ...p, [q.id]: o.id }))}
                      style={{
                        textAlign: "left", padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                        border: selected ? "2px solid var(--brand)" : "2px solid var(--brand-100)",
                        background: selected ? "var(--brand-50)" : "#fff",
                        color: selected ? "var(--brand-700)" : "var(--oxford)",
                        fontWeight: selected ? 700 : 500, fontSize: 14,
                      }}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--oxford-60)" }}>
          {t("patTests.answeredOf", { a: answered, t: total })}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!ready || busy}
          style={{
            padding: "10px 22px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14,
            color: "#fff", background: ready && !busy ? "var(--brand)" : "var(--oxford-30, #B8C6D6)",
            cursor: ready && !busy ? "pointer" : "not-allowed",
          }}>
          {busy ? t("common.sending") : t("patTests.finishCta")}
        </button>
      </div>
    </div>
  );
}
