"use client";

import { useEffect, useMemo, useState } from "react";
import { operatorApi, type PaymentItem } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { getStoredUser } from "@/lib/auth";
import { useT } from "@/lib/i18n/LocaleProvider";
import { toast as uiToast } from "@/components/Toast";
import { SkeletonGrid } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDt(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

type Scope = "all" | "pool" | "mine";

export default function OperatorPaymentsPage() {
  const { t } = useT();
  const me = getStoredUser();
  const meId = me?.userId ?? null;
  const isAdmin = me?.role === "ADMIN";
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [toast, setToast] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    operatorApi.listPendingPayments("PENDING")
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const flash = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 3000); };

  const patch = (p: PaymentItem) => setItems(list => list.map(x => x.id === p.id ? p : x));

  const take = async (p: PaymentItem) => {
    setBusyId(p.id);
    try { patch(await operatorApi.claimPayment(p.id)); }
    catch (e) { uiToast((e as Error).message, "error"); }
    finally { setBusyId(null); }
  };

  const release = async (p: PaymentItem) => {
    setBusyId(p.id);
    try { patch(await operatorApi.releasePayment(p.id)); }
    catch (e) { uiToast((e as Error).message, "error"); }
    finally { setBusyId(null); }
  };

  const markPaid = async (p: PaymentItem) => {
    setBusyId(p.id);
    try {
      await operatorApi.markPaymentPaid(p.id);
      setItems(list => list.filter(x => x.id !== p.id));
      flash(`${p.patientName} · ${t("pkg.paid")}`);
    } catch (e) {
      uiToast((e as Error).message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const poolCount = useMemo(() => items.filter(p => p.claimedByOperatorId == null).length, [items]);
  const mineCount = useMemo(() => items.filter(p => p.claimedByOperatorId === meId).length, [items, meId]);

  const filtered = useMemo(() => items.filter(p => {
    if (scope === "pool") return p.claimedByOperatorId == null;
    if (scope === "mine") return p.claimedByOperatorId === meId;
    return true;
  }), [items, scope, meId]);

  const TABS: { key: Scope; label: string; count?: number; color: string }[] = [
    { key: "all",  label: t("pkg.scopeAll"),  color: "#52718F" },
    { key: "pool", label: t("staff.opPoolFilter"), count: poolCount, color: "#047857" },
    { key: "mine", label: t("staff.opMineFilter"), count: mineCount, color: "var(--brand-700)" },
  ];

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

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map(tb => {
          const active = scope === tb.key;
          return (
            <button key={tb.key} type="button" onClick={() => setScope(tb.key)}
              style={{
                padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: active ? `2px solid ${tb.color}` : "1px solid #E5E7EB",
                background: active ? "#fff" : "rgba(255,255,255,0.6)",
                color: active ? tb.color : "#52718F", cursor: "pointer",
              }}>
              {tb.label}
              {tb.count != null && <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>{tb.count}</span>}
            </button>
          );
        })}
      </div>

      {toast && (
        <div className="opf-row" data-flag="ok"
          style={{ justifyContent: "flex-start", gap: 8, color: "#065F46", fontWeight: 600 }}>
          <IconCheck /> {toast}
        </div>
      )}

      {loading ? (
        <SkeletonGrid count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("pkg.noPayments")} sub="Yeni ödəniş gözləyin və ya filtri dəyişin." />
      ) : (
        <div className="opf-list">
          {filtered.map(p => {
            const isPackage = p.patientPackageId != null;
            const mine = p.claimedByOperatorId != null && p.claimedByOperatorId === meId;
            const other = p.claimedByOperatorId != null && !mine;
            const busy = busyId === p.id;
            return (
              <div key={p.id} className="opf-row" data-flag="followup">
                <div className="opf-row-main">
                  <div className="opf-row-line">
                    <span className="opf-row-name">{p.patientName}</span>
                    <span className="opf-flag opf-flag--warn">
                      {isPackage ? t("pkg.paymentPackage") : t("pkg.paymentSingle")}
                    </span>
                    {mine && (
                      <span className="op-claim-chip op-claim-chip--mine">
                        <span className="op-claim-dot" />{t("staff.opClaimMine")}
                      </span>
                    )}
                    {other && p.claimedByName && (
                      <span className="op-claim-chip">
                        <span className="op-claim-dot" />{t("staff.opClaimWorking", { name: p.claimedByName })}
                      </span>
                    )}
                  </div>
                  <div className="opf-row-meta">
                    {t("pkg.amount")}: <strong style={{ color: "var(--oxford)" }}>{formatAzn(p.amount)}</strong>
                    {" · "}{t("pkg.method")}: {p.method}
                    {" · "}{t("pkg.date")}: {fmtDt(p.createdAt)}
                  </div>
                </div>
                <div className="opf-row-actions" style={{ display: "flex", gap: 8 }}>
                  {p.claimedByOperatorId == null && (
                    <button type="button" onClick={() => take(p)} disabled={busy}
                      className="rsc-btn"
                      style={{ background: "#047857", color: "#fff", padding: "6px 12px", opacity: busy ? 0.6 : 1 }}>
                      {t("staff.opTake")}
                    </button>
                  )}
                  {mine && (
                    <button type="button" onClick={() => release(p)} disabled={busy}
                      className="rsc-btn"
                      style={{ background: "#fff", color: "var(--brand-700)", border: "1px solid #C7D2FE", padding: "6px 12px", opacity: busy ? 0.6 : 1 }}>
                      {t("staff.opReleaseToPool")}
                    </button>
                  )}
                  {(mine || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => markPaid(p)}
                      disabled={busy}
                      className="rsc-btn"
                      style={{ background: "var(--brand)", color: "#fff", padding: "6px 12px", opacity: busy ? 0.6 : 1 }}
                    >
                      {t("pkg.markPaid")}
                    </button>
                  )}
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
