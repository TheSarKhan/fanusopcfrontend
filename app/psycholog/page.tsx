"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  psychologistApi,
  type PsychologistStats,
  type AppointmentDetail,
  type PackageDto,
} from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { formatAzn } from "@/lib/money";
import { azFormatDate } from "@/lib/datetime";

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
  const months = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
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
  const [pricing, setPricing] = useState<{ individualPrice: number | null; currency: string } | null>(null);
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      psychologistApi.stats(),
      psychologistApi.myAppointments(),
      psychologistApi.myPricing(),
      psychologistApi.myPackages(),
    ]).then((results) => {
      if (!active) return;
      if (results[0].status === "fulfilled") setStats(results[0].value);
      if (results[1].status === "fulfilled") setAppointments(results[1].value);
      if (results[2].status === "fulfilled") setPricing(results[2].value);
      if (results[3].status === "fulfilled") setPackages(results[3].value);
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


  const completionRate = stats && stats.thisMonthTotal > 0
    ? Math.round((stats.thisMonthCompleted / stats.thisMonthTotal) * 100)
    : 0;

  return (
    <div>
      {/* ── Səhifə başlığı ────────────────────────────────────────────────────
          Əvvəl burada gradient "hero" banner var idi — panelin içində marketinq
          səthi. Onun yerinə sakit başlıq: kim, hansı gün, iki əsas keçid. */}
      <div className="pnl-head">
        <div>
          <h1 className="pnl-head__title">
            {greet()}, Dr. {user?.firstName ?? "Psixoloq"}
          </h1>
          <p className="pnl-head__sub">
            {todayLabel()}
          </p>
        </div>
        <div className="pnl-head__actions">
          <Link href="/psycholog/calendar" className="pnl-btn">
            <IconCalendar /> Cədvəlim
          </Link>
          <Link href="/psycholog/availability" className="pnl-btn pnl-btn--ghost">
            <IconClock /> İş vaxtları
          </Link>
        </div>
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : (
        <>
          {/* ── Rəqəmlər ───────────────────────────────────────────────────────
              Əvvəl burada halqa/qauge "engagement strip" + ayrıca ikonlu kart
              sırası vardı (iki səth, eyni məlumat). İndi tək sıra: dəyər + etiket. */}
          <div className="pnl-stats">
            <StatCard
              label="Bu ay seans"
              value={stats?.thisMonthTotal ?? 0}
              sub={`${stats?.thisMonthCompleted ?? 0} tamamlandı (${completionRate}%)`}
            />
            <StatCard
              label="Bu həftə"
              value={stats?.thisWeekTotal ?? 0}
              sub="planlaşdırılmış seans"
            />
            <StatCard
              label="Yaxınlaşan"
              value={stats?.upcomingCount ?? 0}
              sub="növbəti randevular"
            />
            <StatCard
              label="Aktiv müştəri"
              value={stats?.activeClientsLast90Days ?? 0}
              sub="son 90 gün"
            />
          </div>

          {/* ── Əsas şəbəkə: 2 sütun × 2 sətir ─────────────────────────────────
              Kartlar birbaşa şəbəkənin uşaqlarıdır (aralıq "stack" sarğısı yoxdur),
              ona görə hər sətirdəki iki kart eyni hündürlüyə uzanır və sağ sütunun
              altında boşluq qalmır. Sıra: cədvəl | yaxınlaşan, qrafik | qiymət. */}
          <div className="pnl-2col">
            <Card>
              <CardHeader
                title="Bu günkü cədvəl"
                subtitle={today.length ? `${today.length} seans planlaşdırılıb` : "Bu gün heç bir seans yoxdur"}
                right={<Link href="/psycholog/appointments" className="pnl-link">Hamısı →</Link>}
              />
              {today.length === 0 ? (
                <EmptyState
                  title="Bu gün cədvəliniz boşdur"
                  body="Sərbəst günü bilik artırmaq üçün istifadə edin və ya açıq vaxtlarınızı yeniləyin."
                />
              ) : (
                <div>
                  {today.slice(0, 6).map(a => <TodayRow key={a.id} a={a} />)}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Yaxınlaşan randevular"
                subtitle={upcoming.length ? "Növbəti günlər" : "Boşdur"}
                right={<Link href="/psycholog/calendar" className="pnl-link">Cədvəl →</Link>}
              />
              {upcoming.length === 0 ? (
                <EmptyState title="Yaxınlaşan seans yoxdur" body="Yeni randevular əlavə olunduqda burada görünəcək." />
              ) : (
                <div>
                  {upcoming.map(a => <UpcomingRow key={a.id} a={a} />)}
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

            <Card>
              <CardHeader
                title="Müraciətin mənbəyi"
                subtitle="Sizi kim seçib — müştəri, yoxsa Fanus"
              />
              <OriginDonut
                direct={stats?.originDirectCount ?? 0}
                matched={stats?.originMatchedCount ?? 0}
              />
            </Card>

            {/* Son sətir tək kartdır — hər iki sütunu tutur ki, sağda boşluq qalmasın. */}
            <div className="pnl-span-2" style={{ display: "flex" }}>
              <PricingSummaryCard pricing={pricing} packages={packages} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="pnl-card">{children}</div>;
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="pnl-card__head">
      <div style={{ minWidth: 0 }}>
        <h3 className="pnl-card__title">{title}</h3>
        {subtitle && <p className="pnl-card__sub">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/** Rəqəm + etiket. Əvvəl ikon qutusu, sol brend zolağı və uppercase etiket vardı —
 *  üçü də dekorativ idi və rəqəmi kiçildirdi. */
function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="pnl-stat">
      <div className="pnl-stat__val">{value}</div>
      <div className="pnl-stat__label">{label}</div>
      {sub && <div className="pnl-stat__sub">{sub}</div>}
    </div>
  );
}

/** Status rəngli NÖQTƏ + sadə mətn (pill deyil) — operator ekranı ilə eyni dil. */
function StatusDot({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? { label: status, color: "var(--oxford-60)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      <span style={{ fontSize: 12.5, color: "var(--oxford-60)", whiteSpace: "nowrap" }}>{s.label}</span>
    </span>
  );
}

function TodayRow({ a }: { a: AppointmentDetail }) {
  return (
    <div className="pnl-row">
      {/* Vaxt öndədir — bu siyahıda oxunan ilk şey odur. */}
      <span style={{
        fontSize: 14, fontWeight: 700, color: "var(--oxford)",
        fontVariantNumeric: "tabular-nums", flex: "none", minWidth: 44,
      }}>
        {formatTime(a.startAt)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pnl-row__title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.patientName ?? "Müştəri"}
        </div>
        <div className="pnl-row__meta">
          {a.endAt ? `${formatTime(a.startAt)} – ${formatTime(a.endAt)}` : "Onlayn seans"}
        </div>
      </div>
      <StatusDot status={a.status} />
    </div>
  );
}

function UpcomingRow({ a }: { a: AppointmentDetail }) {
  return (
    <Link href="/psycholog/appointments" className="pnl-row" style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pnl-row__title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.patientName ?? "Müştəri"}
        </div>
        <div className="pnl-row__meta">
          {formatDayShort(a.startAt)}, {formatTime(a.startAt)}
        </div>
      </div>
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
        right={<Link href="/psycholog/profile" className="pnl-link">Düzəlt →</Link>}
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
                {p.name} <span style={{ color: "var(--oxford-60)", fontWeight: 500 }}>{p.sessionCount} seans</span>
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
  // Bar hündürlüyü PİKSEL ilə hesablanır (faiz DEYİL): valideyn konteynerin
  // hündürlüyü qeyri-müəyyən olduğu üçün (row `alignItems: flex-end`) faizli
  // hündürlük həll olunmurdu və bütün bar-lar minHeight-ə düşüb eyni görünürdü.
  const CHART_H = 100; // ən yüksək bar üçün maks. piksel (konteyner 110px)
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110 }}>
        {data.map((d, i) => {
          const barH = d.count > 0 ? Math.max(6, Math.round((d.count / max) * CHART_H)) : 3;
          const isToday = isSameDay(new Date(d.date), new Date());
          return (
            <div
              key={i}
              title={`${azFormatDate(d.date)}: ${d.count} seans`}
              style={{
                flex: 1,
                height: `${barH}px`,
                background: isToday
                  ? "linear-gradient(180deg, var(--brand-700), var(--brand))"
                  : d.count > 0
                    ? "linear-gradient(180deg, var(--brand-400), var(--brand-300))"
                    : "var(--hairline)",
                borderRadius: 4,
                minHeight: 3,
                transition: "height 0.2s",
              }}
            />
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
    // Mərkəzləşdirilmiş deyil — sola düzülür, mətn kimi oxunur.
    <div className="pnl-empty">
      <div className="pnl-empty__title">{title}</div>
      <div className="pnl-empty__body">{body}</div>
    </div>
  );
}

/* ─── Müraciət mənbəyi (donut) ────────────────────────────────────────────
   İki kateqoriya: müştəri məhz bu psixoloqu seçib (DIRECT) vs Fanus yönləndirib
   (PLATFORM_MATCHED). Rənglər gözlə seçilməyib — brend mavisi + kəhrəba cütü
   CVD validatorundan keçib (ΔE 29.7 protan / 35.8 normal, hamısı PASS).
   Rəqəmlər mətn kimi də verilir (etiketlərdə), yəni məlumat yalnız rəngdə deyil. */
const ORIGIN_COLORS = { direct: "#1051B7", matched: "#C97D2E" };

function OriginDonut({ direct, matched }: { direct: number; matched: number }) {
  const total = direct + matched;
  if (total === 0) {
    return (
      <EmptyState
        title="Hələ məlumat yoxdur"
        body="İlk seanslarınızdan sonra müraciətlərin nə qədərinin birbaşa sizə gəldiyi burada görünəcək."
      />
    );
  }

  const R = 44, SW = 14, C = 2 * Math.PI * R;
  const GAP = 3;                      // səth boşluğu — iki dilim bir-birinə yapışmasın
  const dLen = (direct / total) * C;
  const mLen = (matched / total) * C;
  const pct = (n: number) => Math.round((n / total) * 100);

  const seg = (len: number, offset: number, color: string, label: string) => (
    <circle
      cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth={SW}
      strokeDasharray={`${Math.max(0, len - GAP)} ${C - Math.max(0, len - GAP)}`}
      strokeDashoffset={-offset}
      transform="rotate(-90 60 60)"
    >
      <title>{label}</title>
    </circle>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg viewBox="0 0 120 120" width="150" height="150" role="img"
             aria-label={`Birbaşa ${direct}, yönləndirmə ${matched}`}>
          {seg(dLen, 0, ORIGIN_COLORS.direct, `Birbaşa müraciət: ${direct}`)}
          {seg(mLen, dLen, ORIGIN_COLORS.matched, `Fanus yönləndirməsi: ${matched}`)}
          <text x="60" y="57" textAnchor="middle"
                style={{ fontSize: 22, fontWeight: 700, fill: "var(--oxford)" }}>
            {total}
          </text>
          <text x="60" y="72" textAnchor="middle"
                style={{ fontSize: 9, fill: "var(--oxford-60)" }}>
            seans
          </text>
        </svg>
      </div>

      {/* Birbaşa etiketlər — həm leqend, həm rəqəm. Mətn ink rəngindədir. */}
      <div>
        <OriginLegendRow color={ORIGIN_COLORS.direct} label="Müştərinin tələbi"
                         value={direct} pct={pct(direct)} />
        <OriginLegendRow color={ORIGIN_COLORS.matched} label="Fanusun yönləndirməsi"
                         value={matched} pct={pct(matched)} />
      </div>
    </div>
  );
}

function OriginLegendRow({ color, label, value, pct }:
  { color: string; label: string; value: number; pct: number }) {
  return (
    <div className="pnl-row">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: "none" }} />
        <span className="pnl-row__title" style={{ fontWeight: 500 }}>{label}</span>
      </span>
      <span className="pnl-row__val">
        {value}
        <span style={{ fontWeight: 500, color: "var(--oxford-60)", marginLeft: 6 }}>{pct}%</span>
      </span>
    </div>
  );
}

/** Yüklənmə skeleti — real düzümün eyni forması (4 rəqəm + 2×2 kart şəbəkəsi),
 *  ona görə məzmun gələndə sıçrayış olmur. */
function SkeletonGrid() {
  const block = (h: number) => (
    <div className="pnl-card" style={{ height: h, gap: 10 }}>
      <div style={{ width: "40%", height: 12, background: "var(--oxford-10)", borderRadius: 4 }} />
      <div style={{ width: "70%", height: 22, background: "var(--brand-50)", borderRadius: 4 }} />
    </div>
  );
  return (
    <div>
      <div className="pnl-stats">
        {block(96)}{block(96)}{block(96)}{block(96)}
      </div>
      <div className="pnl-2col">
        {block(300)}{block(300)}{block(240)}{block(240)}
      </div>
    </div>
  );
}

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
