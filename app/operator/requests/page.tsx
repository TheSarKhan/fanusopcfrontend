"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { operatorApi, type ReviewDeletionRequestItem } from "@/lib/api";

/**
 * Tələblər modulu (Operator BRD §10) — seans/paketdən kənar inzibati tələblər.
 * Hazırda tək tələb növü: Rəy Silmə Tələbi (psixoloqdan gəlir, qərar operatorda).
 * Əlavə: operator hesabat exportu (Excel/PDF) — OP-FR-14/15.
 */

type Tab = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

const TAB_META: Record<Tab, { label: string; color: string }> = {
  PENDING:  { label: "Gözləmədə",   color: "#B45309" },
  APPROVED: { label: "Təsdiqlənib", color: "#065F46" },
  REJECTED: { label: "Rədd edilib", color: "#991B1B" },
  ALL:      { label: "Hamısı",      color: "#0B1A35" },
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("az-AZ");
}

function Stars({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} width={13} height={13} viewBox="0 0 24 24" fill={n <= value ? "#C97D2E" : "#E4ECFA"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export default function OperatorRequestsPage() {
  const [items, setItems] = useState<ReviewDeletionRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("PENDING");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    operatorApi.listReviewDeletionRequests()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => tab === "ALL" ? items : items.filter(r => r.status === tab),
    [items, tab]
  );

  const countFor = (t: Tab) => t === "ALL" ? items.length : items.filter(r => r.status === t).length;

  const decide = async (id: number, action: "approve" | "reject") => {
    const note = prompt(action === "approve"
      ? "Təsdiq qeydi (opsional) — rəy sistemdən silinəcək:"
      : "Rədd səbəbi (opsional) — rəy dəyişmədən qalacaq:") ?? undefined;
    setBusyId(id);
    try {
      const updated = action === "approve"
        ? await operatorApi.approveReviewDeletion(id, note)
        : await operatorApi.rejectReviewDeletion(id, note);
      setItems(prev => prev.map(r => r.id === id ? updated : r));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const exportReport = async (format: "xlsx" | "pdf") => {
    setExporting(format);
    try {
      await operatorApi.downloadReport(format, reportFrom || undefined, reportTo || undefined);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0B1A35" }}>Tələblər</h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#52718F" }}>
          Psixoloqlardan gələn Rəy Silmə Tələbləri. Təsdiq etdikdə rəy ictimai profildən qaldırılır.
        </p>
      </div>

      {/* Hesabat exportu */}
      <div style={{
        background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12,
        padding: "16px 20px", marginBottom: 24,
        display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0B1A35", marginBottom: 8 }}>
            Fəaliyyət hesabatım
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, color: "#52718F" }}>
              Başlanğıc{" "}
              <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)}
                style={{ padding: "6px 8px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 12 }} />
            </label>
            <label style={{ fontSize: 12, color: "#52718F" }}>
              Son{" "}
              <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)}
                style={{ padding: "6px 8px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 12 }} />
            </label>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => exportReport("xlsx")} disabled={exporting !== null}
            style={{
              padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "#065F46", color: "#fff", border: "none",
              cursor: exporting ? "wait" : "pointer", opacity: exporting === "pdf" ? 0.6 : 1,
            }}>
            {exporting === "xlsx" ? "Hazırlanır…" : "Excel yüklə"}
          </button>
          <button onClick={() => exportReport("pdf")} disabled={exporting !== null}
            style={{
              padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "#991B1B", color: "#fff", border: "none",
              cursor: exporting ? "wait" : "pointer", opacity: exporting === "xlsx" ? 0.6 : 1,
            }}>
            {exporting === "pdf" ? "Hazırlanır…" : "PDF yüklə"}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "#8AAABF", flexBasis: "100%" }}>
          Hesabat yalnız sizə aid məlumatları əhatə edir: götürdüyünüz seanslar, təsdiqlədiyiniz ödənişlər, cəmi qazanc.
          Tarix seçilməzsə cari ay götürülür.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #E5E7EB" }}>
        {(Object.keys(TAB_META) as Tab[]).map(t => {
          const active = tab === t;
          const count = countFor(t);
          return (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: "8px 14px", border: "none", background: "none", cursor: "pointer",
                fontSize: 13, fontWeight: active ? 600 : 400,
                color: active ? TAB_META[t].color : "#6B7280",
                borderBottom: active ? `2px solid ${TAB_META[t].color}` : "2px solid transparent",
                marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
              }}>
              {TAB_META[t].label}
              {count > 0 && (
                <span style={{
                  background: active ? TAB_META[t].color : "#E5E7EB",
                  color: active ? "#fff" : "#374151",
                  borderRadius: 10, padding: "1px 6px", fontSize: 11, fontWeight: 600,
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p style={{ color: "#6B7280", fontSize: 14 }}>Yüklənir...</p>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#6B7280", fontSize: 14 }}>
          Bu kateqoriyada tələb yoxdur.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(r => {
            const badge = TAB_META[r.status as Tab] ?? TAB_META.ALL;
            const busy = busyId === r.id;
            return (
              <div key={r.id} style={{
                background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "18px 22px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#0B1A35" }}>
                    {r.psychologistName}
                  </span>
                  <span style={{
                    background: "#F3F4F6", color: badge.color,
                    borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700,
                  }}>{badge.label}</span>
                  <span style={{ fontSize: 12, color: "#9CA3AF", marginLeft: "auto" }}>
                    #{r.id} · {fmt(r.createdAt)}
                  </span>
                </div>

                {/* Silinməsi istənilən rəy */}
                <div style={{
                  background: "#F8FAFC", border: "1px solid #EEF2F7",
                  borderRadius: 8, padding: "12px 14px", marginBottom: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Stars value={r.reviewRating} />
                    {r.patientName && (
                      <span style={{ fontSize: 12, color: "#52718F" }}>
                        Müəllif: {r.patientName} (daxili — ictimai göstərilmir)
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {r.reviewComment}
                  </p>
                </div>

                <div style={{ fontSize: 13, color: "#374151", marginBottom: 10 }}>
                  <span style={{ color: "#6B7280", fontWeight: 600 }}>Psixoloqun səbəbi: </span>
                  {r.reason}
                </div>

                {r.status === "PENDING" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => decide(r.id, "approve")} disabled={busy}
                      style={{
                        padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        background: "#065F46", color: "#fff", border: "none",
                        cursor: busy ? "wait" : "pointer",
                      }}>
                      Təsdiqlə (rəyi sil)
                    </button>
                    <button onClick={() => decide(r.id, "reject")} disabled={busy}
                      style={{
                        padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        background: "#fff", color: "#991B1B", border: "1px solid #FECACA",
                        cursor: busy ? "wait" : "pointer",
                      }}>
                      Rədd et (rəy qalır)
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#52718F" }}>
                    Qərar: {fmt(r.decidedAt)}{r.decisionNote ? ` · ${r.decisionNote}` : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
