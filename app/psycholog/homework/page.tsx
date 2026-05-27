"use client";

import { useEffect, useMemo, useState } from "react";
import {
  psychologistApi,
  type ClientSummary, type Homework, type HomeworkLabel,
  type HomeworkLabelColor, type HomeworkPriority, type HomeworkStatus,
} from "@/lib/api";
import HomeworkDetailModal from "@/components/HomeworkDetailModal";
import HomeworkCreateModal from "@/components/HomeworkCreateModal";
import HomeworkLabelChip, { LABEL_COLOR_LIST, labelColors } from "@/components/HomeworkLabelChip";
import { useT } from "@/lib/i18n/LocaleProvider";

const PRIORITY_COLOR: Record<HomeworkPriority, string> = {
  LOW: "#10B981", MEDIUM: "#F59E0B", HIGH: "#DC2626",
};
const PRIORITY_LABEL: Record<HomeworkPriority, string> = {
  LOW: "Aşağı", MEDIUM: "Orta", HIGH: "Yüksək",
};
const STATUS_TONE: Record<HomeworkStatus, { label: string; color: string; bg: string }> = {
  PENDING:   { label: "Gözləyir",   color: "#92400E", bg: "#FEF3C7" },
  COMPLETED: { label: "Tamamlandı", color: "#065F46", bg: "#D1FAE5" },
  SKIPPED:   { label: "Atlandı",    color: "var(--oxford-60)", bg: "var(--oxford-10)" },
};

function isOverdue(h: Homework): boolean {
  if (h.status !== "PENDING" || !h.dueDate) return false;
  return new Date(h.dueDate + "T23:59:59").getTime() < Date.now();
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase();
}
function formatTimeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "indi";
  if (min < 60) return `${min} dəq əvvəl`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} saat əvvəl`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} gün əvvəl`;
  const mo = Math.round(d / 30);
  return `${mo} ay əvvəl`;
}

interface PatientBucket {
  patientId: number;
  patientName: string;
  homeworks: Homework[];
  total: number;
  completed: number;
  pending: number;
  skipped: number;
  overdue: number;
  completionRate: number;
  lastActivityAt: number | null;        // ms
  daysSinceActivity: number | null;
}

function bucketByPatient(items: Homework[]): Map<number, PatientBucket> {
  const map = new Map<number, PatientBucket>();
  for (const h of items) {
    let b = map.get(h.patientId);
    if (!b) {
      b = {
        patientId: h.patientId, patientName: h.patientName,
        homeworks: [], total: 0, completed: 0, pending: 0, skipped: 0, overdue: 0,
        completionRate: 0, lastActivityAt: null, daysSinceActivity: null,
      };
      map.set(h.patientId, b);
    }
    b.homeworks.push(h);
    b.total += 1;
    if (h.status === "COMPLETED") b.completed += 1;
    if (h.status === "PENDING") b.pending += 1;
    if (h.status === "SKIPPED") b.skipped += 1;
    if (isOverdue(h)) b.overdue += 1;
    const at = new Date(h.completedAt ?? h.createdAt).getTime();
    if (b.lastActivityAt == null || at > b.lastActivityAt) b.lastActivityAt = at;
  }
  for (const b of map.values()) {
    b.completionRate = b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0;
    b.daysSinceActivity = b.lastActivityAt
      ? Math.floor((Date.now() - b.lastActivityAt) / (1000 * 60 * 60 * 24))
      : null;
    b.homeworks.sort((a, b) => {
      if (a.status === "PENDING" && b.status !== "PENDING") return -1;
      if (a.status !== "PENDING" && b.status === "PENDING") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  return map;
}

type SubTab = "pending" | "completed" | "skipped" | "all";

export default function PsychologHomeworkPage() {
  const { t } = useT();
  const [items, setItems] = useState<Homework[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [labels, setLabels] = useState<HomeworkLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("pending");
  const [showForm, setShowForm] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [formInitialPatient, setFormInitialPatient] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.homework().catch(() => [] as Homework[]),
      psychologistApi.clients().catch(() => [] as ClientSummary[]),
      psychologistApi.homeworkLabels().catch(() => [] as HomeworkLabel[]),
    ]).then(([h, c, l]) => { setItems(h); setClients(c); setLabels(l); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const buckets = useMemo(() => bucketByPatient(items), [items]);

  /** Side list combines patients-with-tasks with the client roster — we
   *  surface every client so the psychologist can assign a first homework
   *  even before any cards exist for them. */
  const sideList: PatientBucket[] = useMemo(() => {
    const all = new Map(buckets);
    for (const c of clients) {
      if (!all.has(c.patientId)) {
        all.set(c.patientId, {
          patientId: c.patientId, patientName: c.name,
          homeworks: [], total: 0, completed: 0, pending: 0, skipped: 0, overdue: 0,
          completionRate: 0, lastActivityAt: null, daysSinceActivity: null,
        });
      }
    }
    return Array.from(all.values()).sort((a, b) => {
      // Overdue first, then patients with pending tasks, then last activity recency.
      if (a.overdue !== b.overdue) return b.overdue - a.overdue;
      if (a.pending !== b.pending) return b.pending - a.pending;
      const aT = a.lastActivityAt ?? 0;
      const bT = b.lastActivityAt ?? 0;
      return bT - aT;
    });
  }, [buckets, clients]);

  const selected = selectedPatientId != null
    ? sideList.find(b => b.patientId === selectedPatientId) ?? null
    : null;

  // Auto-pick the first patient that has tasks the first time the page loads
  // so the workspace isn't blank on entry.
  useEffect(() => {
    if (loading || selectedPatientId != null || sideList.length === 0) return;
    const firstWithTasks = sideList.find(b => b.total > 0) ?? sideList[0];
    setSelectedPatientId(firstWithTasks.patientId);
  }, [loading, sideList, selectedPatientId]);

  // ─── Stats ──────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    total: items.length,
    pending: items.filter(h => h.status === "PENDING").length,
    completed: items.filter(h => h.status === "COMPLETED").length,
    skipped: items.filter(h => h.status === "SKIPPED").length,
    overdue: items.filter(isOverdue).length,
    activePatients: buckets.size,
    avgCompletion: buckets.size > 0
      ? Math.round([...buckets.values()].reduce((s, b) => s + b.completionRate, 0) / buckets.size)
      : 0,
  }), [items, buckets]);

  // Recent activity across all homework — derived from item state changes.
  const recentEvents = useMemo(() => {
    type Ev = { id: string; ts: number; patientName: string; title: string; kind: "completed" | "skipped" | "created" };
    const evs: Ev[] = [];
    for (const h of items) {
      if (h.completedAt) {
        evs.push({
          id: `c-${h.id}`, ts: new Date(h.completedAt).getTime(),
          patientName: h.patientName, title: h.title,
          kind: h.status === "COMPLETED" ? "completed" : "skipped",
        });
      } else {
        evs.push({
          id: `n-${h.id}`, ts: new Date(h.createdAt).getTime(),
          patientName: h.patientName, title: h.title, kind: "created",
        });
      }
    }
    return evs.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [items]);

  const needsAttention = useMemo(
    () => sideList.filter(b => b.overdue > 0 || (b.total > 0 && (b.daysSinceActivity ?? 0) > 14))
      .slice(0, 5),
    [sideList]
  );

  // ─── Actions ────────────────────────────────────────────────────────────
  const openNewForm = (preselectPatient?: number) => {
    setFormInitialPatient(preselectPatient ?? selectedPatientId ?? null);
    setShowForm(true);
  };

  const onCreated = (created: Homework) => {
    setItems(prev => [created, ...prev]);
    setSelectedPatientId(created.patientId);
    setShowForm(false);
  };

  const remove = async (id: number) => {
    if (!confirm("Tapşırığı silmək istəyirsiniz? Bütün alt-tapşırıqlar və fayllar da silinəcək.")) return;
    try {
      await psychologistApi.deleteHomework(id);
      setItems(prev => prev.filter(x => x.id !== id));
      setDetailId(null);
    } catch (e) { alert((e as Error).message); }
  };

  const updateOne = (h: Homework) => setItems(prev => prev.map(x => x.id === h.id ? h : x));

  const detail = detailId != null ? items.find(h => h.id === detailId) ?? null : null;

  return (
    <div>
      <div className="psy-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)" }}>{t("staff.psyHomeworkTitle")}</h1>
          <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4 }}>
            Pasiyent əsaslı iş otağı. Sol panelden pasiyent seçin və ya yeni tapşırıq əlavə edin.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowLabelManager(true)}
            style={ghostBtn()}>Etiketləri idarə et</button>
          <button onClick={() => openNewForm()}
            style={primaryBtn()}>+ Yeni tapşırıq</button>
        </div>
      </div>

      {/* Top stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
        <StatCell label="Aktiv pasiyent" value={counts.activePatients} tone="brand" />
        <StatCell label="Cəmi tapşırıq"   value={counts.total}          tone="brand" />
        <StatCell label="Gözləyir"        value={counts.pending}        tone="warn" />
        <StatCell label="Tamamlandı"      value={counts.completed}      tone="good" />
        <StatCell label="Atlandı"         value={counts.skipped}        tone="muted" />
        <StatCell label="Gecikən"         value={counts.overdue}        tone="danger" highlight={counts.overdue > 0} />
        <StatCell label="Orta tamamlama"  value={counts.avgCompletion}  tone="muted" suffix="%" />
      </div>

      <HomeworkCreateModal
        open={showForm}
        clients={clients}
        labels={labels}
        initialPatientId={formInitialPatient}
        onClose={() => setShowForm(false)}
        onCreated={onCreated}
      />

      {showLabelManager && (
        <LabelManagerModal labels={labels}
          onClose={() => setShowLabelManager(false)}
          onChange={setLabels} />
      )}

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "var(--oxford-60)" }}>Yüklənir…</div>
      ) : (
        <div className="psy-hw-layout" style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 320px) minmax(0, 1fr)",
          gap: 12,
        }}>
          {/* ── Patients sidebar ───────────────────────────────────────── */}
          <PatientSidebar
            patients={sideList}
            selectedId={selectedPatientId}
            onSelect={setSelectedPatientId}
          />

          {/* ── Workspace ──────────────────────────────────────────────── */}
          <main style={{ minWidth: 0 }}>
            {selected ? (
              <PatientWorkspace
                bucket={selected}
                subTab={subTab}
                onSubTab={setSubTab}
                onOpenHomework={id => setDetailId(id)}
                onRemoveHomework={remove}
                onNewHomework={() => openNewForm(selected.patientId)}
              />
            ) : (
              <OverviewPanel
                counts={counts}
                recentEvents={recentEvents}
                needsAttention={needsAttention}
                onPick={setSelectedPatientId}
              />
            )}
          </main>
        </div>
      )}

      {detail && (
        <HomeworkDetailModal
          homework={detail}
          role="PSYCHOLOGIST"
          availableLabels={labels}
          onClose={() => setDetailId(null)}
          onMutate={updateOne}
          onDelete={() => remove(detail.id)}
        />
      )}
    </div>
  );
}

/* ─── Patient sidebar ─────────────────────────────────────────────────────── */

function PatientSidebar({
  patients, selectedId, onSelect,
}: {
  patients: PatientBucket[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? patients.filter(p => p.patientName.toLowerCase().includes(query.toLowerCase()))
    : patients;

  return (
    <aside style={{
      background: "#fff", borderRadius: 14, padding: 10,
      border: "1px solid var(--oxford-10)",
      height: "fit-content", position: "sticky", top: 12,
    }}>
      <div style={{ padding: "4px 6px 10px" }}>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Pasiyent axtar…"
          style={{
            width: "100%", padding: "8px 10px", borderRadius: 8,
            border: "1px solid var(--oxford-10)", fontSize: 12.5, boxSizing: "border-box",
          }} />
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "var(--oxford-60)", fontSize: 12 }}>
          Pasiyent tapılmadı
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: "70vh", overflow: "auto" }}>
          {filtered.map(p => (
            <PatientRow key={p.patientId} p={p}
              active={selectedId === p.patientId}
              onClick={() => onSelect(p.patientId)} />
          ))}
        </div>
      )}
    </aside>
  );
}

function PatientRow({ p, active, onClick }: {
  p: PatientBucket;
  active: boolean;
  onClick: () => void;
}) {
  const hue = p.completionRate >= 70 ? "#10B981" : p.completionRate >= 30 ? "#F59E0B" : "#DC2626";
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 10px", borderRadius: 10,
      background: active ? "var(--brand-50)" : "transparent",
      border: active ? "1px solid var(--brand-200)" : "1px solid transparent",
      cursor: "pointer", textAlign: "left", width: "100%",
    }}>
      <Avatar name={p.patientName} active={active} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: active ? "var(--brand-700)" : "var(--oxford)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{p.patientName}</div>
        <div style={{ fontSize: 10.5, color: "var(--oxford-60)", marginTop: 2 }}>
          {p.total === 0 ? "Hələ tapşırıq yox" : (
            <>
              {p.completed}/{p.total} bitib · {p.completionRate}%
              {p.lastActivityAt && <> · {formatTimeAgo(new Date(p.lastActivityAt).toISOString())}</>}
            </>
          )}
        </div>
        {p.total > 0 && (
          <div style={{ height: 3, background: "var(--oxford-10)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
            <div style={{
              width: `${p.completionRate}%`, height: "100%", background: hue, transition: "width 0.2s",
            }} />
          </div>
        )}
      </div>
      {p.overdue > 0 && (
        <span title={`${p.overdue} gecikən tapşırıq`} style={{
          fontSize: 10, fontWeight: 700, padding: "2px 7px",
          background: "#FEE2E2", color: "#991B1B", borderRadius: 999,
        }}>{p.overdue}</span>
      )}
    </button>
  );
}

function Avatar({ name, active }: { name: string; active: boolean }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
      background: active ? "var(--brand)" : "var(--brand-50)",
      color: active ? "#fff" : "var(--brand-700)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700,
      border: `1px solid ${active ? "var(--brand)" : "var(--brand-100)"}`,
    }}>{initials(name)}</div>
  );
}

/* ─── Workspace for a selected patient ────────────────────────────────────── */

function PatientWorkspace({
  bucket, subTab, onSubTab, onOpenHomework, onRemoveHomework, onNewHomework,
}: {
  bucket: PatientBucket;
  subTab: SubTab;
  onSubTab: (t: SubTab) => void;
  onOpenHomework: (id: number) => void;
  onRemoveHomework: (id: number) => void;
  onNewHomework: () => void;
}) {
  const ring = makeRing(bucket.completionRate);
  const visible = bucket.homeworks.filter(h => {
    if (subTab === "pending") return h.status === "PENDING";
    if (subTab === "completed") return h.status === "COMPLETED";
    if (subTab === "skipped") return h.status === "SKIPPED";
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Patient summary card */}
      <div style={{
        background: "#fff", borderRadius: 14, padding: 18,
        border: "1px solid var(--oxford-10)",
        display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
      }}>
        <div style={{ position: "relative", width: 76, height: 76 }}>
          <svg width="76" height="76" viewBox="0 0 76 76">
            <circle cx="38" cy="38" r="32" fill="none" stroke="var(--brand-50)" strokeWidth="8" />
            <circle cx="38" cy="38" r="32" fill="none"
              stroke={ring.color} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${ring.dash} 999`}
              transform="rotate(-90 38 38)" />
          </svg>
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: "var(--oxford)",
          }}>{bucket.completionRate}%</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>{bucket.patientName}</h2>
          <div style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span><b style={{ color: "var(--oxford)" }}>{bucket.total}</b> cəmi</span>
            <span><b style={{ color: "#92400E" }}>{bucket.pending}</b> gözləyir</span>
            <span><b style={{ color: "#065F46" }}>{bucket.completed}</b> bitib</span>
            {bucket.skipped > 0 && <span><b style={{ color: "#6B7280" }}>{bucket.skipped}</b> atlandı</span>}
            {bucket.overdue > 0 && <span><b style={{ color: "#991B1B" }}>{bucket.overdue}</b> gecikən</span>}
            {bucket.lastActivityAt && <span>Son aktivlik: {formatTimeAgo(new Date(bucket.lastActivityAt).toISOString())}</span>}
          </div>
        </div>
        <button onClick={onNewHomework} style={primaryBtn()}>+ Yeni tapşırıq</button>
      </div>

      {/* Tab strip */}
      <div style={{
        display: "flex", gap: 6, background: "#fff", padding: 6,
        borderRadius: 10, border: "1px solid var(--oxford-10)", width: "fit-content",
      }}>
        <TabBtn label={`Aktiv (${bucket.pending})`} active={subTab === "pending"} onClick={() => onSubTab("pending")} />
        <TabBtn label={`Bitib (${bucket.completed})`} active={subTab === "completed"} onClick={() => onSubTab("completed")} />
        <TabBtn label={`Atlandı (${bucket.skipped})`} active={subTab === "skipped"} onClick={() => onSubTab("skipped")} />
        <TabBtn label={`Bütün (${bucket.total})`} active={subTab === "all"} onClick={() => onSubTab("all")} />
      </div>

      {/* Tasks list */}
      {visible.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 14, padding: 32, textAlign: "center",
          color: "var(--oxford-60)", border: "1px dashed var(--oxford-10)",
        }}>
          {bucket.total === 0
            ? "Bu pasiyent üçün hələ tapşırıq yoxdur. Yuxarıdakı düymə ilə əlavə edin."
            : "Bu tabda tapşırıq yoxdur."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(h => (
            <PsyHomeworkRow key={h.id} h={h}
              onOpen={() => onOpenHomework(h.id)}
              onDelete={() => onRemoveHomework(h.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function makeRing(percent: number) {
  const r = 32;
  const circumference = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  const color = percent >= 70 ? "#10B981" : percent >= 30 ? "#F59E0B" : "#DC2626";
  return { dash, color };
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px", borderRadius: 8,
      border: "none",
      background: active ? "var(--brand)" : "transparent",
      color: active ? "#fff" : "var(--oxford-60)",
      fontSize: 12, fontWeight: 600, cursor: "pointer",
      transition: "background 0.15s",
    }}>{label}</button>
  );
}

/* ─── Overview panel (when no patient selected) ───────────────────────────── */

function OverviewPanel({
  counts, recentEvents, needsAttention, onPick,
}: {
  counts: { activePatients: number; pending: number; overdue: number; avgCompletion: number };
  recentEvents: { id: string; ts: number; patientName: string; title: string; kind: "completed" | "skipped" | "created" }[];
  needsAttention: PatientBucket[];
  onPick: (id: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        background: "#fff", borderRadius: 14, padding: 22,
        border: "1px solid var(--oxford-10)",
        textAlign: "center", color: "var(--oxford-60)",
      }}>
        Sol paneldən pasiyent seçin və ya aşağıdakı diqqət bölməsindən birbaşa keçid edin.
      </div>

      {needsAttention.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid var(--oxford-10)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)", marginBottom: 10 }}>
            Diqqət tələb edir
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {needsAttention.map(b => (
              <button key={b.patientId} onClick={() => onPick(b.patientId)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  borderRadius: 10, background: "var(--brand-50)", border: "1px solid var(--brand-100)",
                  cursor: "pointer", textAlign: "left", width: "100%",
                }}>
                <Avatar name={b.patientName} active={false} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford)" }}>{b.patientName}</div>
                  <div style={{ fontSize: 11, color: "var(--oxford-60)" }}>
                    {b.overdue > 0 && `${b.overdue} gecikən tapşırıq`}
                    {b.overdue > 0 && (b.daysSinceActivity ?? 0) > 14 && " · "}
                    {(b.daysSinceActivity ?? 0) > 14 && `${b.daysSinceActivity} gündür aktivlik yoxdur`}
                  </div>
                </div>
                <span style={{ fontSize: 14, color: "var(--brand)" }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid var(--oxford-10)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)", marginBottom: 10 }}>
          Son aktivlik
        </div>
        {recentEvents.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--oxford-60)" }}>Hələ aktivlik yoxdur</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentEvents.map(ev => (
              <div key={ev.id} style={{
                display: "flex", gap: 10, fontSize: 12.5, color: "var(--oxford)",
                padding: "6px 0", borderBottom: "1px solid var(--oxford-10)",
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%", marginTop: 6,
                  background: ev.kind === "completed" ? "#10B981" : ev.kind === "skipped" ? "#6B7280" : "var(--brand)",
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <b>{ev.patientName}</b>
                  {" "}
                  <span style={{ color: "var(--oxford-60)" }}>
                    {ev.kind === "completed" ? "tamamladı" : ev.kind === "skipped" ? "atladı" : "yeni tapşırıq aldı"}
                  </span>
                  <span style={{ color: "var(--oxford)" }}>{` — ${ev.title}`}</span>
                  <div style={{ fontSize: 10.5, color: "var(--oxford-60)", marginTop: 2 }}>
                    {formatTimeAgo(new Date(ev.ts).toISOString())}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Compact homework row (used inside workspace) ────────────────────────── */

function PsyHomeworkRow({ h, onOpen, onDelete }: {
  h: Homework;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const overdue = isOverdue(h);
  const status = STATUS_TONE[h.status];
  const progress = h.checklistTotal > 0
    ? Math.round((h.checklistCompleted / h.checklistTotal) * 100)
    : 0;

  return (
    <div onClick={onOpen} style={{
      background: "#fff", borderRadius: 12, padding: 14,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      border: `1px solid ${overdue ? "#FCA5A5" : "var(--oxford-10)"}`,
      borderLeft: `4px solid ${PRIORITY_COLOR[h.priority]}`,
      cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 14px rgba(15,23,42,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)")}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{
              padding: "2px 8px", borderRadius: 999,
              background: status.bg, color: status.color,
              fontSize: 11, fontWeight: 700,
            }}>{status.label}</span>
            <span style={{
              padding: "2px 8px", borderRadius: 999,
              background: PRIORITY_COLOR[h.priority], color: "#fff",
              fontSize: 11, fontWeight: 700,
            }}>{PRIORITY_LABEL[h.priority]}</span>
            {overdue && (
              <span style={{
                padding: "2px 8px", borderRadius: 999,
                background: "#FEE2E2", color: "#991B1B", fontSize: 11, fontWeight: 700,
              }}>Gecikib</span>
            )}
            {h.labels.map(l => <HomeworkLabelChip key={l.id} label={l.label} color={l.color} size="xs" />)}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)", marginBottom: 4 }}>{h.title}</div>
          <div style={{ fontSize: 11.5, color: "var(--oxford-60)", display: "flex", gap: 12, flexWrap: "wrap" }}>
            {h.dueDate && <span>Son tarix: {h.dueDate}</span>}
            <span>Yaradılıb {formatTimeAgo(h.createdAt)}</span>
            {h.completedAt && (
              <span>Statusu dəyişib {formatTimeAgo(h.completedAt)}</span>
            )}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ fontSize: 11, color: "#991B1B", background: "transparent", border: "1px solid #FECACA", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
          Sil
        </button>
      </div>

      {h.checklistTotal > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--oxford-60)", marginBottom: 4 }}>
            <span>Alt-tapşırıq gedişatı</span>
            <span style={{ fontWeight: 600, color: "var(--brand-700)" }}>{h.checklistCompleted}/{h.checklistTotal} · {progress}%</span>
          </div>
          <div style={{ height: 4, background: "var(--brand-50)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--brand)", transition: "width 0.2s" }} />
          </div>
        </div>
      )}

      <div style={{
        display: "flex", gap: 14, marginTop: 10,
        fontSize: 11, color: "var(--oxford-60)", flexWrap: "wrap",
      }}>
        {h.attachments.length > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <PaperclipIcon /> {h.attachments.length} fayl
          </span>
        )}
        {h.commentCount > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <CommentIcon /> {h.commentCount} şərh
          </span>
        )}
        {h.completionNote && (
          <span style={{ color: "var(--brand-700)" }}>Müştəri qeydi var</span>
        )}
      </div>
    </div>
  );
}

/* ─── Stat cell ───────────────────────────────────────────────────────────── */

function StatCell({ label, value, tone, highlight, suffix }: {
  label: string; value: number;
  tone: "brand" | "warn" | "good" | "muted" | "danger";
  highlight?: boolean; suffix?: string;
}) {
  const palette: Record<typeof tone, { color: string }> = {
    brand:  { color: "var(--brand-700)" },
    warn:   { color: "#92400E" },
    good:   { color: "#065F46" },
    muted:  { color: "var(--oxford-60)" },
    danger: { color: "#991B1B" },
  };
  const p = palette[tone];
  return (
    <div style={{
      background: "#fff", borderRadius: 10, padding: 12,
      border: `1px solid ${highlight ? p.color : "var(--oxford-10)"}`,
      borderLeft: `3px solid ${p.color}`,
      boxShadow: highlight ? `0 0 0 1px ${p.color}` : "none",
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--oxford)", marginTop: 2 }}>
        {value}{suffix ?? ""}
      </div>
    </div>
  );
}

/* ─── Label manager ───────────────────────────────────────────────────────── */

function LabelManagerModal({
  labels, onClose, onChange,
}: {
  labels: HomeworkLabel[];
  onClose: () => void;
  onChange: (labels: HomeworkLabel[]) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<HomeworkLabelColor>("blue");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const v = newLabel.trim();
    if (!v) return;
    setBusy(true);
    try {
      const l = await psychologistApi.homeworkLabelCreate(v, newColor);
      onChange([...labels, l]);
      setNewLabel("");
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async (l: HomeworkLabel) => {
    if (!confirm(`"${l.label}" etiketi silinsin?\n(Tapşırıqlardan da silinəcək.)`)) return;
    try {
      await psychologistApi.homeworkLabelDelete(l.id);
      onChange(labels.filter(x => x.id !== l.id));
    } catch (e) { alert((e as Error).message); }
  };

  const recolor = async (l: HomeworkLabel, color: HomeworkLabelColor) => {
    try {
      const updated = await psychologistApi.homeworkLabelUpdate(l.id, l.label, color);
      onChange(labels.map(x => x.id === l.id ? updated : x));
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(8,14,30,0.55)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, maxWidth: 520, width: "100%",
        boxShadow: "0 30px 60px rgba(0,0,0,0.25)", overflow: "hidden",
      }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--oxford-10)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Etiketləri idarə et</h3>
        </div>

        <div style={{ padding: 22, maxHeight: "60vh", overflow: "auto" }}>
          <div style={{ marginBottom: 16 }}>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") create(); }}
              placeholder="Yeni etiket adı"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--oxford-10)", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {LABEL_COLOR_LIST.map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: 8, cursor: "pointer",
                    border: `2px solid ${newColor === c ? "var(--oxford)" : "transparent"}`,
                    background: labelColors(c).fg,
                  }}
                  title={c} />
              ))}
            </div>
            <button onClick={create} disabled={busy || !newLabel.trim()}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: busy || !newLabel.trim() ? "not-allowed" : "pointer", opacity: !newLabel.trim() ? 0.6 : 1,
              }}>+ Yarat</button>
          </div>

          {labels.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--oxford-60)", textAlign: "center", padding: "12px 0" }}>
              Hələ etiket yoxdur
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {labels.map(l => {
                const c = labelColors(l.color);
                return (
                  <div key={l.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 10,
                    background: c.bg, border: `1px solid ${c.border}`,
                  }}>
                    <span style={{ fontSize: 13, color: c.fg, fontWeight: 700, flex: 1 }}>{l.label}</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {LABEL_COLOR_LIST.map(col => (
                        <button key={col} onClick={() => recolor(l, col)}
                          style={{
                            width: 16, height: 16, borderRadius: 4, cursor: "pointer",
                            border: `2px solid ${l.color === col ? "var(--oxford)" : "transparent"}`,
                            background: labelColors(col).fg,
                          }} title={col} />
                      ))}
                    </div>
                    <button onClick={() => remove(l)}
                      style={{ background: "transparent", border: "none", color: c.fg, cursor: "pointer", fontSize: 18, padding: 0, lineHeight: 1, opacity: 0.7 }}>×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 22px", borderTop: "1px solid var(--oxford-10)", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--oxford-10)", background: "#fff", fontSize: 13, cursor: "pointer" }}>Bağla</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Buttons + icons ─────────────────────────────────────────────────────── */

function primaryBtn(): React.CSSProperties {
  return {
    padding: "9px 16px", borderRadius: 10, border: "none",
    background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
  };
}
function ghostBtn(): React.CSSProperties {
  return {
    padding: "9px 14px", borderRadius: 10,
    border: "1px solid var(--brand-200)", background: "#fff",
    color: "var(--brand-700)", fontWeight: 600, fontSize: 13, cursor: "pointer",
  };
}

const sw = {
  width: 12, height: 12, fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};
function PaperclipIcon() {
  return (
    <svg {...sw}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
function CommentIcon() {
  return (<svg {...sw}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>);
}
