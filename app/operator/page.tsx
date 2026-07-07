"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  operatorApi,
  type AppointmentDetail,
  type OperatorStats,
  type PaymentSummary,
  type Referral,
} from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { getStoredUser } from "@/lib/auth";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatAzn } from "@/lib/money";
import { toast } from "@/components/Toast";
import ErrorState from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";

const MONTHS_AZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const DAYS_AZ = ["Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtTime = (iso?: string | null) => { if (!iso) return "—"; const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const todayLabel = () => { const d = new Date(); return `${DAYS_AZ[d.getDay()]}, ${d.getDate()} ${MONTHS_AZ[d.getMonth()]} ${d.getFullYear()}`; };
function timeAgo(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 0) return "indi";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "indi";
  if (m < 60) return `${m} dəq`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat`;
  return `${Math.floor(h / 24)} gün`;
}
function fmtMin(n: number | null) {
  if (n == null) return "—";
  if (n < 60) return `${Math.round(n)} dəq`;
  const h = Math.floor(n / 60); const m = Math.round(n - h * 60);
  return `${h} s ${m > 0 ? m + " dəq" : ""}`.trim();
}

type Tone = "neutral" | "good" | "warn" | "danger";

export default function OperatorDashboard() {
  const { t } = useT();
  const user = getStoredUser();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(new Date());
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [claimingId, setClaimingId] = useState<number | null>(null);

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);

  // Yalnız əsas siyahı (listAppointments) uğursuz olsa xəta vəziyyəti göstərilir —
  // stats/summary/referrals köməkçidir, ayrıca .catch ilə düşür (panel dolu qalır).
  const load = () => {
    setLoading(true);
    setError(false);
    Promise.all([
      operatorApi.listAppointments(),
      operatorApi.stats().catch(() => null),
      operatorApi.paymentsSummary().catch(() => null),
      operatorApi.pendingReferrals().catch(() => [] as Referral[]),
    ]).then(([list, s, sm, rf]) => { setItems(list); setStats(s); setSummary(sm); setReferrals(rf); }).catch(() => setError(true)).finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => subscribeNotifications(n => { if (typeof n.type === "string" && (n.type.startsWith("APPOINTMENT_") || n.type.startsWith("RESCHEDULE_") || n.type.startsWith("REFERRAL"))) load(); }), []);

  /** Pooldan birbaşa götürmə — dashboard-dan çıxmadan (tam səhifə loading olmadan sakit yenilənir). */
  const handleClaim = async (appointmentId: number) => {
    setClaimingId(appointmentId);
    try {
      await operatorApi.claim(appointmentId);
      setItems(await operatorApi.listAppointments());
      toast("Müraciət götürüldü", "success");
    } catch (e) {
      toast((e as Error).message || "Götürmək alınmadı", "error");
    } finally {
      setClaimingId(null);
    }
  };

  const disputed = useMemo(() => items.filter(a => a.status === "DISPUTED").sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()), [items]);
  const rejected = useMemo(() => items.filter(a => a.status === "REJECTED").sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()), [items]);
  const pending = useMemo(() => items.filter(a => a.status === "PENDING").sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [items]);
  // Patient-initiated reschedule requests still live on active appointments (no
  // status change) — surfaced here as their own queue group so operators don't
  // miss them when the transient notification scrolls away.
  const rescheduleReqs = useMemo(() => items.filter(a => a.rescheduleRequestedAt && (a.status === "CONFIRMED" || a.status === "ASSIGNED")).sort((a, b) => new Date(b.rescheduleRequestedAt!).getTime() - new Date(a.rescheduleRequestedAt!).getTime()), [items]);
  const cancelReqs = useMemo(() => items.filter(a => a.status === "CANCEL_REQUESTED").sort((a, b) => new Date(b.cancelRequestedAt ?? b.updatedAt ?? b.createdAt).getTime() - new Date(a.cancelRequestedAt ?? a.updatedAt ?? a.createdAt).getTime()), [items]);
  // ─── Vahid inbox: bütün müraciət növləri (randevu + reschedule + ləğv +
  // mübahisə + rədd + yönləndirmə) əvvəlcə tək siyahıda, ən yenisi yuxarıda. ─────
  const inbox = useMemo<InboxItem[]>(() => {
    const clip = (s?: string | null, n = 56) => (s ? `«${s.length > n ? s.slice(0, n) + "…" : s}»` : "");
    const out: InboxItem[] = [];
    for (const a of pending)
      out.push({ key: `pending-${a.id}`, kind: "pending", href: `/operator/appointments/${a.id}`,
        name: a.patientName ?? "—", sub: a.requestedPsychologistName ? `İstənilən: ${a.requestedPsychologistName}` : "psixoloq seçilməyib",
        ts: a.createdAt, phone: a.patientPhone, appointmentId: a.id, claimedByName: a.claimedByName });
    for (const a of rescheduleReqs)
      out.push({ key: `resched-${a.id}`, kind: "reschedule", href: `/operator/appointments/${a.id}`,
        name: a.patientName ?? "—", sub: clip(a.rescheduleRequestNote) || "pasiyent vaxtı dəyişmək istəyir",
        ts: a.rescheduleRequestedAt ?? a.updatedAt ?? a.createdAt, phone: a.patientPhone });
    for (const a of cancelReqs)
      out.push({ key: `cancel-${a.id}`, kind: "cancel", href: `/operator/appointments/${a.id}`,
        name: a.patientName ?? "—", sub: clip(a.cancelRequestReasonText) || "pasiyent ləğv tələb edib",
        ts: a.cancelRequestedAt ?? a.updatedAt ?? a.createdAt, phone: a.patientPhone });
    for (const a of disputed)
      out.push({ key: `disp-${a.id}`, kind: "disputed", href: `/operator/appointments/${a.id}`,
        name: a.patientName ?? "—", sub: clip(a.disputeReason) || "mübahisə açıldı",
        ts: a.updatedAt ?? a.createdAt, phone: a.patientPhone });
    for (const a of rejected)
      out.push({ key: `rej-${a.id}`, kind: "rejected", href: `/operator/appointments/${a.id}`,
        name: a.patientName ?? "—", sub: a.requestedPsychologistName ? `İstənilən: ${a.requestedPsychologistName}` : "psixoloq rədd etdi",
        ts: a.updatedAt ?? a.createdAt, phone: a.patientPhone });
    for (const r of referrals)
      out.push({ key: `ref-${r.id}`, kind: "referral", href: `/operator/referrals/${r.id}`,
        name: r.patientName ?? "—", sub: `${r.fromPsychologistName} → ${r.toPsychologistName}`, ts: r.createdAt ?? "" });
    // Mübahisəli olanlar tarixdən asılı olmayaraq yuxarıda — ən təcili kateqoriyadır.
    return out.sort((a, b) => {
      const pa = a.kind === "disputed" ? 1 : 0;
      const pb = b.kind === "disputed" ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime();
    });
  }, [pending, rescheduleReqs, cancelReqs, disputed, rejected, referrals]);
  const todayActive = useMemo(() => items.filter(a => a.startAt && isSameDay(new Date(a.startAt), now)).filter(a => ["ASSIGNED", "CONFIRMED", "AWAITING_CONFIRMATION"].includes(a.status)).sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime()), [items, now]);
  const awaitingConfirm = useMemo(() => items.filter(a => a.status === "AWAITING_CONFIRMATION"), [items]);
  const stalePending = useMemo(() => { const cutoff = now.getTime() - 4 * 3600000; return pending.filter(a => new Date(a.createdAt).getTime() < cutoff); }, [pending, now]);
  const recentActions = useMemo(() => {
    let list = items.filter(a => a.assignedByOperatorId);
    if (scope === "mine" && user?.userId) list = list.filter(a => a.assignedByOperatorId === user.userId);
    return list.sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()).slice(0, 6);
  }, [items, scope, user?.userId]);
  const mineCount = useMemo(() => user?.userId ? items.filter(a => a.assignedByOperatorId === user.userId).length : 0, [items, user?.userId]);

  const kpis: { label: string; value: ReactNode; hint: string; tone: Tone; href?: string; icon: ReactNode }[] = [
    { label: "Növbədə", value: pending.length, hint: stalePending.length > 0 ? `${stalePending.length} > 4 saat` : "yeni müraciətlər", tone: stalePending.length > 0 ? "warn" : "neutral", href: "/operator/appointments", icon: <Ico d={I_CLOCK} /> },
    { label: "Mübahisəli", value: disputed.length, hint: (stats?.staleDisputedCount ?? 0) > 0 ? `${stats!.staleDisputedCount} köhnə (${stats!.disputeTimeoutHours}s+)` : disputed.length > 0 ? "həll et" : "boşdur", tone: ((stats?.staleDisputedCount ?? 0) > 0 || disputed.length > 0) ? "danger" : "good", href: "/operator/appointments", icon: <Ico d={I_CHAT} /> },
    { label: "Bu gün təyin", value: stats?.assignedToday ?? 0, hint: "müraciət", tone: "good", icon: <Ico d={I_CHECK} /> },
    { label: "Ümumi təyinat", value: stats?.assignedThisMonth ?? 0, hint: "bu ay", tone: "neutral", icon: <Ico d={I_CHECK} /> },
  ];

  const queueEmpty = inbox.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div className="fx-label" style={{ color: "var(--brand)", marginBottom: 7 }}>{todayLabel()}</div>
          <h1 className="fx-h1">İdarə paneli{user?.firstName ? ` · ${user.firstName}` : ""}</h1>
          <p className="fx-subtitle" style={{ margin: "6px 0 0" }}>{t("staff.opDashSub")}</p>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <GhostLink href="/operator/appointments" icon={<Ico d={I_CAL} w={15} />}>Bütün müraciətlər</GhostLink>
          <GhostLink href="/operator/payments" icon={<Ico d={I_CARD} w={15} />}>Ödənişlər</GhostLink>
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <ErrorState
          title="Panel yüklənmədi"
          sub="Müraciət siyahısı gətirilə bilmədi. Bağlantını yoxlayıb yenidən cəhd edin."
          onRetry={load}
        />
      ) : (
        <>
          {/* STAT ZOLAĞI — bir vahid zolaq, ayrı-ayrı kölgəli qutular yox; sakit hairline-larla bölünür */}
          <div className="fx-card fx-card--lg fx-kpi-row db-kpis" style={{ marginBottom: 16 }}>
            {kpis.map(k => <StatItem key={k.label} {...k} />)}
          </div>

          {/* ƏSAS SAHƏ */}
          <div className="db-main" style={{ marginBottom: 18 }}>
            {/* SOL — TRİYAJ + SON FƏALİYYƏT (əsas fokus burada; hər kart öz məzmununa görə hündürlük alır) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {queueEmpty ? (
                <div className="fx-card--empty" style={{ justifyContent: "center", padding: "44px 24px" }}>
                  <div style={{ color: "var(--sage)", marginBottom: 2 }}><Ico d={I_LEAF} w={36} sw={1.4} /></div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>Növbə boşdur</div>
                  <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 500 }}>Bütün müraciətlər həll edilib. Yeni müraciət gəldikdə burada görünəcək.</div>
                </div>
              ) : (
                /* VAHİD INBOX — bütün müraciət növləri tək siyahıda, pill ilə fərqləndirilir;
                   mübahisəlilər həmişə yuxarıda. İlk 5 sətir göstərilir, qalanı üçün
                   alt hissədə "Hamısına bax" düyməsi çıxır. */
                <QueueBlock title="Yeni müraciətlər" count={inbox.length} shownCount={5} icon={<Ico d={I_INBOX} />} allHref="/operator/appointments">
                  {inbox.slice(0, 5).map(it => (
                    <InboxRow key={it.key} item={it} now={now}
                      onClaim={it.kind === "pending" ? handleClaim : undefined}
                      claiming={it.appointmentId != null && claimingId === it.appointmentId} />
                  ))}
                </QueueBlock>
              )}

              {/* Son fəaliyyət — sol sütunda, triyaj bloku altında; sağ sütunla boşluğu təbii doldurur */}
              {recentActions.length > 0 && (
                <div className="fx-card" style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                    <span className="fx-card-title">Son fəaliyyət</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="fx-segmented">
                        {(["all", "mine"] as const).map(s => {
                          const on = scope === s;
                          const disabled = s === "mine" && (!user?.userId || mineCount === 0);
                          return <button key={s} type="button" disabled={disabled} onClick={() => setScope(s)} className={on ? "fx-seg--active" : ""} style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer" }}>{s === "all" ? "Bütün operatorlar" : `Mənim (${mineCount})`}</button>;
                        })}
                      </div>
                      <Link href="/operator/appointments" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--brand)", textDecoration: "none" }}>Hamısı →</Link>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {recentActions.map(a => {
                      const vt = verbTone(a.status);
                      return (
                        <Link key={a.id} href={`/operator/appointments/${a.id}`} className="db-hover" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderTop: "1px solid var(--hairline)", textDecoration: "none", color: "inherit", flexWrap: "wrap" }}>
                          <span className="fx-num" style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, minWidth: 90 }}>{timeAgo(a.updatedAt ?? a.createdAt, now)} əvvəl</span>
                          <span className="fx-pill" style={{ background: vt.bg, color: vt.fg, fontSize: 11, fontWeight: 700, padding: "3px 10px" }}>{statusVerb(a.status)}</span>
                          <span style={{ flex: 1, minWidth: 150, fontSize: 13.5, fontWeight: 600, color: "var(--oxford)" }}>{a.patientName ?? "—"} <span style={{ color: "var(--oxford-60)", fontWeight: 500 }}>→ {a.psychologistName ?? "—"}</span></span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* SAĞ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Maliyyə */}
              {summary && (
                <div className="fx-card" style={{ padding: 18 }}>
                  <SectionLabel>Maliyyə</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    <Link href="/operator/payments" style={{ ...FIN, background: "var(--amber-bg)", border: "1px solid rgba(201,125,46,.25)", textDecoration: "none" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--status-pending-fg)" }}>Gözləyən ödəniş <span style={{ opacity: 0.7 }}>({summary.pendingCount})</span></span>
                      <span className="fx-num" style={{ fontSize: 14, fontWeight: 800, color: "var(--status-pending-fg)" }}>{formatAzn(summary.pendingSum)}</span>
                    </Link>
                    <div style={{ ...FIN, background: "var(--sage-bg)", border: "1px solid rgba(74,155,127,.3)" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--sage)" }}>Bu ay net gəlir</span>
                      <span className="fx-num" style={{ fontSize: 14, fontWeight: 800, color: "var(--sage)" }}>{formatAzn(summary.paidMonthSum)}</span>
                    </div>
                    <div style={{ ...FIN, background: "var(--status-refunded-bg)", border: "1px solid rgba(153,27,27,.18)" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--status-refunded-fg)" }}>Bu ay geri qaytarılıb</span>
                      <span className="fx-num" style={{ fontSize: 14, fontWeight: 800, color: "var(--status-refunded-fg)" }}>{formatAzn(summary.refundedMonthSum)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sürətli əməliyyatlar */}
              <div className="fx-card" style={{ padding: 18 }}>
                <SectionLabel>Sürətli əməliyyatlar</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  <Quick href="/operator/pool" title="Müraciət sırası" sub="sahibsiz müraciətlər" icon={<Ico d={I_INBOX} w={18} />} />
                  <Quick href="/operator/customers" title="Müştərilər" sub="pasiyent axtar" icon={<Ico d={I_USERS} w={18} />} />
                  <Quick href="/operator/payments" title="Ödənişlər" sub="təsdiq / qaytarma" icon={<Ico d={I_CARD} w={18} />} />
                  <Quick href="/operator/meeting-links" title="Görüş linkləri" sub="link göndər" icon={<Ico d={I_VIDEO} w={18} />} />
                </div>
              </div>

              {/* Bu ay */}
              {stats && (
                <div className="fx-card" style={{ padding: 18 }}>
                  <SectionLabel>Bu ay</SectionLabel>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <MonthStat value={stats.totalThisMonth} label="Cəmi randevu" color="var(--oxford)" />
                    <MonthStat value={stats.completedThisMonth} label="Tamamlandı" color="var(--sage)" />
                    <MonthStat value={stats.rejectionRatePct != null ? `${stats.rejectionRatePct}%` : "—"} label="Rədd faizi" color={stats.rejectionRatePct != null && stats.rejectionRatePct > 15 ? "var(--error)" : "var(--oxford-80)"} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Komponentlər ───────────────────────────────────────────────────────── */
/* Sakit, "considered" görünüş: hər yerdə eyni hairline sərhəd, kölgə yoxdur —
   rəng yalnız diqqət tələb edən (warn/danger) vəziyyətlərdə işə düşür. */

const FIN: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderRadius: 10, padding: "11px 13px" };

/** Yüklənmə skeleti — real layout-un (stat zolağı + iki sütun) formasını təkrarlayır
 *  ki, məzmun gələndə sıçrayış olmasın. */
function DashboardSkeleton() {
  return (
    <>
      <div className="fx-card fx-card--lg fx-kpi-row db-kpis" style={{ marginBottom: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ padding: "18px 20px" }}>
            <Skeleton width={90} height={12} />
            <Skeleton width={54} height={26} style={{ marginTop: 10 }} />
            <Skeleton width={70} height={11} style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div className="db-main">
        <div className="fx-card" style={{ padding: 18 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 2px", borderTop: i === 0 ? "none" : "1px solid var(--hairline)" }}>
              <Skeleton width={36} height={36} radius={999} />
              <div style={{ flex: 1 }}>
                <Skeleton width="45%" height={13} />
                <Skeleton width="65%" height={11} style={{ marginTop: 7 }} />
              </div>
              <Skeleton width={54} height={12} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="fx-card" style={{ padding: 18 }}>
            <Skeleton width={80} height={12} />
            <Skeleton width="100%" height={44} style={{ marginTop: 12 }} />
            <Skeleton width="100%" height={44} style={{ marginTop: 9 }} />
          </div>
          <div className="fx-card" style={{ padding: 18 }}>
            <Skeleton width={110} height={12} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width="100%" height={62} />)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function GhostLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return <Link href={href} className="fx-btn fx-btn--ghost">{icon}{children}</Link>;
}
function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="fx-label" style={{ marginBottom: 13 }}>{children}</div>;
}
function MonthStat({ value, label, color }: { value: ReactNode; label: string; color: string }) {
  return <div style={{ flex: 1, minWidth: 90 }}><div className="fx-num" style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div><div style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600, marginTop: 2 }}>{label}</div></div>;
}
function Quick({ href, title, sub, icon }: { href: string; title: string; sub: string; icon: ReactNode }) {
  return (
    <Link href={href} className="db-hover" style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--surface-muted)", border: "1px solid var(--hairline)", borderRadius: 11, padding: 12, textDecoration: "none", color: "inherit" }}>
      <span style={{ color: "var(--brand)" }}>{icon}</span>
      <div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)" }}>{title}</div><div style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 600 }}>{sub}</div></div>
    </Link>
  );
}

/** Stat zolağının bir sütunu — sakit ink rəngdə, yalnız warn/danger olanda vurğulanır. */
function StatItem({ label, value, hint, tone, href, icon }: { label: string; value: ReactNode; hint: string; tone: Tone; href?: string; icon: ReactNode }) {
  const attention = tone === "warn" || tone === "danger";
  const color = !attention ? undefined : tone === "danger" ? "var(--error)" : "var(--amber)";
  const content = (
    <>
      <div className="fx-flex" style={{ gap: 7, color: color ?? "var(--oxford-60)", marginBottom: 2 }}>
        {icon}
        <span className="fx-label">{label}</span>
      </div>
      <div className="fx-kpi__value" style={color ? { color } : undefined}>{value}</div>
      <div className="fx-kpi__meta" style={color ? { color, fontWeight: 600 } : undefined}>{hint}</div>
    </>
  );
  return href
    ? <Link href={href} className="fx-kpi db-stat" style={{ textDecoration: "none" }}>{content}</Link>
    : <div className="fx-kpi">{content}</div>;
}

function QueueBlock({ title, count, shownCount, icon, children, allHref = "/operator/appointments" }: { title: string; count: number; shownCount?: number; icon: ReactNode; children: ReactNode; allHref?: string }) {
  const hasMore = shownCount != null && count > shownCount;
  return (
    <div className="fx-card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div className="fx-card__head" style={{ gap: 9, justifyContent: "flex-start", flex: "none" }}>
        <span style={{ color: "var(--brand)", display: "inline-flex" }}>{icon}</span>
        <span className="fx-card-title">{title}</span>
        <span className="fx-pill fx-pill--count fx-num">{count}</span>
      </div>
      <div>{children}</div>
      {hasMore && (
        <div style={{ flex: "none", padding: "11px 18px", borderTop: "1px solid var(--hairline)", textAlign: "right" }}>
          <Link href={allHref} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--brand)", textDecoration: "none" }}>Hamısına bax →</Link>
        </div>
      )}
    </div>
  );
}

function Pill({ bg, fg, children }: { bg: string; fg: string; children: ReactNode }) {
  return <span className="fx-pill" style={{ background: bg, color: fg, fontSize: 10.5, fontWeight: 700, padding: "2px 8px" }}>{children}</span>;
}

/* ─── Vahid inbox sətri (bütün müraciət növlərini eyni formatda göstərir) ──── */
type InboxKind = "pending" | "reschedule" | "cancel" | "disputed" | "rejected" | "referral";
interface InboxItem {
  key: string; kind: InboxKind; href: string; name: string; sub: string; ts: string;
  phone?: string | null;
  /** Yalnız pending: "Götür" düyməsi üçün id. */
  appointmentId?: number;
  claimedByName?: string | null;
}

const INBOX_META: Record<InboxKind, { label: string; bg: string; fg: string }> = {
  pending:    { label: "Yeni randevu",     bg: "var(--brand-100)",          fg: "var(--brand-700)" },
  reschedule: { label: "Vaxt dəyişikliyi", bg: "var(--bg-blue)",            fg: "var(--brand-600)" },
  cancel:     { label: "Ləğv tələbi",      bg: "var(--status-pending-bg)",  fg: "var(--status-pending-fg)" },
  disputed:   { label: "Mübahisə",         bg: "var(--status-refunded-bg)", fg: "var(--status-refunded-fg)" },
  rejected:   { label: "Rədd → təyin",     bg: "var(--status-pending-bg)",  fg: "var(--status-pending-fg)" },
  referral:   { label: "Yönləndirmə",      bg: "var(--lilac-bg)",           fg: "var(--lilac)" },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function Avatar({ name, bg, fg }: { name: string; bg: string; fg: string }) {
  // Kateqoriya rəngi mənalıdır (növbədə növü göstərir) — fx-avatar formasını saxlayıb rəngi override edirik.
  return <div className="fx-avatar" style={{ background: bg, color: fg }}>{initials(name)}</div>;
}

function PhoneChip({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone}`}
      onClick={e => e.stopPropagation()}
      className="db-phone"
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", textDecoration: "none" }}
    >
      <Ico d={I_PHONE} w={12} sw={2} />{phone}
    </a>
  );
}

function InboxRow({ item, now, onClaim, claiming }: { item: InboxItem; now: Date; onClaim?: (appointmentId: number) => void; claiming?: boolean }) {
  const m = INBOX_META[item.kind];
  const claimedByOther = !!item.claimedByName;
  return (
    <Link href={item.href} className="fx-row" style={{ padding: "13px 18px", textDecoration: "none", color: "inherit", flexWrap: "wrap" }}>
      <Avatar name={item.name} bg={m.bg} fg={m.fg} />
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{item.name}</span>
          <Pill bg={m.bg} fg={m.fg}>{m.label}</Pill>
          {claimedByOther && (
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--oxford-60)" }}>{item.claimedByName} götürüb</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {item.sub && <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>{item.sub}</span>}
          {item.phone && <PhoneChip phone={item.phone} />}
        </div>
      </div>
      {onClaim && item.appointmentId != null && !claimedByOther && (
        <button
          type="button"
          disabled={claiming}
          onClick={e => { e.preventDefault(); e.stopPropagation(); onClaim(item.appointmentId!); }}
          className="fx-btn fx-btn--ghost fx-btn--sm"
          style={{ flex: "none", color: "var(--brand)", borderColor: "var(--brand-200)", cursor: claiming ? "wait" : "pointer", opacity: claiming ? 0.6 : 1 }}
        >
          {claiming ? "…" : "Götür"}
        </button>
      )}
      <span className="fx-num" style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", flex: "none" }}>{item.ts ? `${timeAgo(item.ts, now)} əvvəl` : ""}</span>
    </Link>
  );
}
function statusVerb(s: string): string {
  switch (s) {
    case "ASSIGNED": return "Təyin";
    case "CONFIRMED": return "Təsdiqləndi";
    case "AWAITING_CONFIRMATION": return "Təsdiq gözlənir";
    case "DISPUTED": return "Mübahisə";
    case "COMPLETED": return "Tamamlandı";
    case "CANCELLED": return "Ləğv";
    case "REJECTED": return "Rədd";
    case "PENDING": return "Yeni müraciət";
    default: return s;
  }
}
function verbTone(s: string): { bg: string; fg: string } {
  switch (s) {
    case "ASSIGNED": return { bg: "var(--brand-100)", fg: "var(--brand-700)" };
    case "CONFIRMED": return { bg: "var(--status-paid-bg)", fg: "var(--status-paid-fg)" };
    case "REJECTED": case "AWAITING_CONFIRMATION": return { bg: "var(--status-pending-bg)", fg: "var(--status-pending-fg)" };
    case "DISPUTED": case "CANCELLED": return { bg: "var(--status-refunded-bg)", fg: "var(--status-refunded-fg)" };
    default: return { bg: "var(--status-cancelled-bg)", fg: "var(--status-cancelled-fg)" };
  }
}

function Ico({ d, w = 16, sw = 1.9 }: { d: string | string[]; w?: number; sw?: number }) {
  const paths = Array.isArray(d) ? d : [d];
  return <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{paths.map((p, i) => <path key={i} d={p} />)}</svg>;
}
const I_CLOCK = "M12 7v5l3 2 M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z";
const I_CHAT = "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z";
const I_CHECK = ["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"];
const I_LEAF = ["M11 20A7 7 0 0 1 4 13c0-4 3-9 11-12 0 0 5 6 5 12a7 7 0 0 1-7 7c-2 0-4-1-5-3", "M2 22c4-1 7-4 9-8"];
const I_CAL = ["M3 4h18v18H3z", "M16 2v4M8 2v4M3 10h18"];
const I_VIDEO = ["M23 7l-7 5 7 5V7z", "M1 5h15v14H1z"];
const I_INBOX = ["M22 12h-6l-2 3h-4l-2-3H2", "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"];
const I_USERS = ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M23 21v-2a4 4 0 0 0-3-3.87"];
const I_CARD = ["M2 5h20v14H2z", "M2 10h20"];
const I_PHONE = "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.11 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7a2 2 0 0 1 1.72 2.03z";

const CSS = `
.db-main{display:grid;grid-template-columns:1.6fr 1fr;gap:18px;align-items:start}
@media(max-width:840px){.db-main{grid-template-columns:1fr}}

/* KPI zolağının sütunları — hairline bölücülər fx-kpi + fx-kpi-dən gəlir */
.db-kpis{grid-template-columns:repeat(4,1fr)}
.db-stat{transition:background .12s}
.db-stat:hover{background:var(--surface-muted)}
.db-hover{transition:background .12s}
.db-hover:hover{background:var(--surface-muted)}
.db-phone:hover{color:var(--brand)}
@media(max-width:760px){
  .db-kpis{grid-template-columns:repeat(2,1fr)}
  .db-kpis>.fx-kpi:nth-child(2n+1){border-left:none}
  .db-kpis>.fx-kpi:nth-child(n+3){border-top:1px solid var(--hairline)}
}
@media(max-width:420px){
  .db-kpis{grid-template-columns:1fr}
  .db-kpis>.fx-kpi{border-left:none!important}
  .db-kpis>.fx-kpi:not(:first-child){border-top:1px solid var(--hairline)}
}
`;
