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

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** Seans statusu — rəngli nöqtə/rozet yoxdur, mətndir. */
function statusLabel(t: Translate, status: string): { label: string; tone: StatusTone } | null {
  const map: Record<string, { label: string; tone: StatusTone }> = {
    PENDING:   { label: t("psyDash.statusPending"),   tone: "wait" },
    ASSIGNED:  { label: t("psyDash.statusAssigned"),  tone: "neutral" },
    CONFIRMED: { label: t("psyDash.statusConfirmed"), tone: "neutral" },
    // Keçmiş seans avtomatik tamamlanır — bütün panellərlə eyni etiket ("Tamamlandı").
    // Bu, seansın uğurla baş tutduğunu yox, vaxtının keçdiyini bildirir.
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

/**
 * Xitab forması — "Ayan xanım" / "Rəşad bəy".
 *
 * Platformada mütəxəssislərə "Dr." deyə xitab ETMİRİK: bu titul yalnız elmi
 * dərəcəsi (PhD) olanlara aiddir. Cinsiyyət boşdursa "bəy" işlədilir (V131 qərarı).
 * Digər dillərdə bu xitab forması yoxdur — suffiks boşdursa sadəcə ad göstərilir.
 */
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

function formatDayShort(t: Translate, iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return t("common.today");
  if (sameDay(d, tomorrow)) return t("common.tomorrow");
  return `${d.getDate()} ${t(`months.m${d.getMonth() + 1}` as MessageKey)}`;
}

function todayLabel(t: Translate) {
  const d = new Date();
  return `${t(`days.d${d.getDay()}` as MessageKey)}, ${d.getDate()} ${t(`months.m${d.getMonth() + 1}` as MessageKey)} ${d.getFullYear()}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function PsychologDashboard() {
  const { t } = useT();
  const user = getStoredUser();
  const [stats, setStats] = useState<PsychologistStats | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDetail[]>([]);
  const [pricing, setPricing] = useState<{ individualPrice: number | null; currency: string } | null>(null);
  const [packages, setPackages] = useState<PackageDto[]>([]);
  /** Xitab formu üçün cinsiyyət ("Ayan xanım" / "Rəşad bəy") — V131. */
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
      <PageHead
        title={`${greet(t)}, ${honorific(t, user?.firstName ?? t("psyDash.psyFallback"), gender)}`}
        sub={todayLabel(t)}
        actions={
          <>
            <Link href="/psycholog/calendar" className={buttonClass("primary")}>
              <IconCalendar /> {t("psyDash.navCalendar")}
            </Link>
            <Link href="/psycholog/availability" className={buttonClass("ghost")}>
              <IconClock /> {t("psyDash.navAvailability")}
            </Link>
          </>
        }
      />

      {loading ? (
        <SkeletonGrid />
      ) : (
        <>
          {/* ── Rəqəmlər ───────────────────────────────────────────────────────
              Əvvəl burada halqa/qauge "engagement strip" + ayrıca ikonlu kart
              sırası vardı (iki səth, eyni məlumat). İndi tək sıra: dəyər + etiket. */}
          <Stats>
            <Stat
              label={t("psyDash.statSessionsMonth")}
              value={stats?.thisMonthTotal ?? 0}
              meta={t("psyDash.statSessionsMonthMeta", { completed: stats?.thisMonthCompleted ?? 0, pct: completionRate })}
            />
            <Stat label={t("psyDash.statWeek")} value={stats?.thisWeekTotal ?? 0} meta={t("psyDash.statWeekMeta")} />
            <Stat label={t("psyDash.statUpcoming")} value={stats?.upcomingCount ?? 0} meta={t("psyDash.statUpcomingMeta")} />
            <Stat label={t("psyDash.statActiveClients")} value={stats?.activeClientsLast90Days ?? 0} meta={t("psyDash.statActiveClientsMeta")} />
          </Stats>

          {/* ── Əsas şəbəkə: 2 sütun × 2 sətir ─────────────────────────────────
              Kartlar birbaşa şəbəkənin uşaqlarıdır (aralıq "stack" sarğısı yoxdur),
              ona görə hər sətirdəki iki kart eyni hündürlüyə uzanır və sağ sütunun
              altında boşluq qalmır. Sıra: cədvəl | yaxınlaşan, qrafik | qiymət. */}
          <div className="fx-2col fx-2col--even">
            <Card fill>
              <CardHead
                title={t("psyDash.todayScheduleTitle")}
                sub={today.length ? t("psyDash.todayScheduleSubCount", { count: today.length }) : t("psyDash.todayScheduleSubEmpty")}
                action={<Link href="/psycholog/appointments" className={linkClass()}>{t("psyDash.viewAll")}</Link>}
              />
              <CardBody>
                {today.length === 0 ? (
                  <EmptyBlock
                    title={t("psyDash.todayEmptyTitle")}
                    body={t("psyDash.todayEmptyBody")}
                  />
                ) : (
                  today.slice(0, 6).map(a => <TodayRow key={a.id} a={a} />)
                )}
              </CardBody>
            </Card>

            <Card fill>
              <CardHead
                title={t("psyDash.upcomingTitle")}
                sub={upcoming.length ? t("psyDash.upcomingSubHasItems") : t("psyDash.upcomingSubEmpty")}
                action={<Link href="/psycholog/calendar" className={linkClass()}>{t("psyDash.calendarLink")}</Link>}
              />
              <CardBody>
                {upcoming.length === 0 ? (
                  <EmptyBlock title={t("psyDash.upcomingEmptyTitle")} body={t("psyDash.upcomingEmptyBody")} />
                ) : (
                  upcoming.map(a => <UpcomingRow key={a.id} a={a} />)
                )}
              </CardBody>
            </Card>

            <Card fill>
              <CardHead
                title={t("psyDash.dailyActivityTitle")}
                sub={stats ? t("psyDash.dailyActivitySub", { count: stats.last30Days.reduce((s, d) => s + d.count, 0) }) : "—"}
              />
              <CardBody>
                <DailyChart data={stats?.last30Days ?? []} />
              </CardBody>
            </Card>

            <Card fill>
              <CardHead title={t("psyDash.originTitle")} sub={t("psyDash.originSub")} />
              <CardBody>
                <OriginDonut
                  direct={stats?.originDirectCount ?? 0}
                  matched={stats?.originMatchedCount ?? 0}
                />
              </CardBody>
            </Card>

            {/* Son sətir tək kartdır — hər iki sütunu tutur ki, sağda boşluq qalmasın. */}
            <div className="fx-span-2">
              <PricingSummaryCard pricing={pricing} packages={packages} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────────────────────────────── */

function SessionStatus({ status }: { status: string }) {
  const { t } = useT();
  const s = statusLabel(t, status);
  // Naməlum status ingiliscə çıxmasın — vahid mənbədən (lib/appointmentStatus) AZ adı götürülür.
  if (!s) return <Status tone="muted">{statusMeta(status).label}</Status>;
  return <Status tone={s.tone}>{s.label}</Status>;
}

function TodayRow({ a }: { a: AppointmentDetail }) {
  const { t } = useT();
  return (
    <Row
      // Vaxt öndədir — bu siyahıda oxunan ilk şey odur.
      lead={
        <span
          className="fx-num"
          style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)", flex: "none", minWidth: 44 }}
        >
          {formatTime(a.startAt)}
        </span>
      }
      title={a.patientName ?? t("psyDash.patientFallback")}
      meta={a.endAt ? `${formatTime(a.startAt)} – ${formatTime(a.endAt)}` : t("psyDash.onlineSession")}
      status={<SessionStatus status={a.status} />}
    />
  );
}

function UpcomingRow({ a }: { a: AppointmentDetail }) {
  const { t } = useT();
  return (
    <Link href="/psycholog/appointments" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Row
        title={a.patientName ?? t("psyDash.patientFallback")}
        meta={`${formatDayShort(t, a.startAt)}, ${formatTime(a.startAt)}`}
      />
    </Link>
  );
}



/** Qiymət və paketlərin yığcam xülasəsi — redaktə Profil-də. */
function PricingSummaryCard({ pricing, packages }: {
  pricing: { individualPrice: number | null; currency: string } | null;
  packages: PackageDto[];
}) {
  const { t } = useT();
  const active = packages.filter(p => p.active);
  return (
    <Card>
      <CardHead
        title={t("psyDash.pricingTitle")}
        sub={t("psyDash.pricingSub")}
        action={<Link href="/psycholog/profile" className={linkClass()}>{t("common.edit")}</Link>}
      />
      <CardBody>
        <Row
          title={t("psyDash.individualSession")}
          amount={pricing?.individualPrice != null ? formatAzn(pricing.individualPrice) : "—"}
        />
        {active.length === 0 ? (
          <EmptyBlock
            title={t("psyDash.packagesEmptyTitle")}
            body={t("psyDash.packagesEmptyBody")}
            actions={<Link href="/psycholog/packages" className={buttonClass("ghost", { size: "sm" })}>{t("psyDash.packagesEmptyCta")}</Link>}
          />
        ) : (
          <>
            {active.slice(0, 4).map(p => (
              <Row key={p.id} title={p.name} meta={t("psyDash.packageSessionCount", { count: p.sessionCount })} amount={formatAzn(p.packagePrice)} />
            ))}
            {active.length > 4 && (
              <Row title={t("psyDash.morePackages", { count: active.length - 4 })} />
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  const { t } = useT();
  const max = Math.max(1, ...data.map(d => d.count));
  if (data.length === 0) {
    return <EmptyBlock title={t("psyDash.chartEmptyTitle")} body={t("psyDash.chartEmptyBody")} />;
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
              title={t("psyDash.chartBarTooltip", { date: azFormatDate(d.date), count: d.count })}
              style={{
                flex: 1,
                height: `${barH}px`,
                // Qradient yox — düz token rəngi. Bu gün tünd brend, qalan günlər açıq.
                background: isToday
                  ? "var(--brand)"
                  : d.count > 0
                    ? "var(--brand-300)"
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

/* ─── Müraciət mənbəyi (donut) ────────────────────────────────────────────
   İki kateqoriya: pasiyent məhz bu psixoloqu seçib (DIRECT) vs Fanus yönləndirib
   (PLATFORM_MATCHED). Rənglər gözlə seçilməyib — brend mavisi + kəhrəba cütü
   CVD validatorundan keçib (ΔE 29.7 protan / 35.8 normal, hamısı PASS).
   Rəqəmlər mətn kimi də verilir (etiketlərdə), yəni məlumat yalnız rəngdə deyil. */
const ORIGIN_COLORS = { direct: "#1051B7", matched: "#C97D2E" };

function OriginDonut({ direct, matched }: { direct: number; matched: number }) {
  const { t } = useT();
  const total = direct + matched;
  if (total === 0) {
    return (
      <EmptyBlock
        title={t("psyDash.originEmptyTitle")}
        body={t("psyDash.originEmptyBody")}
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
             aria-label={t("psyDash.originAriaLabel", { direct, matched })}>
          {seg(dLen, 0, ORIGIN_COLORS.direct, t("psyDash.originDirectTitle", { direct }))}
          {seg(mLen, dLen, ORIGIN_COLORS.matched, t("psyDash.originMatchedTitle", { matched }))}
          <text x="60" y="57" textAnchor="middle"
                style={{ fontSize: 22, fontWeight: 700, fill: "var(--oxford)" }}>
            {total}
          </text>
          <text x="60" y="72" textAnchor="middle"
                style={{ fontSize: 9, fill: "var(--oxford-60)" }}>
            {t("psyDash.originTotalWord")}
          </text>
        </svg>
      </div>

      {/* Birbaşa etiketlər — həm leqend, həm rəqəm. Mətn ink rəngindədir. */}
      <div>
        <OriginLegendRow color={ORIGIN_COLORS.direct} label={t("psyDash.originDirectLabel")}
                         value={direct} pct={pct(direct)} />
        <OriginLegendRow color={ORIGIN_COLORS.matched} label={t("psyDash.originMatchedLabel")}
                         value={matched} pct={pct(matched)} />
      </div>
    </div>
  );
}

function OriginLegendRow({ color, label, value, pct }:
  { color: string; label: string; value: number; pct: number }) {
  return (
    <Row
      // Rəngli kvadrat status işarəsi deyil — qrafik leqendidir, dilimə bağlıdır.
      lead={<span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: "none" }} />}
      title={label}
      amount={
        <>
          {value} <small>{pct}%</small>
        </>
      }
    />
  );
}

/** Yüklənmə skeleti — real düzümün eyni forması (4 rəqəm + 2×2 kart şəbəkəsi),
 *  ona görə məzmun gələndə sıçrayış olmur. */
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
      <div className="fx-2col fx-2col--even">
        {block("c1", 300)}{block("c2", 300)}{block("c3", 240)}{block("c4", 240)}
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
