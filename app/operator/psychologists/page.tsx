"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { operatorApi, type PsychologistRankItem } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { useT } from "@/lib/i18n/LocaleProvider";

type Segment = "all" | "FANUS" | "NORMAL" | "vacation" | "attention";
type SortKey = "rating" | "sessions" | "rejection" | "alpha";
const initials = (n: string) => n.replace(/^Dr\.\s*/i, "").split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
const fmtRating = (n?: number | null) => n == null ? "—" : (Math.round(n * 10) / 10).toFixed(1);
const AVS = [{ bg: "#E0EBFA", color: "#1E3A8A" }, { bg: "#D1FAE5", color: "#065F46" }, { bg: "#FEF3C7", color: "#92400E" }, { bg: "#EDE9FE", color: "#5B21B6" }, { bg: "#FCE7F3", color: "#9D174D" }, { bg: "#CCFBF1", color: "#115E59" }];
const avatarOf = (i: number) => AVS[Math.abs(i) % AVS.length];
const CARD: React.CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8" };
const isAttention = (p: PsychologistRankItem) =>
  !p.active || p.suspendedAt != null || (p.rejectionRatePct ?? 0) > 20 || p.individualPrice == null;

export default function OperatorPsychologistsPage() {
  const { t } = useT();
  const router = useRouter();
  const [ranking, setRanking] = useState<PsychologistRankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [sort, setSort] = useState<SortKey>("rating");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (sort === key) { setDir(d => d === "asc" ? "desc" : "asc"); return; }
    setSort(key);
    setDir(key === "alpha" ? "asc" : "desc");
  };
  const sortIndicator = (key: SortKey) => {
    if (sort !== key) return <span style={{ opacity: .3, marginLeft: 4 }}>↕</span>;
    return <span style={{ marginLeft: 4, color: "var(--brand-700)" }}>{dir === "asc" ? "↑" : "↓"}</span>;
  };

  useEffect(() => {
    operatorApi.psychologistRanking().then(setRanking).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  const maxSessions = useMemo(() => Math.max(...ranking.map(p => p.completedSessions), 1), [ranking]);

  const kpis = useMemo(() => ({
    total: ranking.length,
    active: ranking.filter(p => p.active).length,
    attention: ranking.filter(isAttention).length,
    vacation: ranking.filter(p => p.onVacationToday).length,
  }), [ranking]);

  const segmentCounts = useMemo(() => ({
    all: ranking.length,
    FANUS: ranking.filter(p => (p.psychologistType ?? "").toUpperCase() === "FANUS").length,
    NORMAL: ranking.filter(p => (p.psychologistType ?? "").toUpperCase() === "NORMAL").length,
    vacation: ranking.filter(p => p.onVacationToday).length,
    attention: ranking.filter(isAttention).length,
  }), [ranking]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = ranking.filter(p => {
      if (segment === "FANUS" && (p.psychologistType ?? "").toUpperCase() !== "FANUS") return false;
      if (segment === "NORMAL" && (p.psychologistType ?? "").toUpperCase() !== "NORMAL") return false;
      if (segment === "vacation" && !p.onVacationToday) return false;
      if (segment === "attention" && !isAttention(p)) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.phone ?? "").includes(q) && !(p.email ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "alpha") { const r = a.name.localeCompare(b.name, "az"); return dir === "asc" ? r : -r; }
      const val = (p: PsychologistRankItem) => sort === "rating" ? (p.rankingScore ?? -Infinity)
        : sort === "sessions" ? p.completedSessions : (p.rejectionRatePct ?? -Infinity);
      const r = val(a) - val(b); return dir === "asc" ? r : -r;
    });
    return list;
  }, [ranking, query, segment, sort, dir]);

  const SEGMENTS: { value: Segment; label: string }[] = [
    { value: "all", label: "Hamısı" }, { value: "FANUS", label: "FANUS" }, { value: "NORMAL", label: "NORMAL" },
    { value: "vacation", label: "Məzuniyyətdə" }, { value: "attention", label: "Diqqət tələb edən" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{`.ps-num{font-variant-numeric:tabular-nums}.ps-row:hover{background:#F2F6FD}@keyframes psShim{0%{background-position:-320px 0}100%{background-position:320px 0}}.ps-skel{background:linear-gradient(90deg,#EEF2F9 25%,#E2E9F4 37%,#EEF2F9 63%);background-size:640px 100%;animation:psShim 1.4s infinite linear}`}</style>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", color: "var(--oxford)" }}>Psixoloqlar</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>Platformadakı bütün psixoloqları idarə edin — əlaqə saxlayın, riskləri görün, 360° profilə keçin</p>
        </div>
        <a href="/admin/psychologists" target="_blank" rel="noreferrer" style={{ flex: "none", fontSize: 12.5, fontWeight: 700, color: "var(--brand-700)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          Admin panelinə keçid
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></svg>
        </a>
      </div>

      {error ? <div className="op-error">{t("common.error")}</div> : loading ? <SkeletonList /> : ranking.length === 0 ? (
        <div style={{ ...CARD, padding: "44px 20px", textAlign: "center" }}>
          <EmptyIcon /><div style={{ fontSize: 15, fontWeight: 700, marginTop: 13, color: "var(--oxford)" }}>Hələ psixoloq yoxdur</div>
        </div>
      ) : (
        <>
          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 13, marginBottom: 18 }}>
            <Kpi label="Ümumi psixoloq" value={kpis.total} sub="qeydiyyatda" color="#082F6D" iconColor="#1051B7" icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>} />
            <Kpi label="Aktiv" value={kpis.active} sub="seans qəbul edir" color="#047857" iconColor="#047857" icon={<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" />} />
            <Kpi label="Diqqət tələb edən" value={kpis.attention} sub="yüksək rədd · qiymət yox · dayandırılıb" color="#92400E" iconColor="#C97D2E" icon={<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>} />
            <Kpi label="Məzuniyyətdə" value={kpis.vacation} sub="hazırda əlçatan deyil" color="#5B21B6" iconColor="#8C7DC9" icon={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />
          </div>

          {/* TOOLBAR */}
          <div style={{ ...CARD, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9DB0CC" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ad, telefon və ya email üzrə axtar…" style={{ width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 12px 10px 36px", fontSize: 14, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit" }} />
            </div>
          </div>

          {/* SEGMENTS */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            {SEGMENTS.map(s => {
              const a = segment === s.value;
              return (
                <button key={s.value} type="button" onClick={() => setSegment(s.value)} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: a ? "1px solid #1051B7" : "1px solid #D6E2F7", borderRadius: 999, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: a ? "#082F6D" : "#fff", color: a ? "#fff" : "var(--oxford)" }}>
                  {s.label}
                  <span className="ps-num" style={{ background: a ? "rgba(255,255,255,.22)" : "#F0F4FA", color: a ? "#fff" : "var(--oxford-60)", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{segmentCounts[s.value]}</span>
                </button>
              );
            })}
          </div>

          {/* CƏDVƏL */}
          <div style={{ ...CARD, overflow: "hidden" }}>
            {rows.length === 0 ? (
              <div style={{ padding: "44px 20px", textAlign: "center" }}>
                <EmptyIcon /><div style={{ fontSize: 15, fontWeight: 700, marginTop: 13, color: "var(--oxford)" }}>{query.trim() ? `« ${query.trim()} » üçün nəticə yoxdur` : "Bu seqmentdə psixoloq yoxdur"}</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="fx-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort("alpha")} style={{ cursor: "pointer" }}>Psixoloq {sortIndicator("alpha")}</th>
                      <th>Əlaqə</th>
                      <th onClick={() => handleSort("sessions")} style={{ cursor: "pointer", textAlign: "right" }}>Seans {sortIndicator("sessions")}</th>
                      <th onClick={() => handleSort("rating")} style={{ cursor: "pointer", textAlign: "right" }}>Reytinq {sortIndicator("rating")}</th>
                      <th onClick={() => handleSort("rejection")} style={{ cursor: "pointer", textAlign: "right" }}>Rədd faizi {sortIndicator("rejection")}</th>
                      <th>Qiymət</th>
                      <th>Status</th>
                      <th style={{ width: 76 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const isFanus = (p.psychologistType ?? "").toUpperCase() === "FANUS";
                      const a = avatarOf(p.psychologistId);
                      const suspended = p.suspendedAt != null;
                      const highRejection = (p.rejectionRatePct ?? 0) > 20;
                      return (
                        <tr key={p.psychologistId} onClick={() => router.push(`/operator/psychologists/${p.psychologistId}`)} style={{ cursor: "pointer" }}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                              <span style={{ width: 36, height: 36, borderRadius: 10, background: a.bg, color: a.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flex: "none" }}>{initials(p.name)}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{p.name}</span>
                                <span style={{ background: isFanus ? "#E4ECFA" : "#F3F4F6", color: isFanus ? "#082F6D" : "#374151", fontSize: 10, fontWeight: 700, letterSpacing: ".04em", padding: "3px 8px", borderRadius: 999 }}>{isFanus ? "FANUS" : "NORMAL"}</span>
                                {suspended && <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>Dayandırılıb</span>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>
                              {p.phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><PhoneIcon />{p.phone}</span>}
                              {p.email && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MailIcon />{p.email}</span>}
                              {!p.phone && !p.email && "—"}
                            </div>
                          </td>
                          <td className="fx-td-num">{p.completedSessions}</td>
                          <td className="fx-td-num">★ {fmtRating(p.rankingScore)}</td>
                          <td className="fx-td-num" style={highRejection ? { color: "#991B1B", fontWeight: 700 } : undefined}>
                            {p.rejectionRatePct != null ? `${Math.round(p.rejectionRatePct)}%` : "—"}
                          </td>
                          <td>
                            {p.individualPrice != null ? (
                              <span className="ps-num" style={{ fontWeight: 600, color: "var(--oxford)" }}>{formatAzn(p.individualPrice)}</span>
                            ) : (
                              <span style={{ color: "#92400E", fontWeight: 600, fontSize: 12.5 }}>Qiymət yoxdur</span>
                            )}
                          </td>
                          <td>
                            {p.onVacationToday && <span style={{ background: "#F0F4FA", color: "var(--oxford-60)", fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>Məzuniyyətdə</span>}
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              {p.phone && <a href={`tel:${p.phone}`} title="Zəng" style={quickBtn}><PhoneIcon /></a>}
                              {p.email && <a href={`mailto:${p.email}`} title="Email" style={quickBtn}><MailIcon /></a>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>{rows.length} psixoloq</div>
        </>
      )}
    </div>
  );
}

const quickBtn: React.CSSProperties = { width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F8FAFD", color: "#082F6D", border: "1px solid #EDF1F8", borderRadius: 9, textDecoration: "none" };

function PhoneIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>; }
function MailIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" /></svg>; }

function Kpi({ label, value, sub, color, iconColor, icon }: { label: string; value: number; sub: string; color: string; iconColor: string; icon: React.ReactNode }) {
  return (
    <div style={{ ...CARD, padding: "15px 17px", position: "relative" }}>
      <span style={{ position: "absolute", top: 15, right: 15, color: iconColor }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></span>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 6 }}>{label}</div>
      <div className="ps-num" style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#9DB0CC", fontWeight: 600, marginTop: 3 }}>{sub}</div>
    </div>
  );
}
function EmptyIcon() {
  return <div style={{ width: 52, height: 52, borderRadius: 15, background: "#F2F6FD", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#9DB0CC" }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 9l-5 5-3-3-4 4" /></svg></div>;
}
function SkeletonList() {
  return (
    <div style={{ ...CARD, padding: "6px 14px 10px" }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, borderTop: "1px solid #F4F7FB", padding: "15px 0" }}>
          <div className="ps-skel" style={{ width: 42, height: 42, borderRadius: 12, flex: "none" }} />
          <div style={{ flex: 1 }}><div className="ps-skel" style={{ width: "50%", height: 13, borderRadius: 6, marginBottom: 8 }} /><div className="ps-skel" style={{ width: "70%", height: 9, borderRadius: 6 }} /></div>
        </div>
      ))}
    </div>
  );
}
