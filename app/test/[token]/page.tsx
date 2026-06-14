"use client";

/**
 * Modul F — PUBLIC test götürmə səhifəsi (auth YOXDUR).
 * Paylaşılan link vasitəsilə açılır: /test/{token}.
 * Panel qabığından kənardadır — özünü-tam saxlayan, sadə inline stillər.
 */

import { use, useEffect, useMemo, useState } from "react";
import {
  getPublicTest,
  submitPublicTest,
  type TakeTest,
  type TestResult,
} from "@/lib/api";

const BRAND = "#0B3F90";
const BRAND_DARK = "#082F6D";
const BRAND_50 = "#F2F6FD";
const INK = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

export default function PublicTestPage({ params }: { params: Promise<{ token: string }> }) {
  // Next 16: route params gəlir Promise kimi — client komponentdə React.use() ilə açılır.
  const { token } = use(params);

  const [test, setTest] = useState<TakeTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [respondentName, setRespondentName] = useState("");
  // questionId -> selectedOptionId
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getPublicTest(token)
      .then((t) => {
        if (cancelled) return;
        setTest(t);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(
          "Bu test linki tapılmadı və ya etibarlılıq müddəti bitib. Zəhmət olmasa linki göndərən şəxslə əlaqə saxlayın.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const questions = useMemo(() => test?.questions ?? [], [test]);
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] != null).length,
    [questions, answers],
  );
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const pick = (questionId: number, optionId: number) => {
    setSubmitError(null);
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!test || submitting) return;
    setSubmitError(null);
    if (!allAnswered) {
      setSubmitError("Davam etmək üçün bütün sualları cavablandırın.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitPublicTest(token, {
        answers: questions.map((q) => ({
          questionId: q.id,
          selectedOptionId: answers[q.id],
        })),
        respondentName: respondentName.trim() || undefined,
      });
      setResult(res);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError((err as Error).message || "Test göndərilərkən xəta baş verdi.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Shell>
        <div style={{ ...card, textAlign: "center", color: MUTED }}>Yüklənir…</div>
      </Shell>
    );
  }

  // ── Load error (invalid / expired token) ────────────────────────────────
  if (loadError || !test) {
    return (
      <Shell>
        <div style={{ ...card, textAlign: "center" }}>
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#FEE2E2",
              color: "#991B1B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            !
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: INK, margin: "0 0 8px" }}>
            Test açıla bilmədi
          </h1>
          <p style={{ color: MUTED, margin: 0, lineHeight: 1.6 }}>
            {loadError ?? "Test tapılmadı."}
          </p>
        </div>
      </Shell>
    );
  }

  // ── Result screen ───────────────────────────────────────────────────────
  if (result) {
    const pct = Math.round(result.percentage);
    return (
      <Shell>
        <div style={card}>
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#D1FAE5",
              color: "#065F46",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 6px", textAlign: "center" }}>
            Test tamamlandı
          </h1>
          <p style={{ color: MUTED, margin: "0 0 24px", textAlign: "center", lineHeight: 1.6 }}>
            Cavablarınız üçün təşəkkür edirik. Nəticəniz aşağıdadır.
          </p>

          {result.scaleLabel && (
            <div
              style={{
                background: BRAND_50,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: "16px 18px",
                textAlign: "center",
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 4, letterSpacing: 0.3, textTransform: "uppercase" }}>
                Nəticə
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: BRAND_DARK }}>{result.scaleLabel}</div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Metric label="Bal" value={`${result.totalScore} / ${result.maxScore}`} />
            <Metric label="Faiz" value={`${pct}%`} />
          </div>

          <div style={{ marginTop: 18 }}>
            <div
              style={{
                height: 10,
                background: BORDER,
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, pct))}%`,
                  height: "100%",
                  background: BRAND,
                  borderRadius: 999,
                  transition: "width .4s ease",
                }}
              />
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Test form ───────────────────────────────────────────────────────────
  return (
    <Shell>
      <form onSubmit={onSubmit}>
        <div style={{ ...card, marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: INK, margin: "0 0 8px", lineHeight: 1.3 }}>
            {test.title}
          </h1>
          {test.description && (
            <p style={{ color: MUTED, margin: "0 0 14px", lineHeight: 1.65 }}>{test.description}</p>
          )}
          {test.instructions && (
            <div
              style={{
                background: BRAND_50,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: "14px 16px",
                color: "#334155",
                lineHeight: 1.6,
                fontSize: 14,
                whiteSpace: "pre-wrap",
              }}
            >
              {test.instructions}
            </div>
          )}

          <label style={{ display: "block", marginTop: 18 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: INK, marginBottom: 6 }}>
              Adınız <span style={{ color: MUTED, fontWeight: 400 }}>(istəyə bağlı)</span>
            </span>
            <input
              type="text"
              value={respondentName}
              onChange={(e) => setRespondentName(e.target.value)}
              placeholder="Ad, soyad"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 14px",
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                fontSize: 15,
                color: INK,
                outline: "none",
                background: "#fff",
              }}
            />
          </label>
        </div>

        {questions.map((q, idx) => {
          const selected = answers[q.id];
          return (
            <fieldset
              key={q.id}
              style={{
                ...card,
                marginBottom: 14,
                border: `1px solid ${BORDER}`,
                padding: "20px 22px",
              }}
            >
              <legend style={{ padding: 0 }} />
              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <span
                  style={{
                    flex: "0 0 auto",
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: BRAND_50,
                    color: BRAND,
                    fontWeight: 700,
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {idx + 1}
                </span>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: INK, lineHeight: 1.5, paddingTop: 3 }}>
                  {q.text}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {q.options.map((opt) => {
                  const active = selected === opt.id;
                  return (
                    <label
                      key={opt.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "11px 14px",
                        border: `1.5px solid ${active ? BRAND : BORDER}`,
                        background: active ? BRAND_50 : "#fff",
                        borderRadius: 10,
                        cursor: "pointer",
                        transition: "border-color .15s, background .15s",
                      }}
                    >
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        value={opt.id}
                        checked={active}
                        onChange={() => pick(q.id, opt.id)}
                        style={{ accentColor: BRAND, width: 18, height: 18, flex: "0 0 auto" }}
                      />
                      <span style={{ fontSize: 15, color: INK, lineHeight: 1.4 }}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div style={{ ...card, position: "sticky", bottom: 16, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: MUTED }}>
              {answeredCount} / {questions.length} cavablandı
            </span>
            <button
              type="submit"
              disabled={submitting || !allAnswered}
              style={{
                padding: "12px 28px",
                borderRadius: 10,
                border: "none",
                background: submitting || !allAnswered ? "#94A3B8" : BRAND,
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: submitting || !allAnswered ? "not-allowed" : "pointer",
                transition: "background .15s",
              }}
              title={!allAnswered ? "Bütün sualları cavablandırın" : undefined}
            >
              {submitting ? "Göndərilir…" : "Testi göndər"}
            </button>
          </div>
          {submitError && (
            <div
              style={{
                marginTop: 12,
                background: "#FEE2E2",
                color: "#991B1B",
                border: "1px solid #FECACA",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 14,
              }}
            >
              {submitError}
            </div>
          )}
        </div>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        padding: "32px 16px 64px",
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: "24px 26px",
  boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: "14px 16px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 4, letterSpacing: 0.3, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>{value}</div>
    </div>
  );
}
