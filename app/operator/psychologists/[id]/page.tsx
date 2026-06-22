"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { operatorApi, type OperatorPsychologistStat } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { useT } from "@/lib/i18n/LocaleProvider";

const MONTHS_AZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "İyun", "İyul", "Avq", "Sen", "Okt", "Noy", "Dek"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso?: string | null) => { if (!iso) return "—"; const d = new Date(iso); return `${pad2(d.getDate())} ${MONTHS_AZ[d.getMonth()]} ${d.getFullYear()}`; };
const fmtScore = (n?: number | null) => n == null ? "—" : String(Math.round(n * 10) / 10);
const fmtRating = (n?: number | null) => n == null ? "—" : (Math.round(n * 10) / 10).toFixed(1);
const initials = (n: string) => n.replace(/^Dr\.\s*/i, "").split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
function monthLabel(m: string) { const mm = /^(\d{4})-(\d{2})/.exec(m); return mm ? (MONTHS_SHORT[Number(mm[2]) - 1] ?? m) : m; }

export default function OperatorPsychologistDetailPage() {
  const { t } = useT();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [stat, setStat] = useState<OperatorPsychologistStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) { setError(true); setLoading(false); return; }
    operatorApi.psychologistStats(id).then(setStat).catch(() => setError(true)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}><div className="op-loading">{t("common.loading")}</div></div>;

  if (error || !stat) {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Back />
        <div style={{ ...CARD, padding: "40px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", marginTop: 12 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: "#FEE2E2", color: "#991B1B", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 13 }}>
            <Ico d={["M12 8v4M12 16h.01"]} extra={<circle cx="12" cy="12" r="10" />} size={25} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 9, color: "var(--oxford)" }}>Statistika yüklənmədi</div>
          <Link href="/operator/psychologists" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand-700)", textDecoration: "none" }}>← Psixoloqlar</Link>
        </div>
      </div>
    );
  }

  const isFanus = (stat.psychologistType ?? "").toUpperCase() === "FANUS";
  const av = avatarOf(id);
  const completed = stat.completedCount, cancelled = stat.cancelledCount;
  const totalCC = completed + cancelled;
  const completionPct = totalCC > 0 ? Math.round((completed / totalCC) * 100) : 0;

  const kpis = [
    { label: "Ümumi seans", value: String(stat.totalSessions), sub: "bütün vaxt", numColor: "#082F6D", iconColor: "#1051B7", icon: ["M23 7l-7 5 7 5V7z", "M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1z"] },
    { label: "Fanus seansları", value: String(stat.fanusSessions), sub: "platforma üzərindən", numColor: "#082F6D", iconColor: "#1051B7", icon: ["M12 2L2 7l10 5 10-5-10-5z", "M2 17l10 5 10-5", "M2 12l10 5 10-5"] },
    { label: "Bu ay seans", value: String(stat.currentMonthSessions), sub: "cari ay", numColor: "#047857", iconColor: "#047857", icon: ["M3 9h18 M3 4h18v16H3z", "M8 2v4M16 2v4"] },
    { label: "Gəlir", value: formatAzn(stat.revenue) || "—", sub: "net (geri qaytarmadan sonra)", numColor: "#047857", iconColor: "#047857", icon: ["M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"] },
    { label: "Orta reytinq", value: fmtRating(stat.averageRating), sub: `${stat.totalReviews} rəy`, numColor: "#374151", iconColor: "#F59E0B", icon: ["M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7.2L12 17.8 5.8 21.4l1.6-7.2L2 9.5l7.1-.6z"] },
    { label: "Satılan paket", value: String(stat.packagesSold), sub: "ümumi", numColor: "#374151", iconColor: "#5C6B85", icon: ["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"] },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{`.ps-num{font-variant-numeric:tabular-nums}`}</style>
      <Back />

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", margin: "16px 0 22px" }}>
        <span style={{ width: 58, height: 58, borderRadius: 16, background: av.bg, color: av.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 700, flex: "none" }}>{initials(stat.name)}</span>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 5 }}>
            <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: "-.02em", color: "var(--oxford)" }}>{stat.name}</h1>
            <span style={{ background: isFanus ? "#E4ECFA" : "#F3F4F6", color: isFanus ? "#082F6D" : "#374151", fontSize: 11, fontWeight: 700, letterSpacing: ".05em", padding: "4px 10px", borderRadius: 999 }}>{isFanus ? "FANUS" : "NORMAL"}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 500 }}>
            {stat.statsSource ? <>Mənbə: {stat.statsSource} · </> : null}
            Reytinq: <b style={{ color: "var(--oxford)" }}>{fmtScore(stat.rankingScore)}</b>
            {stat.joinedAt ? <> · Qoşulub: {fmtDate(stat.joinedAt)}</> : null}
          </div>
        </div>
      </div>

      {/* KPI STRIP */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 13, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...CARD, padding: "15px 17px", position: "relative" }}>
            <span style={{ position: "absolute", top: 15, right: 15, color: k.iconColor }}><Ico d={k.icon} /></span>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 }}>{k.label}</div>
            <div className="ps-num" style={{ fontSize: 21, fontWeight: 800, color: k.numColor, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: "#9DB0CC", fontWeight: 600, marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* İKİ KART */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18, marginBottom: 18 }}>
        <div style={{ ...CARD, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 15 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>Tamamlanma</div>
            <div className="ps-num" style={{ fontSize: 26, fontWeight: 800, color: "#047857" }}>{completionPct}%</div>
          </div>
          <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 14, background: "#F3F4F6" }}>
            {completed > 0 && <div style={{ width: `${totalCC > 0 ? (completed / totalCC) * 100 : 0}%`, background: "#10B981" }} />}
            {cancelled > 0 && <div style={{ width: `${totalCC > 0 ? (cancelled / totalCC) * 100 : 0}%`, background: "#DC2626" }} />}
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <LegendItem color="#10B981" label="Tamamlandı" value={completed} />
            <LegendItem color="#DC2626" label="Ləğv" value={cancelled} />
          </div>
        </div>

        <div style={{ ...CARD, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--oxford)" }}>Pasiyentlər</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <PatientStat bg="#F8FAFD" border="#EDF1F8" labelColor="var(--oxford-60)" valueColor="var(--oxford)" label="Aktiv pasiyent" value={stat.activePatients} />
            <PatientStat bg="#ECFDF5" border="#A7F3D0" labelColor="#047857" valueColor="#047857" label="Bu ay yeni" value={stat.newPatientsThisMonth} />
          </div>
        </div>
      </div>

      {/* AYLIQ DİNAMİKA */}
      <div style={{ ...CARD, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, flex: 1, color: "var(--oxford)" }}>Aylıq dinamika</div>
          <Leg color="#1051B7" t="Cəmi" /><Leg color="#10B981" t="Tamamlanmış" /><Leg color="#DC2626" t="Ləğv" />
        </div>
        {stat.monthlyDynamics.length === 0 ? (
          <div style={{ height: 150, border: "1px dashed #D6E2F7", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#9DB0CC", fontWeight: 600 }}>Aylıq məlumat yoxdur</div>
        ) : (
          <MonthlyChart data={stat.monthlyDynamics} />
        )}
      </div>
    </div>
  );
}

const CARD: React.CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8" };
const AVS = [{ bg: "#E0EBFA", color: "#1E3A8A" }, { bg: "#D1FAE5", color: "#065F46" }, { bg: "#FEF3C7", color: "#92400E" }, { bg: "#EDE9FE", color: "#5B21B6" }, { bg: "#FCE7F3", color: "#9D174D" }];
const avatarOf = (i: number) => AVS[Math.abs(i) % AVS.length];

function Back() {
  return <Link href="/operator/psychologists" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--brand-700)", textDecoration: "none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>Psixoloqlar</Link>;
}
function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--oxford-60)" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />{label}: <b style={{ color: "var(--oxford)" }}>{value}</b></span>;
}
function Leg({ color, t }: { color: string; t: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--oxford-60)" }}><span style={{ width: 10, height: 3, borderRadius: 2, background: color }} />{t}</span>;
}
function PatientStat({ bg, border, labelColor, valueColor, label, value }: { bg: string; border: string; labelColor: string; valueColor: string; label: string; value: number }) {
  return (
    <div style={{ flex: 1, minWidth: 120, background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: 15 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: labelColor, marginBottom: 6 }}>{label}</div>
      <div className="ps-num" style={{ fontSize: 28, fontWeight: 800, color: valueColor }}>{value}</div>
    </div>
  );
}

function MonthlyChart({ data }: { data: { month: string; total: number; completed: number; cancelled: number }[] }) {
  const W = 860, H = 190, padL = 30, padR = 12, padT = 12, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = Math.max(1, data.length);
  const max = Math.max(...data.map(d => d.total), 1);
  const x = (i: number) => padL + (n > 1 ? iw * i / (n - 1) : iw / 2);
  const y = (v: number) => padT + ih * (1 - v / max);
  const line = (arr: number[], color: string) => {
    let d = ""; arr.forEach((v, i) => { d += (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " "; });
    return <g><path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />{arr.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={color} stroke="#fff" strokeWidth={1.5} />)}</g>;
  };
  const step = data.length > 8 ? Math.ceil(data.length / 8) : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: "block" }}>
      {[0, max / 2, max].map((g, k) => <g key={k}><line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#F0F4FA" strokeWidth={1} /><text x={padL - 6} y={y(g) + 3} textAnchor="end" fontSize={9} fontWeight={600} fill="#9DB0CC">{Math.round(g)}</text></g>)}
      {line(data.map(d => d.total), "#1051B7")}
      {line(data.map(d => d.completed), "#10B981")}
      {line(data.map(d => d.cancelled), "#DC2626")}
      {data.map((d, i) => i % step === 0 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="#9DB0CC">{monthLabel(d.month)}</text> : null)}
    </svg>
  );
}

function Ico({ d, extra, size = 17 }: { d: string | string[]; extra?: ReactNode; size?: number }) {
  const paths = Array.isArray(d) ? d : [d];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{extra}{paths.map((p, i) => <path key={i} d={p} />)}</svg>;
}
