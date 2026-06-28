"use client";

/**
 * OP-1: Triyaj siyahısı — "inbox" görünüşü. Sətirə klik müraciətin detal
 * səhifəsini açır (/operator/appointments/[id]); köhnə modal axınları detal
 * səhifəsinə köçüb. Burada yalnız toplu əməliyyat (bulk-assign) qalıb.
 * OP-2: claim çipləri ("● Sənin üzərində") + "Mənim üzərimdə" filtri, real-time.
 *
 * Görünüş "Operator Randevular.dc" maketinə uyğun redizayn edilib — məntiq eynidir.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  operatorApi,
  reasonLabel,
  type AppointmentDetail,
  type Psychologist,
} from "@/lib/api";
import OnBehalfBookingModal from "@/components/OnBehalfBookingModal";
import OperatorReferralsView from "@/components/OperatorReferralsView";
import DatePicker from "@/components/DatePicker";
import { getStoredUser } from "@/lib/auth";
import { subscribeNotifications, subscribeOperatorClaims } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azLocalToISO, azFormatDateTime } from "@/lib/datetime";
import { statusMeta, isPoolEligible } from "@/lib/appointmentStatus";

const QUEUE_KEY = "fanus.op.queue";

type Tab = "PENDING" | "CONFIRMED" | "DISPUTED" | "COMPLETED" | "CANCELLED" | "CANCEL_REQUESTED";

const TAB_META: Record<Tab, { label: string; color: string }> = {
  PENDING:          { label: "Yeni müraciətlər",  color: "#92400E" },
  CANCEL_REQUESTED: { label: "Ləğv tələbləri",    color: "#92400E" },
  CONFIRMED:        { label: "Təsdiqlənmiş",      color: "#065F46" },
  DISPUTED:         { label: "Mübahisəli",        color: "#991B1B" },
  COMPLETED:        { label: "Tamamlanmış",       color: "#374151" },
  CANCELLED:        { label: "Ləğv olunmuş",      color: "#991B1B" },
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  return azFormatDateTime(iso);
}

const CHANNEL_LABEL: Record<string, string> = {
  CALL: "Zəng", WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "Email", OTHER: "Digər",
};
const OUTCOME_LABEL: Record<string, { label: string; tone: "good" | "warn" | "danger" | "neutral" }> = {
  ANSWERED:    { label: "Cavab verdi",    tone: "good" },
  NO_ANSWER:   { label: "Cavab vermədi",  tone: "warn" },
  BUSY:        { label: "Məşğul",         tone: "warn" },
  REFUSED:     { label: "İmtina etdi",    tone: "danger" },
  RESCHEDULED: { label: "Vaxt dəyişdi",   tone: "neutral" },
  OTHER:       { label: "Digər",          tone: "neutral" },
};
const FOLLOW_TONE: Record<"good" | "warn" | "danger" | "neutral", { bg: string; color: string }> = {
  good:    { bg: "#D1FAE5", color: "#065F46" },
  warn:    { bg: "#FEF3C7", color: "#92400E" },
  danger:  { bg: "#FEE2E2", color: "#991B1B" },
  neutral: { bg: "#F3F4F6", color: "#374151" },
};

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  return digits;
}
function whatsappLink(phone: string): string {
  const digits = phone.replace(/^\+/, "").replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "indicə";
  if (min < 60) return `${min} dəq öncə`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} saat öncə`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} gün öncə`;
  return `${Math.round(d / 30)} ay öncə`;
}

/** Status-asılı xəbərdarlıq (mübahisə / təsdiq / ləğv tələbi). */
function buildAlert(a: AppointmentDetail): { tone: "red" | "amber"; text: string } | null {
  if (a.status === "DISPUTED") {
    const who = a.patientDisputed && a.psychologistDisputed ? "İkisi də «olmadı» dedi"
      : a.patientDisputed ? "Pasient «olmadı» dedi"
      : a.psychologistDisputed ? "Psixoloq «olmadı» dedi"
      : "Mübahisə açıldı";
    let text = `Mübahisə: ${who}`;
    if (a.disputeReason) text += ` — «${a.disputeReason}»`;
    return { tone: "red", text };
  }
  if (a.status === "AWAITING_CONFIRMATION") {
    let text = "Təsdiq gözlənir";
    if (a.patientConfirmedAt) text += " · pasient təsdiqlədi";
    if (a.psychologistConfirmedAt) text += " · psixoloq təsdiqlədi";
    return { tone: "amber", text };
  }
  if (a.status === "CANCEL_REQUESTED") {
    let text = "Pasient ləğv tələb edib.";
    if (a.cancelRequestReasonCode) text += ` · ${reasonLabel(a.cancelRequestReasonCode)}`;
    if (a.cancelRequestReasonText) text += ` — «${a.cancelRequestReasonText}»`;
    return { tone: "amber", text };
  }
  // Reschedule request lives on an active (CONFIRMED/ASSIGNED) appointment — no
  // dedicated status, so surface it as an inline alert wherever the card shows.
  if (a.rescheduleRequestedAt && (a.status === "CONFIRMED" || a.status === "ASSIGNED")) {
    let text = "Pasient vaxt dəyişikliyi tələb edib.";
    if (a.rescheduleRequestNote) text += ` — «${a.rescheduleRequestNote}»`;
    return { tone: "amber", text };
  }
  return null;
}
const ALERT_STYLE = {
  red:   { bg: "#FEE2E2", border: "#FECACA", color: "#991B1B" },
  amber: { bg: "#FFFBEB", border: "#FDE68A", color: "#92400E" },
} as const;

export default function OperatorAppointmentsPage() {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const meId = getStoredUser()?.userId ?? null;
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(() => {
    const fromUrl = searchParams.get("tab");
    return fromUrl && fromUrl in TAB_META ? (fromUrl as Tab) : "PENDING";
  });
  const [allOnly, setAllOnly] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  // GAP-01: dashboard "Gecikmiş" badge deep-links here with ?filter=overdue
  const [overdueOnly, setOverdueOnly] = useState(() => searchParams.get("filter") === "overdue");
  // "Mənim üzərimdə" filtri (daimi sahiblik)
  const [mineOnly, setMineOnly] = useState(false);
  // Pasient vaxt dəyişikliyi tələb edən aktiv randevular (status dəyişmir)
  const [rescheduleOnly, setRescheduleOnly] = useState(() => searchParams.get("filter") === "reschedule");
  // Qeyd: Pool artıq ayrıca səhifədir (/operator/pool), siyahıda filtr deyil.
  const [slaHours, setSlaHours] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  // "Yönləndirmələr" görünüşü — randevu chip-lərindən ayrı entity; bildiriş
  // deep-link-i (?view=referrals) bu görünüşü açır.
  const [showReferrals, setShowReferrals] = useState(() => searchParams.get("view") === "referrals");
  const [refCount, setRefCount] = useState(0);

  // React to topbar search updates
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
    setOverdueOnly(searchParams.get("filter") === "overdue");
  }, [searchParams]);

  useEffect(() => {
    operatorApi.stats().then(s => setSlaHours(s.slaHours)).catch(() => {});
    operatorApi.pendingReferrals().then(r => setRefCount(r.length)).catch(() => {});
  }, []);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = () => {
    setLoading(true);
    operatorApi.listAppointments()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Live refresh on any appointment-related notification (new, assigned, etc.)
  useEffect(() => {
    return subscribeNotifications((n) => {
      if (typeof n.type !== "string") return;
      if (n.type.startsWith("APPOINTMENT_") || n.type.startsWith("RESCHEDULE_")) load();
      if (n.type.startsWith("REFERRAL_")) operatorApi.pendingReferrals().then(r => setRefCount(r.length)).catch(() => {});
    });
  }, []);

  // OP-2: claim hadisələri çipləri canlı yeniləyir (səhifə reload-suz)
  useEffect(() => {
    return subscribeOperatorClaims((ev) => {
      setItems(prev => prev.map(a => a.id === ev.appointmentId
        ? { ...a, claimedByUserId: ev.claimedByUserId ?? null, claimedByName: ev.claimedByName ?? null, claimedAt: ev.claimedAt ?? null }
        : a));
    });
  }, []);

  /** GAP-01: a request is overdue when the SLA job stamped it, or (live
   *  fallback between job runs) its age exceeds the configured SLA hours. */
  const isOverdue = (a: AppointmentDetail) => {
    if (a.status !== "PENDING" && a.status !== "NEW") return false;
    if (a.slaNotifiedAt) return true;
    if (slaHours == null) return false;
    return now - new Date(a.createdAt).getTime() > slaHours * 3_600_000;
  };
  // Patient reschedule request on an active appointment (no status change).
  const isRescheduleReq = (a: AppointmentDetail) =>
    !!a.rescheduleRequestedAt && (a.status === "CONFIRMED" || a.status === "ASSIGNED");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(a => {
      if (mineOnly && a.claimedByUserId !== meId) return false;
      if (rescheduleOnly) {
        if (!isRescheduleReq(a)) return false;
      } else if (overdueOnly) {
        if (!isOverdue(a)) return false;
      } else if (!mineOnly && !allOnly) {
        if (tab === "PENDING" && !(a.status === "PENDING" || a.status === "REJECTED")) return false;
        // CONFIRMED tab covers AWAITING_CONFIRMATION (post-session) and any
        // legacy ASSIGNED rows (operator assignment now confirms directly).
        if (tab === "CONFIRMED" && !(a.status === "CONFIRMED" || a.status === "AWAITING_CONFIRMATION" || a.status === "ASSIGNED")) return false;
        if (tab !== "PENDING" && tab !== "CONFIRMED" && a.status !== tab) return false;
      }
      if (!q) return true;
      const hay = `${a.id} ${a.patientName ?? ""} ${a.psychologistName ?? ""} ${a.requestedPsychologistName ?? ""} ${a.note ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, tab, allOnly, search, overdueOnly, mineOnly, rescheduleOnly, meId, slaHours]);

  const rescheduleCount = useMemo(() => items.filter(isRescheduleReq).length, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<string, number> = { PENDING: 0, CONFIRMED: 0, DISPUTED: 0, COMPLETED: 0, CANCELLED: 0, CANCEL_REQUESTED: 0 };
    for (const a of items) {
      if (a.status === "PENDING" || a.status === "REJECTED") c.PENDING++;
      else if (a.status === "AWAITING_CONFIRMATION" || a.status === "ASSIGNED") c.CONFIRMED++;
      else if (c[a.status] !== undefined) c[a.status]++;
    }
    return c;
  }, [items]);

  const overdueCount = useMemo(() => items.filter(isOverdue).length, [items, slaHours, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const mineCount = useMemo(
    () => items.filter(a => a.claimedByUserId != null && a.claimedByUserId === meId).length,
    [items, meId]);

  // Pooldan (və ya siyahıdan) götür → müraciət daimi olaraq bu operatora aid olur.
  const takeOwnership = useCallback((id: number) => {
    operatorApi.claim(id).then(c => {
      setItems(prev => prev.map(a => a.id === id ? {
        ...a, claimedByUserId: c.claimedByUserId ?? null, claimedByName: c.claimedByName ?? null, claimedAt: c.claimedAt ?? null,
      } : a));
    }).catch(() => {});
  }, []);

  // OP-1: sətirə klik → detal səhifəsi. Filtrlənmiş növbə sessionStorage ilə daşınır.
  const openDetail = useCallback((a: AppointmentDetail) => {
    try {
      sessionStorage.setItem(QUEUE_KEY, JSON.stringify({ ids: filtered.map(x => x.id), ts: Date.now() }));
    } catch { /* ignore */ }
    const params = new URLSearchParams();
    if (!overdueOnly && !mineOnly && !allOnly && !rescheduleOnly) params.set("queue", tab);
    if (search.trim()) params.set("q", search.trim());
    if (overdueOnly) params.set("filter", "overdue");
    const qs = params.toString();
    router.push(`/operator/appointments/${a.id}${qs ? `?${qs}` : ""}`);
  }, [filtered, overdueOnly, mineOnly, allOnly, tab, search, router]);

  const toggleSelected = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onBulkDone = (updated: AppointmentDetail[]) => {
    const map = new Map(updated.map(a => [a.id, a] as const));
    setItems(prev => prev.map(a => map.get(a.id) ?? a));
    setBulkOpen(false); setSelectMode(false); setSelected(new Set());
  };

  const [onBehalfOpen, setOnBehalfOpen] = useState(false);

  // ─── Filtr çipləri ─────────────────────────────────────────────────────────
  const pickStatus = (tk: Tab) => { setShowReferrals(false); setAllOnly(false); setOverdueOnly(false); setMineOnly(false); setRescheduleOnly(false); setTab(tk); };
  const statusActive = (tk: Tab) => !showReferrals && !allOnly && !overdueOnly && !mineOnly && !rescheduleOnly && tab === tk;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>

      {onBehalfOpen && (
        <OnBehalfBookingModal onClose={() => setOnBehalfOpen(false)} onDone={() => { setOnBehalfOpen(false); load(); }} />
      )}

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", color: "var(--oxford)" }}>{t("staff.opApptTitle")}</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>{t("staff.opDashSub")}</p>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          {!showReferrals && (
            <button type="button" onClick={() => setOnBehalfOpen(true)} className="or-btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 15px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 14px rgba(16,81,183,.25)" }}>
              <Svg w={15} d={<path d="M12 5v14M5 12h14" />} /> Pasiyent adına randevu
            </button>
          )}
          {!showReferrals && (
            <button type="button" onClick={() => { setSelectMode(s => !s); setSelected(new Set()); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: selectMode ? "var(--brand)" : "#fff", color: selectMode ? "#fff" : "#082F6D", border: `1px solid ${selectMode ? "var(--brand)" : "#E5E7EB"}`, borderRadius: 10, padding: "10px 15px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              <Svg w={15} d={<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>} />
              {selectMode ? "Seçimi ləğv et" : "Çoxlu seçim"}
            </button>
          )}
          <button type="button" onClick={load} className="or-btn-ghost"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "#082F6D", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 15px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            <Svg w={15} d={<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>} /> Yenilə
          </button>
        </div>
      </div>

      {/* BULK BAR */}
      {selectMode && selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "var(--brand)", borderRadius: 12, padding: "12px 18px", marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{selected.size} müraciət seçilib</span>
          <button type="button" onClick={() => setBulkOpen(true)}
            style={{ background: "#fff", color: "#082F6D", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
            Toplu təyin et
          </button>
        </div>
      )}

      {/* FILTER TABS */}
      <div className="or-tabs" style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 20 }}>
        <Chip label="Hamısı" count={items.length} active={!showReferrals && allOnly} tone="var(--brand)"
          onClick={() => { setShowReferrals(false); setAllOnly(true); setOverdueOnly(false); setMineOnly(false); setRescheduleOnly(false); }} />
        {(Object.keys(TAB_META) as Tab[]).map(tk => (
          <Chip key={tk} label={TAB_META[tk].label} count={counts[tk] ?? 0} active={statusActive(tk)} tone={TAB_META[tk].color} onClick={() => pickStatus(tk)} />
        ))}
        <Chip label="Gecikmiş" count={overdueCount} active={!showReferrals && overdueOnly} tone="#DC2626" dot="#EF4444"
          onClick={() => { setShowReferrals(false); setAllOnly(false); setMineOnly(false); setRescheduleOnly(false); setOverdueOnly(o => !o); }} />
        <Chip label="Vaxt dəyişikliyi" count={rescheduleCount} active={!showReferrals && rescheduleOnly} tone="#082F6D" dot="#1051B7"
          onClick={() => { setShowReferrals(false); setAllOnly(false); setOverdueOnly(false); setMineOnly(false); setRescheduleOnly(r => !r); }} />
        <Chip label={t("staff.opMineFilter")} count={mineCount} active={!showReferrals && mineOnly} tone="var(--brand)" dot="#1051B7"
          onClick={() => { setShowReferrals(false); setAllOnly(false); setOverdueOnly(false); setRescheduleOnly(false); setMineOnly(m => !m); }} />
        <span aria-hidden style={{ width: 1, alignSelf: "stretch", background: "#E1E9F5", margin: "4px 2px", flex: "none" }} />
        <Chip label="Yönləndirmələr" count={refCount} active={showReferrals} tone="#5B21B6" dot="#7C3AED"
          onClick={() => { setShowReferrals(true); setAllOnly(false); setOverdueOnly(false); setMineOnly(false); setRescheduleOnly(false); setSelectMode(false); setSelected(new Set()); }} />
        <div style={{ position: "relative", flex: "none", minWidth: 220, marginLeft: 4 }}>
          <Svg w={15} stroke="#9DB0CC" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} d={<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>} />
          <input type="text" placeholder="Axtar (ad, psixoloq, qeyd…)" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", border: "1px solid #D6E2F7", background: "#fff", borderRadius: 999, padding: "8px 14px 8px 34px", fontSize: 13, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit" }} />
        </div>
      </div>

      {/* RESULTS */}
      {showReferrals ? (
        <OperatorReferralsView onPendingCount={setRefCount} />
      ) : loading ? (
        <SkeletonCards />
      ) : filtered.length === 0 ? (
        <EmptyCard />
      ) : (
        <div style={GRID}>
          {filtered.map(a => (
            <AppointmentCard key={a.id} a={a} meId={meId} selectable={selectMode} selected={selected.has(a.id)}
              onToggleSelect={() => toggleSelected(a.id)} onTake={() => takeOwnership(a.id)} onOpen={() => openDetail(a)} />
          ))}
        </div>
      )}

      {bulkOpen && (
        <BulkAssignModal ids={Array.from(selected)} onClose={() => setBulkOpen(false)} onDone={onBulkDone} />
      )}
    </div>
  );
}

// ─── Filtr çipi ───────────────────────────────────────────────────────────────

function Chip({ label, count, active, tone, dot, onClick }: { label: string; count: number; active: boolean; tone: string; dot?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, background: active ? "#fff" : "rgba(255,255,255,.5)", border: active ? `2px solid ${tone}` : "1px solid #E1E9F5", borderRadius: 999, padding: active ? "6px 12px" : "7px 13px", fontSize: 13, fontWeight: 600, color: active ? "var(--oxford)" : "var(--oxford-60)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flex: "none" }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />}
      {label}<span style={{ opacity: 0.7, fontWeight: 700 }}>{count}</span>
    </button>
  );
}

// ─── Müraciət kartı ───────────────────────────────────────────────────────────

const GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 };

function AppointmentCard({
  a, meId, selectable, selected, onToggleSelect, onTake, onOpen,
}: {
  a: AppointmentDetail; meId: number | null; selectable?: boolean; selected?: boolean;
  onToggleSelect?: () => void; onTake?: () => void; onOpen: () => void;
}) {
  const { t } = useT();
  const status = a.status;
  const meta = statusMeta(status);
  const phone = normalizePhone(a.patientPhone);
  const hasContact = !!(phone || a.patientEmail);
  const claimMine = a.claimedByUserId != null && a.claimedByUserId === meId;
  const claimOther = a.claimedByUserId != null && !claimMine;
  const showClaim = claimMine || (claimOther && !!a.claimedByName);
  const claimLabel = claimMine ? t("staff.opClaimMine") : (a.claimedByName ? t("staff.opClaimWorking", { name: a.claimedByName }) : "");
  const hasSeries = a.seriesId != null && a.seriesIndex != null && a.seriesTotal != null;
  const lastOutcome = a.lastContactOutcome ? OUTCOME_LABEL[a.lastContactOutcome] : null;
  const alert = buildAlert(a);
  const canClaim = a.claimedByUserId == null && isPoolEligible(a.status) && !!onTake;

  // Təyinat sətri
  let assignText: string, assignColor: string, assignItalic: boolean;
  if (a.psychologistName) {
    assignText = `Təyin olundu: ${a.psychologistName} · ${fmtDateTime(a.startAt)}`;
    assignColor = "var(--oxford)"; assignItalic = false;
  } else if (a.requestedPsychologistName) {
    assignText = `Tövsiyə olunan: ${a.requestedPsychologistName}${a.requestedStartAt ? ` · ${fmtDateTime(a.requestedStartAt)}` : ""}`;
    assignColor = "#52718F"; assignItalic = true;
  } else {
    assignText = "Psixoloq seçilməyib — operator təyin edəcək";
    assignColor = "#9DB0CC"; assignItalic = true;
  }

  const handleClick = () => { if (selectable) { onToggleSelect?.(); return; } onOpen(); };

  return (
    <div className="or-card" role="button" tabIndex={0} onClick={handleClick}
      onKeyDown={e => { if (e.key === "Enter") handleClick(); }}
      style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: `1px solid ${selectable && selected ? "var(--brand)" : "#EDF1F8"}`, padding: 17, display: "flex", flexDirection: "column", cursor: "pointer" }}>

      {/* top chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 11 }}>
        {selectable && (
          <button type="button" onClick={e => { e.stopPropagation(); onToggleSelect?.(); }}
            style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${selected ? "var(--brand)" : "#CBD5E6"}`, background: selected ? "var(--brand)" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none", padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: selected ? 1 : 0 }}><path d="M20 6L9 17l-5-5" /></svg>
          </button>
        )}
        <span className="or-mono" style={{ fontSize: 12.5, fontWeight: 700, color: "#52718F" }}>#FNS-{String(a.id).padStart(4, "0")}</span>
        <span style={{ background: meta.bg, color: meta.fg, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{meta.label}</span>
        {showClaim && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: claimMine ? "#E4ECFA" : "#F3F4F6", color: claimMine ? "var(--brand)" : "#52718F", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: claimMine ? "var(--brand)" : "#52718F" }} />{claimLabel}
          </span>
        )}
        {hasSeries && (
          <span style={{ background: "#E4ECFA", color: "#082F6D", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>
            {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal ?? 0 })}
          </span>
        )}
      </div>

      {/* patient + time */}
      <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--oxford)" }}>{a.patientName ?? "—"}</div>
      <div style={{ fontSize: 12, color: "#52718F", fontWeight: 600, marginTop: 2, marginBottom: 11 }}>
        {timeAgo(a.createdAt) || `${fmtDateTime(a.createdAt)} yaradılıb`}
      </div>

      {/* contact */}
      {hasContact && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 11 }} onClick={e => e.stopPropagation()}>
          {phone && <>
            <a href={`tel:${phone}`} title={`Zəng et: ${a.patientPhone}`} style={CONTACT_GREEN}><IconPhone /> Zəng</a>
            <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" title={`WhatsApp: ${a.patientPhone}`} style={CONTACT_GREEN}><IconWhatsApp /> WhatsApp</a>
          </>}
          {a.patientEmail && <a href={`mailto:${a.patientEmail}`} title={a.patientEmail} style={CONTACT_BLUE}><IconMail /> Email</a>}
        </div>
      )}

      {/* topic */}
      {a.note && (
        <div style={{ background: "#F2F6FD", border: "1px solid #E4ECFA", borderRadius: 10, padding: "9px 12px", marginBottom: 11 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8AAABF", marginBottom: 3 }}>Mövzu</div>
          <div style={{ fontSize: 13, color: "var(--oxford)", fontStyle: "italic", fontWeight: 500, lineHeight: 1.45 }}>«{a.note}»</div>
        </div>
      )}

      {/* assign */}
      <div style={{ fontSize: 12.5, fontWeight: 600, color: assignColor, fontStyle: assignItalic ? "italic" : "normal", marginBottom: 9, display: "flex", alignItems: "flex-start", gap: 7 }}>
        <Svg w={14} style={{ flex: "none", marginTop: 1 }} d={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>} />
        <span>{assignText}</span>
      </div>

      {/* operator note */}
      {a.operatorNote && (
        <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 9 }}>Operator qeydi: {a.operatorNote}</div>
      )}

      {/* follow-up */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontSize: 12, color: "#52718F", fontWeight: 600, marginBottom: 11 }}>
        {a.lastContactAt ? <>
          <span>Son izləmə: {timeAgo(a.lastContactAt)}{a.lastContactChannel ? ` · ${CHANNEL_LABEL[a.lastContactChannel] ?? a.lastContactChannel}` : ""}</span>
          {lastOutcome && (
            <span style={{ background: FOLLOW_TONE[lastOutcome.tone].bg, color: FOLLOW_TONE[lastOutcome.tone].color, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{lastOutcome.label}</span>
          )}
        </> : <span style={{ color: "#9DB0CC" }}>İzləmə qeydi yoxdur</span>}
      </div>

      {/* status alert */}
      {alert && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: ALERT_STYLE[alert.tone].bg, border: `1px solid ${ALERT_STYLE[alert.tone].border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 11 }}>
          <Svg w={14} stroke={ALERT_STYLE[alert.tone].color} style={{ flex: "none", marginTop: 1 }} d={<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: ALERT_STYLE[alert.tone].color, lineHeight: 1.45 }}>{alert.text}</span>
        </div>
      )}

      {/* actions */}
      <div style={{ display: "flex", gap: 9, marginTop: "auto", paddingTop: 4 }}>
        {canClaim && (
          <button type="button" onClick={e => { e.stopPropagation(); onTake?.(); }} className="or-take"
            style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#047857", color: "#fff", border: "none", borderRadius: 9, padding: 10, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            <Svg w={15} d={<><path d="M5 12h14M12 5l7 7-7 7" /></>} /> {t("staff.opTake")}
          </button>
        )}
        <button type="button" onClick={e => { e.stopPropagation(); onOpen(); }} className="or-btn-primary"
          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 9, padding: 10, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
          <Svg w={15} d={<><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>} /> {t("staff.opOpenTicket")}
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton + boş ───────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div style={GRID}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 17 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div className="or-skel" style={{ width: 70, height: 18, borderRadius: 999 }} />
            <div className="or-skel" style={{ width: 60, height: 18, borderRadius: 999 }} />
          </div>
          <div className="or-skel" style={{ width: "55%", height: 15, borderRadius: 6, marginBottom: 8 }} />
          <div className="or-skel" style={{ width: "40%", height: 11, borderRadius: 6, marginBottom: 14 }} />
          <div className="or-skel" style={{ width: "100%", height: 38, borderRadius: 9, marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 9 }}>
            <div className="or-skel" style={{ flex: 1, height: 38, borderRadius: 9 }} />
            <div className="or-skel" style={{ flex: 1, height: 38, borderRadius: 9 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyCard() {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "48px 24px", textAlign: "center" }}>
      <div style={{ width: 54, height: 54, borderRadius: 15, background: "#F2F6FD", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: "#9DB0CC" }}>
        <Svg w={27} sw={1.8} d={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 5, color: "var(--oxford)" }}>Bu kateqoriyada müraciət yoxdur</div>
      <div style={{ fontSize: 13, color: "#9DB0CC", fontWeight: 500 }}>Filtri dəyişin və ya yeni müraciət gözləyin.</div>
    </div>
  );
}

// ─── İkonlar ─────────────────────────────────────────────────────────────────

function Svg({ d, w = 16, sw = 2, stroke = "currentColor", style }: { d: ReactNode; w?: number; sw?: number; stroke?: string; style?: React.CSSProperties }) {
  return <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>{d}</svg>;
}
function IconPhone() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
}
function IconWhatsApp() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>;
}
function IconMail() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></svg>;
}

const CONTACT_GREEN: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0", fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 999, textDecoration: "none" };
const CONTACT_BLUE: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, background: "#F8FAFD", color: "#082F6D", border: "1px solid #EDF1F8", fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 999, textDecoration: "none" };

/* ─── Toplu təyinat modalı (siyahıda qalan yeganə modal) ────────────────────── */

function BulkAssignModal({ ids, onClose, onDone }: { ids: number[]; onClose: () => void; onDone: (updated: AppointmentDetail[]) => void }) {
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [psyId, setPsyId] = useState<number | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { operatorApi.listPsychologists().then(setPsychologists).catch(() => {}); }, []);

  const submit = async () => {
    setErr(null);
    if (!psyId) { setErr("Psixoloq seçin"); return; }
    if (!start || !end) { setErr("Başlama və bitiş vaxtları lazımdır"); return; }
    if (new Date(start) >= new Date(end)) { setErr("Başlama bitişdən əvvəl olmalıdır"); return; }
    setSaving(true);
    try {
      const updated = await operatorApi.bulkAssign(ids, {
        psychologistId: psyId, startAt: azLocalToISO(start), endAt: azLocalToISO(end), operatorNote: note.trim() || null,
      });
      onDone(updated);
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 };
  const fld: React.CSSProperties = { width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 13px", fontSize: 13.5, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(10,26,51,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="or-sheet" style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16, boxShadow: "0 24px 70px rgba(8,47,109,.3)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #F0F4FA", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)" }}>Toplu təyin et</div>
            <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 3, lineHeight: 1.45 }}>{ids.length} müraciət eyni psixoloqa və eyni vaxta təyin olunacaq</div>
          </div>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F0F4FA", border: "none", borderRadius: 8, cursor: "pointer", flex: "none" }}>
            <Svg w={15} stroke="#5C6B85" d={<path d="M18 6L6 18M6 6l12 12" />} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 13 }}>
          <label>
            <span style={lbl}>Psixoloq</span>
            <div style={{ position: "relative" }}>
              <select value={psyId ?? ""} onChange={e => setPsyId(Number(e.target.value) || null)}
                style={{ ...fld, appearance: "none", WebkitAppearance: "none", padding: "11px 36px 11px 13px", fontWeight: 600, cursor: "pointer" }}>
                <option value="">— Seç —</option>
                {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Svg w={15} stroke="#5C6B85" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} d={<path d="M6 9l6 6 6-6" />} />
            </div>
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ flex: 1 }}><span style={lbl}>Başlama</span><DatePicker withTime theme="light" size="sm" value={start} onChange={setStart} style={{ width: "100%" }} /></label>
            <label style={{ flex: 1 }}><span style={lbl}>Bitmə</span><DatePicker withTime theme="light" size="sm" value={end} onChange={setEnd} style={{ width: "100%" }} /></label>
          </div>
          <label><span style={lbl}>Operator qeydi (opsional)</span><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Daxili qeyd…" style={{ ...fld, resize: "vertical", lineHeight: 1.5 }} /></label>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#92400E", fontWeight: 600, lineHeight: 1.45 }}>
            <Svg w={14} style={{ flex: "none", marginTop: 1 }} d={<><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>} />
            Seçilən vaxtda psixoloqun başqa seansı varsa konflikt yarana bilər.
          </div>
          {err && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#991B1B", fontWeight: 600 }}>{err}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid #F0F4FA" }}>
          <button type="button" onClick={onClose} style={{ flex: "none", background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Bağla</button>
          <button type="button" onClick={submit} disabled={saving} className="or-btn-primary"
            style={{ flex: 1, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Göndərilir…" : `${ids.length} təyin et`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stil ────────────────────────────────────────────────────────────────────

const CSS = `
.or-mono{font-family:'JetBrains Mono','Roboto Mono',ui-monospace,monospace}
.or-tabs::-webkit-scrollbar{height:0}
.or-card{transition:box-shadow .15s,border-color .15s}
.or-card:hover{box-shadow:0 6px 20px rgba(8,47,109,.1)}
.or-btn-primary:hover{background:#082F6D!important}
.or-btn-ghost:hover{border-color:#1051B7!important;color:#1051B7!important}
.or-take:hover{background:#065F46!important}
@keyframes orShim{0%{background-position:-320px 0}100%{background-position:320px 0}}
.or-skel{background:linear-gradient(90deg,#EEF2F9 25%,#E2E9F4 37%,#EEF2F9 63%);background-size:640px 100%;animation:orShim 1.4s infinite linear}
@keyframes orSheet{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.or-sheet{animation:orSheet .22s ease}
`;
