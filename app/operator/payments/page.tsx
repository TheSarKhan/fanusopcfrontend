"use client";

import { useEffect, useState } from "react";
import { operatorApi, type PaymentItem } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { useT } from "@/lib/i18n/LocaleProvider";
import { toast as uiToast } from "@/components/Toast";
import { SkeletonGrid } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDt(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function OperatorPaymentsPage() {
  const { t } = useT();
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    operatorApi.listPendingPayments("PENDING")
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const markPaid = async (p: PaymentItem) => {
    setBusyId(p.id);
    try {
      await operatorApi.markPaymentPaid(p.id);
      setItems(list => list.filter(x => x.id !== p.id));
      setToast(`${p.patientName} · ${t("pkg.paid")}`);
      window.setTimeout(() => setToast(null), 3000);
    } catch (e) {
      uiToast((e as Error).message, "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="opf-page">
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>
          {t("pkg.paymentsTitle")}
        </h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: 0 }}>
          {t("pkg.pendingPayments")}
        </p>
      </header>

      {toast && (
        <div className="opf-row" data-flag="ok"
          style={{ justifyContent: "flex-start", gap: 8, color: "#065F46", fontWeight: 600 }}>
          <IconCheck /> {toast}
        </div>
      )}

      {loading ? (
        <SkeletonGrid count={4} />
      ) : items.length === 0 ? (
        <EmptyState title={t("pkg.noPayments")} sub="Yeni ödəniş gözləyin və ya filtri dəyişin." />
      ) : (
        <div className="opf-list">
          {items.map(p => {
            const isPackage = p.patientPackageId != null;
            return (
              <div key={p.id} className="opf-row" data-flag="followup">
                <div className="opf-row-main">
                  <div className="opf-row-line">
                    <span className="opf-row-name">{p.patientName}</span>
                    <span className="opf-flag opf-flag--warn">
                      {isPackage ? t("pkg.paymentPackage") : t("pkg.paymentSingle")}
                    </span>
                  </div>
                  <div className="opf-row-meta">
                    {t("pkg.amount")}: <strong style={{ color: "var(--oxford)" }}>{formatAzn(p.amount)}</strong>
                    {" · "}{t("pkg.method")}: {p.method}
                    {" · "}{t("pkg.date")}: {fmtDt(p.createdAt)}
                  </div>
                </div>
                <div className="opf-row-actions">
                  <button
                    type="button"
                    onClick={() => markPaid(p)}
                    disabled={busyId === p.id}
                    className="rsc-btn"
                    style={{ background: "var(--brand)", color: "#fff", padding: "6px 12px", opacity: busyId === p.id ? 0.6 : 1 }}
                  >
                    {t("pkg.markPaid")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SW = { fill: "none" as const, stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };
function IconCheck() {
  return (<svg width="16" height="16" {...SW}><polyline points="20 6 9 17 4 12" /></svg>);
}
