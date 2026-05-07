"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { patientApi, type AppointmentDetail } from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";

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
  const [reschedFor, setReschedFor] = useState<AppointmentDetail | null>(null);

  const load = () => {
    setLoading(true);
    patientApi.myAppointments()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Live refresh: any appointment notification re-fetches the list
  useEffect(() => {
    return subscribeNotifications((n) => {
      if (typeof n.type === "string" && n.type.startsWith("APPOINTMENT_")) load();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const onRescheduled = (created: AppointmentDetail) => {
    // bookForPatient returns the NEW appointment — refresh full list to get both
    setReschedFor(null);
    load();
    void created;
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
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button
                        onClick={() => setReschedFor(a)}
                        style={{ padding: "6px 12px", fontSize: 12, border: "1px solid #C7D2FE", color: "#3730A3", background: "#EEF2FF", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}
                      >
                        Yenidən planla
                      </button>
                      <button
                        onClick={() => cancel(a.id)}
                        disabled={busyId === a.id}
                        style={{ padding: "6px 12px", fontSize: 12, border: "1px solid #FECACA", color: "#991B1B", background: "#FFF5F5", borderRadius: 8, cursor: busyId === a.id ? "wait" : "pointer", fontWeight: 500 }}
                      >
                        {busyId === a.id ? "Ləğv edilir…" : "Ləğv et"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reschedFor && (
        <RescheduleModal
          appointment={reschedFor}
          onClose={() => setReschedFor(null)}
          onDone={onRescheduled}
        />
      )}
    </div>
  );
}

function RescheduleModal({
  appointment, onClose, onDone,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onDone: (a: AppointmentDetail) => void;
}) {
  const [datetime, setDatetime] = useState("");
  const [format, setFormat] = useState<"ONLINE" | "IN_PERSON">(
    (appointment.sessionFormat as "ONLINE" | "IN_PERSON") ?? "ONLINE"
  );
  const [note, setNote] = useState(appointment.note ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!datetime) { setErr("Yeni vaxt seçin"); return; }
    const trimmed = note.trim();
    if (trimmed.length < 5) { setErr("Qısa təsvir yazın (ən azı 5 simvol)"); return; }
    setSaving(true);
    try {
      const created = await patientApi.reschedule(appointment.id, {
        note: trimmed,
        requestedPsychologistId: appointment.psychologistId ?? appointment.requestedPsychologistId ?? null,
        requestedStartAt: new Date(datetime).toISOString(),
        sessionFormat: format,
      });
      onDone(created);
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(560px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #EFF2F7" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1A2535", margin: 0 }}>Randevunu yenidən planla</h2>
          <p style={{ fontSize: 12, color: "#52718F", marginTop: 4 }}>
            Mövcud randevu ləğv ediləcək və yeni müraciət qeydə alınacaq. Operator yeni vaxtı təsdiqləyəcək.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Yeni vaxt</label>
          <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 14 }} />

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Format</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(["ONLINE", "IN_PERSON"] as const).map(f => (
              <button type="button" key={f} onClick={() => setFormat(f)}
                style={{
                  flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 600,
                  border: format === f ? "2px solid #5A4FC8" : "1px solid #E5E7EB",
                  background: format === f ? "#EEECFB" : "#fff", cursor: "pointer", color: "#1A2535",
                }}>
                {f === "ONLINE" ? "💻 Online" : "🏢 Üzbəüz"}
              </button>
            ))}
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>Qısa təsvir</label>
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Vaxt dəyişdirmə səbəbi və ya yeni qeydlər"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12 }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Bağla
            </button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg,#002147,#5A4FC8)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Göndərilir…" : "Yenidən planla"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
