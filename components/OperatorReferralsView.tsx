"use client";

/**
 * Operator tərəfi — yönləndirmə təsdiq növbəsi (PENDING_OPERATOR).
 * Psixoloq randevu/paketi həmkarına yönləndirir → operator burada təsdiq/rədd edir.
 * Təsdiqdən sonra qarşı psixoloq görür və qəbul edəndə sahiblik ona keçir.
 * Randevular səhifəsinin "Yönləndirmələr" tabında və (kilidli) standalone səhifədə
 * eyni komponent işlədilir. `onPendingCount` valideynə təsdiq gözləyən sayını bildirir.
 */

import { useEffect, useState } from "react";
import { operatorApi, type Referral } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { toast as uiToast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";
import { SkeletonGrid } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

const SUBJECT_META: Record<"APPOINTMENT" | "PACKAGE", { label: string; color: string; bg: string }> = {
  APPOINTMENT: { label: "Randevu", color: "#1E40AF", bg: "#EFF6FF" },
  PACKAGE:     { label: "Paket",   color: "#5B21B6", bg: "#F5F3FF" },
};

export default function OperatorReferralsView({ onPendingCount }: { onPendingCount?: (n: number) => void }) {
  const [items, setItems] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    operatorApi.pendingReferrals()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Valideynə (Randevular chip badge-i üçün) təsdiq gözləyən sayını bildir.
  useEffect(() => { onPendingCount?.(items.length); }, [items.length, onPendingCount]);

  const approve = async (r: Referral) => {
    const ok = await confirmDialog({
      title: "Yönləndirməni təsdiqlə",
      message: `${r.fromPsychologistName} → ${r.toPsychologistName}, ${r.subjectLabel ?? ""}. Təsdiqdən sonra qarşı psixoloq görəcək.`,
      confirmLabel: "Təsdiqlə",
    });
    if (!ok) return;
    setBusyId(r.id);
    try {
      await operatorApi.approveReferral(r.id);
      setItems(prev => prev.filter(x => x.id !== r.id));
      uiToast("Yönləndirmə təsdiqləndi", "success");
    } catch (e) {
      uiToast("Təsdiq alınmadı: " + (e as Error).message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (r: Referral) => {
    const ok = await confirmDialog({
      title: "Yönləndirməni rədd et",
      message: `${r.fromPsychologistName} → ${r.toPsychologistName}, ${r.subjectLabel ?? ""}. Göndərən psixoloqa bildiriş gedəcək.`,
      confirmLabel: "Rədd et",
      danger: true,
    });
    if (!ok) return;
    setBusyId(r.id);
    try {
      await operatorApi.rejectReferral(r.id);
      setItems(prev => prev.filter(x => x.id !== r.id));
      uiToast("Yönləndirmə rədd edildi", "info");
    } catch (e) {
      uiToast("Rədd alınmadı: " + (e as Error).message, "error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <SkeletonGrid count={3} />;
  if (items.length === 0) {
    return (
      <EmptyState title="Təsdiq gözləyən yönləndirmə yoxdur"
        sub="Psixoloq randevu və ya paketi həmkarına yönləndirəndə burada görünəcək." />
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))", gap: 14 }}>
      {items.map(r => {
        const subj = SUBJECT_META[r.subjectType];
        const busy = busyId === r.id;
        const money = r.referredAmount != null
          ? (r.currency && r.currency !== "AZN" ? `${r.referredAmount} ${r.currency}` : formatAzn(r.referredAmount))
          : null;
        return (
          <div key={r.id} style={{
            background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 14,
            padding: 16, display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: subj.color, background: subj.bg }}>{subj.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{r.subjectLabel || "Subyekt"}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--oxford-60)", lineHeight: 1.6 }}>
              <div><b style={{ color: "var(--oxford)" }}>{r.fromPsychologistName}</b> → <b style={{ color: "var(--oxford)" }}>{r.toPsychologistName}</b></div>
              {r.patientName && <div>Klient: <b style={{ color: "var(--oxford)" }}>{r.patientName}</b></div>}
              <div>{fmtDate(r.createdAt)}</div>
            </div>
            {money && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
                background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0",
                fontSize: 12, fontWeight: 700, padding: "4px 11px", borderRadius: 999,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" /><path d="M15 9.5a3 3 0 0 0-3-2 3 3 0 0 0 0 6 3 3 0 0 1 0 6 3 3 0 0 1-3-2M12 6v1.5M12 16.5V18" />
                </svg>
                Ötürülən dəyər: {money}
              </span>
            )}
            <div style={{ fontSize: 12.5, color: "var(--oxford-60)", background: "var(--brand-50)", borderRadius: 10, padding: "9px 12px", lineHeight: 1.5 }}>
              <b style={{ color: "var(--oxford)" }}>Səbəb: </b>{r.reason}
            </div>
            {r.clinicalSummary && (
              <div style={{ fontSize: 12.5, color: "var(--oxford-60)", background: "var(--brand-50)", borderRadius: 10, padding: "9px 12px", lineHeight: 1.5 }}>
                <b style={{ color: "var(--oxford)" }}>Klinik məlumat: </b>{r.clinicalSummary}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "auto" }}>
              <button onClick={() => reject(r)} disabled={busy} style={{
                padding: "8px 14px", borderRadius: 10, border: "1px solid #FECACA", background: "#fff",
                color: "#991B1B", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer",
              }}>Rədd et</button>
              <button onClick={() => approve(r)} disabled={busy} style={{
                padding: "8px 16px", borderRadius: 10, border: "none", background: "var(--brand)",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1,
              }}>{busy ? "..." : "Təsdiqlə"}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
