"use client";

import { useEffect, useMemo, useState } from "react";
import {
  operatorApi,
  type FollowUpStatus,
  type PsychologistFeedbackSummary,
  type SessionFeedback,
} from "@/lib/api";
import { toast as uiToast } from "@/components/Toast";
import { SkeletonGrid } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { azFormatDate, azFormatDateTime } from "@/lib/datetime";

// ── Dizayn sistemi yardımçıları (operator/psychologists ilə eyni dil) ───────
const initials = (n: string) =>
  n.replace(/^Dr\.\s*/i, "").split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
const fmtRating = (n?: number | null) => (n == null ? "—" : (Math.round(n * 10) / 10).toFixed(1));
const AVS = [
  { bg: "#E0EBFA", color: "#1E3A8A" }, { bg: "#D1FAE5", color: "#065F46" },
  { bg: "#FEF3C7", color: "#92400E" }, { bg: "#EDE9FE", color: "#5B21B6" },
  { bg: "#FCE7F3", color: "#9D174D" }, { bg: "#CCFBF1", color: "#115E59" },
];
const avatarOf = (i: number) => AVS[Math.abs(i) % AVS.length];
const CARD: React.CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8" };

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

// ── Əlaqə tələbi lifecycle metadatası ───────────────────────────────────────
const STATUS_META: Record<FollowUpStatus, { label: string; flag: "warn" | "info" | "good" }> = {
  NEW:         { label: "Yeni",        flag: "warn" },
  IN_PROGRESS: { label: "Əlaqədə",     flag: "info" },
  RESOLVED:    { label: "Həll olundu", flag: "good" },
};
/** Açıq = əlaqə tələb olunub və hələ həll edilməyib. */
const isOpenFollowUp = (fb: SessionFeedback) => fb.followUpNeeded && fb.followUpStatus !== "RESOLVED";

type Filter = "ALL" | "OPEN" | "FOLLOWUP" | "LOW";

export default function OperatorFeedbackPage() {
  const [summaries, setSummaries] = useState<PsychologistFeedbackSummary[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);

  const loadList = () => {
    setLoadingList(true);
    operatorApi.feedbackByPsychologist()
      .then(setSummaries)
      .catch(() => setSummaries([]))
      .finally(() => setLoadingList(false));
  };
  useEffect(loadList, []);

  // Detal səhifəsində status dəyişdikcə səviyyə 1 kartını optimistik yeniləyirik.
  const adjustOpen = (psyId: number, delta: number) =>
    setSummaries(s => s?.map(x => x.psychologistId === psyId
      ? { ...x, openFollowUpCount: Math.max(0, x.openFollowUpCount + delta) } : x) ?? s);

  const totals = useMemo(() => ({
    count: (summaries ?? []).reduce((a, x) => a + x.totalCount, 0),
    open: (summaries ?? []).reduce((a, x) => a + x.openFollowUpCount, 0),
    low: (summaries ?? []).reduce((a, x) => a + x.lowRatingCount, 0),
  }), [summaries]);

  if (selected) {
    return (
      <PsychologistDetail
        psy={selected}
        onBack={() => setSelected(null)}
        onDelta={(d) => adjustOpen(selected.id, d)}
      />
    );
  }

  return (
    <div className="opf-page">
      <PageHeader
        title="Seans rəyləri"
        subtitle="Psixoloqlara görə qruplaşmış pasiyent rəyləri. «Operator mənimlə əlaqə saxlasın» müraciətləri həll olunana qədər açıq qalır. Karta klikləyib həmin psixoloqun rəylərinə baxın."
      />

      <div className="opf-stats">
        <Stat label="Cəmi rəy" value={totals.count} />
        <Stat label="Açıq əlaqə tələbi" value={totals.open} tone="warn" />
        <Stat label="Aşağı reytinq (≤2)" value={totals.low} tone="danger" />
      </div>

      {loadingList ? (
        <SkeletonGrid count={6} />
      ) : !summaries || summaries.length === 0 ? (
        <EmptyState title="Hələ rəy yoxdur" sub="Pasiyentlər seansdan sonra rəy verdikcə burada görünəcək." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(260px, 100%), 1fr))", gap: 14 }}>
          {summaries.map((p, i) => (
            <PsyCard key={p.psychologistId} p={p} idx={i}
              onOpen={() => setSelected({ id: p.psychologistId, name: p.psychologistName })} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Səviyyə 1 — psixoloq kartı ──────────────────────────────────────────────
function PsyCard({ p, idx, onOpen }: { p: PsychologistFeedbackSummary; idx: number; onOpen: () => void }) {
  const av = avatarOf(idx);
  // Kənar flag prioriteti: aşağı reytinq > açıq əlaqə tələbi.
  const edge = p.lowRatingCount > 0 ? "#EF4444" : p.openFollowUpCount > 0 ? "#F59E0B" : null;
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        ...CARD,
        borderLeft: edge ? `4px solid ${edge}` : CARD.border as string,
        padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", gap: 12,
        transform: hover ? "translateY(-2px)" : "none",
        boxShadow: hover ? "0 8px 24px rgba(8,47,109,.12)" : CARD.boxShadow as string,
        transition: "transform .15s, box-shadow .15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 40, height: 40, borderRadius: "50%", background: av.bg, color: av.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flex: "none" }}>
          {initials(p.psychologistName)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.psychologistName}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, marginTop: 1 }}>
            <span style={{ color: "#F59E0B" }}>★</span> {fmtRating(p.avgRating)} · {p.totalCount} rəy
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Mini label="Cəmi rəy" value={p.totalCount} />
        <Mini label="Orta ★" value={fmtRating(p.avgRating)} />
        <Mini label="Açıq əlaqə" value={p.openFollowUpCount} tone={p.openFollowUpCount > 0 ? "warn" : undefined} />
        <Mini label="Aşağı reytinq" value={p.lowRatingCount} tone={p.lowRatingCount > 0 ? "danger" : undefined} />
      </div>

      <div style={{ fontSize: 12, color: "var(--oxford-60)" }}>
        Son rəy: {p.lastFeedbackAt ? azFormatDate(p.lastFeedbackAt) : "—"}
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number | string; tone?: "warn" | "danger" }) {
  const color = tone === "warn" ? "#92400E" : tone === "danger" ? "#991B1B" : "var(--oxford)";
  const bg = tone === "warn" ? "#FEF7E8" : tone === "danger" ? "#FEF2F2" : "#F7F9FC";
  return (
    <div style={{ background: bg, borderRadius: 9, padding: "7px 10px" }}>
      <div style={{ fontSize: 10.5, color: "var(--oxford-60)", fontWeight: 600, textTransform: "uppercase", letterSpacing: .2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color, marginTop: 1 }}>{value}</div>
    </div>
  );
}

// ── Səviyyə 2 — psixoloq detalı (pasiyentə görə qruplaşmış rəylər) ───────────
function PsychologistDetail({ psy, onBack, onDelta }: {
  psy: { id: number; name: string };
  onBack: () => void;
  onDelta: (delta: number) => void;
}) {
  const [rows, setRows] = useState<SessionFeedback[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    operatorApi.feedbackForPsychologist(psy.id)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [psy.id]);

  // Əlaqə tələbini lifecycle boyunca hərəkət etdir (YENİ → ƏLAQƏDƏ → HƏLL OLUNDU).
  const setStatus = async (fb: SessionFeedback, status: FollowUpStatus) => {
    setBusyId(fb.id);
    const wasOpen = isOpenFollowUp(fb);
    try {
      const updated = await operatorApi.feedbackSetStatus(fb.id, status);
      setRows(r => r?.map(x => x.id === fb.id ? updated : x) ?? r);
      const nowOpen = isOpenFollowUp(updated);
      if (wasOpen && !nowOpen) onDelta(-1);
      else if (!wasOpen && nowOpen) onDelta(+1);
    } catch (e) { uiToast((e as Error).message, "error"); }
    finally { setBusyId(null); }
  };

  // Əlaqə tələb etməyən aşağı reytinqli rəylər üçün sadə «baxıldı» qeydi.
  const markSeen = async (fb: SessionFeedback) => {
    setBusyId(fb.id);
    try {
      const updated = await operatorApi.feedbackMarkSeen(fb.id);
      setRows(r => r?.map(x => x.id === fb.id ? updated : x) ?? r);
    } catch (e) { uiToast((e as Error).message, "error"); }
    finally { setBusyId(null); }
  };

  const avg = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    return rows.reduce((a, x) => a + x.rating, 0) / rows.length;
  }, [rows]);

  // Pasiyentə görə qruplaşdırma (rows createdAt desc gəlir → daxili sıra qorunur).
  const groups = useMemo(() => {
    const matches = (fb: SessionFeedback) =>
      filter === "ALL" ? true
        : filter === "OPEN" ? isOpenFollowUp(fb)
        : filter === "FOLLOWUP" ? fb.followUpNeeded
        : /* LOW */ fb.rating <= 2;
    const filtered = (rows ?? []).filter(matches);
    const map = new Map<number, { name: string; items: SessionFeedback[] }>();
    for (const fb of filtered) {
      const key = fb.patientId;
      if (!map.has(key)) map.set(key, { name: fb.patientName, items: [] });
      map.get(key)!.items.push(fb);
    }
    return [...map.values()];
  }, [rows, filter]);

  return (
    <div className="opf-page">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onBack} type="button"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "var(--brand)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Geri
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ width: 36, height: 36, borderRadius: "50%", background: "#E0EBFA", color: "#1E3A8A", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flex: "none" }}>
            {initials(psy.name)}
          </span>
          <h1 style={{ fontSize: 19, fontWeight: 700, color: "var(--oxford)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{psy.name}</h1>
        </div>
        {rows && rows.length > 0 && (
          <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600, flex: "none" }}>
            <span style={{ color: "#F59E0B" }}>★</span> {fmtRating(avg)} · {rows.length} rəy
          </span>
        )}
      </div>

      <div className="opf-toolbar">
        {([
          ["ALL",      "Hamısı"],
          ["OPEN",     "Açıq əlaqə tələbi"],
          ["FOLLOWUP", "Bütün əlaqə tələbləri"],
          ["LOW",      "Aşağı reytinq"],
        ] as const).map(([key, label]) => (
          <label key={key}>
            <input type="radio" checked={filter === key} onChange={() => setFilter(key)} />
            {label}
          </label>
        ))}
      </div>

      {loading ? (
        <SkeletonGrid count={4} />
      ) : groups.length === 0 ? (
        <EmptyState title="Filtrə uyğun rəy yoxdur" sub="Filtri dəyişin və ya bütün rəylərə baxın." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map(g => (
            <div key={g.name + g.items[0].id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{g.name}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)", background: "#EEF2F8", borderRadius: 999, padding: "2px 9px" }}>
                  {g.items.length} rəy
                </span>
              </div>
              <div className="opf-list">
                {g.items.map(fb => (
                  <FeedbackRow
                    key={fb.id}
                    fb={fb}
                    busy={busyId === fb.id}
                    onStatus={(s) => setStatus(fb, s)}
                    onSeen={() => markSeen(fb)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackRow({ fb, busy, onStatus, onSeen }: {
  fb: SessionFeedback;
  busy: boolean;
  onStatus: (status: FollowUpStatus) => void;
  onSeen: () => void;
}) {
  const open = isOpenFollowUp(fb);
  const flag = open ? "followup" : (fb.rating <= 2 && !fb.operatorSeenAt) ? "low" : "seen";
  const status = fb.followUpNeeded ? STATUS_META[fb.followUpStatus] : null;
  return (
    <div className="opf-row" data-flag={flag}>
      <div className="opf-row-rating">
        <div className="opf-row-rating-stars" aria-label={`${fb.rating} ulduz`}>
          {"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}
        </div>
        <div className="opf-row-rating-num">{fb.rating}/5</div>
      </div>
      <div className="opf-row-main">
        <div className="opf-row-line">
          <span className="opf-row-name">{fb.patientName}</span>
          {fb.followUpNeeded && status && (
            <span className={`opf-flag opf-flag--${status.flag}`}>əlaqə: {status.label}</span>
          )}
          {fb.rating <= 2 && <span className="opf-flag opf-flag--danger">aşağı reytinq</span>}
        </div>
        {fb.comment && <div className="opf-row-comment">«{fb.comment}»</div>}
        <div className="opf-row-meta">
          {timeAgo(fb.createdAt)} · {azFormatDateTime(fb.createdAt)}
          {fb.appointmentStartAt && <> · seans: {azFormatDate(fb.appointmentStartAt)}</>}
        </div>
      </div>
      <div className="opf-row-actions">
        {fb.followUpNeeded ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
            {fb.followUpStatus === "NEW" && (
              <>
                <button onClick={() => onStatus("IN_PROGRESS")} disabled={busy} className="rsc-btn"
                  style={{ background: "var(--brand)", color: "#fff", padding: "6px 12px" }}>
                  Əlaqə saxlanılır
                </button>
                <button onClick={() => onStatus("RESOLVED")} disabled={busy} className="opf-btn-ghost">
                  Həll olundu
                </button>
              </>
            )}
            {fb.followUpStatus === "IN_PROGRESS" && (
              <button onClick={() => onStatus("RESOLVED")} disabled={busy} className="rsc-btn"
                style={{ background: "#059669", color: "#fff", padding: "6px 12px" }}>
                Həll olundu
              </button>
            )}
            {fb.followUpStatus === "RESOLVED" && (
              <button onClick={() => onStatus("NEW")} disabled={busy} className="opf-btn-ghost">
                Yenidən aç
              </button>
            )}
          </div>
        ) : (
          !fb.operatorSeenAt && fb.rating <= 2 && (
            <button onClick={onSeen} disabled={busy} className="rsc-btn"
              style={{ background: "var(--brand)", color: "#fff", padding: "6px 12px" }}>
              Baxıldı
            </button>
          )
        )}
      </div>
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
