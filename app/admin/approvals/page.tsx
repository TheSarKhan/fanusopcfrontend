"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi, type RefundRequestItem, type PoolReleaseRequestItem } from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";

/**
 * Təsdiqlər — İadə Təsdiqi (Admin BRD §9) və Hovuz-Buraxma Təsdiqi (Admin BRD §8).
 * Bütün iadələr (tam/qismi) və status dəyişikliyi aparılmış müraciətlərin hovuza
 * qaytarılması yalnız buradan verilən qərarla icra olunur (ADM-BR-02, ADM-BR-03).
 */

type Section = "refunds" | "poolReleases";
type StatusTab = "PENDING" | "ALL";

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: "Gözləmədə",   cls: "gold" },
  APPROVED: { label: "Təsdiqlənib", cls: "sage" },
  REJECTED: { label: "Rədd edilib", cls: "rose" },
};

export default function AdminApprovalsPage() {
  const [section, setSection] = useState<Section>("refunds");
  const [statusTab, setStatusTab] = useState<StatusTab>("PENDING");
  const [refunds, setRefunds] = useState<RefundRequestItem[]>([]);
  const [releases, setReleases] = useState<PoolReleaseRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.listRefundRequests().catch(() => [] as RefundRequestItem[]),
      adminApi.listPoolReleaseRequests().catch(() => [] as PoolReleaseRequestItem[]),
    ]).then(([r, p]) => {
      setRefunds(r);
      setReleases(p);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const visibleRefunds = useMemo(
    () => statusTab === "ALL" ? refunds : refunds.filter(r => r.status === "PENDING"),
    [refunds, statusTab]
  );
  const visibleReleases = useMemo(
    () => statusTab === "ALL" ? releases : releases.filter(r => r.status === "PENDING"),
    [releases, statusTab]
  );

  const pendingRefunds = refunds.filter(r => r.status === "PENDING").length;
  const pendingReleases = releases.filter(r => r.status === "PENDING").length;

  const decideRefund = async (r: RefundRequestItem, action: "approve" | "reject") => {
    const note = window.prompt(action === "approve"
      ? `${r.amount} AZN iadə İCRA OLUNACAQ. Qeyd (opsional):`
      : "Rədd səbəbi (operatora bildiriş gedəcək):") ?? undefined;
    setBusyId(r.id);
    try {
      const updated = action === "approve"
        ? await adminApi.approveRefundRequest(r.id, note)
        : await adminApi.rejectRefundRequest(r.id, note);
      setRefunds(prev => prev.map(x => x.id === r.id ? updated : x));
    } catch (e) { alert((e as Error).message); }
    finally { setBusyId(null); }
  };

  const decideRelease = async (r: PoolReleaseRequestItem, action: "approve" | "reject") => {
    const note = window.prompt(action === "approve"
      ? `Müraciət #${r.appointmentId} hovuza QAYTARILACAQ. Qeyd (opsional):`
      : "Rədd səbəbi (operatora bildiriş gedəcək):") ?? undefined;
    setBusyId(r.id);
    try {
      const updated = action === "approve"
        ? await adminApi.approvePoolReleaseRequest(r.id, note)
        : await adminApi.rejectPoolReleaseRequest(r.id, note);
      setReleases(prev => prev.map(x => x.id === r.id ? updated : x));
    } catch (e) { alert((e as Error).message); }
    finally { setBusyId(null); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Təsdiqlər</h1>
          <p className="page-sub">
            Operatorlardan gələn iadə və hovuz-buraxma tələbləri — icra yalnız Admin qərarından sonra.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={load}>Yenilə</button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button
          className={`btn ${section === "refunds" ? "primary" : ""}`}
          onClick={() => setSection("refunds")}
        >
          İadə Təsdiqi {pendingRefunds > 0 && `(${pendingRefunds})`}
        </button>
        <button
          className={`btn ${section === "poolReleases" ? "primary" : ""}`}
          onClick={() => setSection("poolReleases")}
        >
          Hovuz-Buraxma Təsdiqi {pendingReleases > 0 && `(${pendingReleases})`}
        </button>
        <div style={{ marginLeft: "auto" }} className="row">
          <button className={`btn sm ${statusTab === "PENDING" ? "primary" : ""}`} onClick={() => setStatusTab("PENDING")}>
            Gözləyənlər
          </button>
          <button className={`btn sm ${statusTab === "ALL" ? "primary" : ""}`} onClick={() => setStatusTab("ALL")}>
            Hamısı
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>
      ) : section === "refunds" ? (
        visibleRefunds.length === 0 ? (
          <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            {statusTab === "PENDING" ? "Gözləyən iadə tələbi yoxdur" : "İadə tələbi yoxdur"}
          </div>
        ) : (
          <div className="card">
            {visibleRefunds.map(r => {
              const pill = STATUS_PILL[r.status] ?? STATUS_PILL.PENDING;
              const busy = busyId === r.id;
              return (
                <div className="list-item" key={r.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="li-title">
                      Ödəniş #{r.paymentId}
                      {r.patientName && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {r.patientName}</span>}
                      <span className={`pill ${pill.cls}`} style={{ marginLeft: 8 }}>{pill.label}</span>
                    </div>
                    <div className="li-meta">
                      İadə məbləği: <strong>{r.amount} AZN</strong>
                      {r.paymentAmount != null && <> · ödəniş {r.paymentAmount} AZN</>}
                      {r.alreadyRefunded > 0 && <> · əvvəl qaytarılıb {r.alreadyRefunded} AZN</>}
                      <br />
                      Səbəb: {r.reason}
                      <br />
                      Tələb edən: {r.requestedByName ?? "—"} · {azFormatDateTime(r.createdAt)}
                      {r.decisionNote && <> · Qərar qeydi: {r.decisionNote}</>}
                    </div>
                  </div>
                  {r.status === "PENDING" && (
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn primary sm" disabled={busy} onClick={() => decideRefund(r, "approve")}>
                        {busy ? "…" : "Təsdiqlə (icra et)"}
                      </button>
                      <button className="btn danger sm" disabled={busy} onClick={() => decideRefund(r, "reject")}>
                        Rədd et
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        visibleReleases.length === 0 ? (
          <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            {statusTab === "PENDING" ? "Gözləyən hovuz-buraxma tələbi yoxdur" : "Hovuz-buraxma tələbi yoxdur"}
          </div>
        ) : (
          <div className="card">
            {visibleReleases.map(r => {
              const pill = STATUS_PILL[r.status] ?? STATUS_PILL.PENDING;
              const busy = busyId === r.id;
              return (
                <div className="list-item" key={r.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="li-title">
                      Müraciət #{r.appointmentId}
                      {r.patientName && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {r.patientName}</span>}
                      {r.appointmentStatus && <span className="pill ox" style={{ marginLeft: 8 }}>{r.appointmentStatus}</span>}
                      <span className={`pill ${pill.cls}`} style={{ marginLeft: 4 }}>{pill.label}</span>
                    </div>
                    <div className="li-meta">
                      Operator: {r.operatorName ?? "—"} · {azFormatDateTime(r.createdAt)}
                      {r.reason && <><br />Səbəb: {r.reason}</>}
                      {r.decisionNote && <><br />Qərar qeydi: {r.decisionNote}</>}
                    </div>
                  </div>
                  {r.status === "PENDING" && (
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn primary sm" disabled={busy} onClick={() => decideRelease(r, "approve")}>
                        {busy ? "…" : "Təsdiqlə (hovuza qaytar)"}
                      </button>
                      <button className="btn danger sm" disabled={busy} onClick={() => decideRelease(r, "reject")}>
                        Rədd et
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
