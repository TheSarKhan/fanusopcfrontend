"use client";

// Admin ödəniş reyestri — platformanın BÜTÜN ödənişləri. Operator səhifəsindən
// fərqi: sahiblik filtri yoxdur, tam süzgəc dəsti var və əməliyyatlar təsdiq
// gate-inə düşmür (admin qərarı birbaşa icra olunur).
//
// Səhifələmə SERVER tərəfindədir. DİQQƏT: Pagination 1-dən, backend `page` 0-dan
// başlayır — çevirmə aşağıda açıq yazılıb. Süzgəc dəyişəndə səhifə 1-ə qayıdır.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminApi,
  type PaymentItem,
  type PaymentSummary,
  type AdminPaymentQuery,
  type RefundSuggestion,
  type UserRecord,
  type Psychologist,
} from "@/lib/api";
import { azFormatDate, azFormatDateTime } from "@/lib/datetime";
import PanelIcon from "@/components/PanelIcon";
import { toast } from "@/components/Toast";
import DatePicker from "@/components/DatePicker";
import {
  PageHead,
  Card,
  CardPad,
  DataTable,
  Status,
  PaymentStatus,
  Button,
  IconButton,
  SearchInput,
  Select,
  Input,
  Stats,
  Stat,
  Modal,
  Drawer,
  DrawerSection,
  Field,
  Textarea,
  Checkbox,
  Tabs,
  type Column,
  type TabItem,
} from "@/components/ui";

// Tab → status qrupu. "Ödənilmiş" qismi qaytarılmışı da əhatə edir (pul hələ də
// platformadadır); tam qaytarılan ayrıca tabda görünür.
const TABS = [
  { key: "PENDING", label: "Gözləyən", status: "PENDING" },
  { key: "PAID", label: "Ödənilmiş", status: "PAID,PARTIALLY_REFUNDED" },
  { key: "REFUNDED", label: "Geri qaytarılmış", status: "REFUNDED,PARTIALLY_REFUNDED" },
  { key: "CANCELLED", label: "Ləğv edilmiş", status: "CANCELLED" },
  { key: "ALL", label: "Hamısı", status: "PENDING,PAID,PARTIALLY_REFUNDED,REFUNDED,CANCELLED" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const METHODS = ["Nağd", "Kart", "Köçürmə", "MANUAL"];
const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

const money = (v: number | null | undefined, cur = "AZN") =>
  v == null ? "—" : `${Number(v).toFixed(2)} ${cur === "AZN" ? "₼" : cur}`;

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

export default function AdminPaymentsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [tab, setTab] = useState<TabKey>("PENDING");
  const [rows, setRows] = useState<PaymentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Süzgəclər
  const [search, setSearch] = useState("");
  const dq = useDebounce(search, 300).trim();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [method, setMethod] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [psychologistId, setPsychologistId] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const dMin = useDebounce(minAmount, 400);
  const dMax = useDebounce(maxAmount, 400);
  const [zeroCommission, setZeroCommission] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(30);

  // Süzgəc siyahıları — bir dəfə yüklənir.
  const [operators, setOperators] = useState<UserRecord[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);

  const [selected, setSelected] = useState<PaymentItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<{ row: PaymentItem; kind: ActionKind } | null>(null);

  const query: AdminPaymentQuery = useMemo(() => ({
    status: TABS.find(t => t.key === tab)?.status,
    q: dq || undefined,
    from: from || undefined,
    to: to || undefined,
    method: method || undefined,
    operatorId: operatorId ? Number(operatorId) : undefined,
    psychologistId: psychologistId ? Number(psychologistId) : undefined,
    minAmount: dMin ? Number(dMin) : undefined,
    maxAmount: dMax ? Number(dMax) : undefined,
    zeroCommission: zeroCommission || undefined,
    page, size,
  }), [tab, dq, from, to, method, operatorId, psychologistId, dMin, dMax, zeroCommission, page, size]);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminApi.listPaymentsPaged(query)
      .then(r => {
        setRows(r.content ?? []);
        setTotal(r.totalElements ?? 0);
        setTotalPages(Math.max(1, r.totalPages ?? 1));
      })
      .catch(e => setError((e as Error).message || "Ödənişlər yüklənmədi"))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => { load(); }, [load, reloadNonce]);

  // KPI ayrıca yüklənir — siyahı süzgəcindən asılı deyil, qlobal göstəricidir.
  useEffect(() => {
    adminApi.paymentsSummary().then(setSummary).catch(() => { /* KPI kritik deyil */ });
  }, [reloadNonce]);

  // Süzgəc dəyişəndə səhifə 1-ə qayıdır — əks halda boş səhifədə qalır.
  useEffect(() => { setPage(0); },
    [tab, dq, from, to, method, operatorId, psychologistId, dMin, dMax, zeroCommission]);

  useEffect(() => {
    adminApi.getUsers({ role: "OPERATOR", size: 200 })
      .then(r => setOperators(r.content ?? []))
      .catch(() => { /* süzgəc siyahısı kritik deyil */ });
    adminApi.getPsychologists()
      .then(setPsychologists)
      .catch(() => { /* eyni */ });
  }, []);

  const resetFilters = () => {
    setSearch(""); setFrom(""); setTo(""); setMethod("");
    setOperatorId(""); setPsychologistId(""); setMinAmount(""); setMaxAmount("");
    setZeroCommission(false);
  };
  const activeFilterCount =
    [dq, from, to, method, operatorId, psychologistId, dMin, dMax].filter(Boolean).length
    + (zeroCommission ? 1 : 0);

  const tabItems: TabItem<TabKey>[] = TABS.map(t => ({ key: t.key, label: t.label }));

  const columns: Column<PaymentItem>[] = [
    {
      key: "patientName", header: "Müştəri",
      cell: p => (
        <div style={{ minWidth: 0 }}>
          <div className="fx-row__title">
            {p.patientName}
            {p.patientAccountDeleted && <span className="fx-subtitle"> (silinmiş)</span>}
          </div>
          <div className="fx-subtitle">{p.psychologistName ?? "Psixoloq təyin edilməyib"}</div>
        </div>
      ),
    },
    {
      key: "amount", header: "Məbləğ", numeric: true,
      cell: p => (
        <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ fontWeight: 600 }}>{money(p.amount, p.currency)}</span>
          {!!p.refundedAmount && p.refundedAmount > 0 && (
            <span className="fx-subtitle">−{money(p.refundedAmount, p.currency)} qaytarılıb</span>
          )}
        </span>
      ),
    },
    {
      key: "commissionAmount", header: "Komissiya", numeric: true, hideOnMobile: true,
      // Mənbə faizin YANINDA yazılır (ayrıca sütun açmadan): komissiya 0 olanda
      // "niyə 0-dır" sualı dərhal cavablanır. Ayırıcı işarə yox — mötərizə.
      cell: p => (
        <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span>{money(p.commissionAmount, p.currency)}</span>
          <span className="fx-subtitle">
            {p.commissionPercent != null ? `${p.commissionPercent}%` : "—"}
            {p.origin === "DIRECT" ? " (pasiyent seçib)"
              : p.origin === "PLATFORM_MATCHED" ? " (Fanus təyin edib)" : ""}
          </span>
        </span>
      ),
    },
    { key: "method", header: "Üsul", hideOnMobile: true, cell: p => p.method || "—" },
    {
      key: "claimedByName", header: "Operator", hideOnMobile: true,
      cell: p => p.claimedByName ?? <span className="fx-subtitle">—</span>,
    },
    {
      key: "paidAt", header: "Tarix",
      cell: p => (
        <span style={{ whiteSpace: "nowrap" }}>
          {azFormatDate(p.paidAt ?? p.createdAt)}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: p => <PaymentStatus value={p.status} /> },
  ];

  if (!mounted) return null;

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead
        title="Ödənişlər"
        sub="Platformanın bütün ödənişləri — təsdiq, ləğv, iadə və komissiya idarəsi."
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <PanelIcon name="plus" size={15} /> Yeni ödəniş
          </Button>
        }
      />

      <Stats style={{ marginBottom: 16, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <Stat value={summary ? summary.pendingCount : "—"} label="Gözləyən" />
        <Stat value={summary ? money(summary.pendingSum) : "—"} label="Gözləyən məbləğ" />
        <Stat value={summary ? money(summary.paidMonthSum) : "—"} label="Bu ay ödənilib" />
        <Stat value={summary ? money(summary.refundedMonthSum) : "—"} label="Bu ay qaytarılıb" />
      </Stats>

      <Card style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 20px 0" }}>
          <Tabs items={tabItems} value={tab} onChange={setTab} />
        </div>
        <div className="fx-hairline" />

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
            <SearchInput
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Müştəri adı və ya telefon"
              aria-label="Ödəniş axtar"
              autoComplete="off"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setFiltersOpen(o => !o)}>
            Süzgəclər{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>Təmizlə</Button>
          )}
        </div>

        {filtersOpen && (
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--hairline)", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            <Field label="Tarixdən">
              <DatePicker value={from} onChange={setFrom} theme="light" size="sm" clearable />
            </Field>
            <Field label="Tarixə">
              <DatePicker value={to} onChange={setTo} theme="light" size="sm" clearable />
            </Field>
            <Field label="Ödəniş üsulu">
              <Select value={method} onChange={e => setMethod(e.target.value)}>
                <option value="">Hamısı</option>
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Operator">
              <Select value={operatorId} onChange={e => setOperatorId(e.target.value)}>
                <option value="">Hamısı</option>
                {operators.map(o => (
                  <option key={o.id} value={o.id}>
                    {[o.firstName, o.lastName].filter(Boolean).join(" ") || o.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Psixoloq">
              <Select value={psychologistId} onChange={e => setPsychologistId(e.target.value)}>
                <option value="">Hamısı</option>
                {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Məbləğ (min)">
              <Input type="number" inputMode="decimal" value={minAmount}
                onChange={e => setMinAmount(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Məbləğ (maks)">
              <Input type="number" inputMode="decimal" value={maxAmount}
                onChange={e => setMaxAmount(e.target.value)} placeholder="—" />
            </Field>
            <Field label="Komissiya">
              <Checkbox
                checked={zeroCommission}
                onChange={e => setZeroCommission(e.target.checked)}
                label="Yalnız komissiyasız"
              />
            </Field>
          </div>
        )}

        <CardPad>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={p => p.id}
            loading={loading}
            error={error}
            onRetry={() => setReloadNonce(n => n + 1)}
            onRowClick={p => setSelected(p)}
            empty={{
              title: "Ödəniş tapılmadı",
              body: activeFilterCount > 0
                ? "Seçilmiş süzgəclərə uyğun ödəniş yoxdur."
                : "Bu kateqoriyada hələ ödəniş qeydi yoxdur.",
            }}
            actions={p => (
              <span style={{ display: "inline-flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                {p.status === "PENDING" && (
                  <>
                    <IconButton aria-label="Ödənildi" title="Ödənildi olaraq işarələ"
                      onClick={() => setAction({ row: p, kind: "paid" })}>
                      <PanelIcon name="check" size={16} />
                    </IconButton>
                    <IconButton aria-label="Ləğv et" title="Ləğv et"
                      onClick={() => setAction({ row: p, kind: "cancel" })}>
                      <PanelIcon name="x" size={16} />
                    </IconButton>
                  </>
                )}
                {(p.status === "PAID" || p.status === "PARTIALLY_REFUNDED") && (
                  <IconButton aria-label="Geri qaytar" title="Geri qaytar"
                    onClick={() => setAction({ row: p, kind: "refund" })}>
                    <PanelIcon name="arrow-left" size={16} />
                  </IconButton>
                )}
              </span>
            )}
            pagination={{
              // Pagination 1-dən, backend 0-dan başlayır.
              page: page + 1,
              pageCount: totalPages,
              onChange: p => setPage(p - 1),
              pageSize: size,
              onPageSizeChange: s => { setSize(s); setPage(0); },
              pageSizeOptions: PAGE_SIZE_OPTIONS,
            }}
            totalLabel={total > 0
              ? `Göstərilir: ${page * size + 1}–${Math.min((page + 1) * size, total)} / ${total}`
              : undefined}
          />
        </CardPad>
      </Card>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Ödəniş kartı">
        {selected && (
          <PaymentDrawer
            payment={selected}
            onAction={kind => setAction({ row: selected, kind })}
          />
        )}
      </Drawer>

      {action && (
        <ActionModal
          row={action.row}
          kind={action.kind}
          onClose={() => setAction(null)}
          onDone={() => { setAction(null); setSelected(null); setReloadNonce(n => n + 1); }}
        />
      )}

      {createOpen && (
        <CreatePaymentModal
          psychologists={psychologists}
          onClose={() => setCreateOpen(false)}
          onDone={() => { setCreateOpen(false); setReloadNonce(n => n + 1); }}
        />
      )}
    </div>
  );
}

type ActionKind = "paid" | "cancel" | "refund" | "commission";

// ── Drawer: ödənişin tam kartı ──────────────────────────────────────────────
function PaymentDrawer({ payment, onAction }: {
  payment: PaymentItem;
  onAction: (kind: ActionKind) => void;
}) {
  const p = payment;
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Müştəri", value: p.patientName + (p.patientAccountDeleted ? " (silinmiş hesab)" : "") },
    { label: "Telefon", value: p.patientPhone || "—" },
    { label: "Psixoloq", value: p.psychologistName || "—" },
    { label: "Məbləğ", value: money(p.amount, p.currency) },
    { label: "Geri qaytarılıb", value: p.refundedAmount ? money(p.refundedAmount, p.currency) : "—" },
    {
      label: "Komissiya",
      value: `${money(p.commissionAmount, p.currency)}${p.commissionPercent != null ? ` (${p.commissionPercent}%)` : ""}`,
    },
    {
      label: "Mənbə",
      value: p.origin === "DIRECT" ? "Pasiyent özü seçib"
        : p.origin === "PLATFORM_MATCHED" ? "Fanus təyin edib" : "—",
    },
    { label: "Üsul", value: p.method || "—" },
    { label: "Operator", value: p.claimedByName || "—" },
    {
      label: "Bağlantı",
      value: p.patientPackageId ? `Paket #${p.patientPackageId}`
        : p.appointmentId ? `Seans #${p.appointmentId}` : "Sərbəst ödəniş",
    },
    { label: "Yaradılıb", value: azFormatDateTime(p.createdAt) },
    { label: "Ödənilib", value: p.paidAt ? azFormatDateTime(p.paidAt) : "—" },
  ];
  return (
    <>
      <DrawerSection>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <PaymentStatus value={p.status} />
          {p.patientAccountDeleted && <Status tone="risk">Hesab silinib</Status>}
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 13.5 }}>
              <span className="fx-subtitle">{r.label}</span>
              <span style={{ textAlign: "right", minWidth: 0 }}>{r.value}</span>
            </div>
          ))}
        </div>
        {p.statusNote && (
          <div style={{ marginTop: 14 }}>
            <div className="fx-subtitle">Qeyd</div>
            <div style={{ fontSize: 13.5 }}>{p.statusNote}</div>
          </div>
        )}
      </DrawerSection>

      <DrawerSection>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {p.status === "PENDING" && (
            <>
              <Button variant="primary" size="sm" onClick={() => onAction("paid")}>Ödənildi</Button>
              <Button variant="dangerGhost" size="sm" onClick={() => onAction("cancel")}>Ləğv et</Button>
            </>
          )}
          {(p.status === "PAID" || p.status === "PARTIALLY_REFUNDED") && (
            <>
              <Button variant="dangerGhost" size="sm" onClick={() => onAction("refund")}>Geri qaytar</Button>
              <Button variant="ghost" size="sm" onClick={() => onAction("commission")}>Komissiyanı düzəlt</Button>
            </>
          )}
        </div>
      </DrawerSection>
    </>
  );
}

// ── Əməliyyat dialoqları ────────────────────────────────────────────────────
function ActionModal({ row, kind, onClose, onDone }: {
  row: PaymentItem;
  kind: ActionKind;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [proRata, setProRata] = useState(false);
  const [percent, setPercent] = useState(row.commissionPercent != null ? String(row.commissionPercent) : "");
  const [suggestion, setSuggestion] = useState<RefundSuggestion | null>(null);

  // Paket ödənişində qalan seanslara görə pro-rata təklifi göstərilir.
  useEffect(() => {
    if (kind !== "refund" || !row.patientPackageId) return;
    let cancelled = false;
    adminApi.paymentRefundSuggestion(row.id)
      .then(s => { if (!cancelled) setSuggestion(s); })
      .catch(() => { /* təklif gəlməsə məbləğ əl ilə yazılır */ });
    return () => { cancelled = true; };
  }, [kind, row.id, row.patientPackageId]);

  const submit = async () => {
    setBusy(true);
    try {
      if (kind === "paid") {
        await adminApi.markPaymentPaid(row.id, method || undefined);
        toast("Ödəniş təsdiqləndi", "success");
      } else if (kind === "cancel") {
        await adminApi.cancelPayment(row.id, reason.trim());
        toast("Ödəniş ləğv edildi", "success");
      } else if (kind === "refund") {
        await adminApi.refundPayment(row.id, {
          amount: proRata ? undefined : Number(amount),
          reason: reason.trim(),
          proRataRemaining: proRata,
        });
        toast("Geri qaytarma icra olundu", "success");
      } else {
        await adminApi.adjustPaymentCommission(row.id, Number(percent), reason.trim());
        toast("Komissiya düzəldildi", "success");
      }
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };

  const cfg = {
    paid: { title: "Ödənişi təsdiqlə", cta: "Təsdiqlə", danger: false, icon: "check" as const },
    cancel: { title: "Ödənişi ləğv et", cta: "Ləğv et", danger: true, icon: "x" as const },
    refund: { title: "Geri qaytarma", cta: "Geri qaytar", danger: true, icon: "arrow-left" as const },
    commission: { title: "Komissiyanı düzəlt", cta: "Yadda saxla", danger: false, icon: "chart" as const },
  }[kind];

  const valid =
    kind === "paid" ? true
    : kind === "cancel" ? reason.trim().length > 0
    : kind === "refund" ? reason.trim().length > 0 && (proRata || Number(amount) > 0)
    : reason.trim().length > 0 && percent !== "" && Number(percent) >= 0 && Number(percent) <= 100;

  return (
    <Modal open onClose={onClose}
      title={cfg.title}
      text={`${row.patientName} — ${money(row.amount, row.currency)}`}
      icon={<PanelIcon name={cfg.icon} size={20} />}
      iconTone={cfg.danger ? "rose" : "brand"}
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant={cfg.danger ? "danger" : "primary"} disabled={busy || !valid} onClick={submit}>
          {busy ? "İcra olunur…" : cfg.cta}
        </Button>
      </>}>

      {kind === "paid" && (
        <Field label="Ödəniş üsulu" help="Kassa uzlaşdırması üçün — boş qoysanız dəyişmir.">
          <Select value={method} onChange={e => setMethod(e.target.value)}>
            <option value="">Dəyişmə</option>
            <option value="Nağd">Nağd</option>
            <option value="Kart">Kart</option>
            <option value="Köçürmə">Köçürmə</option>
          </Select>
        </Field>
      )}

      {kind === "refund" && (
        <>
          {suggestion && (
            <div style={{ marginBottom: 12, fontSize: 13.5 }}>
              <div className="fx-subtitle">Paket üzrə təklif</div>
              <div>
                {suggestion.remainingSessions} / {suggestion.totalSessions} seans qalıb.
                {" "}Təklif olunan məbləğ <strong>{money(suggestion.suggestedAmount)}</strong>,
                {" "}maksimum {money(suggestion.maxRefundable)}.
              </div>
              <div style={{ marginTop: 8 }}>
                <Checkbox
                  checked={proRata}
                  onChange={e => setProRata(e.target.checked)}
                  label="Qalan seanslara görə hesabla (pro-rata)"
                />
              </div>
            </div>
          )}
          {!proRata && (
            <Field label="Geri qaytarılacaq məbləğ">
              <Input type="number" inputMode="decimal" value={amount}
                onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
          )}
        </>
      )}

      {kind === "commission" && (
        <Field label="Komissiya faizi"
          help="0–100. Möhürlənmiş dəyəri əvəz edir; köhnə dəyər audit log-da qalır.">
          <Input type="number" inputMode="decimal" value={percent}
            onChange={e => setPercent(e.target.value)} placeholder="0" />
        </Field>
      )}

      {kind !== "paid" && (
        <Field label="Səbəb" help="Məcburi.">
          <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
      )}
    </Modal>
  );
}

// ── Sərbəst ödəniş yaratma ──────────────────────────────────────────────────
function CreatePaymentModal({ psychologists, onClose, onDone }: {
  psychologists: Psychologist[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [psychologistId, setPsychologistId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const valid = name.trim().length > 0 && Number(amount) > 0;

  const submit = async () => {
    setBusy(true);
    try {
      await adminApi.createStandalonePayment({
        patientName: name.trim(),
        patientPhone: phone.trim() || undefined,
        psychologistId: psychologistId ? Number(psychologistId) : undefined,
        amount: Number(amount),
        note: note.trim() || undefined,
      });
      toast("Ödəniş qeydi yaradıldı", "success");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}
      title="Yeni ödəniş qeydi"
      text="Randevu və ya paketə bağlı olmayan gəlir. Gözləyən statusda yaranır — adi qaydada təsdiqlənir."
      icon={<PanelIcon name="plus" size={20} />}
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant="primary" disabled={busy || !valid} onClick={submit}>
          {busy ? "Yaradılır…" : "Yarat"}
        </Button>
      </>}>
      <Field label="Müştəri adı">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ad Soyad" />
      </Field>
      <Field label="Telefon">
        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+994…" />
      </Field>
      <Field label="Psixoloq" help="Komissiya hesablanması üçün — boş qoyula bilər.">
        <Select value={psychologistId} onChange={e => setPsychologistId(e.target.value)}>
          <option value="">Seçilməyib</option>
          {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <Field label="Məbləğ">
        <Input type="number" inputMode="decimal" value={amount}
          onChange={e => setAmount(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label="İzah">
        <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
          placeholder="Nəyə görə alınıb" />
      </Field>
    </Modal>
  );
}
