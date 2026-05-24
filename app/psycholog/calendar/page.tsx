"use client";

import { useEffect, useMemo, useState } from "react";
import { psychologistApi, type AppointmentDetail } from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";

const DAYS_AZ = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"]; // Mon..Sun
const DEFAULT_HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07..20

function startOfWeek(d: Date) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // Mon=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - dow);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}

function fmtDay(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtFullDateTime(d: Date) {
  const dayLabel = DAYS_AZ[(d.getDay() + 6) % 7];
  return `${dayLabel} · ${fmtDay(d)} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const STATUS_COLOR: Record<string, { bg: string; fg: string; dashed?: boolean }> = {
  ASSIGNED:  { bg: "#DBEAFE", fg: "#1E40AF" },
  CONFIRMED: { bg: "#D1FAE5", fg: "#065F46" },
  COMPLETED: { bg: "#E5E7EB", fg: "#374151" },
  CANCELLED: { bg: "#FEE2E2", fg: "#991B1B" },
  REJECTED:  { bg: "#FEF3C7", fg: "#92400E" },
  PENDING:   { bg: "#FEF3C7", fg: "#92400E", dashed: true },
};

const DRAGGABLE_STATUSES = new Set(["ASSIGNED", "CONFIRMED"]);
const DRAG_MIME = "application/x-fanus-appointment";

export default function PsychologCalendarPage() {
  const { t } = useT();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Drag-and-drop state
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ day: string; hour: number } | null>(null);
  const [proposalFor, setProposalFor] = useState<{ appointment: AppointmentDetail; newStart: Date } | null>(null);

  const load = () => {
    setLoading(true);
    psychologistApi.myAppointments()
      .then(setItems).catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [refreshNonce]);

  // Live refresh: any appointment-related notification → re-fetch
  useEffect(() => {
    const unsub = subscribeNotifications((n) => {
      if (typeof n.type === "string" && n.type.startsWith("APPOINTMENT_")) {
        setRefreshNonce(x => x + 1);
      }
    });
    return unsub;
  }, []);

  // Refresh on tab focus (browser may have throttled the page while inactive)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") setRefreshNonce(x => x + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Group appointments by day. Use startAt if set, otherwise requestedStartAt
  // (so PENDING / patient-requested appointments are visible too).
  const byDay = useMemo(() => {
    const map = new Map<string, { item: AppointmentDetail; effectiveStart: string }[]>();
    for (const a of items) {
      const eff = a.startAt ?? a.requestedStartAt;
      if (!eff) continue;
      const key = isoDay(new Date(eff));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ item: a, effectiveStart: eff });
    }
    return map;
  }, [items]);

  // Dynamically expand the visible hour range if any appointment falls outside default 7-20.
  const hours = useMemo(() => {
    let min = DEFAULT_HOURS[0];
    let max = DEFAULT_HOURS[DEFAULT_HOURS.length - 1];
    for (const a of items) {
      const eff = a.startAt ?? a.requestedStartAt;
      if (!eff) continue;
      const h = new Date(eff).getHours();
      if (h < min) min = h;
      if (h > max) max = h;
    }
    return Array.from({ length: max - min + 1 }, (_, i) => i + min);
  }, [items]);

  // ─── Drag handlers ──────────────────────────────────────────────────────
  const handleDragStart = (a: AppointmentDetail, e: React.DragEvent) => {
    if (!DRAGGABLE_STATUSES.has(a.status) || !a.startAt) return;
    // Don't allow moving past sessions
    // eslint-disable-next-line react-hooks/purity
    if (new Date(a.startAt).getTime() < Date.now()) return;
    setDraggingId(a.id);
    e.dataTransfer.setData(DRAG_MIME, String(a.id));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
  };

  const handleDragOver = (day: string, hour: number, e: React.DragEvent) => {
    if (draggingId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTarget?.day !== day || dropTarget?.hour !== hour) {
      setDropTarget({ day, hour });
    }
  };

  const handleDrop = (day: Date, hour: number, e: React.DragEvent) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData(DRAG_MIME) || String(draggingId ?? "");
    const id = Number(idStr);
    if (!id) { setDraggingId(null); setDropTarget(null); return; }
    const appt = items.find(a => a.id === id);
    if (!appt || !appt.startAt) { setDraggingId(null); setDropTarget(null); return; }
    const original = new Date(appt.startAt);
    // Preserve original minute offset within the hour
    const newStart = new Date(day);
    newStart.setHours(hour, original.getMinutes(), 0, 0);
    // No-op if dropped on the same slot
    if (newStart.getTime() === original.getTime()) {
      setDraggingId(null); setDropTarget(null); return;
    }
    setProposalFor({ appointment: appt, newStart });
    setDraggingId(null);
    setDropTarget(null);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535" }}>{t("staff.psyCalendarTitle")}</h1>
          <p style={{ fontSize: 11, color: "#8AAABF", marginTop: 2 }}>
            💡 İpucu: gələcək təsdiqli/təyin edilmiş seansları sürükləyib başqa saata buraxaraq yenidən təklif edə bilərsiniz
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setRefreshNonce(x => x + 1)} style={btnStyle()} title="Yenilə">↻</button>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={btnStyle()}>‹ Əvvəlki</button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} style={btnStyle()}>Bu həftə</button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={btnStyle()}>Növbəti ›</button>
        </div>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, padding: 12, overflow: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ minWidth: 720 }}>
          <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", borderBottom: "1px solid #EFF2F7", paddingBottom: 8, marginBottom: 8 }}>
            <div />
            {weekDays.map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 12, color: "#52718F" }}>
                <div style={{ fontWeight: 700, color: "#1A2535" }}>{DAYS_AZ[i]}</div>
                <div>{fmtDay(d)}</div>
              </div>
            ))}
          </div>
          {hours.map(h => (
            <div key={h} style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", minHeight: 60, borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ fontSize: 11, color: "#8AAABF", paddingTop: 6, textAlign: "right", paddingRight: 6 }}>
                {String(h).padStart(2, "0")}:00
              </div>
              {weekDays.map((d, di) => {
                const dayKey = isoDay(d);
                const list = (byDay.get(dayKey) ?? [])
                  .filter(({ effectiveStart }) => new Date(effectiveStart).getHours() === h);
                const isDropTarget = dropTarget?.day === dayKey && dropTarget?.hour === h;
                const isDropDisabled = draggingId !== null && new Date(d).setHours(h, 0, 0, 0) < Date.now();
                return (
                  <div key={di}
                    onDragOver={e => !isDropDisabled && handleDragOver(dayKey, h, e)}
                    onDrop={e => !isDropDisabled && handleDrop(d, h, e)}
                    style={{
                      borderLeft: "1px solid #F3F4F6",
                      padding: 4,
                      position: "relative",
                      background: isDropTarget ? (isDropDisabled ? "#FEE2E2" : "#DBEAFE") : "transparent",
                      transition: "background 0.1s",
                    }}>
                    {list.map(({ item: a, effectiveStart }) => {
                      const start = new Date(effectiveStart);
                      const end = a.endAt ? new Date(a.endAt) : new Date(start.getTime() + 50 * 60_000);
                      const minutes = (end.getTime() - start.getTime()) / 60_000;
                      const colors = STATUS_COLOR[a.status] ?? STATUS_COLOR.PENDING;
                      const time = `${String(start.getHours()).padStart(2,"0")}:${String(start.getMinutes()).padStart(2,"0")}`;
                      const draggable = DRAGGABLE_STATUSES.has(a.status) && !!a.startAt && new Date(a.startAt).getTime() > Date.now();
                      const isBeingDragged = draggingId === a.id;
                      return (
                        <div key={a.id}
                          draggable={draggable}
                          onDragStart={e => handleDragStart(a, e)}
                          onDragEnd={handleDragEnd}
                          title={draggable
                            ? `${a.patientName ?? "—"} · ${time} · ${a.status}\nSürükləyib başqa saata burax`
                            : `${a.patientName ?? "—"} · ${time} · ${a.status}`}
                          style={{
                            padding: "4px 6px", borderRadius: 6,
                            background: colors.bg, color: colors.fg,
                            border: colors.dashed ? `1px dashed ${colors.fg}` : "1px solid transparent",
                            fontSize: 11, fontWeight: 600,
                            marginBottom: 2, lineHeight: 1.2,
                            minHeight: Math.max(28, (minutes / 60) * 56),
                            opacity: a.status === "CANCELLED" ? 0.6 : isBeingDragged ? 0.4 : 1,
                            cursor: draggable ? "grab" : "default",
                            position: "relative",
                          }}>
                          <a href="/psycholog/appointments"
                            onClick={e => { if (draggable) e.stopPropagation(); }}
                            style={{ color: "inherit", textDecoration: "none", display: "block" }}>
                            <div style={{ fontSize: 10, opacity: 0.9, display: "flex", justifyContent: "space-between", gap: 4 }}>
                              <span>{time} · {a.status}</span>
                              {draggable && <span style={{ opacity: 0.6 }}>⠿</span>}
                            </div>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {a.patientName ?? "—"}
                            </div>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Legend */}
          <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: 11, color: "#52718F", flexWrap: "wrap" }}>
            <Legend label="Gözləmədə" bg="#FEF3C7" fg="#92400E" dashed />
            <Legend label="Təyin edilib" bg="#DBEAFE" fg="#1E40AF" />
            <Legend label="Təsdiqlənib" bg="#D1FAE5" fg="#065F46" />
            <Legend label="Tamamlanıb" bg="#E5E7EB" fg="#374151" />
            <Legend label="Ləğv olunub" bg="#FEE2E2" fg="#991B1B" />
          </div>
          </div>
        </div>
      )}

      {proposalFor && (
        <DragProposalModal
          appointment={proposalFor.appointment}
          newStart={proposalFor.newStart}
          onClose={() => setProposalFor(null)}
          onSubmitted={() => { setProposalFor(null); setRefreshNonce(x => x + 1); }}
        />
      )}
    </div>
  );
}

function Legend({ label, bg, fg, dashed }: { label: string; bg: string; fg: string; dashed?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ display: "inline-block", width: 10, height: 10, background: bg, border: dashed ? `1px dashed ${fg}` : `1px solid ${fg}`, borderRadius: 2 }} />
      {label}
    </span>
  );
}

function btnStyle(): React.CSSProperties {
  return { padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", color: "#1A2535", cursor: "pointer" };
}

/* ─── Drag-to-reschedule proposal modal ──────────────────────────────────── */

function DragProposalModal({
  appointment, newStart, onClose, onSubmitted,
}: {
  appointment: AppointmentDetail;
  newStart: Date;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const originalStart = appointment.startAt ? new Date(appointment.startAt) : null;
  const duration = (() => {
    if (appointment.startAt && appointment.endAt) {
      return new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime();
    }
    return 50 * 60_000;
  })();
  const newEnd = new Date(newStart.getTime() + duration);

  const submit = async () => {
    setSubmitting(true); setErr(null);
    try {
      await psychologistApi.proposeReschedule(appointment.id, {
        options: [{ startAt: newStart.toISOString(), endAt: newEnd.toISOString() }],
        reason: reason.trim() || undefined,
        expiresInHours: 48,
      });
      onSubmitted();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, padding: 0, maxWidth: 520, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1A2535", margin: 0 }}>Yenidən təklif</h3>
          <p style={{ fontSize: 12, color: "#52718F", marginTop: 4 }}>
            {appointment.patientName ?? "Pasient"} üçün yeni saat təklif edirsiniz. Pasiyent təsdiq etməlidir.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            <Row label="Köhnə saat" value={originalStart ? fmtFullDateTime(originalStart) : "—"} muted />
            <Row label="Yeni təklif" value={fmtFullDateTime(newStart)} highlight />
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
            Səbəb (məcburi deyil)
          </label>
          <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Məsələn: O saatda işim çıxdı, bu zaman daha rahat olarsa…"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box", resize: "vertical" }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Ləğv
            </button>
            <button onClick={submit} disabled={submitting}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Göndərilir…" : "Təklif göndər"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted, highlight }: { label: string; value: string; muted?: boolean; highlight?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 12px",
      borderRadius: 10,
      background: highlight ? "#EEF5FF" : muted ? "#F8FAFD" : "#fff",
      border: highlight ? "1px solid #BFDBFE" : "1px solid #E5E7EB",
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#52718F", textTransform: "uppercase", letterSpacing: 0.04 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: highlight ? "#1E40AF" : muted ? "#9CA3AF" : "#1A2535" }}>{value}</span>
    </div>
  );
}
