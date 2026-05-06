"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { patientApi, type AppointmentDetail } from "@/lib/api";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: "Gözlənilir",  color: "#92400E", bg: "#FEF3C7" },
  ASSIGNED:  { label: "Təyin edilib",color: "#1E40AF", bg: "#DBEAFE" },
  CONFIRMED: { label: "Təsdiqləndi", color: "#065F46", bg: "#D1FAE5" },
  COMPLETED: { label: "Tamamlandı",  color: "#374151", bg: "#F3F4F6" },
  CANCELLED: { label: "Ləğv edildi", color: "#991B1B", bg: "#FEE2E2" },
  REJECTED:  { label: "Yenidən təyin edilir", color: "#92400E", bg: "#FEF3C7" },
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatLabel(f?: string | null) {
  if (f === "ONLINE") return "💻 Online";
  if (f === "IN_PERSON") return "🏢 Üzbəüz";
  return null;
}

export default function PatientAppointmentsPage() {
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    patientApi.myAppointments()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const cancel = async (id: number) => {
    if (!confirm("Randevunu ləğv etmək istədiyinizə əminsiniz?")) return;
    setBusyId(id);
    try {
      const updated = await patientApi.cancel(id);
      setItems(prev => prev.map(a => (a.id === id ? updated : a)));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]">Randevularım</h1>
          <p className="text-[#52718F] text-sm mt-1">Bütün randevu tarixçəniz və status izləməsi</p>
        </div>
        <Link
          href="/psychologists"
          className="py-2.5 px-5 rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
        >
          + Yeni randevu
        </Link>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", color: "#52718F" }}>
          Yüklənir…
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "4rem 2rem", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div className="text-5xl mb-4">📅</div>
          <h3 className="font-bold text-[#1A2535] mb-2">Hələ randevunuz yoxdur</h3>
          <p className="text-[#52718F] text-sm mb-6">Psixoloqlarımızdan biri ilə randevu alaraq başlayın</p>
          <Link
            href="/psychologists"
            className="inline-block py-2.5 px-6 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
          >
            Psixoloq seç
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(a => {
            const s = STATUS_LABELS[a.status] ?? { label: a.status, color: "#374151", bg: "#F3F4F6" };
            const fmt = formatLabel(a.sessionFormat);
            const psyName = a.psychologistName ?? a.requestedPsychologistName ?? "Operator təyin edəcək";
            const when = a.startAt ?? a.requestedStartAt;
            const cancellable = a.status !== "COMPLETED" && a.status !== "CANCELLED";
            return (
              <div
                key={a.id}
                style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-xs text-[#52718F]">#FNS-{String(a.id).padStart(4, "0")}</div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
                        {s.label}
                      </span>
                      {fmt && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#EEF2F7", color: "#52718F" }}>
                          {fmt}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-[#1A2535] text-base">{psyName}</div>
                    <div className="text-[#52718F] text-sm mt-0.5">{fmtDateTime(when)}</div>
                    {a.note && (
                      <div className="text-[#52718F] text-sm mt-2 italic">«{a.note}»</div>
                    )}
                    {a.operatorNote && (
                      <div className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#F3F4F6", color: "#374151" }}>
                        <strong>Operator:</strong> {a.operatorNote}
                      </div>
                    )}
                  </div>
                  {cancellable && (
                    <button
                      onClick={() => cancel(a.id)}
                      disabled={busyId === a.id}
                      style={{ padding: "6px 12px", fontSize: 12, border: "1px solid #FECACA", color: "#991B1B", background: "#FFF5F5", borderRadius: 8, cursor: busyId === a.id ? "wait" : "pointer", fontWeight: 500 }}
                    >
                      {busyId === a.id ? "Ləğv edilir…" : "Ləğv et"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
