"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, use } from "react";
import { patientApi, type TakeTest, type TestResult } from "@/lib/api";

export default function PatientTakeTestPage({ params }: { params: Promise<{ id: string }> }) {
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
        <div className="pgoals__loading">Yüklənir…</div>
      </div>
    );
  }

  if (err && !result && !test) {
    return (
      <div className="pgoals">
        <div className="pgoals__error">{err}</div>
        <div style={{ marginTop: 16 }}>
          <Link href="/patient/tests" className="pgoals__empty-cta">← Testlərə qayıt</Link>
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
          <strong>Psixoloqunuzdan qeyd: </strong>{test.note}
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
              <fieldset key={q.id} className="pgoal-card" style={{ border: "1px solid var(--brand-100)" }}>
                <legend style={{ fontWeight: 600, color: "var(--oxford)", fontSize: 14, marginBottom: 10, padding: 0 }}>
                  {qi + 1}. {stripLeadingNumber(q.text)}
                </legend>
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
                        }}>
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt.id}
                          checked={isSel}
                          onChange={() => select(q.id, opt.id)}
                          style={{ accentColor: "var(--brand)" }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
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
            {Object.keys(answers).length} / {test.questions.length} sual cavablandırıldı
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
            {submitting ? "Göndərilir…" : "Testi tamamla"}
          </button>
        </div>
        {!allAnswered && (
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 8, textAlign: "right" }}>
            Bütün suallara cavab verin.
          </p>
        )}
      </form>
    </div>
  );
}

// Question text is sometimes authored with its own leading "N." prefix,
// which would otherwise duplicate the {index + 1} badge we render next to it.
// Strips any leading numbering the author baked into the question text so we
// don't double it against our own index. Handles single ("6."), compound
// ("6.6.", "1.2.3.") and spaced ("6. 6.") forms alike.
function stripLeadingNumber(text: string): string {
  return text.replace(/^\s*(\d+[.)]\s*)+/, "");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const months = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function ResultView({ result, title }: { result: TestResult; title?: string }) {
  const pct = Math.round(result.percentage);
  const sortedAnswers = useMemo(
    () => [...result.answers].sort((a, b) => a.displayOrder - b.displayOrder),
    [result],
  );
  return (
    <div className="pgoals">
      <header className="pgoals__head">
        <h1>{title ?? "Test nəticəsi"}</h1>
        <p>Cavablarınız qeydə alındı. Aşağıda nəticəniz göstərilir.</p>
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
            <div style={{ fontSize: 11.5, color: "var(--oxford-60)", marginTop: 4 }}>nəticə</div>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
              {result.totalScore} / {result.maxScore} bal
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
            {result.submittedAt && (
              <div style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 8 }}>
                Tamamlandı: {fmtDate(result.submittedAt)}
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
            Cavablarınız <span style={{ color: "var(--oxford-60)", fontWeight: 600 }}>({sortedAnswers.length})</span>
          </h2>
          <div className="pgoals__list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedAnswers.map((a, i) => (
              <div key={a.questionId} className="pgoal-card" style={{ border: "1px solid var(--brand-100)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--oxford)", marginBottom: 8 }}>
                  {i + 1}. {stripLeadingNumber(a.questionText)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "var(--oxford)", padding: "4px 10px", background: "var(--brand-50)", borderRadius: 8, border: "1px solid var(--brand-100)" }}>
                    {a.selectedLabel}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#065F46", padding: "4px 10px", background: "#D1FAE5", borderRadius: 999 }}>
                    {a.pointsAwarded} bal
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Link href="/patient/tests" className="pgoals__empty-cta">← Testlərə qayıt</Link>
      </div>
    </div>
  );
}
