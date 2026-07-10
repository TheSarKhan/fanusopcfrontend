"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { azFormatDate, azFormatWeekday } from "@/lib/datetime";
import {
  adminApi,
  operatorApi,
  type DashboardMetrics,
  type ActivityEntry,
  type CommandCenter,
  type CommandCenterQueue,
  type OperatorCrisisCheckIn,
} from "@/lib/api";
import {
  IconUsers,
  IconUser,
  IconCalendar,
  IconMail,
  IconEye,
  IconPlus,
  IconDownload,
  IconArrowRight,
  IconCheck,
  IconAlert,
  IconX,
  IconContent,
  IconMegaphone,
  IconChart,
} from "./_components/icons";

const FALLBACK: DashboardMetrics = {
  totalUsers: { value: 0, secondary: null, deltaPercent: null, label: "keçən aydan" },
  activePsychologists: { value: 0, secondary: 0, deltaPercent: null, label: "" },
  pendingAppointments: { value: 0, secondary: null, deltaPercent: null, label: "" },
  newMessages: { value: 0, secondary: null, deltaPercent: null, label: "" },
  articleReads: { value: 0, secondary: null, deltaPercent: null, label: "" },
  appointmentFlow: [],
  recentActivity: [],
  topArticles: [],
  topicDistribution: [],
  systemStatus: {},
};

function formatNumber(n: number): string {
  if (n >= 1000) return new Intl.NumberFormat("az-AZ").format(n);
  return n.toString();
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function deltaLabel(d: number | null | undefined) {
  if (d === null || d === undefined) return null;
  const cls = d > 0 ? "delta up" : d < 0 ? "delta down" : "delta flat";
  const sign = d > 0 ? "↑" : d < 0 ? "↓" : "—";
  return (
    <span className={cls}>
      {sign} {Math.abs(d).toFixed(1)}%
    </span>
  );
}

function Spark({ color }: { color: string }) {
  return (
    <svg className="stat-spark" viewBox="0 0 70 28" preserveAspectRatio="none">
      <path d="M0 22 L8 18 L16 20 L24 14 L32 16 L40 10 L48 12 L56 6 L64 8 L70 4" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function ActivityIcon({ entry }: { entry: ActivityEntry }) {
  const cls = `activity-ic${entry.tone === "ox" ? "" : " " + entry.tone}`;
  if (entry.type === "appointment" && entry.tone === "sage") return <div className={cls}><IconCheck size={14} /></div>;
  if (entry.type === "blog_post") return <div className={cls}><IconContent size={14} /></div>;
  if (entry.type === "announcement") return <div className={cls}><IconMegaphone size={14} /></div>;
  if (entry.tone === "rose") return <div className={cls}><IconX size={14} /></div>;
  if (entry.tone === "gold") return <div className={cls}><IconAlert size={14} /></div>;
  return <div className={cls}><IconUser size={14} /></div>;
}

function Donut({ slices }: { slices: { color: string; percent: number }[] }) {
  return (
    <svg className="donut" viewBox="0 0 42 42">
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#F2F6FD" strokeWidth="6" />
      {slices.map((s, i) => {
        const offset = 25 + slices.slice(0, i).reduce((sum, x) => sum + x.percent, 0);
        return (
          <circle key={i} cx="21" cy="21" r="15.9" fill="transparent" stroke={s.color} strokeWidth="6" strokeDasharray={`${s.percent} 100`} strokeDashoffset={-offset + 50} />
        );
      })}
    </svg>
  );
}

function BarChart({ flow }: { flow: { date: string; confirmed: number; pending: number; cancelled: number }[] }) {
  const max = Math.max(1, ...flow.map((d) => d.confirmed + d.pending + d.cancelled));
  return (
    <div className="bars">
      {flow.map((d, i) => (
        <div className="bar-col" key={i}>
          <div className="bar-stack">
            <div className="bar" style={{ height: `${(d.confirmed / max) * 100}%` }} />
            <div className="bar sec" style={{ height: `${(d.pending / max) * 100}%` }} />
            <div className="bar gold" style={{ height: `${(d.cancelled / max) * 100}%` }} />
          </div>
          <div className="bar-label">{d.date}</div>
        </div>
      ))}
    </div>
  );
}

/** Komanda mərkəzi: "ən köhnə" yaş etiketi — "3g 4s", "2s 15d", "indi". */
function ageLabel(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 1) return "indi";
  if (min < 60) return `${min} dəq`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}s ${min % 60}d`;
  const days = Math.floor(hrs / 24);
  return `${days}g ${hrs % 24}s`;
}

type QueueTone = "ox" | "gold" | "rose" | "muted";

function QueueCard({
  title, queue, href, tone, sub, onClick,
}: {
  title: string;
  queue: CommandCenterQueue;
  href?: string;
  tone: QueueTone;
  sub?: string | null;
  onClick?: () => void;
}) {
  const age = ageLabel(queue.oldestAt);
  const body = (
    <>
      <div className="qcard-top">
        <span className="qcard-title">{title}</span>
        <span className={`qcard-count ${queue.count > 0 ? tone : "muted"}`}>{queue.count}</span>
      </div>
      <div className="qcard-meta">
        {queue.count > 0 && age ? `ən köhnə: ${age}` : queue.count > 0 ? " " : "boşdur"}
        {sub ? <span className="qcard-sub">{sub}</span> : null}
      </div>
    </>
  );
  if (href) {
    return <Link href={href} className={`qcard${queue.count > 0 ? " has-items" : ""}`}>{body}</Link>;
  }
  return (
    <button type="button" onClick={onClick} className={`qcard${queue.count > 0 ? " has-items" : ""}`}>
      {body}
    </button>
  );
}

/** Böhran kartının açdığı sətiriçi panel — admin /operator səhifələrinə girə
 *  bilmir, ona görə cavablanmamış check-in-lər burada göstərilir (operator
 *  endpoint-ləri ADMIN roluna da açıqdır). */
function CrisisPanel({ onAcked }: { onAcked: () => void }) {
  const [items, setItems] = useState<OperatorCrisisCheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    operatorApi.crisisCheckIns().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const acknowledge = async (id: number) => {
    try {
      const updated = await operatorApi.acknowledgeCrisisCheckIn(id);
      setItems((prev) => prev.map((c) => (c.id === id ? updated : c)));
      onAcked();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <h3 className="card-title">Böhran check-in-ləri (son 7 gün)</h3>
        <span className="pill rose"><span className="dot" />yüksək risk</span>
      </div>
      {loading ? (
        <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>Yüklənir…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>Check-in yoxdur</div>
      ) : (
        <div style={{ maxHeight: 320, overflow: "auto" }}>
          {items.map((c) => (
            <div className="list-item" key={c.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="li-title">
                  {c.patientName} · əhval {c.moodScore}/5
                  {c.acknowledgedAt && <span className="pill sage" style={{ marginLeft: 8 }}>baxılıb</span>}
                </div>
                <div className="li-meta">
                  {ageLabel(c.createdAt) ?? ""} əvvəl
                  {c.note ? ` · «${c.note.slice(0, 80)}»` : ""}
                  {c.acknowledgedByName ? ` · baxdı: ${c.acknowledgedByName}` : ""}
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {c.patientPhone && (
                  <a className="btn ghost sm" href={`tel:${c.patientPhone}`}>Zəng et</a>
                )}
                {!c.acknowledgedAt && (
                  <button className="btn sm" onClick={() => acknowledge(c.id)}>Baxıldı</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string>("");
  const [cc, setCc] = useState<CommandCenter | null>(null);
  const [crisisOpen, setCrisisOpen] = useState(false);

  const loadCommandCenter = () => {
    adminApi.getCommandCenter().then(setCc).catch(() => {});
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("authUser");
      if (raw) {
        const u = JSON.parse(raw);
        setMe(u.firstName || u.email || "");
      }
    } catch { /* ignore */ }

    adminApi
      .getDashboardMetrics()
      .then((m) => setMetrics({ ...FALLBACK, ...m }))
      .catch(() => {})
      .finally(() => setLoading(false));

    // MODUL 1: komanda mərkəzi — tək sorğu, 60 saniyədən bir yenilənir.
    loadCommandCenter();
    const timer = setInterval(loadCommandCenter, 60_000);
    return () => clearInterval(timer);
  }, []);

  const dateString = useMemo(() => {
    const d = new Date();
    return `${azFormatWeekday(d)}, ${azFormatDate(d)}`;
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Xoş gəldiniz{me ? `, ${me}` : ""}</h1>
          <p className="page-sub">{dateString} — platformada baş verənlərin xülasəsi.</p>
        </div>
        <div className="page-actions">
          <button className="btn">
            <IconPlus size={14} />
            Tez yarat
          </button>
          <button className="btn">
            <IconDownload size={14} />
            Hesabat ixrac et
          </button>
          <button className="btn primary">
            <IconArrowRight size={14} style={{ stroke: "#fff" } as React.CSSProperties} />
            Bu həftəni göstər
          </button>
        </div>
      </div>

      {/* ─── MODUL 1: Komanda mərkəzi — diqqət tələb edən növbələr ─────────── */}
      {cc && (
        <div className="queue-grid">
          <QueueCard title="Psixoloq müraciətləri" queue={cc.applications} tone="gold" href="/admin/users" />
          <QueueCard title="Rəy moderasiyası" queue={cc.reviews} tone="gold" href="/admin/reviews" />
          <QueueCard
            title="Ləğv istəkləri"
            queue={cc.cancelRequests}
            tone="gold"
            href="/admin/appointments?filter=CANCEL_REQUESTED"
            sub={cc.cancelRequestSeries > 0 ? `${cc.cancelRequestAppointments} randevu · ${cc.cancelRequestSeries} seriya` : null}
          />
          <QueueCard
            title="Mübahisəli"
            queue={cc.disputed}
            tone={cc.disputed.escalatedCount > 0 ? "rose" : "gold"}
            href="/admin/appointments?filter=DISPUTED"
            sub={cc.disputed.escalatedCount > 0 ? `${cc.disputed.escalatedCount} ədəd 48s+` : null}
          />
          <QueueCard title="SLA gecikmiş" queue={cc.slaOverdue} tone="rose" href="/admin/appointments?filter=overdue" sub={`limit ${cc.slaHours}s`} />
          <QueueCard title="Böhran" queue={cc.crisis} tone="rose" onClick={() => setCrisisOpen((o) => !o)} />
          <QueueCard title="Yeni mesajlar" queue={cc.contactMessages} tone="ox" href="/admin/messages" />
          <QueueCard title="Silinmə istəkləri" queue={cc.deletionRequests} tone="gold" href="/admin/deletion-requests" />
          <QueueCard title="Email xətaları (24s)" queue={cc.emailFailures} tone="rose" onClick={() => {}} sub="Modul 4: /admin/system/emails" />
        </div>
      )}

      {crisisOpen && <CrisisPanel onAcked={loadCommandCenter} />}

      <div className="stats-grid">
        <div className="stat">
          <div className="stat-label">
            <IconUsers className="ic" />
            <span>Ümumi istifadəçi</span>
          </div>
          <div className="stat-value">{loading ? "…" : compactNumber(metrics.totalUsers.value)}</div>
          <div className="stat-meta">
            {deltaLabel(metrics.totalUsers.deltaPercent)}
            <span>{metrics.totalUsers.label}</span>
          </div>
          <Spark color="#10B981" />
        </div>

        <div className="stat">
          <div className="stat-label">
            <IconUser className="ic" />
            <span>Aktiv psixoloqlar</span>
          </div>
          <div className="stat-value">
            {loading ? "…" : metrics.activePsychologists.value}
            {metrics.activePsychologists.secondary !== null && (
              <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}> / {metrics.activePsychologists.secondary}</span>
            )}
          </div>
          <div className="stat-meta">
            <span className="delta up">↑ {metrics.activePsychologists.value > 0 ? metrics.activePsychologists.value : 0}</span>
            <span>{metrics.activePsychologists.label || "ümumi"}</span>
          </div>
          <Spark color="#6366F1" />
        </div>

        <div className="stat">
          <div className="stat-label">
            <IconCalendar className="ic" />
            <span>Gözləyən randevu</span>
          </div>
          <div className="stat-value">{loading ? "…" : metrics.pendingAppointments.value}</div>
          <div className="stat-meta">
            <span className="delta down">↓ {metrics.pendingAppointments.value}</span>
            <span>{metrics.pendingAppointments.label || "diqqət tələb edir"}</span>
          </div>
          <Spark color="#F59E0B" />
        </div>

        <div className="stat">
          <div className="stat-label">
            <IconMail className="ic" />
            <span>Yeni mesajlar</span>
          </div>
          <div className="stat-value">{loading ? "…" : metrics.newMessages.value}</div>
          <div className="stat-meta">
            {deltaLabel(metrics.newMessages.deltaPercent)}
            <span>{metrics.newMessages.label}</span>
          </div>
          <Spark color="#3A74D6" />
        </div>

        <div className="stat">
          <div className="stat-label">
            <IconEye className="ic" />
            <span>Məqalə oxunması</span>
          </div>
          <div className="stat-value">{loading ? "…" : compactNumber(metrics.articleReads.value)}</div>
          <div className="stat-meta">
            {deltaLabel(metrics.articleReads.deltaPercent)}
            <span>{metrics.articleReads.label}</span>
          </div>
          <Spark color="#082F6D" />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">Randevu axını</h3>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Son 14 gün — gündəlik</div>
            </div>
            <div className="row">
              <button className="filter active">14 gün</button>
              <button className="filter">30 gün</button>
              <button className="filter">90 gün</button>
            </div>
          </div>
          <div className="legend">
            <span className="lg"><span className="sw" style={{ background: "var(--ox-500)" }} /><span>Təsdiqləndi</span></span>
            <span className="lg"><span className="sw" style={{ background: "var(--ox-200)" }} /><span>Gözləyir</span></span>
            <span className="lg"><span className="sw" style={{ background: "#F59E0B" }} /><span>Ləğv edildi</span></span>
          </div>
          <div style={{ padding: "8px 14px 14px" }}>
            <BarChart flow={metrics.appointmentFlow.length ? metrics.appointmentFlow : Array.from({ length: 14 }, (_, i) => ({ date: String(i + 17), confirmed: 0, pending: 0, cancelled: 0 }))} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3 className="card-title">
              <span>Son aktivlik</span>
              <span className="pill ox"><span className="dot" />live</span>
            </h3>
            <a href="/admin/appointments" className="btn ghost sm">Hamısı</a>
          </div>
          <div>
            {loading && <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>Yüklənir…</div>}
            {!loading && metrics.recentActivity.length === 0 && (
              <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>Aktivlik yoxdur</div>
            )}
            {metrics.recentActivity.map((entry, idx) => (
              <div className="activity-item" key={idx}>
                <ActivityIcon entry={entry} />
                <div style={{ flex: 1 }}>
                  <div className="activity-text" dangerouslySetInnerHTML={{ __html: entry.title }} />
                  <div className="activity-meta">{entry.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-3 mt-16">
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Ən çox oxunan məqalələr</h3>
            <span className="pill muted">Bu ay</span>
          </div>
          <div>
            {metrics.topArticles.length === 0 && !loading && (
              <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>Məqalə yoxdur</div>
            )}
            {metrics.topArticles.map((a) => (
              <div className="list-item" key={a.rank}>
                <div className={`li-rank${a.rank === 1 ? " gold" : ""}`}>{a.rank}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="li-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                  <div className="li-meta">{a.author} · {a.category}</div>
                </div>
                <div>
                  <div className="li-stat">{formatNumber(a.views)}</div>
                  <div className="li-substat">{(a.deltaPct ?? 0) > 0 ? "↑" : a.deltaPct === 0 ? "—" : "↓"} {Math.abs(a.deltaPct ?? 0)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Mövzu paylanması</h3>
          </div>
          <div className="donut-wrap">
            <Donut slices={metrics.topicDistribution} />
            <div className="donut-legend">
              {metrics.topicDistribution.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Kateqoriya yoxdur</div>
              )}
              {metrics.topicDistribution.map((t, i) => (
                <div className="legend-row" key={i}>
                  <span className="sw" style={{ background: t.color }} />
                  <span className="ll">{t.label}</span>
                  <span className="vv">{t.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Sürətli əməliyyatlar</h3>
          </div>
          <div className="card-pad" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <a href="/admin/content" className="btn" style={{ justifyContent: "flex-start", height: "auto", padding: "11px 12px", flexDirection: "column", alignItems: "flex-start", gap: 4, textDecoration: "none" }}>
              <div className="row" style={{ gap: 6, color: "var(--ox-700)" }}>
                <IconContent size={14} />
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>Yeni məqalə</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>Draft yarat</div>
            </a>
            <a href="/admin/psychologists" className="btn" style={{ justifyContent: "flex-start", height: "auto", padding: "11px 12px", flexDirection: "column", alignItems: "flex-start", gap: 4, textDecoration: "none" }}>
              <div className="row" style={{ gap: 6, color: "var(--ox-700)" }}>
                <IconUser size={14} />
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>Psixoloq əlavə et</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>Yeni profil</div>
            </a>
            <a href="/admin/announcements" className="btn" style={{ justifyContent: "flex-start", height: "auto", padding: "11px 12px", flexDirection: "column", alignItems: "flex-start", gap: 4, textDecoration: "none" }}>
              <div className="row" style={{ gap: 6, color: "var(--ox-700)" }}>
                <IconMegaphone size={14} />
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>Elan dərc et</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>Ana səhifədə</div>
            </a>
            <a href="/admin/reports" className="btn" style={{ justifyContent: "flex-start", height: "auto", padding: "11px 12px", flexDirection: "column", alignItems: "flex-start", gap: 4, textDecoration: "none" }}>
              <div className="row" style={{ gap: 6, color: "var(--ox-700)" }}>
                <IconChart size={14} />
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>Hesabat</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>Aylıq xülasə</div>
            </a>
          </div>
          <div className="divider" style={{ margin: "0 16px" }} />
          <div className="card-pad">
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Sistem statusu</div>
            <SystemStatus status={metrics.systemStatus} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemStatus({ status }: { status: Record<string, string> }) {
  const labels: Record<string, string> = {
    api: "API uptime",
    payment: "Ödəniş gateway",
    sms: "SMS provayder",
    ai: "AI yönləndirmə",
  };
  const tone = (v: string) => (v === "operativ" || v === "aktiv" ? "sage" : v === "gecikmə" ? "gold" : "rose");
  const entries = Object.keys(labels).map((k) => ({ k, v: status[k] ?? "naməlum" }));
  return (
    <>
      {entries.map(({ k, v }) => (
        <div className="meta-row" key={k}>
          <span className="lbl">{labels[k]}</span>
          <span className="val">
            <span className={`pill ${tone(v)}`}>
              <span className="dot" />
              {v}
            </span>
          </span>
        </div>
      ))}
    </>
  );
}
