"use client";

import { useEffect, useState } from "react";
import { adminApi, type Appointment } from "@/lib/api";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: "#FFF3EC", color: "#D97706" },
  CONFIRMED: { bg: "#dcfce7", color: "#16a34a" },
  CANCELLED: { bg: "#fee2e2", color: "#dc2626" },
  COMPLETED: { bg: "#EEF5FF", color: "#002147" },
};

export default function AppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminApi.getAppointments().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const updateStatus = async (id: number, status: string) => {
    await adminApi.updateAppointmentStatus(id, status).catch(e => alert(e.message));
    load();
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1A2535]" style={{ fontFamily: "var(--font-playfair, serif)" }}>Randevular</h1>
        <p className="text-[#52718F] text-sm mt-1">{items.length} müraciət</p>
      </div>

      {loading ? <div className="text-center text-[#52718F] py-12">Yüklənir...</div> : (
        <div className="flex flex-col gap-3">
          {items.map(a => {
            const sc = STATUS_COLORS[a.status] ?? STATUS_COLORS.PENDING;
            return (
              <div key={a.id} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E4EDF6" }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-[#1A2535]">{a.patientName}</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: sc.bg, color: sc.color }}>
                        {a.status}
                      </span>
                    </div>
                    <p className="text-sm text-[#52718F]">{a.phone}</p>
                    {a.psychologistName && <p className="text-xs text-[#52718F]">Psixoloq: {a.psychologistName}</p>}
                    {a.note && <p className="text-xs text-[#52718F] mt-1 max-w-md">{a.note}</p>}
                    <p className="text-xs text-[#A8C0D6] mt-1">
                      {new Date(a.createdAt).toLocaleString("az-AZ")}
                      {a.preferredDate && ` · İstədiyi tarix: ${a.preferredDate}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["CONFIRMED", "COMPLETED", "CANCELLED"].map(s => (
                      <button key={s} onClick={() => updateStatus(a.id, s)}
                        disabled={a.status === s}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: STATUS_COLORS[s]?.bg,
                          color: STATUS_COLORS[s]?.color,
                          opacity: a.status === s ? 0.5 : 1,
                        }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          {!items.length && <div className="text-center text-[#52718F] py-12">Heç bir randevu yoxdur</div>}
        </div>
      )}
    </div>
  );
}
