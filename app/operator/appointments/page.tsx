"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  operatorApi,
  isSlotConflict,
  type AppointmentDetail,
  type AvailableSlot,
  type ContactLog,
  type PatientHistory,
  type Psychologist,
  type PsychologistSuggestion,
} from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import CancelModal from "@/components/CancelModal";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azLocalToISO, isoToAzLocal, azFormatDate, azFormatTime, azFormatDateTime } from "@/lib/datetime";

type Tab = "PENDING" | "ASSIGNED" | "CONFIRMED" | "DISPUTED" | "COMPLETED" | "CANCELLED" | "CANCEL_REQUESTED";

const TAB_META: Record<Tab, { label: string; color: string }> = {
  PENDING:          { label: "Yeni müraciətlər",  color: "#92400E" },
  CANCEL_REQUESTED: { label: "Ləğv tələbləri",    color: "#92400E" },
  ASSIGNED:         { label: "Təyin edilmiş",     color: "#082F6D" },
  CONFIRMED:        { label: "Təsdiqlənmiş",      color: "#065F46" },
  DISPUTED:         { label: "Mübahisəli",        color: "#991B1B" },
  COMPLETED:        { label: "Tamamlanmış",       color: "#374151" },
  CANCELLED:        { label: "Ləğv olunmuş",      color: "#991B1B" },
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  return azFormatDateTime(iso);
}
function fmtTime(iso: string) {
  return azFormatTime(iso);
}
function fmtDay(iso: string) {
  return azFormatDate(iso);
}
function isoDateOnly(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toDateTimeLocal(iso: string) {
  return isoToAzLocal(iso);
}

export default function OperatorAppointmentsPage() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("PENDING");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  // GAP-01: dashboard "Gecikmiş" badge deep-links here with ?filter=overdue
  const [overdueOnly, setOverdueOnly] = useState(() => searchParams.get("filter") === "overdue");
  const [slaHours, setSlaHours] = useState<number | null>(null);
  const [now] = useState(() => Date.now());

  // React to topbar search updates
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
    setOverdueOnly(searchParams.get("filter") === "overdue");
  }, [searchParams]);

  useEffect(() => {
    operatorApi.stats().then(s => setSlaHours(s.slaHours)).catch(() => {});
  }, []);
  const [assignFor, setAssignFor] = useState<AppointmentDetail | null>(null);
  const [resolveFor, setResolveFor] = useState<AppointmentDetail | null>(null);
  const [cancelFor, setCancelFor] = useState<AppointmentDetail | null>(null);
  const [logContactFor, setLogContactFor] = useState<AppointmentDetail | null>(null);
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
      if (typeof n.type === "string" && n.type.startsWith("APPOINTMENT_")) load();
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(a => {
      if (overdueOnly) {
        if (!isOverdue(a)) return false;
      } else {
        if (tab === "PENDING" && !(a.status === "PENDING" || a.status === "REJECTED")) return false;
        // CONFIRMED tab also covers AWAITING_CONFIRMATION (post-session, not yet final)
        if (tab === "CONFIRMED" && !(a.status === "CONFIRMED" || a.status === "AWAITING_CONFIRMATION")) return false;
        if (tab !== "PENDING" && tab !== "CONFIRMED" && a.status !== tab) return false;
      }
      if (!q) return true;
      const hay = `${a.id} ${a.patientName ?? ""} ${a.psychologistName ?? ""} ${a.requestedPsychologistName ?? ""} ${a.note ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, tab, search, overdueOnly, slaHours]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { PENDING: 0, ASSIGNED: 0, CONFIRMED: 0, DISPUTED: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const a of items) {
      if (a.status === "PENDING" || a.status === "REJECTED") c.PENDING++;
      else if (a.status === "AWAITING_CONFIRMATION") c.CONFIRMED++;
      else if (c[a.status] !== undefined) c[a.status]++;
    }
    return c;
  }, [items]);

  const onAssigned = (updated: AppointmentDetail) => {
    setItems(prev => prev.map(a => a.id === updated.id ? updated : a));
    setAssignFor(null);
  };

  const onCancel = (a: AppointmentDetail) => setCancelFor(a);

  const onApproveCancelReq = async (a: AppointmentDetail) => {
    const note = window.prompt("Operator qeydi (məcburi deyil):", "") ?? undefined;
    try {
      const updated = await operatorApi.approveCancelRequest(a.id, note);
      setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch (e) { alert((e as Error).message); }
  };
  const onRejectCancelReq = async (a: AppointmentDetail) => {
    const note = window.prompt("Pasiyentə səbəb yazın:", "") ?? undefined;
    try {
      const updated = await operatorApi.rejectCancelRequest(a.id, note);
      setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch (e) { alert((e as Error).message); }
  };

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

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]">{t("staff.opApptTitle")}</h1>
          <p className="text-[#52718F] text-sm mt-1">{t("staff.opDashSub")}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setSelectMode(s => !s); setSelected(new Set()); }}
            className="px-4 py-2 text-sm rounded-xl border border-[#E5E7EB] bg-white text-[#1A2535]">
            {selectMode ? "Seçimi ləğv et" : "Çoxlu seçim"}
          </button>
          <button onClick={load} className="px-4 py-2 text-sm rounded-xl border border-[#E5E7EB] bg-white text-[#1A2535]">
            Yenilə
          </button>
        </div>
      </div>

      {selectMode && selected.size > 0 && (
        <div style={{ background: "var(--brand)", color: "#fff", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {selected.size} müraciət seçilib
          </div>
          <button onClick={() => setBulkOpen(true)}
            style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: "#fff", color: "#1A2535", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Toplu təyin et →
          </button>
        </div>
      )}

      <div className="op-tab-row flex gap-2 mb-4 flex-wrap">
        {(Object.keys(TAB_META) as Tab[]).map(t => {
          const meta = TAB_META[t];
          const active = !overdueOnly && tab === t;
          return (
            <button
              key={t}
              onClick={() => { setOverdueOnly(false); setTab(t); }}
              style={{
                padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: active ? `2px solid ${meta.color}` : "1px solid #E5E7EB",
                background: active ? "#fff" : "rgba(255,255,255,0.6)",
                color: active ? meta.color : "#52718F",
                cursor: "pointer",
              }}
            >
              {meta.label}
              <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>{counts[t] ?? 0}</span>
            </button>
          );
        })}
        <button
          onClick={() => setOverdueOnly(o => !o)}
          style={{
            padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: overdueOnly ? "2px solid #DC2626" : "1px solid #FECACA",
            background: overdueOnly ? "#fff" : "rgba(254,242,242,0.8)",
            color: "#DC2626",
            cursor: "pointer",
          }}
        >
          ⏰ Gecikmiş
          <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>
            {items.filter(isOverdue).length}
          </span>
        </button>
        <input
          type="text"
          className="op-tab-search"
          placeholder="Axtar (ad, psixoloq, qeyd…)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", background: "#fff" }}
        />
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "3rem", textAlign: "center", color: "#52718F" }}>
          Bu kateqoriyada müraciət yoxdur.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map(a => (
            <AppointmentCard
              key={a.id}
              a={a}
              selectable={selectMode}
              selected={selected.has(a.id)}
              onToggleSelect={() => toggleSelected(a.id)}
              onAssign={() => setAssignFor(a)}
              onCancel={() => onCancel(a)}
              onResolve={() => setResolveFor(a)}
              onApproveCancelReq={() => onApproveCancelReq(a)}
              onRejectCancelReq={() => onRejectCancelReq(a)}
              onLogContact={() => setLogContactFor(a)} />
          ))}
        </div>
      )}

      {assignFor && (
        <AssignModal
          appointment={assignFor}
          onClose={() => setAssignFor(null)}
          onAssigned={onAssigned}
        />
      )}

      {bulkOpen && (
        <BulkAssignModal
          ids={Array.from(selected)}
          onClose={() => setBulkOpen(false)}
          onDone={onBulkDone}
        />
      )}

      {resolveFor && (
        <ResolveDisputeModal
          appointment={resolveFor}
          onClose={() => setResolveFor(null)}
          onDone={(updated) => {
            setItems(prev => prev.map(a => a.id === updated.id ? updated : a));
            setResolveFor(null);
          }}
        />
      )}

      {cancelFor && (
        <CancelModal
          appointment={cancelFor}
          role="OPERATOR"
          onClose={() => setCancelFor(null)}
          onDone={(updated) => {
            setItems(prev => prev.map(a => a.id === updated.id ? updated : a));
            setCancelFor(null);
          }}
        />
      )}

      {logContactFor && (
        <LogContactModal
          appointment={logContactFor}
          onClose={() => setLogContactFor(null)}
          onLogged={(log) => {
            setItems(prev => prev.map(a => a.id === logContactFor.id
              ? { ...a, lastContactAt: log.createdAt, lastContactChannel: log.channel, lastContactOutcome: log.outcome }
              : a));
            setLogContactFor(null);
          }}
        />
      )}
    </div>
  );
}

const STATUS_TONE: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING:               { label: "Gözlənilir",      bg: "#FEF3C7", fg: "#92400E" },
  REJECTED:              { label: "Yenidən təyin",   bg: "#FEF3C7", fg: "#92400E" },
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
const OUTCOME_LABEL: Record<string, { label: string; tone: "good" | "warn" | "danger" | "neutral" }> = {
  ANSWERED:    { label: "Cavab verdi",    tone: "good" },
  NO_ANSWER:   { label: "Cavab vermədi",  tone: "warn" },
  BUSY:        { label: "Məşğul",         tone: "warn" },
  REFUSED:     { label: "İmtina etdi",    tone: "danger" },
  RESCHEDULED: { label: "Vaxt dəyişdi",   tone: "neutral" },
  OTHER:       { label: "Digər",          tone: "neutral" },
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

function AppointmentCard({
  a, selectable, selected, onToggleSelect, onAssign, onCancel, onResolve, onApproveCancelReq, onRejectCancelReq, onLogContact,
}: {
  a: AppointmentDetail;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onAssign: () => void;
  onCancel: () => void;
  onResolve: () => void;
  onApproveCancelReq: () => void;
  onRejectCancelReq: () => void;
  onLogContact: () => void;
}) {
  const { t } = useT();
  const status = a.status;
  const isCancelReq = status === "CANCEL_REQUESTED";
  const canAssign = !isCancelReq && (status === "PENDING" || status === "REJECTED" || status === "ASSIGNED");
  const canCancel = !isCancelReq && status !== "COMPLETED" && status !== "CANCELLED";
  const canResolve = status === "DISPUTED";
  const phone = normalizePhone(a.patientPhone);
  const statusMeta = STATUS_TONE[status] ?? { label: status, bg: "#EEF2F7", fg: "#374151" };
  const lastOutcomeMeta = a.lastContactOutcome ? OUTCOME_LABEL[a.lastContactOutcome] : null;

  return (
    <div className={`op-appt${selected ? " op-appt--selected" : ""}`}>
      <div className="op-appt__head">
        {selectable && (
          <input type="checkbox" checked={!!selected} onChange={onToggleSelect}
            style={{ width: 18, height: 18, marginTop: 4, cursor: "pointer", flexShrink: 0 }} />
        )}
        <div className="op-appt__head-main">
          <div className="op-appt__chips">
            <span className="op-appt__id">#FNS-{String(a.id).padStart(4, "0")}</span>
            <span className="op-appt__status" style={{ background: statusMeta.bg, color: statusMeta.fg }}>
              {statusMeta.label}
            </span>
            {a.seriesId != null && a.seriesIndex != null && a.seriesTotal != null && (
              <span className="op-appt__series">
                {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal })}
              </span>
            )}
            <span className="op-appt__time">{fmtDateTime(a.createdAt)} yaradılıb</span>
          </div>

          <div className="op-appt__name">{a.patientName ?? "—"}</div>

          {(phone || a.patientEmail) && (
            <div className="op-appt__contact">
              {phone && (
                <>
                  <a href={`tel:${phone}`} className="op-contact-btn op-contact-btn--call" title={`Zəng et: ${phone}`}>
                    <IconPhone /> Zəng et
                  </a>
                  <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer"
                    className="op-contact-btn op-contact-btn--wa" title={`WhatsApp: ${phone}`}>
                    <IconWhatsApp /> WhatsApp
                  </a>
                  <span className="op-contact-phone">{a.patientPhone}</span>
                </>
              )}
              {a.patientEmail && (
                <a href={`mailto:${a.patientEmail}`} className="op-contact-btn op-contact-btn--mail" title={a.patientEmail}>
                  <IconMail /> Email
                </a>
              )}
            </div>
          )}

          {a.note && (
            <div className="op-appt__topic">
              <div className="op-appt__topic-label">Mövzu</div>
              <div className="op-appt__topic-text">«{a.note}»</div>
            </div>
          )}

          <div className="op-appt__assign">
            {a.psychologistName ? (
              <>
                <strong>Təyin olundu:</strong> {a.psychologistName} · {fmtDateTime(a.startAt)}
              </>
            ) : a.requestedPsychologistName ? (
              <>
                <strong>Tövsiyə olunan:</strong> <em>{a.requestedPsychologistName}</em>
                {a.requestedStartAt && ` · ${fmtDateTime(a.requestedStartAt)}`}
              </>
            ) : (
              <em>Psixoloq seçilməyib — operator təyin edəcək</em>
            )}
          </div>

          {a.operatorNote && (
            <div className="op-appt__op-note">
              <strong>Operator qeydi:</strong> {a.operatorNote}
            </div>
          )}

          <div className="op-appt__followup">
            <div className="op-appt__followup-info">
              <span className="op-appt__followup-label">Son izləmə:</span>
              {a.lastContactAt ? (
                <>
                  <strong>{timeAgo(a.lastContactAt)}</strong>
                  {a.lastContactChannel && (
                    <span className="op-appt__followup-chan">
                      · {CHANNEL_LABEL[a.lastContactChannel] ?? a.lastContactChannel}
                    </span>
                  )}
                  {lastOutcomeMeta && (
                    <span className="op-appt__followup-outcome" data-tone={lastOutcomeMeta.tone}>
                      {lastOutcomeMeta.label}
                    </span>
                  )}
                </>
              ) : (
                <span className="op-appt__followup-empty">qeyd yoxdur</span>
              )}
            </div>
            <button type="button" onClick={onLogContact} className="op-appt__followup-btn">
              + İzləmə əlavə et
            </button>
          </div>

          {status === "DISPUTED" && (
            <div className="op-appt__alert op-appt__alert--danger">
              <strong>Mübahisə:</strong>{" "}
              {a.patientDisputed && a.psychologistDisputed ? "İkisi də 'olmadı' dedi"
                : a.patientDisputed ? "Pasient 'olmadı' dedi"
                : a.psychologistDisputed ? "Psixoloq 'olmadı' dedi"
                : "Mübahisə açıldı"}
              {a.disputeReason && <div style={{ marginTop: 4, fontStyle: "italic" }}>«{a.disputeReason}»</div>}
            </div>
          )}
          {status === "AWAITING_CONFIRMATION" && (
            <div className="op-appt__alert op-appt__alert--warn">
              Təsdiq gözlənir
              {a.patientConfirmedAt && <span> · pasient təsdiqlədi</span>}
              {a.psychologistConfirmedAt && <span> · psixoloq təsdiqlədi</span>}
            </div>
          )}
          {isCancelReq && (
            <div className="op-appt__alert op-appt__alert--warn">
              <strong>Pasient ləğv tələb edib.</strong>
              {a.cancelRequestReasonCode && <> · kod: <code>{a.cancelRequestReasonCode}</code></>}
              {a.cancelRequestReasonText && <div style={{ marginTop: 4, fontStyle: "italic" }}>«{a.cancelRequestReasonText}»</div>}
            </div>
          )}
        </div>

        <div className="op-appt__actions">
          {canResolve && (
            <button onClick={onResolve} className="op-appt__btn op-appt__btn--danger">Həll et</button>
          )}
          {canAssign && (
            <button onClick={onAssign} className="op-appt__btn op-appt__btn--primary">
              {status === "ASSIGNED" ? "Yenidən təyin et" : "Təyin et"}
            </button>
          )}
          {canCancel && !canResolve && (
            <button onClick={onCancel} className="op-appt__btn op-appt__btn--ghost-danger">Ləğv et</button>
          )}
          {isCancelReq && (
            <>
              <button onClick={onApproveCancelReq} className="op-appt__btn op-appt__btn--danger">Ləğvi təsdiqlə</button>
              <button onClick={onRejectCancelReq} className="op-appt__btn op-appt__btn--ghost">Tələbi rədd et</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function IconPhone() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}
function IconWhatsApp() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.3-.7.1-2-.7-3.3-2.3-3.7-2.7-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.1-1.3 0-.1-.2-.2-.5-.3zM12 2C6.5 2 2 6.5 2 12c0 1.7.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/>
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function LogContactModal({
  appointment, onClose, onLogged,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onLogged: (log: ContactLog) => void;
}) {
  const [channel, setChannel] = useState<ContactLog["channel"]>("CALL");
  const [outcome, setOutcome] = useState<ContactLog["outcome"]>("ANSWERED");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const log = await operatorApi.addContactLog(appointment.id, {
        channel, outcome, note: note.trim() || undefined,
      });
      onLogged(log);
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10, 22, 51, 0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(480px, 100%)", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--brand-100)" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>İzləmə qeydi əlavə et</h2>
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4 }}>
            #{appointment.id} · {appointment.patientName ?? "—"}
          </p>
        </div>
        <div style={{ padding: 20, display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--oxford)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Kanal</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["CALL", "WHATSAPP", "SMS", "EMAIL", "OTHER"] as const).map(c => (
                <button key={c} onClick={() => setChannel(c)}
                  style={{
                    padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    border: `1.5px solid ${channel === c ? "var(--brand)" : "var(--brand-100)"}`,
                    background: channel === c ? "var(--brand)" : "#fff",
                    color: channel === c ? "#fff" : "var(--oxford-80)",
                    cursor: "pointer",
                  }}>
                  {CHANNEL_LABEL[c] ?? c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--oxford)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Nəticə</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["ANSWERED", "NO_ANSWER", "BUSY", "REFUSED", "RESCHEDULED", "OTHER"] as const).map(o => {
                const meta = OUTCOME_LABEL[o];
                return (
                  <button key={o} onClick={() => setOutcome(o)}
                    style={{
                      padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${outcome === o ? "var(--brand)" : "var(--brand-100)"}`,
                      background: outcome === o ? "var(--brand)" : "#fff",
                      color: outcome === o ? "#fff" : "var(--oxford-80)",
                      cursor: "pointer",
                    }}>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--oxford)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Qeyd (məcburi deyil)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Qısa təfərrüat — söhbətin nəticəsi, növbəti addım…"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1.5px solid var(--brand-100)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
          </div>
          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose}
              style={{ padding: "8px 14px", border: "1px solid var(--brand-100)", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer", fontWeight: 600 }}>
              Bağla
            </button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 20px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saxlanılır…" : "Qeyd et"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignModal({
  appointment, onClose, onAssigned,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onAssigned: (a: AppointmentDetail) => void;
}) {
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [psyId, setPsyId] = useState<number | null>(appointment.requestedPsychologistId ?? null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  // If the operator opens the modal with a psychologist already chosen,
  // assume slots are about to load — avoids the auto-prefill effect from
  // running before the fetch starts and falsely triggering the manual-time fallback.
  const [loadingSlots, setLoadingSlots] = useState(appointment.requestedPsychologistId != null);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null); // ISO startAt
  const [manualStart, setManualStart] = useState<string>("");
  const [manualEnd, setManualEnd] = useState<string>("");
  const [note, setNote] = useState(appointment.operatorNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Suggestions + history + contact log
  const [suggestions, setSuggestions] = useState<PsychologistSuggestion[]>([]);
  const [history, setHistory] = useState<PatientHistory | null>(null);
  const [contactLogs, setContactLogs] = useState<ContactLog[]>([]);
  const [logChannel, setLogChannel] = useState<"CALL" | "SMS" | "EMAIL" | "WHATSAPP" | "OTHER">("CALL");
  const [logOutcome, setLogOutcome] = useState<"ANSWERED" | "NO_ANSWER" | "BUSY" | "REFUSED" | "RESCHEDULED" | "OTHER">("NO_ANSWER");
  const [logNote, setLogNote] = useState("");
  const [savingLog, setSavingLog] = useState(false);

  useEffect(() => {
    operatorApi.listPsychologists().then(setPsychologists).catch(() => {});
    operatorApi.suggest(appointment.id, 5).then(setSuggestions).catch(() => {});
    if (appointment.patientId) {
      operatorApi.patientHistory(appointment.patientId).then(setHistory).catch(() => {});
    }
    operatorApi.contactLogs(appointment.id).then(setContactLogs).catch(() => {});
  }, [appointment.id, appointment.patientId]);

  const addContactLog = async () => {
    setSavingLog(true);
    try {
      const created = await operatorApi.addContactLog(appointment.id, {
        channel: logChannel, outcome: logOutcome, note: logNote.trim() || undefined,
      });
      setContactLogs(prev => [created, ...prev]);
      setLogNote("");
    } catch (e) { alert((e as Error).message); }
    finally { setSavingLog(false); }
  };

  const blockOrUnblock = async () => {
    if (!history?.userId) return;
    try {
      if (history.blocked) {
        if (!confirm("Bu istifadəçinin blokunu açmaq istəyirsiniz?")) return;
        await operatorApi.unblockUser(history.userId);
        setHistory({ ...history, blocked: false, blockReason: null });
      } else {
        const reason = prompt("Bloklama səbəbi (məcburi deyil):") ?? "";
        await operatorApi.blockUser(history.userId, reason);
        setHistory({ ...history, blocked: true, blockReason: reason });
      }
    } catch (e) { alert((e as Error).message); }
  };

  const applySuggestion = (s: PsychologistSuggestion) => {
    setPsyId(s.psychologistId);
    setPickedSlot(null);
    setManualStart(""); setManualEnd("");
  };

  useEffect(() => {
    if (!psyId) { setSlots([]); return; }
    setLoadingSlots(true);
    const today = new Date();
    const to = new Date(); to.setDate(to.getDate() + 21);
    operatorApi.availability(psyId, isoDateOnly(today), isoDateOnly(to))
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [psyId]);

  // Auto-prefill the time the patient requested when slots load.
  // If the requested time matches an available slot — pick it. Otherwise
  // pre-fill the manual fields using the psychologist's session length.
  useEffect(() => {
    const requested = appointment.requestedStartAt;
    if (!requested || !psyId || loadingSlots) return;
    if (pickedSlot || manualStart) return; // operator already chose
    // Don't run before slots have actually loaded — the fetch may still be in-flight
    // for a brief moment when loadingSlots flips false-true-false. Wait until we
    // have a non-empty array OR confirmed empty after fetch completed.
    if (slots.length === 0) {
      // Empty slot list AFTER load means psychologist has no openings — only then
      // fall back to manual time. Use a microtask/effect re-run guard.
      const psy = psychologists.find(p => p.id === psyId);
      const minutes = psy?.defaultSessionMinutes && psy.defaultSessionMinutes > 0
        ? psy.defaultSessionMinutes : 50;
      const reqMs = new Date(requested).getTime();
      const end = new Date(reqMs + minutes * 60_000);
      setManualStart(toDateTimeLocal(requested));
      setManualEnd(toDateTimeLocal(end.toISOString()));
      return;
    }
    const reqMs = new Date(requested).getTime();
    const match = slots.find(s => new Date(s.startAt).getTime() === reqMs);
    if (match) {
      setPickedSlot(match.startAt);
      return;
    }
    const psy = psychologists.find(p => p.id === psyId);
    const minutes = psy?.defaultSessionMinutes && psy.defaultSessionMinutes > 0
      ? psy.defaultSessionMinutes : 50;
    const end = new Date(reqMs + minutes * 60_000);
    setManualStart(toDateTimeLocal(requested));
    setManualEnd(toDateTimeLocal(end.toISOString()));
  }, [slots, loadingSlots, psyId, psychologists, appointment.requestedStartAt, pickedSlot, manualStart]);

  const groupedSlots = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = fmtDay(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  const submit = async () => {
    setError(null);
    if (!psyId) { setError("Psixoloq seçin"); return; }

    let startAt: string | null = pickedSlot;
    let endAt: string | null = null;
    if (startAt) {
      const slot = slots.find(s => s.startAt === startAt);
      if (slot) endAt = slot.endAt;
    } else if (manualStart && manualEnd) {
      startAt = azLocalToISO(manualStart);
      endAt = azLocalToISO(manualEnd);
    }
    if (!startAt || !endAt) { setError("Vaxt seçin və ya əl ilə daxil edin"); return; }
    if (new Date(startAt) >= new Date(endAt)) { setError("Başlama vaxtı bitiş vaxtından əvvəl olmalıdır"); return; }

    setSaving(true);
    try {
      const updated = await operatorApi.assign(appointment.id, {
        psychologistId: psyId, startAt, endAt, operatorNote: note || null,
      });
      onAssigned(updated);
    } catch (e) {
      setError((e as Error).message);
      // GAP-02: slot raced away — drop the stale pick and reload availability.
      if (isSlotConflict(e) && psyId) {
        setPickedSlot(null);
        setLoadingSlots(true);
        const today = new Date();
        const to = new Date(); to.setDate(to.getDate() + 21);
        operatorApi.availability(psyId, isoDateOnly(today), isoDateOnly(to))
          .then(setSlots)
          .catch(() => {})
          .finally(() => setLoadingSlots(false));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(1100px, 100%)", maxHeight: "92vh", overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #EFF2F7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#52718F" }}>#FNS-{String(appointment.id).padStart(4, "0")}</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A2535", margin: "2px 0 0" }}>Müraciəti psixoloqa təyin et</h2>
            <div style={{ fontSize: 13, color: "#52718F", marginTop: 4 }}>
              <strong>{appointment.patientName ?? "—"}</strong> · {appointment.note?.slice(0, 80)}
              {(appointment.note?.length ?? 0) > 80 ? "…" : ""}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#52718F" }}>×</button>
        </div>

        <div className={`op-assign-grid${history ? " op-assign-grid--with-aside" : ""}`} style={{ overflow: "auto", flex: 1 }}>

        {/* History sidebar */}
        {history && (
          <aside style={{ borderRight: "1px solid #EFF2F7", padding: 16, background: "#FAFCFF" }}>
            <div style={{ fontSize: 11, color: "#52718F", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Müştəri tarixçəsi</div>
            <div style={{ background: "#fff", borderRadius: 10, padding: 12, marginBottom: 10, border: history.blocked ? "1px solid #FECACA" : "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1A2535" }}>{history.name}</div>
              <div style={{ fontSize: 12, color: "#52718F", marginTop: 2 }}>{history.email}</div>
              <div style={{ fontSize: 12, color: "#52718F" }}>{history.phone ?? ""}</div>
              {history.blocked && (
                <div style={{ marginTop: 6, padding: "4px 8px", background: "#FEE2E2", color: "#991B1B", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                  🚫 BLOKLU — {history.blockReason || "səbəb yoxdur"}
                </div>
              )}
              {history.userId && (
                <button onClick={blockOrUnblock}
                  style={{ marginTop: 8, width: "100%", padding: "6px 10px", border: history.blocked ? "1px solid #C7D2FE" : "1px solid #FECACA", background: "#fff", color: history.blocked ? "var(--brand-700)" : "#991B1B", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {history.blocked ? "Bloku aç" : "Blokla / spam"}
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
              <Mini label="Cəmi" value={history.totalAppointments} color="#1E3A5F" />
              <Mini label="Rədd" value={history.rejectedCount} color="#92400E" />
              <Mini label="Ləğv" value={history.cancelledCount} color="#991B1B" />
            </div>

            <div style={{ fontSize: 11, color: "#52718F", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Son müraciətlər</div>
            <div style={{ display: "grid", gap: 4 }}>
              {history.recent.length === 0 ? (
                <div style={{ fontSize: 12, color: "#8AAABF" }}>Yoxdur</div>
              ) : history.recent.map(r => (
                <div key={r.id} style={{ background: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 11, border: "1px solid #EFF2F7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600 }}>#{r.id}</span>
                    <span style={{ color: "#52718F" }}>{r.status}</span>
                  </div>
                  <div style={{ color: "#52718F", marginTop: 2 }}>{r.psychologistName ?? "—"}</div>
                </div>
              ))}
            </div>

            {/* Contact log */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "#52718F", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Əlaqə logu</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6 }}>
                <select value={logChannel} onChange={e => setLogChannel(e.target.value as "CALL" | "SMS" | "EMAIL" | "WHATSAPP" | "OTHER")}
                  style={{ padding: 6, fontSize: 11, borderRadius: 6, border: "1px solid #E5E7EB" }}>
                  <option value="CALL">📞 Zəng</option>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="OTHER">Digər</option>
                </select>
                <select value={logOutcome} onChange={e => setLogOutcome(e.target.value as "ANSWERED" | "NO_ANSWER" | "BUSY" | "REFUSED" | "RESCHEDULED" | "OTHER")}
                  style={{ padding: 6, fontSize: 11, borderRadius: 6, border: "1px solid #E5E7EB" }}>
                  <option value="NO_ANSWER">Cavab yox</option>
                  <option value="ANSWERED">Cavabladı</option>
                  <option value="BUSY">Məşğul</option>
                  <option value="REFUSED">İmtina etdi</option>
                  <option value="RESCHEDULED">Yenidən planladı</option>
                  <option value="OTHER">Digər</option>
                </select>
              </div>
              <input value={logNote} onChange={e => setLogNote(e.target.value)} placeholder="Qeyd"
                style={{ width: "100%", padding: 6, fontSize: 11, borderRadius: 6, border: "1px solid #E5E7EB", marginBottom: 6 }} />
              <button onClick={addContactLog} disabled={savingLog}
                style={{ width: "100%", padding: "6px 10px", border: "none", borderRadius: 6, background: "#1A2535", color: "#fff", fontSize: 11, fontWeight: 600, cursor: savingLog ? "wait" : "pointer" }}>
                {savingLog ? "Əlavə edilir…" : "+ Log əlavə et"}
              </button>
              {contactLogs.length > 0 && (
                <div style={{ marginTop: 8, display: "grid", gap: 4, maxHeight: 120, overflow: "auto" }}>
                  {contactLogs.map(l => (
                    <div key={l.id} style={{ background: "#fff", padding: "4px 6px", borderRadius: 4, fontSize: 10, border: "1px solid #EFF2F7" }}>
                      <strong>{l.channel}</strong> · {l.outcome}
                      {l.note && <div style={{ color: "#52718F" }}>{l.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        <div style={{ padding: 24 }}>
          {suggestions.length > 0 && (
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#065F46", marginBottom: 8 }}>🤖 Avtomatik təklif (top {suggestions.length})</div>
              <div style={{ display: "grid", gap: 6 }}>
                {suggestions.slice(0, 3).map(s => (
                  <button key={s.psychologistId} type="button" onClick={() => applySuggestion(s)}
                    style={{
                      textAlign: "left", padding: "8px 12px", borderRadius: 8,
                      border: psyId === s.psychologistId ? "2px solid #10B981" : "1px solid #BBF7D0",
                      background: psyId === s.psychologistId ? "#fff" : "#FAFEFC",
                      cursor: "pointer",
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1A2535" }}>{s.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#065F46" }}>skor {s.score}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#52718F", marginTop: 2 }}>
                      {s.reasons.join(" · ")}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Psixoloq</label>
          <select value={psyId ?? ""} onChange={e => { setPsyId(Number(e.target.value) || null); setPickedSlot(null); }}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, marginBottom: 16 }}>
            <option value="">— Seç —</option>
            {psychologists.map(p => (
              <option key={p.id} value={p.id}>{p.name} · {p.title}</option>
            ))}
          </select>

          {appointment.requestedStartAt && (
            <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--brand-700)", marginBottom: 12 }}>
              <strong>Müştərinin istədiyi vaxt:</strong> {fmtDateTime(appointment.requestedStartAt)} — avtomatik seçildi, lazım gələrsə dəyişin.
            </div>
          )}

          {psyId && (
            <>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Açıq vaxtlar</label>
              {loadingSlots ? (
                <div style={{ fontSize: 13, color: "#52718F", marginBottom: 16 }}>Yüklənir…</div>
              ) : groupedSlots.length === 0 ? (
                <div style={{ background: "#FFFBEB", border: "1px solid #FEF3C7", borderRadius: 8, padding: 12, fontSize: 12, color: "#92400E", marginBottom: 16 }}>
                  Açıq slot yoxdur. Aşağıda əl ilə vaxt yazın.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10, marginBottom: 16, maxHeight: 220, overflow: "auto" }}>
                  {groupedSlots.map(([day, daySlots]) => {
                    const requestedMs = appointment.requestedStartAt
                      ? new Date(appointment.requestedStartAt).getTime() : null;
                    const pickedMs = pickedSlot ? new Date(pickedSlot).getTime() : null;
                    return (
                    <div key={day}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#52718F", textTransform: "uppercase", marginBottom: 4 }}>{day}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {daySlots.map(s => {
                          const slotMs = new Date(s.startAt).getTime();
                          const active = pickedMs !== null && slotMs === pickedMs;
                          const isRequested = requestedMs !== null && slotMs === requestedMs;
                          let border = "1px solid #E5E7EB";
                          let bg = "#fff";
                          let color = "#1A2535";
                          if (active) { border = "2px solid var(--brand)"; bg = "var(--brand-50)"; color = "var(--brand)"; }
                          else if (isRequested) { border = "2px solid #10B981"; bg = "#ECFDF5"; color = "#065F46"; }
                          return (
                            <button
                              key={s.startAt}
                              type="button"
                              title={isRequested ? "Müştərinin istədiyi vaxt" : undefined}
                              onClick={() => { setPickedSlot(active ? null : s.startAt); setManualStart(""); setManualEnd(""); }}
                              style={{
                                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                border, background: bg, color,
                                cursor: "pointer",
                                position: "relative",
                              }}>
                              {fmtTime(s.startAt)}
                              {isRequested && !active && (
                                <span style={{ marginLeft: 4, fontSize: 9 }}>★</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              <details style={{ marginBottom: 16 }} open={!!manualStart}>
                <summary style={{ fontSize: 12, color: "#52718F", cursor: "pointer" }}>Əl ilə vaxt daxil et</summary>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                  <input type="datetime-local" value={manualStart} onChange={e => { setManualStart(e.target.value); setPickedSlot(null); }}
                    style={{ padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
                  <input type="datetime-local" value={manualEnd} onChange={e => { setManualEnd(e.target.value); setPickedSlot(null); }}
                    style={{ padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
                </div>
              </details>
            </>
          )}

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Operator qeydi (məcburi deyil)</label>
          <textarea
            value={note} onChange={e => setNote(e.target.value)} rows={3}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 16, fontFamily: "inherit" }}
          />

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "10px 18px", border: "1px solid #E5E7EB", background: "#fff", borderRadius: 10, fontSize: 13, color: "#1A2535", cursor: "pointer" }}>
              Ləğv et
            </button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "10px 22px", border: "none", background: "var(--brand)", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saxlanılır…" : "Təsdiqlə və göndər"}
            </button>
          </div>
        </div>

        </div>{/* end grid */}
      </div>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 6, padding: "6px 4px", textAlign: "center", border: "1px solid #EFF2F7" }}>
      <div style={{ fontSize: 9, color: "#52718F", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function BulkAssignModal({
  ids, onClose, onDone,
}: {
  ids: number[];
  onClose: () => void;
  onDone: (updated: AppointmentDetail[]) => void;
}) {
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [psyId, setPsyId] = useState<number | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    operatorApi.listPsychologists().then(setPsychologists).catch(() => {});
  }, []);

  const submit = async () => {
    setErr(null);
    if (!psyId) { setErr("Psixoloq seçin"); return; }
    if (!start || !end) { setErr("Başlama və bitiş vaxtları lazımdır"); return; }
    if (new Date(start) >= new Date(end)) { setErr("Başlama bitişdən əvvəl olmalıdır"); return; }
    setSaving(true);
    try {
      const updated = await operatorApi.bulkAssign(ids, {
        psychologistId: psyId,
        startAt: azLocalToISO(start),
        endAt: azLocalToISO(end),
        operatorNote: note.trim() || null,
      });
      onDone(updated);
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(560px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #EFF2F7" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1A2535", margin: 0 }}>Toplu təyin et</h2>
          <p style={{ fontSize: 12, color: "#52718F", marginTop: 4 }}>{ids.length} müraciət eyni psixoloqa və eyni vaxta təyin olunacaq.</p>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Psixoloq</label>
          <select value={psyId ?? ""} onChange={e => setPsyId(Number(e.target.value) || null)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 12 }}>
            <option value="">— Seç —</option>
            {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }} />
            <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }} />
          </div>

          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Operator qeydi (opsional)"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 12, fontFamily: "inherit" }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>Bağla</button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Göndərilir…" : `${ids.length} təyin et`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Resolve dispute modal ──────────────────────────────────────────────── */

function ResolveDisputeModal({
  appointment, onClose, onDone,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onDone: (updated: AppointmentDetail) => void;
}) {
  const [decision, setDecision] = useState<"COMPLETE" | "CANCEL">("COMPLETE");
  const [blameSide, setBlameSide] = useState<"PATIENT" | "PSYCHOLOGIST" | "NONE">("NONE");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      const blame = decision === "CANCEL" && blameSide !== "NONE" ? blameSide : undefined;
      const updated = await operatorApi.resolveDispute(appointment.id, decision, note.trim() || undefined, blame);
      onDone(updated);
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(560px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #EFF2F7" }}>
          <div style={{ fontSize: 11, color: "#52718F" }}>#FNS-{String(appointment.id).padStart(4, "0")}</div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1A2535", margin: "2px 0 0" }}>Mübahisəni həll et</h2>
          <div style={{ fontSize: 13, color: "#52718F", marginTop: 4 }}>
            <strong>{appointment.patientName ?? "—"}</strong> ↔ {appointment.psychologistName ?? "—"}
          </div>
          {appointment.disputeReason && (
            <div style={{ fontSize: 12, color: "#991B1B", marginTop: 8, padding: "8px 10px", background: "#FEE2E2", borderRadius: 8 }}>
              <strong>Səbəb:</strong> «{appointment.disputeReason}»
            </div>
          )}
          <div style={{ fontSize: 12, color: "#52718F", marginTop: 6 }}>
            {appointment.patientDisputed && "Pasient 'olmadı' dedi"}
            {appointment.patientDisputed && appointment.psychologistDisputed && " · "}
            {appointment.psychologistDisputed && "Psixoloq 'olmadı' dedi"}
          </div>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 8 }}>Qərar</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            <button type="button" onClick={() => setDecision("COMPLETE")}
              style={{
                padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: decision === "COMPLETE" ? "2px solid #10B981" : "1px solid #E5E7EB",
                background: decision === "COMPLETE" ? "#D1FAE5" : "#fff",
                color: decision === "COMPLETE" ? "#065F46" : "#1A2535",
                cursor: "pointer", textAlign: "left",
              }}>
              <div style={{ fontWeight: 700 }}>✓ Tamamlanmış say</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>Seans baş tutdu, hesablamaya daxildir</div>
            </button>
            <button type="button" onClick={() => setDecision("CANCEL")}
              style={{
                padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: decision === "CANCEL" ? "2px solid #DC2626" : "1px solid #E5E7EB",
                background: decision === "CANCEL" ? "#FEE2E2" : "#fff",
                color: decision === "CANCEL" ? "#991B1B" : "#1A2535",
                cursor: "pointer", textAlign: "left",
              }}>
              <div style={{ fontWeight: 700 }}>✗ Ləğv et</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>Seans baş tutmadı, hesablamadan kənar</div>
            </button>
          </div>

          {decision === "CANCEL" && (
            <>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
                Kim "no-show" sayğacına işlənsin?
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
                {[
                  { v: "NONE",          label: "Heç kim",   sub: "Texniki / mübahisəli" },
                  { v: "PATIENT",       label: "Pasient",   sub: "Pasient gəlmədi" },
                  { v: "PSYCHOLOGIST",  label: "Psixoloq",  sub: "Psixoloq gəlmədi" },
                ].map(o => (
                  <button key={o.v} type="button" onClick={() => setBlameSide(o.v as typeof blameSide)}
                    style={{
                      padding: 10, borderRadius: 10, fontSize: 12.5, fontWeight: 600,
                      border: blameSide === o.v ? "2px solid var(--brand)" : "1px solid #E5E7EB",
                      background: blameSide === o.v ? "var(--brand-50)" : "#fff",
                      color: blameSide === o.v ? "var(--brand-700)" : "#1A2535",
                      cursor: "pointer", textAlign: "left",
                    }}>
                    <div style={{ fontWeight: 700 }}>{o.label}</div>
                    <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 2 }}>{o.sub}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
            Operator qeydi (məcburi deyil)
          </label>
          <textarea
            rows={3} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Mübahisənin necə həll edildiyini qısa qeyd edin"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12 }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Bağla
            </button>
            <button onClick={submit} disabled={saving}
              style={{
                padding: "8px 18px", border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                background: decision === "COMPLETE" ? "#10B981" : "#DC2626",
                color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
              }}>
              {saving ? "Göndərilir…" : decision === "COMPLETE" ? "Tamamlanmış say" : "Ləğv et"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
