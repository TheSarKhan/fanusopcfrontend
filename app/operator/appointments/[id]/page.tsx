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
  isScheduleMismatch,
  CANCEL_REASONS,
  reasonLabel,
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
/** Gözləmə müddəti — açıq sözlə ("2 saat 14 dəqiqədir"), qısaltma YOX:
 *  "36d" kimi yazılar oxunmurdu. */
function ageLabel(fromIso: string, nowMs: number): string {
  const min = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 60000));
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (d > 0) {
    const restH = h % 24;
    return restH > 0 ? `${d} gün ${restH} saatdır` : `${d} gündür`;
  }
  if (h > 0) {
    const restM = min % 60;
    return restM > 0 ? `${h} saat ${restM} dəqiqədir` : `${h} saatdır`;
  }
  return `${min} dəqiqədir`;
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
  // SSR-də və klientdə Date.now() fərqli dəyər verir → "36 dəqiqədir gözləyir"
  // kimi mətnlər hydration uyğunsuzluğu yaradırdı. Ona görə ilkin dəyər 0-dır
  // (hər iki tərəfdə eyni), həqiqi vaxt mount-dan sonra effektdə yazılır.
  const [nowMs, setNowMs] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  // Hovuza buraxma: NEW/PENDING-də birbaşa, digər statuslarda Admin təsdiqi
  // tələb olunur (OP-FR-04/05) — ona görə səbəb soruşan modal açılır.
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseReason, setReleaseReason] = useState("");
  const [releaseBusy, setReleaseBusy] = useState(false);
  const assignFocusRef = useRef<HTMLButtonElement | null>(null);
  const assignCardRef = useRef<HTMLDivElement | null>(null);
  const [approving, setApproving] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paying, setPaying] = useState(false);
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

  // ── SLA sayğacı: mount-da bir dəfə, sonra hər 30 saniyədən bir yenilə ─────
  useEffect(() => {
    setNowMs(Date.now());
    const iv = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const qs = searchParams.toString();
  const backToList = useCallback(() => {
    // Paket kontekstindən (paket seansı ?pkg= və ya Paketlər tabı ?view=packages)
    // açılıbsa → birbaşa PAKETLƏR tabına qayıt (Randevular alt-tabına və ya seansa yox).
    if (searchParams.get("pkg") || searchParams.get("view") === "packages") {
      router.push("/operator/appointments?view=packages");
      return;
    }
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

  // ── Pool-a geri burax ─────────────────────────────────────────────────────
  // Toxunulmamış müraciət (NEW/PENDING) dərhal buraxılır; üzərində əməliyyat
  // aparılıbsa backend 409 verir, ona görə həmin halda səbəblə tələb göndərilir.
  const releaseToPool = useCallback(() => {
    setReleaseBusy(true);
    operatorApi.claimRelease(id)
      .then(c => { setClaim(c); setToast("Randevu hovuza buraxıldı"); backToList(); })
      .catch(e => globalToast((e as Error).message, "error"))
      .finally(() => setReleaseBusy(false));
  }, [id, backToList]);

  const sendReleaseRequest = useCallback(() => {
    setReleaseBusy(true);
    operatorApi.releaseRequest(id, releaseReason.trim() || undefined)
      .then(() => {
        setReleaseOpen(false);
        setReleaseReason("");
        globalToast("Buraxma tələbi göndərildi — Admin təsdiqi gözlənilir", "success");
      })
      .catch(e => globalToast((e as Error).message, "error"))
      .finally(() => setReleaseBusy(false));
  }, [id, releaseReason]);

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
    if (!psyId) { globalToast("Bu randevuya psixoloq təyin olunmayıb", "error"); return; }
    guardAction(async () => {
      setApproving(true);
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
        globalToast((e as Error).message, "error");
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
  // Qeyd: əvvəl link təyin ediləndə vaxt/psixoloq kilidlənirdi. Belə qayda
  // biznes axınında yoxdur — həm backend guard-ı, həm də UI kilidi silindi.
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

  // ── Ödəniş vəziyyəti (link ödənişdən ASILI — backend: isPaymentConfirmed) ──
  // Pasiyent ödəniş etməsə operator link ƏLAVƏ də edə bilmir. Ona görə axışda
  // ödəniş mərhələsi linkdən ƏVVƏL gəlir.
  const canMarkPaid = a.paymentStatus === "PENDING" && (a.paymentAmount ?? 0) > 0 && a.paymentId != null;
  // Məbləğ ödəniş təsdiqlənənə qədər həmişə təyin/dəyiş edilə bilər. Paket
  // seansının öz ödənişi paketdədir, anonim müraciətə isə ödəniş bağlanmır.
  const canEditAmount = a.patientId != null && !a.patientPackageId
    && a.paymentStatus !== "PAID" && !isFinal;
  const needsAmount = a.patientId != null && !a.patientPackageId && (!a.paymentStatus || paymentAmountUnset);
  const paymentDue = isAssigned && !a.paymentConfirmed && !isFinal;

  const markPaid = () => {
    if (!a.paymentId) return;
    guardAction(async () => {
      setPaying(true);
      try {
        await operatorApi.markPaymentPaid(a.paymentId!);
        globalToast("Ödəniş təsdiqləndi — indi görüş linki əlavə edilə bilər", "success");
        load(true);
      } catch (e) { globalToast((e as Error).message, "error"); }
      finally { setPaying(false); }
    });
  };

  // ── "Sonrakı addım" strip — bir baxışda operatora indi nə lazım olduğunu deyir ──
  // Qeyd: obyektdə funksiya SAXLAMIRIQ (yalnız `action` açarı) — belədə ref-bağlı
  // callback-lar render obyektinə düşmür (react-hooks/refs lint qaydası təmiz qalır).
  type NextTone = "action" | "warn" | "muted" | "done";
  type NextAction = "approve" | "assign" | "link" | "paySet" | "payMark" | "payView" | "dispute" | "cancelreq";
  const next: { tone: NextTone; title: string; sub?: string; btnLabel?: string; action?: NextAction } = (() => {
    if (a.status === "CANCELLED") return { tone: "muted", title: "Bu müraciət ləğv edilib." };
    if (a.status === "COMPLETED") return { tone: "done", title: "Seans tamamlanıb." };
    if (canResolve) return { tone: "warn", title: "Mübahisə açılıb — nəticəni qeyd edin.", btnLabel: "Mübahisəni həll et", action: "dispute" };
    if (isCancelReq) return { tone: "warn", title: "Pasiyent ləğv tələb edib — təsdiqləyin və ya rədd edin.", btnLabel: "Ləğv tələbinə bax", action: "cancelreq" };
    if (canAssign && full.pendingRescheduleProposal?.initiator === "PSYCHOLOGIST" && full.pendingRescheduleProposal.options?.[0]?.startAt)
      return { tone: "action", title: "Bu psixoloq yeni vaxt təklif edib — təsdiqləyin.", sub: `Təklif olunan vaxt: ${fmtDateTime(full.pendingRescheduleProposal.options[0].startAt)}`, btnLabel: approving ? "…" : "Təsdiqlə və tətbiq et", action: "approve" };
    if (canAssign && (a.rescheduleRequestedAt || full.pendingRescheduleProposal))
      return { tone: "action", title: "Vaxt dəyişikliyi istənilib — yeni vaxt təyin edin.", btnLabel: "Vaxtı seç", action: "assign" };
    if (canAssign && !isAssigned)
      return { tone: "action", title: "Bu müraciətə psixoloq və vaxt təyin edin.", btnLabel: "Təyin et", action: "assign" };
    // ── ÖDƏNİŞ mərhələsi — linkdən ƏVVƏL. Pasiyent ödəməsə link göndərilmir. ──
    if (paymentDue) {
      if (canMarkPaid)
        return { tone: "action", title: "Müştəri ödəniş etməlidir — ödəniş təsdiqlənəndə link göndərilə bilər.", sub: `Məbləğ: ${a.paymentAmount} ₼`, btnLabel: paying ? "…" : "Ödənildi olaraq işarələ", action: "payMark" };
      if (needsAmount)
        return { tone: "action", title: "Seans məbləğini təyin edin ki, müştəri ödəyə bilsin.", btnLabel: "Məbləği təyin et", action: "paySet" };
      return { tone: "action", title: "Ödəniş təsdiqlənməyib — link ödənişdən sonra göndərilir.", btnLabel: "Ödənişlərə bax", action: "payView" };
    }
    if (isAssigned && a.paymentConfirmed && !a.meetingLink && !isFinal)
      return { tone: "action", title: "Görüş linkini əlavə edin ki, pasiyentə göndərilsin.", btnLabel: "Link əlavə et", action: "link" };
    if (needsPayment)
      return { tone: "action", title: "Seans məbləğini təyin edin ki, ödənişlərdə görünsün.", btnLabel: "Məbləği təyin et", action: "paySet" };
    return { tone: "done", title: "Bütün məlumatlar tamamdır." };
  })();
  const runNextAction = (action: NextAction) => {
    if (action === "approve") approveProposal();
    else if (action === "assign") focusAssign();
    else if (action === "link") setLinkModalOpen(true);
    else if (action === "paySet") setPaymentModalOpen(true);
    else if (action === "payMark") markPaid();
    else if (action === "payView") router.push("/operator/payments");
    else if (action === "dispute") setOtherAction("dispute");
    else if (action === "cancelreq") setOtherAction("cancelreq");
  };
  // Ton → mövcud fx-banner variantı (yeni rəng icad edilmir).
  const nextBannerClass = {
    action: "fx-banner--info",
    warn:   "fx-banner--warn",
    muted:  "fx-banner--info",
    done:   "fx-banner--success",
  }[next.tone];

  // Təyin/yenidən-planla forması (AssignBlock) birbaşa aşağıda tam görünürsə,
  // eyni "psixoloq və vaxt təyin edin" çağırışını təkrarlayan üst strip artıqdır —
  // onu gizlə (assign-dışı addımlarda: ödəniş/link/mübahisə strip QALIR).
  const assignBlockVisible = !isFinal && canAssign;
  // Terminal vəziyyətdə strip aşağıdakı «Vəziyyət» kartını təkrarlayır — gizlət.
  const hideNextStrip = isFinal || (assignBlockVisible && next.action === "assign");

  // Sahiblik meta sətri — çip DEYİL, ikon + mətn (dizayn qaydası).
  const ownerLabel = claim?.mine ? "Sənin üzərində" : claimedByOther ? `${claim?.claimedByName ?? "?"} işləyir` : "Sahibsiz";
  const ownerColor = claim?.mine ? "var(--sage)" : claimedByOther ? "var(--status-pending-fg)" : "var(--oxford-60)";

  // Backend qaydası (OP-FR-04): yalnız toxunulmamış müraciət sərbəst buraxılır.
  // Hovuza qaytarmaq yalnız TƏYİNATDAN ƏVVƏL mümkündür: psixoloq və ya vaxt
  // təyin edilibsə randevu artıq müştəriyə söz verilib.
  const canReleaseToPool = (a.status === "PENDING" || a.status === "NEW")
    && !a.psychologistId && !a.startAt;

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
          {/* ── 1. Kimlik + status ────────────────────────────────────────── */}
          <div className="opd__header">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
              <button onClick={backToList} className="fx-iconbtn" title={t("staff.opDetBackToList")} aria-label={t("staff.opDetBackToList")} style={{ flex: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <span className="fx-num" style={{ fontWeight: 700, fontSize: 17, color: "var(--oxford)" }}>#FNS-{String(id).padStart(4, "0")}</span>
              {/* Əsl status rozeti — dizayn sistemi pili. */}
              <span className={`fx-pill ${statusPillClass(a.status)}`}>{statusLabel(a.status)}</span>
              {a.sessionKind === "INTRO" && (
                <span style={{ fontSize: 12, color: "var(--oxford-60)" }}>Pulsuz tanışlıq görüşü</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Sahiblik — YALNIZ başqasının üzərində olanda göstərilir.
                  Operator onsuz da yalnız öz müraciətlərini görür, ona görə
                  "Sənin üzərində" heç bir məlumat vermirdi. */}
              {!claim?.mine && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ownerColor, fontSize: 12, fontWeight: 600 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  {ownerLabel}
                </span>
              )}
              {/* Gözləmə müddəti ayrıca element — ayırıcı işarə yerinə boşluq.
                  nowMs mount-dan sonra dolur; 0 ikən "0 dəqiqədir" yazmırıq. */}
              {!isFinal && nowMs > 0 && (
                <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500 }}>
                  {ageLabel(a.createdAt, nowMs)} gözləyir
                </span>
              )}
              {unowned && (
                <button onClick={takeOwnership} className="fx-btn fx-btn--primary fx-btn--sm">{t("staff.opTake")}</button>
              )}
              {/* Hovuza qaytarmaq YALNIZ heç nə təyin edilməmiş müraciətdə
                  mümkündür. Psixoloq/vaxt təyin ediləndən sonra randevu artıq
                  müştəriyə söz verilib — belə sətri hovuza atmaq olmaz, ona görə
                  düymə tamamilə gizlədilir (Admin təsdiqi yolu da göstərilmir). */}
              {claim?.mine && canReleaseToPool && (
                <button
                  onClick={releaseToPool}
                  disabled={releaseBusy}
                  className="fx-btn fx-btn--ghost fx-btn--sm"
                  title="Randevunu hovuza qaytar"
                >
                  {releaseBusy ? "Buraxılır…" : "Hovuza geri burax"}
                </button>
              )}
              {isAdmin && !unowned && (
                <button onClick={() => setReassignOpen(true)} className="fx-btn fx-btn--ghost fx-btn--sm">{t("staff.opReassign")}</button>
              )}
            </div>
          </div>

          <div className="opd__body">

            {/* ── 2. İndi nə lazımdır ────────────────────────────────────────
                AssignBlock aşağıda tam görünürsə və ya müraciət bağlanıbsa,
                eyni çağırışı təkrarlayan strip gizlədilir. */}
            {!hideNextStrip && (
              <div className={`fx-banner ${nextBannerClass}`} style={{ alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  {next.tone === "done" ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6L9 17l-5-5" /></svg>
                  ) : next.tone === "warn" ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M10 8l4 4-4 4" /></svg>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{next.title}</div>
                    {next.sub && <div style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 2 }}>{next.sub}</div>}
                  </div>
                </div>
                {next.btnLabel && next.action && (
                  <button onClick={() => runNextAction(next.action!)} disabled={approving && next.action === "approve"}
                    className="fx-btn fx-btn--primary fx-btn--sm" style={{ flex: "none" }}>
                    {next.btnLabel}
                  </button>
                )}
              </div>
            )}

            {isFinal ? (
              /* Terminal vəziyyət kartı */
              <div className="opd-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                <div className="opd-card__title">Vəziyyət</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{statusLabel(a.status)}</div>
                {cleanOperatorNote(a.operatorNote) && (
                  <div className="fx-muted" style={{ fontSize: 13 }}>Qeyd: {cleanOperatorNote(a.operatorNote)}</div>
                )}
              </div>
            ) : (
              <>
                {/* ── 3. Təyinat ───────────────────────────────────────────── */}
                {canAssign && (
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

                {/* ── 4. Ödəniş (linkdən ƏVVƏL — link ödənişdən asılıdır) ──── */}
                <SectionCard
                  title="Ödəniş"
                  tone="sage"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20M6 15h4" /></svg>}
                  right={a.paymentAmount != null && a.paymentAmount > 0 ? (
                    /* Ödəniş vəziyyəti kapsul deyil — rəngli nöqtə + mətn. */
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: a.paymentStatus === "PAID" ? "var(--sage)" : "var(--oxford-60)" }}>
                      <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: a.paymentStatus === "PAID" ? "var(--sage)" : "#C97D2E", flex: "none" }} />
                      {a.paymentStatus === "PAID" ? "Ödənilib" : "Gözləyir"}
                    </span>
                  ) : undefined}
                >
                  {/* Məbləğ ödəniş TƏSDİQLƏNƏNƏ QƏDƏR dəyişdirilə bilər — backend
                      mövcud PENDING ödənişin məbləğini yeniləyir (createManual).
                      Əvvəl bu hal ümumiyyətlə göstərilmirdi və təyinatdan əvvəl
                      «Ödəniş tələb olunmur» yazırdı — səhv və çaşdırıcı idi. */}
                  {a.paymentAmount != null && a.paymentAmount > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="fx-num" style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)" }}>{a.paymentAmount} ₼</div>
                        <div className="fx-muted" style={{ fontSize: 12, marginTop: 2 }}>
                          {a.paymentStatus === "PAID" ? "Ödəniş təsdiqlənib" : "Müştəri ödəməlidir — link ödənişdən sonra göndərilir"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flex: "none", flexWrap: "wrap" }}>
                        {canEditAmount && (
                          <button onClick={() => setPaymentModalOpen(true)} className="fx-btn fx-btn--ghost fx-btn--sm">Məbləği dəyiş</button>
                        )}
                        {canMarkPaid && (
                          <button onClick={markPaid} disabled={paying} className="fx-btn fx-btn--primary fx-btn--sm">
                            {paying ? "…" : "Ödənildi olaraq işarələ"}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <span className="fx-muted" style={{ fontSize: 13 }}>
                        {a.patientPackageId
                          ? "Paket seansı — ödəniş paketlə birlikdə alınıb"
                          : a.patientId == null
                            ? "Anonim müraciət — ödəniş yalnız qeydiyyatlı pasiyent üçün yaradılır"
                            : "Bu seans üçün ödəniş qeydi yoxdur"}
                      </span>
                      {canEditAmount && (
                        <button onClick={() => setPaymentModalOpen(true)} className="fx-btn fx-btn--primary fx-btn--sm" style={{ flex: "none" }}>Məbləği təyin et</button>
                      )}
                    </div>
                  )}
                </SectionCard>

                {/* ── 5. Görüş linki ───────────────────────────────────────── */}
                <SectionCard
                  title="Görüş linki"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>}
                >
                  {a.meetingLink ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <a href={a.meetingLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--brand)", wordBreak: "break-all", minWidth: 0 }}>{a.meetingLink}</a>
                      <div style={{ display: "flex", gap: 8, flex: "none" }}>
                        <button onClick={() => setLinkModalOpen(true)} className="fx-btn fx-btn--ghost fx-btn--sm">Dəyiş</button>
                        <button onClick={() => guardAction(async () => { try { await operatorApi.revokeMeetingLink(a.id); load(true); setToast("Link silindi"); } catch (e) { globalToast((e as Error).message, "error"); } })}
                          className="fx-btn fx-btn--danger-ghost fx-btn--sm">Sil</button>
                      </div>
                    </div>
                  ) : !a.paymentConfirmed ? (
                    <div className="fx-banner fx-banner--warn">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      <span>Əvvəlcə ödəniş təsdiqlənməlidir — müştəri ödəyəndən sonra link əlavə oluna və göndərilə bilər.</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <span className="fx-muted" style={{ fontSize: 13 }}>Görüş linki hələ əlavə edilməyib</span>
                      <button onClick={() => setLinkModalOpen(true)} className="fx-btn fx-btn--primary fx-btn--sm" style={{ flex: "none" }}>Link əlavə et</button>
                    </div>
                  )}
                </SectionCard>

                {/* ── 6. Digər əməliyyatlar ────────────────────────────────── */}
                {otherKeys.length > 0 && (
                  <SectionCard
                    title="Digər əməliyyatlar"
                    tone="danger"
                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>}
                  >
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {otherKeys.map(k => (
                        <button key={k} onClick={() => setOtherAction(k)} className={`fx-btn fx-btn--sm ${OTHER_ACTION_META[k].btnClass}`}>
                          {OTHER_ACTION_META[k].label}
                        </button>
                      ))}
                    </div>
                  </SectionCard>
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
      {releaseOpen && (
        <ModalShell
          title="Hovuza buraxma tələbi"
          sub="Bu randevu üzərində artıq əməliyyat aparılıb, ona görə buraxma Admin təsdiqindən keçir."
          onClose={() => setReleaseOpen(false)}
          footer={
            <div className="fx-modal__actions" style={{ marginTop: 0 }}>
              <button onClick={() => setReleaseOpen(false)} className="fx-btn fx-btn--ghost">Ləğv</button>
              <button onClick={sendReleaseRequest} disabled={releaseBusy} className="fx-btn fx-btn--primary">
                {releaseBusy ? "Göndərilir…" : "Tələbi göndər"}
              </button>
            </div>
          }
        >
          <label className="fx-field">
            <span className="fx-label">Səbəb (opsional)</span>
            <textarea
              className="fx-textarea"
              rows={4}
              value={releaseReason}
              onChange={e => setReleaseReason(e.target.value)}
              placeholder="Məsələn: müştəri ilə əlaqə qurula bilmir, başqa operatora uyğundur…"
            />
          </label>
        </ModalShell>
      )}

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
        <div className="fx-toast" style={{ background: "var(--oxford)" }}>{toast}</div>
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

  useEffect(() => {
    operatorApi.listOperators().then(setOperators).catch(() => {});
  }, []);

  const submit = () => {
    if (!opId) { globalToast(t("staff.opReassignPick"), "error"); return; }
    setBusy(true);
    operatorApi.reassignAppointment(id, opId)
      .then(onDone)
      .catch(e => { globalToast((e as Error).message, "error"); setBusy(false); });
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

  // Qeyd: "Blokla / spam" hələlik gizlədilib (sonra baxılacaq) — blockOrUnblock
  // funksiyası da götürülüb ki, istifadə olunmayan kod qalmasın.

  return (
    <>
      {/* Pasiyent kartı */}
      <div className="opd-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="opd-card__title">{t("staff.opDetPatientCard")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <span className="fx-avatar fx-avatar--1" aria-hidden>{(a.patientName ?? "?").trim().charAt(0).toUpperCase()}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", overflow: "hidden", textOverflow: "ellipsis" }}>{a.patientName ?? "—"}</div>
            <div className="fx-muted" style={{ fontSize: 12, marginTop: 2 }}>
              {a.patientId ? t("staff.opDetRegistered") : t("staff.opDetAnonymous")}{h?.blocked ? ", bloklanıb" : ""}
            </div>
          </div>
        </div>
        {a.patientPhone && (
          <div className="fx-num" style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>{a.patientPhone}</div>
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
      </div>

      {/* Müraciət xülasəsi — düz "etiket: dəyər" sətirləri, hər biri tək xətt */}
      <div className="opd-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="opd-card__title">Müraciət xülasəsi</div>
        <div className="opd-kv"><span className="opd-kv__k">İstənilən vaxt</span><span className="opd-kv__v">{fmtDateTime(a.requestedStartAt)}</span></div>
        {/* origin=DIRECT → etiketin özü "Müştəri seçdi" olur (badge lazım deyil). */}
        <div className="opd-kv">
          <span className="opd-kv__k">{a.origin === "DIRECT" ? "Müştəri seçdi" : "İstənilən psixoloq"}</span>
          <span className="opd-kv__v" style={{ fontFamily: "inherit" }}>
            {a.psychologistName ?? a.requestedPsychologistName ?? "Fanusa həvalə edilib"}
          </span>
        </div>
        {a.startAt && <div className="opd-kv"><span className="opd-kv__k">Təyin edilmiş vaxt</span><span className="opd-kv__v">{fmtDateTime(a.startAt)}</span></div>}
        <div className="opd-kv"><span className="opd-kv__k">Yaradılıb</span><span className="opd-kv__v">{fmtDateTime(a.createdAt)}</span></div>
        {/* Müraciət mətni — kontekstdir, əməliyyat deyil: xülasənin altında. */}
        {a.note && <RequestNote text={a.note} />}
      </div>

      {/* Bu müştərinin digər seansları — cross-appointment kontekst (Son fəaliyyət
          yalnız BU müraciətin hadisələridir; əvvəlki seanslar orada görünmür). */}
      {(() => {
        const others = (h?.recent ?? []).filter(r => r.id !== a.id);
        if (others.length === 0) return null;
        return (
          <div className="opd-card" style={{ padding: 16 }}>
            <div className="opd-card__title" style={{ marginBottom: 10 }}>Müştərinin seansları</div>
            {others.slice(0, 6).map((r, i, arr) => {
              // İki sətir: üstdə psixoloqun adı, altda boz tarix və rəngli status.
              // Ayırıcı işarə yoxdur — sətir bölgüsü və boşluq ayırır.
              const when = r.startAt ?? r.createdAt;
              const statusColor = r.status === "COMPLETED" ? "var(--sage)"
                : (r.status === "CANCELLED" || r.status === "REJECTED") ? "var(--rose)" : "var(--oxford-60)";
              return (
                <Link key={r.id} href={`/operator/appointments/${r.id}${suffix}`}
                  style={{ display: "block", padding: "8px 0", borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--hairline)", textDecoration: "none" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--oxford)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.psychologistName ?? (r.sessionKind === "INTRO" ? "Tanışlıq görüşü" : "Seans")}
                    {r.psychologistName && r.sessionKind === "INTRO" ? " (tanışlıq)" : ""}
                  </div>
                  <div className="fx-muted" style={{ fontSize: 11, marginTop: 3, display: "flex", gap: 10 }}>
                    <span>{when ? azFormatDate(when) : "—"}</span>
                    <span style={{ color: statusColor, fontWeight: 600 }}>{statusLabel(r.status)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        );
      })()}

      {/* Kurs konteksti */}
      {a.seriesId != null && full.seriesSiblings.length > 0 && (
        <div className="opd-card" style={{ padding: 16 }}>
          <div className="opd-card__title" style={{ display: "block", marginBottom: 10 }}>
            <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
              <span>{t("staff.opDetGroupContext")}</span>
              <span style={{ color: "var(--oxford-60)", fontWeight: 500 }}>
                {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal ?? full.seriesSiblings.length })}
              </span>
            </span>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {full.seriesSiblings.map(s => (
              <Link key={s.id} href={`/operator/appointments/${s.id}${suffix}`}
                className={s.id === a.id ? "op-det-sibling op-det-sibling--current" : "op-det-sibling"}>
                <span className="fx-num" style={{ display: "inline-flex", gap: 8 }}>
                  <span>#{s.id}</span>
                  <span>{azOrdinal((s.seriesIndex ?? 0) + 1)} seans</span>
                </span>
                <span style={{ color: "var(--oxford-60)", display: "inline-flex", gap: 8 }}>
                  <span>{s.startAt ? azFormatDate(s.startAt) : "—"}</span>
                  <span>{statusLabel(s.status)}</span>
                </span>
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
          <div className="opd-card__title" style={{ display: "block", marginBottom: 12 }}>Son fəaliyyət</div>
          <div className="fx-timeline">
          {full.activity.slice(0, 6).map((item, i, arr) => {
            // Görüş linki hadisələri: xam link ("meetingLink=https://…") ekranı daşırırdı.
            // İndi "Link təyin edildi" kimi göstərilir; link varsa mavi + klikləyəndə kopyalanır.
            const isLink = !!item.action && item.action.startsWith("APPT_MEETING_LINK");
            const copyLink = isLink
              ? (meetingLinkFromActivity(item) ?? (item.action !== "APPT_MEETING_LINK_REVOKED" ? a.meetingLink ?? null : null))
              : null;
            const doCopy = () => {
              if (!copyLink) return;
              navigator.clipboard?.writeText(copyLink)
                .then(() => globalToast("Link kopyalandı", "success"))
                .catch(() => globalToast("Kopyalamaq alınmadı", "error"));
            };
            return (
              <div key={i} className="fx-tl-item">
                <div className="fx-tl-rail">
                  <span className={`fx-tl-dot ${activityDotClass(item)}`} />
                  {i !== arr.length - 1 && <span className="fx-tl-line" />}
                </div>
                <div className="fx-tl-body" style={{ paddingBottom: i === arr.length - 1 ? 0 : 14, minWidth: 0 }}>
                  {copyLink ? (
                    <div onClick={doCopy} role="button" tabIndex={0}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doCopy(); } }}
                      title="Klikləyin — link kopyalanır"
                      className="fx-tl-title" style={{ fontSize: 12.5, color: "var(--brand)", cursor: "pointer" }}>
                      {activityLabel(item)}
                    </div>
                  ) : (
                    <div className="fx-tl-title" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--oxford)", overflowWrap: "anywhere" }}>{activityLabel(item)}</div>
                  )}
                  <div className="fx-tl-meta" style={{ fontSize: 11 }} title={azFormatDateTime(item.createdAt)}>{azFromNow(item.createdAt, nowMs)}</div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

    </>
  );
}

// Görüş linki audit hadisələri → təmiz AZ etiket (xam "meetingLink=…" göstərilmir).
const MEETING_LINK_ACTIONS: Record<string, string> = {
  APPT_MEETING_LINK_SET: "Link təyin edildi",
  APPT_MEETING_LINK_UPDATED: "Link yeniləndi",
  APPT_MEETING_LINK_SENT: "Link göndərildi",
  APPT_MEETING_LINK_REVOKED: "Link silindi",
};
/** Audit qeydindən ("meetingLink=https://…") URL-i çıxarır — yoxdursa null. */
function meetingLinkFromActivity(item: OperatorActivityItem): string | null {
  const m = item.text?.match(/meetingLink=(\S+)/i);
  return m ? m[1] : null;
}

/** Audit sətrindəki xam ingilis hadisə adları → AZ cümlə. */
const AUDIT_EVENT_LABEL: [RegExp, string][] = [
  [/^Operator force-cancelled/i,   "Operator seansı ləğv etdi"],
  [/^Operator cancelled/i,         "Operator seansı ləğv etdi"],
  [/^Patient cancelled/i,          "Pasiyent seansı ləğv etdi"],
  [/^Psy(chologist)? cancelled/i,  "Psixoloq seansı ləğv etdi"],
  [/^Operator approved cancel/i,   "Operator ləğv tələbini təsdiqlədi"],
  [/^Operator rejected cancel/i,   "Operator ləğv tələbini rədd etdi"],
  [/^Operator marked no-?show/i,   "Operator gəlməmə qeyd etdi"],
  [/^Auto-?completed/i,            "Seans avtomatik tamamlandı"],
];

/**
 * Audit qeydi «Operator force-cancelled · reason=OPERATOR_PATIENT_REQUEST ·
 * note=dwqdwq» şəklində gəlir — bu operatora göstərilə bilməz. Hadisə adı AZ
 * cümləyə, səbəb kodu insan etiketinə çevrilir, qeyd sitat kimi əlavə olunur.
 */
function humanizeAuditText(raw: string): string | null {
  const label = AUDIT_EVENT_LABEL.find(([re]) => re.test(raw))?.[1];
  if (!label) return null;
  const reasonCode = /reason=([A-Z_]+)/.exec(raw)?.[1];
  const note = /note=([\s\S]+?)(?:\s*·\s*\w+=|$)/.exec(raw)?.[1]?.trim();
  const parts = [label];
  if (reasonCode) parts.push(`Səbəb: ${reasonLabel(reasonCode)}`);
  if (note) parts.push(`Qeyd: ${note}`);
  return parts.join(". ");
}

function activityLabel(item: OperatorActivityItem): string {
  if (item.action && MEETING_LINK_ACTIONS[item.action]) return MEETING_LINK_ACTIONS[item.action];
  const raw = item.text?.trim();
  if (raw) {
    const humanized = humanizeAuditText(raw);
    if (humanized) return humanized;
    // Backend audit qeydləri bəzən xam ingiliscə + ISO nanosaniyəli tarixlə gəlir
    // (məs. "Psy proposed 1 options · expires 2026-07-19T00:12:07.808…") — bunları
    // operatora insani AZ mətnə çeviririk, tanınmayanların ISO "quyruğunu" kəsirik.
    if (/^Psy proposed/i.test(raw)) return "Psixoloq yeni vaxt təklif etdi";
    if (/^Psy accepted/i.test(raw)) return "Psixoloq təklifi qəbul etdi";
    if (/^Psy rejected/i.test(raw)) return "Psixoloq təklifi rədd etdi";
    if (/^Patient rejected/i.test(raw)) return "Pasiyent təklifi rədd etdi";
    if (/^Patient proposed/i.test(raw)) return "Pasiyent alternativ vaxt təklif etdi";
    // "· expires <ISO>" və ya sonrakı ISO damcı-timestamp quyruğunu təmizlə;
    // tanınmayan sətirdə qalan orta nöqtələr də vergülə çevrilir.
    const cleaned = raw
      .replace(/\s*·\s*expires\s+\S+/i, "")
      .replace(/\s*\d{4}-\d{2}-\d{2}T[\d:.]+/g, "")
      .replace(/\s*·\s*/g, ", ")
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
/** Fəaliyyət növü → fx-timeline nöqtə variantı (dizayn sistemi sinifləri). */
function activityDotClass(item: OperatorActivityItem): string {
  const raw = (item.text ?? "").toLowerCase();
  if (item.kind === "CREATED") return "fx-tl-dot--muted";
  if (/təklif|proposed/.test(raw)) return "fx-tl-dot--amber";
  if (/təsdiq|confirm|qəbul|accepted/.test(raw)) return "fx-tl-dot--sage";
  if (/ləğv|cancel|rədd|reject|no-show|gəlmə/.test(raw)) return "fx-tl-dot--rose";
  if (/təyin|assign|vaxt|link|ödəniş|məbləğ/.test(raw)) return "fx-tl-dot--brand";
  return "fx-tl-dot--muted";
}

// "Digər əməliyyatlar" açarları + sakit sətir/modal meta məlumatı.
type OtherActionKey = "dispute" | "cancelreq" | "noshow" | "cancel";
const OTHER_ACTION_META: Record<OtherActionKey, {
  label: string; btnClass: string;
  title: string; sub: string; badge: { label: string; pillClass: string };
}> = {
  dispute:   { label: "Mübahisəni həll et", btnClass: "fx-btn--warn-ghost",   title: "Mübahisəni həll et", sub: "Seans baş tutdumu? Nəticəni qeyd edin.", badge: { label: "Mübahisəli", pillClass: "fx-pill--pending" } },
  cancelreq: { label: "Ləğv tələbi",        btnClass: "fx-btn--warn-ghost",   title: "Ləğv tələbi",        sub: "Pasiyentin ləğv tələbini emal edin.",    badge: { label: "Gözlənilir", pillClass: "fx-pill--pending" } },
  noshow:    { label: "No-show",            btnClass: "fx-btn--ghost",        title: "No-show işarələ",    sub: "Seansa kim gəlmədi?",                    badge: { label: "No-show",    pillClass: "fx-pill--cancelled" } },
  cancel:    { label: "Seansı ləğv et",     btnClass: "fx-btn--danger-ghost", title: "Seansı ləğv et",     sub: "Bu seansı bağlayın.",                    badge: { label: "Ləğv",       pillClass: "fx-pill--refunded" } },
};

/* ─── Mərkəz: təyinat bloku (köhnə AssignModal-ın səhifə bloku) ────────────── */

/* ─── Fokuslu modal qabığı (Bilet new) ─────────────────────────────────────── */

function ModalShell({ title, sub, badge, onClose, footer, maxWidth = 480, children }: {
  title: string;
  sub?: string;
  badge?: { label: string; pillClass: string };
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
              {badge && <span className={`fx-pill ${badge.pillClass}`}>{badge.label}</span>}
            </div>
            {sub && <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 3 }}>{sub}</div>}
          </div>
          <button onClick={onClose} aria-label="Bağla" className="fx-iconbtn" style={{ flex: "none" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: "14px 20px", borderTop: "1px solid var(--hairline)" }}>{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Müraciət mətni. Fanus/qonaq axınları qeydi «Etiket: dəyər» sətirləri kimi
 * göndərir; əvvəl hamısı tək abzasa yığılıb oxunmaz bir yığın olurdu.
 * İndi etiketli sətirlər səhifənin öz açar-dəyər dili ilə (opd-kv) düzülür,
 * etiketsiz mətn isə sitat kimi qalır.
 */
function RequestNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const CRISIS = "[TƏCİLİ]";
  const rows: { k: string; v: string }[] = [];
  const free: string[] = [];
  let crisis = false;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(CRISIS)) {
      crisis = true;
      const rest = line.slice(CRISIS.length).trim();
      if (rest) free.push(rest);
      continue;
    }
    // «Etiket: dəyər» — etiket qısa olmalıdır ki, adi cümlədəki iki nöqtə
    // (məs. "Qeyd: bu belə oldu: sonra...") sətri parçalamasın.
    const m = /^([^:]{2,24}):\s*(.+)$/.exec(line);
    if (m) rows.push({ k: m[1].trim(), v: m[2].trim() });
    else free.push(line);
  }

  return (
    <div style={{ marginTop: 2, paddingTop: 10, borderTop: "1px solid var(--hairline)" }}>
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: rows.length ? 10 : 0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--oxford-60)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }} aria-hidden><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {crisis && (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#DC2626" }}>
              Böhran açar-sözü aşkarlandı — prioritet müraciət
            </span>
          )}
          {free.length > 0
            ? free.map((line, i) => (
                <span key={i} style={{ fontSize: 12.5, color: "var(--oxford-80)", lineHeight: 1.5, overflowWrap: "anywhere" }}>{line}</span>
              ))
            : <span className="fx-muted" style={{ fontSize: 12.5 }}>Müraciət məlumatı</span>}
        </div>
      </div>
      {/* Qısa dəyər iki sütunlu sətirdə qalır. Uzun dəyər (e-poçt, ünvan, uzun
          səbəb) həmin dar sütunda kəsilirdi — ona görə etiket üstdə, dəyər
          altda TAM ENİ ilə yazılır və sarılır. Heç nə gizlənmir. */}
      {rows.map((r, i) => (r.v.length > 24 ? (
        <div key={i} style={{ padding: "7px 0", borderBottom: "1px solid var(--hairline)" }}>
          <div className="fx-section-label" style={{ marginBottom: 3 }}>{r.k}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--oxford)", lineHeight: 1.5, overflowWrap: "anywhere", userSelect: "text" }}>
            {r.v}
          </div>
        </div>
      ) : (
        <div key={i} className="opd-kv">
          <span className="opd-kv__k">{r.k}</span>
          <span className="opd-kv__v" title={r.v} style={{ fontFamily: "inherit", overflowWrap: "anywhere", userSelect: "text" }}>{r.v}</span>
        </div>
      )))}

      {(rows.length > 0 || free.length > 0) && (
        <button type="button" onClick={() => setOpen(true)}
          style={{ marginTop: 8, background: "none", border: "none", padding: 0, color: "var(--brand)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
          Bax
        </button>
      )}

      {open && (
        <ModalShell title="Müraciət məlumatı" maxWidth={520} onClose={() => setOpen(false)}
          footer={<button onClick={() => setOpen(false)} className="fx-btn fx-btn--primary" style={{ width: "100%" }}>Bağla</button>}>
          {crisis && (
            <div className="fx-banner fx-banner--warn" style={{ marginBottom: 14 }}>
              <span style={{ fontWeight: 700, color: "#DC2626" }}>Böhran açar-sözü aşkarlandı — prioritet müraciət</span>
            </div>
          )}
          {free.map((line, i) => (
            <p key={i} style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--oxford)", lineHeight: 1.6, overflowWrap: "anywhere" }}>{line}</p>
          ))}
          {/* Burada dəyər kəsilmir: hər sahə tam eni ilə, etiketi üstündə. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rows.map((r, i) => (
              <div key={i}>
                <div className="fx-section-label" style={{ marginBottom: 4 }}>{r.k}</div>
                <div style={{ fontSize: 13.5, color: "var(--oxford)", lineHeight: 1.5, overflowWrap: "anywhere", userSelect: "text" }}>{r.v}</div>
              </div>
            ))}
          </div>
        </ModalShell>
      )}
    </div>
  );
}

/** Detal səhifəsinin bölmə kartı: rəngli ikon + başlıq, sağda əməliyyat,
 *  yığıla bilən gövdə. Rozet/kapsul işlətmir. */
function SectionCard({ icon, tone = "brand", title, right, children }: {
  icon: React.ReactNode;
  tone?: "brand" | "sage" | "danger";
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const toneColor = tone === "sage" ? "var(--sage)" : tone === "danger" ? "#DC2626" : "var(--brand)";
  return (
    <div className="opd-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: open ? 10 : 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span aria-hidden style={{
            width: 26, height: 26, borderRadius: 8, flex: "none", color: toneColor,
            background: "var(--surface-2, #F6F8FC)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{icon}</span>
          <span className="opd-card__title">{title}</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "none" }}>
          {right}
          <button type="button" onClick={() => setOpen(o => !o)} className="fx-iconbtn"
            aria-expanded={open} aria-label={open ? "Bölməni yığ" : "Bölməni aç"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .12s" }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </span>
      </div>
      {open && children}
    </div>
  );
}

/** Seans özətindəki bir sütun: kiçik boz etiket + altında dəyər.
 *  Kapsul/rozet işlətmir — dəyərlər sadə mətndir. */
function SummaryCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="fx-section-label" style={{ marginBottom: 7 }}>{label}</div>
      {children}
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
  /** Məbləğ standartdan fərqləndirilir — yalnız operator dəqiqləşdirəndən sonra açılır. */
  const [priceEditing, setPriceEditing] = useState(false);
  /** Standartdan fərqli məbləğ üçün MƏCBURİ əsas — qeydə yazılır ki, izlənə bilsin. */
  const [priceReason, setPriceReason] = useState("");
  // Operator qeydi sahəsi təyinat formasından ÇIXARILIB — formada yalnız
  // əməliyyat üçün zəruri sahələr qalır. Mövcud qeyd itmir: payload-a olduğu
  // kimi geri göndərilir, məbləğ dəqiqləşdirməsi də ona əlavə olunur.
  const note = appointment.operatorNote ?? "";
  /** Təyin edilmiş randevu normalda ÖZƏT kimi göstərilir; forma yalnız «Dəyiş»lə açılır. */
  const [editing, setEditing] = useState(false);
  // Seçilmiş vaxt psixoloqun iş qrafikinə düşmür — bloklayıcı deyil, xəbərdarlıq.
  // Operator psixoloqla razılaşıb "Yenə də təyin et" ilə təsdiqləyə bilər.
  const [scheduleWarn, setScheduleWarn] = useState<string | null>(null);
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
  // Seans məbləği bir dəfə təyin olunandan sonra kilidlənir — yenidən təyinatda da
  // dəyişdirilə bilməz (mövcud ödənişin üzərinə yazılmasın).
  const priceLocked = (appointment.paymentAmount ?? 0) > 0;

  /** Seçilmiş psixoloqun standart tək seans qiyməti — məbləğin etalonu. */
  const standardPrice = psyId != null
    ? (psychologists.find(p => p.id === psyId)?.individualPrice ?? null)
    : null;

  // Məbləği AVTOMATİK doldur: pasiyent psixoloqu özü seçib gəldikdə operator
  // sahəni əl ilə doldurmamalıdır. Yalnız sahə boş olduqda işə düşür — operatorun
  // yazdığının üzərinə yazmır. (Psixoloqu operator dəyişəndə onPsychChange sıfırlayır.)
  useEffect(() => {
    if (priceLocked || allowance?.packageName) return;
    if (standardPrice == null) return;
    setSinglePrice(prev => (prev.trim() ? prev : String(standardPrice)));
  }, [standardPrice, priceLocked, allowance?.packageName]);

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
    setScheduleWarn(null); // vaxt dəyişdi — köhnə qrafik xəbərdarlığı artıq keçərsizdir
    setPickedSlots(prev => {
      if (prev.includes(startAt)) return prev.filter(s => s !== startAt);
      if (maxSlots <= 1) return [startAt]; // tək seçim → əvəzlə
      if (prev.length >= maxSlots) {
        globalToast(allowance?.packageName
          ? `Paketdə ${maxSlots} seans qalıb — daha çox seçilə bilməz`
          : "Paket yoxdur — yalnız 1 vaxt seçilə bilər", "error");
        return prev;
      }
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

  const doSubmit = async (allowOutsideSchedule = false) => {
    if (!allowOutsideSchedule) setScheduleWarn(null);
    if (!psyId) { globalToast("Psixoloq seçin", "error"); return; }

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
      if (new Date(startAt) >= new Date(endAt)) { globalToast("Başlama vaxtı bitiş vaxtından əvvəl olmalıdır", "error"); return; }
      payloadSlots = [{ startAt, endAt }];
    }
    if (payloadSlots.length === 0) { globalToast("Vaxt seçin və ya əl ilə daxil edin", "error"); return; }
    if (payloadSlots.length > maxSlots) {
      globalToast(allowance?.packageName
        ? `Paketdə ${maxSlots} seans qalıb — daha çox vaxt seçilə bilməz`
        : "Paket yoxdur — yalnız 1 vaxt seçilə bilər", "error");
      return;
    }

    // Standartdan fərqli məbləğ yalnız yazılı dəqiqləşdirmə ilə keçir — operator
    // öz mülahizəsi ilə qiyməti dəyişə bilməz.
    const priceChanged = !priceLocked && !allowance?.packageName
      && standardPrice != null && singlePrice.trim() !== "" && Number(singlePrice) !== standardPrice;
    if (priceChanged && !priceReason.trim()) {
      globalToast("Standartdan fərqli məbləğ üçün dəqiqləşdirmənin əsasını yazın", "error");
      return;
    }

    const noteWithPrice = priceChanged
      ? [note.trim(), `Məbləğ dəqiqləşdirildi: ${standardPrice} ₼ → ${Number(singlePrice)} ₼. Əsas: ${priceReason.trim()}`]
          .filter(Boolean).join("\n")
      : note;

    setSaving(true);
    try {
      const updated = await operatorApi.assignSlots(appointment.id, {
        psychologistId: psyId, slots: payloadSlots, operatorNote: noteWithPrice || null,
        // Tək (paketsiz) seans üçün opsional qiymət override-i; paketdə göndərilmir.
        // Məbləğ bir dəfə təyin olunubsa yenidən göndərilmir — mövcud ödənişin
        // üzərinə yazılmasın (yenidən təyin edərkən də dəyişməz qalır).
        sessionPrice: (!priceLocked && !allowance?.packageName && singlePrice.trim()) ? Number(singlePrice) : null,
        allowOutsideSchedule,
      });
      const primary = updated.find(u => u.id === appointment.id) ?? updated[0];
      if (primary) onAssigned(primary);
    } catch (e) {
      // İş-qrafiki uyğunsuzluğu (422) — bloklamır: xəbərdarlıq göstər, operator
      // psixoloqla əlaqə saxlayıb "Yenə də təyin et" ilə təsdiqləyə bilər.
      if (!allowOutsideSchedule && isScheduleMismatch(e)) {
        setScheduleWarn((e as Error).message);
        // Xəbərdarlıq və «Yenə də təyin et» yalnız formadadır — özətdən təyin
        // edilibsə forma açılır ki, operator xəbərdarlığı görsün.
        setEditing(true);
      } else {
        globalToast((e as Error).message, "error");
        // GAP-02 / B4-2: konflikt konsolu — slot qaçdı, köhnə seçimi at, yenilə
        if (isSlotConflict(e) && psyId) {
          setPickedSlots([]);
          loadSlots(psyId);
        }
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
    setScheduleWarn(null); // psixoloq dəyişdi — qrafik xəbərdarlığı yeni psixoloqa aid deyil
    const psy = id !== null ? psychologists.find(p => p.id === id) : null;
    // Yeni psixoloq → yeni standart qiymət; əvvəlki dəqiqləşdirmə də sıfırlanır.
    setSinglePrice(psy?.individualPrice != null ? String(psy.individualPrice) : "");
    setPriceEditing(false);
    setPriceReason("");
  };

  // "İstənilən vaxt" = gözləyən təklifin vaxtı (varsa) → pasiyentin ilkin istədiyi vaxt.
  const desiredStart = proposedStart ?? appointment.requestedStartAt;
  const requestedMs = desiredStart ? new Date(desiredStart).getTime() : null;
  const chosenSlots = pickedSlots.length > 0
    ? pickedSlots.map(st => {
        const slot = slots.find(x => x.startAt === st);
        // Tam aralığı göstər (başlama – bitmə) ki, operator seansın neçə dəqiqə
        // olduğunu birbaşa görsün — məs. 90 dəq seans üçün "10:00 – 11:30".
        return { key: st, label: slot ? `${azFormatDate(slot.startAt)}, ${azFormatTime(slot.startAt)} – ${azFormatTime(slot.endAt)}` : st, onRemove: () => toggleSlot(st) };
      })
    : (manualStart && manualEnd
        ? [{ key: "manual", label: `${azFormatDate(azLocalToISO(manualStart))}, ${azFormatTime(azLocalToISO(manualStart))} – ${azFormatTime(azLocalToISO(manualEnd))}`, onRemove: () => { setManualStart(""); setManualEnd(""); } }]
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

  const modalPrimary: React.CSSProperties = { width: "100%" };

  // ── Özət görünüşü ───────────────────────────────────────────────────────────
  // Psixoloq və vaxt məlum olan kimi operator oxunaqlı özət görür — həm artıq
  // təyin edilmiş randevuda, həm də hələ təsdiqlənməmiş seçimdə. Forma yalnız
  // «Dəyiş» ilə açılır, belə olanda təsadüfən vaxt/psixoloq dəyişmir.
  const assigned = !!appointment.psychologistId && !!appointment.startAt && !!appointment.endAt;
  if ((assigned || ready) && !editing) {
    // Göstəriləcək vaxt: formada seçilmiş slot/manual vaxt üstündür (operator
    // onu indi seçib), yoxsa bazadakı təyin edilmiş vaxt.
    let effStart: string | null = null;
    let effEnd: string | null = null;
    if (pickedSlots.length === 1) {
      const s = slots.find(x => x.startAt === pickedSlots[0]);
      if (s) { effStart = s.startAt; effEnd = s.endAt; }
    } else if (pickedSlots.length === 0 && manualStart && manualEnd) {
      effStart = azLocalToISO(manualStart);
      effEnd = azLocalToISO(manualEnd);
    }
    if (!effStart && appointment.startAt && appointment.endAt) {
      effStart = appointment.startAt;
      effEnd = appointment.endAt;
    }
    const durationMin = effStart && effEnd
      ? Math.round((new Date(effEnd).getTime() - new Date(effStart).getTime()) / 60_000)
      : null;
    // Hələ yadda saxlanmamış seçimdə məbləğ formadakı dəyərdir.
    const amount = appointment.paymentAmount
      ?? (singlePrice.trim() ? Number(singlePrice) : null)
      ?? standardPrice;
    const paid = appointment.paymentStatus === "PAID";
    // Statusun rəngi nöqtə ilə verilir — dolu fon/kapsul YOX.
    const statusDot = paid || appointment.status === "COMPLETED" ? "var(--sage)" : "#1051B7";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className={cold ? "opd-card op-det-card--cold" : "opd-card"} style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <span className="opd-card__title">Seans məlumatı</span>
            <button type="button" onClick={() => setEditing(true)} className="fx-btn fx-btn--ghost fx-btn--sm" style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" /><path d="M21 3v5h-5" /></svg>
              Dəyiş
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(158px, 1fr))", gap: 16 }}>
            <SummaryCell label="Psixoloq">
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {selectedPsy?.photoUrl ? (
                  <img src={selectedPsy.photoUrl} alt="" width={38} height={38}
                    style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flex: "none" }} />
                ) : (
                  <span style={{
                    width: 38, height: 38, borderRadius: "50%", flex: "none", background: "var(--brand-50, #EEF4FE)",
                    color: "var(--brand)", fontWeight: 700, fontSize: 15,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{(psychName || "?").charAt(0)}</span>
                )}
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--oxford)", overflow: "hidden", textOverflow: "ellipsis" }}>{psychName}</span>
                  <span className="fx-muted" style={{ display: "block", fontSize: 12, marginTop: 1 }}>{selectedPsy?.title ?? "Psixoloq"}</span>
                </span>
              </div>
            </SummaryCell>

            <SummaryCell label="Tarix və vaxt">
              {effStart && effEnd ? (
                <>
                  <span className="fx-num" style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
                    {azFormatDate(effStart)}
                  </span>
                  <span className="fx-num" style={{ display: "block", fontSize: 13.5, color: "var(--oxford)", marginTop: 2 }}>
                    {azFormatTime(effStart)} – {azFormatTime(effEnd)}
                  </span>
                  {durationMin != null && (
                    <span className="fx-muted" style={{ display: "block", fontSize: 12, marginTop: 3 }}>{durationMin} dəqiqə</span>
                  )}
                </>
              ) : (
                /* Paket: bir neçə vaxt seçilib — tək tarix göstərmək yanlış olardı. */
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{timeSummary}</span>
              )}
            </SummaryCell>

            <SummaryCell label={allowance?.packageName ? "Paket məbləği" : "Seans məbləği"}>
              {allowance?.packageName ? (
                /* Paket seansı — tək seansın "standart qiyməti" yanıldıcıdır; paketin
                   ÜMUMİ ödənilmiş məbləği göstərilir (ödəniş paketlə birlikdə alınıb). */
                <>
                  <span className="fx-num" style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
                    {allowance.packagePrice != null ? `${allowance.packagePrice} ₼` : "—"}
                  </span>
                  <span className="fx-muted" style={{ display: "block", fontSize: 12, marginTop: 3 }}>
                    Paketin ümumi məbləği
                  </span>
                </>
              ) : amount != null ? (
                <>
                  <span className="fx-num" style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{amount} ₼</span>
                  <span className="fx-muted" style={{ display: "block", fontSize: 12, marginTop: 3 }}>
                    {standardPrice != null && Number(amount) === standardPrice ? "Standart qiymət" : "Dəqiqləşdirilmiş məbləğ"}
                  </span>
                </>
              ) : (
                <span className="fx-muted" style={{ fontSize: 13 }}>Təyin edilməyib</span>
              )}
            </SummaryCell>

            <SummaryCell label="Status">
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: statusDot, flex: "none" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{statusLabel(appointment.status)}</span>
              </span>
              <span className="fx-muted" style={{ display: "block", fontSize: 12, marginTop: 3 }}>
                {!assigned ? "Təyinat təsdiqi gözləyir"
                  : allowance?.packageName ? "Paket seansı"
                  : paid ? "Ödəniş təsdiqlənib" : "Ödəniş gözləyir"}
              </span>
            </SummaryCell>
          </div>

          {/* Təsdiq zolağı — əsas əməliyyat məhz təsdiqlədiyi məlumatın altındadır.
              Solda nəyin baş verəcəyi yazılır ki, düymə "boşluqda" qalmasın. */}
          {!assigned && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12, flexWrap: "wrap",
              marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--hairline)",
            }}>
              <span className="fx-muted" style={{ fontSize: 12.5, minWidth: 0 }}>
                Təsdiqlədikdə seans bu psixoloq və vaxtla yaradılır, tərəflərə bildiriş gedir.
              </span>
              <button type="button" onClick={() => guardAction(() => doSubmit())} disabled={saving || cold}
                className="fx-btn fx-btn--primary" style={{ flex: "none" }}>
                {saving ? "Təyin edilir…" : "Təyin et"}
              </button>
            </div>
          )}
        </div>

      </div>
    );
  }

  return (
    <div className={cold ? "opd-card op-det-card--cold" : "opd-card"} style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
        <span className="opd-card__title">
          {(appointment.status === "CONFIRMED" || appointment.status === "ASSIGNED") ? "Təyin / yenidən planla" : t("staff.opDetAssignBlock")}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Hazırlıq göstəricisi kapsul deyil — rəngli nöqtə + mətn. */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: ready ? "var(--sage)" : "var(--oxford-60)" }}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: ready ? "var(--sage)" : "var(--oxford-40, #9AA8BC)", flex: "none" }} />
            {ready ? "Təyinata hazır" : "Tamamlanmamış"}
          </span>
          {assigned && (
            <button type="button" onClick={() => setEditing(false)} className="fx-btn fx-btn--ghost fx-btn--sm" style={{ flex: "none" }}>
              Ləğv et
            </button>
          )}
        </span>
      </div>

      {/* Pasiyentin ilkin istəyi — təyinat seçimləri üçün istinad. */}
      {!ready && appointment.requestedStartAt && (
        <div className="fx-info" style={{ marginBottom: 12, fontWeight: 600 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" /></svg>
          {/* Psixoloq seçimi Fanusa həvalə edilibsə "—" yazmaq mənasızdır —
              operatora əslində nə tələb olunduğu deyilir. */}
          {appointment.requestedPsychologistName ?? appointment.psychologistName
            ? `Pasiyentin istəyi: ${appointment.requestedPsychologistName ?? appointment.psychologistName}, ${fmtDateTime(appointment.requestedStartAt)}`
            : `Psixoloq seçimi Fanusa həvalə edilib. İstənilən vaxt: ${fmtDateTime(appointment.requestedStartAt)}`}
        </div>
      )}

      {/* özət sətirlər — psixoloq + vaxt seçimi */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 13 }}>
        <div className="opd-row">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "var(--oxford-60)" }}>Psixoloq</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: psyId ? "var(--oxford)" : "var(--oxford-60)" }}>{psychName}</span>
              {psychScore && <span className="fx-num" style={{ fontSize: 12, fontWeight: 600, color: "var(--sage)" }}>{psychScore}</span>}
            </div>
          </div>
          <button ref={selectRef} type="button" onClick={() => setPsychModalOpen(true)} className="fx-btn fx-btn--ghost fx-btn--sm">
            {psyId ? "Dəyiş" : "Seç"}
          </button>
        </div>
        <div className="opd-row">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "var(--oxford-60)" }}>Vaxt</div>
            <div className={timeN ? "fx-num" : undefined} style={{ fontSize: 14, fontWeight: 700, color: timeN ? "var(--oxford)" : "var(--oxford-60)", marginTop: 2 }}>{timeSummary}</div>
          </div>
          {/* Əvvəl psixoloq seçilməyibsə bu düymə səssizcə PSİXOLOQ modalını
              açırdı — operator vaxtı dəyişə bilmirdi. Vaxt psixoloqdan asılı
              deyil (açıq slotlar asılıdır, əl ilə yazmaq yox), ona görə modal
              həmişə açılır və içəridə vəziyyət izah olunur. */}
          <button type="button" onClick={() => setTimeModalOpen(true)} className="fx-btn fx-btn--ghost fx-btn--sm">
            {timeN ? "Dəyiş" : "Seç"}
          </button>
        </div>
      </div>

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


      {!allowance?.packageName && priceLocked && (
        <div className="fx-field" style={{ marginBottom: 15 }}>
          <span className="fx-label">Seans məbləği (₼)</span>
          <div className="fx-num" style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
            {appointment.paymentAmount} ₼
          </div>
          <span className="fx-help">Məbləğ təyin olunub və yenidən təyin edilə bilməz — yenidən təyinatda dəyişməz qalır.</span>
        </div>
      )}

      {/* Məbləğ psixoloqun standart qiymətindən avtomatik dolur və NORMALDA
          bağlıdır — operator öz istəyi ilə artırıb-azalda bilməsin. Dəyişmək
          üçün açıq şəkildə «Dəyiş»ə basmalı və əsasını yazmalıdır; əsas operator
          qeydinə düşür ki, sonradan izlənə bilsin. */}
      {!allowance?.packageName && !priceLocked && standardPrice != null && !priceEditing && (
        <div className="fx-field" style={{ marginBottom: 15 }}>
          <span className="fx-label">Seans məbləği (₼)</span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span className="fx-num" style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
              {singlePrice || standardPrice} ₼
            </span>
            <button type="button" onClick={() => setPriceEditing(true)} className="fx-btn fx-btn--ghost fx-btn--sm" style={{ flex: "none" }}>
              Dəyiş
            </button>
          </div>
          <span className="fx-help">
            {Number(singlePrice) === standardPrice
              ? "Psixoloqun standart tək seans qiyməti avtomatik tətbiq olundu."
              : `Standart qiymət ${standardPrice} ₼ — dəqiqləşdirilmiş məbləğ tətbiq olunur.`}
          </span>
        </div>
      )}

      {!allowance?.packageName && !priceLocked && (standardPrice == null || priceEditing) && (
        <div className="fx-field" style={{ marginBottom: 15 }}>
          <span className="fx-label">Seans məbləği (₼)</span>
          <input
            className="fx-input fx-num"
            type="number"
            min={0}
            step="0.01"
            value={singlePrice}
            onChange={e => setSinglePrice(e.target.value)}
            placeholder={standardPrice != null ? String(standardPrice) : "məs. 80"}
          />
          {standardPrice != null && Number(singlePrice) !== standardPrice ? (
            <>
              <input
                className="fx-input"
                style={{ marginTop: 8 }}
                value={priceReason}
                onChange={e => setPriceReason(e.target.value)}
                placeholder="Məbləğ niyə dəyişdirilir? (psixoloqla dəqiqləşdirmə, endirim və s.)"
              />
              <span className="fx-help">
                Standart qiymət {standardPrice} ₼. Fərqli məbləğ yalnız dəqiqləşdirmədən sonra tətbiq olunur — əsas operator qeydinə yazılır.
              </span>
            </>
          ) : (
            <span className="fx-help">Boş qalarsa ödəniş yaranmır — psixoloqun standart tək seans qiyməti tətbiq olunur. PENDING ödəniş «Ödənişlər → Gözləyir»də görünür.</span>
          )}
          {standardPrice != null && (
            <button
              type="button"
              onClick={() => { setSinglePrice(String(standardPrice)); setPriceReason(""); setPriceEditing(false); }}
              className="fx-btn fx-btn--ghost fx-btn--sm"
              style={{ marginTop: 8, alignSelf: "flex-start" }}
            >
              Standart qiymətə qaytar
            </button>
          )}
        </div>
      )}

      {/* İş-qrafiki xəbərdarlığı — bloklamır. Operator psixoloqla əlaqə saxlayıb
          "Yenə də təyin et" ilə qrafikdən kənar vaxtı təsdiqləyə bilər. */}
      {scheduleWarn && (
        <div className="fx-alert" style={{ alignItems: "flex-start", marginBottom: 12 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
          <div style={{ minWidth: 0 }}>
            <div className="fx-alert__title">{scheduleWarn}</div>
            <div className="fx-alert__text" style={{ marginTop: 3 }}>
              Psixoloqla əlaqə saxlayıb «Yenə də təyin et» ilə qrafikdən kənar vaxtı təsdiqləyə bilərsiniz.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 14, marginTop: 4, paddingTop: 14, borderTop: "1px solid var(--hairline)" }}>
        <button onClick={() => guardAction(() => doSubmit(!!scheduleWarn))} disabled={saving || !ready}
          className={`fx-btn ${scheduleWarn ? "fx-btn--warn-ghost" : "fx-btn--primary"}`}
          style={{ opacity: (saving || !ready) ? 0.55 : 1, cursor: (saving || !ready) ? "not-allowed" : "pointer" }}>
          {saving ? "Saxlanılır…"
            : scheduleWarn ? "Yenə də təyin et"
            : pickedSlots.length > 1 ? `${pickedSlots.length} seans təyin et`
            : appointment.status === "ASSIGNED" ? "Yenidən təyin et" : "Təyin et"}
        </button>
      </div>

      {/* PSİXOLOQ MODALI */}
      {psychModalOpen && (
        <ModalShell title="Psixoloq seç" sub="Tövsiyədən seçin və ya siyahıdan tapın." onClose={() => setPsychModalOpen(false)}
          footer={<button onClick={() => setPsychModalOpen(false)} className="fx-btn fx-btn--primary" style={modalPrimary}>{psyId ? "Hazırdır" : "Bağla"}</button>}>
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
                        <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, marginTop: 1 }}>{s.reasons.join(", ")}</div>
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
              {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}, {p.title}</option>)}
            </select>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--oxford-60)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="M6 9l6 6 6-6" /></svg>
          </div>
        </ModalShell>
      )}

      {/* VAXT MODALI */}
      {timeModalOpen && (
        <ModalShell title="Vaxt seç" sub="Açıq slotlardan seçin və ya əl ilə daxil edin." maxWidth={500} onClose={() => setTimeModalOpen(false)}
          footer={<button onClick={() => setTimeModalOpen(false)} className="fx-btn fx-btn--primary" style={modalPrimary}>{slotComplete ? "Hazırdır" : "Bağla"}</button>}>
          <>
            {/* Psixoloq seçilməyibsə yalnız AÇIQ SLOTLAR göstərilə bilmir —
                vaxtın özü əl ilə yazıla bilər. Əvvəl bu hal bütün modalı
                bloklayırdı və operator müştərinin vaxtını dəyişə bilmirdi. */}
            {!psyId && (
              <div className="fx-banner fx-banner--warn" style={{ marginBottom: 12 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
                <span>Psixoloq hələ seçilməyib, ona görə açıq slotlar göstərilmir. Vaxtı əl ilə yaza, psixoloqu sonra seçə bilərsiniz.</span>
              </div>
            )}
            {psyId && (
              <>
              {desiredStart && (
                <div className="fx-info" style={{ marginBottom: 11 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  <span style={{ fontWeight: 600 }}>
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
                    {/* remainingSessions = planlaşdırılmamış rezerv balansı, "keçirilməmiş seans" deyil. */}
                    <span className="fx-num">Paket: {allowance.packageName}. {allowance.remainingSessions} seans planlaşdırılmayıb, {maxSlots} vaxta qədər seçə bilərsiniz</span>
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

              <div className="fx-section-label" style={{ marginBottom: 11 }}>Açıq vaxtlar</div>
              {loadingSlots ? (
                <div style={{ fontSize: 12, color: "var(--oxford-60)", marginBottom: 12 }}>Yüklənir…</div>
              ) : groupedSlots.length === 0 ? (
                <div className="fx-banner fx-banner--warn" style={{ marginBottom: 12 }}>
                  Açıq slot yoxdur. Aşağıda əl ilə vaxt yazın.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 13, marginBottom: 13 }}>
                  {groupedSlots.map(([day, daySlots]) => (
                    <div key={day}>
                      <div className="fx-section-label" style={{ marginBottom: 8 }}>{day}</div>
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
                                border: active ? "1.5px solid var(--brand)" : disabled ? "1.5px solid var(--hairline)" : isRequested ? "1.5px solid var(--sage)" : "1.5px solid var(--brand-200)",
                                background: active ? "var(--brand-100)" : disabled ? "var(--status-cancelled-bg)" : isRequested ? "var(--sage-bg)" : "var(--surface)",
                                color: active ? "var(--brand-700)" : disabled ? "var(--oxford-20)" : isRequested ? "var(--sage)" : "var(--oxford)" }}>
                              <span className="fx-num">{azFormatTime(s.startAt)} – {azFormatTime(s.endAt)}</span>
                              {maxSlots > 1 && active && (
                                <span style={{ position: "absolute", top: -7, right: -7, width: 18, height: 18, background: "var(--brand)", color: "#fff", border: "2px solid #fff", borderRadius: "50%", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{order}</span>
                              )}
                              {isRequested && !active && (
                                <span style={{ position: "absolute", top: -5, right: -5, width: 9, height: 9, background: "var(--sage)", border: "2px solid var(--surface)", borderRadius: "50%" }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </>
            )}

              <button type="button" onClick={() => setManualOpen(o => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", fontSize: 12.5, fontWeight: 600, color: "var(--brand)", cursor: "pointer", fontFamily: "inherit", padding: "2px 0", marginBottom: 6 }}>
                Əl ilə vaxt daxil et
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: (manualOpen || !!manualStart) ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><path d="M6 9l6 6 6-6" /></svg>
              </button>
              {(manualOpen || !!manualStart) && (
                <div style={{ background: "var(--surface-muted)", border: "1px solid var(--hairline)", borderRadius: 11, padding: 13, marginBottom: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                    <label style={{ display: "block" }}>
                      <span className="fx-label" style={{ display: "block", marginBottom: 5 }}>Başlama vaxtı</span>
                      {/* Vaxt dəyişdi → köhnə qrafik xəbərdarlığı keçərsizdir (toggleSlot /
                          selectPsy ilə eyni davranış). Əks halda düymə "Yenə də təyin et"
                          qalıb artıq düzəldilmiş vaxtı da məcburi göndərirdi. */}
                      <DatePicker withTime theme="light" size="sm" value={manualStart} onChange={v => { setManualStart(v); setPickedSlots([]); setScheduleWarn(null); }} style={{ width: "100%" }} />
                    </label>
                    <label style={{ display: "block" }}>
                      <span className="fx-label" style={{ display: "block", marginBottom: 5 }}>Bitmə vaxtı</span>
                      <DatePicker withTime theme="light" size="sm" value={manualEnd} onChange={v => { setManualEnd(v); setPickedSlots([]); setScheduleWarn(null); }} style={{ width: "100%" }} />
                    </label>
                  </div>
                </div>
              )}

              {chosenSlots.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, background: "var(--surface-muted)", border: "1px dashed var(--brand-200)", borderRadius: 10, padding: "11px 13px" }}>
                  Vaxt seçilməyib — yuxarıdan slot seçin və ya əl ilə tarix daxil edin.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {chosenSlots.map((c, i) => (
                    <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--brand-100)", border: "1px solid var(--brand-200)", borderRadius: 10, padding: "9px 12px" }}>
                      <span className="fx-num" style={{ width: 22, height: 22, borderRadius: 6, background: "var(--brand)", color: "#fff", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{i + 1}</span>
                      <span className="fx-num" style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: "var(--brand-700)" }}>{c.label}</span>
                      <button type="button" onClick={c.onRemove} title="Sil" aria-label="Sil" style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", color: "var(--rose)", border: "1px solid rgba(201,125,125,.4)", borderRadius: 8, cursor: "pointer", flex: "none" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
          </>
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

  const doSubmit = async () => {
    setSaving(true);
    try {
      const blame = decision === "CANCEL" && blameSide !== "NONE" ? blameSide : undefined;
      const updated = await operatorApi.resolveDispute(appointment.id, decision, note.trim() || undefined, blame);
      onDone(updated);
    } catch (e) { globalToast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fx-field" style={{ marginBottom: 12 }}>
        <span className="fx-label">Nəticə</span>
        <div className="fx-segmented" style={{ display: "flex", width: "100%" }}>
          <button type="button" onClick={() => setDecision("COMPLETE")} style={{ flex: 1 }}
            className={decision === "COMPLETE" ? "fx-seg--active" : undefined}>Tamamlanmış say</button>
          <button type="button" onClick={() => setDecision("CANCEL")} style={{ flex: 1 }}
            className={decision === "CANCEL" ? "fx-seg--active" : undefined}>Ləğv et</button>
        </div>
        <span className="fx-help">{decision === "COMPLETE" ? "Seans baş tutdu." : "Seans baş tutmadı."}</span>
      </div>

      {decision === "CANCEL" && (
        <div className="fx-field" style={{ marginBottom: 12 }}>
          <span className="fx-label">Kim «no-show» sayğacına işlənsin?</span>
          <div className="fx-segmented" style={{ display: "flex", width: "100%" }}>
            {([
              { v: "NONE", label: "Heç kim" },
              { v: "PATIENT", label: "Pasient" },
              { v: "PSYCHOLOGIST", label: "Psixoloq" },
            ] as const).map(o => (
              <button key={o.v} type="button" onClick={() => setBlameSide(o.v)} style={{ flex: 1 }}
                className={blameSide === o.v ? "fx-seg--active" : undefined}>
                {o.label}
              </button>
            ))}
          </div>
          <span className="fx-help">«Heç kim» = texniki səbəb; digərləri seçilən tərəfin no-show sayğacını artırır.</span>
        </div>
      )}

      <label className="fx-field" style={{ marginBottom: 14 }}>
        <span className="fx-label">Operator qeydi (məcburi deyil)</span>
        <textarea className="fx-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Qısa izah…" />
      </label>

      <div className="fx-modal__actions" style={{ marginTop: 0 }}>
        <button onClick={() => guardAction(doSubmit)} disabled={saving}
          className={`fx-btn ${decision === "COMPLETE" ? "fx-btn--primary" : "fx-btn--danger"}`}
          style={{ opacity: saving ? 0.7 : 1, cursor: saving ? "wait" : "pointer" }}>
          {saving ? "Göndərilir…" : decision === "COMPLETE" ? "Tamamlanmış say" : "Ləğv et"}
        </button>
      </div>
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

  const doSubmit = async () => {
    setSaving(true);
    try {
      const updated = await operatorApi.markNoShow(appointment.id, blameSide, note.trim() || undefined);
      onDone(updated);
    } catch (e) { globalToast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <p className="fx-modal__text" style={{ margin: "0 0 12px" }}>
        Seans avtomatik tamamlandı, amma əslində baş tutmayıbsa, buradan no-show kimi işarələyin —
        seçilən tərəfin no-show sayğacı artacaq.
      </p>
      <div className="fx-field" style={{ marginBottom: 12 }}>
        <span className="fx-label">Kim gəlmədi?</span>
        <div className="fx-segmented" style={{ display: "flex", width: "100%" }}>
          {([
            { v: "PATIENT", label: "Pasient" },
            { v: "PSYCHOLOGIST", label: "Psixoloq" },
          ] as const).map(o => (
            <button key={o.v} type="button" onClick={() => setBlameSide(o.v)} style={{ flex: 1 }}
              className={blameSide === o.v ? "fx-seg--active" : undefined}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <label className="fx-field" style={{ marginBottom: 14 }}>
        <span className="fx-label">Qeyd (məcburi deyil)</span>
        <textarea className="fx-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Qısa izah…" />
      </label>
      <div className="fx-modal__actions" style={{ marginTop: 0 }}>
        <button onClick={() => guardAction(doSubmit)} disabled={saving}
          className="fx-btn fx-btn--danger" style={{ cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Göndərilir…" : "No-show işarələ"}
        </button>
      </div>
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

  const run = (approved: boolean) => async () => {
    setSaving(true);
    try {
      const updated = approved
        ? await operatorApi.approveCancelRequest(appointment.id, note.trim() || undefined)
        : await operatorApi.rejectCancelRequest(appointment.id, note.trim() || undefined);
      onDone(updated, approved);
    } catch (e) { globalToast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <label className="fx-field" style={{ marginBottom: 14 }}>
        <span className="fx-label">Pasiyentə qeyd</span>
        <textarea className="fx-textarea" rows={3} value={note} onChange={e => setNote(e.target.value)}
          placeholder="Təsdiqdə məcburi deyil, rəddə tövsiyə olunur" />
      </label>
      <div className="fx-modal__actions" style={{ marginTop: 0 }}>
        <button onClick={() => guardAction(run(false))} disabled={saving}
          className="fx-btn fx-btn--ghost" style={{ cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          Tələbi rədd et
        </button>
        <button onClick={() => guardAction(run(true))} disabled={saving}
          className="fx-btn fx-btn--danger" style={{ cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          Ləğvi təsdiqlə
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

  const doSubmit = async () => {
    setSaving(true);
    try {
      const updated = await operatorApi.cancel(appointment.id, reasonCode, note.trim() || undefined);
      onDone(updated);
    } catch (e) { globalToast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <label className="fx-field" style={{ marginBottom: 12 }}>
        <span className="fx-label">Səbəb</span>
        <select className="fx-select" value={reasonCode} onChange={e => setReasonCode(e.target.value)}>
          {reasons.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
      </label>
      <label className="fx-field" style={{ marginBottom: 14 }}>
        <span className="fx-label">Qeyd (məcburi deyil)</span>
        <textarea className="fx-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Qısa izah…" />
      </label>
      <div className="fx-modal__actions" style={{ marginTop: 0 }}>
        <button onClick={onClose} className="fx-btn fx-btn--ghost">Bağla</button>
        <button onClick={() => guardAction(doSubmit)} disabled={saving}
          className="fx-btn fx-btn--danger" style={{ cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
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

  const submit = async () => {
    const v = url.trim();
    if (!v) { globalToast("Görüş linki daxil edin", "error"); return; }
    setSaving(true);
    try { await operatorApi.setMeetingLink(appointment.id, v); onSaved(); }
    catch (e) { globalToast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title={appointment.meetingLink ? "Görüş linkini dəyiş" : "Görüş linki əlavə et"} onClose={onClose}
      footer={
        <div className="fx-modal__actions" style={{ marginTop: 0 }}>
          <button onClick={onClose} className="fx-btn fx-btn--ghost">İmtina</button>
          <button onClick={submit} disabled={saving} className="fx-btn fx-btn--primary" style={{ opacity: saving ? 0.7 : 1 }}>
            {saving ? "…" : "Yadda saxla"}
          </button>
        </div>
      }>
      <label className="fx-field">
        <span className="fx-label">Görüş linki</span>
        <input className="fx-input" type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://meet.google.com/..." autoFocus />
      </label>
    </ModalShell>
  );
}

/* ─── Ödəniş modalı (məbləği təyin et) ─────────────────────────────────────── */

function PaymentEditModal({ appointment, onClose, onSaved }: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Mövcud məbləğ varsa sahə onunla açılır (redaktə halı), yoxsa psixoloqun
  // standart qiyməti ilə dolur.
  const existingAmount = appointment.paymentAmount != null && appointment.paymentAmount > 0
    ? String(appointment.paymentAmount) : "";
  const [amount, setAmount] = useState(existingAmount);
  const [saving, setSaving] = useState(false);
  /** Təyin edilmiş psixoloqun standart tək seans qiyməti — sahənin defaultu. */
  const [standardPrice, setStandardPrice] = useState<number | null>(null);

  // Məbləği operator sıfırdan yazmasın: psixoloqun öz təyin etdiyi qiymət
  // avtomatik dolur. Redaktə açıqdır — operator lazım gələrsə dəyişə bilər.
  useEffect(() => {
    const psyId = appointment.psychologistId ?? appointment.requestedPsychologistId;
    if (psyId == null) return;
    let cancelled = false;
    operatorApi.listPsychologists()
      .then(list => {
        if (cancelled) return;
        const price = list.find(p => p.id === psyId)?.individualPrice ?? null;
        if (price == null) return;
        setStandardPrice(price);
        setAmount(prev => (prev.trim() ? prev : String(price)));
      })
      .catch(() => { /* qiymət gəlmədisə sahə boş qalır — operator əl ilə yazar */ });
    return () => { cancelled = true; };
  }, [appointment.psychologistId, appointment.requestedPsychologistId]);

  const submit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { globalToast("Məbləği düzgün daxil edin", "error"); return; }
    setSaving(true);
    try { await operatorApi.createManualPayment(appointment.id, amt); onSaved(); }
    catch (e) { globalToast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell
      title={existingAmount ? "Seans məbləğini dəyiş" : "Seans məbləğini təyin et"}
      sub={existingAmount
        ? "Ödəniş təsdiqlənənə qədər məbləğ dəyişdirilə bilər."
        : "PENDING ödəniş yaranır və «Ödənişlər»də görünür."}
      onClose={onClose}
      footer={
        <div className="fx-modal__actions" style={{ marginTop: 0 }}>
          <button onClick={onClose} className="fx-btn fx-btn--ghost">İmtina</button>
          <button onClick={submit} disabled={saving} className="fx-btn fx-btn--primary" style={{ opacity: saving ? 0.7 : 1 }}>
            {saving ? "…" : "Yadda saxla"}
          </button>
        </div>
      }>
      <label className="fx-field">
        <span className="fx-label">Seans məbləği (₼)</span>
        <input className="fx-input fx-num" type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder={standardPrice != null ? String(standardPrice) : "məs. 80"} autoFocus />
        {standardPrice != null && (
          <span className="fx-help">
            {Number(amount) === standardPrice
              ? "Psixoloqun təyin etdiyi standart qiymət avtomatik dolduruldu."
              : `Psixoloqun standart qiyməti ${standardPrice} ₼ — fərqli məbləğ yalnız dəqiqləşdirmədən sonra yazılmalıdır.`}
          </span>
        )}
      </label>
    </ModalShell>
  );
}

