"use client";

/**
 * OP-1: Müraciət detal səhifəsi — modal yığını əvəzinə "ticket" iş səhifəsi.
 * 3 zona (kontekst / əməliyyat / fəaliyyət lenti) + sticky header.
 * Pool sahibliyi: səhifəni açmaq sahibliyi GÖTÜRMÜR — operator açıq "Götür"
 * düyməsi (və ya ilk əməliyyat) ilə müraciəti daimi öz üzərinə götürür; admin
 * başqa operatora keçirə bilər.
 */

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ApiError,
  operatorApi,
  isSlotConflict,
  CANCEL_REASONS,
  type AppointmentDetail,
  type AvailableSlot,
  type ClaimState,
  type OperatorActivityItem,
  type OperatorAppointmentFull,
  type Psychologist,
  type SlotAllowance,
} from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import DatePicker from "@/components/DatePicker";
import { toast as globalToast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";
import ErrorState from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { subscribeNotifications, subscribeOperatorClaims } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azLocalToISO, isoToAzLocal, azFormatDate, azFormatTime, azFormatDateTime, azOrdinal } from "@/lib/datetime";


// Randevu statusu → AZ etiket. Rəng artıq fx-pill (statusPillClass) ilə verilir.
const STATUS_LABEL: Record<string, string> = {
  PENDING:               "Gözlənilir",
  NEW:                   "Yeni",
  REJECTED:              "Yenidən təyin",
  IN_REVIEW:             "Operatorda",
  ASSIGNED:              "Təyin edilib",
  CONFIRMED:             "Təsdiqlənib",
  AWAITING_CONFIRMATION: "Təsdiq gözlənir",
  DISPUTED:              "Mübahisəli",
  COMPLETED:             "Tamamlanıb",
  CANCELLED:             "Ləğv edilib",
  CANCEL_REQUESTED:      "Ləğv gözlənir",
};
function statusLabel(status?: string | null): string {
  return (status ? STATUS_LABEL[status] : null) ?? status ?? "—";
}
/** Köhnə randevularda operatorNote-a yazılmış "[Vaxt dəyişikliyi istəyi]" sistem
 *  damğasını gizlədir — bu artıq öz banneri ilə (rescheduleRequestedAt/Note) ayrıca
 *  göstərilir, ona görə xam qeyd blokunda təkrarlanmasın. */
function cleanOperatorNote(note?: string | null): string {
  if (!note) return "";
  return note.split("\n").filter(line => !line.trim().startsWith("[Vaxt dəyişikliyi istəyi]")).join("\n").trim();
}
// Appointment status → Fanus UI Kit pill variant (colors mirror statusMeta()).
function statusPillClass(status?: string | null): string {
  switch (status) {
    case "CONFIRMED": return "fx-pill--paid";
    case "ASSIGNED": return "fx-pill--info";
    case "DISPUTED":
    case "CANCELLED": return "fx-pill--refunded";
    case "COMPLETED": return "fx-pill--cancelled";
    default: return "fx-pill--pending"; // PENDING/NEW/REJECTED/IN_REVIEW/AWAITING_CONFIRMATION/CANCEL_REQUESTED
  }
}


function fmtDateTime(iso?: string | null) { return iso ? azFormatDateTime(iso) : "—"; }
function isoDateOnly(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits || null;
}
function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/^\+/, "").replace(/[^\d]/g, "")}`;
}
/** "2s 14d" formatında yaş — SLA sayğacı üçün. */
function ageLabel(fromIso: string, nowMs: number): string {
  const min = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 60000));
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}g ${h % 24}s`;
  if (h > 0) return `${h}s ${min % 60}d`;
  return `${min}d`;
}
/** İnsani nisbi vaxt — "2 saat əvvəl"; 30 gündən köhnə → tam tarix. */
function azFromNow(iso?: string | null, nowMs: number = Date.now()): string {
  if (!iso) return "—";
  const min = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000));
  if (min < 1) return "indi";
  if (min < 60) return `${min} dəq əvvəl`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} saat əvvəl`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} gün əvvəl`;
  return azFormatDate(iso);
}

export default function OperatorAppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = use(params);
  const id = Number(idStr);
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const me = getStoredUser();
  const meId = me?.userId ?? null;
  const isAdmin = me?.role === "ADMIN";

  const [full, setFull] = useState<OperatorAppointmentFull | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claim, setClaim] = useState<ClaimState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const assignFocusRef = useRef<HTMLButtonElement | null>(null);
  const assignCardRef = useRef<HTMLDivElement | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveErr, setApproveErr] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [otherAction, setOtherAction] = useState<OtherActionKey | null>(null);
  const focusAssign = useCallback(() => {
    assignCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => assignFocusRef.current?.focus(), 250);
  }, []);

  const a = full?.appointment ?? null;
  const claimedByOther = !!claim?.claimedByUserId && !claim.mine;
  const unowned = !claim?.claimedByUserId;

  // ── Data load ──────────────────────────────────────────────────────────────
  const load = useCallback((silent = false) => {
    if (!silent) { setLoading(true); setLoadError(false); }
    operatorApi.fullAppointment(id)
      .then(f => { setFull(f); setClaim(f.claim); setNotFound(false); setLoadError(false); })
      .catch(e => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        // Şəbəkə/server xətası (404 deyil): səhifəni əbədi "Yüklənir…"də saxlamaq
        // əvəzinə xəta+retry göstər. Səssiz (mutasiyadan sonra) yenilənmə uğursuz
        // olsa, mövcud məlumatı silməyib istifadəçini narahat etmirik.
        else if (!silent) setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Qeyd: səhifəni açmaq sahibliyi GÖTÜRMÜR (köhnə efemer auto-claim/heartbeat
  // silindi). Operator açıq "Götür" düyməsi və ya ilk əməliyyat (guardAction)
  // ilə müraciəti öz üzərinə götürür.

  // ── Real-time: sahiblik hadisələri + müraciət dəyişiklikləri ──────────────
  useEffect(() => {
    const offClaims = subscribeOperatorClaims(ev => {
      if (ev.appointmentId !== id) return;
      setClaim(prev => {
        const mine = ev.claimedByUserId != null && ev.claimedByUserId === meId;
        if (prev?.mine && !mine && ev.event === "STOLEN" && ev.claimedByName) {
          setToast(t("staff.opClaimLost", { name: ev.claimedByName }));
        }
        return {
          appointmentId: id,
          claimedByUserId: ev.claimedByUserId ?? null,
          claimedByName: ev.claimedByName ?? null,
          claimedAt: ev.claimedAt ?? null,
          mine,
          ttlMinutes: prev?.ttlMinutes ?? 0,
        };
      });
    });
    const offNotifs = subscribeNotifications(n => {
      if (typeof n.type === "string" && n.type.startsWith("APPOINTMENT_")
          && n.relatedType === "APPOINTMENT" && n.relatedId === id) {
        load(true);
      }
    });
    return () => { offClaims(); offNotifs(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, meId]);

  // ── SLA sayğacı: hər 30 saniyədən bir yenilə ──────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const qs = searchParams.toString();
  const backToList = useCallback(() => {
    // Paket səhifəsindən gəlibsə (?pkg=), həmin paketin daxili səhifəsinə qayıt.
    const pkg = searchParams.get("pkg");
    if (pkg) { router.push(`/operator/appointments/package/${pkg}`); return; }
    const listQs = new URLSearchParams(qs);
    listQs.delete("queue");
    const tab = searchParams.get("queue");
    if (tab) listQs.set("tab", tab);
    const s = listQs.toString();
    router.push(`/operator/appointments${s ? `?${s}` : ""}`);
  }, [router, qs, searchParams]);

  // ── Toast ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const tm = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(tm);
  }, [toast]);

  // ── Pooldan götür ──────────────────────────────────────────────────────────
  const takeOwnership = useCallback(() => {
    operatorApi.claim(id).then(setClaim).catch(e => setToast((e as Error).message));
  }, [id]);

  // ── Əməliyyat qoruması: sahibsizsə avtomatik götür, başqasınınkındadırsa blokla ─
  const guardAction = useCallback((run: () => void) => {
    if (claim?.mine) { run(); return; }
    if (claimedByOther) {
      if (isAdmin) {
        // Admin override: müraciəti öz üzərinə keçirir (audit-loqlanır), sonra icra edir.
        operatorApi.reassignAppointment(id, meId as number).then(c => { setClaim(c); run(); }).catch(() => run());
      } else {
        setToast(t("staff.opClaimBlocked", { name: claim?.claimedByName ?? "?" }));
      }
      return;
    }
    // Sahibsiz → əvvəlcə götür, sonra icra et.
    operatorApi.claim(id).then(c => { setClaim(c); run(); }).catch(() => run());
  }, [claim?.mine, claim?.claimedByName, claimedByOther, isAdmin, id, meId, t]);

  // ── Psixoloq təklifini bir kliklə təsdiqlə və tətbiq et ────────────────────
  // "Operator OK edərsə yeni vaxt təyin edilsin" — pasiyentin qəbul/rədd addımı
  // yoxdur. Təklifin ilk variant vaxtı mövcud psixoloqa assignSlots ilə tətbiq
  // olunur; backend gözləyən təklifi ACCEPTED edir və pasiyenti xəbərdar edir.
  const approveProposal = useCallback(() => {
    const p = full?.pendingRescheduleProposal;
    const opt = p?.options?.[0];
    const appt = full?.appointment;
    if (!p || !opt?.startAt || !opt?.endAt || !appt) return;
    const psyId = appt.psychologistId ?? p.psychologistId;
    if (!psyId) { setApproveErr("Bu randevuya psixoloq təyin olunmayıb"); return; }
    guardAction(async () => {
      setApproving(true); setApproveErr(null);
      try {
        await operatorApi.assignSlots(appt.id, {
          psychologistId: psyId,
          slots: [{ startAt: opt.startAt, endAt: opt.endAt }],
          operatorNote: appt.operatorNote ?? null,
          sessionPrice: null,
        });
        globalToast("Təklif təsdiqləndi — vaxt yeniləndi", "success");
        backToList();
      } catch (e) {
        setApproveErr((e as Error).message);
      } finally {
        setApproving(false);
      }
    });
  }, [full, guardAction, backToList]);

  // ── Yekun əməliyyat: toast ────────────────────────────────────────────────
  // Sahiblik QALIR (pool modeli) — yekun əməliyyat claim-i sıfırlamır.
  const onActionDone = useCallback((updated: AppointmentDetail, msg: string) => {
    setFull(prev => prev ? { ...prev, appointment: updated } : prev);
    setToast(msg);
    load(true); // lenti yenilə (audit qeydi gəlib)
  }, [load]);

  // ── Render halları ─────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="fx-card fx-card--empty" style={{ padding: "4rem 2rem" }}>
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--oxford-60)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <h1 className="fx-h3" style={{ margin: 0 }}>{t("staff.opDetNotFound")}</h1>
        <p className="fx-muted" style={{ fontSize: 13, margin: 0 }}>{t("staff.opDetNotFoundSub")}</p>
        <Link href="/operator/appointments" className="fx-btn fx-btn--primary" style={{ marginTop: 8, textDecoration: "none" }}>
          {t("staff.opDetBackToList")}
        </Link>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="fx-card" style={{ padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Skeleton width={200} height={22} />
            <Skeleton width={140} height={13} style={{ marginTop: 10 }} />
          </div>
          <Skeleton width={110} height={30} radius={999} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginTop: 28 }}>
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} width={`${85 - i * 8}%`} height={14} style={{ marginTop: i === 0 ? 0 : 16 }} />
            ))}
            <Skeleton width="100%" height={120} radius={12} style={{ marginTop: 24 }} />
          </div>
          <div>
            <Skeleton width="100%" height={90} radius={12} />
            <Skeleton width="100%" height={140} radius={12} style={{ marginTop: 14 }} />
          </div>
        </div>
      </div>
    );
  }
  // 404 deyil, amma məlumat gəlmədi (şəbəkə/server xətası) — əbədi spinner əvəzinə
  // xəta + "Yenidən cəhd et". `!full || !a` da bura düşür ki, səhifə ilişməsin.
  if (loadError || !full || !a) {
    return (
      <div className="fx-card" style={{ padding: 20 }}>
        <ErrorState
          title="Müraciət yüklənmədi"
          sub="Bağlantı və ya server problemi ola bilər. Yenidən cəhd edin və ya siyahıya qayıdın."
          onRetry={() => load()}
          action={
            <Link href="/operator/appointments" className="fx-btn fx-btn--ghost" style={{ textDecoration: "none" }}>
              Siyahıya qayıt
            </Link>
          }
        />
      </div>
    );
  }

  const isFinal = a.status === "COMPLETED" || a.status === "CANCELLED";

  const isCancelReq = a.status === "CANCEL_REQUESTED";
  // CONFIRMED included so the assign block doubles as the reschedule / change-psychologist tool.
  const canAssign = !isCancelReq && !isFinal && ["PENDING", "NEW", "REJECTED", "ASSIGNED", "IN_REVIEW", "CONFIRMED"].includes(a.status);
  // Görüş linki artıq təyin edilibsə vaxt/psixoloq dəyişikliyi bloklanır — link konkret
  // vaxta bağlıdır, vaxt dəyişsə köhnəlmiş qalır (backend: guardNotRescheduleWhenLinked).
  const timeLocked = canAssign && !!a.meetingLink;
  const canCancel = !isCancelReq && !isFinal && a.status !== "DISPUTED";
  const canResolve = a.status === "DISPUTED";
  // Tək (paketsiz) seans təyin/yaradılanda qiymət yoxdusa ödəniş yaranmır — belə
  // hallarda "Ödənişlər"də görünmür. Operator burdan əl ilə əlavə edə bilsin.
  // Ödəniş bloku: ya heç ödəniş qeydi yoxdursa, ya da qəbul zamanı yaranmış
  // gözləyən ödənişin məbləği hələ 0-dırsa (qiymətsiz psixoloq) — operator təyin etsin.
  const paymentAmountUnset = a.paymentStatus === "PENDING" && (a.paymentAmount == null || a.paymentAmount <= 0);
  const needsPayment = !["PENDING", "NEW", "IN_REVIEW", "REJECTED", "CANCELLED"].includes(a.status)
    && !a.patientPackageId && a.patientId != null && (!a.paymentStatus || paymentAmountUnset);
  // Option B: sessions auto-complete; operator retroactively marks a no-show.
  const canMarkNoShow = a.status === "COMPLETED" || a.status === "AWAITING_CONFIRMATION";
  const phone = normalizePhone(a.patientPhone);
  const isAssigned = a.status === "ASSIGNED" || a.status === "CONFIRMED";

  // ── "Sonrakı addım" strip — bir baxışda operatora indi nə lazım olduğunu deyir ──
  // Qeyd: obyektdə funksiya SAXLAMIRIQ (yalnız `action` açarı) — belədə ref-bağlı
  // callback-lar render obyektinə düşmür (react-hooks/refs lint qaydası təmiz qalır).
  type NextTone = "action" | "warn" | "muted" | "done";
  type NextAction = "approve" | "assign" | "link" | "payment" | "dispute" | "cancelreq";
  const next: { tone: NextTone; title: string; sub?: string; btnLabel?: string; action?: NextAction } = (() => {
    if (a.status === "CANCELLED") return { tone: "muted", title: "Bu müraciət ləğv edilib." };
    if (a.status === "COMPLETED") return { tone: "done", title: "Seans tamamlanıb." };
    if (canResolve) return { tone: "warn", title: "Mübahisə açılıb — nəticəni qeyd edin.", btnLabel: "Mübahisəni həll et", action: "dispute" };
    if (isCancelReq) return { tone: "warn", title: "Pasiyent ləğv tələb edib — təsdiqləyin və ya rədd edin.", btnLabel: "Ləğv tələbinə bax", action: "cancelreq" };
    if (canAssign && full.pendingRescheduleProposal?.initiator === "PSYCHOLOGIST" && full.pendingRescheduleProposal.options?.[0]?.startAt && !timeLocked)
      return { tone: "action", title: "Bu psixoloq yeni vaxt təklif edib — təsdiqləyin.", sub: `Təklif olunan vaxt: ${fmtDateTime(full.pendingRescheduleProposal.options[0].startAt)}`, btnLabel: approving ? "…" : "Təsdiqlə və tətbiq et", action: "approve" };
    if (canAssign && (a.rescheduleRequestedAt || full.pendingRescheduleProposal) && !timeLocked)
      return { tone: "action", title: "Vaxt dəyişikliyi istənilib — yeni vaxt təyin edin.", btnLabel: "Vaxtı seç", action: "assign" };
    if (canAssign && !isAssigned && !timeLocked)
      return { tone: "action", title: "Bu müraciətə psixoloq və vaxt təyin edin.", btnLabel: "Təyin et", action: "assign" };
    if (isAssigned && !a.meetingLink && !isFinal)
      return { tone: "action", title: "Görüş linkini əlavə edin ki, pasiyentə göndərilsin.", btnLabel: "Link əlavə et", action: "link" };
    if (needsPayment)
      return { tone: "action", title: "Seans məbləğini təyin edin ki, ödənişlərdə görünsün.", btnLabel: "Məbləği təyin et", action: "payment" };
    return { tone: "done", title: "Bütün məlumatlar tamamdır." };
  })();
  const runNextAction = (action: NextAction) => {
    if (action === "approve") approveProposal();
    else if (action === "assign") focusAssign();
    else if (action === "link") setLinkModalOpen(true);
    else if (action === "payment") setPaymentModalOpen(true);
    else if (action === "dispute") setOtherAction("dispute");
    else if (action === "cancelreq") setOtherAction("cancelreq");
  };
  const nextTone = {
    action: { bg: "#EFF6FF", border: "#DBEAFE", iconBg: "#FFFFFF", icon: "#2563EB" },
    warn:   { bg: "#FFFBEB", border: "#FDE68A", iconBg: "#FFFFFF", icon: "#D97706" },
    muted:  { bg: "#F8FAFC", border: "#EDF1F8", iconBg: "#FFFFFF", icon: "#94A3B8" },
    done:   { bg: "#ECFDF3", border: "#BBF7D0", iconBg: "#BBF7D0", icon: "#16A34A" },
  }[next.tone];

  // Claim çipi (sağ header) — sahiblik + SLA vəziyyəti tək kompakt nişanda.
  const ownerLabel = claim?.mine ? "Sənin üzərində" : claimedByOther ? `${claim?.claimedByName ?? "?"} işləyir` : "Sahibsiz";
  const ownerChip = claim?.mine
    ? { bg: "#ECFDF3", fg: "#15803D", dot: "#16A34A" }
    : claimedByOther
      ? { bg: "#FFFBEB", fg: "#B45309", dot: "#D97706" }
      : { bg: "#F1F5F9", fg: "#64748B", dot: "#94A3B8" };

  const otherKeys: OtherActionKey[] = [];
  if (canResolve) otherKeys.push("dispute");
  if (isCancelReq) otherKeys.push("cancelreq");
  if (canMarkNoShow) otherKeys.push("noshow");
  if (canCancel) otherKeys.push("cancel");

  return (
    <div className="opd">
      <div className="opd__grid">

        {/* ── Sol: kontekst ─────────────────────────────────────────────────── */}
        <aside className="opd__left">
          <ContextZone full={full} phone={phone} t={t} qs={qs} nowMs={nowMs} onHistoryChanged={() => load(true)} />
        </aside>

        {/* ── Sağ: iş zonası ────────────────────────────────────────────────── */}
        <main className="opd__right">
          <div className="opd__header">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
              <button onClick={backToList} title={t("staff.opDetBackToList")} aria-label={t("staff.opDetBackToList")}
                style={{ width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #E2E8F5", background: "#fff", borderRadius: 9, cursor: "pointer", color: "#475569", flex: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, fontSize: 18, color: "#1E293B" }}>#FNS-{String(id).padStart(4, "0")}</span>
              <span className={`fx-pill ${statusPillClass(a.status)}`}>{statusLabel(a.status)}</span>
              {a.sessionKind === "INTRO" && (
                <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: "#EFF6FF", color: "#1D4ED8" }}>Tanışlıq · Pulsuz</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {unowned && (
                <button onClick={takeOwnership} className="fx-btn fx-btn--primary fx-btn--sm">{t("staff.opTake")}</button>
              )}
              {isAdmin && !unowned && (
                <button onClick={() => setReassignOpen(true)} className="opd-ghost-btn">{t("staff.opReassign")}</button>
              )}
              <span style={{ display: "flex", alignItems: "center", gap: 6, background: ownerChip.bg, color: ownerChip.fg, padding: "6px 12px", borderRadius: 100, fontSize: 12.5, fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: ownerChip.dot, flex: "none" }} />
                {ownerLabel}{!isFinal ? ` · ${ageLabel(a.createdAt, nowMs)} gözləyir` : ""}
              </span>
            </div>
          </div>

          <div className="opd__body">

            {/* Müraciət mətni — operatorun oxuması üçün (varsa) */}
            {a.note && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#F8FAFC", border: "1px solid #EDF1F8", borderRadius: 12, padding: "13px 15px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                <span style={{ fontSize: 13.5, color: "#334155", fontStyle: "italic", lineHeight: 1.5 }}>«{a.note}»</span>
              </div>
            )}

            {/* Sonrakı addım */}
            <div style={{ background: nextTone.bg, border: `1px solid ${nextTone.border}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", background: nextTone.iconBg, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  {next.tone === "done"
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={nextTone.icon} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    : <span style={{ width: 9, height: 9, borderRadius: "50%", background: nextTone.icon }} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{next.title}</div>
                  {next.sub && <div style={{ fontSize: 12.5, color: "#5C6B85", marginTop: 2 }}>{next.sub}</div>}
                  {approveErr && next.action === "approve" && <div style={{ fontSize: 12.5, color: "#B91C1C", marginTop: 4, fontWeight: 600 }}>{approveErr}</div>}
                </div>
              </div>
              {next.btnLabel && next.action && (
                <button onClick={() => runNextAction(next.action!)} disabled={approving && next.action === "approve"}
                  style={{ background: next.tone === "warn" ? "#D97706" : "#2563EB", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", flex: "none" }}>
                  {next.btnLabel}
                </button>
              )}
            </div>

            {isFinal ? (
              /* Terminal vəziyyət kartı */
              <div className="opd-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Vəziyyət</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>{statusLabel(a.status)}</div>
                {cleanOperatorNote(a.operatorNote) && (
                  <div style={{ fontSize: 13, color: "#5C6B85" }}>Qeyd: {cleanOperatorNote(a.operatorNote)}</div>
                )}
              </div>
            ) : (
              <>
                {/* TƏYİN / YENİDƏN PLANLA */}
                {timeLocked ? (
                  <div className="opd-card" style={{ padding: 18 }}>
                    <div className="opd-card__title" style={{ marginBottom: 10 }}>Təyin / yenidən planla</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 11, padding: "13px 15px" }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
                      <div style={{ fontSize: 13, color: "#92400E", fontWeight: 500, lineHeight: 1.5 }}>
                        <strong>Vaxt/psixoloq dəyişikliyi bloklanıb</strong> — seans linki artıq təyin edilib. Dəyişmək üçün əvvəlcə «Görüş linki» kartından linki geri çağırın.
                      </div>
                    </div>
                  </div>
                ) : canAssign && (
                  <div ref={assignCardRef}>
                    <AssignBlock
                      key={`assign-${a.id}-${a.status}`}
                      appointment={a}
                      suggestions={full.suggestions}
                      cold={claimedByOther}
                      guardAction={guardAction}
                      selectRef={assignFocusRef}
                      proposedStart={full.pendingRescheduleProposal?.options?.[0]?.startAt ?? null}
                      proposedEnd={full.pendingRescheduleProposal?.options?.[0]?.endAt ?? null}
                      proposedInitiator={full.pendingRescheduleProposal?.initiator ?? null}
                      onAssigned={(u) => {
                        globalToast((u.status === "ASSIGNED" || u.status === "CONFIRMED") ? "Təyin olundu" : "Yeniləndi", "success");
                        backToList();
                      }}
                    />
                  </div>
                )}

                {/* İkincili: Görüş linki + Ödəniş */}
                <div className="opd__secondary-grid">
                  <div className="opd-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="opd-card__title">Görüş linki</div>
                    {a.meetingLink ? (
                      <>
                        <a href={a.meetingLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#2563EB", wordBreak: "break-all" }}>{a.meetingLink}</a>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setLinkModalOpen(true)} className="opd-ghost-btn">Dəyiş</button>
                          <button onClick={() => guardAction(async () => { try { await operatorApi.revokeMeetingLink(a.id); load(true); setToast("Link silindi"); } catch (e) { globalToast((e as Error).message, "error"); } })}
                            style={{ background: "transparent", border: "1px solid #FCA5A5", color: "#DC2626", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sil</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, color: "#94A3B8" }}>Görüş linki hələ əlavə edilməyib</div>
                        <button onClick={() => setLinkModalOpen(true)} style={{ alignSelf: "flex-start", background: "#EFF6FF", border: "1px solid #DBEAFE", color: "#1D4ED8", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Link əlavə et</button>
                      </>
                    )}
                  </div>
                  <div className="opd-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="opd-card__title">Ödəniş</div>
                    {a.paymentAmount != null && a.paymentAmount > 0 ? (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "#1E293B" }}>{a.paymentAmount} ₼</div>
                        <div style={{ fontSize: 12, color: "#94A3B8" }}>{a.paymentStatus === "PAID" ? "Ödənilib" : "Gözləyir"}</div>
                      </>
                    ) : needsPayment ? (
                      <>
                        <div style={{ fontSize: 13, color: "#94A3B8" }}>Bu seans üçün ödəniş qeydi yoxdur</div>
                        <button onClick={() => setPaymentModalOpen(true)} style={{ alignSelf: "flex-start", background: "#ECFDF3", border: "1px solid #BBF7D0", color: "#15803D", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Məbləği təyin et</button>
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: "#94A3B8" }}>{a.patientPackageId ? "Paket seansı" : "Ödəniş tələb olunmur"}</div>
                    )}
                  </div>
                </div>

                {/* Digər əməliyyatlar — sakit sətir */}
                {otherKeys.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94A3B8" }}>Digər əməliyyatlar</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {otherKeys.map(k => {
                        const m = OTHER_ACTION_META[k];
                        return (
                          <button key={k} onClick={() => setOtherAction(k)}
                            style={{ background: "transparent", border: `1px solid ${m.border}`, color: m.fg, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* ── Görüş linki modalı ───────────────────────────────────────────────── */}
      {linkModalOpen && (
        <LinkEditModal appointment={a} onClose={() => setLinkModalOpen(false)}
          onSaved={() => { setLinkModalOpen(false); load(true); setToast("Görüş linki yeniləndi"); }} />
      )}

      {/* ── Ödəniş modalı ────────────────────────────────────────────────────── */}
      {paymentModalOpen && (
        <PaymentEditModal appointment={a} onClose={() => setPaymentModalOpen(false)}
          onSaved={() => { setPaymentModalOpen(false); load(true); setToast("Ödəniş əlavə edildi"); }} />
      )}

      {/* ── Digər əməliyyat modalları ────────────────────────────────────────── */}
      {otherAction && (
        <ModalShell title={OTHER_ACTION_META[otherAction].title} sub={OTHER_ACTION_META[otherAction].sub}
          badge={OTHER_ACTION_META[otherAction].badge} onClose={() => setOtherAction(null)}>
          {otherAction === "dispute" && <ResolveDisputeBlock appointment={a} guardAction={guardAction} onDone={(u) => { setOtherAction(null); onActionDone(u, "Mübahisə həll olundu"); }} />}
          {otherAction === "cancelreq" && <CancelRequestBlock appointment={a} guardAction={guardAction} onDone={(u, ap) => { setOtherAction(null); onActionDone(u, ap ? "Ləğv təsdiqləndi" : "Tələb rədd edildi"); }} />}
          {otherAction === "noshow" && <NoShowBlock appointment={a} guardAction={guardAction} onDone={(u) => { setOtherAction(null); onActionDone(u, "No-show işarələndi"); }} />}
          {otherAction === "cancel" && <CancelBlock appointment={a} guardAction={guardAction} onClose={() => setOtherAction(null)} onDone={(u) => { setOtherAction(null); onActionDone(u, "Ləğv edildi"); }} />}
        </ModalShell>
      )}

      {/* ── Admin: başqa operatora keçir (reassign) modalı ─────────────────── */}
      {reassignOpen && (
        <ReassignModal
          id={id}
          currentHolderId={claim?.claimedByUserId ?? null}
          t={t}
          onClose={() => setReassignOpen(false)}
          onDone={(c) => { setClaim(c); setReassignOpen(false); setToast(t("staff.opReassignDone")); }}
        />
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--oxford)", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 90, boxShadow: "var(--shadow-lg)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ─── Admin reassign modalı (operator dropdown + qeyd-şərtsiz keçir) ──────── */

function ReassignModal({ id, currentHolderId, t, onClose, onDone }: {
  id: number;
  currentHolderId: number | null;
  t: ReturnType<typeof useT>["t"];
  onClose: () => void;
  onDone: (c: ClaimState) => void;
}) {
  const [operators, setOperators] = useState<{ id: number; name: string }[]>([]);
  const [opId, setOpId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    operatorApi.listOperators().then(setOperators).catch(() => {});
  }, []);

  const submit = () => {
    if (!opId) { setErr(t("staff.opReassignPick")); return; }
    setBusy(true); setErr(null);
    operatorApi.reassignAppointment(id, opId)
      .then(onDone)
      .catch(e => { setErr((e as Error).message); setBusy(false); });
  };

  return (
    <div className="fx-overlay fx-overlay--center" onClick={onClose} style={{ padding: 16 }}>
      <div className="fx-modal" onClick={e => e.stopPropagation()} style={{ width: "min(420px, 100%)" }}>
        <h3 className="fx-h3">{t("staff.opReassignTitle")}</h3>
        <p className="fx-modal__text" style={{ marginTop: -6 }}>{t("staff.opReassignBody")}</p>
        <select className="fx-select" value={opId ?? ""} onChange={e => setOpId(Number(e.target.value) || null)}>
          <option value="">— {t("staff.opReassignPick")} —</option>
          {operators.filter(o => o.id !== currentHolderId).map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        {err && <div className="fx-banner fx-banner--error" style={{ fontSize: 12 }}>{err}</div>}
        <div className="fx-modal__actions">
          <button onClick={onClose} className="fx-btn fx-btn--ghost">
            {t("staff.opReassignCancel")}
          </button>
          <button onClick={submit} disabled={busy} className="fx-btn fx-btn--primary" style={{ opacity: busy ? 0.7 : 1, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "…" : t("staff.opReassignConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sol zona: pasiyent kartı + reputasiya + kurs + tarixçə ──────────────── */

function ContextZone({ full, phone, t, qs, nowMs, onHistoryChanged }: {
  full: OperatorAppointmentFull;
  phone: string | null;
  t: ReturnType<typeof useT>["t"];
  qs: string;
  nowMs: number;
  onHistoryChanged: () => void;
}) {
  const a = full.appointment;
  const h = full.patientHistory;
  const suffix = qs ? `?${qs}` : "";

  const [seriesStart, setSeriesStart] = useState("");
  const [seriesRescheduleOpen, setSeriesRescheduleOpen] = useState(false);
  const [seriesBusy, setSeriesBusy] = useState(false);

  const doRescheduleSeries = async () => {
    if (!a.seriesId || !seriesStart || seriesBusy) return;
    setSeriesBusy(true);
    try {
      await operatorApi.rescheduleSeries(a.seriesId, azLocalToISO(seriesStart));
      globalToast("Seriya yenidən planlandı", "success");
      setSeriesRescheduleOpen(false); setSeriesStart("");
      onHistoryChanged();
    } catch (e) { globalToast((e as Error).message, "error"); }
    finally { setSeriesBusy(false); }
  };

  const doCancelSeries = async () => {
    if (!a.seriesId || seriesBusy) return;
    if (!(await confirmDialog({ title: "Seriyanı ləğv et", message: "Seriyanın bütün gələcək seansları ləğv olunacaq. Davam edək?", confirmLabel: "Ləğv et", danger: true }))) return;
    setSeriesBusy(true);
    try {
      await operatorApi.cancelSeries(a.seriesId);
      globalToast("Seriya ləğv edildi", "success");
      onHistoryChanged();
    } catch (e) { globalToast((e as Error).message, "error"); }
    finally { setSeriesBusy(false); }
  };

  const blockOrUnblock = async () => {
    if (!h?.userId) return;
    try {
      if (h.blocked) {
        if (!(await confirmDialog({ title: "Bloku aç", message: "Bu istifadəçinin blokunu açmaq istəyirsiniz?", confirmLabel: "Aç" }))) return;
        await operatorApi.unblockUser(h.userId);
        globalToast("Blok açıldı", "success");
      } else {
        if (!(await confirmDialog({ title: "İstifadəçini blokla", message: "Bu pasiyenti bloklamaq istəyirsiniz? Səbəbi sonra qeyd kimi əlavə edə bilərsiniz.", confirmLabel: "Blokla", danger: true }))) return;
        await operatorApi.blockUser(h.userId, "");
        globalToast("İstifadəçi bloklandı", "success");
      }
      onHistoryChanged();
    } catch (e) { globalToast((e as Error).message, "error"); }
  };

  return (
    <>
      {/* Pasiyent kartı */}
      <div className="opd-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="opd-card__title">{t("staff.opDetPatientCard")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>{a.patientName ?? "—"}</span>
          <span className={`fx-pill ${a.patientId ? "fx-pill--paid" : "fx-pill--cancelled"}`}>
            {a.patientId && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            )}
            {a.patientId ? t("staff.opDetRegistered") : t("staff.opDetAnonymous")}
          </span>
          {h?.blocked && <span className="fx-pill fx-pill--refunded">BLOKLU</span>}
        </div>
        {a.patientPhone && (
          <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12.5, color: "#5C6B85" }}>{a.patientPhone}</div>
        )}
        {(phone || a.patientEmail) && (
          <div style={{ display: "flex", gap: 8 }}>
            {phone && (
              <a href={`tel:${phone}`} className="opd-icon-btn" title="Zəng et" aria-label="Zəng et">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              </a>
            )}
            {phone && (
              <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" className="opd-icon-btn" title="WhatsApp" aria-label="WhatsApp">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
              </a>
            )}
            {a.patientEmail && (
              <a href={`mailto:${a.patientEmail}`} className="opd-icon-btn" title={a.patientEmail} aria-label="E-poçt">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22,6 12,13 2,6" /></svg>
              </a>
            )}
          </div>
        )}
        {h?.userId && (
          <div style={{ borderTop: "1px solid #EDF1F8", marginTop: 2, paddingTop: 10 }}>
            <span onClick={blockOrUnblock} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") blockOrUnblock(); }}
              style={{ fontSize: 12, color: h.blocked ? "#15803D" : "#94A3B8", cursor: "pointer", fontWeight: 600 }}>
              {h.blocked ? "Bloku aç" : "Blokla / spam"}
            </span>
          </div>
        )}
      </div>

      {/* Müraciət xülasəsi */}
      <div className="opd-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="opd-card__title">Müraciət xülasəsi</div>
        <div className="opd-kv"><span className="opd-kv__k">İstənilən vaxt</span><span className="opd-kv__v">{fmtDateTime(a.requestedStartAt)}</span></div>
        <div className="opd-kv"><span className="opd-kv__k">İstənilən psixoloq</span><span className="opd-kv__v" style={{ fontFamily: "inherit" }}>{a.psychologistName ?? a.requestedPsychologistName ?? "Seçilməyib"}</span></div>
        {a.startAt && <div className="opd-kv"><span className="opd-kv__k">Təyin edilmiş vaxt</span><span className="opd-kv__v">{fmtDateTime(a.startAt)}</span></div>}
        <div className="opd-kv"><span className="opd-kv__k">Yaradılıb</span><span className="opd-kv__v">{fmtDateTime(a.createdAt)}</span></div>
      </div>

      {/* Kurs konteksti */}
      {a.seriesId != null && full.seriesSiblings.length > 0 && (
        <div className="opd-card" style={{ padding: 16 }}>
          <div className="op-det-card__title">
            {t("staff.opDetGroupContext")} · {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal ?? full.seriesSiblings.length })}
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {full.seriesSiblings.map(s => (
              <Link key={s.id} href={`/operator/appointments/${s.id}${suffix}`}
                className={s.id === a.id ? "op-det-sibling op-det-sibling--current" : "op-det-sibling"}>
                <span className="fx-num">#{s.id} · {azOrdinal((s.seriesIndex ?? 0) + 1)} seans</span>
                <span style={{ color: "var(--oxford-60)" }}>{s.startAt ? azFormatDate(s.startAt) : "—"} · {statusLabel(s.status)}</span>
              </Link>
            ))}
          </div>

          {/* Seriyanı bütöv idarə (operator) */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--hairline)", display: "grid", gap: 8 }}>
            {seriesRescheduleOpen ? (
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--oxford-60)" }}>Növbəti seansın yeni başlanğıcı (qalanlar eyni qədər sürüşəcək)</label>
                <DatePicker withTime theme="light" size="sm" value={seriesStart} onChange={setSeriesStart} />
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => { setSeriesRescheduleOpen(false); setSeriesStart(""); }} disabled={seriesBusy}
                    className="fx-btn fx-btn--ghost fx-btn--sm">Ləğv</button>
                  <button onClick={doRescheduleSeries} disabled={seriesBusy || !seriesStart}
                    className="fx-btn fx-btn--primary fx-btn--sm" style={{ opacity: seriesBusy || !seriesStart ? 0.6 : 1, cursor: seriesBusy ? "wait" : "pointer" }}>{seriesBusy ? "…" : "Köçür"}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => setSeriesRescheduleOpen(true)}
                  className="fx-btn fx-btn--ghost fx-btn--sm">
                  Seriyanı köçür
                </button>
                <button onClick={doCancelSeries} disabled={seriesBusy}
                  className="fx-btn fx-btn--danger-ghost fx-btn--sm">
                  Seriyanı ləğv et
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Son fəaliyyət — insaniləşdirilmiş lent (rəngli nöqtə + nisbi vaxt) */}
      {full.activity.length > 0 && (
        <div className="opd-card" style={{ padding: 16 }}>
          <div className="opd-card__title" style={{ marginBottom: 12 }}>Son fəaliyyət</div>
          {full.activity.slice(0, 6).map((item, i, arr) => (
            <div key={i} style={{ display: "flex", gap: 10, paddingBottom: i === arr.length - 1 ? 0 : 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: activityDotColor(item), flex: "none", marginTop: 4 }} />
                {i !== arr.length - 1 && <div style={{ width: 1, flex: 1, background: "#E2E8F5", marginTop: 2 }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: "#1E293B", lineHeight: 1.4 }}>{activityLabel(item)}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }} title={azFormatDateTime(item.createdAt)}>{azFromNow(item.createdAt, nowMs)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

    </>
  );
}

function activityLabel(item: OperatorActivityItem): string {
  const raw = item.text?.trim();
  if (raw) {
    // Backend audit qeydləri bəzən xam ingiliscə + ISO nanosaniyəli tarixlə gəlir
    // (məs. "Psy proposed 1 options · expires 2026-07-19T00:12:07.808…") — bunları
    // operatora insani AZ mətnə çeviririk, tanınmayanların ISO "quyruğunu" kəsirik.
    if (/^Psy proposed/i.test(raw)) return "Psixoloq yeni vaxt təklif etdi";
    if (/^Psy accepted/i.test(raw)) return "Psixoloq təklifi qəbul etdi";
    if (/^Psy rejected/i.test(raw)) return "Psixoloq təklifi rədd etdi";
    if (/^Patient rejected/i.test(raw)) return "Pasiyent təklifi rədd etdi";
    if (/^Patient proposed/i.test(raw)) return "Pasiyent alternativ vaxt təklif etdi";
    // "· expires <ISO>" və ya sonrakı ISO damcı-timestamp quyruğunu təmizlə
    const cleaned = raw
      .replace(/\s*·\s*expires\s+\S+/i, "")
      .replace(/\s*\d{4}-\d{2}-\d{2}T[\d:.]+/g, "")
      .trim();
    return cleaned || "Yeniləndi";
  }
  switch (item.kind) {
    case "CREATED": return "Müraciət yaradıldı";
    case "CONTACT": return "Pasiyentlə əlaqə saxlanıldı";
    case "NOTE": return "Qeyd əlavə edildi";
    default: return item.action ?? "Yeniləndi";
  }
}
/** Fəaliyyət növü → nöqtə rəngi (dizaynın lent nöqtələri). */
function activityDotColor(item: OperatorActivityItem): string {
  const raw = (item.text ?? "").toLowerCase();
  if (item.kind === "CREATED") return "#94A3B8";
  if (/təklif|proposed/.test(raw)) return "#D97706";
  if (/təsdiq|confirm|qəbul|accepted/.test(raw)) return "#16A34A";
  if (/ləğv|cancel|rədd|reject|no-show|gəlmə/.test(raw)) return "#DC2626";
  if (/təyin|assign|vaxt|link|ödəniş|məbləğ/.test(raw)) return "#2563EB";
  return "#94A3B8";
}

// "Digər əməliyyatlar" açarları + sakit sətir/modal meta məlumatı.
type OtherActionKey = "dispute" | "cancelreq" | "noshow" | "cancel";
const OTHER_ACTION_META: Record<OtherActionKey, {
  label: string; border: string; fg: string;
  title: string; sub: string; badge: { label: string; bg: string; color: string };
}> = {
  dispute:   { label: "Mübahisəni həll et", border: "#FDE68A", fg: "#B45309", title: "Mübahisəni həll et", sub: "Seans baş tutdumu? Nəticəni qeyd edin.", badge: { label: "Mübahisəli", bg: "#FFFBEB", color: "#B45309" } },
  cancelreq: { label: "Ləğv tələbi",         border: "#FDE68A", fg: "#B45309", title: "Ləğv tələbi",         sub: "Pasiyentin ləğv tələbini emal edin.",  badge: { label: "Gözlənilir", bg: "#FEF3C7", color: "#92400E" } },
  noshow:    { label: "No-show",             border: "#E2E8F5", fg: "#5C6B85", title: "No-show işarələ",     sub: "Seansa kim gəlmədi?",                  badge: { label: "No-show",    bg: "#F1F5F9", color: "#475569" } },
  cancel:    { label: "Ləğv et",             border: "#FCA5A5", fg: "#DC2626", title: "Müraciəti ləğv et",   sub: "Bu müraciəti bağlayın.",               badge: { label: "Ləğv",       bg: "#FEE2E2", color: "#991B1B" } },
};

/* ─── Mərkəz: təyinat bloku (köhnə AssignModal-ın səhifə bloku) ────────────── */

/* ─── Fokuslu modal qabığı (Bilet new) ─────────────────────────────────────── */

function ModalShell({ title, sub, badge, onClose, footer, maxWidth = 480, children }: {
  title: string;
  sub?: string;
  badge?: { label: string; bg: string; color: string };
  onClose: () => void;
  footer?: React.ReactNode;
  maxWidth?: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div data-op-modal="" className="fx-overlay fx-overlay--center" onClick={onClose} style={{ zIndex: 60, padding: 20 }}>
      <div className="fx-modal" onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth, padding: 0, gap: 0, overflow: "hidden", maxHeight: "86vh" }}>
        <div style={{ padding: "17px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <span className="fx-h3">{title}</span>
              {badge && <span className="fx-pill" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>}
            </div>
            {sub && <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 3 }}>{sub}</div>}
          </div>
          <button onClick={onClose} aria-label="Bağla" style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface-muted)", border: "none", borderRadius: 8, cursor: "pointer", flex: "none", color: "var(--oxford-60)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: "14px 20px", borderTop: "1px solid var(--hairline)" }}>{footer}</div>}
      </div>
    </div>
  );
}

function AssignBlock({ appointment, suggestions, cold, guardAction, selectRef, onAssigned,
  proposedStart = null, proposedEnd = null, proposedInitiator = null }: {
  appointment: AppointmentDetail;
  suggestions: OperatorAppointmentFull["suggestions"];
  cold: boolean;
  guardAction: (run: () => void) => void;
  selectRef: React.RefObject<HTMLButtonElement | null>;
  onAssigned: (a: AppointmentDetail) => void;
  /** Gözləyən vaxt-dəyişmə təklifi varsa (psixoloq/operator/pasiyent) — onun ilk
   *  variantı "İstənilən vaxt" kimi işlədilir (banner + slot seçimi + manual seed). */
  proposedStart?: string | null;
  proposedEnd?: string | null;
  proposedInitiator?: string | null;
}) {
  const { t } = useT();
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [psyId, setPsyId] = useState<number | null>(appointment.requestedPsychologistId ?? appointment.psychologistId ?? null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pickedSlots, setPickedSlots] = useState<string[]>([]);
  const [allowance, setAllowance] = useState<SlotAllowance | null>(null);
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [singlePrice, setSinglePrice] = useState("");  // yalnız tək (paketsiz) seans ödənişi üçün opsional
  const [note, setNote] = useState(appointment.operatorNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [psychModalOpen, setPsychModalOpen] = useState(false);
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    operatorApi.listPsychologists().then(setPsychologists).catch(() => {});
  }, []);

  const loadSlots = useCallback((pid: number) => {
    setLoadingSlots(true);
    const today = new Date();
    const to = new Date(); to.setDate(to.getDate() + 21);
    operatorApi.availability(pid, isoDateOnly(today), isoDateOnly(to), appointment.sessionKind ?? undefined)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [appointment.sessionKind]);

  useEffect(() => {
    if (!psyId) { setSlots([]); return; }
    loadSlots(psyId);
  }, [psyId, loadSlots]);

  // Paket balansı → neçə slot seçilə bilər (paket yoxdursa 1)
  useEffect(() => {
    if (!psyId) { setAllowance(null); return; }
    operatorApi.slotAllowance(appointment.id, psyId)
      .then(setAllowance)
      .catch(() => setAllowance(null));
  }, [psyId, appointment.id]);

  const maxSlots = allowance?.maxSlots ?? 1;

  // Mövcud təyin olunmuş vaxtı (startAt) — varsa — və ya müştərinin istədiyi vaxtı avtomatik göstər.
  // Təyin edilmiş randevuda startAt artıq booked-dur → açıq slotlarda görünmür → manual sahə ilə əks olunur,
  // ona görə yenidən girişdə "Vaxt" özəti boş (seçilməmiş kimi) qalmasın.
  useEffect(() => {
    // Prioritet: gözləyən təklifin vaxtı (psixoloq/operator/pasiyent məhz bu yeni
    // vaxtı istəyir) → mövcud təyin olunmuş vaxt → pasiyentin ilkin istədiyi vaxt.
    const seedStart = proposedStart ?? appointment.startAt ?? appointment.requestedStartAt;
    if (!seedStart || !psyId || loadingSlots) return;
    if (pickedSlots.length > 0 || manualStart) return;
    const reqMs = new Date(seedStart).getTime();
    const match = slots.find(s => new Date(s.startAt).getTime() === reqMs);
    if (match) { setPickedSlots([match.startAt]); return; }
    const psy = psychologists.find(p => p.id === psyId);
    const isIntro = appointment.sessionKind === "INTRO";
    // Standart seans müddəti psixoloqdan gəlir (defaultSessionMinutes). Psixoloq
    // siyahısı HƏLƏ yüklənməyibsə (psychologists boşdur) səhv 50 dəq fallback ilə
    // seed ETMƏ — çünki aşağıdakı `manualStart` guard-ı yanlış aralığı (məs. 10:00–10:50)
    // dondurur və pasiyent tərəfi (məs. 90 dəq) ilə uyğunsuz görünür. Siyahı gəldikdə
    // effekt yenidən işə düşür (psychologists dependency-dir) və düzgün müddətlə seed edir.
    if (!proposedEnd && !isIntro && psychologists.length === 0) return;
    const minutes = isIntro
      ? 15
      : (psy?.defaultSessionMinutes && psy.defaultSessionMinutes > 0 ? psy.defaultSessionMinutes : 50);
    // Təklifin öz bitmə vaxtı varsa onu işlət; yoxsa mövcud randevunun, o da yoxsa
    // psixoloqun standart müddətindən hesabla.
    const seedEnd = proposedEnd
      ?? ((appointment.startAt && appointment.endAt) ? appointment.endAt : new Date(reqMs + minutes * 60_000).toISOString());
    setManualStart(isoToAzLocal(seedStart));
    setManualEnd(isoToAzLocal(seedEnd));
  }, [slots, loadingSlots, psyId, psychologists, appointment.startAt, appointment.endAt, appointment.requestedStartAt, appointment.sessionKind, proposedStart, proposedEnd, pickedSlots.length, manualStart]);

  // Slot seç/çıxar — paket icazəsinə görə tavanla məhdudlaşır.
  const toggleSlot = (startAt: string) => {
    setManualStart(""); setManualEnd("");
    setPickedSlots(prev => {
      if (prev.includes(startAt)) return prev.filter(s => s !== startAt);
      if (maxSlots <= 1) return [startAt]; // tək seçim → əvəzlə
      if (prev.length >= maxSlots) {
        setError(allowance?.packageName
          ? `Paketdə ${maxSlots} seans qalıb — daha çox seçilə bilməz`
          : "Paket yoxdur — yalnız 1 vaxt seçilə bilər");
        return prev;
      }
      setError(null);
      return [...prev, startAt];
    });
  };

  const groupedSlots = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = azFormatDate(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  const doSubmit = async () => {
    setError(null);
    if (!psyId) { setError("Psixoloq seçin"); return; }

    // Seçilmiş slotları (vaxt sırası ilə) payload-a çevir; slot yoxdursa əl ilə.
    let payloadSlots: { startAt: string; endAt: string }[] = [];
    if (pickedSlots.length > 0) {
      payloadSlots = pickedSlots
        .map(st => slots.find(s => s.startAt === st))
        .filter((s): s is AvailableSlot => !!s)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        .map(s => ({ startAt: s.startAt, endAt: s.endAt }));
    } else if (manualStart && manualEnd) {
      const startAt = azLocalToISO(manualStart);
      const endAt = azLocalToISO(manualEnd);
      if (new Date(startAt) >= new Date(endAt)) { setError("Başlama vaxtı bitiş vaxtından əvvəl olmalıdır"); return; }
      payloadSlots = [{ startAt, endAt }];
    }
    if (payloadSlots.length === 0) { setError("Vaxt seçin və ya əl ilə daxil edin"); return; }
    if (payloadSlots.length > maxSlots) {
      setError(allowance?.packageName
        ? `Paketdə ${maxSlots} seans qalıb — daha çox vaxt seçilə bilməz`
        : "Paket yoxdur — yalnız 1 vaxt seçilə bilər");
      return;
    }

    setSaving(true);
    try {
      const updated = await operatorApi.assignSlots(appointment.id, {
        psychologistId: psyId, slots: payloadSlots, operatorNote: note || null,
        // Tək (paketsiz) seans üçün opsional qiymət override-i; paketdə göndərilmir.
        sessionPrice: (!allowance?.packageName && singlePrice.trim()) ? Number(singlePrice) : null,
      });
      const primary = updated.find(u => u.id === appointment.id) ?? updated[0];
      if (primary) onAssigned(primary);
    } catch (e) {
      setError((e as Error).message);
      // GAP-02 / B4-2: konflikt konsolu — slot qaçdı, köhnə seçimi at, yenilə
      if (isSlotConflict(e) && psyId) {
        setPickedSlots([]);
        loadSlots(psyId);
      }
    } finally {
      setSaving(false);
    }
  };

  const selectPsy = (id: number | null) => {
    setPsyId(id);
    setPickedSlots([]);
    setManualStart("");
    setManualEnd("");
    const psy = id !== null ? psychologists.find(p => p.id === id) : null;
    setSinglePrice(psy?.individualPrice != null ? String(psy.individualPrice) : "");
  };

  // "İstənilən vaxt" = gözləyən təklifin vaxtı (varsa) → pasiyentin ilkin istədiyi vaxt.
  const desiredStart = proposedStart ?? appointment.requestedStartAt;
  const requestedMs = desiredStart ? new Date(desiredStart).getTime() : null;
  const chosenSlots = pickedSlots.length > 0
    ? pickedSlots.map(st => {
        const slot = slots.find(x => x.startAt === st);
        // Tam aralığı göstər (başlama – bitmə) ki, operator seansın neçə dəqiqə
        // olduğunu birbaşa görsün — məs. 90 dəq seans üçün "10:00 – 11:30".
        return { key: st, label: slot ? `${azFormatDate(slot.startAt)} · ${azFormatTime(slot.startAt)} – ${azFormatTime(slot.endAt)}` : st, onRemove: () => toggleSlot(st) };
      })
    : (manualStart && manualEnd
        ? [{ key: "manual", label: `${azFormatDate(azLocalToISO(manualStart))} · ${azFormatTime(azLocalToISO(manualStart))} – ${azFormatTime(azLocalToISO(manualEnd))}`, onRemove: () => { setManualStart(""); setManualEnd(""); } }]
        : []);

  const selectedPsy = psychologists.find(p => p.id === psyId) ?? null;
  const sugMatch = suggestions.find(s => s.psychologistId === psyId) ?? null;
  const psychName = selectedPsy ? selectedPsy.name : (psyId ? "Seçilmiş psixoloq" : "Təyin edilməyib");
  const psychScore = sugMatch ? `Skor ${sugMatch.score}` : "";
  const timeN = chosenSlots.length;
  const timeSummary = timeN === 0 ? "Təyin edilməyib" : (timeN === 1 ? chosenSlots[0].label : `${timeN} vaxt seçilib`);
  const ready = !!psyId && timeN > 0;
  // Slot tavanı: paket yoxdursa 1, varsa paketin qalan seans sayı.
  const atCap = maxSlots > 1 && pickedSlots.length >= maxSlots;
  const slotComplete = maxSlots === 1 ? timeN === 1 : timeN === maxSlots;

  const modalPrimary: React.CSSProperties = { width: "100%", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 11, padding: 13, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" };

  return (
    <div className={cold ? "opd-card op-det-card--cold" : "opd-card"} style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
        <span className="opd-card__title">
          {(appointment.status === "CONFIRMED" || appointment.status === "ASSIGNED") ? "Təyin / yenidən planla" : t("staff.opDetAssignBlock")}
        </span>
        {ready
          ? <span className="fx-pill fx-pill--paid">Təyinata hazır</span>
          : <span className="fx-pill fx-pill--pending">Tamamlanmamış</span>}
      </div>

      {/* özət sətirlər */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 13 }}>
        <div className="opd-row">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#5C6B85" }}>Psixoloq</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: psyId ? "#1E293B" : "#94A3B8" }}>{psychName}</span>
              {psychScore && <span className="fx-pill fx-num" style={{ background: "var(--sage-bg)", color: "var(--sage)" }}>{psychScore}</span>}
            </div>
          </div>
          <button ref={selectRef} type="button" onClick={() => setPsychModalOpen(true)} className="opd-ghost-btn">
            {psyId ? "Dəyiş" : "Seç"}
          </button>
        </div>
        <div className="opd-row">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#5C6B85" }}>Vaxt</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: timeN ? "#1E293B" : "#94A3B8", marginTop: 2, fontFamily: timeN ? "'JetBrains Mono', ui-monospace, monospace" : "inherit" }}>{timeSummary}</div>
          </div>
          <button type="button" onClick={() => { if (!psyId) { setPsychModalOpen(true); return; } setTimeModalOpen(true); }} className="opd-ghost-btn">
            {timeN ? "Dəyiş" : "Seç"}
          </button>
        </div>
      </div>

      {!ready && appointment.requestedStartAt && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 10, padding: "9px 13px", marginBottom: 15, fontSize: 12, fontWeight: 600, color: "var(--brand-700)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" /></svg>
          Pasiyentin istəyi: {appointment.requestedPsychologistName ?? appointment.psychologistName ?? "—"} · {fmtDateTime(appointment.requestedStartAt)}
        </div>
      )}

      {(() => {
        if (appointment.sessionKind === "INTRO") return null; // pulsuz tanışlıq — 15 dəq sabitdir, psixoloqun standartı ilə müqayisə olunmur
        if (!appointment.startAt || !appointment.endAt || !selectedPsy?.defaultSessionMinutes) return null;
        const storedMin = Math.round((new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()) / 60_000);
        if (storedMin === selectedPsy.defaultSessionMinutes) return null;
        return (
          <div className="fx-alert" style={{ alignItems: "center", marginBottom: 14, fontSize: 12, fontWeight: 600, color: "var(--status-pending-fg)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
            Mövcud seans müddəti {storedMin} dəq, psixoloqun standartı isə {selectedPsy.defaultSessionMinutes} dəq. Vaxtı yenidən seçərək uyğunlaşdırın.
          </div>
        );
      })()}

      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", margin: "6px 0 6px" }}>Operator qeydi</div>
      <textarea className="fx-textarea" value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Təyinat haqqında daxili qeyd…"
        style={{ marginBottom: 15 }} />

      {!allowance?.packageName && (
        <div style={{ marginBottom: 15 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 }}>
            Seans məbləği (₼)
            <span style={{ color: "var(--oxford-60)", fontWeight: 400 }}> — boş qalarsa ödəniş yaranmır</span>
          </div>
          <input
            className="fx-input fx-num"
            type="number"
            min={0}
            step="0.01"
            value={singlePrice}
            onChange={e => setSinglePrice(e.target.value)}
            placeholder={selectedPsy?.individualPrice != null ? String(selectedPsy.individualPrice) : "məs. 80"}
          />
        </div>
      )}

      {error && (
        <div className="fx-banner fx-banner--error" style={{ fontSize: 12.5, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 14, marginTop: 4, paddingTop: 14, borderTop: "1px solid #EDF1F8" }}>
        <button onClick={() => guardAction(doSubmit)} disabled={saving || !ready}
          style={{ background: (saving || !ready) ? "#A9BEE2" : "#2563EB", color: "#fff", border: "none", borderRadius: 9, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: (saving || !ready) ? "not-allowed" : "pointer" }}>
          {saving ? "Saxlanılır…"
            : pickedSlots.length > 1 ? `${pickedSlots.length} seans təyin et`
            : appointment.status === "ASSIGNED" ? "Yenidən təyin et" : "Təyin et"}
        </button>
      </div>

      {/* PSİXOLOQ MODALI */}
      {psychModalOpen && (
        <ModalShell title="Psixoloq seç" sub="Tövsiyədən seçin və ya siyahıdan tapın." onClose={() => setPsychModalOpen(false)}
          footer={<button onClick={() => setPsychModalOpen(false)} style={modalPrimary}>{psyId ? "Hazırdır" : "Bağla"}</button>}>
          {suggestions.length > 0 && (
            <div style={{ background: "var(--sage-bg)", border: "1px solid rgba(74,155,127,.35)", borderRadius: 12, padding: 13, marginBottom: 15 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sage)", marginBottom: 11 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" /></svg>
                {t("staff.opDetSuggestions")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {suggestions.slice(0, 3).map(s => {
                  const sel = psyId === s.psychologistId;
                  return (
                    <button key={s.psychologistId} type="button"
                      onClick={() => selectPsy(s.psychologistId)}
                      style={{ display: "flex", alignItems: "center", gap: 11, textAlign: "left", background: sel ? "var(--surface)" : "var(--sage-bg)", border: `1.5px solid ${sel ? "var(--sage)" : "rgba(74,155,127,.35)"}`, borderRadius: 10, padding: "11px 13px", cursor: "pointer", fontFamily: "inherit" }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${sel ? "var(--sage)" : "rgba(74,155,127,.45)"}`, background: sel ? "var(--sage)" : "var(--surface)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: sel ? 1 : 0 }}><path d="M20 6L9 17l-5-5" /></svg>
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, marginTop: 1 }}>{s.reasons.join(" · ")}</div>
                      </div>
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
                        <span className="fx-num" style={{ fontSize: 17, fontWeight: 800, color: "var(--sage)", lineHeight: 1 }}>{s.score}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--oxford-60)", letterSpacing: ".04em" }}>SKOR</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 }}>Psixoloq</div>
          <div style={{ position: "relative" }}>
            <select className="fx-select" value={psyId ?? ""} onChange={e => selectPsy(Number(e.target.value) || null)}
              style={{ appearance: "none", WebkitAppearance: "none", background: "var(--surface)", padding: "11px 38px 11px 13px", fontWeight: 600, cursor: "pointer" }}>
              <option value="">Psixoloq seçin…</option>
              {psychologists.map(p => <option key={p.id} value={p.id}>{p.name} · {p.title}</option>)}
            </select>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--oxford-60)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="M6 9l6 6 6-6" /></svg>
          </div>
        </ModalShell>
      )}

      {/* VAXT MODALI */}
      {timeModalOpen && (
        <ModalShell title="Vaxt seç" sub="Açıq slotlardan seçin və ya əl ilə daxil edin." maxWidth={500} onClose={() => setTimeModalOpen(false)}
          footer={<button onClick={() => setTimeModalOpen(false)} style={modalPrimary}>{slotComplete ? "Hazırdır" : "Bağla"}</button>}>
          {!psyId ? (
            <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 500 }}>Əvvəlcə psixoloq seçin.</div>
          ) : (
            <>
              {desiredStart && (
                <div style={{ display: "flex", gap: 9, alignItems: "center", background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 10, padding: "10px 13px", marginBottom: 11 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--brand-700)" }}>
                    {proposedStart
                      ? `${proposedInitiator === "PSYCHOLOGIST" ? "Psixoloqun təklif etdiyi vaxt"
                          : proposedInitiator === "PATIENT" ? "Pasiyentin təklif etdiyi vaxt"
                          : "Təklif olunan vaxt"}: ${fmtDateTime(proposedStart)} — uyğun slot avtomatik seçilir`
                      : `İstənilən vaxt: ${fmtDateTime(appointment.requestedStartAt)} — uyğun slot avtomatik seçilir`}
                  </span>
                </div>
              )}

              {allowance && (
                allowance.packageName ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--lilac-bg)", border: "1px solid rgba(140,125,201,.35)", borderRadius: 10, padding: "10px 13px", marginBottom: 13, fontSize: 12.5, fontWeight: 700, color: "var(--lilac)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /></svg>
                    <span className="fx-num">Paket: {allowance.packageName} · {allowance.remainingSessions} qalıb — {maxSlots} vaxta qədər seçə bilərsiniz</span>
                  </div>
                ) : (
                  <div className="fx-alert" style={{ alignItems: "center", marginBottom: 13, fontSize: 12.5, fontWeight: 700, color: "var(--status-pending-fg)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /></svg>
                    <span>Paket yoxdur — yalnız 1 vaxt seçilə bilər.</span>
                  </div>
                )
              )}

              <div className="fx-num" style={{ display: "flex", alignItems: "center", gap: 8, background: slotComplete ? "var(--sage-bg)" : "var(--surface-muted)", color: slotComplete ? "var(--sage)" : "var(--oxford-60)", borderRadius: 10, padding: "9px 13px", marginBottom: 13, fontSize: 12.5, fontWeight: 700 }}>
                {slotComplete
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M20 6L9 17l-5-5" /></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>}
                {maxSlots === 1 ? "Tək seans — yalnız 1 vaxt seçin" : `${timeN}/${maxSlots} seçildi`}
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8AAABF", marginBottom: 11 }}>Açıq vaxtlar</div>
              {loadingSlots ? (
                <div style={{ fontSize: 12, color: "var(--oxford-60)", marginBottom: 12 }}>Yüklənir…</div>
              ) : groupedSlots.length === 0 ? (
                <div style={{ background: "#FEF3C7", border: "1px solid #FCE7A8", borderRadius: 10, padding: 11, fontSize: 12, color: "#92400E", marginBottom: 12 }}>
                  Açıq slot yoxdur. Aşağıda əl ilə vaxt yazın.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 13, marginBottom: 13 }}>
                  {groupedSlots.map(([day, daySlots]) => (
                    <div key={day}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#8AAABF", marginBottom: 8, textTransform: "uppercase" }}>{day}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {daySlots.map(s => {
                          const slotMs = new Date(s.startAt).getTime();
                          const active = pickedSlots.includes(s.startAt);
                          const order = active ? pickedSlots.indexOf(s.startAt) + 1 : 0;
                          const isRequested = requestedMs !== null && slotMs === requestedMs;
                          const disabled = atCap && !active;
                          return (
                            <button key={s.startAt} type="button"
                              title={isRequested ? (proposedStart ? "Təklif olunan vaxt" : "Müştərinin istədiyi vaxt") : disabled ? "Tavan dolub" : undefined}
                              disabled={disabled}
                              onClick={disabled ? undefined : () => toggleSlot(s.startAt)}
                              style={{ position: "relative", padding: "9px 15px", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, fontFamily: "inherit",
                                border: active ? "1.5px solid var(--brand)" : disabled ? "1.5px solid #E5E7EB" : isRequested ? "1.5px solid #047857" : "1.5px solid #D6E2F7",
                                background: active ? "#E4ECFA" : disabled ? "#F3F4F6" : isRequested ? "#ECFDF5" : "#fff",
                                color: active ? "#082F6D" : disabled ? "#C0C9D6" : isRequested ? "#047857" : "var(--oxford)" }}>
                              {azFormatTime(s.startAt)} – {azFormatTime(s.endAt)}
                              {maxSlots > 1 && active && (
                                <span style={{ position: "absolute", top: -7, right: -7, width: 18, height: 18, background: "var(--brand)", color: "#fff", border: "2px solid #fff", borderRadius: "50%", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{order}</span>
                              )}
                              {isRequested && !active && (
                                <span style={{ position: "absolute", top: -5, right: -5, width: 9, height: 9, background: "#047857", border: "2px solid #fff", borderRadius: "50%" }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" onClick={() => setManualOpen(o => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", fontSize: 12.5, fontWeight: 600, color: "var(--brand)", cursor: "pointer", fontFamily: "inherit", padding: "2px 0", marginBottom: 6 }}>
                Əl ilə vaxt daxil et
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: (manualOpen || !!manualStart) ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><path d="M6 9l6 6 6-6" /></svg>
              </button>
              {(manualOpen || !!manualStart) && (
                <div style={{ background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 11, padding: 13, marginBottom: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <label style={{ display: "block" }}>
                      <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 5 }}>Başlama vaxtı</span>
                      <DatePicker withTime theme="light" size="sm" value={manualStart} onChange={v => { setManualStart(v); setPickedSlots([]); }} style={{ width: "100%" }} />
                    </label>
                    <label style={{ display: "block" }}>
                      <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 5 }}>Bitmə vaxtı</span>
                      <DatePicker withTime theme="light" size="sm" value={manualEnd} onChange={v => { setManualEnd(v); setPickedSlots([]); }} style={{ width: "100%" }} />
                    </label>
                  </div>
                </div>
              )}

              {chosenSlots.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#9DB0CC", fontWeight: 500, background: "#F8FAFD", border: "1px dashed #D6E2F7", borderRadius: 10, padding: "11px 13px" }}>
                  Vaxt seçilməyib — yuxarıdan slot seçin və ya əl ilə tarix daxil edin.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {chosenSlots.map((c, i) => (
                    <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 10, background: "#E4ECFA", border: "1px solid #C7DBF6", borderRadius: 10, padding: "9px 12px" }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--brand)", color: "#fff", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: "var(--brand-700)" }}>{c.label}</span>
                      <button type="button" onClick={c.onRemove} title="Sil" style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#991B1B", border: "1px solid #F3D6D6", borderRadius: 8, cursor: "pointer", flex: "none" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Tək (paketsiz) seans → opsional qiymət; ödəniş "Ödənişlər → Gözləyir"də yaranır. */}
              {!allowance?.packageName && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #EDF1F8" }}>
                  <label style={{ display: "block" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8AAABF", marginBottom: 8 }}>Seans qiyməti (₼)</span>
                    <input type="number" min={0} step="0.01" value={singlePrice} onChange={e => setSinglePrice(e.target.value)}
                      placeholder="Psixoloqun standart qiyməti"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #D6E2F7", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
                  </label>
                  <div style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>
                    Boş buraxsan psixoloqun standart tək seans qiyməti tətbiq olunur. PENDING ödəniş «Ödənişlər → Gözləyir»də yaranır.
                  </div>
                </div>
              )}
            </>
          )}
        </ModalShell>
      )}
    </div>
  );
}

/* ─── Mərkəz: mübahisə həlli bloku ─────────────────────────────────────────── */

function ResolveDisputeBlock({ appointment, guardAction, onDone }: {
  appointment: AppointmentDetail;
  guardAction: (run: () => void) => void;
  onDone: (a: AppointmentDetail) => void;
}) {
  const [decision, setDecision] = useState<"COMPLETE" | "CANCEL">("COMPLETE");
  const [blameSide, setBlameSide] = useState<"PATIENT" | "PSYCHOLOGIST" | "NONE">("NONE");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const doSubmit = async () => {
    setErr(null); setSaving(true);
    try {
      const blame = decision === "CANCEL" && blameSide !== "NONE" ? blameSide : undefined;
      const updated = await operatorApi.resolveDispute(appointment.id, decision, note.trim() || undefined, blame);
      onDone(updated);
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setDecision("COMPLETE")}
          style={{
            padding: 10, borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "left",
            border: decision === "COMPLETE" ? "2px solid #10B981" : "1px solid #E5E7EB",
            background: decision === "COMPLETE" ? "#D1FAE5" : "#fff",
            color: decision === "COMPLETE" ? "#065F46" : "#1A2535",
          }}>
          <div style={{ fontWeight: 700 }}>Tamamlanmış say</div>
          <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 2 }}>Seans baş tutdu</div>
        </button>
        <button type="button" onClick={() => setDecision("CANCEL")}
          style={{
            padding: 10, borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "left",
            border: decision === "CANCEL" ? "2px solid #DC2626" : "1px solid #E5E7EB",
            background: decision === "CANCEL" ? "#FEE2E2" : "#fff",
            color: decision === "CANCEL" ? "#991B1B" : "#1A2535",
          }}>
          <div style={{ fontWeight: 700 }}>Ləğv et</div>
          <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 2 }}>Seans baş tutmadı</div>
        </button>
      </div>

      {decision === "CANCEL" && (
        <>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
            Kim "no-show" sayğacına işlənsin?
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
            {([
              { v: "NONE", label: "Heç kim", sub: "Texniki" },
              { v: "PATIENT", label: "Pasient", sub: "Gəlmədi" },
              { v: "PSYCHOLOGIST", label: "Psixoloq", sub: "Gəlmədi" },
            ] as const).map(o => (
              <button key={o.v} type="button" onClick={() => setBlameSide(o.v)}
                style={{
                  padding: 8, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left",
                  border: blameSide === o.v ? "2px solid var(--brand)" : "1px solid #E5E7EB",
                  background: blameSide === o.v ? "var(--brand-50)" : "#fff",
                  color: blameSide === o.v ? "var(--brand-700)" : "#1A2535",
                }}>
                <div style={{ fontWeight: 700 }}>{o.label}</div>
                <div style={{ fontSize: 10, opacity: 0.85 }}>{o.sub}</div>
              </button>
            ))}
          </div>
        </>
      )}

      <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
        placeholder="Operator qeydi (məcburi deyil)"
        style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12.5, fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box" }} />

      {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>{err}</div>}

      <button onClick={() => guardAction(doSubmit)} disabled={saving}
        style={{
          width: "100%", padding: 12, borderRadius: 11, fontSize: 14, fontWeight: 700, fontFamily: "inherit",
          background: decision === "COMPLETE" ? "#ECFDF5" : "#FEE2E2",
          color: decision === "COMPLETE" ? "#047857" : "#991B1B",
          border: decision === "COMPLETE" ? "1.5px solid #A7D8BC" : "1.5px solid #F3D6D6",
          cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
        }}>
        {saving ? "Göndərilir…" : decision === "COMPLETE" ? "Tamamlanmış say" : "Ləğv et"}
      </button>
    </>
  );
}

/* ─── No-show işarələmə bloku (Option B) — modal formu ──────────────────────── */

function NoShowBlock({ appointment, guardAction, onDone }: {
  appointment: AppointmentDetail;
  guardAction: (run: () => void) => void;
  onDone: (a: AppointmentDetail) => void;
}) {
  const [blameSide, setBlameSide] = useState<"PATIENT" | "PSYCHOLOGIST">("PATIENT");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const doSubmit = async () => {
    setErr(null); setSaving(true);
    try {
      const updated = await operatorApi.markNoShow(appointment.id, blameSide, note.trim() || undefined);
      onDone(updated);
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <p style={{ fontSize: 12, color: "#52718F", margin: "0 0 10px" }}>
        Seans avtomatik tamamlandı, amma əslində baş tutmayıbsa, buradan no-show kimi işarələyin —
        seçilən tərəfin no-show sayğacı artacaq.
      </p>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
        Kim gəlmədi?
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
        {([
          { v: "PATIENT", label: "Pasient" },
          { v: "PSYCHOLOGIST", label: "Psixoloq" },
        ] as const).map(o => (
          <button key={o.v} type="button" onClick={() => setBlameSide(o.v)}
            style={{
              padding: 10, borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "left",
              border: blameSide === o.v ? "2px solid var(--brand)" : "1px solid #E5E7EB",
              background: blameSide === o.v ? "var(--brand-50)" : "#fff",
              color: blameSide === o.v ? "var(--brand-700)" : "#1A2535",
            }}>
            {o.label}
          </button>
        ))}
      </div>
      <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
        placeholder="Qeyd (məcburi deyil)"
        style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12.5, fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box" }} />
      {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <button onClick={() => guardAction(doSubmit)} disabled={saving}
        style={{
          width: "100%", padding: 12, borderRadius: 11, fontSize: 14, fontWeight: 700, fontFamily: "inherit",
          background: "#FEE2E2", color: "#991B1B", border: "1.5px solid #F3D6D6", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
        }}>
        {saving ? "Göndərilir…" : "No-show işarələ"}
      </button>
    </>
  );
}

/* ─── Ləğv tələbi bloku (approve/reject) — modal formu ──────────────────────── */

function CancelRequestBlock({ appointment, guardAction, onDone }: {
  appointment: AppointmentDetail;
  guardAction: (run: () => void) => void;
  onDone: (a: AppointmentDetail, approved: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = (approved: boolean) => async () => {
    setErr(null); setSaving(true);
    try {
      const updated = approved
        ? await operatorApi.approveCancelRequest(appointment.id, note.trim() || undefined)
        : await operatorApi.rejectCancelRequest(appointment.id, note.trim() || undefined);
      onDone(updated, approved);
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
        placeholder="Pasiyentə qeyd (təsdiqdə məcburi deyil, rəddə tövsiyə olunur)"
        style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12.5, fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box" }} />
      {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button onClick={() => guardAction(run(true))} disabled={saving}
          style={{ padding: 12, border: "1.5px solid #F3D6D6", borderRadius: 11, fontSize: 14, fontWeight: 700, fontFamily: "inherit", background: "#FEE2E2", color: "#991B1B", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          Ləğvi təsdiqlə
        </button>
        <button onClick={() => guardAction(run(false))} disabled={saving}
          style={{ padding: 12, border: "1px solid #D6E2F7", borderRadius: 11, fontSize: 14, fontWeight: 600, fontFamily: "inherit", background: "#fff", color: "var(--oxford)", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          Tələbi rədd et
        </button>
      </div>
    </>
  );
}

/* ─── Mərkəz: operator ləğvi bloku (köhnə CancelModal axını) ───────────────── */

function CancelBlock({ appointment, guardAction, onClose, onDone }: {
  appointment: AppointmentDetail;
  guardAction: (run: () => void) => void;
  onClose: () => void;
  onDone: (a: AppointmentDetail) => void;
}) {
  const reasons = useMemo(() => CANCEL_REASONS.filter(r => r.role === "OPERATOR"), []);
  const [reasonCode, setReasonCode] = useState(reasons[0]?.code ?? "OPERATOR_OTHER");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const doSubmit = async () => {
    setErr(null); setSaving(true);
    try {
      const updated = await operatorApi.cancel(appointment.id, reasonCode, note.trim() || undefined);
      onDone(updated);
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Səbəb</label>
      <select value={reasonCode} onChange={e => setReasonCode(e.target.value)}
        style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12.5, marginBottom: 10 }}>
        {reasons.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
      </select>
      <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
        placeholder="Qeyd (məcburi deyil)"
        style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12.5, fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box" }} />
      {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose}
          style={{ flex: 1, padding: "9px 14px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 12.5, fontWeight: 600, background: "#fff", cursor: "pointer" }}>
          Bağla
        </button>
        <button onClick={() => guardAction(doSubmit)} disabled={saving}
          style={{ flex: 1, padding: 11, border: "1.5px solid #F3D6D6", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", background: "#FEE2E2", color: "#991B1B", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Göndərilir…" : "Ləğv et"}
        </button>
      </div>
    </>
  );
}

/* ─── Görüş linki modalı (əlavə et / dəyiş) ────────────────────────────────── */

function LinkEditModal({ appointment, onClose, onSaved }: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState(appointment.meetingLink ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const v = url.trim();
    if (!v) { setErr("Görüş linki daxil edin"); return; }
    setErr(null); setSaving(true);
    try { await operatorApi.setMeetingLink(appointment.id, v); onSaved(); }
    catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title={appointment.meetingLink ? "Görüş linkini dəyiş" : "Görüş linki əlavə et"} onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} className="opd-ghost-btn">İmtina</button>
          <button onClick={submit} disabled={saving}
            style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "…" : "Yadda saxla"}
          </button>
        </div>
      }>
      <label style={{ display: "block", fontSize: 12, color: "#5C6B85", fontWeight: 600, marginBottom: 6 }}>Görüş linki</label>
      <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://meet.google.com/..." autoFocus
        style={{ width: "100%", border: "1px solid #E2E8F5", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1E293B", boxSizing: "border-box", fontFamily: "inherit" }} />
      {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 10 }}>{err}</div>}
    </ModalShell>
  );
}

/* ─── Ödəniş modalı (məbləği təyin et) ─────────────────────────────────────── */

function PaymentEditModal({ appointment, onClose, onSaved }: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setErr("Məbləği düzgün daxil edin"); return; }
    setErr(null); setSaving(true);
    try { await operatorApi.createManualPayment(appointment.id, amt); onSaved(); }
    catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title="Seans məbləğini təyin et" sub="PENDING ödəniş yaranır və «Ödənişlər»də görünür." onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} className="opd-ghost-btn">İmtina</button>
          <button onClick={submit} disabled={saving}
            style={{ background: "#15803D", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "…" : "Yadda saxla"}
          </button>
        </div>
      }>
      <label style={{ display: "block", fontSize: 12, color: "#5C6B85", fontWeight: 600, marginBottom: 6 }}>Seans məbləği (₼)</label>
      <input type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="məs. 80" autoFocus
        style={{ width: "100%", border: "1px solid #E2E8F5", borderRadius: 8, padding: "9px 12px", fontSize: 13.5, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "#1E293B", boxSizing: "border-box" }} />
      {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 10 }}>{err}</div>}
    </ModalShell>
  );
}

