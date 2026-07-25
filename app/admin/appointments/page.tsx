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
  type AppointmentDetail,
  type AdminApptSummary,
  type PsychologistWorkload,
  type TrendPoint,
  type OperatorPackageCard,
  type AppointmentSortKey,
  type SortDir,
  type Paged,
} from "@/lib/api";
import { azFormatDateTime, azFormatDate, azFormatTime } from "@/lib/datetime";
import { statusMeta } from "@/lib/appointmentStatus";
import PanelIcon from "@/components/PanelIcon";
import OnBehalfBookingModal from "@/components/OnBehalfBookingModal";
import { toast } from "@/components/Toast";
import {
  PageHead,
  SectionTitle,
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

type View = "sessions" | "packages" | "calendar" | "analytics";
const VIEWS: TabItem<View>[] = [
  { key: "sessions", label: "Seanslar" },
  { key: "packages", label: "Paketlər" },
  { key: "calendar", label: "Təqvim" },
  { key: "analytics", label: "Analitika" },
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
        : view === "packages"
        ? <PackagesTab onOpen={(id) => router.push(`/admin/appointments/package/${id}`)} />
        : view === "calendar"
        ? <CalendarTab onOpen={(id) => router.push(`/admin/appointments/${id}`)} />
        : <AnalyticsView summary={summary} />}

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

// ── Təqvim (həftəlik görünüş) ────────────────────────────────────────────────
const WEEKDAYS = ["Baz", "B.e", "Ç.a", "Çər", "C.a", "Cüm", "Şən"]; // getDay(): 0=Bazar
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = x.getDay();
  x.setDate(x.getDate() + (wd === 0 ? -6 : 1 - wd));
  return x;
}
function addDays(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function ymd(d: Date): string { const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function sameDay(a: Date, b: Date): boolean { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

function CalendarTab({ onOpen }: { onOpen: (id: number) => void }) {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [appts, setAppts] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    adminApi.getCalendar(`${ymd(weekStart)}T00:00:00`, `${ymd(addDays(weekStart, 7))}T00:00:00`)
      .then(setAppts).catch(() => setAppts([])).finally(() => setLoading(false));
  }, [weekStart]);
  useEffect(() => { load(); }, [load]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <Card><CardPad>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <SectionTitle>{azFormatDate(ymd(weekStart))} — {azFormatDate(ymd(addDays(weekStart, 6)))}</SectionTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>Əvvəlki</Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(mondayOf(new Date()))}>Bu həftə</Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>Növbəti</Button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(120px, 1fr))", gap: 8, overflowX: "auto" }}>
        {days.map((d) => {
          const list = appts
            .filter((a) => a.startAt && sameDay(new Date(a.startAt), d))
            .sort((x, y) => new Date(x.startAt!).getTime() - new Date(y.startAt!).getTime());
          const isToday = sameDay(d, today);
          return (
            <div key={ymd(d)} style={{ border: "1px solid var(--hairline)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--hairline)", fontWeight: 700, fontSize: 12.5, background: isToday ? "var(--brand)" : "transparent", color: isToday ? "#fff" : undefined }}>
                {WEEKDAYS[d.getDay()]} {d.getDate()}.{String(d.getMonth() + 1).padStart(2, "0")}
              </div>
              <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 6, minHeight: 70 }}>
                {list.length === 0
                  ? <div className="fx-subtitle" style={{ fontSize: 11, padding: 4 }}>—</div>
                  : list.map((a) => (
                    <button key={a.id} type="button" onClick={() => onOpen(a.id)}
                      style={{ textAlign: "left", border: "1px solid var(--hairline)", borderRadius: 8, padding: "7px 9px", cursor: "pointer", background: "transparent", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        <span className="fx-num" style={{ fontSize: 11.5, fontWeight: 700 }}>{a.startAt ? azFormatTime(a.startAt) : ""}</span>
                        <Status tone={apptTone(a.status)}>{statusMeta(a.status).label}</Status>
                      </div>
                      <div style={{ fontSize: 11.5, overflowWrap: "anywhere", lineHeight: 1.3 }}>
                        <span className="fx-subtitle">Pasiyent: </span>{a.patientName ?? "—"}
                      </div>
                      <div style={{ fontSize: 11.5, overflowWrap: "anywhere", lineHeight: 1.3, marginTop: 1 }}>
                        <span className="fx-subtitle">Psixoloq: </span>{a.psychologistName ?? "—"}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
      {loading && <div className="fx-subtitle" style={{ marginTop: 10 }}>Yüklənir…</div>}
    </CardPad></Card>
  );
}

// ── Analitika: trend + status paylanması + psixoloq yükü ─────────────────────
// Status rəngləri semantik (state) — hər zolaq etiket + say + faizlə göstərilir
// (rəng tək başına identifikasiya daşımır), trend isə tək-rəngli magnitud.
const STATUS_CHART: { key: keyof AdminApptSummary; label: string; color: string }[] = [
  { key: "pending", label: "Yeni / gözləyən", color: "#D97706" },
  { key: "confirmed", label: "Təsdiqlənmiş", color: "#059669" },
  { key: "disputed", label: "Mübahisəli", color: "#DC2626" },
  { key: "completed", label: "Tamamlanmış", color: "#64748B" },
  { key: "cancelled", label: "Ləğv olunmuş", color: "#E11D48" },
];

function AnalyticsView({ summary }: { summary: AdminApptSummary | null }) {
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  useEffect(() => { adminApi.getAppointmentsTrend(30).then(setTrend).catch(() => {}); }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 16 }}>
        <Card><CardPad>
          <SectionTitle>Randevu trendi (30 gün)</SectionTitle>
          <TrendBars data={trend} />
        </CardPad></Card>
        <Card><CardPad>
          <SectionTitle>Status paylanması</SectionTitle>
          <StatusBreakdown s={summary} />
        </CardPad></Card>
      </div>
      <WorkloadTab />
    </div>
  );
}

function TrendBars({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <div className="fx-subtitle" style={{ padding: "24px 0" }}>Məlumat yoxdur</div>;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 150 }}>
        {data.map((d) => (
          <div key={d.date} title={`${azFormatDate(d.date)}: ${d.count} randevu`}
            style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-end", height: "100%" }}>
            <div style={{ width: "100%", height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 3 : 0, background: "var(--brand)", borderRadius: "3px 3px 0 0" }} />
          </div>
        ))}
      </div>
      <div className="fx-subtitle" style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span>{azFormatDate(data[0].date)}</span>
        <span>{azFormatDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}

function StatusBreakdown({ s }: { s: AdminApptSummary | null }) {
  if (!s) return <div className="fx-subtitle" style={{ padding: "24px 0" }}>Yüklənir…</div>;
  const total = Math.max(1, s.total);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
      {STATUS_CHART.map((row) => {
        const v = s[row.key];
        const pct = Math.round((v / total) * 100);
        return (
          <div key={row.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12.5, marginBottom: 4 }}>
              <span>{row.label}</span>
              <span className="fx-num"><strong>{v}</strong> <span className="fx-subtitle">{pct}%</span></span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--hairline)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: row.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Analitika: psixoloq yükü ─────────────────────────────────────────────────
function WorkloadTab() {
  const [rows, setRows] = useState<PsychologistWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminApi.getPsychologistWorkload().then(setRows).catch((e) => setError((e as Error).message || "Yüklənmədi")).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const maxUpcoming = Math.max(1, ...rows.map((r) => r.upcoming));
  const columns: Column<PsychologistWorkload>[] = [
    {
      key: "name", header: "Psixoloq", sortable: true, sortValue: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={r.name} size="sm" />
          <span className="fx-row__title">{r.name}</span>
        </div>
      ),
    },
    { key: "total", header: "Ümumi", numeric: true, sortable: true, sortValue: (r) => r.total, cell: (r) => r.total },
    {
      key: "upcoming", header: "Gələcək yük", numeric: true, sortable: true, sortValue: (r) => r.upcoming,
      cell: (r) => (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
          <span className="fx-num">{r.upcoming}</span>
          <div style={{ width: 56, height: 6, borderRadius: 3, background: "var(--hairline)", overflow: "hidden" }}>
            <div style={{ width: `${(r.upcoming / maxUpcoming) * 100}%`, height: "100%", background: "var(--brand)" }} />
          </div>
        </div>
      ),
    },
    { key: "completed", header: "Tamamlanmış", numeric: true, sortable: true, sortValue: (r) => r.completed, cell: (r) => r.completed },
  ];

  return (
    <Card>
      <CardPad>
        <SectionTitle>Psixoloq yükü</SectionTitle>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.psychologistId}
          loading={loading}
          error={error}
          onRetry={load}
          defaultSort={{ key: "upcoming", dir: "desc" }}
          empty={{ title: "Psixoloq tapılmadı", body: "Aktiv psixoloq yoxdur." }}
          totalLabel={rows.length > 0 ? `${rows.length} psixoloq` : undefined}
          minWidth={640}
        />
      </CardPad>
    </Card>
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
