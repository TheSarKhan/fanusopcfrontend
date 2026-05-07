"use client";

import { useEffect, useState } from "react";
import { operatorApi, type OperatorStats } from "@/lib/api";

function fmtMin(min: number | null) {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)} dəq`;
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return `${h} s ${m} dəq`;
}

export default function OperatorAnalyticsPage() {
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    operatorApi.stats().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535", marginBottom: 6 }}>Operator Analytics</h1>
      <p style={{ fontSize: 13, color: "#52718F", marginBottom: 20 }}>Triage performansı və 30 günlük trend</p>

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : !stats ? (
        <div style={{ background: "#FEF2F2", padding: 16, borderRadius: 12, color: "#991B1B" }}>Məlumat alınmadı.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
            <Stat label="Növbədə" value={stats.pendingNow} sub="bu an" color="#92400E" />
            <Stat label="Bu gün təyin" value={stats.assignedToday} sub="randevu" color="#1E40AF" />
            <Stat label="Bu ay tamamlanmış" value={stats.completedThisMonth} sub={`${stats.totalThisMonth} cəmi`} color="#065F46" />
            <Stat label="Orta cavab vaxtı" value={fmtMin(stats.avgResponseMinutes)} color="#5A4FC8" />
            <Stat label="Rədd %" value={stats.rejectionRatePct != null ? `${stats.rejectionRatePct}%` : "—"} sub="bu ay" color="#DC2626" />
          </div>

          <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2535", marginBottom: 12 }}>Son 30 gün — gündəlik triage</h2>
            <Legend />
            <DailyChart data={stats.last30Days} />
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 11, color: "#52718F", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#8AAABF", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#52718F", marginBottom: 8 }}>
      <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#3B82F6", borderRadius: 2, marginRight: 4 }} />Gələn</span>
      <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#10B981", borderRadius: 2, marginRight: 4 }} />Təyin</span>
      <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#F59E0B", borderRadius: 2, marginRight: 4 }} />Rədd</span>
    </div>
  );
}

function DailyChart({ data }: { data: { date: string; incoming: number; assigned: number; rejected: number }[] }) {
  const max = Math.max(1, ...data.map(d => Math.max(d.incoming, d.assigned + d.rejected)));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.date}: ${d.incoming} gələn, ${d.assigned} təyin, ${d.rejected} rədd`}
          style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 1 }}>
          <div style={{ background: "#3B82F6", height: `${(d.incoming / max) * 100}%`, borderRadius: 2, minHeight: d.incoming > 0 ? 2 : 0 }} />
          <div style={{ background: "#10B981", height: `${(d.assigned / max) * 100}%`, minHeight: d.assigned > 0 ? 2 : 0 }} />
          <div style={{ background: "#F59E0B", height: `${(d.rejected / max) * 100}%`, borderRadius: "0 0 2px 2px", minHeight: d.rejected > 0 ? 2 : 0 }} />
        </div>
      ))}
    </div>
  );
}
