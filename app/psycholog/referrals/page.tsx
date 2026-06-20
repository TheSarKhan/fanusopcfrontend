"use client";

import { useEffect, useMemo, useState } from "react";
import {
  psychologistApi,
  getPsychologists,
  type Referral,
  type ReferralStatus,
  type CreateReferralReq,
  type ClientSummary,
  type Psychologist,
} from "@/lib/api";

const STATUS_META: Record<ReferralStatus, { label: string; color: string; bg: string }> = {
  PENDING_CONSENT: { label: "Klient razılığı gözlənilir", color: "#92400E", bg: "#FEF3C7" },
  PENDING_REVIEW:  { label: "Cavab gözlənilir",           color: "#1E40AF", bg: "#DBEAFE" },
  ACCEPTED:        { label: "Qəbul olundu",               color: "#065F46", bg: "#D1FAE5" },
  DECLINED:        { label: "Rədd olundu",                color: "#991B1B", bg: "#FEE2E2" },
  CANCELLED:       { label: "Ləğv olundu",                color: "#475569", bg: "#F1F5F9" },
};

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

type Tab = "RECEIVED" | "SENT";

export default function PsychologReferralsPage() {
  const [tab, setTab] = useState<Tab>("RECEIVED");
  const [received, setReceived] = useState<Referral[]>([]);
  const [sent, setSent] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([psychologistApi.receivedReferrals(), psychologistApi.sentReferrals()])
      .then(([rec, snt]) => { setReceived(rec); setSent(snt); })
      .catch(() => { setReceived([]); setSent([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const pendingReceived = useMemo(() => received.filter(r => r.status === "PENDING_REVIEW").length, [received]);

  const respond = async (r: Referral, action: "accept" | "decline") => {
    setBusyId(r.id);
    setError(null);
    try {
      const updated = action === "accept"
        ? await psychologistApi.acceptReferral(r.id)
        : await psychologistApi.declineReferral(r.id);
      setReceived(prev => prev.map(x => x.id === r.id ? updated : x));
    } catch (e) {
      setError("Əməliyyat alınmadı: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (r: Referral) => {
    setBusyId(r.id);
    setError(null);
    try {
      const updated = await psychologistApi.cancelReferral(r.id);
      setSent(prev => prev.map(x => x.id === r.id ? updated : x));
    } catch (e) {
      setError("Ləğv alınmadı: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--oxford)", margin: 0 }}>Yönləndirmələr</h1>
          <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4, marginBottom: 0 }}>
            Klientləri həmkarlarınıza yönləndirin — klient razılığı ilə.
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={primaryBtn}>
          <IconPlus /> Yeni yönləndirmə
        </button>
      </div>

      <div style={{
        display: "flex", gap: 4, background: "#fff", borderRadius: 12,
        padding: 6, border: "1px solid var(--oxford-10)", alignSelf: "flex-start",
      }}>
        <TabBtn active={tab === "RECEIVED"} onClick={() => setTab("RECEIVED")} count={pendingReceived}>Aldıqlarım</TabBtn>
        <TabBtn active={tab === "SENT"} onClick={() => setTab("SENT")} count={sent.length}>Göndərdiklərim</TabBtn>
      </div>

      {error && (
        <div role="alert" style={{
          fontSize: 12.5, fontWeight: 600, color: "#991B1B", background: "#FEE2E2",
          border: "1px solid #FECACA", borderRadius: 10, padding: "10px 12px",
        }}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 14, height: 120 }} />
          ))}
        </div>
      ) : tab === "RECEIVED" ? (
        received.length === 0 ? (
          <Empty title="Aldığınız yönləndirmə yoxdur" body="Həmkarlarınız sizə klient yönləndirəndə burada görünəcək." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {received.map(r => (
              <ReceivedCard key={r.id} r={r} busy={busyId === r.id} onRespond={respond} />
            ))}
          </div>
        )
      ) : (
        sent.length === 0 ? (
          <Empty title="Göndərdiyiniz yönləndirmə yoxdur" body="İlk yönləndirməni yaratmaq üçün yuxarıdakı düyməyə basın." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sent.map(r => (
              <SentCard key={r.id} r={r} busy={busyId === r.id} onCancel={cancel} />
            ))}
          </div>
        )
      )}

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={(r) => { setSent(prev => [r, ...prev]); setCreating(false); setTab("SENT"); }} />
      )}
    </div>
  );
}

/* ─── Received card ───────────────────────────────────────────────────────── */

function ReceivedCard({ r, busy, onRespond }: {
  r: Referral; busy: boolean; onRespond: (r: Referral, a: "accept" | "decline") => void;
}) {
  const sm = STATUS_META[r.status];
  const pending = r.status === "PENDING_REVIEW";
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
          {r.patientName || "Klient"}
        </div>
        <span style={badge(sm)}>{sm.label}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>
        Yönləndirən: <b style={{ color: "var(--oxford)" }}>{r.fromPsychologistName}</b> · {fmtDate(r.createdAt)}
      </div>
      <InfoBlock label="Səbəb" text={r.reason} />
      {r.clinicalSummary && <InfoBlock label="Klinik məlumat" text={r.clinicalSummary} />}
      {r.message && <InfoBlock label="Qeyd" text={r.message} />}
      {pending && (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => onRespond(r, "decline")} disabled={busy} style={dangerGhostBtn}>Rədd et</button>
          <button onClick={() => onRespond(r, "accept")} disabled={busy} style={primaryBtn}>
            {busy ? "..." : "Qəbul et"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Sent card ───────────────────────────────────────────────────────────── */

function SentCard({ r, busy, onCancel }: { r: Referral; busy: boolean; onCancel: (r: Referral) => void }) {
  const sm = STATUS_META[r.status];
  const open = r.status === "PENDING_CONSENT" || r.status === "PENDING_REVIEW";
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
          {r.toPsychologistName}
        </div>
        <span style={badge(sm)}>{sm.label}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>
        Klient: <b style={{ color: "var(--oxford)" }}>{r.patientName || "Klient"}</b> · {fmtDate(r.createdAt)}
      </div>
      <InfoBlock label="Səbəb" text={r.reason} />
      {open && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => onCancel(r)} disabled={busy} style={dangerGhostBtn}>
            {busy ? "..." : "Ləğv et"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Create modal ────────────────────────────────────────────────────────── */

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: Referral) => void }) {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [colleagues, setColleagues] = useState<Psychologist[]>([]);
  const [meId, setMeId] = useState<number | null>(null);

  const [patientId, setPatientId] = useState<number | "">("");
  const [toId, setToId] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    psychologistApi.me().then(p => setMeId(p.id)).catch(() => {});
    psychologistApi.clients().then(setClients).catch(() => setClients([]));
    getPsychologists().then(setColleagues).catch(() => setColleagues([]));
  }, []);

  const colleagueOptions = useMemo(
    () => colleagues.filter(p => p.active && p.id !== meId),
    [colleagues, meId]);

  const save = async () => {
    if (patientId === "" || toId === "") { setError("Klient və psixoloq seçin."); return; }
    if (!reason.trim()) { setError("Səbəb mütləqdir."); return; }
    setSaving(true);
    setError(null);
    const payload: CreateReferralReq = {
      toPsychologistId: Number(toId),
      patientId: Number(patientId),
      reason: reason.trim(),
      clinicalSummary: clinicalSummary.trim() || undefined,
      message: message.trim() || undefined,
    };
    try {
      const created = await psychologistApi.createReferral(payload);
      onCreated(created);
    } catch (e) {
      setError("Yaradılmadı: " + (e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--oxford)", margin: "0 0 16px" }}>Yeni yönləndirmə</h3>

      <Field label="Klient">
        <select value={patientId} onChange={e => setPatientId(e.target.value === "" ? "" : Number(e.target.value))} style={inputStyle}>
          <option value="">Seçin…</option>
          {clients.map(c => <option key={c.patientId} value={c.patientId}>{c.name}</option>)}
        </select>
      </Field>

      <Field label="Hansı psixoloqa">
        <select value={toId} onChange={e => setToId(e.target.value === "" ? "" : Number(e.target.value))} style={inputStyle}>
          <option value="">Seçin…</option>
          {colleagueOptions.map(p => <option key={p.id} value={p.id}>{p.name} — {p.title}</option>)}
        </select>
      </Field>

      <Field label="Səbəb">
        <input value={reason} onChange={e => setReason(e.target.value)} maxLength={500}
          placeholder="Məs: ailə terapiyası ixtisası tələb olunur" style={inputStyle} />
      </Field>

      <Field label="Klinik məlumat (istəyə bağlı)">
        <textarea value={clinicalSummary} onChange={e => setClinicalSummary(e.target.value)} rows={4}
          placeholder="Qarşı psixoloqa ötürüləcək qısa kontekst (klient razılığından sonra görünür)…"
          style={{ ...inputStyle, resize: "vertical" }} />
      </Field>

      <Field label="Həmkara qeyd (istəyə bağlı)">
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
          style={{ ...inputStyle, resize: "vertical" }} />
      </Field>

      <p style={{ fontSize: 11.5, color: "var(--oxford-60)", margin: "2px 0 0", lineHeight: 1.5 }}>
        Yönləndirmə əvvəlcə klientin razılığına göndərilir. Razılıqdan sonra qarşı psixoloq onu görür.
      </p>

      {error && <p style={{ color: "#DC2626", fontSize: 12.5, margin: "8px 0 0" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={ghostBtn}>Ləğv et</button>
        <button onClick={save} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Göndərilir…" : "Göndər"}
        </button>
      </div>
    </Modal>
  );
}

/* ─── atoms ───────────────────────────────────────────────────────────────── */

function InfoBlock({ label, text }: { label: string; text: string }) {
  return (
    <div style={{
      fontSize: 12.5, color: "var(--oxford-60)", background: "var(--brand-50)",
      borderRadius: 10, padding: "9px 12px", lineHeight: 1.5, whiteSpace: "pre-wrap",
    }}>
      <span style={{ fontWeight: 700, color: "var(--oxford)" }}>{label}: </span>{text}
    </div>
  );
}

function TabBtn({ active, count, onClick, children }: {
  active: boolean; count: number; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 16px", borderRadius: 8, border: "none",
      background: active ? "var(--brand)" : "transparent",
      color: active ? "#fff" : "var(--oxford-60)",
      fontSize: 13, fontWeight: 700, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 7,
    }}>
      {children}
      {count > 0 && (
        <span style={{
          fontSize: 10.5, fontWeight: 700, padding: "0 6px", borderRadius: 999,
          background: active ? "rgba(255,255,255,0.25)" : "var(--oxford-10)",
          color: active ? "#fff" : "var(--oxford-60)", minWidth: 16, textAlign: "center",
        }}>{count}</span>
      )}
    </button>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div style={{
      textAlign: "center", padding: "56px 24px",
      background: "#fff", borderRadius: 16, border: "1px dashed var(--oxford-10)",
    }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", margin: "0 0 4px" }}>{title}</p>
      <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: 0 }}>{body}</p>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(10, 22, 51, 0.55)", backdropFilter: "blur(4px)", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, padding: "24px 26px",
        maxWidth: 520, width: "100%", maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
      }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--oxford)", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff", borderRadius: 14, border: "1px solid var(--oxford-10)",
  padding: 16, display: "flex", flexDirection: "column", gap: 10,
};

function badge(sm: { color: string; bg: string }): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
    background: sm.bg, color: sm.color, whiteSpace: "nowrap",
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  border: "1.5px solid var(--oxford-10)", fontSize: 13,
  color: "var(--oxford)", outline: "none", boxSizing: "border-box",
  fontFamily: "inherit", background: "#fff",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
  background: "var(--brand)", color: "#fff", border: "none", cursor: "pointer",
  boxShadow: "0 4px 14px rgba(16,81,183,0.25)",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
  background: "#fff", color: "var(--oxford)",
  border: "1px solid var(--oxford-10)", cursor: "pointer",
};

const dangerGhostBtn: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 700,
  background: "#fff", color: "#991B1B", border: "1px solid #FECACA", cursor: "pointer",
};

const IconPlus = () => (
  <svg width="14" height="14" strokeWidth="2.5" fill="none" stroke="currentColor"
    strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
