"use client";

// Operator — psixoloq reytinqi.
// Cədvəl <DataTable>-dır. API sadə massiv qaytarır, ona görə həm sıralama,
// həm də səhifələmə client-side aparılır: tam siyahı sıralanır, sonra
// cari səhifə kəsilir.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { operatorApi, type PsychologistRankItem } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { useT } from "@/lib/i18n/LocaleProvider";
import PageHeader from "@/components/PageHeader";
import {
  Avatar,
  ButtonLink,
  DataTable,
  Status,
  type Column,
  type SortState,
  type StatusTone,
} from "@/components/ui";

type Segment = "all" | "FANUS" | "NORMAL" | "vacation" | "attention";
const CARD: React.CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8" };
const isAttention = (p: PsychologistRankItem) =>
  !p.active || p.suspendedAt != null || (p.rejectionRatePct ?? 0) > 20 || p.individualPrice == null;

/** Sıralama tam siyahı üzərində aparılır — yalnız cari səhifədə deyil. */
const SORT_VALUES: Record<string, (p: PsychologistRankItem) => string | number> = {
  alpha: p => p.name,
  sessions: p => p.completedSessions,
};

function statusOf(p: PsychologistRankItem): { label: string; tone: StatusTone } {
  if (p.suspendedAt != null) return { label: "Dayandırılıb", tone: "risk" };
  if (p.onVacationToday) return { label: "Məzuniyyətdə", tone: "wait" };
  if (p.active) return { label: "Aktiv", tone: "positive" };
  return { label: "Deaktiv", tone: "muted" };
}

export default function OperatorPsychologistsPage() {
  const { t } = useT();
  const router = useRouter();
  const [ranking, setRanking] = useState<PsychologistRankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [sort, setSort] = useState<SortState>({ key: "sessions", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    operatorApi.psychologistRanking()
      .then(r => { if (alive) setRanking(r); })
      .catch(() => { if (alive) setError(t("common.error")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadNonce]);

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
    const list = ranking.filter(p => {
      if (segment === "FANUS" && (p.psychologistType ?? "").toUpperCase() !== "FANUS") return false;
      if (segment === "NORMAL" && (p.psychologistType ?? "").toUpperCase() !== "NORMAL") return false;
      if (segment === "vacation" && !p.onVacationToday) return false;
      if (segment === "attention" && !isAttention(p)) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.phone ?? "").includes(q) && !(p.email ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
    const get = SORT_VALUES[sort.key];
    if (!get) return list;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "az") * factor;
    });
  }, [ranking, query, segment, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize]);

  // Axtarış/seqment/sıralama dəyişəndə boş səhifədə qalmamaq üçün 1-ə qayıt.
  useEffect(() => { setPage(1); }, [query, segment, sort, pageSize]);

  const SEGMENTS: { value: Segment; label: string }[] = [
    { value: "all", label: "Hamısı" }, { value: "FANUS", label: "FANUS" }, { value: "NORMAL", label: "NORMAL" },
    { value: "vacation", label: "Məzuniyyətdə" }, { value: "attention", label: "Diqqət tələb edən" },
  ];

  const columns: Column<PsychologistRankItem>[] = [
    {
      key: "alpha",
      header: "Psixoloq",
      sortable: true,
      cell: p => {
        const isFanus = (p.psychologistType ?? "").toUpperCase() === "FANUS";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Avatar name={p.name.replace(/^Dr\.\s*/i, "")} size="sm" />
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span className="fx-row__title">{p.name}</span>
              <Status tone="muted">{isFanus ? "FANUS" : "NORMAL"}</Status>
            </div>
          </div>
        );
      },
    },
    {
      key: "contact",
      header: "Əlaqə",
      hideOnMobile: true,
      cell: p => {
        if (!p.phone && !p.email) return <span className="fx-muted">—</span>;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {p.phone && <span className="fx-subtitle fx-num">{p.phone}</span>}
            {p.email && <span className="fx-subtitle">{p.email}</span>}
          </div>
        );
      },
    },
    { key: "sessions", header: "Seans", numeric: true, sortable: true, cell: p => p.completedSessions },
    { key: "activePatients", header: "Aktiv pasiyent", numeric: true, cell: p => p.activePatients },
    {
      key: "price",
      header: "Qiymət",
      cell: p => (p.individualPrice != null
        ? <span className="fx-num" style={{ fontWeight: 600 }}>{formatAzn(p.individualPrice)}</span>
        : <Status tone="wait">Qiymət yoxdur</Status>),
    },
    {
      key: "status",
      header: "Status",
      cell: p => { const s = statusOf(p); return <Status tone={s.tone}>{s.label}</Status>; },
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{`.ps-num{font-variant-numeric:tabular-nums}`}</style>

      <PageHeader
        title="Psixoloqlar"
        subtitle="Platformadakı bütün psixoloqları idarə edin — əlaqə saxlayın, riskləri görün, 360° profilə keçin"
        actions={
          <a href="/admin/psychologists" target="_blank" rel="noreferrer" style={{ flex: "none", fontSize: 12.5, fontWeight: 700, color: "var(--brand-700)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            Admin panelinə keçid
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></svg>
          </a>
        }
      />

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(180px, 100%), 1fr))", gap: 13, marginBottom: 18 }}>
        <Kpi label="Ümumi psixoloq" value={kpis.total} sub="qeydiyyatda" color="#082F6D" iconColor="#1051B7" icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>} />
        <Kpi label="Aktiv" value={kpis.active} sub="seans qəbul edir" color="#047857" iconColor="#047857" icon={<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" />} />
        <Kpi label="Diqqət tələb edən" value={kpis.attention} sub="yüksək rədd, qiymət yox, dayandırılıb" color="#92400E" iconColor="#C97D2E" icon={<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>} />
        <Kpi label="Məzuniyyətdə" value={kpis.vacation} sub="hazırda əlçatan deyil" color="#5B21B6" iconColor="#8C7DC9" icon={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />
      </div>

      {/* TOOLBAR */}
      <div style={{ ...CARD, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9DB0CC" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ad, telefon və ya email üzrə axtar…" aria-label="Psixoloq axtar" style={{ width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 12px 10px 36px", fontSize: 14, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit" }} />
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
      <div style={{ ...CARD, overflow: "hidden", padding: "4px 16px 14px" }}>
        <DataTable
          rows={pageRows}
          columns={columns}
          rowKey={p => p.psychologistId}
          loading={loading}
          error={error}
          onRetry={() => setReloadNonce(n => n + 1)}
          onRowClick={p => router.push(`/operator/psychologists/${p.psychologistId}`)}
          sort={sort}
          onSortChange={setSort}
          empty={{
            title: ranking.length === 0
              ? "Hələ psixoloq yoxdur"
              : query.trim()
                ? `«${query.trim()}» üçün nəticə yoxdur`
                : "Bu seqmentdə psixoloq yoxdur",
            body: ranking.length === 0
              ? "Psixoloq qeydiyyatdan keçdikdən sonra siyahı burada görünəcək."
              : "Axtarış sözünü və ya seqmenti dəyişib yenidən yoxlayın.",
          }}
          actions={p => (
            <>
              {p.phone && (
                <ButtonLink href={`tel:${p.phone}`} variant="ghost" size="sm" title="Zəng" aria-label="Zəng">
                  <PhoneIcon />
                </ButtonLink>
              )}
              {p.email && (
                <ButtonLink href={`mailto:${p.email}`} variant="ghost" size="sm" title="Email" aria-label="Email">
                  <MailIcon />
                </ButtonLink>
              )}
            </>
          )}
          pagination={{
            page,
            pageCount,
            onChange: setPage,
            pageSize,
            onPageSizeChange: setPageSize,
          }}
          totalLabel={`${rows.length} psixoloq`}
        />
      </div>
    </div>
  );
}

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
