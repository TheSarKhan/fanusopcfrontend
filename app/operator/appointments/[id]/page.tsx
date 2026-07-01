"use client";

/**
 * OP-1: Müraciət detal səhifəsi — modal yığını əvəzinə "ticket" iş səhifəsi.
 * 3 zona (kontekst / əməliyyat / fəaliyyət lenti) + sticky header.
 * Pool sahibliyi: səhifəni açmaq sahibliyi GÖTÜRMÜR — operator açıq "Götür"
 * düyməsi (və ya ilk əməliyyat) ilə müraciəti daimi öz üzərinə götürür; sahib
 * "Pool-a burax", admin isə başqa operatora keçirə bilər.
 */

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ApiError,
  operatorApi,
  isSlotConflict,
  CANCEL_REASONS,
  reasonLabel,
  type AppointmentDetail,
  type AvailableSlot,
  type ClaimState,
  type MeetingLinkLogItem,
  type OperatorActivityItem,
  type OperatorAppointmentFull,
  type Psychologist,
  type SlotAllowance,
} from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import DatePicker from "@/components/DatePicker";
import { toast as globalToast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";
import { subscribeNotifications, subscribeOperatorClaims } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azLocalToISO, isoToAzLocal, azFormatDate, azFormatTime, azFormatDateTime, azOrdinal } from "@/lib/datetime";

const QUEUE_KEY = "fanus.op.queue";
const AUTO_ADVANCE_KEY = "fanus.op.autoAdvance";

const STATUS_TONE: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING:               { label: "Gözlənilir",      bg: "#FEF3C7", fg: "#92400E" },
  NEW:                   { label: "Yeni",            bg: "#FEF3C7", fg: "#92400E" },
  REJECTED:              { label: "Yenidən təyin",   bg: "#FEF3C7", fg: "#92400E" },
  IN_REVIEW:             { label: "Operatorda",      bg: "#FEF3C7", fg: "#92400E" },
  ASSIGNED:              { label: "Təyin edilib",    bg: "var(--brand-50)", fg: "var(--brand-700)" },
  CONFIRMED:             { label: "Təsdiqlənib",     bg: "#D1FAE5", fg: "#065F46" },
  AWAITING_CONFIRMATION: { label: "Təsdiq gözlənir", bg: "#FEF3C7", fg: "#92400E" },
  DISPUTED:              { label: "Mübahisəli",      bg: "#FEE2E2", fg: "#991B1B" },
  COMPLETED:             { label: "Tamamlanıb",      bg: "#F3F4F6", fg: "#374151" },
  CANCELLED:             { label: "Ləğv edilib",     bg: "#FEE2E2", fg: "#991B1B" },
  CANCEL_REQUESTED:      { label: "Ləğv gözlənir",   bg: "#FEF3C7", fg: "#92400E" },
};

const CHANNEL_LABEL: Record<string, string> = {
  CALL: "Zəng", WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "Email", OTHER: "Digər",
};
const OUTCOME_LABEL: Record<string, string> = {
  ANSWERED: "Cavab verdi", NO_ANSWER: "Cavab vermədi", BUSY: "Məşğul",
  REFUSED: "İmtina etdi", RESCHEDULED: "Vaxt dəyişdi", OTHER: "Digər",
};
const AUDIT_LABEL: Record<string, string> = {
  APPT_ASSIGN: "Təyinat",
  APPT_FORCE_CANCEL: "Operator ləğvi",
  APPT_DISPUTE_RESOLVE: "Mübahisə həlli",
  APPT_CANCEL_REQ_APPROVE: "Ləğv tələbi təsdiqi",
  APPT_CANCEL_REQ_REJECT: "Ləğv tələbi rəddi",
  APPT_HANDOFF: "Psixoloq operatora ötürdü",
  APPT_CLAIM_REASSIGN: "Müraciət təhvili",
  APPT_MEETING_LINK_SET: "Görüş linki əlavə edildi",
  APPT_MEETING_LINK_UPDATED: "Görüş linki yeniləndi",
  APPT_MEETING_LINK_REVOKED: "Görüş linki ləğv edildi",
  APPT_MEETING_LINK_SENT: "Görüş linki göndərildi",
};
const FLAG_LABEL: Record<string, string> = {
  HIGH_NO_SHOW: "Yüksək no-show", HIGH_LATE_CANCEL: "Yüksək gec ləğv", HIGH_REJECT: "Yüksək rədd",
};

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
function minutesSince(iso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000));
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
  const [loading, setLoading] = useState(true);
  const [claim, setClaim] = useState<ClaimState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [queueIds, setQueueIds] = useState<number[]>([]);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [zone, setZone] = useState<"work" | "context" | "feed">("work"); // <900px tablar
  const assignFocusRef = useRef<HTMLButtonElement | null>(null);
  const composerFocusRef = useRef<HTMLTextAreaElement | null>(null);

  const a = full?.appointment ?? null;
  const claimedByOther = !!claim?.claimedByUserId && !claim.mine;
  const unowned = !claim?.claimedByUserId;

  // ── localStorage: auto-advance toggle ─────────────────────────────────────
  useEffect(() => {
    try { setAutoAdvance(JSON.parse(localStorage.getItem(AUTO_ADVANCE_KEY) ?? "true")); } catch { /* default */ }
  }, []);
  const toggleAutoAdvance = () => {
    setAutoAdvance(prev => {
      try { localStorage.setItem(AUTO_ADVANCE_KEY, JSON.stringify(!prev)); } catch { /* ignore */ }
      return !prev;
    });
  };

  // ── Data load ──────────────────────────────────────────────────────────────
  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    operatorApi.fullAppointment(id)
      .then(f => { setFull(f); setClaim(f.claim); setNotFound(false); })
      .catch(e => { if (e instanceof ApiError && e.status === 404) setNotFound(true); })
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

  // ── Növbə konteksti (J/K naviqasiyası siyahı filtrinə hörmət edir) ────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { ids: number[] };
        if (Array.isArray(parsed.ids) && parsed.ids.includes(id)) {
          setQueueIds(parsed.ids);
          return;
        }
      }
    } catch { /* fall through */ }
    // Deep-link (bildirişdən) — siyahını çəkib URL filtr kontekstini tətbiq et
    const queue = searchParams.get("queue");
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    const overdue = searchParams.get("filter") === "overdue";
    operatorApi.listAppointments().then(items => {
      const ids = items.filter(x => {
        if (overdue) return x.status === "PENDING" || x.status === "NEW";
        if (queue === "PENDING") { if (!(x.status === "PENDING" || x.status === "REJECTED")) return false; }
        else if (queue === "CONFIRMED") { if (!(x.status === "CONFIRMED" || x.status === "AWAITING_CONFIRMATION")) return false; }
        else if (queue) { if (x.status !== queue) return false; }
        if (!q) return true;
        const hay = `${x.id} ${x.patientName ?? ""} ${x.psychologistName ?? ""} ${x.note ?? ""}`.toLowerCase();
        return hay.includes(q);
      }).map(x => x.id);
      setQueueIds(ids.length ? ids : items.map(x => x.id));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const queuePos = queueIds.indexOf(id);
  const prevId = queuePos > 0 ? queueIds[queuePos - 1] : null;
  const nextId = queuePos >= 0 && queuePos < queueIds.length - 1 ? queueIds[queuePos + 1] : null;

  const qs = searchParams.toString();
  const goTo = useCallback((target: number) => {
    router.push(`/operator/appointments/${target}${qs ? `?${qs}` : ""}`);
  }, [router, qs]);
  const backToList = useCallback(() => {
    const listQs = new URLSearchParams(qs);
    listQs.delete("queue");
    const tab = searchParams.get("queue");
    if (tab) listQs.set("tab", tab);
    const s = listQs.toString();
    router.push(`/operator/appointments${s ? `?${s}` : ""}`);
  }, [router, qs, searchParams]);

  // ── Klaviatura: J/K növbə, A təyinat, N qeyd, Esc siyahı ──────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
      // Modal (psixoloq/vaxt/əməliyyat) açıqdırsa qısayolları söndür.
      if (typeof document !== "undefined" && document.querySelector("[data-op-modal]")) return;
      const k = e.key.toLowerCase();
      if (k === "j" && nextId) { e.preventDefault(); goTo(nextId); }
      else if (k === "k" && prevId) { e.preventDefault(); goTo(prevId); }
      else if (k === "a") { e.preventDefault(); assignFocusRef.current?.focus(); }
      else if (k === "n") { e.preventDefault(); composerFocusRef.current?.focus(); }
      else if (e.key === "Escape" && !reassignOpen) { e.preventDefault(); backToList(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextId, prevId, goTo, backToList, reassignOpen]);

  // ── Toast ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const tm = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(tm);
  }, [toast]);

  // ── Pooldan götür / pool-a burax ──────────────────────────────────────────
  const takeOwnership = useCallback(() => {
    operatorApi.claim(id).then(setClaim).catch(e => setToast((e as Error).message));
  }, [id]);

  const releaseOwnership = useCallback(() => {
    operatorApi.claimRelease(id).then(setClaim).catch(e => setToast((e as Error).message));
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

  // ── Yekun əməliyyat: toast + auto-advance ─────────────────────────────────
  // Sahiblik QALIR (pool modeli) — yekun əməliyyat claim-i sıfırlamır.
  const onActionDone = useCallback((updated: AppointmentDetail, msg: string) => {
    setFull(prev => prev ? { ...prev, appointment: updated } : prev);
    setToast(msg);
    load(true); // lenti yenilə (audit qeydi gəlib)
    if (autoAdvance && nextId) {
      setTimeout(() => goTo(nextId), 700);
    }
  }, [autoAdvance, nextId, goTo, load]);

  // ── Render halları ─────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div style={{ background: "#fff", borderRadius: 16, padding: "4rem 2rem", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#8AAABF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A2535", margin: 0 }}>{t("staff.opDetNotFound")}</h1>
        <p style={{ color: "#52718F", fontSize: 13, marginTop: 6 }}>{t("staff.opDetNotFoundSub")}</p>
        <Link href="/operator/appointments"
          style={{ display: "inline-block", marginTop: 16, padding: "10px 20px", background: "var(--brand)", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          {t("staff.opDetBackToList")}
        </Link>
      </div>
    );
  }
  if (loading || !full || !a) {
    return <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>;
  }

  const statusMeta = STATUS_TONE[a.status] ?? { label: a.status, bg: "#EEF2F7", fg: "#374151" };
  const isFinal = a.status === "COMPLETED" || a.status === "CANCELLED";
  const ageMin = minutesSince(a.createdAt, nowMs);
  const slaColor = ageMin < 60 ? "#065F46" : ageMin <= full.slaHours * 60 ? "#92400E" : "#DC2626";
  const slaBg = ageMin < 60 ? "#D1FAE5" : ageMin <= full.slaHours * 60 ? "#FEF3C7" : "#FEE2E2";
  const claimedMin = claim?.claimedAt ? minutesSince(claim.claimedAt, nowMs) : 0;

  const isCancelReq = a.status === "CANCEL_REQUESTED";
  // CONFIRMED included so the assign block doubles as the reschedule / change-psychologist tool.
  const canAssign = !isCancelReq && !isFinal && ["PENDING", "NEW", "REJECTED", "ASSIGNED", "IN_REVIEW", "CONFIRMED"].includes(a.status);
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

  const copyLink = () => {
    try {
      navigator.clipboard.writeText(`${window.location.origin}/operator/appointments/${id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className={claimedByOther ? "op-det op-det--busy" : "op-det"}>

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div className="op-det__header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          <button onClick={backToList} title={t("staff.opDetBackToList")}
            style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #D6E2F7", background: "#fff", borderRadius: 9, cursor: "pointer", flex: "none", color: "var(--oxford)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>#FNS-{String(id).padStart(4, "0")}</span>
          <span style={{ padding: "4px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: statusMeta.bg, color: statusMeta.fg }}>
            {statusMeta.label}
          </span>
          {!isFinal && (
            <span title={`SLA: ${full.slaHours} saat`}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: slaBg, color: slaColor }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {t("staff.opDetWaiting", { time: ageLabel(a.createdAt, nowMs) })}
            </span>
          )}
          {claim?.claimedByUserId && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: claim.mine ? "#ECFDF5" : "#FEF3C7", color: claim.mine ? "#047857" : "#92400E" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: claim.mine ? "#047857" : "#D97706" }} />
              {claim.mine ? t("staff.opClaimMine") : t("staff.opClaimWorking", { name: claim.claimedByName ?? "?" })}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {unowned && (
            <button onClick={takeOwnership}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "#047857", color: "#fff", borderRadius: 9, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
              {t("staff.opTake")}
            </button>
          )}
          {claim?.mine && (
            <button onClick={releaseOwnership}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 9, padding: "8px 13px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              {t("staff.opReleaseToPool")}
            </button>
          )}
          {isAdmin && !unowned && (
            <button onClick={() => setReassignOpen(true)}
              style={{ background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 9, padding: "8px 13px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              {t("staff.opReassign")}
            </button>
          )}
          <button onClick={toggleAutoAdvance}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #D6E2F7", borderRadius: 9, padding: "7px 12px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", color: "var(--oxford)" }}>
            <span style={{ width: 34, height: 19, borderRadius: 999, background: autoAdvance ? "#047857" : "#CBD5E6", position: "relative", flex: "none", transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 2, left: 2, width: 15, height: 15, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", transform: autoAdvance ? "translateX(15px)" : "translateX(0)", transition: "transform .2s" }} />
            </span>
            {t("staff.opDetAutoAdvance")}
          </button>
          <button onClick={copyLink}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 9, padding: "8px 13px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            {copied ? t("staff.opDetCopied") : t("staff.opDetCopyLink")}
          </button>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #D6E2F7", borderRadius: 9, padding: 3 }}>
            <button onClick={() => prevId && goTo(prevId)} disabled={!prevId} title={t("staff.opDetPrev")}
              style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: 7, cursor: prevId ? "pointer" : "not-allowed", opacity: prevId ? 1 : 0.35, color: "var(--oxford)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12.5, fontWeight: 700, color: "var(--oxford-60)", padding: "0 4px" }}>
              {queuePos >= 0 ? `${queuePos + 1}/${queueIds.length}` : "—"}
            </span>
            <button onClick={() => nextId && goTo(nextId)} disabled={!nextId} title={t("staff.opDetNext")}
              style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: 7, cursor: nextId ? "pointer" : "not-allowed", opacity: nextId ? 1 : 0.35, color: "var(--oxford)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
          <span title="Klaviatura qısayolları" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, fontWeight: 600, color: "#8AAABF" }}>
            J/K növbə · A təyin · N qeyd · Esc siyahı
          </span>
        </div>
      </div>

      {/* ── OP-2: başqasının claim-i — sarı banner ─────────────────────────── */}
      {claimedByOther && claim?.claimedByName && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12, padding: "10px 16px", margin: "12px 0", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#92400E", fontWeight: 600 }}>
          <span className="op-claim-dot" style={{ background: "#D97706" }} />
          {claimedMin > 0
            ? t("staff.opClaimBanner", { name: claim.claimedByName, minutes: claimedMin })
            : t("staff.opClaimBannerFresh", { name: claim.claimedByName })}
        </div>
      )}

      {/* ── <900px zona tabları ────────────────────────────────────────────── */}
      <div className="op-det__tabs">
        {([["work", t("staff.opDetZoneWork")], ["context", t("staff.opDetZoneContext")], ["feed", t("staff.opDetZoneFeed")]] as const).map(([z, label]) => (
          <button key={z} onClick={() => setZone(z)}
            className={zone === z ? "op-det__tab op-det__tab--active" : "op-det__tab"}>
            {label}
          </button>
        ))}
      </div>

      <div className="op-det__grid">

        {/* ── Sol zona: Kontekst ─────────────────────────────────────────────── */}
        <aside className={`op-det__zone op-det__zone--context${zone === "context" ? " op-det__zone--visible" : ""}`}>
          <ContextZone full={full} phone={phone} t={t} qs={qs} onHistoryChanged={() => load(true)} />
        </aside>

        {/* ── Mərkəz zona: Əməliyyat ─────────────────────────────────────────── */}
        <main className={`op-det__zone op-det__zone--work${zone === "work" ? " op-det__zone--visible" : ""}`}>
          <RequestContent full={full} t={t} />

          {/* PRIMARY — Təyinat (yalnız təyinat edilə bilən statuslarda) */}
          {canAssign && (
            <AssignBlock
              key={`assign-${a.id}-${a.status}`}
              appointment={a}
              suggestions={full.suggestions}
              cold={claimedByOther}
              guardAction={guardAction}
              selectRef={assignFocusRef}
              onAssigned={(u) => {
                // Təyinatdan sonra detal səhifəsində gözlətmə — randevular siyahısına qayıt.
                globalToast((u.status === "ASSIGNED" || u.status === "CONFIRMED") ? "Təyin olundu" : "Yeniləndi", "success");
                backToList();
              }}
            />
          )}

          {/* Görüş linki — öz kartı */}
          {!isFinal && (
            <LinkBlock key={`link-${a.id}`} appointment={a} cold={claimedByOther}
              guardAction={guardAction} onDone={(u, m) => onActionDone(u, m)} />
          )}

          {/* Ödəniş qeydi yoxdursa — operator əl ilə əlavə edə bilsin */}
          {needsPayment && (
            <PaymentMissingBlock key={`payment-${a.id}`} appointment={a}
              onCreated={() => { load(true); setToast("Ödəniş əlavə edildi"); }} />
          )}

          {/* Digər əməliyyatlar — kart şəbəkəsi + fokuslu modal */}
          <OtherActions
            appointment={a}
            guardAction={guardAction}
            showResolve={canResolve}
            showCancelReq={isCancelReq}
            showNoShow={canMarkNoShow}
            showCancel={canCancel}
            onResolveDone={(u) => onActionDone(u, "Mübahisə həll olundu")}
            onCancelReqDone={(u, approved) => onActionDone(u, approved ? "Ləğv təsdiqləndi" : "Tələb rədd edildi")}
            onNoShowDone={(u) => onActionDone(u, "No-show işarələndi")}
            onCancelDone={(u) => onActionDone(u, "Ləğv edildi")}
          />
        </main>

        {/* ── Sağ zona: Fəaliyyət lenti ──────────────────────────────────────── */}
        <aside className={`op-det__zone op-det__zone--feed${zone === "feed" ? " op-det__zone--visible" : ""}`}>
          <ActivityFeed
            items={full.activity}
            t={t}
            composerRef={composerFocusRef}
            onAdd={(item) => setFull(prev => prev ? { ...prev, activity: [...prev.activity, item] } : prev)}
            appointmentId={id}
          />
        </aside>
      </div>

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
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1A2535", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 90, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
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
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,51,0.5)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(420px, 100%)", padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1A2535" }}>{t("staff.opReassignTitle")}</h3>
        <p style={{ fontSize: 13, color: "#52718F", marginTop: 8 }}>{t("staff.opReassignBody")}</p>
        <select value={opId ?? ""} onChange={e => setOpId(Number(e.target.value) || null)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginTop: 12 }}>
          <option value="">— {t("staff.opReassignPick")} —</option>
          {operators.filter(o => o.id !== currentHolderId).map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 12 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose}
            style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer", fontWeight: 600 }}>
            {t("staff.opReassignCancel")}
          </button>
          <button onClick={submit} disabled={busy}
            style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "var(--brand)", color: "#fff", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? "…" : t("staff.opReassignConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sol zona: pasiyent kartı + reputasiya + kurs + tarixçə ──────────────── */

function ContextZone({ full, phone, t, qs, onHistoryChanged }: {
  full: OperatorAppointmentFull;
  phone: string | null;
  t: ReturnType<typeof useT>["t"];
  qs: string;
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
      <div className="op-det-card">
        <div className="op-det-card__title">{t("staff.opDetPatientCard")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
          <span style={{ width: 42, height: 42, borderRadius: 12, background: "var(--brand-700)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flex: "none" }}>
            {(a.patientName ?? "—").split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "—"}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{a.patientName ?? "—"}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 3 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: a.patientId ? "#D1FAE5" : "#F3F4F6", color: a.patientId ? "#065F46" : "var(--oxford-60)", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>
                {a.patientId && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                )}
                {a.patientId ? t("staff.opDetRegistered") : t("staff.opDetAnonymous")}
              </span>
              {h?.blocked && (
                <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>BLOKLU</span>
              )}
            </div>
          </div>
        </div>
        {phone && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 11 }}>
            <a href={`tel:${phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F8FAFD", color: "var(--brand-700)", border: "1px solid #EDF1F8", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              {a.patientPhone}
            </a>
            <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F8FAFD", color: "var(--brand-700)", border: "1px solid #EDF1F8", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
              WhatsApp
            </a>
          </div>
        )}
        {a.patientEmail && (
          <a href={`mailto:${a.patientEmail}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--brand)", marginBottom: 12, wordBreak: "break-all" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22,6 12,13 2,6" />
            </svg>
            {a.patientEmail}
          </a>
        )}
        {h?.userId && (
          <button onClick={blockOrUnblock}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "#fff", color: h.blocked ? "var(--brand-700)" : "#991B1B", border: h.blocked ? "1px solid #C7D2FE" : "1px solid #F3D6D6", borderRadius: 9, padding: 8, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M4.9 4.9l14.2 14.2" /></svg>
            {h.blocked ? "Bloku aç" : "Blokla / spam"}
          </button>
        )}
      </div>

      {/* Reputasiya */}
      {h && (
        <div className="op-det-card">
          <div className="op-det-card__title">{t("staff.opDetReputation")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            <RepCell label={t("staff.opDetNoShow")} value={h.noShowCount} warn={h.noShowCount >= 3} />
            <RepCell label={t("staff.opDetLateCancel")} value={h.lateCancelCount} warn={h.lateCancelCount >= 5} />
            <RepCell label={t("staff.opDetRejects")} value={h.rejectedCount} warn={h.rejectedCount >= 3} />
          </div>
          {h.autoFlag && (
            <div style={{ marginTop: 8, padding: "6px 10px", background: "#FEE2E2", color: "#991B1B", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
              {FLAG_LABEL[h.autoFlag] ?? h.autoFlag}
            </div>
          )}
          {h.blocked && h.blockReason && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#991B1B" }}>Səbəb: {h.blockReason}</div>
          )}
        </div>
      )}

      {/* Kurs konteksti */}
      {a.seriesId != null && full.seriesSiblings.length > 0 && (
        <div className="op-det-card">
          <div className="op-det-card__title">
            {t("staff.opDetGroupContext")} · {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal ?? full.seriesSiblings.length })}
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {full.seriesSiblings.map(s => (
              <Link key={s.id} href={`/operator/appointments/${s.id}${suffix}`}
                className={s.id === a.id ? "op-det-sibling op-det-sibling--current" : "op-det-sibling"}>
                <span>#{s.id} · {azOrdinal((s.seriesIndex ?? 0) + 1)} seans</span>
                <span style={{ color: "#8AAABF" }}>{s.startAt ? azFormatDate(s.startAt) : "—"} · {STATUS_TONE[s.status]?.label ?? s.status}</span>
              </Link>
            ))}
          </div>

          {/* Seriyanı bütöv idarə (operator) */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #EFF2F7", display: "grid", gap: 8 }}>
            {seriesRescheduleOpen ? (
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F" }}>Növbəti seansın yeni başlanğıcı (qalanlar eyni qədər sürüşəcək)</label>
                <DatePicker withTime theme="light" size="sm" value={seriesStart} onChange={setSeriesStart} />
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => { setSeriesRescheduleOpen(false); setSeriesStart(""); }} disabled={seriesBusy}
                    style={{ padding: "6px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fff", cursor: "pointer" }}>Ləğv</button>
                  <button onClick={doRescheduleSeries} disabled={seriesBusy || !seriesStart}
                    style={{ padding: "6px 12px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "var(--brand)", color: "#fff", cursor: seriesBusy ? "wait" : "pointer", opacity: seriesBusy || !seriesStart ? 0.6 : 1 }}>{seriesBusy ? "…" : "Köçür"}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => setSeriesRescheduleOpen(true)}
                  style={{ padding: "6px 12px", border: "1px solid var(--brand-200)", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#fff", color: "var(--brand-700)", cursor: "pointer" }}>
                  Seriyanı köçür
                </button>
                <button onClick={doCancelSeries} disabled={seriesBusy}
                  style={{ padding: "6px 12px", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#fff", color: "#991B1B", cursor: "pointer" }}>
                  Seriyanı ləğv et
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pasiyent tarixçəsi */}
      <div className="op-det-card">
        <div className="op-det-card__title">{t("staff.opDetHistory")}</div>
        {!h || h.recent.length === 0 ? (
          <div style={{ fontSize: 12, color: "#8AAABF" }}>{t("staff.opDetHistoryEmpty")}</div>
        ) : (
          <div style={{ display: "grid", gap: 4 }}>
            {h.recent.map(r => (
              <Link key={r.id} href={`/operator/appointments/${r.id}${suffix}`}
                className={r.id === a.id ? "op-det-sibling op-det-sibling--current" : "op-det-sibling"}>
                <span>#{r.id} · {STATUS_TONE[r.status]?.label ?? r.status}</span>
                <span style={{ color: "#8AAABF" }}>{r.psychologistName ?? "—"}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function RepCell({ label, value, warn }: { label: string; value: number; warn: boolean }) {
  return (
    <div style={{ background: warn ? "#FEE2E2" : "#F8FAFD", border: warn ? "1px solid #F3D6D6" : "1px solid #EDF1F8", borderRadius: 10, padding: "11px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: warn ? "#DC2626" : "var(--oxford)" }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: warn ? "#991B1B" : "var(--oxford-60)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

/* ─── Mərkəz: müraciət məzmunu ─────────────────────────────────────────────── */

function RequestContent({ full, t }: { full: OperatorAppointmentFull; t: ReturnType<typeof useT>["t"] }) {
  const a = full.appointment;
  return (
    <div className="op-det-card">
      <div className="op-det-card__title">{t("staff.opDetRequest")}</div>
      {a.note ? (
        <div style={{ display: "flex", gap: 10, background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 11, padding: "13px 15px" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <span style={{ fontSize: 14.5, color: "var(--oxford)", fontStyle: "italic", fontWeight: 500, lineHeight: 1.5 }}>«{a.note}»</span>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: "#8AAABF" }}>Problem təsviri yazılmayıb</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 14 }}>
        {([
          [t("staff.opDetRequestedTime"), fmtDateTime(a.requestedStartAt)],
          [t("staff.opDetRequestedPsy"), a.psychologistName ?? a.requestedPsychologistName ?? "Seçilməyib"],
          ...(a.startAt ? [["Təyin edilmiş vaxt", fmtDateTime(a.startAt)] as [string, string]] : []),
          ["Yaradılıb", fmtDateTime(a.createdAt)],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} style={{ background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{value}</div>
          </div>
        ))}
      </div>

      {a.rescheduleRequestedAt && (a.status === "CONFIRMED" || a.status === "ASSIGNED") && (
        <div style={{ marginTop: 10, fontSize: 12.5, background: "#EFF4FE", border: "1px solid #C7DAF5", borderRadius: 8, padding: "10px 12px", color: "#082F6D" }}>
          <strong>Pasient vaxt dəyişikliyi tələb edib.</strong> Yeni vaxt seçmək üçün aşağıdakı «Vaxtı dəyiş / yenidən təyin» alətindən istifadə edin.
          {a.rescheduleRequestNote && <div style={{ marginTop: 4, fontStyle: "italic" }}>«{a.rescheduleRequestNote}»</div>}
        </div>
      )}

      {a.operatorNote && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#52718F", background: "#FFFBEB", border: "1px solid #FEF3C7", borderRadius: 8, padding: "8px 12px", whiteSpace: "pre-wrap" }}>
          <strong>Operator qeydi:</strong> {a.operatorNote}
        </div>
      )}

      {a.status === "DISPUTED" && (
        <div style={{ marginTop: 10, fontSize: 12.5, background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px", color: "#991B1B" }}>
          <strong>Mübahisə:</strong>{" "}
          {a.patientDisputed && a.psychologistDisputed ? "İkisi də 'olmadı' dedi"
            : a.patientDisputed ? "Pasient 'olmadı' dedi"
            : a.psychologistDisputed ? "Psixoloq 'olmadı' dedi" : "Mübahisə açıldı"}
          {a.disputeReason && <div style={{ marginTop: 4, fontStyle: "italic" }}>«{a.disputeReason}»</div>}
        </div>
      )}

      {a.status === "CANCEL_REQUESTED" && (
        <div style={{ marginTop: 10, fontSize: 12.5, background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 8, padding: "8px 12px", color: "#92400E" }}>
          <strong>Pasient ləğv tələb edib.</strong>
          {a.cancelRequestReasonCode && <> · {reasonLabel(a.cancelRequestReasonCode)}</>}
          {a.cancelRequestReasonText && <div style={{ marginTop: 4, fontStyle: "italic" }}>«{a.cancelRequestReasonText}»</div>}
        </div>
      )}

      {a.status === "CANCELLED" && (
        <div style={{ marginTop: 10, fontSize: 12.5, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px", color: "#991B1B" }}>
          <strong>Ləğv edildi.</strong>{" "}
          {a.cancelledBy === "PATIENT" ? "Pasient ləğv etdi"
            : a.cancelledBy === "PSYCHOLOGIST" ? "Psixoloq ləğv etdi"
            : a.cancelledBy === "OPERATOR" ? "Operator ləğv etdi" : "—"}
          {a.cancelReasonCode && <> · {reasonLabel(a.cancelReasonCode)}</>}
          {a.lateCancel && <> · <span style={{ fontWeight: 700 }}>Gec ləğv</span></>}
          {a.cancelledAt && <> · {fmtDateTime(a.cancelledAt)}</>}
          {a.cancelReasonText && <div style={{ marginTop: 4, fontStyle: "italic" }}>«{a.cancelReasonText}»</div>}
        </div>
      )}

    </div>
  );
}

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
    <div data-op-modal="" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(10,26,51,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth, background: "#fff", borderRadius: 16, boxShadow: "0 24px 70px rgba(8,47,109,.3)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "86vh" }}>
        <div style={{ padding: "17px 20px", borderBottom: "1px solid #F0F4FA", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{title}</span>
              {badge && <span style={{ background: badge.bg, color: badge.color, fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{badge.label}</span>}
            </div>
            {sub && <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 3 }}>{sub}</div>}
          </div>
          <button onClick={onClose} aria-label="Bağla" style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F0F4FA", border: "none", borderRadius: 8, cursor: "pointer", flex: "none" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: "14px 20px", borderTop: "1px solid #F0F4FA" }}>{footer}</div>}
      </div>
    </div>
  );
}

function AssignBlock({ appointment, suggestions, cold, guardAction, selectRef, onAssigned }: {
  appointment: AppointmentDetail;
  suggestions: OperatorAppointmentFull["suggestions"];
  cold: boolean;
  guardAction: (run: () => void) => void;
  selectRef: React.RefObject<HTMLButtonElement | null>;
  onAssigned: (a: AppointmentDetail) => void;
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
    operatorApi.availability(pid, isoDateOnly(today), isoDateOnly(to))
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, []);

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
    const seedStart = appointment.startAt ?? appointment.requestedStartAt;
    if (!seedStart || !psyId || loadingSlots) return;
    if (pickedSlots.length > 0 || manualStart) return;
    const reqMs = new Date(seedStart).getTime();
    const match = slots.find(s => new Date(s.startAt).getTime() === reqMs);
    if (match) { setPickedSlots([match.startAt]); return; }
    const psy = psychologists.find(p => p.id === psyId);
    const minutes = psy?.defaultSessionMinutes && psy.defaultSessionMinutes > 0 ? psy.defaultSessionMinutes : 50;
    const seedEnd = (appointment.startAt && appointment.endAt) ? appointment.endAt : new Date(reqMs + minutes * 60_000).toISOString();
    setManualStart(isoToAzLocal(seedStart));
    setManualEnd(isoToAzLocal(seedEnd));
  }, [slots, loadingSlots, psyId, psychologists, appointment.startAt, appointment.endAt, appointment.requestedStartAt, pickedSlots.length, manualStart]);

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

  const requestedMs = appointment.requestedStartAt ? new Date(appointment.requestedStartAt).getTime() : null;
  const chosenSlots = pickedSlots.length > 0
    ? pickedSlots.map(st => {
        const slot = slots.find(x => x.startAt === st);
        return { key: st, label: slot ? `${azFormatDate(slot.startAt)} · ${azFormatTime(slot.startAt)}` : st, onRemove: () => toggleSlot(st) };
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

  const summaryRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 12, padding: "13px 14px" };
  const summaryIcon: React.CSSProperties = { width: 38, height: 38, borderRadius: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" };
  const summaryLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#8AAABF", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 };
  const summaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "#082F6D", border: "1px solid #C7DAF5", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", flex: "none" };
  const modalPrimary: React.CSSProperties = { width: "100%", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 11, padding: 13, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" };

  return (
    <div className={cold ? "op-det-card op-det-card--cold" : "op-det-card"} style={{ borderTop: "3px solid var(--brand)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 15, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--brand-700)" }}>
          {(appointment.status === "CONFIRMED" || appointment.status === "ASSIGNED") ? "Yenidən planla / psixoloqu dəyiş" : t("staff.opDetAssignBlock")}
        </span>
        {ready
          ? <span style={{ background: "#D1FAE5", color: "#065F46", fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>Təyinata hazır</span>
          : <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>Tamamlanmamış</span>}
        <kbd className="op-det-kbd" style={{ marginLeft: "auto" }}>A</kbd>
      </div>

      {/* özət sətirlər */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 13 }}>
        <div style={summaryRow}>
          <span style={{ ...summaryIcon, background: psyId ? "var(--brand-100)" : "#F0F4FA", color: psyId ? "var(--brand)" : "#9DB0CC" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={summaryLabel}>Psixoloq</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: psyId ? "var(--oxford)" : "#9DB0CC" }}>{psychName}</span>
              {psychScore && <span style={{ background: "#ECFDF5", color: "#047857", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{psychScore}</span>}
            </div>
          </div>
          <button ref={selectRef} type="button" onClick={() => setPsychModalOpen(true)} style={summaryBtn}>
            {psyId ? "Dəyiş" : "Seç"}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
        <div style={summaryRow}>
          <span style={{ ...summaryIcon, background: timeN ? "var(--brand-100)" : "#F0F4FA", color: timeN ? "var(--brand)" : "#9DB0CC" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={summaryLabel}>Vaxt</div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: timeN ? "var(--oxford)" : "#9DB0CC" }}>{timeSummary}</div>
          </div>
          <button type="button" onClick={() => { if (!psyId) { setPsychModalOpen(true); return; } setTimeModalOpen(true); }} style={summaryBtn}>
            {timeN ? "Dəyiş" : "Seç"}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
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
        if (!appointment.startAt || !appointment.endAt || !selectedPsy?.defaultSessionMinutes) return null;
        const storedMin = Math.round((new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()) / 60_000);
        if (storedMin === selectedPsy.defaultSessionMinutes) return null;
        return (
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: "9px 13px", marginBottom: 14, fontSize: 12, fontWeight: 600, color: "#92400E" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
            Mövcud seans müddəti {storedMin} dəq, psixoloqun standartı isə {selectedPsy.defaultSessionMinutes} dəq. Vaxtı yenidən seçərək uyğunlaşdırın.
          </div>
        );
      })()}

      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", margin: "6px 0 6px" }}>Operator qeydi</div>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Təyinat haqqında daxili qeyd…"
        style={{ width: "100%", border: "1px solid #D6E2F7", background: "#fff", borderRadius: 10, padding: 11, fontSize: 13.5, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit", resize: "vertical", lineHeight: 1.5, marginBottom: 15, boxSizing: "border-box" }} />

      {!allowance?.packageName && (
        <div style={{ marginBottom: 15 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 }}>
            Seans məbləği (₼)
            <span style={{ color: "#9DB0CC", fontWeight: 400 }}> — boş qalarsa ödəniş yaranmır</span>
          </div>
          <input
            type="number"
            min={0}
            step="0.01"
            value={singlePrice}
            onChange={e => setSinglePrice(e.target.value)}
            placeholder={selectedPsy?.individualPrice != null ? String(selectedPsy.individualPrice) : "məs. 80"}
            style={{ width: "100%", border: "1px solid #D6E2F7", background: "#fff", borderRadius: 10, padding: 11, fontSize: 13.5, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>
      )}

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button onClick={() => guardAction(doSubmit)} disabled={saving || !ready}
        style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: (saving || !ready) ? "#A9BEE2" : "var(--brand)", color: "#fff", border: "none", borderRadius: 11, padding: 14, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: (saving || !ready) ? "not-allowed" : "pointer" }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        {saving ? "Saxlanılır…"
          : pickedSlots.length > 1 ? `${pickedSlots.length} seans təyin et`
          : appointment.status === "ASSIGNED" ? "Yenidən təyin et" : "Təyin et"}
      </button>

      {/* PSİXOLOQ MODALI */}
      {psychModalOpen && (
        <ModalShell title="Psixoloq seç" sub="Tövsiyədən seçin və ya siyahıdan tapın." onClose={() => setPsychModalOpen(false)}
          footer={<button onClick={() => setPsychModalOpen(false)} style={modalPrimary}>{psyId ? "Hazırdır" : "Bağla"}</button>}>
          {suggestions.length > 0 && (
            <div style={{ background: "#F3FBF6", border: "1px solid #C9EFD9", borderRadius: 12, padding: 13, marginBottom: 15 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#047857", marginBottom: 11 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" /></svg>
                {t("staff.opDetSuggestions")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {suggestions.slice(0, 3).map(s => {
                  const sel = psyId === s.psychologistId;
                  return (
                    <button key={s.psychologistId} type="button"
                      onClick={() => selectPsy(s.psychologistId)}
                      style={{ display: "flex", alignItems: "center", gap: 11, textAlign: "left", background: sel ? "#fff" : "#FAFFFD", border: `1.5px solid ${sel ? "#047857" : "#C9EFD9"}`, borderRadius: 10, padding: "11px 13px", cursor: "pointer", fontFamily: "inherit" }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${sel ? "#047857" : "#A7D8BC"}`, background: sel ? "#047857" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: sel ? 1 : 0 }}><path d="M20 6L9 17l-5-5" /></svg>
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, marginTop: 1 }}>{s.reasons.join(" · ")}</div>
                      </div>
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
                        <span style={{ fontSize: 17, fontWeight: 800, color: "#047857", lineHeight: 1 }}>{s.score}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: "#8AAABF", letterSpacing: ".04em" }}>SKOR</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 }}>Psixoloq</div>
          <div style={{ position: "relative" }}>
            <select value={psyId ?? ""} onChange={e => selectPsy(Number(e.target.value) || null)}
              style={{ width: "100%", appearance: "none", WebkitAppearance: "none", background: "#fff", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 38px 11px 13px", fontSize: 14, fontWeight: 600, color: "var(--oxford)", fontFamily: "inherit", cursor: "pointer" }}>
              <option value="">Psixoloq seçin…</option>
              {psychologists.map(p => <option key={p.id} value={p.id}>{p.name} · {p.title}</option>)}
            </select>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="M6 9l6 6 6-6" /></svg>
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
              {appointment.requestedStartAt && (
                <div style={{ display: "flex", gap: 9, alignItems: "center", background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 10, padding: "10px 13px", marginBottom: 11 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--brand-700)" }}>İstənilən vaxt: {fmtDateTime(appointment.requestedStartAt)} — uyğun slot avtomatik seçilir</span>
                </div>
              )}

              {allowance && (
                allowance.packageName ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#ECFDF5", border: "1px solid #A7D8BC", borderRadius: 10, padding: "10px 13px", marginBottom: 13, fontSize: 12.5, fontWeight: 700, color: "#047857" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /></svg>
                    <span>Paket: {allowance.packageName} · {allowance.remainingSessions} qalıb — {maxSlots} vaxta qədər seçə bilərsiniz</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FEF3C7", border: "1px solid #FCE7A8", borderRadius: 10, padding: "10px 13px", marginBottom: 13, fontSize: 12.5, fontWeight: 700, color: "#92400E" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /></svg>
                    <span>Paket yoxdur — yalnız 1 vaxt seçilə bilər.</span>
                  </div>
                )
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, background: slotComplete ? "#D1FAE5" : "#F0F4FA", color: slotComplete ? "#065F46" : "#5C6B85", borderRadius: 10, padding: "9px 13px", marginBottom: 13, fontSize: 12.5, fontWeight: 700 }}>
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
                              title={isRequested ? "Müştərinin istədiyi vaxt" : disabled ? "Tavan dolub" : undefined}
                              disabled={disabled}
                              onClick={disabled ? undefined : () => toggleSlot(s.startAt)}
                              style={{ position: "relative", padding: "9px 15px", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, fontFamily: "inherit",
                                border: active ? "1.5px solid var(--brand)" : disabled ? "1.5px solid #E5E7EB" : isRequested ? "1.5px solid #047857" : "1.5px solid #D6E2F7",
                                background: active ? "#E4ECFA" : disabled ? "#F3F4F6" : isRequested ? "#ECFDF5" : "#fff",
                                color: active ? "#082F6D" : disabled ? "#C0C9D6" : isRequested ? "#047857" : "var(--oxford)" }}>
                              {azFormatTime(s.startAt)}
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

/* ─── Mərkəz: görüş linki bloku (link idarəsi + tarixçə) ───────────────────── */

function LinkBlock({ appointment, cold }: {
  appointment: AppointmentDetail;
  cold: boolean;
  guardAction: (run: () => void) => void;
  onDone: (a: AppointmentDetail, msg: string) => void;
}) {
  const { t } = useT();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<MeetingLinkLogItem[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const hasLink = !!appointment.meetingLink;

  const toggleHistory = () => {
    if (historyOpen) { setHistoryOpen(false); return; }
    setHistoryOpen(true);
    if (history === null && !loadingHistory) {
      setLoadingHistory(true);
      operatorApi.meetingLinkHistory(appointment.id)
        .then(setHistory)
        .catch(() => setHistory([]))
        .finally(() => setLoadingHistory(false));
    }
  };

  const actionLabel = (action: MeetingLinkLogItem["action"]): string => {
    switch (action) {
      case "SET": return t("meetingLink.actionSet");
      case "UPDATED": return t("meetingLink.actionUpdated");
      case "REVOKED": return t("meetingLink.actionRevoked");
      case "SENT": return t("meetingLink.actionSent");
      default: return action;
    }
  };

  return (
    <div className={cold ? "op-det-card op-det-card--cold" : "op-det-card"}>
      <div className="op-det-card__title">{t("meetingLink.title")}</div>

      {hasLink ? (
        <a href={appointment.meetingLink!} target="_blank" rel="noopener noreferrer"
          style={{ display: "block", fontSize: 12.5, color: "var(--brand-700)", fontWeight: 600, wordBreak: "break-all", marginBottom: 8 }}>
          {appointment.meetingLink}
        </a>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#FEF3C7", border: "1px solid #FCE7A8", borderRadius: 11, padding: "12px 14px", marginBottom: 10 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#92400E" }}>Görüş linki hələ əlavə edilməyib</span>
        </div>
      )}

      <div style={{ fontSize: 12, color: "#52718F", marginBottom: 10 }}>
        {appointment.meetingLinkSentAt
          ? `${t("meetingLink.sent")} · ${azFormatDateTime(appointment.meetingLinkSentAt)}`
          : t("meetingLink.notSent")}
      </div>

      <Link href="/operator/meeting-links"
        style={{ display: "inline-block", padding: "8px 14px", border: "1px solid #C7D2FE", borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: "#fff", color: "var(--brand-700)", textDecoration: "none" }}>
        Görüş linklərini idarə et →
      </Link>

      <div style={{ marginTop: 10 }}>
        <button onClick={toggleHistory}
          style={{ border: "none", background: "transparent", padding: 0, fontSize: 12, fontWeight: 600, color: "#52718F", cursor: "pointer" }}>
          {t("meetingLink.history")} {historyOpen ? "▴" : "▾"}
        </button>
        {historyOpen && (
          <div style={{ marginTop: 8 }}>
            {loadingHistory ? (
              <div style={{ fontSize: 12, color: "#8AAABF" }}>Yüklənir…</div>
            ) : !history || history.length === 0 ? (
              <div style={{ fontSize: 12, color: "#8AAABF" }}>{t("meetingLink.none")}</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {history.map((it, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, borderBottom: i < history.length - 1 ? "1px solid #F1F5F9" : "none", paddingBottom: 6 }}>
                    <span style={{ color: "#1A2535", fontWeight: 600 }}>
                      {actionLabel(it.action)}
                      {it.actorName ? <span style={{ color: "#8AAABF", fontWeight: 400 }}> · {it.actorName}</span> : null}
                    </span>
                    <span style={{ color: "#8AAABF", whiteSpace: "nowrap" }}>{azFormatDateTime(it.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Ödəniş qeydi yoxdursa — əl ilə əlavə et ────────────────────────────────── */

function PaymentMissingBlock({ appointment, onCreated }: {
  appointment: AppointmentDetail;
  onCreated: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Qəbul zamanı 0 məbləğli gözləyən ödəniş yaranıb (qiymətsiz psixoloq) — məbləği təyin edirik.
  const amountUnset = appointment.paymentStatus === "PENDING";

  const submit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setErr("Məbləği düzgün daxil edin"); return; }
    setErr(null); setSaving(true);
    try {
      await operatorApi.createManualPayment(appointment.id, amt);
      onCreated();
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="op-det-card">
      <div className="op-det-card__title">Ödəniş</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#FEF3C7", border: "1px solid #FCE7A8", borderRadius: 11, padding: "12px 14px", marginBottom: 12 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#92400E" }}>{amountUnset
          ? "Bu seansın ödəniş məbləği hələ təyin olunmayıb — məbləği daxil edin"
          : "Bu seans üçün ödəniş qeydi yoxdur — \"Ödənişlər\"də görünmür"}</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="Seans məbləği (₼)"
          style={{ flex: 1, border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, fontWeight: 500, fontFamily: "inherit", boxSizing: "border-box" }} />
        <button onClick={submit} disabled={saving || !amount.trim()}
          style={{ background: (saving || !amount.trim()) ? "#A9BEE2" : "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: (saving || !amount.trim()) ? "not-allowed" : "pointer", flex: "none" }}>
          {saving ? "Saxlanılır…" : amountUnset ? "Məbləği təyin et" : "Ödəniş əlavə et"}
        </button>
      </div>
      {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 10 }}>{err}</div>}
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

/* ─── Mərkəz: digər əməliyyatlar (kart şəbəkəsi + fokuslu modal) ──────────── */

type ActionKey = "dispute" | "cancelreq" | "noshow" | "cancel";

function OtherActions({ appointment, guardAction, showResolve, showCancelReq, showNoShow, showCancel, onResolveDone, onCancelReqDone, onNoShowDone, onCancelDone }: {
  appointment: AppointmentDetail;
  guardAction: (run: () => void) => void;
  showResolve: boolean;
  showCancelReq: boolean;
  showNoShow: boolean;
  showCancel: boolean;
  onResolveDone: (a: AppointmentDetail) => void;
  onCancelReqDone: (a: AppointmentDetail, approved: boolean) => void;
  onNoShowDone: (a: AppointmentDetail) => void;
  onCancelDone: (a: AppointmentDetail) => void;
}) {
  const [open, setOpen] = useState<ActionKey | null>(null);

  const META: Record<ActionKey, {
    cardTitle: string; cardSub: string; tileBg: string; tileColor: string; hoverBorder: string; hoverBg: string; icon: React.ReactNode;
    title: string; sub: string; badge: { label: string; bg: string; color: string };
  }> = {
    dispute: {
      cardTitle: "Mübahisəni həll et", cardSub: "Tamamlandı / Ləğv", tileBg: "#FEE2E2", tileColor: "#991B1B", hoverBorder: "#991B1B", hoverBg: "#FFF8F8",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 12h9M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" /></svg>,
      title: "Mübahisəni həll et", sub: "Seans baş tutdumu? Nəticəni qeyd edin.", badge: { label: "Mübahisəli", bg: "#FEE2E2", color: "#991B1B" },
    },
    cancelreq: {
      cardTitle: "Ləğv tələbi", cardSub: "Təsdiqlə / Rədd et", tileBg: "#FEF3C7", tileColor: "#92400E", hoverBorder: "#B45309", hoverBg: "#FFFBEB",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.7 9.7 0 0 0-6.3 2.6L3 8" /><path d="M3 3v5h5" /></svg>,
      title: "Ləğv tələbi", sub: "Pasiyentin ləğv tələbini emal edin.", badge: { label: "Gözlənilir", bg: "#FEF3C7", color: "#92400E" },
    },
    noshow: {
      cardTitle: "No-show işarələ", cardSub: "Pasient / Psixoloq", tileBg: "#FEE2E2", tileColor: "#991B1B", hoverBorder: "#991B1B", hoverBg: "#FFF8F8",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M23 9l-4 4M19 9l4 4" /></svg>,
      title: "No-show işarələ", sub: "Seansa kim gəlmədi?", badge: { label: "No-show", bg: "#FEE2E2", color: "#991B1B" },
    },
    cancel: {
      cardTitle: "Müraciəti ləğv et", cardSub: "Səbəb + qeyd", tileBg: "#FEE2E2", tileColor: "#991B1B", hoverBorder: "#991B1B", hoverBg: "#FFF8F8",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>,
      title: "Müraciəti ləğv et", sub: "Bu müraciəti bağlayın.", badge: { label: "Ləğv", bg: "#FEE2E2", color: "#991B1B" },
    },
  };

  const keys: ActionKey[] = [];
  if (showResolve) keys.push("dispute");
  if (showCancelReq) keys.push("cancelreq");
  if (showNoShow) keys.push("noshow");
  if (showCancel) keys.push("cancel");
  if (keys.length === 0) return null;

  return (
    <>
      <div className="op-det-card">
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 5 }}>Digər əməliyyatlar</div>
        <div style={{ fontSize: 12, color: "#8AAABF", fontWeight: 500, marginBottom: 14 }}>Statusa uyğun əməliyyatı seçin — fokuslu pəncərədə açılacaq.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {keys.map(k => {
            const m = META[k];
            return (
              <button key={k} type="button" onClick={() => setOpen(k)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = m.hoverBorder; e.currentTarget.style.background = m.hoverBg; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#EDF1F8"; e.currentTarget.style.background = "#fff"; }}
                style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: "#fff", border: "1px solid #EDF1F8", borderRadius: 11, padding: 12, cursor: "pointer", fontFamily: "inherit" }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: m.tileBg, color: m.tileColor, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{m.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)" }}>{m.cardTitle}</div>
                  <div style={{ fontSize: 11, color: "#8AAABF", fontWeight: 600 }}>{m.cardSub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {open && (
        <ModalShell title={META[open].title} sub={META[open].sub} badge={META[open].badge} onClose={() => setOpen(null)}>
          {open === "dispute" && <ResolveDisputeBlock appointment={appointment} guardAction={guardAction} onDone={(u) => { setOpen(null); onResolveDone(u); }} />}
          {open === "cancelreq" && <CancelRequestBlock appointment={appointment} guardAction={guardAction} onDone={(u, a) => { setOpen(null); onCancelReqDone(u, a); }} />}
          {open === "noshow" && <NoShowBlock appointment={appointment} guardAction={guardAction} onDone={(u) => { setOpen(null); onNoShowDone(u); }} />}
          {open === "cancel" && <CancelBlock appointment={appointment} guardAction={guardAction} onClose={() => setOpen(null)} onDone={(u) => { setOpen(null); onCancelDone(u); }} />}
        </ModalShell>
      )}
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

/* ─── Sağ zona: fəaliyyət lenti + composer ─────────────────────────────────── */

function FeedIcon({ kind }: { kind: OperatorActivityItem["kind"] }) {
  const map: Record<OperatorActivityItem["kind"], { bg: string; color: string; path: React.ReactNode }> = {
    CREATED: { bg: "#E4ECFA", color: "#1051B7", path: <><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></> },
    CONTACT: { bg: "#ECFDF5", color: "#047857", path: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /> },
    NOTE: { bg: "#F0F4FA", color: "#5C6B85", path: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
    AUDIT: { bg: "#D1FAE5", color: "#065F46", path: <path d="M20 6L9 17l-5-5" /> },
  };
  const m = map[kind] ?? map.NOTE;
  return (
    <span style={{ width: 28, height: 28, borderRadius: "50%", background: m.bg, color: m.color, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", zIndex: 1 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{m.path}</svg>
    </span>
  );
}

function ActivityFeed({ items, t, composerRef, onAdd, appointmentId }: {
  items: OperatorActivityItem[];
  t: ReturnType<typeof useT>["t"];
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  onAdd: (item: OperatorActivityItem) => void;
  appointmentId: number;
}) {
  const [mode, setMode] = useState<"note" | "contact">("note");
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<"CALL" | "WHATSAPP" | "SMS" | "EMAIL" | "OTHER">("CALL");
  const [outcome, setOutcome] = useState<"ANSWERED" | "NO_ANSWER" | "BUSY" | "REFUSED" | "RESCHEDULED" | "OTHER">("ANSWERED");
  const [saving, setSaving] = useState(false);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ block: "end" });
  }, [items.length]);

  const submit = async () => {
    if (mode === "note" && !text.trim()) return;
    setSaving(true);
    try {
      if (mode === "note") {
        const item = await operatorApi.addNote(appointmentId, text.trim());
        onAdd(item);
      } else {
        const log = await operatorApi.addContactLog(appointmentId, {
          channel, outcome, note: text.trim() || undefined,
        });
        onAdd({ kind: "CONTACT", channel: log.channel, outcome: log.outcome, text: log.note, actorName: log.operatorName, createdAt: log.createdAt });
      }
      setText("");
    } catch (e) { globalToast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="op-det-card" style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 110px)", position: "sticky", top: 76, padding: 0, minWidth: 0 }}>
      <div className="op-det-card__title" style={{ padding: "17px 17px 4px", margin: 0 }}>{t("staff.opDetZoneFeed")}</div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 17px" }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#8AAABF" }}>{t("staff.opDetFeedEmpty")}</div>
        ) : items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 11, paddingBottom: 16, position: "relative" }}>
            {i < items.length - 1 && <span style={{ position: "absolute", left: 13, top: 28, bottom: 0, width: 2, background: "#F0F4FA" }} />}
            <FeedIcon kind={it.kind} />
            <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)", lineHeight: 1.4 }}>
                {it.kind === "CREATED" && t("staff.opDetCreatedEvent")}
                {it.kind === "CONTACT" && <>{CHANNEL_LABEL[it.channel ?? ""] ?? it.channel} · {OUTCOME_LABEL[it.outcome ?? ""] ?? it.outcome}</>}
                {it.kind === "NOTE" && "Qeyd"}
                {it.kind === "AUDIT" && (AUDIT_LABEL[it.action ?? ""] ?? it.action)}
              </div>
              {it.text && (
                <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 8, padding: "7px 10px", marginTop: 5, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>{it.text}</div>
              )}
              <div style={{ fontSize: 11.5, color: "#9DB0CC", fontWeight: 600, marginTop: 4 }}>
                {it.actorName ? `${it.actorName} · ` : ""}{fmtDateTime(it.createdAt)}
              </div>
            </div>
          </div>
        ))}
        <div ref={feedEndRef} />
      </div>

      {/* Composer */}
      <div style={{ borderTop: "1px solid #F0F4FA", padding: "14px 17px" }}>
        <div style={{ display: "flex", gap: 6, background: "#F0F4FA", borderRadius: 9, padding: 3, marginBottom: 11 }}>
          <button onClick={() => setMode("note")}
            style={{ flex: 1, border: "none", borderRadius: 7, padding: 7, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: mode === "note" ? "#fff" : "transparent", color: mode === "note" ? "var(--brand-700)" : "var(--oxford-60)", boxShadow: mode === "note" ? "0 1px 3px rgba(8,47,109,.12)" : "none" }}>
            {t("staff.opDetComposerNote")}
          </button>
          <button onClick={() => setMode("contact")}
            style={{ flex: 1, border: "none", borderRadius: 7, padding: 7, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: mode === "contact" ? "#fff" : "transparent", color: mode === "contact" ? "var(--brand-700)" : "var(--oxford-60)", boxShadow: mode === "contact" ? "0 1px 3px rgba(8,47,109,.12)" : "none" }}>
            {t("staff.opDetComposerContact")}
          </button>
        </div>

        {mode === "contact" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 9 }}>
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <select value={channel} onChange={e => setChannel(e.target.value as typeof channel)}
                style={{ width: "100%", appearance: "none", WebkitAppearance: "none", background: "#fff", border: "1px solid #D6E2F7", borderRadius: 9, padding: "9px 28px 9px 11px", fontSize: 12.5, fontWeight: 600, color: "var(--oxford)", fontFamily: "inherit", cursor: "pointer" }}>
                {(["CALL", "WHATSAPP", "SMS", "EMAIL", "OTHER"] as const).map(c => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
              </select>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="M6 9l6 6 6-6" /></svg>
            </div>
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <select value={outcome} onChange={e => setOutcome(e.target.value as typeof outcome)}
                style={{ width: "100%", appearance: "none", WebkitAppearance: "none", background: "#fff", border: "1px solid #D6E2F7", borderRadius: 9, padding: "9px 28px 9px 11px", fontSize: 12.5, fontWeight: 600, color: "var(--oxford)", fontFamily: "inherit", cursor: "pointer" }}>
                {(["ANSWERED", "NO_ANSWER", "BUSY", "REFUSED", "RESCHEDULED", "OTHER"] as const).map(o => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
              </select>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="M6 9l6 6 6-6" /></svg>
            </div>
          </div>
        )}

        <textarea ref={composerRef} rows={2} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
          placeholder={mode === "note" ? "Qeyd yazın…" : "Əlaqə nəticəsi haqqında qeyd…"}
          style={{ width: "100%", border: "1px solid #D6E2F7", background: "#fff", borderRadius: 9, padding: 10, fontSize: 13, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit", resize: "vertical", lineHeight: 1.5, marginBottom: 9, boxSizing: "border-box" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, fontWeight: 600, color: "#8AAABF" }}>⌘+Enter</span>
          <button onClick={submit} disabled={saving || (mode === "note" && !text.trim())}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--brand-700)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "wait" : "pointer", opacity: saving || (mode === "note" && !text.trim()) ? 0.6 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {saving ? "Əlavə edilir…" : t("staff.opDetComposerSend")}
          </button>
        </div>
      </div>
    </div>
  );
}
