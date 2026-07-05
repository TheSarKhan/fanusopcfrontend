"use client";

/**
 * Psixoloq tərəfi — yönləndirmə paneli (Aldıqlarım / Göndərdiklərim + yaratma).
 * Görüşlər səhifəsinin "Yönləndirmələr" tabında və (kilidli) standalone səhifədə
 * eyni komponent işlədilir. `onPendingCount` valideynə cavab gözləyən alınmış
 * yönləndirmələrin sayını bildirir (tab badge üçün).
 */

import { useEffect, useMemo, useState } from "react";
import {
  psychologistApi,
  getPsychologists,
  type Referral,
  type ReferralStatus,
  type ReferralSubjectType,
  type CreateReferralReq,
  type ReferableSubject,
  type Psychologist,
} from "@/lib/api";
import { formatAzn } from "@/lib/money";

const STATUS_META: Record<ReferralStatus, { label: string; color: string; bg: string }> = {
  PENDING_OPERATOR: { label: "Operator təsdiqi gözlənilir", color: "#92400E", bg: "#FEF3C7" },
  PENDING_REVIEW:   { label: "Cavab gözlənilir",            color: "#1E40AF", bg: "#DBEAFE" },
  ACCEPTED:         { label: "Qəbul olundu",                color: "#065F46", bg: "#D1FAE5" },
  DECLINED:         { label: "Rədd olundu",                 color: "#991B1B", bg: "#FEE2E2" },
  CANCELLED:        { label: "Ləğv olundu",                 color: "#475569", bg: "#F1F5F9" },
};

const SUBJECT_META: Record<"APPOINTMENT" | "PACKAGE", { label: string; color: string; bg: string }> = {
  APPOINTMENT: { label: "Randevu", color: "#1E40AF", bg: "#EFF6FF" },
  PACKAGE:     { label: "Paket",   color: "#5B21B6", bg: "#F5F3FF" },
};

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

type Tab = "RECEIVED" | "SENT";

const PAGE_SIZE = 30;

export default function PsyReferralsView({ onPendingCount }: { onPendingCount?: (n: number) => void }) {
  const [tab, setTab] = useState<Tab>("RECEIVED");
  const [received, setReceived] = useState<Referral[]>([]);
  const [receivedTotal, setReceivedTotal] = useState(0);
  const [receivedPage, setReceivedPage] = useState(0);
  const [sent, setSent] = useState<Referral[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [sentPage, setSentPage] = useState(0);
  const [pendingReceived, setPendingReceived] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMoreReceived, setLoadingMoreReceived] = useState(false);
  const [loadingMoreSent, setLoadingMoreSent] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.receivedReferralsPaged({ page: 0, size: PAGE_SIZE }),
      psychologistApi.sentReferralsPaged({ page: 0, size: PAGE_SIZE }),
      // Yüngül sorğu — badge üçün yalnız totalElements lazımdır.
      psychologistApi.receivedReferralsPaged({ status: "PENDING_REVIEW", size: 5 }),
    ])
      .then(([rec, snt, pend]) => {
        setReceived(rec.content); setReceivedTotal(rec.totalElements); setReceivedPage(0);
        setSent(snt.content); setSentTotal(snt.totalElements); setSentPage(0);
        setPendingReceived(pend.totalElements);
      })
      .catch(() => {
        setReceived([]); setReceivedTotal(0);
        setSent([]); setSentTotal(0);
        setPendingReceived(0);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const loadMoreReceived = () => {
    setLoadingMoreReceived(true);
    psychologistApi.receivedReferralsPaged({ page: receivedPage + 1, size: PAGE_SIZE })
      .then(res => {
        setReceived(prev => [...prev, ...res.content]);
        setReceivedTotal(res.totalElements);
        setReceivedPage(res.page);
      })
      .catch(() => {})
      .finally(() => setLoadingMoreReceived(false));
  };

  const loadMoreSent = () => {
    setLoadingMoreSent(true);
    psychologistApi.sentReferralsPaged({ page: sentPage + 1, size: PAGE_SIZE })
      .then(res => {
        setSent(prev => [...prev, ...res.content]);
        setSentTotal(res.totalElements);
        setSentPage(res.page);
      })
      .catch(() => {})
      .finally(() => setLoadingMoreSent(false));
  };

  // Yeni yönləndirmə yaradılanda göndərilənlərin birinci səhifəsini təzələ.
  const reloadSent = () => {
    psychologistApi.sentReferralsPaged({ page: 0, size: PAGE_SIZE })
      .then(res => { setSent(res.content); setSentTotal(res.totalElements); setSentPage(0); })
      .catch(() => {});
  };

  // Valideynə (Görüşlər tab badge-i üçün) cavab gözləyən sayını bildir.
  useEffect(() => { onPendingCount?.(pendingReceived); }, [pendingReceived, onPendingCount]);

  const respond = async (r: Referral, action: "accept" | "decline") => {
    setBusyId(r.id);
    setError(null);
    try {
      const updated = action === "accept"
        ? await psychologistApi.acceptReferral(r.id)
        : await psychologistApi.declineReferral(r.id);
      setReceived(prev => prev.map(x => x.id === r.id ? updated : x));
      // Cavablanan yönləndirmə PENDING_REVIEW-dan çıxdı — badge sayını azalt.
      setPendingReceived(n => Math.max(0, n - 1));
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{
          display: "flex", gap: 4, background: "#fff", borderRadius: 12,
          padding: 6, border: "1px solid var(--oxford-10)",
        }}>
          <TabBtn active={tab === "RECEIVED"} onClick={() => setTab("RECEIVED")} count={pendingReceived}>Aldıqlarım</TabBtn>
          <TabBtn active={tab === "SENT"} onClick={() => setTab("SENT")} count={sentTotal}>Göndərdiklərim</TabBtn>
        </div>
        <button onClick={() => setCreating(true)} style={primaryBtn}>
          <IconPlus /> Yeni yönləndirmə
        </button>
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
        <>
          {received.length === 0 ? (
            <Empty title="Aldığınız yönləndirmə yoxdur" body="Həmkarınız sizə randevu və ya paket yönləndirəndə (operator təsdiqindən sonra) burada görünəcək." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {received.map(r => (
                <ReceivedCard key={r.id} r={r} busy={busyId === r.id} onRespond={respond} />
              ))}
            </div>
          )}
          {received.length < receivedTotal && (
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <button type="button" onClick={loadMoreReceived} disabled={loadingMoreReceived}
                style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMoreReceived ? "wait" : "pointer", opacity: loadingMoreReceived ? 0.7 : 1 }}>
                {loadingMoreReceived ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, receivedTotal - received.length)})`}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {sent.length === 0 ? (
            <Empty title="Göndərdiyiniz yönləndirmə yoxdur" body="İlk yönləndirməni yaratmaq üçün yuxarıdakı düyməyə basın." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sent.map(r => (
                <SentCard key={r.id} r={r} busy={busyId === r.id} onCancel={cancel} />
              ))}
            </div>
          )}
          {sent.length < sentTotal && (
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <button type="button" onClick={loadMoreSent} disabled={loadingMoreSent}
                style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMoreSent ? "wait" : "pointer", opacity: loadingMoreSent ? 0.7 : 1 }}>
                {loadingMoreSent ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, sentTotal - sent.length)})`}
              </button>
            </div>
          )}
        </>
      )}

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={() => { reloadSent(); setCreating(false); setTab("SENT"); }} />
      )}
    </div>
  );
}

/* ─── Pul nişanı (ötürülən dəyər) ─────────────────────────────────────────── */

function MoneyTag({ label, amount, currency }: { label: string; amount?: number | null; currency?: string | null }) {
  if (amount == null) return null;
  const text = currency && currency !== "AZN" ? `${amount} ${currency}` : formatAzn(amount);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, background: "#ECFDF5", color: "#047857",
      border: "1px solid #A7F3D0", fontSize: 12, fontWeight: 700, padding: "4px 11px", borderRadius: 999,
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M15 9.5a3 3 0 0 0-3-2 3 3 0 0 0 0 6 3 3 0 0 1 0 6 3 3 0 0 1-3-2M12 6v1.5M12 16.5V18" />
      </svg>
      {label}: {text}
    </span>
  );
}

/* ─── Received card ───────────────────────────────────────────────────────── */

function ReceivedCard({ r, busy, onRespond }: {
  r: Referral; busy: boolean; onRespond: (r: Referral, a: "accept" | "decline") => void;
}) {
  const sm = STATUS_META[r.status];
  const subj = SUBJECT_META[r.subjectType];
  const pending = r.status === "PENDING_REVIEW";
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={badge(subj)}>{subj.label}</span>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
            {r.subjectLabel || r.patientName || "Subyekt"}
          </div>
        </div>
        <span style={badge(sm)}>{sm.label}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>
        Yönləndirən: <b style={{ color: "var(--oxford)" }}>{r.fromPsychologistName}</b>
        {r.patientName ? <> · Klient: <b style={{ color: "var(--oxford)" }}>{r.patientName}</b></> : null}
        {" · "}{fmtDate(r.createdAt)}
      </div>
      <MoneyTag label="Yönləndirilən dəyər" amount={r.referredAmount} currency={r.currency} />
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
  const subj = SUBJECT_META[r.subjectType];
  const open = r.status === "PENDING_OPERATOR" || r.status === "PENDING_REVIEW";
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={badge(subj)}>{subj.label}</span>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>
            {r.toPsychologistName}
          </div>
        </div>
        <span style={badge(sm)}>{sm.label}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>
        {r.subjectLabel ? <>{r.subjectLabel} · </> : null}
        Klient: <b style={{ color: "var(--oxford)" }}>{r.patientName || "Klient"}</b> · {fmtDate(r.createdAt)}
      </div>
      <MoneyTag label="Ötürülən dəyər" amount={r.referredAmount} currency={r.currency} />
      <InfoBlock label="Səbəb" text={r.reason} />
      {r.status === "DECLINED" && r.operatorNote ? <InfoBlock label="Operator qeydi" text={r.operatorNote} /> : null}
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
  const [colleagues, setColleagues] = useState<Psychologist[]>([]);
  const [meId, setMeId] = useState<number | null>(null);
  const [options, setOptions] = useState<{ appointments: ReferableSubject[]; packages: ReferableSubject[] }>({ appointments: [], packages: [] });

  const [subjectType, setSubjectType] = useState<ReferralSubjectType>("APPOINTMENT");
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [toId, setToId] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    psychologistApi.me().then(p => setMeId(p.id)).catch(() => {});
    psychologistApi.referralOptions().then(setOptions).catch(() => setOptions({ appointments: [], packages: [] }));
    getPsychologists().then(setColleagues).catch(() => setColleagues([]));
  }, []);

  const colleagueOptions = useMemo(
    () => colleagues.filter(p => p.active && p.id !== meId),
    [colleagues, meId]);

  const subjects = subjectType === "APPOINTMENT" ? options.appointments : options.packages;
  const selectedSubject = useMemo(
    () => (subjectId === "" ? null : subjects.find(s => s.id === subjectId) ?? null),
    [subjects, subjectId]);

  // Subyekt növü dəyişəndə seçimi sıfırla.
  useEffect(() => { setSubjectId(""); }, [subjectType]);

  const save = async () => {
    if (subjectId === "" || toId === "") { setError("Subyekt və psixoloq seçin."); return; }
    if (!reason.trim()) { setError("Səbəb mütləqdir."); return; }
    setSaving(true);
    setError(null);
    const payload: CreateReferralReq = {
      toPsychologistId: Number(toId),
      subjectType,
      appointmentId: subjectType === "APPOINTMENT" ? Number(subjectId) : undefined,
      patientPackageId: subjectType === "PACKAGE" ? Number(subjectId) : undefined,
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

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--oxford-10)",
    background: active ? "var(--brand)" : "#fff", color: active ? "#fff" : "var(--oxford)",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
  });

  const subjLabel = (s: ReferableSubject) =>
    `${s.label}${s.patientName ? ` · ${s.patientName}` : ""}${s.amount != null ? ` · ${formatAzn(s.amount)}` : ""}`;

  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--oxford)", margin: "0 0 16px" }}>Yeni yönləndirmə</h3>

      <Field label="Nəyi yönləndirirsiniz?">
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setSubjectType("APPOINTMENT")} style={tabBtn(subjectType === "APPOINTMENT")}>Randevu</button>
          <button type="button" onClick={() => setSubjectType("PACKAGE")} style={tabBtn(subjectType === "PACKAGE")}>Paket</button>
        </div>
      </Field>

      <Field label={subjectType === "APPOINTMENT" ? "Randevu" : "Paket"}>
        <select value={subjectId} onChange={e => setSubjectId(e.target.value === "" ? "" : Number(e.target.value))} style={inputStyle}>
          <option value="">Seçin…</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{subjLabel(s)}</option>
          ))}
        </select>
        {subjects.length === 0 && (
          <p style={{ fontSize: 11.5, color: "var(--oxford-60)", margin: "6px 0 0" }}>
            {subjectType === "APPOINTMENT" ? "Yönləndiriləcək aktiv randevu yoxdur." : "Balansı qalan aktiv paket yoxdur."}
          </p>
        )}
        {selectedSubject && selectedSubject.amount != null && (
          <div style={{ marginTop: 8 }}>
            <MoneyTag label="Ötürüləcək dəyər" amount={selectedSubject.amount} currency={selectedSubject.currency} />
          </div>
        )}
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
          placeholder="Qarşı psixoloqa ötürüləcək qısa kontekst…"
          style={{ ...inputStyle, resize: "vertical" }} />
      </Field>

      <Field label="Həmkara qeyd (istəyə bağlı)">
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
          style={{ ...inputStyle, resize: "vertical" }} />
      </Field>

      <p style={{ fontSize: 11.5, color: "var(--oxford-60)", margin: "2px 0 0", lineHeight: 1.5 }}>
        Yönləndirmə əvvəlcə operator təsdiqinə gedir. Təsdiqdən sonra qarşı psixoloq onu görür; qəbul edəndə sahiblik ona keçir.
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
