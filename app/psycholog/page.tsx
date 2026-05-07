"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { psychologistApi, type PsychologistStats } from "@/lib/api";

export default function PsychologDashboard() {
  const [stats, setStats] = useState<PsychologistStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    psychologistApi.stats()
      .then(setStats).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A2535]">Psixoloq Paneli</h1>
        <p className="text-[#52718F] text-sm mt-1">Aylıq fəaliyyət, müştərilər və qeydlər</p>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : !stats ? (
        <div style={{ background: "#FEF2F2", padding: 16, borderRadius: 12, color: "#991B1B" }}>Statistik məlumat alınmadı.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
            <Stat label="Bu ay seans" value={stats.thisMonthTotal} sub={`${stats.thisMonthCompleted} tamamlandı`} color="#1E3A5F" />
            <Stat label="Bu həftə" value={stats.thisWeekTotal} sub="seans" color="#5A4FC8" />
            <Stat label="Yaxınlaşan" value={stats.upcomingCount} sub="randevu" color="#065F46" />
            <Stat label="Aktiv müştəri" value={stats.activeClientsLast90Days} sub="son 90 gün" color="#92400E" />
          </div>

          <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2535", marginBottom: 8 }}>Son 30 gün — gündəlik aktivlik</h2>
            <DailyChart data={stats.last30Days} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Link href="/psycholog/appointments"
              style={{ background: "linear-gradient(135deg, #1a1040, #2d1b69)", borderRadius: 14, padding: 20, color: "#fff", textDecoration: "none" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📅</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Randevular</div>
            </Link>
            <Link href="/psycholog/calendar"
              style={{ background: "#fff", borderRadius: 14, padding: 20, color: "#1A2535", textDecoration: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🗓️</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Calendar</div>
            </Link>
            <Link href="/psycholog/clients"
              style={{ background: "#fff", borderRadius: 14, padding: 20, color: "#1A2535", textDecoration: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>👥</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Müştərilər və qeydlər</div>
            </Link>
            <Link href="/psycholog/availability"
              style={{ background: "#fff", borderRadius: 14, padding: 20, color: "#1A2535", textDecoration: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🕓</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Açıq vaxtlar</div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 11, color: "#52718F", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#8AAABF", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
      {data.map((d, i) => {
        const h = (d.count / max) * 100;
        return (
          <div key={i} title={`${d.date}: ${d.count}`}
            style={{ flex: 1, background: "linear-gradient(180deg, #5A4FC8, #8B7FE0)", borderRadius: 2, height: `${Math.max(2, h)}%`, minHeight: 2 }} />
        );
      })}
    </div>
  );
}
