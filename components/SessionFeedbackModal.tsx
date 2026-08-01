"use client";

import { useEffect, useState } from "react";
import { patientApi, type AppointmentDetail, type SessionFeedback } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const RATING_KEYS: Record<number, MessageKey> = {
  1: "feedback.rate1",
  2: "feedback.rate2",
  3: "feedback.rate3",
  4: "feedback.rate4",
  5: "feedback.rate5",
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
  const { t } = useT();
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
    if (rating < 1 || rating > 5) { setError(t("feedback.errorRating")); return; }
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
        <h2>{existing ? t("feedback.modalEditTitle") : t("feedback.modalTitle")}</h2>
        <p className="rsc-modal-sub">
          {t("feedback.modalSub")}
        </p>

        <div className="sf-stars" role="radiogroup" aria-label={t("patFb.ratingAria")}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={t("pub.starsAria", { n })}
              className={`sf-star${rating >= n ? " sf-star--on" : ""}`}
              onClick={() => setRating(n)}
            >★</button>
          ))}
        </div>
        {rating > 0 && <div className="sf-rating-label">{t(RATING_KEYS[rating])}</div>}

        <label className="sf-comment-label">
          <span>{t("feedback.commentLabel")} ({t("common.optional")})</span>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={t("feedback.commentPlaceholder")}
          />
        </label>

        <label className="sf-followup">
          <input
            type="checkbox" checked={followUp}
            onChange={e => setFollowUp(e.target.checked)} />
          <div>
            <strong>{t("feedback.followUpTitle")}</strong>
            <small>{t("feedback.followUpSub")}</small>
          </div>
        </label>

        {error && <div className="pcli-err" style={{ marginTop: 12 }}>{error}</div>}

        <div className="rsc-modal-actions">
          <button type="button" className="rsc-btn rsc-btn--close" onClick={onClose} disabled={saving}>
            {t("common.close")}
          </button>
          <button
            type="button" className="rsc-btn"
            style={{ background: "var(--brand)", color: "#fff" }}
            disabled={saving || rating < 1}
            onClick={submit}>
            {saving ? t("common.sending") : existing ? t("feedback.update") : t("feedback.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
