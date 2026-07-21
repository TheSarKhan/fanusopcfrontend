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
  PENDING:               { label: "Gözlənilir",      bg: "#FEF3C7", fg: "#92400E" },
  ASSIGNED:              { label: "Təyin edilib",    bg: "var(--brand-50)", fg: "var(--brand-700)" },
  CONFIRMED:             { label: "Təsdiqlənib",     bg: "#D1FAE5", fg: "#065F46" },
  AWAITING_CONFIRMATION: { label: "Təsdiq gözlənir", bg: "#FEF3C7", fg: "#92400E" },
  CANCEL_REQUESTED:      { label: "Ləğv gözlənir",  bg: "#FEE2E2", fg: "#991B1B" },
  COMPLETED:             { label: "Tamamlandı",      bg: "#F3F4F6", fg: "#374151" },
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
  const months = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
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
      .filter(a => a.status === "ASSIGNED" || a.status === "CONFIRMED" || a.status === "CANCEL_REQUESTED")
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
    const total = tasks.length;
    const overdue = tasks.filter(t => {
      if (t.status === "COMPLETED" || !t.dueDate) return false;
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
          <div className="pnl-stats">
            <StatTile
              label="Bu ay seans"
              value={monthStats.completed}
              href="/patient/appointments"
            />
            <StatTile
              label="Aktiv tapşırıq"
              value={taskStats.pending}
              href="/patient/homework"
            />
            <StatTile
              label="Bitirilmiş tapşırıq"
              value={taskStats.completed}
              href="/patient/homework"
            />
          </div>

          {/* ── Əsas: tövsiyələr | son aktivlik ──────────────────────────
              Kartlar birbaşa şəbəkənin uşaqlarıdır → eyni hündürlüyə uzanır. */}
          <div className="pnl-2col" style={{ marginBottom: 16 }}>
            <Card>
              <CardHead
                title="Sizə tövsiyə olunan psixoloqlar"
                subtitle={favorites.length > 0 ? "Sevimlilərinizdən və yüksək reytinqlilərdən" : "Yüksək reytinqli mütəxəssislər"}
                link={{ href: "/patient/psychologists", label: "Hamısına bax →" }}
              />
              {recommended.length === 0 ? (
                <Empty msg="Hələ aktiv psixoloq yoxdur." />
              ) : (
                <div>
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
                <div>
                  {activityFeed.map((it, i) => (
                    it.kind === "appt"
                      ? <ApptActivityRow key={"a-" + it.a.id + "-" + i} a={it.a} />
                      : <TaskActivityRow key={"t-" + it.t.id + "-" + i} t={it.t} />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ── Şərti kartlar (hədəf / kurs / gecikmiş) ──────────────────
              auto-fit: 1, 2 və ya 3 kart olsa da sıra tam dolur, boşluq qalmır. */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
            gap: 12, alignItems: "stretch",
          }}>
              {FEATURE_GOALS && activeGoals.length > 0 && (
                <Card>
                  <CardHead
                    title="Aktiv hədəflərim"
                    subtitle={`${goals.length} hədəfdən ${activeGoals.length}-i açıqdır`}
                    link={{ href: "/patient/goals", label: "Hamısına bax →" }}
                  />
                  <div>
                    {activeGoals.map(g => (
                      <Link key={g.id} href="/patient/goals" className="pnl-row"
                        style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <span className="pnl-row__title" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {g.title}
                          </span>
                          <span className="pnl-row__val" style={{ fontSize: 13 }}>{g.progressPct}%</span>
                        </div>
                        <div className="pnl-row__meta">{g.psychologistName ?? "Psixoloqunuz"}</div>
                        <ProgressBar pct={g.progressPct} />
                      </Link>
                    ))}
                  </div>
                </Card>
              )}

              {activeCourse && (
                <Card>
                  <CardHead title={t("course.dashboardTitle")} />
                  <div>
                    <div style={{ fontSize: 13.5, color: "var(--oxford-80)", lineHeight: 1.6 }}>
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
                    <ProgressBar pct={activeCourse.total > 0 ? Math.round((activeCourse.done / activeCourse.total) * 100) : 0} />
                    <Link href="/patient/appointments" className="pnl-link" style={{ marginTop: 12, display: "inline-block" }}>
                      {t("course.dashboardCta")}
                    </Link>
                  </div>
                </Card>
              )}

            {/* "Sürətli giriş" kartı silindi — sidebar onsuz da eyni keçidləri verir. */}

            {taskStats.overdue > 0 && (
              <Card tone="warn">
                <CardHead title={`${taskStats.overdue} gecikmiş tapşırıq`} />
                <p style={{ margin: 0, fontSize: 13, color: "#92400E", lineHeight: 1.6 }}>
                  Vaxtı keçmiş tapşırıqları bağlayın və psixoloqunuza geri bildirim göndərin.
                </p>
                <Link href="/patient/homework" className="pnl-link" style={{ marginTop: 12, display: "inline-block" }}>
                  Tapşırıqlara bax →
                </Link>
              </Card>
            )}
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

  const status = next ? STATUS_LABEL[next.status] : null;

  return (
    <>
      {/* Əvvəl burada gradient banner + uppercase "eyebrow" tarix + rəngli pill-lər
          vardı. Psixoloq paneli ilə eyni sakit dil: başlıq, altında tarix, seans
          isə adi kart. */}
      <div className="pnl-head">
        <div>
          <h1 className="pnl-head__title">{greet()}, {userName}</h1>
          <p className="pnl-head__sub">{dayLabel}</p>
        </div>
        <div className="pnl-head__actions">
          <Link href="/patient/psychologists" className={next ? "pnl-btn pnl-btn--ghost" : "pnl-btn"}>
            Psixoloq tap
          </Link>
        </div>
      </div>

      <div className="pnl-card" style={{ marginBottom: 16 }}>
        <div className="pnl-card__head">
          <div>
            <h2 className="pnl-card__title">Yaxınlaşan seans</h2>
            {!next && (
              <p className="pnl-card__sub">
                Hələ planlaşdırılmış seans yoxdur — sizə uyğun mütəxəssisi seçin.
              </p>
            )}
          </div>
          {next && (
            <Link href="/patient/appointments" className="pnl-link">Detalları aç →</Link>
          )}
        </div>

        {next && next.startAt && (
          <div className="pnl-row">
            {/* Vaxt öndədir — bu kartda oxunan ilk şey odur. */}
            <span style={{ flex: "none", minWidth: 96 }}>
              <span style={{
                display: "block", fontSize: 18, fontWeight: 700, color: "var(--oxford)",
                fontVariantNumeric: "tabular-nums", lineHeight: 1.15,
              }}>
                {azFormatTime(next.startAt)}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>{fmtDay(next.startAt)}</span>
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pnl-row__title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {next.psychologistName ?? "Psixoloq təyin olunur"}
              </div>
              <div className="pnl-row__meta">{timeUntil(new Date(next.startAt)).text}</div>
            </div>

            {/* Pill deyil — rəngli nöqtə + düz mətn. */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
              <span aria-hidden style={{
                width: 6, height: 6, borderRadius: "50%",
                background: status?.fg ?? "var(--oxford-60)",
              }} />
              <span style={{ fontSize: 12.5, color: "var(--oxford-60)", whiteSpace: "nowrap" }}>
                {status?.label ?? next.status}
              </span>
            </span>
          </div>
        )}
      </div>
    </>
  );
}

function Card({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <div className="pnl-card" style={tone === "warn"
      ? { borderColor: "#FDE68A", background: "#FFFBEB" }
      : undefined}>
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
    <div className="pnl-card__head">
      <div style={{ minWidth: 0 }}>
        <h2 className="pnl-card__title">{title}</h2>
        {subtitle && <p className="pnl-card__sub">{subtitle}</p>}
      </div>
      {link && <Link href={link.href} className="pnl-link">{link.label}</Link>}
    </div>
  );
}

function StatTile({
  label, value, sub, href,
}: {
  label: string;
  value: number;
  sub?: string;
  /** Artıq çəkilmir (ikon dairəsi götürüldü) — çağırış yerlərini pozmamaq üçün qalır. */
  icon?: React.ReactNode;
  tone?: "brand" | "good" | "warn";
  href?: string;
}) {
  // İkon dairəsi və uppercase etiket götürüldü — rəqəm əsas element olsun.
  // (tone/icon proplar çağırış yerlərini pozmamaq üçün qalır, sadəcə çəkilmir.)
  const inner = (
    <>
      <div className="pnl-stat__val">{value}</div>
      <div className="pnl-stat__label">{label}</div>
      {sub && <div className="pnl-stat__sub">{sub}</div>}
    </>
  );
  return href
    ? <Link href={href} className="pnl-stat" style={{ textDecoration: "none" }}>{inner}</Link>
    : <div className="pnl-stat">{inner}</div>;
}

function PsyRecCard({ p, favorite }: { p: Psychologist; favorite: boolean }) {
  return (
    // Sətir formatı: avatar + ad/ixtisas, sağda reytinq. Əvvəlki "çip"lər və
    // ayrıca kart çərçivəsi götürüldü — siyahı sakit oxunur.
    <Link href={p.slug ? `/patient/psychologists/${p.slug}` : "/patient/psychologists"}
      className="pnl-row" style={{ textDecoration: "none", color: "inherit" }}>
      <span style={{
        width: 38, height: 38, borderRadius: 10, flex: "none", overflow: "hidden",
        background: "var(--brand-50)", color: "var(--brand-700)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700,
      }}>
        {p.photoUrl
          ? <img src={p.photoUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : initials(p.name)}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pnl-row__title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
          {favorite && (
            <span aria-label="Sevimli" style={{ color: "var(--rose, #C97D7D)", display: "inline-flex", flex: "none" }}>
              <IconHeart small />
            </span>
          )}
        </div>
        <div className="pnl-row__meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {p.title}
        </div>
      </div>

      <span className="pnl-row__val" style={{ fontSize: 13.5 }}>{fmtRating(p.rating)}</span>
    </Link>
  );
}

/** Nazik proqres zolağı — dekorativ qradient/kölgə yoxdur. */
function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{
      marginTop: 8, height: 4, borderRadius: 999,
      background: "var(--oxford-10)", overflow: "hidden",
    }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%",
        background: "var(--brand)", borderRadius: 999,
      }} />
    </div>
  );
}

/** Status — pill deyil, rəngli nöqtə + düz mətn (panel dili). */
function FeedStatus({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 12.5, color: "var(--oxford-60)", whiteSpace: "nowrap" }}>{label}</span>
    </span>
  );
}

function ApptActivityRow({ a }: { a: AppointmentDetail }) {
  const ts = a.startAt ?? a.createdAt;
  const meta = STATUS_LABEL[a.status] ?? { label: a.status, bg: "#F3F4F6", fg: "#374151" };
  return (
    <Link href="/patient/appointments" className="pnl-row" style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pnl-row__title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.psychologistName ?? "Psixoloq təyin olunur"}
        </div>
        <div className="pnl-row__meta">{ts && <>{fmtDay(ts)}, {azFormatTime(ts)}</>}</div>
      </div>
      <FeedStatus color={meta.fg} label={meta.label} />
    </Link>
  );
}

function TaskActivityRow({ t }: { t: Homework }) {
  const status = t.status === "COMPLETED" ? { label: "Bitdi", bg: "#D1FAE5", fg: "#065F46" }
    : t.status === "IN_PROGRESS" ? { label: "Davam edir", bg: "#DBEAFE", fg: "#1E40AF" }
    : { label: "Gözləyir", bg: "#FEF3C7", fg: "#92400E" };
  return (
    <Link href="/patient/homework" className="pnl-row" style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pnl-row__title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t.title}
        </div>
        <div className="pnl-row__meta">
          {fmtDay(t.completedAt ?? t.createdAt)}
        </div>
      </div>
      <FeedStatus color={status.fg} label={status.label} />
    </Link>
  );
}


function Empty({ msg }: { msg: string }) {
  return (
    <div className="pnl-empty">
      <div className="pnl-empty__body" style={{ marginTop: 0 }}>{msg}</div>
    </div>
  );
}

/** Skelet real düzümün formasını təkrarlayır (3 rəqəm + 2 kart) — məzmun
 *  gələndə sıçrayış olmasın. */
function SkeletonGrid() {
  const box = (h: number) => (
    <div className="pnl-card" style={{ height: h, gap: 10 }}>
      <div style={{ width: "40%", height: 12, background: "var(--oxford-10)", borderRadius: 4 }} />
      <div style={{ width: "70%", height: 20, background: "var(--brand-50)", borderRadius: 4 }} />
    </div>
  );
  return (
    <div>
      <div className="pnl-stats">{box(88)}{box(88)}{box(88)}</div>
      <div className="pnl-2col">{box(280)}{box(280)}</div>
    </div>
  );
}

/* ─── Inline icons ───────────────────────────────────────────────────── */

const sw = {
  fill: "none", stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24",
};

function IconHeart({ small }: { small?: boolean } = {}) {
  const s = small ? 12 : 18;
  return (<svg width={s} height={s} {...sw}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>);
}
