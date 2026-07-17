"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  patientApi,
  getPsychologists,
  type AppointmentDetail,
  type PatientPackageItem,
  type RescheduleProposal,
} from "@/lib/api";
import { googleCalendarUrl } from "@/lib/calendar";
import { appUrl } from "@/lib/appUrl";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { azFormatTime, azFormatDate, azOrdinal } from "@/lib/datetime";
import { formatAzn } from "@/lib/money";
import RescheduleProposalModal from "@/components/RescheduleProposalModal";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import JoinSessionButton from "@/components/JoinSessionButton";
import { toast } from "@/components/Toast";
import { useT } from "@/lib/i18n/LocaleProvider";
import {
  STATUS, PKG_STATUS, PA_STYLE,
  PackageBadge, IntroBadge, IconClock, IconX, Section, Empty,
  initialsOf, pad2, cleanOperatorNote,
} from "./shared";

const MONTHS_AZ = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

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
  // Map US weekday short → AZ (tam adlar — mətndə "C" kimi qısaldılmış hərf qarışıq görünür)
  const map: Record<string, string> = {
    Mon: "Bazar ertəsi", Tue: "Çərşənbə axşamı", Wed: "Çərşənbə", Thu: "Cümə axşamı",
    Fri: "Cümə", Sat: "Şənbə", Sun: "Bazar",
  };
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

const ACTIVE_STATUSES = new Set(["ASSIGNED", "CONFIRMED", "PENDING", "REJECTED", "CANCEL_REQUESTED"]);

/** Seans hələ bitməyibsə (yaxınlaşan/davam edən) true. Bitmə vaxtı (endAt) keçibsə
 *  seans BİTİB — qısa (15 dəq INTRO) seanslar da "startAt > now − 30dəq" proxy-si
 *  ilə səhvən "növbəti" görünürdü; endAt ilə düzgün "keçmiş" sayılır. */
function notEndedYet(a: { startAt?: string | null; endAt?: string | null }, nowMs: number): boolean {
  if (a.endAt) return new Date(a.endAt).getTime() > nowMs;
  return !!a.startAt && new Date(a.startAt).getTime() > nowMs - 30 * 60_000;
}

type StatusFilter = "all" | "confirmed" | "pending";
type TabKey = "sessions" | "packages";

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
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [packages, setPackages] = useState<PatientPackageItem[]>([]);
  // Kartlarda psixoloq şəkli: public kataloqdan id → photoUrl xəritəsi
  const [psyPhotos, setPsyPhotos] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  // Tab: paket detalından geri dönüş ?tab=paketler ilə düz taba düşsün.
  const [tab, setTab] = useState<TabKey>(searchParams.get("tab") === "paketler" ? "packages" : "sessions");
  // "Aç" düyməsi — seansın ətraflı məlumat pəncərəsi
  const [detailFor, setDetailFor] = useState<AppointmentDetail | null>(null);
  // GAP-03: new no-penalty flow — patient proposes slots, psychologist decides
  const [reschedRequestFor, setReschedRequestFor] = useState<AppointmentDetail | null>(null);
  const [disputeFor, setDisputeFor] = useState<AppointmentDetail | null>(null);
  const [cancelFor, setCancelFor] = useState<AppointmentDetail | null>(null);
  const [proposals, setProposals] = useState<RescheduleProposal[]>([]);
  const [proposalFor, setProposalFor] = useState<RescheduleProposal | null>(null);
  const [psyFilter, setPsyFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const switchTab = (next: TabKey) => {
    setTab(next);
    window.history.replaceState(null, "", next === "packages" ? "?tab=paketler" : window.location.pathname);
  };

  // Tick every minute for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = () => {
    setLoading(true);
    Promise.all([
      patientApi.myAppointments(),
      patientApi.pendingRescheduleProposals().catch(() => [] as RescheduleProposal[]),
      patientApi.myPackages().catch(() => [] as PatientPackageItem[]),
      getPsychologists().catch(() => []),
    ])
      .then(([appts, props, pkgs, psys]) => {
        setItems(appts);
        setPackages(pkgs);
        const photos: Record<number, string> = {};
        for (const p of psys) if (p.photoUrl) photos[p.id] = p.photoUrl;
        setPsyPhotos(photos);
        // Pasiyent artıq PSİXOLOQ-təşəbbüslü vaxt təklifini özü qəbul/rədd ETMİR —
        // psixoloq Cədvəldə yeni vaxt təklif edəndə qərarı OPERATOR yekunlaşdırır
        // (pasiyent yalnız məlumatlandırılır). Yalnız OPERATOR-təşəbbüslü təkliflər
        // (B4-2 swap vasitəçiliyi — operatorun qəsdən pasiyentə təklifi) pasiyentin
        // qərarına qalır; PATIENT-öz sorğuları psixoloqu gözləyir.
        setProposals(props.filter(p => p.initiator === "OPERATOR"));
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

  // Paketin hələ CANLI (gələcək/gözləyən) seansı varmı? SCHEDULE_NOW paketi alınan
  // kimi bütün seanslar rezerv olunub remaining=0 → backend statusu EXHAUSTED edir,
  // ödəniş operator təsdiqindən keçməsə də. Seanslar hələ irəlidə (və ya PENDING)
  // olduğundan belə paket "bitmiş" deyil — canlı seansa görə aktiv sayılır.
  const pkgHasLiveSessions = useMemo(() => {
    const live = new Set<number>();
    for (const a of items) {
      if (a.patientPackageId == null) continue;
      const terminal = a.status === "COMPLETED" || a.status === "CANCELLED" || a.status === "REJECTED";
      if (!terminal) live.add(a.patientPackageId);
    }
    return live;
  }, [items]);

  const isOngoingPackage = (p: PatientPackageItem) =>
    p.status === "ACTIVE" || pkgHasLiveSessions.has(p.id);

  // "Paketlərim" — aktiv (seans qalan VƏ YA canlı seansı olan) paketlər balans kartı kimi göstərilir.
  const activePackages = useMemo(
    () => packages.filter(isOngoingPackage),
    [packages, pkgHasLiveSessions],
  );

  // Bitmiş/müddəti keçmiş/ləğv edilmiş paketlər — yalnız canlı seansı qalmayanlar.
  const pastPackages = useMemo(
    () => packages.filter(p => !isOngoingPackage(p)),
    [packages, pkgHasLiveSessions],
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
      .filter(a => notEndedYet(a, now.getTime()))
      .filter(a => a.status === "ASSIGNED" || a.status === "CONFIRMED" || a.status === "CANCEL_REQUESTED")
      .filter(matchesFilters)
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, now, psyFilter, statusFilter]);

  /** All upcoming, filtered, xronoloji — bir grid-də. Ayrıca "Operator təsdiqi
   *  gözləyir" bölməsi yoxdur: PENDING/REJECTED müraciətlər də bu sıraya vaxtına
   *  görə daxil olur. Paket seansları da adi seans kimi görünür («Paket» nişanı). */
  const agendaList = useMemo(() => {
    return items
      .filter(a => {
        // Gözləyən müraciətlər vaxt filtrindən keçmir — operator baxana qədər görünür.
        if (a.status === "PENDING" || a.status === "REJECTED") return true;
        if (a.status !== "ASSIGNED" && a.status !== "CONFIRMED" && a.status !== "CANCEL_REQUESTED") return false;
        return notEndedYet(a, now.getTime());
      })
      .filter(matchesFilters)
      .sort((x, y) => {
        const dx = new Date(x.startAt ?? x.requestedStartAt ?? x.createdAt).getTime();
        const dy = new Date(y.startAt ?? y.requestedStartAt ?? y.createdAt).getTime();
        return dx - dy;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, now, psyFilter, statusFilter]);

  const agendaTotal = agendaList.length;

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

  return (
    <div className="psy-appt-page" style={{ maxWidth: 1040, margin: "0 auto" }}>
      <style>{PA_STYLE}</style>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", color: "var(--oxford)" }}>{t("appt.pageTitle")}</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>{t("appt.pageSub")}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/patient/appointments/history"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#fff", color: "var(--oxford)",
              border: "1px solid #D6E2F7",
              padding: "11px 17px", borderRadius: 10,
              fontSize: 14, fontWeight: 600, textDecoration: "none",
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>
            Tarixçə
          </Link>
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
        </div>
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
      ) : items.length === 0 && packages.length === 0 ? (
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
          <NextSessionHero
            appt={next}
            now={now}
            sessionNumber={next ? sessionOrdinalFor(next) : null}
            photoUrl={next?.psychologistId != null ? psyPhotos[next.psychologistId] ?? null : null}
            busyId={busyId}
            onConfirm={(a) => action(a.id, () => patientApi.confirmSession(a.id))}
            onDispute={(a) => setDisputeFor(a)}
            onReschedule={(a) => openReschedule(a)}
            onCancel={(a) => cancel(a)}
          />

          {/* Seanslar / Paketlər tab seçimi */}
          <div role="tablist" style={{ display: "inline-flex", gap: 4, background: "#fff", border: "1px solid #EDF1F8", borderRadius: 12, padding: 5, boxShadow: "0 2px 12px rgba(0,0,0,.04)" }}>
            {([
              ["sessions", "Seanslar", agendaTotal],
              ["packages", "Paketlər", activePackages.length],
            ] as [TabKey, string, number][]).map(([key, label, count]) => {
              const active = tab === key;
              return (
                <button key={key} type="button" role="tab" aria-selected={active} onClick={() => switchTab(key)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, background: active ? "var(--brand)" : "transparent", color: active ? "#fff" : "var(--oxford)", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                  {label}
                  <span style={{ background: active ? "rgba(255,255,255,.22)" : "var(--brand-50)", color: active ? "#fff" : "var(--brand-700)", fontSize: 11.5, fontWeight: 700, minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
                </button>
              );
            })}
          </div>

          {tab === "sessions" && (
            <>
              {(psyChips.length > 1 || statusFilter !== "all" || psyFilter != null) && (
                <div style={{ marginTop: 18 }}>
                  <FilterBar
                    psyChips={psyChips}
                    psyFilter={psyFilter}
                    statusFilter={statusFilter}
                    onPsy={setPsyFilter}
                    onStatus={setStatusFilter}
                  />
                </div>
              )}

              <Section title="Yaxınlaşan" count={agendaTotal} icon="" collapsible={false}>
                {agendaList.length === 0 ? (
                  <Empty msg={
                    psyFilter != null || statusFilter !== "all"
                      ? "Bu filtrlərə uyğun yaxınlaşan randevu yoxdur"
                      : "Yaxınlaşan randevu yoxdur"
                  } />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(330px, 100%), 1fr))", gap: 12 }}>
                    {agendaList.map(a => (
                      <AgendaRow
                        key={a.id}
                        a={a}
                        isNext={next?.id === a.id}
                        now={now}
                        sessionNumber={sessionOrdinalFor(a)}
                        photoUrl={(a.psychologistId ?? a.requestedPsychologistId) != null ? psyPhotos[(a.psychologistId ?? a.requestedPsychologistId)!] ?? null : null}
                        onOpen={() => setDetailFor(a)}
                        onReschedule={() => openReschedule(a)}
                        onCancel={() => cancel(a)}
                      />
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}

          {tab === "packages" && (
            <>
              {activePackages.length === 0 ? (
                <div style={{ marginTop: 22 }}>
                  <Empty msg="Aktiv paketiniz yoxdur — paket almaq üçün psixoloq profilinə baxın" />
                </div>
              ) : (
                <Section title="Aktiv paketlər" count={activePackages.length} icon="" collapsible={false}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))",
                    gap: 16,
                  }}>
                    {activePackages.map(p => (
                      <PackageProgramCard
                        key={`pkg-${p.id}`}
                        pkg={p}
                        sessions={items.filter(a => a.patientPackageId === p.id)}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {pastPackages.length > 0 && (
                <Section title="Əvvəlki paketlər" count={pastPackages.length} icon="" card defaultCollapsed>
                  <div style={{ padding: "0 8px 10px" }}>
                    {pastPackages.map(p => (
                      <PastPackageRow key={`past-${p.id}`} pkg={p} />
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </>
      )}

      {detailFor && (
        <SessionDetailModal
          a={detailFor}
          photoUrl={detailFor.psychologistId != null ? psyPhotos[detailFor.psychologistId] ?? null : null}
          sessionNumber={sessionOrdinalFor(detailFor)}
          now={now}
          onClose={() => setDetailFor(null)}
          onReschedule={() => { openReschedule(detailFor); setDetailFor(null); }}
          onCancel={() => { cancel(detailFor); setDetailFor(null); }}
        />
      )}
      {reschedRequestFor && (
        <RescheduleRequestNoteModal
          appointment={reschedRequestFor}
          onClose={() => setReschedRequestFor(null)}
          onDone={() => { setReschedRequestFor(null); load(); }}
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
    </div>
  );
}

/* ─── Hero — next session ─────────────────────────────────────────────────── */

function NextSessionHero({
  appt, now, sessionNumber, photoUrl, busyId, onConfirm, onDispute, onReschedule, onCancel,
}: {
  appt: AppointmentDetail | null;
  now: Date;
  sessionNumber: number | null;
  photoUrl: string | null;
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
  const cancelRequested = appt.status === "CANCEL_REQUESTED";
  // Vaxt dəyişikliyi istəyi göndərilib, operator hələ baxmayıb — pasiyentə görünən
  // izi olmasa istəyin çatdığı bilinmir və təkrar-təkrar göndərilə bilər.
  const rescheduleRequested = !!appt.rescheduleRequestedAt
    && (appt.status === "CONFIRMED" || appt.status === "ASSIGNED");
  const urgent = tu.urgent || tu.expired;

  // "Qoşul" is the primary action here (JoinSessionButton variant="primary" — solid brand
  // button), everything else is a secondary ghost action at this same comfortable size.
  const heroGhostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#fff", color: "var(--oxford)", border: "1px solid var(--brand-200)", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" };
  const heroDangerBtn: React.CSSProperties = { ...heroGhostBtn, color: "#991B1B", border: "1px solid #F3D6D6" };

  // Badge/pill yox — hər biri öz sətrində, aydın etiketlə (yan-yana mətn qarışıq görünürdü).
  const metaParts: { text: string; color?: string }[] = [];
  if (sessionNumber) metaParts.push({ text: `Seans sayı: ${azOrdinal(sessionNumber)}` });
  if (appt.patientPackageId != null) metaParts.push({ text: appt.packageName ? `Paket: ${appt.packageName}` : "Paket" });
  if (appt.sessionKind === "INTRO") metaParts.push({ text: "Seans növü: Tanışlıq" });

  return (
    <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#F2F6FD 0%,#E4ECFA 100%)", border: `1px solid ${urgent ? "#FECACA" : "#D6E2F7"}`, borderRadius: 18, padding: "24px 26px", marginBottom: 32, boxShadow: "0 2px 12px rgba(8,47,109,.07)" }}>
      <div aria-hidden style={{ position: "absolute", top: -60, right: -40, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle,${urgent ? "rgba(239,68,68,.12)" : "rgba(16,81,183,.1)"},transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: urgent ? "#DC2626" : "var(--brand)" }}>
          Növbəti seans
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#082F6D" }}>
            {relativeDayLabel(start, now)} · <strong>{fmtTime(start)}{appt.endAt ? ` – ${fmtTime(new Date(appt.endAt))}` : ""}</strong>
          </span>
          <span className={tu.expired ? "pa-live" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: urgent ? "#DC2626" : "#059669", fontSize: 13, fontWeight: 700 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{tu.text}
          </span>
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <span style={{ width: 58, height: 58, borderRadius: "50%", background: "#082F6D", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 700, flex: "none", overflow: "hidden" }}>
          {photoUrl ? (

            <img src={photoUrl} alt={appt.psychologistName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : initialsOf(appt.psychologistName)}
        </span>
        <div style={{ flex: 1, minWidth: 230 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: metaParts.length > 0 ? 3 : 8 }}>{appt.psychologistName ?? "Operator psixoloq təyin edəcək"}</div>
          {metaParts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
              {metaParts.map((p, i) => (
                <span key={i} style={{ fontSize: 13, fontWeight: 600, color: p.color ?? "var(--oxford-60)" }}>
                  {p.text}
                </span>
              ))}
            </div>
          )}
          {appt.note && (
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "rgba(255,255,255,.6)", border: "1px solid #D6E2F7", borderRadius: 11, padding: "10px 13px", width: "100%", boxSizing: "border-box" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1051B7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              <span style={{ fontSize: 13.5, color: "var(--oxford)", fontWeight: 500, lineHeight: 1.5 }}>Mövzunuz: <span style={{ fontStyle: "italic" }}>«{appt.note.slice(0, 140)}{appt.note.length > 140 ? "…" : ""}»</span></span>
            </div>
          )}
          {cleanOperatorNote(appt.operatorNote) && (
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "rgba(255,255,255,.6)", border: "1px solid #FDE68A", borderRadius: 11, padding: "10px 13px", width: "100%", boxSizing: "border-box", marginTop: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><path d="M9 12h6M9 16h4M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" /></svg>
              <span style={{ fontSize: 13.5, color: "#92400E", fontWeight: 500, lineHeight: 1.5 }}>Operator qeydi: <span style={{ fontStyle: "italic" }}>«{cleanOperatorNote(appt.operatorNote).slice(0, 140)}{cleanOperatorNote(appt.operatorNote).length > 140 ? "…" : ""}»</span></span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
        {showConfirm && !alreadyConfirmed && (
          <div className="pa-hero-actions">
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
          </div>
        )}
        {showConfirm && alreadyConfirmed && (
          <span className="psy-hero__btn psy-hero__btn--ghost" style={{ cursor: "default" }}>
            {t("appt.youConfirmed")}
          </span>
        )}
        {cancelRequested ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>
            <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
            Ləğv istəyiniz operator təsdiqini gözləyir
          </div>
        ) : !tu.expired && (
          <>
            {rescheduleRequested && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>
                <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
                Vaxt dəyişikliyi istəyiniz operatora göndərilib — sizinlə əlaqə saxlanılacaq
              </div>
            )}
            <div className="pa-hero-actions">
              <JoinSessionButton appointment={appt} variant="primary" />
              <AddToCalendarMenu appointment={appt} />
              {!rescheduleRequested && (
                <button onClick={() => onReschedule(appt)} style={heroGhostBtn}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  {t("staff.cardReschedule")}
                </button>
              )}
              <button onClick={() => onCancel(appt)} style={heroDangerBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                {t("staff.cardCancel")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Package card — xülasə kartı; klik → paket detal səhifəsi ──────────────
   Paketin seansları burada idarə olunmur — onlar «Seanslar» tabında adi seans
   kimi, tam siyahı isə paket detal səhifəsində görünür. */

function PackageProgramCard({
  pkg, sessions,
}: {
  pkg: PatientPackageItem;
  sessions: AppointmentDetail[];
}) {
  // Balans: remaining = hələ planlanmamış seanslar (backend hesabıdır).
  // Tamamlanan/planlanan saylar pasiyentin randevu siyahısından çıxarılır.
  const completed = sessions.filter(a => a.status === "COMPLETED").length;
  const planned = sessions.filter(a => a.status !== "COMPLETED" && a.status !== "CANCELLED").length;
  const completedPct = pkg.total > 0 ? (completed / pkg.total) * 100 : 0;
  const plannedPct = pkg.total > 0 ? (planned / pkg.total) * 100 : 0;

  return (
    <Link href={`/patient/appointments/packages/${pkg.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 22, display: "flex", flexDirection: "column", height: "100%", cursor: "pointer" }}>
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
            {completed}/{pkg.total} tamamlanıb · <span style={{ color: "var(--brand)" }}>{pkg.remaining} seans qalıb</span>
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)" }}>{Math.round(completedPct)}%</span>
        </div>
        <div style={{ display: "flex", height: 9, background: "var(--brand-100)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${completedPct}%`, height: "100%", background: "linear-gradient(90deg,#1051B7,#3A74D6)" }} />
          <div style={{ width: `${plannedPct}%`, height: "100%", background: "#9DBCEB" }} />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "var(--oxford-60)", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1051B7", flex: "none" }} />{completed} tamamlanıb</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9DBCEB", flex: "none" }} />{planned} planlanıb</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand-100)", flex: "none" }} />{pkg.remaining} planlanmamış</span>
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto", paddingTop: 4, color: "var(--brand)", fontSize: 13.5, fontWeight: 700 }}>
        {pkg.remaining > 0 ? "Paketə bax və seans planla" : "Paketə bax"}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </div>
    </div>
    </Link>
  );
}

/* ─── Əvvəlki paket sətri — klik → paket detal səhifəsi ──────────────────── */

function PastPackageRow({ pkg }: { pkg: PatientPackageItem }) {
  const st = PKG_STATUS[pkg.status] ?? PKG_STATUS.EXHAUSTED;
  const used = Math.max(0, pkg.total - pkg.remaining);
  return (
    <Link href={`/patient/appointments/packages/${pkg.id}`} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderTop: "1px solid #F0F4FA", padding: "13px 12px", textDecoration: "none", color: "inherit" }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 100 }}>{azFormatDate(pkg.purchasedAt)}</span>
      <div style={{ flex: 1, minWidth: 170 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{pkg.packageName}</div>
        <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 2 }}>{pkg.psychologistName}</div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford-60)" }}>{used}/{pkg.total} seans istifadə olunub</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)" }}>{formatAzn(pkg.pricePaid)}</span>
      <span style={{ background: st.bg, color: st.color, fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999 }}>{st.label}</span>
    </Link>
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

/* ─── Agenda card — seans kartı ──────────────────────────────────────────────
   Struktur: şəkil + ad → vaxt aralığı → status → aşağıda "Seansa qoşul"
   (link təyin edilibsə aktiv, edilməyibsə boz). Digər əməliyyatlar (təqvim,
   vaxt dəyişmə, ləğv) yuxarı sağdakı 3 nöqtə menyusundadır. */

function AgendaRow({
  a, isNext, now, sessionNumber, photoUrl, onOpen, onReschedule, onCancel,
}: {
  a: AppointmentDetail;
  isNext: boolean;
  now: Date;
  sessionNumber: number | null;
  photoUrl: string | null;
  onOpen: () => void;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  // Operator təsdiqi gözləyən müraciət (PENDING/REJECTED) — ayrıca bölmə yoxdur,
  // eyni kart sırasında göstərilir: vaxt "istədiyiniz vaxt"dır, əməliyyatlar bağlıdır.
  const awaiting = a.status === "PENDING" || a.status === "REJECTED";
  const when = a.startAt ?? a.requestedStartAt;
  const start = a.startAt ? new Date(a.startAt) : null;
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  const tu = start ? timeUntil(start, now) : null;
  const isToday = start ? isSameDay(start, now) : false;
  const cancelRequested = a.status === "CANCEL_REQUESTED";
  const rescheduleRequested = !!a.rescheduleRequestedAt
    && (a.status === "CONFIRMED" || a.status === "ASSIGNED");
  const psyName = a.psychologistName ?? a.requestedPsychologistName ?? null;
  const awaitingHint = a.status === "REJECTED"
    ? "Operator sizə yeni psixoloq təyin edəcək"
    : "Operatorumuz müraciətinizi nəzərdən keçirir";
  return (
    <div className={`psy-card psy-card--today${isNext ? " psy-card--next" : ""}`} style={{ borderLeft: `3px solid ${status.accent}`, display: "flex", flexDirection: "column" }}>
      {/* Şəkil + ad, sağda 3 nöqtə menyu */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div className="psy-card__avatar" style={{ width: 46, height: 46, overflow: "hidden", ...(photoUrl ? {} : { background: "#082F6D", color: "#fff", border: "none" }) }}>
          {photoUrl ? (
            <img src={photoUrl} alt={psyName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : initialsOf(psyName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="psy-card__name">{psyName ?? "Operator təyin edəcək"}</div>
          {sessionNumber != null && <div className="psy-card__nth">{azOrdinal(sessionNumber)} seans</div>}
        </div>
        {!cancelRequested && !awaiting && (
          <SessionCardMenu a={a} onReschedule={onReschedule} onCancel={onCancel}
            hideReschedule={rescheduleRequested} />
        )}
      </div>

      {/* Vaxt aralığı — tarix başlıqları yığışdırılıb, gün etiketi burada */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {when ? (
          <span className="psy-card__time">
            {relativeDayLabel(new Date(when), now)} · {fmtTime(new Date(when))}{start && a.endAt ? ` – ${fmtTime(new Date(a.endAt))}` : ""}
          </span>
        ) : (
          <span className="psy-card__time" style={{ color: "var(--oxford-60)" }}>Vaxt operator təyin edəcək</span>
        )}
        {awaiting && when && <span style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600 }}>istədiyiniz vaxt</span>}
        {isToday && tu && !tu.expired && (
          <span className={tu.urgent ? "pa-live" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: tu.urgent ? "#FEE2E2" : "#ECFDF5", color: tu.urgent ? "#991B1B" : "#047857", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            {tu.text}
          </span>
        )}
      </div>

      {/* Status + nişanlar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <span className="psy-card__badge" style={{ background: status.bg, color: status.color }}>{status.label}</span>
        {isNext && <span className="psy-card__chip psy-card__chip--next">Növbəti</span>}
        {a.patientPackageId != null && <PackageBadge name={a.packageName} />}
        {a.sessionKind === "INTRO" && <IntroBadge />}
      </div>

      {/* Gözləmə vəziyyətləri */}
      {cancelRequested && (
        <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>
          <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
          Ləğv istəyiniz operator təsdiqini gözləyir
        </div>
      )}
      {awaiting && (
        <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>
          <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
          {awaitingHint}
        </div>
      )}
      {rescheduleRequested && (
        <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>
          <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
          Vaxt dəyişikliyi istəyiniz operatora göndərilib
        </div>
      )}

      {/* Aşağı: Aç (ətraflı məlumat) + Qoşul */}
      <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 14 }}>
        <button type="button" onClick={onOpen}
          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 14px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
          Aç
        </button>
        {!cancelRequested && !awaiting && (
          <div style={{ flex: 1.6 }}>
            <SessionJoinButton a={a} />
          </div>
        )}
      </div>
    </div>
  );
}

/* Google Calendar hadisə linki (AddToCalendarMenu ilə eyni format) —
   3 nöqtə menyusu və detal pəncərəsi tərəfindən paylaşılır. */
function gcalHrefFor(a: AppointmentDetail): string | null {
  if (!a.startAt || !a.endAt) return null;
  return googleCalendarUrl({
    uid: String(a.id),
    title: `Fanus seansı${a.psychologistName ? ` — ${a.psychologistName}` : ""}`,
    description: [
      a.psychologistName ? `Psixoloq: ${a.psychologistName}` : null,
      a.note ? `Qeyd: ${a.note}` : null,
      appUrl("/patient/appointments"),
    ].filter(Boolean).join("\n"),
    location: "Online (Fanus)",
    start: new Date(a.startAt),
    end: new Date(a.endAt),
    url: appUrl("/patient/appointments"),
  });
}

/* Qoşulma düyməsi — link operator tərəfindən təyin edilibsə aktiv (brand),
   edilməyibsə boz/deaktiv. Ödəniş təsdiqlənməyibsə də bloklanır. */
function SessionJoinButton({ a }: { a: AppointmentDetail }) {
  const link = a.meetingLink;
  const paymentPending = a.paymentStatus === "PENDING";
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", borderRadius: 10, padding: "11px 14px",
    fontSize: 13.5, fontWeight: 700, fontFamily: "inherit",
  };
  if (link && !paymentPending) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer"
        style={{ ...base, background: "var(--brand)", color: "#fff", textDecoration: "none", boxShadow: "0 4px 14px rgba(16,81,183,.25)" }}>
        <VideoIcon />
        Seansa qoşul
      </a>
    );
  }
  return (
    <span
      title={paymentPending ? "Ödəniş operator tərəfindən hələ təsdiqlənməyib" : "Görüş linkini operator təyin edəcək"}
      style={{ ...base, background: "#EEF2F8", color: "#9AA7BD", cursor: "not-allowed", userSelect: "none" }}>
      <VideoIcon />
      {paymentPending ? "Ödəniş gözlənilir" : "Seansa qoşul"}
    </span>
  );
}

function VideoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="m22 8-6 4 6 4V8Z" /><rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

/* 3 nöqtə menyu — Google Calendar, Vaxtı dəyiş, Ləğv et */
function SessionCardMenu({ a, onReschedule, onCancel, hideReschedule }: {
  a: AppointmentDetail;
  onReschedule: () => void;
  onCancel: () => void;
  /** Vaxt dəyişikliyi istəyi artıq göndərilib — təkrar göndərməyə imkan vermə. */
  hideReschedule?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const itemStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 9, width: "100%",
    background: "transparent", border: "none", borderRadius: 8,
    padding: "9px 11px", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
    color: "var(--oxford)", cursor: "pointer", textDecoration: "none", textAlign: "left",
  };

  const gcalHref = gcalHrefFor(a);

  return (
    <div style={{ position: "relative", flex: "none" }}>
      <button type="button" aria-label="Əməliyyatlar" onClick={() => setOpen(o => !o)}
        style={{ width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", background: open ? "var(--brand-50)" : "transparent", color: "var(--oxford-60)", border: "none", borderRadius: 8, cursor: "pointer" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: 36, right: 0, zIndex: 41, background: "#fff", border: "1px solid #E3EAF6", borderRadius: 12, boxShadow: "0 10px 30px rgba(8,47,109,.14)", padding: 6, minWidth: 224, animation: "paFade .15s ease" }}>
            {gcalHref && (
              <a href={gcalHref} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} style={itemStyle}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Google Calendar-a əlavə et
              </a>
            )}
            {!hideReschedule && (
              <button type="button" onClick={() => { setOpen(false); onReschedule(); }} style={itemStyle}>
                <IconClock />
                Vaxtı dəyiş
              </button>
            )}
            <div style={{ height: 1, background: "#F0F4FA", margin: "4px 6px" }} />
            <button type="button" onClick={() => { setOpen(false); onCancel(); }} style={{ ...itemStyle, color: "#991B1B" }}>
              <IconX />
              Ləğv et
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Seans detal pəncərəsi — "Aç" düyməsi ilə açılır ─────────────────────────
   Seans barədə bütün məlumat bir yerdə: vaxt, status, paket, ödəniş, mövzu,
   operator qeydi, görüş linki və əməliyyatlar. */

function SessionDetailModal({
  a, photoUrl, sessionNumber, now, onClose, onReschedule, onCancel,
}: {
  a: AppointmentDetail;
  photoUrl: string | null;
  sessionNumber: number | null;
  now: Date;
  onClose: () => void;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  const start = a.startAt ? new Date(a.startAt) : null;
  const tu = start ? timeUntil(start, now) : null;
  const cancelRequested = a.status === "CANCEL_REQUESTED";
  const rescheduleRequested = !!a.rescheduleRequestedAt
    && (a.status === "CONFIRMED" || a.status === "ASSIGNED");
  // Operator təsdiqi gözləyən müraciət — görüş/əməliyyat blokları bağlıdır.
  const awaiting = a.status === "PENDING" || a.status === "REJECTED";
  const psyName = a.psychologistName ?? a.requestedPsychologistName ?? null;
  const gcalHref = gcalHrefFor(a);

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 };
  const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textDecoration: "none" };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,22,51,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Başlıq: şəkil + ad + status */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)", display: "flex", alignItems: "center", gap: 12 }}>
          <div className="psy-card__avatar" style={{ width: 46, height: 46, overflow: "hidden", ...(photoUrl ? {} : { background: "#082F6D", color: "#fff", border: "none" }) }}>
            {photoUrl ? (
              <img src={photoUrl} alt={psyName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : initialsOf(psyName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{psyName ?? "Operator təyin edəcək"}</div>
            {sessionNumber != null && <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 1 }}>{azOrdinal(sessionNumber)} seans</div>}
          </div>
          <span className="psy-card__badge" style={{ background: status.bg, color: status.color, flex: "none" }}>{status.label}</span>
          {a.sessionKind === "INTRO" && <IntroBadge />}
          <button type="button" aria-label="Bağla" onClick={onClose}
            style={{ width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", color: "var(--oxford-60)", border: "none", borderRadius: 8, cursor: "pointer", flex: "none" }}>
            <IconX />
          </button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Vaxt */}
          <div>
            <div style={labelStyle}>Vaxt</div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
                {a.startAt
                  ? `${azFormatDate(a.startAt)} · ${fmtTime(new Date(a.startAt))}${a.endAt ? ` – ${fmtTime(new Date(a.endAt))}` : ""}`
                  : a.requestedStartAt
                    ? `İstədiyiniz vaxt: ${azFormatDate(a.requestedStartAt)} · ${fmtTime(new Date(a.requestedStartAt))}`
                    : "Operator vaxtı təyin edəcək"}
              </span>
              {tu && !tu.expired && (
                <span className={tu.urgent ? "pa-live" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: tu.urgent ? "#FEE2E2" : "#ECFDF5", color: tu.urgent ? "#991B1B" : "#047857", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  {tu.text}
                </span>
              )}
            </div>
          </div>

          {/* Paket bağlantısı */}
          {a.patientPackageId != null && (
            <div>
              <div style={labelStyle}>Paket</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--brand-50)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 13px", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: "var(--brand-700)" }}>
                  <PackageBadge name={a.packageName} />
                  {a.packageName ?? "Paket seansı"}
                  {a.packageTotal != null && a.packageRemaining != null && (
                    <span style={{ fontWeight: 600, color: "var(--oxford-60)", fontSize: 12.5 }}>· {a.packageRemaining} seans qalıb</span>
                  )}
                </span>
                <Link href={`/patient/appointments/packages/${a.patientPackageId}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", textDecoration: "none", whiteSpace: "nowrap" }}>
                  Paketə bax
                </Link>
              </div>
            </div>
          )}

          {/* Ödəniş (yalnız tək seans) */}
          {a.paymentStatus != null && (
            <div>
              <div style={labelStyle}>Ödəniş</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--oxford)" }}>
                {a.paymentAmount ? formatAzn(a.paymentAmount) : "Məbləğ təyin edilməyib"}
                <span style={{ color: a.paymentStatus === "PAID" ? "#047857" : "#92400E", marginLeft: 8 }}>
                  {a.paymentStatus === "PAID" ? "Təsdiqlənib" : "Operator təsdiqi gözlənilir"}
                </span>
              </div>
            </div>
          )}

          {/* Mövzu */}
          {a.note && (
            <div>
              <div style={labelStyle}>Mövzunuz</div>
              <div style={{ fontSize: 13.5, color: "var(--oxford)", fontStyle: "italic", fontWeight: 500, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 13px", lineHeight: 1.5 }}>
                «{a.note}»
              </div>
            </div>
          )}

          {/* Operator qeydi */}
          {cleanOperatorNote(a.operatorNote) && (
            <div>
              <div style={labelStyle}>Operator qeydi</div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 13px", fontSize: 13.5, color: "#92400E", fontWeight: 500, lineHeight: 1.5 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }}><path d="M9 12h6M9 16h4M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" /></svg>
                <span style={{ fontStyle: "italic" }}>«{cleanOperatorNote(a.operatorNote)}»</span>
              </div>
            </div>
          )}

          {/* Görüş linki — gözləyən müraciətdə hələ mənasızdır */}
          {!awaiting && (
            <div>
              <div style={labelStyle}>Görüş</div>
              <SessionJoinButton a={a} />
              {!a.meetingLink && (
                <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, marginTop: 6 }}>
                  Görüş linki operator tərəfindən seans vaxtından əvvəl təyin ediləcək.
                </div>
              )}
            </div>
          )}

          {/* Əməliyyatlar */}
          {cancelRequested || awaiting ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>
              <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
              {cancelRequested
                ? "Ləğv istəyiniz operator təsdiqini gözləyir"
                : a.status === "REJECTED"
                  ? "Operator sizə yeni psixoloq təyin edəcək"
                  : "Operatorumuz müraciətinizi nəzərdən keçirir"}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid #F0F4FA", paddingTop: 16 }}>
              {rescheduleRequested && (
                <div style={{ width: "100%", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>
                  <span className="pa-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flex: "none" }} />
                  Vaxt dəyişikliyi istəyiniz operatora göndərilib
                </div>
              )}
              {gcalHref && (
                <a href={gcalHref} target="_blank" rel="noopener noreferrer" style={ghostBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  Google Calendar-a əlavə et
                </a>
              )}
              {!rescheduleRequested && (
                <button type="button" onClick={onReschedule} style={ghostBtn}>
                  <IconClock />
                  Vaxtı dəyiş
                </button>
              )}
              <button type="button" onClick={onCancel} style={{ ...ghostBtn, color: "#991B1B", border: "1px solid #F3D6D6" }}>
                <IconX />
                Ləğv et
              </button>
            </div>
          )}
        </div>
      </div>
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
  // Modal açılan andakı vaxt — render içində Date.now() çağırmamaq üçün state-də.
  const [openedAtMs] = useState(() => Date.now());

  const hoursLeft = appointment.startAt
    ? (new Date(appointment.startAt).getTime() - openedAtMs) / (1000 * 60 * 60)
    : null;
  const isLate = hoursLeft !== null && hoursLeft >= 0 && hoursLeft < 24;
  // Paket seansında "geri qaytarma" pul deyil, 1 seans krediti bərpasıdır (backend:
  // maybeRestorePackageSession). Tək seansda isə yalnız PAID ödəniş refund-a namizəddir,
  // və bu da operatorun əl ilə təsdiqlədiyi ayrıca proses — avtomatik deyil.
  const isPackageSession = appointment.patientPackageId != null;
  const paymentConfirmed = appointment.paymentStatus === "PAID";

  const submit = async () => {
    setSaving(true);
    try {
      const updated = await patientApi.cancel(appointment.id, "PATIENT_OTHER", note.trim() || undefined);
      onDone(updated);
    } catch (e) { toast((e as Error).message, "error"); setSaving(false); }
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
          {isLate ? (
            <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#991B1B", lineHeight: 1.5 }}>
              Seansa <strong>{Math.max(0, Math.floor(hoursLeft!))} saat</strong> qalıb (24 saatdan az).{" "}
              {isPackageSession ? (
                <>Bu halda <strong>bu seans krediti geri qaytarılmır</strong> və gec-ləğv sayğacınıza əlavə olunur.</>
              ) : paymentConfirmed ? (
                <>Bu halda <strong>ödənişiniz geri qaytarılmır</strong> və gec-ləğv sayğacınıza əlavə olunur.</>
              ) : (
                <>Bu, gec-ləğv sayğacınıza əlavə olunacaq.</>
              )}
            </div>
          ) : isPackageSession ? (
            <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#166534", lineHeight: 1.5 }}>
              Seansa 24 saatdan çox qaldığı üçün <strong>bu seans krediti paketinizə geri qaytarılacaq</strong> — başqa vaxta təyin edə bilərsiniz. Paketin ödənişinə təsir etmir.
            </div>
          ) : paymentConfirmed ? (
            <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#166534", lineHeight: 1.5 }}>
              Seansa 24 saatdan çox qaldığı üçün <strong>ödənişiniz geri qaytarmaya uyğundur</strong> — operator müraciətinizi nəzərdən keçirib əlaqə saxlayacaq.
            </div>
          ) : null}
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Səbəb (məcburi deyil)"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1.5px solid var(--brand-100)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
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

  const submit = async () => {
    setSaving(true);
    try {
      await patientApi.requestRescheduleNote(appointment.id, note.trim() || undefined);
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setSaving(false); }
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

  const submit = async () => {
    setSaving(true);
    try {
      const updated = await patientApi.disputeSession(appointment.id, reason.trim() || undefined);
      onDone(updated);
    } catch (e) {
      toast((e as Error).message, "error");
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
