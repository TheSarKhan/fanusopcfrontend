"use client";

/**
 * OP-1: Triyaj siyahısı — "inbox" görünüşü. Sətirə klik müraciətin detal
 * səhifəsini açır (/operator/appointments/[id]); köhnə modal axınları detal
 * səhifəsinə köçüb. Burada yalnız toplu əməliyyat (bulk-assign) qalıb.
 * OP-2: claim çipləri ("● Aysel işləyir") + "Mənim üzərimdə" filtri, real-time.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  operatorApi,
  type AppointmentDetail,
  type Psychologist,
} from "@/lib/api";
import OnBehalfBookingModal from "@/components/OnBehalfBookingModal";
import { getStoredUser } from "@/lib/auth";
import { subscribeNotifications, subscribeOperatorClaims } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azLocalToISO, azFormatDateTime } from "@/lib/datetime";
import { statusMeta } from "@/lib/appointmentStatus";
import { SkeletonGrid } from "@/components/Skeleton";
import EmptyState, { CalendarGlyph } from "@/components/EmptyState";

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
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  // GAP-01: dashboard "Gecikmiş" badge deep-links here with ?filter=overdue
  const [overdueOnly, setOverdueOnly] = useState(() => searchParams.get("filter") === "overdue");
  // OP-2: "Mənim üzərimdə" filtri
  const [mineOnly, setMineOnly] = useState(false);
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

  // OP-2: claim hadisələri çipləri canlı yeniləyir (səhifə reload-suz)
  useEffect(() => {
    return subscribeOperatorClaims((ev) => {
      setItems(prev => prev.map(a => a.id === ev.appointmentId
        ? {
            ...a,
            claimedByUserId: ev.claimedByUserId ?? null,
            claimedByName: ev.claimedByName ?? null,
            claimedAt: ev.claimedAt ?? null,
          }
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(a => {
      if (mineOnly && a.claimedByUserId !== meId) return false;
      if (overdueOnly) {
        if (!isOverdue(a)) return false;
      } else if (!mineOnly) {
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
  }, [items, tab, search, overdueOnly, mineOnly, meId, slaHours]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { PENDING: 0, CONFIRMED: 0, DISPUTED: 0, COMPLETED: 0, CANCELLED: 0, CANCEL_REQUESTED: 0 };
    for (const a of items) {
      if (a.status === "PENDING" || a.status === "REJECTED") c.PENDING++;
      else if (a.status === "AWAITING_CONFIRMATION" || a.status === "ASSIGNED") c.CONFIRMED++;
      else if (c[a.status] !== undefined) c[a.status]++;
    }
    return c;
  }, [items]);

  const mineCount = useMemo(
    () => items.filter(a => a.claimedByUserId != null && a.claimedByUserId === meId).length,
    [items, meId]);

  // OP-1: sətirə klik → detal səhifəsi. Filtrlənmiş növbə sessionStorage ilə
  // daşınır ki, detal səhifəsindəki J/K naviqasiyası filtr kontekstinə hörmət etsin.
  const openDetail = useCallback((a: AppointmentDetail) => {
    try {
      sessionStorage.setItem(QUEUE_KEY, JSON.stringify({ ids: filtered.map(x => x.id), ts: Date.now() }));
    } catch { /* ignore */ }
    const params = new URLSearchParams();
    if (!overdueOnly && !mineOnly) params.set("queue", tab);
    if (search.trim()) params.set("q", search.trim());
    if (overdueOnly) params.set("filter", "overdue");
    const qs = params.toString();
    router.push(`/operator/appointments/${a.id}${qs ? `?${qs}` : ""}`);
  }, [filtered, overdueOnly, mineOnly, tab, search, router]);

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

  return (
    <div>
      {onBehalfOpen && (
        <OnBehalfBookingModal
          onClose={() => setOnBehalfOpen(false)}
          onDone={() => { setOnBehalfOpen(false); load(); }}
        />
      )}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]">{t("staff.opApptTitle")}</h1>
          <p className="text-[#52718F] text-sm mt-1">{t("staff.opDashSub")}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setOnBehalfOpen(true)}
            style={{ padding: "8px 16px", border: "none", borderRadius: 12, background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            + Pasiyent adına randevu
          </button>
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
            Toplu təyin et
          </button>
        </div>
      )}

      <div className="op-tab-row flex gap-2 mb-4 flex-wrap">
        {(Object.keys(TAB_META) as Tab[]).map(tk => {
          const meta = TAB_META[tk];
          const active = !overdueOnly && !mineOnly && tab === tk;
          return (
            <button
              key={tk}
              onClick={() => { setOverdueOnly(false); setMineOnly(false); setTab(tk); }}
              style={{
                padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: active ? `2px solid ${meta.color}` : "1px solid #E5E7EB",
                background: active ? "#fff" : "rgba(255,255,255,0.6)",
                color: active ? meta.color : "#52718F",
                cursor: "pointer",
              }}
            >
              {meta.label}
              <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>{counts[tk] ?? 0}</span>
            </button>
          );
        })}
        <button
          onClick={() => { setMineOnly(false); setOverdueOnly(o => !o); }}
          style={{
            padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: overdueOnly ? "2px solid #DC2626" : "1px solid #FECACA",
            background: overdueOnly ? "#fff" : "rgba(254,242,242,0.8)",
            color: "#DC2626",
            cursor: "pointer",
          }}
        >
          Gecikmiş
          <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>
            {items.filter(isOverdue).length}
          </span>
        </button>
        {/* OP-2: yalnız mənim claim etdiklərim */}
        <button
          onClick={() => { setOverdueOnly(false); setMineOnly(m => !m); }}
          style={{
            padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: mineOnly ? "2px solid var(--brand)" : "1px solid #C7D2FE",
            background: mineOnly ? "#fff" : "rgba(238,242,255,0.8)",
            color: "var(--brand-700)",
            cursor: "pointer",
          }}
        >
          ◉ {t("staff.opMineFilter")}
          <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>{mineCount}</span>
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
        <SkeletonGrid count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<CalendarGlyph />} title="Bu kateqoriyada müraciət yoxdur"
          sub="Filtri dəyişin və ya yeni müraciət gözləyin." />
      ) : (
        <div className="op-appt-grid">
          {filtered.map(a => (
            <AppointmentCard
              key={a.id}
              a={a}
              meId={meId}
              selectable={selectMode}
              selected={selected.has(a.id)}
              onToggleSelect={() => toggleSelected(a.id)}
              onOpen={() => openDetail(a)} />
          ))}
        </div>
      )}

      {bulkOpen && (
        <BulkAssignModal
          ids={Array.from(selected)}
          onClose={() => setBulkOpen(false)}
          onDone={onBulkDone}
        />
      )}
    </div>
  );
}

function AppointmentCard({
  a, meId, selectable, selected, onToggleSelect, onOpen,
}: {
  a: AppointmentDetail;
  meId: number | null;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onOpen: () => void;
}) {
  const { t } = useT();
  const status = a.status;
  const isCancelReq = status === "CANCEL_REQUESTED";
  const phone = normalizePhone(a.patientPhone);
  const meta = statusMeta(status);
  const lastOutcomeMeta = a.lastContactOutcome ? OUTCOME_LABEL[a.lastContactOutcome] : null;
  // OP-2: claim çipi — tək operatorlu rejimdə sadəcə görünmür
  const claimMine = a.claimedByUserId != null && a.claimedByUserId === meId;
  const claimOther = a.claimedByUserId != null && !claimMine;

  const handleCardClick = () => {
    if (selectable) { onToggleSelect?.(); return; }
    onOpen();
  };

  return (
    <div className={`op-appt${selected ? " op-appt--selected" : ""}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter") handleCardClick(); }}
      style={{ cursor: "pointer" }}>

      <div className="op-appt__chips">
        {selectable && (
          <input type="checkbox" checked={!!selected} onChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
            className="op-appt__check" />
        )}
        <span className="op-appt__id">#FNS-{String(a.id).padStart(4, "0")}</span>
        <span className="op-appt__status" style={{ background: meta.bg, color: meta.fg }}>
          {meta.label}
        </span>
        {claimMine && (
          <span className="op-claim-chip op-claim-chip--mine">
            <span className="op-claim-dot" />{t("staff.opClaimMine")}
          </span>
        )}
        {claimOther && a.claimedByName && (
          <span className="op-claim-chip">
            <span className="op-claim-dot" />{t("staff.opClaimWorking", { name: a.claimedByName })}
          </span>
        )}
        {a.seriesId != null && a.seriesIndex != null && a.seriesTotal != null && (
          <span className="op-appt__series">
            {t("series.badge", { index: (a.seriesIndex ?? 0) + 1, total: a.seriesTotal })}
          </span>
        )}
      </div>

      <div className="op-appt__name">{a.patientName ?? "—"}</div>
      <div className="op-appt__time">{timeAgo(a.createdAt) || `${fmtDateTime(a.createdAt)} yaradılıb`}</div>

      {(phone || a.patientEmail) && (
        <div className="op-appt__contact" onClick={e => e.stopPropagation()}>
          {phone && (
            <>
              <a href={`tel:${phone}`} className="op-contact-btn op-contact-btn--call" title={`Zəng et: ${a.patientPhone}`}>
                <IconPhone /> Zəng
              </a>
              <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer"
                className="op-contact-btn op-contact-btn--wa" title={`WhatsApp: ${a.patientPhone}`}>
                <IconWhatsApp /> WhatsApp
              </a>
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

      <div className="op-appt__actions">
        <button onClick={e => { e.stopPropagation(); onOpen(); }} className="op-appt__btn op-appt__btn--primary">
          {t("staff.opOpenTicket")}
        </button>
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

/* ─── Toplu təyinat (siyahıda qalan yeganə modal) ─────────────────────────── */

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
