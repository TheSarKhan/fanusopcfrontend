"use client";

import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  operatorApi,
  type OperatorStats,
  type OperatorCrisisCheckIn,
  type PsychologistConcern,
  type PatientFlagged,
  type OperatorBreakdown,
  type AnalyticsTimePoint,
  type AnalyticsPeriod,
  type PsychologistRankItem,
  type PaymentSummary,
  type RevenueBreakdown,
} from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";
import { toast as uiToast } from "@/components/Toast";
import { azFormatDateTime } from "@/lib/datetime";
import { formatAzn } from "@/lib/money";

const fmtMin = (m: number | null) => m == null ? "—" : m < 60 ? `${Math.round(m)} dəq` : (() => { const h = Math.floor(m / 60); const r = Math.round(m - h * 60); return r > 0 ? `${h} s ${r} dəq` : `${h} s`; })();
const fmtPct = (p: number | null) => p == null ? "—" : `${p}%`;
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
const fmtAgo = (iso: string | null) => { if (!iso) return ""; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return d <= 0 ? "bu gün" : d === 1 ? "dünən" : d < 30 ? `${d} gün öncə` : `${Math.floor(d / 30)} ay öncə`; };

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "daily", label: "Günlük" }, { value: "weekly", label: "Həftəlik" },
  { value: "monthly", label: "Aylıq" }, { value: "yearly", label: "İllik" },
];
const REASON_LABEL: Record<string, { text: string; bg: string; fg: string }> = {
  HIGH_NO_SHOW:     { text: "Yüksək no-show",   bg: "#FEE2E2", fg: "#991B1B" },
  HIGH_LATE_CANCEL: { text: "Yüksək geç ləğv",  bg: "#FEF3C7", fg: "#92400E" },
  HIGH_REJECT:      { text: "Çox rədd alıb",    bg: "#FEF3C7", fg: "#92400E" },
  MANUAL:           { text: "Manual işarələnib",bg: "#FEF3C7", fg: "#92400E" },
  DISPUTED_RECENT:  { text: "Mübahisəli seans", bg: "#FEE2E2", fg: "#991B1B" },
  RECENT_INCIDENT:  { text: "Son insident var", bg: "#F3F4F6", fg: "#374151" },
};
const AV = [{ bg: "#E0EBFA", color: "#1E3A8A" }, { bg: "#D1FAE5", color: "#065F46" }, { bg: "#FEF3C7", color: "#92400E" }, { bg: "#EDE9FE", color: "#5B21B6" }, { bg: "#FCE7F3", color: "#9D174D" }, { bg: "#CCFBF1", color: "#115E59" }];
const av = (i: number) => AV[Math.abs(i) % AV.length];

export default function OperatorAnalyticsPage() {
  const { t } = useT();
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [revenue, setRevenue] = useState<RevenueBreakdown | null>(null);
  const [ranking, setRanking] = useState<PsychologistRankItem[]>([]);
  const [crisis, setCrisis] = useState<OperatorCrisisCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackingId, setAckingId] = useState<number | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>("weekly");
  const [series, setSeries] = useState<AnalyticsTimePoint[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(true);

  const load = () => {
    Promise.allSettled([
      operatorApi.stats(), operatorApi.crisisCheckIns(), operatorApi.psychologistRanking(),
      operatorApi.paymentsSummary(), operatorApi.analyticsRevenue(),
    ]).then(([s, c, r, sm, rv]) => {
      if (s.status === "fulfilled") setStats(s.value);
      if (c.status === "fulfilled") setCrisis(c.value);
      if (r.status === "fulfilled") setRanking(r.value);
      if (sm.status === "fulfilled") setSummary(sm.value);
      if (rv.status === "fulfilled") setRevenue(rv.value);
      setLoading(false);
    });
  };
  useEffect(load, []);

  useEffect(() => {
    let alive = true; setSeriesLoading(true);
    operatorApi.analyticsSessions(period).then(d => { if (alive) setSeries(d); }).catch(() => { if (alive) setSeries([]); }).finally(() => { if (alive) setSeriesLoading(false); });
    return () => { alive = false; };
  }, [period]);

  useEffect(() => subscribeNotifications(n => { if (n.type === "CRISIS_CHECK_IN") load(); }), []);

  const ack = async (id: number) => {
    setAckingId(id);
    try {
      const u = await operatorApi.acknowledgeCrisisCheckIn(id);
      setCrisis(prev => prev.map(c => c.id === id ? u : c));
    } catch (e) { uiToast((e as Error).message, "error"); } finally { setAckingId(null); }
  };

  const finKpis = useMemo(() => {
    if (!summary) return [];
    const gross = summary.paidMonthSum + summary.refundedMonthSum;
    const rate = gross > 0 ? Math.round((summary.refundedMonthSum / gross) * 1000) / 10 : 0;
    return [
      { label: "Bu ay net gəlir", value: formatAzn(summary.paidMonthSum), sub: `${summary.paidMonthCount} ödəniş`, accent: "#047857", icon: I_MONEY },
      { label: "Gözləyən məbləğ", value: formatAzn(summary.pendingSum), sub: `${summary.pendingCount} ödəniş`, accent: "#92400E", icon: I_CLOCK, href: "/operator/payments" },
      { label: "Bu ay geri qaytarılıb", value: formatAzn(summary.refundedMonthSum), sub: "bu ay", accent: "#991B1B", icon: I_UNDO },
      { label: "Geri qaytarma faizi", value: `${String(rate).replace(".", ",")}%`, sub: `${formatAzn(summary.refundedMonthSum)} / ${formatAzn(gross)}`, accent: "#991B1B", icon: I_TREND },
      { label: "Bu ay ödəniş sayı", value: String(summary.paidMonthCount + summary.pendingCount), sub: `${summary.paidMonthCount} ödənilib · ${summary.pendingCount} gözləyir`, accent: "#082F6D", icon: I_LIST },
    ];
  }, [summary]);

  const revTotal = useMemo(() => series.reduce((s, d) => s + (d.revenue ?? 0), 0), [series]);

  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}><div className="op-loading">{t("common.loading")}</div></div>;
  if (!stats) return <div className="op-error">{t("common.error")}</div>;

  const opKpis: { label: string; value: string; sub: string; numColor: string; subColor: string; href?: string }[] = [
    { label: "Cavabsız müraciət", value: String(stats.pendingNow), sub: stats.unansweredOver24h > 0 ? `${stats.unansweredOver24h} · 24 saatdan çox` : "tarixçə təmiz", numColor: stats.unansweredOver24h > 0 ? "#991B1B" : "#92400E", subColor: stats.unansweredOver24h > 0 ? "#991B1B" : "#9DB0CC", href: "/operator/appointments" },
    { label: "Seansa çevrilmə", value: fmtPct(stats.conversionRatePct), sub: `${stats.completedThisMonth}/${stats.totalThisMonth} bu ay`, numColor: "#047857", subColor: "#9DB0CC" },
    { label: "Orta cavab vaxtı", value: fmtMin(stats.avgResponseMinutes), sub: "müraciət → təyin", numColor: "#082F6D", subColor: "#9DB0CC" },
    { label: "Bu gün təyin edilib", value: String(stats.assignedToday), sub: "randevu", numColor: "#082F6D", subColor: "#9DB0CC" },
    { label: "Rədd faizi", value: fmtPct(stats.rejectionRatePct), sub: `${stats.rejectedThisMonth} bu ay`, numColor: stats.rejectionRatePct != null && stats.rejectionRatePct > 15 ? "#991B1B" : "#374151", subColor: "#9DB0CC" },
  ];

  const unseen = crisis.filter(c => !c.acknowledgedAt).length;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>

      <PageHeader
        title={t("staff.opAnalyticsTitle")}
        subtitle="Gəlir, geri qaytarmalar və əməliyyat göstəriciləri"
      />

      {/* MALİYYƏ */}
      {finKpis.length > 0 && <>
        <SectionLabel>Maliyyə</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(180px, 100%), 1fr))", gap: 13, marginBottom: 24 }}>
          {finKpis.map(k => {
            const inner = <>
              <span style={{ position: "absolute", top: 15, right: 15, color: k.accent }}><Ico d={k.icon} /></span>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 }}>{k.label}</div>
              <div className="an-num" style={{ fontSize: 21, fontWeight: 800, color: k.accent, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11.5, color: "#9DB0CC", fontWeight: 600, marginTop: 3 }}>{k.sub}{k.href ? " →" : ""}</div>
            </>;
            const st: React.CSSProperties = { ...CARD, borderLeft: `3px solid ${k.accent}`, padding: "15px 17px", position: "relative", textDecoration: "none", display: "block" };
            return k.href ? <Link key={k.label} href={k.href} style={st}>{inner}</Link> : <div key={k.label} style={st}>{inner}</div>;
          })}
        </div>
      </>}

      {/* GƏLİR DİNAMİKASI */}
      <div style={{ ...CARD, padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--oxford)" }}>Gəlir dinamikası</div>
          <PeriodTabs period={period} onPick={setPeriod} />
        </div>
        <Legend items={[{ c: "#047857", t: "Net gəlir" }]} />
        {seriesLoading ? <div className="op-loading">{t("common.loading")}</div>
          : series.length === 0 ? <Empty msg="Bu dövr üçün məlumat yoxdur" />
          : <LineChart series={[{ data: series.map(d => d.revenue ?? 0), color: "#047857", fill: true }]} labels={series.map(d => d.bucket)} money />}
        {series.length > 0 && <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 999, padding: "7px 13px", marginTop: 14, fontSize: 13, fontWeight: 700, color: "#047857" }}>Bu dövrün gəliri: <span className="an-num">{formatAzn(revTotal)}</span></div>}
      </div>

      {/* GƏLİR BÖLGÜSÜ */}
      {revenue && (revenue.packageRevenue + revenue.singleRevenue > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(320px, 100%), 1fr))", gap: 18, marginBottom: 24 }}>
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: "var(--oxford)" }}>Gəlir mənbəyinə görə</div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
              <Donut a={revenue.packageRevenue} b={revenue.singleRevenue} />
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                <SourceRow color="#1051B7" amount={revenue.packageRevenue} total={revenue.packageRevenue + revenue.singleRevenue} label="Paket" />
                <SourceRow color="#9DB8E8" amount={revenue.singleRevenue} total={revenue.packageRevenue + revenue.singleRevenue} label="Tək seans" />
              </div>
            </div>
          </div>
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--oxford)" }}>Psixoloq üzrə gəlir</div>
            {revenue.byPsychologist.length === 0 ? <Empty msg="Gəlir məlumatı yoxdur" /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {revenue.byPsychologist.map((p, i) => {
                  const max = revenue.byPsychologist[0].revenue || 1;
                  return (
                    <div key={p.psychologistId}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford)" }}>{p.name}</span>
                        <span className="an-num" style={{ fontSize: 13, fontWeight: 700, color: "#082F6D" }}>{formatAzn(p.revenue)}</span>
                      </div>
                      <Bar pct={(p.revenue / max) * 100} delay={i} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ƏMƏLİYYAT */}
      <SectionLabel>Əməliyyat</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(175px, 100%), 1fr))", gap: 13, marginBottom: 24 }}>
        {opKpis.map(k => {
          const inner = <>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 }}>{k.label}</div>
            <div className="an-num" style={{ fontSize: 21, fontWeight: 800, color: k.numColor, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: k.subColor, fontWeight: 600, marginTop: 3 }}>{k.sub}{k.href ? " →" : ""}</div>
          </>;
          const st: React.CSSProperties = { ...CARD, padding: "15px 17px", textDecoration: "none", display: "block" };
          return k.href ? <Link key={k.label} href={k.href} style={st}>{inner}</Link> : <div key={k.label} style={st}>{inner}</div>;
        })}
      </div>

      {/* SEANS DİNAMİKASI */}
      <div style={{ ...CARD, padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, flex: 1, color: "var(--oxford)" }}>Seans dinamikası</div>
          <Legend items={[{ c: "#10B981", t: "Tamamlanmış" }, { c: "#EF4444", t: "Ləğv" }]} inline />
        </div>
        {seriesLoading ? <div className="op-loading">{t("common.loading")}</div>
          : series.length === 0 ? <Empty msg="Bu dövr üçün məlumat yoxdur" />
          : <LineChart series={[{ data: series.map(d => d.completed), color: "#10B981" }, { data: series.map(d => d.cancelled), color: "#EF4444" }]} labels={series.map(d => d.bucket)} />}
      </div>

      {/* TRIAGE 30 GÜN */}
      <div style={{ ...CARD, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, flex: 1, color: "var(--oxford)" }}>Son 30 gün · Triyaj</div>
          <Legend dot items={[{ c: "#3B82F6", t: "Gələn" }, { c: "#10B981", t: "Təyin" }, { c: "#F59E0B", t: "Rədd" }]} inline />
        </div>
        {stats.last30Days.length === 0 ? <Empty msg="Məlumat yoxdur" /> : <TriageBars data={stats.last30Days} />}
      </div>

      {/* PSİXOLOQ SIRALAMASI */}
      <div style={{ ...CARD, padding: 20, marginBottom: 18 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 15, color: "var(--oxford)" }}>Psixoloq sıralaması</div>
        {ranking.length === 0 ? <Empty msg="Sıralama üçün məlumat yoxdur" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {ranking.slice(0, 5).map((r, i) => {
              const max = ranking[0].completedSessions || 1;
              const a = av(r.psychologistId);
              return (
                <Link key={r.psychologistId} href={`/operator/psychologists/${r.psychologistId}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: i === 0 ? "#FEF3C7" : "#F2F6FD", color: i === 0 ? "#92400E" : "#082F6D", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{i + 1}</span>
                  <span style={{ width: 38, height: 38, borderRadius: 11, background: a.bg, color: a.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flex: "none" }}>{initials(r.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>{r.completedSessions} tamamlanmış seans{r.activePatients > 0 ? ` · ${r.activePatients} aktiv müraciətçi` : ""}</div>
                  </div>
                  <div style={{ flex: 1, maxWidth: 220, minWidth: 80 }}><Bar pct={(r.completedSessions / max) * 100} delay={i} /></div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* OPERATOR PERFORMANSI */}
      <div style={{ ...CARD, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 15, color: "var(--oxford)" }}>Operator performansı</div>
        {stats.perOperator.length === 0 ? <Empty msg="Son 30 gündə operator təyinatı yoxdur" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {stats.perOperator.map((o, i) => {
              const max = Math.max(...stats.perOperator.map(x => x.assignedCount), 1);
              const a = av(o.operatorId);
              return (
                <div key={o.operatorId} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ width: 36, height: 36, borderRadius: "50%", background: a.bg, color: a.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{initials(o.name)}</span>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 5, color: "var(--oxford)" }}>{o.name}</div>
                    <Bar pct={(o.assignedCount / max) * 100} delay={i} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, flex: "none" }}>{o.assignedCount} təyinat · orta cavab: {fmtMin(o.avgResponseMinutes)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DİQQƏT TƏLƏB EDƏNLƏR */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(320px, 100%), 1fr))", gap: 18, marginBottom: 24 }}>
        <div style={{ ...CARD, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--oxford)" }}>Diqqət · Müraciətçilər</div>
          {stats.patientsNeedingAttention.length === 0 ? <Empty msg="İşarələnmiş müraciətçi yoxdur" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stats.patientsNeedingAttention.map(p => <FlagPatient key={p.patientId} p={p} />)}
            </div>
          )}
        </div>
        <div style={{ ...CARD, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--oxford)" }}>Diqqət · Psixoloqlar</div>
          {stats.psyConcerns.length === 0 ? <Empty msg="Problemli psixoloq yoxdur" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stats.psyConcerns.map(c => <FlagPsy key={c.psychologistId} c={c} />)}
            </div>
          )}
        </div>
      </div>

      {/* BÖHRAN */}
      {crisis.length > 0 && (
        <div style={{ background: "#FFF5F5", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #FECACA", borderLeft: "3px solid #DC2626", padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 15 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "#FEE2E2", color: "#991B1B", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ico d="M22 12h-4l-3 9L9 3l-3 9H2" size={16} /></span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>Böhran check-in-ləri</span>
            {unseen > 0 && <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999 }}>{unseen} baxılmamış</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {crisis.map(c => <CrisisRow key={c.id} c={c} acking={ackingId === c.id} onAck={() => ack(c.id)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Komponentlər ───────────────────────────────────────────────────────── */

const CARD: React.CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8" };

function SectionLabel({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 12 }}>{children}</div>;
}
function Empty({ msg }: { msg: string }) { return <div className="op-empty">{msg}</div>; }
function Bar({ pct, delay = 0 }: { pct: number; delay?: number }) {
  return <div style={{ height: 8, background: "#E4ECFA", borderRadius: 999, overflow: "hidden" }}><div className="an-bar" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: "linear-gradient(90deg,#1051B7,#3A74D6)", borderRadius: 999, animationDelay: `${delay * 60}ms` }} /></div>;
}
function PeriodTabs({ period, onPick }: { period: AnalyticsPeriod; onPick: (p: AnalyticsPeriod) => void }) {
  return (
    <div style={{ display: "inline-flex", background: "#F0F4FA", borderRadius: 9, padding: 3, gap: 2 }}>
      {PERIODS.map(p => {
        const a = period === p.value;
        return <button key={p.value} type="button" onClick={() => onPick(p.value)} style={{ border: "none", borderRadius: 7, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: a ? "#fff" : "transparent", color: a ? "#082F6D" : "var(--oxford-60)", boxShadow: a ? "0 1px 3px rgba(8,47,109,.12)" : "none" }}>{p.label}</button>;
      })}
    </div>
  );
}
function Legend({ items, inline, dot }: { items: { c: string; t: string }[]; inline?: boolean; dot?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: inline ? 0 : 10 }}>
      {items.map(it => <span key={it.t} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--oxford-60)" }}><span style={{ width: dot ? 9 : 10, height: dot ? 9 : 3, borderRadius: dot ? "50%" : 2, background: it.c }} />{it.t}</span>)}
    </div>
  );
}
function SourceRow({ color, amount, total, label }: { color: string; amount: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: color, flex: "none" }} />
      <div>
        <div className="an-num" style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{formatAzn(amount)}</div>
        <div style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600 }}>{label} · {pct}%</div>
      </div>
    </div>
  );
}

function LineChart({ series, labels, money }: { series: { data: number[]; color: string; fill?: boolean }[]; labels: string[]; money?: boolean }) {
  const W = 860, H = 180, padL = money ? 40 : 24, padR = 12, padT = 12, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const all = series.flatMap(s => s.data);
  const max = Math.max(...all, 1);
  const n = Math.max(1, series[0].data.length);
  const x = (i: number) => padL + (n > 1 ? iw * i / (n - 1) : iw / 2);
  const y = (v: number) => padT + ih * (1 - v / max);
  const grid = [0, max / 2, max];
  const step = labels.length > 8 ? Math.ceil(labels.length / 8) : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: "block" }}>
      <defs><linearGradient id="anG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#047857" stopOpacity={0.16} /><stop offset="100%" stopColor="#047857" stopOpacity={0} /></linearGradient></defs>
      {grid.map((g, k) => (
        <g key={k}>
          <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#F0F4FA" strokeWidth={1} />
          <text x={padL - 6} y={y(g) + 3} textAnchor="end" fontSize={9} fontWeight={600} fill="#9DB0CC">{money ? Math.round(g) : Math.round(g)}</text>
        </g>
      ))}
      {series.map((s, si) => {
        let line = ""; s.data.forEach((v, i) => { line += (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " "; });
        const fill = s.fill ? line + `L${x(n - 1).toFixed(1)} ${padT + ih} L${padL} ${padT + ih} Z` : null;
        return (
          <g key={si}>
            {fill && <path d={fill} fill="url(#anG)" />}
            <path d={line} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {s.data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color} stroke="#fff" strokeWidth={1.5} />)}
          </g>
        );
      })}
      {labels.map((l, i) => i % step === 0 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="#9DB0CC">{l}</text> : null)}
    </svg>
  );
}

function TriageBars({ data }: { data: { date: string; incoming: number; assigned: number; rejected: number }[] }) {
  const W = 860, H = 180, padL = 20, padR = 12, padT = 12, padB = 14;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = data.length;
  const max = Math.max(...data.map(d => Math.max(d.incoming, d.assigned, d.rejected)), 1);
  const groupW = iw / n, barW = Math.max(1.5, groupW / 4.2);
  const y = (v: number) => padT + ih * (1 - v / max);
  const cols: Record<string, string> = { incoming: "#3B82F6", assigned: "#10B981", rejected: "#F59E0B" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: "block" }}>
      <line x1={padL} x2={W - padR} y1={padT + ih} y2={padT + ih} stroke="#EDF1F8" strokeWidth={1} />
      {data.map((d, i) => {
        const gx = padL + groupW * i + groupW * 0.1;
        return <g key={i}>{(["incoming", "assigned", "rejected"] as const).map((k, j) => {
          const v = d[k]; const h = ih * v / max;
          return <rect key={k} x={gx + j * (barW + 1.5)} y={y(v)} width={barW} height={h} rx={2} fill={cols[k]} />;
        })}</g>;
      })}
    </svg>
  );
}

function Donut({ a, b }: { a: number; b: number }) {
  const total = a + b || 1, r = 42, sw = 18, C = 2 * Math.PI * r;
  const segA = C * (a / total);
  return (
    <svg width={110} height={110} viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={55} cy={55} r={r} fill="none" stroke="#9DB8E8" strokeWidth={sw} />
      <circle cx={55} cy={55} r={r} fill="none" stroke="#1051B7" strokeWidth={sw} strokeDasharray={`${segA} ${C - segA}`} strokeDashoffset={0} />
    </svg>
  );
}

function FlagPatient({ p }: { p: PatientFlagged }) {
  const m = REASON_LABEL[p.reason] ?? REASON_LABEL.RECENT_INCIDENT;
  const a = av(p.patientId);
  return (
    <Link href="/operator/appointments" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}>
      <span style={{ width: 34, height: 34, borderRadius: "50%", background: a.bg, color: a.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{initials(p.name)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{p.name}</span>
          <span style={{ background: m.bg, color: m.fg, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{m.text}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600, marginTop: 2 }}>
          {[p.noShowCount > 0 && `${p.noShowCount} no-show`, p.lateCancelCount > 0 && `${p.lateCancelCount} geç ləğv`, p.rejectCount > 0 && `${p.rejectCount} rədd`, p.lastIncidentAt && `son: ${fmtAgo(p.lastIncidentAt)}`].filter(Boolean).join(" · ")}
        </div>
      </div>
    </Link>
  );
}

function FlagPsy({ c }: { c: PsychologistConcern }) {
  const rejTone = (c.rejectionRatePct ?? 0) > 20 ? { bg: "#FEE2E2", fg: "#991B1B" } : { bg: "#FEF3C7", fg: "#92400E" };
  const a = av(c.psychologistId);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <span style={{ width: 34, height: 34, borderRadius: "50%", background: a.bg, color: a.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{initials(c.name)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{c.name}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          {c.rejected > 0 && <span style={{ background: rejTone.bg, color: rejTone.fg, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{c.rejected} rədd · {fmtPct(c.rejectionRatePct)}</span>}
          <span style={{ background: "#F3F4F6", color: "#374151", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>təsdiq: {fmtMin(c.avgConfirmMinutes)}</span>
        </div>
      </div>
    </div>
  );
}

function CrisisRow({ c, acking, onAck }: { c: OperatorCrisisCheckIn; acking: boolean; onAck: () => void }) {
  const unacked = !c.acknowledgedAt;
  const wa = c.patientPhone ? c.patientPhone.replace(/[^\d]/g, "") : null;
  const a = av(c.id);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: unacked ? "#FFF1F1" : "#fff", border: `1px solid ${unacked ? "#FECACA" : "#EDF1F8"}`, borderRadius: 11, padding: "12px 14px", flexWrap: "wrap", opacity: unacked ? 1 : 0.7 }}>
      <span style={{ background: unacked ? "#FEE2E2" : "#FEF3C7", color: unacked ? "#991B1B" : "#92400E", fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 9, flex: "none" }}>{c.moodScore}/5</span>
      <span style={{ width: 34, height: 34, borderRadius: "50%", background: a.bg, color: a.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{initials(c.patientName)}</span>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{c.patientName}</span>
          {c.riskLevel && <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{c.riskLevel === "CRITICAL" ? "Kritik" : c.riskLevel === "HIGH" ? "Yüksək" : c.riskLevel}</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--oxford-60)", fontStyle: "italic", fontWeight: 500, marginTop: 3 }}>{c.note ? `«${c.note.length > 90 ? c.note.slice(0, 90) + "…" : c.note}» · ` : ""}{azFormatDateTime(c.createdAt)}</div>
      </div>
      <div style={{ display: "flex", gap: 7, flex: "none" }}>
        {c.patientPhone && <a href={`tel:${c.patientPhone}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "#047857", border: "1px solid #A7F3D0", fontSize: 11.5, fontWeight: 600, padding: "6px 11px", borderRadius: 9, textDecoration: "none" }}>Zəng</a>}
        {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0", fontSize: 11.5, fontWeight: 600, padding: "6px 11px", borderRadius: 9, textDecoration: "none" }}>WhatsApp</a>}
        {unacked
          ? <button type="button" onClick={onAck} disabled={acking} style={{ background: "#B91C1C", color: "#fff", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", cursor: acking ? "default" : "pointer" }}>{acking ? "…" : "Baxıldı"}</button>
          : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "#9DB0CC" }}><Ico d="M20 6L9 17l-5-5" size={12} /> baxılıb</span>}
      </div>
    </div>
  );
}

function Ico({ d, size = 17 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
const I_MONEY = "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6";
const I_CLOCK = "M12 7v5l3 2 M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z";
const I_UNDO = "M3 7v6h6 M3 13a9 9 0 1 0 3-7.7L3 8";
const I_TREND = "M3 17l6-6 4 4 8-8 M21 7v6h-6";
const I_LIST = "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11";

const CSS = `
.an-num{font-variant-numeric:tabular-nums}
@keyframes anBar{from{width:0}}
.an-bar{animation:anBar .5s ease-out both}
`;
