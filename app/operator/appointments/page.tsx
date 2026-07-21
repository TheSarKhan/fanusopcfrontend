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
import PageHeader from "@/components/PageHeader";
import {
  operatorApi,
  reasonLabel,
  type AppointmentDetail,
  type AppointmentSortKey,
  type Referral,
  type RescheduleProposal,
  type SortDir,
} from "@/lib/api";
import OnBehalfBookingModal from "@/components/OnBehalfBookingModal";
import ErrorState from "@/components/ErrorState";
import { toast } from "@/components/Toast";
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

/** Status siqnalı — sətirdə/kartda doldurulmuş rəngli pill əvəzinə kiçik nöqtə +
 *  adi mətn. Rəng mənbəyi statusMeta()-dır (bütün rollarda eyni), ona görə yeni
 *  rəng dili yaranmır, sadəcə vizual "səs-küy" azalır. */
function DotLabel({ color, label }: { color: string; label: string }) {
  return (
    <span className="or-status">
      <span className="or-status__dot" style={{ background: color }} />
      {label}
    </span>
  );
}
function StatusDot({ status }: { status?: string | null }) {
  const meta = statusMeta(status);
  return <DotLabel color={meta.fg} label={meta.label} />;
}

// Hər tab serverdə ifadə olunur: "INBOX" birləşmiş "Yeni müraciətlər" (yeni
// müraciətlər + ləğv tələbi + vaxt dəyişikliyi siqnalı), qalanları status dəsti.
// Beləliklə siyahı SERVER səhifələməsi ilə gəlir; yalnız kəsişən xüsusi filtrlər
// (Gecikmiş / Mənim üzərimdə / Ləğv tələbləri / Vaxt dəyişikliyi / Hamısı)
// client-side qalır — onlar server sorğusu ilə ifadə olunmur.
const TAB_STATUS_PARAM: Record<Tab, string> = {
  PENDING:   "INBOX",
  CONFIRMED: "CONFIRMED,AWAITING_CONFIRMATION,ASSIGNED",
  DISPUTED:  "DISPUTED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};
const PAGE_SIZE = 30;
const PAGE_SIZES = [15, 30, 50, 100];

/** Client-side sıralama (xüsusi filtrlər aktiv olanda) — server ağ siyahısının
 *  eyni açarları, beləliklə başlıqlar hər iki rejimdə eyni işləyir. */
const SORT_VALUE: Record<AppointmentSortKey, (a: AppointmentDetail) => string | number> = {
  createdAt:        a => new Date(a.createdAt).getTime(),
  startAt:          a => new Date(a.startAt ?? a.requestedStartAt ?? 0).getTime(),
  status:           a => statusMeta(a.status).label.toLowerCase(),
  patientName:      a => (a.patientName ?? "").toLowerCase(),
  psychologistName: a => (a.psychologistName ?? a.requestedPsychologistName ?? "").toLowerCase(),
};
function sortRows(rows: AppointmentDetail[], sort: AppointmentSortKey | null, dir: SortDir): AppointmentDetail[] {
  if (!sort) return rows;
  const get = SORT_VALUE[sort];
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((x, y) => {
    const a = get(x), b = get(y);
    return (a < b ? -1 : a > b ? 1 : 0) * mul;
  });
}

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
// İzləmə nəticəsi meta-dır, status deyil — rəngli çip yerinə yalnız mətn tonu.
const FOLLOW_COLOR: Record<"good" | "warn" | "danger" | "neutral", string> = {
  good:    "var(--status-paid-fg)",
  warn:    "var(--status-pending-fg)",
  danger:  "var(--status-refunded-fg)",
  neutral: "var(--oxford-60)",
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
  // Psixoloq Cədvəldə (drag-and-drop) yeni vaxt təklif edib — təsdiq operatorun
  // əməliyyatı ilə yekunlaşır (pasiyentin cavabı gözlənilmir). Randevunun öz statusu
  // dəyişmədiyi üçün (CONFIRMED/ASSIGNED qalır) bu, ayrıca banner olmadan görünmürdü.
  if (hasPsyProposal && (a.status === "CONFIRMED" || a.status === "ASSIGNED")) {
    return { tone: "amber", text: "Psixoloq yeni vaxt təklif edib — sizin təsdiqiniz gözlənilir." };
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
    if (a.patientConfirmedAt) text += ", pasient təsdiqlədi";
    if (a.psychologistConfirmedAt) text += ", psixoloq təsdiqlədi";
    return { tone: "amber", text };
  }
  if (a.status === "CANCEL_REQUESTED") {
    let text = "Pasient ləğv tələb edib";
    if (a.cancelRequestReasonCode) text += `, ${reasonLabel(a.cancelRequestReasonCode)}`;
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

export default function OperatorAppointmentsPage() {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const meId = getStoredUser()?.userId ?? null;
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  // Server səhifələməsi + sıralaması (əsas randevu siyahısı)
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZE);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sort, setSort] = useState<AppointmentSortKey | null>(null);
  const [dir, setDir] = useState<SortDir>("desc");
  const [tab, setTab] = useState<Tab>(() => {
    const fromUrl = searchParams.get("tab");
    return fromUrl && fromUrl in TAB_META ? (fromUrl as Tab) : "PENDING";
  });
  // Default: BÜTÜN randevular görünür (status filtri müvəqqəti yığışdırılıb).
  // Dashboard-dan gələn dərin keçidlər (?filter/?tab/?queue) istisnadır — onlar
  // konkret bölmə istəyir, ona görə "hamısı" rejimini söndürür.
  const [allOnly, setAllOnly] = useState(() =>
    !searchParams.get("filter") && !searchParams.get("tab") && !searchParams.get("queue"));
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
  // Psixoloqun Cədvəldə (drag-and-drop) yaratdığı, operator təsdiqini gözləyən
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

  // ─── Əsas siyahı — SERVER səhifələməsi + sıralaması ─────────────────────────
  // Randevu siyahısının hər tabı serverdə ifadə olunur (TAB_STATUS_PARAM), ona
  // görə əsas görünüş artıq tam siyahıdan deyil, səhifə-səhifə gəlir.
  // `items` (tam yükləmə) yalnız sayğaclar, Paketlər tabı və server sorğusu ilə
  // ifadə olunmayan kəsişən filtrlər üçün qalır.
  // null = hələ yüklənir (skeleton).
  const [pagedItems, setPagedItems] = useState<AppointmentDetail[] | null>(null);
  const [pagedError, setPagedError] = useState(false);
  const [pagedNonce, setPagedNonce] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(tmr);
  }, [search]);

  // Xüsusi (kəsişən) filtrlər server sorğusuna çevrilmir — onlar aktiv olanda
  // siyahı yenə də yığılmış `items` üzərindən client-side süzülür.
  const serverMode = view === "appointments"
    && !allOnly && !overdueOnly && !mineOnly && !rescheduleOnly && !cancelOnly;

  // Tab / filtr / axtarış / sıralama / səhifə ölçüsü dəyişəndə həmişə 0-a qayıt.
  useEffect(() => {
    setPage(0);
  }, [view, tab, allOnly, overdueOnly, mineOnly, rescheduleOnly, cancelOnly, debouncedSearch, sort, dir, size]);

  useEffect(() => {
    if (!serverMode) return;
    let cancelled = false;
    setPagedItems(null);
    setPagedError(false);
    operatorApi.listAppointmentsPaged({
      status: TAB_STATUS_PARAM[tab],
      q: debouncedSearch || undefined,
      sort: sort ?? undefined,
      dir: sort ? dir : undefined,
      page, size,
    })
      .then(res => {
        if (cancelled) return;
        setPagedItems(res.content);
        setTotalElements(res.totalElements);
        setTotalPages(res.totalPages);
      })
      .catch(() => { if (!cancelled) { setPagedItems([]); setPagedError(true); } });
    return () => { cancelled = true; };
  }, [serverMode, tab, debouncedSearch, sort, dir, page, size, pagedNonce]);

  /** Başlıq kliki: eyni sütun → istiqaməti çevir, yeni sütun → desc-dən başla. */
  const toggleSort = useCallback((key: string) => {
    const k = key as AppointmentSortKey;
    setSort(prev => {
      if (prev === k) { setDir(d => (d === "asc" ? "desc" : "asc")); return prev; }
      setDir("desc");
      return k;
    });
  }, []);

  // Live refresh on any appointment-related notification (new, assigned, etc.)
  useEffect(() => {
    return subscribeNotifications((n) => {
      if (typeof n.type !== "string") return;
      if (n.type.startsWith("APPOINTMENT_") || n.type.startsWith("RESCHEDULE_")) {
        load(); loadPsyProposals(); setPagedNonce(x => x + 1);
      }
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
      setPagedItems(prev => prev ? prev.map(patch) : prev);
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
  const [pkgStatusF, setPkgStatusF] = useState<"ALL" | "PENDING_PAYMENT" | "ACTIVE" | "EXHAUSTED">("ALL");
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
    const c = { ALL: allPackageGroups.length, PENDING_PAYMENT: 0, ACTIVE: 0, EXHAUSTED: 0 };
    for (const g of allPackageGroups) {
      const st = g[0].packageStatus ?? "ACTIVE";
      if (st === "PENDING_PAYMENT") c.PENDING_PAYMENT++;
      else if (st === "ACTIVE") c.ACTIVE++;
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
      setPagedItems(prev => prev ? prev.map(patch) : prev);
    }).catch(() => toast("Müraciəti götürmək alınmadı. Yenidən cəhd edin.", "error"));
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

  // Eyni siyahının iki görünüşü: geniş ekranda cədvəl, dar ekranda kart (CSS swap).
  const renderAppointments = (list: AppointmentDetail[]) => (
    <ResponsiveList
      table={
        <AppointmentTable
          rows={list}
          meId={meId}
          psyProposalApptIds={psyProposalApptIds}
          isOverdue={isOverdue}
          sort={sort}
          dir={dir}
          onSort={toggleSort}
          onTake={takeOwnership}
          onOpen={openDetail}
        />
      }
      cards={
        <div style={GRID}>
          {list.map(a => (
            <AppointmentCard key={a.id} a={a} meId={meId} hasPsyProposal={psyProposalApptIds.has(a.id)}
              onTake={() => takeOwnership(a.id)} onOpen={() => openDetail(a)} />
          ))}
        </div>
      }
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>

      {onBehalfOpen && (
        <OnBehalfBookingModal onClose={() => setOnBehalfOpen(false)}
          onDone={() => { setOnBehalfOpen(false); load(); setPagedNonce(n => n + 1); }} />
      )}

      {/* HEADER */}
      <PageHeader
        title={t("staff.opApptTitle")}
        subtitle={t("staff.opDashSub")}
        actions={
          <>
            {view !== "referrals" && (
              <button type="button" onClick={() => setOnBehalfOpen(true)} className="fx-btn fx-btn--primary">
                <Svg w={15} d={<path d="M12 5v14M5 12h14" />} /> Pasiyent adına randevu
              </button>
            )}
            <button type="button" onClick={() => { load(); setPagedNonce(n => n + 1); }} className="fx-btn fx-btn--ghost">
              <Svg w={15} d={<><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>} /> Yenilə
            </button>
          </>
        }
      />

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

      {/* RANDEVULAR — axtarış + tək "Filtrlər" paneli (çiplər cədvələ keçdikdən
          sonra ləğv edildi: status/xüsusi filtr/sıralama hamısı paneldədir) */}
      {view === "appointments" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <div className="fx-search" style={{ flex: "1 1 260px", minWidth: 220 }}>
            <Svg w={15} d={<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>} />
            <input type="text" placeholder="Axtar (ad, psixoloq, qeyd…)" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {/* Status filtri müvəqqəti yığışdırılıb — bütün randevular default
              göstərilir. Bölmələrə ayırma sonra ayrıca işlənəcək; `pickStatus`
              və TAB_META saxlanılır ki, qaytarmaq bir sətirlik olsun. */}
          <FilterPanel
            statusOptions={[]}
            onPickStatus={(key) => {
              if (key === "ALL") {
                setAllOnly(true); setOverdueOnly(false); setMineOnly(false);
                setRescheduleOnly(false); setCancelOnly(false);
              } else {
                pickStatus(key as Tab);
              }
            }}
            flagOptions={[
              {
                key: "overdue", label: "Gecikmiş", hint: "SLA vaxtı keçib", count: overdueCount, active: overdueOnly,
                onToggle: () => { setAllOnly(false); setMineOnly(false); setRescheduleOnly(false); setCancelOnly(false); setOverdueOnly(o => !o); },
              },
              {
                key: "cancelReq", label: "Ləğv tələbləri", hint: "Pasiyent ləğv istəyib", count: cancelReqCount, active: cancelOnly,
                onToggle: () => { setAllOnly(false); setOverdueOnly(false); setMineOnly(false); setRescheduleOnly(false); setCancelOnly(c => !c); },
              },
              {
                key: "reschedule", label: "Vaxt dəyişikliyi", hint: "Yeni vaxt təklifi gözləyir", count: rescheduleCount, active: rescheduleOnly,
                onToggle: () => { setAllOnly(false); setOverdueOnly(false); setMineOnly(false); setCancelOnly(false); setRescheduleOnly(r => !r); },
              },
              {
                key: "mine", label: t("staff.opMineFilter"), hint: "Sahibi mənəm", count: mineCount, active: mineOnly,
                onToggle: () => { setAllOnly(false); setOverdueOnly(false); setRescheduleOnly(false); setCancelOnly(false); setMineOnly(m => !m); },
              },
            ]}
            sort={sort}
            dir={dir}
            onSortChange={(key, d) => { setSort(key); setDir(d); }}
            onReset={() => {
              setAllOnly(false); setOverdueOnly(false); setMineOnly(false);
              setRescheduleOnly(false); setCancelOnly(false);
              setTab("PENDING"); setSort(null); setDir("desc");
            }}
          />
        </div>
      )}

      {/* PAKETLƏR — status çipləri + axtarış */}
      {view === "packages" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <Chip label="Hamısı" count={pkgCounts.ALL} active={pkgStatusF === "ALL"}
            onClick={() => setPkgStatusF("ALL")} />
          <Chip label="Ödəniş gözlənilir" count={pkgCounts.PENDING_PAYMENT} active={pkgStatusF === "PENDING_PAYMENT"} dot="var(--amber)"
            onClick={() => setPkgStatusF("PENDING_PAYMENT")} />
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
          <ResponsiveList
            table={<ReferralTable rows={referrals} onOpen={r => router.push(`/operator/referrals/${r.id}`)} />}
            cards={
              <div style={GRID}>
                {referrals.map(r => (
                  <ReferralCard key={r.id} r={r} onOpen={() => router.push(`/operator/referrals/${r.id}`)} />
                ))}
              </div>
            }
          />
        )
      ) : serverMode ? (
        // Əsas siyahı — server səhifələməsi (tab filtri + axtarış + sıralama serverdə)
        pagedError ? (
          <ErrorState
            title="Randevular yüklənmədi"
            sub="Bağlantı və ya server problemi ola bilər. Yenidən cəhd edin."
            onRetry={() => setPagedNonce(n => n + 1)}
          />
        ) : pagedItems == null ? (
          <ResponsiveList table={<SkeletonTable />} cards={<SkeletonCards />} />
        ) : pagedItems.length === 0 ? (
          <EmptyCard />
        ) : (
          <>
            {renderAppointments(pagedItems)}
            <Pager page={page} size={size} totalElements={totalElements} totalPages={totalPages}
              onPage={setPage} onSize={setSize} />
          </>
        )
      ) : loading ? (
        <ResponsiveList table={<SkeletonTable />} cards={<SkeletonCards />} />
      ) : error ? (
        <ErrorState
          title="Randevular yüklənmədi"
          sub="Bağlantı və ya server problemi ola bilər. Yenidən cəhd edin."
          onRetry={load}
        />
      ) : view === "packages" ? (
        packageGroups.length === 0 ? (
          <EmptyCard text="Paket tapılmadı" sub="Filtri dəyişin və ya pasiyent adına yeni paket satın." />
        ) : (
          <ResponsiveList
            table={
              <PackageTable
                groups={packageGroups}
                onOpen={g => router.push(`/operator/appointments/package/${g[0].patientPackageId}`)}
                onOpenSession={openDetail}
              />
            }
            cards={
              <div style={PKG_GRID}>
                {packageGroups.map(sessions => (
                  <PackageCard
                    key={`pkg-${sessions[0].patientPackageId}`}
                    sessions={sessions}
                    onOpen={() => router.push(`/operator/appointments/package/${sessions[0].patientPackageId}`)}
                  />
                ))}
              </div>
            }
          />
        )
      ) : filtered.length === 0 ? (
        <EmptyCard />
      ) : renderAppointments(sortRows(filtered, sort, dir))}
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

/* ─── Filtr paneli ───────────────────────────────────────────────────────────
   Siyahı cədvəl strukturuna keçdikdən sonra 8 ayrı status/filtr çipi zolağı
   artıq lazım deyil: hamısı bir "Filtrlər" düyməsinin altındakı popover-dədir.
   Düymədəki sayğac neçə filtrin dəyişdirildiyini göstərir; panelin içində
   status seçimi (tək), xüsusi filtrlər (çoxlu) və sıralama var. */

type StatusOption = { key: string; label: string; count: number; active: boolean };
type FlagOption = { key: string; label: string; hint?: string; count: number; active: boolean; onToggle: () => void };

const SORT_OPTIONS: { key: AppointmentSortKey; label: string }[] = [
  { key: "createdAt",        label: "Yaradılma tarixi" },
  { key: "startAt",          label: "Seans vaxtı" },
  { key: "status",           label: "Status" },
  { key: "patientName",      label: "Pasiyent adı" },
  { key: "psychologistName", label: "Psixoloq adı" },
];

function FilterPanel({
  statusOptions, onPickStatus, flagOptions, sort, dir, onSortChange, onReset,
}: {
  statusOptions: StatusOption[];
  onPickStatus: (key: string) => void;
  flagOptions: FlagOption[];
  sort: AppointmentSortKey | null;
  dir: SortDir;
  onSortChange: (key: AppointmentSortKey | null, dir: SortDir) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const onDoc = (e: MouseEvent) => { if (!node.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const activeStatus = statusOptions.find(s => s.active);
  const activeFlags = flagOptions.filter(f => f.active);
  // Sayğac: default olmayan status + hər aktiv xüsusi filtr + sıralama.
  const isDefaultStatus = activeStatus?.key === "PENDING";
  const badge = (activeStatus && !isDefaultStatus ? 1 : 0) + activeFlags.length + (sort ? 1 : 0);

  // Zolağın altında hansı filtrlərin işlədiyi düz mətnlə yazılır (çip yox).
  const summary = [
    activeStatus && !isDefaultStatus ? activeStatus.label : null,
    ...activeFlags.map(f => f.label),
    sort ? `${SORT_OPTIONS.find(s => s.key === sort)?.label} ${dir === "asc" ? "↑" : "↓"}` : null,
  ].filter(Boolean) as string[];

  const rowBase: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    width: "100%", padding: "8px 10px", borderRadius: 9, border: "1px solid transparent",
    background: "transparent", fontSize: 13, fontWeight: 500, color: "var(--oxford)",
    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
  };
  const activeRow: React.CSSProperties = {
    background: "var(--brand-50, #F2F6FD)", borderColor: "var(--brand-200, #C3D6F6)",
    color: "var(--brand-700, #082F6D)", fontWeight: 600,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 11.5, fontWeight: 600, color: "var(--oxford-60)", margin: "0 0 6px 2px",
  };
  const count: React.CSSProperties = {
    fontSize: 11.5, fontWeight: 600, color: "var(--oxford-60)", fontVariantNumeric: "tabular-nums",
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`fx-btn fx-btn--ghost${open ? " is-open" : ""}`}
        aria-haspopup="dialog" aria-expanded={open}>
        <Svg w={15} d={<><path d="M3 5h18" /><path d="M6 12h12" /><path d="M10 19h4" /></>} />
        Filtrlər
        {badge > 0 && (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            minWidth: 19, height: 19, padding: "0 6px", borderRadius: 999,
            background: "var(--brand)", color: "#fff", fontSize: 11.5, fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}>{badge}</span>
        )}
        <Svg w={12} sw={2.4} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .12s" }} d={<path d="M6 9l6 6 6-6" />} />
      </button>

      {/* Hər filtr öz span-ında — ayırıcı işarə yox, flex boşluğu ayırır. */}
      {summary.length > 0 && (
        <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          {summary.map((s, si) => <span key={si}>{s}</span>)}
          <button type="button" onClick={onReset}
            style={{ marginLeft: 8, background: "none", border: "none", padding: 0, color: "var(--brand)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Təmizlə
          </button>
        </span>
      )}

      {open && (
        <div role="dialog" aria-label="Filtrlər" className="fx-card"
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 40,
            width: 320, maxWidth: "calc(100vw - 32px)", padding: 14,
            boxShadow: "0 16px 40px rgba(0,33,71,.14)",
            maxHeight: "min(70vh, 620px)", overflowY: "auto",
          }}>

          {/* Status — tək seçim. statusOptions boş göndərilsə bölmə göstərilmir
              (hazırda randevular siyahısı belədir: hamısı görünür). */}
          {statusOptions.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={sectionTitle}>Status</div>
              <div style={{ display: "grid", gap: 2 }}>
                {statusOptions.map(s => (
                  <button key={s.key} type="button" onClick={() => onPickStatus(s.key)}
                    style={{ ...rowBase, ...(s.active ? activeRow : {}) }}>
                    <span>{s.label}</span>
                    <span style={count}>{s.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Xüsusi filtrlər — çoxlu seçim */}
          <div style={{ marginBottom: 14, borderTop: statusOptions.length > 0 ? "1px solid var(--hairline)" : "none", paddingTop: statusOptions.length > 0 ? 12 : 0 }}>
            <div style={sectionTitle}>Xüsusi filtrlər</div>
            <div style={{ display: "grid", gap: 2 }}>
              {flagOptions.map(f => (
                <button key={f.key} type="button" onClick={f.onToggle}
                  style={{ ...rowBase, ...(f.active ? activeRow : {}), alignItems: "flex-start" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <span style={{
                      width: 15, height: 15, borderRadius: 4, flex: "none",
                      border: `1.5px solid ${f.active ? "var(--brand)" : "var(--oxford-20, #C3D6F6)"}`,
                      background: f.active ? "var(--brand)" : "#fff",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {f.active && <Svg w={10} sw={3} stroke="#fff" d={<path d="M20 6L9 17l-5-5" />} />}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      {f.label}
                      {f.hint && <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "var(--oxford-60)" }}>{f.hint}</span>}
                    </span>
                  </span>
                  <span style={count}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sıralama */}
          <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12 }}>
            <div style={sectionTitle}>Sıralama</div>
            <div style={{ display: "grid", gap: 2 }}>
              <button type="button" onClick={() => onSortChange(null, "desc")}
                style={{ ...rowBase, ...(sort === null ? activeRow : {}) }}>
                <span>Standart (ən yeni əvvəl)</span>
              </button>
              {SORT_OPTIONS.map(s => {
                const on = sort === s.key;
                return (
                  <div key={s.key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button type="button" onClick={() => onSortChange(s.key, on ? dir : "desc")}
                      style={{ ...rowBase, ...(on ? activeRow : {}), flex: 1 }}>
                      <span>{s.label}</span>
                    </button>
                    {on && (
                      <button type="button" onClick={() => onSortChange(s.key, dir === "asc" ? "desc" : "asc")}
                        title={dir === "asc" ? "Artan sıra" : "Azalan sıra"}
                        style={{
                          flex: "none", width: 34, height: 34, borderRadius: 9,
                          border: "1px solid var(--brand-200, #C3D6F6)", background: "#fff",
                          color: "var(--brand-700, #082F6D)", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        }}>
                        {dir === "asc" ? "↑" : "↓"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alt hissə */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 14, borderTop: "1px solid var(--hairline)", paddingTop: 12 }}>
            <button type="button" onClick={onReset} className="fx-btn fx-btn--ghost" style={{ flex: 1 }}>
              Sıfırla
            </button>
            <button type="button" onClick={() => setOpen(false)} className="fx-btn fx-btn--primary" style={{ flex: 1 }}>
              Tətbiq et
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cədvəl görünüşü ─────────────────────────────────────────────────────────
// Geniş ekranda siyahılar `fx-table` cədvəlidir (operator/customers,
// operator/psychologists, operator/session-requests ilə eyni konvensiya:
// fx-card qabığı → overflowX konteyneri → fx-table, sətir klik = detal).
// Dar ekranda eyni məlumat mövcud kart görünüşünə keçir — CSS media sorğusu ilə,
// beləliklə heç bir davranış/hook dublikat olmur.

function ResponsiveList({ table, cards }: { table: ReactNode; cards: ReactNode }) {
  return (
    <>
      <div className="or-wide">{table}</div>
      <div className="or-narrow">{cards}</div>
    </>
  );
}

/** Cədvəl qabığı — qonşu operator səhifələri ilə eyni struktur. */
function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="fx-card" style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table className="fx-table">{children}</table>
      </div>
    </div>
  );
}

/** Sıralanan cədvəl başlığı — klik istiqaməti çevirir, aktiv istiqamət inline
 *  SVG ox (caret) ilə göstərilir. Həm server, həm client sıralamasında eyni. */
function SortTh({ label, sortKey, sort, dir, onSort, style }: {
  label: string; sortKey: string; sort: string | null; dir: SortDir;
  onSort: (key: string) => void; style?: React.CSSProperties;
}) {
  const active = sort === sortKey;
  return (
    <th style={style} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="or-th" onClick={() => onSort(sortKey)}
        title={`${label} — sıralamanı dəyiş`}>
        {label}
        <Svg w={11} sw={2.6} style={{ opacity: active ? 1 : 0.3, flex: "none" }}
          d={active && dir === "asc" ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />} />
      </button>
    </th>
  );
}

/** Səhifələmə zolağı — operator/session-requests səhifəsindəki konvensiyanın
 *  eynisi (Göstərilir · Əvvəlki/nömrələr/Sonrakı · Səhifə başı). */
function Pager({ page, size, totalElements, totalPages, onPage, onSize }: {
  page: number; size: number; totalElements: number; totalPages: number;
  onPage: (p: number) => void; onSize: (s: number) => void;
}) {
  if (totalElements === 0) return null;
  return (
    <div className="fx-card" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", flexWrap: "wrap", gap: 10 }}>
        <span className="fx-muted fx-num" style={{ fontSize: 12 }}>
          Göstərilir: {page * size + 1}–{Math.min((page + 1) * size, totalElements)} / {totalElements}
        </span>

        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" className="fx-btn fx-btn--ghost fx-btn--sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
              Əvvəlki
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p = i;
              if (totalPages > 5 && page > 2) {
                p = page - 2 + i;
                if (p >= totalPages) p = totalPages - (5 - i);
              }
              if (p < 0 || p >= totalPages) return null;
              return (
                <button key={p} type="button"
                  className={`fx-btn fx-btn--sm${page === p ? " fx-btn--primary" : " fx-btn--ghost"}`}
                  onClick={() => onPage(p)}>
                  {p + 1}
                </button>
              );
            })}
            <button type="button" className="fx-btn fx-btn--ghost fx-btn--sm" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>
              Sonrakı
            </button>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="fx-muted" style={{ fontSize: 12 }}>Səhifə başı:</span>
          <select value={size} onChange={e => onSize(Number(e.target.value))} aria-label="Səhifə ölçüsü" className="fx-select fx-select--inline">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

/** Diqqət nişanı — sətrin əvvəlində, kartdakı banner ikonunun eynisi. */
function AttnMark({ tone, title }: { tone: "red" | "amber"; title: string }) {
  return (
    <span title={title} aria-label={title} style={{ display: "inline-flex", color: tone === "red" ? "var(--rose)" : "var(--amber)" }}>
      <Svg w={15} d={<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>} />
    </span>
  );
}

/** Sətir daxili əlaqə düymələri — kartdakı ContactChips-in yığcam variantı. */
function RowContact({ phone, email }: { phone?: string | null; email?: string | null }) {
  const p = normalizePhone(phone);
  if (!p && !email) return null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <>
      {p && <a href={`tel:${p}`} onClick={stop} title={`Zəng et: ${phone}`} className="fx-btn fx-btn--ghost fx-btn--sm"><IconPhone /></a>}
      {p && <a href={whatsappLink(p)} target="_blank" rel="noopener noreferrer" onClick={stop} title={`WhatsApp: ${phone}`} className="fx-btn fx-btn--ghost fx-btn--sm"><IconWhatsApp /></a>}
      {email && <a href={`mailto:${email}`} onClick={stop} title={email} className="fx-btn fx-btn--ghost fx-btn--sm"><IconMail /></a>}
    </>
  );
}

// ─── Randevular cədvəli ───────────────────────────────────────────────────────

function AppointmentTable({ rows, meId, psyProposalApptIds, isOverdue, sort, dir, onSort, onTake, onOpen }: {
  rows: AppointmentDetail[];
  meId: number | null;
  psyProposalApptIds: Set<number>;
  isOverdue: (a: AppointmentDetail) => boolean;
  sort: AppointmentSortKey | null;
  dir: SortDir;
  onSort: (key: string) => void;
  onTake: (id: number) => void;
  onOpen: (a: AppointmentDetail) => void;
}) {
  return (
    <TableCard>
      <thead>
        <tr>
          <th style={{ width: 34 }} />
          <SortTh label="Pasiyent" sortKey="patientName" sort={sort} dir={dir} onSort={onSort} />
          <SortTh label="Tarix / saat" sortKey="startAt" sort={sort} dir={dir} onSort={onSort} />
          <SortTh label="Psixoloq" sortKey="psychologistName" sort={sort} dir={dir} onSort={onSort} />
          <SortTh label="Status" sortKey="status" sort={sort} dir={dir} onSort={onSort} />
          <th>Ödəniş</th>
          <SortTh label="Gözləmə / diqqət" sortKey="createdAt" sort={sort} dir={dir} onSort={onSort} />
          <th style={{ width: 210 }} />
        </tr>
      </thead>
      <tbody>
        {rows.map(a => (
          <AppointmentRow
            key={a.id}
            a={a}
            meId={meId}
            hasPsyProposal={psyProposalApptIds.has(a.id)}
            overdue={isOverdue(a)}
            onTake={() => onTake(a.id)}
            onOpen={() => onOpen(a)}
          />
        ))}
      </tbody>
    </TableCard>
  );
}

function AppointmentRow({ a, meId, overdue, hasPsyProposal, onTake, onOpen }: {
  a: AppointmentDetail; meId: number | null; overdue: boolean; hasPsyProposal: boolean;
  onTake: () => void; onOpen: () => void;
}) {
  const { t } = useT();
  const alert = buildAlert(a, hasPsyProposal);
  const claimMine = a.claimedByUserId != null && a.claimedByUserId === meId;
  const claimOther = a.claimedByUserId != null && !claimMine;
  // Sahiblik nişanı YALNIZ başqasının üzərində olanda göstərilir — operator
  // onsuz da yalnız öz sətirlərini görür, "Sənin üzərində" məlumat vermirdi.
  const showClaim = claimOther && !!a.claimedByName;
  const claimLabel = claimMine ? t("staff.opClaimMine") : (a.claimedByName ? t("staff.opClaimWorking", { name: a.claimedByName }) : "");
  const hasSeries = a.seriesId != null && a.seriesIndex != null && a.seriesTotal != null;
  const canClaim = a.claimedByUserId == null && isPoolEligible(a.status);
  const when = a.startAt ?? a.requestedStartAt ?? null;
  // Diqqət tonu: xəbərdarlıq varsa onun tonu, yoxsa SLA gecikməsi.
  const tone: "red" | "amber" | null = alert ? alert.tone : overdue ? "red" : null;
  const attnText = alert?.text ?? (overdue ? "SLA gecikməsi — hələ cavablandırılmayıb" : "");

  return (
    <tr onClick={onOpen} style={{ cursor: "pointer" }} className={tone ? `or-tr--attn or-tr--attn-${tone}` : undefined}>
      <td className="or-td-attn">{tone && <AttnMark tone={tone} title={attnText} />}</td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`fx-avatar fx-avatar--${avatarTone(a.id)}`}>{initialsOf(a.patientName)}</span>
          <div style={{ minWidth: 0 }}>
            <div className="fx-row__title">{a.patientName ?? "—"}</div>
            <div className="fx-muted fx-num" style={{ fontSize: 12 }}>#FNS-{String(a.id).padStart(4, "0")}</div>
          </div>
        </div>
      </td>
      <td>
        <div className="fx-num" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{when ? fmtDateTime(when) : "—"}</div>
        {!a.startAt && a.requestedStartAt && <div className="fx-muted" style={{ fontSize: 11.5 }}>istənilən vaxt</div>}
        {a.sessionKind === "INTRO" && <div className="fx-muted" style={{ fontSize: 11.5 }}>Tanışlıq, pulsuz</div>}
      </td>
      <td>
        {a.psychologistName ? (
          <span style={{ fontSize: 12.5 }}>{a.psychologistName}</span>
        ) : a.requestedPsychologistName ? (
          <>
            <div style={{ fontSize: 12.5, fontStyle: a.origin === "DIRECT" ? undefined : "italic" }}>{a.requestedPsychologistName}</div>
            <div className="fx-muted" style={{ fontSize: 11.5 }}>{a.origin === "DIRECT" ? "Müştəri seçdi" : "İstənilən"}</div>
          </>
        ) : (
          <span className="fx-muted" style={{ fontSize: 12.5, fontStyle: "italic" }}>Təyin olunmayıb</span>
        )}
      </td>
      <td>
        {/* Sətirdəki YEGANƏ status siqnalı: nöqtə + mətn (dolu pill deyil).
            Sahiblik/seriya məlumatı susqun mətn sətirləri kimi qalır. */}
        <StatusDot status={a.status} />
        {showClaim && <div className="fx-muted" style={{ fontSize: 11.5, marginTop: 4 }}>{claimLabel}</div>}
        {hasSeries && (
          <div className="fx-muted fx-num" style={{ fontSize: 11.5 }}>
            {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal ?? 0 })}
          </div>
        )}
      </td>
      <td>
        {a.patientPackageId != null ? (
          <span className="fx-muted" style={{ fontSize: 12.5 }}>Paket</span>
        ) : a.paymentStatus === "PAID" ? (
          <>
            {!!a.paymentAmount && <div className="fx-num" style={{ fontSize: 12.5 }}>{a.paymentAmount} ₼</div>}
            <div className="fx-muted" style={{ fontSize: 11.5 }}>Ödənilib</div>
          </>
        ) : a.paymentStatus === "PENDING" ? (
          <span className="fx-muted" style={{ fontSize: 12.5 }}>Gözləyir</span>
        ) : (
          <span className="fx-muted">—</span>
        )}
      </td>
      <td>
        <div className="fx-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{timeAgo(a.createdAt) || fmtDateTime(a.createdAt)}</div>
        {attnText && (
          <div className="or-alert-txt" style={{ color: tone === "red" ? "var(--status-refunded-fg)" : "var(--status-pending-fg)" }}>{attnText}</div>
        )}
        {a.lastContactAt && (
          <div className="fx-muted" style={{ fontSize: 11.5, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span>Son izləmə: {timeAgo(a.lastContactAt)}</span>
            {a.lastContactOutcome && OUTCOME_LABEL[a.lastContactOutcome]
              ? <span style={{ color: FOLLOW_COLOR[OUTCOME_LABEL[a.lastContactOutcome].tone], fontWeight: 600 }}>{OUTCOME_LABEL[a.lastContactOutcome].label}</span>
              : null}
          </div>
        )}
      </td>
      <td onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <RowContact phone={a.patientPhone} email={a.patientEmail} />
          {canClaim && (
            <button type="button" onClick={onTake} className="fx-btn fx-btn--primary fx-btn--sm">{t("staff.opTake")}</button>
          )}
          <button type="button" onClick={onOpen} title={t("staff.opOpenTicket")} className="fx-btn fx-btn--ghost fx-btn--sm">
            <Svg w={14} sw={2.4} d={<path d="M9 18l6-6-6-6" />} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Yönləndirmələr cədvəli ───────────────────────────────────────────────────

// Status siqnalı burada da nöqtə + mətndir; rənglər mövcud status dəyişənləridir.
const REFERRAL_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING_OPERATOR: { label: "Operator təsdiqi", color: "var(--status-pending-fg)" },
  PENDING_REVIEW:   { label: "Psixoloq baxışı",  color: "var(--brand)" },
  ACCEPTED:         { label: "Qəbul edilib",     color: "var(--status-paid-fg)" },
  DECLINED:         { label: "İmtina",           color: "var(--status-refunded-fg)" },
  CANCELLED:        { label: "Ləğv edilib",      color: "var(--status-cancelled-fg)" },
};

/** Yönləndirmə mənbəyi (operatorApi.pendingReferrals) səhifələnmir — server
 *  səhifələməsi yoxdur, ona görə burada YALNIZ client-side sıralama var
 *  (uydurma server səhifələməsi qurulmur). */
const REFERRAL_SORT: Record<string, (r: Referral) => string | number> = {
  patientName: r => (r.patientName ?? "").toLowerCase(),
  createdAt:   r => new Date(r.createdAt ?? 0).getTime(),
  status:      r => (REFERRAL_STATUS_META[r.status]?.label ?? r.status).toLowerCase(),
};

function ReferralTable({ rows, onOpen }: { rows: Referral[]; onOpen: (r: Referral) => void }) {
  const [sort, setSort] = useState<string | null>(null);
  const [dir, setDir] = useState<SortDir>("desc");
  const onSort = (key: string) => {
    if (key === sort) setDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSort(key); setDir("desc"); }
  };
  const sorted = useMemo(() => {
    const get = sort ? REFERRAL_SORT[sort] : null;
    if (!get) return rows;
    const mul = dir === "asc" ? 1 : -1;
    return [...rows].sort((x, y) => {
      const a = get(x), b = get(y);
      return (a < b ? -1 : a > b ? 1 : 0) * mul;
    });
  }, [rows, sort, dir]);

  return (
    <TableCard>
      <thead>
        <tr>
          <SortTh label="Pasiyent" sortKey="patientName" sort={sort} dir={dir} onSort={onSort} />
          <th>Yönləndirmə</th>
          <th>Növ</th>
          <th>Səbəb</th>
          <SortTh label="Tarix" sortKey="createdAt" sort={sort} dir={dir} onSort={onSort} />
          <SortTh label="Status" sortKey="status" sort={sort} dir={dir} onSort={onSort} />
          <th style={{ width: 130 }} />
        </tr>
      </thead>
      <tbody>
        {sorted.map(r => {
          const st = REFERRAL_STATUS_META[r.status] ?? { label: r.status, color: "var(--oxford-60)" };
          return (
            <tr key={r.id} onClick={() => onOpen(r)} style={{ cursor: "pointer" }}>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={`fx-avatar fx-avatar--${avatarTone(r.patientId)}`}>{initialsOf(r.patientName)}</span>
                  <span className="fx-row__title">{r.patientName ?? "—"}</span>
                </div>
              </td>
              <td>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontSize: 12.5 }}>
                  <span>{r.fromPsychologistName}</span>
                  <Svg w={13} sw={2.4} stroke="var(--oxford-60)" d={<path d="M5 12h14M13 6l6 6-6 6" />} />
                  <span>{r.toPsychologistName}</span>
                </span>
              </td>
              <td><span className="fx-muted" style={{ fontSize: 12.5 }}>{REFERRAL_SUBJECT_META[r.subjectType].label}</span></td>
              <td>
                <div style={{ fontSize: 12.5, color: "var(--oxford-80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }} title={r.reason}>
                  {r.reason}
                </div>
              </td>
              <td><span className="fx-muted fx-num" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{timeAgo(r.createdAt) || fmtDateTime(r.createdAt)}</span></td>
              <td><DotLabel color={st.color} label={st.label} /></td>
              <td onClick={e => e.stopPropagation()} style={{ textAlign: "right" }}>
                <button type="button" onClick={() => onOpen(r)} className="fx-btn fx-btn--ghost fx-btn--sm">
                  Ətraflı bax
                  <Svg w={13} sw={2.2} d={<path d="M9 18l6-6-6-6" />} />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableCard>
  );
}

// ─── Paketlər cədvəli — açılan sətir paketin seanslarını göstərir ─────────────

/** Paketlər tam siyahıdan (items) qruplaşdırılır — server səhifələməsi yoxdur,
 *  ona görə sıralama da client-side qalır (uydurma server paging qurulmur). */
const PACKAGE_SORT: Record<string, (g: AppointmentDetail[]) => string | number> = {
  packageName:      g => (g[0].packageName ?? "").toLowerCase(),
  patientName:      g => (g[0].patientName ?? "").toLowerCase(),
  psychologistName: g => (g[0].psychologistName ?? "").toLowerCase(),
  packageStatus:    g => (g[0].packageStatus ?? "ACTIVE").toLowerCase(),
};

function PackageTable({ groups, onOpen, onOpenSession }: {
  groups: AppointmentDetail[][];
  onOpen: (g: AppointmentDetail[]) => void;
  onOpenSession: (a: AppointmentDetail) => void;
}) {
  const [sort, setSort] = useState<string | null>(null);
  const [dir, setDir] = useState<SortDir>("desc");
  const onSort = (key: string) => {
    if (key === sort) setDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSort(key); setDir("desc"); }
  };
  const sorted = useMemo(() => {
    const get = sort ? PACKAGE_SORT[sort] : null;
    if (!get) return groups;
    const mul = dir === "asc" ? 1 : -1;
    return [...groups].sort((x, y) => {
      const a = get(x), b = get(y);
      return (a < b ? -1 : a > b ? 1 : 0) * mul;
    });
  }, [groups, sort, dir]);

  return (
    <TableCard>
      <thead>
        <tr>
          <th style={{ width: 34 }} />
          <th style={{ width: 40 }} />
          <SortTh label="Paket" sortKey="packageName" sort={sort} dir={dir} onSort={onSort} />
          <SortTh label="Pasiyent" sortKey="patientName" sort={sort} dir={dir} onSort={onSort} />
          <SortTh label="Psixoloq" sortKey="psychologistName" sort={sort} dir={dir} onSort={onSort} />
          <th>İrəliləyiş</th>
          <th>Növbəti seans</th>
          <SortTh label="Status" sortKey="packageStatus" sort={sort} dir={dir} onSort={onSort} />
          <th style={{ width: 150 }} />
        </tr>
      </thead>
      <tbody>
        {sorted.map(g => (
          <PackageRow key={`pkg-${g[0].patientPackageId}`} sessions={g} onOpen={() => onOpen(g)} onOpenSession={onOpenSession} />
        ))}
      </tbody>
    </TableCard>
  );
}

function PackageRow({ sessions, onOpen, onOpenSession }: {
  sessions: AppointmentDetail[]; onOpen: () => void; onOpenSession: (a: AppointmentDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const first = sessions[0];
  const total = first.packageTotal ?? sessions.length;
  const scheduledList = sessions
    .filter(s => s.startAt && s.status !== "CANCELLED")
    .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
  const scheduled = scheduledList.length;
  // completed = faktiki keçirilmiş seans; unscheduled = hələ vaxtı təyin olunmamış seans.
  const completed = first.packageCompleted ?? scheduledList.filter(s => s.status === "COMPLETED").length;
  const unscheduled = Math.max(0, total - scheduled);
  const statusKey = first.packageStatus ?? "ACTIVE";
  const st = PKG_STATUS[statusKey] ?? PKG_STATUS.ACTIVE;
  const needsAttention = statusKey === "ACTIVE" && unscheduled > 0;
  const upcoming = scheduledList.find(s => new Date(s.startAt!).getTime() >= now);
  const nextS = upcoming ?? (scheduledList.length ? scheduledList[scheduledList.length - 1] : null);
  const nextLabel = upcoming ? "Növbəti" : "Son seans";
  const attnText = needsAttention ? `${unscheduled} seans planlaşdırılmayıb` : "";
  const panelId = `pkg-sessions-${first.patientPackageId}`;

  return (
    <>
      <tr onClick={onOpen} style={{ cursor: "pointer" }} className={needsAttention ? "or-tr--attn or-tr--attn-amber" : undefined}>
        <td className="or-td-attn">{needsAttention && <AttnMark tone="amber" title={attnText} />}</td>
        <td onClick={e => e.stopPropagation()}>
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={panelId}
            title={open ? "Seansları gizlət" : "Seansları göstər"} className="fx-btn fx-btn--ghost fx-btn--sm">
            <Svg w={13} sw={2.4} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .12s" }} d={<path d="M9 18l6-6-6-6" />} />
          </button>
        </td>
        <td>
          <div className="fx-row__title">{first.packageName ?? "Paket"}</div>
          <div className="fx-muted fx-num" style={{ fontSize: 11.5 }}>#{first.patientPackageId}</div>
        </td>
        <td><span style={{ fontSize: 12.5 }}>{first.patientName ?? "—"}</span></td>
        <td>{first.psychologistName ? <span style={{ fontSize: 12.5 }}>{first.psychologistName}</span> : <span className="fx-muted">—</span>}</td>
        <td>
          {/* İrəliləyiş = KEÇİRİLMİŞ seans / alınmış seans. */}
          <span className="fx-num" style={{ fontSize: 13, fontWeight: 700, color: "var(--lilac)" }}>{completed}/{total}</span>
          <div className="fx-muted" style={{ fontSize: 11.5 }}>keçirilib</div>
          {attnText && <div className="or-alert-txt" style={{ color: "var(--status-pending-fg)" }}>{attnText}</div>}
        </td>
        <td>
          {nextS ? (
            <>
              <div className="fx-num" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{fmtDateTime(nextS.startAt)}</div>
              <div className="fx-muted" style={{ fontSize: 11.5 }}>{nextLabel}</div>
            </>
          ) : <span className="fx-muted">—</span>}
        </td>
        <td><DotLabel color={st.color} label={st.label} /></td>
        <td onClick={e => e.stopPropagation()} style={{ textAlign: "right" }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <RowContact phone={first.patientPhone} email={first.patientEmail} />
            <button type="button" onClick={onOpen} title="Seansları aç" className="fx-btn fx-btn--ghost fx-btn--sm">
              <Svg w={14} sw={2.4} d={<path d="M9 18l6-6-6-6" />} />
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="or-subrow">
          <td colSpan={9} id={panelId}>
            <table className="fx-table or-subtable">
              <thead>
                <tr>
                  <th>Seans</th>
                  <th>Tarix / saat</th>
                  <th>Psixoloq</th>
                  <th>Status</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.id} onClick={() => onOpenSession(s)} style={{ cursor: "pointer" }}>
                    <td className="fx-num">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <span>#{i + 1}</span>
                        <span>FNS-{String(s.id).padStart(4, "0")}</span>
                      </div>
                    </td>
                    <td className="fx-num" style={{ whiteSpace: "nowrap" }}>{s.startAt ? fmtDateTime(s.startAt) : <span className="fx-muted">Təyin edilməyib</span>}</td>
                    <td>{s.psychologistName ?? <span className="fx-muted">—</span>}</td>
                    <td><StatusDot status={s.status} /></td>
                    <td onClick={e => e.stopPropagation()} style={{ textAlign: "right" }}>
                      <button type="button" onClick={() => onOpenSession(s)} title="Seansı aç" className="fx-btn fx-btn--ghost fx-btn--sm">
                        <Svg w={13} sw={2.4} d={<path d="M9 18l6-6-6-6" />} />
                      </button>
                    </td>
                  </tr>
                ))}
                {unscheduled > 0 && (
                  <tr>
                    <td colSpan={5} className="fx-muted" style={{ fontStyle: "italic" }}>{unscheduled} seans hələ planlaşdırılmayıb</td>
                  </tr>
                )}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Ortaq kart primitivləri ─────────────────────────────────────────────────
// Üç kart növü (müraciət / yönləndirmə / paket) eyni ritmi paylaşır:
//   BAŞLIQ (avatar + ad + kimlik/vaxt + status)  →  SİQNAL (xəbərdarlıq)
//   →  FAKTLAR ("Etiket: dəyər" sətirləri)       →  ALT ZOLAQ (əlaqə | əməliyyat)
// Beləliklə operator gözü hər kartda eyni yerdə eyni məlumatı tapır.

const GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(320px, 100%), 1fr))", gap: 14, alignItems: "stretch" };
// Paket kartları öz tabında, öz ölçü standartı ilə — tək seans kartlarına görə dartılmır
const PKG_GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(340px, 100%), 1fr))", gap: 14, alignItems: "stretch" };

/** Klikə/klaviaturaya cavab verən kart qabığı — üç kartda da eyni davranış.
 *  `attention` diqqət tələb edən kartlara fx-card--attention amber zolağını verir. */
function CardShell({ onOpen, attention, children }: { onOpen: () => void; attention?: boolean; children: ReactNode }) {
  return (
    <div className={`fx-card or-card${attention ? " fx-card--attention" : ""}`} role="button" tabIndex={0}
      onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}>
      <div className="or-card__body">{children}</div>
    </div>
  );
}

/** Kart başlığı: avatar + başlıq + yardımçı sətir + sağda status. */
function CardHead({ avatar, title, meta, aside }: { avatar: ReactNode; title: ReactNode; meta?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="or-head">
      {avatar}
      <div className="or-head__main">
        <div className="or-title">{title}</div>
        {meta && <div className="or-meta">{meta}</div>}
      </div>
      {aside && <div className="or-head__aside">{aside}</div>}
    </div>
  );
}

/** "Etiket: dəyər" sətri (ikon + mətn) — nöqtə ilə yığılmış meta yığınının əvəzi. */
function Fact({ icon, label, value, color, italic }: {
  icon: ReactNode; label?: string; value: ReactNode; color?: string; italic?: boolean;
}) {
  return (
    <div className="or-fact">
      <span className="or-fact__ico">{icon}</span>
      <span className="or-fact__txt" style={{ color, fontStyle: italic ? "italic" : undefined }}>
        {label && <span className="or-fact__k">{label}: </span>}{value}
      </span>
    </div>
  );
}

/** Kart daxili xəbərdarlıq — dizayn sistemi banneri (fx-banner), yığcam ölçüdə. */
function CardBanner({ tone, text }: { tone: "warn" | "error" | "success"; text: ReactNode }) {
  return (
    <div className={`fx-banner fx-banner--${tone} or-banner`}>
      {tone === "success"
        ? <Svg w={14} sw={2.4} d={<path d="M20 6 9 17l-5-5" />} />
        : <Svg w={14} d={<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>} />}
      <span>{text}</span>
    </div>
  );
}

/** Əlaqə çipləri — kart açılışını tetikləmədən zəng/WhatsApp/e-poçt. */
function ContactChips({ phone, email }: { phone?: string | null; email?: string | null }) {
  const p = normalizePhone(phone);
  if (!p && !email) return null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div className="or-contact" onClick={stop}>
      {p && <a href={`tel:${p}`} onClick={stop} title={`Zəng et: ${phone}`} className="fx-chip"><IconPhone /> Zəng</a>}
      {p && <a href={whatsappLink(p)} target="_blank" rel="noopener noreferrer" onClick={stop} title={`WhatsApp: ${phone}`} className="fx-chip"><IconWhatsApp /> WhatsApp</a>}
      {email && <a href={`mailto:${email}`} onClick={stop} title={email} className="fx-chip"><IconMail /> Email</a>}
    </div>
  );
}

/** Alt zolaq: solda əlaqə, sağda əməliyyatlar — dar ekranda alt-alta düşür. */
function CardFoot({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="or-foot">
      {left}
      <div className="or-foot__actions">{right}</div>
    </div>
  );
}

function initialsOf(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
/** Avatar rəngi ID-dən deterministik seçilir — eyni kart hər yükləmədə eyni rəngdə. */
function avatarTone(seed: number): 1 | 2 | 3 | 4 {
  return ((Math.abs(seed) % 4) + 1) as 1 | 2 | 3 | 4;
}

// ─── Müraciət kartı ───────────────────────────────────────────────────────────

function AppointmentCard({
  a, meId, onTake, onOpen, hasPsyProposal = false,
}: {
  a: AppointmentDetail; meId: number | null; onTake?: () => void; onOpen: () => void; hasPsyProposal?: boolean;
}) {
  const { t } = useT();
  const status = a.status;
  const phone = normalizePhone(a.patientPhone);
  const hasContact = !!(phone || a.patientEmail);
  const claimMine = a.claimedByUserId != null && a.claimedByUserId === meId;
  const claimOther = a.claimedByUserId != null && !claimMine;
  // Sahiblik nişanı YALNIZ başqasının üzərində olanda göstərilir — operator
  // onsuz da yalnız öz sətirlərini görür, "Sənin üzərində" məlumat vermirdi.
  const showClaim = claimOther && !!a.claimedByName;
  const claimLabel = claimMine ? t("staff.opClaimMine") : (a.claimedByName ? t("staff.opClaimWorking", { name: a.claimedByName }) : "");
  const hasSeries = a.seriesId != null && a.seriesIndex != null && a.seriesTotal != null;
  const lastOutcome = a.lastContactOutcome ? OUTCOME_LABEL[a.lastContactOutcome] : null;
  const alert = buildAlert(a, hasPsyProposal);
  const canClaim = a.claimedByUserId == null && isPoolEligible(a.status) && !!onTake;

  // Təyinat sətri — "Etiket: dəyər" formasına bölünür (etiket + dəyər + vaxt)
  // Ad və vaxt ayrı span-larda — ayırıcı işarə yox, flex boşluğu ayırır.
  let assignLabel: string, assignValue: ReactNode, assignColor: string, assignItalic: boolean;
  if (a.psychologistName) {
    assignLabel = "Təyin olundu";
    assignValue = (
      <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8 }}>
        <span>{a.psychologistName}</span>
        <span className="fx-num">{fmtDateTime(a.startAt)}</span>
      </span>
    );
    assignColor = "var(--oxford)"; assignItalic = false;
  } else if (a.requestedPsychologistName) {
    assignLabel = a.origin === "DIRECT" ? "Müştəri seçdi" : "İstənilən";
    assignValue = (
      <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8 }}>
        <span>{a.requestedPsychologistName}</span>
        {a.requestedStartAt && <span className="fx-num">{fmtDateTime(a.requestedStartAt)}</span>}
      </span>
    );
    assignColor = a.origin === "DIRECT" ? "#15803D" : "var(--oxford-60)"; assignItalic = a.origin !== "DIRECT";
  } else {
    assignLabel = "";
    assignValue = "Psixoloq seçilməyib — operator təyin edəcək";
    assignColor = "var(--oxford-60)"; assignItalic = true;
  }

  // İkinci dərəcəli məlumat yalnız varsa ayrıca sətir tutur (boş yer yaratmır).
  // Cədvəl sətri ilə eyni qayda: rəngli çip yox, susqun mətn.
  const subMeta = showClaim || hasSeries || a.sessionKind === "INTRO";

  return (
    <CardShell onOpen={onOpen} attention={!!alert}>
      {/* 1 — BAŞLIQ: kim / nə vaxt / hansı statusda */}
      <CardHead
        avatar={<span className={`fx-avatar fx-avatar--sm fx-avatar--${avatarTone(a.id)}`}>{initialsOf(a.patientName)}</span>}
        title={a.patientName ?? "—"}
        meta={<>
          <span className="fx-num">#FNS-{String(a.id).padStart(4, "0")}</span>
          <span>{timeAgo(a.createdAt) || `${fmtDateTime(a.createdAt)} yaradılıb`}</span>
        </>}
        aside={<StatusDot status={status} />}
      />

      {subMeta && (
        <div className="or-submeta">
          {showClaim && <span>{claimLabel}</span>}
          {hasSeries && (
            <span className="fx-num">
              {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal ?? 0 })}
            </span>
          )}
          {a.sessionKind === "INTRO" && <><span>Tanışlıq</span><span>Pulsuz</span></>}
        </div>
      )}

      {/* 2 — SİQNAL: nəyə görə bu kart növbədə birincidir (ən üstdə, gözdən qaçmır) */}
      {alert && <CardBanner tone={alert.tone === "red" ? "error" : "warn"} text={alert.text} />}

      {/* 3 — FAKTLAR: hamısı eyni "ikon + Etiket: dəyər" ritmində */}
      <div className="or-facts">
        <Fact
          icon={<Svg w={14} d={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>} />}
          label={assignLabel || undefined} value={assignValue} color={assignColor} italic={assignItalic}
        />
        {a.operatorNote && (
          <Fact
            icon={<Svg w={14} d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>} />}
            label="Operator qeydi" value={a.operatorNote} color="var(--oxford-60)"
          />
        )}
        <Fact
          icon={<Svg w={14} d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />}
          label="Son izləmə"
          color="var(--oxford-60)"
          value={a.lastContactAt ? (
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8 }}>
              <span>{timeAgo(a.lastContactAt)}</span>
              {a.lastContactChannel && <span>{CHANNEL_LABEL[a.lastContactChannel] ?? a.lastContactChannel}</span>}
              {lastOutcome && <span style={{ color: FOLLOW_COLOR[lastOutcome.tone], fontWeight: 600 }}>{lastOutcome.label}</span>}
            </span>
          ) : "yoxdur"}
        />
      </div>

      {/* Pasiyentin öz sözləri — sitat kimi qalır, faktlardan sonra */}
      {a.note && (
        <div className="or-quote">
          <div className="fx-label">Mövzu</div>
          <div className="or-quote__txt">«{a.note}»</div>
        </div>
      )}

      {/* 4 — ALT ZOLAQ: solda əlaqə, sağda əməliyyat */}
      <CardFoot
        left={hasContact ? <ContactChips phone={a.patientPhone} email={a.patientEmail} /> : undefined}
        right={<>
          {canClaim && (
            <button type="button" onClick={e => { e.stopPropagation(); onTake?.(); }} className="fx-btn fx-btn--primary fx-btn--sm">
              <Svg w={14} d={<><path d="M5 12h14M12 5l7 7-7 7" /></>} /> {t("staff.opTake")}
            </button>
          )}
          <button type="button" onClick={e => { e.stopPropagation(); onOpen(); }} className={`fx-btn fx-btn--sm ${canClaim ? "fx-btn--ghost" : "fx-btn--primary"}`}>
            <Svg w={14} d={<><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>} /> {t("staff.opOpenTicket")}
          </button>
        </>}
      />
    </CardShell>
  );
}

// ─── Yönləndirmə kartı — psixoloqdan psixoloqa keçid təsdiqi gözləyir ─────────

// Yalnız etiket qalır — "Növ" dekorativ çip deyil, susqun mətndir.
const REFERRAL_SUBJECT_META: Record<"APPOINTMENT" | "PACKAGE", { label: string }> = {
  APPOINTMENT: { label: "Randevu" },
  PACKAGE:     { label: "Paket" },
};

function ReferralCard({ r, onOpen }: { r: Referral; onOpen: () => void }) {
  const subj = REFERRAL_SUBJECT_META[r.subjectType];
  return (
    <CardShell onOpen={onOpen}>
      {/* Kart onsuz da "Yönləndirmələr" tabındadır — təkrar "Yönləndirmə" nişanı yoxdur */}
      <CardHead
        avatar={
          <span className="fx-avatar fx-avatar--sm fx-avatar--3">
            <Svg w={15} sw={2.2} d={<><path d="M17 3l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 21l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>} />
          </span>
        }
        title={<span className="or-title__flow">
          <span>{r.fromPsychologistName}</span>
          <Svg w={13} sw={2.4} stroke="var(--oxford-60)" d={<path d="M5 12h14M13 6l6 6-6 6" />} />
          <span>{r.toPsychologistName}</span>
        </span>}
        meta={<span>{timeAgo(r.createdAt) || fmtDateTime(r.createdAt)}</span>}
        aside={<span className="fx-muted" style={{ fontSize: 12, fontWeight: 600 }}>{subj.label}</span>}
      />

      <div className="or-facts">
        {r.patientName && (
          <Fact
            icon={<Svg w={14} d={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>} />}
            label="Pasiyent" value={r.patientName}
          />
        )}
        <Fact
          icon={<Svg w={14} d={<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>} />}
          label="Səbəb" value={r.reason} color="var(--oxford-60)"
        />
      </div>

      <CardFoot right={
        <button type="button" onClick={e => { e.stopPropagation(); onOpen(); }} className="fx-btn fx-btn--ghost fx-btn--sm">
          Ətraflı bax
          <Svg w={13} sw={2.2} d={<path d="M9 18l6-6-6-6" />} />
        </button>
      } />
    </CardShell>
  );
}

// ─── Paket kartı — siyahıda adi kart; klik → paketin öz səhifəsi ─────────────

// Fon (bg) artıq lazım deyil — status nöqtə + mətn kimi göstərilir.
const PKG_STATUS: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: "Ödəniş gözlənilir", color: "var(--status-pending-fg)" },
  ACTIVE:    { label: "Aktiv",       color: "var(--status-paid-fg)" },
  EXHAUSTED: { label: "Tamamlanıb",  color: "var(--status-cancelled-fg)" },
  EXPIRED:   { label: "Vaxtı keçib", color: "var(--status-pending-fg)" },
  CANCELLED: { label: "Ləğv",        color: "var(--status-refunded-fg)" },
};

function PackageCard({ sessions, onOpen }: { sessions: AppointmentDetail[]; onOpen: () => void }) {
  const first = sessions[0];
  const total = first.packageTotal ?? sessions.length;
  const scheduledList = sessions
    .filter(s => s.startAt && s.status !== "CANCELLED")
    .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
  const scheduled = scheduledList.length;
  // completed = faktiki keçirilmiş seans; unscheduled = hələ vaxtı təyin olunmamış seans.
  const completed = first.packageCompleted ?? scheduledList.filter(s => s.status === "COMPLETED").length;
  const unscheduled = Math.max(0, total - scheduled);
  const statusKey = first.packageStatus ?? "ACTIVE";
  const st = PKG_STATUS[statusKey] ?? PKG_STATUS.ACTIVE;
  const needsAttention = statusKey === "ACTIVE" && unscheduled > 0;

  // Nöqtə-zolağı: hər dolu seans statusuna görə rəngli, planlaşdırılmamış xanalar amber halqa
  const dots: { key: string; kind: "completed" | "confirmed" | "empty" }[] = [];
  for (const s of scheduledList) dots.push({ key: `s${s.id}`, kind: s.status === "COMPLETED" ? "completed" : "confirmed" });
  for (let i = 0; i < unscheduled; i++) dots.push({ key: `e${i}`, kind: "empty" });

  // Növbəti seans (gələcəkdə ən yaxın) — yoxdursa son keçmiş seans
  const [now] = useState(() => Date.now());
  const upcoming = scheduledList.find(s => new Date(s.startAt!).getTime() >= now);
  const nextS = upcoming ?? (scheduledList.length ? scheduledList[scheduledList.length - 1] : null);
  const nextLabel = upcoming ? "Növbəti" : "Son seans";

  return (
    <CardShell onOpen={onOpen} attention={needsAttention}>
      {/* Kart onsuz da Paketlər tabındadır — "Paket" nişanına ehtiyac yoxdur */}
      <CardHead
        avatar={
          <span className="fx-avatar fx-avatar--sm fx-avatar--3">
            <Svg w={16} d={<><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></>} />
          </span>
        }
        title={first.packageName ?? "Paket"}
        meta={<>
          <span>{first.patientName ?? "—"}</span>
          {first.psychologistName && <span>{first.psychologistName}</span>}
        </>}
        aside={<DotLabel color={st.color} label={st.label} />}
      />

      {/* Nöqtə-zolağı + say — paketin bir baxışda irəliləyişi */}
      <div className="or-dots">
        <div className="or-dots__strip">
          {dots.map(dot => (
            <span key={dot.key} title={dot.kind === "empty" ? "Planlaşdırılmayıb" : dot.kind === "completed" ? "Keçirilib" : "Təyin olunub"}
              style={{
                width: 11, height: 11, borderRadius: 999, flex: "none",
                background: dot.kind === "completed" ? "var(--sage)" : dot.kind === "confirmed" ? "var(--brand)" : "transparent",
                border: dot.kind === "empty" ? "2px solid var(--amber)" : "none",
                boxSizing: "border-box",
              }} />
          ))}
        </div>
        {/* Sayğac = keçirilmiş seans / alınmış seans. */}
        <span className="fx-num or-dots__count">{completed}/{total}</span>
      </div>

      {/* Vəziyyət siqnalı — müraciət kartındakı bannerlə eyni komponent */}
      {needsAttention
        ? <CardBanner tone="warn" text={`${unscheduled} seans planlaşdırılmayıb`} />
        : <CardBanner tone="success" text="Bütün seanslar planlaşdırılıb" />}

      {nextS && (
        <div className="or-facts">
          <Fact
            icon={<Svg w={14} sw={2} stroke="var(--brand)" d={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />}
            label={nextLabel}
            value={
              <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8 }}>
                <span className="fx-num">{fmtDateTime(nextS.startAt)}</span>
                {nextS.psychologistName && <span>{nextS.psychologistName}</span>}
              </span>
            }
          />
        </div>
      )}

      <CardFoot
        left={<ContactChips phone={first.patientPhone} email={first.patientEmail} />}
        right={
          <button type="button" onClick={e => { e.stopPropagation(); onOpen(); }} className="fx-btn fx-btn--ghost fx-btn--sm">
            Seansları aç
            <Svg w={13} sw={2.4} d={<path d="M9 18l6-6-6-6" />} />
          </button>
        }
      />
    </CardShell>
  );
}

// ─── Skeleton + boş ───────────────────────────────────────────────────────────

/** Skeleton həqiqi kartın ritmini təkrarlayır (avatar → başlıq → faktlar → alt zolaq),
 *  ona görə yüklənmə bitəndə layout sıçramır. */
function SkeletonCards() {
  return (
    <div style={GRID} aria-busy="true">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="fx-card">
          <div className="or-card__body">
            <div className="or-head">
              <div className="fx-skeleton fx-skeleton--circle" style={{ width: 30, height: 30 }} />
              <div className="or-head__main">
                <div className="fx-skeleton" style={{ width: "60%", height: 14, borderRadius: 6, marginBottom: 6 }} />
                <div className="fx-skeleton" style={{ width: "42%", height: 10, borderRadius: 6 }} />
              </div>
              <div className="fx-skeleton" style={{ width: 62, height: 18, borderRadius: 999 }} />
            </div>
            <div className="or-facts">
              <div className="fx-skeleton" style={{ width: "88%", height: 12, borderRadius: 6 }} />
              <div className="fx-skeleton" style={{ width: "66%", height: 12, borderRadius: 6 }} />
            </div>
            <div className="or-foot">
              <div className="fx-skeleton" style={{ width: 78, height: 28, borderRadius: 999 }} />
              <div className="or-foot__actions">
                <div className="fx-skeleton" style={{ width: 96, height: 30, borderRadius: 9 }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Cədvəl skeletonu — operator/customers səhifəsindəki sətir skeletonu ilə eyni ritm. */
function SkeletonTable() {
  return (
    <div className="fx-card" style={{ overflow: "hidden" }} aria-busy="true">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="fx-row" style={{ borderTop: "none", borderBottom: "1px solid var(--hairline)", cursor: "default" }}>
          <div className="fx-skeleton fx-skeleton--circle" style={{ width: 34, height: 34 }} />
          <div style={{ flex: 1 }}>
            <div className="fx-skeleton" style={{ height: 12, width: "34%" }} />
            <div className="fx-skeleton" style={{ height: 9, width: "20%", marginTop: 8 }} />
          </div>
          <div className="fx-skeleton" style={{ width: 84, height: 18, borderRadius: 999 }} />
          <div className="fx-skeleton" style={{ width: 110, height: 30, borderRadius: 9, marginLeft: 12 }} />
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

// Yalnız kart daxilindəki yerləşim (boşluq/sıra/kəsilmə) — rəng, kölgə, şrift və
// bütün vizual dil fx-* siniflərindən və mövcud CSS dəyişənlərindən gəlir.
const CSS = `
.or-card{transition:box-shadow .15s,border-color .15s;cursor:pointer;overflow:hidden;display:flex;flex-direction:column}
.or-card:hover{box-shadow:var(--shadow-md)}
.or-card__body{padding:15px 16px;display:flex;flex-direction:column;gap:11px;flex:1;min-width:0}

/* Başlıq */
.or-head{display:flex;align-items:flex-start;gap:11px}
.or-head__main{min-width:0;flex:1}
.or-head__aside{flex:none;display:flex;align-items:center;gap:6px}
.or-title{font-size:14.5px;font-weight:700;color:var(--oxford);line-height:1.3;overflow-wrap:anywhere}
.or-title__flow{display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap}
.or-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:2px;font-size:12px;font-weight:600;color:var(--oxford-60)}
.or-meta .fx-sep{color:var(--brand-200)}
/* İkinci dərəcəli meta (sahiblik / seriya / tanışlıq) — çip yox, susqun mətn */
.or-submeta{display:flex;align-items:center;gap:4px 10px;flex-wrap:wrap;font-size:11.5px;font-weight:600;color:var(--oxford-60)}

/* Status siqnalı — kiçik nöqtə + adi mətn (dolu pill əvəzi) */
.or-status{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--oxford);white-space:nowrap}
.or-status__dot{width:7px;height:7px;border-radius:50%;flex:none}

/* Sıralanan cədvəl başlığı — th-ın öz tipoqrafiyasını miras alır */
.or-th{display:inline-flex;align-items:center;gap:5px;background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit;cursor:pointer}
.or-th:hover{color:var(--oxford)}

/* Fakt sətirləri */
.or-facts{display:flex;flex-direction:column;gap:7px}
.or-fact{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;line-height:1.45;min-width:0}
.or-fact__ico{flex:none;margin-top:1px;color:var(--oxford-60);display:inline-flex}
.or-fact__txt{min-width:0;overflow-wrap:anywhere;color:var(--oxford)}
.or-fact__k{color:var(--oxford-60);font-weight:600}

/* Sitat (pasiyentin öz sözləri) */
.or-quote{background:var(--brand-50);border:1px solid var(--brand-100);border-radius:10px;padding:8px 11px}
.or-quote__txt{margin-top:3px;font-size:12.5px;line-height:1.45;font-style:italic;color:var(--oxford);overflow-wrap:anywhere}

/* Kart daxili banner — fx-banner-in yığcam variantı */
.or-banner{padding:9px 11px;border-radius:10px;font-size:12.5px;line-height:1.45;align-items:flex-start}

/* Paket nöqtə-zolağı */
.or-dots{display:flex;align-items:center;gap:10px}
.or-dots__strip{display:flex;flex-wrap:wrap;gap:5px;flex:1}
.or-dots__count{font-size:13px;font-weight:700;color:var(--lilac);flex:none}

/* Görünüş dəyişimi — geniş ekran: cədvəl, dar ekran: kart (yalnız yerləşim) */
.or-wide{display:block}
.or-narrow{display:none}
@media (max-width:1024px){.or-wide{display:none}.or-narrow{display:block}}

/* Diqqət tələb edən cədvəl sətri — kartdakı fx-card--attention-in sətir qarşılığı */
.or-td-attn{width:34px;padding-right:0!important;text-align:center}
.or-tr--attn td{background:var(--status-pending-bg)}
.or-tr--attn-red td{background:var(--status-refunded-bg)}
.or-tr--attn td:first-child{box-shadow:inset 3px 0 0 var(--amber)}
.or-tr--attn-red td:first-child{box-shadow:inset 3px 0 0 var(--rose)}
.or-alert-txt{font-size:11.5px;font-weight:600;line-height:1.35;max-width:280px;margin-top:3px;white-space:normal}

/* Paketin açılan seans siyahısı */
.or-subrow>td{background:var(--surface-muted);padding:0!important}
.or-subtable{font-size:12.5px}
.or-subtable th{padding:8px 16px;background:transparent}
.or-subtable td{padding:9px 16px}
.or-subtable tbody tr:last-child td{border-bottom:none}

/* Alt zolaq */
.or-contact{display:flex;gap:6px;flex-wrap:wrap}
.or-foot{margin-top:auto;padding-top:11px;border-top:1px solid var(--hairline);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.or-foot__actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
`;
