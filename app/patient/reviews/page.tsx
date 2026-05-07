"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { patientApi, type MyReview } from "@/lib/api";
import ReviewModal from "../appointments/ReviewModal";

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:  { label: "Moderasiyada", color: "#92400E", bg: "#FEF3C7" },
  APPROVED: { label: "Dərc olundu",  color: "#065F46", bg: "#D1FAE5" },
  REJECTED: { label: "Qəbul olunmadı", color: "#991B1B", bg: "#FEE2E2" },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function Stars({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }} aria-label={`${value} ulduz`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width="14" height="14" viewBox="0 0 24 24"
             fill={n <= value ? "#C97D2E" : "#E4ECFA"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export default function PatientReviewsPage() {
  const [items, setItems] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MyReview | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    patientApi.myReviews()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (id: number) => {
    if (!confirm("Bu rəyi silmək istədiyinizə əminsiniz?")) return;
    setBusyId(id);
    try {
      await patientApi.deleteReview(id);
      setItems(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1A2535]">Rəylərim</h1>
        <p className="text-[#52718F] text-sm mt-1">
          Psixoloqlar haqqında yazdığınız rəylər və onların moderasiya statusu
        </p>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", color: "#52718F" }}>
          Yüklənir…
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "4rem 2rem", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div className="text-5xl mb-4">✍️</div>
          <h3 className="font-bold text-[#1A2535] mb-2">Hələ rəy yazmamısınız</h3>
          <p className="text-[#52718F] text-sm mb-6">
            Tamamlanmış seanslarınızdan sonra psixoloqlar haqqında rəy yaza bilərsiniz.
          </p>
          <Link
            href="/patient/appointments"
            className="inline-block py-2.5 px-6 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
          >
            Randevularıma bax
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((r) => {
            const badge = STATUS_BADGE[r.status] ?? { label: r.status, color: "#374151", bg: "#F3F4F6" };
            return (
              <div
                key={r.id}
                style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: badge.color, background: badge.bg }}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-[#52718F]">{fmtDate(r.createdAt)}</span>
                    </div>
                    <Link
                      href={`/psychologists/${r.psychologistId}`}
                      className="font-semibold text-[#1A2535] text-base hover:underline"
                    >
                      {r.psychologistName}
                    </Link>
                    <div style={{ marginTop: 6 }}>
                      <Stars value={r.rating} />
                    </div>
                    <p className="text-sm text-[#374151] mt-3 whitespace-pre-wrap leading-relaxed">
                      {r.comment}
                    </p>
                    {r.reply && (
                      <div style={{ marginTop: 12, padding: "10px 14px", background: "#F4F1FE", borderLeft: "3px solid #5A4FC8", borderRadius: "0 10px 10px 0" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#5A4FC8", marginBottom: 4 }}>
                          Psixoloqun cavabı
                        </div>
                        <p style={{ fontSize: 13, color: "#374151", margin: 0, whiteSpace: "pre-wrap" }}>{r.reply}</p>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button
                      onClick={() => setEditing(r)}
                      style={{ padding: "6px 12px", fontSize: 12, border: "1px solid #C7D2FE", color: "#3730A3", background: "#EEF2FF", borderRadius: 8, cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" }}
                    >
                      Redaktə et
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      disabled={busyId === r.id}
                      style={{ padding: "6px 12px", fontSize: 12, border: "1px solid #FECACA", color: "#991B1B", background: "#FFF5F5", borderRadius: 8, cursor: busyId === r.id ? "wait" : "pointer", fontWeight: 500, whiteSpace: "nowrap" }}
                    >
                      {busyId === r.id ? "Silinir…" : "Sil"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ReviewModal
          psychologistId={editing.psychologistId}
          psychologistName={editing.psychologistName}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmitted={(saved) => {
            setItems(prev => prev.map(r => r.id === saved.id ? saved : r));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
