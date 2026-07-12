"use client";

// ============================================================================
// Seans tarixçəsi — tamamlanmış / ləğv edilmiş / rədd edilmiş seansların
// server-səhifələnmiş siyahısı, aya görə qruplaşmış. Əsas randevu səhifəsindəki
// "Tarixçə" düyməsindən açılır; rəy ("Rəy yaz") və seans feedback-i buradan verilir.
// ============================================================================

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  patientApi,
  reasonLabel,
  type AppointmentDetail,
  type MyReview,
  type SessionFeedback,
} from "@/lib/api";
import { azFormatDate, hoursSince } from "@/lib/datetime";
import ReviewModal from "../ReviewModal";
import SessionFeedbackModal from "@/components/SessionFeedbackModal";
import { STATUS, PA_STYLE, PackageBadge, IntroBadge } from "../shared";

const MONTHS_AZ_FULL = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const PAGE_SIZE = 30;

// AZ zonasında il-ay açarı + başlıq ("İyul 2026") — ay qrupları üçün.
function azMonthOf(iso: string): { key: string; label: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit" })
    .formatToParts(new Date(iso));
  const y = parts.find(p => p.type === "year")?.value ?? "";
  const m = Number(parts.find(p => p.type === "month")?.value ?? 1);
  return { key: `${y}-${m}`, label: `${MONTHS_AZ_FULL[m - 1]} ${y}` };
}

export default function PatientAppointmentHistoryPage() {
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [reviewFor, setReviewFor] = useState<AppointmentDetail | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<AppointmentDetail | null>(null);
  const [existingFeedback, setExistingFeedback] = useState<SessionFeedback | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<number>>(new Set());

  useEffect(() => {
    Promise.all([
      patientApi.myAppointmentsPaged({ scope: "history", page: 0, size: PAGE_SIZE }),
      patientApi.myReviews().catch(() => [] as MyReview[]),
    ])
      .then(([res, revs]) => {
        setItems(res.content);
        setTotalElements(res.totalElements);
        setMyReviews(revs);
        // "Necə keçdi?" düyməsi artıq rəy verilmiş seanslarda təkrar görünməsin.
        // Feedback pəncərəsi 24 saatdır — server onsuz da DESC sıralayır, ona görə
        // yalnız ilk səhifədəki (ən son) tamamlanmış seanslar yoxlanır.
        const fbCandidates = res.content.filter(a => a.status === "COMPLETED");
        if (fbCandidates.length) {
          Promise.all(fbCandidates.map(a =>
            patientApi.getSessionFeedback(a.id).then(fb => (fb ? a.id : null)).catch(() => null),
          )).then(ids => {
            const given = ids.filter((x): x is number => x != null);
            if (given.length) setFeedbackGiven(prev => {
              const next = new Set(prev);
              given.forEach(id => next.add(id));
              return next;
            });
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    patientApi.myAppointmentsPaged({ scope: "history", page: page + 1, size: PAGE_SIZE })
      .then(res => {
        setItems(prev => [...prev, ...res.content]);
        setPage(res.page);
        setTotalElements(res.totalElements);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  // Server artıq tarixçə statuslarına görə filtrləyib DESC sıralayır — burada
  // yalnız aya görə qruplaşdırırıq (tarixi olmayan sətirlər buraxılır).
  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; items: AppointmentDetail[] }[] = [];
    let last: typeof groups[number] | null = null;
    for (const a of items) {
      const ref = a.startAt ?? a.endAt;
      if (!ref) continue;
      const { key, label } = azMonthOf(ref);
      if (!last || last.key !== key) {
        last = { key, label, items: [] };
        groups.push(last);
      }
      last.items.push(a);
    }
    return groups;
  }, [items]);

  const reviewedFor = (psyId?: number | null) =>
    psyId ? myReviews.find(r => r.psychologistId === psyId) ?? null : null;

  const openFeedback = async (a: AppointmentDetail) => {
    setExistingFeedback(null); setFeedbackFor(a);
    try {
      const fb = await patientApi.getSessionFeedback(a.id);
      setExistingFeedback(fb);
      if (fb) setFeedbackGiven(prev => new Set(prev).add(a.id));
    } catch { /* opening modal fresh — backend may have returned 200 with null */ }
  };

  return (
    <div className="psy-appt-page" style={{ maxWidth: 1040, margin: "0 auto" }}>
      <style>{PA_STYLE}</style>
      <header style={{ marginBottom: 22 }}>
        <Link href="/patient/appointments" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none", marginBottom: 10 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Randevulara qayıt
        </Link>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", color: "var(--oxford)" }}>Seans tarixçəsi</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>
          Keçmiş seanslarınız — rəy yazmaq və seansın necə keçdiyini bildirmək buradan mümkündür
        </p>
      </header>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>
          Yüklənir…
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: 40, textAlign: "center", fontSize: 14, color: "var(--oxford-60)", fontWeight: 600 }}>
          Hələ tamamlanmış seansınız yoxdur
        </div>
      ) : (
        <>
          {monthGroups.map(g => (
            <section key={g.key} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
                {g.label}
              </div>
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "0 8px" }}>
                {g.items.map(a => (
                  <HistoryRow
                    key={a.id}
                    a={a}
                    review={reviewedFor(a.psychologistId)}
                    feedbackGiven={feedbackGiven.has(a.id)}
                    onWriteReview={() => setReviewFor(a)}
                    onFeedback={() => openFeedback(a)}
                  />
                ))}
              </div>
            </section>
          ))}

          {items.length < totalElements && (
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <button type="button" onClick={loadMore} disabled={loadingMore}
                style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "default" : "pointer", opacity: loadingMore ? .6 : 1 }}>
                {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - items.length)})`}
              </button>
            </div>
          )}
        </>
      )}

      {reviewFor && reviewFor.psychologistId && (
        <ReviewModal
          psychologistId={reviewFor.psychologistId}
          psychologistName={reviewFor.psychologistName ?? "Psixoloq"}
          appointmentId={reviewFor.id}
          onClose={() => setReviewFor(null)}
          onSubmitted={(saved) => {
            setMyReviews(prev => [saved, ...prev.filter(r => r.id !== saved.id)]);
            setReviewFor(null);
          }}
        />
      )}
      {feedbackFor && (
        <SessionFeedbackModal
          appointment={feedbackFor}
          existing={existingFeedback}
          onClose={() => { setFeedbackFor(null); setExistingFeedback(null); }}
          onSubmitted={(fb) => {
            setFeedbackGiven(prev => new Set(prev).add(feedbackFor.id));
            setExistingFeedback(fb);
            setFeedbackFor(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── History row ────────────────────────────────────────────────────────── */

function HistoryRow({
  a, review, feedbackGiven, onWriteReview, onFeedback,
}: {
  a: AppointmentDetail;
  review: MyReview | null;
  feedbackGiven: boolean;
  onWriteReview: () => void;
  onFeedback: () => void;
}) {
  const ref = a.startAt ?? a.endAt;
  if (!ref) return null;
  const status = STATUS[a.status] ?? STATUS.COMPLETED;
  const canReview = a.status === "COMPLETED" && a.psychologistId && !review;
  // Rəy yalnız seansdan sonrakı 24 saat ərzində yazıla bilər. Vaxt keçəndə
  // "Necə keçdi?" düyməsi yox olur (anchor: seansın bitmə vaxtı, yoxdursa başlama).
  const fbAnchor = a.endAt ?? a.startAt;
  const fbStatusOk = a.status === "COMPLETED" || a.status === "AWAITING_CONFIRMATION";
  const fbWindowOpen = fbStatusOk && fbAnchor != null && hoursSince(fbAnchor) <= 24;
  // "Rəyim" badge-i göstərilmir (lazım deyil) — yalnız moderasiya gözləyən rəy üçün işarə qalır.
  // Diqqət: bu, pasiyentin ARTIQ göndərdiyi ictimai rəyin moderasiya statusudur — pasiyentdən
  // gözlənilən yeni əməliyyat deyil. "Rəy gözləyir" mətni "seans rəyi verildi" ilə yan-yana
  // ziddiyyətli görünürdü; ona görə moderasiyanı bildirən aydın mətnə keçirildi.
  const reviewLabel = review && review.status === "PENDING" ? "Rəy yoxlanılır" : null;
  const isCancelled = a.status === "CANCELLED";
  const cancelWho = a.cancelledBy === "PATIENT" ? "Siz ləğv etdiniz"
    : a.cancelledBy === "PSYCHOLOGIST" ? "Psixoloq ləğv etdi"
    : a.cancelledBy === "OPERATOR" ? "Operator ləğv etdi" : "Ləğv edildi";
  // PATIENT_OTHER ("Digər") faydasızdır — onun yerinə yalnız pasiyentin qeydini göstəririk.
  const cancelReasonTxt = a.cancelReasonCode && a.cancelReasonCode !== "PATIENT_OTHER" ? reasonLabel(a.cancelReasonCode) : "";
  return (
    <div style={{ borderTop: "1px solid #F0F4FA", padding: "13px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 100 }}>{azFormatDate(ref)}</span>
        <span style={{ flex: 1, minWidth: 150, fontSize: 14, color: "var(--oxford-60)", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          {a.psychologistName ?? "Psixoloq"}
          {a.patientPackageId != null && <PackageBadge name={a.packageName} />}
          {a.sessionKind === "INTRO" && <IntroBadge />}
        </span>
        <span style={{ background: status.bg, color: status.color, fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999 }}>{status.label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {feedbackGiven ? (
            <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>rəy verildi</span>
          ) : fbWindowOpen ? (
            <button onClick={onFeedback} type="button" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              Necə keçdi?
            </button>
          ) : null}
        {canReview ? (
          <button onClick={onWriteReview} type="button" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "#082F6D", border: "1px solid #C7DAF5", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" /></svg>
            Rəy yaz
          </button>
        ) : reviewLabel ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FEF3C7", color: "#92400E", fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" /></svg>
            {reviewLabel}
          </span>
        ) : null}
        </div>
      </div>
      {isCancelled && (a.cancelledBy || a.cancelReasonText || cancelReasonTxt) && (
        <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, marginTop: 7 }}>
          <span style={{ color: "#991B1B", fontWeight: 600 }}>{cancelWho}</span>
          {cancelReasonTxt && <> · {cancelReasonTxt}</>}
          {a.cancelReasonText && <> · «{a.cancelReasonText}»</>}
        </div>
      )}
    </div>
  );
}
