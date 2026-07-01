"use client";

/**
 * Admin — Ödəniş sahibliyi.
 * Operator ödəniş pool-unun admin görünüşü: kim hansı ödənişin üzərindədir,
 * sahibsiz qalan varmı, lazım olduqda sahibliyi başqa operatora keçir (reassign).
 * Ödəniş əməliyyatlarının özü (təsdiq/ləğv/refund) operator panelindədir —
 * admin burada yalnız sahibliyi idarə edir. Backend: /operator/payments (ADMIN icazəli),
 * /operator/payments/{id}/reassign (yalnız ADMIN).
 */

import { useEffect, useMemo, useState } from "react";
import { operatorApi, type PaymentItem, type PaymentSummary } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { azFormatDateTime } from "@/lib/datetime";
import { IconSearch } from "../_components/icons";

type BucketKey = "PENDING" | "PAID" | "CLOSED";

const BUCKETS: { key: BucketKey; label: string; statuses: string }[] = [
  { key: "PENDING", label: "Gözləyən",    statuses: "PENDING" },
  { key: "PAID",    label: "Ödənilib",    statuses: "PAID,PARTIALLY_REFUNDED" },
  { key: "CLOSED",  label: "Bağlanmış",   statuses: "REFUNDED,CANCELLED" },
];

const STATUS_META: Record<string, { label: string; pill: string }> = {
  PENDING:            { label: "Gözləyir",        pill: "gold" },
  PAID:               { label: "Ödənilib",        pill: "sage" },
  PARTIALLY_REFUNDED: { label: "Qismən geri",     pill: "gold" },
  REFUNDED:           { label: "Geri qaytarılıb", pill: "ox" },
  CANCELLED:          { label: "Ləğv edilib",     pill: "rose" },
};

export default function AdminPaymentsPage() {
  const [bucket, setBucket] = useState<BucketKey>("PENDING");
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [unownedOnly, setUnownedOnly] = useState(false);
  const [reassignFor, setReassignFor] = useState<PaymentItem | null>(null);

  const load = (b: BucketKey = bucket) => {
    setLoading(true);
    const statuses = BUCKETS.find((x) => x.key === b)!.statuses;
    operatorApi.listPendingPayments(statuses)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(bucket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket]);

  useEffect(() => {
    operatorApi.paymentsSummary().then(setSummary).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (unownedOnly && p.claimedByOperatorId != null) return false;
      if (!q) return true;
      const hay = `${p.id} ${p.patientName ?? ""} ${p.claimedByName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, unownedOnly]);

  const patch = (updated: PaymentItem) => {
    setItems((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Ödəniş sahibliyi</h1>
          <p className="page-sub">
            {summary
              ? `Gözləyən: ${summary.pendingCount} (${formatAzn(summary.pendingSum)}) · bu ay ödənilən: ${summary.paidMonthCount} (${formatAzn(summary.paidMonthSum)})`
              : "Ödəniş pool-unun sahiblik görünüşü — əməliyyatlar operator panelindədir."}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => load()}>Yenilə</button>
        </div>
      </div>

      <div className="toolbar" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        {BUCKETS.map((b) => (
          <button key={b.key} className={`filter${bucket === b.key ? " active" : ""}`} onClick={() => setBucket(b.key)}>
            {b.label}
          </button>
        ))}
        <button className={`filter${unownedOnly ? " active" : ""}`} onClick={() => setUnownedOnly((v) => !v)}>
          Yalnız sahibsiz
        </button>
        <div className="search">
          <IconSearch size={13} style={{ color: "var(--muted)" }} />
          <input placeholder="ID, pasiyent, operator..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="toolbar-spacer" />
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{filtered.length} nəticə</span>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          Bu süzgəcə uyğun ödəniş yoxdur.
        </div>
      ) : (
        <div className="card">
          <div className="list-item" style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 700 }}>
            <div style={{ flex: 2 }}>Ödəniş</div>
            <div style={{ flex: 1, textAlign: "center" }}>Məbləğ</div>
            <div style={{ flex: 1, textAlign: "center" }}>Status</div>
            <div style={{ flex: 1.4 }}>Sahib (operator)</div>
            <div style={{ flex: 1, textAlign: "right" }}>Əməliyyat</div>
          </div>
          {filtered.map((p) => {
            const meta = STATUS_META[p.status] ?? { label: p.status, pill: "ox" };
            const refunded = p.refundedAmount ?? 0;
            const terminal = p.status === "REFUNDED" || p.status === "CANCELLED";
            return (
              <div className="list-item" key={p.id}>
                <div style={{ flex: 2, minWidth: 0 }}>
                  <div className="li-title">
                    #PAY-{String(p.id).padStart(4, "0")} · {p.patientName || "—"}
                    <span className="pill ox" style={{ marginLeft: 6 }}>
                      {p.patientPackageId != null ? "Paket" : "Seans"}
                    </span>
                  </div>
                  <div className="li-meta">
                    yaradılıb: {azFormatDateTime(p.createdAt)}
                    {p.paidAt && <> · ödənilib: {azFormatDateTime(p.paidAt)}</>}
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 600 }}>
                  {formatAzn(p.amount)}
                  {refunded > 0 && (
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>geri: {formatAzn(refunded)}</div>
                  )}
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <span className={`pill ${meta.pill}`}>{meta.label}</span>
                </div>
                <div style={{ flex: 1.4, fontSize: 13 }}>
                  {p.claimedByName
                    ? <>{p.claimedByName}{p.claimedAt && <span style={{ color: "var(--muted-2)", fontSize: 11 }}> · {azFormatDateTime(p.claimedAt)}</span>}</>
                    : <span style={{ color: "var(--muted)" }}>Sahibsiz</span>}
                </div>
                <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                  {!terminal && (
                    <button className="btn ghost sm" onClick={() => setReassignFor(p)}>
                      {p.claimedByOperatorId != null ? "Operatoru dəyiş" : "Operatora ver"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reassignFor && (
        <ReassignPaymentModal
          payment={reassignFor}
          onClose={() => setReassignFor(null)}
          onDone={(u) => { patch(u); setReassignFor(null); }}
        />
      )}
    </div>
  );
}

/* ─── Ödəniş sahibliyini operatora keçir ──────────────────────────────────── */

function ReassignPaymentModal({
  payment, onClose, onDone,
}: {
  payment: PaymentItem;
  onClose: () => void;
  onDone: (p: PaymentItem) => void;
}) {
  const [operators, setOperators] = useState<{ id: number; name: string }[]>([]);
  const [opId, setOpId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    operatorApi.listOperators().then(setOperators).catch(() => {});
  }, []);

  const submit = async () => {
    if (!opId) { setErr("Operator seçin"); return; }
    setSaving(true); setErr(null);
    try { onDone(await operatorApi.reassignPayment(payment.id, opId)); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(440px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Ödəniş sahibliyini keçir</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            #PAY-{String(payment.id).padStart(4, "0")} · {payment.patientName || "—"} · {formatAzn(payment.amount)}
            {payment.claimedByName
              ? <> · hazırkı sahib: <strong>{payment.claimedByName}</strong></>
              : <> · hazırda sahibsizdir</>}
          </p>
        </div>
        <div style={{ padding: 20 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Yeni sahib</label>
          <select value={opId ?? ""} onChange={(e) => setOpId(Number(e.target.value) || null)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, marginBottom: 12 }}>
            <option value="">— Operator seçin —</option>
            {operators.filter((o) => o.id !== payment.claimedByOperatorId).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
            Keçid qeyd-şərtsizdir və audit-loqa yazılır; ödənişin təsdiqi/ləğvi yeni sahibin üzərindədir.
          </p>
          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose}>Bağla</button>
            <button className="btn primary" onClick={submit} disabled={saving}>
              {saving ? "Göndərilir…" : "Sahibliyi keçir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
