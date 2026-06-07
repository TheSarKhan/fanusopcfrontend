"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  operatorApi,
  type AppointmentDetail,
  type OperatorStats,
} from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { getStoredUser } from "@/lib/auth";
import { useT } from "@/lib/i18n/LocaleProvider";

const MONTHS_AZ = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
const DAYS_AZ = ["Bazar","Bazar ertəsi","Çərşənbə axşamı","Çərşənbə","Cümə axşamı","Cümə","Şənbə"];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function todayLabel() {
  const d = new Date();
  return `${DAYS_AZ[d.getDay()]}, ${d.getDate()} ${MONTHS_AZ[d.getMonth()]} ${d.getFullYear()}`;
}
function timeAgo(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 0) return "indi";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "indi";
  if (m < 60) return `${m} dəq`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat`;
  const d = Math.floor(h / 24);
  return `${d} gün`;
}
function fmtMin(n: number | null) {
  if (n == null) return "—";
  if (n < 60) return `${Math.round(n)} dəq`;
  const h = Math.floor(n / 60);
  const m = Math.round(n - h * 60);
  return `${h} s ${m > 0 ? m + " dəq" : ""}`.trim();
}

export default function OperatorDashboard() {
  const { t } = useT();
  const user = getStoredUser();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [activityScope, setActivityScope] = useState<"all" | "mine">("all");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = () => {
    setLoading(true);
    Promise.all([
      operatorApi.listAppointments(),
      operatorApi.stats().catch(() => null),
    ])
      .then(([list, s]) => { setItems(list); setStats(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    return subscribeNotifications((n) => {
      if (typeof n.type === "string" && n.type.startsWith("APPOINTMENT_")) load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Derived buckets ───────────────────────────────────────────────────
  const disputed = useMemo(
    () => items.filter(a => a.status === "DISPUTED")
      .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()),
    [items]
  );

  const rejected = useMemo(
    () => items.filter(a => a.status === "REJECTED")
      .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()),
    [items]
  );

  const pending = useMemo(
    () => items.filter(a => a.status === "PENDING")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [items]
  );

  const todayActive = useMemo(() => {
    return items
      .filter(a => a.startAt && isSameDay(new Date(a.startAt), now))
      .filter(a => ["ASSIGNED", "CONFIRMED", "AWAITING_CONFIRMATION"].includes(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
  }, [items, now]);

  const awaitingConfirm = useMemo(
    () => items.filter(a => a.status === "AWAITING_CONFIRMATION"),
    [items]
  );

  const stalePending = useMemo(() => {
    const cutoff = now.getTime() - 4 * 60 * 60_000; // 4h
    return pending.filter(a => new Date(a.createdAt).getTime() < cutoff);
  }, [pending, now]);

  /** Severity tiers: undefined < 4h · "warn" 4-24h · "warn-2" 24-48h · "danger" 48h+ */
  const staleSeverity = (a: AppointmentDetail): "warn" | "warn-2" | "danger" | undefined => {
    const ms = now.getTime() - new Date(a.createdAt).getTime();
    if (ms >= 48 * 60 * 60_000) return "danger";
    if (ms >= 24 * 60 * 60_000) return "warn-2";
    if (ms >= 4 * 60 * 60_000)  return "warn";
    return undefined;
  };

  const recentActions = useMemo(() => {
    let list = items.filter(a => a.assignedByOperatorId);
    if (activityScope === "mine" && user?.userId) {
      list = list.filter(a => a.assignedByOperatorId === user.userId);
    }
    return list
      .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
      .slice(0, 6);
  }, [items, activityScope, user?.userId]);

  const mineCount = useMemo(
    () => user?.userId ? items.filter(a => a.assignedByOperatorId === user.userId).length : 0,
    [items, user?.userId]
  );

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="op-dash-header">
        <div>
          <p className="op-dash-eyebrow">{todayLabel()}</p>
          <h1 className="op-dash-title">{t("staff.opDashTitle")}{user?.firstName ? ` · ${user.firstName}` : ""}</h1>
          <p className="op-dash-sub">{t("staff.opDashSub")}</p>
        </div>
        <div className="op-dash-actions">
          <Link href="/operator/appointments" className="op-dash-btn op-dash-btn--ghost">
            {t("staff.opViewAll")}
          </Link>
          <Link href="/operator/analytics" className="op-dash-btn op-dash-btn--ghost">
            <IconChart /> {t("nav.analytics")}
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 60, textAlign: "center", color: "var(--oxford-60)" }}>
          {t("common.loading")}
        </div>
      ) : (
        <>
          {/* ── KPI strip ─────────────────────────────────────────────────── */}
          <div className="op-dash-kpis">
            <Kpi
              icon={<IconClipboard />}
              label="Növbədə"
              value={pending.length}
              hint={stalePending.length > 0 ? `${stalePending.length} > 4 saat` : "yeni müraciətlər"}
              tone={stalePending.length > 0 ? "warn" : "neutral"}
              href="/operator/appointments"
            />
            <Kpi
              icon={<IconAlert />}
              label="Mübahisəli"
              value={disputed.length}
              hint={disputed.length > 0 ? "həll et" : "boşdur"}
              tone={disputed.length > 0 ? "danger" : "good"}
              href="/operator/appointments"
            />
            <Kpi
              icon={<IconRefresh />}
              label="Yenidən təyin"
              value={rejected.length}
              hint="psixoloq rədd etdi"
              tone={rejected.length > 0 ? "warn" : "neutral"}
              href="/operator/appointments"
            />
            <Kpi
              icon={<IconCheck />}
              label="Bu gün təyin"
              value={stats?.assignedToday ?? 0}
              hint="müraciət"
              tone="good"
            />
            <Kpi
              icon={<IconStopwatch />}
              label="Orta cavab"
              value={fmtMin(stats?.avgResponseMinutes ?? null)}
              hint="bu ay"
              tone="neutral"
            />
          </div>

          {/* ── Main grid ─────────────────────────────────────────────────── */}
          <div className="op-dash-grid">

            {/* Triage queue */}
            <div className="op-dash-col">
              {disputed.length === 0 && rejected.length === 0 && pending.length === 0 ? (
                <div className="op-dash-card op-dash-empty">
                  <div className="op-dash-empty-icon"><IconLeaf /></div>
                  <div className="op-dash-empty-title">Növbə boşdur</div>
                  <p className="op-dash-empty-sub">
                    Bütün müraciətlər həll edilib. Yeni müraciət gəldikdə burada görünəcək.
                  </p>
                </div>
              ) : (
                <>
                  {disputed.length > 0 && (
                    <QueueBlock
                      title="Acil həll et"
                      icon={<IconAlert />}
                      tone="danger"
                      count={disputed.length}
                      ctaText="Həll panelinə keç →"
                      ctaHref="/operator/appointments"
                    >
                      {disputed.slice(0, 4).map(a => (
                        <QueueRow key={a.id} a={a} now={now} kind="disputed" />
                      ))}
                      {disputed.length > 4 && <Overflow n={disputed.length - 4} />}
                    </QueueBlock>
                  )}

                  {rejected.length > 0 && (
                    <QueueBlock
                      title="Yenidən təyin lazımdır"
                      icon={<IconRefresh />}
                      tone="warn"
                      count={rejected.length}
                      ctaText="Hamısı →"
                      ctaHref="/operator/appointments"
                    >
                      {rejected.slice(0, 4).map(a => (
                        <QueueRow key={a.id} a={a} now={now} kind="rejected" />
                      ))}
                      {rejected.length > 4 && <Overflow n={rejected.length - 4} />}
                    </QueueBlock>
                  )}

                  {pending.length > 0 && (
                    <QueueBlock
                      title="Yeni müraciətlər"
                      icon={<IconClipboard />}
                      tone={stalePending.length > 0 ? "warn" : "brand"}
                      count={pending.length}
                      ctaText="Hamısı →"
                      ctaHref="/operator/appointments"
                    >
                      {pending.slice(0, 6).map(a => (
                        <QueueRow
                          key={a.id}
                          a={a}
                          now={now}
                          kind="pending"
                          severity={staleSeverity(a)}
                        />
                      ))}
                      {pending.length > 6 && <Overflow n={pending.length - 6} />}
                    </QueueBlock>
                  )}
                </>
              )}
            </div>

            {/* Right column */}
            <div className="op-dash-side">

              {/* Today */}
              <div className="op-dash-card">
                <div className="op-dash-card-head">
                  <h3>Bu gün</h3>
                  <span className="op-dash-card-meta">{todayActive.length} aktiv</span>
                </div>
                {todayActive.length === 0 ? (
                  <div className="op-dash-empty-mini">
                    Bu gün üçün təyin edilmiş seans yoxdur
                  </div>
                ) : (
                  <div className="op-dash-today-list">
                    {todayActive.slice(0, 5).map(a => {
                      const start = a.startAt ? new Date(a.startAt) : null;
                      const isAwaiting = a.status === "AWAITING_CONFIRMATION";
                      return (
                        <div key={a.id} className={`op-dash-today-row${isAwaiting ? " is-awaiting" : ""}`}>
                          <div className="op-dash-today-time">{start ? fmtTime(start.toISOString()) : "—"}</div>
                          <div className="op-dash-today-main">
                            <div className="op-dash-today-name">{a.patientName ?? "—"}</div>
                            <div className="op-dash-today-meta">
                              {a.psychologistName ?? "—"}
                              {isAwaiting && <span className="op-dash-pill op-dash-pill--warn">təsdiq</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {todayActive.length > 5 && <Overflow n={todayActive.length - 5} />}
                  </div>
                )}
                {awaitingConfirm.length > 0 && (
                  <div className="op-dash-today-foot">
                    <span><IconHourglass /> {awaitingConfirm.length} təsdiq gözləyir</span>
                    <Link href="/operator/appointments">izlə →</Link>
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="op-dash-card">
                <div className="op-dash-card-head">
                  <h3>Sürətli əməliyyatlar</h3>
                </div>
                <div className="op-dash-quick">
                  <Link href="/operator/appointments" className="op-dash-quick-btn">
                    <span><IconClipboard /></span>
                    <div>
                      <strong>Triage paneli</strong>
                      <small>Müraciətləri təyin et</small>
                    </div>
                  </Link>
                  <Link href="/operator/analytics" className="op-dash-quick-btn">
                    <span><IconChart /></span>
                    <div>
                      <strong>Analitika</strong>
                      <small>Performans və trend</small>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Stats summary */}
              {stats && (
                <div className="op-dash-card">
                  <div className="op-dash-card-head">
                    <h3>Bu ay</h3>
                  </div>
                  <div className="op-dash-month">
                    <div>
                      <span>Cəmi randevu</span>
                      <strong>{stats.totalThisMonth}</strong>
                    </div>
                    <div>
                      <span>Tamamlandı</span>
                      <strong style={{ color: "#065F46" }}>{stats.completedThisMonth}</strong>
                    </div>
                    <div>
                      <span>Rədd faizi</span>
                      <strong style={{ color: stats.rejectionRatePct && stats.rejectionRatePct > 15 ? "#DC2626" : "var(--oxford-80)" }}>
                        {stats.rejectionRatePct != null ? `${stats.rejectionRatePct}%` : "—"}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Recent activity ────────────────────────────────────────────── */}
          {recentActions.length > 0 && (
            <div className="op-dash-card" style={{ marginTop: 22 }}>
              <div className="op-dash-card-head">
                <h3>Son fəaliyyət</h3>
                <div className="op-dash-activity-tools">
                  <div className="op-dash-activity-scope" role="tablist">
                    <button type="button"
                      className={`op-dash-activity-scope-btn${activityScope === "all" ? " is-active" : ""}`}
                      onClick={() => setActivityScope("all")}>
                      Bütün operatorlar
                    </button>
                    <button type="button"
                      className={`op-dash-activity-scope-btn${activityScope === "mine" ? " is-active" : ""}`}
                      onClick={() => setActivityScope("mine")}
                      disabled={!user?.userId || mineCount === 0}>
                      Mənim ({mineCount})
                    </button>
                  </div>
                  <Link href="/operator/appointments" className="op-dash-card-link">Hamısı →</Link>
                </div>
              </div>
              <div className="op-dash-activity">
                {recentActions.map(a => (
                  <div key={a.id} className="op-dash-activity-row">
                    <span className="op-dash-activity-time">{timeAgo(a.updatedAt ?? a.createdAt, now)} əvvəl</span>
                    <span className="op-dash-activity-action">{statusVerb(a.status)}</span>
                    <span className="op-dash-activity-name">{a.patientName ?? "—"}</span>
                    <span className="op-dash-activity-psy">→ {a.psychologistName ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function Kpi({
  icon, label, value, hint, tone, href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  tone: "neutral" | "good" | "warn" | "danger";
  href?: string;
}) {
  const inner = (
    <>
      <div className="op-dash-kpi-top">
        <span className="op-dash-kpi-icon" data-tone={tone}>{icon}</span>
        <span className="op-dash-kpi-label">{label}</span>
      </div>
      <div className="op-dash-kpi-value" data-tone={tone}>{value}</div>
      {hint && <div className="op-dash-kpi-hint">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="op-dash-kpi" data-tone={tone}>{inner}</Link>
  ) : (
    <div className="op-dash-kpi" data-tone={tone}>{inner}</div>
  );
}

function QueueBlock({
  title, icon, tone, count, ctaText, ctaHref, children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "danger" | "warn" | "brand";
  count: number;
  ctaText: string;
  ctaHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="op-dash-card op-dash-queue" data-tone={tone}>
      <div className="op-dash-card-head">
        <div className="op-dash-queue-title">
          <span className="op-dash-queue-icon" data-tone={tone}>{icon}</span>
          <h3>{title}</h3>
          <span className="op-dash-queue-count" data-tone={tone}>{count}</span>
        </div>
        <Link href={ctaHref} className="op-dash-card-link">{ctaText}</Link>
      </div>
      <div className="op-dash-queue-list">{children}</div>
    </div>
  );
}

function QueueRow({
  a, now, kind, severity,
}: {
  a: AppointmentDetail;
  now: Date;
  kind: "disputed" | "rejected" | "pending";
  severity?: "warn" | "warn-2" | "danger";
}) {
  return (
    <Link href="/operator/appointments" className="op-dash-queue-row" data-severity={severity}>
      <div className="op-dash-queue-row-main">
        <div className="op-dash-queue-name">
          {a.patientName ?? "—"}
          <span className="op-dash-queue-id">#FNS-{String(a.id).padStart(4, "0")}</span>
          {severity === "danger" && (
            <span className="op-dash-queue-sev" data-severity="danger">48h+ gözləyir</span>
          )}
          {severity === "warn-2" && (
            <span className="op-dash-queue-sev" data-severity="warn-2">24h+ gözləyir</span>
          )}
        </div>
        <div className="op-dash-queue-meta">
          {kind === "disputed" && (
            <>
              <span className="op-dash-pill op-dash-pill--danger">Mübahisə</span>
              {a.disputeReason && (
                <span className="op-dash-queue-quote">«{a.disputeReason.slice(0, 60)}{a.disputeReason.length > 60 ? "…" : ""}»</span>
              )}
            </>
          )}
          {kind === "rejected" && (
            <>
              <span className="op-dash-pill op-dash-pill--warn">Rədd</span>
              {a.requestedPsychologistName && <span>İstənilən: {a.requestedPsychologistName}</span>}
              {a.note && <span className="op-dash-queue-quote">«{a.note.slice(0, 50)}…»</span>}
            </>
          )}
          {kind === "pending" && (
            <>
              {a.requestedPsychologistName ? (
                <span>İstənilən: <strong>{a.requestedPsychologistName}</strong></span>
              ) : (
                <span>Psixoloq seçilməyib</span>
              )}
              {a.note && <span className="op-dash-queue-quote">«{a.note.slice(0, 50)}…»</span>}
            </>
          )}
        </div>
      </div>
      <div className="op-dash-queue-time">
        {kind === "disputed"
          ? <span>{timeAgo(a.updatedAt ?? a.createdAt, now)} əvvəl</span>
          : kind === "rejected"
          ? <span>{timeAgo(a.updatedAt ?? a.createdAt, now)} əvvəl</span>
          : <span data-severity={severity}>{timeAgo(a.createdAt, now)} gözləyir</span>}
      </div>
    </Link>
  );
}

function Overflow({ n }: { n: number }) {
  return (
    <Link href="/operator/appointments" className="op-dash-overflow">
      +{n} daha →
    </Link>
  );
}

function statusVerb(status: string): string {
  switch (status) {
    case "ASSIGNED":              return "Təyin";
    case "CONFIRMED":             return "Təsdiqləndi";
    case "AWAITING_CONFIRMATION": return "Təsdiq gözlənir";
    case "DISPUTED":              return "Mübahisə";
    case "COMPLETED":             return "Tamamlandı";
    case "CANCELLED":             return "Ləğv";
    case "REJECTED":              return "Rədd";
    case "PENDING":               return "Yeni müraciət";
    default:                       return status;
  }
}

/* ─── Inline SVG icons (no emojis) ────────────────────────────────────── */
const SW = { fill: "none" as const, stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };
function IconClipboard() {
  return (<svg width="16" height="16" {...SW}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg>);
}
function IconAlert() {
  return (<svg width="16" height="16" {...SW} strokeWidth={2.2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>);
}
function IconRefresh() {
  return (<svg width="16" height="16" {...SW}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>);
}
function IconCheck() {
  return (<svg width="16" height="16" {...SW} strokeWidth={2.4}><polyline points="20 6 9 17 4 12" /></svg>);
}
function IconStopwatch() {
  return (<svg width="16" height="16" {...SW}><circle cx="12" cy="13" r="8" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="9" y1="2" x2="15" y2="2" /></svg>);
}
function IconChart() {
  return (<svg width="14" height="14" {...SW}><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-7" /></svg>);
}
function IconHourglass() {
  return (<svg width="14" height="14" {...SW}><path d="M5 2h14" /><path d="M5 22h14" /><path d="M7 2v3a5 5 0 0 0 10 0V2" /><path d="M7 22v-3a5 5 0 0 1 10 0v3" /></svg>);
}
function IconLeaf() {
  return (<svg width="36" height="36" {...SW} strokeWidth={1.4}><path d="M11 20A7 7 0 0 1 4 13c0-4 3-9 11-12 0 0 5 6 5 12a7 7 0 0 1-7 7c-2 0-4-1-5-3" /><path d="M2 22c4-1 7-4 9-8" /></svg>);
}
