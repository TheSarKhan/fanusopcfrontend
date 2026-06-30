"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  operatorApi,
  type AppointmentDetail,
  type OperatorStats,
  type PaymentSummary,
  type SessionRequest,
  type Referral,
} from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { getStoredUser } from "@/lib/auth";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatAzn } from "@/lib/money";

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
const TONE: Record<Tone, { accent: string; num: string; hint: string }> = {
  danger:  { accent: "#DC2626", num: "#991B1B", hint: "#991B1B" },
  warn:    { accent: "#F59E0B", num: "#0A1A33", hint: "#92400E" },
  good:    { accent: "#047857", num: "#047857", hint: "#9DB0CC" },
  neutral: { accent: "#9CA3AF", num: "#374151", hint: "#9DB0CC" },
};

export default function OperatorDashboard() {
  const { t } = useT();
  const user = getStoredUser();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [leads, setLeads] = useState<SessionRequest[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [scope, setScope] = useState<"all" | "mine">("all");

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);

  const load = () => {
    setLoading(true);
    Promise.all([
      operatorApi.listAppointments(),
      operatorApi.stats().catch(() => null),
      operatorApi.paymentsSummary().catch(() => null),
      operatorApi.listSessionRequests("NEW").catch(() => [] as SessionRequest[]),
      operatorApi.pendingReferrals().catch(() => [] as Referral[]),
    ]).then(([list, s, sm, ld, rf]) => { setItems(list); setStats(s); setSummary(sm); setLeads(ld); setReferrals(rf); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => subscribeNotifications(n => { if (typeof n.type === "string" && (n.type.startsWith("APPOINTMENT_") || n.type.startsWith("RESCHEDULE_") || n.type.startsWith("SESSION_REQUEST") || n.type.startsWith("REFERRAL"))) load(); }), []);

  const disputed = useMemo(() => items.filter(a => a.status === "DISPUTED").sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()), [items]);
  const rejected = useMemo(() => items.filter(a => a.status === "REJECTED").sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()), [items]);
  const pending = useMemo(() => items.filter(a => a.status === "PENDING").sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [items]);
  // Patient-initiated reschedule requests still live on active appointments (no
  // status change) — surfaced here as their own queue group so operators don't
  // miss them when the transient notification scrolls away.
  const rescheduleReqs = useMemo(() => items.filter(a => a.rescheduleRequestedAt && (a.status === "CONFIRMED" || a.status === "ASSIGNED")).sort((a, b) => new Date(b.rescheduleRequestedAt!).getTime() - new Date(a.rescheduleRequestedAt!).getTime()), [items]);
  const cancelReqs = useMemo(() => items.filter(a => a.status === "CANCEL_REQUESTED").sort((a, b) => new Date(b.cancelRequestedAt ?? b.updatedAt ?? b.createdAt).getTime() - new Date(a.cancelRequestedAt ?? a.updatedAt ?? a.createdAt).getTime()), [items]);
  // ─── Vahid inbox: bütün müraciət növləri (lead + randevu + reschedule + ləğv +
  // mübahisə + rədd + yönləndirmə) əvvəlcə tək siyahıda, ən yenisi yuxarıda. ─────
  const inbox = useMemo<InboxItem[]>(() => {
    const clip = (s?: string | null, n = 56) => (s ? `«${s.length > n ? s.slice(0, n) + "…" : s}»` : "");
    const out: InboxItem[] = [];
    for (const l of leads)
      out.push({ key: `lead-${l.id}`, kind: "lead", href: `/operator/session-requests/${l.id}`,
        name: l.name, sub: clip(l.reason) || "yeni müraciət forması", ts: l.createdAt });
    for (const a of pending)
      out.push({ key: `pending-${a.id}`, kind: "pending", href: `/operator/appointments/${a.id}`,
        name: a.patientName ?? "—", sub: a.requestedPsychologistName ? `İstənilən: ${a.requestedPsychologistName}` : "psixoloq seçilməyib", ts: a.createdAt });
    for (const a of rescheduleReqs)
      out.push({ key: `resched-${a.id}`, kind: "reschedule", href: `/operator/appointments/${a.id}`,
        name: a.patientName ?? "—", sub: clip(a.rescheduleRequestNote) || "pasiyent vaxtı dəyişmək istəyir", ts: a.rescheduleRequestedAt ?? a.updatedAt ?? a.createdAt });
    for (const a of cancelReqs)
      out.push({ key: `cancel-${a.id}`, kind: "cancel", href: `/operator/appointments/${a.id}`,
        name: a.patientName ?? "—", sub: clip(a.cancelRequestReasonText) || "pasiyent ləğv tələb edib", ts: a.cancelRequestedAt ?? a.updatedAt ?? a.createdAt });
    for (const a of disputed)
      out.push({ key: `disp-${a.id}`, kind: "disputed", href: `/operator/appointments/${a.id}`,
        name: a.patientName ?? "—", sub: clip(a.disputeReason) || "mübahisə açıldı", ts: a.updatedAt ?? a.createdAt });
    for (const a of rejected)
      out.push({ key: `rej-${a.id}`, kind: "rejected", href: `/operator/appointments/${a.id}`,
        name: a.patientName ?? "—", sub: a.requestedPsychologistName ? `İstənilən: ${a.requestedPsychologistName}` : "psixoloq rədd etdi", ts: a.updatedAt ?? a.createdAt });
    for (const r of referrals)
      out.push({ key: `ref-${r.id}`, kind: "referral", href: `/operator/referrals`,
        name: r.patientName ?? "—", sub: `${r.fromPsychologistName} → ${r.toPsychologistName}`, ts: r.createdAt ?? "" });
    return out.sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime());
  }, [leads, pending, rescheduleReqs, cancelReqs, disputed, rejected, referrals]);
  const leadItems = useMemo(() => inbox.filter(i => i.kind === "lead"), [inbox]);
  const referralItems = useMemo(() => inbox.filter(i => i.kind === "referral"), [inbox]);
  const todayActive = useMemo(() => items.filter(a => a.startAt && isSameDay(new Date(a.startAt), now)).filter(a => ["ASSIGNED", "CONFIRMED", "AWAITING_CONFIRMATION"].includes(a.status)).sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime()), [items, now]);
  const awaitingConfirm = useMemo(() => items.filter(a => a.status === "AWAITING_CONFIRMATION"), [items]);
  const stalePending = useMemo(() => { const cutoff = now.getTime() - 4 * 3600000; return pending.filter(a => new Date(a.createdAt).getTime() < cutoff); }, [pending, now]);
  const staleSeverity = (a: AppointmentDetail): "warn" | "warn-2" | "danger" | undefined => {
    const ms = now.getTime() - new Date(a.createdAt).getTime();
    if (ms >= 48 * 3600000) return "danger";
    if (ms >= 24 * 3600000) return "warn-2";
    if (ms >= 4 * 3600000) return "warn";
    return undefined;
  };
  const recentActions = useMemo(() => {
    let list = items.filter(a => a.assignedByOperatorId);
    if (scope === "mine" && user?.userId) list = list.filter(a => a.assignedByOperatorId === user.userId);
    return list.sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()).slice(0, 6);
  }, [items, scope, user?.userId]);
  const mineCount = useMemo(() => user?.userId ? items.filter(a => a.assignedByOperatorId === user.userId).length : 0, [items, user?.userId]);

  const kpis: { label: string; value: ReactNode; hint: string; tone: Tone; href?: string; icon: ReactNode }[] = [
    { label: "Növbədə", value: pending.length, hint: stalePending.length > 0 ? `${stalePending.length} > 4 saat` : "yeni müraciətlər", tone: stalePending.length > 0 ? "warn" : "neutral", href: "/operator/appointments", icon: <Ico d={I_CLOCK} /> },
    { label: "Gecikmiş", value: stats?.slaOverdueCount ?? 0, hint: `SLA: ${stats?.slaHours ?? 2} saat`, tone: (stats?.slaOverdueCount ?? 0) > 0 ? "danger" : "good", href: "/operator/appointments?filter=overdue", icon: <Ico d={I_ALERT} /> },
    { label: "Mübahisəli", value: disputed.length, hint: (stats?.staleDisputedCount ?? 0) > 0 ? `${stats!.staleDisputedCount} köhnə (${stats!.disputeTimeoutHours}s+)` : disputed.length > 0 ? "həll et" : "boşdur", tone: ((stats?.staleDisputedCount ?? 0) > 0 || disputed.length > 0) ? "danger" : "good", href: "/operator/appointments", icon: <Ico d={I_CHAT} /> },
    { label: "Böhran", value: stats?.crisisUnackedCount ?? 0, hint: (stats?.crisisUnackedCount ?? 0) > 0 ? "baxılmamış check-in" : "hamısına baxılıb", tone: (stats?.crisisUnackedCount ?? 0) > 0 ? "danger" : "good", href: "/operator/analytics", icon: <Ico d={I_PULSE} /> },
    { label: "Yenidən təyin", value: rejected.length, hint: "psixoloq rədd etdi", tone: rejected.length > 0 ? "warn" : "neutral", href: "/operator/appointments", icon: <Ico d={I_REFRESH} /> },
    { label: "Bu gün təyin", value: stats?.assignedToday ?? 0, hint: "müraciət", tone: "good", icon: <Ico d={I_CHECK} /> },
    { label: "Orta cavab", value: fmtMin(stats?.avgResponseMinutes ?? null), hint: "bu ay", tone: "neutral", icon: <Ico d={I_WATCH} /> },
  ];

  const queueEmpty = inbox.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--brand)", marginBottom: 7 }}>{todayLabel()}</div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", color: "var(--oxford)" }}>İdarə paneli{user?.firstName ? ` · ${user.firstName}` : ""}</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>{t("staff.opDashSub")}</p>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <GhostLink href="/operator/appointments" icon={<Ico d={I_CAL} w={15} />}>Bütün müraciətlər</GhostLink>
          <GhostLink href="/operator/analytics" icon={<Ico d={I_CHART} w={15} />}>Analitika</GhostLink>
        </div>
      </div>

      {loading ? (
        <div style={{ ...CARD, padding: 60, textAlign: "center", color: "var(--oxford-60)" }}>{t("common.loading")}</div>
      ) : (
        <>
          {/* KPI STRIP */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 22 }}>
            {kpis.map(k => {
              const c = TONE[k.tone];
              const inner = <>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9, color: c.accent }}>{k.icon}<span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--oxford-60)" }}>{k.label}</span></div>
                <div className="db-num" style={{ fontSize: 23, fontWeight: 800, color: c.num, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: c.hint, fontWeight: 600, marginTop: 4 }}>{k.hint}</div>
              </>;
              const st: React.CSSProperties = { ...CARD, borderLeft: `3px solid ${c.accent}`, padding: "14px 15px", textDecoration: "none", display: "block" };
              return k.href ? <Link key={k.label} href={k.href} className="db-kpi" style={st}>{inner}</Link> : <div key={k.label} style={st}>{inner}</div>;
            })}
          </div>

          {/* MAIN GRID */}
          <div className="db-main" style={{ marginBottom: 18 }}>
            {/* LEFT — TRİYAJ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {queueEmpty ? (
                <div style={{ ...CARD, padding: "44px 24px", textAlign: "center" }}>
                  <div style={{ color: "#86B89E", marginBottom: 10 }}><Ico d={I_LEAF} w={36} sw={1.4} /></div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)", marginBottom: 5 }}>Növbə boşdur</div>
                  <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 500 }}>Bütün müraciətlər həll edilib. Yeni müraciət gəldikdə burada görünəcək.</div>
                </div>
              ) : <>
                {/* VAHİD INBOX — bütün müraciət növləri əvvəlcə burada toplanır */}
                <QueueBlock title="Yeni müraciətlər" tone="brand" count={inbox.length} icon={<Ico d={I_INBOX} />} allHref="/operator/appointments">
                  {inbox.slice(0, 8).map(it => <InboxRow key={it.key} item={it} now={now} />)}
                  {inbox.length > 8 && <Overflow n={inbox.length - 8} />}
                </QueueBlock>

                {/* Daha sonra eyni müraciətlər uyğun kateqoriyalar üzrə bölünür */}
                {disputed.length > 0 && (
                  <QueueBlock title="Acil həll et" tone="danger" count={disputed.length} icon={<Ico d={I_ALERT} />} allHref="/operator/appointments?tab=DISPUTED">
                    {disputed.slice(0, 4).map(a => <QueueRow key={a.id} a={a} now={now} kind="disputed" />)}
                    {disputed.length > 4 && <Overflow n={disputed.length - 4} />}
                  </QueueBlock>
                )}
                {leadItems.length > 0 && (
                  <QueueBlock title="Yeni müraciət formaları (lead)" tone="brand" count={leadItems.length} icon={<Ico d={I_PLUS} />} allHref="/operator/session-requests">
                    {leadItems.slice(0, 4).map(it => <InboxRow key={it.key} item={it} now={now} />)}
                    {leadItems.length > 4 && <Overflow n={leadItems.length - 4} />}
                  </QueueBlock>
                )}
                {pending.length > 0 && (
                  <QueueBlock title="Yeni randevu tələbləri" tone="brand" count={pending.length} icon={<Ico d={I_PLUS} />}>
                    {pending.slice(0, 6).map(a => <QueueRow key={a.id} a={a} now={now} kind="pending" severity={staleSeverity(a)} />)}
                    {pending.length > 6 && <Overflow n={pending.length - 6} />}
                  </QueueBlock>
                )}
                {rescheduleReqs.length > 0 && (
                  <QueueBlock title="Vaxt dəyişikliyi tələbləri" tone="warn" count={rescheduleReqs.length} icon={<Ico d={I_CLOCK} />} allHref="/operator/appointments?filter=reschedule">
                    {rescheduleReqs.slice(0, 4).map(a => <QueueRow key={a.id} a={a} now={now} kind="reschedule" />)}
                    {rescheduleReqs.length > 4 && <Overflow n={rescheduleReqs.length - 4} />}
                  </QueueBlock>
                )}
                {cancelReqs.length > 0 && (
                  <QueueBlock title="Ləğv tələbləri" tone="warn" count={cancelReqs.length} icon={<Ico d={I_BAN} />} allHref="/operator/appointments?tab=CANCEL_REQUESTED">
                    {cancelReqs.slice(0, 4).map(a => <QueueRow key={a.id} a={a} now={now} kind="cancel" />)}
                    {cancelReqs.length > 4 && <Overflow n={cancelReqs.length - 4} />}
                  </QueueBlock>
                )}
                {rejected.length > 0 && (
                  <QueueBlock title="Yenidən təyin lazımdır" tone="warn" count={rejected.length} icon={<Ico d={I_REFRESH} />}>
                    {rejected.slice(0, 4).map(a => <QueueRow key={a.id} a={a} now={now} kind="rejected" />)}
                    {rejected.length > 4 && <Overflow n={rejected.length - 4} />}
                  </QueueBlock>
                )}
                {referralItems.length > 0 && (
                  <QueueBlock title="Yönləndirmələr" tone="warn" count={referralItems.length} icon={<Ico d={I_REFRESH} />} allHref="/operator/referrals">
                    {referralItems.slice(0, 4).map(it => <InboxRow key={it.key} item={it} now={now} />)}
                    {referralItems.length > 4 && <Overflow n={referralItems.length - 4} />}
                  </QueueBlock>
                )}
              </>}
            </div>

            {/* RIGHT */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Bu gün */}
              <div style={{ ...CARD, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>Bu gün</span>
                  <span style={{ background: "#E4ECFA", color: "#082F6D", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{todayActive.length} aktiv</span>
                </div>
                {todayActive.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--oxford-60)", padding: "8px 0" }}>Bu gün üçün təyin edilmiş seans yoxdur</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {todayActive.slice(0, 5).map(a => {
                      const aw = a.status === "AWAITING_CONFIRMATION";
                      return (
                        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 10px", borderRadius: 9, ...(aw ? { background: "#FFFBEB", border: "1px solid #FDECC8" } : {}) }}>
                          <span className="db-num" style={{ fontSize: 14, fontWeight: 800, minWidth: 44, color: "var(--oxford)" }}>{a.startAt ? fmtTime(a.startAt) : "—"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)" }}>{a.patientName ?? "—"}</div>
                            <div style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600 }}>{a.psychologistName ?? "—"}</div>
                          </div>
                          {aw && <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>təsdiq</span>}
                        </div>
                      );
                    })}
                    {todayActive.length > 5 && <Overflow n={todayActive.length - 5} />}
                  </div>
                )}
                {awaitingConfirm.length > 0 && (
                  <Link href="/operator/appointments" style={{ display: "block", marginTop: 11, paddingTop: 11, borderTop: "1px solid #F4F7FB", fontSize: 12.5, fontWeight: 600, color: "#92400E", textDecoration: "none" }}>{awaitingConfirm.length} təsdiq gözləyir · izlə →</Link>
                )}
              </div>

              {/* Maliyyə */}
              {summary && (
                <div style={{ ...CARD, padding: 18 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--oxford)" }}>Maliyyə</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    <Link href="/operator/payments" style={{ ...FIN, background: "#FFFBEB", border: "1px solid #FDECC8", textDecoration: "none" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#92400E" }}>Gözləyən ödəniş <span style={{ opacity: 0.7 }}>({summary.pendingCount})</span></span>
                      <span className="db-num" style={{ fontSize: 14, fontWeight: 800, color: "#92400E" }}>{formatAzn(summary.pendingSum)}</span>
                    </Link>
                    <div style={{ ...FIN, background: "#ECFDF5", border: "1px solid #A7F3D0" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#065F46" }}>Bu ay net gəlir</span>
                      <span className="db-num" style={{ fontSize: 14, fontWeight: 800, color: "#065F46" }}>{formatAzn(summary.paidMonthSum)}</span>
                    </div>
                    <div style={{ ...FIN, background: "#FEF2F2", border: "1px solid #FBD5D5" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#991B1B" }}>Bu ay geri qaytarılıb</span>
                      <span className="db-num" style={{ fontSize: 14, fontWeight: 800, color: "#991B1B" }}>{formatAzn(summary.refundedMonthSum)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sürətli əməliyyatlar */}
              <div style={{ ...CARD, padding: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 13, color: "var(--oxford)" }}>Sürətli əməliyyatlar</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  <Quick href="/operator/pool" title="Müraciət sırası" sub="sahibsiz müraciətlər" icon={<Ico d={I_INBOX} w={18} />} />
                  <Quick href="/operator/customers" title="Müştərilər" sub="pasiyent axtar" icon={<Ico d={I_USERS} w={18} />} />
                  <Quick href="/operator/payments" title="Ödənişlər" sub="təsdiq / qaytarma" icon={<Ico d={I_CARD} w={18} />} />
                  <Quick href="/operator/analytics" title="Analitika" sub="gəlir & performans" icon={<Ico d={I_CHART} w={18} />} />
                </div>
              </div>

              {/* Bu ay */}
              {stats && (
                <div style={{ ...CARD, padding: 18 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--oxford)" }}>Bu ay</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <MonthStat value={stats.totalThisMonth} label="Cəmi randevu" color="var(--oxford)" />
                    <MonthStat value={stats.completedThisMonth} label="Tamamlandı" color="#047857" />
                    <MonthStat value={stats.rejectionRatePct != null ? `${stats.rejectionRatePct}%` : "—"} label="Rədd faizi" color={stats.rejectionRatePct != null && stats.rejectionRatePct > 15 ? "#DC2626" : "#374151"} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SON FƏALİYYƏT */}
          {recentActions.length > 0 && (
            <div style={{ ...CARD, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>Son fəaliyyət</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "inline-flex", background: "#F0F4FA", borderRadius: 8, padding: 3, gap: 2 }}>
                    {(["all", "mine"] as const).map(s => {
                      const on = scope === s;
                      const disabled = s === "mine" && (!user?.userId || mineCount === 0);
                      return <button key={s} type="button" disabled={disabled} onClick={() => setScope(s)} style={{ border: "none", borderRadius: 6, padding: "6px 11px", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, background: on ? "#fff" : "transparent", color: on ? "#082F6D" : "var(--oxford-60)", boxShadow: on ? "0 1px 3px rgba(8,47,109,.12)" : "none" }}>{s === "all" ? "Bütün operatorlar" : `Mənim (${mineCount})`}</button>;
                    })}
                  </div>
                  <Link href="/operator/appointments" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--brand)", textDecoration: "none" }}>Hamısı →</Link>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {recentActions.map(a => {
                  const vt = verbTone(a.status);
                  return (
                    <Link key={a.id} href={`/operator/appointments/${a.id}`} className="db-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderTop: "1px solid #F4F7FB", textDecoration: "none", color: "inherit", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "#9DB0CC", fontWeight: 600, minWidth: 90 }}>{timeAgo(a.updatedAt ?? a.createdAt, now)} əvvəl</span>
                      <span style={{ background: vt.bg, color: vt.fg, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>{statusVerb(a.status)}</span>
                      <span style={{ flex: 1, minWidth: 150, fontSize: 13.5, fontWeight: 600, color: "var(--oxford)" }}>{a.patientName ?? "—"} <span style={{ color: "var(--oxford-60)", fontWeight: 500 }}>→ {a.psychologistName ?? "—"}</span></span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Komponentlər ───────────────────────────────────────────────────────── */

const CARD: React.CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8" };
const FIN: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderRadius: 10, padding: "11px 13px" };

function GhostLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return <Link href={href} className="db-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "#082F6D", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 15px", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>{icon}{children}</Link>;
}
function MonthStat({ value, label, color }: { value: ReactNode; label: string; color: string }) {
  return <div style={{ flex: 1, minWidth: 90 }}><div className="db-num" style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div><div style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600, marginTop: 2 }}>{label}</div></div>;
}
function Quick({ href, title, sub, icon }: { href: string; title: string; sub: string; icon: ReactNode }) {
  return (
    <Link href={href} className="db-row" style={{ display: "flex", flexDirection: "column", gap: 6, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 11, padding: 12, textDecoration: "none", color: "inherit" }}>
      <span style={{ color: "var(--brand)" }}>{icon}</span>
      <div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)" }}>{title}</div><div style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 600 }}>{sub}</div></div>
    </Link>
  );
}

const QUEUE_TONE = {
  danger: { border: "#DC2626", headBg: "#FFF5F5", headBorder: "#FBE2E2", fg: "#991B1B", chipBg: "#FEE2E2" },
  warn:   { border: "#F59E0B", headBg: "#FFFBEB", headBorder: "#FDECC8", fg: "#92400E", chipBg: "#FEF3C7" },
  brand:  { border: "#1051B7", headBg: "#F2F6FD", headBorder: "#E1E9F5", fg: "#082F6D", chipBg: "#E4ECFA" },
} as const;

function QueueBlock({ title, tone, count, icon, children, allHref = "/operator/appointments" }: { title: string; tone: keyof typeof QUEUE_TONE; count: number; icon: ReactNode; children: ReactNode; allHref?: string }) {
  const c = QUEUE_TONE[tone];
  return (
    <div style={{ ...CARD, borderLeft: `3px solid ${c.border}`, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "15px 18px", background: c.headBg, borderBottom: `1px solid ${c.headBorder}` }}>
        <span style={{ color: c.fg, display: "inline-flex" }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: c.fg }}>{title}</span>
        <span style={{ background: c.chipBg, color: c.fg, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{count}</span>
        <span style={{ flex: 1 }} />
        <Link href={allHref} style={{ fontSize: 12, fontWeight: 600, color: c.fg, textDecoration: "none" }}>Hamısı →</Link>
      </div>
      <div>{children}</div>
    </div>
  );
}

function QueueRow({ a, now, kind, severity }: { a: AppointmentDetail; now: Date; kind: "disputed" | "rejected" | "pending" | "reschedule" | "cancel"; severity?: "warn" | "warn-2" | "danger" }) {
  const timeColor = severity === "danger" ? "#991B1B" : severity === "warn-2" ? "#92400E" : kind === "disputed" ? "#991B1B" : kind === "rejected" || kind === "cancel" ? "#92400E" : "#52718F";
  const timeText = kind === "pending" ? `${timeAgo(a.createdAt, now)} gözləyir`
    : kind === "reschedule" ? `${timeAgo(a.rescheduleRequestedAt ?? a.updatedAt ?? a.createdAt, now)} əvvəl`
    : kind === "cancel" ? `${timeAgo(a.cancelRequestedAt ?? a.updatedAt ?? a.createdAt, now)} gözləyir`
    : `${timeAgo(a.updatedAt ?? a.createdAt, now)} əvvəl`;
  return (
    <Link href={`/operator/appointments/${a.id}`} className="db-row" style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 18px", textDecoration: "none", color: "inherit", borderTop: "1px solid #F4F7FB", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{a.patientName ?? "—"}</span>
          <span className="db-mono" style={{ fontSize: 11.5, fontWeight: 700, color: "#52718F" }}>#FNS-{String(a.id).padStart(4, "0")}</span>
          {kind === "disputed" && <Pill bg="#FEE2E2" fg="#991B1B">Mübahisə</Pill>}
          {kind === "rejected" && <Pill bg="#FEF3C7" fg="#92400E">Rədd</Pill>}
          {kind === "reschedule" && <Pill bg="#E4ECFA" fg="#082F6D">Vaxt dəyişikliyi</Pill>}
          {kind === "cancel" && <Pill bg="#FEF3C7" fg="#92400E">Ləğv tələbi</Pill>}
          {severity === "warn-2" && <Pill bg="#FEF3C7" fg="#92400E">24h+ gözləyir</Pill>}
          {severity === "danger" && <Pill bg="#FEE2E2" fg="#991B1B">48h+ gözləyir</Pill>}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>
          {kind === "disputed" && a.disputeReason && <span style={{ fontStyle: "italic" }}>«{a.disputeReason.slice(0, 60)}{a.disputeReason.length > 60 ? "…" : ""}»</span>}
          {kind === "rejected" && <>{a.requestedPsychologistName && <>İstənilən: {a.requestedPsychologistName}</>}{a.note && <> · <span style={{ fontStyle: "italic" }}>«{a.note.slice(0, 40)}…»</span></>}</>}
          {kind === "reschedule" && <>{a.psychologistName && <>{a.psychologistName} · </>}{a.rescheduleRequestNote ? <span style={{ fontStyle: "italic" }}>«{a.rescheduleRequestNote.slice(0, 50)}{a.rescheduleRequestNote.length > 50 ? "…" : ""}»</span> : "pasient vaxtı dəyişmək istəyir"}</>}
          {kind === "pending" && <>{a.requestedPsychologistName ? <>İstənilən: <strong>{a.requestedPsychologistName}</strong></> : "Psixoloq seçilməyib"}{a.note && <> · <span style={{ fontStyle: "italic" }}>«{a.note.slice(0, 40)}…»</span></>}</>}
          {kind === "cancel" && <>{a.psychologistName && <>{a.psychologistName} · </>}{a.cancelRequestReasonText ? <span style={{ fontStyle: "italic" }}>«{a.cancelRequestReasonText.slice(0, 60)}{a.cancelRequestReasonText.length > 60 ? "…" : ""}»</span> : "pasient ləğv tələb edib"}</>}
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: severity === "warn-2" || severity === "danger" ? 700 : 600, color: timeColor, flex: "none" }}>{timeText}</span>
    </Link>
  );
}

function Pill({ bg, fg, children }: { bg: string; fg: string; children: ReactNode }) {
  return <span style={{ background: bg, color: fg, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{children}</span>;
}

/* ─── Vahid inbox sətri (bütün müraciət növlərini eyni formatda göstərir) ──── */
type InboxKind = "lead" | "pending" | "reschedule" | "cancel" | "disputed" | "rejected" | "referral";
interface InboxItem { key: string; kind: InboxKind; href: string; name: string; sub: string; ts: string }

const INBOX_META: Record<InboxKind, { label: string; bg: string; fg: string }> = {
  lead:       { label: "Lead",             bg: "#DCFCE7", fg: "#166534" },
  pending:    { label: "Yeni randevu",     bg: "#E4ECFA", fg: "#082F6D" },
  reschedule: { label: "Vaxt dəyişikliyi", bg: "#E0E7FF", fg: "#3730A3" },
  cancel:     { label: "Ləğv tələbi",      bg: "#FEF3C7", fg: "#92400E" },
  disputed:   { label: "Mübahisə",         bg: "#FEE2E2", fg: "#991B1B" },
  rejected:   { label: "Rədd → təyin",     bg: "#FEF3C7", fg: "#92400E" },
  referral:   { label: "Yönləndirmə",      bg: "#F3E8FF", fg: "#6B21A8" },
};

function InboxRow({ item, now }: { item: InboxItem; now: Date }) {
  const m = INBOX_META[item.kind];
  return (
    <Link href={item.href} className="db-row" style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 18px", textDecoration: "none", color: "inherit", borderTop: "1px solid #F4F7FB", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{item.name}</span>
          <Pill bg={m.bg} fg={m.fg}>{m.label}</Pill>
        </div>
        {item.sub && <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>{item.sub}</div>}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#52718F", flex: "none" }}>{item.ts ? `${timeAgo(item.ts, now)} əvvəl` : ""}</span>
    </Link>
  );
}
function Overflow({ n }: { n: number }) {
  return <Link href="/operator/appointments" style={{ display: "block", textAlign: "center", padding: 11, fontSize: 12.5, fontWeight: 600, color: "var(--brand)", textDecoration: "none", borderTop: "1px solid #F4F7FB" }}>+{n} daha →</Link>;
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
    case "ASSIGNED": return { bg: "#E4ECFA", fg: "#082F6D" };
    case "CONFIRMED": return { bg: "#D1FAE5", fg: "#065F46" };
    case "REJECTED": case "AWAITING_CONFIRMATION": return { bg: "#FEF3C7", fg: "#92400E" };
    case "DISPUTED": case "CANCELLED": return { bg: "#FEE2E2", fg: "#991B1B" };
    default: return { bg: "#F3F4F6", fg: "#374151" };
  }
}

function Ico({ d, w = 16, sw = 1.9 }: { d: string | string[]; w?: number; sw?: number }) {
  const paths = Array.isArray(d) ? d : [d];
  return <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{paths.map((p, i) => <path key={i} d={p} />)}</svg>;
}
const I_CLOCK = "M12 7v5l3 2 M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z";
const I_ALERT = ["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4M12 17h.01"];
const I_CHAT = "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z";
const I_PULSE = "M22 12h-4l-3 9L9 3l-3 9H2";
const I_REFRESH = ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5"];
const I_CHECK = ["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"];
const I_WATCH = ["M12 14v-3", "M12 22a8 8 0 1 1 0-16 8 8 0 0 1 0 16z", "M9 2h6"];
const I_LEAF = ["M11 20A7 7 0 0 1 4 13c0-4 3-9 11-12 0 0 5 6 5 12a7 7 0 0 1-7 7c-2 0-4-1-5-3", "M2 22c4-1 7-4 9-8"];
const I_PLUS = "M12 5v14M5 12h14";
const I_BAN = ["M18.36 6.64a9 9 0 1 1-12.73 0", "M18.36 17.36A9 9 0 0 1 5.64 6.64"];
const I_CAL = ["M3 4h18v18H3z", "M16 2v4M8 2v4M3 10h18"];
const I_CHART = ["M3 3v18h18", "M18 9l-5 5-3-3-4 4"];
const I_INBOX = ["M22 12h-6l-2 3h-4l-2-3H2", "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"];
const I_USERS = ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M23 21v-2a4 4 0 0 0-3-3.87"];
const I_CARD = ["M2 5h20v14H2z", "M2 10h20"];

const CSS = `
.db-num{font-variant-numeric:tabular-nums}
.db-mono{font-family:'JetBrains Mono','Roboto Mono',ui-monospace,monospace}
.db-main{display:grid;grid-template-columns:1.6fr 1fr;gap:18px}
@media(max-width:840px){.db-main{grid-template-columns:1fr}}
.db-kpi{transition:box-shadow .15s}
.db-kpi:hover{box-shadow:0 6px 18px rgba(8,47,109,.1)}
.db-row{transition:background .14s}
.db-row:hover{background:#F8FAFD}
.db-ghost:hover{border-color:#1051B7;color:#1051B7}
`;
