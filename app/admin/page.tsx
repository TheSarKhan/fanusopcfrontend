"use client";

// Admin dashboard — platformanın TAM mənzərəsi, ekranın bütün enində.
//
// Quruluş: hər bölmə tam en tutur, daxilində avtomatik uyğunlaşan grid var
// (ayrıca desktop/mobil versiya YOXDUR — tək responsive layout).
//
// DİQQƏT: burada YALNIZ real ölçülən data göstərilir. Əvvəl backend-də məqalə
// baxışı, trafik mənbələri, saatlıq heatmap, konversiya və orta reytinq uydurma
// düsturlarla doldurulurdu — hamısı silindi (bax ReportsService/DashboardService).
// Ölçülməyən göstərici bu səhifəyə əlavə edilməməlidir.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  adminApi,
  type DashboardMetrics,
  type CommandCenter,
  type CommandCenterQueue,
  type AdminApptSummary,
  type PsychologistWorkload,
  type FinanceSummary,
  type PaymentSummary,
  type ReportsData,
  type TrendPoint,
  type PayoutBalance,
  type PsychologistOverride,
} from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";
import PanelIcon from "@/components/PanelIcon";
import {
  AppointmentFlowChart, WorkloadChart, TopicPieChart, TrendChart, FunnelChart,
} from "@/components/DashboardCharts";
import {
  PageHead, Card, CardPad, Stats, Stat, Status, Button, SectionTitle, DataTable,
  type Column,
} from "@/components/ui";

const money = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toFixed(2)} ₼`;
const num = (v: number | null | undefined) => (v == null ? "—" : String(v));

/** Növbənin yaşı — həm etiket, həm sıralama açarı. */
function ageOf(iso: string | null): { label: string; hours: number } {
  if (!iso) return { label: "—", hours: -1 };
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.max(0, Math.floor(ms / 3_600_000));
  if (hours < 1) return { label: "1 saatdan az", hours };
  if (hours < 24) return { label: `${hours} saat`, hours };
  return { label: `${Math.floor(hours / 24)} gün`, hours };
}

type QueueRow = {
  key: string; label: string; href: string;
  queue: CommandCenterQueue; escalated?: number;
};

export default function AdminDashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [cc, setCc] = useState<CommandCenter | null>(null);
  const [appt, setAppt] = useState<AdminApptSummary | null>(null);
  const [workload, setWorkload] = useState<PsychologistWorkload[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [payments, setPayments] = useState<PaymentSummary | null>(null);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [balances, setBalances] = useState<PayoutBalance[]>([]);
  const [overrides, setOverrides] = useState<PsychologistOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  // Hər blok ayrıca endpoint-dən gəlir. Biri sınsa qalanı yenə göstərilməlidir —
  // ona görə allSettled; ümumi xəta yalnız HAMISI sınanda çıxır.
  const load = useCallback(() => {
    setLoading(true); setError(null);
    Promise.allSettled([
      adminApi.getDashboardMetrics(),
      adminApi.getCommandCenter(),
      adminApi.getAppointmentsSummary(),
      adminApi.getPsychologistWorkload(),
      adminApi.financeSummary(),
      adminApi.paymentsSummary(),
      adminApi.getReports(),
      adminApi.getAppointmentsTrend(30),
      adminApi.payoutBalances(),
      adminApi.commissionOverrides(),
    ]).then(r => {
      const [m, c, a, w, f, p, rep, tr, bal, ovr] = r;
      if (m.status === "fulfilled") setMetrics(m.value);
      if (c.status === "fulfilled") setCc(c.value);
      if (a.status === "fulfilled") setAppt(a.value);
      if (w.status === "fulfilled") setWorkload(w.value);
      if (f.status === "fulfilled") setFinance(f.value);
      if (p.status === "fulfilled") setPayments(p.value);
      if (rep.status === "fulfilled") setReports(rep.value);
      if (tr.status === "fulfilled") setTrend(tr.value);
      if (bal.status === "fulfilled") setBalances(bal.value);
      if (ovr.status === "fulfilled") setOverrides(ovr.value);
      if (r.every(x => x.status === "rejected")) {
        setError("Məlumat yüklənmədi — bağlantını yoxlayın.");
      }
      setLoadedAt(new Date().toISOString());
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  // Növbələr yaşa görə sıralanır — ən çox gözləyən öndə.
  const queues: QueueRow[] = useMemo(() => {
    if (!cc) return [];
    const rows: QueueRow[] = [
      { key: "applications", label: "Psixoloq müraciətləri", href: "/admin/psychologists", queue: cc.applications },
      { key: "deletions", label: "Hesab silinmə istəkləri", href: "/admin/approvals", queue: cc.deletionRequests },
      { key: "disputed", label: "Mübahisəli seanslar", href: "/admin/appointments", queue: cc.disputed, escalated: cc.disputed.escalatedCount },
      { key: "cancelRequests", label: "Ləğv istəkləri", href: "/admin/appointments", queue: cc.cancelRequests },
      { key: "slaOverdue", label: `Cavabsız müraciət (${cc.slaHours}s+)`, href: "/admin/appointments", queue: cc.slaOverdue },
      { key: "reviews", label: "Rəy moderasiyası", href: "/admin/reviews", queue: cc.reviews },
      { key: "contactMessages", label: "Əlaqə mesajları", href: "/admin/messages", queue: cc.contactMessages },
      { key: "emailFailures", label: "Uğursuz e-poçtlar (24s)", href: "/admin/notifications", queue: cc.emailFailures },
    ];
    return rows
      .filter(r => r.queue.count > 0)
      .sort((a, b) => ageOf(b.queue.oldestAt).hours - ageOf(a.queue.oldestAt).hours);
  }, [cc]);

  const totalQueued = queues.reduce((s, q) => s + q.queue.count, 0);
  const totalOwed = balances.reduce((s, b) => s + (b.balance > 0 ? b.balance : 0), 0);

  // Sıfır datalı qrafik boş çərçivə kimi görünür (oxlar var, sütun yoxdur) —
  // belə halda qrafik əvəzinə izahlı mətn göstərilir.
  const hasWorkload = workload.some(w => w.total > 0);
  const hasFunnel = (reports?.funnel ?? []).some(f => f.count > 0);
  const hasFlow = (metrics?.appointmentFlow ?? []).some(f => f.confirmed + f.pending + f.cancelled > 0);
  const hasTrend = trend.some(t => t.count > 0);

  const balanceCols: Column<PayoutBalance>[] = [
    { key: "psychologistName", header: "Psixoloq", cell: b => b.psychologistName },
    { key: "earnedNet", header: "Qazanılıb", numeric: true, cell: b => money(b.earnedNet) },
    { key: "paidOut", header: "Ödənilib", numeric: true, cell: b => money(b.paidOut) },
    { key: "pendingPayout", header: "Hazırlanıb", numeric: true, cell: b => b.pendingPayout > 0 ? money(b.pendingPayout) : "—" },
    { key: "balance", header: "Qalıq", numeric: true, cell: b => <strong>{money(b.balance)}</strong> },
  ];

  const perfCols: Column<NonNullable<ReportsData["performance"]>[number]>[] = [
    { key: "name", header: "Psixoloq", cell: p => p.name },
    { key: "sessions", header: "Tamamlanmış", numeric: true, cell: p => num(p.sessions) },
    { key: "completionPct", header: "Tamamlanma", numeric: true, cell: p => `${p.completionPct}%` },
    { key: "rating", header: "Reytinq", numeric: true, cell: p => p.rating > 0 ? p.rating.toFixed(1) : "—" },
  ];

  const articleCols: Column<NonNullable<DashboardMetrics["topArticles"]>[number]>[] = [
    { key: "rank", header: "#", numeric: true, cell: a => num(a.rank) },
    { key: "title", header: "Başlıq", cell: a => a.title },
    { key: "author", header: "Müəllif", hideOnMobile: true, cell: a => a.author },
    { key: "category", header: "Kateqoriya", hideOnMobile: true, cell: a => a.category || "—" },
    { key: "views", header: "Baxış", numeric: true, cell: a => <strong>{num(a.views)}</strong> },
  ];

  const overrideCols: Column<PsychologistOverride>[] = [
    { key: "psychologistName", header: "Psixoloq", cell: o => o.psychologistName },
    { key: "overridePercent", header: "Fərdi faiz", numeric: true, cell: o => <strong>{o.overridePercent}%</strong> },
    { key: "globalPercent", header: "Qlobal faiz", numeric: true, cell: o => o.globalPercent != null ? `${o.globalPercent}%` : "—" },
  ];

  if (!mounted) return null;

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead
        title="İdarə paneli"
        sub={loadedAt ? `Son yenilənmə: ${azFormatDateTime(loadedAt)}` : "Platformanın ümumi mənzərəsi."}
        actions={
          <Button variant="ghost" onClick={load} disabled={loading}>
            <PanelIcon name="chart" size={15} /> {loading ? "Yüklənir…" : "Yenilə"}
          </Button>
        }
      />

      {error && (
        <Card style={{ marginBottom: 16 }}>
          <CardPad>
            <div className="fx-subtitle" style={{ marginBottom: 10 }}>{error}</div>
            <Button variant="ghost" size="sm" onClick={load}>Yenidən cəhd et</Button>
          </CardPad>
        </Card>
      )}

      {/* ── KPI — TƏK sətir. Əvvəl 12 göstərici vardı və ikinci sətirə keçib
             sağda boş yer buraxırdı. İndi 8-dir: geniş ekranda bir sətrə sığır.
             Çıxarılanlar səhifədə onsuz da var — orta reytinq "Performans"da,
             məqalə baxışı "Ən çox oxunan məqalələr"də, konversiya isə
             "Konversiya hunisi" kartında. Təkrar göstərmək yer yeyirdi. ── */}
      <Stats style={{ marginBottom: 16 }}>
        <Stat value={metrics ? metrics.totalUsers.value : "—"} label="İstifadəçi"
          meta={metrics?.totalUsers.deltaPercent != null
            ? `${metrics.totalUsers.deltaPercent > 0 ? "+" : ""}${metrics.totalUsers.deltaPercent}% ${metrics.totalUsers.label}` : undefined} />
        <Stat value={metrics ? metrics.activePsychologists.value : "—"} label="Aktiv psixoloq" />
        <Stat value={appt ? appt.total : "—"} label="Randevu (cəmi)" />
        <Stat value={appt ? appt.pending : "—"} label="Gözləyən randevu" />
        <Stat value={reports ? `${reports.completion.value}%` : "—"} label="Tamamlanma" />
        <Stat value={payments ? money(payments.pendingSum) : "—"} label="Gözləyən ödəniş" />
        <Stat value={finance ? money(finance.totalRevenue) : "—"} label="Ümumi gəlir" />
        <Stat value={money(totalOwed)} label="Psixoloqlara borc" />
      </Stats>

      {/* ── Diqqət tələb edənlər — tam en, kart şəbəkəsi ── */}
      <Card style={{ marginBottom: 16 }}>
        <CardPad>
          <SectionTitle>Diqqət tələb edir{totalQueued > 0 ? ` (${totalQueued})` : ""}</SectionTitle>
          {loading && queues.length === 0 ? (
            <div className="fx-subtitle" style={{ paddingTop: 10 }}>Yüklənir…</div>
          ) : queues.length === 0 ? (
            <div style={{ paddingTop: 10 }}>
              <Status tone="positive">Boşdur</Status>
              <div className="fx-subtitle" style={{ marginTop: 6 }}>Qərar gözləyən heç nə yoxdur.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {queues.map(q => {
                const age = ageOf(q.queue.oldestAt);
                return (
                  <Link key={q.key} href={q.href}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                      padding: "12px 14px", borderRadius: 10, textDecoration: "none",
                      color: "inherit", border: "1px solid var(--hairline)",
                    }}>
                    <span style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{q.label}</div>
                      <div className="fx-subtitle">
                        {age.hours >= 0 ? `Ən köhnəsi ${age.label} gözləyir` : "Vaxt məlum deyil"}
                        {q.escalated ? `, ${q.escalated} eskalasiya` : ""}
                      </div>
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 20, flexShrink: 0 }}>{q.queue.count}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardPad>
      </Card>

      {/* ── Randevu qrafikləri — iki bərabər sütun, tam en ── */}
      <Section cols="repeat(auto-fit, minmax(420px, 1fr))">
        <Card fill>
          <CardPad>
            <SectionTitle>Randevu axını — son 14 gün</SectionTitle>
            {hasFlow
              ? <AppointmentFlowChart data={metrics!.appointmentFlow} />
              : <Empty loading={loading} text="Son 14 gündə randevu qeydi yoxdur." />}
          </CardPad>
        </Card>
        <Card fill>
          <CardPad>
            <SectionTitle>Randevu trendi — son 30 gün</SectionTitle>
            {hasTrend
              ? <TrendChart data={trend} />
              : <Empty loading={loading} text="Son 30 gündə randevu qeydi yoxdur." />}
          </CardPad>
        </Card>
      </Section>

      {/* ── Status bölgüsü + huni ── */}
      <Section cols="repeat(auto-fit, minmax(320px, 1fr))">
        <Card fill>
          <CardPad>
            <SectionTitle>Randevu statusları</SectionTitle>
            <div style={{ display: "grid", gap: 10, paddingTop: 6, minHeight: BLOCK_MIN, alignContent: "start" }}>
              <MetaRow label="Cəmi" value={num(appt?.total)} />
              <MetaRow label="Gözləyən" value={num(appt?.pending)} />
              <MetaRow label="Təsdiqlənmiş" value={num(appt?.confirmed)} />
              <MetaRow label="Tamamlanmış" value={num(appt?.completed)} />
              <MetaRow label="Mübahisəli" value={num(appt?.disputed)} />
              <MetaRow label="Ləğv edilmiş" value={num(appt?.cancelled)} />
            </div>
          </CardPad>
        </Card>
        <Card fill>
          <CardPad>
            <SectionTitle>Konversiya hunisi</SectionTitle>
            <div className="fx-subtitle" style={{ marginBottom: 6 }}>
              Müraciət / məqalə baxışı: {reports ? `${reports.conversion.value}%` : "—"}
            </div>
            {hasFunnel
              ? <FunnelChart data={reports!.funnel} />
              : <Empty loading={loading} text="Huni üçün hələ ölçülmüş data yoxdur." />}
          </CardPad>
        </Card>
        <Card fill>
          <CardPad>
            <SectionTitle>Ödəniş vəziyyəti</SectionTitle>
            <div style={{ display: "grid", gap: 10, paddingTop: 6, minHeight: BLOCK_MIN, alignContent: "start" }}>
              <MetaRow label="Gözləyən (say)" value={num(payments?.pendingCount)} />
              <MetaRow label="Gözləyən məbləğ" value={money(payments?.pendingSum)} />
              <MetaRow label="Bu ay ödənilib (say)" value={num(payments?.paidMonthCount)} />
              <MetaRow label="Bu ay ödənilib" value={money(payments?.paidMonthSum)} />
              <MetaRow label="Bu ay qaytarılıb" value={money(payments?.refundedMonthSum)} />
            </div>
          </CardPad>
        </Card>
      </Section>

      {/* ── Maliyyə: gəlir mənbəyi (dar) + hesablaşma cədvəli (geniş) ── */}
      <Section cols="minmax(300px, 1fr) minmax(420px, 2fr)">
        <Card fill>
          <CardPad>
            <SectionTitle>Gəlir mənbəyi</SectionTitle>
            <div style={{ display: "grid", gap: 10, paddingTop: 6, minHeight: BLOCK_MIN, alignContent: "start" }}>
              <MetaRow label="Komissiya (cəmi)" value={money(finance?.commissionRevenue)} />
              <MetaRow label="Pasiyent seçib" value={money(finance?.directCommissionRevenue)} />
              <MetaRow label="Fanus təyin edib" value={money(finance?.platformMatchedCommissionRevenue)} />
              <MetaRow label="Abunə (aylıq)" value={money(finance?.subscriptionMonthlyRevenue)} />
              <MetaRow label="Aktiv abunə" value={num(finance?.activeSubscriptions)} />
              <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 10 }}>
                <MetaRow label="Ümumi gəlir" value={money(finance?.totalRevenue)} />
              </div>
            </div>
          </CardPad>
        </Card>
        <Card fill style={{ minWidth: 0 }}>
          <CardPad>
            <SectionTitle>Psixoloq hesablaşması</SectionTitle>
            <Block>
              <DataTable
                rows={balances}
                columns={balanceCols}
                rowKey={b => b.psychologistId}
                loading={loading}
                empty={{ title: "Hesablaşma yoxdur", body: "Təsdiqlənmiş ödəniş olmadan balans yaranmır." }}
              />
            </Block>
          </CardPad>
        </Card>
      </Section>

      {/* ── Psixoloqlar ── */}
      <Section cols="repeat(auto-fit, minmax(420px, 1fr))">
        <Card fill>
          <CardPad>
            <SectionTitle>Psixoloq yükü</SectionTitle>
            {hasWorkload
              ? <WorkloadChart data={workload} />
              : <Empty loading={loading} text="Hələ heç bir psixoloqa randevu təyin olunmayıb." />}
          </CardPad>
        </Card>
        <Card fill>
          <CardPad>
            <SectionTitle>Performans</SectionTitle>
            {/* Meta məlumat ayrı sətirlərdə — yan-yana ayırıcı ilə yox (UI kit qaydası). */}
            <div className="fx-subtitle" style={{ marginBottom: 6, display: "grid", gap: 2 }}>
              <span>
                Platforma ortalaması: {reports && reports.averageRating.value > 0
                  ? reports.averageRating.value.toFixed(2) : "—"}
              </span>
              <span>
                Son 30 gündə aktiv istifadəçi: {reports ? Math.round(reports.activeUsers.value) : "—"}
              </span>
            </div>
            <Block>
              <DataTable
                rows={reports?.performance ?? []}
                columns={perfCols}
                rowKey={p => p.name}
                loading={loading}
                empty={{ title: "Performans datası yoxdur", body: "Aktiv psixoloq və ya randevu qeydi yoxdur." }}
              />
            </Block>
          </CardPad>
        </Card>
      </Section>

      {/* "Yük cədvəli" SİLİNDİ — yuxarıdakı yük qrafiki ilə eyni datanı təkrar
          göstərirdi. Qrafik data olmayanda onsuz da mətnə keçir. */}
      <Card fill style={{ marginBottom: 16 }}>
        <CardPad>
          <SectionTitle>Fərdi komissiya faizləri</SectionTitle>
          <div className="fx-subtitle" style={{ marginBottom: 8 }}>
            Bu psixoloqlarda qlobal faiz tətbiq olunmur — fərdi dəyər onu üstələyir.
          </div>
          <Block>
            <DataTable
              rows={overrides}
              columns={overrideCols}
              rowKey={o => o.psychologistId}
              loading={loading}
              empty={{ title: "Fərdi faiz yoxdur", body: "Bütün psixoloqlarda qlobal faiz tətbiq olunur." }}
            />
          </Block>
        </CardPad>
      </Card>

      {/* ── Məzmun ── */}
      <Section cols="repeat(auto-fit, minmax(420px, 1fr))">
        <Card fill>
          <CardPad>
            <SectionTitle>Ən çox oxunan məqalələr</SectionTitle>
            <div className="fx-subtitle" style={{ marginBottom: 6 }}>
              Son 30 gündə cəmi baxış: {metrics ? metrics.articleReads.value : "—"}
            </div>
            <Block>
              <DataTable
                rows={metrics?.topArticles ?? []}
                columns={articleCols}
                rowKey={a => a.rank}
                loading={loading}
                empty={{
                  title: "Baxış qeydi yoxdur",
                  body: "Baxış sayğacı yeni qurulub — məqalələr oxunduqca burada görünəcək.",
                }}
              />
            </Block>
          </CardPad>
        </Card>
        <Card fill>
          <CardPad>
            <SectionTitle>Məzmun mövzuları</SectionTitle>
            {metrics && metrics.topicDistribution.length > 0
              ? <TopicPieChart data={metrics.topicDistribution} />
              : <Empty loading={loading} text="Kateqoriyalı məqalə yoxdur." />}
          </CardPad>
        </Card>
      </Section>

      {/* ── Son fəaliyyət — tam en ── */}
      {metrics && metrics.recentActivity.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <CardPad>
            <SectionTitle>Son fəaliyyət</SectionTitle>
            <div style={{ display: "grid", gap: 10, marginTop: 8, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
              {metrics.recentActivity.map((a, i) => (
                <div key={i} style={{ padding: "10px 14px", border: "1px solid var(--hairline)", borderRadius: 10 }}>
                  <div style={{ fontSize: 13.5 }}>{a.title}</div>
                  <div className="fx-subtitle">{a.meta}</div>
                </div>
              ))}
            </div>
          </CardPad>
        </Card>
      )}

      {/* Yeganə əl-CSS: dar ekranda bölmə sütunlarının tək sütuna düşməsi.
          KPI sətrinə toxunulmur — kitin `.fx-stats` auto-fit qaydası özü
          uyğunlaşır (əvvəl ona sabit sütun sayı yazmışdım, ikisi toqquşurdu).
          Kartların bərabər hündürlüyü isə `fill` prop-u ilə həll olunur. */}
      <style>{`
        @media (max-width: 860px) {
          .fx-dash-section { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/**
 * Tam enli bölmə — daxilində avtomatik uyğunlaşan sütunlar.
 *
 * Kartlar sətir boyu EYNİ HÜNDÜRLÜKDƏ olur: qrid `stretch` ilə işləyir və kart
 * xanasını tam doldurur. Əvvəl `alignItems: start` idi — hər kart yalnız öz
 * məzmunu qədər hündür olurdu və qısa kartın altında qəribə boşluq qalırdı
 * (qrafikin yanındakı siyahı kartı kimi).
 *
 * Dar ekranda sütunlar tək sütuna düşür — ayrıca mobil layout yoxdur.
 */
function Section({ cols, children }: { cols: string; children: React.ReactNode }) {
  return (
    <div
      className="fx-dash-section"
      style={{ display: "grid", gap: 16, gridTemplateColumns: cols, marginBottom: 16 }}
    >
      {children}
    </div>
  );
}

/**
 * Kart məzmununun minimum hündürlüyü.
 *
 * Boş kart da dolu kart qədər böyük görünməlidir — əks halda sətirdə bir kart
 * 60px, qonşusu 300px olur və aralarında asılı boşluq qalır. Qrafiklərin
 * hündürlüyü ilə (240–260px) uyğunlaşdırılıb ki, dolu və boş kart eyni ölçüdə
 * dursun.
 */
// DİQQƏT: `export` OLMAMALIDIR. Next.js səhifə faylından yalnız müəyyən adları
// ixrac etməyə icazə verir (default, metadata, revalidate, dynamic …); ixtiyari
// sabit ixrac etmək `next build`-i tip yoxlamasında sındırır:
//   Type error: "BLOCK_MIN" is not a valid Page export field.
const BLOCK_MIN = 260;

/** Boş vəziyyət — mərkəzləşdirilmiş, tam blok hündürlüyündə. */
function Empty({ loading, text, minHeight = BLOCK_MIN }: {
  loading: boolean; text: string; minHeight?: number;
}) {
  return (
    <div style={{
      minHeight, display: "flex", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "24px 12px",
    }}>
      <span className="fx-subtitle">{loading ? "Yüklənir…" : text}</span>
    </div>
  );
}

/** Cədvəl/siyahı üçün sabit minimum sahə — boş cədvəl kartı da tam görünsün. */
function Block({ children, minHeight = BLOCK_MIN }: {
  children: React.ReactNode; minHeight?: number;
}) {
  return <div style={{ minHeight }}>{children}</div>;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5 }}>
      <span className="fx-subtitle">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
