"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { operatorApi, type OperatorPsychologistStat } from "@/lib/api";
import { MonthlyDynamicsChart } from "@/components/AnalyticsCharts";
import { formatAzn } from "@/lib/money";
import { useT } from "@/lib/i18n/LocaleProvider";

const MONTHS_AZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

function pad2(n: number) { return String(n).padStart(2, "0"); }

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad2(d.getDate())} ${MONTHS_AZ[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtScore(n?: number | null): string {
  return n == null ? "—" : String(Math.round(n * 10) / 10);
}

function fmtRating(n?: number | null): string {
  return n == null ? "—" : (Math.round(n * 10) / 10).toFixed(1);
}

function typeLabel(type?: string | null): { text: string; tone: "brand" | "neutral" } {
  if (type && type.toUpperCase() === "FANUS") return { text: "FANUS", tone: "brand" };
  return { text: "NORMAL", tone: "neutral" };
}

export default function OperatorPsychologistDetailPage() {
  const { t } = useT();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [stat, setStat] = useState<OperatorPsychologistStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setError(true);
      setLoading(false);
      return;
    }
    operatorApi.psychologistStats(id)
      .then((s) => setStat(s))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="op-analytics">
        <div className="op-loading">{t("common.loading")}</div>
      </div>
    );
  }

  if (error || !stat) {
    return (
      <div className="op-analytics">
        <header className="op-analytics__head">
          <div>
            <Link href="/operator/psychologists" style={{ fontSize: 13, color: "var(--brand-700)", textDecoration: "none" }}>← Psixoloqlar</Link>
            <h1>Psixoloq statistikası</h1>
          </div>
        </header>
        <div className="op-error">{t("common.error")}</div>
      </div>
    );
  }

  const tl = typeLabel(stat.psychologistType);

  return (
    <div className="op-analytics">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="op-analytics__head">
        <div>
          <Link href="/operator/psychologists" style={{ fontSize: 13, color: "var(--brand-700)", textDecoration: "none" }}>
            ← Psixoloqlar
          </Link>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {stat.name}
            <span className="op-row__badge" data-tone={tl.tone}>{tl.text}</span>
          </h1>
          <p>
            {stat.statsSource ? <>Mənbə: {stat.statsSource} · </> : null}
            Reytinq: <strong>{fmtScore(stat.rankingScore)}</strong>
            {stat.joinedAt ? <> · Qoşulub: {fmtDate(stat.joinedAt)}</> : null}
          </p>
        </div>
      </header>

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <div className="op-kpis">
        <Kpi label="Ümumi seans" value={stat.totalSessions} sub="bütün vaxt" tone="brand" />
        <Kpi label="Fanus seansları" value={stat.fanusSessions} sub="platforma üzərindən" tone="brand" />
        <Kpi label="Bu ay seans" value={stat.currentMonthSessions} sub="cari ay" tone="good" />
        <Kpi label="Gəlir" value={formatAzn(stat.revenue) || "—"} sub="ümumi" tone="good" />
        <Kpi
          label="Orta reytinq"
          value={fmtRating(stat.averageRating)}
          sub={`${stat.totalReviews} rəy`}
          tone="neutral"
        />
        <Kpi label="Satılan paket" value={stat.packagesSold} sub="ümumi" tone="neutral" />
      </div>

      <div className="op-grid">
        {/* ── Completed vs cancelled ────────────────────────────────────── */}
        <div className="op-card">
          <div className="op-card__head">
            <div>
              <h2>Tamamlanma</h2>
              <p>Tamamlanmış və ləğv edilmiş seanslar</p>
            </div>
          </div>
          <div className="op-card__body">
            <SplitBar completed={stat.completedCount} cancelled={stat.cancelledCount} />
            <div className="op-legend" style={{ marginTop: 12 }}>
              <span><i style={{ background: "#10B981" }} /> Tamamlandı: <strong>{stat.completedCount}</strong></span>
              <span><i style={{ background: "#DC2626" }} /> Ləğv: <strong>{stat.cancelledCount}</strong></span>
            </div>
          </div>
        </div>

        {/* ── Patients ──────────────────────────────────────────────────── */}
        <div className="op-card">
          <div className="op-card__head">
            <div>
              <h2>Pasientlər</h2>
              <p>Aktiv və yeni pasientlər</p>
            </div>
          </div>
          <div className="op-card__body">
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 13, color: "var(--oxford-60)" }}>Aktiv pasient</span>
                <strong style={{ fontSize: 26, color: "var(--oxford-80)" }}>{stat.activePatients}</strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 13, color: "var(--oxford-60)" }}>Bu ay yeni</span>
                <strong style={{ fontSize: 26, color: "#065F46" }}>{stat.newPatientsThisMonth}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Monthly dynamics ────────────────────────────────────────────── */}
      <div className="op-card">
        <div className="op-card__head">
          <div>
            <h2>Aylıq dinamika</h2>
            <p>Cəmi, tamamlanmış və ləğv edilmiş seanslar</p>
          </div>
        </div>
        <div className="op-card__body">
          {stat.monthlyDynamics.length === 0 ? (
            <div className="op-empty">Aylıq məlumat yoxdur</div>
          ) : (
            <MonthlyDynamicsChart data={stat.monthlyDynamics} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Building blocks ──────────────────────────────────────────────────── */

function Kpi({
  label, value, sub, tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone: "brand" | "good" | "warn" | "danger" | "neutral";
}) {
  return (
    <div className="op-kpi" data-tone={tone}>
      <div className="op-kpi__label">{label}</div>
      <div className="op-kpi__value" data-tone={tone}>{value}</div>
      {sub && <div className="op-kpi__sub">{sub}</div>}
    </div>
  );
}

function SplitBar({ completed, cancelled }: { completed: number; cancelled: number }) {
  const total = completed + cancelled;
  const cPct = total > 0 ? (completed / total) * 100 : 0;
  const xPct = total > 0 ? (cancelled / total) * 100 : 0;
  return (
    <div
      style={{
        display: "flex",
        height: 14,
        borderRadius: 8,
        overflow: "hidden",
        background: "#F3F4F6",
      }}
      title={`Tamamlandı: ${completed} · Ləğv: ${cancelled}`}
    >
      {completed > 0 && <div style={{ width: `${cPct}%`, background: "#10B981" }} />}
      {cancelled > 0 && <div style={{ width: `${xPct}%`, background: "#DC2626" }} />}
    </div>
  );
}
