"use client";

import { useEffect, useState } from "react";
import { operatorApi, type FeedbackTriageResponse, type SessionFeedback } from "@/lib/api";

const PAGE_SIZE = 30;

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDt(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "indi";
  if (m < 60) return `${m} dəq öncə`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat öncə`;
  const d = Math.floor(h / 24);
  return `${d} gün öncə`;
}

function flagFor(fb: SessionFeedback): "followup" | "low" | "seen" | "ok" {
  if (fb.operatorSeenAt) return "seen";
  if (fb.followUpNeeded) return "followup";
  if (fb.rating <= 2)    return "low";
  return "ok";
}

export default function OperatorFeedbackPage() {
  const [data, setData] = useState<FeedbackTriageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"ALL" | "FOLLOWUP" | "LOW" | "UNSEEN">("UNSEEN");

  const load = () => {
    setLoading(true);
    operatorApi.feedbackTriage({
      page, size: PAGE_SIZE,
      onlyFollowUp: filter === "FOLLOWUP",
      onlyUnseen: filter === "UNSEEN" || filter === "FOLLOWUP",
      maxRating: filter === "LOW" ? 2 : undefined,
    })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, filter]);

  const markSeen = async (fb: SessionFeedback) => {
    try {
      const updated = await operatorApi.feedbackMarkSeen(fb.id);
      setData(d => d ? { ...d, content: d.content.map(x => x.id === fb.id ? updated : x) } : d);
    } catch (e) { alert((e as Error).message); }
  };

  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="opf-page">
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Seans rəyləri</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: 0 }}>
          Pasientlərin seansdan sonrakı 1-klik rəyləri. Operator zəng tələb edənlər və aşağı reytinqlər ön plana düşür.
        </p>
      </header>

      <div className="opf-stats">
        <Stat label="Görülməmiş əlaqə tələbi" value={data?.unseenFollowUpCount ?? 0} tone="warn" />
        <Stat label="Aşağı reytinq (≤2)" value={data?.lowRatingCount ?? 0} tone="danger" />
        <Stat label="Cəmi rəy" value={data?.totalElements ?? 0} />
      </div>

      <div className="opf-toolbar">
        {([
          ["UNSEEN",   "Görülməmiş əlaqə"],
          ["FOLLOWUP", "Operator zəngi tələb edən"],
          ["LOW",      "Aşağı reytinq"],
          ["ALL",      "Hamısı"],
        ] as const).map(([key, label]) => (
          <label key={key}>
            <input type="radio" checked={filter === key}
              onChange={() => { setFilter(key); setPage(0); }} />
            {label}
          </label>
        ))}
      </div>

      {loading ? (
        <div className="opf-row" style={{ justifyContent: "center", color: "var(--oxford-60)" }}>Yüklənir…</div>
      ) : !data || data.content.length === 0 ? (
        <div className="opf-row" style={{ justifyContent: "center", color: "var(--oxford-60)" }}>
          Filtə uyğun rəy yoxdur 🌿
        </div>
      ) : (
        <div className="opf-list">
          {data.content.map(fb => {
            const flag = flagFor(fb);
            return (
              <div key={fb.id} className="opf-row" data-flag={flag}>
                <div className="opf-row-rating">
                  <div className="opf-row-rating-stars" aria-label={`${fb.rating} ulduz`}>
                    {"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}
                  </div>
                  <div className="opf-row-rating-num">{fb.rating}/5</div>
                </div>
                <div className="opf-row-main">
                  <div className="opf-row-line">
                    <span className="opf-row-name">{fb.patientName}</span>
                    {fb.psychologistName && (
                      <span className="opf-row-psy">→ {fb.psychologistName}</span>
                    )}
                    {fb.followUpNeeded && (
                      <span className="opf-flag opf-flag--warn">📞 əlaqə tələb edir</span>
                    )}
                    {fb.rating <= 2 && (
                      <span className="opf-flag opf-flag--danger">aşağı reytinq</span>
                    )}
                    {fb.operatorSeenAt && (
                      <span className="opf-flag opf-flag--good">✓ baxılıb</span>
                    )}
                  </div>
                  {fb.comment && <div className="opf-row-comment">«{fb.comment}»</div>}
                  <div className="opf-row-meta">
                    {timeAgo(fb.createdAt)} · {fmtDt(fb.createdAt)}
                    {fb.appointmentStartAt && (
                      <> · seans: {fmtDt(fb.appointmentStartAt)}</>
                    )}
                  </div>
                </div>
                {!fb.operatorSeenAt && (
                  <div className="opf-row-actions">
                    <button onClick={() => markSeen(fb)} className="rsc-btn"
                      style={{ background: "var(--brand)", color: "#fff", padding: "6px 12px" }}>
                      Baxıldı
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="audit-pager">
          <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="audit-page-btn">← Geri</button>
          <span className="audit-page-info">{page + 1} / {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)} className="audit-page-btn">İrəli →</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "danger" }) {
  return (
    <div className="opf-stat">
      <div className="opf-stat-label">{label}</div>
      <div className="opf-stat-value" data-tone={tone}>{value}</div>
    </div>
  );
}
