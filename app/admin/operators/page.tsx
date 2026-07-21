"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminApi, type OperatorOverview } from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";

/** MODUL 3D — operator idarəetməsi: siyahı, performans, deaktiv et, şifrə-reset. */
export default function AdminOperatorsPage() {
  const [items, setItems] = useState<OperatorOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.getOperatorsOverview().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleActive = async (op: OperatorOverview) => {
    if (!window.confirm(`${op.name} ${op.active ? "deaktiv edilsin" : "aktivləşdirilsin"}?`)) return;
    setBusyId(op.userId);
    try {
      await adminApi.toggleUserActive(op.userId);
      load();
    } catch (e) { alert((e as Error).message); }
    finally { setBusyId(null); }
  };

  const sendReset = async (op: OperatorOverview) => {
    setBusyId(op.userId);
    try {
      await adminApi.sendPasswordReset(op.userId);
      alert(`Şifrə-reset linki ${op.email} ünvanına göndərildi.`);
    } catch (e) { alert((e as Error).message); }
    finally { setBusyId(null); }
  };

  const totals = useMemo(() => ({
    today: items.reduce((s, o) => s + o.assignedToday, 0),
    week: items.reduce((s, o) => s + o.assignedWeek, 0),
    sla: items.reduce((s, o) => s + o.slaViolations30, 0),
  }), [items]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Operatorlar</h1>
          <p className="page-sub" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <span>Komanda: bu gün {totals.today} təyin</span>
            <span>son 7 gün {totals.week}</span>
            <span>son 30 gündə {totals.sla} SLA pozuntusu</span>
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={load}>Yenilə</button>
          <button className="btn primary" onClick={() => setCreateOpen(true)}>+ Yeni operator</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          Operator yoxdur.
        </div>
      ) : (
        <div className="card">
          <div className="list-item" style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 700 }}>
            <div style={{ flex: 2 }}>Operator</div>
            <div style={{ flex: 1, textAlign: "center" }}>Bu gün / 7g / 30g</div>
            <div style={{ flex: 1, textAlign: "center" }}>Ort. cavab</div>
            <div style={{ flex: 1, textAlign: "center" }}>SLA (30g)</div>
            <div style={{ flex: 1.4, textAlign: "right" }}>Əməliyyat</div>
          </div>
          {items.map((op) => (
            <div className="list-item" key={op.userId}>
              <div style={{ flex: 2, minWidth: 0 }}>
                <div className="li-title">
                  <Link href={`/admin/users/${op.userId}`}>{op.name}</Link>
                  {!op.active && <span className="pill rose" style={{ marginLeft: 6 }}>deaktiv</span>}
                </div>
                <div className="li-meta row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <span>{op.email}</span>
                  <span>son giriş: {op.lastLogin ? azFormatDateTime(op.lastLogin) : "—"}</span>
                </div>
              </div>
              <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 600 }}>
                {op.assignedToday} / {op.assignedWeek} / {op.assigned30}
              </div>
              <div style={{ flex: 1, textAlign: "center", fontSize: 13 }}>
                {op.avgResponseMinutes != null ? `${Math.round(op.avgResponseMinutes)} dəq` : "—"}
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <span className={`pill ${op.slaViolations30 > 0 ? "rose" : "sage"}`}>{op.slaViolations30}</span>
              </div>
              <div style={{ flex: 1.4, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button className="btn ghost sm" disabled={busyId === op.userId} onClick={() => sendReset(op)}>
                  Şifrə-reset
                </button>
                <button className={`btn sm${op.active ? " danger" : ""}`} disabled={busyId === op.userId} onClick={() => toggleActive(op)}>
                  {op.active ? "Deaktiv et" : "Aktivləşdir"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && <CreateOperatorModal onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load(); }} />}
    </div>
  );
}

function CreateOperatorModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!email.trim() || !firstName.trim() || !lastName.trim()) { setErr("Email, ad və soyad məcburidir"); return; }
    setBusy(true);
    try {
      await adminApi.createOperator({ email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() || undefined });
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(440px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Yeni operator</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Müvəqqəti şifrə email ilə göndəriləcək.</p>
        </div>
        <div style={{ padding: 20, display: "grid", gap: 10 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ad"
              style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }} />
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Soyad"
              style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }} />
          </div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon (opsional)"
            style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }} />
          {err && <div style={{ fontSize: 12, color: "#991B1B" }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose}>Bağla</button>
            <button className="btn primary" onClick={submit} disabled={busy}>{busy ? "Yaradılır…" : "Yarat"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
