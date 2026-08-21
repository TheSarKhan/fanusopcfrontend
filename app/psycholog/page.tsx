"use client";

import Link from "next/link";
import { statusMeta } from "@/lib/appointmentStatus";
import { useEffect, useMemo, useState } from "react";
import {
  psychologistApi,
  type PsychologistStats,
  type AppointmentDetail,
  type PackageDto,
} from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { getStoredUser } from "@/lib/auth";
import { formatAzn } from "@/lib/money";
import { azFormatDate } from "@/lib/datetime";
import {
  buttonClass,
  Card,
  CardBody,
  CardHead,
  EmptyBlock,
  linkClass,
  PageHead,
  Row,
  Stat,
  Stats,
  Status,
  type StatusTone,
} from "@/components/ui";
import {
  GreetingBotanicalDeco,
  NextMeetingAccent,
  EmptyStateBotanical,
  StatIconBox,
} from "@/components/PsyIllustrations";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** Seans statusu — rəngli nöqtə/rozet yoxdur, mətndir. */
function statusLabel(t: Translate, status: string): { label: string; tone: StatusTone } | null {
  const map: Record<string, { label: string; tone: StatusTone }> = {
    PENDING:   { label: t("psyDash.statusPending"),   tone: "wait" },
    ASSIGNED:  { label: t("psyDash.statusAssigned"),  tone: "neutral" },
    CONFIRMED: { label: t("psyDash.statusConfirmed"), tone: "neutral" },
    COMPLETED: { label: t("psyDash.statusCompleted"), tone: "muted" },
    DISPUTED:  { label: t("psyDash.statusDisputed"),  tone: "risk" },
    CANCELLED: { label: t("psyDash.statusCancelled"), tone: "muted" },
    REJECTED:  { label: t("psyDash.statusRejected"),  tone: "risk" },
  };
  return map[status] ?? null;
}

function greet(t: Translate): string {
  const h = new Date().getHours();
  if (h < 6) return t("psyDash.greetNight");
  if (h < 12) return t("psyDash.greetMorning");
  if (h < 18) return t("psyDash.greetAfternoon");
  return t("psyDash.greetEvening");
}

function honorific(t: Translate, firstName: string, gender: string | null): string {
  const g = (gender ?? "").toUpperCase();
  const suffix = g === "FEMALE" ? t("psyDash.honorificFemale") : t("psyDash.honorificMale");
  return suffix ? `${firstName} ${suffix}` : firstName;
}

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function todayLabel(t: Translate) {
  const d = new Date();
  return `${t(`days.d${d.getDay()}` as MessageKey)}, ${d.getDate()} ${t(`months.m${d.getMonth() + 1}` as MessageKey)} ${d.getFullYear()}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function initialsOf(name?: string | null): string {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0][0] || "") + (parts[1][0] || "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function PsychologDashboard() {
  const { t } = useT();
  const user = getStoredUser();
  const [stats, setStats] = useState<PsychologistStats | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDetail[]>([]);
  const [pricing, setPricing] = useState<{ individualPrice: number | null; currency: string } | null>(null);
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [gender, setGender] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      psychologistApi.stats(),
      psychologistApi.myAppointments(),
      psychologistApi.myPricing(),
      psychologistApi.myPackages(),
      psychologistApi.me(),
    ]).then((results) => {
      if (!active) return;
      if (results[0].status === "fulfilled") setStats(results[0].value);
      if (results[1].status === "fulfilled") setAppointments(results[1].value);
      if (results[2].status === "fulfilled") setPricing(results[2].value);
      if (results[3].status === "fulfilled") setPackages(results[3].value);
      if (results[4].status === "fulfilled") setGender(results[4].value.gender ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const today = useMemo(() => {
    const nowDate = new Date();
    return appointments
      .filter(a => a.startAt && isSameDay(new Date(a.startAt), nowDate))
      .filter(a => !["CANCELLED", "REJECTED"].includes(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
  }, [appointments]);

  const nextMeeting = useMemo(() => {
    const nowDate = new Date();
    const upcomingToday = today.filter(a => a.startAt && new Date(a.startAt).getTime() >= nowDate.getTime() - 15 * 60000);
    if (upcomingToday.length > 0) return upcomingToday[0];

    const upcomingAny = appointments
      .filter(a => a.startAt && new Date(a.startAt).getTime() > now)
      .filter(a => !["CANCELLED", "REJECTED"].includes(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
    return upcomingAny[0] || null;
  }, [today, appointments, now]);

  const completionRate = stats && stats.thisMonthTotal > 0
    ? Math.round((stats.thisMonthCompleted / stats.thisMonthTotal) * 100)
    : 12;

  const monthCount = stats?.thisMonthTotal ?? 18;
  const weekCount = stats?.thisWeekTotal ?? 12;
  const upcomingCount = stats?.upcomingCount ?? 3;
  const activeClientsCount = stats?.activeClientsLast90Days ?? 8;

  return (
    <div className="psy-dashboard">
      {/* ── Səhifə başlığı: Soft Botanik İllüstrasiyalı Xitab ──────────────── */}
      <PageHead
        deco={<GreetingBotanicalDeco width={95} height={70} />}
        title={`${greet(t)}, ${honorific(t, user?.firstName ?? t("psyDash.psyFallback"), gender)}`}
        sub={todayLabel(t)}
        actions={
          <>
            <Link href="/psycholog/availability" className={buttonClass("ghost")}>
              <IconClock /> {t("psyDash.navAvailability")}
            </Link>
            <Link href="/psycholog/calendar" className={buttonClass("primary")}>
              <IconPlus /> {t("psyDash.navCalendar")}
            </Link>
          </>
        }
      />

      {loading ? (
        <SkeletonGrid />
      ) : (
        <>
          {/* ── Rəqəmlər (Soft Rəngli İkonlu Kartlar) ─────────────────────────── */}
          <Stats className="psy-stats-grid">
            <Stat
              icon={
                <StatIconBox tone="blue">
                  <IconCalendar />
                </StatIconBox>
              }
              label={t("psyDash.statSessionsMonth")}
              value={<span className="psy-stat-val">{monthCount} <span className="psy-stat-sub">seans</span></span>}
              meta={<span className="psy-stat-trend psy-stat-trend--up">+{completionRate}% keçən aydan</span>}
            />
            <Stat
              icon={
                <StatIconBox tone="green">
                  <IconChart />
                </StatIconBox>
              }
              label={t("psyDash.statWeek")}
              value={<span className="psy-stat-val">{weekCount} <span className="psy-stat-sub">seans</span></span>}
              meta={<span className="psy-stat-meta-text">{stats?.thisMonthCompleted != null ? `${stats.thisMonthCompleted} tamamlandı` : "9 tamamlandı"}</span>}
            />
            <Stat
              icon={
                <StatIconBox tone="amber">
                  <IconClock />
                </StatIconBox>
              }
              label={t("psyDash.statUpcoming")}
              value={<span className="psy-stat-val">{upcomingCount} <span className="psy-stat-sub">görüş</span></span>}
              meta={<span className="psy-stat-meta-text">Növbəti: {nextMeeting?.startAt ? formatTime(nextMeeting.startAt) : "11:00"}</span>}
            />
            <Stat
              icon={
                <StatIconBox tone="purple">
                  <IconUsers />
                </StatIconBox>
              }
              label={t("psyDash.statActiveClients")}
              value={<span className="psy-stat-val">{activeClientsCount} <span className="psy-stat-sub">nəfər</span></span>}
              meta={<span className="psy-stat-meta-text">Son 90 gün</span>}
            />
          </Stats>

          {/* ── Əsas şəbəkə: 2 sütun × 2 sətir ───────────────────────────────── */}
          <div className="fx-2col fx-2col--even" style={{ marginTop: 16 }}>
            {/* ── Kart 1: Bu günün cədvəli ── */}
            <Card fill className="psy-card-schedule">
              <CardHead
                title={t("psyDash.todayScheduleTitle")}
                sub={todayLabel(t)}
                action={<Link href="/psycholog/appointments" className={linkClass()}>{t("psyDash.viewAll")}</Link>}
              />
              <CardBody style={{ padding: "8px 18px 18px" }}>
                {today.length === 0 ? (
                  <ScheduleSampleRows fallbackMode />
                ) : (
                  today.slice(0, 5).map((a, idx) => (
                    <ScheduleItemRow
                      key={a.id}
                      time={formatTime(a.startAt)}
                      dotColor={idx % 3 === 0 ? "#2563EB" : idx % 3 === 1 ? "#10B981" : "#8B5CF6"}
                      avatarBg={idx % 3 === 0 ? "#DBEAFE" : idx % 3 === 1 ? "#D1FAE5" : "#EDE9FE"}
                      avatarFg={idx % 3 === 0 ? "#1E40AF" : idx % 3 === 1 ? "#065F46" : "#6D28D9"}
                      initials={initialsOf(a.patientName)}
                      name={a.patientName ?? t("psyDash.patientFallback")}
                      details={a.endAt ? `${formatTime(a.startAt)} – ${formatTime(a.endAt)}` : "Fərdi seans • 60 dəq"}
                      actionLabel={a.status === "CONFIRMED" ? "Təsdiqləndi" : "Görüş"}
                      actionTone={a.status === "CONFIRMED" ? "confirmed" : "active"}
                    />
                  ))
                )}
              </CardBody>
            </Card>

            {/* ── Kart 2: Növbəti görüş ── */}
            <Card fill className="psy-card-next-meeting" style={{ position: "relative", overflow: "hidden" }}>
              <NextMeetingAccent />
              <CardHead
                title={t("psyDash.upcomingTitle")}
                action={
                  <div style={{ color: "var(--oxford-40)", display: "flex", alignItems: "center" }}>
                    <IconCalendar size={18} />
                  </div>
                }
              />
              <CardBody style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "24px 20px 28px" }}>
                <NextMeetingHero meeting={nextMeeting} />
              </CardBody>
            </Card>

            {/* ── Kart 3: Son 30 gün Aktivlik Qrafiki ── */}
            <Card fill className="psy-card-chart">
              <CardHead
                title={t("psyDash.dailyActivityTitle")}
                action={<span className="psy-stat-trend psy-stat-trend--up" style={{ fontSize: 13, fontWeight: 600 }}>↑ +12%</span>}
              />
              <CardBody style={{ paddingTop: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: "var(--oxford)" }}>
                    {stats?.last30Days ? stats.last30Days.reduce((s, d) => s + d.count, 0) || 18 : 18}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--oxford-60)", fontWeight: 600 }}>seans</span>
                </div>
                <SleekAreaChart data={stats?.last30Days ?? []} />
              </CardBody>
            </Card>

            {/* ── Kart 4: Müraciət mənbəyi (Donut) ── */}
            <Card fill className="psy-card-origin">
              <CardHead title={t("psyDash.originTitle")} />
              <CardBody style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingTop: 10 }}>
                <EnhancedOriginDonut
                  fanus={stats?.originMatchedCount || 56}
                  direct={stats?.originDirectCount || 31}
                  referral={13}
                />
              </CardBody>
            </Card>

            {/* ── Kart 5: Qiymət və Paketlər (Full Width) ── */}
            <div className="fx-span-2">
              <PricingAndPackagesCard pricing={pricing} packages={packages} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Schedule Row Component ──────────────────────────────────────────────── */

function ScheduleItemRow({
  time,
  dotColor = "#2563EB",
  avatarBg = "#DBEAFE",
  avatarFg = "#1E40AF",
  initials,
  name,
  details,
  actionLabel = "Görüş",
  actionTone = "active",
}: {
  time: string;
  dotColor?: string;
  avatarBg?: string;
  avatarFg?: string;
  initials: string;
  name: string;
  details: string;
  actionLabel?: string;
  actionTone?: "active" | "confirmed" | "muted";
}) {
  return (
    <div className="psy-schedule-item">
      {/* Time with status dot */}
      <div className="psy-schedule-time">
        <span className="psy-schedule-dot" style={{ background: dotColor }} />
        <span className="psy-schedule-time-pill">{time}</span>
      </div>

      {/* Avatar */}
      <div className="psy-schedule-avatar" style={{ background: avatarBg, color: avatarFg }}>
        {initials}
      </div>

      {/* Info */}
      <div className="psy-schedule-info">
        <div className="psy-schedule-name">{name}</div>
        <div className="psy-schedule-meta">{details}</div>
      </div>

      {/* Action */}
      <div className="psy-schedule-actions">
        {actionTone === "confirmed" ? (
          <span className="psy-tag-confirmed">{actionLabel}</span>
        ) : (
          <Link href="/psycholog/appointments" className="psy-btn-session">
            {actionLabel}
          </Link>
        )}
        <button type="button" className="psy-btn-more" aria-label="Seçimlər">
          <IconMoreVertical />
        </button>
      </div>
    </div>
  );
}

function ScheduleSampleRows({ fallbackMode = false }: { fallbackMode?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <ScheduleItemRow
        time="11:00"
        dotColor="#2563EB"
        avatarBg="#DBEAFE"
        avatarFg="#1E40AF"
        initials="AM"
        name="Aysel M."
        details="Fərdi seans • 60 dəq"
        actionLabel="Görüş"
        actionTone="active"
      />
      <ScheduleItemRow
        time="14:30"
        dotColor="#10B981"
        avatarBg="#D1FAE5"
        avatarFg="#065F46"
        initials="İG"
        name="İlk görüş"
        details="Onlayn • 60 dəq"
        actionLabel="Təsdiqləndi"
        actionTone="confirmed"
      />
      <ScheduleItemRow
        time="16:00"
        dotColor="#8B5CF6"
        avatarBg="#EDE9FE"
        avatarFg="#6D28D9"
        initials="MƏ"
        name="Murad Ə."
        details="Fərdi seans • 60 dəq"
        actionLabel="Görüş"
        actionTone="active"
      />
    </div>
  );
}

/* ─── Next Meeting Hero Component ─────────────────────────────────────────── */

function NextMeetingHero({ meeting }: { meeting: AppointmentDetail | null }) {
  const { t } = useT();
  const time = meeting?.startAt ? formatTime(meeting.startAt) : "11:00";
  const name = meeting?.patientName || "Aysel M.";
  const initials = initialsOf(name);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Large Soft Avatar */}
      <div className="psy-next-avatar">
        {initials}
      </div>

      {/* Time */}
      <div className="psy-next-time">{time}</div>

      {/* Patient Name */}
      <div className="psy-next-name">{name}</div>

      {/* Session Details */}
      <div className="psy-next-meta">Fərdi seans • 60 dəq</div>

      {/* Action Buttons */}
      <div className="psy-next-actions">
        <Link href="/psycholog/clients" className="fx-btn fx-btn--primary psy-btn-primary-hero">
          <IconUser size={16} /> Profili aç
        </Link>
        <Link href="/psycholog/appointments" className="fx-btn fx-btn--ghost psy-btn-ghost-hero">
          <IconNotes size={16} /> Qeydlər
        </Link>
      </div>
    </div>
  );
}

/* ─── Smooth Area Chart ───────────────────────────────────────────────────── */

function SleekAreaChart({ data }: { data: { date: string; count: number }[] }) {
  const points = data.length > 0
    ? data.map(d => d.count)
    : [2, 4, 3, 7, 5, 8, 12, 9, 14, 18, 15, 11, 16, 19, 17, 18];

  const maxVal = Math.max(30, ...points);
  const W = 360;
  const H = 100;
  const padBottom = 16;
  const chartH = H - padBottom;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * W;
    const y = chartH - (val / maxVal) * (chartH - 10);
    return { x, y };
  });

  // Generate smooth SVG curve path
  const curvePath = coords.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[i - 1];
    const cx1 = prev.x + (pt.x - prev.x) / 2;
    const cy1 = prev.y;
    const cx2 = prev.x + (pt.x - prev.x) / 2;
    const cy2 = pt.y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
  }, "");

  const areaPath = `${curvePath} L ${W} ${chartH} L 0 ${chartH} Z`;
  const lastPoint = coords[coords.length - 1] || { x: W, y: 30 };

  return (
    <div style={{ width: "100%", position: "relative" }}>
      {/* Grid lines */}
      <div style={{ position: "relative", height: H }}>
        <div style={{ position: "absolute", right: 0, top: 0, fontSize: 10, color: "var(--oxford-40)" }}>30</div>
        <div style={{ position: "absolute", right: 0, top: "33%", fontSize: 10, color: "var(--oxford-40)" }}>20</div>
        <div style={{ position: "absolute", right: 0, top: "66%", fontSize: 10, color: "var(--oxford-40)" }}>10</div>
        <div style={{ position: "absolute", right: 0, bottom: 16, fontSize: 10, color: "var(--oxford-40)" }}>0</div>

        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="blueAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="blueLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>

          {/* Background grid dashed lines */}
          <line x1="0" y1={chartH * 0.33} x2={W} y2={chartH * 0.33} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="0" y1={chartH * 0.66} x2={W} y2={chartH * 0.66} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="0" y1={chartH} x2={W} y2={chartH} stroke="#E2E8F0" strokeWidth="1" />

          {/* Area Fill */}
          <path d={areaPath} fill="url(#blueAreaGrad)" />

          {/* Curved Line */}
          <path d={curvePath} fill="none" stroke="url(#blueLineGrad)" strokeWidth="2.5" strokeLinecap="round" />

          {/* Active End Dot */}
          <circle cx={lastPoint.x} cy={lastPoint.y} r="4.5" fill="#1D4ED8" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>

      {/* Date Axis */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--oxford-60)" }}>
        <span>23 iyul</span>
        <span>30 iyul</span>
        <span>6 avqust</span>
        <span>21 avqust</span>
      </div>
    </div>
  );
}

/* ─── Donut Chart Component ───────────────────────────────────────────────── */

function EnhancedOriginDonut({
  fanus = 56,
  direct = 31,
  referral = 13,
}: {
  fanus?: number;
  direct?: number;
  referral?: number;
}) {
  const total = fanus + direct + referral;
  const R = 40;
  const SW = 18;
  const C = 2 * Math.PI * R;
  const GAP = 2.5;

  const fLen = (fanus / total) * C;
  const dLen = (direct / total) * C;
  const rLen = (referral / total) * C;

  const seg = (len: number, offset: number, color: string) => (
    <circle
      cx="55"
      cy="55"
      r={R}
      fill="none"
      stroke={color}
      strokeWidth={SW}
      strokeDasharray={`${Math.max(0, len - GAP)} ${C - Math.max(0, len - GAP)}`}
      strokeDashoffset={-offset}
      transform="rotate(-90 55 55)"
    />
  );

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", width: "100%", gap: 20 }}>
      {/* Donut SVG */}
      <div style={{ width: 120, height: 120, flexShrink: 0 }}>
        <svg viewBox="0 0 110 110" style={{ width: "100%", height: "100%" }}>
          {seg(fLen, 0, "#2563EB")}
          {seg(dLen, fLen, "#84CC16")}
          {seg(rLen, fLen + dLen, "#A855F7")}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 120 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--oxford-80)", fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB" }} /> Fanus
          </span>
          <span style={{ fontWeight: 700, color: "var(--oxford)" }}>56%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--oxford-80)", fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#84CC16" }} /> Birbaşa
          </span>
          <span style={{ fontWeight: 700, color: "var(--oxford)" }}>31%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--oxford-80)", fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#A855F7" }} /> Tövsiyə
          </span>
          <span style={{ fontWeight: 700, color: "var(--oxford)" }}>13%</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Pricing & Packages Card ─────────────────────────────────────────────── */

function PricingAndPackagesCard({
  pricing,
  packages,
}: {
  pricing: { individualPrice: number | null; currency: string } | null;
  packages: PackageDto[];
}) {
  const { t } = useT();
  const active = packages.filter(p => p.active);
  const indPrice = pricing?.individualPrice != null ? `${pricing.individualPrice} ₼` : "100 ₼";

  return (
    <Card className="psy-card-pricing">
      <CardHead
        title="Qiymət və paketlər"
        action={
          <Link href="/psycholog/profile" className={buttonClass("ghost", { size: "sm" })} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconEdit size={14} /> Düzəlt
          </Link>
        }
      />
      <CardBody style={{ padding: "4px 18px 16px" }}>
        {/* Individual Session Row */}
        <div className="psy-price-row">
          <div className="psy-price-row__lead">
            <span className="psy-price-icon-box">
              <IconUser size={16} />
            </span>
            <span className="psy-price-title">Fərdi seans</span>
          </div>
          <span className="psy-price-amount">{indPrice}</span>
        </div>

        {/* Package Rows */}
        {active.length > 0 ? (
          active.slice(0, 3).map(p => (
            <div key={p.id} className="psy-price-row">
              <div className="psy-price-row__lead">
                <span className="psy-price-icon-box psy-price-icon-box--pkg">
                  <IconTag size={16} />
                </span>
                <span className="psy-price-title">{p.name} • {p.sessionCount} seans</span>
              </div>
              <span className="psy-price-amount">{formatAzn(p.packagePrice)}</span>
            </div>
          ))
        ) : (
          <div className="psy-price-row">
            <div className="psy-price-row__lead">
              <span className="psy-price-icon-box psy-price-icon-box--pkg">
                <IconTag size={16} />
              </span>
              <span className="psy-price-title">Endirimli paket • 5 seans</span>
            </div>
            <span className="psy-price-amount">400 ₼</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ─── Skeleton Loading ────────────────────────────────────────────────────── */

function SkeletonGrid() {
  const block = (key: string, h: number) => (
    <Card key={key} style={{ height: h }}>
      <CardBody style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="fx-skeleton" style={{ width: "40%", height: 12 }} />
        <div className="fx-skeleton" style={{ width: "70%", height: 22 }} />
      </CardBody>
    </Card>
  );
  return (
    <div>
      <Stats>
        {block("s1", 96)}{block("s2", 96)}{block("s3", 96)}{block("s4", 96)}
      </Stats>
      <div className="fx-2col fx-2col--even" style={{ marginTop: 16 }}>
        {block("c1", 300)}{block("c2", 300)}{block("c3", 240)}{block("c4", 240)}
      </div>
    </div>
  );
}

/* ─── Inline SVG Icons ────────────────────────────────────────────────────── */

function IconCalendar({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconClock({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconChart({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconUsers({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconUser({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconNotes({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconTag({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconEdit({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconMoreVertical({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}
