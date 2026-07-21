"use client";

// ============================================================================
// Psixoloq randevuları — pasient tərəfi ilə eyni dizayn dili:
//   • Header: başlıq + sağda "Tarixçə" (alt səhifə) və "Təqvim" keçidləri
//   • Hero: növbəti seans
//   • Tablar: Seanslar | Paketlər | Yönləndirmələr (?view=referrals deep-link)
//   • Seans kartları bir grid-də (təsdiq gözləyən/mübahisəli də daxil) —
//     kartda: pasient + gün·vaxt + status, altda "Aç" (detal) + əsas düymə
//   • Tarixçə ayrıca səhifədədir: /psycholog/appointments/history
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
import PageHeader from "@/components/PageHeader";
import { useSearchParams } from "next/navigation";
import {
  psychologistApi,
  isSlotConflict,
  type AppointmentDetail,
  type ClientNote,
  type ClientSummary,
  type RescheduleProposal,
} from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import CancelModal from "@/components/CancelModal";
import RescheduleComposeModal from "@/components/RescheduleComposeModal";
import PsyReferralsView from "@/components/PsyReferralsView";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azOrdinal } from "@/lib/datetime";
import {
  MONTHS_AZ, pad2, fmtTime, isSameDay, relativeDayLabel, timeUntil,
  initialsOf, avatarColor, NO_SHOW_REPORT_WINDOW_MS, PSY_APPT_STYLE,
  IClock, IMsg, ICal, IAlert, IRefresh, ICheck, IUser, IX, IOpen, ILayers,
  StatusText, SessionMeta, MetaItem, Empty, PsyJoinButton, gcalHrefFor,
  RowMenu, type MenuItem, DisputeModal, OutcomeModal,
} from "./shared";

const ACTIVE_STATUSES = new Set(["ASSIGNED", "CONFIRMED", "CANCEL_REQUESTED"]);
const ATTENTION_STATUSES = new Set(["AWAITING_CONFIRMATION", "DISPUTED"]);

/** Seans hələ bitməyibsə (yaxınlaşan/davam edən) true. Bitmə vaxtı (endAt) keçibsə
 *  seans BİTİB. Əvvəllər "startAt > now − 30dəq" proxy-si istifadə olunurdu —
 *  bu, 15 dəqlik INTRO kimi qısa seanslar bitsə də hələ "növbəti" göstərirdi
 *  (məs. 20:20–20:35 seans saat 20:39-da hələ növbəti görünürdü). */
function notEndedYet(a: { startAt?: string | null; endAt?: string | null }, nowMs: number): boolean {
  if (a.endAt) return new Date(a.endAt).getTime() > nowMs;
  return !!a.startAt && new Date(a.startAt).getTime() > nowMs - 30 * 60_000;
}

type TabKey = "sessions" | "packages" | "referrals";

export default function PsychologistAppointmentsPage() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [notesByPatient, setNotesByPatient] = useState<Record<number, ClientNote | null>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  const [detailFor, setDetailFor] = useState<AppointmentDetail | null>(null);
  const [disputeFor, setDisputeFor] = useState<AppointmentDetail | null>(null);
  const [rejectFor, setRejectFor] = useState<AppointmentDetail | null>(null);
  const [cancelFor, setCancelFor] = useState<AppointmentDetail | null>(null);
  const [rescheduleProposeFor, setRescheduleProposeFor] = useState<AppointmentDetail | null>(null);
  const [outcomeFor, setOutcomeFor] = useState<AppointmentDetail | null>(null);
  // Tab: bildiriş deep-link-i (?view=referrals) Yönləndirmələr tabını açır.
  const [tab, setTab] = useState<TabKey>(() =>
    searchParams.get("view") === "referrals" ? "referrals"
      : searchParams.get("tab") === "paketler" ? "packages" : "sessions");
  const [referralPending, setReferralPending] = useState(0);
  // GAP-03: incoming patient-initiated reschedule requests awaiting my decision
  const [patientRequests, setPatientRequests] = useState<RescheduleProposal[]>([]);

  const switchTab = (next: TabKey) => {
    setTab(next);
    const q = next === "referrals" ? "?view=referrals" : next === "packages" ? "?tab=paketler" : window.location.pathname;
    window.history.replaceState(null, "", q);
  };

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
      // Yalnız PENDING təkliflər — bütün təklif tarixçəsini çəkməyə ehtiyac yoxdur.
      psychologistApi.myRescheduleProposals("PENDING").catch(() => [] as RescheduleProposal[]),
      psychologistApi.receivedReferralsCountPending().catch(() => 0),
    ])
      .then(([appts, cs, props, refPending]) => {
        setItems(appts);
        setClients(cs);
        setPatientRequests(props.filter(p => p.initiator === "PATIENT" && p.status === "PENDING"));
        setReferralPending(refPending);
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

  const next = useMemo(() => {
    return items
      .filter(a => notEndedYet(a, now.getTime()))
      .filter(a => a.status === "ASSIGNED" || a.status === "CONFIRMED")
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())[0] ?? null;
  }, [items, now]);

  /** Bütün yaxınlaşan seanslar + diqqət tələb edənlər — bir grid-də, xronoloji.
   *  Ayrıca "Diqqət" bölməsi yoxdur: təsdiq gözləyən / mübahisəli seanslar da
   *  bu sırada öz status nişanı ilə görünür (pasient tərəfindəki yanaşma). */
  const agendaList = useMemo(() => {
    return items
      .filter(a => {
        if (ATTENTION_STATUSES.has(a.status)) return true;
        if (!ACTIVE_STATUSES.has(a.status)) return false;
        return notEndedYet(a, now.getTime());
      })
      .sort((x, y) => {
        const dx = new Date(x.startAt ?? x.endAt ?? x.createdAt).getTime();
        const dy = new Date(y.startAt ?? y.endAt ?? y.createdAt).getTime();
        return dx - dy;
      });
  }, [items, now]);

  // Paketlər — əvvəl patientPackageId-ə, sonra pasientə görə qruplaşdırılır.
  // Eyni pasient eyni paketi bir neçə dəfə ala bilər — bunlar ayrı pasient kimi
  // deyil, BİR pasientin fərqli paketləri kimi görünməlidir.
  const packagePatients = useMemo(() => {
    const byPkg = new Map<number, AppointmentDetail[]>();
    for (const a of items) {
      if (a.patientPackageId != null) {
        const arr = byPkg.get(a.patientPackageId) ?? [];
        arr.push(a);
        byPkg.set(a.patientPackageId, arr);
      }
    }
    const pkgs: PackageGroup[] = Array.from(byPkg.entries()).map(([id, appts]) => ({
      id,
      patientId: appts[0].patientId ?? null,
      patientName: appts[0].patientName ?? "Pasiyent",
      sessions: [...appts].sort((x, y) =>
        new Date(x.startAt ?? x.createdAt).getTime() - new Date(y.startAt ?? y.createdAt).getTime()),
    }));
    const byPatient = new Map<string, PatientPackageGroup>();
    for (const p of pkgs) {
      const key = p.patientId != null ? `id-${p.patientId}` : `name-${p.patientName}`;
      const entry = byPatient.get(key) ?? { key, patientId: p.patientId, patientName: p.patientName, packages: [] };
      entry.packages.push(p);
      byPatient.set(key, entry);
    }
    return Array.from(byPatient.values())
      .map(e => ({ ...e, packages: [...e.packages].sort((a, b) => a.id - b.id) })) // alış sırası ilə
      .sort((a, b) => a.patientName.localeCompare(b.patientName, "az"));
  }, [items]);

  const packagesTotal = useMemo(
    () => packagePatients.reduce((n, p) => n + p.packages.length, 0),
    [packagePatients],
  );

  // Lazy-fetch latest clinical note for upcoming sessions' patients (detal pəncərəsi üçün)
  useEffect(() => {
    const ids = new Set<number>();
    if (next?.patientId) ids.add(next.patientId);
    agendaList.slice(0, 12).forEach(a => { if (a.patientId) ids.add(a.patientId); });
    const targets = Array.from(ids).filter(id => !(id in notesByPatient));
    if (!targets.length) return;
    targets.forEach(id => {
      psychologistApi.notesForPatient(id)
        .then(notes => setNotesByPatient(prev => ({ ...prev, [id]: notes[0] ?? null })))
        .catch(() => setNotesByPatient(prev => ({ ...prev, [id]: null })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendaList, next]);

  const action = async (id: number, fn: () => Promise<AppointmentDetail>) => {
    setBusyId(id);
    try {
      const updated = await fn();
      setItems(prev => prev.map(a => a.id === id ? updated : a));
      setDetailFor(prev => (prev && prev.id === id ? updated : prev));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const clientFor = (id?: number | null) =>
    id ? clients.find(c => c.patientId === id) ?? null : null;
  const noteFor = (id?: number | null) =>
    id ? notesByPatient[id] : undefined;

  const handlers: Handlers = {
    onAction: action,
    onDispute: setDisputeFor,
    onReject: setRejectFor,
    onCancel: setCancelFor,
    onPropose: setRescheduleProposeFor,
    onAddOutcome: setOutcomeFor,
  };

  return (
    <div className="psy-appt-page">
      <style>{PSY_APPT_STYLE}</style>
      <PageHeader
        title={t("staff.psyApptTitle")}
        subtitle={t("staff.psyApptSub")}
        actions={
          <>
            <Link href="/psycholog/appointments/history" className="pa-btn pa-btn--ghost pa-btn--auto">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>
              Tarixçə
            </Link>
            <Link href="/psycholog/calendar" className="pa-btn pa-btn--primary pa-btn--auto">
              <ICal s={17} c="#fff" />
              Təqvim
            </Link>
          </>
        }
      />

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>
          {t("common.loading")}
        </div>
      ) : (
        <>
          <NextHero appt={next} now={now} client={next ? clientFor(next.patientId) : null} busyId={busyId} h={handlers} />

          {/* Seanslar / Paketlər / Yönləndirmələr tab seçimi */}
          <div role="tablist" className="gor-tabs" style={{ display: "inline-flex", maxWidth: "100%", overflowX: "auto", gap: 4, background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 12, padding: 5 }}>
            {([
              ["sessions", "Seanslar", agendaList.length + patientRequests.length, false],
              ["packages", "Paketlər", packagesTotal, false],
              ["referrals", "Yönləndirmələr", referralPending, referralPending > 0],
            ] as [TabKey, string, number, boolean][]).map(([key, label, count, warn]) => {
              const active = tab === key;
              return (
                <button key={key} type="button" role="tab" aria-selected={active} onClick={() => switchTab(key)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: active ? "var(--brand)" : "transparent", color: active ? "#fff" : "var(--oxford-80)", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", flex: "none" }}>
                  {label}
                  {count > 0 && (
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: active ? "rgba(255,255,255,.75)" : warn ? "#B45309" : "var(--oxford-60)" }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {tab === "sessions" && (
            <div style={{ marginTop: 22 }}>
              {/* GAP-03: pasiyentin vaxt dəyişikliyi istəkləri — banner kartlar */}
              {patientRequests.length > 0 && (
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

              {agendaList.length === 0 ? (
                <Empty msg="Yaxınlaşan seans yoxdur." />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(330px, 100%), 1fr))", gap: 12 }}>
                  {agendaList.map(a => (
                    <SessionCard
                      key={a.id}
                      a={a}
                      client={clientFor(a.patientId)}
                      isNext={next?.id === a.id}
                      now={now}
                      busyId={busyId}
                      onOpen={() => setDetailFor(a)}
                      h={handlers}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "packages" && (
            <div style={{ marginTop: 22 }}>
              {packagePatients.length === 0 ? (
                <Empty msg="Paketli pasiyent yoxdur." />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", gap: 16, alignItems: "start" }}>
                  {packagePatients.map(pp => (
                    <PatientPackagesCard key={pp.key} group={pp} now={now} busyId={busyId} h={handlers} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "referrals" && (
            <div style={{ marginTop: 22 }}>
              <PsyReferralsView onPendingCount={setReferralPending} />
            </div>
          )}

          {detailFor && (
            <SessionDetailModal
              a={detailFor}
              client={clientFor(detailFor.patientId)}
              note={noteFor(detailFor.patientId)}
              now={now}
              busyId={busyId}
              h={handlers}
              onClose={() => setDetailFor(null)}
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
        </>
      )}
    </div>
  );
}

/* ═══ Kartlar və detal pəncərəsi ═══════════════════════════════════════════ */

type Handlers = {
  onAction: (id: number, fn: () => Promise<AppointmentDetail>) => Promise<void>;
  onDispute: (a: AppointmentDetail) => void;
  onReject: (a: AppointmentDetail) => void;
  onCancel: (a: AppointmentDetail) => void;
  onPropose: (a: AppointmentDetail) => void;
  onAddOutcome: (a: AppointmentDetail) => void;
};

/* ─── Növbəti seans ────────────────────────────────────────────────────────
   Üç sütun: nə vaxt · kim · nə etməli. Rəngli nişan yoxdur — tarix və vaxt
   tipoqrafiya ilə oxunur, status və paket sadə mətn sətirləridir. */

/** Sol sütun üçün qısa gün etiketi: "Bu gün" · "Sabah" · "12 Avq". */
function shortDayLabel(d: Date, now: Date) {
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(d, now)) return "Bu gün";
  if (isSameDay(d, tomorrow)) return "Sabah";
  return `${pad2(d.getDate())} ${MONTHS_AZ[d.getMonth()]}`;
}

function NextHero({ appt, now, client, busyId, h }: {
  appt: AppointmentDetail | null; now: Date; client: ClientSummary | null;
  busyId: number | null; h: Handlers;
}) {
  if (!appt || !appt.startAt) {
    return (
      <section style={{ marginBottom: 26 }}>
        <h2 className="pa-sec">Növbəti seans</h2>
        <div className="pa-next pa-next--empty">
          <ICal s={20} c="#9DB0CC" />
          Yaxınlaşan təsdiqli seans yoxdur.
        </div>
      </section>
    );
  }
  const start = new Date(appt.startAt);
  const end = appt.endAt ? new Date(appt.endAt) : null;
  const cd = timeUntil(start, now);
  const av = avatarColor(appt.patientId ?? appt.patientName);
  const sessionNumber = client ? client.completedSessions + 1 : null;
  const minutes = end ? Math.round((end.getTime() - start.getTime()) / 60_000) : null;
  const busy = busyId === appt.id;
  const needsConfirm = appt.status === "ASSIGNED";

  return (
    <section style={{ marginBottom: 26 }}>
      <h2 className="pa-sec">Növbəti seans</h2>
      <div className="pa-next">
        {/* Nə vaxt */}
        <div className="pa-next__when">
          <div className="pa-next__day">{shortDayLabel(start, now)}</div>
          <div className="pa-next__time">{fmtTime(start)}</div>
          {end && <div className="pa-next__end">{fmtTime(end)}-dək</div>}
        </div>

        {/* Kim */}
        <div className="pa-next__main">
          <span style={{ width: 44, height: 44, borderRadius: "50%", background: av, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, flex: "none" }}>
            {initialsOf(appt.patientName)}
          </span>
          <div className="pa-next__who">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="pa-next__name">{appt.patientName ?? "Pasiyent"}</span>
              <StatusText status={appt.status} />
            </div>
            <SessionMeta
              a={appt}
              extra={
                <>
                  <MetaItem icon={<ICal s={13} c="#9DB0CC" />}>{relativeDayLabel(start, now)}</MetaItem>
                  {sessionNumber ? <MetaItem icon={<ILayers />}>{azOrdinal(sessionNumber)} seans</MetaItem> : null}
                  {minutes ? <MetaItem icon={<IClock s={13} c="#9DB0CC" />}>{minutes} dəqiqə</MetaItem> : null}
                </>
              }
            />
          </div>
        </div>

        {/* Nə etməli */}
        <div className="pa-next__cta">
          {needsConfirm ? <PrimaryAction a={appt} busy={busy} h={h} /> : <PsyJoinButton a={appt} />}
          {!cd.expired && (
            <div className={`pa-next__count${cd.urgent ? " pa-next__count--urgent" : ""}`}>{cd.text}</div>
          )}
        </div>
      </div>
    </section>
  );
}

/* Status-a görə əsas düymə — kartın aşağı sağ hissəsində ("Qoşul" yeri). */
function PrimaryAction({ a, busy, h }: { a: AppointmentDetail; busy: boolean; h: Handlers }) {
  if (a.status === "ASSIGNED") {
    return (
      <button type="button" className="pa-btn pa-btn--primary" disabled={busy}
        onClick={() => h.onAction(a.id, () => psychologistApi.confirm(a.id))}>
        <ICheck s={15} c="#fff" />{busy ? "…" : "Təsdiqlə"}
      </button>
    );
  }
  if (a.status === "AWAITING_CONFIRMATION") {
    return (
      <button type="button" className="pa-btn pa-btn--primary" disabled={busy}
        onClick={() => h.onAction(a.id, () => psychologistApi.confirmSession(a.id))}>
        <ICheck s={15} c="#fff" />{busy ? "…" : "Baş tutdu"}
      </button>
    );
  }
  if (a.status === "CONFIRMED") return <PsyJoinButton a={a} />;
  return null;
}

/* Status-a uyğun "daha çox" menyusu.
   Sıralama hər statusda eynidir ki, psixoloq axtarmasın:
     1) seansı idarə et (vaxt dəyişikliyi tələbi)
     2) seansdan sonrakı işlər (qeyd, baş tutmadı)
     3) kontekst (müştəri 360°, təqvimə əlavə)
     4) dağıdıcı (ləğv / rədd) — RowMenu bunları ayırıcı xəttdən sonra göstərir. */
function buildMenu(a: AppointmentDetail, h: Handlers, now: Date): MenuItem[] {
  const ico = "#5C6B85";
  const m: MenuItem[] = [];
  const endMs = a.endAt ? new Date(a.endAt).getTime() : null;
  const expired = endMs != null && endMs < now.getTime();
  const reportableNoShow = endMs != null && expired && now.getTime() - endMs < NO_SHOW_REPORT_WINDOW_MS;
  const noShowItem: MenuItem = { label: "Baş tutmadı", onClick: () => h.onDispute(a), icon: <IAlert s={15} c={ico} /> };
  const noteItem = (label: string): MenuItem => ({ label, onClick: () => h.onAddOutcome(a), icon: <IMsg s={15} c={ico} /> });

  // 1) Seansı idarə et
  if (a.status === "ASSIGNED" || a.status === "CONFIRMED") {
    m.push({ label: "Vaxt dəyişikliyi tələb et", onClick: () => h.onPropose(a), icon: <IClock s={15} c={ico} /> });
  }

  // 2) Seansdan sonra
  if (a.status === "AWAITING_CONFIRMATION") {
    m.push(noteItem("Nəticə əlavə et"));
    m.push(noShowItem);
  } else if (a.status === "CONFIRMED" && expired) {
    m.push(noteItem("Seans qeydi"));
    m.push(noShowItem);
  } else if (a.status === "COMPLETED" && reportableNoShow) {
    // Avtomatik tamamlanmış, lakin əslində baş tutmamış seansı operatora bildir.
    m.push(noShowItem);
  }

  // 3) Kontekst
  if (a.patientId) m.push({ label: "Müştəri 360°", href: `/psycholog/clients/${a.patientId}`, icon: <IUser s={15} c={ico} /> });
  const gcal = gcalHrefFor(a);
  if (gcal && (a.status === "ASSIGNED" || a.status === "CONFIRMED")) {
    m.push({ label: "Google Calendar-a əlavə et", href: gcal, icon: <ICal s={15} c={ico} /> });
  }

  // 4) Dağıdıcı
  if (a.status === "ASSIGNED") {
    m.push({ label: "Rədd et", onClick: () => h.onReject(a), danger: true, icon: <IX s={15} /> });
  } else if (a.status === "CONFIRMED" && !expired) {
    m.push({ label: "Ləğv et", onClick: () => h.onCancel(a), danger: true, icon: <IX s={15} /> });
  }
  return m;
}

/* ─── Seans kartı ──────────────────────────────────────────────────────────
   Oxunuş sırası: NƏ VAXT → KİM → VƏZİYYƏT → NƏ ETMƏLİ.
   Vaxt tipoqrafiya ilə öndədir; status rəngli nişan deyil, nöqtə + mətndir.
   Kart çərçivəsi yalnız diqqət tələb edən vəziyyətlərdə rənglənir. */

function SessionCard({
  a, client, isNext, now, busyId, onOpen, h,
}: {
  a: AppointmentDetail;
  client: ClientSummary | null;
  isNext: boolean;
  now: Date;
  busyId: number | null;
  onOpen: () => void;
  h: Handlers;
}) {
  const start = a.startAt ? new Date(a.startAt) : null;
  const end = a.endAt ? new Date(a.endAt) : null;
  const tu = start ? timeUntil(start, now) : null;
  const isToday = start ? isSameDay(start, now) : false;
  const av = avatarColor(a.patientId ?? a.patientName);
  const busy = busyId === a.id;
  const sessionNumber = client ? client.completedSessions + 1 : null;
  const menu = buildMenu(a, h, now);
  const cancelRequested = a.status === "CANCEL_REQUESTED";
  const disputed = a.status === "DISPUTED";
  const awaiting = a.status === "AWAITING_CONFIRMATION";
  const cls = ["pa-card"];
  if (isNext) cls.push("pa-card--next");
  if (disputed) cls.push("pa-card--alert");
  else if (awaiting || cancelRequested) cls.push("pa-card--attn");

  return (
    <div className={cls.join(" ")}>
      {/* Nə vaxt — kartın başlığı */}
      <div className="pa-card__head">
        <div style={{ minWidth: 0 }}>
          <div className="pa-card__day">{start ? relativeDayLabel(start, now) : "Vaxt təyin edilməyib"}</div>
          {start && (
            <div className="pa-card__time">
              {fmtTime(start)}{end ? ` – ${fmtTime(end)}` : ""}
            </div>
          )}
          {isToday && tu && !tu.expired && (
            <div className={`pa-card__count${tu.urgent ? " pa-card__count--urgent" : ""}`}>{tu.text}</div>
          )}
        </div>
        {/* Status vaxtın qarşısında, sağ üst küncdə — kartın "vəziyyət" xanası */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
          <StatusText status={a.status} />
          {menu.length > 0 && <RowMenu items={menu} size={28} />}
        </div>
      </div>

      <div className="pa-card__rule" />

      {/* Kim */}
      <div className="pa-card__who">
        <span className="pa-card__av" style={{ background: av }}>{initialsOf(a.patientName)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pa-card__name">{a.patientName ?? "Pasiyent"}</div>
          {sessionNumber != null && <div className="pa-card__nth">{azOrdinal(sessionNumber)} seans</div>}
        </div>
      </div>

      {/* Seans konteksti — paket / tanışlıq sətirləri */}
      {(a.patientPackageId != null || a.sessionKind === "INTRO") && (
        <div style={{ marginTop: 10 }}>
          <SessionMeta a={a} />
        </div>
      )}

      {cancelRequested && (
        <div className="pa-card__note">Pasient ləğv istəyib — operator təsdiqi gözlənilir.</div>
      )}
      {disputed && (
        <div className="pa-card__note" style={{ color: "#B4413F" }}>Operator həll edir — qərar gözlənilir.</div>
      )}

      {/* Nə etməli */}
      <div className="pa-card__foot">
        <button type="button" onClick={onOpen} className="pa-btn pa-btn--ghost" style={{ flex: 1 }}>
          <IOpen />
          Ətraflı
        </button>
        {!cancelRequested && !disputed && (
          <div style={{ flex: 1.5, minWidth: 0 }}>
            <PrimaryAction a={a} busy={busy} h={h} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Seans detal pəncərəsi — "Aç" düyməsi ilə açılır ─────────────────────── */

function SessionDetailModal({
  a, client, note, now, busyId, h, onClose,
}: {
  a: AppointmentDetail;
  client: ClientSummary | null;
  note: ClientNote | null | undefined;
  now: Date;
  busyId: number | null;
  h: Handlers;
  onClose: () => void;
}) {
  const start = a.startAt ? new Date(a.startAt) : null;
  const tu = start ? timeUntil(start, now) : null;
  const busy = busyId === a.id;
  const sessionNumber = client ? client.completedSessions + 1 : null;
  const av = avatarColor(a.patientId ?? a.patientName);
  // Menyu elementləri detalda açıq düymələr kimi göstərilir.
  const menu = buildMenu(a, h, now).map(it => ({
    ...it,
    onClick: it.onClick ? () => { onClose(); it.onClick!(); } : undefined,
  }));

  const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 5 };
  const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textDecoration: "none" };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,22,51,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Başlıq: avatar + pasient + status */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)", display: "flex", alignItems: "center", gap: 12 }}>
          <div className="psy-card__avatar" style={{ width: 46, height: 46, background: av, color: "#fff", border: "none" }}>
            {initialsOf(a.patientName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{a.patientName ?? "Pasiyent"}</div>
            {sessionNumber != null && <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 1 }}>{azOrdinal(sessionNumber)} seans</div>}
          </div>
          <span style={{ flex: "none" }}><StatusText status={a.status} /></span>
          <button type="button" aria-label="Bağla" onClick={onClose}
            style={{ width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", color: "var(--oxford-60)", border: "none", borderRadius: 8, cursor: "pointer", flex: "none" }}>
            <IX s={16} />
          </button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Vaxt */}
          <div>
            <div style={labelStyle}>Vaxt</div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
                {start
                  ? `${pad2(start.getDate())} ${MONTHS_AZ[start.getMonth()]} ${start.getFullYear()}, ${fmtTime(start)}${a.endAt ? ` – ${fmtTime(new Date(a.endAt))}` : ""}`
                  : "Vaxt təyin edilməyib"}
              </span>
              {tu && !tu.expired && (
                <span style={{ fontSize: 13, fontWeight: 600, color: tu.urgent ? "#B45309" : "var(--oxford-60)" }}>{tu.text}</span>
              )}
            </div>
          </div>

          {/* Seans növü / paket — sadə sətirlər */}
          {(a.patientPackageId != null || a.sessionKind === "INTRO") && (
            <div>
              <div style={labelStyle}>Seans</div>
              <SessionMeta a={a} />
            </div>
          )}

          {/* Pasientin mövzusu */}
          {a.note && (
            <div>
              <div style={labelStyle}>Pasientin mövzusu</div>
              <div style={{ fontSize: 13.5, color: "var(--oxford)", fontStyle: "italic", fontWeight: 500, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 13px", lineHeight: 1.5 }}>
                «{a.note}»
              </div>
            </div>
          )}

          {/* Müştəri konteksti — qeyd sayı, son klinik qeyd, əhval */}
          {(client || note) && (
            <div>
              <div style={labelStyle}>Müştəri konteksti</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 13px" }}>
                {client && (
                  <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <span>{client.completedSessions} tamamlanmış seans</span>
                    {client.noteCount > 0 && <span>{client.noteCount} klinik qeyd</span>}
                    {note?.moodScore ? <span>son əhval {note.moodScore}/10</span> : null}
                  </div>
                )}
                {note?.body && (
                  <div style={{ fontSize: 13, color: "var(--oxford)", fontWeight: 500, lineHeight: 1.5 }}>
                    Son qeyd: <span style={{ fontStyle: "italic" }}>«{note.body.slice(0, 160)}{note.body.length > 160 ? "…" : ""}»</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Görüş linki */}
          {(a.status === "ASSIGNED" || a.status === "CONFIRMED") && (
            <div>
              <div style={labelStyle}>Görüş</div>
              <PsyJoinButton a={a} />
              {!a.meetingLink && (
                <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, marginTop: 6 }}>
                  Görüş linki operator tərəfindən seans vaxtından əvvəl təyin ediləcək.
                </div>
              )}
            </div>
          )}

          {/* Əməliyyatlar */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid #F0F4FA", paddingTop: 16 }}>
            {(a.status === "ASSIGNED" || a.status === "AWAITING_CONFIRMATION") && (
              <div style={{ width: "100%" }}>
                <PrimaryAction a={a} busy={busy} h={h} />
              </div>
            )}
            {menu.map((it, i) => it.href ? (
              it.href.startsWith("http") ? (
                <a key={i} href={it.href} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, ...(it.danger ? { color: "#991B1B", border: "1px solid #F3D6D6" } : {}) }} onClick={onClose}>
                  {it.icon}{it.label}
                </a>
              ) : (
                <Link key={i} href={it.href} style={{ ...ghostBtn, ...(it.danger ? { color: "#991B1B", border: "1px solid #F3D6D6" } : {}) }} onClick={onClose}>
                  {it.icon}{it.label}
                </Link>
              )
            ) : (
              <button key={i} type="button" onClick={it.onClick} style={{ ...ghostBtn, ...(it.danger ? { color: "#991B1B", border: "1px solid #F3D6D6" } : {}) }}>
                {it.icon}{it.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Pasient paket kartı — bir pasientin BÜTÜN paketləri bir kartda ────────
   Eyni pasient eyni paketi bir neçə dəfə ala bilər; hər alış ayrıca blok kimi
   (alış sırası ilə) göstərilir — ayrı pasient kimi yox. */

const pkgStatLab: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "var(--oxford-60)", marginBottom: 2 };
const pkgStatVal: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, color: "var(--oxford)" };

type PackageGroup = { id: number; patientId: number | null; patientName: string; sessions: AppointmentDetail[] };
type PatientPackageGroup = { key: string; patientId: number | null; patientName: string; packages: PackageGroup[] };

function PatientPackagesCard({ group, now, busyId, h }: {
  group: PatientPackageGroup; now: Date; busyId: number | null; h: Handlers;
}) {
  const av = avatarColor(group.patientId ?? group.patientName);
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 22, display: "flex", flexDirection: "column" }}>
      {/* Pasient başlığı */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, background: av, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flex: "none" }}>{initialsOf(group.patientName)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--oxford)" }}>{group.patientName}</div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, marginTop: 1 }}>{group.packages.length} paket</div>
        </div>
        {group.patientId != null && (
          <Link href={`/psycholog/clients/${group.patientId}`} className="gor-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, textDecoration: "none", flex: "none" }}>
            <IUser s={14} />
            Müştəri 360°
          </Link>
        )}
      </div>

      {/* Pasientin paketləri — alış sırası ilə */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {group.packages.map((p, i) => (
          <PackageBlock key={p.id} pkg={p} ordinal={group.packages.length > 1 ? i + 1 : null} now={now} busyId={busyId} h={h} />
        ))}
      </div>
    </div>
  );
}

/* Tək paket bloku — pasient kartının içində: gedişat + genişlənən seans siyahısı. */
function PackageBlock({ pkg, ordinal, now, busyId, h }: {
  pkg: PackageGroup; ordinal: number | null; now: Date; busyId: number | null; h: Handlers;
}) {
  const [open, setOpen] = useState(false);
  const sessions = pkg.sessions;
  const total = sessions[0]?.packageTotal ?? sessions.length;
  const name = sessions[0]?.packageName || `${total} seanslıq proqram`;
  const completed = sessions.filter(s => s.status === "COMPLETED").length;
  const planned = sessions.filter(s => s.status !== "COMPLETED" && s.status !== "CANCELLED" && s.status !== "REJECTED").length;
  const completedPct = total ? (completed / total) * 100 : 0;
  const plannedPct = total ? (planned / total) * 100 : 0;
  // "Qalan" = balans (planlanmamış seans) — pasiyent/operator panelləri ilə eyni metrika.
  const remaining = Math.max(0, total - sessions.length);
  const upcoming = sessions.find(s => notEndedYet(s, now.getTime())
    && (s.status === "CONFIRMED" || s.status === "ASSIGNED" || s.status === "AWAITING_CONFIRMATION"));
  const fmtDM = (iso?: string | null) => { if (!iso) return "—"; const d = new Date(iso); return `${d.getDate()} ${MONTHS_AZ[d.getMonth()]}`; };

  return (
    <div style={{ background: "#FBFCFE", border: "1px solid #EDF1F8", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--oxford)", letterSpacing: "-.01em" }}>{name}</div>
        {ordinal != null && (
          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--oxford-60)", marginTop: 2 }}>{azOrdinal(ordinal)} alış</div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--oxford)" }}>
            {completed}/{total} tamamlanıb
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)" }}>{Math.round(completedPct)}%</span>
        </div>
        <div style={{ display: "flex", height: 9, background: "var(--brand-100)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${completedPct}%`, height: "100%", background: "linear-gradient(90deg,#1051B7,#3A74D6)" }} />
          <div style={{ width: `${plannedPct - completedPct > 0 ? plannedPct - completedPct : 0}%`, height: "100%", background: "#9DBCEB" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "11px 0", borderTop: "1px solid #EDF1F8", borderBottom: "1px solid #EDF1F8" }}>
        <div>
          <div style={pkgStatLab}>Növbəti</div>
          <div style={pkgStatVal}>{upcoming && upcoming.startAt ? `${fmtDM(upcoming.startAt)}, ${fmtTime(new Date(upcoming.startAt))}` : "—"}</div>
          {upcoming && <div style={{ marginTop: 3 }}><StatusText status={upcoming.status} size={12.5} /></div>}
        </div>
        <div><div style={pkgStatLab}>Planlanmamış</div><div style={pkgStatVal}>{remaining}</div></div>
      </div>

      <button type="button" onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "none", border: "none", padding: "12px 0 0", cursor: "pointer", fontFamily: "inherit", marginTop: "auto" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>
          {open ? "Seansları gizlət" : "Seansları gör"}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div style={{ marginTop: 6 }}>
          {(() => {
            const RANK_EXCL = new Set(["CANCELLED", "REJECTED"]);
            let ord = 0;
            return sessions.map((s) => {
              const excluded = RANK_EXCL.has(s.status);
              if (!excluded) ord++;
              return <PackageSessionRow key={s.id} a={s} index={excluded ? null : ord} now={now} busyId={busyId} h={h} />;
            });
          })()}
          {(() => {
            const activeCount = sessions.filter(s => s.status !== "CANCELLED" && s.status !== "REJECTED").length;
            return Array.from({ length: remaining }).map((_, i) => (
              <div key={`rem-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: "1px solid #F4F7FB", flexWrap: "wrap" }}>
                <span style={{ width: 22, textAlign: "center", color: "#9DB0CC", fontSize: 12.5, fontWeight: 600, flex: "none", fontFeatureSettings: '"tnum"' }}>{activeCount + i + 1}</span>
                <div style={{ width: 150, flex: "none" }}><span style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford-60)" }}>—</span></div>
                <span style={{ flex: 1, minWidth: 60, fontSize: 12.5, color: "#9DB0CC", fontWeight: 500 }}>planlaşmayıb</span>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--oxford-60)" }}>Qalıb</span>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

function PackageSessionRow({ a, index, now, busyId, h }: {
  a: AppointmentDetail; index: number | null; now: Date; busyId: number | null; h: Handlers;
}) {
  const start = a.startAt ? new Date(a.startAt) : null;
  const busy = busyId === a.id;
  const menu = buildMenu(a, h, now);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: "1px solid #F4F7FB", flexWrap: "wrap" }}>
      <span style={{ width: 22, textAlign: "center", color: "var(--oxford-60)", fontSize: 12.5, fontWeight: 600, flex: "none", fontFeatureSettings: '"tnum"' }}>{index ?? "—"}</span>
      <div style={{ width: 150, flex: "none" }}>
        {start
          ? <><span style={{ fontSize: 13, fontWeight: 600 }}>{start.getDate()} {MONTHS_AZ[start.getMonth()]}</span> <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>{fmtTime(start)}</span></>
          : <span style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford-60)" }}>—</span>}
      </div>
      <span style={{ flex: 1, minWidth: 50 }} />
      <span style={{ flex: "none" }}><StatusText status={a.status} size={12.5} /></span>
      {a.status === "ASSIGNED" && (
        <button type="button" className="gor-accept" disabled={busy}
          onClick={() => h.onAction(a.id, () => psychologistApi.confirm(a.id))}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: busy ? "wait" : "pointer", flex: "none", opacity: busy ? 0.7 : 1 }}>
          <ICheck s={13} c="#fff" />{busy ? "…" : "Təsdiqlə"}
        </button>
      )}
      {menu.length > 0 && <RowMenu items={menu} size={28} />}
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

  const fmtOpt = (startIso: string, endIso: string) => {
    const s = new Date(startIso), e = new Date(endIso);
    return `${pad2(s.getDate())} ${MONTHS_AZ[s.getMonth()]}, ${fmtTime(s)}–${fmtTime(e)}`;
  };

  const accept = async (idx: number) => {
    setBusyOption(idx);
    try {
      const updated = await psychologistApi.acceptPatientReschedule(proposal.id, idx);
      onDecided(updated);
    } catch (e) {
      toast(isSlotConflict(e)
        ? (e as Error).message + " Digər variantlardan birini seçə bilərsiniz."
        : (e as Error).message, "error");
    } finally { setBusyOption(null); }
  };

  const reject = async () => {
    if (!confirm("İstəyi rədd etmək istəyirsiniz? Randevu köhnə vaxtında qalacaq.")) return;
    setRejecting(true);
    try {
      const updated = await psychologistApi.rejectPatientReschedule(proposal.id);
      onDecided(updated);
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setRejecting(false); }
  };

  const busy = busyOption !== null || rejecting;

  return (
    <div style={{ background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 14, padding: 20, animation: "gorFade .25s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 14 }}>
        <IRefresh s={18} c="#B45309" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--oxford)", letterSpacing: "-.01em" }}>{proposal.patientName ?? "Pasiyent"} vaxt dəyişikliyi istəyir</div>
          {proposal.originalStartAt && (
            <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 500, marginTop: 2 }}>
              Hazırkı vaxt: {fmtOpt(proposal.originalStartAt, proposal.originalEndAt ?? proposal.originalStartAt)}
            </div>
          )}
        </div>
      </div>
      {proposal.reason && (
        <div style={{ marginBottom: 14, fontSize: 13.5, color: "var(--oxford-80)", fontStyle: "italic", fontWeight: 400, lineHeight: 1.5 }}>
          «{proposal.reason}»
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {proposal.options.map(opt => (
          <button
            key={opt.index}
            type="button"
            className="gor-opt"
            disabled={busy}
            onClick={() => accept(opt.index)}
            style={{
              display: "flex", alignItems: "center", gap: 11, background: "#FBFCFE",
              border: "1px solid var(--oxford-10)", borderRadius: 10, padding: "12px 14px",
              cursor: busy ? "default" : "pointer", opacity: busy && busyOption !== opt.index ? 0.6 : 1,
              fontFamily: "inherit", textAlign: "left",
            }}
          >
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--oxford)" }}>{fmtOpt(opt.startAt, opt.endAt)}</span>
            <span className="gor-accept" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand)", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600 }}>
              {busyOption === opt.index ? "…" : <><ICheck s={13} c="#fff" />Qəbul et</>}
            </span>
          </button>
        ))}
      </div>
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
