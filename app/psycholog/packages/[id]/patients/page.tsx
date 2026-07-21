"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { psychologistApi, type PackageDto, type PackageStats } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { azFormatDate, azOrdinal } from "@/lib/datetime";
import {
  Avatar,
  DataTable,
  Progress,
  Status,
  type Column,
  type SortState,
  type StatusTone,
} from "@/components/ui";
import { STATUS_PT, withPurchaseOrdinal } from "../../shared";

/** Cədvəl sətri — paket alışı + neçənci alış olduğu. */
type PatientRow = ReturnType<typeof withPurchaseOrdinal>[number];

const PAGE_SIZE = 10;

/**
 * Paket statusu rəngli rozetlə deyil, mətnlə göstərilir — rəng yalnız diqqət
 * (`wait`) və risk (`risk`) hallarında məna daşıyır.
 */
const STATUS_TONE: Record<string, StatusTone> = {
  PENDING_PAYMENT: "wait",
  ACTIVE: "positive",
  EXHAUSTED: "neutral",
  EXPIRED: "wait",
  CANCELLED: "risk",
};

/** Eyni pasiyent eyni paketi bir neçə dəfə ala bilər — açar alış tarixini də daşıyır. */
const rowKeyOf = (p: PatientRow) => `${p.patientId}-${p.purchasedAt}-${p.ordinal}`;

const COLUMNS: Column<PatientRow>[] = [
  {
    key: "patient",
    header: "Pasiyent",
    sortable: true,
    sortValue: p => p.patientName ?? "",
    cell: p => (
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Avatar name={p.patientName} size="sm" />
        <div style={{ minWidth: 0 }}>
          <Link
            href={`/psycholog/clients/${p.patientId}`}
            className="fx-link"
            onClick={e => e.stopPropagation()}
            style={{ fontWeight: 600 }}
          >
            {p.patientName}
          </Link>
          {p.purchaseCount > 1 && (
            <div className="fx-row__meta" style={{ marginTop: 2 }}>{azOrdinal(p.ordinal)} dəfə alıb</div>
          )}
        </div>
      </div>
    ),
  },
  {
    key: "purchasedAt",
    header: "Alış tarixi",
    sortable: true,
    sortValue: p => new Date(p.purchasedAt).getTime(),
    cell: p => <span style={{ whiteSpace: "nowrap" }}>{azFormatDate(p.purchasedAt)}</span>,
  },
  {
    key: "progress",
    header: "Keçirilib",
    sortable: true,
    sortValue: p => (p.total > 0 ? p.completed / p.total : 0),
    cell: p => (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, maxWidth: 110 }}>
          <Progress value={p.completed} max={p.total} tone={p.status === "EXHAUSTED" ? "sage" : "brand"} />
        </div>
        <span className="fx-num" style={{ whiteSpace: "nowrap" }}>{p.completed}/{p.total}</span>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    sortValue: p => STATUS_PT[p.status]?.label ?? p.status,
    cell: p => (
      <Status tone={STATUS_TONE[p.status] ?? "neutral"}>
        {STATUS_PT[p.status]?.label ?? p.status}
      </Status>
    ),
  },
];

export default function PackagePatientsPage() {
  const params = useParams();
  const router = useRouter();
  const packageId = Number(params.id);

  const [catalog, setCatalog] = useState<PackageDto[]>([]);
  const [statsById, setStatsById] = useState<Record<number, PackageStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>({ key: "purchasedAt", dir: "desc" });
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([psychologistApi.myPackages(), psychologistApi.myPackageStats()])
      .then(([c, s]) => {
        setCatalog(c);
        const map: Record<number, PackageStats> = {};
        for (const st of s) map[st.packageId] = st;
        setStatsById(map);
      })
      .catch(e => setError((e as Error).message || "Paket məlumatı yüklənmədi"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const pkg = catalog.find(p => p.id === packageId);
  const stats = statsById[packageId];

  const rows = useMemo(() => {
    if (!stats) return [] as PatientRow[];
    return withPurchaseOrdinal(stats.patients);
  }, [stats]);

  // Sıralama bütün siyahı üzərində aparılır, səhifə YALNIZ ondan sonra kəsilir —
  // əks halda sıralama tək səhifənin içində qalardı.
  const sortedRows = useMemo(() => {
    const get = COLUMNS.find(c => c.key === sort.key)?.sortValue;
    if (!get) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "az") * factor;
    });
  }, [rows, sort]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = sortedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const backLink = (
    <Link href="/psycholog/packages" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none", marginBottom: 14 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      Paketlərə qayıt
    </Link>
  );

  if (loading) {
    return (
      <div className="panel-page">
        {backLink}
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>Yüklənir…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-page">
        {backLink}
        <DataTable rows={[]} columns={COLUMNS} rowKey={rowKeyOf} error={error} onRetry={load} />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="panel-page">
        {backLink}
        <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: 40, textAlign: "center", fontSize: 14, color: "var(--oxford-60)", fontWeight: 600 }}>
          Paket tapılmadı
        </div>
      </div>
    );
  }

  return (
    <div className="panel-page">
      {backLink}

      {/* Paket başlığı */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 7 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#E4ECFA", color: "#082F6D", fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 7 }}>Paket</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--oxford)" }}>{pkg.name}</span>
          <span style={{ background: pkg.active ? "#D1FAE5" : "#F3F4F6", color: pkg.active ? "#065F46" : "#6B7280", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>{pkg.active ? "Aktiv" : "Deaktiv"}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600, marginBottom: stats ? 16 : 0, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <span>{pkg.sessionCount} seans</span>
          <span>{formatAzn(pkg.packagePrice)}</span>
          <span>seans başına ≈ {formatAzn(pkg.perSessionPrice)}</span>
        </div>
        {stats && (
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", paddingTop: 14, borderTop: "1px solid #EDF1F8" }}>
            <MiniStat label="Satılıb" value={String(stats.sold)} />
            <MiniStat label="Aktiv" value={String(stats.active)} color="#065F46" />
            <MiniStat label="Tamamlanıb" value={String(stats.completed)} />
            <MiniStat label="Gəlir" value={formatAzn(stats.revenue)} color="#082F6D" />
          </div>
        )}
      </div>

      {/* Pasiyent cədvəli */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EDF1F8", fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>
          Bu paketi alan pasiyentlər ({rows.length})
        </div>
        <div style={{ padding: "6px 20px 16px" }}>
          <DataTable
            rows={pageRows}
            columns={COLUMNS}
            rowKey={rowKeyOf}
            mobile="cards"
            onRowClick={p => router.push(`/psycholog/clients/${p.patientId}`)}
            sort={sort}
            onSortChange={next => { setSort(next); setPage(1); }}
            empty={{
              title: "Hələ bu paketi alan yoxdur",
              body: "Paket satıldıqca alış tarixi və gedişat burada görünəcək.",
            }}
            pagination={{ page: safePage, pageCount, onChange: setPage }}
            totalLabel={`Cəmi ${sortedRows.length} alış`}
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8AAABF", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color ?? "var(--oxford)" }}>{value}</div>
    </div>
  );
}
