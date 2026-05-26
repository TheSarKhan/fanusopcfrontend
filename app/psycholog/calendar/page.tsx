"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { psychologistApi, type AppointmentDetail } from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";

const DAYS_AZ = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"]; // Mon..Sun

const HOUR_PX = 56;                  // 1 minute ≈ 0.93px — comfortable for 50-min sessions
const PX_PER_MIN = HOUR_PX / 60;
const DROP_SNAP_MIN = 15;            // drop targets snap to a 15-minute grid
const DEFAULT_HOUR_MIN = 7;
const DEFAULT_HOUR_MAX = 21;         // exclusive upper bound (last visible hour label = 20)

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

function pad2(n: number) { return String(n).padStart(2, "0"); }

function fmtHM(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

function fmtFullDateTime(d: Date) {
  const dayLabel = DAYS_AZ[(d.getDay() + 6) % 7];
  return `${dayLabel} · ${fmtDay(d)} · ${fmtHM(d)}`;
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

interface PositionedEvent {
  item: AppointmentDetail;
  start: Date;
  end: Date;
  startMinOfDay: number;
  endMinOfDay: number;
  // Lane layout for overlapping events
  laneIndex: number;
  laneCount: number;
}

/** Pack overlapping events into lanes (columns). Returns the same events with
 *  laneIndex/laneCount filled in so siblings can split horizontal space. */
function layoutEvents(events: Omit<PositionedEvent, "laneIndex" | "laneCount">[]): PositionedEvent[] {
  const sorted = [...events].sort((a, b) => a.startMinOfDay - b.startMinOfDay);
  const result: PositionedEvent[] = [];
  // Greedy lane assignment grouped by overlapping clusters.
  let cluster: PositionedEvent[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneCount = Math.max(...cluster.map(e => e.laneIndex)) + 1;
    cluster.forEach(e => { e.laneCount = laneCount; });
    result.push(...cluster);
    cluster = [];
    clusterEnd = -1;
  };

  for (const ev of sorted) {
    if (ev.startMinOfDay >= clusterEnd) flush();
    // Find first lane whose latest end is <= this event's start
    const lanesEnd: number[] = [];
    for (const c of cluster) {
      lanesEnd[c.laneIndex] = Math.max(lanesEnd[c.laneIndex] ?? -Infinity, c.endMinOfDay);
    }
    let lane = 0;
    while (lane < lanesEnd.length && lanesEnd[lane] > ev.startMinOfDay) lane++;
    cluster.push({ ...ev, laneIndex: lane, laneCount: 0 });
    clusterEnd = Math.max(clusterEnd, ev.endMinOfDay);
  }
  flush();
  return result;
}

export default function PsychologCalendarPage() {
  const { t } = useT();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Drag-and-drop state
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ day: string; minute: number } | null>(null);
  const [proposalFor, setProposalFor] = useState<{ appointment: AppointmentDetail; newStart: Date } | null>(null);

  const gridScrollRef = useRef<HTMLDivElement | null>(null);

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

  // Compute visible hour range: expand if any event leaks outside the default window.
  const { hourMin, hourMax } = useMemo(() => {
    let lo = DEFAULT_HOUR_MIN;
    let hi = DEFAULT_HOUR_MAX;
    for (const a of items) {
      const eff = a.startAt ?? a.requestedStartAt;
      if (!eff) continue;
      const s = new Date(eff);
      const e = a.endAt ? new Date(a.endAt) : new Date(s.getTime() + 50 * 60_000);
      lo = Math.min(lo, s.getHours());
      // Round end up to the next hour so events never get clipped.
      hi = Math.max(hi, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
    }
    return { hourMin: lo, hourMax: hi };
  }, [items]);

  const hours = useMemo(
    () => Array.from({ length: hourMax - hourMin }, (_, i) => i + hourMin),
    [hourMin, hourMax]
  );
  const gridHeight = (hourMax - hourMin) * HOUR_PX;

  // Auto-scroll to current time on first mount of the grid each week.
  useEffect(() => {
    if (loading) return;
    const now = new Date();
    if (now.getHours() < hourMin || now.getHours() >= hourMax) return;
    const el = gridScrollRef.current;
    if (!el) return;
    const targetTop = (now.getHours() - hourMin) * HOUR_PX + now.getMinutes() * PX_PER_MIN - 120;
    el.scrollTop = Math.max(0, targetTop);
    // Only on initial paint of a given week.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, weekStart]);

  // Group + layout per-day events
  const byDay = useMemo(() => {
    const map = new Map<string, PositionedEvent[]>();
    const raw = new Map<string, Omit<PositionedEvent, "laneIndex" | "laneCount">[]>();
    for (const a of items) {
      const eff = a.startAt ?? a.requestedStartAt;
      if (!eff) continue;
      const start = new Date(eff);
      const end = a.endAt
        ? new Date(a.endAt)
        : new Date(start.getTime() + 50 * 60_000);
      const key = isoDay(start);
      if (!raw.has(key)) raw.set(key, []);
      raw.get(key)!.push({
        item: a, start, end,
        startMinOfDay: start.getHours() * 60 + start.getMinutes(),
        endMinOfDay: end.getHours() * 60 + end.getMinutes(),
      });
    }
    raw.forEach((evs, key) => map.set(key, layoutEvents(evs)));
    return map;
  }, [items]);

  // ─── Drag handlers ──────────────────────────────────────────────────────
  const handleDragStart = (a: AppointmentDetail, e: React.DragEvent) => {
    if (!DRAGGABLE_STATUSES.has(a.status) || !a.startAt) return;
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

  /** Convert a vertical pointer offset (px from top of day column) into a
   *  minute-of-day, snapped to DROP_SNAP_MIN. */
  const yToMinute = (y: number): number => {
    const minutes = y / PX_PER_MIN + hourMin * 60;
    const snapped = Math.round(minutes / DROP_SNAP_MIN) * DROP_SNAP_MIN;
    return Math.max(hourMin * 60, Math.min(hourMax * 60 - DROP_SNAP_MIN, snapped));
  };

  const handleColumnDragOver = (day: string, e: React.DragEvent<HTMLDivElement>) => {
    if (draggingId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minute = yToMinute(y);
    if (dropTarget?.day !== day || dropTarget?.minute !== minute) {
      setDropTarget({ day, minute });
    }
  };

  const handleColumnDrop = (day: Date, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData(DRAG_MIME) || String(draggingId ?? "");
    const id = Number(idStr);
    if (!id) { setDraggingId(null); setDropTarget(null); return; }
    const appt = items.find(a => a.id === id);
    if (!appt || !appt.startAt) { setDraggingId(null); setDropTarget(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const minute = yToMinute(e.clientY - rect.top);
    const original = new Date(appt.startAt);
    const newStart = new Date(day);
    newStart.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    if (newStart.getTime() === original.getTime()) {
      setDraggingId(null); setDropTarget(null); return;
    }
    // Don't allow dropping into the past
    if (newStart.getTime() < Date.now()) {
      setDraggingId(null); setDropTarget(null); return;
    }
    setProposalFor({ appointment: appt, newStart });
    setDraggingId(null);
    setDropTarget(null);
  };

  const dropPreviewTopPx = (minute: number) => (minute - hourMin * 60) * PX_PER_MIN;
  const dropPreviewHeightPx = () => DROP_SNAP_MIN * PX_PER_MIN;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535" }}>{t("staff.psyCalendarTitle")}</h1>
          <p style={{ fontSize: 11, color: "#8AAABF", marginTop: 2 }}>
            İpucu: gələcək təsdiqli/təyin edilmiş seansları sürükləyib başqa saata buraxaraq yenidən təklif edə bilərsiniz (15 dəq-lik addımlarla)
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
        <div style={{ background: "#fff", borderRadius: 14, padding: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ minWidth: 760 }}>
            {/* Day header row */}
            <div style={{
              display: "grid",
              gridTemplateColumns: `60px repeat(7, 1fr)`,
              borderBottom: "1px solid #EFF2F7",
              paddingBottom: 8,
              marginBottom: 0,
              position: "sticky", top: 0, zIndex: 5, background: "#fff",
            }}>
              <div />
              {weekDays.map((d, i) => {
                const isToday = isoDay(d) === isoDay(new Date());
                return (
                  <div key={i} style={{ textAlign: "center", fontSize: 12, color: "#52718F" }}>
                    <div style={{ fontWeight: 700, color: isToday ? "var(--brand)" : "#1A2535" }}>{DAYS_AZ[i]}</div>
                    <div style={{ color: isToday ? "var(--brand)" : "#52718F" }}>{fmtDay(d)}</div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable time grid */}
            <div ref={gridScrollRef} style={{ maxHeight: "70vh", overflow: "auto", position: "relative" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: `60px repeat(7, 1fr)`,
                position: "relative",
                height: gridHeight,
              }}>
                {/* Hour labels column */}
                <div style={{ position: "relative" }}>
                  {hours.map(h => (
                    <div key={h} style={{
                      position: "absolute",
                      top: (h - hourMin) * HOUR_PX,
                      right: 6,
                      fontSize: 11,
                      color: "#8AAABF",
                      transform: "translateY(-6px)",
                    }}>
                      {pad2(h)}:00
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((d, di) => {
                  const dayKey = isoDay(d);
                  const events = byDay.get(dayKey) ?? [];
                  const isToday = dayKey === isoDay(new Date());
                  const isDayDropTarget = dropTarget?.day === dayKey;
                  return (
                    <div
                      key={di}
                      onDragOver={e => handleColumnDragOver(dayKey, e)}
                      onDrop={e => handleColumnDrop(d, e)}
                      style={{
                        position: "relative",
                        borderLeft: "1px solid #F3F4F6",
                        background: isToday ? "rgba(16,81,183,0.02)" : "transparent",
                      }}
                    >
                      {/* Hourly horizontal lines + half-hour ticks */}
                      {hours.map(h => (
                        <div key={h} style={{
                          position: "absolute",
                          left: 0, right: 0,
                          top: (h - hourMin) * HOUR_PX,
                          borderTop: "1px solid #F3F4F6",
                          height: 0,
                          pointerEvents: "none",
                        }} />
                      ))}
                      {hours.map(h => (
                        <div key={`half-${h}`} style={{
                          position: "absolute",
                          left: 0, right: 0,
                          top: (h - hourMin) * HOUR_PX + HOUR_PX / 2,
                          borderTop: "1px dashed #F8FAFC",
                          height: 0,
                          pointerEvents: "none",
                        }} />
                      ))}

                      {/* Drop preview marker */}
                      {isDayDropTarget && dropTarget && (
                        <div style={{
                          position: "absolute",
                          left: 2, right: 2,
                          top: dropPreviewTopPx(dropTarget.minute),
                          height: dropPreviewHeightPx(),
                          background: "rgba(16,81,183,0.12)",
                          border: "1px dashed var(--brand)",
                          borderRadius: 6,
                          pointerEvents: "none",
                          zIndex: 1,
                        }}>
                          <div style={{
                            position: "absolute", top: -16, left: 4,
                            fontSize: 10, fontWeight: 700, color: "var(--brand)",
                            background: "#fff", padding: "1px 4px", borderRadius: 4,
                            border: "1px solid var(--brand)",
                          }}>
                            {pad2(Math.floor(dropTarget.minute / 60))}:{pad2(dropTarget.minute % 60)}
                          </div>
                        </div>
                      )}

                      {/* Events */}
                      {events.map(ev => {
                        const colors = STATUS_COLOR[ev.item.status] ?? STATUS_COLOR.PENDING;
                        const top = (ev.startMinOfDay - hourMin * 60) * PX_PER_MIN;
                        // Ensure visually-clickable minimum even for very short events
                        const rawHeight = (ev.endMinOfDay - ev.startMinOfDay) * PX_PER_MIN;
                        const height = Math.max(22, rawHeight);
                        const widthPct = 100 / ev.laneCount;
                        const leftPct = widthPct * ev.laneIndex;
                        const draggable = DRAGGABLE_STATUSES.has(ev.item.status)
                          && !!ev.item.startAt
                          && ev.start.getTime() > Date.now();
                        const isBeingDragged = draggingId === ev.item.id;
                        const a = ev.item;
                        const compact = height < 38;
                        return (
                          <div key={a.id}
                            draggable={draggable}
                            onDragStart={e => handleDragStart(a, e)}
                            onDragEnd={handleDragEnd}
                            title={`${a.patientName ?? "—"} · ${fmtHM(ev.start)}–${fmtHM(ev.end)} · ${a.status}${draggable ? "\nSürükləyib başqa vaxta burax" : ""}`}
                            style={{
                              position: "absolute",
                              top,
                              height,
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${widthPct}% - 4px)`,
                              background: colors.bg,
                              color: colors.fg,
                              border: colors.dashed ? `1px dashed ${colors.fg}` : `1px solid ${colors.bg}`,
                              borderLeft: `3px solid ${colors.fg}`,
                              borderRadius: 6,
                              padding: compact ? "1px 5px" : "4px 6px",
                              fontSize: 11,
                              lineHeight: 1.2,
                              overflow: "hidden",
                              opacity: a.status === "CANCELLED" ? 0.55 : isBeingDragged ? 0.4 : 1,
                              cursor: draggable ? "grab" : "default",
                              zIndex: 2,
                              boxShadow: isBeingDragged ? "none" : "0 1px 2px rgba(16,81,183,0.08)",
                            }}>
                            <a href="/psycholog/appointments"
                              onClick={e => { if (draggable) e.stopPropagation(); }}
                              style={{ color: "inherit", textDecoration: "none", display: "block", overflow: "hidden" }}>
                              {compact ? (
                                <div style={{
                                  display: "flex", justifyContent: "space-between", gap: 4,
                                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                  fontWeight: 600,
                                }}>
                                  <span>{fmtHM(ev.start)} {a.patientName ?? "—"}</span>
                                  {draggable && <span style={{ opacity: 0.6 }}>⠿</span>}
                                </div>
                              ) : (
                                <>
                                  <div style={{
                                    display: "flex", justifyContent: "space-between", gap: 4,
                                    fontSize: 10, opacity: 0.9, fontWeight: 700,
                                  }}>
                                    <span>{fmtHM(ev.start)}–{fmtHM(ev.end)}</span>
                                    {draggable && <span style={{ opacity: 0.6 }}>⠿</span>}
                                  </div>
                                  <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {a.patientName ?? "—"}
                                  </div>
                                  {height >= 56 && (
                                    <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>
                                      {a.status}
                                    </div>
                                  )}
                                </>
                              )}
                            </a>
                          </div>
                        );
                      })}

                    </div>
                  );
                })}
              </div>
            </div>

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
            <Row label="Köhnə saat" value={originalStart ? `${fmtFullDateTime(originalStart)}–${fmtHM(new Date(originalStart.getTime() + duration))}` : "—"} muted />
            <Row label="Yeni təklif" value={`${fmtFullDateTime(newStart)}–${fmtHM(newEnd)}`} highlight />
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
