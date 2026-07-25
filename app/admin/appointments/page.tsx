"use client";

// Admin · Randevular — iki tab: Seanslar (yalnız tək seanslar) və Paketlər.
// Status tabları əvəzinə alətlər zolağında dropdown süzgəci. Sətrə klik → daxili
// detal səhifəsi: /admin/appointments/[id] (seans), /admin/appointments/package/[id] (paket).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminApi,
  reasonsForRole,
  type AdminAppointmentRow,
  type AdminApptSummary,
  type OperatorPackageCard,
  type AppointmentSortKey,
  type SortDir,
  type Paged,
} from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";
import { statusMeta } from "@/lib/appointmentStatus";
import PanelIcon from "@/components/PanelIcon";
import OnBehalfBookingModal from "@/components/OnBehalfBookingModal";
import { toast } from "@/components/Toast";
import {
  PageHead,
  Card,
  CardPad,
  DataTable,
  Status,
  Avatar,
  Button,
  IconButton,
  SearchInput,
  Select,
  Tabs,
  Stats,
  Stat,
  Modal,
  Field,
  Textarea,
  type Column,
  type SortState,
  type TabItem,
  type StatusTone,
} from "@/components/ui";

const APPT_TONE: Record<string, StatusTone> = {
  PENDING: "wait", NEW: "wait", REJECTED: "wait", IN_REVIEW: "wait",
  AWAITING_CONFIRMATION: "wait", CANCEL_REQUESTED: "wait",
  ASSIGNED: "neutral", CONFIRMED: "positive",
  DISPUTED: "risk", CANCELLED: "risk", COMPLETED: "muted",
};
const apptTone = (s?: string | null): StatusTone => (s && APPT_TONE[s]) || "neutral";

const PKG_TONE: Record<string, StatusTone> = {
  PENDING_PAYMENT: "wait", ACTIVE: "positive", EXHAUSTED: "muted", CANCELLED: "risk", EXPIRED: "muted",
};
const PKG_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Ödəniş gözlənilir", ACTIVE: "Aktiv", EXHAUSTED: "Tamamlanıb", CANCELLED: "Ləğv", EXPIRED: "Vaxtı bitib",
};

type View = "sessions" | "packages";
const VIEWS: TabItem<View>[] = [
  { key: "sessions", label: "Seanslar" },
  { key: "packages", label: "Paketlər" },
];

const APPT_STATUS_FILTERS: { v: string; label: string; status?: string }[] = [
  { v: "all", label: "Bütün statuslar" },
  { v: "new", label: "Yeni müraciətlər", status: "PENDING,NEW,REJECTED" },
  { v: "active", label: "Təsdiqlənmiş", status: "CONFIRMED,ASSIGNED,AWAITING_CONFIRMATION" },
  { v: "disputed", label: "Mübahisəli", status: "DISPUTED" },
  { v: "completed", label: "Tamamlanmış", status: "COMPLETED" },
  { v: "cancelled", label: "Ləğv olunmuş", status: "CANCELLED,CANCEL_REQUESTED" },
];
const PKG_STATUS_FILTERS: { v: string; label: string; status?: string }[] = [
  { v: "all", label: "Bütün statuslar" },
  { v: "PENDING_PAYMENT", label: "Ödəniş gözlənilir", status: "PENDING_PAYMENT" },
  { v: "ACTIVE", label: "Aktiv", status: "ACTIVE" },
  { v: "EXHAUSTED", label: "Tamamlanıb", status: "EXHAUSTED" },
  { v: "CANCELLED", label: "Ləğv", status: "CANCELLED" },
  { v: "EXPIRED", label: "Vaxtı bitib", status: "EXPIRED" },
];
const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];
const OPERATOR_REASONS = reasonsForRole("OPERATOR");

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

export default function AdminAppointmentsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [view, setView] = useState<View>("sessions");
  const [onBehalfOpen, setOnBehalfOpen] = useState(false);
  const [summary, setSummary] = useState<AdminApptSummary | null>(null);
  useEffect(() => { adminApi.getAppointmentsSummary().then(setSummary).catch(() => {}); }, []);

  if (!mounted) return null;

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead title="Randevular" sub="Platformadakı bütün seanslar və paketlər."
        actions={<Button variant="primary" onClick={() => setOnBehalfOpen(true)} icon={<PanelIcon name="plus" size={16} />}>Pasiyent adına randevu</Button>} />

      <Stats style={{ marginBottom: 16, gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
        <Stat value={summary?.total ?? "—"} label="Ümumi randevu" />
        <Stat value={summary?.pending ?? "—"} label="Yeni / gözləyən" />
        <Stat value={summary?.confirmed ?? "—"} label="Təsdiqlənmiş" />
        <Stat value={summary?.disputed ?? "—"} label="Mübahisəli" />
        <Stat value={summary?.completed ?? "—"} label="Tamamlanmış" />
        <Stat value={summary?.cancelled ?? "—"} label="Ləğv olunmuş" />
      </Stats>

      <div style={{ marginBottom: 16 }}>
        <Tabs items={VIEWS} value={view} onChange={setView} />
      </div>

      {/* Detal səhifələri operatorunku ilə EYNİDİR — /admin route-ları operator
          səhifəsini re-export edir; səhifə panel prefiksini cari yoldan seçir. */}
      {view === "sessions"
        ? <SessionsTab onOpen={(id) => router.push(`/admin/appointments/${id}`)} />
        : <PackagesTab onOpen={(id) => router.push(`/admin/appointments/package/${id}`)} />}

      {onBehalfOpen && <OnBehalfBookingModal onClose={() => setOnBehalfOpen(false)} onDone={() => setOnBehalfOpen(false)} />}
    </div>
  );
}

// ── Seanslar tabı (yalnız tək seanslar, single=true) ─────────────────────────
function SessionsTab({ onOpen }: { onOpen: (id: number) => void }) {
  const [data, setData] = useState<Paged<AdminAppointmentRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const dq = useDebounce(search, 300);
  const [statusF, setStatusF] = useState("all");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(30);
  const [sort, setSort] = useState<AppointmentSortKey>("createdAt");
  const [dir, setDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const statusParam = APPT_STATUS_FILTERS.find((f) => f.v === statusF)?.status;

  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminApi.getAppointmentsPaged({ q: dq || undefined, status: statusParam, page, size, sort, dir })
      .then((res) => { setData(res); if (res.totalPages > 0 && page >= res.totalPages) setPage(0); })
      .catch((e) => setError((e as Error).message || "Seanslar yüklənmədi"))
      .finally(() => setLoading(false));
  }, [dq, statusParam, page, size, sort, dir]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); setSelected(new Set()); }, [dq, statusParam]);

  const columns: Column<AdminAppointmentRow>[] = [
    {
      key: "patientName", header: "Pasiyent", sortable: true,
      cell: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={r.detail.patientName ?? "—"} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div className="fx-row__title">{r.detail.patientName ?? "—"}</div>
            {r.detail.patientEmail && <div className="fx-subtitle">{r.detail.patientEmail}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "psychologistName", header: "Psixoloq", sortable: true, hideOnMobile: true,
      cell: (r) => r.detail.psychologistName
        ? <span>{r.detail.psychologistName}</span>
        : r.detail.requestedPsychologistName
          ? <span className="fx-subtitle">{r.detail.requestedPsychologistName} (təklif)</span>
          : <span className="fx-subtitle">—</span>,
    },
    {
      key: "startAt", header: "Vaxt", sortable: true,
      cell: (r) => {
        const t = r.detail.startAt ?? r.detail.requestedStartAt;
        if (!t) return <span className="fx-subtitle">—</span>;
        return <span className="fx-num" style={{ whiteSpace: "nowrap" }}>{azFormatDateTime(t)}{!r.detail.startAt && <span className="fx-subtitle"> (təklif)</span>}</span>;
      },
    },
    {
      key: "status", header: "Status", sortable: true,
      cell: (r) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Status tone={apptTone(r.detail.status)}>{statusMeta(r.detail.status).label}</Status>
          {r.detail.patientPackageId != null && <Status tone="muted">Paket</Status>}
        </span>
      ),
    },
    { key: "operator", header: "Operator", hideOnMobile: true, cell: (r) => r.assignedByOperatorName ?? <span className="fx-subtitle">—</span> },
    { key: "createdAt", header: "Yaradılıb", sortable: true, hideOnMobile: true, cell: (r) => <span className="fx-num" style={{ whiteSpace: "nowrap" }}>{azFormatDateTime(r.detail.createdAt)}</span> },
  ];

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pasiyent və ya psixoloq üzrə axtar" aria-label="Axtar" autoComplete="off" />
        </div>
        <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label="Status süzgəci" style={{ maxWidth: 210 }}>
          {APPT_STATUS_FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
        </Select>
        {selected.size > 0 && (
          <Button variant="dangerGhost" size="sm" onClick={() => setBulkOpen(true)}>Seçilmişləri ləğv et ({selected.size})</Button>
        )}
      </div>
      {bulkOpen && <BulkCancelModal ids={[...selected].map(Number)} onClose={() => setBulkOpen(false)} onDone={() => { setBulkOpen(false); setSelected(new Set()); load(); }} />}
      <CardPad>
        <DataTable
          rows={data?.content ?? []}
          columns={columns}
          rowKey={(r) => r.detail.id}
          loading={loading}
          error={error}
          onRetry={load}
          onRowClick={(r) => onOpen(r.detail.id)}
          selection={{ selectedKeys: selected, onChange: setSelected }}
          empty={{ title: "Seans tapılmadı", body: "Filtri dəyişin və ya yeni müraciət gözləyin." }}
          sort={{ key: sort, dir }}
          onSortChange={(s) => { setSort(s.key as AppointmentSortKey); setDir(s.dir); setPage(0); }}
          actions={(r) => <IconButton aria-label="Aç" onClick={() => onOpen(r.detail.id)}><PanelIcon name="chevron" size={16} /></IconButton>}
          pagination={{
            page: page + 1, pageCount: Math.max(1, data?.totalPages ?? 1),
            onChange: (p) => setPage(p - 1), pageSize: size,
            onPageSizeChange: (s) => { setSize(s); setPage(0); }, pageSizeOptions: PAGE_SIZE_OPTIONS,
          }}
          totalLabel={data && data.totalElements > 0
            ? `Göstərilir: ${data.page * data.size + 1}–${Math.min((data.page + 1) * data.size, data.totalElements)} / ${data.totalElements}`
            : undefined}
        />
      </CardPad>
    </Card>
  );
}

// ── Toplu ləğv modalı (backend bulkCancelAppointments) ───────────────────────
function BulkCancelModal({ ids, onClose, onDone }: { ids: number[]; onClose: () => void; onDone: () => void }) {
  const [reasonCode, setReasonCode] = useState(OPERATOR_REASONS[0]?.code ?? "OPERATOR_OTHER");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const res = await adminApi.bulkCancelAppointments(ids, reasonCode, note.trim() || undefined);
      const failed = Object.keys(res.failed).length;
      toast(`${res.cancelled.length} randevu ləğv edildi${failed ? `, ${failed} uğursuz` : ""}`, failed ? "error" : "success");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${ids.length} randevunu ləğv et`}
      text="Seçilmiş randevular ləğv olunacaq. Hər biri ayrıca audit-loga yazılır."
      icon={<PanelIcon name="x" size={20} />} iconTone="rose"
      actions={<><Button variant="ghost" onClick={onClose}>İmtina</Button><Button variant="danger" disabled={busy} onClick={submit}>{busy ? "Ləğv olunur…" : `${ids.length} randevunu ləğv et`}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Səbəb">
          <Select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
            {OPERATOR_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </Select>
        </Field>
        <Field label="Qeyd (istəyə bağlı)"><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} /></Field>
      </div>
    </Modal>
  );
}

// ── Paketlər tabı ────────────────────────────────────────────────────────────
function PackagesTab({ onOpen }: { onOpen: (id: number) => void }) {
  const [data, setData] = useState<Paged<OperatorPackageCard> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const dq = useDebounce(search, 300);
  const [statusF, setStatusF] = useState("all");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(30);
  const [sort, setSort] = useState<SortState | null>(null);

  const statusParam = PKG_STATUS_FILTERS.find((f) => f.v === statusF)?.status;

  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminApi.getAdminPackagesPaged({ q: dq || undefined, status: statusParam, page, size, sort: sort?.key, dir: sort?.dir })
      .then((res) => { setData(res); if (res.totalPages > 0 && page >= res.totalPages) setPage(0); })
      .catch((e) => setError((e as Error).message || "Paketlər yüklənmədi"))
      .finally(() => setLoading(false));
  }, [dq, statusParam, page, size, sort]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [dq, statusParam]);

  const columns: Column<OperatorPackageCard>[] = [
    {
      key: "packageName", header: "Paket", sortable: true,
      cell: (c) => (
        <div style={{ minWidth: 0 }}>
          <div className="fx-row__title">{c.packageName ?? "Paket"}</div>
          <div className="fx-subtitle fx-num">#{c.id}</div>
        </div>
      ),
    },
    { key: "patientName", header: "Pasiyent", cell: (c) => c.patientName ?? <span className="fx-subtitle">—</span> },
    { key: "psychologistName", header: "Psixoloq", hideOnMobile: true, cell: (c) => c.psychologistName ?? <span className="fx-subtitle">—</span> },
    {
      key: "progress", header: "İrəliləyiş", hideOnMobile: true,
      cell: (c) => {
        const done = c.sessions.filter((s) => s.status === "COMPLETED").length;
        return <span className="fx-num" style={{ fontWeight: 700, color: "var(--lilac)" }}>{done}/{c.totalSessions}</span>;
      },
    },
    {
      key: "packageStatus", header: "Status", sortable: true,
      cell: (c) => <Status tone={PKG_TONE[c.status] ?? "neutral"}>{PKG_LABEL[c.status] ?? c.status}</Status>,
    },
  ];

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Paket, pasiyent və ya psixoloq üzrə axtar" aria-label="Axtar" autoComplete="off" />
        </div>
        <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label="Status süzgəci" style={{ maxWidth: 210 }}>
          {PKG_STATUS_FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
        </Select>
      </div>
      <CardPad>
        <DataTable
          rows={data?.content ?? []}
          columns={columns}
          rowKey={(c) => c.id}
          loading={loading}
          error={error}
          onRetry={load}
          onRowClick={(c) => onOpen(c.id)}
          empty={{ title: "Paket tapılmadı", body: "Filtri dəyişin və ya pasiyent adına yeni paket satın." }}
          sort={sort}
          onSortChange={(s) => { setSort(s); setPage(0); }}
          actions={(c) => <IconButton aria-label="Aç" onClick={() => onOpen(c.id)}><PanelIcon name="chevron" size={16} /></IconButton>}
          pagination={{
            page: page + 1, pageCount: Math.max(1, data?.totalPages ?? 1),
            onChange: (p) => setPage(p - 1), pageSize: size,
            onPageSizeChange: (s) => { setSize(s); setPage(0); }, pageSizeOptions: PAGE_SIZE_OPTIONS,
          }}
          totalLabel={data && data.totalElements > 0
            ? `Göstərilir: ${data.page * data.size + 1}–${Math.min((data.page + 1) * data.size, data.totalElements)} / ${data.totalElements}`
            : undefined}
        />
      </CardPad>
    </Card>
  );
}
