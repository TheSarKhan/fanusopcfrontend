"use client";

import { useEffect, useMemo, useState } from "react";
import {
  operatorApi,
  type AppointmentDetail,
  type AvailableSlot,
  type Psychologist,
} from "@/lib/api";

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

  const load = () => {
    setLoading(true);
    operatorApi.listAppointments()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]">Randevular</h1>
          <p className="text-[#52718F] text-sm mt-1">Müraciətləri psixoloqlara təyin edin və status izləyin</p>
        </div>
        <button onClick={load} className="px-4 py-2 text-sm rounded-xl border border-[#E5E7EB] bg-white text-[#1A2535]">
          Yenilə
        </button>
      </div>

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
            <AppointmentCard key={a.id} a={a} onAssign={() => setAssignFor(a)} onCancel={() => onCancel(a.id)} />
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
    </div>
  );
}

function AppointmentCard({
  a, onAssign, onCancel,
}: { a: AppointmentDetail; onAssign: () => void; onCancel: () => void }) {
  const status = a.status;
  const canAssign = status === "PENDING" || status === "REJECTED" || status === "ASSIGNED";
  const canCancel = status !== "COMPLETED" && status !== "CANCELLED";
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
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
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null); // ISO startAt
  const [manualStart, setManualStart] = useState<string>("");
  const [manualEnd, setManualEnd] = useState<string>("");
  const [sessionFormat, setSessionFormat] = useState<"ONLINE" | "IN_PERSON">(
    (appointment.sessionFormat as "ONLINE" | "IN_PERSON") ?? "ONLINE"
  );
  const [note, setNote] = useState(appointment.operatorNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    operatorApi.listPsychologists().then(setPsychologists).catch(() => {});
  }, []);

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
        style={{ background: "#fff", borderRadius: 16, width: "min(720px, 100%)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #EFF2F7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

        <div style={{ padding: 24 }}>
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
                  {groupedSlots.map(([day, daySlots]) => (
                    <div key={day}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#52718F", textTransform: "uppercase", marginBottom: 4 }}>{day}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {daySlots.map(s => {
                          const active = pickedSlot === s.startAt;
                          return (
                            <button
                              key={s.startAt}
                              type="button"
                              onClick={() => { setPickedSlot(active ? null : s.startAt); setManualStart(""); setManualEnd(""); }}
                              style={{
                                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                border: active ? "2px solid #5A4FC8" : "1px solid #E5E7EB",
                                background: active ? "#EEECFB" : "#fff",
                                color: active ? "#5A4FC8" : "#1A2535",
                                cursor: "pointer",
                              }}>
                              {fmtTime(s.startAt)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
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
      </div>
    </div>
  );
}
