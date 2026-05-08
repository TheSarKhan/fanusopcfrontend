"use client";

import { useEffect, useMemo, useState } from "react";
import { psychologistApi, type AppointmentDetail } from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: "Yeni",        color: "#92400E", bg: "#FEF3C7" },
  ASSIGNED:  { label: "Sizə təyin",  color: "#1E40AF", bg: "#DBEAFE" },
  CONFIRMED: { label: "Təsdiqləndi", color: "#065F46", bg: "#D1FAE5" },
  COMPLETED: { label: "Tamamlandı",  color: "#374151", bg: "#F3F4F6" },
  CANCELLED: { label: "Ləğv",        color: "#991B1B", bg: "#FEE2E2" },
  REJECTED:  { label: "Rədd",        color: "#92400E", bg: "#FEF3C7" },
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function PsychologistAppointmentsPage() {
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "all" | "history">("upcoming");

  const load = () => {
    setLoading(true);
    psychologistApi.myAppointments()
      .then(setItems).catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    return subscribeNotifications((n) => {
      if (typeof n.type === "string" && n.type.startsWith("APPOINTMENT_")) load();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    return items.filter(a => {
      if (filter === "upcoming") {
        return ["ASSIGNED", "CONFIRMED"].includes(a.status) && (!a.startAt || new Date(a.startAt).getTime() >= now - 60 * 60 * 1000);
      }
      if (filter === "history") {
        return ["COMPLETED", "CANCELLED"].includes(a.status);
      }
      return true;
    });
  }, [items, filter]);

  const action = async (id: number, fn: () => Promise<AppointmentDetail>) => {
    setBusyId(id);
    try {
      const updated = await fn();
      setItems(prev => prev.map(a => a.id === id ? updated : a));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A2535]">Randevularım</h1>
        <p className="text-[#52718F] text-sm mt-1">Operator tərəfindən sizə təyin edilmiş seanslar</p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {([
          { k: "upcoming", label: "Gələcək" },
          { k: "history",  label: "Tarixçə" },
          { k: "all",      label: "Hamısı" },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: filter === t.k ? "2px solid var(--brand)" : "1px solid #E5E7EB",
              background: filter === t.k ? "#fff" : "rgba(255,255,255,0.6)",
              color: filter === t.k ? "var(--brand)" : "#52718F", cursor: "pointer",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>Heç bir randevu yoxdur.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map(a => {
            const s = STATUS_LABELS[a.status] ?? { label: a.status, color: "#374151", bg: "#F3F4F6" };
            return (
              <div key={a.id} style={{ background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 11, color: "#52718F" }}>#FNS-{String(a.id).padStart(4, "0")}</div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, color: s.color, background: s.bg, fontWeight: 600 }}>
                      {s.label}
                    </span>
                    {a.sessionFormat && (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#EEF2F7", color: "#52718F" }}>
                        {a.sessionFormat === "ONLINE" ? "Onlayn" : "Əyani"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, color: "#1A2535", fontSize: 15 }}>
                    {a.patientName ?? "—"}
                    {a.patientPhone && <span style={{ color: "#52718F", fontSize: 12, fontWeight: 400, marginLeft: 8 }}>{a.patientPhone}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "#52718F", marginTop: 2 }}>{fmt(a.startAt)} → {fmt(a.endAt)}</div>
                  {a.note && <div style={{ fontSize: 13, color: "#374151", marginTop: 8, padding: "8px 12px", background: "#F9FAFB", borderRadius: 8 }}>«{a.note}»</div>}
                  {a.operatorNote && <div style={{ fontSize: 12, color: "#52718F", marginTop: 6 }}><strong>Operator:</strong> {a.operatorNote}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {a.status === "ASSIGNED" && (
                    <>
                      <button disabled={busyId === a.id} onClick={() => action(a.id, () => psychologistApi.confirm(a.id))}
                        style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#10B981", border: "none", borderRadius: 8, cursor: "pointer" }}>
                        Təsdiqlə
                      </button>
                      <button disabled={busyId === a.id} onClick={() => {
                        const note = prompt("Rədd səbəbi (məcburi deyil):") ?? undefined;
                        action(a.id, () => psychologistApi.reject(a.id, note));
                      }}
                        style={{ padding: "6px 14px", fontSize: 12, color: "#991B1B", background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 8, cursor: "pointer" }}>
                        Rədd et
                      </button>
                    </>
                  )}
                  {a.status === "CONFIRMED" && (
                    <button disabled={busyId === a.id} onClick={() => action(a.id, () => psychologistApi.complete(a.id))}
                      style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>
                      Tamamlandı
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
