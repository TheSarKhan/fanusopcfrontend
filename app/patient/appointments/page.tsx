"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  patientApi,
  type AppointmentDetail,
  type MyReview,
  type RescheduleProposal,
  type SessionFeedback,
} from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import ReviewModal from "./ReviewModal";
import CancelModal from "@/components/CancelModal";
import RescheduleProposalModal from "@/components/RescheduleProposalModal";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import SessionFeedbackModal from "@/components/SessionFeedbackModal";
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
  PENDING:                { label: "Gözlənilir",       color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  ASSIGNED:               { label: "Təyin edilib",     color: "var(--brand-700)", bg: "var(--brand-50)", accent: "var(--brand)" },
  CONFIRMED:              { label: "Təsdiqlənib",      color: "#065F46",          bg: "#D1FAE5",         accent: "#10B981" },
  AWAITING_CONFIRMATION:  { label: "Təsdiq gözlənir",  color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  DISPUTED:               { label: "Mübahisəli",       color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  COMPLETED:              { label: "Tamamlandı",       color: "#374151",          bg: "#F3F4F6",         accent: "#9CA3AF" },
  CANCELLED:              { label: "Ləğv edildi",      color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  CANCEL_REQUESTED:       { label: "Ləğv gözlənir",    color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  REJECTED:               { label: "Yenidən təyin",    color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
};

const ACTIVE_STATUSES = new Set(["ASSIGNED", "CONFIRMED", "PENDING", "REJECTED", "CANCEL_REQUESTED"]);

export default function PatientAppointmentsPage() {
  const { t } = useT();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  const [reschedFor, setReschedFor] = useState<AppointmentDetail | null>(null);
  const [reviewFor, setReviewFor] = useState<AppointmentDetail | null>(null);
  const [disputeFor, setDisputeFor] = useState<AppointmentDetail | null>(null);
  const [cancelFor, setCancelFor] = useState<AppointmentDetail | null>(null);
  const [proposals, setProposals] = useState<RescheduleProposal[]>([]);
  const [proposalFor, setProposalFor] = useState<RescheduleProposal | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<AppointmentDetail | null>(null);
  const [existingFeedback, setExistingFeedback] = useState<SessionFeedback | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<number>>(new Set());

  // Tick every minute for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = () => {
    setLoading(true);
    Promise.all([
      patientApi.myAppointments(),
      patientApi.myReviews().catch(() => [] as MyReview[]),
      patientApi.pendingRescheduleProposals().catch(() => [] as RescheduleProposal[]),
    ])
      .then(([appts, revs, props]) => {
        setItems(appts);
        setMyReviews(revs);
        setProposals(props);
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
      .filter(a => a.status === "ASSIGNED" || a.status === "CONFIRMED")
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())[0] ?? null;
  }, [items, now]);

  const awaitingConfirm = useMemo(() => {
    return items
      .filter(a => a.status === "AWAITING_CONFIRMATION" || a.status === "DISPUTED")
      .sort((a, b) => {
        const da = new Date(a.endAt ?? a.startAt ?? 0).getTime();
        const db = new Date(b.endAt ?? b.startAt ?? 0).getTime();
        return db - da;
      });
  }, [items]);

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
      .filter(a => ["COMPLETED", "CANCELLED"].includes(a.status))
      .sort((a, b) => {
        const da = new Date(a.startAt ?? a.endAt ?? 0).getTime();
        const db = new Date(b.startAt ?? b.endAt ?? 0).getTime();
        return db - da;
      });
  }, [items]);

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

  const sessionCountFor = (psyId?: number | null) => {
    if (!psyId) return null;
    const completed = items.filter(a =>
      a.psychologistId === psyId &&
      ["COMPLETED", "CONFIRMED", "AWAITING_CONFIRMATION"].includes(a.status)
    ).length;
    return completed > 0 ? completed + 1 : 1;
  };

  const reviewedFor = (psyId?: number | null) =>
    psyId ? myReviews.find(r => r.psychologistId === psyId) ?? null : null;

  const openFeedback = async (a: AppointmentDetail) => {
    setExistingFeedback(null); setFeedbackFor(a);
    try {
      const fb = await patientApi.getSessionFeedback(a.id);
      setExistingFeedback(fb);
      if (fb) setFeedbackGiven(prev => new Set(prev).add(a.id));
    } catch { /* opening modal fresh — backend may have returned 200 with null */ }
  };

  return (
    <div className="psy-appt-page">
      <header style={{ marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>{t("appt.pageTitle")}</h1>
          <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4 }}>{t("appt.pageSub")}</p>
        </div>
        <Link
          href="/psychologists"
          style={{
            background: "var(--brand)", color: "#fff",
            padding: "10px 18px", borderRadius: 10,
            fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}>
          {t("appt.newCta")}
        </Link>
      </header>

      {proposals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {proposals.map(p => (
            <div key={p.id} className="rsc-banner">
              <div className="rsc-banner-icon">📅</div>
              <div className="rsc-banner-main">
                <div className="rsc-banner-title">Saat təklifi gözləyir</div>
                <p className="rsc-banner-text">
                  {p.psychologistName ?? "Psixoloqunuz"} {p.options.length} alternativ saat təklif edir.
                  Birini seçin və ya hamısını rədd edin.
                </p>
              </div>
              <button className="rsc-banner-action" onClick={() => setProposalFor(p)}>
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
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "4rem 2rem", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>📅</div>
          <h3 style={{ fontWeight: 700, color: "var(--oxford)", marginBottom: 6, fontSize: 17 }}>Hələ randevunuz yoxdur</h3>
          <p style={{ color: "var(--oxford-60)", fontSize: 13, marginBottom: 18 }}>
            Psixoloqlarımızdan biri ilə randevu alaraq başlayın
          </p>
          <Link
            href="/psychologists"
            style={{ background: "var(--brand)", color: "#fff", padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none", display: "inline-block" }}>
            Psixoloq seç
          </Link>
        </div>
      ) : (
        <>
          <NextSessionHero
            appt={next}
            now={now}
            sessionNumber={next?.psychologistId ? sessionCountFor(next.psychologistId) : null}
            busyId={busyId}
            onConfirm={(a) => action(a.id, () => patientApi.confirmSession(a.id))}
            onDispute={(a) => setDisputeFor(a)}
            onReschedule={(a) => setReschedFor(a)}
            onCancel={(a) => cancel(a)}
          />

          {/* Pending confirmation — appears prominently if any */}
          {awaitingConfirm.length > 0 && (
            <Section title={t("appt.sectionAwaiting")} count={awaitingConfirm.length} icon="⏳">
              <div style={{ display: "grid", gap: 10 }}>
                {awaitingConfirm.map(a => (
                  <AwaitingCard
                    key={a.id}
                    a={a}
                    busyId={busyId}
                    onConfirm={() => action(a.id, () => patientApi.confirmSession(a.id))}
                    onDispute={() => setDisputeFor(a)}
                  />
                ))}
              </div>
            </Section>
          )}

          <Section title={t("appt.sectionToday")} count={today.length} icon="🟢">
            {today.length === 0 ? (
              <Empty msg="Bu gün başqa randevunuz yoxdur" />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {today.map(a => (
                  <TodayCard
                    key={a.id}
                    a={a}
                    isNext={next?.id === a.id}
                    sessionNumber={a.psychologistId ? sessionCountFor(a.psychologistId) : null}
                    busyId={busyId}
                    onReschedule={() => setReschedFor(a)}
                    onCancel={() => cancel(a)}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title={t("appt.sectionWeek")} count={thisWeek.length} icon="📅">
            {thisWeek.length === 0 ? (
              <Empty msg="Bu həftə başqa randevunuz yoxdur" />
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {thisWeek.map(a => (
                  <WeekRow
                    key={a.id}
                    a={a}
                    sessionNumber={a.psychologistId ? sessionCountFor(a.psychologistId) : null}
                    now={now}
                    onReschedule={() => setReschedFor(a)}
                    onCancel={() => cancel(a)}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title={t("appt.sectionHistory")} count={history.length} icon="📂" defaultCollapsed>
            {history.length === 0 ? (
              <Empty msg="Hələ tamamlanmış seansınız yoxdur" />
            ) : (
              <div style={{ display: "grid", gap: 4 }}>
                {history.slice(0, 30).map(a => (
                  <HistoryRow
                    key={a.id}
                    a={a}
                    review={reviewedFor(a.psychologistId)}
                    feedbackGiven={feedbackGiven.has(a.id)}
                    onWriteReview={() => setReviewFor(a)}
                    onFeedback={() => openFeedback(a)}
                  />
                ))}
                {history.length > 30 && (
                  <div style={{ fontSize: 12, color: "var(--oxford-60)", textAlign: "center", marginTop: 8 }}>
                    +{history.length - 30} daha
                  </div>
                )}
              </div>
            )}
          </Section>
        </>
      )}

      {reschedFor && (
        <RescheduleModal
          appointment={reschedFor}
          onClose={() => setReschedFor(null)}
          onDone={() => { setReschedFor(null); load(); }}
        />
      )}
      {reviewFor && reviewFor.psychologistId && (
        <ReviewModal
          psychologistId={reviewFor.psychologistId}
          psychologistName={reviewFor.psychologistName ?? "Psixoloq"}
          appointmentId={reviewFor.id}
          onClose={() => setReviewFor(null)}
          onSubmitted={(saved) => {
            setMyReviews(prev => [saved, ...prev.filter(r => r.id !== saved.id)]);
            setReviewFor(null);
          }}
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
        <CancelModal
          appointment={cancelFor}
          role="PATIENT"
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
      {feedbackFor && (
        <SessionFeedbackModal
          appointment={feedbackFor}
          existing={existingFeedback}
          onClose={() => { setFeedbackFor(null); setExistingFeedback(null); }}
          onSubmitted={(fb) => {
            setFeedbackGiven(prev => new Set(prev).add(feedbackFor.id));
            setExistingFeedback(fb);
            setFeedbackFor(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Hero — next session ─────────────────────────────────────────────────── */

function NextSessionHero({
  appt, now, sessionNumber, busyId, onConfirm, onDispute, onReschedule, onCancel,
}: {
  appt: AppointmentDetail | null;
  now: Date;
  sessionNumber: number | null;
  busyId: number | null;
  onConfirm: (a: AppointmentDetail) => void;
  onDispute: (a: AppointmentDetail) => void;
  onReschedule: (a: AppointmentDetail) => void;
  onCancel: (a: AppointmentDetail) => void;
}) {
  const { t } = useT();
  if (!appt || !appt.startAt) {
    return (
      <div className="psy-hero psy-hero--empty">
        <div className="psy-hero__icon">🌿</div>
        <div>
          <div className="psy-hero__label">Yaxınlaşan randevu yoxdur</div>
          <div className="psy-hero__sub">Yeni randevu almaq üçün psixoloq seçin.</div>
        </div>
      </div>
    );
  }

  const start = new Date(appt.startAt);
  const tu = timeUntil(start, now);
  const showConfirm = tu.expired && (appt.status === "CONFIRMED" || appt.status === "AWAITING_CONFIRMATION");
  const alreadyConfirmed = !!appt.patientConfirmedAt;

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
        <div className="psy-hero__avatar">{initialsOf(appt.psychologistName)}</div>
        <div className="psy-hero__info">
          <div className="psy-hero__name">
            <span>{appt.psychologistName ?? "Operator psixoloq təyin edəcək"}</span>
            {sessionNumber && <span className="psy-hero__nth">{sessionNumber}-ci seans</span>}
          </div>
          {appt.note && (
            <div className="psy-hero__quote">
              <span>📋 Mövzunuz:</span> «{appt.note.slice(0, 140)}{appt.note.length > 140 ? "…" : ""}»
            </div>
          )}
        </div>
      </div>

      <div className="psy-hero__actions">
        <span className={`psy-hero__countdown${tu.expired ? " is-live" : tu.urgent ? " is-urgent" : ""}`}>
          ⏰ {tu.text}
        </span>
        {showConfirm && !alreadyConfirmed && (
          <>
            <button
              disabled={busyId === appt.id}
              onClick={() => onConfirm(appt)}
              className="psy-hero__btn psy-hero__btn--primary">
              {busyId === appt.id ? "…" : `✓ ${t("staff.cardConfirm")}`}
            </button>
            <button
              onClick={() => onDispute(appt)}
              className="psy-hero__btn psy-hero__btn--ghost">
              {t("staff.cardDispute")}
            </button>
          </>
        )}
        {showConfirm && alreadyConfirmed && (
          <span className="psy-hero__btn psy-hero__btn--ghost" style={{ cursor: "default" }}>
            {t("appt.youConfirmed")}
          </span>
        )}
        {!tu.expired && (
          <>
            <AddToCalendarMenu appointment={appt} variant="compact" />
            <button
              onClick={() => onReschedule(appt)}
              className="psy-hero__btn psy-hero__btn--ghost">
              {t("staff.cardReschedule")}
            </button>
            <button
              onClick={() => onCancel(appt)}
              className="psy-hero__btn psy-hero__btn--ghost">
              {t("staff.cardCancel")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Sections wrapper ───────────────────────────────────────────────────── */

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

/* ─── Awaiting confirmation card ─────────────────────────────────────────── */

function AwaitingCard({
  a, busyId, onConfirm, onDispute,
}: {
  a: AppointmentDetail;
  busyId: number | null;
  onConfirm: () => void;
  onDispute: () => void;
}) {
  const { t } = useT();
  const status = STATUS[a.status] ?? STATUS.AWAITING_CONFIRMATION;
  const start = a.startAt ? new Date(a.startAt) : null;
  const alreadyConfirmed = !!a.patientConfirmedAt;
  const isDisputed = a.status === "DISPUTED";

  return (
    <div className="psy-card psy-card--today" style={{ borderLeft: `4px solid ${status.accent}` }}>
      <div className="psy-card__top">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="psy-card__time">{start ? `${pad2(start.getDate())}.${pad2(start.getMonth() + 1)} · ${fmtTime(start)}` : "—"}</span>
          <span className="psy-card__badge" style={{ color: status.color, background: status.bg }}>
            {status.label}
          </span>
          {a.seriesId != null && a.seriesIndex != null && a.seriesTotal != null && (
            <span className="psy-card__chip" style={{ background: "var(--brand-50)", color: "var(--brand-700)", fontWeight: 600 }}>
              {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal })}
            </span>
          )}
        </div>
      </div>
      <div className="psy-card__body">
        <div className="psy-card__avatar">{initialsOf(a.psychologistName)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="psy-card__name">{a.psychologistName ?? "Psixoloq"}</div>
          <div className="psy-card__ctx">
            {isDisputed ? (
              <span className="psy-card__ctx-quote">Operator komandamız sizinlə əlaqə saxlayacaq.</span>
            ) : alreadyConfirmed ? (
              <span className="psy-card__ctx-quote">✓ Siz təsdiqlədiniz — psixoloqdan gözlənilir</span>
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
            {busyId === a.id ? "…" : `✓ ${t("staff.cardConfirm")}`}
          </button>
          <button
            onClick={onDispute}
            className="psy-card__btn psy-card__btn--ghost">
            {t("staff.cardDispute")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Today card ─────────────────────────────────────────────────────────── */

function TodayCard({
  a, isNext, sessionNumber, busyId, onReschedule, onCancel,
}: {
  a: AppointmentDetail;
  isNext: boolean;
  sessionNumber: number | null;
  busyId: number | null;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  if (!a.startAt) return null;
  const start = new Date(a.startAt);
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;

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
          {a.seriesId != null && a.seriesIndex != null && a.seriesTotal != null && (
            <span className="psy-card__chip" style={{ background: "var(--brand-50)", color: "var(--brand-700)", fontWeight: 600 }}>
              {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal })}
            </span>
          )}
          {isNext && <span className="psy-card__chip psy-card__chip--next">Növbəti</span>}
        </div>
      </div>
      <div className="psy-card__body">
        <div className="psy-card__avatar">{initialsOf(a.psychologistName)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="psy-card__name">
            {a.psychologistName ?? "Operator təyin edəcək"}
            {sessionNumber && <span className="psy-card__nth"> · {sessionNumber}-ci seans</span>}
          </div>
          <div className="psy-card__ctx">
            {a.note && (
              <span className="psy-card__ctx-quote">
                «{a.note.slice(0, 80)}{a.note.length > 80 ? "…" : ""}»
              </span>
            )}
            {a.operatorNote && (
              <span className="psy-card__ctx-quote">
                <strong>Operator:</strong> {a.operatorNote.slice(0, 80)}{a.operatorNote.length > 80 ? "…" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="psy-card__actions">
        <a
          href={`/patient/appointments/${a.id}/intake`}
          className="psy-card__btn psy-card__btn--ghost"
          style={{ textDecoration: "none" }}>
          {t("intake.cta")}
        </a>
        <button
          onClick={onReschedule}
          disabled={busyId === a.id}
          className="psy-card__btn psy-card__btn--ghost">
          {t("staff.cardReschedule")}
        </button>
        <button
          onClick={onCancel}
          disabled={busyId === a.id}
          className="psy-card__btn psy-card__btn--ghost"
          style={{ color: "#991B1B", borderColor: "#FECACA" }}>
          {t("staff.cardCancel")}
        </button>
      </div>
    </div>
  );
}

/* ─── Week row ───────────────────────────────────────────────────────────── */

function WeekRow({
  a, sessionNumber, now, onReschedule, onCancel,
}: {
  a: AppointmentDetail;
  sessionNumber: number | null;
  now: Date;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  if (!a.startAt) return null;
  const start = new Date(a.startAt);
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  return (
    <div className="psy-week-row" style={{ borderLeft: `3px solid ${status.accent}` }}>
      <div className="psy-week-row__day">
        <strong>{relativeDayLabel(start, now)}</strong>
        <span>{fmtTime(start)}</span>
      </div>
      <div className="psy-week-row__name">
        {a.psychologistName ?? "Operator təyin edəcək"}
        {sessionNumber && <small> · {sessionNumber}-ci seans</small>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onReschedule}
          style={{ fontSize: 11, color: "var(--brand-700)", background: "var(--brand-50)", border: "1px solid var(--brand-200)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontWeight: 600 }}>
          {t("staff.cardReschedule")}
        </button>
        <button onClick={onCancel}
          style={{ fontSize: 11, color: "#991B1B", background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontWeight: 600 }}>
          {t("staff.cardCancel")}
        </button>
      </div>
    </div>
  );
}

/* ─── History row ────────────────────────────────────────────────────────── */

function HistoryRow({
  a, review, feedbackGiven, onWriteReview, onFeedback,
}: {
  a: AppointmentDetail;
  review: MyReview | null;
  feedbackGiven: boolean;
  onWriteReview: () => void;
  onFeedback: () => void;
}) {
  const ref = a.startAt ?? a.endAt;
  if (!ref) return null;
  const d = new Date(ref);
  const status = STATUS[a.status] ?? STATUS.COMPLETED;
  const canReview = a.status === "COMPLETED" && a.psychologistId && !review;
  const canFeedback = a.status === "COMPLETED" || a.status === "AWAITING_CONFIRMATION";
  const reviewLabel = review
    ? review.status === "PENDING" ? "Rəy gözləyir" : review.status === "APPROVED" ? "Rəyim ✓" : "Rəyim"
    : null;
  return (
    <div className="psy-hist-row">
      <span className="psy-hist-row__date">{pad2(d.getDate())}.{pad2(d.getMonth() + 1)}.{d.getFullYear()}</span>
      <span className="psy-hist-row__name">{a.psychologistName ?? "Psixoloq"}</span>
      <span className="psy-hist-row__badge" style={{ color: status.color, background: status.bg }}>
        {status.label}
      </span>
      {canFeedback && (
        feedbackGiven ? (
          <span className="sf-given">⭐ rəy verildi</span>
        ) : (
          <button onClick={onFeedback} className="sf-cta" type="button">
            Necə keçdi?
          </button>
        )
      )}
      {canReview ? (
        <button
          onClick={onWriteReview}
          style={{ fontSize: 11.5, color: "var(--brand)", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}>
          Rəy yaz
        </button>
      ) : reviewLabel ? (
        <span style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 500 }}>
          {reviewLabel}
        </span>
      ) : <span />}
    </div>
  );
}

/* ─── Reschedule modal (kept from previous version, brand-aligned) ───────── */

function RescheduleModal({
  appointment, onClose, onDone,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const [datetime, setDatetime] = useState("");
  const [note, setNote] = useState(appointment.note ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!datetime) { setErr("Yeni vaxt seçin"); return; }
    const trimmed = note.trim();
    if (trimmed.length < 5) { setErr("Qısa təsvir yazın (ən azı 5 simvol)"); return; }
    setSaving(true);
    try {
      await patientApi.reschedule(appointment.id, {
        note: trimmed,
        requestedPsychologistId: appointment.psychologistId ?? appointment.requestedPsychologistId ?? null,
        requestedStartAt: new Date(datetime).toISOString(),
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(560px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Vaxtı dəyişdir</h2>
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4 }}>
            Mövcud randevu ləğv ediləcək və yeni müraciət qeydə alınacaq. Operator yeni vaxtı təsdiqləyəcək.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>Yeni vaxt</label>
          <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 14 }} />

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>Qısa təsvir</label>
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Vaxt dəyişdirmə səbəbi və ya yeni qeydlər"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12 }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Bağla
            </button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Göndərilir…" : "Vaxtı dəyiş"}
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
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      const updated = await patientApi.disputeSession(appointment.id, reason.trim() || undefined);
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
