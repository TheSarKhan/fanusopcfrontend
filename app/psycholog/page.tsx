"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { psychologistApi, type AppointmentDetail } from "@/lib/api";

function count(items: AppointmentDetail[], st: string | string[]) {
  const set = Array.isArray(st) ? new Set(st) : new Set([st]);
  return items.filter(a => set.has(a.status)).length;
}

export default function PsychologDashboard() {
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    psychologistApi.myAppointments()
      .then(setItems).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const assigned = count(items, "ASSIGNED");
  const confirmed = count(items, "CONFIRMED");
  const completed = count(items, "COMPLETED");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A2535]">Psixoloq Paneli</h1>
        <p className="text-[#52718F] text-sm mt-1">Sizə təyin edilmiş randevular və açıq vaxtlarınız</p>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
            <Stat label="Təsdiqinizi gözləyir" value={assigned} color="#1E40AF" />
            <Stat label="Təsdiqlənmiş" value={confirmed} color="#065F46" />
            <Stat label="Tamamlanmış" value={completed} color="#374151" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Link href="/psycholog/appointments"
              style={{ background: "linear-gradient(135deg, #1a1040, #2d1b69)", borderRadius: 14, padding: 20, color: "#fff", textDecoration: "none" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Randevulara bax</div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>Yeni təyinatları təsdiqləyin və ya rədd edin</p>
            </Link>
            <Link href="/psycholog/availability"
              style={{ background: "#fff", borderRadius: 14, padding: 20, color: "#1A2535", textDecoration: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🕓</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Açıq vaxtlar</div>
              <p style={{ fontSize: 13, color: "#52718F", marginTop: 4 }}>Həftəlik cədvəlinizi və istisnaları idarə edin</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 12, color: "#52718F", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}
