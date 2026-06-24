"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  psychologistApi,
  isSlotConflict,
  type AppointmentDetail,
  type ClientNote,
  type ClientSummary,
  type RescheduleProposal,
  type Referral,
} from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import CancelModal from "@/components/CancelModal";
import RescheduleComposeModal from "@/components/RescheduleComposeModal";
import JoinSessionButton from "@/components/JoinSessionButton";
import PsyReferralsView from "@/components/PsyReferralsView";
import { useT } from "@/lib/i18n/LocaleProvider";

const WEEKDAYS_AZ = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"];
const MONTHS_AZ = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtTime(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function relativeDayLabel(d: Date, now: Date) {
  const today = new Date(now);
  const tomorrow = new Date(now); tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(d, today)) return "Bu gün";
  if (isSameDay(d, tomorrow)) return "Sabah";
  const isoDow = (d.getDay() + 6) % 7;
  return `${WEEKDAYS_AZ[isoDow]} · ${pad2(d.getDate())} ${MONTHS_AZ[d.getMonth()]}`;
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
  PENDING:               { label: "Yeni",          color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  ASSIGNED:              { label: "Sizə təyin",    color: "var(--brand-700)", bg: "var(--brand-50)", accent: "var(--brand)" },
  CONFIRMED:             { label: "Təsdiqli",      color: "#065F46",          bg: "#D1FAE5",         accent: "#10B981" },
  AWAITING_CONFIRMATION: { label: "Təsdiq gözlənir", color: "#92400E",        bg: "#FEF3C7",         accent: "#F59E0B" },
  DISPUTED:              { label: "Mübahisəli",    color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  COMPLETED:             { label: "Tamamlandı",    color: "#374151",          bg: "#F3F4F6",         accent: "#9CA3AF" },
  CANCELLED:             { label: "Ləğv",          color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  REJECTED:              { label: "Rədd",          color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
};

const ACTIVE_STATUSES = new Set(["ASSIGNED", "CONFIRMED"]);

// Option B-də keçmiş seans avtomatik "Tamamlandı" olur. Seans əslində baş tutmadısa,
// psixoloq onu bu pəncərə ərzində "baş tutmadı" kimi bildirə bilər (köhnə tarixçəni
// yenidən açmamaq üçün məhdudlaşdırılıb). Bildiriş operator həllinə yönləndirilir.
const NO_SHOW_REPORT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/* ─── Inline line icons (no emojis) ──────────────────────────────────────── */
type IcoProps = { s?: number; c?: string };
function IClock({ s = 14, c = "#5C6B85" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>; }
function IDots({ s = 16, c = "#5C6B85" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill={c} aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>; }
function IMsg({ s = 14, c = "#9DB0CC" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>; }
function ICal({ s = 20, c = "currentColor" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>; }
function IGrid({ s = 20, c = "currentColor" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>; }
function IAlert({ s = 20, c = "currentColor" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>; }
function IRefresh({ s = 18, c = "var(--brand)" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>; }
function ICheck({ s = 13, c = "currentColor" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6L9 17l-5-5" /></svg>; }
function IUser({ s = 18, c = "var(--brand)" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>; }
function IX({ s = 18, c = "currentColor" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>; }

/* Stable per-patient avatar tint from a small brand-friendly palette. */
const AVATAR_COLORS = ["#082F6D", "#1051B7", "#0F766E", "#6D28D9", "#B45309", "#9D174D"];
function avatarColor(seed: string | number | null | undefined) {
  const str = String(seed ?? "?");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function PsychologistAppointmentsPage() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [notesByPatient, setNotesByPatient] = useState<Record<number, ClientNote | null>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  const [disputeFor, setDisputeFor] = useState<AppointmentDetail | null>(null);
  const [rejectFor, setRejectFor] = useState<AppointmentDetail | null>(null);
  const [cancelFor, setCancelFor] = useState<AppointmentDetail | null>(null);
  const [rescheduleProposeFor, setRescheduleProposeFor] = useState<AppointmentDetail | null>(null);
  const [outcomeFor, setOutcomeFor] = useState<AppointmentDetail | null>(null);
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Yönləndirmələr" — bildiriş deep-link-i (?view=referrals) həmin tabı açır.
  const [view, setView] = useState<"ALL" | "TODAY" | "WEEK" | "ATTENTION" | "HISTORY" | "REFERRALS">(
    () => (searchParams.get("view") === "referrals" ? "REFERRALS" : "ALL"));
  const [referralPending, setReferralPending] = useState(0);
  const [selectedPkg, setSelectedPkg] = useState<number | null>(null);
  // GAP-03: incoming patient-initiated reschedule requests awaiting my decision
  const [patientRequests, setPatientRequests] = useState<RescheduleProposal[]>([]);

  // Tick every minute so countdown stays fresh
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.myAppointments(),
      psychologistApi.clients().catch(() => [] as ClientSummary[]),
      psychologistApi.myRescheduleProposals().catch(() => [] as RescheduleProposal[]),
      psychologistApi.receivedReferrals().catch(() => [] as Referral[]),
    ])
      .then(([appts, cs, props, refs]) => {
        setItems(appts);
        setClients(cs);
        setPatientRequests(props.filter(p => p.initiator === "PATIENT" && p.status === "PENDING"));
        setReferralPending(refs.filter(r => r.status === "PENDING_REVIEW").length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    return subscribeNotifications((n) => {
      if (typeof n.type === "string"
        && (n.type.startsWith("APPOINTMENT_") || n.type.startsWith("RESCHEDULE_") || n.type.startsWith("REFERRAL_"))) load();
    });

  }, []);

  const today = useMemo(() => {
    return items
      .filter(a => a.startAt && isSameDay(new Date(a.startAt), now))
      .filter(a => ACTIVE_STATUSES.has(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
  }, [items, now]);

  const next = useMemo(() => {
    return items
      .filter(a => a.startAt && new Date(a.startAt).getTime() > now.getTime() - 30 * 60_000)
      .filter(a => ACTIVE_STATUSES.has(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())[0] ?? null;
  }, [items, now]);

  const thisWeek = useMemo(() => {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return items
      .filter(a => a.startAt
        && new Date(a.startAt).getTime() > now.getTime()
        && new Date(a.startAt).getTime() < weekEnd.getTime()
        && !isSameDay(new Date(a.startAt), now)
      )
      .filter(a => ACTIVE_STATUSES.has(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
  }, [items, now]);

  const history = useMemo(() => {
    return items
      .filter(a => ["COMPLETED", "CANCELLED", "REJECTED"].includes(a.status))
      .sort((a, b) => {
        const da = new Date(a.startAt ?? a.endAt ?? 0).getTime();
        const db = new Date(b.startAt ?? b.endAt ?? 0).getTime();
        return db - da;
      });
  }, [items]);

  const awaitingConfirm = useMemo(() => {
    return items
      .filter(a => a.status === "AWAITING_CONFIRMATION" || a.status === "DISPUTED")
      .sort((a, b) => {
        const da = new Date(a.endAt ?? a.startAt ?? 0).getTime();
        const db = new Date(b.endAt ?? b.startAt ?? 0).getTime();
        return db - da;
      });
  }, [items]);

  // Single unified list driven by the active filter — no separate sections.
  const visible = useMemo(() => {
    if (view === "TODAY") return today;
    if (view === "WEEK") return thisWeek;
    if (view === "ATTENTION") return awaitingConfirm;
    if (view === "HISTORY") return history;
    const all = [...awaitingConfirm, ...today, ...thisWeek];
    const seen = new Set<number>();
    return all
      .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; })
      .sort((a, b) => new Date(a.startAt ?? 0).getTime() - new Date(b.startAt ?? 0).getTime());
  }, [view, today, thisWeek, awaitingConfirm, history]);

  // Paket pasiyentləri — patientPackageId-ə görə qruplaşdır (tam proqram görünüşü).
  const packages = useMemo(() => {
    const map = new Map<number, AppointmentDetail[]>();
    for (const a of items) {
      if (a.patientPackageId != null) {
        const arr = map.get(a.patientPackageId) ?? [];
        arr.push(a);
        map.set(a.patientPackageId, arr);
      }
    }
    return Array.from(map.entries()).map(([id, appts]) => ({
      id,
      patientId: appts[0].patientId ?? null,
      patientName: appts[0].patientName ?? "Pasiyent",
      sessions: [...appts].sort((x, y) =>
        new Date(x.startAt ?? x.createdAt).getTime() - new Date(y.startAt ?? y.createdAt).getTime()),
    })).sort((a, b) => a.patientName.localeCompare(b.patientName, "az"));
  }, [items]);

  // "Tək seanslar" = paketə aid olmayan, filterə uyğun randevular.
  const singlesVisible = useMemo(() => visible.filter(a => a.patientPackageId == null), [visible]);

  useEffect(() => {
    if (packages.length && (selectedPkg == null || !packages.some(p => p.id === selectedPkg))) {
      setSelectedPkg(packages[0].id);
    }
  }, [packages, selectedPkg]);

  // Lazy-fetch latest clinical note for today's appointments + the next session
  useEffect(() => {
    const ids = new Set<number>();
    if (next?.patientId) ids.add(next.patientId);
    today.forEach(a => { if (a.patientId) ids.add(a.patientId); });
    const targets = Array.from(ids).filter(id => !(id in notesByPatient));
    if (!targets.length) return;
    targets.forEach(id => {
      psychologistApi.notesForPatient(id)
        .then(notes => setNotesByPatient(prev => ({ ...prev, [id]: notes[0] ?? null })))
        .catch(() => setNotesByPatient(prev => ({ ...prev, [id]: null })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, next]);

  const action = async (id: number, fn: () => Promise<AppointmentDetail>) => {
    setError(null);
    setBusyId(id);
    try {
      const updated = await fn();
      setItems(prev => prev.map(a => a.id === id ? updated : a));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const clientFor = (id?: number | null) =>
    id ? clients.find(c => c.patientId === id) ?? null : null;
  const noteFor = (id?: number | null) =>
    id ? notesByPatient[id] : undefined;

  return (
    <div className="psy-appt-page">
      <style>{`
.gor-tabs::-webkit-scrollbar{height:0}
.gor-grid{display:grid;grid-template-columns:minmax(0,1fr) 326px;gap:20px;align-items:start}
.gor-rail{position:sticky;top:24px;display:flex;flex-direction:column;gap:14px}
@media(max-width:920px){.gor-grid{grid-template-columns:1fr}.gor-rail{position:static}}
.gor-menu:hover{border-color:var(--brand)!important}
.gor-link:hover{border-color:var(--brand)!important}
.gor-accept:hover{background:var(--brand-700)!important}
.gor-decline:hover{background:#FEE2E2!important}
.gor-sheet-item:hover{background:#F8FAFD!important}
.gor-sheet-item--danger:hover{background:#FEE2E2!important}
@keyframes gorFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes gorSheet{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.02em", color: "var(--oxford)", margin: "0 0 6px" }}>{t("staff.psyApptTitle")}</h1>
        <p style={{ fontSize: 15, color: "var(--oxford-60)", fontWeight: 500, margin: 0 }}>
          {t("staff.psyApptSub")}
        </p>
        {/* "Tarix aralığı ləğv et" düyməsi müvəqqəti gizlədilib — funksionallıq sonra tamamlanacaq (modal/state aşağıda saxlanılıb). */}
      </header>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>
          {t("common.loading")}
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" style={{
              fontSize: 12.5, fontWeight: 600, color: "#991B1B", background: "#FEE2E2",
              border: "1px solid #FECACA", borderRadius: 10, padding: "10px 12px", marginBottom: 14,
            }}>{error}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 13, marginBottom: 20 }}>
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "15px 17px", display: "flex", alignItems: "center", gap: 13 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: "#E4ECFA", color: "#1051B7", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><ICal s={19} /></span>
              <div><div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{today.length}</div><div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginTop: 2 }}>Bu gün</div></div>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "15px 17px", display: "flex", alignItems: "center", gap: 13 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: "#E4ECFA", color: "#1051B7", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><IUser s={19} c="#1051B7" /></span>
              <div><div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{thisWeek.length}</div><div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginTop: 2 }}>Bu həftə</div></div>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "15px 17px", display: "flex", alignItems: "center", gap: 13 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: "#D1FAE5", color: "#065F46", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><IClock s={19} c="#065F46" /></span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{next && next.startAt ? fmtTime(new Date(next.startAt)) : "—"}</div>
                <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginTop: 2 }}>
                  {next && next.startAt ? `${relativeDayLabel(new Date(next.startAt), now)} · növbəti` : "Növbəti seans yox"}
                </div>
              </div>
            </div>
            {(awaitingConfirm.length + patientRequests.length) > 0 && (
              <div style={{ background: "#FFFBEB", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #FDE68A", borderLeft: "3px solid #B45309", padding: "15px 17px", display: "flex", alignItems: "center", gap: 13 }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: "#FEF3C7", color: "#92400E", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><IAlert s={19} c="#92400E" /></span>
                <div><div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: "#92400E" }}>{awaitingConfirm.length + patientRequests.length}</div><div style={{ fontSize: 12, color: "#92400E", fontWeight: 600, marginTop: 2 }}>Diqqət tələb edir</div></div>
              </div>
            )}
          </div>

          <NextHero appt={next} now={now} client={next ? clientFor(next.patientId) : null} />

          <div className="gor-tabs" style={{ display: "flex", gap: 4, borderBottom: "1px solid #E1E9F5", overflowX: "auto", marginBottom: 20 }}>
            <FilterTab active={view === "ALL"} onClick={() => setView("ALL")}>Hamısı</FilterTab>
            <FilterTab active={view === "TODAY"} count={today.length} onClick={() => setView("TODAY")}>Bu gün</FilterTab>
            <FilterTab active={view === "WEEK"} count={thisWeek.length} onClick={() => setView("WEEK")}>Bu həftə</FilterTab>
            <FilterTab active={view === "ATTENTION"} count={awaitingConfirm.length + patientRequests.length} warn onClick={() => setView("ATTENTION")}>Diqqət</FilterTab>
            <FilterTab active={view === "HISTORY"} count={history.length} onClick={() => setView("HISTORY")}>Tarixçə</FilterTab>
            <span aria-hidden style={{ width: 1, alignSelf: "stretch", background: "#E1E9F5", margin: "6px 4px" }} />
            <FilterTab active={view === "REFERRALS"} count={referralPending} warn={referralPending > 0} onClick={() => setView("REFERRALS")}>Yönləndirmələr</FilterTab>
          </div>

          {view === "REFERRALS" && (
            <PsyReferralsView onPendingCount={setReferralPending} />
          )}

          {(view === "ALL" || view === "ATTENTION") && patientRequests.length > 0 && (
            <div style={{ display: "grid", gap: 12, marginBottom: 22 }}>
              {patientRequests.map(p => (
                <PatientRescheduleRequestCard
                  key={p.id}
                  proposal={p}
                  onDecided={(nextP) => {
                    setPatientRequests(prev => prev.filter(x => x.id !== nextP.id));
                    load();
                  }}
                />
              ))}
            </div>
          )}

          {view === "ALL" && packages.length > 0 && (() => {
            const sel = packages.find(p => p.id === selectedPkg) ?? packages[0];
            return (
              <div style={{ marginBottom: 26 }}>
                <SectionLabel text="Paketli pasiyentlər" count={packages.length} />
                <OwnerChips packages={packages} selected={sel.id} onSelect={setSelectedPkg} />
                <PackageCard
                  pkg={sel}
                  now={now}
                  busyId={busyId}
                  onAction={action}
                  onDispute={setDisputeFor}
                  onReject={setRejectFor}
                  onCancel={setCancelFor}
                  onPropose={setRescheduleProposeFor}
                  onAddOutcome={setOutcomeFor}
                />
              </div>
            );
          })()}

          {view === "ALL" && <SectionLabel text="Tək seanslar" count={singlesVisible.length} />}

          {view !== "REFERRALS" && (() => {
            const list = view === "ALL" ? singlesVisible : visible;
            if (list.length === 0) {
              return <Empty msg={view === "ALL" ? "Tək seans yoxdur." : "Bu kateqoriyada randevu yoxdur."} />;
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {list.map(a => (
                  <SingleCard
                    key={a.id}
                    a={a}
                    client={clientFor(a.patientId)}
                    note={noteFor(a.patientId)}
                    isNext={next?.id === a.id}
                    now={now}
                    busyId={busyId}
                    onAction={action}
                    onDispute={setDisputeFor}
                    onReject={setRejectFor}
                    onCancel={setCancelFor}
                    onPropose={setRescheduleProposeFor}
                    onAddOutcome={setOutcomeFor}
                  />
                ))}
              </div>
            );
          })()}

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
          {rejectFor && (
            <CancelModal
              appointment={rejectFor}
              role="PSYCHOLOGIST"
              mode="reject"
              onClose={() => setRejectFor(null)}
              onDone={(updated) => {
                setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
                setRejectFor(null);
              }}
            />
          )}
          {cancelFor && (
            <CancelModal
              appointment={cancelFor}
              role="PSYCHOLOGIST"
              mode="cancel"
              onClose={() => setCancelFor(null)}
              onDone={(updated) => {
                setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
                setCancelFor(null);
              }}
            />
          )}
          {rescheduleProposeFor && (
            <RescheduleComposeModal
              appointment={rescheduleProposeFor}
              onClose={() => setRescheduleProposeFor(null)}
              onCreated={() => { setRescheduleProposeFor(null); load(); }}
            />
          )}
          {outcomeFor && (
            <OutcomeModal
              appointment={outcomeFor}
              onClose={() => setOutcomeFor(null)}
              onSaved={() => setOutcomeFor(null)}
            />
          )}
          {bulkCancelOpen && (
            <BulkCancelModal
              appointments={items}
              onClose={() => setBulkCancelOpen(false)}
              onDone={() => { setBulkCancelOpen(false); load(); }}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ═══ Yeni kart əsaslı dizayn (hero · paket · tək seans) ═══════════════════ */

type Handlers = {
  onAction: (id: number, fn: () => Promise<AppointmentDetail>) => Promise<void>;
  onDispute: (a: AppointmentDetail) => void;
  onReject: (a: AppointmentDetail) => void;
  onCancel: (a: AppointmentDetail) => void;
  onPropose: (a: AppointmentDetail) => void;
  onAddOutcome: (a: AppointmentDetail) => void;
};

function SectionLabel({ text, count }: { text: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--oxford-60)" }}>{text}</span>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 6px", background: "#F2F6FD", color: "#082F6D", fontSize: 11, fontWeight: 700, borderRadius: 999 }}>{count}</span>
    </div>
  );
}

function NextHero({ appt, now, client }: { appt: AppointmentDetail | null; now: Date; client: ClientSummary | null }) {
  if (!appt || !appt.startAt) {
    return (
      <div style={{ background: "linear-gradient(135deg,#F2F6FD,#E4ECFA)", border: "1px solid #D6E2F7", borderRadius: 18, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12, color: "var(--oxford-60)" }}>
        <ICal s={22} c="#9DB0CC" /><span style={{ fontSize: 14, fontWeight: 600 }}>Yaxınlaşan təsdiqli seans yoxdur.</span>
      </div>
    );
  }
  const start = new Date(appt.startAt);
  const cd = timeUntil(start, now);
  const av = "#082F6D";
  const sessionNumber = client ? client.completedSessions + 1 : null;
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#F2F6FD,#E4ECFA)", border: "1px solid #D6E2F7", borderRadius: 18, padding: "22px 24px", marginBottom: 24, boxShadow: "0 2px 12px rgba(8,47,109,.07)" }}>
      <div aria-hidden style={{ position: "absolute", top: -60, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(16,81,183,.1),transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--brand)", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 999 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />Növbəti seans
        </span>
        {!cd.expired && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: cd.urgent ? "#FEF3C7" : "#ECFDF5", color: cd.urgent ? "#92400E" : "#047857", border: `1px solid ${cd.urgent ? "#FDE68A" : "#A7F3D0"}`, fontSize: 13, fontWeight: 700, padding: "7px 13px", borderRadius: 999 }}>
            <IClock s={14} c={cd.urgent ? "#92400E" : "#047857"} />{cd.text}
          </span>
        )}
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ width: 56, height: 56, borderRadius: "50%", background: av, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flex: "none" }}>{initialsOf(appt.patientName)}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>{appt.patientName ?? "Pasiyent"}</div>
          <div style={{ fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 600 }}>{relativeDayLabel(start, now)} · {fmtTime(start)}{sessionNumber ? ` · ${sessionNumber}-ci seans` : ""}</div>
        </div>
        <JoinSessionButton appointment={appt} variant="compact" />
      </div>
    </div>
  );
}

function OwnerChips({ packages, selected, onSelect }: {
  packages: { id: number; patientName: string; patientId: number | null; sessions: AppointmentDetail[] }[];
  selected: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="gor-tabs" style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
      {packages.map(p => {
        const active = p.id === selected;
        const total = p.sessions[0]?.packageTotal ?? p.sessions.length;
        const done = p.sessions.filter(s => s.status === "COMPLETED").length;
        const av = avatarColor(p.patientId ?? p.patientName);
        return (
          <button key={p.id} type="button" onClick={() => onSelect(p.id)}
            style={{ display: "inline-flex", alignItems: "center", gap: 9, background: active ? "var(--brand)" : "#fff", border: `1px solid ${active ? "var(--brand)" : "#D6E2F7"}`, borderRadius: 999, padding: "6px 13px 6px 7px", fontSize: 13, fontWeight: 600, color: active ? "#fff" : "var(--oxford)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flex: "none" }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: active ? "rgba(255,255,255,.22)" : av, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flex: "none" }}>{initialsOf(p.patientName)}</span>
            {p.patientName}
            <span style={{ background: active ? "rgba(255,255,255,.22)" : "#F2F6FD", color: active ? "#fff" : "#082F6D", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{done}/{total}</span>
          </button>
        );
      })}
    </div>
  );
}

function ActBtn({ children, onClick, busy, variant = "primary", small, icon }: {
  children: React.ReactNode; onClick?: () => void; busy?: boolean; variant?: "primary" | "ghost"; small?: boolean; icon?: React.ReactNode;
}) {
  const skin = variant === "primary"
    ? { background: "var(--brand)", color: "#fff", border: "none" }
    : { background: "#fff", color: "#082F6D", border: "1px solid #C7DAF5" };
  return (
    <button type="button" className={variant === "primary" ? "gor-accept" : "gor-link"} disabled={busy} onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: small ? 6 : 7, borderRadius: small ? 8 : 9, padding: small ? "7px 12px" : "9px 15px", fontSize: small ? 12.5 : 13.5, fontWeight: 600, fontFamily: "inherit", cursor: busy ? "wait" : "pointer", flex: "none", opacity: busy ? 0.7 : 1, ...skin }}>
      {icon}{children}
    </button>
  );
}

function RowMenu({ items, size = 36 }: { items: MenuItem[]; size?: number }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div style={{ position: "relative", flex: "none" }}>
      <button type="button" className="gor-menu" aria-label="Əməliyyatlar" onClick={() => setOpen(o => !o)}
        style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: size >= 36 ? 9 : 8, cursor: "pointer" }}>
        <IDots s={size >= 36 ? 17 : 16} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 19 }} aria-hidden />
          <div role="menu" style={{ position: "absolute", right: 0, top: size + 6, zIndex: 20, width: 192, background: "#fff", border: "1px solid #E1E9F5", borderRadius: 11, boxShadow: "0 12px 40px rgba(8,47,109,.18)", padding: 6, animation: "gorFade .16s ease" }}>
            {items.map((it, i) => {
              const st: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", background: "none", border: "none", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontWeight: 600, color: it.danger ? "#991B1B" : "var(--oxford)", cursor: "pointer", fontFamily: "inherit", textDecoration: "none" };
              const cls = `gor-sheet-item${it.danger ? " gor-sheet-item--danger" : ""}`;
              return it.href
                ? <Link key={i} href={it.href} className={cls} style={st} onClick={() => setOpen(false)}>{it.icon}<span>{it.label}</span></Link>
                : <button key={i} type="button" className={cls} style={st} onClick={() => { setOpen(false); it.onClick?.(); }}>{it.icon}<span>{it.label}</span></button>;
            })}
          </div>
        </>
      )}
    </div>
  );
}

function buildMenu(a: AppointmentDetail, h: Handlers, now: Date): MenuItem[] {
  const m: MenuItem[] = [];
  const endMs = a.endAt ? new Date(a.endAt).getTime() : null;
  const expired = endMs != null && endMs < now.getTime();
  const reportableNoShow = endMs != null && expired && now.getTime() - endMs < NO_SHOW_REPORT_WINDOW_MS;
  const noShowItem: MenuItem = { label: "Baş tutmadı", onClick: () => h.onDispute(a), icon: <IAlert s={15} c="#5C6B85" /> };
  if (a.status === "ASSIGNED") {
    m.push({ label: "Vaxt təklif et", onClick: () => h.onPropose(a), icon: <IClock /> });
    m.push({ label: "Rədd et", onClick: () => h.onReject(a), danger: true, icon: <IX /> });
  } else if (a.status === "CONFIRMED") {
    m.push({ label: "Vaxt təklif et", onClick: () => h.onPropose(a), icon: <IClock /> });
    if (!expired) m.push({ label: "Ləğv et", onClick: () => h.onCancel(a), danger: true, icon: <IX /> });
    else {
      m.push(noShowItem);
      m.push({ label: "Seans qeydi", onClick: () => h.onAddOutcome(a), icon: <IMsg c="var(--brand)" /> });
    }
  } else if (a.status === "AWAITING_CONFIRMATION") {
    m.push(noShowItem);
    m.push({ label: "Nəticə əlavə et", onClick: () => h.onAddOutcome(a), icon: <IMsg c="var(--brand)" /> });
  } else if (a.status === "COMPLETED" && reportableNoShow) {
    // Avtomatik tamamlanmış, lakin əslində baş tutmamış seansı operatora bildir.
    m.push(noShowItem);
  }
  if (a.patientId) m.push({ label: "Müştəri 360°", href: `/psycholog/clients/${a.patientId}`, icon: <IUser /> });
  return m;
}

function primaryAction(a: AppointmentDetail, h: Handlers, busy: boolean, small?: boolean): React.ReactNode {
  if (a.status === "ASSIGNED")
    return <ActBtn busy={busy} small={small} icon={<ICheck c="#fff" />} onClick={() => h.onAction(a.id, () => psychologistApi.confirm(a.id))}>Təsdiqlə</ActBtn>;
  if (a.status === "CONFIRMED")
    return <JoinSessionButton appointment={a} variant="compact" />;
  if (a.status === "AWAITING_CONFIRMATION")
    return <ActBtn busy={busy} small={small} icon={<ICheck c="#fff" />} onClick={() => h.onAction(a.id, () => psychologistApi.confirmSession(a.id))}>Baş tutdu</ActBtn>;
  if (a.status === "COMPLETED")
    return <ActBtn variant="ghost" small={small} icon={<IMsg c="var(--brand)" />} onClick={() => h.onAddOutcome(a)}>Nəticə / qeyd</ActBtn>;
  return null;
}

function SingleCard({ a, client, note, isNext, now, busyId, ...h }: {
  a: AppointmentDetail; client: ClientSummary | null; note: ClientNote | null | undefined; isNext: boolean; now: Date; busyId: number | null;
} & Handlers) {
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  const start = a.startAt ? new Date(a.startAt) : (a.endAt ? new Date(a.endAt) : null);
  const av = avatarColor(a.patientId ?? a.patientName);
  const busy = busyId === a.id;
  const sessionNumber = client ? client.completedSessions + 1 : null;
  const menu = buildMenu(a, h, now);
  const primary = primaryAction(a, h, busy);
  const meta = `${start ? `${relativeDayLabel(start, now)} · ${fmtTime(start)}` : "Vaxt yoxdur"}${sessionNumber ? ` · ${sessionNumber}-ci seans` : ""}`;
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: isNext ? "0 6px 20px rgba(16,81,183,.12)" : "0 2px 12px rgba(0,0,0,.06)", border: `1px solid ${isNext ? "#C7DBF6" : "#EDF1F8"}`, borderLeft: `3px solid ${status.accent}`, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", animation: "gorFade .2s ease" }}>
      <span style={{ width: 46, height: 46, borderRadius: 13, background: av, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, flex: "none" }}>{initialsOf(a.patientName)}</span>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{a.patientName ?? "Pasiyent"}</div>
        <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>{meta}</div>
        {a.note && (
          <div style={{ fontSize: 12.5, color: "var(--oxford)", fontStyle: "italic", fontWeight: 500, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 8, padding: "7px 10px", marginTop: 6, maxWidth: 440 }}>«{a.note.slice(0, 100)}{a.note.length > 100 ? "…" : ""}»</div>
        )}
        {a.status === "DISPUTED" && (
          <div style={{ fontSize: 12, color: "#991B1B", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <IAlert s={13} c="#991B1B" />Operator həll edir — qərar gözlənilir
          </div>
        )}
      </div>
      <span style={{ background: status.bg, color: status.color, fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999, flex: "none" }}>{status.label}</span>
      {primary}
      <RowMenu items={menu} />
    </div>
  );
}

const pkgStatLab: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: "#8AAABF", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 };
const pkgStatVal: React.CSSProperties = { fontSize: 13, fontWeight: 700 };

function PackageCard({ pkg, now, busyId, ...h }: {
  pkg: { id: number; patientId: number | null; patientName: string; sessions: AppointmentDetail[] };
  now: Date; busyId: number | null;
} & Handlers) {
  const [open, setOpen] = useState(true);
  const sessions = pkg.sessions;
  const total = sessions[0]?.packageTotal ?? sessions.length;
  const name = sessions[0]?.packageName || `${total} seanslıq proqram`;
  const completed = sessions.filter(s => s.status === "COMPLETED").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  // "Qalan" = balans (planlanmamış seans) — pasiyent/operator panelləri ilə eyni
  // metrika. (Əvvəl total−completed idi → planlanmış amma keçməmiş seans fərq yaradırdı.)
  const remaining = Math.max(0, total - sessions.length);
  const fmtDM = (iso?: string | null) => { if (!iso) return "—"; const d = new Date(iso); return `${d.getDate()} ${MONTHS_AZ[d.getMonth()]}`; };
  const dated = sessions.filter(s => s.startAt);
  const range = dated.length
    ? `${fmtDM(dated[0].startAt)} – ${fmtDM(dated[dated.length - 1].startAt)} ${new Date(dated[dated.length - 1].startAt!).getFullYear()}`
    : "—";
  const av = avatarColor(pkg.patientId ?? pkg.patientName);
  const upcoming = sessions.find(s => s.startAt && new Date(s.startAt).getTime() >= now.getTime() - 30 * 60_000
    && (s.status === "CONFIRMED" || s.status === "ASSIGNED" || s.status === "AWAITING_CONFIRMATION"));
  const upStatus = upcoming ? (STATUS[upcoming.status] ?? STATUS.ASSIGNED) : null;

  return (
    <div style={{ background: "linear-gradient(180deg,#F8FBFF,#fff 130px)", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #E4ECFA", padding: 21 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 15 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#E4ECFA", color: "#082F6D", fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 7, marginBottom: 9 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /></svg>Paket
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span style={{ fontSize: 17, fontWeight: 800 }}>{name}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: av, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{initialsOf(pkg.patientName)}</span>{pkg.patientName}
            </span>
          </div>
        </div>
        <span style={{ background: "#F2F6FD", border: "1px solid #D6E2F7", color: "#082F6D", fontSize: 21, fontWeight: 800, padding: "6px 14px", borderRadius: 11, flex: "none" }}>{completed}<span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford-60)" }}>/{total}</span></span>
      </div>
      <div style={{ marginBottom: 13 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}><span style={{ fontSize: 12.5, fontWeight: 700, color: "#082F6D" }}>Gedişat</span><span style={{ fontSize: 12, fontWeight: 700, color: "var(--oxford-60)" }}>{pct}%</span></div>
        <div style={{ height: 9, background: "#E4ECFA", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#1051B7,#3A74D6)", borderRadius: 999 }} /></div>
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "11px 0", borderTop: "1px solid #EDF1F8", borderBottom: "1px solid #EDF1F8", marginBottom: 6 }}>
        <div><div style={pkgStatLab}>Aralıq</div><div style={pkgStatVal}>{range}</div></div>
        <div><div style={pkgStatLab}>Qalan</div><div style={pkgStatVal}>{remaining}</div></div>
      </div>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "none", border: "none", padding: "11px 0 0", cursor: "pointer", fontFamily: "inherit", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--oxford-60)", flexWrap: "wrap" }}>
          Növbəti: <span style={{ color: "var(--oxford)", fontWeight: 700 }}>{upcoming && upcoming.startAt ? `${fmtDM(upcoming.startAt)} · ${fmtTime(new Date(upcoming.startAt))}` : "—"}</span>
          {upStatus && <span style={{ background: upStatus.bg, color: upStatus.color, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{upStatus.label}</span>}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--brand)" }}>
          {open ? "Seansları gizlət" : "Seansları gör"}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 6 }}>
          {sessions.map((s, i) => <PackageSessionRow key={s.id} a={s} index={i + 1} now={now} busyId={busyId} {...h} />)}
          {Array.from({ length: remaining }).map((_, i) => (
            <div key={`rem-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: "1px solid #F4F7FB", flexWrap: "wrap" }}>
              <span style={{ width: 22, height: 22, borderRadius: 7, background: "#fff", border: "1.5px solid #D6E2F7", color: "#9DB0CC", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{sessions.length + i + 1}</span>
              <div style={{ width: 108, flex: "none" }}><span style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford-60)" }}>—</span></div>
              <span style={{ flex: 1, minWidth: 60, fontSize: 11.5, color: "#9DB0CC", fontWeight: 600 }}>planlaşmayıb</span>
              <span style={{ background: "#F2F6FD", color: "#082F6D", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>Qalıb</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PackageSessionRow({ a, index, now, busyId, ...h }: {
  a: AppointmentDetail; index: number; now: Date; busyId: number | null;
} & Handlers) {
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  const start = a.startAt ? new Date(a.startAt) : null;
  const busy = busyId === a.id;
  const menu = buildMenu(a, h, now);
  const primary = primaryAction(a, h, busy, true);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: "1px solid #F4F7FB", flexWrap: "wrap" }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, background: status.bg, color: status.color, fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{index}</span>
      <div style={{ width: 108, flex: "none" }}>
        {start
          ? <><span style={{ fontSize: 13, fontWeight: 700 }}>{start.getDate()} {MONTHS_AZ[start.getMonth()]}</span> <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 700 }}>{fmtTime(start)}</span></>
          : <span style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford-60)" }}>—</span>}
      </div>
      <span style={{ flex: 1, minWidth: 50 }} />
      <span style={{ background: status.bg, color: status.color, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, flex: "none" }}>{status.label}</span>
      {primary}
      <RowMenu items={menu} size={30} />
    </div>
  );
}

/* ─── Right rail: next-session card + at-a-glance, fills the side on wide screens ── */

function RailNext({
  appt, now,
}: {
  appt: AppointmentDetail | null;
  now: Date;
}) {
  if (!appt || !appt.startAt) {
    return (
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 14 }}>Növbəti seans</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--oxford-60)", fontWeight: 500 }}>
          <span>Yaxınlaşan seans yoxdur.</span>
          <Link href="/psycholog/clients" style={{ color: "var(--brand)", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>Müştərilərə bax</Link>
        </div>
      </div>
    );
  }
  const start = new Date(appt.startAt);
  const tu = timeUntil(start, now);
  const cdBg = tu.urgent || tu.expired ? "#FEF3C7" : "#ECFDF5";
  const cdColor = tu.urgent || tu.expired ? "#92400E" : "#047857";
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 8px 30px rgba(8,47,109,.10)", border: "1px solid #EDF1F8", padding: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 14 }}>Növbəti seans</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ width: 46, height: 46, borderRadius: 13, background: avatarColor(appt.patientId ?? appt.patientName), color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, flex: "none" }}>{initialsOf(appt.patientName)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{appt.patientName ?? "Pasient"}</div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, marginTop: 1 }}>{relativeDayLabel(start, now)} · {fmtTime(start)}</div>
        </div>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: cdBg, color: cdColor, fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: 999, marginBottom: 14 }}><IClock s={13} c={cdColor} />{tu.text}</div>
      <div>
        <JoinSessionButton appointment={appt} variant="compact" />
      </div>
    </div>
  );
}

function RailGlance({
  todayCount, weekCount, doneCount,
}: {
  todayCount: number;
  weekCount: number;
  doneCount: number;
}) {
  const row = (label: string, val: number) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 600 }}>{label}</span>
      <strong style={{ fontSize: 15, fontWeight: 800, color: "var(--oxford)" }}>{val}</strong>
    </div>
  );
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 14 }}>Bir baxışda</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 14 }}>
        {row("Bu gün", todayCount)}
        {row("Bu həftə", weekCount)}
        {row("Tamamlanmış", doneCount)}
      </div>
      <div style={{ display: "flex", gap: 9, paddingTop: 14, borderTop: "1px solid #F0F4FA" }}>
        <Link href="/psycholog/clients" className="gor-link" style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none", padding: 9, border: "1px solid #D6E2F7", borderRadius: 9 }}>Müştərilər</Link>
        <Link href="/psycholog/availability" className="gor-link" style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none", padding: 9, border: "1px solid #D6E2F7", borderRadius: 9 }}>İş vaxtları</Link>
      </div>
    </div>
  );
}

/* ─── Secondary row actions — rendered as inline buttons on each card ─────── */

type MenuItem = { label: string; onClick?: () => void; href?: string; danger?: boolean; icon?: React.ReactNode };

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "48px 24px", textAlign: "center", animation: "gorFade .25s ease" }}>
      <div style={{ width: 54, height: 54, borderRadius: 15, background: "var(--brand-50)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 15 }}><ICal s={26} c="#9DB0CC" /></div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{msg}</div>
    </div>
  );
}

function FilterTab({
  active, count, warn, onClick, children,
}: {
  active: boolean;
  count?: number;
  warn?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const warnInactive = !!warn && !active && !!count;
  const color = active ? "#082F6D" : warnInactive ? "#92400E" : "var(--oxford-60)";
  const line = active ? "var(--brand)" : "transparent";
  const pillBg = active ? "#E4ECFA" : warnInactive ? "#FEF3C7" : "#F2F6FD";
  const pillColor = active ? "#082F6D" : warnInactive ? "#92400E" : "#082F6D";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", padding: "11px 12px", marginBottom: -1, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", color, borderBottom: `2px solid ${line}`, whiteSpace: "nowrap" }}>
      {children}
      {count != null && count > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 6px", background: pillBg, color: pillColor, fontSize: 11, fontWeight: 700, borderRadius: 999 }}>{count}</span>
      )}
    </button>
  );
}

function AgendaRow({
  a, client, note, isNext, now, busyId, onAction, onDispute, onReject, onCancel, onPropose, onAddOutcome,
}: {
  a: AppointmentDetail;
  client: ClientSummary | null;
  note: ClientNote | null | undefined;
  isNext: boolean;
  now: Date;
  busyId: number | null;
  onAction: (id: number, fn: () => Promise<AppointmentDetail>) => Promise<void>;
  onDispute: () => void;
  onReject: () => void;
  onCancel: () => void;
  onPropose: () => void;
  onAddOutcome: () => void;
}) {
  const { t } = useT();
  const [sheet, setSheet] = useState(false);
  if (!a.startAt) return null;
  const start = new Date(a.startAt);
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  const sessionNumber = client ? client.totalSessions + 1 : null;
  const expired = !!a.endAt && new Date(a.endAt).getTime() < now.getTime();
  const ctxLine = [
    client && client.noteCount > 0 ? `${client.noteCount} qeyd` : null,
    note?.moodScore ? `Əhval ${note.moodScore}/10` : null,
    a.note ? `«${a.note.slice(0, 80)}${a.note.length > 80 ? "…" : ""}»` : null,
  ].filter(Boolean).join(" · ");

  // Countdown only for an upcoming, active session.
  const isUpcoming = a.status === "CONFIRMED" && start.getTime() > now.getTime();
  const cd = isUpcoming ? timeUntil(start, now) : null;

  // Secondary actions → action sheet (status-aware). Primary action stays inline.
  const menu: MenuItem[] = [];
  if (a.status === "CONFIRMED" && !expired) {
    menu.push({ label: "Yenidən planla", onClick: onPropose, icon: <IRefresh /> });
    menu.push({ label: "Ləğv et", onClick: onCancel, danger: true, icon: <IX /> });
  }
  // Clinical session note stays available once the session is over.
  if (a.status === "COMPLETED" || (a.status === "CONFIRMED" && expired)) {
    menu.push({ label: "Seans qeydi", onClick: onAddOutcome, icon: <IMsg c="var(--brand)" /> });
  }
  if (a.patientId) menu.push({ label: "Pasient profili", href: `/psycholog/clients/${a.patientId}`, icon: <IUser /> });

  // Foot only carries the Join button for an active confirmed session — there is
  // no post-session confirmation step anymore (sessions auto-complete).
  const showFoot = a.status === "CONFIRMED";
  const avColor = avatarColor(a.patientId ?? a.patientName);
  const cdBg = cd?.urgent || cd?.expired ? "#FEF3C7" : "#ECFDF5";
  const cdColor = cd?.urgent || cd?.expired ? "#92400E" : "#047857";

  return (
    <div style={{
      background: "#fff", borderRadius: 14,
      boxShadow: isNext ? "0 6px 20px rgba(16,81,183,.12)" : "0 2px 12px rgba(0,0,0,.06)",
      border: `1px solid ${isNext ? "#C7DBF6" : "#EDF1F8"}`,
      borderLeft: isNext ? "3px solid var(--brand)" : "1px solid #EDF1F8",
      padding: 18, animation: "gorFade .2s ease",
    }}>
      <div role="button" tabIndex={0} style={{ cursor: "pointer" }}
        onClick={() => setSheet(true)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSheet(true); } }}
        aria-label={`${a.patientName ?? "Pasient"} — əməliyyatlar`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span style={{ background: status.bg, color: status.color, fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999 }}>{status.label}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--oxford)" }}><IClock />{relativeDayLabel(start, now)} · {fmtTime(start)}</span>
          </div>
          <button type="button" className="gor-menu" title="Əməliyyatlar" aria-label="Əməliyyatlar"
            onClick={e => { e.stopPropagation(); setSheet(true); }}
            style={{ width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #EDF1F8", borderRadius: 9, cursor: "pointer", flex: "none" }}>
            <IDots />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: avColor, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, flex: "none" }}>{initialsOf(a.patientName)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--oxford)" }}>{a.patientName ?? "Pasient"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginTop: 2 }}>
              <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>{sessionNumber ? `${sessionNumber}-ci seans` : "Seans"}</span>
              {cd && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: cdBg, color: cdColor, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}><IClock s={11} c={cdColor} />{cd.text}</span>}
            </div>
          </div>
        </div>

        {ctxLine && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, lineHeight: 1.5, marginTop: 12 }}>
            <span style={{ flex: "none", marginTop: 2, display: "inline-flex" }}><IMsg /></span>
            <span>{ctxLine}</span>
          </div>
        )}
      </div>

      {showFoot && (
        <div onClick={e => e.stopPropagation()} style={{ borderTop: "1px solid #F0F4FA", paddingTop: 13, marginTop: 13 }}>
          <JoinSessionButton appointment={a} variant="compact" />
        </div>
      )}

      {sheet && (
        <ActionSheet
          patientName={a.patientName ?? "Pasient"}
          subtitle={`${pad2(start.getDate())}.${pad2(start.getMonth() + 1)} · ${fmtTime(start)} · ${status.label}`}
          contextLine={ctxLine || undefined}
          color={avColor}
          items={menu}
          onClose={() => setSheet(false)} />
      )}
    </div>
  );
}

/* ─── Action sheet — opens on card tap; holds every secondary action ──────── */

function ActionSheet({
  patientName, subtitle, contextLine, items, color, onClose,
}: {
  patientName: string;
  subtitle: string;
  contextLine?: string;
  items: MenuItem[];
  color: string;
  onClose: () => void;
}) {
  const normal = items.filter(i => !i.danger);
  const danger = items.filter(i => i.danger);
  const itemStyle = (isDanger?: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 12, width: "100%",
    background: "none", border: "none", borderRadius: 10, padding: 12,
    fontSize: 14, fontWeight: 600, color: isDanger ? "#991B1B" : "var(--oxford)",
    fontFamily: "inherit", cursor: "pointer", textAlign: "left", textDecoration: "none",
  });
  const renderItem = (it: MenuItem, key: number) => {
    const cls = `gor-sheet-item${it.danger ? " gor-sheet-item--danger" : ""}`;
    const content = <><span style={{ flex: "none", display: "inline-flex" }}>{it.icon}</span>{it.label}</>;
    return it.href ? (
      <Link key={key} href={it.href} className={cls} style={itemStyle(it.danger)} onClick={onClose}>{content}</Link>
    ) : (
      <button key={key} type="button" className={cls} style={itemStyle(it.danger)} onClick={() => { onClose(); it.onClick?.(); }}>{content}</button>
    );
  };

  return (
    <div onClick={onClose} role="presentation"
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(10,26,51,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label={`${patientName} əməliyyatları`}
        style={{ width: "100%", maxWidth: 360, background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(8,47,109,.3)", overflow: "hidden", animation: "gorSheet .22s ease" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "18px 18px 14px", borderBottom: "1px solid #F0F4FA" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flex: "none" }}>{initialsOf(patientName)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{patientName}</div>
              <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>{subtitle}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Bağla"
            style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F0F4FA", border: "none", borderRadius: 8, cursor: "pointer", flex: "none" }}>
            <IX s={15} c="#5C6B85" />
          </button>
        </div>
        {contextLine && <div style={{ padding: "10px 18px 0", fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>{contextLine}</div>}
        <div style={{ padding: 8 }}>
          {normal.map((it, i) => renderItem(it, i))}
          {danger.length > 0 && <div style={{ height: 1, background: "#F0F4FA", margin: "6px 8px" }} />}
          {danger.map((it, i) => renderItem(it, normal.length + i))}
        </div>
      </div>
    </div>
  );
}

/* ─── GAP-03: patient-initiated reschedule request card ─────────────────── */

function PatientRescheduleRequestCard({
  proposal, onDecided,
}: {
  proposal: RescheduleProposal;
  onDecided: (p: RescheduleProposal) => void;
}) {
  const [busyOption, setBusyOption] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmtOpt = (startIso: string, endIso: string) => {
    const s = new Date(startIso), e = new Date(endIso);
    return `${pad2(s.getDate())} ${MONTHS_AZ[s.getMonth()]} · ${fmtTime(s)}–${fmtTime(e)}`;
  };

  const accept = async (idx: number) => {
    setError(null); setBusyOption(idx);
    try {
      const updated = await psychologistApi.acceptPatientReschedule(proposal.id, idx);
      onDecided(updated);
    } catch (e) {
      setError(isSlotConflict(e)
        ? (e as Error).message + " Digər variantlardan birini seçə bilərsiniz."
        : (e as Error).message);
    } finally { setBusyOption(null); }
  };

  const reject = async () => {
    if (!confirm("İstəyi rədd etmək istəyirsiniz? Randevu köhnə vaxtında qalacaq.")) return;
    setError(null); setRejecting(true);
    try {
      const updated = await psychologistApi.rejectPatientReschedule(proposal.id);
      onDecided(updated);
    } catch (e) { setError((e as Error).message); }
    finally { setRejecting(false); }
  };

  const busy = busyOption !== null || rejecting;

  return (
    <div style={{ background: "linear-gradient(90deg,#FFFBEB,#FEF3C7)", border: "1px solid #FDE68A", borderLeft: "3px solid #F59E0B", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(180,83,9,.06)", animation: "gorFade .25s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: "#FEF3C7", color: "#92400E", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><IRefresh s={17} c="#92400E" /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#92400E" }}>{proposal.patientName ?? "Pasiyent"} vaxt dəyişikliyi istəyir</div>
          {proposal.originalStartAt && (
            <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>
              Hazırkı vaxt: {fmtOpt(proposal.originalStartAt, proposal.originalEndAt ?? proposal.originalStartAt)}
            </div>
          )}
        </div>
      </div>
      {proposal.reason && (
        <div style={{ background: "rgba(255,255,255,.7)", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 13px", marginBottom: 14, fontSize: 13.5, color: "#0A1A33", fontStyle: "italic", fontWeight: 500 }}>
          «{proposal.reason}»
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 14 }}>
        {proposal.options.map(opt => (
          <button
            key={opt.index}
            type="button"
            className="gor-opt"
            disabled={busy}
            onClick={() => accept(opt.index)}
            style={{
              display: "flex", alignItems: "center", gap: 11, background: "#fff",
              border: "1px solid #FDE68A", borderRadius: 10, padding: "11px 13px",
              cursor: busy ? "default" : "pointer", opacity: busy && busyOption !== opt.index ? 0.6 : 1,
              fontFamily: "inherit", textAlign: "left",
            }}
          >
            <span style={{ width: 22, height: 22, borderRadius: 7, background: "#FEF3C7", color: "#92400E", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{opt.index + 1}</span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{fmtOpt(opt.startAt, opt.endAt)}</span>
            <span className="gor-accept" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand)", color: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 700 }}>
              {busyOption === opt.index ? "…" : <><ICheck s={13} c="#fff" />Qəbul et</>}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}
      <button
        type="button"
        className="gor-decline"
        disabled={busy}
        onClick={reject}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "#991B1B", border: "1px solid #F3D6D6", borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: busy ? "default" : "pointer" }}
      >
        {rejecting ? "Göndərilir…" : "İmtina et"}
      </button>
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
      const updated = await psychologistApi.disputeSession(appointment.id, reason.trim() || undefined);
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
            Operator komandamız müraciətinizə baxıb həll edəcək.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>
            Səbəb (məcburi deyil)
          </label>
          <textarea
            rows={4} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Məsələn: pasient qoşulmadı, texniki problem…"
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

/* ─── Session outcome modal — write a clinical note tied to this appointment ── */

function OutcomeModal({
  appointment, onClose, onSaved,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim()) { setErr("Qeyd mətni boş ola bilməz"); return; }
    if (!appointment.patientId) { setErr("Pasient ID tapılmadı"); return; }
    setSaving(true); setErr(null);
    try {
      await psychologistApi.createNote({
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        title: null,
        body: body.trim(),
        moodScore: typeof mood === "number" ? mood : null,
      });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, padding: 0, maxWidth: 540, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Seans qeydi</h3>
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4 }}>
            {appointment.patientName ?? "Pasient"} ilə seans haqqında qısa qeyd — pasient bunu görmür, AES-256 ilə şifrələnir.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>
            Seansın nəticəsi
          </label>
          <textarea
            rows={6} value={body} onChange={e => setBody(e.target.value)}
            placeholder="İşlənən mövzu, müştəri reaksiyası, gələcək plan…"
            autoFocus
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box", resize: "vertical" }} />

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>
            Əhval-ruhiyyə qiymətləndirməsi (1–10, məcburi deyil)
          </label>
          <input type="number" min={1} max={10} value={mood}
            onChange={e => { const v = e.target.value; setMood(v === "" ? "" : Math.max(1, Math.min(10, Number(v)))); }}
            style={{ width: 80, padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 12 }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Ləğv
            </button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saxlanılır…" : "Qeydi saxla"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ─── Bulk cancel by date range ─────────────────────────────────────────── */

const CANCEL_REASONS: { code: string; label: string }[] = [
  { code: "PSY_HEALTH",    label: "Xəstələndim" },
  { code: "PSY_EMERGENCY", label: "Təcili / fövqəladə" },
  { code: "PSY_TECHNICAL", label: "Texniki problem" },
  { code: "PSY_OTHER",     label: "Digər" },
];

const CANCELLABLE = new Set(["ASSIGNED", "CONFIRMED"]);

function BulkCancelModal({
  appointments, onClose, onDone,
}: {
  appointments: AppointmentDetail[];
  onClose: () => void;
  onDone: () => void;
}) {
  const today = useMemo(() => {
    const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }, []);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reasonCode, setReasonCode] = useState(CANCEL_REASONS[0].code);
  const [reasonText, setReasonText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const targets = useMemo(() => {
    const startMs = new Date(startDate + "T00:00:00").getTime();
    const endMs = new Date(endDate + "T23:59:59").getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return [];
    return appointments.filter(a => {
      if (!a.startAt) return false;
      if (!CANCELLABLE.has(a.status)) return false;
      const t = new Date(a.startAt).getTime();
      return t >= startMs && t <= endMs;
    }).sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
  }, [appointments, startDate, endDate]);

  const submit = async () => {
    if (targets.length === 0) { setErr("Bu aralıqda ləğv ediləcək seans yoxdur"); return; }
    setSubmitting(true); setErr(null);
    try {
      const res = await psychologistApi.bulkCancel(
        targets.map(a => a.id),
        reasonCode,
        reasonText.trim() || undefined,
      );
      if (res.errors.length > 0 && res.cancelled.length === 0) {
        setErr(`Ləğv edilə bilmədi: ${res.errors.map(e => e.message).join("; ")}`);
        return;
      }
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, padding: 0, maxWidth: 560, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Tarix aralığı üçün ləğv</h3>
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4 }}>
            Seçilmiş tarix aralığındakı bütün təsdiqli/təyin edilmiş seansları bir səbəblə ləğv edin
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford)" }}>Başlanğıc</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford)" }}>Bitiş</span>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }} />
            </label>
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>Səbəb</label>
          <select value={reasonCode} onChange={e => setReasonCode(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 10, background: "#fff" }}>
            {CANCEL_REASONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>Əlavə açıqlama (məcburi deyil)</label>
          <textarea rows={2} value={reasonText} onChange={e => setReasonText(e.target.value)}
            placeholder="Pasiyentlərə göndəriləcək qısa qeyd…"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box", resize: "vertical" }} />

          <div style={{ padding: 12, background: "#F8FAFD", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>
              {targets.length === 0 ? "Aralıqda seans yoxdur" : `${targets.length} seans ləğv ediləcək`}
            </div>
            {targets.length > 0 && (
              <ul style={{ margin: 0, padding: "0 0 0 18px", color: "#52718F", maxHeight: 140, overflowY: "auto" }}>
                {targets.slice(0, 10).map(a => {
                  const d = new Date(a.startAt!);
                  return (
                    <li key={a.id} style={{ fontSize: 12, marginBottom: 2 }}>
                      {pad2(d.getDate())}.{pad2(d.getMonth() + 1)} · {fmtTime(d)} — {a.patientName ?? "Pasient"}
                    </li>
                  );
                })}
                {targets.length > 10 && <li style={{ fontSize: 12, color: "#9CA3AF" }}>… və {targets.length - 10} daha</li>}
              </ul>
            )}
          </div>

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Ləğv
            </button>
            <button onClick={submit} disabled={submitting || targets.length === 0}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: targets.length === 0 ? "#E5E7EB" : "#DC2626",
                color: targets.length === 0 ? "#9CA3AF" : "#fff",
                cursor: submitting || targets.length === 0 ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Ləğv olunur…" : `${targets.length} seansı ləğv et`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
