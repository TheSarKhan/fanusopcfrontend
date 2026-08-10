"use client";

// ============================================================================
// Psixoloq seans tarixçəsi — tamamlanmış / ləğv edilmiş / rədd edilmiş
// seansların tam siyahısı, ardıcıl kart grid-i. Əsas randevu səhifəsindəki
// "Tarixçə" düyməsindən açılır. Buradan seans qeydi yazmaq, yaxın keçmişdəki
// seansı "baş tutmadı" kimi bildirmək və Pasiyent 360° səhifəsinə keçmək olur.
// ============================================================================

import Link from "next/link";
import { useEffect, useState } from "react";
import { psychologistApi, type AppointmentDetail } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  pad2, fmtTime, avatarColor, initialsOf, NO_SHOW_REPORT_WINDOW_MS,
  PSY_APPT_STYLE, IMsg, IAlert, IUser, ISearch,
  StatusText, SessionMeta, RowMenu, type MenuItem, DisputeModal, OutcomeModal,
} from "../shared";

// Ləğv/rədd səbəb kodları — dəyərlər t() ilə render zamanı tərcümə olunur,
// açarlar (kodlar) backend enum-u ilə uyğunlaşdığı üçün dəyişməz qalır.
const CANCEL_REASON_KEY: Record<string, MessageKey> = {
  PATIENT_BUSY: "psyApptExtra.reasonPatientBusy",
  PATIENT_HEALTH: "psyApptExtra.reasonPatientHealth",
  PATIENT_FORGOT: "psyApptExtra.reasonPatientForgot",
  PATIENT_NOT_NEEDED: "psyApptExtra.reasonPatientNotNeeded",
  PATIENT_TECHNICAL: "psyApptExtra.reasonTechnical",
  PATIENT_TIME_CONFLICT: "psyApptExtra.reasonPatientTimeConflict",
  PATIENT_OTHER: "psyApptExtra.reasonOther",
  PSY_HEALTH: "psyApptExtra.reasonPsyHealth",
  PSY_EMERGENCY: "psyApptExtra.reasonPsyEmergency",
  PSY_TECHNICAL: "psyApptExtra.reasonTechnical",
  PSY_INCOMPATIBLE: "psyApptExtra.reasonPsyIncompatible",
  PSY_OTHER: "psyApptExtra.reasonOther",
  OPERATOR_PATIENT_REQUEST: "psyApptExtra.reasonOperatorPatientRequest",
  OPERATOR_PSY_UNAVAILABLE: "psyApptExtra.reasonOperatorPsyUnavailable",
  OPERATOR_DISPUTE_RESOLUTION: "psyApptExtra.reasonOperatorDisputeResolution",
  OPERATOR_NO_SHOW_BOTH: "psyApptExtra.reasonOperatorNoShowBoth",
  OPERATOR_PATIENT_BLOCKED: "psyApptExtra.reasonOperatorPatientBlocked",
  OPERATOR_OTHER: "psyApptExtra.reasonOther",
};

const PAGE_SIZE = 30;

type StatusFilter = "ALL" | "COMPLETED" | "CANCELLED" | "REJECTED";
// Sıralama sabitdir; mətn t() ilə render zamanı tərcümə olunur (COMPLETED/
// CANCELLED/REJECTED status mətnləri ilə eyni açarları bölüşür).
const STATUS_FILTERS: { key: StatusFilter; labelKey: MessageKey }[] = [
  { key: "ALL", labelKey: "psyApptExtra.filterAll" },
  { key: "COMPLETED", labelKey: "psyApptExtra.statusCompleted" },
  { key: "CANCELLED", labelKey: "psyApptExtra.statusCancelled" },
  { key: "REJECTED", labelKey: "psyApptExtra.statusRejected" },
];

export default function PsychologistAppointmentHistoryPage() {
  const { t } = useT();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [outcomeFor, setOutcomeFor] = useState<AppointmentDetail | null>(null);
  const [disputeFor, setDisputeFor] = useState<AppointmentDetail | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [now] = useState(() => new Date());

  // Axtarış yazılışını 300ms gecikdiririk ki, hər hərfə sorğu getməsin.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Filtr/axtarış dəyişəndə birinci səhifədən yenidən yüklə.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    psychologistApi.myAppointmentsPaged({
      scope: statusFilter === "ALL" ? "history" : statusFilter,
      q: debouncedQuery || undefined,
      page: 0,
      size: PAGE_SIZE,
    })
      .then(res => {
        if (cancelled) return;
        setItems(res.content);
        setTotalElements(res.totalElements);
        setPage(0);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, statusFilter]);

  const loadMore = () => {
    setLoadingMore(true);
    psychologistApi.myAppointmentsPaged({
      scope: statusFilter === "ALL" ? "history" : statusFilter,
      q: debouncedQuery || undefined,
      page: page + 1,
      size: PAGE_SIZE,
    })
      .then(res => {
        setItems(prev => [...prev, ...res.content]);
        setTotalElements(res.totalElements);
        setPage(res.page);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const visible = items;
  const hasMore = items.length < totalElements;

  return (
    <div className="psy-appt-page">
      <style>{PSY_APPT_STYLE}</style>
      <header style={{ marginBottom: 22 }}>
        <Link href="/psycholog/appointments" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none", marginBottom: 10 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          {t("psyApptExtra.backToAppointments")}
        </Link>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", color: "var(--oxford)" }}>{t("psyApptExtra.historyTitle")}</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>
          {t("psyApptExtra.historySub")}
        </p>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--oxford-60)", display: "inline-flex" }}>
            <ISearch />
          </span>
          <input
            type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder={t("psyApptExtra.searchPlaceholder")}
            style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13.5, fontFamily: "inherit", boxSizing: "border-box", background: "#fff" }} />
        </div>
        <div role="tablist" className="gor-tabs" style={{ display: "inline-flex", maxWidth: "100%", overflowX: "auto", gap: 4, background: "#fff", border: "1px solid #EDF1F8", borderRadius: 12, padding: 5, boxShadow: "0 2px 12px rgba(0,0,0,.04)" }}>
          {STATUS_FILTERS.map(({ key, labelKey }) => {
            const active = statusFilter === key;
            return (
              <button key={key} type="button" role="tab" aria-selected={active} onClick={() => setStatusFilter(key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: active ? "var(--brand)" : "transparent", color: active ? "#fff" : "var(--oxford)", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", flex: "none" }}>
                {t(labelKey)}
                {active && !loading && (
                  <span style={{ background: "rgba(255,255,255,.22)", color: "#fff", fontSize: 11, fontWeight: 700, minWidth: 19, height: 19, padding: "0 5px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{totalElements}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>
          {t("psyApptExtra.loading")}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: 40, textAlign: "center", fontSize: 14, color: "var(--oxford-60)", fontWeight: 600 }}>
          {debouncedQuery || statusFilter !== "ALL" ? t("psyApptExtra.emptySearch") : t("psyApptExtra.emptyNone")}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))", gap: 12, marginBottom: 20 }}>
            {visible.map(a => (
              <HistoryCard
                key={a.id}
                a={a}
                now={now}
                onOutcome={() => setOutcomeFor(a)}
                onDispute={() => setDisputeFor(a)}
              />
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <button type="button" onClick={loadMore} disabled={loadingMore}
                style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
                {loadingMore ? t("psyApptExtra.loading") : t("psyApptExtra.loadMore", { count: Math.min(PAGE_SIZE, totalElements - visible.length) })}
              </button>
            </div>
          )}
        </>
      )}

      {outcomeFor && (
        <OutcomeModal
          appointment={outcomeFor}
          onClose={() => setOutcomeFor(null)}
          onSaved={() => setOutcomeFor(null)}
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
    </div>
  );
}

/* ─── Tarixçə kartı ──────────────────────────────────────────────────────── */

function HistoryCard({
  a, now, onOutcome, onDispute,
}: {
  a: AppointmentDetail;
  now: Date;
  onOutcome: () => void;
  onDispute: () => void;
}) {
  const { t } = useT();
  const ref = a.startAt ?? a.endAt;
  if (!ref) return null;
  const d = new Date(ref);
  const av = avatarColor(a.patientId ?? a.patientName);
  // Avtomatik tamamlanmış seansı bu pəncərə ərzində "baş tutmadı" kimi bildirmək olar.
  const endMs = a.endAt ? new Date(a.endAt).getTime() : null;
  const reportableNoShow = a.status === "COMPLETED" && endMs != null
    && now.getTime() - endMs < NO_SHOW_REPORT_WINDOW_MS;
  const cancelReasonKey = a.cancelReasonCode ? CANCEL_REASON_KEY[a.cancelReasonCode] : null;
  const cancelReason = cancelReasonKey ? t(cancelReasonKey) : a.cancelReasonCode ?? null;

  const menu: MenuItem[] = [];
  if (reportableNoShow) menu.push({ label: t("psyApptExtra.noShowAction"), onClick: onDispute, icon: <IAlert s={15} c="#5C6B85" /> });
  if (a.patientId) menu.push({ label: t("psyApptExtra.patient360"), href: `/psycholog/clients/${a.patientId}`, icon: <IUser /> });

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "14px 16px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div className="psy-card__avatar" style={{ width: 46, height: 46, background: av, color: "#fff", border: "none" }}>
          {initialsOf(a.patientName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="psy-card__name">{a.patientName ?? t("psyApptExtra.patientFallback")}</div>
          <div className="psy-card__nth">{pad2(d.getDate())}.{pad2(d.getMonth() + 1)}.{d.getFullYear()}, {fmtTime(d)}</div>
        </div>
        {menu.length > 0 && <RowMenu items={menu} />}
      </div>

      <div style={{ marginTop: 12 }}>
        <StatusText status={a.status} />
        <SessionMeta a={a} />
      </div>

      {cancelReason && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span>{t("psyApptExtra.reasonPrefix")} <span style={{ color: "var(--oxford)" }}>{cancelReason}</span></span>
          {a.cancelledBy && <span style={{ color: "var(--oxford-60)" }}>{a.cancelledBy === "PATIENT" ? t("psyApptExtra.cancelledByPatient") : a.cancelledBy === "PSYCHOLOGIST" ? t("psyApptExtra.cancelledByPsy") : t("psyApptExtra.cancelledByOperator")}</span>}
        </div>
      )}
      {a.status === "COMPLETED" && a.note && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--oxford-60)", fontStyle: "italic", lineHeight: 1.4 }}>
          «{a.note}»
        </div>
      )}

      {a.status === "COMPLETED" && (
        <div style={{ marginTop: "auto", paddingTop: 14 }}>
          <button type="button" onClick={onOutcome}
            style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 14px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
            <IMsg c="var(--brand)" />
            {t("psyApptExtra.sessionNoteBtn")}
          </button>
        </div>
      )}
    </div>
  );
}
