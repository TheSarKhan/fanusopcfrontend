"use client";

import { useEffect, useMemo, useState } from "react";
import { psychologistApi, type PsychologistReceivedReview, type ReviewDeletionRequestItem } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:  { label: "Moderasiyada", color: "#92400E", bg: "#FEF3C7" },
  APPROVED: { label: "Public",       color: "#065F46", bg: "#D1FAE5" },
  REJECTED: { label: "Rədd",         color: "#991B1B", bg: "#FEE2E2" },
};

const PAGE_SIZE = 30;

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }} aria-label={`${value} ulduz`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24"
             fill={n <= value ? "#C97D2E" : "#E4ECFA"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export default function PsychologReviewsPage() {
  const { t } = useT();
  const [items, setItems] = useState<PsychologistReceivedReview[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "APPROVED" | "PENDING">("APPROVED");
  const [replyFor, setReplyFor] = useState<PsychologistReceivedReview | null>(null);
  const [deleteFor, setDeleteFor] = useState<PsychologistReceivedReview | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deletionRequests, setDeletionRequests] = useState<ReviewDeletionRequestItem[]>([]);

  const load = () => {
    setLoading(true);
    psychologistApi.receivedReviewsPaged({ page: 0, size: PAGE_SIZE })
      .then(res => {
        setItems(res.content);
        setTotalElements(res.totalElements);
        setPage(0);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    psychologistApi.myReviewDeletionRequests()
      .then(setDeletionRequests)
      .catch(() => setDeletionRequests([]));
  };

  useEffect(load, []);

  const loadMore = () => {
    setLoadingMore(true);
    psychologistApi.receivedReviewsPaged({ page: page + 1, size: PAGE_SIZE })
      .then(res => {
        setItems(prev => [...prev, ...res.content]);
        setTotalElements(res.totalElements);
        setPage(res.page);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const hasMore = items.length < totalElements;

  const deletionByReview = useMemo(() => {
    const map = new Map<number, ReviewDeletionRequestItem>();
    // ilk (ən yeni) tələb qalır — siyahı createdAt desc gəlir
    deletionRequests.forEach(dr => { if (!map.has(dr.reviewId)) map.set(dr.reviewId, dr); });
    return map;
  }, [deletionRequests]);

  const visible = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter(r => r.status === filter);
  }, [items, filter]);

  // ALL server cəmidir (totalElements); status sayları yüklənmiş rəylərdən hesablanır.
  const counts = useMemo(() => {
    const c = { ALL: totalElements, APPROVED: 0, PENDING: 0 } as Record<string, number>;
    items.forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [items, totalElements]);

  const summary = useMemo(() => {
    const approved = items.filter(r => r.status === "APPROVED");
    if (approved.length === 0) return { avg: 0, total: 0 };
    const avg = approved.reduce((s, r) => s + r.rating, 0) / approved.length;
    return { avg: Math.round(avg * 10) / 10, total: approved.length };
  }, [items]);

  const removeReply = async (id: number) => {
    if (!confirm("Cavabı silmək istədiyinizə əminsiniz?")) return;
    setBusyId(id);
    try {
      await psychologistApi.deleteReviewReply(id);
      setItems(prev => prev.map(r => r.id === id ? { ...r, reply: null, replyAt: null } : r));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535", margin: 0 }}>{t("staff.psyReviewsTitle")}</h1>
        <p style={{ fontSize: 13, color: "#52718F", marginTop: 4 }}>
          {t("staff.psyReviewsSub")}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
        <Stat label={t("staff.psyReviewsAvg")} value={summary.total > 0 ? summary.avg.toFixed(1) : "—"}
              extra={summary.total > 0 ? <Stars value={Math.round(summary.avg)} size={14} /> : null} />
        <Stat label={t("psyDetail.reviews")} value={String(counts.APPROVED ?? 0)} />
        <Stat label={t("appt.statusPending")} value={String(counts.PENDING ?? 0)} />
        <Stat label={t("psyList.filterAll")} value={String(counts.ALL ?? 0)} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["APPROVED", "PENDING", "ALL"] as const).map((f) => {
          const active = filter === f;
          const label = f === "APPROVED" ? "Public" : f === "PENDING" ? "Moderasiyada" : "Hamısı";
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: "7px 14px", borderRadius: 999,
                border: active ? "2px solid #1A2535" : "1px solid #DDE6F0",
                background: active ? "#1A2535" : "#fff",
                color: active ? "#fff" : "#1A2535",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
              {label} <span style={{ opacity: 0.7 }}>({counts[f] ?? 0})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>
          Yüklənir…
        </div>
      ) : visible.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 60, textAlign: "center", color: "#52718F", border: "1px dashed #DDE6F0" }}>
          {filter === "APPROVED"
            ? "Hələ public rəy yoxdur — yeni rəylər moderasiyadan sonra burada görünəcək."
            : "Bu kateqoriyada rəy yoxdur."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.map((r) => {
            const badge = STATUS_BADGE[r.status] ?? { label: r.status, color: "#374151", bg: "#F3F4F6" };
            const busy = busyId === r.id;
            return (
              <div key={r.id} style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #EEF2F7" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: badge.color, background: badge.bg }}>
                    {badge.label}
                  </span>
                  <Stars value={r.rating} />
                  <span style={{ fontSize: 12, color: "#52718F" }}>{fmt(r.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1A2535", marginBottom: 8 }}>
                  {r.patientName}
                </div>
                <p style={{ fontSize: 14, color: "#374151", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {r.comment}
                </p>

                {(() => {
                  const dr = deletionByReview.get(r.id);
                  if (!dr) return null;
                  const drBadge = dr.status === "PENDING"
                    ? { label: "Silmə tələbi: Gözləmədə", bg: "#FEF3C7", color: "#92400E" }
                    : dr.status === "APPROVED"
                      ? { label: "Silmə tələbi: Təsdiqləndi (rəy silindi)", bg: "#D1FAE5", color: "#065F46" }
                      : { label: "Silmə tələbi: Rədd edildi", bg: "#FEE2E2", color: "#991B1B" };
                  return (
                    <div style={{ marginTop: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: drBadge.color, background: drBadge.bg }}>
                        {drBadge.label}
                      </span>
                      {dr.decisionNote && (
                        <span style={{ fontSize: 12, color: "#52718F", marginLeft: 8 }}>{dr.decisionNote}</span>
                      )}
                    </div>
                  );
                })()}

                {r.reply ? (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--brand-50)", borderLeft: "3px solid var(--brand)", borderRadius: "0 8px 8px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <strong style={{ fontSize: 12, color: "var(--brand)" }}>Sizin cavabınız</strong>
                      <span style={{ fontSize: 11, color: "#52718F" }}>{fmt(r.replyAt ?? null)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#374151", margin: 0, whiteSpace: "pre-wrap" }}>{r.reply}</p>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => setReplyFor(r)} disabled={busy}
                        style={{ padding: "5px 10px", fontSize: 12, border: "1px solid var(--brand-200)", color: "var(--brand)", background: "#fff", borderRadius: 6, cursor: "pointer" }}>
                        Redaktə et
                      </button>
                      <button onClick={() => removeReply(r.id)} disabled={busy}
                        style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #FECACA", color: "#991B1B", background: "#fff", borderRadius: 6, cursor: busy ? "wait" : "pointer" }}>
                        Sil
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button onClick={() => setReplyFor(r)}
                      style={{ padding: "7px 14px", fontSize: 13, fontWeight: 600, border: "1px solid var(--brand-200)", color: "var(--brand)", background: "var(--brand-50)", borderRadius: 8, cursor: "pointer" }}>
                      Cavab yaz
                    </button>
                    {!deletionByReview.get(r.id) && (
                      <button onClick={() => setDeleteFor(r)}
                        style={{ padding: "7px 14px", fontSize: 13, fontWeight: 600, border: "1px solid #FECACA", color: "#991B1B", background: "#FEF2F2", borderRadius: 8, cursor: "pointer" }}>
                        Silmə tələbi göndər
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button type="button" onClick={loadMore} disabled={loadingMore}
            style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
            {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - items.length)})`}
          </button>
        </div>
      )}

      {replyFor && (
        <ReplyModal
          review={replyFor}
          onClose={() => setReplyFor(null)}
          onSaved={(updated) => {
            setItems(prev => prev.map(r => r.id === updated.id ? updated : r));
            setReplyFor(null);
          }}
        />
      )}

      {deleteFor && (
        <DeletionRequestModal
          review={deleteFor}
          onClose={() => setDeleteFor(null)}
          onSaved={(dr) => {
            setDeletionRequests(prev => [dr, ...prev]);
            setDeleteFor(null);
          }}
        />
      )}
    </div>
  );
}

/** Rəy Silmə Tələbi — rəy birbaşa silinmir, qərar Operatorundur (PSI-BR-04). */
function DeletionRequestModal({ review, onClose, onSaved }: {
  review: PsychologistReceivedReview;
  onClose: () => void;
  onSaved: (dr: ReviewDeletionRequestItem) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (reason.trim().length < 5) { setErr("Səbəbi qısaca izah edin (ən azı 5 simvol)"); return; }
    setBusy(true);
    try {
      const dr = await psychologistApi.requestReviewDeletion(review.id, reason.trim());
      onSaved(dr);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(560px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #EFF2F7" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", margin: 0 }}>
            Rəy üçün silmə tələbi
          </h2>
          <p style={{ fontSize: 12, color: "#52718F", marginTop: 4 }}>
            Tələbiniz Operatora göndərilir — rəy yalnız Operator təsdiqindən sonra silinir.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ background: "#F8FAFC", border: "1px solid #EEF2F7", padding: 12, borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#52718F", marginBottom: 4 }}>
              {review.patientName} · <Stars value={review.rating} size={12} />
            </div>
            <p style={{ fontSize: 13, color: "#374151", margin: 0, whiteSpace: "pre-wrap" }}>{review.comment}</p>
          </div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
            Silinmə səbəbi
          </label>
          <textarea
            rows={4} value={reason} maxLength={2000}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rəyin niyə uyğunsuz olduğunu izah edin…"
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", lineHeight: 1.55, resize: "vertical" }}
          />
          {err && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 10 }}>
              {err}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button onClick={onClose} disabled={busy}
              style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: busy ? "wait" : "pointer" }}>
              Bağla
            </button>
            <button onClick={submit} disabled={busy}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#991B1B", color: "#fff", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
              {busy ? "Göndərilir…" : "Tələbi göndər"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #EEF2F7", borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#52718F", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1A2535", marginTop: 4 }}>{value}</div>
      {extra && <div style={{ marginTop: 4 }}>{extra}</div>}
    </div>
  );
}

function ReplyModal({ review, onClose, onSaved }: {
  review: PsychologistReceivedReview;
  onClose: () => void;
  onSaved: (r: PsychologistReceivedReview) => void;
}) {
  const [text, setText] = useState(review.reply ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (text.trim().length < 2) { setErr("Cavab mətnini yazın"); return; }
    setBusy(true);
    try {
      const updated = await psychologistApi.replyToReview(review.id, text.trim());
      onSaved(updated);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(560px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #EFF2F7" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", margin: 0 }}>
            {review.reply ? "Cavabı redaktə et" : "Pasiyentə cavab yaz"}
          </h2>
          <p style={{ fontSize: 12, color: "#52718F", marginTop: 4 }}>
            Cavabınız public profildə rəylə birlikdə görünəcək. Peşəkar dildə yazın.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ background: "#F8FAFC", border: "1px solid #EEF2F7", padding: 12, borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#52718F", marginBottom: 4 }}>
              {review.patientName} · <Stars value={review.rating} size={12} />
            </div>
            <p style={{ fontSize: 13, color: "#374151", margin: 0, whiteSpace: "pre-wrap" }}>{review.comment}</p>
          </div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
            Cavabınız
          </label>
          <textarea
            rows={5} value={text} maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pasiyentə təşəkkür edin və ya əlavə kontekst paylaşın…"
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", lineHeight: 1.55, resize: "vertical" }}
          />
          <div style={{ fontSize: 11, color: "#8AAABF", textAlign: "right", marginTop: 4 }}>
            {text.length} / 2000
          </div>
          {err && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 10 }}>
              {err}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button onClick={onClose} disabled={busy}
              style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: busy ? "wait" : "pointer" }}>
              Bağla
            </button>
            <button onClick={submit} disabled={busy}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg,#1a1040,var(--brand))", color: "#fff", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
              {busy ? "Saxlanılır…" : "Saxla"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
