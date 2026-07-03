"use client";

/**
 * Admin — Ödəniş sahibliyi (oxu görünüşü).
 * Ayrıca "ödəniş pool"u yoxdur — sahiblik ödənişin bağlı olduğu seansın/paketin
 * claim-indən DƏRHAL törəyir. Sahibliyi dəyişmək üçün admin bağlı seansı/paketi
 * Müraciətlər səhifəsində "Operatoru dəyiş" ilə köçürür — ödəniş avtomatik onu izləyir.
 * Ödəniş əməliyyatlarının özü (təsdiq/ləğv/refund) operator panelindədir.
 * Backend: /operator/payments (ADMIN icazəli).
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
            <div style={{ flex: 1.4 }}>Sahib (bağlı seans/paketin operatoru)</div>
          </div>
          {filtered.map((p) => {
            const meta = STATUS_META[p.status] ?? { label: p.status, pill: "ox" };
            const refunded = p.refundedAmount ?? 0;
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
                    : <span style={{ color: "var(--muted)" }}>Sahibsiz — Müraciətlər pool-unda</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
