"use client";

import { useEffect, useMemo, useState } from "react";
import {
  operatorApi,
  type AppointmentDetail,
  type AvailableSlot,
  type ContactLog,
  type PatientHistory,
  type Psychologist,
  type PsychologistSuggestion,
} from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";

type Tab = "PENDING" | "ASSIGNED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

const TAB_META: Record<Tab, { label: string; color: string }> = {
  PENDING:   { label: "Yeni müraciətlər",  color: "#92400E" },
  ASSIGNED:  { label: "Təyin edilmiş",     color: "#1E40AF" },
  CONFIRMED: { label: "Təsdiqlənmiş",      color: "#065F46" },
  COMPLETED: { label: "Tamamlanmış",       color: "#374151" },
  CANCELLED: { label: "Ləğv olunmuş",      color: "#991B1B" },
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtDay(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function isoDateOnly(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toDateTimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OperatorAppointmentsPage() {
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("PENDING");
  const [search, setSearch] = useState("");
  const [assignFor, setAssignFor] = useState<AppointmentDetail | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = () => {
    setLoading(true);
    operatorApi.listAppointments()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Live refresh on any appointment-related notification (new, assigned, etc.)
  useEffect(() => {
    return subscribeNotifications((n) => {
      if (typeof n.type === "string" && n.type.startsWith("APPOINTMENT_")) load();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(a => {
      if (tab === "PENDING" && !(a.status === "PENDING" || a.status === "REJECTED")) return false;
      if (tab !== "PENDING" && a.status !== tab) return false;
      if (!q) return true;
      const hay = `${a.id} ${a.patientName ?? ""} ${a.psychologistName ?? ""} ${a.requestedPsychologistName ?? ""} ${a.note ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, tab, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { PENDING: 0, ASSIGNED: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const a of items) {
      if (a.status === "PENDING" || a.status === "REJECTED") c.PENDING++;
      else if (c[a.status] !== undefined) c[a.status]++;
    }
    return c;
  }, [items]);

  const onAssigned = (updated: AppointmentDetail) => {
    setItems(prev => prev.map(a => a.id === updated.id ? updated : a));
    setAssignFor(null);
  };

  const onCancel = async (id: number) => {
    const note = prompt("Ləğv səbəbini qeyd edin (məcburi deyil):") ?? undefined;
    try {
      const updated = await operatorApi.cancel(id, note);
      setItems(prev => prev.map(a => a.id === id ? updated : a));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const toggleSelected = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onBulkDone = (updated: AppointmentDetail[]) => {
    const map = new Map(updated.map(a => [a.id, a] as const));
    setItems(prev => prev.map(a => map.get(a.id) ?? a));
    setBulkOpen(false); setSelectMode(false); setSelected(new Set());
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]">Randevular</h1>
          <p className="text-[#52718F] text-sm mt-1">Müraciətləri psixoloqlara təyin edin və status izləyin</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setSelectMode(s => !s); setSelected(new Set()); }}
            className="px-4 py-2 text-sm rounded-xl border border-[#E5E7EB] bg-white text-[#1A2535]">
            {selectMode ? "Seçimi ləğv et" : "Çoxlu seçim"}
          </button>
          <button onClick={load} className="px-4 py-2 text-sm rounded-xl border border-[#E5E7EB] bg-white text-[#1A2535]">
            Yenilə
          </button>
        </div>
      </div>

      {selectMode && selected.size > 0 && (
        <div style={{ background: "linear-gradient(135deg,#002147,#5A4FC8)", color: "#fff", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {selected.size} müraciət seçilib
          </div>
          <button onClick={() => setBulkOpen(true)}
            style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: "#fff", color: "#1A2535", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Toplu təyin et →
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {(Object.keys(TAB_META) as Tab[]).map(t => {
          const meta = TAB_META[t];
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: active ? `2px solid ${meta.color}` : "1px solid #E5E7EB",
                background: active ? "#fff" : "rgba(255,255,255,0.6)",
                color: active ? meta.color : "#52718F",
                cursor: "pointer",
              }}
            >
              {meta.label}
              <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>{counts[t] ?? 0}</span>
            </button>
          );
        })}
        <input
          type="text"
          placeholder="Axtar (ad, psixoloq, qeyd…)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", background: "#fff", marginLeft: "auto", minWidth: 280 }}
        />
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "3rem", textAlign: "center", color: "#52718F" }}>
          Bu kateqoriyada müraciət yoxdur.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map(a => (
            <AppointmentCard
              key={a.id}
              a={a}
              selectable={selectMode}
              selected={selected.has(a.id)}
              onToggleSelect={() => toggleSelected(a.id)}
              onAssign={() => setAssignFor(a)}
              onCancel={() => onCancel(a.id)} />
          ))}
        </div>
      )}

      {assignFor && (
        <AssignModal
          appointment={assignFor}
          onClose={() => setAssignFor(null)}
          onAssigned={onAssigned}
        />
      )}

      {bulkOpen && (
        <BulkAssignModal
          ids={Array.from(selected)}
          onClose={() => setBulkOpen(false)}
          onDone={onBulkDone}
        />
      )}
    </div>
  );
}

function AppointmentCard({
  a, selectable, selected, onToggleSelect, onAssign, onCancel,
}: {
  a: AppointmentDetail;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onAssign: () => void;
  onCancel: () => void;
}) {
  const status = a.status;
  const canAssign = status === "PENDING" || status === "REJECTED" || status === "ASSIGNED";
  const canCancel = status !== "COMPLETED" && status !== "CANCELLED";
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: selected ? "2px solid #5A4FC8" : "1px solid transparent" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        {selectable && (
          <input type="checkbox" checked={!!selected} onChange={onToggleSelect}
            style={{ width: 18, height: 18, marginTop: 4, cursor: "pointer" }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: "#52718F" }}>#FNS-{String(a.id).padStart(4, "0")}</div>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#EEF2F7", color: "#374151" }}>
              {status}
            </span>
            {a.sessionFormat && (
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#EEF2F7", color: "#52718F" }}>
                {a.sessionFormat === "ONLINE" ? "💻 Online" : "🏢 Üzbəüz"}
              </span>
            )}
          </div>
          <div style={{ fontWeight: 600, color: "#1A2535", fontSize: 15 }}>
            {a.patientName ?? "—"}
            {a.patientPhone && <span style={{ color: "#52718F", fontSize: 12, fontWeight: 400, marginLeft: 8 }}>{a.patientPhone}</span>}
          </div>
          <div style={{ fontSize: 13, color: "#52718F", marginTop: 2 }}>
            {a.psychologistName
              ? <>Təyin: <strong>{a.psychologistName}</strong> · {fmtDateTime(a.startAt)}</>
              : a.requestedPsychologistName
                ? <>İstənilən: <em>{a.requestedPsychologistName}</em>{a.requestedStartAt ? `, ${fmtDateTime(a.requestedStartAt)}` : ""}</>
                : <em>Psixoloq seçilməyib — operator təyin edəcək</em>}
          </div>
          {a.note && <div style={{ fontSize: 13, color: "#374151", marginTop: 8, padding: "8px 12px", background: "#F9FAFB", borderRadius: 8 }}>«{a.note}»</div>}
          {a.operatorNote && <div style={{ fontSize: 12, color: "#52718F", marginTop: 6 }}><strong>Qeyd:</strong> {a.operatorNote}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {canAssign && (
            <button
              onClick={onAssign}
              style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg,#002147,#5A4FC8)", border: "none", borderRadius: 8, cursor: "pointer" }}>
              {status === "ASSIGNED" ? "Yenidən təyin et" : "Təyin et"}
            </button>
          )}
          {canCancel && (
            <button
              onClick={onCancel}
              style={{ padding: "6px 12px", fontSize: 12, color: "#991B1B", background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 8, cursor: "pointer" }}>
              Ləğv et
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AssignModal({
  appointment, onClose, onAssigned,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onAssigned: (a: AppointmentDetail) => void;
}) {
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [psyId, setPsyId] = useState<number | null>(appointment.requestedPsychologistId ?? null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  // If the operator opens the modal with a psychologist already chosen,
  // assume slots are about to load — avoids the auto-prefill effect from
  // running before the fetch starts and falsely triggering the manual-time fallback.
  const [loadingSlots, setLoadingSlots] = useState(appointment.requestedPsychologistId != null);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null); // ISO startAt
  const [manualStart, setManualStart] = useState<string>("");
  const [manualEnd, setManualEnd] = useState<string>("");
  const [sessionFormat, setSessionFormat] = useState<"ONLINE" | "IN_PERSON">(
    (appointment.sessionFormat as "ONLINE" | "IN_PERSON") ?? "ONLINE"
  );
  const [note, setNote] = useState(appointment.operatorNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Suggestions + history + contact log
  const [suggestions, setSuggestions] = useState<PsychologistSuggestion[]>([]);
  const [history, setHistory] = useState<PatientHistory | null>(null);
  const [contactLogs, setContactLogs] = useState<ContactLog[]>([]);
  const [logChannel, setLogChannel] = useState<"CALL" | "SMS" | "EMAIL" | "WHATSAPP" | "OTHER">("CALL");
  const [logOutcome, setLogOutcome] = useState<"ANSWERED" | "NO_ANSWER" | "BUSY" | "REFUSED" | "RESCHEDULED" | "OTHER">("NO_ANSWER");
  const [logNote, setLogNote] = useState("");
  const [savingLog, setSavingLog] = useState(false);

  useEffect(() => {
    operatorApi.listPsychologists().then(setPsychologists).catch(() => {});
    operatorApi.suggest(appointment.id, 5).then(setSuggestions).catch(() => {});
    if (appointment.patientId) {
      operatorApi.patientHistory(appointment.patientId).then(setHistory).catch(() => {});
    }
    operatorApi.contactLogs(appointment.id).then(setContactLogs).catch(() => {});
  }, [appointment.id, appointment.patientId]);

  const addContactLog = async () => {
    setSavingLog(true);
    try {
      const created = await operatorApi.addContactLog(appointment.id, {
        channel: logChannel, outcome: logOutcome, note: logNote.trim() || undefined,
      });
      setContactLogs(prev => [created, ...prev]);
      setLogNote("");
    } catch (e) { alert((e as Error).message); }
    finally { setSavingLog(false); }
  };

  const blockOrUnblock = async () => {
    if (!history?.userId) return;
    try {
      if (history.blocked) {
        if (!confirm("Bu istifadəçinin blokunu açmaq istəyirsiniz?")) return;
        await operatorApi.unblockUser(history.userId);
        setHistory({ ...history, blocked: false, blockReason: null });
      } else {
        const reason = prompt("Bloklama səbəbi (məcburi deyil):") ?? "";
        await operatorApi.blockUser(history.userId, reason);
        setHistory({ ...history, blocked: true, blockReason: reason });
      }
    } catch (e) { alert((e as Error).message); }
  };

  const applySuggestion = (s: PsychologistSuggestion) => {
    setPsyId(s.psychologistId);
    setPickedSlot(null);
    setManualStart(""); setManualEnd("");
  };

  useEffect(() => {
    if (!psyId) { setSlots([]); return; }
    setLoadingSlots(true);
    const today = new Date();
    const to = new Date(); to.setDate(to.getDate() + 21);
    operatorApi.availability(psyId, isoDateOnly(today), isoDateOnly(to))
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [psyId]);

  // Auto-prefill the time the patient requested when slots load.
  // If the requested time matches an available slot — pick it. Otherwise
  // pre-fill the manual fields using the psychologist's session length.
  useEffect(() => {
    const requested = appointment.requestedStartAt;
    if (!requested || !psyId || loadingSlots) return;
    if (pickedSlot || manualStart) return; // operator already chose
    // Don't run before slots have actually loaded — the fetch may still be in-flight
    // for a brief moment when loadingSlots flips false-true-false. Wait until we
    // have a non-empty array OR confirmed empty after fetch completed.
    if (slots.length === 0) {
      // Empty slot list AFTER load means psychologist has no openings — only then
      // fall back to manual time. Use a microtask/effect re-run guard.
      const psy = psychologists.find(p => p.id === psyId);
      const minutes = psy?.defaultSessionMinutes && psy.defaultSessionMinutes > 0
        ? psy.defaultSessionMinutes : 50;
      const reqMs = new Date(requested).getTime();
      const end = new Date(reqMs + minutes * 60_000);
      setManualStart(toDateTimeLocal(requested));
      setManualEnd(toDateTimeLocal(end.toISOString()));
      return;
    }
    const reqMs = new Date(requested).getTime();
    const match = slots.find(s => new Date(s.startAt).getTime() === reqMs);
    if (match) {
      setPickedSlot(match.startAt);
      return;
    }
    const psy = psychologists.find(p => p.id === psyId);
    const minutes = psy?.defaultSessionMinutes && psy.defaultSessionMinutes > 0
      ? psy.defaultSessionMinutes : 50;
    const end = new Date(reqMs + minutes * 60_000);
    setManualStart(toDateTimeLocal(requested));
    setManualEnd(toDateTimeLocal(end.toISOString()));
  }, [slots, loadingSlots, psyId, psychologists, appointment.requestedStartAt, pickedSlot, manualStart]);

  const groupedSlots = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = fmtDay(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  const submit = async () => {
    setError(null);
    if (!psyId) { setError("Psixoloq seçin"); return; }

    let startAt: string | null = pickedSlot;
    let endAt: string | null = null;
    if (startAt) {
      const slot = slots.find(s => s.startAt === startAt);
      if (slot) endAt = slot.endAt;
    } else if (manualStart && manualEnd) {
      startAt = new Date(manualStart).toISOString();
      endAt = new Date(manualEnd).toISOString();
    }
    if (!startAt || !endAt) { setError("Vaxt seçin və ya əl ilə daxil edin"); return; }
    if (new Date(startAt) >= new Date(endAt)) { setError("Başlama vaxtı bitiş vaxtından əvvəl olmalıdır"); return; }

    setSaving(true);
    try {
      const updated = await operatorApi.assign(appointment.id, {
        psychologistId: psyId, startAt, endAt, sessionFormat, operatorNote: note || null,
      });
      onAssigned(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(1100px, 100%)", maxHeight: "92vh", overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #EFF2F7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#52718F" }}>#FNS-{String(appointment.id).padStart(4, "0")}</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A2535", margin: "2px 0 0" }}>Müraciəti psixoloqa təyin et</h2>
            <div style={{ fontSize: 13, color: "#52718F", marginTop: 4 }}>
              <strong>{appointment.patientName ?? "—"}</strong> · {appointment.note?.slice(0, 80)}
              {(appointment.note?.length ?? 0) > 80 ? "…" : ""}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#52718F" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: history ? "300px 1fr" : "1fr", overflow: "auto", flex: 1 }}>

        {/* History sidebar */}
        {history && (
          <aside style={{ borderRight: "1px solid #EFF2F7", padding: 16, background: "#FAFCFF" }}>
            <div style={{ fontSize: 11, color: "#52718F", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Müştəri tarixçəsi</div>
            <div style={{ background: "#fff", borderRadius: 10, padding: 12, marginBottom: 10, border: history.blocked ? "1px solid #FECACA" : "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1A2535" }}>{history.name}</div>
              <div style={{ fontSize: 12, color: "#52718F", marginTop: 2 }}>{history.email}</div>
              <div style={{ fontSize: 12, color: "#52718F" }}>{history.phone ?? ""}</div>
              {history.blocked && (
                <div style={{ marginTop: 6, padding: "4px 8px", background: "#FEE2E2", color: "#991B1B", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                  🚫 BLOKLU — {history.blockReason || "səbəb yoxdur"}
                </div>
              )}
              {history.userId && (
                <button onClick={blockOrUnblock}
                  style={{ marginTop: 8, width: "100%", padding: "6px 10px", border: history.blocked ? "1px solid #C7D2FE" : "1px solid #FECACA", background: "#fff", color: history.blocked ? "#3730A3" : "#991B1B", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {history.blocked ? "Bloku aç" : "Blokla / spam"}
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
              <Mini label="Cəmi" value={history.totalAppointments} color="#1E3A5F" />
              <Mini label="Rədd" value={history.rejectedCount} color="#92400E" />
              <Mini label="Ləğv" value={history.cancelledCount} color="#991B1B" />
            </div>

            <div style={{ fontSize: 11, color: "#52718F", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Son müraciətlər</div>
            <div style={{ display: "grid", gap: 4 }}>
              {history.recent.length === 0 ? (
                <div style={{ fontSize: 12, color: "#8AAABF" }}>Yoxdur</div>
              ) : history.recent.map(r => (
                <div key={r.id} style={{ background: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 11, border: "1px solid #EFF2F7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600 }}>#{r.id}</span>
                    <span style={{ color: "#52718F" }}>{r.status}</span>
                  </div>
                  <div style={{ color: "#52718F", marginTop: 2 }}>{r.psychologistName ?? "—"}</div>
                </div>
              ))}
            </div>

            {/* Contact log */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "#52718F", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Əlaqə logu</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6 }}>
                <select value={logChannel} onChange={e => setLogChannel(e.target.value as "CALL" | "SMS" | "EMAIL" | "WHATSAPP" | "OTHER")}
                  style={{ padding: 6, fontSize: 11, borderRadius: 6, border: "1px solid #E5E7EB" }}>
                  <option value="CALL">📞 Zəng</option>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="OTHER">Digər</option>
                </select>
                <select value={logOutcome} onChange={e => setLogOutcome(e.target.value as "ANSWERED" | "NO_ANSWER" | "BUSY" | "REFUSED" | "RESCHEDULED" | "OTHER")}
                  style={{ padding: 6, fontSize: 11, borderRadius: 6, border: "1px solid #E5E7EB" }}>
                  <option value="NO_ANSWER">Cavab yox</option>
                  <option value="ANSWERED">Cavabladı</option>
                  <option value="BUSY">Məşğul</option>
                  <option value="REFUSED">İmtina etdi</option>
                  <option value="RESCHEDULED">Yenidən planladı</option>
                  <option value="OTHER">Digər</option>
                </select>
              </div>
              <input value={logNote} onChange={e => setLogNote(e.target.value)} placeholder="Qeyd"
                style={{ width: "100%", padding: 6, fontSize: 11, borderRadius: 6, border: "1px solid #E5E7EB", marginBottom: 6 }} />
              <button onClick={addContactLog} disabled={savingLog}
                style={{ width: "100%", padding: "6px 10px", border: "none", borderRadius: 6, background: "#1A2535", color: "#fff", fontSize: 11, fontWeight: 600, cursor: savingLog ? "wait" : "pointer" }}>
                {savingLog ? "Əlavə edilir…" : "+ Log əlavə et"}
              </button>
              {contactLogs.length > 0 && (
                <div style={{ marginTop: 8, display: "grid", gap: 4, maxHeight: 120, overflow: "auto" }}>
                  {contactLogs.map(l => (
                    <div key={l.id} style={{ background: "#fff", padding: "4px 6px", borderRadius: 4, fontSize: 10, border: "1px solid #EFF2F7" }}>
                      <strong>{l.channel}</strong> · {l.outcome}
                      {l.note && <div style={{ color: "#52718F" }}>{l.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        <div style={{ padding: 24 }}>
          {suggestions.length > 0 && (
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#065F46", marginBottom: 8 }}>🤖 Avtomatik təklif (top {suggestions.length})</div>
              <div style={{ display: "grid", gap: 6 }}>
                {suggestions.slice(0, 3).map(s => (
                  <button key={s.psychologistId} type="button" onClick={() => applySuggestion(s)}
                    style={{
                      textAlign: "left", padding: "8px 12px", borderRadius: 8,
                      border: psyId === s.psychologistId ? "2px solid #10B981" : "1px solid #BBF7D0",
                      background: psyId === s.psychologistId ? "#fff" : "#FAFEFC",
                      cursor: "pointer",
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1A2535" }}>{s.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#065F46" }}>skor {s.score}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#52718F", marginTop: 2 }}>
                      {s.reasons.join(" · ")}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Psixoloq</label>
          <select value={psyId ?? ""} onChange={e => { setPsyId(Number(e.target.value) || null); setPickedSlot(null); }}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, marginBottom: 16 }}>
            <option value="">— Seç —</option>
            {psychologists.map(p => (
              <option key={p.id} value={p.id}>{p.name} · {p.title}</option>
            ))}
          </select>

          {appointment.requestedStartAt && (
            <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#3730A3", marginBottom: 12 }}>
              <strong>Müştərinin istədiyi vaxt:</strong> {fmtDateTime(appointment.requestedStartAt)} — avtomatik seçildi, lazım gələrsə dəyişin.
            </div>
          )}

          {psyId && (
            <>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Açıq vaxtlar</label>
              {loadingSlots ? (
                <div style={{ fontSize: 13, color: "#52718F", marginBottom: 16 }}>Yüklənir…</div>
              ) : groupedSlots.length === 0 ? (
                <div style={{ background: "#FFFBEB", border: "1px solid #FEF3C7", borderRadius: 8, padding: 12, fontSize: 12, color: "#92400E", marginBottom: 16 }}>
                  Açıq slot yoxdur. Aşağıda əl ilə vaxt yazın.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10, marginBottom: 16, maxHeight: 220, overflow: "auto" }}>
                  {groupedSlots.map(([day, daySlots]) => {
                    const requestedMs = appointment.requestedStartAt
                      ? new Date(appointment.requestedStartAt).getTime() : null;
                    const pickedMs = pickedSlot ? new Date(pickedSlot).getTime() : null;
                    return (
                    <div key={day}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#52718F", textTransform: "uppercase", marginBottom: 4 }}>{day}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {daySlots.map(s => {
                          const slotMs = new Date(s.startAt).getTime();
                          const active = pickedMs !== null && slotMs === pickedMs;
                          const isRequested = requestedMs !== null && slotMs === requestedMs;
                          let border = "1px solid #E5E7EB";
                          let bg = "#fff";
                          let color = "#1A2535";
                          if (active) { border = "2px solid #5A4FC8"; bg = "#EEECFB"; color = "#5A4FC8"; }
                          else if (isRequested) { border = "2px solid #10B981"; bg = "#ECFDF5"; color = "#065F46"; }
                          return (
                            <button
                              key={s.startAt}
                              type="button"
                              title={isRequested ? "Müştərinin istədiyi vaxt" : undefined}
                              onClick={() => { setPickedSlot(active ? null : s.startAt); setManualStart(""); setManualEnd(""); }}
                              style={{
                                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                border, background: bg, color,
                                cursor: "pointer",
                                position: "relative",
                              }}>
                              {fmtTime(s.startAt)}
                              {isRequested && !active && (
                                <span style={{ marginLeft: 4, fontSize: 9 }}>★</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              <details style={{ marginBottom: 16 }} open={!!manualStart}>
                <summary style={{ fontSize: 12, color: "#52718F", cursor: "pointer" }}>Əl ilə vaxt daxil et</summary>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                  <input type="datetime-local" value={manualStart} onChange={e => { setManualStart(e.target.value); setPickedSlot(null); }}
                    style={{ padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
                  <input type="datetime-local" value={manualEnd} onChange={e => { setManualEnd(e.target.value); setPickedSlot(null); }}
                    style={{ padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
                </div>
              </details>
            </>
          )}

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Format</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["ONLINE", "IN_PERSON"] as const).map(f => (
              <button
                type="button" key={f}
                onClick={() => setSessionFormat(f)}
                style={{
                  flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 600,
                  border: sessionFormat === f ? "2px solid #5A4FC8" : "1px solid #E5E7EB",
                  background: sessionFormat === f ? "#EEECFB" : "#fff", cursor: "pointer", color: "#1A2535",
                }}>
                {f === "ONLINE" ? "💻 Online" : "🏢 Üzbəüz"}
              </button>
            ))}
          </div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Operator qeydi (məcburi deyil)</label>
          <textarea
            value={note} onChange={e => setNote(e.target.value)} rows={3}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 16, fontFamily: "inherit" }}
          />

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "10px 18px", border: "1px solid #E5E7EB", background: "#fff", borderRadius: 10, fontSize: 13, color: "#1A2535", cursor: "pointer" }}>
              Ləğv et
            </button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "10px 22px", border: "none", background: "linear-gradient(135deg,#002147,#5A4FC8)", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saxlanılır…" : "Təsdiqlə və göndər"}
            </button>
          </div>
        </div>

        </div>{/* end grid */}
      </div>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 6, padding: "6px 4px", textAlign: "center", border: "1px solid #EFF2F7" }}>
      <div style={{ fontSize: 9, color: "#52718F", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function BulkAssignModal({
  ids, onClose, onDone,
}: {
  ids: number[];
  onClose: () => void;
  onDone: (updated: AppointmentDetail[]) => void;
}) {
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [psyId, setPsyId] = useState<number | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [format, setFormat] = useState<"ONLINE" | "IN_PERSON">("ONLINE");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    operatorApi.listPsychologists().then(setPsychologists).catch(() => {});
  }, []);

  const submit = async () => {
    setErr(null);
    if (!psyId) { setErr("Psixoloq seçin"); return; }
    if (!start || !end) { setErr("Başlama və bitiş vaxtları lazımdır"); return; }
    if (new Date(start) >= new Date(end)) { setErr("Başlama bitişdən əvvəl olmalıdır"); return; }
    setSaving(true);
    try {
      const updated = await operatorApi.bulkAssign(ids, {
        psychologistId: psyId,
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
        sessionFormat: format,
        operatorNote: note.trim() || null,
      });
      onDone(updated);
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(560px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #EFF2F7" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1A2535", margin: 0 }}>Toplu təyin et</h2>
          <p style={{ fontSize: 12, color: "#52718F", marginTop: 4 }}>{ids.length} müraciət eyni psixoloqa və eyni vaxta təyin olunacaq.</p>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Psixoloq</label>
          <select value={psyId ?? ""} onChange={e => setPsyId(Number(e.target.value) || null)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 12 }}>
            <option value="">— Seç —</option>
            {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }} />
            <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }} />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(["ONLINE", "IN_PERSON"] as const).map(f => (
              <button key={f} type="button" onClick={() => setFormat(f)}
                style={{
                  flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 600,
                  border: format === f ? "2px solid #5A4FC8" : "1px solid #E5E7EB",
                  background: format === f ? "#EEECFB" : "#fff", cursor: "pointer", color: "#1A2535",
                }}>
                {f === "ONLINE" ? "💻 Online" : "🏢 Üzbəüz"}
              </button>
            ))}
          </div>

          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Operator qeydi (opsional)"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 12, fontFamily: "inherit" }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>Bağla</button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg,#002147,#5A4FC8)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Göndərilir…" : `${ids.length} təyin et`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
