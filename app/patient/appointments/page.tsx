"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DatePicker from "@/components/DatePicker";
import {
  patientApi,
  getPsychologistAvailability,
  reasonLabel,
  type AppointmentDetail,
  type AvailableSlot,
  type MyReview,
  type PatientPackageItem,
  type RescheduleProposal,
  type SessionFeedback,
} from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { azFormatTime, azFormatDate, azLocalToISO, hoursSince, azOrdinal } from "@/lib/datetime";
import { formatAzn } from "@/lib/money";
import ReviewModal from "./ReviewModal";
import RescheduleProposalModal from "@/components/RescheduleProposalModal";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import JoinSessionButton from "@/components/JoinSessionButton";
import SessionFeedbackModal from "@/components/SessionFeedbackModal";
import { useT } from "@/lib/i18n/LocaleProvider";

const WEEKDAYS_AZ = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"];
const MONTHS_AZ = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function isoDateOnly(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function fmtTime(d: Date) { return azFormatTime(d); }
// AZ-zone year/month/day key for a Date — uses Intl with Asia/Baku.
function azDayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit" });
}
function isSameDay(a: Date, b: Date) {
  return azDayKey(a) === azDayKey(b);
}
function relativeDayLabel(d: Date, now: Date) {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (isSameDay(d, now)) return "Bu gün";
  if (isSameDay(d, tomorrow)) return "Sabah";
  // Pull weekday/day/month components in AZ tz
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Baku", weekday: "short", day: "2-digit", month: "numeric" })
    .formatToParts(d);
  const weekdayShort = parts.find(p => p.type === "weekday")?.value ?? "";
  const dayNum = Number(parts.find(p => p.type === "day")?.value ?? 0);
  const monthNum = Number(parts.find(p => p.type === "month")?.value ?? 1);
  // Map US weekday short → AZ
  const map: Record<string, string> = { Mon: "B.e", Tue: "Ç.a", Wed: "Ç", Thu: "C.a", Fri: "C", Sat: "Ş", Sun: "B" };
  const azWd = map[weekdayShort] ?? weekdayShort;
  return `${azWd} · ${pad2(dayNum)} ${MONTHS_AZ[monthNum - 1]}`;
}

interface CountdownInfo {
  text: string;
  expired: boolean;
  urgent: boolean;
}
function timeUntil(target: Date, now: Date): CountdownInfo {
  const ms = target.getTime() - now.getTime();
  if (ms < 0) return { expired: true, urgent: false, text: "İndi başladı" };
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return { expired: false, urgent: minutes <= 15, text: `${minutes} dəq qaldı` };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remMin = minutes % 60;
    return { expired: false, urgent: false, text: `${hours} saat${remMin > 0 ? ` ${remMin} dəq` : ""} qaldı` };
  }
  const days = Math.floor(hours / 24);
  return { expired: false, urgent: false, text: `${days} gün qaldı` };
}

function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

const STATUS: Record<string, { label: string; color: string; bg: string; accent: string }> = {
  PENDING:                { label: "Gözlənilir",       color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  ASSIGNED:               { label: "Təyin edilib",     color: "var(--brand-700)", bg: "var(--brand-50)", accent: "var(--brand)" },
  CONFIRMED:              { label: "Təsdiqlənib",      color: "#065F46",          bg: "#D1FAE5",         accent: "#10B981" },
  AWAITING_CONFIRMATION:  { label: "Təsdiq gözlənir",  color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  DISPUTED:               { label: "Mübahisəli",       color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  COMPLETED:              { label: "Tamamlandı",       color: "#374151",          bg: "#F3F4F6",         accent: "#9CA3AF" },
  CANCELLED:              { label: "Ləğv edildi",      color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  CANCEL_REQUESTED:       { label: "Ləğv gözlənir",    color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  REJECTED:               { label: "Yenidən təyin",    color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
};

const ACTIVE_STATUSES = new Set(["ASSIGNED", "CONFIRMED", "PENDING", "REJECTED", "CANCEL_REQUESTED"]);

type StatusFilter = "all" | "confirmed" | "pending";

// Səhifəyə xas animasiya + filter scrollbar gizlətməsi (media query inline ola bilmir).
const PA_STYLE = `
@keyframes paFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes paSheet{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes paLive{0%,100%{opacity:1}50%{opacity:.45}}
.pa-filters::-webkit-scrollbar{height:0}
.pa-live{animation:paLive 1.4s ease-in-out infinite}
`;

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
  const { t } = useT();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [packages, setPackages] = useState<PatientPackageItem[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  // GAP-03: new no-penalty flow — patient proposes slots, psychologist decides
  const [reschedRequestFor, setReschedRequestFor] = useState<AppointmentDetail | null>(null);
  const [reviewFor, setReviewFor] = useState<AppointmentDetail | null>(null);
  const [disputeFor, setDisputeFor] = useState<AppointmentDetail | null>(null);
  const [cancelFor, setCancelFor] = useState<AppointmentDetail | null>(null);
  const [proposals, setProposals] = useState<RescheduleProposal[]>([]);
  const [proposalFor, setProposalFor] = useState<RescheduleProposal | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<AppointmentDetail | null>(null);
  const [existingFeedback, setExistingFeedback] = useState<SessionFeedback | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<number>>(new Set());
  const [psyFilter, setPsyFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Tick every minute for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = () => {
    setLoading(true);
    Promise.all([
      patientApi.myAppointments(),
      patientApi.myReviews().catch(() => [] as MyReview[]),
      patientApi.pendingRescheduleProposals().catch(() => [] as RescheduleProposal[]),
      patientApi.myPackages().catch(() => [] as PatientPackageItem[]),
    ])
      .then(([appts, revs, props, pkgs]) => {
        setItems(appts);
        setMyReviews(revs);
        setPackages(pkgs);
        // Only psychologist-initiated proposals are FOR the patient to decide;
        // the patient's own GAP-03 requests are awaiting the psychologist.
        setProposals(props.filter(p => p.initiator !== "PATIENT"));
        // Refresh-də "Necə keçdi?" düyməsi təkrar görünməsin: artıq rəy verilmiş
        // tamamlanmış seansları serverdən öyrən. Düymə yalnız göstərilən tarixçə
        // sətirlərində (ən son 30) çıxır — sorğu sayını ona görə məhdudlaşdırırıq.
        const fbCandidates = appts
          .filter(a => a.status === "COMPLETED")
          .sort((x, y) => new Date(y.startAt ?? y.endAt ?? 0).getTime() - new Date(x.startAt ?? x.endAt ?? 0).getTime())
          .slice(0, 30);
        if (fbCandidates.length) {
          Promise.all(fbCandidates.map(a =>
            patientApi.getSessionFeedback(a.id).then(fb => (fb ? a.id : null)).catch(() => null),
          )).then(ids => {
            const given = ids.filter((x): x is number => x != null);
            if (given.length) setFeedbackGiven(prev => {
              const next = new Set(prev);
              given.forEach(id => next.add(id));
              return next;
            });
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    return subscribeNotifications((n) => {
      if (typeof n.type === "string"
        && (n.type.startsWith("APPOINTMENT_") || n.type.startsWith("RESCHEDULE_"))) load();
    });

  }, []);

  // "Proqramlarım" — yalnız aktiv (seans qalan) paketlər. Bitmiş/müddəti
  // keçənlər göstərilmir (razılaşma 2026-06-22).
  const activePackages = useMemo(
    () => packages.filter(p => p.status === "ACTIVE"),
    [packages],
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
      .filter(a => a.startAt && new Date(a.startAt).getTime() > now.getTime() - 30 * 60_000)
      .filter(a => a.status === "ASSIGNED" || a.status === "CONFIRMED")
      .filter(matchesFilters)
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, now, psyFilter, statusFilter]);

  /** All upcoming (today + future), filtered, grouped by AZ day key.
   *  Paket seansları paket kartında idarə olunur — burada görünmür. */
  const agendaGroups = useMemo(() => {
    const list = items
      .filter(a => a.patientPackageId == null) // paket seansları paket kartında idarə olunur
      .filter(a => a.startAt && new Date(a.startAt).getTime() > now.getTime() - 30 * 60_000)
      // Yalnız operator tərəfindən təyin/təsdiq olunmuş seanslar; gözləyən
      // müraciətlər (PENDING/REJECTED) aşağıdakı ayrıca bölmədə göstərilir.
      .filter(a => a.status === "ASSIGNED" || a.status === "CONFIRMED" || a.status === "CANCEL_REQUESTED")
      .filter(matchesFilters)
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
    const groups: { key: string; label: string; items: AppointmentDetail[] }[] = [];
    let last: typeof groups[number] | null = null;
    for (const a of list) {
      const d = new Date(a.startAt!);
      const key = azDayKey(d);
      if (!last || last.key !== key) {
        last = { key, label: relativeDayLabel(d, now), items: [] };
        groups.push(last);
      }
      last.items.push(a);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, now, psyFilter, statusFilter]);

  const agendaTotal = useMemo(() => agendaGroups.reduce((n, g) => n + g.items.length, 0), [agendaGroups]);

  /** Operatorun təsdiq/təyin etməsini gözləyən müraciətlər (PENDING/REJECTED).
   *  Paket seansları paket kartında göstərilir, ona görə buradan çıxarılır.
   *  Bunlar əvvəllər heç yerdə görünmürdü (Yaxınlaşan bölməsi startAt tələb edirdi). */
  const awaitingOperator = useMemo(() => {
    return items
      .filter(a => a.patientPackageId == null)
      .filter(a => a.status === "PENDING" || a.status === "REJECTED")
      .filter(matchesFilters)
      .sort((a, b) => {
        const da = new Date(a.requestedStartAt ?? a.startAt ?? a.createdAt).getTime();
        const db = new Date(b.requestedStartAt ?? b.startAt ?? b.createdAt).getTime();
        return da - db;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, psyFilter, statusFilter]);

  const history = useMemo(() => {
    return items
      .filter(a => ["COMPLETED", "CANCELLED", "AWAITING_CONFIRMATION", "DISPUTED"].includes(a.status))
      .filter(matchesFilters)
      .sort((a, b) => {
        const da = new Date(a.startAt ?? a.endAt ?? 0).getTime();
        const db = new Date(b.startAt ?? b.endAt ?? 0).getTime();
        return db - da;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, psyFilter, statusFilter]);

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

  const reviewedFor = (psyId?: number | null) =>
    psyId ? myReviews.find(r => r.psychologistId === psyId) ?? null : null;

  const openFeedback = async (a: AppointmentDetail) => {
    setExistingFeedback(null); setFeedbackFor(a);
    try {
      const fb = await patientApi.getSessionFeedback(a.id);
      setExistingFeedback(fb);
      if (fb) setFeedbackGiven(prev => new Set(prev).add(a.id));
    } catch { /* opening modal fresh — backend may have returned 200 with null */ }
  };

  return (
    <div className="psy-appt-page" style={{ maxWidth: 1040, margin: "0 auto" }}>
      <style>{PA_STYLE}</style>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", color: "var(--oxford)" }}>{t("appt.pageTitle")}</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>{t("appt.pageSub")}</p>
        </div>
        <Link
          href="/patient/psychologists"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--brand)", color: "#fff",
            padding: "11px 17px", borderRadius: 10,
            fontSize: 14, fontWeight: 600, textDecoration: "none",
            boxShadow: "0 4px 14px rgba(16,81,183,.25)",
          }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          {t("appt.newCta")}
        </Link>
      </header>

      {proposals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {proposals.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 13, background: "linear-gradient(90deg,#FFFBEB,#FEF3C7)", border: "1px solid #FDE68A", borderLeft: "3px solid #F59E0B", borderRadius: 13, padding: "13px 16px" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#FEF3C7", color: "#92400E", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#92400E" }}>Saat təklifi gözləyir</div>
                <div style={{ fontSize: 12.5, color: "#92400E", opacity: .9, fontWeight: 500, marginTop: 1 }}>
                  {p.psychologistName ?? "Psixoloqunuz"} {p.options.length} alternativ saat təklif edir. Birini seçin və ya hamısını rədd edin.
                </div>
              </div>
              <button onClick={() => setProposalFor(p)} style={{ background: "#fff", color: "#92400E", border: "1px solid #FDE68A", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", flex: "none" }}>
                Bax və seç
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>
          Yüklənir…
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "4rem 2rem", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontWeight: 700, color: "var(--oxford)", marginBottom: 6, fontSize: 17 }}>Hələ randevunuz yoxdur</h3>
          <p style={{ color: "var(--oxford-60)", fontSize: 13, marginBottom: 18 }}>
            Psixoloqlarımızdan biri ilə randevu alaraq başlayın
          </p>
          <Link
            href="/patient/psychologists"
            style={{ background: "var(--brand)", color: "#fff", padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none", display: "inline-block" }}>
            Psixoloq seç
          </Link>
        </div>
      ) : (
        <>
          {(psyChips.length > 1 || statusFilter !== "all" || psyFilter != null) && (
            <FilterBar
              psyChips={psyChips}
              psyFilter={psyFilter}
              statusFilter={statusFilter}
              onPsy={setPsyFilter}
              onStatus={setStatusFilter}
            />
          )}

          <NextSessionHero
            appt={next}
            now={now}
            sessionNumber={next ? sessionOrdinalFor(next) : null}
            busyId={busyId}
            onConfirm={(a) => action(a.id, () => patientApi.confirmSession(a.id))}
            onDispute={(a) => setDisputeFor(a)}
            onReschedule={(a) => openReschedule(a)}
            onCancel={(a) => cancel(a)}
          />

          {/* Operator təsdiqi gözləyən müraciətlər — pasiyent öz sorğusunun
              statusunu görsün (əvvəllər heç yerdə görünmürdü). */}
          {awaitingOperator.length > 0 && (
            <Section title="Operator təsdiqi gözləyir" count={awaitingOperator.length} icon="" collapsible={false}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {awaitingOperator.map(a => (
                  <AwaitingOperatorCard key={a.id} a={a} />
                ))}
              </div>
            </Section>
          )}

          {/* "Proqramlarım" — yalnız alınmış paketlər (booking_series anlayışı yoxdur). */}
          {activePackages.length > 0 && (
            <Section
              title="Proqramlarım"
              count={activePackages.length}
              icon=""
            >
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                gap: 16,
              }}>
                {activePackages.map(p => (
                  <PackageProgramCard
                    key={`pkg-${p.id}`}
                    pkg={p}
                    sessions={items.filter(a => a.patientPackageId === p.id && a.status !== "COMPLETED" && a.status !== "CANCELLED")}
                    onChanged={load}
                  />
                ))}
              </div>
            </Section>
          )}

          <Section title="Yaxınlaşan" count={agendaTotal} icon="" collapsible={false}>
            {agendaGroups.length === 0 ? (
              <Empty msg={
                psyFilter != null || statusFilter !== "all"
                  ? "Bu filtrlərə uyğun yaxınlaşan randevu yoxdur"
                  : "Yaxınlaşan randevu yoxdur"
              } />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {agendaGroups.map(g => (
                  <div key={g.key}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>{g.label}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {g.items.map(a => (
                        <AgendaRow
                          key={a.id}
                          a={a}
                          isNext={next?.id === a.id}
                          now={now}
                          sessionNumber={sessionOrdinalFor(a)}
                          onReschedule={() => openReschedule(a)}
                          onCancel={() => cancel(a)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={t("appt.sectionHistory")} count={history.length} icon="" card defaultCollapsed>
            {history.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--oxford-60)", fontSize: 13, borderTop: "1px solid #F0F4FA" }}>Hələ tamamlanmış seansınız yoxdur</div>
            ) : (
              <div style={{ padding: "0 8px 10px" }}>
                {history.slice(0, 30).map(a => (
                  <HistoryRow
                    key={a.id}
                    a={a}
                    review={reviewedFor(a.psychologistId)}
                    feedbackGiven={feedbackGiven.has(a.id)}
                    onWriteReview={() => setReviewFor(a)}
                    onFeedback={() => openFeedback(a)}
                  />
                ))}
                {history.length > 30 && (
                  <div style={{ textAlign: "center", padding: "13px 0 6px", borderTop: "1px solid #F0F4FA", fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>
                    +{history.length - 30} daha
                  </div>
                )}
              </div>
            )}
          </Section>
        </>
      )}

      {reschedRequestFor && (
        <RescheduleRequestNoteModal
          appointment={reschedRequestFor}
          onClose={() => setReschedRequestFor(null)}
          onDone={() => { setReschedRequestFor(null); load(); }}
        />
      )}
      {reviewFor && reviewFor.psychologistId && (
        <ReviewModal
          psychologistId={reviewFor.psychologistId}
          psychologistName={reviewFor.psychologistName ?? "Psixoloq"}
          appointmentId={reviewFor.id}
          onClose={() => setReviewFor(null)}
          onSubmitted={(saved) => {
            setMyReviews(prev => [saved, ...prev.filter(r => r.id !== saved.id)]);
            setReviewFor(null);
          }}
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
      {feedbackFor && (
        <SessionFeedbackModal
          appointment={feedbackFor}
          existing={existingFeedback}
          onClose={() => { setFeedbackFor(null); setExistingFeedback(null); }}
          onSubmitted={(fb) => {
            setFeedbackGiven(prev => new Set(prev).add(feedbackFor.id));
            setExistingFeedback(fb);
            setFeedbackFor(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Hero — next session ─────────────────────────────────────────────────── */

function NextSessionHero({
  appt, now, sessionNumber, busyId, onConfirm, onDispute, onReschedule, onCancel,
}: {
  appt: AppointmentDetail | null;
  now: Date;
  sessionNumber: number | null;
  busyId: number | null;
  onConfirm: (a: AppointmentDetail) => void;
  onDispute: (a: AppointmentDetail) => void;
  onReschedule: (a: AppointmentDetail) => void;
  onCancel: (a: AppointmentDetail) => void;
}) {
  const { t } = useT();
  if (!appt || !appt.startAt) {
    return (
      <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: 28, textAlign: "center", marginBottom: 32, fontSize: 14, color: "var(--oxford-60)", fontWeight: 600 }}>
        Yaxınlaşan randevu yoxdur — yeni randevu üçün psixoloq seçin.
      </div>
    );
  }

  const start = new Date(appt.startAt);
  const tu = timeUntil(start, now);
  // Option B: sessions auto-complete — patient never confirms/disputes a session.
  const showConfirm = false;
  const alreadyConfirmed = !!appt.patientConfirmedAt;
  const urgent = tu.urgent || tu.expired;

  const heroGhostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 15px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" };
  const heroDangerBtn: React.CSSProperties = { ...heroGhostBtn, color: "#991B1B", border: "1px solid #F3D6D6" };

  return (
    <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#F2F6FD 0%,#E4ECFA 100%)", border: `1px solid ${urgent ? "#FECACA" : "#D6E2F7"}`, borderRadius: 18, padding: "24px 26px", marginBottom: 32, boxShadow: "0 2px 12px rgba(8,47,109,.07)" }}>
      <div aria-hidden style={{ position: "absolute", top: -60, right: -40, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle,${urgent ? "rgba(239,68,68,.12)" : "rgba(16,81,183,.1)"},transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: urgent ? "#EF4444" : "var(--brand)", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 999 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />NÖVBƏTİ SEANS
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#082F6D" }}>{relativeDayLabel(start, now)} · <strong>{fmtTime(start)}</strong></span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <span style={{ width: 58, height: 58, borderRadius: "50%", background: "#082F6D", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 700, flex: "none" }}>{initialsOf(appt.psychologistName)}</span>
        <div style={{ flex: 1, minWidth: 230 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{appt.psychologistName ?? "Operator psixoloq təyin edəcək"}</span>
            {sessionNumber && <span style={{ background: "#fff", border: "1px solid #D6E2F7", color: "#082F6D", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999 }}>{azOrdinal(sessionNumber)} seans</span>}
          </div>
          {appt.note && (
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "rgba(255,255,255,.6)", border: "1px solid #D6E2F7", borderRadius: 11, padding: "10px 13px", maxWidth: 520 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1051B7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              <span style={{ fontSize: 13.5, color: "var(--oxford)", fontWeight: 500, lineHeight: 1.5 }}>Mövzunuz: <span style={{ fontStyle: "italic" }}>«{appt.note.slice(0, 140)}{appt.note.length > 140 ? "…" : ""}»</span></span>
            </div>
          )}
          {appt.operatorNote && (
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "rgba(255,255,255,.6)", border: "1px solid #FDE68A", borderRadius: 11, padding: "10px 13px", maxWidth: 520, marginTop: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><path d="M9 12h6M9 16h4M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" /></svg>
              <span style={{ fontSize: 13.5, color: "#92400E", fontWeight: 500, lineHeight: 1.5 }}>Operator qeydi: <span style={{ fontStyle: "italic" }}>«{appt.operatorNote.slice(0, 140)}{appt.operatorNote.length > 140 ? "…" : ""}»</span></span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 18 }}>
        <span className={tu.expired ? "pa-live" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: urgent ? "#FEE2E2" : "#ECFDF5", color: urgent ? "#991B1B" : "#047857", border: `1px solid ${urgent ? "#FECACA" : "#A7F3D0"}`, fontSize: 13, fontWeight: 700, padding: "9px 14px", borderRadius: 999 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{tu.text}
        </span>
        {showConfirm && !alreadyConfirmed && (
          <>
            <button
              disabled={busyId === appt.id}
              onClick={() => onConfirm(appt)}
              className="psy-hero__btn psy-hero__btn--primary">
              {busyId === appt.id ? "…" : t("staff.cardConfirm")}
            </button>
            <button
              onClick={() => onDispute(appt)}
              className="psy-hero__btn psy-hero__btn--ghost">
              {t("staff.cardDispute")}
            </button>
          </>
        )}
        {showConfirm && alreadyConfirmed && (
          <span className="psy-hero__btn psy-hero__btn--ghost" style={{ cursor: "default" }}>
            {t("appt.youConfirmed")}
          </span>
        )}
        {!tu.expired && (
          <>
            <JoinSessionButton appointment={appt} variant="compact" />
            <AddToCalendarMenu appointment={appt} variant="compact" />
            <button onClick={() => onReschedule(appt)} style={heroGhostBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {t("staff.cardReschedule")}
            </button>
            <button onClick={() => onCancel(appt)} style={heroDangerBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              {t("staff.cardCancel")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Package program card — paket Randevulara birləşdi ──────────────────── */

function PackageProgramCard({
  pkg, sessions, onChanged,
}: {
  pkg: PatientPackageItem;
  sessions: AppointmentDetail[];
  onChanged: () => void;
}) {
  // null | yeni seans planla | mövcud seansın vaxtını dəyiş
  const [mode, setMode] = useState<null | { kind: "new" } | { kind: "change"; appt: AppointmentDetail }>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const done = Math.max(0, pkg.total - pkg.remaining);
  const pct = pkg.total > 0 ? Math.round((done / pkg.total) * 100) : 0;
  const canSchedule = pkg.status === "ACTIVE" && pkg.remaining > 0;

  const sorted = [...sessions].sort((a, b) =>
    new Date(a.startAt ?? a.requestedStartAt ?? a.createdAt).getTime()
    - new Date(b.startAt ?? b.requestedStartAt ?? b.createdAt).getTime());

  const changeAppt = mode?.kind === "change" ? mode.appt : null;
  const changePsyId = changeAppt
    ? (changeAppt.psychologistId ?? changeAppt.requestedPsychologistId ?? pkg.psychologistId)
    : pkg.psychologistId;

  // Yeni seans — seçilmiş slot → PENDING (birbaşa deyil, operator təsdiqləyir).
  const scheduleSlot = async (slot: AvailableSlot) => {
    setBusy(true); setErr(null);
    try {
      await patientApi.schedulePackageSession(pkg.id, { startAt: slot.startAt });
      setMode(null);
      onChanged();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  // Mövcud seansın vaxtını dəyiş — yeni slot seçilə bilər və ya yalnız siqnal; ikisi də operatora gedir.
  const requestChange = async (appt: AppointmentDetail, preferred?: AvailableSlot) => {
    setBusy(true); setErr(null);
    const msg = preferred
      ? `İstənilən yeni vaxt: ${azFormatDate(preferred.startAt)} · ${azFormatTime(preferred.startAt)}`
      : "Bu seansın vaxtının dəyişdirilməsini xahiş edirəm.";
    try {
      await patientApi.requestRescheduleNote(appt.id, msg);
      setMode(null);
      onChanged();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 22, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand-100)", color: "var(--brand-700)", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 7 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
          </svg>
          Paket
        </span>
        <span style={{ background: "#D1FAE5", color: "#065F46", fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999 }}>Aktiv</span>
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
            {done}/{pkg.total} · <span style={{ color: "var(--brand)" }}>{pkg.remaining} qalıb</span>
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)" }}>{pct}%</span>
        </div>
        <div style={{ height: 9, background: "var(--brand-100)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#1051B7,#3A74D6)", borderRadius: 999 }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 130, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Ödənilib</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{formatAzn(pkg.pricePaid)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 130, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Alınıb</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{azFormatDate(pkg.purchasedAt)}</div>
        </div>
      </div>

      {sorted.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Seçilmiş seanslar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sorted.map(a => {
              const st = STATUS[a.status] ?? STATUS.PENDING;
              const when = a.startAt ?? a.requestedStartAt;
              const canChange = a.status === "CONFIRMED" || a.status === "ASSIGNED";
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "9px 11px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)" }}>{when ? `${azFormatDate(when)} · ${azFormatTime(when)}` : "Operator vaxtı təyin edəcək"}</span>
                  <span style={{ background: st.bg, color: st.color, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{st.label}</span>
                  <span style={{ flex: 1 }} />
                  {canChange ? (
                    <button type="button" onClick={() => { setErr(null); setMode(changeAppt?.id === a.id ? null : { kind: "change", appt: a }); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "#082F6D", border: "1px solid #C7DAF5", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                      <IconClock />Dəyiş
                    </button>
                  ) : (
                    <span style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600 }}>operator təsdiqi gözlənilir</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {canSchedule ? (
        <button
          type="button"
          onClick={() => { setErr(null); setMode(mode?.kind === "new" ? null : { kind: "new" }); }}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: mode?.kind === "new" ? "#fff" : "var(--brand)", color: mode?.kind === "new" ? "var(--oxford-60)" : "#fff", border: mode?.kind === "new" ? "1px solid #D6E2F7" : "none", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", marginTop: "auto" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
          </svg>
          {mode?.kind === "new" ? "Planlaşdırmanı bağla" : "Seans planla"}
        </button>
      ) : sorted.length === 0 ? (
        <div style={{ marginTop: "auto", textAlign: "center", fontSize: 12.5, color: "var(--oxford-60)", background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>
          Bütün seanslar istifadə olunub
        </div>
      ) : null}

      {err && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 12 }}>{err}</div>
      )}

      {mode?.kind === "new" && canSchedule && (
        <div style={{ marginTop: 14, background: "var(--brand-50)", border: "1px solid #D6E2F7", borderRadius: 12, padding: 16, animation: "paFade .25s ease" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-700)", marginBottom: 4 }}>Psixoloqun açıq vaxtından seçin</div>
          <div style={{ fontSize: 12, color: "var(--oxford-60)", marginBottom: 12 }}>Seçdiyiniz vaxt operatora gedəcək, təsdiqdən sonra randevuya çevriləcək.</div>
          <SlotPicker psychologistId={pkg.psychologistId} busy={busy} onPick={scheduleSlot}
            confirmNote="Seçdiyiniz vaxt operatora göndəriləcək, təsdiqdən sonra randevuya çevriləcək." />
        </div>
      )}

      {changeAppt && (
        <div style={{ marginTop: 14, background: "var(--brand-50)", border: "1px solid #D6E2F7", borderRadius: 12, padding: 16, animation: "paFade .25s ease" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-700)", marginBottom: 4 }}>Vaxtı dəyiş</div>
          <div style={{ fontSize: 12, color: "var(--oxford-60)", marginBottom: 12 }}>Yeni vaxt seçin — dəyişiklik operator təsdiqindən keçəcək.</div>
          <SlotPicker psychologistId={changePsyId} busy={busy} onPick={(slot) => requestChange(changeAppt, slot)}
            confirmNote="Vaxt dəyişikliyi tələbiniz operatora göndəriləcək, təsdiqdən sonra qüvvəyə minəcək." />
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0" }}>
            <span style={{ flex: 1, height: 1, background: "#D6E2F7" }} /><span style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 600 }}>və ya</span><span style={{ flex: 1, height: 1, background: "#D6E2F7" }} />
          </div>
          <button type="button" disabled={busy} onClick={() => requestChange(changeAppt)}
            style={{ width: "100%", background: "#fff", color: "#082F6D", border: "1px solid #C7DAF5", borderRadius: 9, padding: 11, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: busy ? "wait" : "pointer" }}>
            Uyğun vaxt yoxdur — operatorla əlaqə
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Slot picker — psixoloqun açıq vaxtları (paket planlama/dəyişmə üçün) ─── */

function SlotPicker({ psychologistId, busy, onPick, confirmNote }: {
  psychologistId: number;
  busy: boolean;
  onPick: (slot: AvailableSlot) => void | Promise<void>;
  confirmNote?: string;
}) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  // Saata basmaq müraciəti birbaşa göndərmir — əvvəlcə təsdiq popup-ı çıxır.
  const [picked, setPicked] = useState<AvailableSlot | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const today = new Date();
    const to = new Date(); to.setDate(to.getDate() + 21);
    getPsychologistAvailability(psychologistId, isoDateOnly(today), isoDateOnly(to))
      .then(s => { if (alive) setSlots(s); })
      .catch(() => { if (alive) setSlots([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [psychologistId]);

  const grouped = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = azFormatDate(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  if (loading) return <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Açıq vaxtlar yüklənir…</div>;
  if (slots.length === 0) return <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Bu psixoloqun yaxın 3 həftədə açıq vaxtı yoxdur.</div>;

  // Təsdiqlə: sorğu bitənə qədər popup açıq qalır (busy → "Göndərilir…"), sonra bağlanır.
  const confirm = async () => { if (!picked) return; await onPick(picked); setPicked(null); };

  return (
    <>
      <div style={{ display: "grid", gap: 10, maxHeight: 240, overflowY: "auto" }}>
        {grouped.map(([day, daySlots]) => (
          <div key={day}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 6 }}>{day}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {daySlots.map(s => (
                <button key={s.startAt} type="button" disabled={busy} onClick={() => setPicked(s)}
                  style={{ background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer" }}>
                  {azFormatTime(s.startAt)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {picked && (
        <div onClick={() => !busy && setPicked(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,26,51,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 1000, animation: "paFade .15s ease" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.22)", border: "1px solid #EDF1F8", padding: 24, width: "100%", maxWidth: 380, animation: "paSheet .2s ease" }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "var(--brand-100)", color: "var(--brand-700)", marginBottom: 14 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>Bu vaxtı təsdiqləyirsiniz?</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--brand-700)", marginBottom: 8 }}>
              {azFormatDate(picked.startAt)} · {azFormatTime(picked.startAt)}
            </div>
            <div style={{ fontSize: 13, color: "var(--oxford-60)", lineHeight: 1.5, marginBottom: 20 }}>
              {confirmNote ?? "Seçdiyiniz vaxt operatora göndəriləcək, təsdiqdən sonra randevuya çevriləcək."}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" disabled={busy} onClick={() => setPicked(null)}
                style={{ flex: 1, background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: busy ? "wait" : "pointer" }}>
                Ləğv et
              </button>
              <button type="button" disabled={busy} onClick={confirm}
                style={{ flex: 1.4, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer" }}>
                {busy ? "Göndərilir…" : "Bəli, göndər"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
          Hamısı <span style={{ opacity: .7, fontWeight: 700 }}>{totalUpcoming}</span>
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
            {s === "all" ? "Hamısı" : s === "confirmed" ? "Təsdiqlənmiş" : "Gözləyir"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Compact agenda row ─────────────────────────────────────────────────── */

function AgendaRow({
  a, isNext, now, sessionNumber, onReschedule, onCancel,
}: {
  a: AppointmentDetail;
  isNext: boolean;
  now: Date;
  sessionNumber: number | null;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  if (!a.startAt) return null;
  const start = new Date(a.startAt);
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  const tu = timeUntil(start, now);
  const isToday = isSameDay(start, now);
  const rowIconBtn: React.CSSProperties = { width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 9, cursor: "pointer" };
  const rowIconBtnDanger: React.CSSProperties = { ...rowIconBtn, color: "#991B1B", border: "1px solid #F3D6D6" };
  return (
    <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderLeft: `3px solid ${status.accent}`, borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 17, fontWeight: 800, minWidth: 52 }}>{fmtTime(start)}</span>
        <span style={{ width: 38, height: 38, borderRadius: 11, background: "#082F6D", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flex: "none" }}>{initialsOf(a.psychologistName)}</span>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>{a.psychologistName ?? "Operator təyin edəcək"}</span>
            {sessionNumber != null && <span style={{ color: "var(--oxford-60)", fontWeight: 500, fontSize: 13 }}>· {azOrdinal(sessionNumber)} seans</span>}
            {isNext && <span style={{ background: "var(--brand-100)", color: "#082F6D", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>Növbəti</span>}
            {a.seriesId != null && a.seriesIndex != null && a.seriesTotal != null && (
              <span style={{ background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal })}
              </span>
            )}
            {isToday && !tu.expired && <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>{tu.text}</span>}
          </div>
        </div>
        <span style={{ background: status.bg, color: status.color, fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999 }}>{status.label}</span>
        {a.status === "CANCEL_REQUESTED" ? (
          <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>operator təsdiqini gözləyir</span>
        ) : (
          <div style={{ display: "flex", gap: 7 }}>
            <JoinSessionButton appointment={a} variant="compact" />
            <button onClick={onReschedule} title={t("staff.cardReschedule")} style={rowIconBtn}><IconClock /></button>
            <button onClick={onCancel} title={t("staff.cardCancel")} style={rowIconBtnDanger}><IconX /></button>
          </div>
        )}
      </div>
      {a.operatorNote && (
        <div style={{ display: "flex", gap: 7, alignItems: "flex-start", marginTop: 9, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "7px 10px" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><path d="M9 12h6M9 16h4M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" /></svg>
          <span style={{ fontSize: 12.5, color: "#92400E", fontWeight: 500, lineHeight: 1.45 }}>Operator qeydi: <span style={{ fontStyle: "italic" }}>«{a.operatorNote.slice(0, 120)}{a.operatorNote.length > 120 ? "…" : ""}»</span></span>
        </div>
      )}
    </div>
  );
}

/* ─── Operator təsdiqi gözləyən müraciət sətri ───────────────────────────── */

function AwaitingOperatorCard({ a }: { a: AppointmentDetail }) {
  const status = STATUS[a.status] ?? STATUS.PENDING;
  const when = a.startAt ?? a.requestedStartAt;
  const psyName = a.psychologistName ?? a.requestedPsychologistName ?? null;
  const hint = a.status === "REJECTED"
    ? "Operator sizə yeni psixoloq təyin edəcək"
    : "Operatorumuz müraciətinizi nəzərdən keçirir";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "1px solid #EDF1F8", borderLeft: `3px solid ${status.accent}`, borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: "13px 15px", flexWrap: "wrap" }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, background: "#FEF3C7", color: "#92400E", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      </span>
      <div style={{ flex: 1, minWidth: 170 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--oxford)" }}>{psyName ?? "Operator psixoloq təyin edəcək"}</div>
        <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, marginTop: 2 }}>
          {when ? `İstədiyiniz vaxt: ${azFormatDate(when)} · ${azFormatTime(when)}` : "Vaxt operator tərəfindən təyin olunacaq"}
        </div>
        {a.note && (
          <div style={{ fontSize: 12.5, color: "var(--oxford)", fontStyle: "italic", fontWeight: 500, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 8, padding: "6px 9px", marginTop: 6, maxWidth: 440 }}>
            «{a.note.slice(0, 100)}{a.note.length > 100 ? "…" : ""}»
          </div>
        )}
        {a.operatorNote && (
          <div style={{ display: "flex", gap: 7, alignItems: "flex-start", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "6px 9px", marginTop: 6, maxWidth: 440 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><path d="M9 12h6M9 16h4M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" /></svg>
            <span style={{ fontSize: 12.5, color: "#92400E", fontWeight: 500, lineHeight: 1.45 }}>Operator qeydi: <span style={{ fontStyle: "italic" }}>«{a.operatorNote.slice(0, 100)}{a.operatorNote.length > 100 ? "…" : ""}»</span></span>
          </div>
        )}
      </div>
      <span style={{ background: status.bg, color: status.color, fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999, flex: "none" }}>{status.label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, flex: "none" }}>
        <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
        {hint}
      </span>
    </div>
  );
}

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

/* ─── Sections wrapper ───────────────────────────────────────────────────── */

function Section({
  title, count, icon, children, defaultCollapsed = false, card = false, collapsible = true,
}: {
  title: string;
  count: number;
  icon: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  card?: boolean;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  const isOpen = collapsible ? open : true;

  const labelRow = (
    <>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--oxford)" }}>{title}</span>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 22, padding: "0 7px", background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 12, fontWeight: 700, borderRadius: 999 }}>{count}</span>
    </>
  );
  const chevron = (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><path d="M6 9l6 6 6-6" /></svg>
  );

  if (card) {
    return (
      <section style={{ marginTop: 22, background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", overflow: "hidden" }}>
        <button type="button" onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", padding: "18px 20px", cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>{labelRow}</span>
          {chevron}
        </button>
        {isOpen && children}
      </section>
    );
  }

  return (
    <section style={{ marginTop: 22 }}>
      <button type="button" onClick={() => collapsible && setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none", padding: "0 0 16px", cursor: collapsible ? "pointer" : "default", textAlign: "left", fontFamily: "inherit" }}>
        {labelRow}
        <span style={{ flex: 1 }} />
        {collapsible && chevron}
      </button>
      {isOpen && children}
    </section>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: 26, textAlign: "center", fontSize: 14, color: "var(--oxford-60)", fontWeight: 600 }}>
      {msg}
    </div>
  );
}

/* ─── Awaiting confirmation card ─────────────────────────────────────────── */

function AwaitingCard({
  a, busyId, onConfirm, onDispute,
}: {
  a: AppointmentDetail;
  busyId: number | null;
  onConfirm: () => void;
  onDispute: () => void;
}) {
  const { t } = useT();
  const status = STATUS[a.status] ?? STATUS.AWAITING_CONFIRMATION;
  const start = a.startAt ? new Date(a.startAt) : null;
  const alreadyConfirmed = !!a.patientConfirmedAt;
  const isDisputed = a.status === "DISPUTED";

  return (
    <div className="psy-card psy-card--today" style={{ borderLeft: `4px solid ${status.accent}` }}>
      <div className="psy-card__top">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="psy-card__time">{a.startAt ? `${azFormatDate(a.startAt).slice(0, 5)} · ${fmtTime(new Date(a.startAt))}` : "—"}</span>
          <span className="psy-card__badge" style={{ color: status.color, background: status.bg }}>
            {status.label}
          </span>
          {a.seriesId != null && a.seriesIndex != null && a.seriesTotal != null && (
            <span className="psy-card__chip" style={{ background: "var(--brand-50)", color: "var(--brand-700)", fontWeight: 600 }}>
              {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal })}
            </span>
          )}
        </div>
      </div>
      <div className="psy-card__body">
        <div className="psy-card__avatar">{initialsOf(a.psychologistName)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="psy-card__name">{a.psychologistName ?? "Psixoloq"}</div>
          <div className="psy-card__ctx">
            {isDisputed ? (
              <span className="psy-card__ctx-quote">Operator komandamız sizinlə əlaqə saxlayacaq.</span>
            ) : alreadyConfirmed ? (
              <span className="psy-card__ctx-quote">Siz təsdiqlədiniz — psixoloqdan gözlənilir</span>
            ) : (
              <span className="psy-card__ctx-quote">Seans baş tutdumu? Qısa təsdiq lazımdır.</span>
            )}
          </div>
        </div>
      </div>
      {!isDisputed && !alreadyConfirmed && (
        <div className="psy-card__actions">
          <button
            disabled={busyId === a.id}
            onClick={onConfirm}
            className="psy-card__btn psy-card__btn--primary">
            {busyId === a.id ? "…" : t("staff.cardConfirm")}
          </button>
          <button
            onClick={onDispute}
            className="psy-card__btn psy-card__btn--ghost">
            {t("staff.cardDispute")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── History row ────────────────────────────────────────────────────────── */

function HistoryRow({
  a, review, feedbackGiven, onWriteReview, onFeedback,
}: {
  a: AppointmentDetail;
  review: MyReview | null;
  feedbackGiven: boolean;
  onWriteReview: () => void;
  onFeedback: () => void;
}) {
  const ref = a.startAt ?? a.endAt;
  if (!ref) return null;
  const status = STATUS[a.status] ?? STATUS.COMPLETED;
  const canReview = a.status === "COMPLETED" && a.psychologistId && !review;
  // Rəy yalnız seansdan sonrakı 24 saat ərzində yazıla bilər. Vaxt keçəndə
  // "Necə keçdi?" düyməsi yox olur (anchor: seansın bitmə vaxtı, yoxdursa başlama).
  const fbAnchor = a.endAt ?? a.startAt;
  const fbStatusOk = a.status === "COMPLETED" || a.status === "AWAITING_CONFIRMATION";
  const fbWindowOpen = fbStatusOk && fbAnchor != null && hoursSince(fbAnchor) <= 24;
  // "Rəyim" badge-i göstərilmir (lazım deyil) — yalnız moderasiya gözləyən rəy üçün işarə qalır.
  const reviewLabel = review && review.status === "PENDING" ? "Rəy gözləyir" : null;
  const isCancelled = a.status === "CANCELLED";
  const cancelWho = a.cancelledBy === "PATIENT" ? "Siz ləğv etdiniz"
    : a.cancelledBy === "PSYCHOLOGIST" ? "Psixoloq ləğv etdi"
    : a.cancelledBy === "OPERATOR" ? "Operator ləğv etdi" : "Ləğv edildi";
  // PATIENT_OTHER ("Digər") faydasızdır — onun yerinə yalnız pasiyentin qeydini göstəririk.
  const cancelReasonTxt = a.cancelReasonCode && a.cancelReasonCode !== "PATIENT_OTHER" ? reasonLabel(a.cancelReasonCode) : "";
  return (
    <div style={{ borderTop: "1px solid #F0F4FA", padding: "13px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 100 }}>{azFormatDate(ref)}</span>
        <span style={{ flex: 1, minWidth: 150, fontSize: 14, color: "var(--oxford-60)", fontWeight: 500 }}>{a.psychologistName ?? "Psixoloq"}</span>
        <span style={{ background: status.bg, color: status.color, fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999 }}>{status.label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {feedbackGiven ? (
            <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>rəy verildi</span>
          ) : fbWindowOpen ? (
            <button onClick={onFeedback} type="button" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              Necə keçdi?
            </button>
          ) : null}
        {canReview ? (
          <button onClick={onWriteReview} type="button" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "#082F6D", border: "1px solid #C7DAF5", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" /></svg>
            Rəy yaz
          </button>
        ) : reviewLabel ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FEF3C7", color: "#92400E", fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" /></svg>
            {reviewLabel}
          </span>
        ) : null}
        </div>
      </div>
      {isCancelled && (a.cancelledBy || a.cancelReasonText || cancelReasonTxt) && (
        <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, marginTop: 7 }}>
          <span style={{ color: "#991B1B", fontWeight: 600 }}>{cancelWho}</span>
          {cancelReasonTxt && <> · {cancelReasonTxt}</>}
          {a.cancelReasonText && <> · «{a.cancelReasonText}»</>}
        </div>
      )}
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
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const updated = await patientApi.cancel(appointment.id, "PATIENT_OTHER", note.trim() || undefined);
      onDone(updated);
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,22,51,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Randevunu ləğv et</h3>
          <p style={{ fontSize: 12.5, color: "var(--oxford-60)", margin: "4px 0 0" }}>
            Ləğv istəyiniz operatora gedəcək — qısaca səbəbi yaza bilərsiniz (məcburi deyil).
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Səbəb (məcburi deyil)"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1.5px solid var(--brand-100)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, margin: "10px 0 0" }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid var(--brand-100)", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer", fontWeight: 600 }}>Geri</button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 20px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "#DC2626", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Göndərilir…" : "Ləğv istəyi göndər"}
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
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      await patientApi.requestRescheduleNote(appointment.id, note.trim() || undefined);
      onDone();
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,22,51,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Vaxtı dəyişmək istəyirəm</h3>
          <p style={{ fontSize: 12.5, color: "var(--oxford-60)", margin: "4px 0 0" }}>
            İstəyinizi operatora göndərin — sizə uyğun yeni vaxtı operator təyin edəcək.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <textarea rows={4} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Hansı vaxt sizə daha uyğundur? (məs. həftə içi axşamlar, və ya konkret tarix)"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1.5px solid var(--brand-100)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, margin: "10px 0 0" }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid var(--brand-100)", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer", fontWeight: 600 }}>Bağla</button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 20px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Göndərilir…" : "İstək göndər"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Reschedule modal (kept from previous version, brand-aligned) ───────── */

function RescheduleModal({
  appointment, onClose, onDone,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const [datetime, setDatetime] = useState("");
  const [note, setNote] = useState(appointment.note ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!datetime) { setErr("Yeni vaxt seçin"); return; }
    const trimmed = note.trim();
    if (trimmed.length < 5) { setErr("Qısa təsvir yazın (ən azı 5 simvol)"); return; }
    setSaving(true);
    try {
      await patientApi.reschedule(appointment.id, {
        note: trimmed,
        requestedPsychologistId: appointment.psychologistId ?? appointment.requestedPsychologistId ?? null,
        requestedStartAt: azLocalToISO(datetime),
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(560px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Vaxtı dəyişdir</h2>
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4 }}>
            Mövcud randevu ləğv ediləcək və yeni müraciət qeydə alınacaq. Operator yeni vaxtı təsdiqləyəcək.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>Yeni vaxt</label>
          <DatePicker withTime value={datetime} onChange={setDatetime} theme="light" size="sm" style={{ width: "100%", marginBottom: 14 }} />

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>Qısa təsvir</label>
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Vaxt dəyişdirmə səbəbi və ya yeni qeydlər"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12 }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Bağla
            </button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Göndərilir…" : "Vaxtı dəyiş"}
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
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      const updated = await patientApi.disputeSession(appointment.id, reason.trim() || undefined);
      onDone(updated);
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(480px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Seans baş tutmadı</h2>
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4 }}>
            Operator komandamız müraciətinizə baxıb sizinlə əlaqə saxlayacaq.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>
            Səbəb (məcburi deyil)
          </label>
          <textarea
            rows={4} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Məsələn: psixoloq qoşulmadı, texniki problem, vaxt uyğun deyildi…"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12 }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Bağla
            </button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#DC2626", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Göndərilir…" : "Operator'a bildir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
