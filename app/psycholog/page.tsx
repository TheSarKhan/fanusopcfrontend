"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  psychologistApi,
  type PsychologistStats,
  type AppointmentDetail,
  type ChatThread,
  type Homework,
} from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: "Yeni",        color: "#92400E", bg: "#FEF3C7" },
  ASSIGNED:  { label: "Sizə təyin",  color: "#1E40AF", bg: "#DBEAFE" },
  CONFIRMED: { label: "Təsdiqli",    color: "#065F46", bg: "#D1FAE5" },
  COMPLETED: { label: "Bitdi",       color: "#374151", bg: "#F3F4F6" },
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
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      psychologistApi.stats(),
      psychologistApi.myAppointments(),
      psychologistApi.chatThreads(),
      psychologistApi.homework(),
    ]).then((results) => {
      if (!active) return;
      if (results[0].status === "fulfilled") setStats(results[0].value);
      if (results[1].status === "fulfilled") setAppointments(results[1].value);
      if (results[2].status === "fulfilled") setThreads(results[2].value);
      if (results[3].status === "fulfilled") setHomework(results[3].value);
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
    const now = Date.now();
    return appointments
      .filter(a => a.startAt && new Date(a.startAt).getTime() > now)
      .filter(a => !isSameDay(new Date(a.startAt!), new Date()))
      .filter(a => !["CANCELLED", "REJECTED"].includes(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())
      .slice(0, 4);
  }, [appointments]);

  const pendingRequests = useMemo(
    () => appointments.filter(a => a.status === "ASSIGNED" || a.status === "PENDING").length,
    [appointments]
  );
  const totalUnread = useMemo(
    () => threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0),
    [threads]
  );
  const pendingHomework = useMemo(
    () => homework.filter(h => h.status === "PENDING").length,
    [homework]
  );

  const completionRate = stats && stats.thisMonthTotal > 0
    ? Math.round((stats.thisMonthCompleted / stats.thisMonthTotal) * 100)
    : 0;

  return (
    <div>
      {/* ── Hero header ───────────────────────────────────────────────────────── */}
      <div
        className="psy-dash-hero"
        style={{
          background: "linear-gradient(135deg, var(--brand-700) 0%, var(--brand-600) 60%, var(--brand) 100%)",
          borderRadius: 18,
          padding: "26px 28px",
          color: "#fff",
          marginBottom: 22,
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(8, 47, 109, 0.25)",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute", right: -40, top: -40, width: 220, height: 220,
            background: "radial-gradient(circle, rgba(255,255,255,0.18), rgba(255,255,255,0) 70%)",
            borderRadius: "50%",
          }}
        />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 500, letterSpacing: 0.4, textTransform: "uppercase" }}>
              {todayLabel()}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px" }}>
              {greet()}, Dr. {user?.firstName ?? "Psixoloq"}
            </h1>
            <p style={{ fontSize: 14, opacity: 0.78, margin: 0 }}>
              Bugünkü cədvəlinizə və müştərilərinizin son fəaliyyətinə nəzər salın.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/psycholog/calendar" style={heroBtn(true)}>🗓️ Cədvəlim</Link>
            <Link href="/psycholog/availability" style={heroBtn(false)}>🕓 Açıq vaxtlar</Link>
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : (
        <>
          {/* ── Stat row ───────────────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
            <StatCard
              icon="📈"
              label="Bu ay seans"
              value={stats?.thisMonthTotal ?? 0}
              sub={`${stats?.thisMonthCompleted ?? 0} tamamlandı · ${completionRate}% bitirilib`}
              accent="var(--brand)"
              bg="linear-gradient(135deg, #EEF0FF 0%, #F7F4FF 100%)"
            />
            <StatCard
              icon="🗓️"
              label="Bu həftə"
              value={stats?.thisWeekTotal ?? 0}
              sub="planlaşdırılmış seans"
              accent="#1E3A5F"
              bg="linear-gradient(135deg, #E5F0FF 0%, #F0F7FF 100%)"
            />
            <StatCard
              icon="⏳"
              label="Yaxınlaşan"
              value={stats?.upcomingCount ?? 0}
              sub="növbəti randevular"
              accent="#065F46"
              bg="linear-gradient(135deg, #DCFCE7 0%, #F0FDF4 100%)"
            />
            <StatCard
              icon="👥"
              label="Aktiv müştəri"
              value={stats?.activeClientsLast90Days ?? 0}
              sub="son 90 gün"
              accent="#92400E"
              bg="linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%)"
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
                    icon="🌿"
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
                    icon="📋"
                    title="Təsdiq gözləyən randevu"
                    count={pendingRequests}
                    href="/psycholog/appointments"
                    accent="#1E40AF"
                    bg="#DBEAFE"
                  />
                  <ActionRow
                    icon="💬"
                    title="Oxunmamış mesaj"
                    count={totalUnread}
                    href="/psycholog/chat"
                    accent="var(--brand)"
                    bg="#EDE9FE"
                  />
                  <ActionRow
                    icon="🎯"
                    title="Açıq tapşırıq"
                    count={pendingHomework}
                    href="/psycholog/homework"
                    accent="#92400E"
                    bg="#FEF3C7"
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
                  <EmptyState icon="📭" title="Yaxınlaşan seans yoxdur" body="Yeni randevular əlavə olunduqda burada görünəcək." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {upcoming.map(a => <UpcomingRow key={a.id} a={a} />)}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* ── Quick actions ─────────────────────────────────────────────────── */}
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#52718F", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Sürətli giriş
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <QuickAction href="/psycholog/clients"   icon="👥" label="Müştərilər"   tone="violet" />
              <QuickAction href="/psycholog/chat"      icon="💬" label="Mesajlar"     tone="blue"   badge={totalUnread} />
              <QuickAction href="/psycholog/homework"  icon="🎯" label="Tapşırıqlar"  tone="amber"  badge={pendingHomework} />
              <QuickAction href="/psycholog/resources" icon="📚" label="Resurslar"    tone="emerald" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: 20,
      boxShadow: "0 2px 14px rgba(15, 23, 42, 0.06)",
      border: "1px solid rgba(226, 232, 240, 0.7)",
    }}>{children}</div>
  );
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1A2535" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "#8AAABF", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent, bg }:
  { icon: string; label: string; value: number; sub?: string; accent: string; bg: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: 18,
      boxShadow: "0 2px 14px rgba(15, 23, 42, 0.06)",
      border: "1px solid rgba(226, 232, 240, 0.7)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: bg, opacity: 0.55 }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>{icon}</div>
          <div style={{ fontSize: 11, color: "#52718F", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {label}
          </div>
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: accent, lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: "#52718F", marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  );
}

function TodayRow({ a }: { a: AppointmentDetail }) {
  const badge = STATUS_BADGE[a.status] ?? { label: a.status, color: "#374151", bg: "#F3F4F6" };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
      borderRadius: 12, background: "#F8FAFC", border: "1px solid #EEF2F7",
    }}>
      <div style={{
        width: 56, textAlign: "center", padding: "6px 0", borderRadius: 10,
        background: "#fff", border: "1px solid #E2E8F0",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1A2535" }}>{formatTime(a.startAt)}</div>
        <div style={{ fontSize: 10, color: "#8AAABF" }}>{a.endAt ? formatTime(a.endAt) : "—"}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1A2535", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.patientName ?? "Müştəri"}
        </div>
        <div style={{ fontSize: 12, color: "#52718F", marginTop: 2 }}>
          {a.sessionFormat ?? "Onlayn seans"}
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
        borderRadius: 12, background: "#F8FAFC", border: "1px solid #EEF2F7",
        textDecoration: "none", color: "inherit",
      }}
    >
      <div style={{
        width: 8, height: 38, borderRadius: 4,
        background: "linear-gradient(180deg, var(--brand), #8B7FE0)",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1A2535", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.patientName ?? "Müştəri"}
        </div>
        <div style={{ fontSize: 11, color: "#52718F", marginTop: 2 }}>
          {formatDayShort(a.startAt)} · {formatTime(a.startAt)}
        </div>
      </div>
    </Link>
  );
}

function ActionRow({ icon, title, count, href, accent, bg }:
  { icon: string; title: string; count: number; href: string; accent: string; bg: string }) {
  const empty = count === 0;
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
      borderRadius: 12, background: empty ? "#F8FAFC" : bg,
      border: `1px solid ${empty ? "#EEF2F7" : "transparent"}`,
      textDecoration: "none", color: "inherit",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: empty ? "#fff" : "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1A2535" }}>{title}</div>
        <div style={{ fontSize: 11, color: empty ? "#8AAABF" : accent, marginTop: 2, fontWeight: empty ? 400 : 600 }}>
          {empty ? "Hər şey nizamındadır" : `${count} ${count === 1 ? "elementə" : "elementə"} baxılmalıdır`}
        </div>
      </div>
      {!empty && (
        <span style={{
          minWidth: 28, height: 28, borderRadius: 14, padding: "0 8px",
          background: accent, color: "#fff", fontSize: 12, fontWeight: 700,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>{count}</span>
      )}
    </Link>
  );
}

function QuickAction({ href, icon, label, tone, badge }:
  { href: string; icon: string; label: string; tone: "violet" | "blue" | "amber" | "emerald"; badge?: number }) {
  const palettes: Record<typeof tone, { from: string; to: string; text: string }> = {
    violet:  { from: "#EDE9FE", to: "#DDD6FE", text: "var(--brand)" },
    blue:    { from: "#DBEAFE", to: "#BFDBFE", text: "#1E3A5F" },
    amber:   { from: "#FEF3C7", to: "#FDE68A", text: "#92400E" },
    emerald: { from: "#D1FAE5", to: "#A7F3D0", text: "#065F46" },
  };
  const p = palettes[tone];
  return (
    <Link href={href} style={{
      position: "relative",
      background: `linear-gradient(135deg, ${p.from}, ${p.to})`,
      borderRadius: 14, padding: 18, color: p.text, textDecoration: "none",
      border: "1px solid rgba(255,255,255,0.6)",
      boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
      display: "block",
    }}>
      <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
      {badge != null && badge > 0 && (
        <span style={{
          position: "absolute", top: 12, right: 12,
          minWidth: 22, height: 22, padding: "0 7px", borderRadius: 11,
          background: "#fff", color: p.text, fontSize: 11, fontWeight: 700,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}>{badge}</span>
      )}
    </Link>
  );
}

function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count));
  if (data.length === 0) {
    return <EmptyState icon="📊" title="Məlumat yoxdur" body="Aktivliyiniz burada görünəcək." />;
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
                      ? "linear-gradient(180deg, #1a1040, var(--brand))"
                      : "linear-gradient(180deg, #8B7FE0, var(--brand-200))",
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
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "#8AAABF" }}>
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

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 12px", color: "#52718F" }}>
      <div style={{ fontSize: 32, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1A2535" }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>{body}</div>
    </div>
  );
}

function SkeletonGrid() {
  const block = (h: number) => (
    <div style={{ background: "#fff", borderRadius: 16, height: h, padding: 18,
      boxShadow: "0 2px 14px rgba(15,23,42,0.05)", border: "1px solid #EEF2F7" }}>
      <div style={{ width: "40%", height: 12, background: "#EEF2F7", borderRadius: 4, marginBottom: 10 }} />
      <div style={{ width: "70%", height: 22, background: "#F1F5F9", borderRadius: 4 }} />
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
  fontSize: 12, fontWeight: 600, color: "var(--brand)", textDecoration: "none",
  padding: "4px 10px", borderRadius: 8, background: "var(--brand-50)",
};

function heroBtn(primary: boolean): React.CSSProperties {
  return {
    fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 10,
    background: primary ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.12)",
    color: primary ? "#1a1040" : "#fff",
    border: primary ? "none" : "1px solid rgba(255,255,255,0.25)",
    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
  };
}
