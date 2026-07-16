"use client";

/**
 * OP-1: Triyaj siyahısı — "inbox" görünüşü. Sətirə klik müraciətin detal
 * səhifəsini açır (/operator/appointments/[id]); köhnə modal axınları detal
 * səhifəsinə köçüb. Burada yalnız toplu əməliyyat (bulk-assign) qalıb.
 * OP-2: claim çipləri ("● Sənin üzərində") + "Mənim üzərimdə" filtri, real-time.
 *
 * Siyahı server səhifələməsi ilə yüklənir (createdAt DESC) — "Daha çox göstər"
 * növbəti səhifəni əlavə edir; tək-statuslu filtrlər serverə ötürülür.
 *
 * Görünüş "Operator Randevular.dc" maketinə uyğun redizayn edilib — məntiq eynidir.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  operatorApi,
  reasonLabel,
  type AppointmentDetail,
  type Referral,
  type RescheduleProposal,
} from "@/lib/api";
import OnBehalfBookingModal from "@/components/OnBehalfBookingModal";
import ErrorState from "@/components/ErrorState";
import { getStoredUser } from "@/lib/auth";
import { subscribeNotifications, subscribeOperatorClaims } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azFormatDateTime } from "@/lib/datetime";
import { statusMeta, isPoolEligible } from "@/lib/appointmentStatus";

type Tab = "PENDING" | "CONFIRMED" | "DISPUTED" | "COMPLETED" | "CANCELLED";

// "Yeni müraciətlər" is the unified triage inbox: new booking requests, patient
// cancel requests and reschedule requests all land here (no dedicated tab for
// each) so operators only need to watch one place. "Ləğv tələbləri" / "Vaxt
// dəyişikliyi" remain as narrowing chips within it.
const TAB_META: Record<Tab, { label: string; color: string }> = {
  PENDING:          { label: "Yeni müraciətlər",  color: "var(--status-pending-fg)" },
  CONFIRMED:        { label: "Təsdiqlənmiş",      color: "var(--status-paid-fg)" },
  DISPUTED:         { label: "Mübahisəli",        color: "var(--status-refunded-fg)" },
  COMPLETED:        { label: "Tamamlanmış",       color: "var(--status-cancelled-fg)" },
  CANCELLED:        { label: "Ləğv olunmuş",      color: "var(--status-refunded-fg)" },
};

// Appointment status → Fanus UI Kit pill variant (rənglər statusMeta() ilə eynidir,
// beləliklə vizual reqressiya və rollar arası fərq yaranmır).
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

// Server status filtri yalnız tək-statuslu tablar üçün mümkündür; PENDING
// ("Yeni müraciətlər") və CONFIRMED birləşmiş/törəmə statusları əhatə etdiyindən
// onların filtri yığılmış items üzərində client-side qalır.
const SERVER_STATUS_TABS: readonly Tab[] = ["DISPUTED", "COMPLETED", "CANCELLED"];
const PAGE_SIZE = 30;

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
  good:    { bg: "var(--status-paid-bg)",      color: "var(--status-paid-fg)" },
  warn:    { bg: "var(--status-pending-bg)",   color: "var(--status-pending-fg)" },
  danger:  { bg: "var(--status-refunded-bg)",  color: "var(--status-refunded-fg)" },
  neutral: { bg: "var(--status-cancelled-bg)", color: "var(--status-cancelled-fg)" },
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
function buildAlert(a: AppointmentDetail, hasPsyProposal = false): { tone: "red" | "amber"; text: string } | null {
  // Psixoloq Cədvəldə (drag-and-drop) yeni vaxt təklif edib — pasiyentin cavabını
  // gözləyir. Randevunun öz statusu dəyişmədiyi üçün (CONFIRMED/ASSIGNED qalır)
  // bu, ayrıca banner olmadan operatorda görünmürdü.
  if (hasPsyProposal && (a.status === "CONFIRMED" || a.status === "ASSIGNED")) {
    return { tone: "amber", text: "Psixoloq yeni vaxt təklif edib — pasiyentin cavabı gözlənilir." };
  }
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
  red:   { bg: "var(--rose-bg)",  border: "rgba(201,125,125,.35)", color: "var(--status-refunded-fg)" },
  amber: { bg: "var(--amber-bg)", border: "rgba(201,125,46,.3)",   color: "var(--status-pending-fg)" },
} as const;

export default function OperatorAppointmentsPage() {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const meId = getStoredUser()?.userId ?? null;
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
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
  // Pasient ləğv tələb edib — "Yeni müraciətlər"in bir alt-filtri (əvvəllər ayrıca tab idi)
  const [cancelOnly, setCancelOnly] = useState(() => searchParams.get("filter") === "cancel");
  // Qeyd: Pool artıq ayrıca səhifədir (/operator/pool), siyahıda filtr deyil.
  const [slaHours, setSlaHours] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  // Əsas görünüş tabları: Randevular | Paketlər | Yönləndirmələr (alt-xəttli).
  // Bildiriş deep-link-i (?view=referrals / ?view=packages) birbaşa açır.
  const [view, setView] = useState<"appointments" | "packages" | "referrals">(() => {
    const v = searchParams.get("view");
    return v === "referrals" || v === "packages" ? v : "appointments";
  });
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const refCount = referrals.length;
  // Psixoloqun Cədvəldə (drag-and-drop) yaratdığı, pasiyentin cavabını gözləyən
  // təkliflərin randevu ID-ləri — bu məlumat AppointmentDetail-də olmadığı üçün
  // ayrıca çəkilir və randevu sətrinə xəbərdarlıq/filtr kimi bağlanır.
  const [psyProposalApptIds, setPsyProposalApptIds] = useState<Set<number>>(new Set());
  const loadPsyProposals = useCallback(() => {
    operatorApi.pendingPsychologistProposals()
      .then((ps: RescheduleProposal[]) => setPsyProposalApptIds(new Set(ps.map(p => p.appointmentId))))
      .catch(() => {});
  }, []);

  // React to topbar search updates
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
    setOverdueOnly(searchParams.get("filter") === "overdue");
  }, [searchParams]);

  useEffect(() => {
    operatorApi.stats().then(s => setSlaHours(s.slaHours)).catch(() => {});
    operatorApi.pendingReferrals().then(setReferrals).catch(() => {});
    loadPsyProposals();
  }, [loadPsyProposals]);

  const [error, setError] = useState(false);
  const load = () => {
    setLoading(true);
    setError(false);
    operatorApi.listAppointments()
      .then(setItems)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // ─── Arxiv tabları (Mübahisəli/Tamamlanmış/Ləğv olunmuş) — server səhifələməsi.
  // Bu statuslar illərlə hüdudsuz böyüyür; aktiv triyaj tam siyahıdan işləməyə davam edir.
  // null = hələ yüklənir (skeleton). Xüsusi filtrlər (Gecikmiş/Mənim və s.) legacy yoldadır.
  const [archiveItems, setArchiveItems] = useState<AppointmentDetail[] | null>(null);
  const [archiveError, setArchiveError] = useState(false);
  const [archiveNonce, setArchiveNonce] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(tmr);
  }, [search]);

  const archiveMode = view === "appointments"
    && (SERVER_STATUS_TABS as readonly string[]).includes(tab)
    && !allOnly && !overdueOnly && !mineOnly && !rescheduleOnly && !cancelOnly;

  useEffect(() => {
    if (!archiveMode) return;
    let cancelled = false;
    setArchiveItems(null);
    setArchiveError(false);
    operatorApi.listAppointmentsPaged({ status: tab, q: debouncedSearch || undefined, page: 0, size: PAGE_SIZE })
      .then(res => {
        if (cancelled) return;
        setArchiveItems(res.content);
        setTotalElements(res.totalElements);
        setPage(0);
      })
      .catch(() => { if (!cancelled) { setArchiveItems([]); setArchiveError(true); } });
    return () => { cancelled = true; };
  }, [archiveMode, tab, debouncedSearch, archiveNonce]);

  const loadMoreArchive = () => {
    setLoadingMore(true);
    operatorApi.listAppointmentsPaged({ status: tab, q: debouncedSearch || undefined, page: page + 1, size: PAGE_SIZE })
      .then(res => {
        setArchiveItems(prev => [...(prev ?? []), ...res.content]);
        setTotalElements(res.totalElements);
        setPage(res.page);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  // Live refresh on any appointment-related notification (new, assigned, etc.)
  useEffect(() => {
    return subscribeNotifications((n) => {
      if (typeof n.type !== "string") return;
      if (n.type.startsWith("APPOINTMENT_") || n.type.startsWith("RESCHEDULE_")) { load(); loadPsyProposals(); }
      if (n.type.startsWith("REFERRAL_")) operatorApi.pendingReferrals().then(setReferrals).catch(() => {});
    });
  }, [loadPsyProposals]);

  // OP-2: claim hadisələri çipləri canlı yeniləyir (səhifə reload-suz)
  useEffect(() => {
    return subscribeOperatorClaims((ev) => {
      const patch = (a: AppointmentDetail) => a.id === ev.appointmentId
        ? { ...a, claimedByUserId: ev.claimedByUserId ?? null, claimedByName: ev.claimedByName ?? null, claimedAt: ev.claimedAt ?? null }
        : a;
      setItems(prev => prev.map(patch));
      setArchiveItems(prev => prev ? prev.map(patch) : prev);
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
  // Vaxt dəyişikliyi tələbi — həm pasiyentin note-tələbi (rescheduleRequestedAt),
  // həm də psixoloqun Cədvəl (drag-and-drop) təklifi. Hər ikisi aktiv randevuda
  // yaşayır (status dəyişmir), ona görə eyni filtr/inbox altında birləşir.
  const isRescheduleReq = (a: AppointmentDetail) =>
    (a.status === "CONFIRMED" || a.status === "ASSIGNED")
    && (!!a.rescheduleRequestedAt || psyProposalApptIds.has(a.id));
  const isCancelReq = (a: AppointmentDetail) => a.status === "CANCEL_REQUESTED";
  // Everything that belongs in the unified "Yeni müraciətlər" inbox: brand-new
  // requests plus patient-initiated cancel/reschedule requests on existing bookings.
  const isNewRequest = (a: AppointmentDetail) =>
    a.status === "PENDING" || a.status === "REJECTED" || isCancelReq(a) || isRescheduleReq(a);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Paket seansları öz tabında (Paketlər) yaşayır; Randevular tabı yalnız tək
    // seansları göstərir. İstisna — kəsişən triyaj filtrləri (Gecikmiş/Ləğv
    // tələbi/Vaxt dəyişikliyi) VƏ "Yeni müraciətlər" (PENDING) tabındakı ləğv/vaxt
    // dəyişikliyi siqnalları: orada paket seansı da fərdi sətir kimi çıxır ki,
    // təcili iş (bax "unified triage inbox" qeydi yuxarıda) gözdən qaçmasın —
    // əks halda paket seansının vaxt dəyişikliyi tələbi heç yerdə görünmürdü.
    const triage = overdueOnly || rescheduleOnly || cancelOnly;
    const isPendingTriageSignal = (a: AppointmentDetail) =>
      tab === "PENDING" && !mineOnly && !allOnly && !triage && (isCancelReq(a) || isRescheduleReq(a));
    return items.filter(a => {
      if (!triage && a.patientPackageId != null && !isPendingTriageSignal(a)) return false;
      if (mineOnly && a.claimedByUserId !== meId) return false;
      if (rescheduleOnly) {
        if (!isRescheduleReq(a)) return false;
      } else if (cancelOnly) {
        if (!isCancelReq(a)) return false;
      } else if (overdueOnly) {
        if (!isOverdue(a)) return false;
      } else if (!mineOnly && !allOnly) {
        if (tab === "PENDING" && !isNewRequest(a)) return false;
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
  }, [items, tab, allOnly, search, overdueOnly, mineOnly, rescheduleOnly, cancelOnly, meId, slaHours, psyProposalApptIds]);

  // ─── Paketlər tabı ───────────────────────────────────────────────────────────
  // Paket kartı BÜTÖV paketi əks etdirir: seans siyahısı/sayğacları həmişə paketin
  // BÜTÜN seanslarından (items) qurulur — operator paket haqqında tam mənzərəni görür.
  const [pkgStatusF, setPkgStatusF] = useState<"ALL" | "ACTIVE" | "EXHAUSTED">("ALL");
  const [pkgSearch, setPkgSearch] = useState("");

  const allPackageGroups = useMemo(() => {
    const groups = new Map<number, AppointmentDetail[]>();
    for (const a of items) {
      if (a.patientPackageId == null) continue;
      if (!groups.has(a.patientPackageId)) groups.set(a.patientPackageId, []);
      groups.get(a.patientPackageId)!.push(a);
    }
    for (const list of groups.values()) {
      list.sort((x, y) => new Date(x.startAt ?? x.createdAt).getTime() - new Date(y.startAt ?? y.createdAt).getTime());
    }
    return Array.from(groups.values());
  }, [items]);

  const pkgCounts = useMemo(() => {
    const c = { ALL: allPackageGroups.length, ACTIVE: 0, EXHAUSTED: 0 };
    for (const g of allPackageGroups) {
      const st = g[0].packageStatus ?? "ACTIVE";
      if (st === "ACTIVE") c.ACTIVE++;
      else if (st === "EXHAUSTED") c.EXHAUSTED++;
    }
    return c;
  }, [allPackageGroups]);

  const packageGroups = useMemo(() => {
    const q = pkgSearch.trim().toLowerCase();
    return allPackageGroups.filter(g => {
      const f = g[0];
      if (pkgStatusF !== "ALL" && (f.packageStatus ?? "ACTIVE") !== pkgStatusF) return false;
      if (!q) return true;
      const hay = `${f.packageName ?? ""} ${f.patientName ?? ""} ${f.psychologistName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allPackageGroups, pkgStatusF, pkgSearch]);

  const rescheduleCount = useMemo(() => items.filter(isRescheduleReq).length, [items, psyProposalApptIds]);
  const cancelReqCount = useMemo(() => items.filter(isCancelReq).length, [items]);

  // Randevular tabının sayğacları yalnız tək seansları sayır (paketlər öz tabında)
  const singleItems = useMemo(() => items.filter(a => a.patientPackageId == null), [items]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { PENDING: 0, CONFIRMED: 0, DISPUTED: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const a of singleItems) {
      if (isNewRequest(a)) c.PENDING++;
      if (a.status === "AWAITING_CONFIRMATION" || a.status === "ASSIGNED" || a.status === "CONFIRMED") c.CONFIRMED++;
      else if (a.status === "DISPUTED") c.DISPUTED++;
      else if (a.status === "COMPLETED") c.COMPLETED++;
      else if (a.status === "CANCELLED") c.CANCELLED++;
    }
    // Paket seansı olsa belə, ləğv/vaxt dəyişikliyi tələbi "Yeni müraciətlər"
    // sayğacına düşməlidir — yoxsa operator badge-də görmədiyi üçün heç vaxt
    // "Digər filtrlər" menyusunu açıb axtarmır (bax filtered-dəki eyni istisna).
    for (const a of items) {
      if (a.patientPackageId != null && (isCancelReq(a) || isRescheduleReq(a))) c.PENDING++;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleItems, items]);

  const overdueCount = useMemo(() => items.filter(isOverdue).length, [items, slaHours, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const mineCount = useMemo(() => {
    if (meId == null) return 0;
    const ids = new Set(
      items
        .filter(a => a.claimedByUserId != null && a.claimedByUserId === meId && a.patientId != null)
        .map(a => a.patientId)
    );
    return ids.size;
  }, [items, meId]);

  // Pooldan (və ya siyahıdan) götür → müraciət daimi olaraq bu operatora aid olur.
  const takeOwnership = useCallback((id: number) => {
    operatorApi.claim(id).then(c => {
      const patch = (a: AppointmentDetail) => a.id === id ? {
        ...a, claimedByUserId: c.claimedByUserId ?? null, claimedByName: c.claimedByName ?? null, claimedAt: c.claimedAt ?? null,
      } : a;
      setItems(prev => prev.map(patch));
      setArchiveItems(prev => prev ? prev.map(patch) : prev);
    }).catch(() => {});
  }, []);

  // OP-1: sətirə klik → detal səhifəsi. Aktiv filtr konteksti URL parametrləri ilə daşınır.
  const openDetail = useCallback((a: AppointmentDetail) => {
    const params = new URLSearchParams();
    if (!overdueOnly && !mineOnly && !allOnly && !rescheduleOnly && !cancelOnly) params.set("queue", tab);
    if (search.trim()) params.set("q", search.trim());
    if (overdueOnly) params.set("filter", "overdue");
    const qs = params.toString();
    router.push(`/operator/appointments/${a.id}${qs ? `?${qs}` : ""}`);
  }, [filtered, overdueOnly, mineOnly, allOnly, tab, search, router]);

  const [onBehalfOpen, setOnBehalfOpen] = useState(false);

  // ─── Filtr çipləri ─────────────────────────────────────────────────────────
  const pickStatus = (tk: Tab) => { setAllOnly(false); setOverdueOnly(false); setMineOnly(false); setRescheduleOnly(false); setCancelOnly(false); setTab(tk); };
  const statusActive = (tk: Tab) => !allOnly && !overdueOnly && !mineOnly && !rescheduleOnly && !cancelOnly && tab === tk;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>

      {onBehalfOpen && (
        <OnBehalfBookingModal onClose={() => setOnBehalfOpen(false)} onDone={() => { setOnBehalfOpen(false); load(); }} />
      )}

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 className="fx-h1" style={{ marginBottom: 6 }}>{t("staff.opApptTitle")}</h1>
          <p className="fx-subtitle" style={{ margin: 0 }}>{t("staff.opDashSub")}</p>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          {view !== "referrals" && (
            <button type="button" onClick={() => setOnBehalfOpen(true)} className="fx-btn fx-btn--primary">
              <Svg w={15} d={<path d="M12 5v14M5 12h14" />} /> Pasiyent adına randevu
            </button>
          )}
          <button type="button" onClick={load} className="fx-btn fx-btn--ghost">
            <Svg w={15} d={<><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>} /> Yenilə
          </button>
        </div>
      </div>

      {/* ƏSAS TABLAR — alt-xəttli: Randevular | Paketlər | Yönləndirmələr */}
      <div className="fx-tabs" style={{ borderBottom: "1px solid var(--hairline)", marginBottom: 18, overflowX: "auto" }}>
        {([
          { key: "appointments" as const, label: "Randevular", count: singleItems.length },
          { key: "packages" as const, label: "Paketlər", count: allPackageGroups.length },
          { key: "referrals" as const, label: "Yönləndirmələr", count: refCount },
        ]).map(tb => {
          const active = view === tb.key;
          return (
            <button key={tb.key} type="button" onClick={() => setView(tb.key)}
              className={`fx-tab${active ? " fx-tab--active" : ""}`} style={{ flex: "none" }}>
              {tb.label}
              <span className={`fx-pill fx-pill--count${active ? " fx-pill--count-active" : ""} fx-num`}>{tb.count}</span>
            </button>
          );
        })}
      </div>

      {/* RANDEVULAR — filtr çipləri */}
      {view === "appointments" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <Chip label="Hamısı" count={singleItems.length} active={allOnly}
            onClick={() => { setAllOnly(true); setOverdueOnly(false); setMineOnly(false); setRescheduleOnly(false); setCancelOnly(false); }} />
          {(Object.keys(TAB_META) as Tab[]).map(tk => (
            <Chip key={tk} label={TAB_META[tk].label} count={counts[tk] ?? 0} active={statusActive(tk)} onClick={() => pickStatus(tk)} />
          ))}
          <FilterMoreMenu options={[
            {
              key: "overdue", label: "Gecikmiş", count: overdueCount, dot: "var(--rose)", active: overdueOnly,
              onClick: () => { setAllOnly(false); setMineOnly(false); setRescheduleOnly(false); setCancelOnly(false); setOverdueOnly(o => !o); },
            },
            {
              key: "cancelReq", label: "Ləğv tələbləri", count: cancelReqCount, dot: "var(--amber)", active: cancelOnly,
              onClick: () => { setAllOnly(false); setOverdueOnly(false); setMineOnly(false); setRescheduleOnly(false); setCancelOnly(c => !c); },
            },
            {
              key: "reschedule", label: "Vaxt dəyişikliyi", count: rescheduleCount, dot: "var(--brand)", active: rescheduleOnly,
              onClick: () => { setAllOnly(false); setOverdueOnly(false); setMineOnly(false); setCancelOnly(false); setRescheduleOnly(r => !r); },
            },
          ]} />
          <Chip label={t("staff.opMineFilter")} count={mineCount} active={mineOnly} dot="var(--brand)"
            onClick={() => { setAllOnly(false); setOverdueOnly(false); setRescheduleOnly(false); setCancelOnly(false); setMineOnly(m => !m); }} />
          <div className="fx-search" style={{ flex: "1 1 220px", minWidth: 200, marginLeft: 4 }}>
            <Svg w={15} d={<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>} />
            <input type="text" placeholder="Axtar (ad, psixoloq, qeyd…)" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      )}

      {/* PAKETLƏR — status çipləri + axtarış */}
      {view === "packages" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <Chip label="Hamısı" count={pkgCounts.ALL} active={pkgStatusF === "ALL"}
            onClick={() => setPkgStatusF("ALL")} />
          <Chip label="Aktiv" count={pkgCounts.ACTIVE} active={pkgStatusF === "ACTIVE"} dot="var(--sage)"
            onClick={() => setPkgStatusF("ACTIVE")} />
          <Chip label="Tamamlanıb" count={pkgCounts.EXHAUSTED} active={pkgStatusF === "EXHAUSTED"} dot="var(--oxford-60)"
            onClick={() => setPkgStatusF("EXHAUSTED")} />
          <div className="fx-search" style={{ flex: "1 1 220px", minWidth: 200, marginLeft: 4 }}>
            <Svg w={15} d={<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>} />
            <input type="text" placeholder="Axtar (paket, pasiyent, psixoloq…)" value={pkgSearch} onChange={e => setPkgSearch(e.target.value)} />
          </div>
        </div>
      )}

      {/* RESULTS */}
      {view === "referrals" ? (
        referrals.length === 0 ? (
          <EmptyCard text="Təsdiq gözləyən yönləndirmə yoxdur." />
        ) : (
          <div style={GRID}>
            {referrals.map(r => (
              <ReferralCard key={r.id} r={r} onOpen={() => router.push(`/operator/referrals/${r.id}`)} />
            ))}
          </div>
        )
      ) : loading ? (
        <SkeletonCards />
      ) : error && !archiveMode ? (
        <ErrorState
          title="Randevular yüklənmədi"
          sub="Bağlantı və ya server problemi ola bilər. Yenidən cəhd edin."
          onRetry={load}
        />
      ) : view === "packages" ? (
        packageGroups.length === 0 ? (
          <EmptyCard text="Paket tapılmadı" sub="Filtri dəyişin və ya pasiyent adına yeni paket satın." />
        ) : (
          <div style={PKG_GRID}>
            {packageGroups.map(sessions => (
              <PackageCard
                key={`pkg-${sessions[0].patientPackageId}`}
                sessions={sessions}
                onOpen={() => router.push(`/operator/appointments/package/${sessions[0].patientPackageId}`)}
              />
            ))}
          </div>
        )
      ) : archiveMode ? (
        archiveError ? (
          <ErrorState
            title="Siyahı yüklənmədi"
            sub="Bağlantı və ya server problemi ola bilər. Yenidən cəhd edin."
            onRetry={() => setArchiveNonce(n => n + 1)}
          />
        ) : archiveItems == null ? (
          <SkeletonCards />
        ) : (() => {
          // Paket seansları öz tabında yaşayır — arxivdə də yalnız tək seanslar.
          const singles = archiveItems.filter(a => a.patientPackageId == null);
          const hasMore = archiveItems.length < totalElements;
          return (
            <>
              {singles.length === 0 ? (
                <EmptyCard />
              ) : (
                <div style={GRID}>
                  {singles.map(a => (
                    <AppointmentCard key={a.id} a={a} meId={meId} hasPsyProposal={psyProposalApptIds.has(a.id)}
                      onTake={() => takeOwnership(a.id)} onOpen={() => openDetail(a)} />
                  ))}
                </div>
              )}
              {hasMore && (
                <div style={{ textAlign: "center", marginTop: 18 }}>
                  <button type="button" onClick={loadMoreArchive} disabled={loadingMore} className="fx-btn fx-btn--ghost"
                    style={{ cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
                    {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - archiveItems.length)})`}
                  </button>
                </div>
              )}
            </>
          );
        })()
      ) : filtered.length === 0 ? (
        <EmptyCard />
      ) : (
        <div style={GRID}>
          {filtered.map(a => (
            <AppointmentCard key={a.id} a={a} meId={meId} hasPsyProposal={psyProposalApptIds.has(a.id)}
              onTake={() => takeOwnership(a.id)} onOpen={() => openDetail(a)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filtr çipi ───────────────────────────────────────────────────────────────

function Chip({ label, count, active, dot, onClick }: { label: string; count: number; active: boolean; dot?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`fx-toggle-chip${active ? " fx-toggle-chip--active" : ""}`} style={{ flex: "none" }}>
      {dot && <span className="fx-dot" style={{ background: dot }} />}
      {label}<span className="fx-num" style={{ opacity: 0.7, fontWeight: 700 }}>{count}</span>
    </button>
  );
}

/** Az istifadə olunan, dar filtrləri ("Gecikmiş" və s.) bir dropdown-a yığır —
 *  filtr zolağını hər zaman görünən 6+ ayrı çip əvəzinə yığcam saxlayır. */
function FilterMoreMenu({ options }: { options: { key: string; label: string; count: number; active: boolean; dot: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const onDoc = (e: MouseEvent) => { if (!node.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const activeOpt = options.find(o => o.active);
  const totalCount = options.reduce((s, o) => s + o.count, 0);

  return (
    <div ref={ref} style={{ position: "relative", flex: "none" }}>
      <button type="button" onClick={() => setOpen(o => !o)} className={`fx-toggle-chip${activeOpt ? " fx-toggle-chip--active" : ""}`}>
        {activeOpt && <span className="fx-dot" style={{ background: activeOpt.dot }} />}
        {activeOpt ? activeOpt.label : "Digər filtrlər"}
        {totalCount > 0 && <span className="fx-num" style={{ opacity: 0.7, fontWeight: 700 }}>{totalCount}</span>}
        <Svg w={12} sw={2.4} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .12s" }} d={<path d="M6 9l6 6 6-6" />} />
      </button>
      {open && (
        <div className="fx-menu" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, minWidth: 210, zIndex: 20 }}>
          {options.map(o => (
            <button key={o.key} type="button" onClick={() => { o.onClick(); setOpen(false); }}
              className="fx-menu-item" style={{ justifyContent: "space-between", background: o.active ? "var(--surface-muted)" : undefined }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: o.dot }} />{o.label}
              </span>
              <span className="fx-num" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)" }}>{o.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Müraciət kartı ───────────────────────────────────────────────────────────

const GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(340px, 100%), 1fr))", gap: 16 };
// Paket kartları öz tabında, öz ölçü standartı ilə — tək seans kartlarına görə dartılmır
const PKG_GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(360px, 100%), 1fr))", gap: 16 };

function AppointmentCard({
  a, meId, onTake, onOpen, hasPsyProposal = false,
}: {
  a: AppointmentDetail; meId: number | null; onTake?: () => void; onOpen: () => void; hasPsyProposal?: boolean;
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
  const alert = buildAlert(a, hasPsyProposal);
  const canClaim = a.claimedByUserId == null && isPoolEligible(a.status) && !!onTake;

  // Təyinat sətri
  let assignText: string, assignColor: string, assignItalic: boolean;
  if (a.psychologistName) {
    assignText = `Təyin olundu: ${a.psychologistName} · ${fmtDateTime(a.startAt)}`;
    assignColor = "var(--oxford)"; assignItalic = false;
  } else if (a.requestedPsychologistName) {
    assignText = `Tövsiyə olunan: ${a.requestedPsychologistName}${a.requestedStartAt ? ` · ${fmtDateTime(a.requestedStartAt)}` : ""}`;
    assignColor = "var(--oxford-60)"; assignItalic = true;
  } else {
    assignText = "Psixoloq seçilməyib — operator təyin edəcək";
    assignColor = "var(--oxford-60)"; assignItalic = true;
  }

  return (
    <div className="fx-card or-card" role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      style={{ padding: 17, display: "flex", flexDirection: "column", cursor: "pointer" }}>

      {/* top chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 11 }}>
        <span className="fx-num" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--oxford-60)" }}>#FNS-{String(a.id).padStart(4, "0")}</span>
        <span className={`fx-pill ${statusPillClass(status)}`}>{meta.label}</span>
        {showClaim && (
          <span className={`fx-pill ${claimMine ? "fx-pill--info" : "fx-pill--neutral"}`}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: claimMine ? "var(--brand)" : "var(--oxford-60)" }} />{claimLabel}
          </span>
        )}
        {hasSeries && (
          <span className="fx-pill fx-pill--info fx-num">
            {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal ?? 0 })}
          </span>
        )}
        {a.sessionKind === "INTRO" && (
          <span className="fx-pill" style={{ background: "var(--status-paid-bg)", color: "var(--status-paid-fg)" }}>Tanışlıq · Pulsuz</span>
        )}
      </div>

      {/* patient + time */}
      <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--oxford)" }}>{a.patientName ?? "—"}</div>
      <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginTop: 2, marginBottom: 11 }}>
        {timeAgo(a.createdAt) || `${fmtDateTime(a.createdAt)} yaradılıb`}
      </div>

      {/* contact */}
      {hasContact && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 11 }} onClick={e => e.stopPropagation()}>
          {phone && <>
            <a href={`tel:${phone}`} title={`Zəng et: ${a.patientPhone}`} className="fx-chip"><IconPhone /> Zəng</a>
            <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" title={`WhatsApp: ${a.patientPhone}`} className="fx-chip"><IconWhatsApp /> WhatsApp</a>
          </>}
          {a.patientEmail && <a href={`mailto:${a.patientEmail}`} title={a.patientEmail} className="fx-chip"><IconMail /> Email</a>}
        </div>
      )}

      {/* topic */}
      {a.note && (
        <div style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 10, padding: "9px 12px", marginBottom: 11 }}>
          <div className="fx-label" style={{ marginBottom: 3 }}>Mövzu</div>
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
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 11 }}>
        {a.lastContactAt ? <>
          <span>Son izləmə: {timeAgo(a.lastContactAt)}{a.lastContactChannel ? ` · ${CHANNEL_LABEL[a.lastContactChannel] ?? a.lastContactChannel}` : ""}</span>
          {lastOutcome && (
            <span className="fx-pill" style={{ background: FOLLOW_TONE[lastOutcome.tone].bg, color: FOLLOW_TONE[lastOutcome.tone].color }}>{lastOutcome.label}</span>
          )}
        </> : <span style={{ color: "var(--oxford-60)" }}>İzləmə qeydi yoxdur</span>}
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
          <button type="button" onClick={e => { e.stopPropagation(); onTake?.(); }} className="fx-btn fx-btn--primary" style={{ flex: 1 }}>
            <Svg w={15} d={<><path d="M5 12h14M12 5l7 7-7 7" /></>} /> {t("staff.opTake")}
          </button>
        )}
        <button type="button" onClick={e => { e.stopPropagation(); onOpen(); }} className={`fx-btn ${canClaim ? "fx-btn--ghost" : "fx-btn--primary"}`} style={{ flex: 1 }}>
          <Svg w={15} d={<><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>} /> {t("staff.opOpenTicket")}
        </button>
      </div>
    </div>
  );
}

// ─── Yönləndirmə kartı — psixoloqdan psixoloqa keçid təsdiqi gözləyir ─────────

const REFERRAL_SUBJECT_META: Record<"APPOINTMENT" | "PACKAGE", { label: string; color: string; bg: string }> = {
  APPOINTMENT: { label: "Randevu", color: "var(--brand-600)", bg: "var(--brand-50)" },
  PACKAGE:     { label: "Paket",   color: "var(--lilac)",     bg: "var(--lilac-bg)" },
};

function ReferralCard({ r, onOpen }: { r: Referral; onOpen: () => void }) {
  const subj = REFERRAL_SUBJECT_META[r.subjectType];
  return (
    <div className="fx-card or-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      style={{ padding: 17, display: "flex", flexDirection: "column", cursor: "pointer" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 11 }}>
        <span className="fx-pill" style={{ background: "var(--lilac-bg)", color: "var(--lilac)" }}>
          <Svg w={11} sw={2.4} d={<><path d="M17 3l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 21l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>} />
          Yönləndirmə
        </span>
        <span className="fx-pill" style={{ background: subj.bg, color: subj.color }}>{subj.label}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
        <span>{r.fromPsychologistName}</span>
        <Svg w={13} sw={2.4} stroke="var(--oxford-60)" d={<path d="M5 12h14M13 6l6 6-6 6" />} />
        <span>{r.toPsychologistName}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginTop: 2, marginBottom: 11 }}>
        {r.patientName ? `Pasiyent: ${r.patientName} · ` : ""}{timeAgo(r.createdAt) || fmtDateTime(r.createdAt)}
      </div>

      <div style={{ fontSize: 12.5, color: "var(--oxford-60)", background: "var(--surface-muted)", border: "1px solid var(--hairline)", borderRadius: 10, padding: "9px 12px", marginBottom: 15, lineHeight: 1.5 }}>
        <b style={{ color: "var(--oxford)" }}>Səbəb: </b>{r.reason}
      </div>

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--lilac)" }}>
        Ətraflı bax
        <Svg w={14} sw={2.2} d={<path d="M9 18l6-6-6-6" />} />
      </div>
    </div>
  );
}

// ─── Paket kartı — siyahıda adi kart; klik → paketin öz səhifəsi ─────────────

const PKG_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE:    { label: "Aktiv",       bg: "var(--status-paid-bg)",      color: "var(--status-paid-fg)" },
  EXHAUSTED: { label: "Tamamlanıb",  bg: "var(--status-cancelled-bg)", color: "var(--status-cancelled-fg)" },
  EXPIRED:   { label: "Vaxtı keçib", bg: "var(--status-pending-bg)",   color: "var(--status-pending-fg)" },
  CANCELLED: { label: "Ləğv",        bg: "var(--status-refunded-bg)",  color: "var(--status-refunded-fg)" },
};

function PackageCard({ sessions, onOpen }: { sessions: AppointmentDetail[]; onOpen: () => void }) {
  const first = sessions[0];
  const total = first.packageTotal ?? sessions.length;
  const scheduledList = sessions
    .filter(s => s.startAt && s.status !== "CANCELLED")
    .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
  const scheduled = scheduledList.length;
  const empty = Math.max(0, total - scheduled);
  const statusKey = first.packageStatus ?? "ACTIVE";
  const st = PKG_STATUS[statusKey] ?? PKG_STATUS.ACTIVE;
  const needsAttention = statusKey === "ACTIVE" && empty > 0;

  // Nöqtə-zolağı: hər dolu seans statusuna görə rəngli, boş xanalar amber halqa
  const dots: { key: string; kind: "completed" | "confirmed" | "empty" }[] = [];
  for (const s of scheduledList) dots.push({ key: `s${s.id}`, kind: s.status === "COMPLETED" ? "completed" : "confirmed" });
  for (let i = 0; i < empty; i++) dots.push({ key: `e${i}`, kind: "empty" });

  // Növbəti seans (gələcəkdə ən yaxın) — yoxdursa son keçmiş seans
  const [now] = useState(() => Date.now());
  const upcoming = scheduledList.find(s => new Date(s.startAt!).getTime() >= now);
  const nextS = upcoming ?? (scheduledList.length ? scheduledList[scheduledList.length - 1] : null);
  const nextLabel = upcoming ? "Növbəti" : "Son seans";

  const phone = normalizePhone(first.patientPhone);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="fx-card or-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      style={{ padding: 16, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 11, cursor: "pointer" }}>

      {/* Başlıq: ikon + ad + status (kart onsuz da Paketlər tabındadır — "Paket" nişanına ehtiyac yoxdur) */}
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--lilac-bg)", color: "var(--lilac)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <Svg w={18} d={<><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></>} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{first.packageName ?? "Paket"}</div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {first.patientName ?? "—"}{first.psychologistName ? ` · ${first.psychologistName}` : ""}
          </div>
        </div>
        <span className="fx-pill" style={{ background: st.bg, color: st.color, flex: "none" }}>{st.label}</span>
      </div>

      {/* Nöqtə-zolağı + say — bir sətirdə */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, flex: 1 }}>
          {dots.map(dot => (
            <span key={dot.key} title={dot.kind === "empty" ? "Boş — təyin edilməli" : dot.kind === "completed" ? "Tamamlanıb" : "Təyin olunub"}
              style={{
                width: 11, height: 11, borderRadius: 999, flex: "none",
                background: dot.kind === "completed" ? "var(--sage)" : dot.kind === "confirmed" ? "var(--brand)" : "transparent",
                border: dot.kind === "empty" ? "2px solid var(--amber)" : "none",
                boxSizing: "border-box",
              }} />
          ))}
        </div>
        <span className="fx-num" style={{ fontSize: 13, fontWeight: 700, color: "var(--lilac)", flex: "none" }}>{scheduled}/{total}</span>
      </div>

      {/* Vəziyyət sətri: boş varsa amber xəbərdarlıq, yoxsa sage təsdiq */}
      {needsAttention ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--amber-bg)", border: "1px solid rgba(201,125,46,.3)", borderRadius: 8, padding: "7px 10px" }}>
          <Svg w={13} sw={2.2} stroke="var(--amber)" d={<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--status-pending-fg)" }}>{empty} boş seans — təyin edilməli</span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--sage-bg)", border: "1px solid rgba(74,155,127,.35)", borderRadius: 8, padding: "7px 10px" }}>
          <Svg w={13} sw={2.4} stroke="var(--sage)" d={<path d="M20 6 9 17l-5-5" />} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--sage)" }}>Bütün seanslar təyin olunub</span>
        </div>
      )}

      {/* Növbəti / son seans — yığcam bir sətir */}
      {nextS && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--oxford)", minWidth: 0 }}>
          <Svg w={14} sw={2} stroke="var(--brand)" style={{ flex: "none" }} d={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />
          <span style={{ fontWeight: 600, color: "var(--oxford-60)", flex: "none" }}>{nextLabel}:</span>
          <span style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {fmtDateTime(nextS.startAt)}{nextS.psychologistName ? ` · ${nextS.psychologistName}` : ""}
          </span>
        </div>
      )}

      {/* Alt sətir: əlaqə solda, keçid sağda */}
      <div style={{ marginTop: "auto", paddingTop: 11, borderTop: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        <span style={{ display: "flex", gap: 7, flexWrap: "wrap" }} onClick={stop}>
          {phone && <a href={`tel:${phone}`} onClick={stop} title={`Zəng et: ${first.patientPhone}`} className="fx-chip"><IconPhone /> Zəng</a>}
          {phone && <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" onClick={stop} title={`WhatsApp: ${first.patientPhone}`} className="fx-chip"><IconWhatsApp /> WhatsApp</a>}
          {first.patientEmail && <a href={`mailto:${first.patientEmail}`} onClick={stop} title={first.patientEmail} className="fx-chip"><IconMail /> Email</a>}
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "var(--lilac)", whiteSpace: "nowrap" }}>
          Seansları aç
          <Svg w={13} sw={2.4} d={<path d="M9 18l6-6-6-6" />} />
        </span>
      </div>
    </div>
  );
}

// ─── Skeleton + boş ───────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div style={GRID}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="fx-card" style={{ padding: 17 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div className="fx-skeleton" style={{ width: 70, height: 18, borderRadius: 999 }} />
            <div className="fx-skeleton" style={{ width: 60, height: 18, borderRadius: 999 }} />
          </div>
          <div className="fx-skeleton" style={{ width: "55%", height: 15, borderRadius: 6, marginBottom: 8 }} />
          <div className="fx-skeleton" style={{ width: "40%", height: 11, borderRadius: 6, marginBottom: 14 }} />
          <div className="fx-skeleton" style={{ width: "100%", height: 38, borderRadius: 9, marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 9 }}>
            <div className="fx-skeleton" style={{ flex: 1, height: 38, borderRadius: 9 }} />
            <div className="fx-skeleton" style={{ flex: 1, height: 38, borderRadius: 9 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyCard({ text, sub }: { text?: string; sub?: string } = {}) {
  return (
    <div className="fx-card--empty" style={{ padding: "48px 24px" }}>
      <div style={{ width: 54, height: 54, borderRadius: 15, background: "var(--brand-50)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--oxford-60)" }}>
        <Svg w={27} sw={1.8} d={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{text ?? "Bu kateqoriyada müraciət yoxdur"}</div>
      <div className="fx-muted" style={{ fontSize: 13, fontWeight: 500 }}>{sub ?? "Filtri dəyişin və ya yeni müraciət gözləyin."}</div>
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

// ─── Stil ────────────────────────────────────────────────────────────────────

// Yalnız kartın hover qalxması — qalan hər şey fx-* siniflərindən gəlir.
const CSS = `
.or-card{transition:box-shadow .15s,border-color .15s}
.or-card:hover{box-shadow:var(--shadow-md)}
`;
