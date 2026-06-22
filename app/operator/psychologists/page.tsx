"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { operatorApi, type PsychologistRankItem } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

type SortKey = "rating" | "sessions" | "fanus" | "active" | "alpha";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "rating", label: "Reytinq" }, { value: "sessions", label: "Tamamlanmış seans" },
  { value: "fanus", label: "Fanus seansları" }, { value: "active", label: "Aktiv pasiyent" }, { value: "alpha", label: "Əlifba" },
];
const initials = (n: string) => n.replace(/^Dr\.\s*/i, "").split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
const fmtRating = (n?: number | null) => n == null ? "—" : (Math.round(n * 10) / 10).toFixed(1);
const shortName = (n: string) => n.replace(/^Dr\.\s*/i, "");
const AVS = [{ bg: "#E0EBFA", color: "#1E3A8A" }, { bg: "#D1FAE5", color: "#065F46" }, { bg: "#FEF3C7", color: "#92400E" }, { bg: "#EDE9FE", color: "#5B21B6" }, { bg: "#FCE7F3", color: "#9D174D" }, { bg: "#CCFBF1", color: "#115E59" }];
const avatarOf = (i: number) => AVS[Math.abs(i) % AVS.length];
const CARD: React.CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8" };

export default function OperatorPsychologistsPage() {
  const { t } = useT();
  const [ranking, setRanking] = useState<PsychologistRankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "FANUS" | "NORMAL">("all");
  const [sort, setSort] = useState<SortKey>("rating");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    operatorApi.psychologistRanking().then(setRanking).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  const maxSessions = useMemo(() => Math.max(...ranking.map(p => p.completedSessions), 1), [ranking]);

  const kpis = useMemo(() => ({
    total: ranking.length,
    fanus: ranking.filter(p => (p.psychologistType ?? "").toUpperCase() === "FANUS").length,
    sessions: ranking.reduce((s, p) => s + p.completedSessions, 0),
    active: ranking.reduce((s, p) => s + p.activePatients, 0),
  }), [ranking]);

  const top5 = useMemo(() => [...ranking].sort((a, b) => b.completedSessions - a.completedSessions).slice(0, 5), [ranking]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = ranking.filter(p => {
      if (type !== "all" && (p.psychologistType ?? "").toUpperCase() !== type) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "alpha") { const r = a.name.localeCompare(b.name, "az"); return dir === "asc" ? r : -r; }
      const val = (p: PsychologistRankItem) => sort === "rating" ? (p.rankingScore ?? -Infinity) : sort === "sessions" ? p.completedSessions : sort === "fanus" ? p.fanusSessions : p.activePatients;
      const r = val(a) - val(b); return dir === "asc" ? r : -r;
    });
    return list;
  }, [ranking, query, type, sort, dir]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{`.ps-num{font-variant-numeric:tabular-nums}.ps-row{transition:background .14s}.ps-row:hover{background:#F2F6FD}@keyframes psShim{0%{background-position:-320px 0}100%{background-position:320px 0}}.ps-skel{background:linear-gradient(90deg,#EEF2F9 25%,#E2E9F4 37%,#EEF2F9 63%);background-size:640px 100%;animation:psShim 1.4s infinite linear}`}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", color: "var(--oxford)" }}>Psixoloq statistikası</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>Reytinq və performans göstəriciləri — sətrə klikləyərək detallara keçin</p>
      </div>

      {error ? <div className="op-error">{t("common.error")}</div> : loading ? <SkeletonList /> : ranking.length === 0 ? (
        <div style={{ ...CARD, padding: "44px 20px", textAlign: "center" }}>
          <EmptyIcon /><div style={{ fontSize: 15, fontWeight: 700, marginTop: 13, color: "var(--oxford)" }}>Hələ ki statistika yoxdur</div>
        </div>
      ) : (
        <>
          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 13, marginBottom: 18 }}>
            <Kpi label="Ümumi psixoloq" value={kpis.total} color="#082F6D" iconColor="#1051B7" icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>} />
            <Kpi label="FANUS psixoloq" value={kpis.fanus} color="#082F6D" iconColor="#1051B7" icon={<path d="M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5" />} />
            <Kpi label="Cəmi tamamlanmış seans" value={kpis.sessions} color="#047857" iconColor="#047857" icon={<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" />} />
            <Kpi label="Aktiv pasiyent" value={kpis.active} color="#082F6D" iconColor="#1051B7" icon={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>} />
          </div>

          {/* TOOLBAR */}
          <div style={{ ...CARD, padding: "14px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9DB0CC" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Psixoloq adı ilə axtar…" style={{ width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 12px 10px 36px", fontSize: 14, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "inline-flex", background: "#F0F4FA", borderRadius: 9, padding: 3, gap: 2 }}>
              {(["all", "FANUS", "NORMAL"] as const).map(k => {
                const a = type === k;
                return <button key={k} type="button" onClick={() => setType(k)} style={{ border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: a ? "#fff" : "transparent", color: a ? "#082F6D" : "var(--oxford-60)", boxShadow: a ? "0 1px 3px rgba(8,47,109,.12)" : "none" }}>{k === "all" ? "Hamısı" : k}</button>;
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ position: "relative" }}>
                <select value={sort} onChange={e => setSort(e.target.value as SortKey)} style={{ appearance: "none", WebkitAppearance: "none", background: "#fff", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 34px 10px 12px", fontSize: 13, fontWeight: 600, color: "var(--oxford)", fontFamily: "inherit", cursor: "pointer" }}>
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="M6 9l6 6 6-6" /></svg>
              </div>
              <button type="button" onClick={() => setDir(d => d === "asc" ? "desc" : "asc")} title="İstiqamət" style={{ width: 38, height: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#082F6D", border: "1px solid #D6E2F7", borderRadius: 10, cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dir === "asc" ? "rotate(180deg)" : "none" }}><path d="M12 5v14M5 12l7 7 7-7" /></svg>
              </button>
            </div>
          </div>

          {/* TOP-5 */}
          <div style={{ ...CARD, padding: 20, marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 15, color: "var(--oxford)" }}>Top-5 · tamamlanmış seans</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {top5.map(p => (
                <div key={p.psychologistId} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 120, flex: "none", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--oxford)" }}>{shortName(p.name)}</span>
                  <div style={{ flex: 1, height: 10, background: "#E4ECFA", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${Math.round(100 * p.completedSessions / maxSessions)}%`, height: "100%", background: "linear-gradient(90deg,#1051B7,#3A74D6)", borderRadius: 999 }} /></div>
                  <span className="ps-num" style={{ width: 40, flex: "none", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#082F6D" }}>{p.completedSessions}</span>
                </div>
              ))}
            </div>
          </div>

          {/* LIST */}
          <div style={{ ...CARD, padding: "6px 12px 12px" }}>
            {rows.length === 0 ? (
              <div style={{ padding: "44px 20px", textAlign: "center" }}>
                <EmptyIcon /><div style={{ fontSize: 15, fontWeight: 700, marginTop: 13, color: "var(--oxford)" }}>{query.trim() ? `« ${query.trim()} » üçün psixoloq tapılmadı` : "Hələ ki statistika yoxdur"}</div>
              </div>
            ) : rows.map((p, i) => {
              const isFanus = (p.psychologistType ?? "").toUpperCase() === "FANUS";
              const a = avatarOf(p.psychologistId);
              const rc = i < 3 ? { bg: "#FEF3C7", color: "#92400E" } : { bg: "#F2F6FD", color: "#082F6D" };
              return (
                <Link key={p.psychologistId} href={`/operator/psychologists/${p.psychologistId}`} className="ps-row" style={{ display: "flex", alignItems: "center", gap: 13, borderTop: "1px solid #F4F7FB", borderRadius: 10, padding: "14px 12px", textDecoration: "none", color: "inherit", flexWrap: "wrap" }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: rc.bg, color: rc.color, fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{i + 1}</span>
                  <span style={{ width: 42, height: 42, borderRadius: 12, background: a.bg, color: a.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flex: "none" }}>{initials(p.name)}</span>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{p.name}</span>
                      <span style={{ background: isFanus ? "#E4ECFA" : "#F3F4F6", color: isFanus ? "#082F6D" : "#374151", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", padding: "3px 9px", borderRadius: 999 }}>{isFanus ? "FANUS" : "NORMAL"}</span>
                    </div>
                    <div style={{ height: 6, background: "#E4ECFA", borderRadius: 999, overflow: "hidden", maxWidth: 260 }}><div style={{ width: `${Math.round(100 * p.completedSessions / maxSessions)}%`, height: "100%", background: "linear-gradient(90deg,#1051B7,#3A74D6)", borderRadius: 999 }} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                    <Pill>Seans: <b>{p.completedSessions}</b></Pill>
                    <Pill>Fanus: <b>{p.fanusSessions}</b></Pill>
                    <Pill>Aktiv: <b>{p.activePatients}</b></Pill>
                    <span className="ps-num" style={{ background: "#E4ECFA", color: "#082F6D", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>Reytinq: {fmtRating(p.rankingScore)}</span>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7D3E6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M9 6l6 6-6 6" /></svg>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, color, iconColor, icon }: { label: string; value: number; color: string; iconColor: string; icon: React.ReactNode }) {
  return (
    <div style={{ ...CARD, padding: "15px 17px", position: "relative" }}>
      <span style={{ position: "absolute", top: 15, right: 15, color: iconColor }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></span>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 }}>{label}</div>
      <div className="ps-num" style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="ps-num" style={{ background: "#F8FAFD", border: "1px solid #EDF1F8", color: "var(--oxford)", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999 }}>{children}</span>;
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
