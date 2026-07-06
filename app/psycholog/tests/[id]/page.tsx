"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { psychologistApi, type TestResult } from "@/lib/api";
import { stripLeadingNumber } from "@/lib/testQuestion";

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

  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(assignmentId)) {
      setError("Yanlış təyinat nömrəsi");
      setLoading(false);
      return;
    }
    setLoading(true);
    // One assignment may hold many submissions (a re-usable public link). The
    // list endpoint returns all of them (newest first); a patient assignment
    // simply returns a single-element list.
    psychologistApi.testSubmissions(assignmentId)
      .then(r => { setResults(r); setError(null); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  const selected = useMemo(
    () => (selectedId != null ? results.find(r => r.resultId === selectedId) ?? null : null),
    [selectedId, results]
  );

  // Scale-band distribution across all submissions (screening overview).
  const distribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of results) {
      const k = r.scaleLabel || "Şkalasız";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [results]);

  return (
    <div>
      <Link href="/psycholog/tests" style={{ display: "inline-block", fontSize: 13, color: "#52718F", textDecoration: "none", marginBottom: 16 }}>
        ← Testlərə qayıt
      </Link>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>
          Yüklənir…
        </div>
      ) : error ? (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 18, borderRadius: 14, fontSize: 13 }}>
          {error}
        </div>
      ) : results.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F", border: "1px dashed #DDE6F0" }}>
          Hələ heç kim doldurmayıb.
        </div>
      ) : results.length === 1 ? (
        // Single submission (patient assignment or a link used once) — show detail directly.
        <ResultDetail result={results[0]} />
      ) : selected ? (
        // A taker was picked from the list — show their full breakdown.
        <>
          <button onClick={() => setSelectedId(null)}
            style={{ fontSize: 13, color: "var(--brand)", background: "transparent", border: "none", cursor: "pointer", padding: 0, marginBottom: 14 }}>
            ← Bütün cavablandıranlar ({results.length})
          </button>
          <ResultDetail result={selected} />
        </>
      ) : (
        // Many submissions through one public link — overview + takers table.
        <>
          <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #EEF2F7", marginBottom: 18 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A2535", margin: "0 0 4px" }}>
              Cavablandıranlar <span style={{ color: "#52718F", fontWeight: 600 }}>({results.length})</span>
            </h1>
            <p style={{ fontSize: 13, color: "#52718F", margin: "0 0 14px" }}>
              Bir public link — bir neçə nəfər. Təfərrüat üçün sətrə klikləyin.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {distribution.map(([label, n]) => (
                <span key={label} style={{
                  fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 999,
                  background: "#F1F5F9", color: "#374151",
                }}>
                  {label}: <b>{n}</b>
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", textAlign: "left" }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Respondent</th>
                  <th style={thStyle}>Bal</th>
                  <th style={thStyle}>Faiz</th>
                  <th style={thStyle}>Şkala</th>
                  <th style={thStyle}>Tarix</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const pct = Math.round(r.percentage);
                  const tone = pctTone(pct);
                  return (
                    <tr key={r.resultId} onClick={() => setSelectedId(r.resultId)}
                      style={{ borderTop: "1px solid #EEF2F7", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--brand-50)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ ...tdStyle, color: "#9AAFC4" }}>{results.length - i}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "#1A2535" }}>{r.respondentName || "Anonim"}</td>
                      <td style={tdStyle}>{r.totalScore} / {r.maxScore}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999, color: tone.fg, background: tone.bg }}>{pct}%</span>
                      </td>
                      <td style={{ ...tdStyle, color: "#374151" }}>{r.scaleLabel || "—"}</td>
                      <td style={{ ...tdStyle, color: "#52718F" }}>{fmtDateTime(r.submittedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Single-result detail (overall + per-question) ───────────────────────── */

function ResultDetail({ result }: { result: TestResult }) {
  const sortedAnswers = useMemo(
    () => [...result.answers].sort((a, b) => a.displayOrder - b.displayOrder),
    [result]
  );
  const pct = Math.round(result.percentage);
  const tone = pctTone(pct);

  return (
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
                    {stripLeadingNumber(a.questionText)}
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
  );
}

const thStyle: React.CSSProperties = {
  padding: "11px 16px", fontSize: 11, fontWeight: 700, color: "#52718F",
  textTransform: "uppercase", letterSpacing: 0.4,
};
const tdStyle: React.CSSProperties = { padding: "12px 16px", verticalAlign: "middle" };

function Stat({ label, value, accentFg, accentBg }: { label: string; value: string; accentFg?: string; accentBg?: string }) {
  return (
    <div style={{ background: accentBg ?? "#F8FAFC", border: "1px solid #EEF2F7", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#52718F", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accentFg ?? "#1A2535", marginTop: 4, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}
