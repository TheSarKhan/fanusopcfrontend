"use client";

import { useEffect, useState } from "react";
import { psychologistApi, type AppointmentDetail, type RescheduleProposal } from "@/lib/api";

const MAX_OPTIONS = 3;

interface OptionDraft {
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  durationMin: number;
  sessionFormat: "ONLINE" | "IN_PERSON" | "";
}

function blankOption(): OptionDraft {
  return { date: "", startTime: "", durationMin: 50, sessionFormat: "" };
}

function combine(date: string, time: string, addMin: number = 0): string | null {
  if (!date || !time) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi]    = time.split(":").map(Number);
  if ([y, mo, d, h, mi].some(x => Number.isNaN(x))) return null;
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  if (addMin) dt.setMinutes(dt.getMinutes() + addMin);
  // Backend expects LocalDateTime → ISO without offset.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
}

/**
 * Psychologist creates 1–3 alternative slots for an upcoming appointment.
 * On submit calls POST /psychologist/appointments/{id}/reschedule-proposals.
 */
export default function RescheduleComposeModal({
  appointment,
  onClose,
  onCreated,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onCreated: (proposal: RescheduleProposal) => void;
}) {
  const initialDuration = appointment.startAt && appointment.endAt
    ? Math.max(15, Math.round(
        (new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()) / 60000
      ))
    : 50;

  const [options, setOptions] = useState<OptionDraft[]>([
    { ...blankOption(), durationMin: initialDuration, sessionFormat: (appointment.sessionFormat as ("ONLINE"|"IN_PERSON")) || "" },
  ]);
  const [reason, setReason] = useState("");
  const [expiresHours, setExpiresHours] = useState<number>(24);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const update = (i: number, patch: Partial<OptionDraft>) =>
    setOptions(prev => prev.map((o, idx) => idx === i ? { ...o, ...patch } : o));

  const addOption = () => setOptions(prev => prev.length < MAX_OPTIONS
    ? [...prev, { ...blankOption(), durationMin: initialDuration, sessionFormat: prev[0]?.sessionFormat ?? "" }]
    : prev);

  const removeOption = (i: number) => setOptions(prev =>
    prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const submit = async () => {
    setError(null);
    const payloadOptions: { startAt: string; endAt: string; sessionFormat?: string }[] = [];
    for (const o of options) {
      if (!o.date || !o.startTime) {
        setError("Hər seçim üçün tarix və başlama saatı tələb olunur"); return;
      }
      const startAt = combine(o.date, o.startTime, 0);
      const endAt   = combine(o.date, o.startTime, o.durationMin);
      if (!startAt || !endAt) { setError("Tarix/saat formatı yanlışdır"); return; }
      if (new Date(startAt).getTime() <= Date.now()) {
        setError("Saatlar gələcəkdə olmalıdır"); return;
      }
      payloadOptions.push({
        startAt, endAt,
        sessionFormat: o.sessionFormat || undefined,
      });
    }

    setSaving(true);
    try {
      const created = await psychologistApi.proposeReschedule(appointment.id, {
        options: payloadOptions,
        reason: reason.trim() || undefined,
        expiresInHours: Math.max(2, Math.min(168, expiresHours)),
      });
      onCreated(created);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rsc-modal-back" onClick={onClose}>
      <div className="rsc-modal" onClick={e => e.stopPropagation()}>
        <h2>Yenidən planlaşdırma təklif et</h2>
        <p className="rsc-modal-sub">
          1–3 alternativ saat təklif edin. Pasient birini seçsə yeni randevu avtomatik təsdiqlənir.
          Heç biri uyğun olmasa randevu mübahisə statusuna keçir və operator həll edir.
        </p>

        {appointment.startAt && (
          <div className="rsc-modal-original">
            <strong>Cari vaxt:</strong> {new Date(appointment.startAt).toLocaleString("az-AZ")}
          </div>
        )}

        <div className="rsc-compose-options">
          {options.map((o, i) => (
            <div key={i} className="rsc-compose-option">
              <div className="rsc-compose-option-head">
                <span>Variant {i + 1}</span>
                {options.length > 1 && (
                  <button type="button" className="rsc-compose-remove" onClick={() => removeOption(i)}>
                    × sil
                  </button>
                )}
              </div>
              <div className="rsc-compose-row">
                <label>
                  <span>Tarix</span>
                  <input type="date" value={o.date} onChange={e => update(i, { date: e.target.value })} />
                </label>
                <label>
                  <span>Başlama</span>
                  <input type="time" value={o.startTime} onChange={e => update(i, { startTime: e.target.value })} />
                </label>
                <label>
                  <span>Müddət (dəq)</span>
                  <input type="number" min={15} max={240} step={5}
                    value={o.durationMin}
                    onChange={e => update(i, { durationMin: Math.max(15, Math.min(240, Number(e.target.value) || 50)) })} />
                </label>
                <label>
                  <span>Format</span>
                  <select value={o.sessionFormat}
                    onChange={e => update(i, { sessionFormat: e.target.value as OptionDraft["sessionFormat"] })}>
                    <option value="">—</option>
                    <option value="ONLINE">Onlayn</option>
                    <option value="IN_PERSON">Əyani</option>
                  </select>
                </label>
              </div>
            </div>
          ))}

          {options.length < MAX_OPTIONS && (
            <button type="button" className="rsc-compose-add-btn" onClick={addOption}>
              + Növbəti variant
            </button>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--oxford-60)" }}>
              Səbəb (pasientə görünəcək, məcburi deyil)
            </span>
            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={500}
              placeholder="Məs. təcili müraciət oldu, vaxtı dəyişməliyəm…"
              style={{
                padding: "8px 12px", border: "1px solid var(--brand-200)",
                borderRadius: 8, fontSize: 13, resize: "vertical",
              }}
            />
          </label>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "var(--oxford-60)" }}>
          Müddət:{" "}
          <input
            type="number" min={2} max={168}
            value={expiresHours}
            onChange={e => setExpiresHours(Number(e.target.value) || 24)}
            style={{ width: 60, padding: "4px 8px", border: "1px solid var(--brand-200)", borderRadius: 6, fontSize: 12 }}
          />
          {" "}saat (default 24)
        </div>

        {error && <div className="pcli-err" style={{ marginTop: 12 }}>{error}</div>}

        <div className="rsc-modal-actions">
          <button type="button" className="rsc-btn rsc-btn--close" onClick={onClose} disabled={saving}>
            Ləğv
          </button>
          <button type="button" className="rsc-btn"
            style={{ background: "var(--brand)", color: "#fff" }}
            onClick={submit} disabled={saving}>
            {saving ? "Göndərilir…" : "Təklifi göndər"}
          </button>
        </div>
      </div>
    </div>
  );
}
