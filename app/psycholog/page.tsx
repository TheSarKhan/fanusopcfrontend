"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  psychologistApi,
  type PsychologistStats,
  type AppointmentDetail,
  type Homework,
  type PackageDto,
} from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { formatAzn } from "@/lib/money";

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: "Yeni",        color: "#92400E", bg: "#FEF3C7" },
  ASSIGNED:  { label: "Sizə təyin",  color: "var(--brand-700)", bg: "var(--brand-100)" },
  CONFIRMED: { label: "Təsdiqli",    color: "#0F766E", bg: "#CCFBF1" },
  // Keçmiş seans avtomatik tamamlanır — bütün panellərlə eyni etiket ("Tamamlandı").
  // Bu, seansın uğurla baş tutduğunu yox, vaxtının keçdiyini bildirir.
  COMPLETED: { label: "Tamamlandı",  color: "var(--oxford-60)", bg: "var(--oxford-10)" },
  DISPUTED:  { label: "Mübahisəli",  color: "#991B1B", bg: "#FEE2E2" },
  CANCELLED: { label: "Ləğv",        color: "#991B1B", bg: "#FEE2E2" },
  REJECTED:  { label: "Rədd",        color: "#92400E", bg: "#FEF3C7" },
};

function greet(): string {
  const h = new Date().getHours();
  if (h < 6) return "Xoş gecələr";
  if (h < 12) return "Sabahınız xeyir";
  if (h < 18) return "Günortanız xeyir";
  return "Axşamınız xeyir";
}

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDayShort(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Bu gün";
  if (sameDay(d, tomorrow)) return "Sabah";
  const months = ["Yan","Fev","Mar","Apr","May","İyn","İyl","Avq","Sen","Okt","Noy","Dek"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function todayLabel() {
  const days = ["Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə"];
  const months = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
  const d = new Date();
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function PsychologDashboard() {
  const user = getStoredUser();
  const [stats, setStats] = useState<PsychologistStats | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDetail[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [pricing, setPricing] = useState<{ individualPrice: number | null; currency: string } | null>(null);
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      psychologistApi.stats(),
      psychologistApi.myAppointments(),
      psychologistApi.homework(),
      psychologistApi.myPricing(),
      psychologistApi.myPackages(),
    ]).then((results) => {
      if (!active) return;
      if (results[0].status === "fulfilled") setStats(results[0].value);
      if (results[1].status === "fulfilled") setAppointments(results[1].value);
      if (results[2].status === "fulfilled") setHomework(results[2].value);
      if (results[3].status === "fulfilled") setPricing(results[3].value);
      if (results[4].status === "fulfilled") setPackages(results[4].value);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const today = useMemo(() => {
    const now = new Date();
    return appointments
      .filter(a => a.startAt && isSameDay(new Date(a.startAt), now))
      .filter(a => !["CANCELLED", "REJECTED"].includes(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
  }, [appointments]);

  const upcoming = useMemo(() => {
    return appointments
      .filter(a => a.startAt && new Date(a.startAt).getTime() > now)
      .filter(a => !isSameDay(new Date(a.startAt!), new Date()))
      .filter(a => !["CANCELLED", "REJECTED"].includes(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())
      .slice(0, 4);
  }, [appointments, now]);

  const pendingRequests = useMemo(
    () => appointments.filter(a => a.status === "ASSIGNED" || a.status === "PENDING").length,
    [appointments]
  );
  const pendingHomework = useMemo(
    () => homework.filter(h => h.status === "PENDING").length,
    [homework]
  );
  const overdueHomework = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    return homework.filter(h => {
      if (h.status !== "PENDING" || !h.dueDate) return false;
      const due = new Date(h.dueDate + "T23:59:59");
      return due.getTime() < todayStart.getTime();
    }).length;
  }, [homework]);

  const completionRate = stats && stats.thisMonthTotal > 0
    ? Math.round((stats.thisMonthCompleted / stats.thisMonthTotal) * 100)
    : 0;

  return (
    <div>
      {/* ── Hero header ───────────────────────────────────────────────────────── */}
      <div
        className="psy-dash-hero"
        style={{
          background: "linear-gradient(135deg, var(--brand-700) 0%, var(--brand-600) 55%, var(--brand) 100%)",
          borderRadius: 18,
          padding: "26px 28px",
          color: "#fff",
          marginBottom: 22,
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(8, 47, 109, 0.22)",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute", right: -40, top: -40, width: 220, height: 220,
            background: "radial-gradient(circle, rgba(255,255,255,0.14), rgba(255,255,255,0) 70%)",
            borderRadius: "50%",
          }}
        />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase" }}>
              {todayLabel()}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "#fff" }}>
              {greet()}, Dr. {user?.firstName ?? "Psixoloq"}
            </h1>
            <p style={{ fontSize: 14, opacity: 0.82, margin: 0 }}>
              Bugünkü cədvəlinizə və müştərilərinizin son fəaliyyətinə nəzər salın.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
            <Link href="/psycholog/calendar" style={heroBtn(true)}>
              <IconCalendar /> Cədvəlim
            </Link>
            <Link href="/psycholog/availability" style={heroBtn(false)}>
              <IconClock /> İş vaxtları
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : (
        <>
          {/* ── Engagement strip — long-term metrics that motivate ───────────── */}
          <EngagementStrip stats={stats} />

          {/* ── Stat row ───────────────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
            <StatCard
              icon={<IconChart />}
              label="Bu ay seans"
              value={stats?.thisMonthTotal ?? 0}
              sub={`${stats?.thisMonthCompleted ?? 0} tamamlandı · ${completionRate}% bitirilib`}
            />
            <StatCard
              icon={<IconCalendar />}
              label="Bu həftə"
              value={stats?.thisWeekTotal ?? 0}
              sub="planlaşdırılmış seans"
            />
            <StatCard
              icon={<IconClock />}
              label="Yaxınlaşan"
              value={stats?.upcomingCount ?? 0}
              sub="növbəti randevular"
            />
            <StatCard
              icon={<IconUsers />}
              label="Aktiv müştəri"
              value={stats?.activeClientsLast90Days ?? 0}
              sub="son 90 gün"
            />
          </div>

          {/* ── Two-column layout ─────────────────────────────────────────────── */}
          <div className="psy-dash-2col" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 18, marginBottom: 22 }}>
            {/* Left: today's schedule + chart */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
              <Card>
                <CardHeader
                  title="Bu günkü cədvəl"
                  subtitle={today.length ? `${today.length} seans planlaşdırılıb` : "Bu gün heç bir seans yoxdur"}
                  right={<Link href="/psycholog/appointments" style={linkBtn}>Hamısı →</Link>}
                />
                {today.length === 0 ? (
                  <EmptyState
                    title="Bu gün cədvəliniz boşdur"
                    body="Sərbəst günü bilik artırmaq üçün istifadə edin və ya açıq vaxtlarınızı yeniləyin."
                  />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {today.slice(0, 5).map(a => (
                      <TodayRow key={a.id} a={a} />
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Son 30 gün — gündəlik aktivlik"
                  subtitle={stats ? `Cəmi ${stats.last30Days.reduce((s, d) => s + d.count, 0)} seans` : "—"}
                />
                <DailyChart data={stats?.last30Days ?? []} />
              </Card>
            </div>

            {/* Right: action items + upcoming */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
              <Card>
                <CardHeader title="Diqqət tələb edir" subtitle="Yığılmış işlər" />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <ActionRow
                    icon={<IconClipboard />}
                    title="Təsdiq gözləyən randevu"
                    count={pendingRequests}
                    href="/psycholog/appointments"
                    tone="brand"
                  />
                  <ActionRow
                    icon={<IconTarget />}
                    title={overdueHomework > 0 ? `Açıq tapşırıq (${overdueHomework} gecikib)` : "Açıq tapşırıq"}
                    count={pendingHomework}
                    href="/psycholog/homework"
                    tone={overdueHomework > 0 ? "danger" : "warning"}
                  />
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Yaxınlaşan randevular"
                  subtitle={upcoming.length ? "Növbəti günlər" : "Boşdur"}
                  right={<Link href="/psycholog/calendar" style={linkBtn}>Cədvəl →</Link>}
                />
                {upcoming.length === 0 ? (
                  <EmptyState title="Yaxınlaşan seans yoxdur" body="Yeni randevular əlavə olunduqda burada görünəcək." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {upcoming.map(a => <UpcomingRow key={a.id} a={a} />)}
                  </div>
                )}
              </Card>

              <PricingSummaryCard pricing={pricing} packages={packages} />
            </div>
          </div>

          {/* ── Quick actions ─────────────────────────────────────────────────── */}
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Sürətli giriş
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <QuickAction href="/psycholog/clients"  icon={<IconUsers />}   label="Müştərilər" />
              <QuickAction href="/psycholog/homework" icon={<IconTarget />}  label="Tapşırıqlar" badge={pendingHomework} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Engagement strip ───────────────────────────────────────────────────── */

function EngagementStrip({ stats }: { stats: PsychologistStats | null }) {
  const completion = stats?.completionRatePct ?? null;
  const rating = stats?.averageRating ?? null;
  const reviews = stats?.totalReviews ?? 0;
  const returning = stats?.returningClients ?? 0;
  const returningPct = stats?.returningClientsPct ?? null;
  const hours = stats?.sessionHoursThisMonth ?? 0;
  const streak = stats?.weeklyStreak ?? 0;

  return (
    <div className="psy-engage" style={{ marginBottom: 18 }}>
      <RingMetric
        label="Seans tamamlama"
        value={completion != null ? `${completion}%` : "—"}
        ringPct={completion ?? 0}
        sub="son 90 gün"
        tone="brand"
      />
      <RingMetric
        label="Orta reytinq"
        value={rating != null ? `${rating.toFixed(1)} ★` : "—"}
        ringPct={rating != null ? (rating / 5) * 100 : 0}
        sub={reviews > 0 ? `${reviews} rəyə əsasən` : "hələ rəy yoxdur"}
        tone="gold"
      />
      <RingMetric
        label="Qayıdan müştəri"
        value={String(returning)}
        ringPct={returningPct ?? 0}
        sub={returningPct != null ? `aktivlərin ${returningPct}%-i` : "son 90 gün"}
        tone="good"
      />
      <FlatMetric
        label="Bu ay klinik saat"
        value={`${hours}`}
        unit="saat"
        sub={hours > 0 ? "tamamlanmış seans müddətləri" : "hələ seans yoxdur"}
        icon={<IconClock />}
        tone="brand"
      />
      <FlatMetric
        label="Davamlılıq"
        value={String(streak)}
        unit={streak === 1 ? "həftə" : "həftə"}
        sub={streak > 0 ? "ardıcıl aktiv həftələr" : "yeni başlayın"}
        icon={<IconFlame />}
        tone={streak >= 4 ? "warm" : streak > 0 ? "brand" : "muted"}
      />
    </div>
  );
}

function RingMetric({
  label, value, ringPct, sub, tone,
}: {
  label: string;
  value: string;
  ringPct: number;
  sub: string;
  tone: "brand" | "gold" | "good";
}) {
  const pct = Math.max(0, Math.min(100, ringPct));
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const colors = {
    brand: { stroke: "var(--brand)",  track: "var(--brand-100)", fg: "var(--brand-700)" },
    gold:  { stroke: "#F59E0B",       track: "#FEF3C7",          fg: "#92400E" },
    good:  { stroke: "#10B981",       track: "#D1FAE5",          fg: "#065F46" },
  }[tone];
  return (
    <div className="psy-engage__card">
      <div className="psy-engage__ring">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke={colors.track} strokeWidth="6" />
          <circle cx="36" cy="36" r={r} fill="none"
            stroke={colors.stroke} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            transform="rotate(-90 36 36)" />
        </svg>
        <div className="psy-engage__ring-val" style={{ color: colors.fg }}>{value}</div>
      </div>
      <div className="psy-engage__body">
        <div className="psy-engage__label">{label}</div>
        <div className="psy-engage__sub">{sub}</div>
      </div>
    </div>
  );
}

function FlatMetric({
  label, value, unit, sub, icon, tone,
}: {
  label: string;
  value: string;
  unit: string;
  sub: string;
  icon: React.ReactNode;
  tone: "brand" | "warm" | "muted";
}) {
  const colors = {
    brand: { bg: "var(--brand-50)",  border: "var(--brand-100)", fg: "var(--brand-700)" },
    warm:  { bg: "#FEF3C7",          border: "#FDE68A",          fg: "#92400E" },
    muted: { bg: "var(--oxford-10)", border: "var(--oxford-10)", fg: "var(--oxford-60)" },
  }[tone];
  return (
    <div className="psy-engage__card">
      <div className="psy-engage__icon" style={{ background: colors.bg, borderColor: colors.border, color: colors.fg }}>
        {icon}
      </div>
      <div className="psy-engage__body">
        <div className="psy-engage__big">
          <span className="psy-engage__big-val">{value}</span>
          <span className="psy-engage__big-unit">{unit}</span>
        </div>
        <div className="psy-engage__label">{label}</div>
        <div className="psy-engage__sub">{sub}</div>
      </div>
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: 20,
      boxShadow: "0 2px 14px rgba(15, 23, 42, 0.06)",
      border: "1px solid var(--oxford-10)",
    }}>{children}</div>
  );
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

/** Uniform stat card: white background, navy left accent, monochrome brand icon. */
function StatCard({ icon, label, value, sub }:
  { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: 18,
      boxShadow: "0 2px 14px rgba(15, 23, 42, 0.06)",
      border: "1px solid var(--oxford-10)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
        background: "var(--brand)",
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: "var(--brand-50)", color: "var(--brand-700)",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid var(--brand-100)",
        }}>{icon}</div>
        <div style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: "var(--oxford)", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--oxford-60)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TodayRow({ a }: { a: AppointmentDetail }) {
  const badge = STATUS_BADGE[a.status] ?? { label: a.status, color: "var(--oxford-60)", bg: "var(--oxford-10)" };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
      borderRadius: 12, background: "var(--brand-50)", border: "1px solid var(--brand-100)",
    }}>
      <div style={{
        width: 56, textAlign: "center", padding: "6px 0", borderRadius: 10,
        background: "#fff", border: "1px solid var(--brand-100)",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{formatTime(a.startAt)}</div>
        <div style={{ fontSize: 10, color: "var(--oxford-60)" }}>{a.endAt ? formatTime(a.endAt) : "—"}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--oxford)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.patientName ?? "Müştəri"}
        </div>
        <div style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 2 }}>
          Onlayn seans
        </div>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999,
        color: badge.color, background: badge.bg, whiteSpace: "nowrap",
      }}>{badge.label}</span>
    </div>
  );
}

function UpcomingRow({ a }: { a: AppointmentDetail }) {
  return (
    <Link
      href="/psycholog/appointments"
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
        borderRadius: 12, background: "var(--brand-50)", border: "1px solid var(--brand-100)",
        textDecoration: "none", color: "inherit",
      }}
    >
      <div style={{
        width: 4, height: 38, borderRadius: 4,
        background: "var(--brand)",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.patientName ?? "Müştəri"}
        </div>
        <div style={{ fontSize: 11, color: "var(--oxford-60)", marginTop: 2 }}>
          {formatDayShort(a.startAt)} · {formatTime(a.startAt)}
        </div>
      </div>
    </Link>
  );
}

type ActionTone = "brand" | "warning" | "danger";
const ACTION_TONE: Record<ActionTone, { accent: string; bg: string; border: string }> = {
  brand:   { accent: "var(--brand-700)", bg: "var(--brand-50)",  border: "var(--brand-100)" },
  warning: { accent: "#92400E",          bg: "#FEF3C7",          border: "#FDE68A" },
  danger:  { accent: "#991B1B",          bg: "#FEE2E2",          border: "#FECACA" },
};

function ActionRow({ icon, title, count, href, tone }:
  { icon: React.ReactNode; title: string; count: number; href: string; tone: ActionTone }) {
  const empty = count === 0;
  const t = ACTION_TONE[tone];
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
      borderRadius: 12,
      background: empty ? "var(--brand-50)" : t.bg,
      border: `1px solid ${empty ? "var(--brand-100)" : t.border}`,
      textDecoration: "none", color: "inherit",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: empty ? "#fff" : "rgba(255,255,255,0.85)",
        color: empty ? "var(--brand-700)" : t.accent,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${empty ? "var(--brand-100)" : "rgba(255,255,255,0.6)"}`,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford)" }}>{title}</div>
        <div style={{ fontSize: 11, color: empty ? "var(--oxford-60)" : t.accent, marginTop: 2, fontWeight: empty ? 400 : 600 }}>
          {empty ? "Hər şey nizamındadır" : `${count} elementə baxılmalıdır`}
        </div>
      </div>
      {!empty && (
        <span style={{
          minWidth: 28, height: 28, borderRadius: 14, padding: "0 8px",
          background: t.accent, color: "#fff", fontSize: 12, fontWeight: 700,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>{count}</span>
      )}
    </Link>
  );
}

function QuickAction({ href, icon, label, badge }:
  { href: string; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <Link href={href} style={{
      position: "relative",
      background: "#fff",
      borderRadius: 14, padding: 18, color: "var(--oxford)", textDecoration: "none",
      border: "1px solid var(--oxford-10)",
      boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
      display: "flex", alignItems: "center", gap: 12,
      transition: "border-color 0.15s, box-shadow 0.15s",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: "var(--brand-50)", color: "var(--brand-700)",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid var(--brand-100)",
      }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
      {badge != null && badge > 0 && (
        <span style={{
          position: "absolute", top: 12, right: 12,
          minWidth: 22, height: 22, padding: "0 7px", borderRadius: 11,
          background: "var(--brand)", color: "#fff", fontSize: 11, fontWeight: 700,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>{badge}</span>
      )}
    </Link>
  );
}

/** Qiymət və paketlərin yığcam xülasəsi — redaktə Profil-də. */
function PricingSummaryCard({ pricing, packages }: {
  pricing: { individualPrice: number | null; currency: string } | null;
  packages: PackageDto[];
}) {
  const active = packages.filter(p => p.active);
  return (
    <Card>
      <CardHeader
        title="Qiymət və paketlər"
        subtitle="Cari təklifləriniz"
        right={<Link href="/psycholog/profile" style={linkBtn}>Düzəlt →</Link>}
      />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        padding: "10px 12px", borderRadius: 10,
        background: "var(--brand-50)", border: "1px solid var(--brand-100)",
        marginBottom: active.length ? 12 : 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: "#fff", color: "var(--brand-700)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--brand-100)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford)" }}>Fərdi seans</span>
        </div>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: "var(--oxford)" }}>
          {pricing?.individualPrice != null ? formatAzn(pricing.individualPrice) : "—"}
        </span>
      </div>
      {active.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--oxford-60)", textAlign: "center", padding: "4px 0" }}>Paket təyin edilməyib</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {active.slice(0, 4).map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--oxford)", fontWeight: 600 }}>
                {p.name} <span style={{ color: "var(--oxford-60)", fontWeight: 500 }}>· {p.sessionCount} seans</span>
              </span>
              <span style={{ fontWeight: 700, color: "var(--brand-700)", flex: "none" }}>{formatAzn(p.packagePrice)}</span>
            </div>
          ))}
          {active.length > 4 && (
            <div style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600 }}>+{active.length - 4} paket daha</div>
          )}
        </div>
      )}
    </Card>
  );
}

function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count));
  if (data.length === 0) {
    return <EmptyState title="Məlumat yoxdur" body="Aktivliyiniz burada görünəcək." />;
  }
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110 }}>
        {data.map((d, i) => {
          const h = (d.count / max) * 100;
          const date = new Date(d.date);
          const today = new Date();
          const isToday = isSameDay(date, today);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                <div
                  title={`${d.date}: ${d.count} seans`}
                  style={{
                    width: "100%",
                    background: isToday
                      ? "linear-gradient(180deg, var(--brand-700), var(--brand))"
                      : "linear-gradient(180deg, var(--brand-300), var(--brand-200))",
                    borderRadius: 4,
                    height: `${Math.max(3, h)}%`,
                    minHeight: 3,
                    transition: "all 0.2s",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "var(--oxford-60)" }}>
        <span>{shortDate(data[0]?.date)}</span>
        {data.length > 14 && <span>{shortDate(data[Math.floor(data.length / 2)]?.date)}</span>}
        <span>{shortDate(data[data.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

function shortDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 12px", color: "var(--oxford-60)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford)" }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>{body}</div>
    </div>
  );
}

function SkeletonGrid() {
  const block = (h: number) => (
    <div style={{ background: "#fff", borderRadius: 16, height: h, padding: 18,
      boxShadow: "0 2px 14px rgba(15,23,42,0.05)", border: "1px solid var(--oxford-10)" }}>
      <div style={{ width: "40%", height: 12, background: "var(--oxford-10)", borderRadius: 4, marginBottom: 10 }} />
      <div style={{ width: "70%", height: 22, background: "var(--brand-50)", borderRadius: 4 }} />
    </div>
  );
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
        {block(96)}{block(96)}{block(96)}{block(96)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
        {block(280)}{block(280)}
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "var(--brand-700)", textDecoration: "none",
  padding: "4px 10px", borderRadius: 8, background: "var(--brand-50)",
  border: "1px solid var(--brand-100)",
};

function heroBtn(primary: boolean): React.CSSProperties {
  return {
    fontSize: 13, fontWeight: 600, padding: "10px 16px", borderRadius: 10,
    background: primary ? "#fff" : "transparent",
    color: primary ? "var(--brand-700)" : "#fff",
    border: primary ? "1px solid #fff" : "1px solid rgba(255,255,255,0.45)",
    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
    boxShadow: primary ? "0 2px 8px rgba(0,0,0,0.10)" : "none",
  };
}

/* ─── Inline icons (no emojis — looks AI-generated otherwise) ───────────── */

const sw = { width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };

function IconCalendar() {
  return (
    <svg {...sw}><rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" /></svg>
  );
}
function IconClock() {
  return (<svg {...sw}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
}
function IconChart() {
  return (<svg {...sw}><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-7" /></svg>);
}
function IconUsers() {
  return (
    <svg {...sw}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg {...sw}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  );
}
function IconTarget() {
  return (<svg {...sw}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>);
}
function IconFlame() {
  return (
    <svg {...sw}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-1-2.6-2.5-3.5C7 7.6 6 6 6 4c3 0 5 2 6 4 1-2 2-4 5-4 0 5-3 8-6 8-1 1-2.5 1.5-2.5 2.5z" />
      <path d="M12 22c-3 0-6-2-6-5 0-2 1-3 2-4 .5 1 1 2 2 3 1 1 2 1 2 2 0 .5-.5 1-1 1.5" />
    </svg>
  );
}
