"use client";

import { useEffect, useMemo, useState } from "react";
import { patientApi, type Homework, type HomeworkPriority, type HomeworkStatus } from "@/lib/api";
import HomeworkDetailModal from "@/components/HomeworkDetailModal";
import HomeworkLabelChip from "@/components/HomeworkLabelChip";
import { useT } from "@/lib/i18n/LocaleProvider";

const COLUMNS: { status: HomeworkStatus; label: string; tone: string; hint: string }[] = [
  { status: "PENDING",     label: "Gözləyir",   tone: "#F59E0B", hint: "Hələ başlamadıqların" },
  { status: "IN_PROGRESS", label: "Davam edir", tone: "#3B82F6", hint: "Üzərində işlədiklərin" },
  { status: "COMPLETED",   label: "Tamamlandı", tone: "#10B981", hint: "Bitirdiklərin" },
];

const PRIORITY_COLOR: Record<HomeworkPriority, string> = {
  LOW: "#10B981", MEDIUM: "#F59E0B", HIGH: "#DC2626",
};
const PRIORITY_LABEL: Record<HomeworkPriority, string> = {
  LOW: "Aşağı", MEDIUM: "Orta", HIGH: "Yüksək",
};

const DRAG_MIME = "application/x-fanus-homework";

const PAGE_SIZE = 30;

function isOverdue(h: Homework): boolean {
  if (h.status === "COMPLETED" || !h.dueDate) return false;
  return new Date(h.dueDate + "T23:59:59").getTime() < Date.now();
}

export default function PatientHomeworkPage() {
  const { t } = useT();
  const [items, setItems] = useState<Homework[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<HomeworkStatus | null>(null);

  const load = () => {
    setLoading(true);
    patientApi.homeworkPaged({ page: 0, size: PAGE_SIZE })
      .then(res => {
        setItems(res.content);
        setTotalElements(res.totalElements);
        setPage(0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const loadMore = () => {
    setLoadingMore(true);
    patientApi.homeworkPaged({ page: page + 1, size: PAGE_SIZE })
      .then(res => {
        setItems(prev => [...prev, ...res.content]);
        setTotalElements(res.totalElements);
        setPage(res.page);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const hasMore = items.length < totalElements;

  const updateOne = (h: Homework) => setItems(prev => prev.map(x => x.id === h.id ? h : x));

  const byStatus = useMemo(() => {
    const map: Record<HomeworkStatus, Homework[]> = { PENDING: [], IN_PROGRESS: [], COMPLETED: [] };
    for (const h of items) {
      if (!map[h.status]) continue;
      map[h.status].push(h);
    }
    Object.values(map).forEach(list => list.sort((a, b) => a.position - b.position));
    return map;
  }, [items]);

  const onDragStart = (id: number, e: React.DragEvent) => {
    setDraggingId(id);
    e.dataTransfer.setData(DRAG_MIME, String(id));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragEnd = () => { setDraggingId(null); setDragOver(null); };

  const onColDragOver = (status: HomeworkStatus, e: React.DragEvent) => {
    if (draggingId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(status);
  };

  const onColDrop = async (status: HomeworkStatus, e: React.DragEvent) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData(DRAG_MIME) || String(draggingId ?? "");
    const id = Number(idStr);
    setDraggingId(null); setDragOver(null);
    if (!id) return;
    const card = items.find(x => x.id === id);
    if (!card) return;
    // Drop at end of target column.
    const targetIndex = byStatus[status].filter(c => c.id !== id).length;
    try {
      const updated = await patientApi.homeworkMove(id, status, targetIndex);
      updateOne(updated);
    } catch (er) { alert((er as Error).message); }
  };

  const detail = detailId != null ? items.find(h => h.id === detailId) ?? null : null;

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)" }}>{t("staff.patHwTitle")}</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4 }}>
          Kartı tutub başqa sütuna sürükləyərək statusunu dəyişin və ya açıb şərh yazın.
        </p>
      </div>

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "var(--oxford-60)" }}>{t("common.loading")}</div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", padding: 48, borderRadius: 14, textAlign: "center" }}>
          <div style={{ fontWeight: 600, color: "var(--oxford)" }}>{t("staff.patHwEmpty")}</div>
        </div>
      ) : (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(260px, 1fr))",
            gap: 12,
          }}>
            {COLUMNS.map(col => (
              <KanbanColumn key={col.status}
                column={col}
                items={byStatus[col.status]}
                isDropTarget={dragOver === col.status}
                isDragging={draggingId !== null}
                onCardClick={id => setDetailId(id)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOver={onColDragOver}
                onDrop={onColDrop} />
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button type="button" onClick={loadMore} disabled={loadingMore}
                style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
                {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - items.length)})`}
              </button>
            </div>
          )}
        </>
      )}

      {detail && (
        <HomeworkDetailModal
          homework={detail}
          role="PATIENT"
          onClose={() => setDetailId(null)}
          onMutate={updateOne}
        />
      )}
    </div>
  );
}

function KanbanColumn({
  column, items, isDropTarget, isDragging,
  onCardClick, onDragStart, onDragEnd, onDragOver, onDrop,
}: {
  column: { status: HomeworkStatus; label: string; tone: string; hint: string };
  items: Homework[];
  isDropTarget: boolean;
  isDragging: boolean;
  onCardClick: (id: number) => void;
  onDragStart: (id: number, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (status: HomeworkStatus, e: React.DragEvent) => void;
  onDrop: (status: HomeworkStatus, e: React.DragEvent) => void;
}) {
  return (
    <div
      onDragOver={e => onDragOver(column.status, e)}
      onDrop={e => onDrop(column.status, e)}
      style={{
        background: isDropTarget ? "var(--brand-100)" : "#F3F6FB",
        borderRadius: 14, padding: 10,
        border: `1px solid ${isDropTarget ? "var(--brand)" : "var(--oxford-10)"}`,
        minHeight: 240, transition: "background 0.15s, border-color 0.15s",
      }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "4px 8px 10px", borderBottom: `2px solid ${column.tone}`,
        marginBottom: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: column.tone, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)" }}>{column.label}</div>
            <div style={{ fontSize: 10.5, color: "var(--oxford-60)", marginTop: 1 }}>{column.hint}</div>
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
          background: "#fff", color: "var(--oxford-60)", border: "1px solid var(--oxford-10)",
        }}>{items.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length === 0 ? (
          <div style={{
            padding: "20px 10px", textAlign: "center", fontSize: 12,
            color: "var(--oxford-60)", border: "1px dashed var(--oxford-10)",
            borderRadius: 10, background: "#fff",
          }}>
            {isDragging ? "Buraya buraxın" : "Boşdur"}
          </div>
        ) : (
          items.map(h => (
            <KanbanCard key={h.id} h={h}
              onClick={() => onCardClick(h.id)}
              onDragStart={e => onDragStart(h.id, e)}
              onDragEnd={onDragEnd} />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  h, onClick, onDragStart, onDragEnd,
}: {
  h: Homework;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const overdue = isOverdue(h);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        background: "#fff", borderRadius: 10, padding: 12,
        boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
        border: `1px solid ${overdue ? "#FCA5A5" : "var(--oxford-10)"}`,
        borderLeft: `3px solid ${PRIORITY_COLOR[h.priority]}`,
        cursor: "grab",
        transition: "transform 0.1s, box-shadow 0.1s",
      }}
      onMouseDown={e => (e.currentTarget.style.cursor = "grabbing")}
      onMouseUp={e => (e.currentTarget.style.cursor = "grab")}
    >
      {h.labels.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
          {h.labels.map(l => (
            <HomeworkLabelChip key={l.id} label={l.label} color={l.color} size="xs" />
          ))}
        </div>
      )}
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)", lineHeight: 1.3, marginBottom: 6 }}>
        {h.title}
      </div>
      <div style={{ fontSize: 11, color: "var(--oxford-60)" }}>
        {h.psychologistName}
      </div>

      {/* Metrics strip */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginTop: 8,
        fontSize: 11, color: "var(--oxford-60)", flexWrap: "wrap",
      }}>
        <span style={{
          padding: "1px 6px", borderRadius: 4, fontWeight: 700,
          background: PRIORITY_COLOR[h.priority], color: "#fff",
        }}>{PRIORITY_LABEL[h.priority]}</span>

        {h.dueDate && (
          <span style={{
            padding: "1px 6px", borderRadius: 4, fontWeight: 600,
            background: overdue ? "#FEE2E2" : "var(--brand-50)",
            color: overdue ? "#991B1B" : "var(--brand-700)",
          }}>
            {h.dueDate}
          </span>
        )}
        {h.checklistTotal > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <CheckIcon /> {h.checklistCompleted}/{h.checklistTotal}
          </span>
        )}
        {h.attachments.length > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <PaperclipIcon /> {h.attachments.length}
          </span>
        )}
        {h.commentCount > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <CommentIcon /> {h.commentCount}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Inline SVGs ─────────────────────────────────────────────────────────── */
const sw = {
  width: 12, height: 12, fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};
function CheckIcon() { return (<svg {...sw}><polyline points="20 6 9 17 4 12" /></svg>); }
function PaperclipIcon() {
  return (
    <svg {...sw}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
function CommentIcon() { return (<svg {...sw}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>); }
