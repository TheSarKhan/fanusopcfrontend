"use client";

import { useEffect, useState } from "react";
import { patientApi, type PatientReferral, type ReferralStatus } from "@/lib/api";

const STATUS_META: Record<ReferralStatus, { label: string; color: string; bg: string }> = {
  PENDING_CONSENT: { label: "Razılığınız gözlənilir", color: "#92400E", bg: "#FEF3C7" },
  PENDING_REVIEW:  { label: "Psixoloq baxır",         color: "#1E40AF", bg: "#DBEAFE" },
  ACCEPTED:        { label: "Qəbul olundu",           color: "#065F46", bg: "#D1FAE5" },
  DECLINED:        { label: "Rədd olundu",            color: "#991B1B", bg: "#FEE2E2" },
  CANCELLED:       { label: "Ləğv olundu",            color: "#475569", bg: "#F1F5F9" },
};

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

function initials(name?: string | null) {
  if (!name) return "P";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "P";
}

export default function PatientReferralsPage() {
  const [items, setItems] = useState<PatientReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    patientApi.myReferrals().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const act = async (r: PatientReferral, action: "consent" | "decline") => {
    setBusyId(r.id);
    try {
      const updated = action === "consent"
        ? await patientApi.consentReferral(r.id)
        : await patientApi.declineReferral(r.id);
      setItems(prev => prev.map(x => x.id === r.id ? updated : x));
    } catch (e) {
      alert("Əməliyyat alınmadı: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--oxford)", margin: 0 }}>Yönləndirmələr</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4, marginBottom: 0 }}>
          Psixoloqunuz sizi başqa mütəxəssisə yönləndirmək istəyəndə razılığınız burada soruşulur.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 14, height: 130 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "56px 24px",
          background: "#fff", borderRadius: 16, border: "1px dashed var(--oxford-10)",
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", margin: "0 0 4px" }}>Yönləndirmə yoxdur</p>
          <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: 0 }}>
            Hələ heç bir yönləndirmə təklifiniz yoxdur.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map(r => {
            const sm = STATUS_META[r.status];
            const pending = r.status === "PENDING_CONSENT";
            return (
              <div key={r.id} style={{
                background: "#fff", borderRadius: 14, border: "1px solid var(--oxford-10)",
                padding: 16, display: "flex", flexDirection: "column", gap: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 15, fontWeight: 800,
                  }}>
                    {r.toPsychologistPhotoUrl
                      ? <img src={r.toPsychologistPhotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : initials(r.toPsychologistName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{r.toPsychologistName}</div>
                    {r.toPsychologistTitle && (
                      <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>{r.toPsychologistTitle}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
                    background: sm.bg, color: sm.color, whiteSpace: "nowrap",
                  }}>{sm.label}</span>
                </div>

                <div style={{ fontSize: 13, color: "var(--oxford)", lineHeight: 1.55 }}>
                  <b>{r.fromPsychologistName}</b> sizi <b>{r.toPsychologistName}</b> adlı psixoloqa yönləndirmək istəyir.
                </div>
                <div style={{
                  fontSize: 12.5, color: "var(--oxford-60)", background: "var(--brand-50)",
                  borderRadius: 10, padding: "10px 12px", lineHeight: 1.5,
                }}>
                  <span style={{ fontWeight: 700, color: "var(--oxford)" }}>Səbəb: </span>{r.reason}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 11.5, color: "var(--oxford-60)" }}>{fmtDate(r.createdAt)}</span>
                  {pending && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => act(r, "decline")} disabled={busyId === r.id}
                        style={{
                          padding: "8px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 700,
                          background: "#fff", color: "#991B1B", border: "1px solid #FECACA",
                          cursor: busyId === r.id ? "wait" : "pointer",
                        }}>İmtina et</button>
                      <button onClick={() => act(r, "consent")} disabled={busyId === r.id}
                        style={{
                          padding: "8px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 700,
                          background: "var(--brand)", color: "#fff", border: "none",
                          cursor: busyId === r.id ? "wait" : "pointer",
                          boxShadow: "0 4px 14px rgba(16,81,183,0.25)",
                        }}>{busyId === r.id ? "..." : "Razıyam"}</button>
                    </div>
                  )}
                </div>

                {pending && (
                  <p style={{ fontSize: 11, color: "var(--oxford-60)", margin: 0, lineHeight: 1.5 }}>
                    Razılıq versəniz, psixoloqunuzun paylaşdığı qısa məlumat yeni mütəxəssisə ötürüləcək.
                    Razılıq vermədən heç bir məlumat paylaşılmır.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
