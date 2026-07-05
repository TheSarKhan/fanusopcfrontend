"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { operatorApi, type PaymentItem, type PaymentSummary } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { getStoredUser } from "@/lib/auth";
import { useT } from "@/lib/i18n/LocaleProvider";
import { toast as uiToast } from "@/components/Toast";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDt(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

type Status = "PENDING" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED" | "CANCELLED";
const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  PENDING:            { label: "Gözləyir",         bg: "#FEF3C7", fg: "#92400E" },
  PAID:               { label: "Ödənilib",         bg: "#D1FAE5", fg: "#065F46" },
  PARTIALLY_REFUNDED: { label: "Qismi qaytarılıb", bg: "#FFEDD5", fg: "#9A3412" },
  REFUNDED:           { label: "Geri qaytarılıb",  bg: "#FEE2E2", fg: "#991B1B" },
  CANCELLED:          { label: "Ləğv edilib",      bg: "#F3F4F6", fg: "#374151" },
};
// Əməliyyat qrupları (status tabları yox) — qismi qaytarılmış ödəniş "Ödənilmiş"də
// qalır, in-place yenidən qaytarıla bilir; yalnız tam qaytarma terminal qrupa keçir.
type BucketKey = "PENDING" | "PAID" | "REFUNDED" | "CANCELLED";
const BUCKETS: { key: BucketKey; label: string; statuses: Status[]; color: string }[] = [
  { key: "PENDING",   label: "Gözləyir",         statuses: ["PENDING"],                    color: "#92400E" },
  { key: "PAID",      label: "Ödənilmiş",        statuses: ["PAID", "PARTIALLY_REFUNDED"], color: "#065F46" },
  { key: "REFUNDED",  label: "Geri qaytarılmış", statuses: ["REFUNDED"],                   color: "#991B1B" },
  { key: "CANCELLED", label: "Ləğv edilmiş",     statuses: ["CANCELLED"],                  color: "#374151" },
];
const bucketStatuses = (k: BucketKey) => (BUCKETS.find(b => b.key === k) ?? BUCKETS[0]).statuses;

const AV = [
  { bg: "#E0EBFA", color: "#1E3A8A" }, { bg: "#D1FAE5", color: "#065F46" },
  { bg: "#FEF3C7", color: "#92400E" }, { bg: "#EDE9FE", color: "#5B21B6" }, { bg: "#FCE7F3", color: "#9D174D" },
];
const avatarOf = (id: number) => AV[Math.abs(id) % AV.length];
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";

export default function OperatorPaymentsPage() {
  const { t } = useT();
  const me = getStoredUser();
  const meId = me?.userId ?? null;
  const isAdmin = me?.role === "ADMIN";
  const PAGE_SIZE = 30;
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bucket, setBucket] = useState<BucketKey>("PENDING");
  const [mineOnly, setMineOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [refundFor, setRefundFor] = useState<PaymentItem | null>(null);
  const [cancelFor, setCancelFor] = useState<PaymentItem | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);

  // Server səhifələməsi — bucket dəyişəndə birinci səhifədən başlanır.
  const load = (bk: BucketKey = bucket) => {
    setLoading(true);
    operatorApi.listPaymentsPaged({ status: bucketStatuses(bk).join(","), page: 0, size: PAGE_SIZE })
      .then(res => {
        setItems(res.content);
        setTotalElements(res.totalElements);
        setPage(0);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  const loadMore = () => {
    setLoadingMore(true);
    operatorApi.listPaymentsPaged({ status: bucketStatuses(bucket).join(","), page: page + 1, size: PAGE_SIZE })
      .then(res => {
        setItems(prev => [...prev, ...res.content]);
        setTotalElements(res.totalElements);
        setPage(res.page);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };
  const loadSummary = () => { operatorApi.paymentsSummary().then(setSummary).catch(() => {}); };

  useEffect(() => { load(bucket); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [bucket]);
  useEffect(() => { loadSummary(); }, []);

  const flash = (msg: string) => {
    const id = Date.now();
    setToast({ id, msg });
    window.setTimeout(() => setToast(cur => (cur && cur.id === id ? null : cur)), 4200);
  };
  const patch = (p: PaymentItem) => setItems(list => list.map(x => x.id === p.id ? p : x));
  const settle = (p: PaymentItem) => {
    // Qrupda qalırsa in-place yenilə (məs. qismi qaytarma "Ödənilmiş"də qalır), yoxsa çıxar.
    if (bucketStatuses(bucket).includes(p.status as Status)) patch(p);
    else setItems(list => list.filter(x => x.id !== p.id));
    loadSummary();
  };

  const markPaid = async (p: PaymentItem) => {
    setBusyId(p.id);
    try {
      await operatorApi.markPaymentPaid(p.id);
      setItems(list => list.filter(x => x.id !== p.id));
      flash(`${p.patientName} · ${t("pkg.paid")}`); loadSummary();
    } catch (e) { uiToast((e as Error).message, "error"); } finally { setBusyId(null); }
  };
  const onCancelled = (p: PaymentItem) => { setCancelFor(null); settle(p); flash(`${p.patientName} · ödəniş ləğv edildi`); };
  // İadə artıq dərhal icra olunmur — Admin təsdiqinə gedir (OP-BR-07, ADM-BR-03).
  const onRefundRequested = () => { setRefundFor(null); flash("İadə tələbi Admin təsdiqinə göndərildi — təsdiqdən sonra icra olunacaq"); };

  const mineCountItems = useMemo(() => items.filter(p => p.claimedByOperatorId === meId).length, [items, meId]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(p =>
      (!mineOnly || p.claimedByOperatorId === meId) &&
      (!q || (p.patientName ?? "").toLowerCase().includes(q)));
  }, [items, mineOnly, meId, search]);

  const kpis = summary ? [
    { label: "Gözləyən məbləğ", value: formatAzn(summary.pendingSum), sub: `${summary.pendingCount} ödəniş`, color: "#92400E", icon: I_CLOCK },
    { label: "Bu ay ödənilib", value: formatAzn(summary.paidMonthSum), sub: `${summary.paidMonthCount} ödəniş`, color: "#047857", icon: I_CHECKC },
    { label: "Geri qaytarılıb", value: formatAzn(summary.refundedMonthSum), sub: "bu ay", color: "#991B1B", icon: I_UNDO },
    { label: "Mənim üzərimdə", value: String(summary.mineCount), sub: "ödəniş", color: "#082F6D", icon: I_USER },
  ] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", color: "var(--oxford)" }}>{t("pkg.paymentsTitle")}</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>Özünüzün götürdüyünüz müraciətlərin ödənişlərini idarə edin — təsdiq, ləğv və geri qaytarma (tam/qismi).</p>
      </div>

      {/* KPI */}
      {kpis.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 13, marginBottom: 20 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ ...CARD, padding: "15px 17px", position: "relative" }}>
              <span style={{ position: "absolute", top: 15, right: 15, color: k.color }}><Ico d={k.icon} /></span>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 5 }}>{k.label}</div>
              <div className="py-num" style={{ fontSize: 21, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11.5, color: "#9DB0CC", fontWeight: 600, marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtr */}
      <div className="py-tabs" style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 18 }}>
        {BUCKETS.map(b => {
          const active = bucket === b.key;
          return (
            <button key={b.key} type="button" onClick={() => { setBucket(b.key); setMineOnly(false); }}
              style={{ background: active ? "#fff" : "rgba(255,255,255,.5)", border: active ? `2px solid ${b.color}` : "1px solid #E1E9F5", borderRadius: 999, padding: active ? "6px 13px" : "7px 14px", fontSize: 13, fontWeight: 600, color: active ? "var(--oxford)" : "#52718F", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flex: "none" }}>
              {b.label}
            </button>
          );
        })}
        {/* Admin qlobal siyahıya baxır, "mənim üzərimdə" ilə öz götürdüklərinə süzə bilir.
            Operator artıq server tərəfdə yalnız özününkülərini görür — bu çip mənasız olardı. */}
        {isAdmin && (
          <button type="button" onClick={() => setMineOnly(v => !v)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: mineOnly ? "#fff" : "rgba(255,255,255,.5)", border: mineOnly ? "2px solid var(--brand)" : "1px solid #E1E9F5", borderRadius: 999, padding: mineOnly ? "6px 13px" : "7px 14px", fontSize: 13, fontWeight: 600, color: mineOnly ? "var(--brand-700)" : "#52718F", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flex: "none" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1051B7" }} />Mənim üzərimdə <span style={{ opacity: 0.7, fontWeight: 700 }}>{summary?.mineCount ?? mineCountItems}</span>
          </button>
        )}
        <div style={{ position: "relative", flex: "none", minWidth: 210, marginLeft: 4 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9DB0CC" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pasiyent adı ilə axtar…"
            style={{ width: "100%", border: "1px solid #D6E2F7", background: "#fff", borderRadius: 999, padding: "8px 14px 8px 34px", fontSize: 13, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit" }} />
        </div>
      </div>

      {/* Sətirlər */}
      {loading ? (
        <SkeletonRows />
      ) : filtered.length === 0 ? (
        <EmptyCard />
      ) : (
        <div style={{ ...CARD, padding: "6px 12px 10px" }}>
          {filtered.map(p => <Row key={p.id} p={p} meId={meId} isAdmin={isAdmin} busy={busyId === p.id}
            onMarkPaid={markPaid} onCancel={setCancelFor} onRefund={setRefundFor} />)}
        </div>
      )}

      {!loading && items.length < totalElements && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button type="button" onClick={loadMore} disabled={loadingMore}
            style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
            {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - items.length)})`}
          </button>
        </div>
      )}

      {refundFor && <RefundModal payment={refundFor} onClose={() => setRefundFor(null)} onDone={onRefundRequested} />}
      {cancelFor && <CancelModal payment={cancelFor} onClose={() => setCancelFor(null)} onDone={onCancelled} />}

      {toast && (
        <div key={toast.id} className="py-toast"
          style={{ position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)", zIndex: 1100, display: "inline-flex", alignItems: "center", gap: 9, background: "#065F46", color: "#fff", borderRadius: 12, padding: "12px 18px", fontSize: 13.5, fontWeight: 600, boxShadow: "0 12px 40px rgba(6,95,70,.35)" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          <span className="py-num">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

// ─── Sətir ───────────────────────────────────────────────────────────────────

function Row({ p, meId, isAdmin, busy, onMarkPaid, onCancel, onRefund }: {
  p: PaymentItem; meId: number | null; isAdmin: boolean; busy: boolean;
  onMarkPaid: (p: PaymentItem) => void;
  onCancel: (p: PaymentItem) => void; onRefund: (p: PaymentItem) => void;
}) {
  const { t } = useT();
  const st = (p.status as Status);
  const m = STATUS_META[st] ?? STATUS_META.PENDING;
  const av = avatarOf(p.id);
  const isPackage = p.patientPackageId != null;
  const mine = p.claimedByOperatorId != null && p.claimedByOperatorId === meId;
  const other = p.claimedByOperatorId != null && !mine;
  const canAct = mine || isAdmin;
  const refunded = p.refundedAmount ?? 0;
  const net = p.amount - refunded;
  const canRefund = st === "PAID" || st === "PARTIALLY_REFUNDED";
  const terminal = st === "REFUNDED" || st === "CANCELLED";

  return (
    <div className="py-row" data-pay-row={p.id} style={{ borderTop: "1px solid #F4F7FB", borderRadius: 10, padding: "15px 12px", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
      <span style={{ width: 42, height: 42, borderRadius: 12, background: av.bg, color: av.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flex: "none" }}>{initialsOf(p.patientName)}</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{p.patientName}</span>
          <span style={{ background: m.bg, color: m.fg, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{m.label}</span>
          <span style={{ background: isPackage ? "#F2F6FD" : "#F3F4F6", color: isPackage ? "#082F6D" : "#374151", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999 }}>{isPackage ? t("pkg.paymentPackage") : t("pkg.paymentSingle")}</span>
          {(mine || (other && p.claimedByName)) && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: mine ? "#E4ECFA" : "#F3F4F6", color: mine ? "#1051B7" : "#52718F", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: mine ? "#1051B7" : "#52718F" }} />
              {mine ? t("staff.opClaimMine") : t("staff.opClaimWorking", { name: p.claimedByName! })}
            </span>
          )}
        </div>
        <div className="py-num" style={{ fontSize: 12.5, color: "#52718F", fontWeight: 600 }}>
          {t("pkg.amount")}: <b style={{ color: "var(--oxford)" }}>{formatAzn(p.amount)}</b> · {t("pkg.method")}: {p.method} · {t("pkg.date")}: {fmtDt(p.createdAt)}
          {refunded > 0 && <span style={{ color: "#9A3412" }}> · geri qaytarılıb: {formatAzn(refunded)} · qalıq: {formatAzn(net)}</span>}
        </div>
        {p.statusNote && <div style={{ fontSize: 12, color: "var(--oxford-60)", fontStyle: "italic", fontWeight: 500, marginTop: 4 }}>Səbəb: «{p.statusNote}»</div>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "none", alignItems: "center" }}>
        {st === "PENDING" && p.claimedByOperatorId == null && (
          <span style={{ fontSize: 11.5, color: "#9A3412", fontWeight: 600, padding: "8px 4px", maxWidth: 210, lineHeight: 1.35 }}>
            Bağlı seans/paket hələ götürülməyib — Pool-dan götürün ki, ödəniş sizə keçsin
          </span>
        )}
        {st === "PENDING" && canAct && <Btn tone="brand" busy={busy} onClick={() => onMarkPaid(p)} icon={<path d="M20 6L9 17l-5-5" />}>{t("pkg.markPaid")}</Btn>}
        {st === "PENDING" && canAct && <Btn tone="danger" busy={busy} onClick={() => onCancel(p)}>Ləğv et</Btn>}
        {canRefund && canAct && <Btn tone="orange" busy={busy} onClick={() => onRefund(p)} icon={<><path d="M3 7v6h6" /><path d="M3 13a9 9 0 1 0 3-7.7L3 8" /></>}>{refunded > 0 ? "Qalanı qaytar" : "Geri qaytar"}</Btn>}
        {terminal && <span style={{ fontSize: 12, color: "#9DB0CC", fontWeight: 600, padding: "8px 4px" }}>Əməliyyat yox</span>}
      </div>
    </div>
  );
}

function Btn({ tone, busy, onClick, icon, children }: { tone: "green" | "ghost" | "brand" | "danger" | "orange"; busy: boolean; onClick: () => void; icon?: ReactNode; children: ReactNode }) {
  const S: Record<string, React.CSSProperties> = {
    green:  { background: "#047857", color: "#fff", border: "none" },
    brand:  { background: "var(--brand)", color: "#fff", border: "none" },
    ghost:  { background: "#fff", color: "#082F6D", border: "1px solid #D6E2F7" },
    danger: { background: "#fff", color: "#B91C1C", border: "1px solid #F3D6D6" },
    orange: { background: "#fff", color: "#9A3412", border: "1px solid #FED7AA" },
  };
  return (
    <button type="button" onClick={onClick} disabled={busy}
      style={{ ...S[tone], display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 9, padding: "8px 13px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
      {icon && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>}
      {children}
    </button>
  );
}

function SkeletonRows() {
  return (
    <div style={{ ...CARD, padding: "6px 12px 10px" }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, borderTop: "1px solid #F4F7FB", padding: "15px 0" }}>
          <div className="py-skel" style={{ width: 42, height: 42, borderRadius: 12, flex: "none" }} />
          <div style={{ flex: 1 }}>
            <div className="py-skel" style={{ width: "50%", height: 13, borderRadius: 6, marginBottom: 8 }} />
            <div className="py-skel" style={{ width: "70%", height: 10, borderRadius: 6 }} />
          </div>
          <div className="py-skel" style={{ width: 80, height: 34, borderRadius: 9, flex: "none" }} />
        </div>
      ))}
    </div>
  );
}

function EmptyCard() {
  return (
    <div style={{ ...CARD, padding: "48px 24px", textAlign: "center" }}>
      <div style={{ width: 54, height: 54, borderRadius: 15, background: "#F2F6FD", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: "#9DB0CC" }}>
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" /></svg>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 5, color: "var(--oxford)" }}>Bu statusda ödəniş yoxdur</div>
      <div style={{ fontSize: 13, color: "#9DB0CC", fontWeight: 500 }}>Statusu dəyişin və ya yeni ödəniş gözləyin.</div>
    </div>
  );
}

// ─── Geri qaytarma modalı ─────────────────────────────────────────────────────

function RefundModal({ payment, onClose, onDone }: { payment: PaymentItem; onClose: () => void; onDone: () => void }) {
  const remaining = payment.amount - (payment.refundedAmount ?? 0);
  const [amount, setAmount] = useState(String(remaining));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const amt = Number(amount);
  const amtOk = Number.isFinite(amt) && amt > 0 && amt <= remaining + 1e-9;
  const ready = amtOk && reason.trim().length > 0;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true); setErr(null);
    try { await operatorApi.refundPayment(payment.id, amt, reason.trim()); onDone(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <Sheet title="İadə tələbi" sub={`${payment.patientName} · ödəniş ${formatAzn(payment.amount)} · qalıq ${formatAzn(remaining)}`} onClose={onClose}>
      <Field label="Geri qaytarılacaq məbləğ (₼)">
        <input type="number" min={0} step="0.01" max={remaining} value={amount} onChange={e => setAmount(e.target.value)} style={{ ...INPUT, fontSize: 15 }} autoFocus />
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: -2 }}>
        <button type="button" onClick={() => setAmount(String(remaining))} style={{ background: "#FFF7ED", color: "#9A3412", border: "1px solid #FED7AA", borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Tam ({formatAzn(remaining)})</button>
        <button type="button" onClick={() => setAmount(String(Math.round(remaining / 2 * 100) / 100))} style={{ background: "#fff", color: "#5C6B85", border: "1px solid #D6E2F7", borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Yarısı</button>
      </div>
      <Field label="Səbəb (məcburi)">
        <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Geri qaytarma səbəbi…" style={{ ...INPUT, resize: "vertical", lineHeight: 1.5 }} />
      </Field>
      <InfoBox tone="brand">Bütün iadələr (tam və qismi) Admin təsdiqindən keçir — tələb təsdiqlənəndə icra olunacaq.{payment.patientPackageId != null && " Paket ödənişidirsə icra zamanı qalan seanslar bağlanacaq."}</InfoBox>
      {err && <ErrBox>{err}</ErrBox>}
      <Footer onClose={onClose} onSubmit={submit} disabled={!ready || busy} label={busy ? "Göndərilir…" : `${formatAzn(amtOk ? amt : 0)} üçün tələb göndər`} />
    </Sheet>
  );
}

function CancelModal({ payment, onClose, onDone }: { payment: PaymentItem; onClose: () => void; onDone: (p: PaymentItem) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ready = reason.trim().length > 0;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true); setErr(null);
    try { onDone(await operatorApi.cancelPayment(payment.id, reason.trim())); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <Sheet title="Ödənişi ləğv et" sub={`${payment.patientName} · ${formatAzn(payment.amount)} · gözləyən ödəniş`} onClose={onClose}>
      <Field label="Ləğv səbəbi (məcburi)">
        <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ləğv səbəbi…" style={{ ...INPUT, resize: "vertical", lineHeight: 1.5 }} autoFocus />
      </Field>
      {payment.patientPackageId != null && <InfoBox tone="warn">Paket ödənişidir — paket də ləğv olunacaq (qalan seanslar bağlanır).</InfoBox>}
      {err && <ErrBox>{err}</ErrBox>}
      <Footer onClose={onClose} onSubmit={submit} disabled={!ready || busy} label={busy ? "Göndərilir…" : "Ödənişi ləğv et"} />
    </Sheet>
  );
}

// ─── UI köməkçiləri ───────────────────────────────────────────────────────────

const CARD: React.CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8" };
const INPUT: React.CSSProperties = { width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 13px", fontSize: 13.5, fontWeight: 600, color: "var(--oxford)", fontFamily: "inherit", boxSizing: "border-box" };

function Sheet({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,26,51,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="py-sheet" style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 16, boxShadow: "0 24px 70px rgba(8,47,109,.3)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #F0F4FA", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)" }}>{title}</div>
            <div className="py-num" style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, marginTop: 3 }}>{sub}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Bağla" style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F0F4FA", border: "none", borderRadius: 8, cursor: "pointer", flex: "none" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={{ display: "block" }}><span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 }}>{label}</span>{children}</label>;
}
function InfoBox({ tone, children }: { tone: "brand" | "warn"; children: ReactNode }) {
  const s = tone === "warn" ? { bg: "#FFFBEB", bd: "#FDE68A", fg: "#92400E" } : { bg: "#F2F6FD", bd: "#E4ECFA", fg: "#082F6D" };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 10, padding: "10px 12px", fontSize: 12, color: s.fg, fontWeight: 600, lineHeight: 1.45 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
      <span>{children}</span>
    </div>
  );
}
function ErrBox({ children }: { children: ReactNode }) {
  return <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12 }}>{children}</div>;
}
function Footer({ onClose, onSubmit, disabled, label }: { onClose: () => void; onSubmit: () => void; disabled: boolean; label: string }) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 2 }}>
      <button type="button" onClick={onClose} style={{ background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Ləğv</button>
      <button type="button" onClick={onSubmit} disabled={disabled}
        style={{ flex: 1, background: disabled ? "#9DB0CC" : "#B91C1C", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: disabled ? "default" : "pointer" }}>{label}</button>
    </div>
  );
}

function Ico({ d }: { d: ReactNode }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
}
const I_CLOCK = <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>;
const I_CHECKC = <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></>;
const I_UNDO = <><path d="M3 7v6h6" /><path d="M3 13a9 9 0 1 0 3-7.7L3 8" /></>;
const I_USER = <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>;

const CSS = `
.py-num{font-variant-numeric:tabular-nums}
.py-tabs::-webkit-scrollbar{height:0}
.py-row{transition:background .14s}
.py-row:hover{background:#F2F6FD}
@keyframes pyShim{0%{background-position:-320px 0}100%{background-position:320px 0}}
.py-skel{background:linear-gradient(90deg,#EEF2F9 25%,#E2E9F4 37%,#EEF2F9 63%);background-size:640px 100%;animation:pyShim 1.4s infinite linear}
@keyframes pySheet{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.py-sheet{animation:pySheet .2s ease}
@keyframes pyToast{0%{opacity:0;transform:translateX(-50%) translateY(12px)}12%{opacity:1;transform:translateX(-50%) translateY(0)}88%{opacity:1}100%{opacity:0}}
.py-toast{animation:pyToast 4s ease forwards}
`;
