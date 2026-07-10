"use client";

import { useEffect, useRef, useState } from "react";
import {
  psychologistApi, patientApi,
  type Homework, type HomeworkActivity, type HomeworkAttachment,
  type HomeworkChecklistItem, type HomeworkComment, type HomeworkLabel,
  type HomeworkLabelColor, type HomeworkPriority,
} from "@/lib/api";
import HomeworkLabelChip, { labelColors } from "./HomeworkLabelChip";
import { azFormatDate, azFormatDateTime } from "@/lib/datetime";

type Role = "PSYCHOLOGIST" | "PATIENT";

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  return azFormatDateTime(iso);
}

const ACTION_LABEL: Record<string, string> = {
  CREATED: "yaratdı",
  EDITED: "redaktə etdi",
  MOVED: "köçürdü",
  PRIORITY_CHANGED: "prioritetini dəyişdi",
  ITEM_ADDED: "alt-tapşırıq əlavə etdi",
  ITEM_DONE: "alt-tapşırığı işarələdi",
  ITEM_REOPENED: "alt-tapşırığı yenidən açdı",
  ATTACHMENT_ADDED: "fayl əlavə etdi",
  COMMENTED: "şərh yazdı",
  LABEL_ADDED: "etiket əlavə etdi",
  MARKED: "statusu dəyişdi",
};

interface Props {
  homework: Homework;
  role: Role;
  /** psychologist's label palette — only used in PSYCHOLOGIST mode. */
  availableLabels?: HomeworkLabel[];
  onClose: () => void;
  onMutate: (h: Homework) => void;
  onDelete?: () => void;
}

/** Full-screen detail panel for a single homework card. Used from both psy
 *  kanban and the patient list. */
export default function HomeworkDetailModal({
  homework, role, availableLabels = [], onClose, onMutate, onDelete,
}: Props) {
  const api = role === "PSYCHOLOGIST" ? psychologistApi : patientApi;
  const [comments, setComments] = useState<HomeworkComment[]>([]);
  const [activity, setActivity] = useState<HomeworkActivity[]>([]);
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [commentBody, setCommentBody] = useState("");
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    api.homeworkComments(homework.id).then(setComments).catch(() => setComments([]));
    api.homeworkActivity(homework.id).then(setActivity).catch(() => setActivity([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homework.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleItem = async (item: HomeworkChecklistItem) => {
    try {
      const updated = await api.homeworkToggleItem(homework.id, item.id, !item.completed);
      const list = homework.checklist.map(i => i.id === item.id ? updated : i);
      onMutate({ ...homework, checklist: list, checklistCompleted: list.filter(i => i.completed).length });
    } catch (e) { alert((e as Error).message); }
  };

  const addItem = async () => {
    const v = newItem.trim();
    if (!v) return;
    setBusy(true);
    try {
      const item = await api.homeworkAddItem(homework.id, v);
      onMutate({ ...homework, checklist: [...homework.checklist, item], checklistTotal: homework.checklistTotal + 1 });
      setNewItem("");
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };

  const deleteItem = async (item: HomeworkChecklistItem) => {
    if (role !== "PSYCHOLOGIST") return;
    if (!confirm(`"${item.label}" silinsin?`)) return;
    try {
      await psychologistApi.homeworkDeleteItem(homework.id, item.id);
      const list = homework.checklist.filter(i => i.id !== item.id);
      onMutate({
        ...homework, checklist: list,
        checklistTotal: homework.checklistTotal - 1,
        checklistCompleted: list.filter(i => i.completed).length,
      });
    } catch (e) { alert((e as Error).message); }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) { alert("Maksimum 30 MB"); return; }
    setBusy(true);
    try {
      const att = await api.homeworkUploadAttachment(homework.id, file);
      onMutate({ ...homework, attachments: [att, ...homework.attachments] });
    } catch (er) { alert((er as Error).message); }
    finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteAttachment = async (att: HomeworkAttachment) => {
    if (!confirm(`"${att.fileName}" silinsin?`)) return;
    try {
      await api.homeworkDeleteAttachment(homework.id, att.id);
      onMutate({ ...homework, attachments: homework.attachments.filter(a => a.id !== att.id) });
    } catch (e) { alert((e as Error).message); }
  };

  const submitComment = async () => {
    const v = commentBody.trim();
    if (!v) return;
    setBusy(true);
    try {
      const c = await api.homeworkAddComment(homework.id, v);
      setComments(prev => [...prev, c]);
      setCommentBody("");
      onMutate({ ...homework, commentCount: homework.commentCount + 1 });
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };

  const removeComment = async (c: HomeworkComment) => {
    if (!confirm("Şərh silinsin?")) return;
    try {
      await api.homeworkDeleteComment(homework.id, c.id);
      setComments(prev => prev.filter(x => x.id !== c.id));
      onMutate({ ...homework, commentCount: Math.max(0, homework.commentCount - 1) });
    } catch (e) { alert((e as Error).message); }
  };

  const setPriority = async (p: HomeworkPriority) => {
    if (role !== "PSYCHOLOGIST") return;
    try {
      const updated = await psychologistApi.homeworkSetPriority(homework.id, p);
      onMutate(updated);
    } catch (e) { alert((e as Error).message); }
  };

  const toggleLabel = async (l: HomeworkLabel) => {
    if (role !== "PSYCHOLOGIST") return;
    const has = homework.labels.some(x => x.id === l.id);
    try {
      const updated = has
        ? await psychologistApi.homeworkDetachLabel(homework.id, l.id)
        : await psychologistApi.homeworkAttachLabel(homework.id, l.id);
      onMutate(updated);
    } catch (e) { alert((e as Error).message); }
  };

  const progress = homework.checklistTotal > 0
    ? Math.round((homework.checklistCompleted / homework.checklistTotal) * 100)
    : 0;

  return (
    <div onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(8, 14, 30, 0.55)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "5vh 20px", overflow: "auto",
      }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16,
        maxWidth: 880, width: "100%",
        boxShadow: "0 30px 60px rgba(0,0,0,0.25)", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 22px", borderBottom: "1px solid var(--oxford-10)",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              {homework.labels.map(l => (
                <HomeworkLabelChip key={l.id} label={l.label} color={l.color} />
              ))}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>
              {homework.title}
            </h2>
            <div style={{ fontSize: 11, color: "var(--oxford-60)", marginTop: 4 }}>
              {homework.patientName} · {formatDateTime(homework.createdAt)}
              {homework.dueDate && <> · son tarix: {azFormatDate(homework.dueDate)}</>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {role === "PSYCHOLOGIST" && onDelete && (
              <button onClick={onDelete} style={{ ...iconBtn("#991B1B", "#FEE2E2"), display: "inline-flex", alignItems: "center", gap: 5 }} title="Tapşırığı sil">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                </svg>
                Sil
              </button>
            )}
            <button onClick={onClose} style={iconBtn("var(--oxford-60)", "var(--oxford-10)")}>Bağla</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 0, flex: 1, minHeight: 0 }}>
          {/* Left column */}
          <div style={{ padding: 22, overflow: "auto", maxHeight: "70vh" }}>
            {homework.description && (
              <div style={{ fontSize: 13, color: "var(--oxford)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 16 }}>
                {homework.description}
              </div>
            )}

            {/* Checklist */}
            <Section title={`Alt-tapşırıqlar${homework.checklistTotal > 0 ? ` (${homework.checklistCompleted}/${homework.checklistTotal})` : ""}`}>
              {homework.checklistTotal > 0 && (
                <div style={{ height: 4, background: "var(--brand-50)", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: "var(--brand)", transition: "width 0.2s" }} />
                </div>
              )}
              {homework.checklist.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                  {homework.checklist.map(item => (
                    <label key={item.id} style={{
                      display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                      padding: "8px 12px", borderRadius: 8,
                      background: item.completed ? "#F0FDF4" : "var(--brand-50)",
                      border: `1px solid ${item.completed ? "#BBF7D0" : "var(--brand-100)"}`,
                    }}>
                      <input type="checkbox" checked={item.completed}
                        onChange={() => toggleItem(item)}
                        style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--brand)" }} />
                      <span style={{
                        flex: 1, fontSize: 13,
                        color: item.completed ? "var(--oxford-60)" : "var(--oxford)",
                        textDecoration: item.completed ? "line-through" : "none",
                      }}>{item.label}</span>
                      {role === "PSYCHOLOGIST" && (
                        <button onClick={(e) => { e.preventDefault(); deleteItem(item); }}
                          style={{ background: "transparent", border: "none", color: "var(--oxford-40,#9EAFC2)", cursor: "pointer", padding: "2px 4px", lineHeight: 1, display: "inline-flex", alignItems: "center", borderRadius: 4 }}
                          title="Alt-tapşırığı sil">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      )}
                    </label>
                  ))}
                </div>
              )}
              {role !== "PATIENT" && (
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={newItem} onChange={e => setNewItem(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                    placeholder="Yeni alt-tapşırıq…"
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--oxford-10)", fontSize: 12.5 }} />
                  <button onClick={addItem} disabled={busy || !newItem.trim()}
                    style={smallBtn(!newItem.trim())}>+ Əlavə et</button>
                </div>
              )}
            </Section>

            {/* Attachments */}
            <Section title={`Fayllar${homework.attachments.length > 0 ? ` (${homework.attachments.length})` : ""}`}
              right={
                <label style={{
                  cursor: busy ? "wait" : "pointer", fontSize: 12, fontWeight: 600,
                  color: "var(--brand-700)", padding: "4px 10px", borderRadius: 6,
                  background: "var(--brand-50)", border: "1px solid var(--brand-100)",
                }}>
                  <input ref={fileRef} type="file" onChange={onPickFile} disabled={busy}
                    style={{ display: "none" }} />
                  {busy ? "Yüklənir…" : "+ Fayl yüklə"}
                </label>
              }>
              {homework.attachments.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--oxford-60)" }}>Heç bir fayl yoxdur</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {homework.attachments.map(att => {
                    const canDelete = role === "PSYCHOLOGIST" || att.uploadedByRole === "PATIENT";
                    return (
                      <div key={att.id} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                        borderRadius: 8, background: "var(--brand-50)", border: "1px solid var(--brand-100)",
                      }}>
                        <FileIcon contentType={att.contentType} />
                        <a href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, fontSize: 12.5, color: "var(--oxford)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {att.fileName}
                        </a>
                        <span style={{ fontSize: 10, color: "var(--oxford-60)" }}>
                          {att.uploadedByRole === role ? "Siz" : (att.uploadedByRole === "PSYCHOLOGIST" ? "Psixoloq" : "Pasiyent")} · {formatFileSize(att.fileSize)}
                        </span>
                        {canDelete && (
                          <button onClick={() => deleteAttachment(att)}
                            style={{ background: "transparent", border: "none", color: "var(--oxford-40,#9EAFC2)", cursor: "pointer", padding: "2px 4px", lineHeight: 1, display: "inline-flex", alignItems: "center", borderRadius: 4 }}
                            title="Faylı sil">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Tabs: comments / activity */}
            <div style={{ marginTop: 18, borderTop: "1px solid var(--oxford-10)", paddingTop: 16 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                <TabBtn active={tab === "comments"} onClick={() => setTab("comments")}>
                  Şərhlər ({comments.length})
                </TabBtn>
                <TabBtn active={tab === "activity"} onClick={() => setTab("activity")}>
                  Aktivlik
                </TabBtn>
              </div>

              {tab === "comments" ? (
                <>
                  {comments.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--oxford-60)", marginBottom: 10 }}>Hələ şərh yoxdur</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                      {comments.map(c => (
                        <div key={c.id} style={{
                          padding: "10px 12px",
                          background: c.authorRole === role ? "var(--brand-50)" : "#fff",
                          border: `1px solid ${c.authorRole === role ? "var(--brand-100)" : "var(--oxford-10)"}`,
                          borderRadius: 10,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-700)" }}>
                              {c.authorName ?? (c.authorRole === "PSYCHOLOGIST" ? "Psixoloq" : "Pasiyent")}
                            </span>
                            <span style={{ fontSize: 10, color: "var(--oxford-60)" }}>{formatDateTime(c.createdAt)}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "var(--oxford)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                            {c.body}
                          </div>
                          {(role === "PSYCHOLOGIST" || c.authorRole === role) && (
                            <button onClick={() => removeComment(c)}
                              style={{ background: "transparent", border: "none", color: "var(--oxford-60)", cursor: "pointer", fontSize: 11, padding: 0, marginTop: 4 }}>
                              Sil
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <textarea rows={2} value={commentBody}
                      onChange={e => setCommentBody(e.target.value)}
                      placeholder="Şərh yazın…"
                      style={{
                        width: "100%", padding: 10, borderRadius: 10,
                        border: "1px solid var(--oxford-10)", fontSize: 13,
                        fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
                      }} />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                      <button onClick={submitComment} disabled={busy || !commentBody.trim()}
                        style={{
                          padding: "8px 18px", borderRadius: 8, border: "none",
                          background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 600,
                          cursor: busy || !commentBody.trim() ? "not-allowed" : "pointer",
                          opacity: !commentBody.trim() ? 0.6 : 1,
                        }}>
                        Göndər
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {activity.length === 0 && <div style={{ fontSize: 12, color: "var(--oxford-60)" }}>Aktivlik yoxdur</div>}
                  {activity.map(a => (
                    <div key={a.id} style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "6px 0", borderBottom: "1px solid var(--oxford-10)",
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%", marginTop: 6,
                        background: "var(--brand)",
                      }} />
                      <div style={{ flex: 1, fontSize: 12, color: "var(--oxford-60)" }}>
                        <span style={{ fontWeight: 600, color: "var(--oxford)" }}>
                          {a.actorName ?? (a.actorRole === "PSYCHOLOGIST" ? "Psixoloq" : "Pasiyent")}
                        </span>
                        {" "}
                        {ACTION_LABEL[a.action] ?? a.action.toLowerCase()}
                        {a.meta && <span style={{ color: "var(--oxford-80)" }}>{` — ${a.meta}`}</span>}
                        <div style={{ fontSize: 10, color: "var(--oxford-60)", marginTop: 2 }}>{formatDateTime(a.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column — meta sidebar */}
          <div style={{
            background: "var(--brand-50)",
            padding: 22,
            borderLeft: "1px solid var(--oxford-10)",
            display: "flex", flexDirection: "column", gap: 14,
            overflow: "auto", maxHeight: "70vh",
          }}>
            <MetaBlock title="Status">
              <span style={{
                display: "inline-flex", padding: "4px 10px", borderRadius: 999,
                fontSize: 12, fontWeight: 700,
                background: homework.status === "COMPLETED" ? "#D1FAE5" : homework.status === "IN_PROGRESS" ? "#DBEAFE" : "#FEF3C7",
                color: homework.status === "COMPLETED" ? "#065F46" : homework.status === "IN_PROGRESS" ? "#1E40AF" : "#92400E",
              }}>
                {homework.status === "COMPLETED" ? "Tamamlandı" : homework.status === "IN_PROGRESS" ? "Davam edir" : "Gözləyir"}
              </span>
              {role === "PATIENT" && homework.status !== "COMPLETED" && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--oxford-60)" }}>
                  Pasiyent panelində kartı sütunlar arası (Gözləyir → Davam edir → Tamamlandı) sürükləyərək statusu dəyişə bilərsiniz
                </div>
              )}
            </MetaBlock>

            <MetaBlock title="Prioritet">
              {role === "PSYCHOLOGIST" ? (
                <div style={{ display: "flex", gap: 6 }}>
                  {(["LOW", "MEDIUM", "HIGH"] as HomeworkPriority[]).map(p => (
                    <button key={p} onClick={() => setPriority(p)}
                      style={{
                        flex: 1, padding: "6px 0", borderRadius: 6,
                        border: `1px solid ${PRIORITY_COLOR[p]}`,
                        background: homework.priority === p ? PRIORITY_COLOR[p] : "#fff",
                        color: homework.priority === p ? "#fff" : PRIORITY_COLOR[p],
                        fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}>
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              ) : (
                <span style={{
                  display: "inline-flex", padding: "4px 10px", borderRadius: 999,
                  fontSize: 12, fontWeight: 700,
                  background: PRIORITY_COLOR[homework.priority],
                  color: "#fff",
                }}>{PRIORITY_LABEL[homework.priority]}</span>
              )}
            </MetaBlock>

            <MetaBlock title="Etiketlər">
              {homework.labels.length === 0 && (
                <div style={{ fontSize: 11, color: "var(--oxford-60)", marginBottom: 6 }}>Heç bir etiket yoxdur</div>
              )}
              {role === "PSYCHOLOGIST" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {availableLabels.length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--oxford-60)" }}>
                      Etiket paletiniz boşdur. Tapşırıqlar səhifəsindən etiket yaradın.
                    </div>
                  ) : (
                    availableLabels.map(l => {
                      const active = homework.labels.some(x => x.id === l.id);
                      const c = labelColors(l.color);
                      return (
                        <button key={l.id} onClick={() => toggleLabel(l)}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "6px 10px", borderRadius: 8,
                            background: c.bg, border: `1px solid ${active ? c.fg : c.border}`,
                            color: c.fg, fontSize: 12, fontWeight: 600,
                            cursor: "pointer", textAlign: "left",
                          }}>
                          <span style={{
                            width: 14, height: 14, borderRadius: 3,
                            background: active ? c.fg : "transparent",
                            border: `1.5px solid ${c.fg}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: 10,
                          }}>{active ? "✓" : ""}</span>
                          {l.label}
                        </button>
                      );
                    })
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {homework.labels.map(l => (
                    <HomeworkLabelChip key={l.id} label={l.label} color={l.color} />
                  ))}
                </div>
              )}
            </MetaBlock>

            <MetaBlock title="Müştəri">
              <div style={{ fontSize: 13, color: "var(--oxford)", fontWeight: 600 }}>{homework.patientName}</div>
            </MetaBlock>

            {homework.completionNote && (
              <MetaBlock title="Müştəri qeydi">
                <div style={{ fontSize: 12, color: "var(--oxford)", whiteSpace: "pre-wrap" }}>{homework.completionNote}</div>
              </MetaBlock>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const PRIORITY_COLOR: Record<HomeworkPriority, string> = {
  LOW: "#10B981", MEDIUM: "#F59E0B", HIGH: "#DC2626",
};
const PRIORITY_LABEL: Record<HomeworkPriority, string> = {
  LOW: "Aşağı", MEDIUM: "Orta", HIGH: "Yüksək",
};

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--oxford)", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function MetaBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{
        padding: "6px 12px", borderRadius: 8,
        border: active ? "1px solid var(--brand)" : "1px solid var(--oxford-10)",
        background: active ? "var(--brand-50)" : "#fff",
        color: active ? "var(--brand-700)" : "var(--oxford-60)",
        fontSize: 12, fontWeight: 600, cursor: "pointer",
      }}>{children}</button>
  );
}

function smallBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 8,
    border: "1px solid var(--brand-200)", background: "var(--brand-50)",
    color: "var(--brand-700)", fontSize: 12, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
  };
}

function iconBtn(fg: string, bg: string): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 8,
    border: "1px solid transparent", background: bg,
    color: fg, fontSize: 12, fontWeight: 600, cursor: "pointer",
  };
}

function FileIcon({ contentType }: { contentType?: string | null }) {
  const isImg = contentType?.startsWith("image/");
  const isVid = contentType?.startsWith("video/");
  const isAud = contentType?.startsWith("audio/");
  const label = isImg ? "IMG" : isVid ? "VID" : isAud ? "AUD" : "DOC";
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 6,
      background: "#fff", border: "1px solid var(--brand-100)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 9, fontWeight: 800, color: "var(--brand-700)",
    }}>{label}</div>
  );
}
