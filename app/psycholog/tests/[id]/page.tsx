"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { psychologistApi, type TestResult } from "@/lib/api";

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function pctTone(pct: number): { fg: string; bg: string } {
  if (pct >= 70) return { fg: "#991B1B", bg: "#FEE2E2" };
  if (pct >= 40) return { fg: "#92400E", bg: "#FEF3C7" };
  return { fg: "#065F46", bg: "#D1FAE5" };
}

export default function TestResultPage() {
  const params = useParams<{ id: string }>();
  const assignmentId = Number(params.id);

  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(assignmentId)) {
      setError("Yanlış təyinat nömrəsi");
      setLoading(false);
      return;
    }
    setLoading(true);
    psychologistApi.testResult(assignmentId)
      .then(r => { setResult(r); setError(null); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  const sortedAnswers = useMemo(() => {
    if (!result) return [];
    return [...result.answers].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [result]);

  const pct = result ? Math.round(result.percentage) : 0;
  const tone = pctTone(pct);

  return (
    <div>
      <Link href="/psycholog/tests" style={{ display: "inline-block", fontSize: 13, color: "#52718F", textDecoration: "none", marginBottom: 16 }}>
        ← Testlərə qayıt
      </Link>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>
          Yüklənir…
        </div>
      ) : error || !result ? (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 18, borderRadius: 14, fontSize: 13 }}>
          {error ?? "Nəticə tapılmadı."}
        </div>
      ) : (
        <>
          {/* ── Overall result ──────────────────────────────────────────────── */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #EEF2F7", marginBottom: 18 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A2535", margin: 0 }}>Test nəticəsi</h1>
              {result.scaleLabel && (
                <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999, color: tone.fg, background: tone.bg }}>
                  {result.scaleLabel}
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
              <Stat label="Ümumi bal" value={`${result.totalScore} / ${result.maxScore}`} />
              <Stat label="Faiz" value={`${pct}%`} accentFg={tone.fg} accentBg={tone.bg} />
              <Stat label="Respondent" value={result.respondentName || "—"} />
              <Stat label="Təqdim tarixi" value={fmtDateTime(result.submittedAt)} />
            </div>

            {/* Score bar */}
            <div>
              <div style={{ height: 10, borderRadius: 999, background: "#EEF2F7", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: tone.fg, borderRadius: 999, transition: "width .3s" }} />
              </div>
            </div>
          </div>

          {/* ── Per-question breakdown ──────────────────────────────────────── */}
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", margin: "0 0 12px" }}>
            Cavabların təfərrüatı <span style={{ color: "#52718F", fontWeight: 600 }}>({sortedAnswers.length})</span>
          </h2>

          {sortedAnswers.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F", border: "1px dashed #DDE6F0" }}>
              Cavab məlumatı yoxdur.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedAnswers.map((a, i) => (
                <div key={a.questionId} style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #EEF2F7" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#9AAFC4", minWidth: 22, paddingTop: 1 }}>
                      {i + 1}.
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1A2535", marginBottom: 8 }}>
                        {a.questionText}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, color: "#374151", padding: "4px 10px", background: "var(--brand-50)", borderRadius: 8, border: "1px solid var(--brand-100)" }}>
                          {a.selectedLabel}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#065F46", padding: "4px 10px", background: "#D1FAE5", borderRadius: 999 }}>
                          {a.pointsAwarded} bal
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accentFg, accentBg }: { label: string; value: string; accentFg?: string; accentBg?: string }) {
  return (
    <div style={{ background: accentBg ?? "#F8FAFC", border: "1px solid #EEF2F7", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#52718F", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accentFg ?? "#1A2535", marginTop: 4, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}
