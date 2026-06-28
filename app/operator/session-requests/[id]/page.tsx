"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { operatorApi, type Psychologist, type SessionRequest } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  NEW:       { label: "Yeni",        bg: "#FEF3C7", color: "#92400E" },
  IN_REVIEW: { label: "Baxılır",     bg: "#DBEAFE", color: "#1E40AF" },
  SCHEDULED: { label: "Planlandı",   bg: "#D1FAE5", color: "#065F46" },
  CANCELLED: { label: "Ləğv edildi", bg: "#FEE2E2", color: "#991B1B" },
};

const SESSION_PACKAGES = [
  "Tək seans",
  "2 seans paketi",
  "4 seans paketi",
  "8 seans paketi",
  "12 seans paketi",
];

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
      <span style={{ minWidth: 160, color: "#6B7280", fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function SessionRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [req, setReq] = useState<SessionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);

  // Schedule form state
  const [schedPsyId, setSchedPsyId] = useState<number | "">("");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [schedPackage, setSchedPackage] = useState("");
  const [schedNote, setSchedNote] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [schedError, setSchedError] = useState("");

  // Status update
  const [statusLoading, setStatusLoading] = useState(false);

  const load = useCallback(() => {
    operatorApi.getSessionRequest(Number(id)).then(data => {
      setReq(data);
      setLoading(false);
      // Pre-fill schedule form if already scheduled
      if (data.assignedPsychologistId) setSchedPsyId(data.assignedPsychologistId);
      if (data.scheduledDate) setSchedDate(data.scheduledDate);
      if (data.scheduledTime) setSchedTime(data.scheduledTime);
      if (data.sessionPackage) setSchedPackage(data.sessionPackage);
      if (data.operatorNote) setSchedNote(data.operatorNote);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    operatorApi.listPsychologists().then(setPsychologists).catch(() => {});
  }, []);

  // Auto-mark as IN_REVIEW when first opened (if still NEW)
  useEffect(() => {
    if (req?.status === "NEW") {
      operatorApi.updateSessionRequestStatus(Number(id), { status: "IN_REVIEW" })
        .then(updated => setReq(updated))
        .catch(() => {});
    }
  }, [req?.status, id]);

  const handleSchedule = async () => {
    if (!schedPsyId) { setSchedError("Psixoloq seçin"); return; }
    if (!schedDate)  { setSchedError("Tarix seçin"); return; }
    setSchedError("");
    setScheduling(true);
    try {
      const updated = await operatorApi.scheduleSessionRequest(Number(id), {
        psychologistId: Number(schedPsyId),
        scheduledDate: schedDate,
        scheduledTime: schedTime || null,
        sessionPackage: schedPackage || null,
        operatorNote: schedNote || null,
      });
      setReq(updated);
    } catch (e: any) {
      setSchedError(e?.message ?? "Xəta baş verdi");
    } finally {
      setScheduling(false);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    setStatusLoading(true);
    try {
      const updated = await operatorApi.updateSessionRequestStatus(Number(id), { status });
      setReq(updated);
    } catch {
      // ignore
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 32, color: "#6B7280" }}>Yüklənir...</div>;
  }
  if (!req) {
    return <div style={{ padding: 32, color: "#991B1B" }}>Müraciət tapılmadı.</div>;
  }

  const badge = STATUS_BADGE[req.status] ?? { label: req.status, bg: "#F3F4F6", color: "#374151" };
  const isScheduled = req.status === "SCHEDULED";
  const isCancelled = req.status === "CANCELLED";

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.push("/operator/session-requests")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#52718F", fontSize: 13, padding: 0 }}
        >
          ← Geri
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0B1A35" }}>
          Seans müraciəti #{req.id}
        </h1>
        <span style={{
          background: badge.bg, color: badge.color,
          borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600,
        }}>
          {badge.label}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
        {/* Left — request info */}
        <div>
          <div style={{
            background: "#fff", border: "1px solid #E5E7EB",
            borderRadius: 12, padding: "20px 24px", marginBottom: 20,
          }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#0B1A35", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Müraciət məlumatları
            </h2>
            <InfoRow label="Ad Soyad"     value={req.name} />
            <InfoRow label="Telefon"      value={req.phone} />
            <InfoRow label="E-poçt"       value={req.email} />
            <InfoRow label="Yaş"          value={req.age} />
            <InfoRow label="Göndərildi"   value={new Date(req.createdAt).toLocaleString("az-AZ")} />
          </div>

          <div style={{
            background: "#fff", border: "1px solid #E5E7EB",
            borderRadius: 12, padding: "20px 24px", marginBottom: 20,
          }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#0B1A35", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Müraciətin səbəbi
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: "#111827", lineHeight: 1.6 }}>{req.reason}</p>
          </div>

          {(req.preferredDate || req.preferredTime || req.notes) && (
            <div style={{
              background: "#fff", border: "1px solid #E5E7EB",
              borderRadius: 12, padding: "20px 24px",
            }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#0B1A35", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Əlavə məlumat
              </h2>
              <InfoRow label="Üstünlük verilən tarix" value={req.preferredDate} />
              <InfoRow label="Üstünlük verilən saat"  value={req.preferredTime} />
              {req.notes && (
                <div style={{ marginTop: 12, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                  <span style={{ color: "#6B7280" }}>Əlavə qeydlər: </span>{req.notes}
                </div>
              )}
            </div>
          )}

          {/* Result info if scheduled */}
          {isScheduled && (
            <div style={{
              background: "#D1FAE5", border: "1px solid #6EE7B7",
              borderRadius: 12, padding: "20px 24px", marginTop: 20,
            }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#065F46", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Planlanmış seans
              </h2>
              <InfoRow label="Psixoloq"    value={req.assignedPsychologistName} />
              <InfoRow label="Tarix"       value={req.scheduledDate} />
              <InfoRow label="Saat"        value={req.scheduledTime} />
              <InfoRow label="Paket"       value={req.sessionPackage} />
              {req.operatorNote && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#065F46" }}>
                  <span style={{ opacity: 0.7 }}>Operator qeydi: </span>{req.operatorNote}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right — actions */}
        <div>
          {/* Schedule form */}
          {!isCancelled && (
            <div style={{
              background: "#fff", border: "1px solid #E5E7EB",
              borderRadius: 12, padding: "20px 24px", marginBottom: 16,
            }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#0B1A35", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {isScheduled ? "Yenidən planla" : "Seans planla"}
              </h2>

              {schedError && (
                <div style={{
                  background: "#FEE2E2", color: "#991B1B",
                  borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12,
                }}>
                  {schedError}
                </div>
              )}

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                Psixoloq *
              </label>
              <select
                value={schedPsyId}
                onChange={e => setSchedPsyId(e.target.value === "" ? "" : Number(e.target.value))}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
              >
                <option value="">Psixoloq seçin...</option>
                {psychologists.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                Seans tarixi *
              </label>
              <DatePicker
                value={schedDate}
                onChange={setSchedDate}
                placeholder="gg.aa.iiii"
                theme="light"
              />

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4, marginTop: 12 }}>
                Saat
              </label>
              <div style={{ marginBottom: 12 }}>
                <TimePicker
                  value={schedTime}
                  onChange={setSchedTime}
                  theme="light"
                  size="sm"
                />
              </div>

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                Seans paketi
              </label>
              <select
                value={schedPackage}
                onChange={e => setSchedPackage(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
              >
                <option value="">Seçin...</option>
                {SESSION_PACKAGES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                Operator qeydi
              </label>
              <textarea
                value={schedNote}
                onChange={e => setSchedNote(e.target.value)}
                rows={3}
                placeholder="Daxili qeyd (istifadəçiyə göstərilmir)"
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box", marginBottom: 14 }}
              />

              <button
                onClick={handleSchedule}
                disabled={scheduling}
                style={{
                  width: "100%", padding: "10px 0",
                  background: "#5A4FC8", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: scheduling ? "not-allowed" : "pointer",
                  opacity: scheduling ? 0.7 : 1,
                }}
              >
                {scheduling ? "Göndərilir..." : isScheduled ? "Yenilə və bildiriş göndər" : "Planla və bildiriş göndər"}
              </button>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
                {req.email ? "Müştəriyə e-poçt göndəriləcək" : "E-poçt yoxdur — bildiriş göndərilməyəcək"}
              </p>
            </div>
          )}

          {/* Status actions */}
          {!isCancelled && (
            <div style={{
              background: "#fff", border: "1px solid #E5E7EB",
              borderRadius: 12, padding: "20px 24px",
            }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#0B1A35", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Status
              </h2>
              <button
                onClick={() => handleStatusUpdate("CANCELLED")}
                disabled={statusLoading}
                style={{
                  width: "100%", padding: "9px 0",
                  background: "#FEE2E2", color: "#991B1B",
                  border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: statusLoading ? "not-allowed" : "pointer",
                  opacity: statusLoading ? 0.7 : 1,
                }}
              >
                Müraciəti ləğv et
              </button>
            </div>
          )}

          {isCancelled && (
            <div style={{
              background: "#FEE2E2", border: "1px solid #FECACA",
              borderRadius: 12, padding: "16px 20px",
            }}>
              <p style={{ margin: 0, fontSize: 13, color: "#991B1B", fontWeight: 500 }}>
                Bu müraciət ləğv edilib.
              </p>
              <button
                onClick={() => handleStatusUpdate("NEW")}
                disabled={statusLoading}
                style={{
                  marginTop: 10, padding: "7px 14px",
                  background: "#fff", color: "#374151",
                  border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, fontWeight: 500,
                  cursor: statusLoading ? "not-allowed" : "pointer",
                }}
              >
                Bərpa et
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
