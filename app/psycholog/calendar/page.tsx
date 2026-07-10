"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { psychologistApi, type AppointmentDetail, type GoogleCalendarStatus, type GoogleExternalEvent } from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azFormatDateTime } from "@/lib/datetime";

const DAYS_AZ = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"]; // Mon..Sun

// Google Calendar inteqrasiyası — header-dəki "Sinxronlaşdır" düyməsi + status banner.
const SHOW_GOOGLE_INTEGRATION = true;

const HOUR_PX = 72;                  // 1 dəqiqə = 1.2px — 11:20–12:25 kimi seanslar dəqiq proporsiyada görünür
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

/** ISO without timezone (LocalDateTime), matches Spring's LocalDateTime parser. */
function toLocalIso(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
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

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Gözləmədə",
  ASSIGNED: "Təyin edilib",
  CONFIRMED: "Təsdiqlənib",
  COMPLETED: "Tamamlanıb",
  CANCELLED: "Ləğv olunub",
  REJECTED: "Rədd edilib",
};

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

interface PositionedExternal {
  ev: GoogleExternalEvent;
  start: Date;
  end: Date;
  startMinOfDay: number;
  endMinOfDay: number;
}

/** Fanus seansı + onunla üst-üstə düşən Google hadisələri. */
interface ConflictPair {
  appointment: AppointmentDetail;
  start: Date;
  end: Date;
  events: GoogleExternalEvent[];
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
  const [proposalFor, setProposalFor] = useState<{ appointment: AppointmentDetail; newStart: Date; editable?: boolean } | null>(null);

  // Google Calendar overlay
  const [gStatus, setGStatus] = useState<GoogleCalendarStatus | null>(null);
  const [gEvents, setGEvents] = useState<GoogleExternalEvent[]>([]);
  const [gLoading, setGLoading] = useState(false);
  const [gShown, setGShown] = useState(true);
  const [gConnecting, setGConnecting] = useState(false);
  const [gError, setGError] = useState<string | null>(null);
  const [showConflicts, setShowConflicts] = useState(false);

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

  // Google Calendar status (one-shot on mount) — gated by feature flag.
  useEffect(() => {
    if (!SHOW_GOOGLE_INTEGRATION) return;
    psychologistApi.googleStatus().then(setGStatus).catch(() => setGStatus(null));
  }, []);

  // OAuth callback nəticəsi — backend ?google=connected|error ilə bura yönləndirir.
  // Xəta səbəbini banner-də göstərib URL-i təmizləyirik.
  useEffect(() => {
    if (!SHOW_GOOGLE_INTEGRATION) return;
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (!g) return;
    if (g === "error") {
      setGError(params.get("reason") || "Google bağlantısı alınmadı");
    }
    params.delete("google");
    params.delete("reason");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  // Fetch Google events for the visible week whenever week or connection changes.
  useEffect(() => {
    if (!SHOW_GOOGLE_INTEGRATION) return;
    if (!gStatus?.connected) { setGEvents([]); return; }
    const from = new Date(weekStart); from.setHours(0, 0, 0, 0);
    const to = addDays(weekStart, 7);
    setGLoading(true); setGError(null);
    psychologistApi.googleEvents(toLocalIso(from), toLocalIso(to))
      .then(setGEvents)
      .catch((e: Error) => { setGEvents([]); setGError(e.message); })
      .finally(() => setGLoading(false));
  }, [gStatus?.connected, weekStart, refreshNonce]);

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
      hi = Math.max(hi, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
    }
    if (gShown && gStatus?.connected) {
      for (const ev of gEvents) {
        const s = new Date(ev.startAt);
        const e = new Date(ev.endAt);
        if (s.getTime() < weekStart.getTime() || s.getTime() >= addDays(weekStart, 7).getTime()) continue;
        lo = Math.min(lo, s.getHours());
        hi = Math.max(hi, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
      }
    }
    return { hourMin: lo, hourMax: hi };
  }, [items, gEvents, gShown, gStatus?.connected, weekStart]);

  // Fanus seansları ilə üst-üstə düşən Google hadisələri — konflikt paneli
  // hər cütü göstərib həll yolu (yeni vaxt təklifi / Google-da köçürmə) təqdim edir.
  const conflictPairs = useMemo(() => {
    const out: ConflictPair[] = [];
    if (!gShown || !gStatus?.connected || gEvents.length === 0) return out;
    for (const a of items) {
      if (!a.startAt) continue;
      if (a.status === "CANCELLED" || a.status === "REJECTED") continue;
      const start = new Date(a.startAt);
      const end = a.endAt ? new Date(a.endAt) : new Date(start.getTime() + 50 * 60_000);
      const events = gEvents.filter(ev => {
        const eS = new Date(ev.startAt).getTime();
        const eE = new Date(ev.endAt).getTime();
        return start.getTime() < eE && eS < end.getTime();
      });
      if (events.length > 0) out.push({ appointment: a, start, end, events });
    }
    out.sort((x, y) => x.start.getTime() - y.start.getTime());
    return out;
  }, [items, gEvents, gShown, gStatus?.connected]);

  const conflictIds = useMemo(
    () => new Set(conflictPairs.map(p => p.appointment.id)),
    [conflictPairs]
  );

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

  // Group external (Google) events per visible day. Events that span across
  // midnight are split into two day buckets so each fragment renders correctly.
  const externalByDay = useMemo(() => {
    const map = new Map<string, PositionedExternal[]>();
    if (!gShown || !gStatus?.connected) return map;
    const weekStartMs = weekStart.getTime();
    const weekEndMs = addDays(weekStart, 7).getTime();
    for (const ev of gEvents) {
      const s0 = new Date(ev.startAt);
      const e0 = new Date(ev.endAt);
      if (e0.getTime() <= weekStartMs || s0.getTime() >= weekEndMs) continue;

      // Walk per day from start to end, clipping at day boundaries.
      let cursor = new Date(s0);
      cursor.setHours(0, 0, 0, 0); // start of the event's day
      // start from event start day, not midnight earlier
      cursor = new Date(s0);
      while (cursor < e0) {
        const dayKey = isoDay(cursor);
        const dayEnd = new Date(cursor); dayEnd.setHours(24, 0, 0, 0);
        const segStart = cursor;
        const segEnd = e0 < dayEnd ? e0 : dayEnd;
        if (!map.has(dayKey)) map.set(dayKey, []);
        map.get(dayKey)!.push({
          ev,
          start: new Date(segStart),
          end: new Date(segEnd),
          startMinOfDay: segStart.getHours() * 60 + segStart.getMinutes(),
          endMinOfDay: segEnd.getHours() === 0 && segEnd.getMinutes() === 0
            ? 24 * 60
            : segEnd.getHours() * 60 + segEnd.getMinutes(),
        });
        cursor = dayEnd;
      }
    }
    return map;
  }, [gEvents, gShown, gStatus?.connected, weekStart]);

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
    // eslint-disable-next-line react-hooks/purity -- event handler, runs on drop only
    if (newStart.getTime() < Date.now()) {
      setDraggingId(null); setDropTarget(null); return;
    }
    setProposalFor({ appointment: appt, newStart });
    setDraggingId(null);
    setDropTarget(null);
  };

  const dropPreviewTopPx = (minute: number) => (minute - hourMin * 60) * PX_PER_MIN;
  const dropPreviewHeightPx = () => DROP_SNAP_MIN * PX_PER_MIN;

  const handleGoogleConnect = async () => {
    setGConnecting(true); setGError(null);
    try {
      const { url } = await psychologistApi.googleAuthUrl();
      window.location.href = url;
    } catch (e) {
      setGError((e as Error).message);
      setGConnecting(false);
    }
  };

  const handleGoogleResync = async () => {
    setGLoading(true); setGError(null);
    try {
      await psychologistApi.googleResync();
      setRefreshNonce(x => x + 1);
      psychologistApi.googleStatus().then(setGStatus).catch(() => {});
    } catch (e) {
      setGError((e as Error).message);
    } finally {
      setGLoading(false);
    }
  };

  // Səhv hesabla qoşulubsa: köhnə bağlantını silib dərhal yenidən OAuth-a
  // yönləndiririk — select_account sayəsində Google hesab seçimi ekranı çıxır.
  const handleGoogleChangeAccount = async () => {
    setGConnecting(true); setGError(null);
    try {
      await psychologistApi.googleDisconnect();
      const { url } = await psychologistApi.googleAuthUrl();
      window.location.href = url;
    } catch (e) {
      setGError((e as Error).message);
      setGConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!window.confirm("Google Calendar bağlantısı kəsilsin? Mövcud hadisələr Google Calendar-da qalacaq, yeni seanslar daha sinxronlaşmayacaq.")) return;
    setGLoading(true); setGError(null);
    try {
      await psychologistApi.googleDisconnect();
      setGEvents([]);
      psychologistApi.googleStatus().then(setGStatus).catch(() => {});
    } catch (e) {
      setGError((e as Error).message);
    } finally {
      setGLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>{t("staff.psyCalendarTitle")}</h1>
          <p style={{ fontSize: 12.5, color: "var(--oxford-60)", margin: "3px 0 0", maxWidth: 580 }}>
            Gələcək təsdiqli/təyin edilmiş seansı sürükləyib başqa saata buraxaraq yenidən təklif edə bilərsiniz (15 dəq addımlarla).
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>
            {fmtDay(weekDays[0])} – {fmtDay(weekDays[6])}.{weekDays[6].getFullYear()}
          </span>
          <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--oxford-10)", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={navBtnStyle(true)} title="Əvvəlki həftə" aria-label="Əvvəlki həftə"><ChevronLeft /></button>
            <button onClick={() => setWeekStart(startOfWeek(new Date()))} style={{ ...navBtnStyle(true), width: "auto", padding: "0 12px", height: 34, fontSize: 12.5, fontWeight: 600, color: "var(--oxford)", borderLeft: "1px solid var(--oxford-10)", borderRight: "1px solid var(--oxford-10)" }}>Bu həftə</button>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={navBtnStyle(true)} title="Növbəti həftə" aria-label="Növbəti həftə"><ChevronRight /></button>
          </div>
          <button onClick={() => setRefreshNonce(x => x + 1)} style={navBtnStyle(false)} title="Yenilə" aria-label="Yenilə"><RefreshIcon /></button>
          {SHOW_GOOGLE_INTEGRATION && (
            <button
              onClick={gStatus?.connected ? handleGoogleResync : handleGoogleConnect}
              disabled={gConnecting || gLoading || (gStatus != null && !gStatus.configured)}
              title={gStatus != null && !gStatus.configured
                ? "İnteqrasiya hələ konfiqurasiya olunmayıb"
                : gStatus?.connected ? "Google Calendar hadisələrini yenilə" : "Google Calendar hesabınızı qoşun"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#fff", color: "var(--oxford)",
                border: "1px solid var(--oxford-10)", borderRadius: 10,
                padding: "0 14px", height: 36, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                cursor: gConnecting || gLoading ? "wait" : (gStatus != null && !gStatus.configured) ? "not-allowed" : "pointer",
                opacity: gStatus != null && !gStatus.configured ? 0.6 : 1,
              }}>
              <GoogleIcon size={15} />
              {gStatus?.connected
                ? (gLoading ? "Sinxronlaşdırılır…" : "Sinxronlaşdır")
                : (gConnecting ? "Yönləndirilir…" : "Google Calendar ilə sinxronlaşdır")}
            </button>
          )}
        </div>
      </div>

      {SHOW_GOOGLE_INTEGRATION && (
        <GoogleStatusBanner
          status={gStatus}
          loading={gLoading}
          shown={gShown}
          eventCount={gEvents.length}
          conflictCount={conflictIds.size}
          connecting={gConnecting}
          error={gError}
          onConnect={handleGoogleConnect}
          onResync={handleGoogleResync}
          onChangeAccount={handleGoogleChangeAccount}
          onDisconnect={handleGoogleDisconnect}
          onToggleShown={() => setGShown(s => !s)}
          onDismissError={() => setGError(null)}
          onShowConflicts={() => setShowConflicts(true)}
        />
      )}

      {loading ? (
        <CalendarSkeleton />
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, padding: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #EDF1F8" }}>
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
                  <div key={i} style={{ textAlign: "center", fontSize: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ fontWeight: 700, color: isToday ? "var(--brand)" : "var(--oxford)" }}>{DAYS_AZ[i]}</div>
                    <div style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      minWidth: 34, height: 22, padding: "0 8px", borderRadius: 999,
                      background: isToday ? "var(--brand)" : "transparent",
                      color: isToday ? "#fff" : "var(--oxford-60)",
                      fontWeight: isToday ? 700 : 500, fontSize: 11.5,
                    }}>{fmtDay(d)}</div>
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
                          borderTop: "1px dashed #E8EEF7",
                          height: 0,
                          pointerEvents: "none",
                        }} />
                      ))}
                      {/* 15 dəqiqəlik incə bölgülər — seansın saat kvadratının hansı
                          hissəsini tutduğu dəqiq oxunsun deyə */}
                      {hours.flatMap(h => [15, 45].map(m => (
                        <div key={`q-${h}-${m}`} style={{
                          position: "absolute",
                          left: 0, right: 0,
                          top: (h - hourMin) * HOUR_PX + (m / 60) * HOUR_PX,
                          borderTop: "1px dotted #F2F6FB",
                          height: 0,
                          pointerEvents: "none",
                        }} />
                      )))}

                      {/* Cari vaxt xətti — yalnız bugünkü sütunda */}
                      {isToday && (() => {
                        const now = new Date();
                        const nowMin = now.getHours() * 60 + now.getMinutes();
                        if (nowMin < hourMin * 60 || nowMin > hourMax * 60) return null;
                        const top = (nowMin - hourMin * 60) * PX_PER_MIN;
                        return (
                          <div style={{ position: "absolute", left: 0, right: 0, top, zIndex: 4, pointerEvents: "none" }}>
                            <div style={{ position: "absolute", left: -3, top: -4, width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} />
                            <div style={{ borderTop: "2px solid #EF4444" }} />
                          </div>
                        );
                      })()}

                      {/* Google external events (background layer) */}
                      {SHOW_GOOGLE_INTEGRATION && gShown && gStatus?.connected && (externalByDay.get(dayKey) ?? []).map((ex, idx) => {
                        const top = Math.max(0, (ex.startMinOfDay - hourMin * 60) * PX_PER_MIN);
                        const rawHeight = (ex.endMinOfDay - ex.startMinOfDay) * PX_PER_MIN;
                        const height = Math.max(18, rawHeight);
                        return (
                          <a key={`gx-${ex.ev.id}-${idx}`}
                            href={ex.ev.htmlLink ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => { if (!ex.ev.htmlLink) e.preventDefault(); }}
                            title={`Google: ${ex.ev.title}\n${fmtHM(ex.start)}–${fmtHM(ex.end)}`}
                            style={{
                              position: "absolute",
                              top, height,
                              left: 2, right: 2,
                              background: "repeating-linear-gradient(135deg, rgba(66,133,244,0.10) 0 6px, rgba(66,133,244,0.04) 6px 12px)",
                              border: "1px solid rgba(66,133,244,0.35)",
                              borderLeft: "3px solid #4285F4",
                              borderRadius: 6,
                              padding: "2px 6px",
                              fontSize: 10.5,
                              lineHeight: 1.25,
                              color: "#1E3A8A",
                              overflow: "hidden",
                              cursor: ex.ev.htmlLink ? "pointer" : "default",
                              textDecoration: "none",
                              zIndex: 1,
                            }}>
                            <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {ex.ev.title}
                            </div>
                            {height >= 36 && (
                              <div style={{ fontSize: 9.5, opacity: 0.7, marginTop: 1 }}>
                                {fmtHM(ex.start)}–{fmtHM(ex.end)} · Google
                              </div>
                            )}
                          </a>
                        );
                      })}

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
                        const hasConflict = conflictIds.has(a.id);
                        return (
                          <div key={a.id}
                            draggable={draggable}
                            onDragStart={e => handleDragStart(a, e)}
                            onDragEnd={handleDragEnd}
                            title={`${a.patientName ?? "—"} · ${fmtHM(ev.start)}–${fmtHM(ev.end)} · ${a.status}${hasConflict ? "\nGoogle Calendar ilə zaman üst-üstə düşür" : ""}${draggable ? "\nSürükləyib başqa vaxta burax" : ""}`}
                            style={{
                              position: "absolute",
                              top,
                              height,
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${widthPct}% - 4px)`,
                              background: colors.bg,
                              color: colors.fg,
                              border: hasConflict
                                ? "1px solid #DC2626"
                                : colors.dashed ? `1px dashed ${colors.fg}` : `1px solid ${colors.bg}`,
                              borderLeft: `3px solid ${hasConflict ? "#DC2626" : colors.fg}`,
                              borderRadius: 6,
                              padding: compact ? "1px 5px" : "4px 6px",
                              fontSize: 11,
                              lineHeight: 1.2,
                              overflow: "hidden",
                              opacity: a.status === "CANCELLED" ? 0.55 : isBeingDragged ? 0.4 : 1,
                              cursor: draggable ? "grab" : "default",
                              zIndex: 2,
                              boxShadow: hasConflict
                                ? "0 0 0 1px rgba(220, 38, 38, 0.25), 0 1px 2px rgba(220, 38, 38, 0.18)"
                                : isBeingDragged ? "none" : "0 1px 2px rgba(16,81,183,0.08)",
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
                                  <span>{fmtHM(ev.start)}–{fmtHM(ev.end)} {a.patientName ?? "—"}</span>
                                  {draggable && <span style={{ opacity: 0.55, display: "inline-flex", alignItems: "center" }}><GripIcon /></span>}
                                </div>
                              ) : (
                                <>
                                  <div style={{
                                    display: "flex", justifyContent: "space-between", gap: 4,
                                    fontSize: 10, opacity: 0.9, fontWeight: 700,
                                  }}>
                                    <span>{fmtHM(ev.start)}–{fmtHM(ev.end)}</span>
                                    {draggable && <span style={{ opacity: 0.55, display: "inline-flex", alignItems: "center" }}><GripIcon /></span>}
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
            <div style={{ display: "flex", gap: 14, marginTop: 14, paddingTop: 12, borderTop: "1px solid #EFF2F7", fontSize: 11.5, color: "var(--oxford-60)", flexWrap: "wrap" }}>
              <Legend label="Gözləmədə" bg="#FEF3C7" fg="#92400E" dashed />
              <Legend label="Təyin edilib" bg="#DBEAFE" fg="#1E40AF" />
              <Legend label="Təsdiqlənib" bg="#D1FAE5" fg="#065F46" />
              <Legend label="Tamamlanıb" bg="#E5E7EB" fg="#374151" />
              <Legend label="Ləğv olunub" bg="#FEE2E2" fg="#991B1B" />
              {SHOW_GOOGLE_INTEGRATION && gStatus?.connected && gShown && (
                <Legend label="Google hadisəsi" bg="rgba(66,133,244,0.10)" fg="#4285F4" />
              )}
              {SHOW_GOOGLE_INTEGRATION && conflictIds.size > 0 && (
                <Legend label="Konflikt" bg="#FEE2E2" fg="#DC2626" />
              )}
            </div>
          </div>
        </div>
      )}

      {proposalFor && (
        <DragProposalModal
          appointment={proposalFor.appointment}
          newStart={proposalFor.newStart}
          editable={proposalFor.editable}
          onClose={() => setProposalFor(null)}
          onSubmitted={() => { setProposalFor(null); setRefreshNonce(x => x + 1); }}
        />
      )}

      {showConflicts && (
        <ConflictModal
          pairs={conflictPairs}
          onClose={() => setShowConflicts(false)}
          onPropose={(a) => {
            setShowConflicts(false);
            if (a.startAt) setProposalFor({ appointment: a, newStart: new Date(a.startAt), editable: true });
          }}
        />
      )}
    </div>
  );
}

function GoogleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M21.8 12.2c0-.6-.1-1.2-.2-1.7H12v3.4h5.5c-.2 1.2-1 2.3-2 3v2.4h3.3c1.9-1.8 3-4.4 3-7.1z" fill="#4285F4"/>
      <path d="M12 22c2.7 0 5-.9 6.7-2.5l-3.3-2.4c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3v2.5C4.7 19.8 8.1 22 12 22z" fill="#34A853"/>
      <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.5H3C2.4 9 2 10.5 2 12s.4 3 1 4.5L6.4 14z" fill="#FBBC04"/>
      <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 2.9 14.6 2 12 2 8.1 2 4.7 4.2 3 7.5L6.4 10c.8-2.4 3-4.1 5.6-4.1z" fill="#EA4335"/>
    </svg>
  );
}

function GoogleStatusBanner({
  status, loading, shown, eventCount, conflictCount, connecting, error,
  onConnect, onResync, onChangeAccount, onDisconnect, onToggleShown, onDismissError, onShowConflicts,
}: {
  status: GoogleCalendarStatus | null;
  loading: boolean;
  shown: boolean;
  eventCount: number;
  conflictCount: number;
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
  onResync: () => void;
  onChangeAccount: () => void;
  onDisconnect: () => void;
  onToggleShown: () => void;
  onDismissError: () => void;
  onShowConflicts: () => void;
}) {
  const baseCard: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    padding: "10px 14px",
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 12.5,
  };

  // Still loading status — show a neutral placeholder so the slot is visible.
  if (!status) {
    return (
      <div style={{
        ...baseCard,
        background: "#F8FAFC", border: "1px solid #E2E8F0",
        color: "#475569",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "#fff", border: "1px solid #E2E8F0",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <GoogleIcon size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: "#1A2535" }}>Google Calendar</div>
          <div style={{ fontSize: 11.5, marginTop: 2 }}>Status yoxlanılır…</div>
        </div>
      </div>
    );
  }

  // Backend env not configured by admin (GOOGLE_CLIENT_ID etc. missing).
  if (!status.configured) {
    return (
      <div style={{
        ...baseCard,
        background: "#FFFBEB", border: "1px solid #FDE68A",
        color: "#854D0E",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "#fff", border: "1px solid #FDE68A",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <GoogleIcon size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700 }}>Google Calendar inteqrasiyası hələ konfiqurasiya olunmayıb</div>
          <div style={{ fontSize: 11.5, marginTop: 2 }}>
            Bu xidmətdən istifadə etmək üçün admin komandası backend-də{" "}
            <code style={{ fontSize: 11 }}>GOOGLE_CLIENT_ID</code>,{" "}
            <code style={{ fontSize: 11 }}>GOOGLE_CLIENT_SECRET</code> və{" "}
            <code style={{ fontSize: 11 }}>GOOGLE_REDIRECT_URI</code> dəyərlərini qurmalıdır.
          </div>
        </div>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div style={{
        ...baseCard,
        background: "linear-gradient(135deg, #F8FAFF 0%, #EFF6FF 100%)",
        border: "1px solid #DBEAFE",
        color: "#1E3A8A",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "#fff", border: "1px solid #DBEAFE",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <GoogleIcon size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, color: "#1E3A8A" }}>Google Calendar bağlı deyil</div>
          <div style={{ color: "#3B5BA5", fontSize: 11.5, marginTop: 2 }}>
            Şəxsi cədvəlinizi qoşduğunuz halda Fanus randevuları ilə konfliktlər avtomatik göstəriləcək.
          </div>
        </div>
        <button onClick={onConnect} disabled={connecting} style={{
          padding: "8px 14px", borderRadius: 8,
          border: "1px solid #DBEAFE", background: "#fff",
          color: "#1E3A8A", fontWeight: 600, fontSize: 12.5,
          cursor: connecting ? "wait" : "pointer", opacity: connecting ? 0.7 : 1,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <GoogleIcon size={13} /> {connecting ? "Yönləndirilir…" : "Google ilə qoşul"}
        </button>
        {error && (
          <div style={{
            width: "100%",
            background: "#FEF2F2", border: "1px solid #FECACA",
            color: "#991B1B",
            padding: "8px 10px", borderRadius: 8, fontSize: 11.5,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
          }}>
            <span>{error}</span>
            <button onClick={onDismissError} aria-label="Bağla" style={{
              border: 0, background: "transparent", color: "#991B1B",
              fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1,
            }}>×</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      ...baseCard,
      background: conflictCount > 0
        ? "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)"
        : "linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)",
      border: conflictCount > 0 ? "1px solid #FDE68A" : "1px solid #A7F3D0",
      color: conflictCount > 0 ? "#854D0E" : "#065F46",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: "#fff",
        border: conflictCount > 0 ? "1px solid #FDE68A" : "1px solid #A7F3D0",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <GoogleIcon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 700 }}>
          {status.email || "Google Calendar qoşulub"}
        </div>
        <div style={{ fontSize: 11.5, marginTop: 2, opacity: 0.85 }}>
          {loading
            ? "Yüklənir…"
            : eventCount > 0
              ? `Bu həftədə ${eventCount} hadisə`
              : "Bu həftədə hadisə yoxdur"}
          {conflictCount > 0 && (
            <> · <strong style={{ color: "#B45309" }}>{conflictCount} konflikt</strong></>
          )}
          {status.lastSyncAt && (
            <> · son sinxron {azFormatDateTime(status.lastSyncAt)}</>
          )}
        </div>
      </div>
      <label style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 12, fontWeight: 600,
        cursor: "pointer", userSelect: "none",
      }}>
        <input
          type="checkbox"
          checked={shown}
          onChange={onToggleShown}
          style={{ accentColor: "#4285F4", width: 14, height: 14 }}
        />
        Göstər
      </label>
      {conflictCount > 0 && (
        <button onClick={onShowConflicts} style={{
          padding: "7px 12px", borderRadius: 8,
          border: "1px solid #F59E0B",
          background: "#B45309",
          color: "#fff",
          fontWeight: 700, fontSize: 12,
          cursor: "pointer",
        }}>
          Konfliktləri həll et
        </button>
      )}
      <button onClick={onResync} disabled={loading} style={{
        padding: "7px 12px", borderRadius: 8,
        border: conflictCount > 0 ? "1px solid #FDE68A" : "1px solid #A7F3D0",
        background: "#fff",
        color: conflictCount > 0 ? "#854D0E" : "#065F46",
        fontWeight: 600, fontSize: 12,
        cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
      }}>
        {loading ? "Yüklənir…" : "Yenilə"}
      </button>
      <button onClick={onChangeAccount} disabled={connecting || loading} title="Başqa Google hesabı ilə qoşul" style={{
        padding: "7px 12px", borderRadius: 8,
        border: conflictCount > 0 ? "1px solid #FDE68A" : "1px solid #A7F3D0",
        background: "#fff",
        color: conflictCount > 0 ? "#854D0E" : "#065F46",
        fontWeight: 600, fontSize: 12,
        cursor: connecting ? "wait" : "pointer", opacity: connecting || loading ? 0.7 : 1,
      }}>
        {connecting ? "Yönləndirilir…" : "Hesabı dəyiş"}
      </button>
      <button onClick={onDisconnect} disabled={connecting || loading} title="Google Calendar bağlantısını kəs" style={{
        padding: "7px 12px", borderRadius: 8,
        border: "1px solid #FECACA",
        background: "#fff",
        color: "#B91C1C",
        fontWeight: 600, fontSize: 12,
        cursor: loading ? "wait" : "pointer", opacity: connecting || loading ? 0.7 : 1,
      }}>
        Bağlantını kəs
      </button>
      {error && (
        <div style={{
          width: "100%",
          background: "#FEF2F2", border: "1px solid #FECACA",
          color: "#991B1B",
          padding: "8px 10px", borderRadius: 8, fontSize: 11.5,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
        }}>
          <span>{error}</span>
          <button onClick={onDismissError} aria-label="Bağla" style={{
            border: 0, background: "transparent", color: "#991B1B",
            fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1,
          }}>×</button>
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

/** İkon naviqasiya düyməsi. `inGroup` — segment qrupunun içindədirsə (sərhədsiz). */
function navBtnStyle(inGroup: boolean): React.CSSProperties {
  return {
    width: 36, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: inGroup ? "none" : "1px solid var(--oxford-10)",
    borderRadius: inGroup ? 0 : 10,
    background: "#fff", color: "var(--oxford-60)", cursor: "pointer", fontFamily: "inherit", padding: 0,
    transition: "background .15s, color .15s",
  };
}

function ChevronLeft() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>;
}
function ChevronRight() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>;
}
function RefreshIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>;
}
/** Sürüklənə bilən seans üçün tutacaq ikonu (köhnə ⠿ simvolu əvəzinə). */
function GripIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="9" cy="5" r="1.7" /><circle cx="15" cy="5" r="1.7" /><circle cx="9" cy="12" r="1.7" /><circle cx="15" cy="12" r="1.7" /><circle cx="9" cy="19" r="1.7" /><circle cx="15" cy="19" r="1.7" /></svg>;
}

/** Yüklənmə skeleti — cədvəl strukturunu təqlid edir. */
function CalendarSkeleton() {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #EDF1F8" }}>
      <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: 8, marginBottom: 14 }}>
        <div />
        {Array.from({ length: 7 }).map((_, i) => <div key={i} style={{ height: 30, borderRadius: 8, background: "#F1F5F9" }} />)}
      </div>
      {Array.from({ length: 7 }).map((_, r) => (
        <div key={r} style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: 8, marginBottom: 10 }}>
          <div style={{ height: 42, borderRadius: 8, background: "#F8FAFC" }} />
          {Array.from({ length: 7 }).map((_, i) => <div key={i} style={{ height: 42, borderRadius: 8, background: "#F4F7FB" }} />)}
        </div>
      ))}
    </div>
  );
}

/* ─── Drag-to-reschedule proposal modal ──────────────────────────────────── */

function DragProposalModal({
  appointment, newStart, editable, onClose, onSubmitted,
}: {
  appointment: AppointmentDetail;
  newStart: Date;
  /** true → istifadəçi yeni vaxtı modal daxilində özü seçir (konflikt panelindən). */
  editable?: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [start, setStart] = useState<Date>(newStart);
  const [openedAt] = useState(() => new Date());

  const originalStart = appointment.startAt ? new Date(appointment.startAt) : null;
  const duration = (() => {
    if (appointment.startAt && appointment.endAt) {
      return new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime();
    }
    return 50 * 60_000;
  })();
  const newEnd = new Date(start.getTime() + duration);

  const submit = async () => {
    if (start.getTime() < openedAt.getTime()) {
      setErr("Keçmiş vaxta təklif göndərmək olmaz — başqa vaxt seçin.");
      return;
    }
    if (originalStart && start.getTime() === originalStart.getTime()) {
      setErr("Yeni vaxt köhnə vaxtla eynidir — başqa vaxt seçin.");
      return;
    }
    setSubmitting(true); setErr(null);
    try {
      await psychologistApi.proposeReschedule(appointment.id, {
        options: [{ startAt: start.toISOString(), endAt: newEnd.toISOString() }],
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
          {editable && (
            <>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
                Yeni vaxt
              </label>
              <input
                type="datetime-local"
                value={toInputValue(start)}
                min={toInputValue(openedAt)}
                onChange={e => { if (e.target.value) setStart(new Date(e.target.value)); }}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box" }}
              />
            </>
          )}
          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            <Row label="Köhnə saat" value={originalStart ? `${fmtFullDateTime(originalStart)}–${fmtHM(new Date(originalStart.getTime() + duration))}` : "—"} muted />
            <Row label="Yeni təklif" value={`${fmtFullDateTime(start)}–${fmtHM(newEnd)}`} highlight />
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

/** Date → datetime-local input dəyəri (lokal vaxt, dəqiqə dəqiqliyi). */
function toInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Konflikt paneli — hər Fanus seansı ilə üst-üstə düşən Google hadisələrini
 *  göstərir və iki həll yolu təklif edir: seansa yeni vaxt təklifi göndərmək
 *  (pasiyent təsdiqləməlidir) və ya şəxsi hadisəni Google Calendar-da açıb
 *  oradan köçürmək/silmək. */
function ConflictModal({
  pairs, onClose, onPropose,
}: {
  pairs: ConflictPair[];
  onClose: () => void;
  onPropose: (a: AppointmentDetail) => void;
}) {
  const [now] = useState(() => new Date());

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, maxWidth: 620, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1A2535", margin: 0 }}>
              Cədvəl konfliktləri{pairs.length > 0 ? ` (${pairs.length})` : ""}
            </h3>
            <p style={{ fontSize: 12, color: "#52718F", margin: "4px 0 0" }}>
              Fanus seansları şəxsi Google Calendar hadisələrinizlə üst-üstə düşür.
              Seansa yeni vaxt təklif edin (pasiyent təsdiqləməlidir) və ya şəxsi
              hadisənizi Google Calendar-da başqa vaxta köçürün.
            </p>
          </div>
          <button onClick={onClose} aria-label="Bağla" style={{ border: 0, background: "transparent", color: "#52718F", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, overflowY: "auto" }}>
          {pairs.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, fontSize: 13.5, color: "#52718F", fontWeight: 600 }}>
              Aktiv konflikt qalmayıb
            </div>
          ) : pairs.map(p => {
            const a = p.appointment;
            const colors = STATUS_COLOR[a.status] ?? STATUS_COLOR.PENDING;
            const proposable = DRAGGABLE_STATUSES.has(a.status) && p.start.getTime() > now.getTime();
            return (
              <div key={a.id} style={{ border: "1px solid #FECACA", borderLeft: "3px solid #DC2626", borderRadius: 12, padding: "13px 15px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1A2535" }}>
                    {fmtFullDateTime(p.start)}–{fmtHM(p.end)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1A2535" }}>
                    · {a.patientName ?? "Pasiyent"}
                  </span>
                  <span style={{ background: colors.bg, color: colors.fg, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>

                {p.events.map(ev => (
                  <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "rgba(66,133,244,0.06)", border: "1px solid rgba(66,133,244,0.25)", borderRadius: 8, padding: "7px 10px", marginBottom: 6, fontSize: 12.5 }}>
                    <GoogleIcon size={12} />
                    <span style={{ fontWeight: 600, color: "#1E3A8A", flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ev.title}
                    </span>
                    <span style={{ color: "#3B5BA5", fontWeight: 600 }}>
                      {fmtHM(new Date(ev.startAt))}–{fmtHM(new Date(ev.endAt))}
                    </span>
                    {ev.htmlLink && (
                      <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, fontWeight: 700, color: "#1E3A8A", textDecoration: "underline", whiteSpace: "nowrap" }}>
                        Google-da aç
                      </a>
                    )}
                  </div>
                ))}

                <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                  {proposable ? (
                    <button onClick={() => onPropose(a)} style={{
                      padding: "7px 13px", borderRadius: 8, border: "none",
                      background: "var(--brand)", color: "#fff",
                      fontWeight: 600, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer",
                    }}>
                      Yeni vaxt təklif et
                    </button>
                  ) : (
                    <span style={{ fontSize: 11.5, color: "#9CA3AF", fontWeight: 600, alignSelf: "center" }}>
                      {p.start.getTime() <= now.getTime()
                        ? "Seansın vaxtı keçib — vaxt təklifi mümkün deyil"
                        : "Bu statusda vaxt təklifi mümkün deyil"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
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
