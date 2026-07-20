"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  psychologistApi,
  type ClientSummary,
  type PsyTest,
  type TestResult,
  type TestResultRow,
  type TestStatsSummary,
} from "@/lib/api";
import AssignTestModal from "@/components/AssignTestModal";

/* ── helpers ─────────────────────────────────────────────────────────────── */
function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const PANEL_SUBS = new Set(["patient", "psycholog", "operator", "admin"]);
function publicOrigin(): string {
  const { protocol, hostname, port } = window.location;
  const parts = hostname.split(".");
  if (parts.length > 1 && PANEL_SUBS.has(parts[0])) parts.shift();
  return `${protocol}//${parts.join(".")}${port ? `:${port}` : ""}`;
}
function toPublicUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${publicOrigin()}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return `${publicOrigin()}${url.startsWith("/") ? "" : "/"}${url}`;
  }
}

const BAND_COLORS = ["#16A34A", "#84CC16", "#CA8A04", "#EA580C", "#DC2626", "#7C3AED"];
const BAR_PALETTE = ["#F87171", "#FB923C", "#FBBF24", "#A3E635", "#4ADE80", "#22C55E"];
const barColor = (i: number, n: number) => BAR_PALETTE[Math.round((n <= 1 ? 1 : i / (n - 1)) * (BAR_PALETTE.length - 1))];

/* ── icons ───────────────────────────────────────────────────────────────── */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IconUsers = () => (<svg width="20" height="20" viewBox="0 0 24 24" {...S}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
const IconTrend = () => (<svg width="20" height="20" viewBox="0 0 24 24" {...S}><path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></svg>);
const IconPercent = () => (<svg width="20" height="20" viewBox="0 0 24 24" {...S}><path d="M19 5L5 19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>);
const IconAward = () => (<svg width="20" height="20" viewBox="0 0 24 24" {...S}><circle cx="12" cy="8" r="6" /><path d="M15.5 13.5L17 22l-5-3-5 3 1.5-8.5" /></svg>);
const IconEdit = () => (<svg width="15" height="15" viewBox="0 0 24 24" {...S}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>);
const IconShare = () => (<svg width="15" height="15" viewBox="0 0 24 24" {...S}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" /></svg>);
const IconDownload = () => (<svg width="15" height="15" viewBox="0 0 24 24" {...S}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>);
const IconEye = () => (<svg width="15" height="15" viewBox="0 0 24 24" {...S}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>);
const IconTrash = () => (<svg width="15" height="15" viewBox="0 0 24 24" {...S}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>);

function Kpi({ icon, iconBg, iconColor, label, value }: { icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 200, background: "#fff", border: "1px solid #EEF2F7", borderRadius: 16, padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: iconBg, color: iconColor, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1A2535", marginTop: 3 }}>{value}</div>
      </div>
    </div>
  );
}

export default function PsyTestStatsPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const [test, setTest] = useState<PsyTest | null>(null);
  const [summary, setSummary] = useState<TestStatsSummary | null>(null);
  const [rows, setRows] = useState<TestResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  const [assignOpen, setAssignOpen] = useState(false);
  const [detail, setDetail] = useState<TestResult | null>(null);
  const [detailBusy, setDetailBusy] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [link, setLink] = useState<{ url: string; token: string } | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // debounce search → reset to first page
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 350); return () => clearTimeout(t); }, [search]);

  // initial: test info + aggregate summary + clients
  useEffect(() => {
    if (!Number.isFinite(id)) { setError("Yanlış test nömrəsi"); setLoading(false); return; }
    Promise.all([
      psychologistApi.previewTest(id),
      psychologistApi.testStatsSummary(id).catch(() => null),
      psychologistApi.clients().catch(() => [] as ClientSummary[]),
    ])
      .then(([t, s, cs]) => { setTest(t); setSummary(s); setClients(cs); setError(null); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  // backend-paged table
  useEffect(() => {
    if (!Number.isFinite(id)) return;
    setTableLoading(true);
    psychologistApi.testResultsPaged(id, { page, size, q: debounced })
      .then((p) => { setRows(p.content); setTotal(p.totalElements); })
      .catch(() => {})
      .finally(() => setTableLoading(false));
  }, [id, page, size, debounced]);

  const reloadStats = () => {
    psychologistApi.testStatsSummary(id).then(setSummary).catch(() => {});
    psychologistApi.testResultsPaged(id, { page, size, q: debounced }).then((p) => { setRows(p.content); setTotal(p.totalElements); }).catch(() => {});
  };

  const scaleColor = useMemo(() => {
    const m = new Map<string, string>();
    (test?.scales ?? []).forEach((s, i) => m.set(s.label, s.color ?? BAND_COLORS[i % BAND_COLORS.length]));
    return m;
  }, [test]);

  const pieGroups = (summary?.scaleCounts ?? []).map((sc) => ({ label: sc.label, count: sc.count, color: scaleColor.get(sc.label) ?? "#94A3B8" }));
  const bars = summary?.buckets ?? [];
  const barMax = Math.max(1, ...bars.map((b) => b.count));
  // Denominator = test's maximum possible score (stays correct even with 0 takers).
  const testMax = useMemo(
    () => (test ? test.questions.reduce((s, q) => s + (q.options.length ? Math.max(...q.options.map((o) => o.points)) : 0), 0) : 0),
    [test]
  );
  const maxScore = testMax || (summary?.maxScore ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / size));

  const onShare = async () => {
    setShareOpen(true);
    if (link) return;
    setLinkBusy(true);
    try { const res = await psychologistApi.createTestLink({ testId: id }); setLink({ url: toPublicUrl(res.url), token: res.token }); }
    catch (e) { alert((e as Error).message); }
    finally { setLinkBusy(false); }
  };
  const copyLink = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link.url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { alert("Kopyalamaq alınmadı"); }
  };
  const openDetail = async (resultId: number) => {
    setDetailBusy(resultId);
    try { setDetail(await psychologistApi.testResultDetail(resultId)); }
    catch (e) { alert((e as Error).message); }
    finally { setDetailBusy(null); }
  };
  const onDelete = async (resultId: number) => {
    if (!confirm("Bu nəticəni silmək istəyirsiniz?")) return;
    try { await psychologistApi.deleteTestResult(resultId); reloadStats(); }
    catch (e) { alert((e as Error).message); }
  };

  const exportCsv = async () => {
    const all = await psychologistApi.testResults(id).catch(() => rows);
    const cell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [["Ad", "Mənbə", "Bal", "Maksimal", "Faiz", "Nəticə", "Tarix"].join(",")];
    all.forEach((r) => lines.push([
      cell(r.respondentName?.trim() || "Anonim"),
      r.publicLink ? "Public link" : "Təyinat",
      r.totalScore, r.maxScore, Math.round(r.percentage),
      cell(r.scaleLabel ?? ""), cell(fmtDateTime(r.submittedAt)),
    ].join(",")));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(test?.title ?? "netice").replace(/[\\/:*?"<>|]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const hbtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" };

  return (
    <div className="panel-page">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <button type="button" onClick={() => router.push("/psycholog/tests")} aria-label="Geri"
          style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #EEF2F7", background: "#fff", color: "#52718F", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>←</button>
        <h1 style={{ flex: 1, minWidth: 180, fontSize: 20, fontWeight: 700, color: "#1A2535", margin: 0 }}>{test?.title ?? "Statistika"}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => router.push(`/psycholog/tests/manage/${id}/edit`)} style={{ ...hbtn, border: "1px solid #E5E7EB", background: "#fff", color: "#374151" }}><IconEdit /> Redaktə et</button>
          <button type="button" onClick={onShare} style={{ ...hbtn, border: "1px solid #E5E7EB", background: "#fff", color: "#374151" }}><IconShare /> Paylaş</button>
          <button type="button" onClick={exportCsv} style={{ ...hbtn, border: "none", background: "#16A34A", color: "#fff" }}><IconDownload /> Excel ixracı</button>
        </div>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : error || !test ? (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 18, borderRadius: 14, fontSize: 13 }}>{error ?? "Test tapılmadı."}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* KPI */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Kpi icon={<IconUsers />} iconBg="#EEF4F9" iconColor="#3B6FA5" label="İştirakçılar" value={summary?.total ?? 0} />
            <Kpi icon={<IconTrend />} iconBg="#DCFCE7" iconColor="#16A34A" label="Ort. bal" value={<>{(summary?.avgScore ?? 0).toFixed(1)} <span style={{ fontSize: 13, color: "#8AAABF", fontWeight: 600 }}>/ {maxScore}</span></>} />
            <Kpi icon={<IconPercent />} iconBg="#FEF3C7" iconColor="#B45309" label="Ort. faiz" value={`${summary?.avgPercent ?? 0}%`} />
            <Kpi icon={<IconAward />} iconBg="#EDE9FE" iconColor="#7C3AED" label="Ən yüksək bal" value={<>{summary?.topScore ?? 0} <span style={{ fontSize: 13, color: "#8AAABF", fontWeight: 600 }}>/ {maxScore}</span></>} />
          </div>

          {/* Pie (zolaq) + bar (bal aralıqları) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            <div style={{ background: "#fff", border: "1px solid #EEF2F7", borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1A2535" }}>Nəticə zolaqları</div>
              <div style={{ fontSize: 12, color: "#52718F", margin: "2px 0 16px" }}>İştirakçıların ən çox düşdüyü nəticə zolağı</div>
              {pieGroups.length === 0 ? (
                <div style={{ color: "#52718F", fontSize: 13, padding: "16px 0" }}>Hələ cavab yoxdur.</div>
              ) : (<ScalePie groups={pieGroups} />)}
            </div>

            <div style={{ background: "#fff", border: "1px solid #EEF2F7", borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1A2535" }}>Bal paylanması</div>
              <div style={{ fontSize: 12, color: "#52718F", margin: "2px 0 16px" }}>İştirakçıların topladığı bal aralıqlarına görə</div>
              {bars.length === 0 || (summary?.total ?? 0) === 0 ? (
                <div style={{ color: "#52718F", fontSize: 13, padding: "16px 0" }}>Hələ cavab yoxdur.</div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 150 }}>
                    {bars.map((b, i) => (
                      <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>{b.count > 0 ? b.count : ""}</span>
                        <div style={{ width: "68%", height: `${(b.count / barMax) * 118}px`, minHeight: b.count > 0 ? 6 : 2, background: b.count > 0 ? barColor(i, bars.length) : "#EEF2F7", borderRadius: "6px 6px 0 0", transition: "height .3s ease" }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    {bars.map((b) => (<span key={b.label} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "#8AAABF" }}>{b.label}</span>))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Participants table (backend-paged) */}
          <div style={{ background: "#fff", border: "1px solid #EEF2F7", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderBottom: "1px solid #EEF2F7" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#1A2535" }}>
                Bütün iştirakçılar
                <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 999, background: "#F1F5F9", color: "#64748B" }}>{total}</span>
              </div>
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Ad ilə axtar…"
                style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, minWidth: 200, boxSizing: "border-box" }} />
            </div>

            {rows.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#52718F", fontSize: 13 }}>{tableLoading ? "Yüklənir…" : "Nəticə tapılmadı."}</div>
            ) : (
              <div style={{ overflowX: "auto", opacity: tableLoading ? 0.6 : 1, transition: "opacity .15s" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", textAlign: "left" }}>
                      <th style={th}>İştirakçı</th>
                      <th style={th}>Tarix</th>
                      <th style={th}>Mənbə</th>
                      <th style={th}>Bal</th>
                      <th style={th}>Nəticə</th>
                      <th style={th}>Status</th>
                      <th style={{ ...th, textAlign: "right" }}>Əməliyyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.resultId} style={{ borderTop: "1px solid #EEF2F7" }}>
                        <td style={td}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 28, height: 28, borderRadius: 999, background: "#EEF4F9", color: "#3B6FA5", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{(r.respondentName?.trim()?.[0] ?? "A").toUpperCase()}</span>
                            <span style={{ fontWeight: 600, color: "#1A2535" }}>{r.respondentName?.trim() || "Anonim"}</span>
                          </div>
                        </td>
                        <td style={{ ...td, color: "#52718F" }}>{fmtDateTime(r.submittedAt)}</td>
                        <td style={td}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: r.publicLink ? "#3730A3" : "var(--brand-700, #2F4A63)", background: r.publicLink ? "#E0E7FF" : "var(--brand-50, #EEF4F9)" }}>{r.publicLink ? "Public link" : "Təyinat"}</span>
                        </td>
                        <td style={{ ...td, fontWeight: 700, color: "#1A2535" }}>{r.totalScore} <span style={{ color: "#8AAABF", fontWeight: 600 }}>/ {r.maxScore}</span></td>
                        <td style={td}>{r.scaleLabel ? <span style={{ fontSize: 12.5, fontWeight: 600, color: "#065F46" }}>{r.scaleLabel}</span> : <span style={{ color: "#9AAFC4" }}>—</span>}</td>
                        <td style={td}><span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: "#065F46", background: "#D1FAE5" }}>Tam yoxlanılıb</span></td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
                            <button type="button" onClick={() => openDetail(r.resultId)} disabled={detailBusy === r.resultId} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--brand)", background: "transparent", border: "none", cursor: "pointer" }}><IconEye /> {detailBusy === r.resultId ? "…" : "Bax"}</button>
                            <button type="button" onClick={() => onDelete(r.resultId)} aria-label="Sil" style={{ color: "#991B1B", background: "transparent", border: "none", cursor: "pointer", display: "inline-flex" }}><IconTrash /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {total > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: "1px solid #EEF2F7", flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#52718F" }}>
                  Sətir sayı:
                  <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} style={{ padding: "5px 8px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12.5 }}>
                    {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ fontSize: 12.5, color: "#52718F" }}>{total ? page * size + 1 : 0}–{Math.min(total, (page + 1) * size)} / {total}</div>
                <div style={{ display: "inline-flex", gap: 4 }}>
                  <PagerBtn disabled={page === 0} onClick={() => setPage(0)}>«</PagerBtn>
                  <PagerBtn disabled={page === 0} onClick={() => setPage(page - 1)}>‹</PagerBtn>
                  <span style={{ fontSize: 12.5, color: "#52718F", padding: "0 8px", alignSelf: "center" }}>{page + 1} / {pageCount}</span>
                  <PagerBtn disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>›</PagerBtn>
                  <PagerBtn disabled={page >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>»</PagerBtn>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {assignOpen && test && (
        <AssignTestModal testId={id} testTitle={test.title} clients={clients} onClose={() => setAssignOpen(false)} onAssigned={() => { setAssignOpen(false); reloadStats(); }} />
      )}
      {detail && <ResultDetailModal result={detail} onClose={() => setDetail(null)} />}
      {shareOpen && (
        <SharePopup link={link} busy={linkBusy} copied={copied} onCopy={copyLink} onAssign={() => { setShareOpen(false); setAssignOpen(true); }} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "11px 16px", fontSize: 11, fontWeight: 700, color: "#52718F", textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "12px 16px", verticalAlign: "middle" };

function ScalePie({ groups }: { groups: { label: string; color: string; count: number }[] }) {
  const total = groups.reduce((s, g) => s + g.count, 0);
  let acc = 0;
  const stops = groups.map((g) => {
    const start = total ? (acc / total) * 100 : 0;
    acc += g.count;
    const end = total ? (acc / total) * 100 : 0;
    return `${g.color} ${start}% ${end}%`;
  }).join(", ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: 150, height: 150, borderRadius: 999, flexShrink: 0, background: total ? `conic-gradient(${stops})` : "#F1F5F9" }}>
        <div style={{ position: "absolute", inset: 34, background: "#fff", borderRadius: 999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#1A2535", lineHeight: 1 }}>{total}</span>
          <span style={{ fontSize: 11, color: "#8AAABF" }}>nəfər</span>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 9 }}>
        {groups.map((g) => (
          <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: g.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#1A2535", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#52718F", whiteSpace: "nowrap" }}>{g.count} ({total ? Math.round((g.count / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PagerBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: disabled ? "#CBD5E1" : "#52718F", cursor: disabled ? "default" : "pointer", fontSize: 15 }}>
      {children}
    </button>
  );
}

function SharePopup({ link, busy, copied, onCopy, onAssign, onClose }: { link: { url: string; token: string } | null; busy: boolean; copied: boolean; onCopy: () => void; onAssign: () => void; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "min(460px, 100%)", padding: 24, boxShadow: "0 18px 50px rgba(10,26,51,0.28)", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, background: "#D1FAE5", color: "#065F46", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1A2535", margin: "0 0 6px" }}>Public link</h3>
        <p style={{ fontSize: 13, color: "#52718F", lineHeight: 1.6, margin: "0 0 16px" }}>Bu link testin özünə aiddir — bir neçə pasiyent məlumatlarını yazaraq işləyə bilər.</p>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16 }}>
          <input readOnly value={busy ? "Yüklənir…" : link?.url ?? ""} onFocus={(e) => e.currentTarget.select()}
            style={{ flex: 1, minWidth: 0, padding: "9px 10px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12.5, color: "#374151", background: "#F8FAFC" }} />
          <button type="button" onClick={onCopy} disabled={!link}
            style={{ padding: "9px 14px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--brand)", cursor: link ? "pointer" : "default", whiteSpace: "nowrap", opacity: link ? 1 : 0.6 }}>
            {copied ? "Kopyalandı" : "Kopyala"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px", color: "#9AAFC4", fontSize: 12 }}>
          <span style={{ flex: 1, height: 1, background: "#EEF2F7" }} /> və ya <span style={{ flex: 1, height: 1, background: "#EEF2F7" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onAssign} style={{ flex: 1, padding: "9px 12px", border: "1px solid var(--brand-200)", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "var(--brand-50)", color: "var(--brand)", cursor: "pointer" }}>Pasiyentə təyin et</button>
          <button type="button" onClick={onClose} style={{ padding: "9px 16px", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#fff", color: "#374151", cursor: "pointer" }}>Bağla</button>
        </div>
      </div>
    </div>
  );
}

function ResultDetailModal({ result, onClose }: { result: TestResult; onClose: () => void }) {
  const answers = [...result.answers].sort((a, b) => a.displayOrder - b.displayOrder);
  const pct = Math.round(result.percentage);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "min(640px, 100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 18px 50px rgba(10,26,51,0.28)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #EFF2F7", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", margin: 0 }}>{result.respondentName?.trim() || "Anonim"}</h2>
            <p style={{ fontSize: 12.5, color: "#52718F", margin: "4px 0 0" }}>Bal: <b style={{ color: "#1A2535" }}>{result.totalScore} / {result.maxScore}</b> · {pct}%{result.scaleLabel ? <> · <b style={{ color: "#065F46" }}>{result.scaleLabel}</b></> : null}</p>
          </div>
          <button onClick={onClose} aria-label="Bağla" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #EEF2F7", background: "#fff", color: "#52718F", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 22, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {answers.map((a, i) => (
            <div key={a.questionId} style={{ border: "1px solid #EEF2F7", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>{i + 1}. {a.questionText}</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#374151" }}>{a.selectedLabel}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-700)", background: "var(--brand-50)", padding: "2px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{a.pointsAwarded} bal</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
