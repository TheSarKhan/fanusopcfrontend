"use client";

import { useEffect, useState } from "react";
import { patientApi, type AppointmentDetail, type SessionFeedback } from "@/lib/api";

const RATING_LABELS: Record<number, string> = {
  1: "Çox pis",
  2: "Pis",
  3: "Orta",
  4: "Yaxşı",
  5: "Əla",
};

export default function SessionFeedbackModal({
  appointment,
  existing,
  onClose,
  onSubmitted,
}: {
  appointment: AppointmentDetail;
  existing: SessionFeedback | null;
  onClose: () => void;
  onSubmitted: (fb: SessionFeedback) => void;
}) {
  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [comment, setComment] = useState<string>(existing?.comment ?? "");
  const [followUp, setFollowUp] = useState<boolean>(existing?.followUpNeeded ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (rating < 1 || rating > 5) { setError("Ulduz sayını seçin"); return; }
    setSaving(true); setError(null);
    try {
      const saved = await patientApi.submitSessionFeedback(appointment.id, {
        rating, comment: comment.trim() || undefined, followUpNeeded: followUp,
      });
      onSubmitted(saved);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="rsc-modal-back" onClick={onClose}>
      <div className="rsc-modal sf-modal" onClick={e => e.stopPropagation()}>
        <h2>{existing ? "Rəyi yenilə" : "Seans necə keçdi?"}</h2>
        <p className="rsc-modal-sub">
          Sizin rəyiniz xidmət keyfiyyətini izləməyə kömək edir. Yalnız operatorlar görür — ictimai rəylərdən fərqlidir.
        </p>

        <div className="sf-stars" role="radiogroup" aria-label="Reytinq">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} ulduz`}
              className={`sf-star${rating >= n ? " sf-star--on" : ""}`}
              onClick={() => setRating(n)}
            >★</button>
          ))}
        </div>
        {rating > 0 && <div className="sf-rating-label">{RATING_LABELS[rating]}</div>}

        <label className="sf-comment-label">
          <span>Əlavə qeyd (məcburi deyil)</span>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Nə yaxşı oldu, nə yaxşılaşdırılmalıdır?"
          />
        </label>

        <label className="sf-followup">
          <input
            type="checkbox" checked={followUp}
            onChange={e => setFollowUp(e.target.checked)} />
          <div>
            <strong>Operator komandası mənimlə əlaqə saxlasın</strong>
            <small>Bu seçim operatorun triage siyahısına düşür</small>
          </div>
        </label>

        {error && <div className="pcli-err" style={{ marginTop: 12 }}>{error}</div>}

        <div className="rsc-modal-actions">
          <button type="button" className="rsc-btn rsc-btn--close" onClick={onClose} disabled={saving}>
            Bağla
          </button>
          <button
            type="button" className="rsc-btn"
            style={{ background: "var(--brand)", color: "#fff" }}
            disabled={saving || rating < 1}
            onClick={submit}>
            {saving ? "Göndərilir…" : existing ? "Yenilə" : "Göndər"}
          </button>
        </div>
      </div>
    </div>
  );
}
