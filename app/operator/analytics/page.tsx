"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  operatorApi,
  type OperatorStats,
  type OperatorCrisisCheckIn,
  type PsychologistConcern,
  type PatientFlagged,
  type OperatorBreakdown,
} from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";

function fmtMin(min: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)} dəq`;
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m > 0 ? `${h} s ${m} dəq` : `${h} s`;
}

function fmtPct(p: number | null): string {
  return p == null ? "—" : `${p}%`;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function fmtAgo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (d <= 0) return "bu gün";
  if (d === 1) return "dünən";
  if (d < 30) return `${d} gün öncə`;
  return `${Math.floor(d / 30)} ay öncə`;
}

const REASON_LABEL: Record<string, { text: string; tone: "danger" | "warn" | "neutral" }> = {
  HIGH_NO_SHOW:     { text: "Yüksək no-show",     tone: "danger" },
  HIGH_LATE_CANCEL: { text: "Yüksək geç ləğv",     tone: "warn" },
  HIGH_REJECT:      { text: "Çox rədd alıb",       tone: "warn" },
  MANUAL:           { text: "Manual işarələnib",   tone: "warn" },
  DISPUTED_RECENT:  { text: "Mübahisəli seans",    tone: "danger" },
  RECENT_INCIDENT:  { text: "Son insident var",    tone: "neutral" },
};

export default function OperatorAnalyticsPage() {
  const { t } = useT();
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [crisis, setCrisis] = useState<OperatorCrisisCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackingId, setAckingId] = useState<number | null>(null);

  const load = () => {
    Promise.allSettled([operatorApi.stats(), operatorApi.crisisCheckIns()])
      .then(([s, c]) => {
        if (s.status === "fulfilled") setStats(s.value);
        if (c.status === "fulfilled") setCrisis(c.value);
        setLoading(false);
      });
  };

  useEffect(load, []);

  // GAP-07: a new crisis check-in must surface the moment it arrives.
  useEffect(() => {
    return subscribeNotifications((n) => {
      if (n.type === "CRISIS_CHECK_IN") load();
    });

  }, []);

  const ack = async (id: number) => {
    setAckingId(id);
    try {
      const updated = await operatorApi.acknowledgeCrisisCheckIn(id);
      setCrisis(prev => prev.map(c => c.id === id ? updated : c));
      setStats(prev => prev
        ? { ...prev, crisisUnackedCount: Math.max(0, prev.crisisUnackedCount - 1) }
        : prev);
    } catch (e) { alert((e as Error).message); }
    finally { setAckingId(null); }
  };

  return (
    <div className="op-analytics">
      <header className="op-analytics__head">
        <div>
          <h1>{t("staff.opAnalyticsTitle")}</h1>
          <p>{t("staff.opAnalyticsSub")}</p>
        </div>
      </header>

      {loading ? (
        <div className="op-loading">{t("common.loading")}</div>
      ) : !stats ? (
        <div className="op-error">{t("common.error")}</div>
      ) : (
        <>
          {/* KPI strip — answers Q1, Q4, Q5 at a glance */}
          <div className="op-kpis">
            <Kpi
              label="Cavabsız müraciət"
              value={stats.pendingNow}
              sub={stats.unansweredOver24h > 0
                ? `${stats.unansweredOver24h} ədəd 24 saatdan çoxdur`
                : "tarixçə təmiz"}
              tone={stats.unansweredOver24h > 0 ? "danger" : "warn"}
              href="/operator/appointments"
            />
            <Kpi
              label="Seansa çevrilmə"
              value={fmtPct(stats.conversionRatePct)}
              sub={`${stats.completedThisMonth} / ${stats.totalThisMonth} (bu ay)`}
              tone="good"
            />
            <Kpi
              label="Orta cavab vaxtı"
              value={fmtMin(stats.avgResponseMinutes)}
              sub="müraciət → təyin"
              tone="brand"
            />
            <Kpi
              label="Bu gün təyin edilib"
              value={stats.assignedToday}
              sub="randevu"
              tone="brand"
            />
            <Kpi
              label="Rədd %"
              value={fmtPct(stats.rejectionRatePct)}
              sub={`${stats.rejectedThisMonth} ədəd bu ay`}
              tone={stats.rejectionRatePct != null && stats.rejectionRatePct > 15 ? "danger" : "neutral"}
            />
          </div>

          <div className="op-grid">
            <Card title="Diqqət tələb edən müraciətçilər"
                  subtitle="Son 60 gündə insident və ya işarələnmə"
                  count={stats.patientsNeedingAttention.length}>
              {stats.patientsNeedingAttention.length === 0 ? (
                <Empty msg="İşarələnmiş müraciətçi yoxdur" />
              ) : (
                <div className="op-list">
                  {stats.patientsNeedingAttention.map(p => (
                    <PatientRow key={p.patientId} p={p} />
                  ))}
                </div>
              )}
            </Card>

            <Card title="Diqqət tələb edən psixoloqlar"
                  subtitle="Çox rədd etmiş və ya gec təsdiqləyən"
                  count={stats.psyConcerns.length}>
              {stats.psyConcerns.length === 0 ? (
                <Empty msg="Hələ ki problemli psixoloq yoxdur" />
              ) : (
                <div className="op-list">
                  {stats.psyConcerns.map(c => (
                    <PsyRow key={c.psychologistId} c={c} />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {crisis.length > 0 && (
            <Card title="Böhran — son 7 günün check-in-ləri"
                  subtitle="Baxılmamışlar qırmızıdır — zəng edin və 'Baxıldı' işarələyin"
                  count={crisis.filter(c => !c.acknowledgedAt).length}
                  tone="danger">
              <div className="op-list">
                {crisis.map(c => (
                  <CrisisRow key={c.id} c={c} acking={ackingId === c.id} onAck={() => ack(c.id)} />
                ))}
              </div>
            </Card>
          )}

          <Card title="Operator performansı"
                subtitle="Son 30 günlük təyinatlar və orta cavab vaxtı"
                count={stats.perOperator.length}>
            {stats.perOperator.length === 0 ? (
              <Empty msg="Son 30 gündə operator təyinatı yoxdur" />
            ) : (
              <div className="op-list">
                {stats.perOperator.map(o => (
                  <OperatorRow key={o.operatorId} o={o} max={Math.max(...stats.perOperator.map(x => x.assignedCount), 1)} />
                ))}
              </div>
            )}
          </Card>

          <Card title="Son 30 gün — gündəlik triage" subtitle="Gələn, təyin, rədd günlərə görə">
            <Legend />
            <DailyChart data={stats.last30Days} />
          </Card>
        </>
      )}
    </div>
  );
}

/* ─── Building blocks ────────────────────────────────────────────────────── */

function Kpi({
  label, value, sub, tone, href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone: "brand" | "good" | "warn" | "danger" | "neutral";
  href?: string;
}) {
  const inner = (
    <>
      <div className="op-kpi__label">{label}</div>
      <div className="op-kpi__value" data-tone={tone}>{value}</div>
      {sub && <div className="op-kpi__sub">{sub}</div>}
    </>
  );
  if (href) {
    return <Link href={href} className="op-kpi" data-tone={tone}>{inner}</Link>;
  }
  return <div className="op-kpi" data-tone={tone}>{inner}</div>;
}

function Card({
  title, subtitle, count, children, tone,
}: {
  title: string; subtitle?: string; count?: number; children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <div className="op-card" data-tone={tone}>
      <div className="op-card__head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {count != null && <span className="op-card__count" data-tone={tone}>{count}</span>}
      </div>
      <div className="op-card__body">{children}</div>
    </div>
  );
}

function CrisisRow({ c, acking, onAck }: {
  c: OperatorCrisisCheckIn;
  acking: boolean;
  onAck: () => void;
}) {
  const unacked = !c.acknowledgedAt;
  const waPhone = c.patientPhone ? c.patientPhone.replace(/[^\d]/g, "") : null;
  return (
    <div className="op-row"
      style={unacked
        ? { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10 }
        : { opacity: 0.65 }}>
      <div className="op-row__avatar" data-tone={unacked ? "danger" : "neutral"}>{c.moodScore}/5</div>
      <div className="op-row__main">
        <div className="op-row__name">
          {c.patientName}
          {c.riskLevel && (
            <span className="op-row__badge" data-tone="danger" style={{ marginLeft: 6 }}>
              {c.riskLevel === "CRITICAL" ? "Kritik" : c.riskLevel === "HIGH" ? "Yüksək" : c.riskLevel}
            </span>
          )}
          {!unacked && (
            <span className="op-row__badge" data-tone="neutral" style={{ marginLeft: 6 }}>
              ✓ baxılıb{c.acknowledgedByName ? ` · ${c.acknowledgedByName}` : ""}
            </span>
          )}
        </div>
        <div className="op-row__meta">
          {c.note && <span>«{c.note.length > 90 ? c.note.slice(0, 90) + "…" : c.note}»</span>}
          <span>· {new Date(c.createdAt).toLocaleString("az-AZ")}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        {c.patientPhone && (
          <>
            <a href={`tel:${c.patientPhone}`} title={`Zəng et: ${c.patientPhone}`}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 12, fontWeight: 600, color: "#1A2535", textDecoration: "none" }}>
              📞 Zəng
            </a>
            {waPhone && (
              <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer"
                title="WhatsApp ilə yaz"
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", fontSize: 12, fontWeight: 600, color: "#166534", textDecoration: "none" }}>
                WhatsApp
              </a>
            )}
          </>
        )}
        {unacked && (
          <button type="button" onClick={onAck} disabled={acking}
            style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {acking ? "…" : "Baxıldı"}
          </button>
        )}
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="op-empty">{msg}</div>;
}

function PatientRow({ p }: { p: PatientFlagged }) {
  const meta = REASON_LABEL[p.reason] ?? REASON_LABEL.RECENT_INCIDENT;
  return (
    <Link href={`/operator/appointments`} className="op-row" title="Müraciətlərə bax">
      <div className="op-row__avatar" data-tone={meta.tone}>{initials(p.name)}</div>
      <div className="op-row__main">
        <div className="op-row__name">{p.name}</div>
        <div className="op-row__meta">
          <span className="op-row__badge" data-tone={meta.tone}>{meta.text}</span>
          {p.noShowCount > 0 && <span>· {p.noShowCount} no-show</span>}
          {p.lateCancelCount > 0 && <span>· {p.lateCancelCount} geç ləğv</span>}
          {p.rejectCount > 0 && <span>· {p.rejectCount} rədd</span>}
          {p.lastIncidentAt && <span>· son: {fmtAgo(p.lastIncidentAt)}</span>}
        </div>
      </div>
    </Link>
  );
}

function PsyRow({ c }: { c: PsychologistConcern }) {
  const rejTone = (c.rejectionRatePct ?? 0) > 20 ? "danger" : (c.rejectionRatePct ?? 0) > 10 ? "warn" : "neutral";
  const slowTone = (c.avgConfirmMinutes ?? 0) > 720 ? "danger" : (c.avgConfirmMinutes ?? 0) > 240 ? "warn" : "neutral";
  return (
    <div className="op-row">
      <div className="op-row__avatar" data-tone="brand">{initials(c.name)}</div>
      <div className="op-row__main">
        <div className="op-row__name">{c.name}</div>
        <div className="op-row__meta">
          <span>{c.received} qəbul</span>
          {c.rejected > 0 && (
            <span className="op-row__badge" data-tone={rejTone}>
              {c.rejected} rədd · {fmtPct(c.rejectionRatePct)}
            </span>
          )}
          <span className="op-row__badge" data-tone={slowTone}>
            təsdiq: {fmtMin(c.avgConfirmMinutes)}
          </span>
        </div>
      </div>
    </div>
  );
}

function OperatorRow({ o, max }: { o: OperatorBreakdown; max: number }) {
  const pct = max > 0 ? (o.assignedCount / max) * 100 : 0;
  return (
    <div className="op-row op-row--op">
      <div className="op-row__avatar" data-tone="brand">{initials(o.name)}</div>
      <div className="op-row__main">
        <div className="op-row__name">{o.name}</div>
        <div className="op-row__bar">
          <div className="op-row__bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="op-row__meta">
          <span>{o.assignedCount} təyinat</span>
          <span>· orta cavab: {fmtMin(o.avgResponseMinutes)}</span>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="op-legend">
      <span><i style={{ background: "#3B82F6" }} /> Gələn</span>
      <span><i style={{ background: "#10B981" }} /> Təyin</span>
      <span><i style={{ background: "#F59E0B" }} /> Rədd</span>
    </div>
  );
}

function DailyChart({ data }: { data: { date: string; incoming: number; assigned: number; rejected: number }[] }) {
  const max = Math.max(1, ...data.map(d => Math.max(d.incoming, d.assigned + d.rejected)));
  return (
    <div className="op-chart">
      {data.map((d, i) => (
        <div key={i} className="op-chart__col"
          title={`${d.date}: ${d.incoming} gələn, ${d.assigned} təyin, ${d.rejected} rədd`}>
          <div style={{ background: "#3B82F6", height: `${(d.incoming / max) * 100}%`, minHeight: d.incoming > 0 ? 2 : 0, borderRadius: 2 }} />
          <div style={{ background: "#10B981", height: `${(d.assigned / max) * 100}%`, minHeight: d.assigned > 0 ? 2 : 0 }} />
          <div style={{ background: "#F59E0B", height: `${(d.rejected / max) * 100}%`, minHeight: d.rejected > 0 ? 2 : 0, borderRadius: "0 0 2px 2px" }} />
        </div>
      ))}
    </div>
  );
}
