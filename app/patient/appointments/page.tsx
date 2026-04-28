"use client";

import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: "Gözlənilir",  color: "#92400E", bg: "#FEF3C7" },
  NEW:       { label: "Yeni",        color: "#1E40AF", bg: "#DBEAFE" },
  IN_REVIEW: { label: "Baxılır",     color: "#5B21B6", bg: "#EDE9FE" },
  ASSIGNED:  { label: "Təyin edilib",color: "#065F46", bg: "#D1FAE5" },
  CONFIRMED: { label: "Təsdiqləndi", color: "#065F46", bg: "#D1FAE5" },
  COMPLETED: { label: "Tamamlandı",  color: "#374151", bg: "#F3F4F6" },
  CANCELLED: { label: "Ləğv edildi", color: "#991B1B", bg: "#FEE2E2" },
  NO_SHOW:   { label: "Gəlmədi",     color: "#92400E", bg: "#FEF3C7" },
};

export default function PatientAppointmentsPage() {
  // Phase 2-də real API call əlavə olunacaq
  const appointments: {
    id: number; psychologistName?: string; preferredDate?: string;
    status: string; note?: string; createdAt: string;
  }[] = [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]">Randevularım</h1>
          <p className="text-[#52718F] text-sm mt-1">Bütün randevu tarixçəniz</p>
        </div>
        <Link
          href="/psychologists"
          className="py-2.5 px-5 rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
        >
          + Yeni randevu
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: "1rem", padding: "4rem 2rem",
          textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          <div className="text-5xl mb-4">📅</div>
          <h3 className="font-bold text-[#1A2535] mb-2">Hələ randevunuz yoxdur</h3>
          <p className="text-[#52718F] text-sm mb-6">
            Psixoloqlarımızdan biri ilə randevu alaraq başlayın
          </p>
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
          {appointments.map(apt => {
            const s = STATUS_LABELS[apt.status] ?? { label: apt.status, color: "#374151", bg: "#F3F4F6" };
            return (
              <div
                key={apt.id}
                style={{
                  background: "#fff", borderRadius: "1rem", padding: "1.5rem",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                }}
                className="flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-[#1A2535]">
                    {apt.psychologistName ?? "Psixoloq seçilməyib"}
                  </div>
                  <div className="text-[#52718F] text-sm mt-0.5">
                    {apt.preferredDate ?? "Tarix seçilməyib"}
                  </div>
                </div>
                <span
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ color: s.color, background: s.bg }}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
