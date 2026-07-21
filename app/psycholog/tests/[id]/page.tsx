"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { psychologistApi, type TestResult } from "@/lib/api";
import { stripLeadingNumber } from "@/lib/testQuestion";
import { azFormatDateTime } from "@/lib/datetime";
import { Button, DataTable, Status, type Column } from "@/components/ui";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Bütün tarixlər gg.aa.iiii formatındadır (@/lib/datetime). */
function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  return azFormatDateTime(iso);
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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Serverdə səhifələnir: backend 0-dan sayır.
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(assignmentId)) {
      setError("Yanlış təyinat nömrəsi");
      setLoading(false);
      return;
    }
    setLoading(true);
    // One assignment may hold many submissions (a re-usable public link). The
    // list endpoint returns all of them (newest first); a patient assignment
    // simply returns a single-element page.
    psychologistApi.testSubmissionsPaged(assignmentId, { page, size })
      .then(res => { setResults(res.content); setTotal(res.totalElements); setError(null); })
      .catch(e => setError((e as Error).message || "Nəticələr yüklənmədi"))
      .finally(() => setLoading(false));
  }, [assignmentId, page, size, nonce]);

  const selected = useMemo(
    () => (selectedId != null ? results.find(r => r.resultId === selectedId) ?? null : null),
    [selectedId, results]
  );

  // Scale-band distribution. Serverdə səhifələnir — bu paylanma yalnız
  // hazırkı səhifədəki cavablara aiddir, ona görə başlıqda da belə yazılır.
  const distribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of results) {
      const k = r.scaleLabel || "Şkalasız";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [results]);

  const pageCount = Math.max(1, Math.ceil(total / size));

  /**
   * Sütunlar. Psixoloji test nəticəsi HEÇ VAXT rənglənmir —
   * faiz və şkala neytral mətndir.
   */
  // Sıra nömrəsi bütün siyahıya görədir (ən yeni ən böyük nömrə), yalnız səhifəyə görə yox.
  const rowIndex = useMemo(() => {
    const m = new Map<number, number>();
    results.forEach((r, i) => m.set(r.resultId, i));
    return m;
  }, [results]);

  const columns: Column<TestResult>[] = useMemo(() => [
    {
      key: "no",
      header: "Sıra",
      numeric: true,
      width: 70,
      cell: (r) => <span className="fx-muted">{total - (page * size + (rowIndex.get(r.resultId) ?? 0))}</span>,
    },
    {
      key: "respondent",
      header: "Respondent",
      cell: (r) => <span style={{ fontWeight: 600 }}>{r.respondentName || "Anonim"}</span>,
    },
    {
      key: "score",
      header: "Bal",
      numeric: true,
      cell: (r) => <span style={{ whiteSpace: "nowrap" }}>{r.totalScore} / {r.maxScore}</span>,
    },
    {
      key: "percentage",
      header: "Faiz",
      numeric: true,
      cell: (r) => <span>{Math.round(r.percentage)}%</span>,
    },
    {
      key: "scaleLabel",
      header: "Şkala",
      cell: (r) => (r.scaleLabel ? <Status>{r.scaleLabel}</Status> : <span className="fx-muted">—</span>),
    },
    {
      key: "submittedAt",
      header: "Tarix",
      cell: (r) => <span style={{ whiteSpace: "nowrap" }}>{fmtDateTime(r.submittedAt)}</span>,
    },
  ], [rowIndex, total, page, size]);

  // Tək təqdimat (pasiyent təyinatı və ya bir dəfə işlədilmiş link) — birbaşa detal.
  const singleResult = !loading && !error && total === 1 && results.length === 1;

  return (
    <div>
      <Link href="/psycholog/tests" style={{ display: "inline-block", fontSize: 13, color: "#52718F", textDecoration: "none", marginBottom: 16 }}>
        ← Testlərə qayıt
      </Link>

      {selected ? (
        // A taker was picked from the list — show their full breakdown.
        <>
          <div style={{ marginBottom: 14 }}>
            <Button variant="quiet" size="sm" onClick={() => setSelectedId(null)}>
              ← Bütün cavablandıranlar ({total})
            </Button>
          </div>
          <ResultDetail result={selected} />
        </>
      ) : singleResult ? (
        <ResultDetail result={results[0]} />
      ) : (
        // Many submissions through one public link — overview + takers table.
        <>
          {!loading && !error && total > 1 && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #EEF2F7", marginBottom: 18 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A2535", margin: "0 0 4px" }}>
                Cavablandıranlar <span style={{ color: "#52718F", fontWeight: 600 }}>({total})</span>
              </h1>
              <p style={{ fontSize: 13, color: "#52718F", margin: "0 0 14px" }}>
                Bir public link — bir neçə nəfər. Təfərrüat üçün sətrə klikləyin.
              </p>
              <div style={{ fontSize: 12, color: "#52718F", marginBottom: 8 }}>
                Bu səhifədəki şkala paylanması
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {distribution.map(([label, n]) => (
                  <div key={label} style={{ fontSize: 13, color: "#374151" }}>
                    {label}: <b>{n}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: 14 }}>
            <DataTable
              rows={results}
              columns={columns}
              rowKey={(r) => r.resultId}
              loading={loading}
              error={error}
              onRetry={() => setNonce(n => n + 1)}
              minWidth={720}
              onRowClick={(r) => setSelectedId(r.resultId)}
              empty={{
                title: "Hələ heç kim doldurmayıb",
                body: "Testi pasiyentə təyin etdikdən və ya public linki paylaşdıqdan sonra cavablar burada siyahılanacaq.",
              }}
              // Backend 0-dan sayır, Pagination 1-dən — çevirmə burada aparılır.
              pagination={{
                page: page + 1,
                pageCount,
                onChange: (p) => { setPage(p - 1); setSelectedId(null); },
                pageSize: size,
                onPageSizeChange: (n) => { setSize(n); setPage(0); setSelectedId(null); },
                pageSizeOptions: PAGE_SIZE_OPTIONS,
              }}
              totalLabel={`${total ? page * size + 1 : 0}–${Math.min(total, (page + 1) * size)} / ${total}`}
            />
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 12, marginBottom: 16 }}>
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

function Stat({ label, value, accentFg, accentBg }: { label: string; value: string; accentFg?: string; accentBg?: string }) {
  return (
    <div style={{ background: accentBg ?? "#F8FAFC", border: "1px solid #EEF2F7", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#52718F", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accentFg ?? "#1A2535", marginTop: 4, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}
