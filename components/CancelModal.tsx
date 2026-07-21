"use client";

import { useMemo, useState } from "react";
import {
  patientApi,
  psychologistApi,
  reasonsForRole,
  type AppointmentDetail,
  type CancellationRole,
} from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";

const LATE_WINDOW_HOURS = 24;

function hoursUntil(iso?: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  return ms / (1000 * 60 * 60);
}

interface Props {
  appointment: AppointmentDetail;
  /** OP-1: operator ləğvi artıq detal səhifəsinin blokundadır — modal yalnız pasiyent/psixoloq üçündür. */
  role: Exclude<CancellationRole, "OPERATOR">;
  /** Reject vs cancel: psychologists rejecting an ASSIGNED appointment use a different endpoint. */
  mode?: "cancel" | "reject";
  onClose: () => void;
  onDone: (updated: AppointmentDetail) => void;
}

export default function CancelModal({ appointment, role, mode = "cancel", onClose, onDone }: Props) {
  const reasons = useMemo(() => reasonsForRole(role), [role]);
  const [reasonCode, setReasonCode] = useState<string>(reasons[0]?.code ?? "");
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const hours = hoursUntil(appointment.startAt);
  const isLate = hours !== null && hours >= 0 && hours < LATE_WINDOW_HOURS;
  const isPast = hours !== null && hours < 0;

  const isPatientRequest = role === "PATIENT" && mode === "cancel";
  const headerLabel = mode === "reject"
    ? "Müraciəti rədd et"
    : isPatientRequest
      ? "Ləğv tələbi göndər"
      : "Randevunu ləğv et";

  const submit = async () => {
    setErr(null);
    if (!reasonCode) { setErr("Səbəb seçin"); return; }
    setSaving(true);
    try {
      let updated: AppointmentDetail;
      if (role === "PATIENT") {
        updated = await patientApi.cancel(appointment.id, reasonCode, reasonText || undefined);
      } else if (mode === "reject") {
        updated = await psychologistApi.reject(appointment.id, reasonCode, reasonText || undefined);
      } else {
        updated = await psychologistApi.cancel(appointment.id, reasonCode, reasonText || undefined);
      }
      onDone(updated);
    } catch (e) {
      setErr((e as Error).message || "Əməliyyat uğursuz oldu");
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} className="cm-overlay">
      <div onClick={e => e.stopPropagation()} className="cm-sheet">
        <div className="cm-head">
          <h2 className="cm-title">{headerLabel}</h2>
          {appointment.psychologistName || appointment.patientName ? (
            <p className="cm-sub" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <span>{role === "PATIENT" ? appointment.psychologistName : appointment.patientName}</span>
              {appointment.startAt && (
                <span>{azFormatDateTime(appointment.startAt)}</span>
              )}
            </p>
          ) : null}
        </div>

        <div className="cm-body">
          {isPatientRequest && !isPast && (
            <div className="cm-warn" style={{ background: "var(--brand-50)", borderColor: "var(--brand-200)", color: "var(--brand-700)" }}>
              ℹ Bu, ləğv <strong>tələbi</strong>dir. Operator yoxlayıb sizə bildiriş göndərəcək.
            </div>
          )}
          {isPast && mode === "cancel" && (
            <div className="cm-warn cm-warn--strong">
              ⚠ Seans vaxtı keçib. Əgər seans baş tutmadısa, "Olmadı" bildirişindən istifadə edin.
            </div>
          )}
          {isLate && !isPast && (
            <div className="cm-warn">
              ⚠ <strong>Gec ləğv:</strong> seansa {Math.max(0, Math.floor(hours!))} saat qalıb (24 saatdan az).
              {role === "PATIENT" && <> Bu halda <strong>ödəniş geri qaytarılmır</strong> və gec-ləğv sayğacınıza əlavə olunur.</>}
              {role === "PSYCHOLOGIST" && " Bu, sizin gec-ləğv sayğacınıza əlavə olunacaq."}
            </div>
          )}

          <label className="cm-label">Səbəb</label>
          <div className="cm-reasons">
            {reasons.map(r => (
              <label key={r.code} className={`cm-reason${reasonCode === r.code ? " is-active" : ""}`}>
                <input
                  type="radio"
                  name="reason"
                  value={r.code}
                  checked={reasonCode === r.code}
                  onChange={() => setReasonCode(r.code)}
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>

          <label className="cm-label">Əlavə qeyd (məcburi deyil)</label>
          <textarea
            rows={3}
            value={reasonText}
            onChange={e => setReasonText(e.target.value)}
            placeholder="Lazım gəlsə təfərrüat verin"
            className="cm-textarea"
          />

          {err && <div className="cm-err">{err}</div>}
        </div>

        <div className="cm-actions">
          <button onClick={onClose} className="cm-btn cm-btn--ghost">Geri</button>
          <button
            onClick={submit}
            disabled={saving || !reasonCode || isPast}
            className="cm-btn cm-btn--danger">
            {saving ? "Göndərilir…"
              : mode === "reject" ? "Rədd et"
              : isPatientRequest ? "Tələb göndər"
              : "Ləğv et"}
          </button>
        </div>
      </div>
    </div>
  );
}
