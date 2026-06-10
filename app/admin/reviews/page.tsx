"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminApi, type AdminReview } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:  { label: "Moderasiyada", color: "#92400E", bg: "#FEF3C7" },
  APPROVED: { label: "Təsdiqli",     color: "#065F46", bg: "#D1FAE5" },
  REJECTED: { label: "Rədd",         color: "#991B1B", bg: "#FEE2E2" },
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Stars({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }} aria-label={`${value} ulduz`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width="14" height="14" viewBox="0 0 24 24"
             fill={n <= value ? "#C97D2E" : "#E4ECFA"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export default function AdminReviewsPage() {
  const { t } = useT();
  const [items, setItems] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status>("PENDING");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<{ review: AdminReview; action: "approve" | "reject" } | null>(null);

  const load = (f: Status = filter) => {
    setLoading(true);
    const apiStatus = f === "ALL" ? undefined : f;
    adminApi.getReviews(apiStatus)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load identity changes every render; re-fetch only on filter change
  useEffect(() => { load(filter); }, [filter]);

  const counts = useMemo(() => {
    const c = { PENDING: 0, APPROVED: 0, REJECTED: 0 } as Record<string, number>;
    items.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [items]);

  const moderate = async (id: number, action: "approve" | "reject", note?: string) => {
    setBusyId(id);
    try {
      const updated = action === "approve"
        ? await adminApi.approveReview(id, note)
        : await adminApi.rejectReview(id, note);
      // If on PENDING filter, the row is no longer relevant — drop it.
      setItems(prev => filter === "PENDING"
        ? prev.filter(r => r.id !== id)
        : prev.map(r => r.id === id ? updated : r));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
      setNoteFor(null);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Bu rəyi tamamilə silmək istədiyinizə əminsiniz? Geri alınmaz.")) return;
    setBusyId(id);
    try {
      await adminApi.deleteReview(id);
      setItems(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535", margin: 0 }}>{t("staff.adminReviewsTitle")}</h1>
        <p style={{ fontSize: 13, color: "#52718F", marginTop: 4 }}>
          {t("staff.adminReviewsSub")}
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["PENDING", "APPROVED", "REJECTED", "ALL"] as Status[]).map((s) => {
          const active = filter === s;
          const label = s === "ALL" ? "Hamısı" : STATUS_BADGE[s].label;
          const count = s === "ALL" ? items.length : counts[s] ?? 0;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: active ? "2px solid #1A2535" : "1px solid #DDE6F0",
                background: active ? "#1A2535" : "#fff",
                color: active ? "#fff" : "#1A2535",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 8,
              }}
            >
              {label}
              {!loading && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  background: active ? "rgba(255,255,255,0.18)" : "#F3F4F6",
                  color: active ? "#fff" : "#52718F",
                  padding: "1px 8px", borderRadius: 999,
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>
          Yüklənir…
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 60, textAlign: "center", color: "#52718F", border: "1px dashed #DDE6F0" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✨</div>
          {filter === "PENDING" ? "Moderasiya gözləyən rəy yoxdur" : "Bu kateqoriyada rəy yoxdur"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((r) => {
            const badge = STATUS_BADGE[r.status] ?? { label: r.status, color: "#374151", bg: "#F3F4F6" };
            const busy = busyId === r.id;
            return (
              <div key={r.id} style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #EEF2F7" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: badge.color, background: badge.bg }}>
                        {badge.label}
                      </span>
                      <Stars value={r.rating} />
                      <span style={{ fontSize: 12, color: "#52718F" }}>{fmt(r.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#52718F" }}>
                      <strong style={{ color: "#1A2535" }}>{r.patientName ?? "Anonim"}</strong> →{" "}
                      <Link href={`/psychologists/${r.psychologistId}`} style={{ color: "var(--brand-700)", textDecoration: "none" }}>
                        {r.psychologistName ?? "Psixoloq"}
                      </Link>
                    </div>
                    <p style={{ fontSize: 14, color: "#1A2535", margin: "10px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {r.comment}
                    </p>
                    {r.reply && (
                      <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--brand-50)", borderLeft: "3px solid var(--brand)", borderRadius: "0 8px 8px 0", fontSize: 12 }}>
                        <strong style={{ color: "var(--brand)" }}>Psixoloqun cavabı:</strong>{" "}
                        <span style={{ color: "#374151" }}>{r.reply}</span>
                      </div>
                    )}
                    {r.moderationNote && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "#52718F" }}>
                        <strong>Admin qeydi:</strong> {r.moderationNote}
                        {r.moderatedByEmail && <> · {r.moderatedByEmail}</>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140 }}>
                    {r.status !== "APPROVED" && (
                      <button
                        onClick={() => moderate(r.id, "approve")}
                        disabled={busy}
                        style={{ padding: "7px 12px", border: "none", color: "#fff", background: "#065F46", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}
                      >
                        ✓ Təsdiqlə
                      </button>
                    )}
                    {r.status !== "REJECTED" && (
                      <button
                        onClick={() => setNoteFor({ review: r, action: "reject" })}
                        disabled={busy}
                        style={{ padding: "7px 12px", border: "1px solid #FECACA", color: "#991B1B", background: "#FFF5F5", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}
                      >
                        ✕ Rədd et
                      </button>
                    )}
                    <button
                      onClick={() => remove(r.id)}
                      disabled={busy}
                      style={{ padding: "7px 12px", border: "1px solid #DDE6F0", color: "#52718F", background: "#fff", borderRadius: 8, fontSize: 12, cursor: busy ? "wait" : "pointer" }}
                    >
                      Tamamilə sil
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {noteFor && (
        <ModerationNoteModal
          title={noteFor.action === "approve" ? "Rəyi təsdiqlə" : "Rəyi rədd et"}
          confirmLabel={noteFor.action === "approve" ? "Təsdiqlə" : "Rədd et"}
          confirmColor={noteFor.action === "approve" ? "#065F46" : "#991B1B"}
          onCancel={() => setNoteFor(null)}
          onConfirm={(note) => moderate(noteFor.review.id, noteFor.action, note)}
        />
      )}
    </div>
  );
}

function ModerationNoteModal({ title, confirmLabel, confirmColor, onCancel, onConfirm }: {
  title: string;
  confirmLabel: string;
  confirmColor: string;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(480px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EFF2F7" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", margin: 0 }}>{title}</h2>
        </div>
        <div style={{ padding: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
            Səbəb (istəyə bağlı, pasiyentə göstəriləcək)
          </label>
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Məsələn: Rəy mətnində söyüş ifadəsi var, redaktə edib yenidən göndərin."
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={onCancel}
              style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              İmtina
            </button>
            <button
              onClick={() => onConfirm(note.trim())}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: confirmColor, cursor: "pointer" }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
