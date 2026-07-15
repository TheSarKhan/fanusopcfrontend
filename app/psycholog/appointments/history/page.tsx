"use client";

// ============================================================================
// Psixoloq seans tarixçəsi — tamamlanmış / ləğv edilmiş / rədd edilmiş
// seansların tam siyahısı, ardıcıl kart grid-i. Əsas randevu səhifəsindəki
// "Tarixçə" düyməsindən açılır. Buradan seans qeydi yazmaq, yaxın keçmişdəki
// seansı "baş tutmadı" kimi bildirmək və Müştəri 360° səhifəsinə keçmək olur.
// ============================================================================

import Link from "next/link";
import { useEffect, useState } from "react";
import { psychologistApi, type AppointmentDetail } from "@/lib/api";
import {
  pad2, fmtTime, avatarColor, initialsOf, STATUS, NO_SHOW_REPORT_WINDOW_MS,
  PSY_APPT_STYLE, IMsg, IAlert, IUser, ISearch,
  PackageBadge, IntroBadge, RowMenu, type MenuItem, DisputeModal, OutcomeModal,
} from "../shared";

const CANCEL_REASON_LABEL: Record<string, string> = {
  PATIENT_BUSY: "Məşğul oldu",
  PATIENT_HEALTH: "Xəstələndi",
  PATIENT_FORGOT: "Unutdu",
  PATIENT_NOT_NEEDED: "Lazım deyildi",
  PATIENT_TECHNICAL: "Texniki problem",
  PATIENT_TIME_CONFLICT: "Vaxt uyğun deyildi",
  PATIENT_OTHER: "Digər",
  PSY_HEALTH: "Psixoloq xəstələndi",
  PSY_EMERGENCY: "Psixoloq təcili",
  PSY_TECHNICAL: "Texniki problem",
  PSY_INCOMPATIBLE: "Profil uyğun deyildi",
  PSY_OTHER: "Digər",
  OPERATOR_PATIENT_REQUEST: "Pasient telefonla bildirdi",
  OPERATOR_PSY_UNAVAILABLE: "Psixoloq mövcud deyildi",
  OPERATOR_DISPUTE_RESOLUTION: "Mübahisə həlli",
  OPERATOR_NO_SHOW_BOTH: "İkisi də gəlmədi",
  OPERATOR_PATIENT_BLOCKED: "Pasient bloklandı",
  OPERATOR_OTHER: "Digər",
};

const PAGE_SIZE = 30;

type StatusFilter = "ALL" | "COMPLETED" | "CANCELLED" | "REJECTED";
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "Hamısı" },
  { key: "COMPLETED", label: "Tamamlandı" },
  { key: "CANCELLED", label: "Ləğv" },
  { key: "REJECTED", label: "Rədd" },
];

export default function PsychologistAppointmentHistoryPage() {
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
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
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
    <div className="psy-appt-page" style={{ maxWidth: 1040, margin: "0 auto" }}>
      <style>{PSY_APPT_STYLE}</style>
      <header style={{ marginBottom: 22 }}>
        <Link href="/psycholog/appointments" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none", marginBottom: 10 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Randevulara qayıt
        </Link>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", color: "var(--oxford)" }}>Seans tarixçəsi</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>
          Keçmiş seanslarınız — seans qeydi yazmaq və problemli seansı bildirmək buradan mümkündür
        </p>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--oxford-60)", display: "inline-flex" }}>
            <ISearch />
          </span>
          <input
            type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Pasiyent adına görə axtar…"
            style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13.5, fontFamily: "inherit", boxSizing: "border-box", background: "#fff" }} />
        </div>
        <div role="tablist" className="gor-tabs" style={{ display: "inline-flex", maxWidth: "100%", overflowX: "auto", gap: 4, background: "#fff", border: "1px solid #EDF1F8", borderRadius: 12, padding: 5, boxShadow: "0 2px 12px rgba(0,0,0,.04)" }}>
          {STATUS_FILTERS.map(({ key, label }) => {
            const active = statusFilter === key;
            return (
              <button key={key} type="button" role="tab" aria-selected={active} onClick={() => setStatusFilter(key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: active ? "var(--brand)" : "transparent", color: active ? "#fff" : "var(--oxford)", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", flex: "none" }}>
                {label}
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
          Yüklənir…
        </div>
      ) : visible.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: 40, textAlign: "center", fontSize: 14, color: "var(--oxford-60)", fontWeight: 600 }}>
          {debouncedQuery || statusFilter !== "ALL" ? "Axtarışa uyğun seans tapılmadı" : "Hələ tamamlanmış seansınız yoxdur"}
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
                {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - visible.length)})`}
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
  const ref = a.startAt ?? a.endAt;
  if (!ref) return null;
  const d = new Date(ref);
  const status = STATUS[a.status] ?? STATUS.COMPLETED;
  const av = avatarColor(a.patientId ?? a.patientName);
  // Avtomatik tamamlanmış seansı bu pəncərə ərzində "baş tutmadı" kimi bildirmək olar.
  const endMs = a.endAt ? new Date(a.endAt).getTime() : null;
  const reportableNoShow = a.status === "COMPLETED" && endMs != null
    && now.getTime() - endMs < NO_SHOW_REPORT_WINDOW_MS;
  const cancelReason = a.cancelReasonCode ? (CANCEL_REASON_LABEL[a.cancelReasonCode] ?? a.cancelReasonCode) : null;

  const menu: MenuItem[] = [];
  if (reportableNoShow) menu.push({ label: "Baş tutmadı", onClick: onDispute, icon: <IAlert s={15} c="#5C6B85" /> });
  if (a.patientId) menu.push({ label: "Müştəri 360°", href: `/psycholog/clients/${a.patientId}`, icon: <IUser /> });

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "14px 16px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div className="psy-card__avatar" style={{ width: 46, height: 46, background: av, color: "#fff", border: "none" }}>
          {initialsOf(a.patientName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="psy-card__name">{a.patientName ?? "Pasiyent"}</div>
          <div className="psy-card__nth">{pad2(d.getDate())}.{pad2(d.getMonth() + 1)}.{d.getFullYear()} · {fmtTime(d)}</div>
        </div>
        {menu.length > 0 && <RowMenu items={menu} />}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        <span className="psy-card__badge" style={{ background: status.bg, color: status.color }}>{status.label}</span>
        {a.patientPackageId != null && <PackageBadge name={a.packageName} />}
        {a.sessionKind === "INTRO" && <IntroBadge />}
      </div>

      {cancelReason && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>
          Səbəb: <span style={{ color: "var(--oxford)" }}>{cancelReason}</span>
          {a.cancelledBy && <span style={{ color: "var(--oxford-60)" }}> · {a.cancelledBy === "PATIENT" ? "pasiyent" : a.cancelledBy === "PSYCHOLOGIST" ? "sizin tərəfdən" : "operator"}</span>}
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
            Seans qeydi
          </button>
        </div>
      )}
    </div>
  );
}
