"use client";

/**
 * OP-1: Müraciət detal səhifəsi — modal yığını əvəzinə "ticket" iş səhifəsi.
 * 3 zona (kontekst / əməliyyat / fəaliyyət lenti) + sticky header.
 * OP-2: yumşaq kilid (claim) — açılanda avtomatik claim, heartbeat, steal axını.
 */

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ApiError,
  operatorApi,
  operatorClaimReleaseUrl,
  isSlotConflict,
  CANCEL_REASONS,
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
import { toast as globalToast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";
import { subscribeNotifications, subscribeOperatorClaims } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azLocalToISO, isoToAzLocal, azFormatDate, azFormatTime, azFormatDateTime } from "@/lib/datetime";

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
  APPT_CLAIM_STEAL: "Claim təhvili",
};
const DURATION_LABEL: Record<string, string> = {
  LT_1M: "1 aydan az", M_1_3: "1–3 ay", M_3_6: "3–6 ay", GT_6M: "6 aydan çox",
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
  const [stealOpen, setStealOpen] = useState(false);
  const [zone, setZone] = useState<"work" | "context" | "feed">("work"); // <900px tablar
  const pendingActionRef = useRef<(() => void) | null>(null);
  const assignFocusRef = useRef<HTMLSelectElement | null>(null);
  const composerFocusRef = useRef<HTMLTextAreaElement | null>(null);
  const claimMineRef = useRef(false);

  const a = full?.appointment ?? null;
  const claimedByOther = !!claim?.claimedByUserId && !claim.mine;
  useEffect(() => { claimMineRef.current = !!claim?.mine; }, [claim?.mine]);

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

  // ── OP-2: avtomatik claim cəhdi + heartbeat + tab bağlananda release ──────
  useEffect(() => {
    if (!full || notFound) return;
    let stopped = false;
    operatorApi.claim(id).then(c => { if (!stopped) setClaim(c); }).catch(() => {});

    const hb = setInterval(() => {
      if (!claimMineRef.current) return;
      operatorApi.claimHeartbeat(id).then(c => {
        if (stopped) return;
        setClaim(prev => {
          if (prev?.mine && !c.mine && c.claimedByName) {
            setToast(t("staff.opClaimLost", { name: c.claimedByName }));
          }
          return c;
        });
      }).catch(() => {});
    }, 60_000);

    const onPageHide = () => {
      if (claimMineRef.current) {
        try { navigator.sendBeacon(operatorClaimReleaseUrl(id)); } catch { /* ignore */ }
      }
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      stopped = true;
      clearInterval(hb);
      window.removeEventListener("pagehide", onPageHide);
      onPageHide(); // səhifədən çıxanda da release
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!full, notFound]);

  // ── Real-time: claim hadisələri + müraciət dəyişiklikləri ─────────────────
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
          ttlMinutes: prev?.ttlMinutes ?? 15,
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
      const k = e.key.toLowerCase();
      if (k === "j" && nextId) { e.preventDefault(); goTo(nextId); }
      else if (k === "k" && prevId) { e.preventDefault(); goTo(prevId); }
      else if (k === "a") { e.preventDefault(); assignFocusRef.current?.focus(); }
      else if (k === "n") { e.preventDefault(); composerFocusRef.current?.focus(); }
      else if (e.key === "Escape" && !stealOpen) { e.preventDefault(); backToList(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextId, prevId, goTo, backToList, stealOpen]);

  // ── Toast ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const tm = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(tm);
  }, [toast]);

  // ── OP-2: soyuq rejim qoruması — başqasının claim-i varsa təsdiq istə ─────
  const guardAction = useCallback((run: () => void) => {
    if (!claimedByOther) { run(); return; }
    if (isAdmin) {
      // Admin override: təsdiq modalsız (səlahiyyət fərqi), yenə də audit-loqlanır
      operatorApi.claim(id, true).then(c => { setClaim(c); run(); }).catch(() => run());
      return;
    }
    pendingActionRef.current = run;
    setStealOpen(true);
  }, [claimedByOther, isAdmin, id]);

  const confirmSteal = () => {
    setStealOpen(false);
    operatorApi.claim(id, true).then(c => {
      setClaim(c);
      const run = pendingActionRef.current;
      pendingActionRef.current = null;
      run?.();
    }).catch(e => setToast((e as Error).message));
  };

  // ── Yekun əməliyyat: toast + auto-advance ─────────────────────────────────
  const onActionDone = useCallback((updated: AppointmentDetail, msg: string) => {
    setFull(prev => prev ? { ...prev, appointment: updated } : prev);
    setClaim(prev => prev ? { ...prev, claimedByUserId: null, claimedByName: null, claimedAt: null, mine: false } : prev);
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
            style={{ border: "1px solid #E5E7EB", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "#52718F" }}>
            ←
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#52718F" }}>#FNS-{String(id).padStart(4, "0")}</span>
          <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: statusMeta.bg, color: statusMeta.fg }}>
            {statusMeta.label}
          </span>
          {!isFinal && (
            <span title={`SLA: ${full.slaHours} saat`}
              style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: slaBg, color: slaColor }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }}>
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {t("staff.opDetWaiting", { time: ageLabel(a.createdAt, nowMs) })}
            </span>
          )}
          {claim?.claimedByUserId && (
            <span className={claim.mine ? "op-claim-chip op-claim-chip--mine" : "op-claim-chip"}>
              <span className="op-claim-dot" />
              {claim.mine ? t("staff.opClaimMine") : t("staff.opClaimWorking", { name: claim.claimedByName ?? "?" })}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#52718F", cursor: "pointer" }}>
            <input type="checkbox" checked={autoAdvance} onChange={toggleAutoAdvance} style={{ accentColor: "var(--brand)" }} />
            {t("staff.opDetAutoAdvance")}
          </label>
          <button onClick={copyLink}
            style={{ border: "1px solid #E5E7EB", background: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#1A2535" }}>
            {copied ? t("staff.opDetCopied") : t("staff.opDetCopyLink")}
          </button>
          <button onClick={() => prevId && goTo(prevId)} disabled={!prevId} title={t("staff.opDetPrev")}
            style={{ border: "1px solid #E5E7EB", background: "#fff", borderRadius: 8, padding: "6px 12px", cursor: prevId ? "pointer" : "not-allowed", opacity: prevId ? 1 : 0.4, fontSize: 13 }}>
            ←
          </button>
          <span style={{ fontSize: 11, color: "#8AAABF" }}>
            {queuePos >= 0 ? `${queuePos + 1}/${queueIds.length}` : ""}
          </span>
          <button onClick={() => nextId && goTo(nextId)} disabled={!nextId} title={t("staff.opDetNext")}
            style={{ border: "1px solid #E5E7EB", background: "#fff", borderRadius: 8, padding: "6px 12px", cursor: nextId ? "pointer" : "not-allowed", opacity: nextId ? 1 : 0.4, fontSize: 13 }}>
            →
          </button>
          <span title="Klaviatura qısayolları" style={{ fontSize: 10.5, color: "#8AAABF", display: "flex", gap: 6, alignItems: "center", marginLeft: 4 }}>
            <kbd className="op-det-kbd">J</kbd>/<kbd className="op-det-kbd">K</kbd> növbə
            <kbd className="op-det-kbd">A</kbd> təyin
            <kbd className="op-det-kbd">N</kbd> qeyd
            <kbd className="op-det-kbd">Esc</kbd> siyahı
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

          {!isFinal && (
            <LinkBlock
              key={`link-${a.id}`}
              appointment={a}
              cold={claimedByOther}
              guardAction={guardAction}
              onDone={(u, m) => onActionDone(u, m)}
            />
          )}

          {canResolve && (
            <ResolveDisputeBlock appointment={a} cold={claimedByOther} guardAction={guardAction}
              onDone={(u) => onActionDone(u, "Mübahisə həll olundu")} />
          )}

          {isCancelReq && (
            <CancelRequestBlock appointment={a} cold={claimedByOther} guardAction={guardAction}
              onDone={(u, approved) => onActionDone(u, approved ? "Ləğv təsdiqləndi" : "Tələb rədd edildi")} />
          )}

          {canCancel && (
            <CancelBlock appointment={a} cold={claimedByOther} guardAction={guardAction}
              onDone={(u) => onActionDone(u, "Ləğv edildi")} />
          )}

          {canMarkNoShow && (
            <NoShowBlock appointment={a} cold={claimedByOther} guardAction={guardAction}
              onDone={(u) => onActionDone(u, "No-show işarələndi")} />
          )}
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

      {/* ── OP-2: steal təsdiq modalı ──────────────────────────────────────── */}
      {stealOpen && claim?.claimedByName && (
        <div onClick={() => setStealOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,22,51,0.5)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, width: "min(420px, 100%)", padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1A2535" }}>{t("staff.opClaimStealTitle")}</h3>
            <p style={{ fontSize: 13, color: "#52718F", marginTop: 8 }}>
              {t("staff.opClaimStealBody", { name: claim.claimedByName })}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => { setStealOpen(false); pendingActionRef.current = null; }}
                style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer", fontWeight: 600 }}>
                {t("staff.opClaimStealCancel")}
              </button>
              <button onClick={confirmSteal}
                style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "#D97706", color: "#fff", cursor: "pointer" }}>
                {t("staff.opClaimStealConfirm")}
              </button>
            </div>
          </div>
        </div>
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
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1A2535" }}>{a.patientName ?? "—"}</div>
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: a.patientId ? "#D1FAE5" : "#F3F4F6", color: a.patientId ? "#065F46" : "#52718F" }}>
            {a.patientId ? t("staff.opDetRegistered") : t("staff.opDetAnonymous")}
          </span>
          {h?.blocked && (
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#FEE2E2", color: "#991B1B" }}>
              BLOKLU
            </span>
          )}
        </div>
        {phone && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <a href={`tel:${phone}`} className="op-contact-btn op-contact-btn--call">{a.patientPhone}</a>
            <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" className="op-contact-btn op-contact-btn--wa">WhatsApp</a>
          </div>
        )}
        {a.patientEmail && (
          <a href={`mailto:${a.patientEmail}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--brand-700)", marginTop: 6, wordBreak: "break-all" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22,6 12,13 2,6" />
            </svg>
            {a.patientEmail}
          </a>
        )}
        {h?.userId && (
          <button onClick={blockOrUnblock}
            style={{ marginTop: 10, width: "100%", padding: "6px 10px", border: h.blocked ? "1px solid #C7D2FE" : "1px solid #FECACA", background: "#fff", color: h.blocked ? "var(--brand-700)" : "#991B1B", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
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
                <span>#{s.id} · {(s.seriesIndex ?? 0) + 1}-ci seans</span>
                <span style={{ color: "#8AAABF" }}>{s.startAt ? azFormatDate(s.startAt) : "—"} · {STATUS_TONE[s.status]?.label ?? s.status}</span>
              </Link>
            ))}
          </div>

          {/* Seriyanı bütöv idarə (operator) */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #EFF2F7", display: "grid", gap: 8 }}>
            {seriesRescheduleOpen ? (
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F" }}>Növbəti seansın yeni başlanğıcı (qalanlar eyni qədər sürüşəcək)</label>
                <input type="datetime-local" step={60} value={seriesStart} onChange={e => setSeriesStart(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }} />
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
    <div style={{ background: warn ? "#FEF2F2" : "#F8FAFC", border: warn ? "1px solid #FECACA" : "1px solid #EFF2F7", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "#52718F", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: warn ? "#DC2626" : "#1A2535" }}>{value}</div>
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
        <div style={{ fontSize: 14, color: "#1A2535", lineHeight: 1.55, background: "#F8FAFC", borderRadius: 10, padding: "10px 14px" }}>
          «{a.note}»
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#8AAABF" }}>Problem təsviri yazılmayıb</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, fontSize: 12.5 }}>
        <div>
          <div style={{ color: "#52718F", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{t("staff.opDetRequestedTime")}</div>
          <div style={{ color: "#1A2535", fontWeight: 600, marginTop: 2 }}>{fmtDateTime(a.requestedStartAt)}</div>
        </div>
        <div>
          <div style={{ color: "#52718F", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{t("staff.opDetRequestedPsy")}</div>
          <div style={{ color: "#1A2535", fontWeight: 600, marginTop: 2 }}>
            {a.psychologistName ?? a.requestedPsychologistName ?? "Seçilməyib"}
          </div>
        </div>
        {a.startAt && (
          <div>
            <div style={{ color: "#52718F", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Təyin edilmiş vaxt</div>
            <div style={{ color: "#1A2535", fontWeight: 600, marginTop: 2 }}>{fmtDateTime(a.startAt)}</div>
          </div>
        )}
        <div>
          <div style={{ color: "#52718F", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Yaradılıb</div>
          <div style={{ color: "#1A2535", fontWeight: 600, marginTop: 2 }}>{fmtDateTime(a.createdAt)}</div>
        </div>
      </div>

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
          {a.cancelRequestReasonCode && <> · kod: <code>{a.cancelRequestReasonCode}</code></>}
          {a.cancelRequestReasonText && <div style={{ marginTop: 4, fontStyle: "italic" }}>«{a.cancelRequestReasonText}»</div>}
        </div>
      )}

      {/* Intake cavabları (V36) */}
      {full.intake?.submittedAt && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-700)", cursor: "pointer" }}>
            Intake anketi ({azFormatDate(full.intake.submittedAt)})
          </summary>
          <div style={{ display: "grid", gap: 8, marginTop: 8, fontSize: 12.5 }}>
            {([
              ["Əsas narahatlıq", full.intake.mainConcern],
              ["Gözləntilər", full.intake.expectations],
              ["Simptomlar", full.intake.symptoms],
              ["Müddət", full.intake.duration ? DURATION_LABEL[full.intake.duration] : null],
              ["Əvvəlki terapiya", full.intake.priorTherapy ? (full.intake.priorTherapyDetails || "Bəli") : "Xeyr"],
              ["Dərmanlar", full.intake.medications],
              ["Tibbi vəziyyət", full.intake.medicalConditions],
              ["Təcili əlaqə", full.intake.emergencyContact],
            ] as const).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <div style={{ color: "#52718F", fontWeight: 600, fontSize: 11 }}>{k}</div>
                <div style={{ color: "#1A2535" }}>{v}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/* ─── Mərkəz: təyinat bloku (köhnə AssignModal-ın səhifə bloku) ────────────── */

function AssignBlock({ appointment, suggestions, cold, guardAction, selectRef, onAssigned }: {
  appointment: AppointmentDetail;
  suggestions: OperatorAppointmentFull["suggestions"];
  cold: boolean;
  guardAction: (run: () => void) => void;
  selectRef: React.RefObject<HTMLSelectElement | null>;
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
  const [note, setNote] = useState(appointment.operatorNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  // Müştərinin istədiyi vaxtı avtomatik seç (slot varsa slotu, yoxdursa manual)
  useEffect(() => {
    const requested = appointment.requestedStartAt;
    if (!requested || !psyId || loadingSlots) return;
    if (pickedSlots.length > 0 || manualStart) return;
    const reqMs = new Date(requested).getTime();
    const match = slots.find(s => new Date(s.startAt).getTime() === reqMs);
    if (match) { setPickedSlots([match.startAt]); return; }
    const psy = psychologists.find(p => p.id === psyId);
    const minutes = psy?.defaultSessionMinutes && psy.defaultSessionMinutes > 0 ? psy.defaultSessionMinutes : 50;
    setManualStart(isoToAzLocal(requested));
    setManualEnd(isoToAzLocal(new Date(reqMs + minutes * 60_000).toISOString()));
  }, [slots, loadingSlots, psyId, psychologists, appointment.requestedStartAt, pickedSlots.length, manualStart]);

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

  return (
    <div className={cold ? "op-det-card op-det-card--cold" : "op-det-card"}>
      <div className="op-det-card__title">{(appointment.status === "CONFIRMED" || appointment.status === "ASSIGNED") ? "Yenidən planla / psixoloqu dəyiş" : t("staff.opDetAssignBlock")} <kbd className="op-det-kbd">A</kbd></div>

      {suggestions.length > 0 && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#065F46", marginBottom: 6 }}>
            {t("staff.opDetSuggestions")}
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            {suggestions.slice(0, 3).map(s => (
              <button key={s.psychologistId} type="button"
                onClick={() => { setPsyId(s.psychologistId); setPickedSlots([]); setManualStart(""); setManualEnd(""); }}
                style={{
                  textAlign: "left", padding: "7px 10px", borderRadius: 8,
                  border: psyId === s.psychologistId ? "2px solid #10B981" : "1px solid #BBF7D0",
                  background: psyId === s.psychologistId ? "#fff" : "#FAFEFC", cursor: "pointer",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1A2535" }}>{s.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#065F46" }}>skor {s.score}</span>
                </div>
                <div style={{ fontSize: 11, color: "#52718F", marginTop: 2 }}>{s.reasons.join(" · ")}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Psixoloq</label>
      <select ref={selectRef} value={psyId ?? ""} onChange={e => { setPsyId(Number(e.target.value) || null); setPickedSlots([]); setManualStart(""); setManualEnd(""); }}
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 12 }}>
        <option value="">— Seç —</option>
        {psychologists.map(p => <option key={p.id} value={p.id}>{p.name} · {p.title}</option>)}
      </select>

      {appointment.requestedStartAt && (
        <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "var(--brand-700)", marginBottom: 10 }}>
          <strong>İstənilən vaxt:</strong> {fmtDateTime(appointment.requestedStartAt)} — uyğun slot avtomatik seçilir.
        </div>
      )}

      {psyId && allowance && (
        allowance.packageName ? (
          <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#065F46", marginBottom: 10 }}>
            <strong>Paket: {allowance.packageName}</strong> · {allowance.remainingSessions} seans qalıb — {maxSlots} vaxta qədər seçə bilərsiniz
            {pickedSlots.length > 0 && ` (${pickedSlots.length} seçilib)`}
          </div>
        ) : (
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#92400E", marginBottom: 10 }}>
            Paket yoxdur — yalnız <strong>1 vaxt</strong> seçilə bilər. Çoxlu seans üçün pasiyent paket almalıdır.
          </div>
        )
      )}

      {psyId && (
        <>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Açıq vaxtlar</label>
          {loadingSlots ? (
            <div style={{ fontSize: 12, color: "#52718F", marginBottom: 12 }}>Yüklənir…</div>
          ) : groupedSlots.length === 0 ? (
            <div style={{ background: "#FFFBEB", border: "1px solid #FEF3C7", borderRadius: 8, padding: 10, fontSize: 12, color: "#92400E", marginBottom: 12 }}>
              Açıq slot yoxdur. Aşağıda əl ilə vaxt yazın.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8, marginBottom: 12, maxHeight: 200, overflow: "auto" }}>
              {groupedSlots.map(([day, daySlots]) => {
                const requestedMs = appointment.requestedStartAt ? new Date(appointment.requestedStartAt).getTime() : null;
                return (
                  <div key={day}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: "#52718F", textTransform: "uppercase", marginBottom: 4 }}>{day}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {daySlots.map(s => {
                        const slotMs = new Date(s.startAt).getTime();
                        const active = pickedSlots.includes(s.startAt);
                        const order = active ? pickedSlots.indexOf(s.startAt) + 1 : 0;
                        const isRequested = requestedMs !== null && slotMs === requestedMs;
                        return (
                          <button key={s.startAt} type="button"
                            title={isRequested ? "Müştərinin istədiyi vaxt" : undefined}
                            onClick={() => toggleSlot(s.startAt)}
                            style={{
                              padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              border: active ? "2px solid var(--brand)" : isRequested ? "2px solid #10B981" : "1px solid #E5E7EB",
                              background: active ? "var(--brand-50)" : isRequested ? "#ECFDF5" : "#fff",
                              color: active ? "var(--brand)" : isRequested ? "#065F46" : "#1A2535",
                            }}>
                            {maxSlots > 1 && active && (
                              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: "50%", background: "var(--brand)", color: "#fff", fontSize: 9, marginRight: 5 }}>{order}</span>
                            )}
                            {azFormatTime(s.startAt)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <details style={{ marginBottom: 12 }} open={!!manualStart}>
            <summary style={{ fontSize: 12, color: "#52718F", cursor: "pointer" }}>Əl ilə vaxt daxil et</summary>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <input type="datetime-local" step={60} value={manualStart} onChange={e => { setManualStart(e.target.value); setPickedSlots([]); }}
                style={{ padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }} />
              <input type="datetime-local" step={60} value={manualEnd} onChange={e => { setManualEnd(e.target.value); setPickedSlots([]); }}
                style={{ padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }} />
            </div>
          </details>
        </>
      )}

      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Operator qeydi (məcburi deyil)</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
        style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12.5, marginBottom: 10, fontFamily: "inherit", boxSizing: "border-box" }} />

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 10 }}>
          {error}
        </div>
      )}

      <button onClick={() => guardAction(doSubmit)} disabled={saving}
        style={{ width: "100%", padding: "10px 18px", border: "none", background: "var(--brand)", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
        {saving ? "Saxlanılır…"
          : pickedSlots.length > 1 ? `${pickedSlots.length} seans təyin et`
          : appointment.status === "ASSIGNED" ? "Yenidən təyin et" : "Təyin et"}
      </button>
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
        <div style={{ fontSize: 12.5, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
          Görüş linki hələ əlavə edilməyib.
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

/* ─── Mərkəz: mübahisə həlli bloku ─────────────────────────────────────────── */

function ResolveDisputeBlock({ appointment, cold, guardAction, onDone }: {
  appointment: AppointmentDetail;
  cold: boolean;
  guardAction: (run: () => void) => void;
  onDone: (a: AppointmentDetail) => void;
}) {
  const { t } = useT();
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
    <div className={cold ? "op-det-card op-det-card--cold" : "op-det-card"}>
      <div className="op-det-card__title">{t("staff.opDetStatusActions")} — Mübahisəni həll et</div>
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
          width: "100%", padding: "10px 18px", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: decision === "COMPLETE" ? "#10B981" : "#DC2626", color: "#fff",
          cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
        }}>
        {saving ? "Göndərilir…" : decision === "COMPLETE" ? "Tamamlanmış say" : "Ləğv et"}
      </button>
    </div>
  );
}

/* ─── Mərkəz: no-show işarələmə bloku (Option B) ────────────────────────────── */

function NoShowBlock({ appointment, cold, guardAction, onDone }: {
  appointment: AppointmentDetail;
  cold: boolean;
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
    <div className={cold ? "op-det-card op-det-card--cold" : "op-det-card"}>
      <div className="op-det-card__title">Seans baş tutmadı — no-show işarələ</div>
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
          width: "100%", padding: "10px 18px", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: "#DC2626", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
        }}>
        {saving ? "Göndərilir…" : "No-show işarələ"}
      </button>
    </div>
  );
}

/* ─── Mərkəz: ləğv tələbi bloku (approve/reject) ───────────────────────────── */

function CancelRequestBlock({ appointment, cold, guardAction, onDone }: {
  appointment: AppointmentDetail;
  cold: boolean;
  guardAction: (run: () => void) => void;
  onDone: (a: AppointmentDetail, approved: boolean) => void;
}) {
  const { t } = useT();
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
    <div className={cold ? "op-det-card op-det-card--cold" : "op-det-card"}>
      <div className="op-det-card__title">{t("staff.opDetStatusActions")} — Ləğv tələbi</div>
      <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
        placeholder="Pasiyentə qeyd (təsdiqdə məcburi deyil, rəddə tövsiyə olunur)"
        style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12.5, fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box" }} />
      {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button onClick={() => guardAction(run(true))} disabled={saving}
          style={{ padding: "10px 14px", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "#DC2626", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          Ləğvi təsdiqlə
        </button>
        <button onClick={() => guardAction(run(false))} disabled={saving}
          style={{ padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "#fff", color: "#1A2535", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          Tələbi rədd et
        </button>
      </div>
    </div>
  );
}

/* ─── Mərkəz: operator ləğvi bloku (köhnə CancelModal axını) ───────────────── */

function CancelBlock({ appointment, cold, guardAction, onDone }: {
  appointment: AppointmentDetail;
  cold: boolean;
  guardAction: (run: () => void) => void;
  onDone: (a: AppointmentDetail) => void;
}) {
  const [open, setOpen] = useState(false);
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

  if (!open) {
    return (
      <div className={cold ? "op-det-card op-det-card--cold" : "op-det-card"} style={{ padding: 12 }}>
        <button onClick={() => setOpen(true)}
          style={{ width: "100%", padding: "8px 14px", border: "1px solid #FECACA", borderRadius: 10, fontSize: 12.5, fontWeight: 600, background: "#fff", color: "#991B1B", cursor: "pointer" }}>
          Müraciəti ləğv et…
        </button>
      </div>
    );
  }

  return (
    <div className={cold ? "op-det-card op-det-card--cold" : "op-det-card"}>
      <div className="op-det-card__title" style={{ color: "#991B1B" }}>Müraciəti ləğv et</div>
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
        <button onClick={() => setOpen(false)}
          style={{ flex: 1, padding: "9px 14px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 12.5, fontWeight: 600, background: "#fff", cursor: "pointer" }}>
          Bağla
        </button>
        <button onClick={() => guardAction(doSubmit)} disabled={saving}
          style={{ flex: 1, padding: "9px 14px", border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: "#DC2626", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Göndərilir…" : "Ləğv et"}
        </button>
      </div>
    </div>
  );
}

/* ─── Sağ zona: fəaliyyət lenti + composer ─────────────────────────────────── */

const FEED_ICON: Record<OperatorActivityItem["kind"], string> = {
  CREATED: "✦", AUDIT: "⚙", NOTE: "✎", CONTACT: "☏",
};

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
    <div className="op-det-card" style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 180px)", position: "sticky", top: 76 }}>
      <div className="op-det-card__title">{t("staff.opDetZoneFeed")}</div>

      <div style={{ flex: 1, overflow: "auto", display: "grid", gap: 0, alignContent: "start" }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 12, color: "#8AAABF" }}>{t("staff.opDetFeedEmpty")}</div>
        ) : items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < items.length - 1 ? "1px solid #F1F5F9" : "none" }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: it.kind === "CONTACT" ? "#EEF2FF" : it.kind === "NOTE" ? "#FEF9C3" : "#F1F5F9" }}>
              {FEED_ICON[it.kind] ?? "•"}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, color: "#1A2535", lineHeight: 1.45 }}>
                {it.kind === "CREATED" && <strong>{t("staff.opDetCreatedEvent")}</strong>}
                {it.kind === "CONTACT" && (
                  <>
                    <strong>{CHANNEL_LABEL[it.channel ?? ""] ?? it.channel}</strong>
                    {" · "}{OUTCOME_LABEL[it.outcome ?? ""] ?? it.outcome}
                    {it.text && <div style={{ color: "#52718F", marginTop: 2 }}>{it.text}</div>}
                  </>
                )}
                {it.kind === "NOTE" && <div style={{ whiteSpace: "pre-wrap" }}>{it.text}</div>}
                {it.kind === "AUDIT" && (
                  <>
                    <strong>{AUDIT_LABEL[it.action ?? ""] ?? it.action}</strong>
                    {it.text && <div style={{ color: "#52718F", marginTop: 2 }}>{it.text}</div>}
                  </>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: "#8AAABF", marginTop: 2 }}>
                {it.actorName ? `${it.actorName} · ` : ""}{fmtDateTime(it.createdAt)}
              </div>
            </div>
          </div>
        ))}
        <div ref={feedEndRef} />
      </div>

      {/* Composer */}
      <div style={{ borderTop: "1px solid #EFF2F7", paddingTop: 10, marginTop: 10 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button onClick={() => setMode("note")}
            style={{ flex: 1, padding: "5px 8px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: "pointer", border: mode === "note" ? "2px solid var(--brand)" : "1px solid #E5E7EB", background: mode === "note" ? "var(--brand-50)" : "#fff", color: mode === "note" ? "var(--brand-700)" : "#52718F" }}>
            {t("staff.opDetComposerNote")}
          </button>
          <button onClick={() => setMode("contact")}
            style={{ flex: 1, padding: "5px 8px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: "pointer", border: mode === "contact" ? "2px solid var(--brand)" : "1px solid #E5E7EB", background: mode === "contact" ? "var(--brand-50)" : "#fff", color: mode === "contact" ? "var(--brand-700)" : "#52718F" }}>
            {t("staff.opDetComposerContact")}
          </button>
        </div>

        {mode === "contact" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
            <select value={channel} onChange={e => setChannel(e.target.value as typeof channel)}
              style={{ padding: 6, fontSize: 11.5, borderRadius: 8, border: "1px solid #E5E7EB" }}>
              {(["CALL", "WHATSAPP", "SMS", "EMAIL", "OTHER"] as const).map(c => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
            </select>
            <select value={outcome} onChange={e => setOutcome(e.target.value as typeof outcome)}
              style={{ padding: 6, fontSize: 11.5, borderRadius: 8, border: "1px solid #E5E7EB" }}>
              {(["ANSWERED", "NO_ANSWER", "BUSY", "REFUSED", "RESCHEDULED", "OTHER"] as const).map(o => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
            </select>
          </div>
        )}

        <textarea ref={composerRef} rows={2} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
          placeholder={mode === "note" ? "Qeyd yaz… (N)" : "Söhbətin nəticəsi (opsional)"}
          style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12.5, fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box", resize: "vertical" }} />

        <button onClick={submit} disabled={saving || (mode === "note" && !text.trim())}
          style={{ width: "100%", padding: "8px 12px", border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: "#1A2535", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving || (mode === "note" && !text.trim()) ? 0.6 : 1 }}>
          {saving ? "Əlavə edilir…" : t("staff.opDetComposerSend")}
        </button>
      </div>
    </div>
  );
}
