"use client";

import { useMemo, useState } from "react";
import {
  patientApi,
  psychologistApi,
  operatorApi,
  reasonsForRole,
  type AppointmentDetail,
  type CancellationRole,
} from "@/lib/api";

const LATE_WINDOW_HOURS = 24;

function hoursUntil(iso?: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  return ms / (1000 * 60 * 60);
}

interface Props {
  appointment: AppointmentDetail;
  role: CancellationRole;
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

  const headerLabel = mode === "reject"
    ? "Müraciəti rədd et"
    : "Randevunu ləğv et";

  const submit = async () => {
    setErr(null);
    if (!reasonCode) { setErr("Səbəb seçin"); return; }
    setSaving(true);
    try {
      let updated: AppointmentDetail;
      if (role === "PATIENT") {
        updated = await patientApi.cancel(appointment.id, reasonCode, reasonText || undefined);
      } else if (role === "PSYCHOLOGIST") {
        if (mode === "reject") {
          updated = await psychologistApi.reject(appointment.id, reasonCode, reasonText || undefined);
        } else {
          updated = await psychologistApi.cancel(appointment.id, reasonCode, reasonText || undefined);
        }
      } else {
        updated = await operatorApi.cancel(appointment.id, reasonCode, reasonText || undefined);
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
            <p className="cm-sub">
              {role === "PATIENT" ? appointment.psychologistName : appointment.patientName}
              {appointment.startAt && (
                <span> · {new Date(appointment.startAt).toLocaleString("az-AZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </p>
          ) : null}
        </div>

        <div className="cm-body">
          {isPast && mode === "cancel" && (
            <div className="cm-warn cm-warn--strong">
              ⚠ Seans vaxtı keçib. Əgər seans baş tutmadısa, "Olmadı" bildirişindən istifadə edin.
            </div>
          )}
          {isLate && !isPast && (
            <div className="cm-warn">
              ⚠ <strong>Geç ləğv:</strong> seansa {Math.max(0, Math.floor(hours!))} saat qalıb.
              {role === "PATIENT" && " Bu, geç-ləğv sayğacınıza əlavə olunacaq."}
              {role === "PSYCHOLOGIST" && " Bu, sizin geç-ləğv sayğacınıza əlavə olunacaq."}
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
            {saving ? "Göndərilir…" : (mode === "reject" ? "Rədd et" : "Ləğv et")}
          </button>
        </div>
      </div>
    </div>
  );
}
