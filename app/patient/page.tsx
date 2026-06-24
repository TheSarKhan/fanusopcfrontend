"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getPsychologists,
  patientApi,
  type AppointmentDetail,
  type BookingSeries,
  type Homework,
  type PatientGoalView,
  type Psychologist,
} from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import { withSlugs } from "@/lib/slug";
import { getStoredUser } from "@/lib/auth";
import { azFormatTime } from "@/lib/datetime";
import { FEATURE_GOALS } from "@/lib/features";

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING:               { label: "Gözlənilir",    bg: "#FEF3C7", fg: "#92400E" },
  ASSIGNED:              { label: "Təyin edilib",  bg: "var(--brand-50)", fg: "var(--brand-700)" },
  CONFIRMED:             { label: "Təsdiqlənib",   bg: "#D1FAE5", fg: "#065F46" },
  AWAITING_CONFIRMATION: { label: "Təsdiq gözlənir", bg: "#FEF3C7", fg: "#92400E" },
  COMPLETED:             { label: "Tamamlandı",    bg: "#F3F4F6", fg: "#374151" },
};

function greet(): string {
  const h = new Date().getHours();
  if (h < 6) return "Xoş gecələr";
  if (h < 12) return "Sabahınız xeyir";
  if (h < 18) return "Günortanız xeyir";
  return "Axşamınız xeyir";
}

function fmtDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Bu gün";
  if (same(d, tomorrow)) return "Sabah";
  const months = ["Yan","Fev","Mar","Apr","May","İyn","İyl","Avq","Sen","Okt","Noy","Dek"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function timeUntil(target: Date): { text: string; urgent: boolean } {
  const ms = target.getTime() - Date.now();
  if (ms < 0) return { text: "indi başladı", urgent: true };
  const m = Math.floor(ms / 60000);
  if (m < 60) return { text: `${m} dəq qaldı`, urgent: m <= 15 };
  const h = Math.floor(m / 60);
  if (h < 24) return { text: `${h} saat ${m % 60} dəq qaldı`, urgent: false };
  const d = Math.floor(h / 24);
  return { text: `${d} gün qaldı`, urgent: false };
}

function initials(name?: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function fmtRating(r: string | number | undefined | null): string {
  if (r == null || r === "") return "—";
  const n = typeof r === "string" ? parseFloat(r) : r;
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

export default function PatientDashboard() {
  const { t } = useT();
  const user = getStoredUser();
  const [appts, setAppts] = useState<AppointmentDetail[]>([]);
  const [tasks, setTasks] = useState<Homework[]>([]);
  const [favorites, setFavorites] = useState<Psychologist[]>([]);
  const [allPsy, setAllPsy] = useState<Psychologist[]>([]);
  const [goals, setGoals] = useState<PatientGoalView[]>([]);
  const [series, setSeries] = useState<BookingSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    Promise.allSettled([
      patientApi.myAppointments(),
      patientApi.homework(),
      patientApi.favorites(),
      getPsychologists(),
      // Goals gizlidirsə sorğu ümumiyyətlə getməsin.
      FEATURE_GOALS ? patientApi.goals() : Promise.resolve<PatientGoalView[]>([]),
      patientApi.myBookingSeries(),
    ]).then(res => {
      if (res[0].status === "fulfilled") setAppts(res[0].value);
      if (res[1].status === "fulfilled") setTasks(res[1].value);
      if (res[2].status === "fulfilled") setFavorites(res[2].value);
      if (res[3].status === "fulfilled") setAllPsy(res[3].value);
      if (res[4].status === "fulfilled") setGoals(res[4].value);
      if (res[5].status === "fulfilled") setSeries(res[5].value);
      setLoading(false);
    });
  }, []);

  // B2-1.4: active course widget — first live group with 2+ sessions.
  // Plain computation: the React Compiler memoizes it automatically.
  const findActiveCourse = () => {
    for (const s of series) {
      if (s.cancelledAt) continue;
      const members = appts.filter(a => a.seriesId === s.id);
      if (members.length < 2) continue;
      const done = members.filter(a => a.status === "COMPLETED").length;
      const upcoming = members
        .filter(a => {
          const at = a.startAt ?? a.requestedStartAt;
          return at && new Date(at).getTime() > now
            && a.status !== "CANCELLED" && a.status !== "COMPLETED";
        })
        .sort((a, b) =>
          new Date(a.startAt ?? a.requestedStartAt!).getTime()
          - new Date(b.startAt ?? b.requestedStartAt!).getTime())[0] ?? null;
      if (done === members.length && !upcoming) continue; // finished course
      return { series: s, total: members.length, done, upcoming };
    }
    return null;
  };
  const activeCourse = findActiveCourse();

  const activeGoals = useMemo(
    () => goals.filter(g => g.status === "OPEN" || g.status === "IN_PROGRESS").slice(0, 3),
    [goals]
  );

  // Derived
  const next = useMemo(() => {
    return appts
      .filter(a => a.startAt && new Date(a.startAt).getTime() > now - 30 * 60_000)
      .filter(a => a.status === "ASSIGNED" || a.status === "CONFIRMED")
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())[0] ?? null;
  }, [appts, now]);

  const monthStats = useMemo(() => {
    const ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0);
    const mt = ms.getTime();
    let completed = 0, scheduled = 0;
    for (const a of appts) {
      const at = a.startAt ?? a.createdAt;
      if (!at) continue;
      if (new Date(at).getTime() < mt) continue;
      scheduled++;
      if (a.status === "COMPLETED") completed++;
    }
    return { completed, scheduled };
  }, [appts]);

  const taskStats = useMemo(() => {
    const pending = tasks.filter(t => t.status === "PENDING").length;
    const completed = tasks.filter(t => t.status === "COMPLETED").length;
    const total = pending + completed + tasks.filter(t => t.status === "SKIPPED").length;
    const overdue = tasks.filter(t => {
      if (t.status !== "PENDING" || !t.dueDate) return false;
      return new Date(t.dueDate + "T23:59:59").getTime() < now;
    }).length;
    return { pending, completed, total, overdue };
  }, [tasks, now]);

  const recommended = useMemo(() => {
    const favList = withSlugs(favorites).filter(p => p.active);
    if (favList.length >= 2) return favList.slice(0, 4);
    const fav = new Set(favorites.map(f => f.id));
    const rest = withSlugs(allPsy)
      .filter(p => p.active && !fav.has(p.id))
      .sort((a, b) => parseFloat(b.rating ?? "0") - parseFloat(a.rating ?? "0"));
    return [...favList, ...rest].slice(0, 4);
  }, [favorites, allPsy]);

  const activityFeed = useMemo(() => {
    type Item =
      | { kind: "appt"; ts: number; a: AppointmentDetail }
      | { kind: "task"; ts: number; t: Homework };
    const items: Item[] = [];
    for (const a of appts.slice(0, 6)) {
      const ts = new Date(a.startAt ?? a.createdAt).getTime();
      items.push({ kind: "appt", ts, a });
    }
    for (const t of tasks.slice(0, 5)) {
      const ts = new Date(t.completedAt ?? t.createdAt).getTime();
      items.push({ kind: "task", ts, t });
    }
    return items.sort((a, b) => b.ts - a.ts).slice(0, 6);
  }, [appts, tasks]);

  return (
    <div className="pdash">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <PatientHero
        userName={user?.firstName ?? "Pasiyent"}
        next={next}
      />

      {loading ? (
        <SkeletonGrid />
      ) : (
        <>
          {/* ── Engagement strip ─────────────────────────────────────── */}
          <div className="pdash-stats">
            <StatTile
              label="Bu ay seans"
              value={monthStats.completed}
              sub={monthStats.scheduled > 0 ? `${monthStats.scheduled} planlaşdırılıb` : "hələ planlaşdırma yoxdur"}
              icon={<IconCheck />}
              tone="brand"
              href="/patient/appointments"
            />
            <StatTile
              label="Aktiv tapşırıq"
              value={taskStats.pending}
              sub={taskStats.overdue > 0 ? `${taskStats.overdue} gecikib` : "vaxtında"}
              icon={<IconTarget />}
              tone={taskStats.overdue > 0 ? "warn" : "brand"}
              href="/patient/homework"
            />
            <StatTile
              label="Bitirilmiş tapşırıq"
              value={taskStats.completed}
              sub={taskStats.total > 0 ? `${Math.round((taskStats.completed / taskStats.total) * 100)}% tamamlanma` : "hələ tapşırıq yoxdur"}
              icon={<IconAward />}
              tone="good"
              href="/patient/homework"
            />
          </div>

          {/* ── 2-column body ────────────────────────────────────────── */}
          <div className="pdash-grid">
            <div className="pdash-col">
              <Card>
                <CardHead
                  title="Sizə tövsiyə olunan psixoloqlar"
                  subtitle={favorites.length > 0 ? "Sevimlilərinizdən və yüksək reytinqlilərdən" : "Yüksək reytinqli mütəxəssislər"}
                  link={{ href: "/patient/psychologists", label: "Hamısına bax →" }}
                />
                {recommended.length === 0 ? (
                  <Empty msg="Hələ aktiv psixoloq yoxdur." />
                ) : (
                  <div className="pdash-psy-grid">
                    {recommended.slice(0, 4).map(p => (
                      <PsyRecCard key={p.id} p={p} favorite={favorites.some(f => f.id === p.id)} />
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <CardHead title="Son aktivlik" subtitle="Randevular və tapşırıqlar" />
                {activityFeed.length === 0 ? (
                  <Empty msg="Hələ aktivlik yoxdur. İlk randevunuzu alın." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {activityFeed.map((it, i) => (
                      it.kind === "appt"
                        ? <ApptActivityRow key={"a-" + it.a.id + "-" + i} a={it.a} />
                        : <TaskActivityRow key={"t-" + it.t.id + "-" + i} t={it.t} />
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="pdash-col">
              {FEATURE_GOALS && activeGoals.length > 0 && (
                <Card>
                  <CardHead
                    title="Aktiv hədəflərim"
                    subtitle={`${activeGoals.length} açıq · ${goals.length} cəmi`}
                    link={{ href: "/patient/goals", label: "Hamısına bax →" }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {activeGoals.map(g => (
                      <Link key={g.id} href="/patient/goals" className="pdash-goal">
                        <div className="pdash-goal__title">{g.title}</div>
                        <div className="pdash-goal__psy">{g.psychologistName ?? "Psixoloqunuz"}</div>
                        <div className="pdash-goal__bar">
                          <div className="pdash-goal__bar-fill" style={{ width: `${g.progressPct}%` }} />
                        </div>
                        <div className="pdash-goal__pct">{g.progressPct}%</div>
                      </Link>
                    ))}
                  </div>
                </Card>
              )}

              {activeCourse && (
                <Card>
                  <CardHead title={t("course.dashboardTitle")} />
                  <div className="pdash-course">
                    <div className="pdash-course__line">
                      {activeCourse.upcoming
                        ? t("course.dashboardLine", {
                            done: activeCourse.done,
                            total: activeCourse.total,
                            next: `${fmtDay((activeCourse.upcoming.startAt ?? activeCourse.upcoming.requestedStartAt)!)} ${azFormatTime((activeCourse.upcoming.startAt ?? activeCourse.upcoming.requestedStartAt)!)}`,
                          })
                        : t("course.dashboardNoNext", {
                            done: activeCourse.done,
                            total: activeCourse.total,
                          })}
                    </div>
                    <div className="pdash-course__bar">
                      <div className="pdash-course__bar-fill"
                        style={{ width: `${activeCourse.total > 0 ? Math.round((activeCourse.done / activeCourse.total) * 100) : 0}%` }} />
                    </div>
                    <Link href="/patient/appointments" className="pdash-course__cta">
                      {t("course.dashboardCta")}
                    </Link>
                  </div>
                </Card>
              )}

              <Card>
                <CardHead title="Sürətli giriş" />
                <div className="pdash-quick">
                  <QuickLink href="/patient/psychologists" icon={<IconSearch />} label="Psixoloq tap" primary />
                  <QuickLink href="/patient/appointments"  icon={<IconCalendar />} label="Randevular" />
                  <QuickLink href="/patient/homework"      icon={<IconTarget />} label="Tapşırıqlar" badge={taskStats.pending || undefined} />
                  {FEATURE_GOALS && (
                    <QuickLink href="/patient/goals"         icon={<IconAward />} label="Hədəflərim" badge={activeGoals.length || undefined} />
                  )}
                  <QuickLink href="/patient/favorites"     icon={<IconHeart />} label="Sevimlilərim" />
                  <QuickLink href="/patient/profile"       icon={<IconUser />} label="Profil" />
                </div>
              </Card>

              {taskStats.overdue > 0 && (
                <Card tone="warn">
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div className="pdash-alert-icon"><IconBell /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#9A3412" }}>
                        {taskStats.overdue} gecikmiş tapşırığınız var
                      </div>
                      <div style={{ fontSize: 12, color: "#9A3412", marginTop: 3 }}>
                        Vaxtı keçmiş tapşırıqları bağlayın və psixoloqunuza geri bildirim göndərin.
                      </div>
                      <Link href="/patient/homework" className="pdash-alert-cta">Tapşırıqlara bax →</Link>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────────────────────────── */

function PatientHero({ userName, next }: { userName: string; next: AppointmentDetail | null }) {
  const today = new Date();
  const dayLabel = (() => {
    const days = ["Bazar","Bazar ertəsi","Çərşənbə axşamı","Çərşənbə","Cümə axşamı","Cümə","Şənbə"];
    const months = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
    return `${days[today.getDay()]}, ${today.getDate()} ${months[today.getMonth()]}`;
  })();

  return (
    <div className="pdash-hero">
      <div className="pdash-hero__bg" aria-hidden />
      <div className="pdash-hero__top">
        <div>
          <div className="pdash-hero__day">{dayLabel}</div>
          <h1 className="pdash-hero__title">{greet()}, {userName}</h1>
          <p className="pdash-hero__sub">
            {next ? "Yaxınlaşan seansınız aşağıda. Yaxşı hazırlıq görün." : "Hələ planlaşdırılmış seans yoxdur. Sizə uyğun mütəxəssisi seçin."}
          </p>
        </div>
        {!next && (
          <Link href="/patient/psychologists" className="pdash-hero__cta">
            Psixoloq tap →
          </Link>
        )}
      </div>

      {next && next.startAt && (
        <div className="pdash-hero__next">
          <div className="pdash-hero__next-time">
            <div className="pdash-hero__next-day">{fmtDay(next.startAt)}</div>
            <div className="pdash-hero__next-hr">{azFormatTime(next.startAt)}</div>
          </div>
          <div className="pdash-hero__next-info">
            <div className="pdash-hero__next-name">
              {next.psychologistName ?? "Psixoloq təyin olunur"}
            </div>
            <div className="pdash-hero__next-meta">
              <span className="pdash-hero__next-cd">
                {timeUntil(new Date(next.startAt)).text}
              </span>
              <span className="pdash-hero__next-status"
                style={{
                  background: STATUS_LABEL[next.status]?.bg,
                  color: STATUS_LABEL[next.status]?.fg,
                }}>
                {STATUS_LABEL[next.status]?.label ?? next.status}
              </span>
            </div>
          </div>
          <div className="pdash-hero__next-actions">
            <Link href="/patient/appointments" className="pdash-hero__btn pdash-hero__btn--primary">
              Detalları aç
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <div className="pdash-card" data-tone={tone}>
      {children}
    </div>
  );
}

function CardHead({ title, subtitle, link }: {
  title: string;
  subtitle?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="pdash-card__head">
      <div>
        <div className="pdash-card__title">{title}</div>
        {subtitle && <div className="pdash-card__sub">{subtitle}</div>}
      </div>
      {link && <Link href={link.href} className="pdash-card__link">{link.label}</Link>}
    </div>
  );
}

function StatTile({
  label, value, sub, icon, tone, href,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  tone: "brand" | "good" | "warn";
  href?: string;
}) {
  const inner = (
    <>
      <div className="pdash-stat__icon" data-tone={tone}>{icon}</div>
      <div className="pdash-stat__body">
        <div className="pdash-stat__label">{label}</div>
        <div className="pdash-stat__val">{value}</div>
        {sub && <div className="pdash-stat__sub">{sub}</div>}
      </div>
    </>
  );
  return href
    ? <Link href={href} className="pdash-stat">{inner}</Link>
    : <div className="pdash-stat">{inner}</div>;
}

function PsyRecCard({ p, favorite }: { p: Psychologist; favorite: boolean }) {
  return (
    <Link href={p.slug ? `/patient/psychologists/${p.slug}` : "/patient/psychologists"}
      className="pdash-psy-card">
      <div className="pdash-psy-card__avatar">
        {p.photoUrl ? (
           
          <img src={p.photoUrl} alt={p.name} />
        ) : (
          <span>{initials(p.name)}</span>
        )}
      </div>
      <div className="pdash-psy-card__body">
        <div className="pdash-psy-card__name">
          {p.name}
          {favorite && <span className="pdash-psy-card__fav" aria-label="Sevimli"><IconHeart small /></span>}
        </div>
        <div className="pdash-psy-card__title">{p.title}</div>
        <div className="pdash-psy-card__meta">
          <span className="pdash-psy-card__rating">★ {fmtRating(p.rating)}</span>
          {p.specializations?.[0] && (
            <span className="pdash-psy-card__chip">{p.specializations[0]}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ApptActivityRow({ a }: { a: AppointmentDetail }) {
  const ts = a.startAt ?? a.createdAt;
  const meta = STATUS_LABEL[a.status] ?? { label: a.status, bg: "#F3F4F6", fg: "#374151" };
  return (
    <Link href="/patient/appointments" className="pdash-feed-row">
      <div className="pdash-feed-row__dot" style={{ background: "var(--brand)" }} />
      <div className="pdash-feed-row__main">
        <div className="pdash-feed-row__title">{a.psychologistName ?? "Psixoloq təyin olunur"}</div>
        <div className="pdash-feed-row__meta">
          {ts && <>{fmtDay(ts)} · {azFormatTime(ts)}</>}
        </div>
      </div>
      <span className="pdash-feed-row__badge" style={{ background: meta.bg, color: meta.fg }}>
        {meta.label}
      </span>
    </Link>
  );
}

function TaskActivityRow({ t }: { t: Homework }) {
  const status = t.status === "COMPLETED" ? { label: "Bitdi", bg: "#D1FAE5", fg: "#065F46" }
    : t.status === "SKIPPED" ? { label: "Atlandı", bg: "#F3F4F6", fg: "#374151" }
    : { label: "Aktiv", bg: "#FEF3C7", fg: "#92400E" };
  return (
    <Link href="/patient/homework" className="pdash-feed-row">
      <div className="pdash-feed-row__dot" style={{ background: "#F59E0B" }} />
      <div className="pdash-feed-row__main">
        <div className="pdash-feed-row__title">{t.title}</div>
        <div className="pdash-feed-row__meta">
          {t.psychologistName ?? "Tapşırıq"} · {fmtDay(t.completedAt ?? t.createdAt)}
        </div>
      </div>
      <span className="pdash-feed-row__badge" style={{ background: status.bg, color: status.fg }}>
        {status.label}
      </span>
    </Link>
  );
}

function QuickLink({
  href, icon, label, badge, primary,
}: {
  href: string; icon: React.ReactNode; label: string; badge?: number; primary?: boolean;
}) {
  return (
    <Link href={href} className={`pdash-quick__item${primary ? " is-primary" : ""}`}>
      <span className="pdash-quick__icon">{icon}</span>
      <span className="pdash-quick__label">{label}</span>
      {badge != null && badge > 0 && (
        <span className="pdash-quick__badge">{badge}</span>
      )}
    </Link>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="pdash-empty">{msg}</div>;
}

function SkeletonGrid() {
  return (
    <div className="pdash-skel">
      <div className="pdash-skel__row">
        <div className="pdash-skel__box" style={{ height: 100 }} />
        <div className="pdash-skel__box" style={{ height: 100 }} />
        <div className="pdash-skel__box" style={{ height: 100 }} />
      </div>
      <div className="pdash-skel__row" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="pdash-skel__box" style={{ height: 280 }} />
        <div className="pdash-skel__box" style={{ height: 280 }} />
      </div>
    </div>
  );
}

/* ─── Inline icons ───────────────────────────────────────────────────── */

const sw = {
  fill: "none", stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24",
};

function IconCheck() {
  return (<svg width="18" height="18" {...sw}><path d="M20 6L9 17l-5-5"/></svg>);
}
function IconTarget() {
  return (<svg width="18" height="18" {...sw}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>);
}
function IconAward() {
  return (<svg width="18" height="18" {...sw}><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>);
}
function IconSearch() {
  return (<svg width="18" height="18" {...sw}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>);
}
function IconCalendar() {
  return (<svg width="18" height="18" {...sw}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>);
}
function IconHeart({ small }: { small?: boolean } = {}) {
  const s = small ? 12 : 18;
  return (<svg width={s} height={s} {...sw}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>);
}
function IconUser() {
  return (<svg width="18" height="18" {...sw}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
}
function IconBell() {
  return (<svg width="22" height="22" {...sw}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>);
}
