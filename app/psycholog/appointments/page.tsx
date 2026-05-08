"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  psychologistApi,
  type AppointmentDetail,
  type ClientNote,
  type ClientSummary,
} from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";

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
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [notesByPatient, setNotesByPatient] = useState<Record<number, ClientNote | null>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  const [disputeFor, setDisputeFor] = useState<AppointmentDetail | null>(null);

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
    ])
      .then(([appts, cs]) => {
        setItems(appts);
        setClients(cs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    return subscribeNotifications((n) => {
      if (typeof n.type === "string" && n.type.startsWith("APPOINTMENT_")) load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const clientFor = (id?: number | null) =>
    id ? clients.find(c => c.patientId === id) ?? null : null;
  const noteFor = (id?: number | null) =>
    id ? notesByPatient[id] : undefined;

  return (
    <div className="psy-appt-page">
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Randevular</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4 }}>
          Bugünkü iş axınınız və yaxınlaşan seanslar
        </p>
      </header>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>
          Yüklənir…
        </div>
      ) : (
        <>
          <NextSessionHero
            appt={next}
            now={now}
            client={clientFor(next?.patientId)}
            note={noteFor(next?.patientId)}
            busyId={busyId}
            onAction={action}
            onDispute={(a) => setDisputeFor(a)}
          />

          {awaitingConfirm.length > 0 && (
            <Section title="Təsdiq gözlənir" count={awaitingConfirm.length} icon="⏳">
              <div style={{ display: "grid", gap: 10 }}>
                {awaitingConfirm.map(a => (
                  <AwaitingCard
                    key={a.id}
                    a={a}
                    client={clientFor(a.patientId)}
                    busyId={busyId}
                    onConfirm={() => action(a.id, () => psychologistApi.confirmSession(a.id))}
                    onDispute={() => setDisputeFor(a)}
                  />
                ))}
              </div>
            </Section>
          )}

          <Section title="Bu gün" count={today.length} icon="🟢">
            {today.length === 0 ? (
              <Empty msg="Bu gün başqa seans yoxdur 🌿" />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {today.map(a => (
                  <TodayCard
                    key={a.id}
                    a={a}
                    client={clientFor(a.patientId)}
                    note={noteFor(a.patientId)}
                    isNext={next?.id === a.id}
                    now={now}
                    busyId={busyId}
                    onAction={action}
                    onDispute={() => setDisputeFor(a)}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Bu həftə" count={thisWeek.length} icon="📅">
            {thisWeek.length === 0 ? (
              <Empty msg="Bu həftə daha randevu yoxdur" />
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {thisWeek.map(a => (
                  <WeekRow
                    key={a.id}
                    a={a}
                    client={clientFor(a.patientId)}
                    now={now}
                  />
                ))}
              </div>
            )}
          </Section>

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

          <Section title="Tarixçə" count={history.length} icon="📂" defaultCollapsed>
            {history.length === 0 ? (
              <Empty msg="Hələ tamamlanmış seans yoxdur" />
            ) : (
              <div style={{ display: "grid", gap: 4 }}>
                {history.slice(0, 20).map(a => <HistoryRow key={a.id} a={a} />)}
                {history.length > 20 && (
                  <div style={{ fontSize: 12, color: "var(--oxford-60)", textAlign: "center", marginTop: 8 }}>
                    +{history.length - 20} daha
                  </div>
                )}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function NextSessionHero({
  appt, now, client, note, busyId, onAction, onDispute,
}: {
  appt: AppointmentDetail | null;
  now: Date;
  client: ClientSummary | null;
  note: ClientNote | null | undefined;
  busyId: number | null;
  onAction: (id: number, fn: () => Promise<AppointmentDetail>) => Promise<void>;
  onDispute: (a: AppointmentDetail) => void;
}) {
  if (!appt || !appt.startAt) {
    return (
      <div className="psy-hero psy-hero--empty">
        <div className="psy-hero__icon">🌿</div>
        <div>
          <div className="psy-hero__label">Növbəti randevu yoxdur</div>
          <div className="psy-hero__sub">Operator yeni müraciət göndərdiyində burada görünəcək.</div>
        </div>
      </div>
    );
  }

  const start = new Date(appt.startAt);
  const tu = timeUntil(start, now);
  const sessionNumber = client ? client.totalSessions + 1 : null;
  const fmt = appt.sessionFormat === "ONLINE" ? "Onlayn" : appt.sessionFormat === "IN_PERSON" ? "Əyani" : null;

  return (
    <div className={`psy-hero${tu.urgent || tu.expired ? " psy-hero--urgent" : ""}`}>
      <div className="psy-hero__bg" aria-hidden />
      <div className="psy-hero__top">
        <span className="psy-hero__pill">
          <span className="psy-hero__dot" /> NÖVBƏTİ SEANS
        </span>
        <span className="psy-hero__time">
          {relativeDayLabel(start, now)} · <strong>{fmtTime(start)}</strong>
        </span>
      </div>

      <div className="psy-hero__main">
        <div className="psy-hero__avatar">{initialsOf(appt.patientName)}</div>
        <div className="psy-hero__info">
          <div className="psy-hero__name">
            <span>{appt.patientName ?? "Pasient"}</span>
            {sessionNumber && <span className="psy-hero__nth">{sessionNumber}-ci seans</span>}
            {fmt && <span className="psy-hero__fmt">{fmt}</span>}
          </div>
          {note ? (
            <div className="psy-hero__quote">
              <span>📝 Son qeyd:</span> «{note.body.slice(0, 140)}{note.body.length > 140 ? "…" : ""}»
            </div>
          ) : appt.note ? (
            <div className="psy-hero__quote">
              <span>📋 Müraciət:</span> «{appt.note.slice(0, 140)}{appt.note.length > 140 ? "…" : ""}»
            </div>
          ) : null}
        </div>
      </div>

      <div className="psy-hero__actions">
        <span className={`psy-hero__countdown${tu.expired ? " is-live" : tu.urgent ? " is-urgent" : ""}`}>
          ⏰ {tu.text}
        </span>
        {appt.status === "ASSIGNED" && (
          <button
            disabled={busyId === appt.id}
            onClick={() => onAction(appt.id, () => psychologistApi.confirm(appt.id))}
            className="psy-hero__btn psy-hero__btn--primary">
            {busyId === appt.id ? "…" : "Təsdiqlə"}
          </button>
        )}
        {((appt.status === "CONFIRMED" && tu.expired) || appt.status === "AWAITING_CONFIRMATION") && !appt.psychologistConfirmedAt && (
          <>
            <button
              disabled={busyId === appt.id}
              onClick={() => onAction(appt.id, () => psychologistApi.confirmSession(appt.id))}
              className="psy-hero__btn psy-hero__btn--primary">
              {busyId === appt.id ? "…" : "✓ Təsdiqlə"}
            </button>
            <button
              onClick={() => onDispute(appt)}
              className="psy-hero__btn psy-hero__btn--ghost">
              Olmadı
            </button>
          </>
        )}
        {appt.psychologistConfirmedAt && appt.status === "AWAITING_CONFIRMATION" && (
          <span className="psy-hero__btn psy-hero__btn--ghost" style={{ cursor: "default" }}>
            ✓ Siz təsdiqlədiniz · pasientdən gözlənilir
          </span>
        )}
        {appt.patientId && (
          <Link href={`/psycholog/clients/${appt.patientId}`} className="psy-hero__btn psy-hero__btn--ghost">
            Pasient profilinə bax
          </Link>
        )}
      </div>
    </div>
  );
}

function Section({
  title, count, icon, children, defaultCollapsed = false,
}: {
  title: string;
  count: number;
  icon: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  return (
    <section style={{ marginTop: 22 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", gap: 10,
          background: "transparent", border: "none", padding: "0 0 10px",
          cursor: "pointer", textAlign: "left",
        }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <h2 style={{
          fontSize: 13, fontWeight: 700, color: "var(--oxford)",
          margin: 0, textTransform: "uppercase", letterSpacing: 0.4,
        }}>
          {title}
        </h2>
        <span style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 999,
          background: "var(--brand-50)", color: "var(--brand-700)", fontWeight: 700,
        }}>
          {count}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--oxford-60)" }}>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && children}
    </section>
  );
}

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

function TodayCard({
  a, client, note, isNext, now, busyId, onAction, onDispute,
}: {
  a: AppointmentDetail;
  client: ClientSummary | null;
  note: ClientNote | null | undefined;
  isNext: boolean;
  now: Date;
  busyId: number | null;
  onAction: (id: number, fn: () => Promise<AppointmentDetail>) => Promise<void>;
  onDispute: () => void;
}) {
  if (!a.startAt) return null;
  const start = new Date(a.startAt);
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  const sessionNumber = client ? client.totalSessions + 1 : null;
  const fmt = a.sessionFormat === "ONLINE" ? "Onlayn" : a.sessionFormat === "IN_PERSON" ? "Əyani" : null;
  const expired = !!a.endAt && new Date(a.endAt).getTime() < now.getTime();
  const canConfirmSession = (a.status === "CONFIRMED" && expired) || a.status === "AWAITING_CONFIRMATION";

  return (
    <div
      className={`psy-card psy-card--today${isNext ? " psy-card--next" : ""}`}
      style={{ borderLeft: `4px solid ${status.accent}` }}
    >
      <div className="psy-card__top">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="psy-card__time">{fmtTime(start)}</span>
          <span className="psy-card__badge" style={{ color: status.color, background: status.bg }}>
            {status.label}
          </span>
          {fmt && <span className="psy-card__chip">{fmt}</span>}
          {isNext && <span className="psy-card__chip psy-card__chip--next">Növbəti</span>}
        </div>
      </div>
      <div className="psy-card__body">
        <div className="psy-card__avatar">{initialsOf(a.patientName)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="psy-card__name">
            {a.patientName ?? "Pasient"}
            {sessionNumber && <span className="psy-card__nth"> · {sessionNumber}-ci seans</span>}
          </div>
          <div className="psy-card__ctx">
            {client && client.noteCount > 0 && <span>📝 {client.noteCount} qeyd</span>}
            {note?.moodScore && <span>💭 son ovqat {note.moodScore}/10</span>}
            {a.note && (
              <span className="psy-card__ctx-quote">
                «{a.note.slice(0, 80)}{a.note.length > 80 ? "…" : ""}»
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="psy-card__actions">
        {a.status === "ASSIGNED" && (
          <button
            disabled={busyId === a.id}
            onClick={() => onAction(a.id, () => psychologistApi.confirm(a.id))}
            className="psy-card__btn psy-card__btn--primary">
            {busyId === a.id ? "…" : "Təsdiqlə"}
          </button>
        )}
        {canConfirmSession && !a.psychologistConfirmedAt && (
          <>
            <button
              disabled={busyId === a.id}
              onClick={() => onAction(a.id, () => psychologistApi.confirmSession(a.id))}
              className="psy-card__btn psy-card__btn--primary">
              {busyId === a.id ? "…" : "✓ Təsdiqlə"}
            </button>
            <button onClick={onDispute} className="psy-card__btn psy-card__btn--ghost">
              Olmadı
            </button>
          </>
        )}
        {canConfirmSession && a.psychologistConfirmedAt && (
          <span className="psy-card__btn psy-card__btn--ghost" style={{ cursor: "default", fontSize: 11.5 }}>
            ✓ Siz təsdiqlədiniz · pasientdən gözlənilir
          </span>
        )}
        {a.patientId && (
          <Link href={`/psycholog/clients/${a.patientId}`} className="psy-card__btn psy-card__btn--ghost">
            Pasient
          </Link>
        )}
      </div>
    </div>
  );
}

function WeekRow({
  a, client, now,
}: {
  a: AppointmentDetail;
  client: ClientSummary | null;
  now: Date;
}) {
  if (!a.startAt) return null;
  const start = new Date(a.startAt);
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  const sessionNumber = client ? client.totalSessions + 1 : null;
  const fmt = a.sessionFormat === "ONLINE" ? "Onlayn" : a.sessionFormat === "IN_PERSON" ? "Əyani" : null;
  return (
    <div className="psy-week-row" style={{ borderLeft: `3px solid ${status.accent}` }}>
      <div className="psy-week-row__day">
        <strong>{relativeDayLabel(start, now)}</strong>
        <span>{fmtTime(start)}</span>
      </div>
      <div className="psy-week-row__name">
        {a.patientName ?? "Pasient"}
        {sessionNumber && <small> · {sessionNumber}-ci seans</small>}
      </div>
      {fmt && <span className="psy-week-row__chip">{fmt}</span>}
      {a.patientId ? (
        <Link href={`/psycholog/clients/${a.patientId}`} className="psy-week-row__link" aria-label="Pasient profilinə git">›</Link>
      ) : <span />}
    </div>
  );
}

function HistoryRow({ a }: { a: AppointmentDetail }) {
  const ref = a.startAt ?? a.endAt;
  if (!ref) return null;
  const d = new Date(ref);
  const status = STATUS[a.status] ?? STATUS.COMPLETED;
  return (
    <div className="psy-hist-row">
      <span className="psy-hist-row__date">{pad2(d.getDate())}.{pad2(d.getMonth() + 1)}.{d.getFullYear()}</span>
      <span className="psy-hist-row__name">{a.patientName ?? "Pasient"}</span>
      <span className="psy-hist-row__badge" style={{ color: status.color, background: status.bg }}>
        {status.label}
      </span>
      {a.patientId ? (
        <Link href={`/psycholog/clients/${a.patientId}`} className="psy-hist-row__link">Notə bax</Link>
      ) : <span />}
    </div>
  );
}

/* ─── Awaiting confirmation card ─────────────────────────────────────────── */

function AwaitingCard({
  a, client, busyId, onConfirm, onDispute,
}: {
  a: AppointmentDetail;
  client: ClientSummary | null;
  busyId: number | null;
  onConfirm: () => void;
  onDispute: () => void;
}) {
  const status = STATUS[a.status] ?? STATUS.AWAITING_CONFIRMATION;
  const fmt = a.sessionFormat === "ONLINE" ? "Onlayn" : a.sessionFormat === "IN_PERSON" ? "Əyani" : null;
  const start = a.startAt ? new Date(a.startAt) : null;
  const sessionNumber = client ? client.totalSessions + 1 : null;
  const alreadyConfirmed = !!a.psychologistConfirmedAt;
  const isDisputed = a.status === "DISPUTED";

  return (
    <div className="psy-card psy-card--today" style={{ borderLeft: `4px solid ${status.accent}` }}>
      <div className="psy-card__top">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="psy-card__time">{start ? `${pad2(start.getDate())}.${pad2(start.getMonth() + 1)} · ${fmtTime(start)}` : "—"}</span>
          <span className="psy-card__badge" style={{ color: status.color, background: status.bg }}>
            {status.label}
          </span>
          {fmt && <span className="psy-card__chip">{fmt}</span>}
        </div>
      </div>
      <div className="psy-card__body">
        <div className="psy-card__avatar">{initialsOf(a.patientName)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="psy-card__name">
            {a.patientName ?? "Pasient"}
            {sessionNumber && <span className="psy-card__nth"> · {sessionNumber}-ci seans</span>}
          </div>
          <div className="psy-card__ctx">
            {isDisputed ? (
              <span className="psy-card__ctx-quote">⚠ Mübahisə açıldı — operator həll edəcək</span>
            ) : alreadyConfirmed ? (
              <span className="psy-card__ctx-quote">✓ Siz təsdiqlədiniz — pasientdən gözlənilir</span>
            ) : (
              <span className="psy-card__ctx-quote">Seans baş tutdumu? Qısa təsdiq lazımdır.</span>
            )}
          </div>
        </div>
      </div>
      {!isDisputed && !alreadyConfirmed && (
        <div className="psy-card__actions">
          <button
            disabled={busyId === a.id}
            onClick={onConfirm}
            className="psy-card__btn psy-card__btn--primary">
            {busyId === a.id ? "…" : "✓ Təsdiqlə"}
          </button>
          <button onClick={onDispute} className="psy-card__btn psy-card__btn--ghost">
            Olmadı
          </button>
        </div>
      )}
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
