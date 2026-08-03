"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, use } from "react";
import { patientApi, type TakeTest, type TestResult } from "@/lib/api";
import { stripLeadingNumber } from "@/lib/testQuestion";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azFormatDate } from "@/lib/datetime";

export default function PatientTakeTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useT();
  const { id } = use(params);
  const assignmentId = Number(id);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [test, setTest] = useState<TakeTest | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  // questionId -> selectedOptionId
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    // A completed assignment must always surface the stored result (with the
    // patient's per-question answers) — never a blank re-take form. So we look
    // for a result FIRST; only when none exists do we load the take form.
    (async () => {
      try {
        const r = await patientApi.patientTestResult(assignmentId);
        if (!cancelled) setResult(r);
        return;
      } catch {
        // No stored result yet — the test hasn't been taken, so load the form.
      }
      try {
        const t = await patientApi.takeTest(assignmentId);
        if (!cancelled) setTest(t);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [assignmentId]);

  const allAnswered = useMemo(
    () => !!test && test.questions.every(q => answers[q.id] != null),
    [test, answers],
  );

  const select = (questionId: number, optionId: number) =>
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!test || !allAnswered) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const r = await patientApi.submitTest(assignmentId, {
        answers: test.questions.map(q => ({
          questionId: q.id,
          selectedOptionId: answers[q.id],
        })),
      });
      setResult(r);
    } catch (e) {
      setSubmitErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="pgoals">
        <div className="pgoals__loading">{t("common.loading")}</div>
      </div>
    );
  }

  if (err && !result && !test) {
    return (
      <div className="pgoals">
        <div className="pgoals__error">{err}</div>
        <div style={{ marginTop: 16 }}>
          <Link href="/patient/tests" className="pgoals__empty-cta">{t("patTests.back")}</Link>
        </div>
      </div>
    );
  }

  // Result view — after submit, or when the assignment was already completed.
  if (result) {
    return <ResultView result={result} title={test?.title} />;
  }

  if (!test) return null;

  return (
    <div className="pgoals">
      <header className="pgoals__head">
        <h1>{test.title}</h1>
        {test.description && <p>{test.description}</p>}
      </header>

      {test.note && (
        <div
          style={{
            background: "#FEF3C7",
            border: "1px solid #FDE68A",
            color: "#92400E",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 13,
            marginBottom: test.instructions ? 10 : 18,
            lineHeight: 1.5,
          }}>
          <strong>{t("patTests.psyNote")} </strong>{test.note}
        </div>
      )}

      {test.instructions && (
        <div
          style={{
            background: "var(--brand-50)",
            border: "1px solid var(--brand-100)",
            color: "var(--oxford)",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 13,
            marginBottom: 18,
            lineHeight: 1.5,
          }}>
          {test.instructions}
        </div>
      )}

      <form onSubmit={submit}>
        <div className="pgoals__list">
          {test.questions.map((q, qi) => {
            const selected = answers[q.id];
            return (
              <div
                key={q.id}
                role="radiogroup"
                aria-labelledby={`q-title-${q.id}`}
                className="pgoal-card"
                style={{ border: "1px solid var(--brand-100)", minWidth: 0 }}>
                <div
                  id={`q-title-${q.id}`}
                  style={{ fontWeight: 600, color: "var(--oxford)", fontSize: 14, marginBottom: 10, overflowWrap: "break-word" }}>
                  {qi + 1}. {stripLeadingNumber(q.text)}
                </div>
                {q.imageUrl && (
                   
                  <img
                    src={q.imageUrl}
                    alt=""
                    style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 10, border: "1px solid var(--brand-100)", objectFit: "contain", marginBottom: 10, display: "block" }}
                  />
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {q.options.map(opt => {
                    const isSel = selected === opt.id;
                    return (
                      <label
                        key={opt.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: `1px solid ${isSel ? "var(--brand)" : "#E5E7EB"}`,
                          background: isSel ? "var(--brand-50)" : "#fff",
                          cursor: "pointer",
                          fontSize: 13.5,
                          color: "var(--oxford)",
                          minWidth: 0,
                        }}>
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt.id}
                          checked={isSel}
                          onChange={() => select(q.id, opt.id)}
                          style={{ accentColor: "var(--brand)", flex: "0 0 auto" }}
                        />
                        {opt.imageUrl && (
                           
                          <img
                            src={opt.imageUrl}
                            alt=""
                            style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid #E5E7EB", flex: "0 0 auto" }}
                          />
                        )}
                        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {submitErr && (
          <div className="pgoals__error" style={{ marginTop: 16 }}>{submitErr}</div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 20,
          }}>
          <span style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>
            {t("patTests.answeredOf", { a: Object.keys(answers).length, t: test.questions.length })}
          </span>
          <button
            type="submit"
            disabled={!allAnswered || submitting}
            style={{
              padding: "10px 22px",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: allAnswered ? "var(--brand)" : "#9CA3AF",
              cursor: !allAnswered || submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}>
            {submitting ? t("common.sending") : t("patTests.finish")}
          </button>
        </div>
        {!allAnswered && (
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 8, textAlign: "right" }}>
            {t("patTests.answerAll")}
          </p>
        )}
      </form>
    </div>
  );
}

function ResultView({ result, title }: { result: TestResult; title?: string }) {
  const { t } = useT();
  const pct = Math.round(result.percentage);
  const sortedAnswers = useMemo(
    () => [...result.answers].sort((a, b) => a.displayOrder - b.displayOrder),
    [result],
  );
  return (
    <div className="pgoals">
      <header className="pgoals__head">
        <h1>{title ?? t("patTests.resultTitle")}</h1>
        <p>{t("patTests.resultSub")}</p>
      </header>

      <div className="pgoal-card" style={{ border: "1px solid var(--brand-100)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div
            style={{
              minWidth: 96,
              textAlign: "center",
              padding: "14px 18px",
              borderRadius: 14,
              background: "var(--brand-50)",
              border: "1px solid var(--brand-100)",
            }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: "var(--brand-700)", lineHeight: 1 }}>{pct}%</div>
            <div style={{ fontSize: 11.5, color: "var(--oxford-60)", marginTop: 4 }}>{t("patTests.resultWord")}</div>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
              {t("patTests.score", { score: result.totalScore, max: result.maxScore })}
            </div>
            {result.scaleLabel && (
              <div
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  padding: "4px 12px",
                  borderRadius: 999,
                  background: "#D1FAE5",
                  color: "#065F46",
                  fontSize: 13,
                  fontWeight: 600,
                }}>
                {result.scaleLabel}
              </div>
            )}
            {/* Psixoloqun bu zolaq üçün yazdığı izah — nəticənin adı tək başına
                pasiyentə nə demək olduğunu izah etmir. */}
            {result.scaleDescription && (
              <div style={{
                fontSize: 13.5, color: "var(--oxford)", lineHeight: 1.65,
                marginTop: 10, whiteSpace: "pre-wrap",
              }}>
                {result.scaleDescription}
              </div>
            )}
            {result.submittedAt && (
              <div style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 8 }}>
                {t("patTests.completedAt", { date: azFormatDate(result.submittedAt) })}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            height: 10,
            borderRadius: 999,
            background: "var(--brand-50)",
            overflow: "hidden",
          }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--brand)" }} />
        </div>
      </div>

      {sortedAnswers.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", margin: "0 0 12px" }}>
            {t("patTests.yourAnswers")} <span style={{ color: "var(--oxford-60)", fontWeight: 600 }}>({sortedAnswers.length})</span>
          </h2>
          <div className="pgoals__list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedAnswers.map((a, i) => (
              <div key={a.questionId} className="pgoal-card" style={{ border: "1px solid var(--brand-100)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--oxford)", marginBottom: 8 }}>
                  {i + 1}.{" "}
                  {a.questionText
                    ? stripLeadingNumber(a.questionText)
                    /* Test redaktə olunub və sual silinib — mətn heç yerdə qalmayıb.
                       Boş sətir əvəzinə səbəbi yazırıq. */
                    : <span style={{ fontStyle: "italic", color: "var(--oxford-60)", fontWeight: 500 }}>
                        {t("patTests.deletedQuestion")}
                      </span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "var(--oxford)", padding: "4px 10px", background: "var(--brand-50)", borderRadius: 8, border: "1px solid var(--brand-100)" }}>
                    {a.selectedLabel ?? t("patTests.deletedOption")}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#065F46", padding: "4px 10px", background: "#D1FAE5", borderRadius: 999 }}>
                    {t("patTests.points", { n: a.pointsAwarded })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Link href="/patient/tests" className="pgoals__empty-cta">{t("patTests.back")}</Link>
      </div>
    </div>
  );
}
