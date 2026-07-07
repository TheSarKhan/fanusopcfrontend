"use client";

import { useEffect, useState } from "react";
import {
  adminApi,
  type PayoutBalance, type PayoutItem,
  type SubscriptionPlanItem, type PsySubscriptionItem, type FinanceSummary,
} from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";

/**
 * Maliyyə və Komissiya (Admin BRD §12) — komissiya faizi (qlobal + psixoloq
 * override ayrıca psixoloq kartından), payout izləməsi və abunə planları.
 * Komissiya hər ödəniş operator tərəfindən təsdiqləndikdə avtomatik hesablanır.
 */

type Section = "overview" | "payouts" | "plans";

export default function AdminFinancePage() {
  const [section, setSection] = useState<Section>("overview");

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Maliyyə və Komissiya</h1>
          <p className="page-sub">
            Gəlir modeli: seans/paket ödənişlərindən komissiya + psixoloq abunə haqqı.
          </p>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <button className={`btn ${section === "overview" ? "primary" : ""}`} onClick={() => setSection("overview")}>
          Komissiya və Gəlir
        </button>
        <button className={`btn ${section === "payouts" ? "primary" : ""}`} onClick={() => setSection("payouts")}>
          Psixoloq Ödəmələri
        </button>
        <button className={`btn ${section === "plans" ? "primary" : ""}`} onClick={() => setSection("plans")}>
          Abunə Planları
        </button>
      </div>

      {section === "overview" && <OverviewSection />}
      {section === "payouts" && <PayoutsSection />}
      {section === "plans" && <PlansSection />}
    </div>
  );
}

/* ─── Komissiya + gəlir icmalı ─────────────────────────────────────────── */

function OverviewSection() {
  const [commission, setCommission] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [directCommission, setDirectCommission] = useState<number | null>(null);
  const [directInput, setDirectInput] = useState("");
  const [directBusy, setDirectBusy] = useState(false);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    adminApi.getCommission().then(c => {
      setCommission(c.globalPercent);
      setInput(c.globalPercent != null ? String(c.globalPercent) : "");
    }).catch(() => {});
    adminApi.getDirectCommission().then(c => {
      setDirectCommission(c.globalPercent);
      setDirectInput(c.globalPercent != null ? String(c.globalPercent) : "");
    }).catch(() => {});
    adminApi.financeSummary().then(setSummary).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    const val = Number(input);
    if (!Number.isFinite(val) || val < 0 || val > 100) { alert("Faiz 0-100 aralığında olmalıdır"); return; }
    setBusy(true);
    try {
      const c = await adminApi.setCommission(val);
      setCommission(c.globalPercent);
      alert("Komissiya faizi yeniləndi — bundan sonrakı ödəniş təsdiqlərində tətbiq olunacaq");
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };

  const saveDirect = async () => {
    const val = Number(directInput);
    if (!Number.isFinite(val) || val < 0 || val > 100) { alert("Faiz 0-100 aralığında olmalıdır"); return; }
    setDirectBusy(true);
    try {
      const c = await adminApi.setDirectCommission(val);
      setDirectCommission(c.globalPercent);
      alert("Birbaşa müraciət faizi yeniləndi — bundan sonrakı ödəniş təsdiqlərində tətbiq olunacaq");
    } catch (e) { alert((e as Error).message); }
    finally { setDirectBusy(false); }
  };

  return (
    <>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Qlobal komissiya faizi</h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>
          İlkin dəyər yoxdur — ilk konfiqurasiyada təyin edin. Psixoloq üzrə fərqli faiz (override) psixoloqun
          admin kartından təyin oluna bilər. Hər ödəniş təsdiqləndikdə komissiya avtomatik hesablanır.
        </p>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <input
            type="number" min={0} max={100} step="0.5"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="məs. 20"
            style={{ width: 120, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 14 }}
          />
          <span style={{ fontSize: 14, color: "var(--muted)" }}>%</span>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? "Saxlanılır…" : "Yadda saxla"}
          </button>
          {commission == null && (
            <span className="pill gold">Hələ təyin olunmayıb — komissiya hesablanmır</span>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Birbaşa müraciət faizi</h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>
          Pasient psixoloqu özü seçib müraciət edəndə (platforma yönləndirməyib) tətbiq olunan faiz.
          Təyin edilməyibsə 0% (komissiyasız) tətbiq olunur.
        </p>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <input
            type="number" min={0} max={100} step="0.5"
            value={directInput}
            onChange={e => setDirectInput(e.target.value)}
            placeholder="məs. 0"
            style={{ width: 120, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 14 }}
          />
          <span style={{ fontSize: 14, color: "var(--muted)" }}>%</span>
          <button className="btn primary" onClick={saveDirect} disabled={directBusy}>
            {directBusy ? "Saxlanılır…" : "Yadda saxla"}
          </button>
          {directCommission == null && (
            <span className="pill gold">Hələ təyin olunmayıb — 0% tətbiq olunur</span>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Gəlir icmalı (cari ay)</h3>
        {!loaded ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Yüklənir…</div>
        ) : summary ? (
          <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
            <Metric label="Komissiya gəliri" value={`${summary.commissionRevenue} AZN`} />
            <Metric label="— Birbaşa müraciətdən" value={`${summary.directCommissionRevenue} AZN`} />
            <Metric label="— Yönləndirilmiş müraciətdən" value={`${summary.platformMatchedCommissionRevenue} AZN`} />
            <Metric label="Aktiv abunə" value={String(summary.activeSubscriptions)} />
            <Metric label="Abunə gəliri (aylıq ekv.)" value={`${summary.subscriptionMonthlyRevenue} AZN`} />
            <Metric label="Cəmi" value={`${summary.totalRevenue} AZN`} />
          </div>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Məlumat yoxdur</div>
        )}
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

/* ─── Payout ───────────────────────────────────────────────────────────── */

function PayoutsSection() {
  const [balances, setBalances] = useState<PayoutBalance[]>([]);
  const [history, setHistory] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.payoutBalances().catch(() => [] as PayoutBalance[]),
      adminApi.listPayouts().catch(() => [] as PayoutItem[]),
    ]).then(([b, h]) => { setBalances(b); setHistory(h); }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const pay = async (b: PayoutBalance) => {
    const amountStr = window.prompt(
      `${b.psychologistName} — qalıq balans ${b.balance} AZN.\nÖdəniləcək məbləğ:`,
      String(b.balance > 0 ? b.balance : ""));
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) { alert("Məbləğ düzgün deyil"); return; }
    const note = window.prompt("Qeyd (məs. bank köçürməsi referansı, opsional):") ?? undefined;
    setBusyId(b.psychologistId);
    try {
      await adminApi.createPayout({ psychologistId: b.psychologistId, amount, note });
      load();
    } catch (e) { alert((e as Error).message); }
    finally { setBusyId(null); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>;

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <strong style={{ fontSize: 14 }}>Balanslar</strong>
          <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
            Qazanc = ödənilmiş məbləğ − iadə − komissiya. Ödəmə manual (bank köçürməsi) qeyd olunur, psixoloqa bildiriş gedir.
          </span>
        </div>
        {balances.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            Hələ qazanc qeydi yoxdur
          </div>
        ) : balances.map(b => (
          <div className="list-item" key={b.psychologistId}>
            <div style={{ flex: 1 }}>
              <div className="li-title">{b.psychologistName}</div>
              <div className="li-meta">
                Qazanc (net): {b.earnedNet} AZN · Ödənilib: {b.paidOut} AZN ·{" "}
                <strong style={{ color: b.balance > 0 ? "#065F46" : undefined }}>Qalıq: {b.balance} AZN</strong>
              </div>
            </div>
            <button className="btn primary sm" disabled={busyId === b.psychologistId || b.balance <= 0}
              onClick={() => pay(b)}>
              {busyId === b.psychologistId ? "…" : "Ödəmə qeyd et"}
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <strong style={{ fontSize: 14 }}>Ödəmə tarixçəsi</strong>
        </div>
        {history.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            Hələ ödəmə yoxdur
          </div>
        ) : history.map(p => (
          <div className="list-item" key={p.id}>
            <div style={{ flex: 1 }}>
              <div className="li-title">
                {p.psychologistName ?? `Psixoloq #${p.psychologistId}`}
                <span className="pill sage" style={{ marginLeft: 8 }}>Ödənildi</span>
              </div>
              <div className="li-meta">
                {p.amount} AZN · {azFormatDateTime(p.paidAt ?? p.createdAt)}
                {p.note && <> · {p.note}</>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── Abunə planları ───────────────────────────────────────────────────── */

function PlansSection() {
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);
  const [subs, setSubs] = useState<PsySubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.listSubscriptionPlans().catch(() => [] as SubscriptionPlanItem[]),
      adminApi.listSubscriptions().catch(() => [] as PsySubscriptionItem[]),
    ]).then(([p, s]) => { setPlans(p); setSubs(s); }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const createPlan = async () => {
    const name = window.prompt("Plan adı (məs. Standart):");
    if (!name?.trim()) return;
    const priceStr = window.prompt("Qiymət (AZN):");
    const price = Number(priceStr);
    if (!Number.isFinite(price) || price < 0) { alert("Qiymət düzgün deyil"); return; }
    const period = window.confirm("İllik plan? (OK = illik, Cancel = aylıq)") ? "YEARLY" : "MONTHLY";
    const perks = window.prompt("Daxil olan imtiyazlar (opsional):") ?? undefined;
    setBusy(true);
    try {
      await adminApi.createSubscriptionPlan({ name: name.trim(), price, period, perks });
      load();
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };

  const togglePlan = async (p: SubscriptionPlanItem) => {
    setBusy(true);
    try {
      await adminApi.updateSubscriptionPlan(p.id, {
        name: p.name, price: p.price, period: p.period, perks: p.perks ?? undefined, active: !p.active,
      });
      load();
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };

  const setSubStatus = async (s: PsySubscriptionItem) => {
    const status = window.prompt("Yeni status (ACTIVE / EXPIRED / OVERDUE / CANCELLED):", s.status);
    if (!status) return;
    setBusy(true);
    try {
      await adminApi.updateSubscriptionStatus(s.id, status.trim().toUpperCase());
      load();
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>;

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong style={{ fontSize: 14 }}>Planlar</strong>
            <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
              Sabit struktur yoxdur — planları sərbəst yaradın.
            </span>
          </div>
          <button className="btn primary sm" onClick={createPlan} disabled={busy}>Yeni plan</button>
        </div>
        {plans.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            Hələ plan yaradılmayıb
          </div>
        ) : plans.map(p => (
          <div className="list-item" key={p.id}>
            <div style={{ flex: 1 }}>
              <div className="li-title">
                {p.name}
                <span className={`pill ${p.active ? "sage" : "muted"}`} style={{ marginLeft: 8 }}>
                  {p.active ? "Aktiv" : "Deaktiv"}
                </span>
              </div>
              <div className="li-meta">
                {p.price} AZN / {p.period === "YEARLY" ? "illik" : "aylıq"}
                {p.perks && <> · {p.perks}</>}
              </div>
            </div>
            <button className="btn sm" onClick={() => togglePlan(p)} disabled={busy}>
              {p.active ? "Deaktiv et" : "Aktivləşdir"}
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <strong style={{ fontSize: 14 }}>Psixoloq abunələri</strong>
          <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
            Abunə təyinatı psixoloqun admin kartından və ya API ilə edilir; status buradan idarə olunur.
          </span>
        </div>
        {subs.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            Hələ abunə yoxdur
          </div>
        ) : subs.map(s => (
          <div className="list-item" key={s.id}>
            <div style={{ flex: 1 }}>
              <div className="li-title">
                {s.psychologistName ?? `Psixoloq #${s.psychologistId}`}
                <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {s.planName ?? `Plan #${s.planId}`}</span>
                <span className={`pill ${s.status === "ACTIVE" ? "sage" : s.status === "OVERDUE" ? "gold" : "muted"}`} style={{ marginLeft: 8 }}>
                  {s.status}
                </span>
              </div>
              <div className="li-meta">
                Başlanğıc: {s.startedAt} · Bitmə: {s.expiresAt ?? "—"}
                {s.planPrice != null && <> · {s.planPrice} AZN</>}
              </div>
            </div>
            <button className="btn sm" onClick={() => setSubStatus(s)} disabled={busy}>Statusu dəyiş</button>
          </div>
        ))}
      </div>
    </>
  );
}
