"use client";

import { useEffect, useMemo, useState } from "react";
import { psychologistApi, type AppointmentDetail } from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";

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

const STATUS_COLOR: Record<string, { bg: string; fg: string; dashed?: boolean }> = {
  ASSIGNED:  { bg: "#DBEAFE", fg: "#1E40AF" },
  CONFIRMED: { bg: "#D1FAE5", fg: "#065F46" },
  COMPLETED: { bg: "#E5E7EB", fg: "#374151" },
  CANCELLED: { bg: "#FEE2E2", fg: "#991B1B" },
  REJECTED:  { bg: "#FEF3C7", fg: "#92400E" },
  PENDING:   { bg: "#FEF3C7", fg: "#92400E", dashed: true },
};

export default function PsychologCalendarPage() {
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [refreshNonce, setRefreshNonce] = useState(0);

  const load = () => {
    setLoading(true);
    psychologistApi.myAppointments()
      .then(setItems).catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [refreshNonce]);

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

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535" }}>Calendar</h1>
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
                const list = (byDay.get(isoDay(d)) ?? [])
                  .filter(({ effectiveStart }) => new Date(effectiveStart).getHours() === h);
                return (
                  <div key={di} style={{ borderLeft: "1px solid #F3F4F6", padding: 4, position: "relative" }}>
                    {list.map(({ item: a, effectiveStart }) => {
                      const start = new Date(effectiveStart);
                      const end = a.endAt ? new Date(a.endAt) : new Date(start.getTime() + 50 * 60_000);
                      const minutes = (end.getTime() - start.getTime()) / 60_000;
                      const colors = STATUS_COLOR[a.status] ?? STATUS_COLOR.PENDING;
                      const time = `${String(start.getHours()).padStart(2,"0")}:${String(start.getMinutes()).padStart(2,"0")}`;
                      return (
                        <a key={a.id} href="/psycholog/appointments"
                          title={`${a.patientName ?? "—"} · ${time} · ${a.status}`}
                          style={{
                            display: "block", padding: "4px 6px", borderRadius: 6,
                            background: colors.bg, color: colors.fg,
                            border: colors.dashed ? `1px dashed ${colors.fg}` : "1px solid transparent",
                            fontSize: 11, fontWeight: 600, textDecoration: "none",
                            marginBottom: 2, lineHeight: 1.2,
                            minHeight: Math.max(28, (minutes / 60) * 56),
                            opacity: a.status === "CANCELLED" ? 0.6 : 1,
                          }}>
                          <div style={{ fontSize: 10, opacity: 0.9 }}>{time} · {a.status}</div>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.patientName ?? "—"}
                          </div>
                        </a>
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
