"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  patientApi,
  getPsychologists,
  type AppointmentDetail,
  type PatientPackageItem,
  type RescheduleProposal,
  type SessionFeedback,
} from "@/lib/api";
import { googleCalendarUrl } from "@/lib/calendar";
import { ordinalFor } from "@/lib/ordinal";
import { appUrl } from "@/lib/appUrl";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { azFormatTime, azFormatDate, azOrdinal, hoursSince } from "@/lib/datetime";
import SessionFeedbackModal from "@/components/SessionFeedbackModal";
import PageHeader from "@/components/PageHeader";
import { formatAzn } from "@/lib/money";
import RescheduleProposalModal from "@/components/RescheduleProposalModal";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import JoinSessionButton from "@/components/JoinSessionButton";
import { toast } from "@/components/Toast";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { Locale, MessageKey } from "@/lib/i18n/messages";
import {
  STATUS, PKG_STATUS, PA_STYLE,
  PackageBadge, IntroBadge, IconClock, IconX, Section, Empty,
  initialsOf, pad2, cleanOperatorNote,
} from "./shared";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

function fmtTime(d: Date) { return azFormatTime(d); }
// AZ-zone year/month/day key for a Date — uses Intl with Asia/Baku.
function azDayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit" });
}
function isSameDay(a: Date, b: Date) {
  return azDayKey(a) === azDayKey(b);
}
function relativeDayLabel(t: Translate, d: Date, now: Date) {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (isSameDay(d, now)) return t("common.today");
  if (isSameDay(d, tomorrow)) return t("common.tomorrow");
  // Pull weekday/day/month components in AZ tz
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Baku", weekday: "short", day: "2-digit", month: "numeric" })
    .formatToParts(d);
  const weekdayShort = parts.find(p => p.type === "weekday")?.value ?? "";
  const dayNum = Number(parts.find(p => p.type === "day")?.value ?? 0);
  const monthNum = Number(parts.find(p => p.type === "month")?.value ?? 1);
  // US qısa gün adı → `days.d0..d6` (Date.getDay() sırası: Bazar = 0).
  const dayIndex: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const idx = dayIndex[weekdayShort];
  const weekday = idx === undefined ? weekdayShort : t(`days.d${idx}` as MessageKey);
  return `${weekday}, ${pad2(dayNum)} ${t(`months.m${monthNum}` as MessageKey)}`;
}

interface CountdownInfo {
  text: string;
  expired: boolean;
  urgent: boolean;
}
function timeUntil(t: Translate, target: Date, now: Date): CountdownInfo {
  const ms = target.getTime() - now.getTime();
  if (ms < 0) return { expired: true, urgent: false, text: t("patAppt.startedNow") };
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return { expired: false, urgent: minutes <= 15, text: t("patAppt.minLeft", { n: minutes }) };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remMin = minutes % 60;
    return {
      expired: false, urgent: false,
      text: remMin > 0 ? t("patAppt.hourMinLeft", { h: hours, m: remMin }) : t("patAppt.hourLeft", { h: hours }),
    };
  }
  const days = Math.floor(hours / 24);
  return { expired: false, urgent: false, text: t("patAppt.daysLeft", { n: days }) };
}

const ACTIVE_STATUSES = new Set(["ASSIGNED", "CONFIRMED", "PENDING", "REJECTED", "CANCEL_REQUESTED"]);

/** Seans hələ bitməyibsə (yaxınlaşan/davam edən) true. Bitmə vaxtı (endAt) keçibsə
 *  seans BİTİB — qısa (15 dəq INTRO) seanslar da "startAt > now − 30dəq" proxy-si
 *  ilə səhvən "növbəti" görünürdü; endAt ilə düzgün "keçmiş" sayılır. */
function notEndedYet(a: { startAt?: string | null; endAt?: string | null }, nowMs: number): boolean {
  if (a.endAt) return new Date(a.endAt).getTime() > nowMs;
  return !!a.startAt && new Date(a.startAt).getTime() > nowMs - 30 * 60_000;
}

type StatusFilter = "all" | "confirmed" | "pending";
type TabKey = "sessions" | "packages";

// Avatar tinti — psixoloq id-sinə görə sabit (determinist).
const PA_AVATAR_TINTS: { bg: string; color: string }[] = [
  { bg: "#E0EBFA", color: "#1E3A8A" },
  { bg: "#D1FAE5", color: "#065F46" },
  { bg: "#FEF3C7", color: "#92400E" },
  { bg: "#EDE9FE", color: "#5B21B6" },
  { bg: "#FCE7F3", color: "#9D174D" },
  { bg: "#E0F2FE", color: "#075985" },
];
function avatarTint(id?: number | null): { bg: string; color: string } {
  if (!id) return PA_AVATAR_TINTS[0];
  return PA_AVATAR_TINTS[id % PA_AVATAR_TINTS.length];
}

export default function PatientAppointmentsPage() {
  const { t, locale } = useT();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [packages, setPackages] = useState<PatientPackageItem[]>([]);
  // Kartlarda psixoloq şəkli: public kataloqdan id → photoUrl xəritəsi
  const [psyPhotos, setPsyPhotos] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  // Tab: paket detalından geri dönüş ?tab=paketler ilə düz taba düşsün.
  const [tab, setTab] = useState<TabKey>(searchParams.get("tab") === "paketler" ? "packages" : "sessions");
  // "Aç" düyməsi — seansın ətraflı məlumat pəncərəsi
  const [detailFor, setDetailFor] = useState<AppointmentDetail | null>(null);
  // GAP-03: new no-penalty flow — patient proposes slots, psychologist decides
  const [reschedRequestFor, setReschedRequestFor] = useState<AppointmentDetail | null>(null);
  const [disputeFor, setDisputeFor] = useState<AppointmentDetail | null>(null);
  const [cancelFor, setCancelFor] = useState<AppointmentDetail | null>(null);
  const [proposals, setProposals] = useState<RescheduleProposal[]>([]);
  const [proposalFor, setProposalFor] = useState<RescheduleProposal | null>(null);
  const [psyFilter, setPsyFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // "Necə keçdi?" — qiymətləndirilməmiş, yaxın tamamlanmış seans üçün prompt.
  const [pendingRate, setPendingRate] = useState<AppointmentDetail | null>(null);
  const [ratedIds, setRatedIds] = useState<Set<number>>(new Set());
  const [feedbackFor, setFeedbackFor] = useState<AppointmentDetail | null>(null);
  const [existingFeedback, setExistingFeedback] = useState<SessionFeedback | null>(null);

  const switchTab = (next: TabKey) => {
    setTab(next);
    window.history.replaceState(null, "", next === "packages" ? "?tab=paketler" : window.location.pathname);
  };

  // Tick every minute for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = () => {
    setLoading(true);
    Promise.all([
      patientApi.myAppointments(),
      patientApi.pendingRescheduleProposals().catch(() => [] as RescheduleProposal[]),
      patientApi.myPackages().catch(() => [] as PatientPackageItem[]),
      getPsychologists().catch(() => []),
    ])
      .then(([appts, props, pkgs, psys]) => {
        setItems(appts);
        setPackages(pkgs);
        const photos: Record<number, string> = {};
        for (const p of psys) if (p.photoUrl) photos[p.id] = p.photoUrl;
        setPsyPhotos(photos);
        // Pasiyent artıq PSİXOLOQ-təşəbbüslü vaxt təklifini özü qəbul/rədd ETMİR —
        // psixoloq Cədvəldə yeni vaxt təklif edəndə qərarı OPERATOR yekunlaşdırır
        // (pasiyent yalnız məlumatlandırılır). Yalnız OPERATOR-təşəbbüslü təkliflər
        // (B4-2 swap vasitəçiliyi — operatorun qəsdən pasiyentə təklifi) pasiyentin
        // qərarına qalır; PATIENT-öz sorğuları psixoloqu gözləyir.
        setProposals(props.filter(p => p.initiator === "OPERATOR"));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Yaxınlarda tamamlanmış (24 saat pəncərəsi) və hələ qiymətləndirilməmiş seansı tap —
  // "Necə keçdi?" prompt-u üçün. Ən sonuncudan başlayaraq feedback varlığını yoxlayır.
  useEffect(() => {
    const candidates = items
      .filter(a => a.status === "COMPLETED")
      .filter(a => { const anchor = a.endAt ?? a.startAt; return !!anchor && hoursSince(anchor) <= 24; })
      .filter(a => !ratedIds.has(a.id))
      .sort((a, b) => new Date(b.startAt ?? b.endAt ?? 0).getTime() - new Date(a.startAt ?? a.endAt ?? 0).getTime());
    if (candidates.length === 0) { setPendingRate(null); return; }
    let cancelled = false;
    (async () => {
      for (const a of candidates) {
        try {
          const fb = await patientApi.getSessionFeedback(a.id);
          if (cancelled) return;
          if (fb) { setRatedIds(prev => new Set(prev).add(a.id)); continue; }
          setPendingRate(a); return;
        } catch { /* yoxlanıla bilmədi — keç */ }
      }
      if (!cancelled) setPendingRate(null);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const openRate = async (a: AppointmentDetail) => {
    setExistingFeedback(null);
    setFeedbackFor(a);
    try { setExistingFeedback(await patientApi.getSessionFeedback(a.id)); } catch { /* təzə form */ }
  };

  useEffect(() => {
    return subscribeNotifications((n) => {
      if (typeof n.type === "string"
        && (n.type.startsWith("APPOINTMENT_") || n.type.startsWith("RESCHEDULE_"))) load();
    });

  }, []);

  // Paketin hələ CANLI (gələcək/gözləyən) seansı varmı? Backend artıq EXHAUSTED
  // statusunu yalnız BÜTÜN seanslar KEÇİRİLƏNDƏ (COMPLETED) verir — remaining=0
  // (yəni hamısı rezerv olunub) artıq paketi bitmiş saymır. Bu yoxlama yenə də
  // müdafiə xətti kimi qalır: canlı seansı olan paket "bitmiş" göstərilməsin.
  const pkgHasLiveSessions = useMemo(() => {
    const live = new Set<number>();
    for (const a of items) {
      if (a.patientPackageId == null) continue;
      const terminal = a.status === "COMPLETED" || a.status === "CANCELLED" || a.status === "REJECTED";
      if (!terminal) live.add(a.patientPackageId);
    }
    return live;
  }, [items]);

  const isOngoingPackage = (p: PatientPackageItem) =>
    p.status === "ACTIVE" || pkgHasLiveSessions.has(p.id);

  // "Paketlərim" — aktiv (seans qalan VƏ YA canlı seansı olan) paketlər balans kartı kimi göstərilir.
  const activePackages = useMemo(
    () => packages.filter(isOngoingPackage),
    [packages, pkgHasLiveSessions],
  );

  // Bitmiş/müddəti keçmiş/ləğv edilmiş paketlər — yalnız canlı seansı qalmayanlar.
  const pastPackages = useMemo(
    () => packages.filter(p => !isOngoingPackage(p)),
    [packages, pkgHasLiveSessions],
  );

  /** Psychologist filter chips: every psy from any active appointment, sorted by upcoming count. */
  const psyChips = useMemo(() => {
    const map = new Map<number, { id: number; name: string; count: number }>();
    for (const a of items) {
      if (!a.psychologistId || !a.psychologistName) continue;
      if (!ACTIVE_STATUSES.has(a.status) && a.status !== "AWAITING_CONFIRMATION" && a.status !== "DISPUTED") continue;
      const entry = map.get(a.psychologistId) ?? { id: a.psychologistId, name: a.psychologistName, count: 0 };
      entry.count += 1;
      map.set(a.psychologistId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [items]);

  const matchesFilters = (a: AppointmentDetail) => {
    if (psyFilter != null && a.psychologistId !== psyFilter) return false;
    if (statusFilter === "confirmed" && a.status !== "CONFIRMED") return false;
    if (statusFilter === "pending"
      && a.status !== "ASSIGNED"
      && a.status !== "PENDING"
      && a.status !== "AWAITING_CONFIRMATION"
      && a.status !== "CANCEL_REQUESTED"
      && a.status !== "REJECTED") return false;
    return true;
  };

  const next = useMemo(() => {
    return items
      .filter(a => notEndedYet(a, now.getTime()))
      .filter(a => a.status === "ASSIGNED" || a.status === "CONFIRMED" || a.status === "CANCEL_REQUESTED")
      .filter(matchesFilters)
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, now, psyFilter, statusFilter]);

  /** All upcoming, filtered, xronoloji — bir grid-də. Ayrıca "Operator təsdiqi
   *  gözləyir" bölməsi yoxdur: PENDING/REJECTED müraciətlər də bu sıraya vaxtına
   *  görə daxil olur. Paket seansları da adi seans kimi görünür («Paket» nişanı). */
  const agendaList = useMemo(() => {
    return items
      .filter(a => {
        // Gözləyən müraciətlər vaxt filtrindən keçmir — operator baxana qədər görünür.
        if (a.status === "PENDING" || a.status === "REJECTED") return true;
        if (a.status !== "ASSIGNED" && a.status !== "CONFIRMED" && a.status !== "CANCEL_REQUESTED") return false;
        return notEndedYet(a, now.getTime());
      })
      .filter(matchesFilters)
      .sort((x, y) => {
        const dx = new Date(x.startAt ?? x.requestedStartAt ?? x.createdAt).getTime();
        const dy = new Date(y.startAt ?? y.requestedStartAt ?? y.createdAt).getTime();
        return dx - dy;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, now, psyFilter, statusFilter]);

  const agendaTotal = agendaList.length;

  const action = async (id: number, fn: () => Promise<AppointmentDetail>) => {
    setBusyId(id);
    try {
      const updated = await fn();
      setItems(prev => prev.map(a => a.id === id ? updated : a));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const cancel = (a: AppointmentDetail) => setCancelFor(a);

  // Simplified reschedule: the patient only sends a "change my time" request —
  // an operator reschedules directly. No slot picking, no penalty branching.
  const openReschedule = (a: AppointmentDetail) => setReschedRequestFor(a);

  // Bu randevunun pasiyentin həmin psixoloqla keçirdiyi seanslar arasındakı
  // xronoloji sıra nömrəsi (1-dən). Yalnız pasiyentin ÖZ randevuları (myAppointments)
  // üzərindən hesablanır — psixoloqun digər müştərilərlə seansları daxil deyil.
  // Ləğv/rədd olunmuş və hələ təyin olunmamış (PENDING) müraciətlər seans sayılmır.
  const SESSION_RANK_EXCLUDE = new Set(["CANCELLED", "REJECTED", "PENDING"]);
  const sessionOrdinalFor = (appt: AppointmentDetail): number | null => {
    if (!appt.psychologistId) return null;
    const ordered = items
      .filter(a => a.psychologistId === appt.psychologistId)
      .filter(a => a.startAt && !SESSION_RANK_EXCLUDE.has(a.status))
      .sort((x, y) => new Date(x.startAt!).getTime() - new Date(y.startAt!).getTime());
    const idx = ordered.findIndex(a => a.id === appt.id);
    return idx >= 0 ? idx + 1 : null;
  };

  return (
    <div className="psy-appt-page">
      <style>{PA_STYLE}</style>
      <PageHeader
        title={t("appt.pageTitle")}
        subtitle={t("appt.pageSub")}
        actions={
          <>
            <Link href="/patient/appointments/history" className="pnl-btn pnl-btn--ghost">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>
              {t("patAppt.historyCta")}
            </Link>
            <Link href="/patient/psychologists" className="pnl-btn">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              {t("appt.newCta")}
            </Link>
          </>
        }
      />

      {pendingRate && (
        <div className="pnl-card" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="pnl-card__title">{t("patAppt.ratePromptTitle")}</div>
            <div className="pnl-row__meta">
              {pendingRate.psychologistName ?? t("pat.psyFallback")}, {azFormatDate(pendingRate.startAt ?? pendingRate.endAt ?? "")}
            </div>
          </div>
          <button type="button" onClick={() => openRate(pendingRate)} className="pnl-btn" style={{ flex: "none" }}>
            {t("patAppt.rateCta")}
          </button>
        </div>
      )}

      {feedbackFor && (
        <SessionFeedbackModal
          appointment={feedbackFor}
          existing={existingFeedback}
          onClose={() => { setFeedbackFor(null); setExistingFeedback(null); }}
          onSubmitted={() => {
            setRatedIds(prev => new Set(prev).add(feedbackFor.id));
            if (pendingRate?.id === feedbackFor.id) setPendingRate(null);
            setFeedbackFor(null);
            setExistingFeedback(null);
          }}
        />
      )}

      {proposals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {proposals.map(p => (
            <div key={p.id} className="pnl-card" style={{ flexDirection: "row", alignItems: "center", gap: 13, background: "#FFFBEB", borderColor: "#FDE68A" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pnl-card__title" style={{ color: "#92400E" }}>{t("appt.proposalBannerTitle")}</div>
                <div style={{ fontSize: 12.5, color: "#92400E", opacity: .9, marginTop: 2, lineHeight: 1.55 }}>
                  {t("appt.proposalBannerBody", { psy: p.psychologistName ?? t("pat.yourPsy"), n: p.options.length })}
                </div>
              </div>
              <button onClick={() => setProposalFor(p)} className="pnl-btn pnl-btn--ghost" style={{ flex: "none" }}>
                {t("appt.proposalBannerAction")}
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>
          {t("common.loading")}
        </div>
      ) : items.length === 0 && packages.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: "3rem 2rem", textAlign: "center", border: "1px solid var(--oxford-10)" }}>
          <h3 style={{ fontWeight: 700, color: "var(--oxford)", marginBottom: 6, fontSize: 17 }}>{t("appt.emptyAll")}</h3>
          <p style={{ color: "var(--oxford-60)", fontSize: 13, marginBottom: 18 }}>
            {t("patAppt.emptyBody")}
          </p>
          <Link
            href="/patient/psychologists"
            style={{ background: "var(--brand)", color: "#fff", padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none", display: "inline-block" }}>
            {t("home.heroCta")}
          </Link>
        </div>
      ) : (
        <>
          <NextSessionHero
            appt={next}
            now={now}
            sessionNumber={next ? sessionOrdinalFor(next) : null}
            photoUrl={next?.psychologistId != null ? psyPhotos[next.psychologistId] ?? null : null}
            busyId={busyId}
            onConfirm={(a) => action(a.id, () => patientApi.confirmSession(a.id))}
            onDispute={(a) => setDisputeFor(a)}
            onReschedule={(a) => openReschedule(a)}
            onCancel={(a) => cancel(a)}
          />

          {/* Seanslar / Paketlər tab seçimi */}
          <div role="tablist" style={{ display: "inline-flex", gap: 4, background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 12, padding: 4 }}>
            {([
              ["sessions", t("patAppt.tabSessions"), agendaTotal],
              ["packages", t("patAppt.tabPackages"), activePackages.length],
            ] as [TabKey, string, number][]).map(([key, label, count]) => {
              const active = tab === key;
              return (
                <button key={key} type="button" role="tab" aria-selected={active} onClick={() => switchTab(key)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, background: active ? "var(--brand)" : "transparent", color: active ? "#fff" : "var(--oxford)", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                  {label}
                  <span style={{ color: active ? "rgba(255,255,255,.75)" : "var(--oxford-60)", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{count}</span>
                </button>
              );
            })}
          </div>

          {tab === "sessions" && (
            <>
              {(psyChips.length > 1 || statusFilter !== "all" || psyFilter != null) && (
                <div style={{ marginTop: 18 }}>
                  <FilterBar
                    psyChips={psyChips}
                    psyFilter={psyFilter}
                    statusFilter={statusFilter}
                    onPsy={setPsyFilter}
                    onStatus={setStatusFilter}
                  />
                </div>
              )}

              <Section title={t("patAppt.sectionUpcoming")} count={agendaTotal} icon="" collapsible={false}>
                {agendaList.length === 0 ? (
                  <Empty msg={
                    psyFilter != null || statusFilter !== "all"
                      ? t("patAppt.emptyFiltered")
                      : t("patAppt.emptyUpcoming")
                  } />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(330px, 100%), 1fr))", gap: 12 }}>
                    {agendaList.map(a => (
                      <AgendaRow
                        key={a.id}
                        a={a}
                        isNext={next?.id === a.id}
                        now={now}
                        sessionNumber={sessionOrdinalFor(a)}
                        photoUrl={(a.psychologistId ?? a.requestedPsychologistId) != null ? psyPhotos[(a.psychologistId ?? a.requestedPsychologistId)!] ?? null : null}
                        onOpen={() => setDetailFor(a)}
                        onReschedule={() => openReschedule(a)}
                        onCancel={() => cancel(a)}
                      />
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}

          {tab === "packages" && (
            <>
              {activePackages.length === 0 ? (
                <div style={{ marginTop: 22 }}>
                  <Empty msg={t("patAppt.emptyActivePkg")} />
                </div>
              ) : (
                <Section title={t("patAppt.sectionActivePkg")} count={activePackages.length} icon="" collapsible={false}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))",
                    gap: 16,
                  }}>
                    {activePackages.map(p => (
                      <PackageProgramCard
                        key={`pkg-${p.id}`}
                        pkg={p}
                        sessions={items.filter(a => a.patientPackageId === p.id)}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {pastPackages.length > 0 && (
                <Section title={t("patAppt.sectionPastPkg")} count={pastPackages.length} icon="" card defaultCollapsed>
                  <div style={{ padding: "0 8px 10px" }}>
                    {pastPackages.map(p => (
                      <PastPackageRow key={`past-${p.id}`} pkg={p} />
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </>
      )}

      {detailFor && (
        <SessionDetailModal
          a={detailFor}
          photoUrl={detailFor.psychologistId != null ? psyPhotos[detailFor.psychologistId] ?? null : null}
          sessionNumber={sessionOrdinalFor(detailFor)}
          now={now}
          onClose={() => setDetailFor(null)}
          onReschedule={() => { openReschedule(detailFor); setDetailFor(null); }}
          onCancel={() => { cancel(detailFor); setDetailFor(null); }}
        />
      )}
      {reschedRequestFor && (
        <RescheduleRequestNoteModal
          appointment={reschedRequestFor}
          onClose={() => setReschedRequestFor(null)}
          onDone={() => { setReschedRequestFor(null); load(); }}
        />
      )}
      {disputeFor && (
        <DisputeModal
          appointment={disputeFor}
          onClose={() => setDisputeFor(null)}
          onDone={(updated) => {
            setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
            setDisputeFor(null);
          }}
        />
      )}
      {cancelFor && (
        <CancelRequestNoteModal
          appointment={cancelFor}
          onClose={() => setCancelFor(null)}
          onDone={(updated) => {
            setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
            setCancelFor(null);
          }}
        />
      )}
      {proposalFor && (
        <RescheduleProposalModal
          proposal={proposalFor}
          onClose={() => setProposalFor(null)}
          onResolved={() => { setProposalFor(null); load(); }}
        />
      )}
    </div>
  );
}

/* ─── Hero — next session ─────────────────────────────────────────────────── */

function NextSessionHero({
  appt, now, sessionNumber, photoUrl, busyId, onConfirm, onDispute, onReschedule, onCancel,
}: {
  appt: AppointmentDetail | null;
  now: Date;
  sessionNumber: number | null;
  photoUrl: string | null;
  busyId: number | null;
  onConfirm: (a: AppointmentDetail) => void;
  onDispute: (a: AppointmentDetail) => void;
  onReschedule: (a: AppointmentDetail) => void;
  onCancel: (a: AppointmentDetail) => void;
}) {
  const { t, locale } = useT();
  // Yaxınlaşan seans yoxdursa burada heç nə göstərmirik — aşağıdakı "Yaxınlaşan"
  // bölməsi onsuz da boş-halı göstərir (təkrar olmasın deyə).
  if (!appt || !appt.startAt) return null;

  const start = new Date(appt.startAt);
  const tu = timeUntil(t, start, now);
  // Option B: sessions auto-complete — patient never confirms/disputes a session.
  const showConfirm = false;
  const alreadyConfirmed = !!appt.patientConfirmedAt;
  const cancelRequested = appt.status === "CANCEL_REQUESTED";
  // Vaxt dəyişikliyi istəyi göndərilib, operator hələ baxmayıb — pasiyentə görünən
  // izi olmasa istəyin çatdığı bilinmir və təkrar-təkrar göndərilə bilər.
  const rescheduleRequested = !!appt.rescheduleRequestedAt
    && (appt.status === "CONFIRMED" || appt.status === "ASSIGNED");
  const urgent = tu.urgent || tu.expired;

  // "Qoşul" is the primary action here (JoinSessionButton variant="primary" — solid brand
  // button), everything else is a secondary ghost action at this same comfortable size.
  const heroGhostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#fff", color: "var(--oxford)", border: "1px solid var(--brand-200)", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" };
  const heroDangerBtn: React.CSSProperties = { ...heroGhostBtn, color: "#991B1B", border: "1px solid #F3D6D6" };

  const endD = appt.endAt ? new Date(appt.endAt) : null;

  return (
    <div style={{
      background: "#fff", border: "1px solid #EDF1F8", borderRadius: 16,
      padding: 24, marginBottom: 16,
    }}>
      {/* Basliq: ikon + ad, sagda geri sayim */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{
            width: 34, height: 34, borderRadius: 9, flex: "none",
            background: "#EAF1FE", color: "var(--brand)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </span>
          <span style={{ fontSize: 19, fontWeight: 700, color: "#0B1A35" }}>{t("patAppt.heroTitle")}</span>
        </span>

        {/* Badge/kapsul YOX — sadəcə ikon + mətn (qayda referansdan üstündür). */}
        <span className={tu.expired ? "pa-live" : undefined} style={{
          display: "inline-flex", alignItems: "center", gap: 7, flex: "none",
          color: urgent ? "#DC2626" : "#15803D",
          fontSize: 13.5, fontWeight: 600,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          {tu.text}
        </span>
      </div>

      <div style={{ height: 1, background: "#EDF1F8", margin: "18px 0" }} />

      {/* Govde: solda psixoloq, sagda vaxt paneli */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flex: "1 1 320px", minWidth: 0 }}>
          <span style={{
            width: 72, height: 72, borderRadius: "50%", flex: "none", overflow: "hidden",
            background: "var(--brand-50)", color: "var(--brand-700)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700,
          }}>
            {photoUrl
              ? <img src={photoUrl} alt={appt.psychologistName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initialsOf(appt.psychologistName)}
          </span>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 700, color: "#0B1A35", marginBottom: 10 }}>
              {appt.psychologistName ?? t("patAppt.heroPsyPending")}
            </div>
            {(sessionNumber || appt.patientPackageId != null) && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                background: "#F6F8FC", border: "1px solid #EDF1F8", borderRadius: 10,
                padding: "9px 14px",
              }}>
                {sessionNumber && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#31425C" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                    {t("appt.sessionNumber", { ordinal: ordinalFor(locale, sessionNumber) })}
                  </span>
                )}
                {sessionNumber && appt.patientPackageId != null && (
                  <span aria-hidden style={{ width: 1, height: 16, background: "#DDE5F0" }} />
                )}
                {appt.patientPackageId != null && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#31425C" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                    {appt.packageName ? t("patAppt.pkgNamed", { name: appt.packageName }) : t("patAppt.pkgPlain")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{
          flex: "1 1 380px", minWidth: 0,
          background: "#EEF4FE", border: "1px solid #DCE8FB", borderRadius: 14,
          padding: "16px 22px",
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--brand)", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            {relativeDayLabel(t, start, now)}
          </span>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap",
            fontSize: 40, fontWeight: 700, color: "#0B1A35", lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
          }}>
            <span>{fmtTime(start)}</span>
            {endD && <><span style={{ color: "#9FB3D0", fontWeight: 400 }}>&mdash;</span><span>{fmtTime(endD)}</span></>}
          </div>
        </div>
      </div>

      {appt.note && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          background: "#F1F5FE", border: "1px solid #E1E9FA", borderRadius: 12,
          padding: "14px 16px", marginTop: 16,
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: "50%", flex: "none",
            background: "var(--brand)", color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", marginBottom: 3 }}>{t("patAppt.noteLabel")}</div>
            <div style={{ fontSize: 14.5, color: "#0B1A35", lineHeight: 1.5 }}>
              &laquo;{appt.note.slice(0, 160)}{appt.note.length > 160 ? "…" : ""}&raquo;
            </div>
          </div>
        </div>
      )}

      {cleanOperatorNote(appt.operatorNote) && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12,
          padding: "14px 16px", marginTop: 12,
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: "50%", flex: "none",
            background: "#B45309", color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6M9 16h4M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" /></svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E", marginBottom: 3 }}>{t("patAppt.operatorNoteLabel")}</div>
            <div style={{ fontSize: 14.5, color: "#7C4A0B", lineHeight: 1.5 }}>
              &laquo;{cleanOperatorNote(appt.operatorNote).slice(0, 160)}{cleanOperatorNote(appt.operatorNote).length > 160 ? "…" : ""}&raquo;
            </div>
          </div>
        </div>
      )}

      {cancelRequested ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--oxford-60)", fontWeight: 600, marginTop: 18 }}>
          <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
          {t("patAppt.cancelPending")}
        </div>
      ) : !tu.expired && (
        <>
          {rescheduleRequested && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--oxford-60)", fontWeight: 600, marginTop: 18 }}>
              <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
              {t("patAppt.reschedPending")}
            </div>
          )}
          <div className="pa-hero-actions" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
            <AddToCalendarMenu appointment={appt} />
            {!rescheduleRequested && (
              <button onClick={() => onReschedule(appt)} style={heroGhostBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                {t("staff.cardReschedule")}
              </button>
            )}
            <JoinSessionButton appointment={appt} variant="primary" />
            <button onClick={() => onCancel(appt)} style={heroDangerBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
              {t("staff.cardCancel")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Package card — xülasə kartı; klik → paket detal səhifəsi ──────────────
   Paketin seansları burada idarə olunmur — onlar «Seanslar» tabında adi seans
   kimi, tam siyahı isə paket detal səhifəsində görünür. */

function PackageProgramCard({
  pkg, sessions,
}: {
  pkg: PatientPackageItem;
  sessions: AppointmentDetail[];
}) {
  const { t } = useT();
  // Balans: remaining = hələ planlanmamış seanslar (backend hesabıdır).
  // Tamamlanan/planlanan saylar pasiyentin randevu siyahısından çıxarılır.
  const completed = sessions.filter(a => a.status === "COMPLETED").length;
  const planned = sessions.filter(a => a.status !== "COMPLETED" && a.status !== "CANCELLED").length;
  const completedPct = pkg.total > 0 ? (completed / pkg.total) * 100 : 0;
  const plannedPct = pkg.total > 0 ? (planned / pkg.total) * 100 : 0;

  return (
    <Link href={`/patient/appointments/packages/${pkg.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--oxford-10)", padding: 16, display: "flex", flexDirection: "column", height: "100%", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--oxford-60)", fontSize: 12.5, fontWeight: 600 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
          </svg>
          {t("patAppt.pkgBadge")}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}><span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "#16A34A" }} /><span style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>{t("pkg.active")}</span></span>
      </div>

      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--oxford)", marginBottom: 4 }}>{pkg.packageName}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500, marginBottom: 18 }}>
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--brand-700)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
          {initialsOf(pkg.psychologistName)}
        </span>
        {pkg.psychologistName}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>
            {/* "qalıb" yazmırıq: pkg.remaining planlaşdırılmamış rezervdir, aşağıdakı ayırmada göstərilir. */}
            {t("patAppt.pkgProgressLine", { total: pkg.total, done: completed })}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)" }}>{Math.round(completedPct)}%</span>
        </div>
        <div style={{ display: "flex", height: 9, background: "var(--brand-100)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${completedPct}%`, height: "100%", background: "var(--brand)" }} />
          <div style={{ width: `${plannedPct}%`, height: "100%", background: "#9DBCEB" }} />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "var(--oxford-60)", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1051B7", flex: "none" }} />{t("patAppt.pkgLegendDone", { n: completed })}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9DBCEB", flex: "none" }} />{t("patAppt.pkgLegendPlanned", { n: planned })}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand-100)", flex: "none" }} />{t("patAppt.pkgLegendUnplanned", { n: pkg.remaining })}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 130, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 3 }}>{t("patAppt.pkgPaid")}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{formatAzn(pkg.pricePaid)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 130, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 3 }}>{t("patAppt.pkgPurchased")}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{azFormatDate(pkg.purchasedAt)}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto", paddingTop: 4, color: "var(--brand)", fontSize: 13.5, fontWeight: 700 }}>
        {pkg.remaining > 0 ? t("patAppt.pkgViewAndPlan") : t("patAppt.pkgView")}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </div>
    </div>
    </Link>
  );
}

/* ─── Əvvəlki paket sətri — klik → paket detal səhifəsi ──────────────────── */

function PastPackageRow({ pkg }: { pkg: PatientPackageItem }) {
  const { t } = useT();
  const st = PKG_STATUS[pkg.status] ?? PKG_STATUS.EXHAUSTED;
  // İstifadə = FAKTİKİ keçirilmiş seans (pkg.completed), rezerv fərqi deyil.
  const used = pkg.completed;
  return (
    <Link href={`/patient/appointments/packages/${pkg.id}`} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderTop: "1px solid #F0F4FA", padding: "13px 12px", textDecoration: "none", color: "inherit" }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 100 }}>{azFormatDate(pkg.purchasedAt)}</span>
      <div style={{ flex: 1, minWidth: 170 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{pkg.packageName}</div>
        <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 2 }}>{pkg.psychologistName}</div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford-60)" }}>{t("patAppt.pkgSessionsUsed", { used, total: pkg.total })}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)" }}>{formatAzn(pkg.pricePaid)}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}><span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: st.color }} /><span style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>{t(st.labelKey)}</span></span>
    </Link>
  );
}

/* ─── Filter bar ─────────────────────────────────────────────────────────── */

function FilterBar({
  psyChips, psyFilter, statusFilter, onPsy, onStatus,
}: {
  psyChips: { id: number; name: string; count: number }[];
  psyFilter: number | null;
  statusFilter: StatusFilter;
  onPsy: (id: number | null) => void;
  onStatus: (s: StatusFilter) => void;
}) {
  const { t } = useT();
  const totalUpcoming = psyChips.reduce((n, c) => n + c.count, 0);
  const chipStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 8,
    background: active ? "var(--brand)" : "#fff",
    color: active ? "#fff" : "var(--oxford)",
    border: `1px solid ${active ? "var(--brand)" : "#D6E2F7"}`,
    borderRadius: 999, padding: "6px 13px 6px 7px",
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flex: "none",
  });
  const statusStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--brand)" : "#fff",
    color: active ? "#fff" : "var(--oxford)",
    border: `1px solid ${active ? "var(--brand)" : "#D6E2F7"}`,
    borderRadius: 999, padding: "7px 14px",
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flex: "none",
  });
  return (
    <div className="pa-filters" style={{ display: "flex", alignItems: "center", gap: 14, overflowX: "auto", paddingBottom: 6, marginBottom: 22 }}>
      <div style={{ display: "flex", gap: 8, flex: "none" }}>
        <button type="button" onClick={() => onPsy(null)} style={chipStyle(psyFilter === null)}>
          <span style={{ width: 24, height: 24, borderRadius: "50%", background: psyFilter === null ? "rgba(255,255,255,.25)" : "#082F6D", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="2" /><circle cx="5" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </span>
          {t("patAppt.filterAll")} <span style={{ opacity: .7, fontWeight: 700 }}>{totalUpcoming}</span>
        </button>
        {psyChips.map(p => {
          const active = psyFilter === p.id;
          const tint = avatarTint(p.id);
          return (
            <button key={p.id} type="button" onClick={() => onPsy(active ? null : p.id)} style={chipStyle(active)}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: active ? "rgba(255,255,255,.25)" : tint.bg, color: active ? "#fff" : tint.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flex: "none" }}>
                {initialsOf(p.name)}
              </span>
              {p.name.replace("Dr. ", "")}
              <span style={{ opacity: .7, fontWeight: 700 }}>{p.count}</span>
            </button>
          );
        })}
      </div>
      <div style={{ width: 1, height: 24, background: "#D6E2F7", flex: "none" }} />
      <div style={{ display: "flex", gap: 8, flex: "none" }}>
        {(["all", "confirmed", "pending"] as StatusFilter[]).map(s => (
          <button key={s} type="button" onClick={() => onStatus(s)} style={statusStyle(statusFilter === s)}>
            {s === "all" ? t("patAppt.filterAll") : s === "confirmed" ? t("patAppt.filterConfirmed") : t("patAppt.filterPending")}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Agenda card — seans kartı ──────────────────────────────────────────────
   Struktur: şəkil + ad → vaxt aralığı → status → aşağıda "Seansa qoşul"
   (link təyin edilibsə aktiv, edilməyibsə boz). Digər əməliyyatlar (təqvim,
   vaxt dəyişmə, ləğv) yuxarı sağdakı 3 nöqtə menyusundadır. */

function AgendaRow({
  a, isNext, now, sessionNumber, photoUrl, onOpen, onReschedule, onCancel,
}: {
  a: AppointmentDetail;
  isNext: boolean;
  now: Date;
  sessionNumber: number | null;
  photoUrl: string | null;
  onOpen: () => void;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const { t, locale } = useT();
  // Operator təsdiqi gözləyən müraciət (PENDING/REJECTED) — ayrıca bölmə yoxdur,
  // eyni kart sırasında göstərilir: vaxt "istədiyiniz vaxt"dır, əməliyyatlar bağlıdır.
  const awaiting = a.status === "PENDING" || a.status === "REJECTED";
  const when = a.startAt ?? a.requestedStartAt;
  const start = a.startAt ? new Date(a.startAt) : null;
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  const tu = start ? timeUntil(t, start, now) : null;
  const isToday = start ? isSameDay(start, now) : false;
  const cancelRequested = a.status === "CANCEL_REQUESTED";
  const rescheduleRequested = !!a.rescheduleRequestedAt
    && (a.status === "CONFIRMED" || a.status === "ASSIGNED");
  const psyName = a.psychologistName ?? a.requestedPsychologistName ?? null;
  const awaitingHint = a.status === "REJECTED"
    ? t("patAppt.awaitingRejected")
    : t("patAppt.awaitingPending");
  return (
    <div className={`psy-card psy-card--today${isNext ? " psy-card--next" : ""}`} style={{ display: "flex", flexDirection: "column" }}>
      {/* Şəkil + ad, sağda 3 nöqtə menyu */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div className="psy-card__avatar" style={{ width: 46, height: 46, overflow: "hidden", ...(photoUrl ? {} : { background: "#082F6D", color: "#fff", border: "none" }) }}>
          {photoUrl ? (
            <img src={photoUrl} alt={psyName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : initialsOf(psyName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="psy-card__name">{psyName ?? t("patAppt.rowPsyPending")}</div>
          {sessionNumber != null && <div className="psy-card__nth">{t("appt.sessionNumber", { ordinal: ordinalFor(locale, sessionNumber) })}</div>}
        </div>
        {!cancelRequested && !awaiting && (
          <SessionCardMenu a={a} onReschedule={onReschedule} onCancel={onCancel}
            hideReschedule={rescheduleRequested} />
        )}
      </div>

      {/* Vaxt aralığı — tarix başlıqları yığışdırılıb, gün etiketi burada */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {when ? (
          <span className="psy-card__time">
            {relativeDayLabel(t, new Date(when), now)}, {fmtTime(new Date(when))}{start && a.endAt ? ` – ${fmtTime(new Date(a.endAt))}` : ""}
          </span>
        ) : (
          <span className="psy-card__time" style={{ color: "var(--oxford-60)" }}>{t("patAppt.rowTimePending")}</span>
        )}
        {awaiting && when && <span style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600 }}>{t("patAppt.rowRequestedTime")}</span>}
        {isToday && tu && !tu.expired && (
          <span className={tu.urgent ? "pa-live" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: tu.urgent ? "#991B1B" : "#047857", fontSize: 12, fontWeight: 600 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            {tu.text}
          </span>
        )}
      </div>

      {/* Status + nişanlar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <span className="psy-card__badge" style={{ background: status.bg, color: status.color }}>{t(status.labelKey)}</span>
        {isNext && <span className="psy-card__chip psy-card__chip--next">{t("patAppt.chipNext")}</span>}
        {a.patientPackageId != null && <PackageBadge name={a.packageName} />}
        {a.sessionKind === "INTRO" && <IntroBadge />}
      </div>

      {/* Gözləmə vəziyyətləri */}
      {cancelRequested && (
        <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>
          <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
          {t("patAppt.cancelPending")}
        </div>
      )}
      {awaiting && (
        <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>
          <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
          {awaitingHint}
        </div>
      )}
      {rescheduleRequested && (
        <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>
          <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
          {t("patAppt.reschedPending")}
        </div>
      )}

      {/* Aşağı: Aç (ətraflı məlumat) + Qoşul */}
      <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 14 }}>
        <button type="button" onClick={onOpen}
          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 14px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
          {t("patAppt.openCta")}
        </button>
        {!cancelRequested && !awaiting && (
          <div style={{ flex: 1.6 }}>
            <SessionJoinButton a={a} />
          </div>
        )}
      </div>
    </div>
  );
}

/* Google Calendar hadisə linki (AddToCalendarMenu ilə eyni format) —
   3 nöqtə menyusu və detal pəncərəsi tərəfindən paylaşılır. */
function gcalHrefFor(t: Translate, a: AppointmentDetail): string | null {
  if (!a.startAt || !a.endAt) return null;
  return googleCalendarUrl({
    uid: String(a.id),
    title: a.psychologistName
      ? t("patAppt.calTitleWith", { name: a.psychologistName })
      : t("patAppt.calTitle"),
    description: [
      a.psychologistName ? t("patAppt.calPsyLine", { name: a.psychologistName }) : null,
      a.note ? t("patAppt.calNoteLine", { note: a.note }) : null,
      appUrl("/patient/appointments"),
    ].filter(Boolean).join("\n"),
    location: t("patAppt.calLocation"),
    start: new Date(a.startAt),
    end: new Date(a.endAt),
    url: appUrl("/patient/appointments"),
  });
}

/* Qoşulma düyməsi — link operator tərəfindən təyin edilibsə aktiv (brand),
   edilməyibsə boz/deaktiv. Ödəniş təsdiqlənməyibsə də bloklanır. */
function SessionJoinButton({ a }: { a: AppointmentDetail }) {
  const { t } = useT();
  const link = a.meetingLink;
  const paymentPending = a.paymentStatus === "PENDING";
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", borderRadius: 10, padding: "11px 14px",
    fontSize: 13.5, fontWeight: 700, fontFamily: "inherit",
  };
  if (link && !paymentPending) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer"
        style={{ ...base, background: "var(--brand)", color: "#fff", textDecoration: "none" }}>
        <VideoIcon />
        {t("patAppt.joinCta")}
      </a>
    );
  }
  return (
    <span
      title={paymentPending ? t("patAppt.joinTitlePayment") : t("patAppt.joinTitleNoLink")}
      style={{ ...base, background: "#EEF2F8", color: "#9AA7BD", cursor: "not-allowed", userSelect: "none" }}>
      <VideoIcon />
      {paymentPending ? t("patAppt.joinPaymentPending") : t("patAppt.joinCta")}
    </span>
  );
}

function VideoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="m22 8-6 4 6 4V8Z" /><rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

/* 3 nöqtə menyu — Google Calendar, Vaxtı dəyiş, Ləğv et */
function SessionCardMenu({ a, onReschedule, onCancel, hideReschedule }: {
  a: AppointmentDetail;
  onReschedule: () => void;
  onCancel: () => void;
  /** Vaxt dəyişikliyi istəyi artıq göndərilib — təkrar göndərməyə imkan vermə. */
  hideReschedule?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  const itemStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 9, width: "100%",
    background: "transparent", border: "none", borderRadius: 8,
    padding: "9px 11px", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
    color: "var(--oxford)", cursor: "pointer", textDecoration: "none", textAlign: "left",
  };

  const gcalHref = gcalHrefFor(t, a);

  return (
    <div style={{ position: "relative", flex: "none" }}>
      <button type="button" aria-label={t("patAppt.menuAria")} onClick={() => setOpen(o => !o)}
        style={{ width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", background: open ? "var(--brand-50)" : "transparent", color: "var(--oxford-60)", border: "none", borderRadius: 8, cursor: "pointer" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: 36, right: 0, zIndex: 41, background: "#fff", border: "1px solid #E3EAF6", borderRadius: 12, boxShadow: "0 10px 30px rgba(8,47,109,.14)", padding: 6, minWidth: 224, animation: "paFade .15s ease" }}>
            {gcalHref && (
              <a href={gcalHref} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} style={itemStyle}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                {t("patAppt.addGoogle")}
              </a>
            )}
            {!hideReschedule && (
              <button type="button" onClick={() => { setOpen(false); onReschedule(); }} style={itemStyle}>
                <IconClock />
                {t("staff.cardReschedule")}
              </button>
            )}
            <div style={{ height: 1, background: "#F0F4FA", margin: "4px 6px" }} />
            <button type="button" onClick={() => { setOpen(false); onCancel(); }} style={{ ...itemStyle, color: "#991B1B" }}>
              <IconX />
              {t("staff.cardCancel")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Seans detal pəncərəsi — "Aç" düyməsi ilə açılır ─────────────────────────
   Seans barədə bütün məlumat bir yerdə: vaxt, status, paket, ödəniş, mövzu,
   operator qeydi, görüş linki və əməliyyatlar. */

function SessionDetailModal({
  a, photoUrl, sessionNumber, now, onClose, onReschedule, onCancel,
}: {
  a: AppointmentDetail;
  photoUrl: string | null;
  sessionNumber: number | null;
  now: Date;
  onClose: () => void;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const { t, locale } = useT();
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  const start = a.startAt ? new Date(a.startAt) : null;
  const tu = start ? timeUntil(t, start, now) : null;
  const cancelRequested = a.status === "CANCEL_REQUESTED";
  const rescheduleRequested = !!a.rescheduleRequestedAt
    && (a.status === "CONFIRMED" || a.status === "ASSIGNED");
  // Operator təsdiqi gözləyən müraciət — görüş/əməliyyat blokları bağlıdır.
  const awaiting = a.status === "PENDING" || a.status === "REJECTED";
  const psyName = a.psychologistName ?? a.requestedPsychologistName ?? null;
  const gcalHref = gcalHrefFor(t, a);

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 4 };
  const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textDecoration: "none" };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,22,51,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Başlıq: şəkil + ad + status */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)", display: "flex", alignItems: "center", gap: 12 }}>
          <div className="psy-card__avatar" style={{ width: 46, height: 46, overflow: "hidden", ...(photoUrl ? {} : { background: "#082F6D", color: "#fff", border: "none" }) }}>
            {photoUrl ? (
              <img src={photoUrl} alt={psyName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : initialsOf(psyName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{psyName ?? t("patAppt.rowPsyPending")}</div>
            {sessionNumber != null && <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 1 }}>{t("appt.sessionNumber", { ordinal: ordinalFor(locale, sessionNumber) })}</div>}
          </div>
          <span className="psy-card__badge" style={{ background: status.bg, color: status.color, flex: "none" }}>{t(status.labelKey)}</span>
          {a.sessionKind === "INTRO" && <IntroBadge />}
          <button type="button" aria-label={t("common.close")} onClick={onClose}
            style={{ width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", color: "var(--oxford-60)", border: "none", borderRadius: 8, cursor: "pointer", flex: "none" }}>
            <IconX />
          </button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Vaxt */}
          <div>
            <div style={labelStyle}>{t("patAppt.detailTime")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
                {a.startAt
                  ? `${azFormatDate(a.startAt)}, ${fmtTime(new Date(a.startAt))}${a.endAt ? ` – ${fmtTime(new Date(a.endAt))}` : ""}`
                  : a.requestedStartAt
                    ? t("patAppt.detailRequestedTime", { when: `${azFormatDate(a.requestedStartAt)}, ${fmtTime(new Date(a.requestedStartAt))}` })
                    : t("patAppt.detailTimeTbd")}
              </span>
              {tu && !tu.expired && (
                <span className={tu.urgent ? "pa-live" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: tu.urgent ? "#991B1B" : "#047857", fontSize: 12.5, fontWeight: 600 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  {tu.text}
                </span>
              )}
            </div>
          </div>

          {/* Paket bağlantısı */}
          {a.patientPackageId != null && (
            <div>
              <div style={labelStyle}>{t("patAppt.detailPackage")}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--brand-50)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 13px", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: "var(--brand-700)" }}>
                  <PackageBadge name={a.packageName} />
                  {a.packageName ?? t("patAppt.detailPkgFallback")}
                  {/* Gedişat = keçirilmiş seans / alınmış seans. */}
                  {a.packageTotal != null && a.packageCompleted != null && (
                    <span style={{ fontWeight: 600, color: "var(--oxford-60)", fontSize: 12.5 }}>{t("patAppt.detailPkgProgress", { done: a.packageCompleted, total: a.packageTotal })}</span>
                  )}
                </span>
                <Link href={`/patient/appointments/packages/${a.patientPackageId}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", textDecoration: "none", whiteSpace: "nowrap" }}>
                  {t("patAppt.pkgView")}
                </Link>
              </div>
            </div>
          )}

          {/* Ödəniş (yalnız tək seans) */}
          {a.paymentStatus != null && (
            <div>
              <div style={labelStyle}>{t("patAppt.detailPayment")}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--oxford)" }}>
                {a.paymentAmount ? formatAzn(a.paymentAmount) : t("patAppt.detailAmountTbd")}
                <span style={{ color: a.paymentStatus === "PAID" ? "#047857" : "#92400E", marginLeft: 8 }}>
                  {a.paymentStatus === "PAID" ? t("patAppt.detailPaid") : t("patAppt.detailPayAwaiting")}
                </span>
              </div>
            </div>
          )}

          {/* Mövzu */}
          {a.note && (
            <div>
              <div style={labelStyle}>{t("patAppt.noteLabel")}</div>
              <div style={{ fontSize: 13.5, color: "var(--oxford)", fontStyle: "italic", fontWeight: 500, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 13px", lineHeight: 1.5 }}>
                «{a.note}»
              </div>
            </div>
          )}

          {/* Operator qeydi */}
          {cleanOperatorNote(a.operatorNote) && (
            <div>
              <div style={labelStyle}>{t("patAppt.operatorNoteLabel")}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 13px", fontSize: 13.5, color: "#92400E", fontWeight: 500, lineHeight: 1.5 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }}><path d="M9 12h6M9 16h4M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" /></svg>
                <span style={{ fontStyle: "italic" }}>«{cleanOperatorNote(a.operatorNote)}»</span>
              </div>
            </div>
          )}

          {/* Görüş linki — gözləyən müraciətdə hələ mənasızdır */}
          {!awaiting && (
            <div>
              <div style={labelStyle}>{t("patAppt.detailMeeting")}</div>
              <SessionJoinButton a={a} />
              {!a.meetingLink && (
                <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, marginTop: 6 }}>
                  {t("patAppt.detailMeetingHint")}
                </div>
              )}
            </div>
          )}

          {/* Əməliyyatlar */}
          {cancelRequested || awaiting ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>
              <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
              {cancelRequested
                ? t("patAppt.cancelPending")
                : a.status === "REJECTED"
                  ? t("patAppt.awaitingRejected")
                  : t("patAppt.awaitingPending")}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid #F0F4FA", paddingTop: 16 }}>
              {rescheduleRequested && (
                <div style={{ width: "100%", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>
                  <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
                  {t("patAppt.reschedPending")}
                </div>
              )}
              {gcalHref && (
                <a href={gcalHref} target="_blank" rel="noopener noreferrer" style={ghostBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  {t("patAppt.addGoogle")}
                </a>
              )}
              {!rescheduleRequested && (
                <button type="button" onClick={onReschedule} style={ghostBtn}>
                  <IconClock />
                  {t("staff.cardReschedule")}
                </button>
              )}
              <button type="button" onClick={onCancel} style={{ ...ghostBtn, color: "#991B1B", border: "1px solid #F3D6D6" }}>
                <IconX />
                {t("staff.cardCancel")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Simplified cancel request — patient signals, operator decides ───────── */

function CancelRequestNoteModal({
  appointment, onClose, onDone,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onDone: (updated: AppointmentDetail) => void;
}) {
  const { t } = useT();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  // Modal açılan andakı vaxt — render içində Date.now() çağırmamaq üçün state-də.
  const [openedAtMs] = useState(() => Date.now());

  const hoursLeft = appointment.startAt
    ? (new Date(appointment.startAt).getTime() - openedAtMs) / (1000 * 60 * 60)
    : null;
  const isLate = hoursLeft !== null && hoursLeft >= 0 && hoursLeft < 24;
  // Paket seansında "geri qaytarma" pul deyil, 1 seans krediti bərpasıdır (backend:
  // maybeRestorePackageSession). Tək seansda isə yalnız PAID ödəniş refund-a namizəddir,
  // və bu da operatorun əl ilə təsdiqlədiyi ayrıca proses — avtomatik deyil.
  const isPackageSession = appointment.patientPackageId != null;
  const paymentConfirmed = appointment.paymentStatus === "PAID";

  const submit = async () => {
    setSaving(true);
    try {
      const updated = await patientApi.cancel(appointment.id, "PATIENT_OTHER", note.trim() || undefined);
      onDone(updated);
    } catch (e) { toast((e as Error).message, "error"); setSaving(false); }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,22,51,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>{t("cancel.modalTitle")}</h3>
          <p style={{ fontSize: 12.5, color: "var(--oxford-60)", margin: "4px 0 0" }}>
            {t("patAppt.cancelSub")}
          </p>
        </div>
        <div style={{ padding: 22 }}>
          {isLate ? (
            <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#991B1B", lineHeight: 1.5 }}>
              {t("patAppt.lateA")}{" "}
              <strong>{t("patAppt.lateB", { n: Math.max(0, Math.floor(hoursLeft!)) })}</strong>{" "}
              {t("patAppt.lateC")}{" "}
              {isPackageSession ? (
                <>{t("patAppt.caseA")} <strong>{t("patAppt.latePkgB")}</strong> {t("patAppt.lateTail")}</>
              ) : paymentConfirmed ? (
                <>{t("patAppt.caseA")} <strong>{t("patAppt.latePaidB")}</strong> {t("patAppt.lateTail")}</>
              ) : (
                <>{t("patAppt.latePlain")}</>
              )}
            </div>
          ) : isPackageSession ? (
            <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#166534", lineHeight: 1.5 }}>
              {t("patAppt.earlyA")} <strong>{t("patAppt.earlyPkgB")}</strong> {t("patAppt.earlyPkgC")}
            </div>
          ) : paymentConfirmed ? (
            <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#166534", lineHeight: 1.5 }}>
              {t("patAppt.earlyA")} <strong>{t("patAppt.earlyPaidB")}</strong> {t("patAppt.earlyPaidC")}
            </div>
          ) : null}
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
            placeholder={t("patAppt.cancelReasonPh")}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1.5px solid var(--brand-100)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid var(--brand-100)", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer", fontWeight: 600 }}>{t("common.back")}</button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 20px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "#DC2626", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? t("common.sending") : t("patAppt.cancelSubmit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Simplified reschedule request — patient signals, operator reschedules ── */

function RescheduleRequestNoteModal({
  appointment, onClose, onDone,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await patientApi.requestRescheduleNote(appointment.id, note.trim() || undefined);
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setSaving(false); }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,22,51,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>{t("patAppt.reschedTitle")}</h3>
          <p style={{ fontSize: 12.5, color: "var(--oxford-60)", margin: "4px 0 0" }}>
            {t("patAppt.reschedSub")}
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <textarea rows={4} value={note} onChange={e => setNote(e.target.value)}
            placeholder={t("patAppt.reschedPh")}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1.5px solid var(--brand-100)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid var(--brand-100)", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer", fontWeight: 600 }}>{t("common.close")}</button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 20px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? t("common.sending") : t("patAppt.reschedSubmit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Dispute modal ──────────────────────────────────────────────────────── */

function DisputeModal({
  appointment, onClose, onDone,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onDone: (updated: AppointmentDetail) => void;
}) {
  const { t } = useT();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const updated = await patientApi.disputeSession(appointment.id, reason.trim() || undefined);
      onDone(updated);
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(480px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>{t("patAppt.disputeTitle")}</h2>
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4 }}>
            {t("patAppt.disputeSub")}
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>
            {t("patAppt.disputeReason")}
          </label>
          <textarea
            rows={4} value={reason} onChange={e => setReason(e.target.value)}
            placeholder={t("patAppt.disputePh")}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12 }} />

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              {t("common.close")}
            </button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#DC2626", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? t("common.sending") : t("patAppt.disputeSubmit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
