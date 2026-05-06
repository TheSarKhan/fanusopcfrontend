"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { operatorApi, type AppointmentDetail } from "@/lib/api";

function count(items: AppointmentDetail[], st: string | string[]) {
  const set = Array.isArray(st) ? new Set(st) : new Set([st]);
  return items.filter(a => set.has(a.status)).length;
}

export default function OperatorDashboard() {
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    operatorApi.listAppointments()
      .then(setItems).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pending = count(items, ["PENDING", "REJECTED"]);
  const assigned = count(items, "ASSIGNED");
  const confirmed = count(items, "CONFIRMED");
  const completed = count(items, "COMPLETED");

  const cards = [
    { label: "Yeni müraciət", value: pending, color: "#92400E", bg: "#FEF3C7" },
    { label: "Təyin edilmiş",  value: assigned, color: "#1E40AF", bg: "#DBEAFE" },
    { label: "Təsdiqlənmiş",   value: confirmed, color: "#065F46", bg: "#D1FAE5" },
    { label: "Tamamlanmış",    value: completed, color: "#374151", bg: "#F3F4F6" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A2535]">Operator Paneli</h1>
        <p className="text-[#52718F] text-sm mt-1">Müraciətlər və psixoloq koordinasiyası</p>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
            {cards.map(c => (
              <div key={c.label} style={{ background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 12, color: "#52718F", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{c.label}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", marginBottom: 8 }}>Diqqət tələb edən müraciətlər</h2>
            <p style={{ fontSize: 13, color: "#52718F", marginBottom: 16 }}>
              {pending === 0 ? "Yeni müraciət yoxdur." : `${pending} müraciət psixoloq təyininizi gözləyir.`}
            </p>
            <Link
              href="/operator/appointments"
              style={{ display: "inline-block", padding: "10px 18px", background: "linear-gradient(135deg,#002147,#5A4FC8)", color: "#fff", borderRadius: 10, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
              Müraciətlərə bax →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
