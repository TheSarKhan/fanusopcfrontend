"use client";

/**
 * Yönləndirmə detalı — Randevular səhifəsinin "Yönləndirmələr" tabındakı
 * ReferralCard-a klikdən açılır. Kim kimə niyə yönləndirmək istəyir: göndərən/
 * qəbul edən psixoloq, pasiyent, subyekt (randevu/paket), səbəb, klinik xülasə,
 * ötürülən dəyər. PENDING_OPERATOR statusundadırsa operator təsdiq/rədd edir.
 */

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { operatorApi, type Referral } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { toast as uiToast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";

const SUBJECT_META: Record<"APPOINTMENT" | "PACKAGE", { label: string; color: string; bg: string }> = {
  APPOINTMENT: { label: "Randevu", color: "#1E40AF", bg: "#EFF6FF" },
  PACKAGE:     { label: "Paket",   color: "#5B21B6", bg: "#F5F3FF" },
};

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  PENDING_OPERATOR: { label: "Operator təsdiqi gözlənir", bg: "#FEF3C7", color: "#92400E" },
  PENDING_REVIEW:   { label: "Qarşı psixoloqda",          bg: "#E4ECFA", color: "#1E40AF" },
  ACCEPTED:         { label: "Qəbul edilib",              bg: "#D1FAE5", color: "#065F46" },
  DECLINED:         { label: "Rədd edilib",                bg: "#FEE2E2", color: "#991B1B" },
  CANCELLED:        { label: "Ləğv edilib",                bg: "#F3F4F6", color: "#374151" },
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}, ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

export default function OperatorReferralDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = use(params);
  const id = Number(idStr);
  const router = useRouter();

  const [r, setR] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!Number.isFinite(id)) { setError(true); setLoading(false); return; }
    setLoading(true);
    operatorApi.referral(id)
      .then(setR)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const backToList = () => router.push("/operator/appointments?view=referrals");

  const approve = async () => {
    if (!r) return;
    const ok = await confirmDialog({
      title: "Yönləndirməni təsdiqlə",
      message: `${r.fromPsychologistName} → ${r.toPsychologistName}${r.subjectLabel ? `, ${r.subjectLabel}` : ""}. Təsdiqdən sonra qarşı psixoloq görəcək.`,
      confirmLabel: "Təsdiqlə",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const updated = await operatorApi.approveReferral(r.id);
      setR(updated);
      uiToast("Yönləndirmə təsdiqləndi", "success");
    } catch (e) {
      uiToast("Təsdiq alınmadı: " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!r) return;
    const ok = await confirmDialog({
      title: "Yönləndirməni rədd et",
      message: `${r.fromPsychologistName} → ${r.toPsychologistName}${r.subjectLabel ? `, ${r.subjectLabel}` : ""}. Göndərən psixoloqa bildiriş gedəcək.`,
      confirmLabel: "Rədd et",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const updated = await operatorApi.rejectReferral(r.id);
      setR(updated);
      uiToast("Yönləndirmə rədd edildi", "info");
    } catch (e) {
      uiToast("Rədd alınmadı: " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>Yüklənir…</div>;
  }
  if (error || !r) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)", marginBottom: 8 }}>Yönləndirmə tapılmadı</div>
        <button onClick={backToList} style={{ marginTop: 8, padding: "8px 16px", borderRadius: 9, border: "1px solid #D6E2F7", background: "#fff", color: "var(--oxford)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Siyahıya qayıt
        </button>
      </div>
    );
  }

  const subj = SUBJECT_META[r.subjectType];
  const st = STATUS_META[r.status] ?? STATUS_META.PENDING_OPERATOR;
  const money = r.referredAmount != null
    ? (r.currency && r.currency !== "AZN" ? `${r.referredAmount} ${r.currency}` : formatAzn(r.referredAmount))
    : null;
  const pending = r.status === "PENDING_OPERATOR";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <button onClick={backToList}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "none", color: "var(--oxford-60)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Yönləndirmələr
      </button>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EDF1F8", boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13, fontWeight: 600, color: "var(--oxford-60)" }}>#REF-{String(r.id).padStart(4, "0")}</span>
          <span style={{ background: subj.bg, color: subj.color, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{subj.label}</span>
          <span style={{ background: st.bg, color: st.color, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{st.label}</span>
          <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#9DB0CC", fontWeight: 600 }}>{fmtDate(r.createdAt)}</span>
        </div>

        {/* kim kimə */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "20px 0", marginBottom: 18, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9DB0CC", marginBottom: 4 }}>Göndərən</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{r.fromPsychologistName}</div>
          </div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9DB0CC", marginBottom: 4 }}>Qəbul edən</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{r.toPsychologistName}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#9DB0CC", marginBottom: 4 }}>Pasiyent</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--oxford)" }}>{r.patientName ?? "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#9DB0CC", marginBottom: 4 }}>Subyekt</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--oxford)" }}>{r.subjectLabel ?? "—"}</div>
          </div>
          {money && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#9DB0CC", marginBottom: 4 }}>Ötürülən dəyər</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#047857" }}>{money}</div>
            </div>
          )}
        </div>

        <div style={{ fontSize: 13.5, color: "var(--oxford)", background: "var(--brand-50)", borderRadius: 10, padding: "12px 14px", marginBottom: r.clinicalSummary || r.message ? 12 : 18, lineHeight: 1.55 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--brand-700)", marginBottom: 5 }}>Niyə yönləndirir</div>
          {r.reason}
        </div>

        {r.clinicalSummary && (
          <div style={{ fontSize: 13.5, color: "var(--oxford)", background: "var(--brand-50)", borderRadius: 10, padding: "12px 14px", marginBottom: r.message ? 12 : 18, lineHeight: 1.55 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--brand-700)", marginBottom: 5 }}>Klinik xülasə</div>
            {r.clinicalSummary}
          </div>
        )}

        {r.message && (
          <div style={{ fontSize: 13.5, color: "var(--oxford)", background: "var(--brand-50)", borderRadius: 10, padding: "12px 14px", marginBottom: 18, lineHeight: 1.55 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--brand-700)", marginBottom: 5 }}>Qeyd</div>
            {r.message}
          </div>
        )}

        {r.operatorNote && (
          <div style={{ fontSize: 13, color: "var(--oxford-60)", marginBottom: 18 }}>
            <b style={{ color: "var(--oxford)" }}>Operator qeydi: </b>{r.operatorNote}
          </div>
        )}

        {pending ? (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={reject} disabled={busy}
              style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #FECACA", background: "#fff", color: "#991B1B", fontSize: 13.5, fontWeight: 700, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>
              Rədd et
            </button>
            <button onClick={approve} disabled={busy}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit" }}>
              {busy ? "…" : "Təsdiqlə"}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "#9DB0CC", fontWeight: 600, textAlign: "right" }}>
            {r.respondedAt ? `Cavablandı: ${fmtDate(r.respondedAt)}` : "Bu yönləndirmə artıq emal olunub."}
          </div>
        )}
      </div>
    </div>
  );
}
