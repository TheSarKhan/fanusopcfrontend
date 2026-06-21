"use client";

/**
 * Operator: psixoloqlar arası yönləndirmə təsdiqi. Psixoloq randevu/paketi
 * həmkarına yönləndirir → operator burada təsdiq/rədd edir. Təsdiqdən sonra
 * qarşı psixoloq yönləndirməni görür və qəbul edəndə sahiblik ona keçir.
 */

import { useEffect, useState } from "react";
import { operatorApi, type Referral } from "@/lib/api";
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

export default function OperatorReferralsPage() {
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

  const approve = async (r: Referral) => {
    const ok = await confirmDialog({
      title: "Yönləndirməni təsdiqlə",
      message: `${r.fromPsychologistName} → ${r.toPsychologistName} · ${r.subjectLabel ?? ""}. Təsdiqdən sonra qarşı psixoloq görəcək.`,
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
      message: `${r.fromPsychologistName} → ${r.toPsychologistName} · ${r.subjectLabel ?? ""}. Göndərən psixoloqa bildiriş gedəcək.`,
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--oxford)", margin: 0 }}>Yönləndirmələr</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4, marginBottom: 0 }}>
          Psixoloqlar arası randevu/paket yönləndirmələri — təsdiq gözləyənlər.
        </p>
      </div>

      {loading ? (
        <SkeletonGrid count={3} />
      ) : items.length === 0 ? (
        <EmptyState title="Təsdiq gözləyən yönləndirmə yoxdur"
          sub="Psixoloq randevu və ya paketi həmkarına yönləndirəndə burada görünəcək." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {items.map(r => {
            const subj = SUBJECT_META[r.subjectType];
            const busy = busyId === r.id;
            return (
              <div key={r.id} style={{
                background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 14,
                padding: 16, display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: subj.color, background: subj.bg }}>{subj.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{r.subjectLabel || "Subyekt"}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--oxford-60)", lineHeight: 1.6 }}>
                  <div><b style={{ color: "var(--oxford)" }}>{r.fromPsychologistName}</b> → <b style={{ color: "var(--oxford)" }}>{r.toPsychologistName}</b></div>
                  {r.patientName && <div>Klient: <b style={{ color: "var(--oxford)" }}>{r.patientName}</b></div>}
                  <div>{fmtDate(r.createdAt)}</div>
                </div>
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
      )}
    </div>
  );
}
