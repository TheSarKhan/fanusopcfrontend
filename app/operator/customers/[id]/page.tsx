"use client";

// Modul H — operator müştəri profili (360° görünüş, Fanus UI Kit).
// Pasiyentin qeydiyyatı, seans bölgüsü, ödənişlər, paketlər, test nəticələri,
// rəylər, qayğı paneli, operator qeydləri (CRM) və fəaliyyət jurnalı bir səhifədə.
// Modul G məxfi sahələri (təcili əlaqə/ünvan) açıq işarələnir.

import { use, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { operatorApi, type CustomerProfile, type CustomerNote, type Psychologist, type PackageDto, type AvailableSlot, type IntroEligibility } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { isoToAzLocal, azFormatDate, azFormatTime, azLocalToISO } from "@/lib/datetime";
import { toast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";
import DatePicker from "@/components/DatePicker";
import OnBehalfBookingModal from "@/components/OnBehalfBookingModal";
import { Icon } from "../icons";

// ─── Köməkçilər ──────────────────────────────────────────────────────────────
const MONTHS_AZ = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
/** Jurnal/sətir tarixləri üçün "5 iyul" tipli qısa format. */
function fmtShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS_AZ[d.getMonth()]}`;
}
function fmtShortTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${fmtShort(iso)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function monthsSince(iso?: string | null): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
}
function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}
const fmtNum = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
function initialsOf(name?: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}
function avatarVariant(id: number) { return (Math.abs(id) % 4) + 1; }
/** datetime-local stringinə dəqiqə əlavə edir, yenə datetime-local formatı qaytarır. */
function addMinutes(local: string, mins: number): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  d.setMinutes(d.getMinutes() + mins);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function dateOnly(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Gözlənilir", NEW: "Yeni", REJECTED: "Yenidən təyin", IN_REVIEW: "Operatorda",
  ASSIGNED: "Təyin edilib", CONFIRMED: "Təsdiqlənib", AWAITING_CONFIRMATION: "Təsdiq gözlənir",
  DISPUTED: "Mübahisəli", COMPLETED: "Tamamlanıb", CANCELLED: "Ləğv edilib", CANCEL_REQUESTED: "Ləğv gözlənir",
  PAID: "Ödənilib", PARTIALLY_REFUNDED: "Qismi qaytarılıb", REFUNDED: "Geri qaytarılıb",
  ACTIVE: "Aktiv", EXPIRED: "Bitib", PUBLISHED: "Dərc edilib", HIDDEN: "Gizli",
};
function statusLabel(s: string): string { return STATUS_LABEL[s] ?? s; }

const FLAG_LABEL: Record<string, string> = {
  HIGH_NO_SHOW: "Yüksək no-show", HIGH_LATE_CANCEL: "Yüksək gec ləğv", HIGH_REJECT: "Yüksək rədd",
};
const ACTIVITY_LABEL: Record<string, string> = {
  AUDIT: "Audit", SUPPORT: "Dəstək", APPOINTMENT: "Randevu", TEST: "Test",
};

const PILL_CLASS: Record<string, string> = {
  PENDING: "fx-pill--pending", PAID: "fx-pill--paid", PARTIALLY_REFUNDED: "fx-pill--partial",
  REFUNDED: "fx-pill--refunded", CANCELLED: "fx-pill--cancelled",
};
function pillClass(status: string) { return PILL_CLASS[status] ?? "fx-pill--neutral"; }

const PKG_TEXT: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: "Ödəniş gözlənilir", color: "var(--amber)" },
  ACTIVE: { label: "Aktiv", color: "var(--sage)" },
  EXHAUSTED: { label: "Tamamlanıb", color: "var(--oxford-60)" },
  EXPIRED: { label: "Vaxtı keçib", color: "var(--amber)" },
  CANCELLED: { label: "Ləğv", color: "var(--rose)" },
};

type DotTone = "seans" | "pay" | "pkg" | "test" | "care" | "sys";
const DOT: Record<DotTone, { bg: string; ring: string }> = {
  seans: { bg: "var(--brand)", ring: "var(--brand-100)" },
  pay: { bg: "var(--sage)", ring: "var(--sage-bg)" },
  pkg: { bg: "var(--lilac)", ring: "var(--lilac-bg)" },
  test: { bg: "var(--amber)", ring: "var(--amber-bg)" },
  care: { bg: "var(--rose)", ring: "var(--rose-bg)" },
  sys: { bg: "var(--oxford-60)", ring: "var(--status-cancelled-bg)" },
};
interface JEvent { key: string; title: string; detail: string; at: string; dot: DotTone }

const UPCOMING_STATUSES = new Set(["ASSIGNED", "CONFIRMED", "AWAITING_CONFIRMATION"]);

export default function OperatorCustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = use(params);
  const patientId = Number(idStr);

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [sellOpen, setSellOpen] = useState(false);
  const [sellMode, setSellMode] = useState<"catalog" | "custom" | "single">("catalog");
  const [bookOpen, setBookOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [resendingActivation, setResendingActivation] = useState(false);
  const [introStatus, setIntroStatus] = useState<IntroEligibility | null>(null);
  const [grantingIntro, setGrantingIntro] = useState(false);
  const [schedulePkg, setSchedulePkg] = useState<CustomerProfile["packages"][number] | null>(null);

  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteDraft, setNoteDraft] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  // "İndi" anını render-dən kənarda (state initializer-də) təsbit edirik ki,
  // useMemo daxilində Date.now() birbaşa çağırılmasın (React saflıq qaydası).
  const [nowTs] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(patientId)) { setError(true); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setError(false);
    operatorApi.customerProfile(patientId)
      .then(p => { if (alive) setProfile(p); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [patientId, reloadKey]);

  useEffect(() => {
    if (!Number.isFinite(patientId)) return;
    let alive = true;
    setNotesLoading(true);
    operatorApi.customerNotes(patientId)
      .then(list => { if (alive) setNotes(list); })
      .catch(() => { if (alive) setNotes([]); })
      .finally(() => { if (alive) setNotesLoading(false); });
    return () => { alive = false; };
  }, [patientId]);

  useEffect(() => {
    if (!Number.isFinite(patientId)) return;
    let alive = true;
    operatorApi.freeIntroStatus(patientId)
      .then(s => { if (alive) setIntroStatus(s); })
      .catch(() => { if (alive) setIntroStatus(null); });
    return () => { alive = false; };
  }, [patientId, reloadKey]);

  // Operator bu düymə ilə pasiyentə 1 əlavə pulsuz tanışlıq seansı aç/bağlayır
  // (aç = 1, bağla = 0) — sadə açar, artırıb-azaltma yoxdur.
  const toggleIntroGrant = async () => {
    if (grantingIntro || !introStatus) return;
    const next = introStatus.extraGrantsConfigured > 0 ? 0 : 1;
    setGrantingIntro(true);
    try {
      const s = await operatorApi.setFreeIntroGrants(patientId, next);
      setIntroStatus(s);
      toast(next > 0 ? "Əlavə pulsuz tanışlıq açıldı" : "Əlavə pulsuz tanışlıq bağlandı", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setGrantingIntro(false);
    }
  };

  const toggleBlock = async () => {
    const h = profile?.history;
    if (!h?.userId || blocking) return;
    if (h.blocked) {
      if (!(await confirmDialog({ title: "Bloku aç", message: "Bu istifadəçinin blokunu açmaq istəyirsiniz?", confirmLabel: "Aç" }))) return;
    } else {
      if (!(await confirmDialog({ title: "İstifadəçini blokla", message: "Bu pasiyenti bloklamaq istəyirsiniz?", confirmLabel: "Blokla", danger: true }))) return;
    }
    setBlocking(true);
    try {
      if (h.blocked) { await operatorApi.unblockUser(h.userId); toast("Blok açıldı", "success"); }
      else { await operatorApi.blockUser(h.userId, ""); toast("İstifadəçi bloklandı", "success"); }
      setReloadKey(k => k + 1);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBlocking(false);
    }
  };

  const resendActivation = async () => {
    if (resendingActivation) return;
    setResendingActivation(true);
    try {
      await operatorApi.resendActivationInvite(patientId);
      toast("Aktivləşdirmə dəvəti yenidən göndərildi", "success");
    } catch (e) {
      toast((e as Error).message || "Göndərilmədi", "error");
    } finally {
      setResendingActivation(false);
    }
  };

  const submitNote = async () => {
    const text = noteDraft.trim();
    if (!text) { toast("Qeyd boşdur", "error"); return; }
    setAddingNote(true);
    try {
      const n = await operatorApi.addCustomerNote(patientId, text);
      setNotes(prev => [n, ...prev]);
      setNoteDraft("");
      toast("Qeyd əlavə edildi", "success");
    } catch (e) {
      toast((e as Error).message || "Qeyd əlavə edilmədi", "error");
    } finally {
      setAddingNote(false);
    }
  };

  // ── Törənmiş dəyərlər (yalnız profile mövcud olanda) ──────────────────────
  const derived = useMemo(() => {
    if (!profile) return null;
    const h = profile.history;

    const paidLike = profile.payments.filter(p => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED");
    const ltv = paidLike.reduce((a, p) => a + (p.amount - (p.refundedAmount ?? 0)), 0);
    const avgSession = profile.completedCount > 0 ? Math.round(ltv / profile.completedCount) : null;
    const pendingBalance = profile.payments.filter(p => p.status === "PENDING").reduce((a, p) => a + p.amount, 0);

    // Ödənişi hələ təsdiqlənməmiş paket də operator üçün "cari"dir — KPI-dan yox olmasın.
    const activePkgs = profile.packages.filter(p => p.status === "ACTIVE" || p.status === "PENDING_PAYMENT");
    // remaining = planlaşdırılmamış (rezerv) seans; completed = faktiki keçirilmiş seans.
    const pkgUnscheduled = activePkgs.reduce((a, p) => a + p.remaining, 0);
    const pkgCompleted = activePkgs.reduce((a, p) => a + p.completed, 0);
    const pkgTotal = activePkgs.reduce((a, p) => a + p.total, 0);

    const upcoming = profile.appointments
      .filter(a => a.startAt && new Date(a.startAt).getTime() > nowTs && UPCOMING_STATUSES.has(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
    const nextSession = upcoming[0] ?? null;

    const events: JEvent[] = [];
    for (const p of profile.payments) {
      const at = p.paidAt ?? p.createdAt ?? null;
      if (at) {
        const link = p.patientPackageId != null ? "Paket ödənişi" : p.appointmentId != null ? `Seans #${p.appointmentId}` : "—";
        events.push({
          key: `pay-${p.id}`,
          title: p.status === "PENDING" ? `Ödəniş gözləyir — ${fmtNum(p.amount)} AZN (${p.method || "—"})` : `Ödəniş — ${fmtNum(p.amount)} AZN (${p.method || "—"})`,
          detail: link, at, dot: "pay",
        });
      }
      const refunded = p.refundedAmount ?? 0;
      if (refunded > 0) {
        events.push({
          key: `ref-${p.id}`,
          title: `İadə — ${fmtNum(refunded)} AZN`,
          detail: p.statusNote ? `«${p.statusNote}»` : "Geri qaytarma icra edildi",
          at: at ?? new Date().toISOString(), dot: "care",
        });
      }
    }
    for (const pkg of profile.packages) {
      if (pkg.purchasedAt) {
        events.push({
          key: `pkg-${pkg.id}`,
          title: `Paket alışı — ${pkg.packageName}`,
          detail: [pkg.psychologistName, pkg.pricePaid != null ? formatAzn(pkg.pricePaid) : null].filter(Boolean).join(", ") || "—",
          at: pkg.purchasedAt, dot: "pkg",
        });
      }
    }
    for (const tr of profile.testResults) {
      if (tr.submittedAt) {
        events.push({
          key: `test-${tr.assignmentId}`,
          title: `Test tamamlandı — ${tr.testTitle}`,
          detail: [tr.totalScore != null && tr.maxScore != null ? `${tr.totalScore}/${tr.maxScore}` : null, tr.scaleLabel].filter(Boolean).join(", ") || "—",
          at: tr.submittedAt, dot: "test",
        });
      }
    }
    for (const r of profile.reviewsGiven) {
      if (r.createdAt) {
        events.push({
          key: `rev-${r.id}`,
          title: `Rəy verildi — ${r.rating} ulduz`,
          detail: [r.psychologistName, r.comment ? `«${r.comment}»` : null].filter(Boolean).join(", ") || "—",
          at: r.createdAt, dot: "seans",
        });
      }
    }
    // Seanslar — HƏR seans (paylı/pulsuz fərq etməz) açıq "Seans" event-i kimi.
    // Əvvəllər seanslar timeline-da yalnız ÖDƏNİŞ event-i ilə görünürdü; pulsuz
    // tanışlıq (INTRO) ödəniş yaratmadığı üçün müştəri tarixçəsində görünmürdü.
    for (const s of profile.appointments) {
      const at = s.startAt ?? s.createdAt;
      if (!at) continue;
      const isIntro = s.sessionKind === "INTRO";
      events.push({
        key: `appt-${s.id}`,
        title: `${isIntro ? "Tanışlıq seansı" : "Seans"} — ${STATUS_LABEL[s.status] ?? s.status}`,
        detail: s.psychologistName ?? "—",
        at, dot: "seans",
      });
    }
    for (const ev of profile.activity) {
      // Seans (APPOINTMENT) event-ləri artıq yuxarıda profile.appointments-dən
      // açıq şəkildə qurulur — burada təkrarlamırıq.
      if (ev.type === "APPOINTMENT") continue;
      const tone: DotTone = ev.type === "SUPPORT" ? "care" : ev.type === "TEST" ? "test" : "sys";
      events.push({
        key: `act-${ev.at}-${ev.action ?? ""}`,
        title: ev.action || ACTIVITY_LABEL[ev.type] || ev.type,
        detail: ev.summary ?? "—",
        at: ev.at, dot: tone,
      });
    }
    if (h.registeredAt) events.push({ key: "reg", title: "Platformada qeydiyyat", detail: "—", at: h.registeredAt, dot: "sys" });
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const careDetail = h.autoFlag === "HIGH_NO_SHOW"
      ? `${h.noShowCount} dəfə seansa gəlməyib. Sistem avtomatik nişan qoyub.`
      : h.autoFlag === "HIGH_LATE_CANCEL"
      ? `${h.lateCancelCount} dəfə gec ləğv edib. Sistem avtomatik nişan qoyub.`
      : h.autoFlag === "HIGH_REJECT"
      ? `${h.rejectedCount} təyinatı rədd edib. Sistem avtomatik nişan qoyub.`
      : "";
    const careTip = h.autoFlag === "HIGH_NO_SHOW"
      ? `Tövsiyə: ${h.noShowCount} no-show — növbəti seansdan bir gün əvvəl təsdiq zəngi edin.`
      : h.autoFlag === "HIGH_LATE_CANCEL"
      ? `Tövsiyə: ${h.lateCancelCount} gec ləğv — seans xatırlatmasını daha erkən göndərin.`
      : h.autoFlag === "HIGH_REJECT"
      ? `Tövsiyə: ${h.rejectedCount} rədd — uyğun psixoloq təklifini yenidən nəzərdən keçirin.`
      : "";

    return { ltv, avgSession, pendingBalance, pkgUnscheduled, pkgCompleted, pkgTotal, nextSession, events, careDetail, careTip };
  }, [profile, nowTs]);

  if (loading) {
    return (
      <div className="panel-page">
        <Cust360Skeleton />
      </div>
    );
  }
  if (error || !profile || !derived) {
    return (
      <div className="panel-page">
        <div className="fx-card fx-card--error" style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center" }}>
          <Icon name="alert" className="fx-icon fx-icon--xl" style={{ color: "var(--rose)" }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>Profil yüklənmədi</div>
          <div style={{ fontSize: 11.5, color: "var(--oxford-60)" }}>Serverlə əlaqə kəsildi. Bir az sonra yenidən yoxlayın</div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" className="fx-btn fx-btn--ghost fx-btn--sm" onClick={() => setReloadKey(k => k + 1)}>
              <Icon name="refresh" className="fx-icon fx-icon--sm" />Yenidən cəhd et
            </button>
            <Link href="/operator/customers" className="fx-btn fx-btn--ghost fx-btn--sm">Axtarışa qayıt</Link>
          </div>
        </div>
      </div>
    );
  }

  const h = profile.history;
  const av = avatarVariant(patientId);
  const lastLoginDays = daysSince(profile.lastLogin);
  const months = monthsSince(h.registeredAt);

  return (
    <div className="panel-page">
      <style>{CUST_CSS}</style>

      {sellOpen && (
        <SellPackageModal
          patientId={patientId}
          initialMode={sellMode}
          onClose={() => setSellOpen(false)}
          onDone={(name, isSingle) => { setSellOpen(false); setReloadKey(k => k + 1); toast(isSingle ? "Tək seans satıldı, ödəniş PENDING" : `Paket satıldı: ${name}, ödəniş PENDING`, "success"); }}
        />
      )}
      {schedulePkg && (
        <SchedulePackageSessionModal
          patientId={patientId}
          pkg={schedulePkg}
          onClose={() => setSchedulePkg(null)}
          onDone={() => { setSchedulePkg(null); setReloadKey(k => k + 1); toast("Seans planlandı, təsdiqləndi", "success"); }}
        />
      )}
      {bookOpen && (
        <OnBehalfBookingModal
          presetPatientId={patientId}
          presetPatientLabel={h.name}
          onClose={() => setBookOpen(false)}
          onDone={() => { setBookOpen(false); setReloadKey(k => k + 1); toast("Randevu yaradıldı", "success"); }}
        />
      )}

      {/* Breadcrumb */}
      <div className="fx-breadcrumb" style={{ marginBottom: 18 }}>
        <Link href="/operator/customers">Müştərilər</Link>
        <Icon name="chevron-right" className="fx-icon" style={{ width: 12, height: 12 }} />
        <span className="fx-current">{h.name}</span>
      </div>

      {/* 1) HERO */}
      <div className="fx-card fx-card--lg cust-hero" style={{ marginBottom: 14 }}>
        <div style={{ flex: "1.3 1 420px", display: "flex", gap: 20, padding: "26px 30px", alignItems: "center" }}>
          <span className={`fx-avatar fx-avatar--lg fx-avatar--${av}`}>{initialsOf(h.name)}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 className="fx-h2">{h.name}</h1>
              {h.blocked && <span className="fx-pill fx-pill--refunded">Bloklanıb</span>}
              {h.autoFlag && (
                <span className="fx-pill" style={{ background: "var(--status-pending-bg)", color: "var(--status-pending-fg)" }}>
                  <Icon name="alert" className="fx-icon fx-icon--sm" />Diqqət — {FLAG_LABEL[h.autoFlag] ?? h.autoFlag}
                </span>
              )}
              {months > 0 && <span className="fx-pill fx-pill--info fx-num">Üzv: {months} aydır</span>}
              {introStatus && (
                <span className="fx-pill fx-pill--info">
                  Tanışlıq: {introStatus.usedCount === 0 ? "1 pulsuz haqqı var"
                    : introStatus.extraGrantsConfigured > 0 ? "əlavə pulsuz haqqı aktivdir"
                    : "haqqı bitib"}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {h.phone && <span className="fx-chip fx-num"><Icon name="phone" className="fx-icon fx-icon--sm" />{h.phone}</span>}
              {h.email && <span className="fx-chip"><Icon name="mail" className="fx-icon fx-icon--sm" />{h.email}</span>}
              <span style={{ fontSize: 12, color: "var(--oxford-60)" }}>Qeydiyyat: {fmtDate(h.registeredAt)}</span>
            </div>
          </div>
        </div>
        <div className="fx-kpi-row cust-hero-kpis" style={{ flex: "1.4 1 420px", gridTemplateColumns: "repeat(4,1fr)", borderLeft: "1px solid var(--hairline)" }}>
          <div className="fx-kpi">
            <span className="fx-label">Ümumi xərc</span>
            <span className="fx-kpi__value--sm fx-num">{fmtNum(derived.ltv)} <span className="fx-kpi__unit">AZN</span></span>
          </div>
          <div className="fx-kpi">
            <span className="fx-label">Tamamlanmış</span>
            <span className="fx-kpi__value--sm fx-num">{profile.completedCount}</span>
            <span className="fx-kpi__meta" style={{ gap: 8, flexWrap: "wrap" }}><span>seans</span><span>{profile.activeCount} aktiv</span></span>
          </div>
          <div className="fx-kpi">
            <span className="fx-label">Paket gedişatı</span>
            <span className="fx-kpi__value--sm fx-num">{derived.pkgTotal > 0 ? <>{derived.pkgCompleted} <span className="fx-kpi__unit">/ {derived.pkgTotal}</span></> : "—"}</span>
            {/* Əsas rəqəm keçirilmiş seansdır; planlaşdırılmamış balans ayrıca sətirdə. */}
            <span className="fx-kpi__meta" style={{ gap: 8, flexWrap: "wrap" }}>
              {derived.pkgTotal > 0
                ? <><span>seans keçirilib</span>{derived.pkgUnscheduled > 0 && <span>{derived.pkgUnscheduled} planlaşdırılmayıb</span>}</>
                : "cari paket yoxdur"}
            </span>
          </div>
          <div className="fx-kpi">
            <span className="fx-label">Son giriş</span>
            <span className="fx-kpi__value--sm fx-num">{lastLoginDays == null ? "—" : lastLoginDays <= 0 ? "Bu gün" : <>{lastLoginDays} <span className="fx-kpi__unit">gün</span></>}</span>
            <span className="fx-kpi__meta" style={{ gap: 8, flexWrap: "wrap" }}>
              {profile.lastLogin ? <><span>əvvəl</span><span>{fmtDate(profile.lastLogin)}</span></> : "heç vaxt"}
            </span>
          </div>
        </div>
      </div>

      {/* 2) TEZ ƏMƏLİYYATLAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" className="fx-btn fx-btn--primary" onClick={() => { setSellMode("single"); setSellOpen(true); }}>
          <Icon name="calendar-plus" />Seans sat
        </button>
        <button type="button" className="fx-btn fx-btn--ghost" onClick={() => { setSellMode("catalog"); setSellOpen(true); }}>
          <Icon name="package" />Paket sat
        </button>
        {h.phone && (
          <button type="button" className="fx-btn fx-btn--ghost" onClick={() => window.location.assign(`tel:${h.phone!.replace(/\s/g, "")}`)}>
            <Icon name="phone" />Zəng
          </button>
        )}
        {h.phone && (
          <button type="button" className="fx-btn fx-btn--ghost" onClick={() => window.open(`https://wa.me/${h.phone!.replace(/[^\d]/g, "")}`, "_blank", "noopener")}>
            <Icon name="message" />WhatsApp
          </button>
        )}
        <button type="button" className="fx-btn fx-btn--ghost" onClick={() => noteRef.current?.focus()}>
          <Icon name="edit" />Qeyd əlavə et
        </button>
        <button type="button" className="fx-btn fx-btn--ghost" onClick={() => setBookOpen(true)}>
          <Icon name="calendar-plus" />Randevu yarat
        </button>
        {derived.nextSession && (
          <div className="fx-flex" style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 10, padding: "8px 14px", fontSize: 12.5, color: "var(--oxford-80)" }}>
            <Icon name="clock" style={{ color: "var(--brand)" }} />
            {/* Vaxt və psixoloq ayrı span-larda — ayırıcı işarə yox. */}
            <span>Növbəti seans: <b className="fx-num">{fmtShortTime(derived.nextSession.startAt)}</b></span>
            {derived.nextSession.psychologistName && <span style={{ color: "var(--oxford-60)" }}>{derived.nextSession.psychologistName}</span>}
          </div>
        )}
        <span className="fx-spacer" />
        {introStatus && introStatus.usedCount >= 1 && (
          <button type="button" onClick={toggleIntroGrant} disabled={grantingIntro}
            className={`fx-btn ${introStatus.extraGrantsConfigured > 0 ? "fx-btn--primary" : "fx-btn--ghost"}`}
            aria-pressed={introStatus.extraGrantsConfigured > 0}>
            <Icon name="star" />
            {grantingIntro ? "…" : introStatus.extraGrantsConfigured > 0 ? "Əlavə pulsuz tanışlıq: Aktiv" : "Əlavə pulsuz tanışlıq"}
          </button>
        )}
        {h.operatorCreated && !h.emailVerified && (
          <button type="button" onClick={resendActivation} disabled={resendingActivation} className="fx-btn fx-btn--ghost"
            title="Hesab hələ aktivləşdirilməyib — müştəri emaildəki linkdən şifrəsini təyin etməlidir">
            <Icon name="mail" />{resendingActivation ? "…" : "Aktivləşdirmə dəvətini yenidən göndər"}
          </button>
        )}
        <button type="button" onClick={toggleBlock} disabled={blocking} className="fx-btn fx-btn--ghost"
          style={h.blocked ? undefined : { borderColor: "rgba(201,125,125,.4)", color: "var(--rose)" }}>
          <Icon name="block" />{blocking ? "…" : h.blocked ? "Bloku aç" : "Blokla"}
        </button>
      </div>

      {/* 3) ƏSAS GÖVDƏ */}
      <div className="cust-body">
        {/* SOL SÜTUN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Müştəri jurnalı */}
          <div className="fx-card" style={{ padding: "22px 26px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
              <span className="fx-card-title">Müştəri jurnalı</span>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--oxford-60)", flexWrap: "wrap" }}>
                <LegendDot tone="seans" label="Seans" />
                <LegendDot tone="pay" label="Ödəniş" />
                <LegendDot tone="pkg" label="Paket" />
                <LegendDot tone="test" label="Test" />
                <LegendDot tone="care" label="Qayğı" />
              </div>
            </div>
            {derived.events.length === 0 ? (
              <EmptyBlock icon="clock" title="Hələ fəaliyyət yoxdur" sub="Seans, ödəniş və digər hadisələr burada görünəcək" />
            ) : (
              <div className="fx-timeline">
                {derived.events.map((ev, i) => (
                  <div key={ev.key} className="fx-tl-item">
                    <div className="fx-tl-rail">
                      <span className="fx-tl-dot" style={{ background: DOT[ev.dot].bg, borderColor: DOT[ev.dot].ring }} />
                      {i < derived.events.length - 1 && <span className="fx-tl-line" />}
                    </div>
                    <div className="fx-tl-body">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                        <span className="fx-tl-title">{ev.title}</span>
                        <span className="fx-tl-meta" style={{ whiteSpace: "nowrap" }}>{fmtShort(ev.at)}</span>
                      </div>
                      <span style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>{ev.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Maliyyə */}
          <div className="fx-card" style={{ overflow: "hidden" }}>
            <div className="fx-card-title" style={{ padding: "20px 26px 0" }}>Maliyyə</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", padding: "16px 26px", borderBottom: "1px solid var(--hairline)" }}>
              <FinStat label="Ümumi xərc" value={`${fmtNum(derived.ltv)} AZN`} />
              <FinStat label="Orta seans dəyəri" value={derived.avgSession != null ? `${fmtNum(derived.avgSession)} AZN` : "—"} border />
              <FinStat label="Gözləyən qalıq" value={`${fmtNum(derived.pendingBalance)} AZN`} color={derived.pendingBalance > 0 ? "var(--amber)" : undefined} border />
            </div>
            {profile.payments.length === 0 ? (
              <EmptyBlock icon="card" title="Ödəniş qeydi yoxdur" sub="Seans/paket satışından ödənişlər burada görünəcək" bare />
            ) : (
              [...profile.payments].sort((a, b) => new Date(b.paidAt ?? b.createdAt ?? 0).getTime() - new Date(a.paidAt ?? a.createdAt ?? 0).getTime()).map(p => (
                <div key={p.id} className="cust-hoverrow" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 26px", borderBottom: "1px solid var(--hairline)", fontSize: 13, flexWrap: "wrap" }}>
                  <span className="fx-num" style={{ color: "var(--oxford-60)", minWidth: 64 }}>{fmtShort(p.paidAt ?? p.createdAt)}</span>
                  <span className="fx-num" style={{ fontWeight: 700, minWidth: 90 }}>{fmtNum(p.amount)} AZN</span>
                  <span style={{ color: "var(--oxford-60)" }}>{p.method || "—"}</span>
                  <span style={{ color: "var(--oxford-60)", fontSize: 12 }}>{p.patientPackageId != null ? "Paket" : p.appointmentId != null ? `Seans #${p.appointmentId}` : (p.statusNote ? `«${p.statusNote}»` : "—")}</span>
                  <span className="fx-spacer" />
                  <span className={`fx-pill ${pillClass(p.status)}`}>{statusLabel(p.status)}</span>
                </div>
              ))
            )}
            <div style={{ padding: "18px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="fx-section-label">Paketlər</div>
              {profile.packages.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Paket yoxdur</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {profile.packages.map(pkg => {
                    const pay = profile.payments.find(pm => pm.patientPackageId === pkg.id);
                    const paid = pay?.status === "PAID";
                    // Proqres = FAKTİKİ keçirilmiş seans. pkg.remaining yalnız
                    // "hələ planlaşdırılmayıb" mənasını daşıyır.
                    const completed = pkg.completed;
                    const unscheduled = Math.max(0, pkg.remaining);
                    const pct = pkg.total > 0 ? Math.round((completed / pkg.total) * 100) : 0;
                    const done = pkg.status === "EXHAUSTED";
                    const txt = PKG_TEXT[pkg.status] ?? PKG_TEXT.ACTIVE;
                    return (
                      <div key={pkg.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, gap: 10, flexWrap: "wrap" }}>
                          {/* Paket adı + detallar ayrı span-larda — ayırıcı işarə yox, flex boşluğu ayırır. */}
                          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600 }}>{pkg.packageName}</span>
                            {[pkg.psychologistName, pkg.pricePaid != null ? formatAzn(pkg.pricePaid) : null].filter(Boolean).map((s, si) => (
                              <span key={si} style={{ fontWeight: 400, color: "var(--oxford-60)" }}>{s}</span>
                            ))}
                          </span>
                          <span className="fx-num" style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-600)" }}>{completed} / {pkg.total} keçirilib</span>
                        </div>
                        <div className="fx-progress">
                          <div className={`fx-progress__fill${done ? " fx-progress__fill--sage" : ""}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, color: "var(--oxford-60)", flexWrap: "wrap", gap: 8 }} className="fx-num">
                          <span>{unscheduled > 0 ? `${unscheduled} seans planlaşdırılmayıb` : "Bütün seanslar planlaşdırılıb"}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 600, color: txt.color }}>{txt.label}</span>
                            <span className={`fx-pill ${paid ? "fx-pill--paid" : "fx-pill--pending"}`}>
                              <Icon name={paid ? "check" : "clock"} className="fx-icon fx-icon--sm" style={{ width: 11, height: 11 }} />
                              {paid ? "Ödənildi" : "Ödəniş gözlənir"}
                            </span>
                          </span>
                        </div>
                        {pkg.status === "ACTIVE" && pkg.remaining > 0 && pkg.psychologistId != null && (
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button type="button" onClick={() => setSchedulePkg(pkg)} className="fx-btn fx-btn--ghost fx-btn--sm">
                              <Icon name="calendar-plus" className="fx-icon fx-icon--sm" />Seans planla
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Test nəticələri */}
          <div className="fx-card" style={{ padding: "20px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
            <span className="fx-card-title">Test nəticələri</span>
            {profile.testResults.length === 0 ? (
              <EmptyBlock icon="check-square" title="Test nəticəsi yoxdur" sub="Müştəriyə test göndərəndə nəticələr burada görünəcək" bare />
            ) : (
              profile.testResults.map((tr, i) => (
                <div key={tr.assignmentId} style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: i < profile.testResults.length - 1 ? 16 : 0, borderBottom: i < profile.testResults.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{tr.testTitle}</span>
                    <span className="fx-num" style={{ fontSize: 11.5, color: "var(--oxford-60)" }}>{tr.submittedAt ? fmtShort(tr.submittedAt) : statusLabel(tr.status)}</span>
                  </div>
                  {tr.totalScore != null && tr.maxScore != null ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className="fx-num" style={{ fontSize: 16, fontWeight: 800 }}>{tr.totalScore} <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)" }}>/ {tr.maxScore}</span></span>
                        {tr.percentage != null && <span className="fx-num" style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)" }}>{Math.round(tr.percentage)}%</span>}
                        {tr.scaleLabel && <span className="fx-pill fx-pill--neutral">{tr.scaleLabel}</span>}
                      </div>
                      <div className="fx-progress" style={{ maxWidth: 320 }}>
                        <div className="fx-progress__fill--soft" style={{ width: `${Math.round(tr.percentage ?? 0)}%`, background: "var(--brand-300)", borderRadius: "inherit" }} />
                      </div>
                      <span style={{ fontSize: 12, color: "var(--oxford-60)" }}>Nəticə psixoloqla növbəti seansda müzakirə üçün nəzərdə tutulub</span>
                    </>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 12, color: "var(--oxford-60)" }}>Müştəriyə göndərilib, cavab gözlənilir</span>
                      <span className="fx-pill fx-pill--pending">{statusLabel(tr.status)}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Verilmiş rəylər */}
          <div className="fx-card" style={{ padding: "20px 26px", display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="fx-card-title">Verilmiş rəylər</span>
            {profile.reviewsGiven.length === 0 ? (
              <EmptyBlock icon="star" title="Rəy yoxdur" sub="Müştərinin verdiyi rəylər burada görünəcək" bare />
            ) : (
              profile.reviewsGiven.map((r, i) => (
                <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: i < profile.reviewsGiven.length - 1 ? 12 : 0, borderBottom: i < profile.reviewsGiven.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.psychologistName ?? "—"}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="fx-stars" aria-label={`${Math.round(r.rating)} / 5`}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <svg key={n} viewBox="0 0 24 24" className={n <= Math.round(r.rating) ? undefined : "fx-star--off"}>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                      </span>
                      <span className={`fx-pill ${r.status === "PUBLISHED" ? "fx-pill--paid" : "fx-pill--cancelled"}`}>{statusLabel(r.status)}</span>
                    </div>
                  </div>
                  {r.comment && <span style={{ fontSize: 13, color: "var(--oxford-80)", background: "var(--surface-muted)", border: "1px solid var(--hairline)", borderRadius: 8, padding: "10px 14px" }}>«{r.comment}»</span>}
                  {r.createdAt && <span className="fx-num" style={{ fontSize: 11.5, color: "var(--oxford-60)" }}>{fmtDate(r.createdAt)}</span>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* SAĞ SÜTUN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Qayğı paneli */}
          <div className="fx-card" style={{ overflow: "hidden" }}>
            <div className="fx-card-title" style={{ padding: "18px 22px", borderBottom: "1px solid var(--hairline)" }}>Qayğı paneli</div>
            {h.autoFlag && (
              <div className="fx-alert" style={{ margin: "16px 22px 0" }}>
                <Icon name="alert" className="fx-icon fx-icon--md" />
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span className="fx-alert__title">{FLAG_LABEL[h.autoFlag] ?? h.autoFlag} göstəricisi</span>
                  <span className="fx-alert__text">{derived.careDetail}</span>
                </div>
              </div>
            )}
            <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 9, fontSize: 13 }}>
              <CareRow label="Gəlmədi (no-show)" value={h.noShowCount} warn={h.noShowCount >= 2} />
              <CareRow label="Gec ləğv" value={h.lateCancelCount} warn={h.lateCancelCount >= 3} />
              <CareRow label="Rədd edilmiş" value={h.rejectedCount} />
              <CareRow label="Ləğv edilmiş" value={h.cancelledCount} />
            </div>
            {h.autoFlag && (
              <div style={{ margin: "0 22px 18px", borderTop: "1px solid var(--hairline)", paddingTop: 12, display: "flex", gap: 9, fontSize: 12, color: "var(--oxford-80)", lineHeight: 1.5 }}>
                <Icon name="info" className="fx-icon fx-icon--sm" style={{ color: "var(--brand)", flexShrink: 0, marginTop: 1 }} />
                <span>{derived.careTip}</span>
              </div>
            )}
          </div>

          {/* Operator qeydləri */}
          <div className="fx-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--hairline)" }}>
              <span className="fx-card-title">Operator qeydləri</span>
              <span className="fx-pill fx-pill--count fx-num">{notes.length}</span>
            </div>
            {notesLoading ? (
              <div style={{ padding: "14px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="fx-skeleton" style={{ height: 11, width: "80%" }} />
                <div className="fx-skeleton" style={{ height: 9, width: "40%" }} />
              </div>
            ) : notes.length === 0 ? (
              <div style={{ padding: "14px 22px", fontSize: 12.5, color: "var(--oxford-60)" }}>Hələ qeyd yoxdur</div>
            ) : (
              notes.map(n => (
                <div key={n.id} style={{ padding: "14px 22px", borderBottom: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 13, color: "var(--oxford-80)", lineHeight: 1.5 }}>{n.text}</span>
                  <span className="fx-num" style={{ fontSize: 11.5, color: "var(--oxford-60)", display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <span>{n.authorName ?? "Operator"}</span>
                    <span>{fmtDate(n.createdAt)}</span>
                  </span>
                </div>
              ))
            )}
            <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea ref={noteRef} className="fx-textarea" rows={3} value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                placeholder="Zəng, izləmə və ya müşahidə qeydi yazın…" />
              <button type="button" onClick={submitNote} disabled={addingNote} className="fx-btn fx-btn--primary fx-btn--sm" style={{ alignSelf: "flex-end" }}>
                {addingNote ? "Əlavə edilir…" : "Qeyd əlavə et"}
              </button>
            </div>
          </div>

          {/* Təcili əlaqə + ünvan */}
          <div className="fx-card fx-card__pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span className="fx-card-title">Təcili əlaqə və ünvan</span>
            {h.emergencyContactName ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="fx-avatar fx-avatar--2">{initialsOf(h.emergencyContactName)}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span>{h.emergencyContactName}</span>
                    {h.emergencyContactRelation && <span style={{ fontWeight: 400, color: "var(--oxford-60)" }}>{h.emergencyContactRelation}</span>}
                  </span>
                  <span className="fx-num" style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>{h.emergencyContactPhone ?? "—"}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Təcili əlaqə qeyd edilməyib</div>
            )}
            {h.residentialAddress && (
              <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12, display: "flex", gap: 9, fontSize: 12.5, color: "var(--oxford-80)" }}>
                <Icon name="map-pin" className="fx-icon fx-icon--sm" style={{ color: "var(--oxford-60)", flexShrink: 0, marginTop: 1 }} />
                <span>{h.residentialAddress}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Kiçik building block-lar ────────────────────────────────────────────── */

function LegendDot({ tone, label }: { tone: DotTone; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: DOT[tone].bg }} />{label}
    </span>
  );
}

function FinStat({ label, value, color, border }: { label: string; value: string; color?: string; border?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, borderLeft: border ? "1px solid var(--hairline)" : undefined, paddingLeft: border ? 20 : undefined }}>
      <span className="fx-label">{label}</span>
      <span className="fx-num" style={{ fontSize: 18, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

function CareRow({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--oxford-60)" }}>{label}</span>
      <span className="fx-num" style={{ fontWeight: 700, color: warn ? "var(--status-pending-fg)" : undefined }}>{value}</span>
    </div>
  );
}

function EmptyBlock({ icon, title, sub, bare }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; sub: string; bare?: boolean }) {
  return (
    <div className={bare ? "" : "fx-card--empty"} style={bare ? { padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" } : undefined}>
      <Icon name={icon} className="fx-icon fx-icon--xl" style={{ color: "var(--brand-300)" }} />
      <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: "var(--oxford-60)" }}>{sub}</div>
    </div>
  );
}

function Cust360Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="fx-card fx-card--lg" style={{ display: "flex", padding: "26px 30px", gap: 20, alignItems: "center" }}>
        <div className="fx-skeleton fx-skeleton--circle" style={{ width: 72, height: 72 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="fx-skeleton" style={{ height: 20, width: "35%" }} />
          <div className="fx-skeleton" style={{ height: 12, width: "55%" }} />
        </div>
      </div>
      <div className="cust-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="fx-card" style={{ padding: 24 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: "flex", gap: 14, marginTop: i ? 18 : 0 }}>
                <div className="fx-skeleton fx-skeleton--circle" style={{ width: 11, height: 11, marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div className="fx-skeleton" style={{ height: 12, width: "60%" }} />
                  <div className="fx-skeleton" style={{ height: 9, width: "40%", marginTop: 7 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="fx-card" style={{ padding: 20 }}>
            <div className="fx-skeleton" style={{ height: 12, width: "50%" }} />
            <div className="fx-skeleton" style={{ height: 40, width: "100%", marginTop: 14 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Paket satışı modalı (operator) — dəyişməz, mövcud satış məntiqi ───────── */

const SELL_TINTS = [
  { bg: "#E0EBFA", fg: "#1E3A8A" }, { bg: "#D1FAE5", fg: "#065F46" },
  { bg: "#FEF3C7", fg: "#92400E" }, { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#EDE9FE", fg: "#5B21B6" }, { bg: "#CCFBF1", fg: "#115E59" },
];
function sellTint(name?: string | null) {
  const s = name ?? "?"; let hh = 0;
  for (let i = 0; i < s.length; i++) hh = (hh * 31 + s.charCodeAt(i)) >>> 0;
  return SELL_TINTS[hh % SELL_TINTS.length];
}
function sellInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function SellPackageModal({ patientId, initialMode = "catalog", onClose, onDone }: {
  patientId: number;
  initialMode?: "catalog" | "custom" | "single";
  onClose: () => void;
  onDone: (displayName: string, isSingle: boolean) => void;
}) {
  const [psys, setPsys] = useState<Psychologist[]>([]);
  const [psyId, setPsyId] = useState<number | null>(null);
  const [mode, setMode] = useState<"catalog" | "custom" | "single">(initialMode);
  const [catalog, setCatalog] = useState<PackageDto[]>([]);
  const [catalogId, setCatalogId] = useState<number | null>(null);
  const [loadingCat, setLoadingCat] = useState(false);
  // xüsusi
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState("");
  const [price, setPrice] = useState("");
  // tək seans
  const [singleName, setSingleName] = useState("");
  const [singlePrice, setSinglePrice] = useState("");
  const [singleStart, setSingleStart] = useState("");
  const [singleEnd, setSingleEnd] = useState("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Pasient bu psixoloqu özü seçib müraciət edibsə komissiyasız/azaldılmış faiz tətbiq olunur.
  const [patientChoseDirectly, setPatientChoseDirectly] = useState(false);

  useEffect(() => { operatorApi.listPsychologists().then(setPsys).catch(() => {}); }, []);

  useEffect(() => {
    if (mode !== "single" || psyId == null) return;
    const p = psys.find(x => x.id === psyId);
    if (p && p.individualPrice != null) setSinglePrice(String(p.individualPrice));
  }, [psyId, mode, psys]);

  useEffect(() => {
    if (mode !== "single" || psyId == null) { setSlots([]); return; }
    setSlotsLoading(true);
    const today = new Date();
    const to = new Date(); to.setDate(to.getDate() + 21);
    operatorApi.availability(psyId, dateOnly(today), dateOnly(to))
      .then(setSlots).catch(() => setSlots([])).finally(() => setSlotsLoading(false));
  }, [mode, psyId]);

  // Boş saat yoxdursa əl ilə daxiletməni AVTOMATİK aç (tək seans satışında da) — sahə
  // toggle arxasında gizli qalmasın.
  useEffect(() => {
    if (mode === "single" && psyId != null && !slotsLoading && slots.length === 0) setManualOpen(true);
  }, [mode, psyId, slotsLoading, slots.length]);

  useEffect(() => { setSingleStart(""); setSingleEnd(""); }, [psyId]);

  const groupedSlots = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = azFormatDate(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  useEffect(() => {
    setCatalog([]); setCatalogId(null);
    if (!psyId) return;
    setLoadingCat(true);
    operatorApi.psychologistPackages(psyId)
      .then(list => setCatalog(list.filter(p => p.active !== false)))
      .catch(() => setCatalog([]))
      .finally(() => setLoadingCat(false));
  }, [psyId]);

  const selPsy = psys.find(p => p.id === psyId) ?? null;
  const sessionMin = selPsy?.defaultSessionMinutes ?? 50;

  const submit = async () => {
    if (!psyId) { toast("Psixoloq seçin", "error"); return; }

    if (mode === "single") {
      const p = Number(singlePrice);
      if (!Number.isFinite(p) || p < 0) { toast("Qiymət düzgün deyil", "error"); return; }
      if (!singleStart) { toast("Seans vaxtını seçin", "error"); return; }
      setSaving(true);
      try {
        await operatorApi.sellSingleSession(patientId, {
          psychologistId: psyId, price: p, startAt: singleStart, endAt: singleEnd || addMinutes(singleStart, sessionMin),
          patientChoseDirectly,
        });
        onDone(singleName.trim() || "Tək seans", true);
      } catch (e) {
        toast((e as Error).message, "error");
        setSaving(false);
      }
      return;
    }

    let payload: Parameters<typeof operatorApi.sellPackage>[1];
    let displayName: string;
    if (mode === "catalog") {
      if (!catalogId) { toast("Kataloqdan paket seçin", "error"); return; }
      payload = { sessionPackageId: catalogId };
      displayName = catalog.find(c => c.id === catalogId)?.name ?? "Paket";
    } else {
      const s = Number(sessions), p = Number(price);
      if (!Number.isFinite(s) || s < 1) { toast("Seans sayı düzgün deyil", "error"); return; }
      if (!Number.isFinite(p) || p < 0) { toast("Qiymət düzgün deyil", "error"); return; }
      payload = { psychologistId: psyId, packageName: name.trim() || undefined, sessionCount: s, price: p };
      displayName = name.trim() || `${s} seanslıq paket`;
    }
    setSaving(true);
    try {
      await operatorApi.sellPackage(patientId, { ...payload, patientChoseDirectly });
      onDone(displayName, false);
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  };

  const selCat = catalog.find(c => c.id === catalogId) ?? null;
  // Xülasə meta-sı hissə-hissə saxlanılır — ayırıcı işarə yox, flex boşluğu ayırır.
  let summaryName = "—";
  let summaryMeta: string[] = [];
  let hasSelection = false;
  if (mode === "single") {
    hasSelection = psyId != null;
    summaryName = singleName.trim() || "Tək seans";
    summaryMeta = ["1 seans", formatAzn(Number(singlePrice) || 0), singleStart ? fmtDateTime(singleStart) : "tarix seçilməyib"];
  } else if (mode === "custom") {
    const s = Number(sessions) || 0, pr = Number(price) || 0;
    hasSelection = s > 0 || pr > 0 || !!name.trim();
    if (hasSelection) {
      summaryName = name.trim() || "Xüsusi paket";
      summaryMeta = [`${s} seans`, formatAzn(pr), `seans başına ≈ ${s ? formatAzn(Math.round(pr / s)) : "—"}`];
    }
  } else if (selCat) {
    hasSelection = true;
    summaryName = selCat.name;
    summaryMeta = [`${selCat.sessionCount} seans`, formatAzn(selCat.packagePrice), `seans başına ≈ ${formatAzn(selCat.perSessionPrice)}`];
  }
  const emptyHint = mode === "single" ? "Psixoloq və seans tarixini seçin"
    : mode === "custom" ? "Seans sayı və qiyməti daxil edin"
    : "Psixoloq və paket seçin";

  const seg = (on: boolean): CSSProperties => ({ flex: 1, border: "none", borderRadius: 8, padding: 9, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: on ? "#fff" : "transparent", color: on ? "#082F6D" : "var(--oxford-60)", boxShadow: on ? "0 1px 3px rgba(8,47,109,.12)" : "none" });
  const field: CSSProperties = { width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 13px", fontSize: 14, fontWeight: 600, color: "var(--oxford)", fontFamily: "inherit", boxSizing: "border-box" };
  const fLab: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,26,51,.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "28px 20px", overflowY: "auto" }}>
      <style>{`@keyframes opSheet{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 16, boxShadow: "0 24px 70px rgba(8,47,109,.3)", overflow: "hidden", margin: "auto", animation: "opSheet .22s ease" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #F0F4FA", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)" }}>Satış</div>
            <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 3, lineHeight: 1.45 }}>Psixoloq + paket və ya tək seans seçin. Ödəniş PENDING yaranır — pul gələndə «Ödənişlər»də təsdiqləyin.</div>
          </div>
          <button onClick={onClose} aria-label="Bağla" style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F0F4FA", border: "none", borderRadius: 8, cursor: "pointer", flex: "none" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div style={{ padding: "18px 22px", maxHeight: "62vh", overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 9 }}>Psixoloq</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18, maxHeight: 232, overflowY: "auto" }}>
            {psys.length === 0 && <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Psixoloq siyahısı yüklənir…</div>}
            {psys.map(p => {
              const a = psyId === p.id;
              const tint = sellTint(p.name);
              return (
                <button key={p.id} type="button" onClick={() => setPsyId(p.id)}
                  style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: a ? "#F2F6FD" : "#fff", border: `1.5px solid ${a ? "var(--brand)" : "#D6E2F7"}`, borderRadius: 11, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ width: 34, height: 34, borderRadius: "50%", background: tint.bg, color: tint.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{sellInitials(p.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600 }}>{p.title || "Psixoloq"}</div>
                  </div>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${a ? "var(--brand)" : "#CBD5E6"}`, background: a ? "var(--brand)" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: a ? 1 : 0 }} aria-hidden><path d="M20 6L9 17l-5-5" /></svg>
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 4, background: "#F0F4FA", borderRadius: 10, padding: 3, marginBottom: 16 }}>
            <button type="button" onClick={() => setMode("catalog")} style={seg(mode === "catalog")}>Kataloq paketi</button>
            <button type="button" onClick={() => setMode("custom")} style={seg(mode === "custom")}>Xüsusi paket</button>
            <button type="button" onClick={() => setMode("single")} style={seg(mode === "single")}>Tək seans</button>
          </div>

          {mode === "catalog" ? (
            !psyId ? (
              <div style={{ fontSize: 12.5, color: "var(--oxford-60)", background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>Əvvəlcə psixoloq seçin.</div>
            ) : loadingCat ? (
              <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Yüklənir…</div>
            ) : catalog.length === 0 ? (
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 11, padding: "12px 14px", fontSize: 12.5, color: "#92400E", fontWeight: 600, lineHeight: 1.45 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }} aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
                Bu psixoloqun kataloq paketi yoxdur — «Xüsusi paket» seçin.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {catalog.map(c => {
                  const a = catalogId === c.id;
                  return (
                    <button key={c.id} type="button" onClick={() => setCatalogId(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: a ? "#F2F6FD" : "#fff", border: `1.5px solid ${a ? "var(--brand)" : "#D6E2F7"}`, borderRadius: 12, padding: "13px 15px", cursor: "pointer", fontFamily: "inherit" }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${a ? "var(--brand)" : "#CBD5E6"}`, background: a ? "var(--brand)" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: a ? 1 : 0 }} aria-hidden><path d="M20 6L9 17l-5-5" /></svg>
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginTop: 1, display: "flex", flexWrap: "wrap", gap: 10 }}>
                          <span>{c.sessionCount} seans</span>
                          <span>seans başına ≈ {formatAzn(c.perSessionPrice)}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#082F6D", flex: "none" }}>{formatAzn(c.packagePrice)}</span>
                    </button>
                  );
                })}
              </div>
            )
          ) : mode === "single" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={fLab}>Seans vaxtı — boş saatlardan seçin *</div>
                {!psyId ? (
                  <div style={{ fontSize: 12.5, color: "var(--oxford-60)", background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>Əvvəlcə psixoloq seçin.</div>
                ) : slotsLoading ? (
                  <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Boş saatlar yüklənir…</div>
                ) : slots.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px" }}>Yaxın 3 həftədə boş saat yoxdur — aşağıdan əl ilə daxil edin.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 240, overflowY: "auto", paddingRight: 2 }}>
                    {groupedSlots.map(([day, daySlots]) => (
                      <div key={day}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 6 }}>{day}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {daySlots.map(s => {
                            const sel = singleStart === isoToAzLocal(s.startAt);
                            return (
                              <button key={s.startAt} type="button"
                                onClick={() => { setManualOpen(false); setSingleStart(isoToAzLocal(s.startAt)); setSingleEnd(isoToAzLocal(s.endAt)); }}
                                style={{ border: `1.5px solid ${sel ? "var(--brand)" : "#D6E2F7"}`, background: sel ? "var(--brand)" : "#fff", color: sel ? "#fff" : "var(--oxford)", borderRadius: 9, padding: "7px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                {azFormatTime(s.startAt)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {psyId && (
                  <button type="button" onClick={() => setManualOpen(o => !o)}
                    style={{ marginTop: 8, background: "none", border: "none", color: "var(--brand-700)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                    {manualOpen ? "Əl ilə daxiletməni gizlət" : "Və ya əl ilə daxil et"}
                  </button>
                )}
                {manualOpen && (
                  <label style={{ display: "block", marginTop: 8 }}><span style={fLab}>Tarix və saat (əl ilə)</span>
                    <DatePicker withTime theme="light" size="sm" value={singleStart} onChange={v => { setSingleStart(v); setSingleEnd(addMinutes(v, sessionMin)); }} style={{ width: "100%" }} />
                  </label>
                )}
                {singleStart && (
                  <div style={{ fontSize: 12, color: "#065F46", fontWeight: 600, marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <span>Seçilmiş vaxt: {fmtDateTime(singleStart)}</span>
                    <span>~{sessionMin} dəq</span>
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label><span style={fLab}>Ad (opsional)</span><input value={singleName} onChange={e => setSingleName(e.target.value)} placeholder="Tək seans" style={field} /></label>
                <label><span style={fLab}>Qiymət (₼)</span><input value={singlePrice} onChange={e => setSinglePrice(e.target.value)} type="number" min={0} step="0.01" placeholder="60" style={field} /></label>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ gridColumn: "1 / -1" }}><span style={fLab}>Ad (opsional)</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Məs. Fərdi proqram" style={field} /></label>
              <label><span style={fLab}>Seans sayı</span><input value={sessions} onChange={e => setSessions(e.target.value)} type="number" min={1} placeholder="10" style={field} /></label>
              <label><span style={fLab}>Qiymət (₼)</span><input value={price} onChange={e => setPrice(e.target.value)} type="number" min={0} step="0.01" placeholder="450" style={field} /></label>
            </div>
          )}

          <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 16, cursor: "pointer" }}>
            <input type="checkbox" checked={patientChoseDirectly} onChange={e => setPatientChoseDirectly(e.target.checked)} style={{ width: 16, height: 16, marginTop: 1, flex: "none" }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--oxford)", lineHeight: 1.4 }}>
              Pasient bu psixoloqu özü seçib müraciət edib <span style={{ color: "var(--oxford-60)", fontWeight: 500 }}>(komissiyasız/azaldılmış faiz tətbiq olunur)</span>
            </span>
          </label>

          <div style={{ marginTop: 12, background: "#F2F6FD", border: "1px solid #D6E2F7", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 9 }}>Seçim xülasəsi</div>
            {hasSelection ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{summaryName}</div>
                  <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, marginTop: 2, display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {summaryMeta.map((m, mi) => <span key={mi}>{m}</span>)}
                  </div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FEF3C7", color: "#92400E", fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>Ödəniş: PENDING
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 500 }}>{emptyHint}</div>
            )}
          </div>

        </div>

        <div style={{ display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid #F0F4FA" }}>
          <button onClick={onClose} style={{ flex: "none", background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Ləğv</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: "0 4px 14px rgba(16,81,183,.25)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>{saving ? "Satılır…" : (mode === "single" ? "Tək seans sat" : "Paket sat")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Operator paket seansı planlama modalı — dəyişməz ───────────────────── */

function SchedulePackageSessionModal({ patientId, pkg, onClose, onDone }: {
  patientId: number;
  pkg: CustomerProfile["packages"][number];
  onClose: () => void;
  onDone: () => void;
}) {
  const psyId = pkg.psychologistId as number;
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [psy, setPsy] = useState<Psychologist | null>(null);

  useEffect(() => {
    setSlotsLoading(true);
    const today = new Date();
    const to = new Date(); to.setDate(to.getDate() + 21);
    operatorApi.availability(psyId, dateOnly(today), dateOnly(to))
      .then(setSlots).catch(() => setSlots([])).finally(() => setSlotsLoading(false));
  }, [psyId]);

  // Boş saat yoxdursa əl ilə daxiletməni AVTOMATİK aç — mesaj "aşağıdan əl ilə daxil
  // edin" deyir, amma sahə toggle arxasında gizli qalırdı.
  useEffect(() => {
    if (!slotsLoading && slots.length === 0) setManualOpen(true);
  }, [slotsLoading, slots.length]);

  useEffect(() => {
    operatorApi.listPsychologists()
      .then(list => setPsy(list.find(p => p.id === psyId) ?? null))
      .catch(() => setPsy(null));
  }, [psyId]);

  // Psixoloqun öz seans müddəti — əl ilə daxiletmədə bitmə vaxtını təxmin etmək üçün.
  // Sabit 50 dəq hardcode edilsəydi, 60 dəq işləyən psixoloqlar üçün operator
  // görünüşü ilə pasiyent/psixoloq görünüşü arasında uyğunsuzluq yaranırdı.
  const defaultDurationMin = psy?.defaultSessionMinutes ?? 50;

  const groupedSlots = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = azFormatDate(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  const submit = async () => {
    if (!start || !end) { toast("Vaxt seçin və ya əl ilə daxil edin", "error"); return; }
    const startAt = azLocalToISO(start);
    const endAt = azLocalToISO(end);
    if (new Date(startAt) >= new Date(endAt)) { toast("Başlama vaxtı bitiş vaxtından əvvəl olmalıdır", "error"); return; }
    setSaving(true);
    try {
      await operatorApi.schedulePackageSession(patientId, pkg.id, { startAt, endAt });
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setSaving(false); }
  };

  const labS: CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 5 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(10,26,51,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16, boxShadow: "0 24px 70px rgba(8,47,109,.3)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #F0F4FA" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)" }}>Paket seansı planla</div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 3, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <span>{pkg.packageName}</span>
            <span>{Math.max(0, pkg.remaining)} seans planlaşdırılmayıb</span>
            {pkg.psychologistName && <span>{pkg.psychologistName}</span>}
          </div>
        </div>
        <div style={{ padding: "18px 22px", overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8AAABF", marginBottom: 10 }}>Boş saatlar</div>
          {slotsLoading ? (
            <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Boş saatlar yüklənir…</div>
          ) : slots.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px" }}>Yaxın 3 həftədə boş saat yoxdur — aşağıdan əl ilə daxil edin.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto", paddingRight: 2 }}>
              {groupedSlots.map(([day, daySlots]) => (
                <div key={day}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 6 }}>{day}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {daySlots.map(s => {
                      const sel = start === isoToAzLocal(s.startAt);
                      return (
                        <button key={s.startAt} type="button"
                          onClick={() => { setManualOpen(false); setStart(isoToAzLocal(s.startAt)); setEnd(isoToAzLocal(s.endAt)); }}
                          style={{ border: `1.5px solid ${sel ? "var(--brand)" : "#D6E2F7"}`, background: sel ? "var(--brand)" : "#fff", color: sel ? "#fff" : "var(--oxford)", borderRadius: 9, padding: "7px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {azFormatTime(s.startAt)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={() => setManualOpen(o => !o)}
            style={{ marginTop: 10, background: "none", border: "none", color: "var(--brand-700)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            {manualOpen ? "Əl ilə daxiletməni gizlət" : "Və ya əl ilə daxil et"}
          </button>
          {manualOpen && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <label style={{ display: "block" }}>
                <span style={labS}>Başlama vaxtı</span>
                <DatePicker withTime theme="light" size="sm" value={start} onChange={v => { setStart(v); if (!end) setEnd(addMinutes(v, defaultDurationMin)); }} style={{ width: "100%" }} />
              </label>
              <label style={{ display: "block" }}>
                <span style={labS}>Bitmə vaxtı</span>
                <DatePicker withTime theme="light" size="sm" value={end} onChange={setEnd} style={{ width: "100%" }} />
              </label>
            </div>
          )}

          {start && end && (
            <div style={{ fontSize: 12.5, color: "#065F46", fontWeight: 600, marginTop: 12, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 9, padding: "9px 12px" }}>
              {/* Tarix və vaxt aralığı bir cümlə kimi oxunur — vergüllə. */}
              Seçilmiş vaxt: {azFormatDate(azLocalToISO(start))}, {azFormatTime(azLocalToISO(start))} – {azFormatTime(azLocalToISO(end))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#F2F6FD", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 12px", marginTop: 12, fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, lineHeight: 1.45 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }} aria-hidden><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
            Paket balansından 1 seans sərf olunacaq və seans təsdiqlənmiş (CONFIRMED) yaranacaq.
          </div>

        </div>
        <div style={{ display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid #F0F4FA" }}>
          <button onClick={onClose} style={{ flex: "none", background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Ləğv</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Planlanır…" : "Seansı planla"}
          </button>
        </div>
      </div>
    </div>
  );
}

const CUST_CSS = `
.cust-hero{display:flex;overflow:hidden;flex-wrap:wrap}
.cust-body{display:grid;grid-template-columns:1.6fr 1fr;gap:16px;align-items:start}
.cust-hoverrow{transition:background .12s}
.cust-hoverrow:hover{background:var(--surface-muted)}
@media(max-width:900px){.cust-body{grid-template-columns:1fr}}
`;
