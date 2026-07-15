"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import { operatorApi, type PaymentItem, type PaymentSummary } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { getStoredUser } from "@/lib/auth";
import { toast as uiToast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";
import ErrorState from "@/components/ErrorState";

// ─── Sabitlər ─────────────────────────────────────────────────────────────────
const PLATFORM_RATE = 0.20; // platforma komissiyası (default — sonra site_config-dən oxunacaq)
const ALL_STATUSES = ["PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED"] as const;
const PAGE_LIMIT = 300; // modul bir baxışda hesablanır (KPI/qrafik/payout) — hamısı bir dəfəyə gətirilir
const MONTHS_AZ = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
// Backend PaymentService.PAYMENT_METHODS ilə eyni dəyərlər — "Ödəniş üsulu bölgüsü" qrafiki bunlardan hesablanır.
const PAYMENT_METHOD_OPTIONS = ["Nağd", "Kart", "Köçürmə"] as const;

type Status = "PENDING" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED" | "CANCELLED";
type BucketKey = "pending" | "paid" | "refunded" | "cancelled";

const PILL_LABEL: Record<Status, string> = {
  PENDING: "Gözləyir",
  PAID: "Ödənilib",
  PARTIALLY_REFUNDED: "Qismi qaytarılıb",
  REFUNDED: "Geri qaytarılıb",
  CANCELLED: "Ləğv edilib",
};
const PILL_CLASS: Record<Status, string> = {
  PENDING: "fx-pill--pending",
  PAID: "fx-pill--paid",
  PARTIALLY_REFUNDED: "fx-pill--partial",
  REFUNDED: "fx-pill--refunded",
  CANCELLED: "fx-pill--cancelled",
};
const GROUPS: Record<BucketKey, Status[]> = {
  pending:   ["PENDING"],
  paid:      ["PAID", "PARTIALLY_REFUNDED"],
  refunded:  ["REFUNDED"],
  cancelled: ["CANCELLED"],
};
const TABS: { key: BucketKey; label: string }[] = [
  { key: "pending",   label: "Gözləyir" },
  { key: "paid",      label: "Ödənilmiş" },
  { key: "refunded",  label: "Geri qaytarılmış" },
  { key: "cancelled", label: "Ləğv edilmiş" },
];
// Rəng variantları id % 4 ilə seçilir — fx-avatar--1..4 (bax fanus-ui-kit/components.css)
const avatarClassOf = (id: number) => `fx-avatar--${(Math.abs(id) % 4) + 1}`;
const initialsOf = (name?: string | null) => (name ?? "").split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("");
const fmtNum = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDay(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_AZ[d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function ageHours(iso: string) { return (Date.now() - new Date(iso).getTime()) / 3_600_000; }
function ageLabel(h: number) {
  if (h < 1) return "indicə";
  if (h < 24) return `${Math.round(h)} saat gözləyir`;
  return `${Math.round(h / 24)} gün gözləyir`;
}
const netOf = (p: PaymentItem) => p.amount - (p.refundedAmount ?? 0);
// Real komissiya varsa onu göstər; yoxdursa (hələ hesablanmayıb) default dərəcə ilə təxmin et.
const commOf = (p: PaymentItem) => p.commissionAmount != null ? Math.round(p.commissionAmount) : Math.round(p.amount * PLATFORM_RATE);
const linkLabel = (p: PaymentItem) =>
  p.patientPackageId != null ? "Paket" : p.appointmentId != null ? `Seans #${p.appointmentId}` : "—";
const originLabel = (p: PaymentItem) => p.origin === "DIRECT" ? "Birbaşa" : p.origin === "PLATFORM_MATCHED" ? "Yönləndirilmiş" : null;

// ─── Səhifə ───────────────────────────────────────────────────────────────────
export default function OperatorPaymentsPage() {
  const router = useRouter();
  const me = getStoredUser();
  const meId = me?.userId ?? null;

  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [tab, setTab] = useState<BucketKey>("pending");
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [psych, setPsych] = useState("all");
  const [sort, setSort] = useState<"date" | "amount-desc" | "amount-asc">("date");
  const [mineOnly, setMineOnly] = useState(false);

  const [selected, setSelected] = useState<Record<number, true>>({});
  const [reminded, setReminded] = useState<Record<number, true>>({});
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [refundFor, setRefundFor] = useState<PaymentItem | null>(null);
  const [cancelFor, setCancelFor] = useState<PaymentItem | null>(null);
  const [payFor, setPayFor] = useState<PaymentItem | null>(null);

  // Bütün statuslar bir dəfəyə — modul insight (KPI/qrafik/payout) tam datadan hesablanır.
  const load = () => {
    setLoading(true);
    setError(false);
    operatorApi.listPaymentsPaged({ status: ALL_STATUSES.join(","), page: 0, size: PAGE_LIMIT })
      .then(res => setItems(res.content))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const patch = (id: number, next: Partial<PaymentItem>) =>
    setItems(list => list.map(x => x.id === id ? { ...x, ...next } : x));

  // ── Hesablamalar ─────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<BucketKey, number> = { pending: 0, paid: 0, refunded: 0, cancelled: 0 };
    for (const p of items) for (const k of TABS.map(t => t.key)) if (GROUPS[k].includes(p.status as Status)) c[k]++;
    return c;
  }, [items]);

  const pending = useMemo(() => items.filter(p => p.status === "PENDING"), [items]);
  const pendingSum = useMemo(() => pending.reduce((a, p) => a + p.amount, 0), [pending]);
  const overdue = useMemo(() => pending.filter(p => ageHours(p.createdAt) >= 24), [pending]);
  const paidItems = useMemo(() => items.filter(p => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED"), [items]);
  const paidMonthSum = useMemo(() => paidItems.reduce((a, p) => a + netOf(p), 0), [paidItems]);
  const todaySum = useMemo(() => {
    const now = new Date(); const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return paidItems.filter(p => p.paidAt && new Date(p.paidAt).getTime() >= t0).reduce((a, p) => a + netOf(p), 0);
  }, [paidItems]);
  const refundedSum = useMemo(() => items.reduce((a, p) => a + (p.refundedAmount ?? 0), 0), [items]);
  const collectionRate = useMemo(() => {
    const denom = paidMonthSum + pendingSum;
    return denom > 0 ? Math.round(paidMonthSum / denom * 100) : 0;
  }, [paidMonthSum, pendingSum]);

  const methodMix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of paidItems) m[p.method] = (m[p.method] ?? 0) + netOf(p);
    const total = Object.values(m).reduce((a, b) => a + b, 0) || 1;
    const order = ["Kart", "Köçürmə", "Nağd"];
    const colors: Record<string, string> = { "Kart": "var(--brand)", "Köçürmə": "var(--brand-400)", "Nağd": "var(--brand-200)" };
    const keys = [...order.filter(k => m[k]), ...Object.keys(m).filter(k => !order.includes(k))];
    return { total, rows: keys.map(k => ({ label: k, value: m[k], pct: Math.round(m[k] / total * 100), color: colors[k] ?? "var(--brand-300)" })) };
  }, [paidItems]);

  const revenueBars = useMemo(() => {
    const days = 14, dayMs = 86_400_000;
    const now = new Date(); const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const buckets = new Array(days).fill(0) as number[];
    for (const p of paidItems) {
      if (!p.paidAt) continue;
      const pd = new Date(p.paidAt); const pd0 = new Date(pd.getFullYear(), pd.getMonth(), pd.getDate()).getTime();
      const back = Math.round((t0 - pd0) / dayMs);
      const idx = days - 1 - back;
      if (idx >= 0 && idx < days) buckets[idx] += netOf(p);
    }
    const max = Math.max(1, ...buckets);
    return { buckets, max, startLabel: `${new Date(t0 - 13 * dayMs).getDate()} ${MONTHS_AZ[new Date(t0 - 13 * dayMs).getMonth()]}`, endLabel: `${now.getDate()} ${MONTHS_AZ[now.getMonth()]}` };
  }, [paidItems]);

  const psychOptions = useMemo(
    () => Array.from(new Set(items.map(p => p.psychologistName).filter(Boolean))) as string[],
    [items]);

  const payouts = useMemo(() => {
    const by: Record<string, { gross: number; comm: number; n: number }> = {};
    for (const p of paidItems) {
      const name = p.psychologistName; if (!name) continue;
      (by[name] ??= { gross: 0, comm: 0, n: 0 });
      by[name].gross += netOf(p); by[name].comm += commOf(p); by[name].n++;
    }
    let totGross = 0, totComm = 0;
    const rows = Object.keys(by).map((name, i) => {
      const g = by[name].gross; const c = by[name].comm;
      totGross += g; totComm += c;
      return { name, sessions: by[name].n, gross: g, comm: c, net: g - c, avatarClass: avatarClassOf(i) };
    });
    return { rows, totGross, totComm, totNet: totGross - totComm };
  }, [paidItems]);

  const rows = useMemo(() => {
    let r = items.filter(p => GROUPS[tab].includes(p.status as Status));
    const q = search.trim().toLowerCase();
    if (q) r = r.filter(p => (p.patientName ?? "").toLowerCase().includes(q) || (p.patientPhone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, "")));
    if (method !== "all") r = r.filter(p => p.method === method);
    if (psych !== "all") r = r.filter(p => p.psychologistName === psych);
    if (mineOnly) r = r.filter(p => p.claimedByOperatorId === meId);
    if (sort === "amount-desc") r = [...r].sort((a, b) => b.amount - a.amount);
    else if (sort === "amount-asc") r = [...r].sort((a, b) => a.amount - b.amount);
    else r = [...r].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return r;
  }, [items, tab, search, method, psych, mineOnly, sort, meId]);
  const rowSum = useMemo(() => rows.reduce((a, p) => a + p.amount, 0), [rows]);

  const selectedIds = Object.keys(selected).map(Number);
  const drawerItem = items.find(p => p.id === drawerId) ?? null;

  // ── Əməliyyatlar ───────────────────────────────────────────────────────────
  const toggleSel = (id: number) => setSelected(s => { const n = { ...s }; if (n[id]) delete n[id]; else n[id] = true; return n; });

  const onPaid = (p: PaymentItem, method: string) => {
    patch(p.id, { status: "PAID", paidAt: new Date().toISOString(), method });
    uiToast(`${p.patientName} — ödəniş təsdiqləndi`, "success");
    setPayFor(null);
  };

  const bulkPay = async () => {
    const targets = items.filter(p => selected[p.id] && p.status === "PENDING");
    if (targets.length === 0) { uiToast("Seçilənlər arasında gözləyən ödəniş yoxdur", "info"); return; }
    const ok = await confirmDialog({
      title: "Toplu təsdiq",
      message: `${targets.length} ödəniş «ödənildi» kimi işarələnəcək. Davam edilsin?`,
      confirmLabel: "Təsdiqlə",
    });
    if (!ok) return;
    let done = 0;
    for (const p of targets) {
      try { await operatorApi.markPaymentPaid(p.id); patch(p.id, { status: "PAID", paidAt: new Date().toISOString() }); done++; } catch { /* davam et */ }
    }
    setSelected({});
    uiToast(`${done} ödəniş təsdiqləndi${done < targets.length ? ` · ${targets.length - done} alınmadı` : ""}`, done > 0 ? "success" : "error");
  };

  const onCancelled = (p: PaymentItem) => { setCancelFor(null); patch(p.id, p); uiToast(`${p.patientName} — ödəniş ləğv edildi`, "success"); };
  const onRefundRequested = () => { setRefundFor(null); load(); uiToast("İadə tələbi Admin təsdiqinə göndərildi — təsdiqdən sonra icra olunacaq", "info"); };

  const remind = (p: PaymentItem) => {
    setReminded(r => ({ ...r, [p.id]: true }));
    if (p.patientPhone) window.open(`https://wa.me/${p.patientPhone.replace(/[^\d]/g, "")}`, "_blank", "noopener");
    uiToast("WhatsApp xatırlatması açıldı", "success");
  };
  const callPatient = (p: PaymentItem) => { if (p.patientPhone) window.location.href = `tel:${p.patientPhone.replace(/\s/g, "")}`; };
  const viewPatient = (p: PaymentItem) => { if (p.patientId != null) router.push(`/operator/customers/${p.patientId}`); };

  const exportExcel = (list: PaymentItem[]) => {
    if (list.length === 0) { uiToast("Export ediləcək ödəniş yoxdur", "info"); return; }
    const data = list.map(p => ({
      ID: p.id,
      Pasiyent: p.patientName,
      Psixoloq: p.psychologistName ?? "",
      Məbləğ: p.amount,
      Valyuta: p.currency,
      Status: PILL_LABEL[p.status as Status] ?? p.status,
      Üsul: p.method,
      Komissiya: p.commissionAmount ?? "",
      "Geri qaytarılan": p.refundedAmount ?? "",
      Tarix: fmtDay(p.paidAt ?? p.createdAt),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ödənişlər");
    XLSX.writeFile(wb, `odenisler-${new Date().toISOString().slice(0, 10)}.xlsx`);
    uiToast(`${list.length} ödəniş export edildi`, "success");
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>

      {/* Başlıq */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <h1 className="fx-h1" style={{ marginBottom: 5 }}>Ödənişlər</h1>
          <div className="fx-subtitle">Maliyyə əməliyyatları · {fmtToday()}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => exportExcel(rows)} className="fx-btn fx-btn--ghost">
            <Ic d={["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"]} /> Export
          </button>
          <button type="button" onClick={() => { uiToast("Ödəniş seans/paket satışından yaranır", "info"); router.push("/operator/appointments"); }} className="fx-btn fx-btn--primary">
            <Ic d={["M12 5v14", "M5 12h14"]} sw={2} /> Yeni ödəniş
          </button>
        </div>
      </div>

      {loading ? <PageSkeleton /> : error ? (
        <ErrorState title="Ödənişlər yüklənmədi" sub="Bağlantı və ya server problemi ola bilər. Yenidən cəhd edin." onRetry={load} />
      ) : (
        <>
          {/* 1) KPI zolağı */}
          <div className="fx-card fx-card--lg fx-kpi-row pm-kpi" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
            <Kpi label="Bu gün yığılan" value={todaySum} sub={`${paidItems.filter(p => p.paidAt && isToday(p.paidAt)).length} ödəniş`} />
            <Kpi label="Bu ay gəlir" value={paidMonthSum} sub={`${paidItems.length} ödəniş`} />
            <Kpi label="Gözləyən məbləğ" value={pendingSum} sub={<><span style={{ color: "var(--amber)", fontWeight: 600 }}>{overdue.length} gecikmiş</span> · {pending.length} ödəniş</>} />
            <Kpi label="Geri qaytarılan" value={refundedSum} sub={`bu ay · ${items.filter(p => (p.refundedAmount ?? 0) > 0).length} əməliyyat`} />
          </div>

          {/* Qrafiklər */}
          <div className="pm-charts" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Gəlir dinamikası */}
            <div className="fx-card fx-card__pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford-80)" }}>Gəlir dinamikası</div>
                <div style={{ fontSize: "var(--text-micro)", color: "var(--oxford-60)" }}>Son 14 gün</div>
              </div>
              <svg viewBox="0 0 322 76" style={{ width: "100%", height: 76 }} preserveAspectRatio="none">
                <line x1="0" y1="70" x2="322" y2="70" stroke="var(--hairline)" strokeWidth="1" />
                {revenueBars.buckets.map((v, i) => {
                  const h = Math.max(2, Math.round(v / revenueBars.max * 56));
                  const fill = i >= 11 ? "#4A9B7F" : i >= 7 ? "#6FB395" : i >= 3 ? "#9CCBB5" : "#B9DACB";
                  return <rect key={i} x={2 + i * 23} y={70 - h} width={14} height={h} rx={3} fill={fill} />;
                })}
              </svg>
              <div className="fx-num" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--oxford-60)" }}>
                <span>{revenueBars.startLabel}</span><span>{revenueBars.endLabel}</span>
              </div>
            </div>

            {/* Üsul bölgüsü */}
            <div className="fx-card fx-card__pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford-80)" }}>Ödəniş üsulu bölgüsü</div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <MethodDonut total={methodMix.total} rows={methodMix.rows} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, flex: 1 }}>
                  {methodMix.rows.length === 0 && <span className="fx-muted">Data yoxdur</span>}
                  {methodMix.rows.map(r => (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color }} />
                      <span style={{ color: "var(--oxford-80)", flex: 1 }}>{r.label}</span>
                      <span className="fx-num" style={{ fontWeight: 700 }}>{r.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Yığım dərəcəsi */}
            <div className="fx-card fx-card__pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford-80)" }}>Yığım dərəcəsi</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="fx-num" style={{ fontSize: 28, fontWeight: 800 }}>{collectionRate}%</span>
                <span style={{ fontSize: 12, color: "var(--oxford-60)" }}>ödənilən / ümumi</span>
              </div>
              <div className="fx-progress fx-progress--lg">
                <div className="fx-progress__fill" style={{ width: `${collectionRate}%` }} />
              </div>
              <div className="fx-num" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--oxford-60)" }}>
                <span><b style={{ color: "var(--brand)" }}>{fmtNum(paidMonthSum)} AZN</b> ödənilib</span>
                <span><b style={{ color: "var(--amber)" }}>{fmtNum(pendingSum)} AZN</b> gözləyir</span>
              </div>
            </div>
          </div>

          {/* 2) Diqqət tələb edən */}
          {pending.length > 0 && (
            <div className="fx-card fx-card--attention" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 24px", borderBottom: "1px solid var(--hairline)" }}>
                <span style={{ display: "inline-flex", width: 32, height: 32, borderRadius: 10, background: "var(--status-pending-bg)", color: "var(--status-pending-fg)", alignItems: "center", justifyContent: "center" }}>
                  <Ic d={["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4", "M12 17h.01"]} />
                </span>
                <div style={{ flex: 1 }}>
                  <div className="fx-card-title">Diqqət tələb edən ödənişlər</div>
                  <div className="fx-num" style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>{pending.length} ödəniş · {fmtNum(pendingSum)} AZN yığılmayıb</div>
                </div>
                {overdue.length > 0 && <span className="fx-pill fx-pill--pending fx-num">{overdue.length} gecikmiş (24+ saat)</span>}
              </div>
              {[...pending].sort((a, b) => ageHours(b.createdAt) - ageHours(a.createdAt)).map(p => {
                const h = ageHours(p.createdAt);
                const agePillClass = h >= 48 ? "fx-pill--refunded" : h >= 24 ? "fx-pill--pending" : "fx-pill--neutral";
                return (
                  <div key={p.id} className="pm-attn-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 24px", borderTop: "1px solid var(--hairline)" }}>
                    <span className={`fx-avatar fx-avatar--sm ${avatarClassOf(p.id)}`}>{initialsOf(p.patientName)}</span>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 170 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.patientName}</span>
                      <span style={{ fontSize: 11.5, color: "var(--oxford-60)" }}>{linkLabel(p)}{p.psychologistName ? ` · ${p.psychologistName}` : ""}</span>
                    </div>
                    <span className={`fx-pill ${agePillClass} fx-num`} style={{ whiteSpace: "nowrap" }}>{ageLabel(h)}</span>
                    <div className="fx-spacer" />
                    <span className="fx-num" style={{ fontSize: 15, fontWeight: 700, minWidth: 84, textAlign: "right" }}>{fmtNum(p.amount)} <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--oxford-60)" }}>AZN</span></span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {p.patientId != null && <MiniBtn onClick={() => viewPatient(p)} d={["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"]}>Pasiyentə bax</MiniBtn>}
                      {p.patientPhone && <MiniBtn onClick={() => callPatient(p)} d={["M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"]}>Zəng</MiniBtn>}
                      {reminded[p.id] ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--sage)", padding: "6px 11px", whiteSpace: "nowrap" }}>
                          <Ic d="M20 6L9 17l-5-5" sw={2.2} w={13} /> Xatırladıldı
                        </span>
                      ) : (
                        <button type="button" onClick={() => remind(p)} className="fx-btn fx-btn--warn-ghost fx-btn--sm" style={{ whiteSpace: "nowrap" }}>
                          <Ic d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" w={13} /> WhatsApp ilə xatırlat
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3+4) Alətlər + siyahı */}
          <div className="fx-card" style={{ marginBottom: 24, overflow: "hidden" }}>
            {/* Tablar */}
            <div className="fx-tabs" style={{ padding: "14px 20px 0 20px", flexWrap: "wrap" }}>
              {TABS.map(tt => {
                const active = tab === tt.key;
                return (
                  <button key={tt.key} type="button" onClick={() => { setTab(tt.key); setSelected({}); }}
                    className={`fx-tab ${active ? "fx-tab--active" : ""}`}>
                    {tt.label}
                    <span className={`fx-pill fx-pill--count ${active ? "fx-pill--count-active" : ""} fx-num`}>{counts[tt.key]}</span>
                  </button>
                );
              })}
            </div>
            <div className="fx-hairline" />

            {/* Filtr zolağı */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
              <div className="fx-search" style={{ flex: 1, minWidth: 200, maxWidth: 300 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} aria-label="Ödəniş axtar" placeholder="Ad və ya telefon üzrə axtar" />
              </div>
              <select value={method} onChange={e => setMethod(e.target.value)} aria-label="Üsul" className="fx-select fx-select--inline">
                <option value="all">Bütün üsullar</option><option value="Kart">Kart</option><option value="Nağd">Nağd</option><option value="Köçürmə">Köçürmə</option>
              </select>
              {psychOptions.length > 0 && (
                <select value={psych} onChange={e => setPsych(e.target.value)} aria-label="Psixoloq" className="fx-select fx-select--inline">
                  <option value="all">Bütün psixoloqlar</option>
                  {psychOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
              <span className="fx-chip fx-num">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>
                {monthRange()}
              </span>
              <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label="Sıralama" className="fx-select fx-select--inline">
                <option value="date">Ən yeni</option><option value="amount-desc">Məbləğ: çoxdan aza</option><option value="amount-asc">Məbləğ: azdan çoxa</option>
              </select>
              <div className="fx-spacer" />
              <button type="button" onClick={() => setMineOnly(v => !v)} className={`fx-toggle-chip ${mineOnly ? "fx-toggle-chip--active" : ""}`}>
                <span className="fx-dot" /> Mənim
              </button>
            </div>

            {/* Sətirlər — .fx-row bu qədər sütunla (checkbox+avatar+ad+2 pill+məbləğ+3 əməliyyat)
                dar ekranda kart eninə sığmaya bilər; kartın özü overflow:hidden olduğu üçün
                (guşələrin dəyirmiləşməsi üçün) əlavə sarğı olmadan sağ tərəf sadəcə kəsilib
                görünməz olurdu — üfüqi scroll ilə əvəzləndi. */}
            <div style={{ overflowX: "auto" }}>
              {rows.length === 0 ? (
                <div style={{ padding: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, borderTop: "1px solid var(--hairline)" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--brand-300)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--oxford-80)" }}>Nəticə tapılmadı</div>
                  <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Axtarış və ya filtr şərtlərini dəyişin</div>
                </div>
              ) : rows.map(p => (
                <PayRow key={p.id} p={p} selected={!!selected[p.id]} onToggle={() => toggleSel(p.id)}
                  onOpen={() => setDrawerId(p.id)} onPay={() => setPayFor(p)} onCancel={() => setCancelFor(p)} onRefund={() => setRefundFor(p)} />
              ))}
            </div>

            <div className="fx-num" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid var(--hairline)", fontSize: 12, color: "var(--oxford-60)" }}>
              <span>{rows.length} nəticə göstərilir</span>
              <span>Cəm: <b style={{ color: "var(--oxford)" }}>{fmtNum(rowSum)} AZN</b></span>
            </div>
          </div>

          {/* 6) Komissiya / payout */}
          {payouts.rows.length > 0 && (
            <div className="pm-payout" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 32 }}>
              <div className="fx-card" style={{ overflow: "hidden" }}>
                <div className="fx-card__head">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Psixoloq üzrə bu ay</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", padding: "10px 24px", fontSize: "var(--text-label)", fontWeight: 600, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid var(--hairline)" }}>
                  <span>Psixoloq</span><span style={{ textAlign: "right" }}>Gəlir</span><span style={{ textAlign: "right" }}>Platforma</span><span style={{ textAlign: "right" }}>Ödəniləcək</span>
                </div>
                {payouts.rows.map(r => (
                  <div key={r.name} className="pm-grid-row" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", alignItems: "center", padding: "13px 24px", borderTop: "1px solid var(--hairline)", fontSize: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className={`fx-avatar fx-avatar--sm ${r.avatarClass}`}>{initialsOf(r.name.replace("Dr. ", ""))}</span>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600 }}>{r.name}</span>
                        <span className="fx-num" style={{ fontSize: 11.5, color: "var(--oxford-60)" }}>{r.sessions} ödəniş</span>
                      </div>
                    </div>
                    <span className="fx-num" style={{ textAlign: "right", fontWeight: 600 }}>{fmtNum(r.gross)}</span>
                    <span className="fx-num" style={{ textAlign: "right", color: "var(--oxford-60)" }}>{fmtNum(r.comm)}</span>
                    <span className="fx-num" style={{ textAlign: "right", fontWeight: 700, color: "var(--sage)" }}>{fmtNum(r.net)}</span>
                  </div>
                ))}
                <div className="fx-num" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", padding: "13px 24px", borderTop: "1px solid var(--hairline)", fontSize: 13, fontWeight: 700, background: "var(--bg)" }}>
                  <span>Cəm</span>
                  <span style={{ textAlign: "right" }}>{fmtNum(payouts.totGross)}</span>
                  <span style={{ textAlign: "right", color: "var(--oxford-60)" }}>{fmtNum(payouts.totComm)}</span>
                  <span style={{ textAlign: "right", color: "var(--sage)" }}>{fmtNum(payouts.totNet)}</span>
                </div>
              </div>

              <div className="fx-card fx-card__pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Komissiya bölgüsü — bu ay</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className="fx-num" style={{ fontSize: 26, fontWeight: 800 }}>{fmtNum(payouts.totComm)}</span>
                  <span style={{ fontSize: 13, color: "var(--oxford-60)" }}>AZN platforma payı</span>
                </div>
                <div className="fx-progress fx-progress--lg">
                  <div className="fx-progress__fill" style={{ width: `${payouts.totGross ? Math.round((payouts.totComm / payouts.totGross) * 100) : 0}%` }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5 }}>
                  <LegendRow color="var(--brand)" label="Platforma payı" value={`${fmtNum(payouts.totComm)} AZN`} />
                  <LegendRow color="var(--brand-100)" label="Psixoloqlara ödəniləcək" value={`${fmtNum(payouts.totNet)} AZN`} />
                </div>
                <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14, display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--oxford-60)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>
                  Növbəti payout: {nextPayout()}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Toplu əməliyyat paneli */}
      {selectedIds.length > 0 && (
        <div className="fx-bulkbar">
          <span className="fx-num" style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.length} seçildi</span>
          <span className="fx-bulkbar__divider" />
          <button type="button" onClick={bulkPay} className="fx-btn fx-btn--primary fx-btn--sm">Toplu ödənildi</button>
          <button type="button" onClick={() => { exportExcel(items.filter(p => selected[p.id])); setSelected({}); }} className="fx-btn fx-btn--dark-outline fx-btn--sm">
            <Ic d={["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"]} /> Export
          </button>
          <button type="button" onClick={() => setSelected({})} aria-label="Seçimi təmizlə" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", display: "flex", padding: 4 }}>
            <Ic d={["M18 6L6 18", "M6 6l12 12"]} sw={2} />
          </button>
        </div>
      )}

      {/* Detal drawer */}
      {drawerItem && <Drawer p={drawerItem} onClose={() => setDrawerId(null)} onCall={() => callPatient(drawerItem)} onWhatsapp={() => remind(drawerItem)} onViewLinked={() => viewPatient(drawerItem)} />}

      {refundFor && <RefundModal payment={refundFor} onClose={() => setRefundFor(null)} onDone={onRefundRequested} />}
      {cancelFor && <CancelModal payment={cancelFor} onClose={() => setCancelFor(null)} onDone={onCancelled} />}
      {payFor && <MarkPaidModal payment={payFor} onClose={() => setPayFor(null)} onDone={onPaid} />}
    </div>
  );
}

// ─── KPI ──────────────────────────────────────────────────────────────────────
function Kpi({ label, value, sub }: { label: string; value: number; sub: ReactNode }) {
  return (
    <div className="fx-kpi">
      <span className="fx-label">{label}</span>
      <span className="fx-kpi__value fx-num">{fmtNum(value)} <span className="fx-kpi__unit">AZN</span></span>
      <span className="fx-kpi__meta">{sub}</span>
    </div>
  );
}

function MethodDonut({ total, rows }: { total: number; rows: { label: string; value: number; pct: number; color: string }[] }) {
  const C = 2 * Math.PI * 34;
  // Offset-lər saf prefix-sum ilə — render zamanı heç bir dəyişən mutasiyası yoxdur.
  const lens = rows.map(r => (r.value / (total || 1)) * C);
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <svg width="92" height="92" viewBox="0 0 92 92">
      <g transform="rotate(-90 46 46)">
        <circle cx="46" cy="46" r="34" fill="none" stroke="var(--bg-blue)" strokeWidth="12" />
        {rows.map((r, i) => (
          <circle key={r.label} cx="46" cy="46" r="34" fill="none" stroke={r.color} strokeWidth="12" strokeDasharray={`${lens[i]} ${C - lens[i]}`} strokeDashoffset={-offsets[i]} />
        ))}
      </g>
      <text x="46" y="43" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--oxford)" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtNum(total)}</text>
      <text x="46" y="57" textAnchor="middle" fontSize="9" fill="var(--oxford-60)">AZN</text>
    </svg>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
      <span style={{ color: "var(--oxford-80)", flex: 1 }}>{label}</span>
      <span className="fx-num" style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function MiniBtn({ onClick, d, children }: { onClick: () => void; d: string | string[]; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="fx-btn fx-btn--ghost fx-btn--sm" style={{ whiteSpace: "nowrap" }}>
      <Ic d={d} w={13} /> {children}
    </button>
  );
}

// ─── Siyahı sətri ─────────────────────────────────────────────────────────────
function PayRow({ p, selected, onToggle, onOpen, onPay, onCancel, onRefund }: {
  p: PaymentItem; selected: boolean; onToggle: () => void; onOpen: () => void;
  onPay: () => void; onCancel: () => void; onRefund: () => void;
}) {
  const st = p.status as Status;
  const refunded = p.refundedAmount ?? 0;
  const canPay = st === "PENDING";
  const canRefund = st === "PAID" || st === "PARTIALLY_REFUNDED";
  const showNote = !!p.statusNote && (st === "REFUNDED" || st === "CANCELLED");
  return (
    <div className="fx-row" onClick={onOpen}>
      <input type="checkbox" checked={selected} onChange={onToggle} onClick={e => e.stopPropagation()} aria-label="Seç" className="fx-checkbox" />
      <span className={`fx-avatar ${avatarClassOf(p.id)}`}>{initialsOf(p.patientName)}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 210 }}>
        <span className="fx-row__title">{p.patientName}</span>
        <div className="fx-row__meta">
          <MethodIcon method={p.method} />
          <span>{p.method}</span><span className="fx-sep">·</span>
          <span className="fx-num">{fmtDay(p.createdAt)}</span><span className="fx-sep">·</span>
          <span>{linkLabel(p)}</span>
        </div>
        {showNote && <span style={{ fontSize: 11.5, color: "var(--status-partial-fg)", fontStyle: "italic" }}>«{p.statusNote}»</span>}
      </div>
      <span className={`fx-pill ${PILL_CLASS[st] ?? "fx-pill--pending"}`} style={{ whiteSpace: "nowrap" }}>{PILL_LABEL[st] ?? PILL_LABEL.PENDING}</span>
      {originLabel(p) && <span className="fx-pill fx-pill--neutral" style={{ whiteSpace: "nowrap" }}>{originLabel(p)}</span>}
      <div className="fx-spacer" />
      <div className="fx-row__amount" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, minWidth: 130 }}>
        <span className="fx-num">{fmtNum(p.amount)} <small>AZN</small></span>
        {refunded > 0 && <span className="fx-num" style={{ fontSize: 11.5, color: "var(--status-partial-fg)", fontWeight: 400 }}>qaytarılıb {fmtNum(refunded)} · qalıq {fmtNum(p.amount - refunded)}</span>}
        {st === "PAID" && <span className="fx-num" style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 400 }}>komissiya {fmtNum(commOf(p))} AZN</span>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 196, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
        {canPay && <button type="button" onClick={onPay} className="fx-btn fx-btn--primary fx-btn--sm">Ödənildi</button>}
        {canPay && <button type="button" onClick={onCancel} className="fx-btn fx-btn--ghost fx-btn--sm">Ləğv</button>}
        {canRefund && <button type="button" onClick={onRefund} className="fx-btn fx-btn--danger-ghost fx-btn--sm">İadə</button>}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-200)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </div>
    </div>
  );
}

function MethodIcon({ method }: { method: string }) {
  if (method === "Nağd") return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>;
  if (method === "Köçürmə") return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4-4 4" /><path d="M21 7H9" /><path d="M7 21l-4-4 4-4" /><path d="M3 17h12" /></svg>;
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>;
}

// ─── Detal drawer ─────────────────────────────────────────────────────────────
type TlKind = "soft" | "sage" | "amber" | "rose" | "muted";
function Drawer({ p, onClose, onCall, onWhatsapp, onViewLinked }: { p: PaymentItem; onClose: () => void; onCall: () => void; onWhatsapp: () => void; onViewLinked: () => void }) {
  const st = p.status as Status;
  const comm = commOf(p);
  const origin = originLabel(p);
  const timeline: { title: string; who: string; time?: string | null; note?: string | null; kind: TlKind }[] = [];
  timeline.push({ title: "Yaradıldı", who: p.claimedByName ?? "Operator", time: p.createdAt, kind: "soft" });
  if (p.paidAt) timeline.push({ title: "Təsdiqləndi — ödənilib", who: p.claimedByName ?? "Operator", time: p.paidAt, kind: "sage" });
  if (st === "PARTIALLY_REFUNDED") timeline.push({ title: `Qismi qaytarıldı — ${fmtNum(p.refundedAmount ?? 0)} AZN`, who: p.claimedByName ?? "Operator", time: null, note: p.statusNote, kind: "amber" });
  if (st === "REFUNDED") timeline.push({ title: "Tam geri qaytarıldı", who: p.claimedByName ?? "Operator", time: null, note: p.statusNote, kind: "rose" });
  if (st === "CANCELLED") timeline.push({ title: "Ləğv edildi", who: p.claimedByName ?? "Operator", time: p.createdAt, note: p.statusNote, kind: "muted" });

  return (
    <>
      <div onClick={onClose} className="fx-overlay" />
      <div className="fx-drawer">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "24px 26px", borderBottom: "1px solid var(--hairline)" }}>
          <span className={`fx-avatar fx-avatar--md ${avatarClassOf(p.id)}`}>{initialsOf(p.patientName)}</span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
            <div className="fx-h3">{p.patientName}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="fx-num" style={{ fontSize: 20, fontWeight: 800 }}>{fmtNum(p.amount)} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford-60)" }}>AZN</span></span>
              <span className={`fx-pill ${PILL_CLASS[st] ?? "fx-pill--pending"}`}>{PILL_LABEL[st] ?? PILL_LABEL.PENDING}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Bağla" className="fx-iconbtn">
            <Ic d={["M18 6L6 18", "M6 6l12 12"]} sw={2} w={18} />
          </button>
        </div>

        <div className="fx-drawer__section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", fontSize: 13 }}>
          <Meta label="Üsul" value={p.method} />
          <Meta label="Yaradılıb" value={fmtDay(p.createdAt)} />
          <Meta label="Operator" value={p.claimedByName ?? "—"} />
          <Meta label="Bağlı" value={linkLabel(p)} onClick={p.patientId != null ? onViewLinked : undefined} />
          {p.psychologistName && <Meta label="Psixoloq" value={p.psychologistName} />}
          {origin && <Meta label="Mənbə" value={origin} />}
          {p.patientPhone && <Meta label="Telefon" value={p.patientPhone} />}
        </div>

        {/* Audit izi */}
        <div className="fx-drawer__section">
          <div className="fx-section-label" style={{ marginBottom: 14 }}>Audit izi</div>
          <div className="fx-timeline">
            {timeline.map((ev, i) => (
              <div key={i} className="fx-tl-item">
                <div className="fx-tl-rail">
                  <span className={`fx-tl-dot fx-tl-dot--${ev.kind}`} />
                  {i < timeline.length - 1 && <span className="fx-tl-line" />}
                </div>
                <div className="fx-tl-body">
                  <span className="fx-tl-title">{ev.title}</span>
                  <span className="fx-tl-meta">{ev.who}{ev.time ? ` · ${fmtDay(ev.time)}` : ""}</span>
                  {ev.note && <span className="fx-tl-note">«{ev.note}»</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Komissiya */}
        <div className="fx-drawer__section">
          <div className="fx-section-label" style={{ marginBottom: 14 }}>Komissiya bölgüsü</div>
          <div className="fx-progress fx-progress--lg" style={{ marginBottom: 12 }}>
            <div className="fx-progress__fill" style={{ width: `${p.amount ? Math.round((comm / p.amount) * 100) : 0}%` }} />
          </div>
          <div className="fx-num" style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--oxford-60)" }}>Ümumi məbləğ</span><b>{fmtNum(p.amount)} AZN</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--oxford-60)" }}><span style={{ width: 8, height: 8, borderRadius: 2.5, background: "var(--brand)" }} />Platforma payı</span><span style={{ fontWeight: 600 }}>{fmtNum(comm)} AZN</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--oxford-60)" }}><span style={{ width: 8, height: 8, borderRadius: 2.5, background: "var(--brand-100)" }} />Psixoloq payı{p.psychologistName ? ` — ${p.psychologistName}` : ""}</span><b style={{ color: "var(--sage)" }}>{fmtNum(p.amount - comm)} AZN</b></div>
          </div>
        </div>

        {/* Əlaqə */}
        {(p.patientPhone) && (
          <div style={{ padding: "20px 26px", display: "flex", gap: 10 }}>
            <button type="button" onClick={onCall} className="fx-btn fx-btn--ghost" style={{ flex: 1 }}>
              <Ic d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" w={14} /> Zəng et
            </button>
            <button type="button" onClick={onWhatsapp} className="fx-btn fx-btn--ghost" style={{ flex: 1 }}>
              <Ic d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" w={14} /> WhatsApp yaz
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Meta({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="fx-label">{label}</span>
      {onClick
        ? <button type="button" onClick={onClick} className="fx-num" style={{ fontWeight: 600, color: "var(--brand)", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, textAlign: "left" }}>{value}</button>
        : <span className="fx-num" style={{ fontWeight: 600 }}>{value}</span>}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="fx-card fx-card--lg" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ padding: "22px 26px", borderLeft: i ? "1px solid var(--hairline)" : "none" }}>
            <div className="fx-skeleton" style={{ width: 90, height: 11 }} />
            <div className="fx-skeleton" style={{ width: 110, height: 26, marginTop: 12 }} />
            <div className="fx-skeleton" style={{ width: 70, height: 11, marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="fx-card" style={{ padding: "6px 12px 10px" }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, borderTop: i ? "1px solid var(--hairline)" : "none", padding: "15px 8px" }}>
            <div className="fx-skeleton fx-skeleton--circle" style={{ width: 38, height: 38 }} />
            <div style={{ flex: 1 }}>
              <div className="fx-skeleton" style={{ width: "45%", height: 13 }} />
              <div className="fx-skeleton" style={{ width: "65%", height: 10, marginTop: 8 }} />
            </div>
            <div className="fx-skeleton" style={{ width: 80, height: 30 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Kiçik ikon köməkçisi ─────────────────────────────────────────────────────
function Ic({ d, w = 15, sw = 1.8 }: { d: string | string[]; w?: number; sw?: number }) {
  const paths = Array.isArray(d) ? d : [d];
  return <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{paths.map((p, i) => <path key={i} d={p} />)}</svg>;
}

// ─── Tarix köməkçiləri ────────────────────────────────────────────────────────
function fmtToday() {
  const days = ["Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə"];
  const d = new Date();
  return `${days[d.getDay()]}, ${d.getDate()} ${MONTHS_AZ[d.getMonth()]} ${d.getFullYear()}`;
}
function isToday(iso: string) {
  const d = new Date(iso); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function monthRange() {
  const n = new Date();
  const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
  return `1 – ${last} ${MONTHS_AZ[n.getMonth()]}`;
}
function nextPayout() {
  const n = new Date();
  let mo = n.getMonth(), yr = n.getFullYear();
  if (n.getDate() >= 15) { mo++; if (mo > 11) { mo = 0; yr++; } }
  return `15 ${MONTHS_AZ[mo]} ${yr}`;
}

// ─── Geri qaytarma / ləğv modalları ───────────────────────────────────────────
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
    <ModalShell icon="rose" iconD={["M1 4v6h6", "M3.51 15a9 9 0 1 0 2.13-9.36L1 10"]} title="İadə tələbi" onClose={onClose}>
      <div className="fx-modal__text">{payment.patientName} · ödəniş {formatAzn(payment.amount)} · qalıq {formatAzn(remaining)}</div>
      <ModalField label="Geri qaytarılacaq məbləğ (₼)">
        <input type="number" min={0} step="0.01" max={remaining} value={amount} onChange={e => setAmount(e.target.value)} className="fx-input" style={{ fontSize: 15 }} autoFocus />
      </ModalField>
      <div style={{ display: "flex", gap: 8, marginTop: -4 }}>
        <button type="button" onClick={() => setAmount(String(remaining))} className="fx-btn fx-btn--warn-ghost fx-btn--sm">Tam ({formatAzn(remaining)})</button>
        <button type="button" onClick={() => setAmount(String(Math.round(remaining / 2 * 100) / 100))} className="fx-btn fx-btn--ghost fx-btn--sm">Yarısı</button>
      </div>
      <ModalField label="Səbəb (məcburi)">
        <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Geri qaytarma səbəbi…" className="fx-textarea" />
      </ModalField>
      <div className="fx-banner fx-banner--info">
        <Ic d={["M12 16v-4", "M12 8h.01"]} sw={2} w={14} />
        <span>Bütün iadələr (tam və qismi) Admin təsdiqindən keçir — tələb təsdiqlənəndə icra olunacaq.{payment.patientPackageId != null && " Paket ödənişidirsə icra zamanı qalan seanslar bağlanacaq."}</span>
      </div>
      {err && <ModalError>{err}</ModalError>}
      <ModalFooter onClose={onClose} onSubmit={submit} disabled={!ready || busy} label={busy ? "Göndərilir…" : `${formatAzn(amtOk ? amt : 0)} üçün tələb göndər`} />
    </ModalShell>
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
    <ModalShell icon="rose" iconD={["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4", "M12 17h.01"]} title="Ödənişi ləğv et" onClose={onClose}>
      <div className="fx-modal__text">{payment.patientName} · {formatAzn(payment.amount)} · gözləyən ödəniş</div>
      <ModalField label="Ləğv səbəbi (məcburi)">
        <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ləğv səbəbi…" className="fx-textarea" autoFocus />
      </ModalField>
      {payment.patientPackageId != null && (
        <div className="fx-banner fx-banner--warn">
          <Ic d={["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4", "M12 17h.01"]} sw={2} w={14} />
          <span>Paket ödənişidir — paket də ləğv olunacaq (qalan seanslar bağlanır).</span>
        </div>
      )}
      {err && <ModalError>{err}</ModalError>}
      <ModalFooter onClose={onClose} onSubmit={submit} disabled={!ready || busy} label={busy ? "Göndərilir…" : "Ödənişi ləğv et"} />
    </ModalShell>
  );
}

function MarkPaidModal({ payment, onClose, onDone }: { payment: PaymentItem; onClose: () => void; onDone: (p: PaymentItem, method: string) => void }) {
  const [method, setMethod] = useState<string>(PAYMENT_METHOD_OPTIONS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const updated = await operatorApi.markPaymentPaid(payment.id, method);
      onDone(updated, method);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <ModalShell icon="brand" iconD="M20 6L9 17l-5-5" title="Ödənişi təsdiqlə" onClose={onClose}>
      <div className="fx-modal__text">{payment.patientName} üçün {formatAzn(payment.amount)} ödənişini təsdiqləmək istəyirsiniz? Bu əməliyyat audit izinə və maliyyə hesabatına düşür.</div>
      <ModalField label="Ödəniş üsulu">
        <select value={method} onChange={e => setMethod(e.target.value)} className="fx-select" autoFocus>
          {PAYMENT_METHOD_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </ModalField>
      {err && <ModalError>{err}</ModalError>}
      <ModalFooter onClose={onClose} onSubmit={submit} disabled={busy} label={busy ? "Göndərilir…" : "Ödənildi"} />
    </ModalShell>
  );
}

function ModalShell({ icon, iconD, title, onClose, children }: { icon: "rose" | "brand" | "amber"; iconD: string | string[]; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fx-overlay fx-overlay--center" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="fx-modal">
        <div className={`fx-modal__icon fx-modal__icon--${icon}`}>
          <Ic d={iconD} w={19} />
        </div>
        <h3 className="fx-h3">{title}</h3>
        {children}
      </div>
    </div>
  );
}
function ModalField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="fx-field">{label && <span className="fx-label" style={{ textTransform: "none", letterSpacing: 0 }}>{label}</span>}{children}</label>;
}
function ModalError({ children }: { children: ReactNode }) {
  return (
    <div className="fx-banner fx-banner--error">
      <Ic d={["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4", "M12 17h.01"]} sw={2} w={14} />
      <span>{children}</span>
    </div>
  );
}
function ModalFooter({ onClose, onSubmit, disabled, label }: { onClose: () => void; onSubmit: () => void; disabled: boolean; label: string }) {
  return (
    <div className="fx-modal__actions">
      <button type="button" onClick={onClose} className="fx-btn fx-btn--ghost">İmtina</button>
      <button type="button" onClick={onSubmit} disabled={disabled} className="fx-btn fx-btn--danger" style={{ opacity: disabled ? .5 : 1, cursor: disabled ? "default" : "pointer" }}>{label}</button>
    </div>
  );
}

const CSS = `
.pm-attn-row:hover{background:var(--surface-muted)}
.pm-grid-row:hover{background:var(--surface-muted)}
@media(max-width:1100px){.pm-kpi{grid-template-columns:repeat(2,1fr)!important}.pm-charts{grid-template-columns:1fr!important}.pm-payout{grid-template-columns:1fr!important}}
`;
