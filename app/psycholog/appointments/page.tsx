"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import JoinSessionButton from "@/components/JoinSessionButton";
import { useT } from "@/lib/i18n/LocaleProvider";

const WEEKDAYS_AZ = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"];
const MONTHS_AZ = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtTime(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function relativeDayLabel(d: Date, now: Date) {
  const today = new Date(now);
  const tomorrow = new Date(now); tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(d, today)) return "Bu gün";
  if (isSameDay(d, tomorrow)) return "Sabah";
  const isoDow = (d.getDay() + 6) % 7;
  return `${WEEKDAYS_AZ[isoDow]} · ${pad2(d.getDate())} ${MONTHS_AZ[d.getMonth()]}`;
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

function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

const STATUS: Record<string, { label: string; color: string; bg: string; accent: string }> = {
  PENDING:               { label: "Yeni",          color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  ASSIGNED:              { label: "Sizə təyin",    color: "var(--brand-700)", bg: "var(--brand-50)", accent: "var(--brand)" },
  CONFIRMED:             { label: "Təsdiqli",      color: "#065F46",          bg: "#D1FAE5",         accent: "#10B981" },
  AWAITING_CONFIRMATION: { label: "Təsdiq gözlənir", color: "#92400E",        bg: "#FEF3C7",         accent: "#F59E0B" },
  DISPUTED:              { label: "Mübahisəli",    color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  COMPLETED:             { label: "Tamamlandı",    color: "#374151",          bg: "#F3F4F6",         accent: "#9CA3AF" },
  CANCELLED:             { label: "Ləğv",          color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  REJECTED:              { label: "Rədd",          color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
};

const ACTIVE_STATUSES = new Set(["ASSIGNED", "CONFIRMED"]);

export default function PsychologistAppointmentsPage() {
  const { t } = useT();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [notesByPatient, setNotesByPatient] = useState<Record<number, ClientNote | null>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  const [disputeFor, setDisputeFor] = useState<AppointmentDetail | null>(null);
  const [rejectFor, setRejectFor] = useState<AppointmentDetail | null>(null);
  const [cancelFor, setCancelFor] = useState<AppointmentDetail | null>(null);
  const [rescheduleProposeFor, setRescheduleProposeFor] = useState<AppointmentDetail | null>(null);
  const [outcomeFor, setOutcomeFor] = useState<AppointmentDetail | null>(null);
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"ALL" | "TODAY" | "WEEK" | "ATTENTION" | "HISTORY">("ALL");
  // GAP-03: incoming patient-initiated reschedule requests awaiting my decision
  const [patientRequests, setPatientRequests] = useState<RescheduleProposal[]>([]);

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
      psychologistApi.myRescheduleProposals().catch(() => [] as RescheduleProposal[]),
    ])
      .then(([appts, cs, props]) => {
        setItems(appts);
        setClients(cs);
        setPatientRequests(props.filter(p => p.initiator === "PATIENT" && p.status === "PENDING"));
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

  const today = useMemo(() => {
    return items
      .filter(a => a.startAt && isSameDay(new Date(a.startAt), now))
      .filter(a => ACTIVE_STATUSES.has(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
  }, [items, now]);

  const next = useMemo(() => {
    return items
      .filter(a => a.startAt && new Date(a.startAt).getTime() > now.getTime() - 30 * 60_000)
      .filter(a => ACTIVE_STATUSES.has(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())[0] ?? null;
  }, [items, now]);

  const thisWeek = useMemo(() => {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return items
      .filter(a => a.startAt
        && new Date(a.startAt).getTime() > now.getTime()
        && new Date(a.startAt).getTime() < weekEnd.getTime()
        && !isSameDay(new Date(a.startAt), now)
      )
      .filter(a => ACTIVE_STATUSES.has(a.status))
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
  }, [items, now]);

  const history = useMemo(() => {
    return items
      .filter(a => ["COMPLETED", "CANCELLED", "REJECTED"].includes(a.status))
      .sort((a, b) => {
        const da = new Date(a.startAt ?? a.endAt ?? 0).getTime();
        const db = new Date(b.startAt ?? b.endAt ?? 0).getTime();
        return db - da;
      });
  }, [items]);

  const awaitingConfirm = useMemo(() => {
    return items
      .filter(a => a.status === "AWAITING_CONFIRMATION" || a.status === "DISPUTED")
      .sort((a, b) => {
        const da = new Date(a.endAt ?? a.startAt ?? 0).getTime();
        const db = new Date(b.endAt ?? b.startAt ?? 0).getTime();
        return db - da;
      });
  }, [items]);

  // Single unified list driven by the active filter — no separate sections.
  const visible = useMemo(() => {
    if (view === "TODAY") return today;
    if (view === "WEEK") return thisWeek;
    if (view === "ATTENTION") return awaitingConfirm;
    if (view === "HISTORY") return history;
    const all = [...awaitingConfirm, ...today, ...thisWeek];
    const seen = new Set<number>();
    return all
      .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; })
      .sort((a, b) => new Date(a.startAt ?? 0).getTime() - new Date(b.startAt ?? 0).getTime());
  }, [view, today, thisWeek, awaitingConfirm, history]);

  // Lazy-fetch latest clinical note for today's appointments + the next session
  useEffect(() => {
    const ids = new Set<number>();
    if (next?.patientId) ids.add(next.patientId);
    today.forEach(a => { if (a.patientId) ids.add(a.patientId); });
    const targets = Array.from(ids).filter(id => !(id in notesByPatient));
    if (!targets.length) return;
    targets.forEach(id => {
      psychologistApi.notesForPatient(id)
        .then(notes => setNotesByPatient(prev => ({ ...prev, [id]: notes[0] ?? null })))
        .catch(() => setNotesByPatient(prev => ({ ...prev, [id]: null })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, next]);

  const action = async (id: number, fn: () => Promise<AppointmentDetail>) => {
    setError(null);
    setBusyId(id);
    try {
      const updated = await fn();
      setItems(prev => prev.map(a => a.id === id ? updated : a));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const clientFor = (id?: number | null) =>
    id ? clients.find(c => c.patientId === id) ?? null : null;
  const noteFor = (id?: number | null) =>
    id ? notesByPatient[id] : undefined;

  return (
    <div className="psy-appt-page">
      <header style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>{t("staff.psyApptTitle")}</h1>
          <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4 }}>
            {t("staff.psyApptSub")}
          </p>
        </div>
        {/* "Tarix aralığı ləğv et" düyməsi müvəqqəti gizlədilib — funksionallıq sonra tamamlanacaq (modal/state aşağıda saxlanılıb). */}
      </header>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>
          {t("common.loading")}
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" style={{
              fontSize: 12.5, fontWeight: 600, color: "#991B1B", background: "#FEE2E2",
              border: "1px solid #FECACA", borderRadius: 10, padding: "10px 12px", marginBottom: 14,
            }}>{error}</div>
          )}

          <div className="psy-summary">
            <div className="psy-summary__tile">
              <span className="psy-summary__num">{today.length}</span>
              <span className="psy-summary__lbl">Bu gün</span>
            </div>
            <div className="psy-summary__tile">
              <span className="psy-summary__num">{thisWeek.length}</span>
              <span className="psy-summary__lbl">Bu həftə</span>
            </div>
            <div className="psy-summary__tile psy-summary__tile--accent">
              <span className="psy-summary__num">
                {next && next.startAt ? fmtTime(new Date(next.startAt)) : "—"}
              </span>
              <span className="psy-summary__lbl">
                {next && next.startAt ? `${relativeDayLabel(new Date(next.startAt), now)} · növbəti` : "Növbəti seans yox"}
              </span>
            </div>
            {(awaitingConfirm.length + patientRequests.length) > 0 && (
              <div className="psy-summary__tile psy-summary__tile--warn">
                <span className="psy-summary__num">{awaitingConfirm.length + patientRequests.length}</span>
                <span className="psy-summary__lbl">Diqqət tələb edir</span>
              </div>
            )}
          </div>

          <div className="psy-filter">
            <FilterTab active={view === "ALL"} onClick={() => setView("ALL")}>Hamısı</FilterTab>
            <FilterTab active={view === "TODAY"} count={today.length} onClick={() => setView("TODAY")}>Bu gün</FilterTab>
            <FilterTab active={view === "WEEK"} count={thisWeek.length} onClick={() => setView("WEEK")}>Bu həftə</FilterTab>
            <FilterTab active={view === "ATTENTION"} count={awaitingConfirm.length + patientRequests.length} warn onClick={() => setView("ATTENTION")}>Diqqət</FilterTab>
            <FilterTab active={view === "HISTORY"} count={history.length} onClick={() => setView("HISTORY")}>Tarixçə</FilterTab>
          </div>

          <div className="psy-grid">
            <div className="psy-grid__main">
              {(view === "ALL" || view === "ATTENTION") && patientRequests.length > 0 && (
                <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
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

              {visible.length === 0 ? (
                <Empty msg="Bu kateqoriyada randevu yoxdur." />
              ) : (
                <div className="psy-agenda">
                  {visible.map(a => (
                    <AgendaRow
                      key={a.id}
                      a={a}
                      client={clientFor(a.patientId)}
                      note={noteFor(a.patientId)}
                      isNext={next?.id === a.id}
                      now={now}
                      busyId={busyId}
                      onAction={action}
                      onDispute={() => setDisputeFor(a)}
                      onReject={() => setRejectFor(a)}
                      onCancel={() => setCancelFor(a)}
                      onPropose={() => setRescheduleProposeFor(a)}
                      onAddOutcome={() => setOutcomeFor(a)}
                    />
                  ))}
                </div>
              )}
            </div>

            <aside className="psy-grid__side">
              <RailNext appt={next} now={now} />
              <RailGlance todayCount={today.length} weekCount={thisWeek.length} doneCount={history.length} />
            </aside>
          </div>

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
          {bulkCancelOpen && (
            <BulkCancelModal
              appointments={items}
              onClose={() => setBulkCancelOpen(false)}
              onDone={() => { setBulkCancelOpen(false); load(); }}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ─── Right rail: next-session card + at-a-glance, fills the side on wide screens ── */

function RailNext({
  appt, now,
}: {
  appt: AppointmentDetail | null;
  now: Date;
}) {
  if (!appt || !appt.startAt) {
    return (
      <div className="psy-rail-card">
        <div className="psy-rail-card__label">Növbəti seans</div>
        <div className="psy-rail-empty">
          <span>Yaxınlaşan seans yoxdur.</span>
          <Link href="/psycholog/clients" className="psy-rail-link">Müştərilərə bax</Link>
        </div>
      </div>
    );
  }
  const start = new Date(appt.startAt);
  const tu = timeUntil(start, now);
  return (
    <div className={`psy-rail-card psy-rail-next${tu.urgent || tu.expired ? " psy-rail-next--urgent" : ""}`}>
      <div className="psy-rail-card__label">Növbəti seans</div>
      <div className="psy-rail-next__head">
        <span className="psy-rail-next__avatar">{initialsOf(appt.patientName)}</span>
        <div className="psy-rail-next__info">
          <span className="psy-rail-next__name">{appt.patientName ?? "Pasient"}</span>
          <span className="psy-rail-next__when">{relativeDayLabel(start, now)} · {fmtTime(start)}</span>
        </div>
      </div>
      <span className={`psy-rail-next__cd${tu.expired ? " is-live" : tu.urgent ? " is-urgent" : ""}`}>{tu.text}</span>
      <div className="psy-rail-next__act">
        <JoinSessionButton appointment={appt} variant="compact" />
      </div>
    </div>
  );
}

function RailGlance({
  todayCount, weekCount, doneCount,
}: {
  todayCount: number;
  weekCount: number;
  doneCount: number;
}) {
  return (
    <div className="psy-rail-card">
      <div className="psy-rail-card__label">Bir baxışda</div>
      <div className="psy-rail-stat"><span>Bu gün</span><strong>{todayCount}</strong></div>
      <div className="psy-rail-stat"><span>Bu həftə</span><strong>{weekCount}</strong></div>
      <div className="psy-rail-stat"><span>Tamamlanmış</span><strong>{doneCount}</strong></div>
      <div className="psy-rail-links">
        <Link href="/psycholog/clients" className="psy-rail-link">Müştərilər</Link>
        <Link href="/psycholog/availability" className="psy-rail-link">İş vaxtları</Link>
      </div>
    </div>
  );
}

/* ─── Secondary row actions — rendered as inline buttons on each card ─────── */

type MenuItem = { label: string; onClick?: () => void; href?: string; danger?: boolean };

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: 28,
      textAlign: "center", color: "var(--oxford-60)", fontSize: 13,
      border: "1px dashed var(--brand-100)",
    }}>
      {msg}
    </div>
  );
}

function FilterTab({
  active, count, warn, onClick, children,
}: {
  active: boolean;
  count?: number;
  warn?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`psy-filter__tab${active ? " is-active" : ""}${warn && count ? " is-warn" : ""}`}>
      {children}
      {count != null && count > 0 && <span className="psy-filter__count">{count}</span>}
    </button>
  );
}

function AgendaRow({
  a, client, note, isNext, now, busyId, onAction, onDispute, onReject, onCancel, onPropose, onAddOutcome,
}: {
  a: AppointmentDetail;
  client: ClientSummary | null;
  note: ClientNote | null | undefined;
  isNext: boolean;
  now: Date;
  busyId: number | null;
  onAction: (id: number, fn: () => Promise<AppointmentDetail>) => Promise<void>;
  onDispute: () => void;
  onReject: () => void;
  onCancel: () => void;
  onPropose: () => void;
  onAddOutcome: () => void;
}) {
  const { t } = useT();
  const [sheet, setSheet] = useState(false);
  if (!a.startAt) return null;
  const start = new Date(a.startAt);
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  const sessionNumber = client ? client.totalSessions + 1 : null;
  const expired = !!a.endAt && new Date(a.endAt).getTime() < now.getTime();
  const ctxLine = [
    client && client.noteCount > 0 ? `${client.noteCount} qeyd` : null,
    note?.moodScore ? `Əhval ${note.moodScore}/10` : null,
    a.note ? `«${a.note.slice(0, 80)}${a.note.length > 80 ? "…" : ""}»` : null,
  ].filter(Boolean).join(" · ");

  const badgeLabel = status.label;
  const badgeColor = status.color;
  const badgeBg = status.bg;
  // Countdown only for an upcoming, active session.
  const isUpcoming = a.status === "CONFIRMED" && start.getTime() > now.getTime();
  const cd = isUpcoming ? timeUntil(start, now) : null;

  // Secondary actions → overflow menu (status-aware). Primary action stays inline.
  const menu: MenuItem[] = [];
  if (a.status === "CONFIRMED" && !expired) {
    menu.push({ label: "Yenidən planla", onClick: onPropose });
    menu.push({ label: "Ləğv et", onClick: onCancel, danger: true });
  }
  // Clinical session note stays available once the session is over.
  if (a.status === "COMPLETED" || (a.status === "CONFIRMED" && expired)) {
    menu.push({ label: "Seans qeydi", onClick: onAddOutcome });
  }
  if (a.patientId) menu.push({ label: "Pasient profili", href: `/psycholog/clients/${a.patientId}` });
  menu.push({ label: t("intake.psyTitle"), href: `/psycholog/appointments/${a.id}/intake` });

  // Foot only carries the Join button for an active confirmed session — there is
  // no post-session confirmation step anymore (sessions auto-complete).
  const showFoot = a.status === "CONFIRMED";

  return (
    <div className={`psy-aptcard${isNext ? " psy-aptcard--next" : ""}`}>
      <button type="button" className="psy-aptcard__face" onClick={() => setSheet(true)} aria-label={`${a.patientName ?? "Pasient"} — ətraflı`}>
        <div className="psy-aptcard__top">
          <span className="psy-aptcard__badge" style={{ color: badgeColor, background: badgeBg }}>{badgeLabel}</span>
          <span className="psy-aptcard__when">{relativeDayLabel(start, now)} · {fmtTime(start)}</span>
        </div>

        <div className="psy-aptcard__body">
          <span className="psy-aptcard__avatar">{initialsOf(a.patientName)}</span>
          <div className="psy-aptcard__who">
            <span className="psy-aptcard__name">{a.patientName ?? "Pasient"}</span>
            <span className="psy-aptcard__nth">
              {sessionNumber ? `${sessionNumber}-ci seans` : "Seans"}
              {cd && <span className={`psy-aptcard__cd${cd.urgent ? " is-urgent" : ""}`}>{cd.text}</span>}
            </span>
          </div>
        </div>

        {ctxLine && <div className="psy-aptcard__ctx2">{ctxLine}</div>}
      </button>

      {showFoot && (
        <div className="psy-aptcard__foot">
          <JoinSessionButton appointment={a} variant="compact" />
        </div>
      )}

      {sheet && (
        <ActionSheet
          patientName={a.patientName ?? "Pasient"}
          subtitle={`${pad2(start.getDate())}.${pad2(start.getMonth() + 1)} · ${fmtTime(start)} · ${status.label}`}
          contextLine={ctxLine || undefined}
          items={menu}
          onClose={() => setSheet(false)} />
      )}
    </div>
  );
}

/* ─── Action sheet — opens on card tap; holds every secondary action ──────── */

function ActionSheet({
  patientName, subtitle, contextLine, items, onClose,
}: {
  patientName: string;
  subtitle: string;
  contextLine?: string;
  items: MenuItem[];
  onClose: () => void;
}) {
  return (
    <div className="psy-sheet__overlay" onClick={onClose} role="presentation">
      <div className="psy-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={`${patientName} əməliyyatları`}>
        <div className="psy-sheet__head">
          <div style={{ minWidth: 0 }}>
            <div className="psy-sheet__title">{patientName}</div>
            <div className="psy-sheet__sub">{subtitle}</div>
          </div>
          <button type="button" className="psy-sheet__close" onClick={onClose} aria-label="Bağla">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        {contextLine && <div className="psy-sheet__ctx">{contextLine}</div>}
        <div className="psy-sheet__list">
          {items.map((it, i) => it.href ? (
            <Link key={i} href={it.href} className={`psy-sheet__item${it.danger ? " is-danger" : ""}`} onClick={onClose}>{it.label}</Link>
          ) : (
            <button key={i} type="button" className={`psy-sheet__item${it.danger ? " is-danger" : ""}`} onClick={() => { onClose(); it.onClick?.(); }}>{it.label}</button>
          ))}
        </div>
      </div>
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
  const [error, setError] = useState<string | null>(null);

  const fmtOpt = (startIso: string, endIso: string) => {
    const s = new Date(startIso), e = new Date(endIso);
    return `${pad2(s.getDate())} ${MONTHS_AZ[s.getMonth()]} · ${fmtTime(s)}–${fmtTime(e)}`;
  };

  const accept = async (idx: number) => {
    setError(null); setBusyOption(idx);
    try {
      const updated = await psychologistApi.acceptPatientReschedule(proposal.id, idx);
      onDecided(updated);
    } catch (e) {
      setError(isSlotConflict(e)
        ? (e as Error).message + " Digər variantlardan birini seçə bilərsiniz."
        : (e as Error).message);
    } finally { setBusyOption(null); }
  };

  const reject = async () => {
    if (!confirm("İstəyi rədd etmək istəyirsiniz? Randevu köhnə vaxtında qalacaq.")) return;
    setError(null); setRejecting(true);
    try {
      const updated = await psychologistApi.rejectPatientReschedule(proposal.id);
      onDecided(updated);
    } catch (e) { setError((e as Error).message); }
    finally { setRejecting(false); }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid var(--brand-100)", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <div style={{ fontWeight: 700, color: "var(--oxford)", fontSize: 14 }}>
          {proposal.patientName ?? "Pasiyent"} vaxt dəyişikliyi istəyir
        </div>
        {proposal.originalStartAt && (
          <span style={{ fontSize: 12, color: "var(--oxford-60)" }}>
            Hazırkı vaxt: {fmtOpt(proposal.originalStartAt, proposal.originalEndAt ?? proposal.originalStartAt)}
          </span>
        )}
      </div>
      {proposal.reason && (
        <div style={{ fontSize: 12.5, color: "var(--oxford-60)", marginTop: 6, fontStyle: "italic" }}>
          «{proposal.reason}»
        </div>
      )}
      <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
        {proposal.options.map(opt => (
          <button
            key={opt.index}
            type="button"
            disabled={busyOption !== null || rejecting}
            onClick={() => accept(opt.index)}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderRadius: 10, border: "1px solid var(--brand-100)",
              background: "var(--brand-50)", fontSize: 13, fontWeight: 600,
              color: "var(--oxford)", cursor: "pointer",
            }}
          >
            <span>{opt.index + 1}. {fmtOpt(opt.startAt, opt.endAt)}</span>
            <span style={{ color: "var(--brand)" }}>{busyOption === opt.index ? "…" : "Qəbul et"}</span>
          </button>
        ))}
      </div>
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 10 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <button
          type="button"
          disabled={busyOption !== null || rejecting}
          onClick={reject}
          style={{ padding: "7px 14px", border: "1px solid #FECACA", borderRadius: 8, background: "#fff", color: "#991B1B", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
        >
          {rejecting ? "Göndərilir…" : "İmtina et"}
        </button>
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
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      const updated = await psychologistApi.disputeSession(appointment.id, reason.trim() || undefined);
      onDone(updated);
    } catch (e) {
      setErr((e as Error).message);
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
            Operator komandamız müraciətinizə baxıb həll edəcək.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>
            Səbəb (məcburi deyil)
          </label>
          <textarea
            rows={4} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Məsələn: pasient qoşulmadı, texniki problem…"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12 }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

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

/* ─── Session outcome modal — write a clinical note tied to this appointment ── */

function OutcomeModal({
  appointment, onClose, onSaved,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim()) { setErr("Qeyd mətni boş ola bilməz"); return; }
    if (!appointment.patientId) { setErr("Pasient ID tapılmadı"); return; }
    setSaving(true); setErr(null);
    try {
      await psychologistApi.createNote({
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        title: null,
        body: body.trim(),
        moodScore: typeof mood === "number" ? mood : null,
      });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, padding: 0, maxWidth: 540, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Seans qeydi</h3>
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4 }}>
            {appointment.patientName ?? "Pasient"} ilə seans haqqında qısa qeyd — pasient bunu görmür, AES-256 ilə şifrələnir.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>
            Seansın nəticəsi
          </label>
          <textarea
            rows={6} value={body} onChange={e => setBody(e.target.value)}
            placeholder="İşlənən mövzu, müştəri reaksiyası, gələcək plan…"
            autoFocus
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box", resize: "vertical" }} />

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>
            Əhval-ruhiyyə qiymətləndirməsi (1–10, məcburi deyil)
          </label>
          <input type="number" min={1} max={10} value={mood}
            onChange={e => { const v = e.target.value; setMood(v === "" ? "" : Math.max(1, Math.min(10, Number(v)))); }}
            style={{ width: 80, padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 12 }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Ləğv
            </button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saxlanılır…" : "Qeydi saxla"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ─── Bulk cancel by date range ─────────────────────────────────────────── */

const CANCEL_REASONS: { code: string; label: string }[] = [
  { code: "PSY_HEALTH",    label: "Xəstələndim" },
  { code: "PSY_EMERGENCY", label: "Təcili / fövqəladə" },
  { code: "PSY_TECHNICAL", label: "Texniki problem" },
  { code: "PSY_OTHER",     label: "Digər" },
];

const CANCELLABLE = new Set(["ASSIGNED", "CONFIRMED"]);

function BulkCancelModal({
  appointments, onClose, onDone,
}: {
  appointments: AppointmentDetail[];
  onClose: () => void;
  onDone: () => void;
}) {
  const today = useMemo(() => {
    const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }, []);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reasonCode, setReasonCode] = useState(CANCEL_REASONS[0].code);
  const [reasonText, setReasonText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const targets = useMemo(() => {
    const startMs = new Date(startDate + "T00:00:00").getTime();
    const endMs = new Date(endDate + "T23:59:59").getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return [];
    return appointments.filter(a => {
      if (!a.startAt) return false;
      if (!CANCELLABLE.has(a.status)) return false;
      const t = new Date(a.startAt).getTime();
      return t >= startMs && t <= endMs;
    }).sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
  }, [appointments, startDate, endDate]);

  const submit = async () => {
    if (targets.length === 0) { setErr("Bu aralıqda ləğv ediləcək seans yoxdur"); return; }
    setSubmitting(true); setErr(null);
    try {
      const res = await psychologistApi.bulkCancel(
        targets.map(a => a.id),
        reasonCode,
        reasonText.trim() || undefined,
      );
      if (res.errors.length > 0 && res.cancelled.length === 0) {
        setErr(`Ləğv edilə bilmədi: ${res.errors.map(e => e.message).join("; ")}`);
        return;
      }
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, padding: 0, maxWidth: 560, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Tarix aralığı üçün ləğv</h3>
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4 }}>
            Seçilmiş tarix aralığındakı bütün təsdiqli/təyin edilmiş seansları bir səbəblə ləğv edin
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford)" }}>Başlanğıc</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford)" }}>Bitiş</span>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }} />
            </label>
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>Səbəb</label>
          <select value={reasonCode} onChange={e => setReasonCode(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 10, background: "#fff" }}>
            {CANCEL_REASONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>Əlavə açıqlama (məcburi deyil)</label>
          <textarea rows={2} value={reasonText} onChange={e => setReasonText(e.target.value)}
            placeholder="Pasiyentlərə göndəriləcək qısa qeyd…"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box", resize: "vertical" }} />

          <div style={{ padding: 12, background: "#F8FAFD", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>
              {targets.length === 0 ? "Aralıqda seans yoxdur" : `${targets.length} seans ləğv ediləcək`}
            </div>
            {targets.length > 0 && (
              <ul style={{ margin: 0, padding: "0 0 0 18px", color: "#52718F", maxHeight: 140, overflowY: "auto" }}>
                {targets.slice(0, 10).map(a => {
                  const d = new Date(a.startAt!);
                  return (
                    <li key={a.id} style={{ fontSize: 12, marginBottom: 2 }}>
                      {pad2(d.getDate())}.{pad2(d.getMonth() + 1)} · {fmtTime(d)} — {a.patientName ?? "Pasient"}
                    </li>
                  );
                })}
                {targets.length > 10 && <li style={{ fontSize: 12, color: "#9CA3AF" }}>… və {targets.length - 10} daha</li>}
              </ul>
            )}
          </div>

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Ləğv
            </button>
            <button onClick={submit} disabled={submitting || targets.length === 0}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: targets.length === 0 ? "#E5E7EB" : "#DC2626",
                color: targets.length === 0 ? "#9CA3AF" : "#fff",
                cursor: submitting || targets.length === 0 ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Ləğv olunur…" : `${targets.length} seansı ləğv et`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
