"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { operatorApi, type ReviewDeletionRequestItem } from "@/lib/api";
import { toast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";

/**
 * Tələblər modulu (Operator BRD §10) — seans/paketdən kənar inzibati tələblər.
 * Hazırda tək tələb növü: Rəy Silmə Tələbi (psixoloqdan gəlir, qərar operatorda).
 * Əlavə: operator hesabat exportu (Excel/PDF) — OP-FR-14/15.
 */

type Tab = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

const TAB_LABEL: Record<Tab, string> = {
  PENDING: "Gözləmədə",
  APPROVED: "Təsdiqlənib",
  REJECTED: "Rədd edilib",
  ALL: "Hamısı",
};

const STATUS_PILL: Record<Exclude<Tab, "ALL">, { cls: string; label: string }> = {
  PENDING: { cls: "fx-pill--pending", label: "Gözləmədə" },
  APPROVED: { cls: "fx-pill--paid", label: "Təsdiqlənib" },
  REJECTED: { cls: "fx-pill--refunded", label: "Rədd edilib" },
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("az-AZ");
}

function IconCheck() {
  return (
    <svg className="fx-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function IconX() {
  return (
    <svg className="fx-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18" /><path d="M6 6l12 12" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg className="fx-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
    </svg>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="fx-stars">
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} viewBox="0 0 24 24" className={n <= value ? undefined : "fx-star--off"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export default function OperatorRequestsPage() {
  const PAGE_SIZE = 30;
  const [items, setItems] = useState<ReviewDeletionRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [tab, setTab] = useState<Tab>("PENDING");
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  // Qərar modalı — prompt() əvəzinə: opsional qeyd üçün textarea.
  const [decision, setDecision] = useState<{ id: number; action: "approve" | "reject" } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");

  // Server səhifələməsi: aktiv tabın statusu sorğuya ötürülür, tab dəyişəndə sıfırlanır.
  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    operatorApi.listReviewDeletionRequestsPaged({ status: tab === "ALL" ? undefined : tab, page: 0, size: PAGE_SIZE })
      .then(res => {
        setItems(res.content);
        setTotalElements(res.totalElements);
        setPage(0);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const loadMore = () => {
    setLoadingMore(true);
    operatorApi.listReviewDeletionRequestsPaged({ status: tab === "ALL" ? undefined : tab, page: page + 1, size: PAGE_SIZE })
      .then(res => {
        setItems(prev => [...prev, ...res.content]);
        setTotalElements(res.totalElements);
        setPage(res.page);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  // Qərar veriləndən sonra status dəyişir — köhnə davranış kimi uyğun olmayan
  // sətir aktiv tabdan çıxsın deyə status filtri yığılmış siyahıya da tətbiq olunur.
  const visible = useMemo(
    () => tab === "ALL" ? items : items.filter(r => r.status === tab),
    [items, tab]
  );

  const hasMore = items.length < totalElements;

  const openDecision = (id: number, action: "approve" | "reject") => {
    setDecisionNote("");
    setDecision({ id, action });
  };

  const submitDecision = async () => {
    if (!decision) return;
    const { id, action } = decision;
    const note = decisionNote.trim() || undefined;
    setBusyId(id);
    try {
      const updated = action === "approve"
        ? await operatorApi.approveReviewDeletion(id, note)
        : await operatorApi.rejectReviewDeletion(id, note);
      setItems(prev => prev.map(r => r.id === id ? updated : r));
      toast(action === "approve" ? "Rəy silindi" : "Tələb rədd edildi", "success");
      setDecision(null);
    } catch (e) {
      toast((e as Error).message || "Əməliyyat alınmadı", "error");
    } finally {
      setBusyId(null);
    }
  };

  const exportReport = async (format: "xlsx" | "pdf") => {
    setExporting(format);
    try {
      await operatorApi.downloadReport(format, reportFrom || undefined, reportTo || undefined);
      toast("Hesabat yükləndi", "success");
    } catch (e) {
      toast((e as Error).message || "Hesabat yüklənmədi", "error");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="fx-page" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="fx-h1">Tələblər</h1>
        <p className="fx-subtitle" style={{ margin: "4px 0 0" }}>
          Psixoloqlardan gələn Rəy Silmə Tələbləri. Təsdiq etdikdə rəy ictimai profildən qaldırılır.
        </p>
      </div>

      {/* Hesabat exportu */}
      <div className="fx-card fx-card__pad" style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="fx-card-title" style={{ marginBottom: 8 }}>Fəaliyyət hesabatım</div>
          <div className="fx-flex">
            <label className="fx-field" style={{ gap: 4 }}>
              <span className="fx-label">Başlanğıc</span>
              <input type="date" className="fx-input" value={reportFrom} onChange={e => setReportFrom(e.target.value)}
                style={{ width: "auto" }} />
            </label>
            <label className="fx-field" style={{ gap: 4 }}>
              <span className="fx-label">Son</span>
              <input type="date" className="fx-input" value={reportTo} onChange={e => setReportTo(e.target.value)}
                style={{ width: "auto" }} />
            </label>
          </div>
        </div>
        <div className="fx-flex">
          <button type="button" className="fx-btn fx-btn--ghost" onClick={() => exportReport("xlsx")} disabled={exporting !== null}
            style={{ opacity: exporting === "pdf" ? 0.6 : 1, cursor: exporting ? "wait" : "pointer" }}>
            <IconDownload />
            {exporting === "xlsx" ? "Hazırlanır…" : "Excel yüklə"}
          </button>
          <button type="button" className="fx-btn fx-btn--ghost" onClick={() => exportReport("pdf")} disabled={exporting !== null}
            style={{ opacity: exporting === "xlsx" ? 0.6 : 1, cursor: exporting ? "wait" : "pointer" }}>
            <IconDownload />
            {exporting === "pdf" ? "Hazırlanır…" : "PDF yüklə"}
          </button>
        </div>
        <p className="fx-muted" style={{ margin: 0, fontSize: "var(--text-caption)", flexBasis: "100%" }}>
          Hesabat yalnız sizə aid məlumatları əhatə edir: götürdüyünüz seanslar, təsdiqlədiyiniz ödənişlər, cəmi qazanc.
          Tarix seçilməzsə cari ay götürülür.
        </p>
      </div>

      {/* Tabs — say yalnız aktiv tabda göstərilir (server cəmi) */}
      <div className="fx-tabs" style={{ marginBottom: 16, borderBottom: "1px solid var(--hairline)" }}>
        {(Object.keys(TAB_LABEL) as Tab[]).map(t => {
          const active = tab === t;
          return (
            <button key={t} type="button" className={`fx-tab${active ? " fx-tab--active" : ""}`} onClick={() => setTab(t)}>
              {TAB_LABEL[t]}
              {active && !loading && totalElements > 0 && (
                <span className="fx-pill fx-pill--count-active">{totalElements}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="fx-stack">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="fx-card fx-card__pad">
              <Skeleton width={180} height={14} />
              <Skeleton width="100%" height={54} radius={8} style={{ marginTop: 12 }} />
              <Skeleton width={220} height={32} radius={8} style={{ marginTop: 12 }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Tələblər yüklənmədi"
          sub="Bağlantı və ya server problemi ola bilər. Yenidən cəhd edin."
          onRetry={load}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 15l2 2 4-4" />
            </svg>
          }
          title="Tələb yoxdur"
          sub={tab === "PENDING" ? "Gözləyən rəy silmə tələbi yoxdur. Psixoloq tələb göndərdikdə burada görünəcək." : "Bu kateqoriyada tələb yoxdur."}
        />
      ) : (
        <div className="fx-stack">
          {visible.map(r => {
            const badge = STATUS_PILL[r.status];
            const busy = busyId === r.id;
            return (
              <div key={r.id} className="fx-card fx-card__pad">
                <div className="fx-flex" style={{ marginBottom: 10, flexWrap: "wrap" }}>
                  <span className="fx-row__title">{r.psychologistName}</span>
                  <span className={`fx-pill ${badge.cls}`}>{badge.label}</span>
                  <span className="fx-muted fx-num" style={{ fontSize: "var(--text-caption)", marginLeft: "auto" }}>
                    #{r.id} · {fmt(r.createdAt)}
                  </span>
                </div>

                {/* Silinməsi istənilən rəy */}
                <div style={{
                  background: "var(--surface-muted)", border: "1px solid var(--hairline)",
                  borderRadius: 8, padding: "12px 14px", marginBottom: 10,
                }}>
                  <div className="fx-flex" style={{ marginBottom: 6 }}>
                    <Stars value={r.reviewRating} />
                    {r.patientName && (
                      <span className="fx-muted" style={{ fontSize: "var(--text-caption)" }}>
                        Müəllif: {r.patientName} (daxili — ictimai göstərilmir)
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "var(--text-body)", color: "var(--oxford-80)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {r.reviewComment}
                  </p>
                </div>

                <div style={{ fontSize: "var(--text-body)", color: "var(--oxford-80)", marginBottom: 10 }}>
                  <span className="fx-muted" style={{ fontWeight: 600 }}>Psixoloqun səbəbi: </span>
                  {r.reason}
                </div>

                {r.status === "PENDING" ? (
                  <div className="fx-flex">
                    <button type="button" className="fx-btn fx-btn--primary fx-btn--sm" onClick={() => openDecision(r.id, "approve")} disabled={busy}
                      style={{ cursor: busy ? "wait" : "pointer" }}>
                      <IconCheck />
                      Təsdiqlə (rəyi sil)
                    </button>
                    <button type="button" className="fx-btn fx-btn--danger-ghost fx-btn--sm" onClick={() => openDecision(r.id, "reject")} disabled={busy}
                      style={{ cursor: busy ? "wait" : "pointer" }}>
                      <IconX />
                      Rədd et (rəy qalır)
                    </button>
                  </div>
                ) : (
                  <div className="fx-muted" style={{ fontSize: "var(--text-caption)" }}>
                    Qərar: {fmt(r.decidedAt)}{r.decisionNote ? ` · ${r.decisionNote}` : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button type="button" className="fx-btn fx-btn--ghost" onClick={loadMore} disabled={loadingMore}
            style={{ cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
            {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - items.length)})`}
          </button>
        </div>
      )}

      {decision && (
        <div className="fx-overlay fx-overlay--center" onClick={() => busyId == null && setDecision(null)}>
          <div className="fx-modal" role="dialog" aria-modal="true" aria-label={decision.action === "approve" ? "Rəyi sil" : "Tələbi rədd et"} onClick={e => e.stopPropagation()}>
            <div className={`fx-modal__icon fx-modal__icon--${decision.action === "approve" ? "brand" : "rose"}`}>
              {decision.action === "approve" ? (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              )}
            </div>
            <h3 className="fx-h3">
              {decision.action === "approve" ? "Rəyi sil" : "Tələbi rədd et"}
            </h3>
            <p className="fx-modal__text">
              {decision.action === "approve"
                ? "Təsdiqlədikdə rəy ictimai profildən silinəcək. İstəsəniz qeyd əlavə edin."
                : "Rədd etdikdə rəy dəyişmədən qalacaq. İstəsəniz səbəb yazın."}
            </p>
            <div className="fx-field">
              <label className="fx-label" htmlFor="decision-note">
                Qeyd (opsional)
              </label>
              <textarea
                id="decision-note"
                className="fx-textarea"
                value={decisionNote}
                onChange={e => setDecisionNote(e.target.value)}
                rows={3}
                autoFocus
                placeholder={decision.action === "approve" ? "Məs. qaydalara zidd məzmun" : "Məs. rəy əsaslıdır, silinmir"}
              />
            </div>
            <div className="fx-modal__actions">
              <button type="button" className="fx-btn fx-btn--ghost" onClick={() => setDecision(null)} disabled={busyId != null}>
                Ləğv
              </button>
              <button
                type="button"
                className={`fx-btn ${decision.action === "approve" ? "fx-btn--primary" : "fx-btn--danger"}`}
                onClick={submitDecision}
                disabled={busyId != null}
              >
                {busyId != null ? "Göndərilir…" : decision.action === "approve" ? "Təsdiqlə və sil" : "Rədd et"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
