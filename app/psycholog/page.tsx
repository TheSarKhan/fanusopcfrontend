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

/** Seans statusu — rəngli nöqtə/rozet yoxdur, mətndir. */
const STATUS_LABEL: Record<string, { label: string; tone: StatusTone }> = {
  PENDING:   { label: "Yeni",       tone: "wait" },
  ASSIGNED:  { label: "Sizə təyin", tone: "neutral" },
  CONFIRMED: { label: "Təsdiqli",   tone: "neutral" },
  // Keçmiş seans avtomatik tamamlanır — bütün panellərlə eyni etiket ("Tamamlandı").
  // Bu, seansın uğurla baş tutduğunu yox, vaxtının keçdiyini bildirir.
  COMPLETED: { label: "Tamamlandı", tone: "muted" },
  DISPUTED:  { label: "Mübahisəli", tone: "risk" },
  CANCELLED: { label: "Ləğv",       tone: "muted" },
  REJECTED:  { label: "Rədd",       tone: "risk" },
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
      <PageHead
        title={`${greet()}, Dr. ${user?.firstName ?? "Psixoloq"}`}
        sub={todayLabel()}
        actions={
          <>
            <Link href="/psycholog/calendar" className={buttonClass("primary")}>
              <IconCalendar /> Cədvəlim
            </Link>
            <Link href="/psycholog/availability" className={buttonClass("ghost")}>
              <IconClock /> İş vaxtları
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
              label="Bu ay seans"
              value={stats?.thisMonthTotal ?? 0}
              meta={`${stats?.thisMonthCompleted ?? 0} tamamlandı (${completionRate}%)`}
            />
            <Stat label="Bu həftə" value={stats?.thisWeekTotal ?? 0} meta="planlaşdırılmış seans" />
            <Stat label="Yaxınlaşan" value={stats?.upcomingCount ?? 0} meta="növbəti randevular" />
            <Stat label="Aktiv müştəri" value={stats?.activeClientsLast90Days ?? 0} meta="son 90 gün" />
          </Stats>

          {/* ── Əsas şəbəkə: 2 sütun × 2 sətir ─────────────────────────────────
              Kartlar birbaşa şəbəkənin uşaqlarıdır (aralıq "stack" sarğısı yoxdur),
              ona görə hər sətirdəki iki kart eyni hündürlüyə uzanır və sağ sütunun
              altında boşluq qalmır. Sıra: cədvəl | yaxınlaşan, qrafik | qiymət. */}
          <div className="fx-2col fx-2col--even">
            <Card fill>
              <CardHead
                title="Bu günkü cədvəl"
                sub={today.length ? `${today.length} seans planlaşdırılıb` : "Bu gün heç bir seans yoxdur"}
                action={<Link href="/psycholog/appointments" className={linkClass()}>Hamısı</Link>}
              />
              <CardBody>
                {today.length === 0 ? (
                  <EmptyBlock
                    title="Bu gün cədvəliniz boşdur"
                    body="Sərbəst günü bilik artırmaq üçün istifadə edin və ya açıq vaxtlarınızı yeniləyin."
                  />
                ) : (
                  today.slice(0, 6).map(a => <TodayRow key={a.id} a={a} />)
                )}
              </CardBody>
            </Card>

            <Card fill>
              <CardHead
                title="Yaxınlaşan randevular"
                sub={upcoming.length ? "Növbəti günlər" : "Boşdur"}
                action={<Link href="/psycholog/calendar" className={linkClass()}>Cədvəl</Link>}
              />
              <CardBody>
                {upcoming.length === 0 ? (
                  <EmptyBlock title="Yaxınlaşan seans yoxdur" body="Yeni randevular əlavə olunduqda burada görünəcək." />
                ) : (
                  upcoming.map(a => <UpcomingRow key={a.id} a={a} />)
                )}
              </CardBody>
            </Card>

            <Card fill>
              <CardHead
                title="Son 30 gün — gündəlik aktivlik"
                sub={stats ? `Cəmi ${stats.last30Days.reduce((s, d) => s + d.count, 0)} seans` : "—"}
              />
              <CardBody>
                <DailyChart data={stats?.last30Days ?? []} />
              </CardBody>
            </Card>

            <Card fill>
              <CardHead title="Müraciətin mənbəyi" sub="Sizi kim seçib — müştəri, yoxsa Fanus" />
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
  const s = STATUS_LABEL[status];
  if (!s) return <Status tone="muted">{status}</Status>;
  return <Status tone={s.tone}>{s.label}</Status>;
}

function TodayRow({ a }: { a: AppointmentDetail }) {
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
      title={a.patientName ?? "Müştəri"}
      meta={a.endAt ? `${formatTime(a.startAt)} – ${formatTime(a.endAt)}` : "Onlayn seans"}
      status={<SessionStatus status={a.status} />}
    />
  );
}

function UpcomingRow({ a }: { a: AppointmentDetail }) {
  return (
    <Link href="/psycholog/appointments" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Row
        title={a.patientName ?? "Müştəri"}
        meta={`${formatDayShort(a.startAt)}, ${formatTime(a.startAt)}`}
      />
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
      <CardHead
        title="Qiymət və paketlər"
        sub="Cari təklifləriniz"
        action={<Link href="/psycholog/profile" className={linkClass()}>Düzəlt</Link>}
      />
      <CardBody>
        <Row
          title="Fərdi seans"
          amount={pricing?.individualPrice != null ? formatAzn(pricing.individualPrice) : "—"}
        />
        {active.length === 0 ? (
          <EmptyBlock
            title="Paket təyin edilməyib"
            body="Paket təklif etsəniz müştərilər bir neçə seansı birlikdə ala bilər. «Qiymətlər & Paketlər» səhifəsindən əlavə edin."
            actions={<Link href="/psycholog/packages" className={buttonClass("ghost", { size: "sm" })}>Qiymətlər &amp; Paketlər</Link>}
          />
        ) : (
          <>
            {active.slice(0, 4).map(p => (
              <Row key={p.id} title={p.name} meta={`${p.sessionCount} seans`} amount={formatAzn(p.packagePrice)} />
            ))}
            {active.length > 4 && (
              <Row title={`+${active.length - 4} paket daha`} />
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count));
  if (data.length === 0) {
    return <EmptyBlock title="Məlumat yoxdur" body="Aktivliyiniz burada görünəcək." />;
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
   İki kateqoriya: müştəri məhz bu psixoloqu seçib (DIRECT) vs Fanus yönləndirib
   (PLATFORM_MATCHED). Rənglər gözlə seçilməyib — brend mavisi + kəhrəba cütü
   CVD validatorundan keçib (ΔE 29.7 protan / 35.8 normal, hamısı PASS).
   Rəqəmlər mətn kimi də verilir (etiketlərdə), yəni məlumat yalnız rəngdə deyil. */
const ORIGIN_COLORS = { direct: "#1051B7", matched: "#C97D2E" };

function OriginDonut({ direct, matched }: { direct: number; matched: number }) {
  const total = direct + matched;
  if (total === 0) {
    return (
      <EmptyBlock
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
