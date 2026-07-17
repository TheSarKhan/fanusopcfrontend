"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminApi,
  operatorApi,
  isSlotConflict,
  type AppointmentDetail,
  type AuditLogEntry,
  type AvailableSlot,
  type BookingSeries,
  type ClaimState,
  type ConflictInfo,
  type Psychologist,
  type PsychologistSuggestion,
} from "@/lib/api";
import { azLocalToISO, azFormatDate, azFormatTime, azFormatDateTime } from "@/lib/datetime";
import { IconSearch } from "../_components/icons";
import DatePicker from "@/components/DatePicker";
import { toast } from "@/components/Toast";

/** MODUL 2: admin sətri = operator detail DTO + operator adı + pasiyent bayrağı. */
type AdminAppt = AppointmentDetail & {
  assignedByOperatorName: string | null;
  patientFlag: string | null;
};

type Column = { key: string; title: string; dotColor: string; statuses: string[]; dropStatus: string | null };

// Kanban qalır (qəbul kriteriyası 1) — köhnə 4 sütun + əməliyyat statusları.
const COLUMNS: Column[] = [
  { key: "PENDING",   title: "Yeni / təyin gözləyir", dotColor: "var(--gold)",   statuses: ["PENDING", "NEW", "REJECTED", "IN_REVIEW"], dropStatus: "PENDING" },
  { key: "ASSIGNED",  title: "Təyin edilib",          dotColor: "var(--ox-500)", statuses: ["ASSIGNED"], dropStatus: null },
  { key: "CONFIRMED", title: "Təsdiqlənib",           dotColor: "var(--sage)",   statuses: ["CONFIRMED", "AWAITING_CONFIRMATION"], dropStatus: "CONFIRMED" },
  { key: "ATTENTION", title: "Diqqət",                dotColor: "var(--rose)",   statuses: ["DISPUTED", "CANCEL_REQUESTED"], dropStatus: null },
  { key: "COMPLETED", title: "Tamamlandı",            dotColor: "var(--ox-200)", statuses: ["COMPLETED"], dropStatus: "COMPLETED" },
  { key: "CANCELLED", title: "Ləğv edildi",           dotColor: "var(--rose)",   statuses: ["CANCELLED"], dropStatus: "CANCELLED" },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Gözləyir", NEW: "Yeni", REJECTED: "Yenidən təyin", IN_REVIEW: "Operatora qaytarılıb",
  ASSIGNED: "Təyin edilib", CONFIRMED: "Təsdiqlənib", AWAITING_CONFIRMATION: "Təsdiq gözlənir",
  DISPUTED: "Mübahisəli", CANCEL_REQUESTED: "Ləğv gözlənir", COMPLETED: "Tamamlanıb", CANCELLED: "Ləğv edilib",
};

const FLAG_LABEL: Record<string, string> = {
  HIGH_NO_SHOW: "Çox no-show",
  HIGH_LATE_CANCEL: "Çox gec ləğv",
  HIGH_REJECT: "Çox rədd",
};

const OPERATOR_REASONS: { code: string; label: string }[] = [
  { code: "OPERATOR_PATIENT_REQUEST", label: "Pasient telefonla bildirdi" },
  { code: "OPERATOR_PSY_UNAVAILABLE", label: "Psixoloq mövcud deyil" },
  { code: "OPERATOR_NO_SHOW_BOTH", label: "İkisi də gəlmədi" },
  { code: "OPERATOR_PATIENT_BLOCKED", label: "Pasient bloklandı" },
  { code: "OPERATOR_OTHER", label: "Digər" },
];

const AVATAR_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#3A74D6", "#5d6b85", "#082F6D"];

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function avatarColor(name: string) {
  const hash = Array.from(name).reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function fmtDT(iso?: string | null) {
  return iso ? azFormatDateTime(iso) : "—";
}
function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "indi";
  if (min < 60) return `${min} dəq`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}s ${min % 60}d`;
  return `${Math.floor(hrs / 24)}g`;
}
function isoDateOnly(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits || null;
}
function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/^\+/, "").replace(/[^\d]/g, "")}`;
}

export default function AdminAppointmentsPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AdminAppt[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [slaHours, setSlaHours] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());

  // Filtrlər (qəbul kriteriyası 3)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const f = searchParams.get("filter");
    return f === "CANCEL_REQUESTED" || f === "DISPUTED" ? f : "";
  });
  const [overdueOnly, setOverdueOnly] = useState(() => searchParams.get("filter") === "overdue");
  const [psyFilter, setPsyFilter] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | "series" | "single">("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  // Seçim + modallar
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [detailFor, setDetailFor] = useState<AdminAppt | null>(null);
  const [assignFor, setAssignFor] = useState<AdminAppt | null>(null);
  const [cancelFor, setCancelFor] = useState<AdminAppt | null>(null);
  const [resolveFor, setResolveFor] = useState<AdminAppt | null>(null);
  const [reassignFor, setReassignFor] = useState<AdminAppt | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    adminApi.getAppointmentsDetailed()
      .then((rows) => setItems(rows.map((r) => ({
        ...r.detail,
        assignedByOperatorName: r.assignedByOperatorName,
        patientFlag: r.patientFlag,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    operatorApi.listPsychologists().then(setPsychologists).catch(() => {});
    operatorApi.stats().then((s) => setSlaHours(s.slaHours)).catch(() => {});
  }, []);

  const patch = (updated: AppointmentDetail) => {
    setItems((prev) => prev.map((a) => (a.id === updated.id
      ? { ...a, ...updated }
      : a)));
    setDetailFor((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
  };

  /** GAP-01 ilə eyni qayda: SLA job möhürü, yoxsa canlı yaş hesabı. */
  const isOverdue = (a: AdminAppt) => {
    if (a.status !== "PENDING" && a.status !== "NEW") return false;
    if (a.slaNotifiedAt) return true;
    if (slaHours == null) return false;
    return now - new Date(a.createdAt).getTime() > slaHours * 3_600_000;
  };

  const operatorNames = useMemo(() => {
    const set = new Set<string>();
    items.forEach((a) => { if (a.assignedByOperatorName) set.add(a.assignedByOperatorName); });
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate + "T00:00:00") : null;
    const to = toDate ? new Date(toDate + "T23:59:59") : null;
    return items.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (overdueOnly && !isOverdue(a)) return false;
      if (psyFilter && String(a.psychologistId ?? "") !== psyFilter) return false;
      if (operatorFilter && a.assignedByOperatorName !== operatorFilter) return false;
      if (groupFilter === "series" && a.seriesId == null) return false;
      if (groupFilter === "single" && a.seriesId != null) return false;
      if (flaggedOnly && !a.patientFlag) return false;
      const anchor = a.startAt ?? a.createdAt;
      if (from && new Date(anchor) < from) return false;
      if (to && new Date(anchor) > to) return false;
      if (q) {
        const hay = `${a.id} ${a.patientName ?? ""} ${a.patientPhone ?? ""} ${a.psychologistName ?? ""} ${a.assignedByOperatorName ?? ""} ${a.note ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, statusFilter, overdueOnly, psyFilter, operatorFilter, fromDate, toDate, groupFilter, flaggedOnly, slaHours]);

  const grouped = useMemo(() => {
    const map: Record<string, AdminAppt[]> = {};
    COLUMNS.forEach((c) => { map[c.key] = []; });
    filtered.forEach((a) => {
      const col = COLUMNS.find((c) => c.statuses.includes(a.status));
      if (col) map[col.key].push(a);
    });
    return map;
  }, [filtered]);

  // Köhnə sürükləmə davranışı qalır (yalnız legacy statuslar arasında).
  const updateStatusLegacy = async (id: number, status: string) => {
    const before = items;
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await adminApi.updateAppointmentStatus(id, status);
    } catch (e) {
      setItems(before);
      alert((e as Error).message);
    }
  };

  const onDragStart = (id: number) => (e: DragEvent<HTMLDivElement>) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (col: Column) => (e: DragEvent<HTMLDivElement>) => {
    if (!col.dropStatus) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overCol !== col.key) setOverCol(col.key);
  };
  const onDrop = (col: Column) => (e: DragEvent<HTMLDivElement>) => {
    if (!col.dropStatus) return;
    e.preventDefault();
    setOverCol(null);
    if (draggedId == null) return;
    const current = items.find((a) => a.id === draggedId);
    if (current && current.status !== col.dropStatus) updateStatusLegacy(draggedId, col.dropStatus);
    setDraggedId(null);
  };

  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const approveCancelReq = async (a: AdminAppt) => {
    const note = window.prompt("Qeyd (məcburi deyil):", "") ?? undefined;
    try { patch(await adminApi.approveAppointmentCancelRequest(a.id, note)); }
    catch (e) { alert((e as Error).message); }
  };
  const rejectCancelReq = async (a: AdminAppt) => {
    const note = window.prompt("Pasiyentə səbəb yazın:", "") ?? undefined;
    try { patch(await adminApi.rejectAppointmentCancelRequest(a.id, note)); }
    catch (e) { alert((e as Error).message); }
  };

  const activeFilterCount =
    (statusFilter ? 1 : 0) + (overdueOnly ? 1 : 0) + (psyFilter ? 1 : 0) + (operatorFilter ? 1 : 0)
    + (fromDate || toDate ? 1 : 0) + (groupFilter !== "all" ? 1 : 0) + (flaggedOnly ? 1 : 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Randevular</h1>
          <p className="page-sub">Tam əməliyyat dəsti: təyinat, mübahisə, ləğv təsdiqi, konflikt həlli. Karta klik — detal.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => { setSelectMode((s) => !s); setSelected(new Set()); }}>
            {selectMode ? "Seçimi bağla" : "Çoxlu seçim"}
          </button>
          <button className="btn" onClick={load}>Yenilə</button>
        </div>
      </div>

      {/* ─── Filtrlər ──────────────────────────────────────────────────────── */}
      <div className="toolbar" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div className="search">
          <IconSearch size={13} style={{ color: "var(--muted)" }} />
          <input placeholder="ID, ad, telefon, psixoloq..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter" style={{ cursor: "pointer" }}>
          <option value="">Bütün statuslar</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={psyFilter} onChange={(e) => setPsyFilter(e.target.value)} className="filter" style={{ cursor: "pointer" }}>
          <option value="">Bütün psixoloqlar</option>
          {psychologists.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
        <select value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)} className="filter" style={{ cursor: "pointer" }}>
          <option value="">Bütün operatorlar</option>
          {operatorNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value as typeof groupFilter)} className="filter" style={{ cursor: "pointer" }}>
          <option value="all">Qrup + tək</option>
          <option value="series">Yalnız qrup/seriya</option>
          <option value="single">Yalnız tək</option>
        </select>
        <DatePicker value={fromDate} onChange={setFromDate} theme="light" size="sm" style={{ width: 150 }} />
        <DatePicker value={toDate} onChange={setToDate} theme="light" size="sm" style={{ width: 150 }} />
        <button className={`filter${overdueOnly ? " active" : ""}`} onClick={() => setOverdueOnly((o) => !o)}>
          SLA gecikmiş{slaHours != null ? ` (${slaHours}s+)` : ""}
        </button>
        <button className={`filter${flaggedOnly ? " active" : ""}`} onClick={() => setFlaggedOnly((f) => !f)}>
          Bayraqlı pasiyent
        </button>
        {activeFilterCount > 0 && (
          <button className="filter" onClick={() => {
            setStatusFilter(""); setOverdueOnly(false); setPsyFilter(""); setOperatorFilter("");
            setFromDate(""); setToDate(""); setGroupFilter("all"); setFlaggedOnly(false); setSearch("");
          }}>
            Filtri sıfırla ({activeFilterCount})
          </button>
        )}
        <div className="toolbar-spacer" />
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{filtered.length} nəticə</span>
      </div>

      {/* ─── Toplu əməliyyat paneli ────────────────────────────────────────── */}
      {selectMode && selected.size > 0 && (
        <div style={{ background: "var(--ox-800)", color: "#fff", borderRadius: 10, padding: "10px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} randevu seçilib</span>
          <button onClick={() => setBulkCancelOpen(true)}
            style={{ padding: "7px 14px", border: "none", borderRadius: 8, background: "#fff", color: "#991B1B", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            Toplu ləğv et (səbəblə)
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>
      ) : (
        <div className="kanban cols-6">
          {COLUMNS.map((col) => {
            const list = grouped[col.key] ?? [];
            return (
              <div key={col.key}
                className={`col${overCol === col.key ? " drag-over" : ""}`}
                onDragOver={onDragOver(col)}
                onDragLeave={() => setOverCol(null)}
                onDrop={onDrop(col)}>
                <div className="col-head">
                  <div className="col-title">
                    <span style={{ width: 8, height: 8, background: col.dotColor, borderRadius: "50%" }} />
                    {col.title}
                    <span className="col-count">{list.length}</span>
                  </div>
                </div>
                {list.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", color: "var(--muted-2)", fontSize: 11.5 }}>Boşdur</div>
                ) : list.map((a) => (
                  <div key={a.id}
                    className={`ticket${draggedId === a.id ? " dragging" : ""}`}
                    draggable={col.dropStatus !== null}
                    onDragStart={onDragStart(a.id)}
                    onDragEnd={() => { setDraggedId(null); setOverCol(null); }}
                    onClick={() => { if (selectMode) toggleSelected(a.id); else setDetailFor(a); }}>
                    <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
                      <span className="ticket-id">
                        {selectMode && (
                          <input type="checkbox" checked={selected.has(a.id)} readOnly
                            style={{ marginRight: 6, verticalAlign: "middle" }} />
                        )}
                        #FNS-{String(a.id).padStart(4, "0")}
                      </span>
                      <span className="row" style={{ gap: 4 }}>
                        {isOverdue(a) && <span className="pill rose" style={{ fontSize: 10, padding: "1px 6px" }}>SLA</span>}
                        {a.status === "DISPUTED" && <span className="pill rose" style={{ fontSize: 10, padding: "1px 6px" }}>mübahisə</span>}
                        {a.status === "CANCEL_REQUESTED" && <span className="pill gold" style={{ fontSize: 10, padding: "1px 6px" }}>ləğv tələbi</span>}
                        {a.seriesId != null && (
                          <span className="pill ox" style={{ fontSize: 10, padding: "1px 6px" }}>
                            Kurs {(a.seriesIndex ?? 0) + 1}/{a.seriesTotal ?? "?"}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="ticket-title">{a.note ? a.note.slice(0, 60) : "Konsultasiya"}</div>
                    <div className="ticket-meta">
                      <div className="row-avatar">
                        <div className="av" style={{ width: 20, height: 20, fontSize: 9, background: avatarColor(a.patientName ?? "?") }}>
                          {initials(a.patientName ?? "?")}
                        </div>
                        <span>{a.patientName ?? "—"}</span>
                        {a.patientFlag && (
                          <span className="pill gold" style={{ fontSize: 9, padding: "0 5px", display: "inline-flex", alignItems: "center" }} title={FLAG_LABEL[a.patientFlag] ?? a.patientFlag}>
                            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                          </span>
                        )}
                      </div>
                      <span className="ticket-time">{a.startAt ? azFormatDate(a.startAt) : relTime(a.createdAt)}</span>
                    </div>
                    {a.psychologistName && (
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                        {a.psychologistName}
                        {a.assignedByOperatorName && <span style={{ color: "var(--muted-2)" }}> · op: {a.assignedByOperatorName}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {detailFor && (
        <DetailDrawer
          appt={detailFor}
          onClose={() => setDetailFor(null)}
          onPatched={patch}
          onAssign={() => { setAssignFor(detailFor); }}
          onCancel={() => { setCancelFor(detailFor); }}
          onResolve={() => { setResolveFor(detailFor); }}
          onReassign={() => { setReassignFor(detailFor); }}
          onApproveCancelReq={() => approveCancelReq(detailFor)}
          onRejectCancelReq={() => rejectCancelReq(detailFor)}
        />
      )}

      {assignFor && (
        <AssignModal
          appointment={assignFor}
          psychologists={psychologists}
          onClose={() => setAssignFor(null)}
          onAssigned={(u) => { patch(u); setAssignFor(null); }}
        />
      )}

      {cancelFor && (
        <AdminCancelModal
          appointment={cancelFor}
          onClose={() => setCancelFor(null)}
          onDone={(u) => { patch(u); setCancelFor(null); }}
        />
      )}

      {resolveFor && (
        <ResolveDisputeModal
          appointment={resolveFor}
          onClose={() => setResolveFor(null)}
          onDone={(u) => { patch(u); setResolveFor(null); }}
        />
      )}

      {reassignFor && (
        <AdminReassignModal
          appointment={reassignFor}
          onClose={() => setReassignFor(null)}
          onDone={(c) => {
            patch({
              ...reassignFor,
              claimedByUserId: c.claimedByUserId,
              claimedByName: c.claimedByName,
              claimedAt: c.claimedAt,
            });
            setReassignFor(null);
          }}
        />
      )}

      {bulkCancelOpen && (
        <BulkCancelModal
          ids={Array.from(selected)}
          onClose={() => setBulkCancelOpen(false)}
          onDone={() => { setBulkCancelOpen(false); setSelectMode(false); setSelected(new Set()); load(); }}
        />
      )}
    </div>
  );
}

/* ─── Detal drawer: tam məlumat + əməliyyatlar + status tarixçəsi ─────────── */

function DetailDrawer({
  appt, onClose, onPatched, onAssign, onCancel, onResolve, onReassign, onApproveCancelReq, onRejectCancelReq,
}: {
  appt: AdminAppt;
  onClose: () => void;
  onPatched: (a: AppointmentDetail) => void;
  onAssign: () => void;
  onCancel: () => void;
  onResolve: () => void;
  onReassign: () => void;
  onApproveCancelReq: () => void;
  onRejectCancelReq: () => void;
}) {
  const [history, setHistory] = useState<AuditLogEntry[] | null>(null);
  const [series, setSeries] = useState<BookingSeries | null>(null);
  const [note, setNote] = useState(appt.operatorNote ?? "");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    adminApi.getAppointmentHistory(appt.id).then(setHistory).catch(() => setHistory([]));
    if (appt.seriesId != null) {
      adminApi.getBookingSeries(appt.seriesId).then(setSeries).catch(() => {});
    }
  }, [appt.id, appt.seriesId]);

  const saveNote = async () => {
    setSavingNote(true);
    try { onPatched(await adminApi.updateAppointmentNote(appt.id, note)); }
    catch (e) { alert((e as Error).message); }
    finally { setSavingNote(false); }
  };

  const seriesCancelPending = series && series.cancelRequestedAt && !series.cancelledAt;
  const approveSeriesCancel = async () => {
    if (!series) return;
    const n = window.prompt("Qeyd (məcburi deyil):", "") ?? undefined;
    try { setSeries(await adminApi.approveSeriesCancelRequest(series.id, n)); }
    catch (e) { alert((e as Error).message); }
  };
  const rejectSeriesCancel = async () => {
    if (!series) return;
    const n = window.prompt("Pasiyentə səbəb yazın:", "") ?? undefined;
    try { setSeries(await adminApi.rejectSeriesCancelRequest(series.id, n)); }
    catch (e) { alert((e as Error).message); }
  };

  const phone = normalizePhone(appt.patientPhone);
  const s = appt.status;
  const canAssign = ["PENDING", "NEW", "REJECTED", "IN_REVIEW", "ASSIGNED"].includes(s);
  const canCancel = !["COMPLETED", "CANCELLED", "CANCEL_REQUESTED"].includes(s);
  const canResolve = s === "DISPUTED";
  const isCancelReq = s === "CANCEL_REQUESTED";
  // Sahiblik dəyişməsi terminal statuslarda mənasızdır (bilet artıq işlənməyəcək).
  const canReassign = !["COMPLETED", "CANCELLED"].includes(s);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,22,51,0.45)", zIndex: 80, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px, 100%)", height: "100%", background: "#fff", boxShadow: "-12px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>#FNS-{String(appt.id).padStart(4, "0")}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
              {appt.patientName ?? "—"}
              <span className="pill ox" style={{ marginLeft: 8 }}>{STATUS_LABEL[s] ?? s}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "var(--muted)" }}>×</button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 20, display: "grid", gap: 14, alignContent: "start" }}>
          {/* Əməliyyat dəsti */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canResolve && <button className="btn danger" onClick={onResolve}>Mübahisəni həll et</button>}
            {isCancelReq && (
              <>
                <button className="btn danger" onClick={onApproveCancelReq}>Ləğvi təsdiqlə</button>
                <button className="btn" onClick={onRejectCancelReq}>Tələbi rədd et</button>
              </>
            )}
            {canAssign && <button className="btn primary" onClick={onAssign}>{s === "ASSIGNED" ? "Yenidən təyin et" : "Təyin et"}</button>}
            {canReassign && <button className="btn" onClick={onReassign}>Operatoru dəyiş</button>}
            {canCancel && !canResolve && <button className="btn danger" onClick={onCancel}>Ləğv et (səbəblə)</button>}
            {phone && <a className="btn" href={`tel:${phone}`}>Zəng et</a>}
            {phone && <a className="btn" href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          </div>

          {/* Əsas məlumat */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12.5 }}>
            <Info label="Telefon" value={appt.patientPhone ?? "—"} />
            <Info label="Email" value={appt.patientEmail ?? "—"} />
            <Info label="Psixoloq" value={appt.psychologistName ?? (appt.requestedPsychologistName ? `(istənilən) ${appt.requestedPsychologistName}` : "—")} />
            <Info label="Təyin edən operator" value={appt.assignedByOperatorName ?? "—"} />
            <Info label="Müraciət sahibi (operator)" value={appt.claimedByName ?? "Sahibsiz"} />
            <Info label="Seans vaxtı" value={appt.startAt ? `${fmtDT(appt.startAt)} – ${appt.endAt ? azFormatTime(appt.endAt) : ""}` : "—"} />
            <Info label="İstənilən vaxt" value={fmtDT(appt.requestedStartAt)} />
            <Info label="Yaradılıb" value={fmtDT(appt.createdAt)} />
            <Info label="Pasiyent bayrağı" value={appt.patientFlag ? (FLAG_LABEL[appt.patientFlag] ?? appt.patientFlag) : "—"} />
          </div>

          {appt.note && (
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, fontSize: 12.5 }}>
              <strong>Mövzu:</strong> «{appt.note}»
            </div>
          )}

          {s === "DISPUTED" && (
            <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: 10, fontSize: 12.5, color: "#991B1B" }}>
              <strong>Mübahisə:</strong>{" "}
              {appt.patientDisputed && appt.psychologistDisputed ? "İkisi də 'olmadı' dedi"
                : appt.patientDisputed ? "Pasient 'olmadı' dedi"
                : appt.psychologistDisputed ? "Psixoloq 'olmadı' dedi" : "Mübahisə açıldı"}
              {appt.disputeReason && <div style={{ marginTop: 4, fontStyle: "italic" }}>«{appt.disputeReason}»</div>}
            </div>
          )}

          {isCancelReq && (
            <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8, padding: 10, fontSize: 12.5, color: "#92400E" }}>
              <strong>Pasient ləğv tələb edib</strong> · {fmtDT(appt.cancelRequestedAt)}
              {appt.cancelRequestReasonCode && <> · kod: <code>{appt.cancelRequestReasonCode}</code></>}
              {appt.cancelRequestReasonText && <div style={{ marginTop: 4, fontStyle: "italic" }}>«{appt.cancelRequestReasonText}»</div>}
            </div>
          )}

          {s === "CANCELLED" && (
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, fontSize: 12.5 }}>
              <strong>Ləğv:</strong> {appt.cancelledBy ?? "—"} · {fmtDT(appt.cancelledAt)}
              {appt.cancelReasonCode && <> · <code>{appt.cancelReasonCode}</code></>}
              {appt.lateCancel && <span className="pill rose" style={{ marginLeft: 6 }}>gec ləğv</span>}
              {appt.cancelReasonText && <div style={{ marginTop: 4, fontStyle: "italic" }}>«{appt.cancelReasonText}»</div>}
            </div>
          )}

          {/* Seriya / qrup */}
          {appt.seriesId != null && (
            <div style={{ background: "var(--ox-50)", border: "1px solid var(--ox-100)", borderRadius: 8, padding: 10, fontSize: 12.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Kurs {(appt.seriesIndex ?? 0) + 1}/{appt.seriesTotal ?? series?.totalCount ?? "?"}</strong>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>seriya #{appt.seriesId}</span>
              </div>
              {series && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                  {series.createdAppointments} seans yaradılıb
                  {series.cancelledAt ? " · seriya ləğv edilib" : ""}
                </div>
              )}
              {seriesCancelPending && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: "#92400E", fontWeight: 600, marginBottom: 6 }}>
                    Seriya üzrə ləğv tələbi gözləyir
                    {series?.cancelRequestReasonText && <span style={{ fontWeight: 400 }}> · «{series.cancelRequestReasonText}»</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn danger" onClick={approveSeriesCancel}>Seriyanın ləğvini təsdiqlə</button>
                    <button className="btn" onClick={rejectSeriesCancel}>Rədd et</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Qeyd */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Operator qeydi</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
            <button className="btn sm" style={{ marginTop: 6 }} onClick={saveNote} disabled={savingNote}>
              {savingNote ? "Saxlanılır…" : "Qeydi saxla"}
            </button>
          </div>

          {/* Status tarixçəsi (audit-log) */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>
              Status tarixçəsi (audit)
            </div>
            {history === null ? (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Yüklənir…</div>
            ) : history.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Bu randevu üçün audit qeydi yoxdur.</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {history.map((h) => (
                  <div key={h.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ color: "var(--ox-800)" }}>{h.action}</strong>
                      <span style={{ color: "var(--muted-2)", whiteSpace: "nowrap" }}>{fmtDT(h.createdAt)}</span>
                    </div>
                    {h.summary && <div style={{ color: "var(--muted)", marginTop: 2 }}>{h.summary}</div>}
                    <div style={{ color: "var(--muted-2)", marginTop: 2, fontSize: 11 }}>
                      {h.actorEmail ?? "sistem"}{h.actorRole ? ` (${h.actorRole})` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 10px" }}>
      <div style={{ fontSize: 10, color: "var(--muted-2)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: "var(--ink)", marginTop: 2, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

/* ─── Təyinat modalı + konflikt konsolu (B4-2) ────────────────────────────── */

function AssignModal({
  appointment, psychologists, onClose, onAssigned,
}: {
  appointment: AdminAppt;
  psychologists: Psychologist[];
  onClose: () => void;
  onAssigned: (a: AppointmentDetail) => void;
}) {
  const [psyId, setPsyId] = useState<number | null>(appointment.requestedPsychologistId ?? appointment.psychologistId ?? null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [note, setNote] = useState(appointment.operatorNote ?? "");
  const [suggestions, setSuggestions] = useState<PsychologistSuggestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [mediateOpen, setMediateOpen] = useState(false);

  useEffect(() => {
    operatorApi.suggest(appointment.id, 3).then(setSuggestions).catch(() => {});
  }, [appointment.id]);

  const reloadSlots = (id: number) => {
    setLoadingSlots(true);
    const today = new Date();
    const to = new Date(); to.setDate(to.getDate() + 21);
    operatorApi.availability(id, isoDateOnly(today), isoDateOnly(to), appointment.sessionKind ?? undefined)
      .then(setSlots).catch(() => setSlots([])).finally(() => setLoadingSlots(false));
  };

  useEffect(() => {
    if (!psyId) { setSlots([]); return; }
    reloadSlots(psyId);
  }, [psyId]);

  const groupedSlots = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const sl of slots) {
      const k = azFormatDate(sl.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(sl);
    }
    return Array.from(map.entries());
  }, [slots]);

  const chosen = (): { startAt: string; endAt: string } | null => {
    if (pickedSlot) {
      const sl = slots.find((x) => x.startAt === pickedSlot);
      if (sl) return { startAt: sl.startAt, endAt: sl.endAt };
    }
    if (manualStart && manualEnd) {
      return { startAt: azLocalToISO(manualStart), endAt: azLocalToISO(manualEnd) };
    }
    return null;
  };

  const submit = async () => {
    setConflict(null);
    if (!psyId) { toast("Psixoloq seçin", "error"); return; }
    const time = chosen();
    if (!time) { toast("Vaxt seçin və ya əl ilə daxil edin", "error"); return; }
    if (new Date(time.startAt) >= new Date(time.endAt)) { toast("Başlama bitişdən əvvəl olmalıdır", "error"); return; }

    setSaving(true);
    try {
      const updated = await adminApi.assignAppointment(appointment.id, {
        psychologistId: psyId, startAt: time.startAt, endAt: time.endAt, operatorNote: note || null,
      });
      onAssigned(updated);
    } catch (e) {
      toast((e as Error).message, "error");
      if (isSlotConflict(e) && psyId) {
        // B4-2: konflikt konsolu — tutan randevunu göstər.
        adminApi.getConflictInfo(psyId, time.startAt, time.endAt)
          .then(setConflict)
          .catch(() => {});
        setPickedSlot(null);
        reloadSlots(psyId);
      }
    } finally {
      setSaving(false);
    }
  };

  const psyName = psychologists.find((p) => p.id === psyId)?.name ?? "";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, width: "min(720px, 100%)", maxHeight: "92vh", overflow: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>#FNS-{String(appointment.id).padStart(4, "0")}</div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: "2px 0 0" }}>Psixoloqa təyin et</h2>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{appointment.patientName ?? "—"}</div>
        </div>

        <div style={{ padding: 20 }}>
          {suggestions.length > 0 && (
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#065F46", marginBottom: 6 }}>Avtomatik təklif</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {suggestions.map((sg) => (
                  <button key={sg.psychologistId} type="button"
                    onClick={() => { setPsyId(sg.psychologistId); setPickedSlot(null); }}
                    style={{
                      padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: psyId === sg.psychologistId ? "2px solid #10B981" : "1px solid #BBF7D0",
                      background: psyId === sg.psychologistId ? "#fff" : "#FAFEFC", color: "#065F46",
                    }}>
                    {sg.name} · {sg.score}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Psixoloq</label>
          <select value={psyId ?? ""} onChange={(e) => { setPsyId(Number(e.target.value) || null); setPickedSlot(null); setConflict(null); }}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--line)", fontSize: 13.5, marginBottom: 14 }}>
            <option value="">— Seç —</option>
            {psychologists.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.title}</option>)}
          </select>

          {psyId && (
            <>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Açıq slotlar (21 gün)</label>
              {loadingSlots ? (
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>Yüklənir…</div>
              ) : groupedSlots.length === 0 ? (
                <div style={{ background: "#FFFBEB", border: "1px solid #FEF3C7", borderRadius: 8, padding: 10, fontSize: 12, color: "#92400E", marginBottom: 12 }}>
                  Açıq slot yoxdur — aşağıda əl ilə vaxt yazın.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8, marginBottom: 12, maxHeight: 200, overflow: "auto" }}>
                  {groupedSlots.map(([day, daySlots]) => (
                    <div key={day}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>{day}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {daySlots.map((sl) => {
                          const active = pickedSlot === sl.startAt;
                          return (
                            <button key={sl.startAt} type="button"
                              onClick={() => { setPickedSlot(active ? null : sl.startAt); setManualStart(""); setManualEnd(""); }}
                              style={{
                                padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                border: active ? "2px solid var(--ox-800)" : "1px solid var(--line)",
                                background: active ? "var(--ox-50)" : "#fff",
                                color: active ? "var(--ox-800)" : "var(--ink)",
                              }}>
                              {azFormatTime(sl.startAt)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <details style={{ marginBottom: 12 }} open={!!manualStart}>
                <summary style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>Əl ilə vaxt daxil et</summary>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <label style={{ display: "block" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Başlama vaxtı</span>
                    <DatePicker withTime theme="light" size="sm" style={{ width: "100%" }}
                      value={manualStart} onChange={(v) => { setManualStart(v); setPickedSlot(null); }} />
                  </label>
                  <label style={{ display: "block" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Bitmə vaxtı</span>
                    <DatePicker withTime theme="light" size="sm" style={{ width: "100%" }}
                      value={manualEnd} onChange={(v) => { setManualEnd(v); setPickedSlot(null); }} />
                  </label>
                </div>
              </details>
            </>
          )}

          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Operator qeydi (məcburi deyil)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, marginBottom: 12, fontFamily: "inherit", boxSizing: "border-box" }} />

          {/* ─── Konflikt konsolu (B4-2) ──────────────────────────────────── */}
          {conflict && (
            <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#9A3412", marginBottom: 6 }}>
                Bu vaxtı tutan randevu
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink)" }}>
                <strong>#{conflict.appointmentId}</strong> · {conflict.patientName ?? "—"}
                {conflict.patientPhone && <> · {conflict.patientPhone}</>}
                <span className="pill ox" style={{ marginLeft: 6 }}>{STATUS_LABEL[conflict.status] ?? conflict.status}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {fmtDT(conflict.startAt)} – {conflict.endAt ? azFormatTime(conflict.endAt) : ""}
                {conflict.rescheduleCount > 0 && <> · {conflict.rescheduleCount} dəfə vaxt dəyişib</>}
              </div>
              {conflict.seriesId != null && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#9A3412", fontWeight: 600 }}>
                  Bu seans {conflict.seriesTotal ?? "?"} seanslıq kursun parçasıdır
                  (Kurs {(conflict.seriesIndex ?? 0) + 1}/{conflict.seriesTotal ?? "?"}) — tərpətmək ritmi pozar.
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {normalizePhone(conflict.patientPhone) && (
                  <>
                    <a className="btn sm" href={`tel:${normalizePhone(conflict.patientPhone)}`}>Zəng et</a>
                    <a className="btn sm" href={whatsappLink(normalizePhone(conflict.patientPhone)!)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                  </>
                )}
                {conflict.hasPendingProposal ? (
                  <span className="pill gold">Bu randevu üçün artıq gözləyən təklif var</span>
                ) : (
                  <button className="btn sm primary" onClick={() => setMediateOpen(true)}>
                    Vasitəçili vaxt-dəyişmə təklifi göndər
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose}>Bağla</button>
            <button className="btn primary" onClick={submit} disabled={saving}>
              {saving ? "Saxlanılır…" : "Təyin et"}
            </button>
          </div>
        </div>
      </div>

      {mediateOpen && conflict && psyId && (
        <MediateModal
          conflict={conflict}
          psychologistName={psyName}
          waitingAppointmentId={appointment.id}
          onClose={() => setMediateOpen(false)}
          onSent={() => {
            setMediateOpen(false);
            setConflict({ ...conflict, hasPendingProposal: true });
          }}
        />
      )}
    </div>
  );
}

/* ─── Vasitəçili təklif modalı (B4-2 komponenti) ──────────────────────────── */

function MediateModal({
  conflict, psychologistName, waitingAppointmentId, onClose, onSent,
}: {
  conflict: ConflictInfo;
  psychologistName: string;
  waitingAppointmentId: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const [options, setOptions] = useState<{ start: string; end: string }[]>([{ start: "", end: "" }]);
  const [reason, setReason] = useState("");
  const [withSwap, setWithSwap] = useState(true);
  const [saving, setSaving] = useState(false);

  const setOpt = (i: number, field: "start" | "end", v: string) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, [field]: v } : o)));
  };

  const submit = async () => {
    const filled = options.filter((o) => o.start && o.end);
    if (filled.length === 0) { toast("Ən azı 1 alternativ vaxt daxil edin", "error"); return; }
    for (const o of filled) {
      if (new Date(azLocalToISO(o.start)) >= new Date(azLocalToISO(o.end))) {
        toast("Hər variantda başlama bitişdən əvvəl olmalıdır", "error"); return;
      }
    }
    setSaving(true);
    try {
      await adminApi.mediateReschedule(conflict.appointmentId, {
        options: filled.map((o) => ({ startAt: azLocalToISO(o.start), endAt: azLocalToISO(o.end) })),
        reason: reason.trim() || null,
        swapTargetAppointmentId: withSwap ? waitingAppointmentId : null,
      });
      onSent();
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  };

  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.55)", zIndex: 95, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, width: "min(540px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Vasitəçili vaxt-dəyişmə təklifi</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {conflict.patientName ?? "Tutan pasiyent"} ({psychologistName}) üçün 1–3 alternativ saat.
            Qəbul edərsə, boşalan slot avtomatik #{waitingAppointmentId} müraciətinə bağlanır.
            Məcburi dəyişdirmə yoxdur — yalnız təklif.
          </p>
        </div>
        <div style={{ padding: 20 }}>
          {options.map((o, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
              <DatePicker withTime theme="light" size="sm" value={o.start} onChange={(v) => setOpt(i, "start", v)} />
              <DatePicker withTime theme="light" size="sm" value={o.end} onChange={(v) => setOpt(i, "end", v)} />
              {options.length > 1 ? (
                <button className="btn sm" onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}>×</button>
              ) : <span />}
            </div>
          ))}
          {options.length < 3 && (
            <button className="btn sm" style={{ marginBottom: 12 }} onClick={() => setOptions((prev) => [...prev, { start: "", end: "" }])}>
              + Variant əlavə et
            </button>
          )}

          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Səbəb qeydi (pasiyentə göstərilir)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
            placeholder="Niyə vaxt dəyişikliyi xahiş edirik — qısa izah"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }} />

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink)", marginBottom: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={withSwap} onChange={(e) => setWithSwap(e.target.checked)} />
            Qəbul olunarsa boşalan slotu #{waitingAppointmentId} müraciətinə avtomatik təyin et (atomik svop)
          </label>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose}>Bağla</button>
            <button className="btn primary" onClick={submit} disabled={saving}>
              {saving ? "Göndərilir…" : "Təklifi göndər"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Admin ləğv modalı (səbəblə) ─────────────────────────────────────────── */

function AdminCancelModal({
  appointment, onClose, onDone,
}: {
  appointment: AdminAppt;
  onClose: () => void;
  onDone: (a: AppointmentDetail) => void;
}) {
  const [reason, setReason] = useState(OPERATOR_REASONS[0].code);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try { onDone(await adminApi.cancelAppointment(appointment.id, reason, note.trim() || undefined)); }
    catch (e) { toast((e as Error).message, "error"); setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(460px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Randevunu ləğv et</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>#{appointment.id} · {appointment.patientName ?? "—"}</p>
        </div>
        <div style={{ padding: 20 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Səbəb</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, marginBottom: 12 }}>
            {OPERATOR_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Qeyd (məcburi deyil)"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose}>Bağla</button>
            <button className="btn danger" onClick={submit} disabled={saving}>{saving ? "Göndərilir…" : "Ləğv et"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Toplu ləğv modalı ───────────────────────────────────────────────────── */

function BulkCancelModal({
  ids, onClose, onDone,
}: {
  ids: number[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState(OPERATOR_REASONS[0].code);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ cancelled: number[]; failed: Record<string, string> } | null>(null);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await adminApi.bulkCancelAppointments(ids, reason, note.trim() || undefined);
      setResult(res);
      if (Object.keys(res.failed).length === 0) onDone();
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(480px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Toplu ləğv</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {ids.length} randevu ləğv olunacaq. Hər biri ayrıca audit qeydi alır.
          </p>
        </div>
        <div style={{ padding: 20 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Səbəb</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, marginBottom: 12 }}>
            {OPERATOR_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Qeyd (məcburi deyil)"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }} />

          {result && Object.keys(result.failed).length > 0 && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: 10, fontSize: 12, color: "#92400E", marginBottom: 10 }}>
              <strong>{result.cancelled.length} uğurlu, {Object.keys(result.failed).length} uğursuz:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {Object.entries(result.failed).map(([id, msg]) => (
                  <li key={id}>#{id}: {msg}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={result ? onDone : onClose}>{result ? "Bağla" : "İmtina"}</button>
            {!result && (
              <button className="btn danger" onClick={submit} disabled={saving}>
                {saving ? "Göndərilir…" : `${ids.length} randevunu ləğv et`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Mübahisə həlli modalı ───────────────────────────────────────────────── */

function ResolveDisputeModal({
  appointment, onClose, onDone,
}: {
  appointment: AdminAppt;
  onClose: () => void;
  onDone: (a: AppointmentDetail) => void;
}) {
  const [decision, setDecision] = useState<"COMPLETE" | "CANCEL">("COMPLETE");
  const [blameSide, setBlameSide] = useState<"PATIENT" | "PSYCHOLOGIST" | "NONE">("NONE");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const blame = decision === "CANCEL" && blameSide !== "NONE" ? blameSide : undefined;
      onDone(await adminApi.resolveAppointmentDispute(appointment.id, decision, note.trim() || undefined, blame));
    } catch (e) { toast((e as Error).message, "error"); setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(520px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Mübahisəni həll et</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {appointment.patientName ?? "—"} — {appointment.psychologistName ?? "—"}
          </p>
          {appointment.disputeReason && (
            <div style={{ fontSize: 12, color: "#991B1B", marginTop: 6, padding: "7px 10px", background: "#FEE2E2", borderRadius: 8 }}>
              «{appointment.disputeReason}»
            </div>
          )}
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={() => setDecision("COMPLETE")}
              style={{
                padding: 12, borderRadius: 10, fontSize: 13, cursor: "pointer", textAlign: "left",
                border: decision === "COMPLETE" ? "2px solid #10B981" : "1px solid var(--line)",
                background: decision === "COMPLETE" ? "#D1FAE5" : "#fff",
                color: decision === "COMPLETE" ? "#065F46" : "var(--ink)",
              }}>
              <div style={{ fontWeight: 700 }}>Tamamlanmış say</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>Seans baş tutdu</div>
            </button>
            <button type="button" onClick={() => setDecision("CANCEL")}
              style={{
                padding: 12, borderRadius: 10, fontSize: 13, cursor: "pointer", textAlign: "left",
                border: decision === "CANCEL" ? "2px solid #DC2626" : "1px solid var(--line)",
                background: decision === "CANCEL" ? "#FEE2E2" : "#fff",
                color: decision === "CANCEL" ? "#991B1B" : "var(--ink)",
              }}>
              <div style={{ fontWeight: 700 }}>Ləğv et</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>Seans baş tutmadı</div>
            </button>
          </div>

          {decision === "CANCEL" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
              {([
                { v: "NONE", label: "Heç kim" },
                { v: "PATIENT", label: "Pasient" },
                { v: "PSYCHOLOGIST", label: "Psixoloq" },
              ] as const).map((o) => (
                <button key={o.v} type="button" onClick={() => setBlameSide(o.v)}
                  style={{
                    padding: 9, borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                    border: blameSide === o.v ? "2px solid var(--ox-800)" : "1px solid var(--line)",
                    background: blameSide === o.v ? "var(--ox-50)" : "#fff",
                    color: blameSide === o.v ? "var(--ox-800)" : "var(--ink)",
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          )}

          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Həll qeydi (məcburi deyil)"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }} />

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose}>Bağla</button>
            <button className={`btn ${decision === "COMPLETE" ? "primary" : "danger"}`} onClick={submit} disabled={saving}>
              {saving ? "Göndərilir…" : decision === "COMPLETE" ? "Tamamlanmış say" : "Ləğv et"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Admin: müraciət sahibliyini başqa operatora keçir (reassign) ─────────── */

function AdminReassignModal({
  appointment, onClose, onDone,
}: {
  appointment: AdminAppt;
  onClose: () => void;
  onDone: (c: ClaimState) => void;
}) {
  const [operators, setOperators] = useState<{ id: number; name: string }[]>([]);
  const [opId, setOpId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    operatorApi.listOperators().then(setOperators).catch(() => {});
  }, []);

  const submit = async () => {
    if (!opId) { toast("Operator seçin", "error"); return; }
    setSaving(true);
    try { onDone(await operatorApi.reassignAppointment(appointment.id, opId)); }
    catch (e) { toast((e as Error).message, "error"); setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(440px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Operatoru dəyiş</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            #FNS-{String(appointment.id).padStart(4, "0")} · {appointment.patientName ?? "—"}
            {appointment.claimedByName
              ? <> · hazırkı sahib: <strong>{appointment.claimedByName}</strong></>
              : <> · hazırda sahibsizdir</>}
          </p>
        </div>
        <div style={{ padding: 20 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Yeni sahib</label>
          <select value={opId ?? ""} onChange={(e) => setOpId(Number(e.target.value) || null)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, marginBottom: 12 }}>
            <option value="">— Operator seçin —</option>
            {operators.filter((o) => o.id !== appointment.claimedByUserId).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
            Keçid qeyd-şərtsizdir: əvvəlki sahibə bildiriş gedir, əməliyyat audit-loqa yazılır.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose}>Bağla</button>
            <button className="btn primary" onClick={submit} disabled={saving}>
              {saving ? "Göndərilir…" : "Sahibliyi keçir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
