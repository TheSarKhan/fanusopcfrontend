"use client";

import { useState } from "react";
import { patientApi, type MyReview } from "@/lib/api";

export default function ReviewModal({
  psychologistId,
  psychologistName,
  appointmentId,
  initial,
  onClose,
  onSubmitted,
}: {
  psychologistId: number;
  psychologistName: string;
  appointmentId?: number | null;
  initial?: MyReview;
  onClose: () => void;
  onSubmitted: (review: MyReview) => void;
}) {
  const [rating, setRating] = useState<number>(initial?.rating ?? 5);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState<string>(initial?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (rating < 1 || rating > 5) { setErr("Reytinq seçin"); return; }
    if (comment.trim().length < 5) { setErr("Rəy mətnini ən azı 5 simvol yazın"); return; }
    setBusy(true);
    try {
      const data = { rating, comment: comment.trim(), appointmentId: appointmentId ?? null };
      const saved = initial
        ? await patientApi.updateReview(initial.id, data)
        : await patientApi.submitReview(psychologistId, data);
      onSubmitted(saved);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(560px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #EFF2F7" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1A2535", margin: 0 }}>
            {initial ? "Rəyimi redaktə et" : "Psixoloqa rəy yaz"}
          </h2>
          <p style={{ fontSize: 12, color: "#52718F", marginTop: 4 }}>
            {psychologistName} ilə təcrübəniz haqqında qısa fikrinizi paylaşın.
            Rəyiniz moderasiyadan keçdikdən sonra public profildə görünəcək.
          </p>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
              Reytinq
            </label>
            <div
              onMouseLeave={() => setHover(0)}
              style={{ display: "flex", gap: 4 }}
            >
              {[1, 2, 3, 4, 5].map((n) => {
                const active = (hover || rating) >= n;
                return (
                  <button
                    type="button"
                    key={n}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => setRating(n)}
                    aria-label={`${n} ulduz`}
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      padding: 4, lineHeight: 0,
                    }}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24"
                         fill={active ? "#C97D2E" : "#E4ECFA"}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                );
              })}
              <span style={{ fontSize: 13, color: "#52718F", alignSelf: "center", marginLeft: 8 }}>
                {rating === 5 ? "Mükəmməl" : rating === 4 ? "Yaxşı" : rating === 3 ? "Orta" : rating === 2 ? "Zəif" : "Pis"}
              </span>
            </div>
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
            Rəy mətni
          </label>
          <textarea
            rows={5}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Seansın sizə necə təsir etdiyi, psixoloqun yanaşması və ümumi təcrübəniz haqqında yazın…"
            maxLength={2000}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", lineHeight: 1.55, resize: "vertical", marginBottom: 6 }}
          />
          <div style={{ fontSize: 11, color: "#8AAABF", textAlign: "right", marginBottom: 14 }}>
            {comment.length} / 2000
          </div>

          {err && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
              {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              disabled={busy}
              style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: busy ? "wait" : "pointer" }}
            >
              Bağla
            </button>
            <button
              onClick={submit}
              disabled={busy}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}
            >
              {busy ? "Göndərilir…" : initial ? "Yenilə" : "Göndər"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
