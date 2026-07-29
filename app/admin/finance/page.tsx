"use client";

// Maliyyə — qurum səviyyəli pul idarəsi. Gündəlik əməliyyat (ödənişi təsdiqlə,
// ləğv et, iadə) Ödənişlər modulundadır; burada qaydalar və hesablaşma var:
// psixoloqlara borc, köçürmələr, komissiya faizləri və abunələr.
//
// Payout axını: hazırlanır (GÖZLƏYİR) → bank köçürməsi → "ödənildi".
// Balansdan yalnız ÖDƏNİLMİŞ məbləğ çıxılır; gözləyən ayrıca göstərilir ki,
// eyni məbləğ ikinci dəfə hazırlanmasın.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminApi,
  type PayoutBalance,
  type PayoutItem,
  type CommissionChange,
  type PsychologistOverride,
  type FinanceSummary,
  type SubscriptionPlanItem,
  type PsySubscriptionItem,
  type Psychologist,
} from "@/lib/api";
import { azFormatDate, azFormatDateTime } from "@/lib/datetime";
import PanelIcon from "@/components/PanelIcon";
import { toast } from "@/components/Toast";
import {
  PageHead,
  Card,
  CardPad,
  DataTable,
  Status,
  Button,
  IconButton,
  Stats,
  Stat,
  Modal,
  Field,
  Input,
  Select,
  Textarea,
  Tabs,
  type Column,
  type TabItem,
} from "@/components/ui";

const TABS = [
  { key: "BALANCES", label: "Balanslar" },
  { key: "PAYOUTS", label: "Ödəmə tarixçəsi" },
  { key: "COMMISSION", label: "Komissiya" },
  { key: "SUBSCRIPTIONS", label: "Abunələr" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const money = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toFixed(2)} ₼`;
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);

export default function AdminFinancePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [tab, setTab] = useState<TabKey>("BALANCES");
  const [summary, setSummary] = useState<FinanceSummary | null>(null);

  useEffect(() => {
    adminApi.financeSummary().then(setSummary).catch(() => { /* KPI kritik deyil */ });
  }, []);

  const tabItems: TabItem<TabKey>[] = TABS.map(t => ({ key: t.key, label: t.label }));

  if (!mounted) return null;

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead
        title="Maliyyə"
        sub="Psixoloqlara hesablaşma, komissiya qaydaları və abunələr. Gündəlik ödəniş əməliyyatları Ödənişlər modulundadır."
      />

      <Stats style={{ marginBottom: 16, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <Stat value={summary ? money(summary.commissionRevenue) : "—"} label="Komissiya gəliri" />
        <Stat value={summary ? money(summary.subscriptionMonthlyRevenue) : "—"} label="Abunə (aylıq)" />
        <Stat value={summary ? summary.activeSubscriptions : "—"} label="Aktiv abunə" />
        <Stat value={summary ? money(summary.totalRevenue) : "—"} label="Ümumi gəlir" />
      </Stats>

      <Card style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 20px 0" }}>
          <Tabs items={tabItems} value={tab} onChange={setTab} />
        </div>
        <div className="fx-hairline" />
        <CardPad>
          {tab === "BALANCES" && <BalancesTab />}
          {tab === "PAYOUTS" && <PayoutsTab />}
          {tab === "COMMISSION" && <CommissionTab />}
          {tab === "SUBSCRIPTIONS" && <SubscriptionsTab />}
        </CardPad>
      </Card>
    </div>
  );
}

// ── Tab 1: Balanslar ────────────────────────────────────────────────────────
function BalancesTab() {
  const [rows, setRows] = useState<PayoutBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [payFor, setPayFor] = useState<PayoutBalance | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    adminApi.payoutBalances()
      .then(setRows)
      .catch(e => setError((e as Error).message || "Balanslar yüklənmədi"))
      .finally(() => setLoading(false));
  }, [nonce]);

  const columns: Column<PayoutBalance>[] = [
    { key: "psychologistName", header: "Psixoloq", cell: b => b.psychologistName },
    { key: "earnedNet", header: "Qazanılıb", numeric: true, cell: b => money(b.earnedNet) },
    { key: "paidOut", header: "Ödənilib", numeric: true, cell: b => money(b.paidOut) },
    {
      key: "pendingPayout", header: "Hazırlanıb", numeric: true,
      cell: b => b.pendingPayout > 0
        ? <span>{money(b.pendingPayout)}</span>
        : <span className="fx-subtitle">—</span>,
    },
    {
      key: "balance", header: "Qalıq borc", numeric: true,
      cell: b => <span style={{ fontWeight: 600 }}>{money(b.balance)}</span>,
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={b => b.psychologistId}
        loading={loading}
        error={error}
        onRetry={() => setNonce(n => n + 1)}
        empty={{
          title: "Hesablaşma yoxdur",
          body: "Təsdiqlənmiş ödəniş olmadan psixoloq balansı yaranmır.",
        }}
        actions={b => (
          <Button variant="ghost" size="sm" onClick={() => setPayFor(b)}>Ödəmə hazırla</Button>
        )}
      />
      {payFor && (
        <CreatePayoutModal
          balance={payFor}
          onClose={() => setPayFor(null)}
          onDone={() => { setPayFor(null); setNonce(n => n + 1); }}
        />
      )}
    </>
  );
}

function CreatePayoutModal({ balance, onClose, onDone }: {
  balance: PayoutBalance; onClose: () => void; onDone: () => void;
}) {
  const [amount, setAmount] = useState(balance.balance > 0 ? String(balance.balance.toFixed(2)) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = Number(amount) > 0;

  const submit = async () => {
    setBusy(true);
    try {
      await adminApi.createPayout({
        psychologistId: balance.psychologistId,
        amount: Number(amount),
        note: note.trim() || undefined,
      });
      toast("Ödəmə hazırlandı — köçürmədən sonra «ödənildi» işarələyin", "success");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}
      title="Ödəmə hazırla"
      text={`${balance.psychologistName} — qalıq borc ${money(balance.balance)}`}
      icon={<PanelIcon name="plus" size={20} />}
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant="primary" disabled={busy || !valid} onClick={submit}>
          {busy ? "Hazırlanır…" : "Hazırla"}
        </Button>
      </>}>
      {balance.pendingPayout > 0 && (
        <div style={{ marginBottom: 12, fontSize: 13.5 }}>
          <Status tone="wait">Diqqət</Status>
          <div style={{ marginTop: 4 }}>
            Bu psixoloq üçün artıq {money(balance.pendingPayout)} məbləğində
            icra gözləyən ödəmə var. Təkrar hazırlamadan əvvəl yoxlayın.
          </div>
        </div>
      )}
      <Field label="Məbləğ">
        <Input type="number" inputMode="decimal" value={amount}
          onChange={e => setAmount(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label="Qeyd" help="Köçürmə referansı və ya izah — ixtiyari.">
        <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

// ── Tab 2: Ödəmə tarixçəsi ──────────────────────────────────────────────────
function PayoutsTab() {
  const [rows, setRows] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [confirm, setConfirm] = useState<{ row: PayoutItem; kind: "paid" | "cancel" } | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    adminApi.listPayouts()
      .then(setRows)
      .catch(e => setError((e as Error).message || "Ödəmələr yüklənmədi"))
      .finally(() => setLoading(false));
  }, [nonce]);

  const columns: Column<PayoutItem>[] = [
    { key: "psychologistName", header: "Psixoloq", cell: p => p.psychologistName ?? "—" },
    { key: "amount", header: "Məbləğ", numeric: true, cell: p => money(p.amount) },
    { key: "note", header: "Qeyd", hideOnMobile: true, cell: p => p.note || <span className="fx-subtitle">—</span> },
    {
      key: "createdAt", header: "Hazırlanıb",
      cell: p => <span style={{ whiteSpace: "nowrap" }}>{azFormatDate(p.createdAt)}</span>,
    },
    {
      key: "paidAt", header: "Ödənilib", hideOnMobile: true,
      cell: p => p.paidAt
        ? <span style={{ whiteSpace: "nowrap" }}>{azFormatDate(p.paidAt)}</span>
        : <span className="fx-subtitle">—</span>,
    },
    {
      key: "status", header: "Status",
      cell: p => p.status === "PAID"
        ? <Status tone="positive">Ödənilib</Status>
        : <Status tone="wait">Gözləyir</Status>,
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={p => p.id}
        loading={loading}
        error={error}
        onRetry={() => setNonce(n => n + 1)}
        empty={{ title: "Ödəmə yoxdur", body: "Balanslar tabından psixoloqa ödəmə hazırlaya bilərsiniz." }}
        actions={p => p.status === "PENDING" ? (
          <span style={{ display: "inline-flex", gap: 6 }}>
            <IconButton aria-label="Ödənildi" title="Köçürmə icra olundu"
              onClick={() => setConfirm({ row: p, kind: "paid" })}>
              <PanelIcon name="check" size={16} />
            </IconButton>
            <IconButton aria-label="Ləğv et" title="Ləğv et"
              onClick={() => setConfirm({ row: p, kind: "cancel" })}>
              <PanelIcon name="x" size={16} />
            </IconButton>
          </span>
        ) : <span className="fx-subtitle" style={{ whiteSpace: "nowrap" }}>—</span>}
      />
      {confirm && (
        <PayoutDecisionModal
          row={confirm.row}
          kind={confirm.kind}
          onClose={() => setConfirm(null)}
          onDone={() => { setConfirm(null); setNonce(n => n + 1); }}
        />
      )}
    </>
  );
}

function PayoutDecisionModal({ row, kind, onClose, onDone }: {
  row: PayoutItem; kind: "paid" | "cancel"; onClose: () => void; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const submit = async () => {
    setBusy(true);
    try {
      if (kind === "paid") {
        await adminApi.markPayoutPaid(row.id);
        toast("Ödəmə icra olundu — psixoloqa bildiriş göndərildi", "success");
      } else {
        await adminApi.cancelPayout(row.id, reason.trim() || undefined);
        toast("Ödəmə ləğv edildi", "success");
      }
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose}
      title={kind === "paid" ? "Köçürməni təsdiqlə" : "Ödəməni ləğv et"}
      text={kind === "paid"
        ? `${row.psychologistName ?? "Psixoloq"} — ${money(row.amount)} köçürüldü olaraq işarələnəcək və psixoloqa bildiriş gedəcək.`
        : `${row.psychologistName ?? "Psixoloq"} — ${money(row.amount)} məbləğində hazırlanmış ödəmə silinəcək.`}
      icon={<PanelIcon name={kind === "paid" ? "check" : "x"} size={20} />}
      iconTone={kind === "paid" ? "brand" : "rose"}
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant={kind === "paid" ? "primary" : "danger"} disabled={busy} onClick={submit}>
          {busy ? "İcra olunur…" : kind === "paid" ? "Ödənildi" : "Ləğv et"}
        </Button>
      </>}>
      {kind === "cancel" && (
        <Field label="Səbəb" help="İxtiyari — audit qeydinə yazılır.">
          <Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
      )}
    </Modal>
  );
}

// ── Tab 3: Komissiya ────────────────────────────────────────────────────────
function CommissionTab() {
  const [global, setGlobal] = useState<number | null>(null);
  const [direct, setDirect] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<PsychologistOverride[]>([]);
  const [history, setHistory] = useState<CommissionChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [edit, setEdit] = useState<null | { scope: "GLOBAL" | "DIRECT" }>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    Promise.all([
      adminApi.getCommission(),
      adminApi.getDirectCommission(),
      adminApi.commissionOverrides(),
      adminApi.commissionHistory({ size: 30 }),
    ])
      .then(([g, d, o, h]) => {
        setGlobal(g.globalPercent); setDirect(d.globalPercent);
        setOverrides(o); setHistory(h.content ?? []);
      })
      .catch(e => setError((e as Error).message || "Komissiya məlumatı yüklənmədi"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load, nonce]);

  const historyCols: Column<CommissionChange>[] = [
    {
      key: "scope", header: "Sahə",
      cell: c => c.scope === "GLOBAL" ? "Qlobal"
        : c.scope === "DIRECT" ? "Pasiyent seçib (DIRECT)"
        : c.psychologistName ?? "Psixoloq",
    },
    {
      key: "change", header: "Dəyişiklik", numeric: true,
      cell: c => (
        <span>
          {pct(c.oldPercent)} → {c.newPercent == null ? "qlobal" : pct(c.newPercent)}
        </span>
      ),
    },
    { key: "changedByName", header: "Kim", hideOnMobile: true, cell: c => c.changedByName ?? c.actorRole ?? "—" },
    { key: "reason", header: "Səbəb", hideOnMobile: true, cell: c => c.reason || <span className="fx-subtitle">—</span> },
    {
      key: "createdAt", header: "Tarix",
      cell: c => <span style={{ whiteSpace: "nowrap" }}>{azFormatDateTime(c.createdAt)}</span>,
    },
  ];

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <div className="fx-subtitle" style={{ marginBottom: 10 }}>{error}</div>
        <Button variant="ghost" size="sm" onClick={() => setNonce(n => n + 1)}>Yenidən cəhd et</Button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <RuleCard
          title="Qlobal faiz"
          desc="Fanus təyin etdiyi rezervasiyalarda (PLATFORM_MATCHED) tətbiq olunur."
          value={loading ? "—" : pct(global)}
          onEdit={() => setEdit({ scope: "GLOBAL" })}
        />
        <RuleCard
          title="Pasiyent seçib (DIRECT)"
          desc="Pasiyent psixoloqu özü seçəndə tətbiq olunan faiz. Default 0%."
          value={loading ? "—" : pct(direct)}
          onEdit={() => setEdit({ scope: "DIRECT" })}
        />
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
          Fərdi faizlər ({overrides.length})
        </div>
        <div className="fx-subtitle" style={{ marginBottom: 10 }}>
          Bu psixoloqlarda qlobal faiz TƏTBIQ OLUNMUR — fərdi dəyər onu üstələyir.
          Komissiya gözlənilməz çıxdıqda ilk baxılacaq yer buradır.
        </div>
        {overrides.length === 0 ? (
          <div className="fx-subtitle">Fərdi faiz təyin edilmiş psixoloq yoxdur.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {overrides.map(o => (
              <div key={o.psychologistId}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5 }}>
                <span>{o.psychologistName}</span>
                <span>
                  <strong>{pct(o.overridePercent)}</strong>
                  <span className="fx-subtitle"> (qlobal {pct(o.globalPercent)})</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Dəyişiklik tarixçəsi</div>
        <DataTable
          rows={history}
          columns={historyCols}
          rowKey={c => c.id}
          loading={loading}
          empty={{ title: "Tarixçə boşdur", body: "Komissiya faizi hələ dəyişdirilməyib." }}
        />
      </div>

      {edit && (
        <EditCommissionModal
          scope={edit.scope}
          current={edit.scope === "GLOBAL" ? global : direct}
          onClose={() => setEdit(null)}
          onDone={() => { setEdit(null); setNonce(n => n + 1); }}
        />
      )}
    </div>
  );
}

function RuleCard({ title, desc, value, onEdit }: {
  title: string; desc: string; value: string; onEdit: () => void;
}) {
  return (
    <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
          <div className="fx-subtitle" style={{ marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>Dəyiş</Button>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>{value}</div>
    </div>
  );
}

function EditCommissionModal({ scope, current, onClose, onDone }: {
  scope: "GLOBAL" | "DIRECT"; current: number | null; onClose: () => void; onDone: () => void;
}) {
  const [percent, setPercent] = useState(current != null ? String(current) : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = percent !== "" && Number(percent) >= 0 && Number(percent) <= 100;

  const submit = async () => {
    setBusy(true);
    try {
      if (scope === "GLOBAL") await adminApi.setCommission(Number(percent), reason.trim() || undefined);
      else await adminApi.setDirectCommission(Number(percent), reason.trim() || undefined);
      toast("Faiz yeniləndi", "success");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}
      title={scope === "GLOBAL" ? "Qlobal faizi dəyiş" : "DIRECT faizini dəyiş"}
      text="Dəyişiklik yalnız BUNDAN SONRAKI ödənişlərə təsir edir — təsdiqlənmiş ödənişlərdə komissiya möhürlənib və toxunulmur."
      icon={<PanelIcon name="chart" size={20} />}
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant="primary" disabled={busy || !valid} onClick={submit}>
          {busy ? "Yadda saxlanılır…" : "Yadda saxla"}
        </Button>
      </>}>
      <Field label="Faiz" help="0–100">
        <Input type="number" inputMode="decimal" value={percent}
          onChange={e => setPercent(e.target.value)} placeholder="0" />
      </Field>
      <Field label="Səbəb" help="İxtiyari — tarixçədə görünür.">
        <Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}

// ── Tab 4: Abunələr ─────────────────────────────────────────────────────────
function SubscriptionsTab() {
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);
  const [subs, setSubs] = useState<PsySubscriptionItem[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [planModal, setPlanModal] = useState<SubscriptionPlanItem | "new" | null>(null);
  const [subModal, setSubModal] = useState(false);

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      adminApi.listSubscriptionPlans(),
      adminApi.listSubscriptions(),
      adminApi.getPsychologists(),
    ])
      .then(([p, s, psy]) => { setPlans(p); setSubs(s); setPsychologists(psy); })
      .catch(e => setError((e as Error).message || "Abunə məlumatı yüklənmədi"))
      .finally(() => setLoading(false));
  }, [nonce]);

  const planCols: Column<SubscriptionPlanItem>[] = [
    { key: "name", header: "Plan", cell: p => p.name },
    { key: "price", header: "Qiymət", numeric: true, cell: p => money(p.price) },
    { key: "period", header: "Dövr", cell: p => p.period === "YEARLY" ? "İllik" : "Aylıq" },
    {
      key: "active", header: "Status",
      cell: p => p.active ? <Status tone="positive">Aktiv</Status> : <Status tone="muted">Deaktiv</Status>,
    },
  ];

  const subCols: Column<PsySubscriptionItem>[] = [
    { key: "psychologistName", header: "Psixoloq", cell: s => s.psychologistName ?? "—" },
    { key: "planName", header: "Plan", cell: s => s.planName ?? "—" },
    { key: "planPrice", header: "Qiymət", numeric: true, cell: s => money(s.planPrice) },
    {
      key: "expiresAt", header: "Bitir", hideOnMobile: true,
      cell: s => s.expiresAt ? azFormatDate(s.expiresAt) : <span className="fx-subtitle">—</span>,
    },
    {
      key: "status", header: "Status",
      cell: s => (
        <Status tone={s.status === "ACTIVE" ? "positive" : s.status === "OVERDUE" ? "risk" : "muted"}>
          {s.status === "ACTIVE" ? "Aktiv" : s.status === "OVERDUE" ? "Gecikib"
            : s.status === "EXPIRED" ? "Bitib" : "Ləğv edilib"}
        </Status>
      ),
    },
  ];

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <div className="fx-subtitle" style={{ marginBottom: 10 }}>{error}</div>
        <Button variant="ghost" size="sm" onClick={() => setNonce(n => n + 1)}>Yenidən cəhd et</Button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Planlar ({plans.length})</div>
          <Button variant="ghost" size="sm" onClick={() => setPlanModal("new")}>Yeni plan</Button>
        </div>
        <DataTable
          rows={plans}
          columns={planCols}
          rowKey={p => p.id}
          loading={loading}
          empty={{ title: "Plan yoxdur", body: "Psixoloq abunəsi üçün ilk planı yaradın." }}
          actions={p => <Button variant="ghost" size="sm" onClick={() => setPlanModal(p)}>Redaktə</Button>}
        />
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Aktiv abunələr ({subs.length})</div>
          <Button variant="ghost" size="sm" disabled={plans.length === 0} onClick={() => setSubModal(true)}>
            Abunə əlavə et
          </Button>
        </div>
        <DataTable
          rows={subs}
          columns={subCols}
          rowKey={s => s.id}
          loading={loading}
          empty={{ title: "Abunə yoxdur", body: "Psixoloqa plan təyin edildikdə burada görünəcək." }}
        />
      </div>

      {planModal && (
        <PlanModal
          plan={planModal === "new" ? null : planModal}
          onClose={() => setPlanModal(null)}
          onDone={() => { setPlanModal(null); setNonce(n => n + 1); }}
        />
      )}
      {subModal && (
        <SubscriptionModal
          plans={plans}
          psychologists={psychologists}
          onClose={() => setSubModal(false)}
          onDone={() => { setSubModal(false); setNonce(n => n + 1); }}
        />
      )}
    </div>
  );
}

function PlanModal({ plan, onClose, onDone }: {
  plan: SubscriptionPlanItem | null; onClose: () => void; onDone: () => void;
}) {
  const [name, setName] = useState(plan?.name ?? "");
  const [price, setPrice] = useState(plan ? String(plan.price) : "");
  // Açıq <string>: plan.period union tipdədir, <select> isə string qaytarır.
  const [period, setPeriod] = useState<string>(plan?.period ?? "MONTHLY");
  const [perks, setPerks] = useState(plan?.perks ?? "");
  const [active, setActive] = useState(plan?.active ?? true);
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length > 0 && Number(price) >= 0;

  const submit = async () => {
    setBusy(true);
    try {
      const data = { name: name.trim(), price: Number(price), period, perks: perks.trim() || undefined, active };
      if (plan) await adminApi.updateSubscriptionPlan(plan.id, data);
      else await adminApi.createSubscriptionPlan(data);
      toast(plan ? "Plan yeniləndi" : "Plan yaradıldı", "success");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}
      title={plan ? "Planı redaktə et" : "Yeni plan"}
      icon={<PanelIcon name="package" size={20} />}
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant="primary" disabled={busy || !valid} onClick={submit}>
          {busy ? "Yadda saxlanılır…" : "Yadda saxla"}
        </Button>
      </>}>
      <Field label="Ad"><Input value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Qiymət">
        <Input type="number" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />
      </Field>
      <Field label="Dövr">
        <Select value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="MONTHLY">Aylıq</option>
          <option value="YEARLY">İllik</option>
        </Select>
      </Field>
      <Field label="Üstünlüklər" help="Sətir-sətir yazıla bilər.">
        <Textarea rows={3} value={perks} onChange={e => setPerks(e.target.value)} />
      </Field>
      <Field label="Status">
        <Select value={active ? "1" : "0"} onChange={e => setActive(e.target.value === "1")}>
          <option value="1">Aktiv</option>
          <option value="0">Deaktiv</option>
        </Select>
      </Field>
    </Modal>
  );
}

function SubscriptionModal({ plans, psychologists, onClose, onDone }: {
  plans: SubscriptionPlanItem[]; psychologists: Psychologist[];
  onClose: () => void; onDone: () => void;
}) {
  const [psychologistId, setPsychologistId] = useState("");
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const activePlans = useMemo(() => plans.filter(p => p.active), [plans]);
  const valid = psychologistId !== "" && planId !== "";

  const submit = async () => {
    setBusy(true);
    try {
      await adminApi.createSubscription({
        psychologistId: Number(psychologistId),
        planId: Number(planId),
      });
      toast("Abunə əlavə edildi", "success");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}
      title="Abunə əlavə et"
      icon={<PanelIcon name="plus" size={20} />}
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant="primary" disabled={busy || !valid} onClick={submit}>
          {busy ? "Əlavə olunur…" : "Əlavə et"}
        </Button>
      </>}>
      <Field label="Psixoloq">
        <Select value={psychologistId} onChange={e => setPsychologistId(e.target.value)}>
          <option value="">Seçin</option>
          {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <Field label="Plan">
        <Select value={planId} onChange={e => setPlanId(e.target.value)}>
          <option value="">Seçin</option>
          {activePlans.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} — {money(p.price)} / {p.period === "YEARLY" ? "il" : "ay"}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}
