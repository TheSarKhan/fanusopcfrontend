"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPsychologistAvailability,
  patientApi,
  isSlotConflict,
  type AppointmentDetail,
  type AvailableSlot,
  type RescheduleProposal,
} from "@/lib/api";

const MONTHS_AZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const WEEKDAYS_AZ = ["Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə", "Bazar"];
const MAX_PICKS = 3;

function pad2(n: number) { return String(n).padStart(2, "0"); }
function isoDateOnly(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function dayLabel(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAYS_AZ[(d.getDay() + 6) % 7]} · ${pad2(d.getDate())} ${MONTHS_AZ[d.getMonth()]}`;
}
function timeLabel(startIso: string, endIso: string) {
  const s = new Date(startIso), e = new Date(endIso);
  return `${pad2(s.getHours())}:${pad2(s.getMinutes())}–${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
}

/**
 * GAP-03: patient picks 1–3 real free slots of their psychologist and sends a
 * reschedule request. The psychologist accepts one (appointment moves, old
 * slot frees up) or declines (appointment stays). Never counts as late-cancel.
 */
export default function PatientRescheduleRequestModal({
  appointment, onClose, onDone,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onDone: (p: RescheduleProposal) => void;
}) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [picked, setPicked] = useState<AvailableSlot[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadSlots = () => {
    if (!appointment.psychologistId) { setSlots([]); setLoadingSlots(false); return; }
    setLoadingSlots(true);
    const from = new Date();
    const to = new Date(); to.setDate(to.getDate() + 14);
    getPsychologistAvailability(appointment.psychologistId, isoDateOnly(from), isoDateOnly(to))
      .then(list => setSlots(list.filter(s => s.startAt !== appointment.startAt)))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadSlots, [appointment.psychologistId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const grouped = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = s.startAt.slice(0, 10);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  const togglePick = (s: AvailableSlot) => {
    setPicked(prev => {
      const has = prev.some(p => p.startAt === s.startAt);
      if (has) return prev.filter(p => p.startAt !== s.startAt);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, s];
    });
  };

  const submit = async () => {
    setErr(null);
    if (picked.length === 0) { setErr("Ən azı bir alternativ saat seçin"); return; }
    setSaving(true);
    try {
      const created = await patientApi.requestReschedule(appointment.id, {
        options: picked.map(p => ({ startAt: p.startAt, endAt: p.endAt })),
        reason: reason.trim() || null,
      });
      onDone(created);
    } catch (e) {
      setErr((e as Error).message);
      // GAP-02: a slot raced away — clear stale picks and refresh the list.
      if (isSlotConflict(e)) {
        setPicked([]);
        loadSlots();
      }
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(640px, 100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Vaxtı dəyiş</h2>
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4 }}>
            Psixoloqunuzun boş saatlarından 1–3 alternativ seçin. Psixoloq birini qəbul etsə,
            randevunuz həmin vaxta keçəcək — qəbul edilməsə, köhnə vaxtında qalacaq.
            Bu istək ləğv kimi qeydə alınmır.
          </p>
        </div>

        <div style={{ padding: 22, overflow: "auto", flex: 1 }}>
          {loadingSlots ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--oxford-60)", fontSize: 13 }}>
              Boş saatlar yüklənir…
            </div>
          ) : grouped.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--oxford-60)", fontSize: 13 }}>
              Yaxın 14 gündə boş saat tapılmadı. Operator komandası ilə əlaqə saxlayın.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {grouped.map(([day, daySlots]) => (
                <div key={day}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 6 }}>
                    {dayLabel(day)}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {daySlots.map(s => {
                      const isPicked = picked.some(p => p.startAt === s.startAt);
                      const pickIndex = picked.findIndex(p => p.startAt === s.startAt);
                      return (
                        <button
                          key={s.startAt}
                          type="button"
                          onClick={() => togglePick(s)}
                          disabled={!isPicked && picked.length >= MAX_PICKS}
                          style={{
                            padding: "7px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                            border: isPicked ? "2px solid var(--brand)" : "1px solid #E5E7EB",
                            background: isPicked ? "var(--brand-50)" : "#fff",
                            color: isPicked ? "var(--brand-700)" : "var(--oxford)",
                            cursor: "pointer",
                            opacity: !isPicked && picked.length >= MAX_PICKS ? 0.4 : 1,
                          }}
                        >
                          {isPicked && <span style={{ marginRight: 5 }}>{pickIndex + 1}.</span>}
                          {timeLabel(s.startAt, s.endAt)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", margin: "16px 0 6px" }}>
            Səbəb (istəyə bağlı)
          </label>
          <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} maxLength={500}
            placeholder="Məsələn: iş qrafikim dəyişdi"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit" }} />

          {err && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 12 }}>
              {err}
            </div>
          )}
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--brand-100)", display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--oxford-60)" }}>
            {picked.length}/{MAX_PICKS} saat seçilib
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Bağla
            </button>
            <button onClick={submit} disabled={saving || picked.length === 0}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving || picked.length === 0 ? 0.7 : 1 }}>
              {saving ? "Göndərilir…" : "İstəyi göndər"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
