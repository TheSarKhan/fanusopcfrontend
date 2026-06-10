"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  psychologistApi,
  type ClientSummary, type Homework, type HomeworkLabel,
  type HomeworkPriority,
} from "@/lib/api";
import { labelColors } from "./HomeworkLabelChip";

const PRIORITY: Record<HomeworkPriority, { label: string; color: string; hint: string }> = {
  LOW:    { label: "Aşağı",   color: "#10B981", hint: "Vacib deyil, vaxtı çatanda" },
  MEDIUM: { label: "Orta",    color: "#F59E0B", hint: "Normal axın" },
  HIGH:   { label: "Yüksək",  color: "#DC2626", hint: "İlk növbədə diqqət edilməli" },
};

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file

function fmtBytes(n?: number | null): string {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysFromNowIso(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase();
}
function fmtDate(iso: string): string {
  const months = ["Yan","Fev","Mar","Apr","May","İyn","İyl","Avq","Sen","Okt","Noy","Dek"];
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

interface Props {
  open: boolean;
  clients: ClientSummary[];
  labels: HomeworkLabel[];
  /** Pre-select a patient (e.g. when opened from a patient workspace). */
  initialPatientId?: number | null;
  onClose: () => void;
  onCreated: (h: Homework) => void;
}

export default function HomeworkCreateModal({
  open, clients, labels, initialPatientId, onClose, onCreated,
}: Props) {
  const [patientId, setPatientId] = useState<number | null>(initialPatientId ?? null);
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<HomeworkPriority>("MEDIUM");
  const [draftChecklist, setDraftChecklist] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [draftLabelIds, setDraftLabelIds] = useState<number[]>([]);
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingStage, setSavingStage] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement | null>(null);
  const checklistInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dueInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Reset state every time the modal re-opens.
  useEffect(() => {
    if (!open) return;
    setPatientId(initialPatientId ?? null);
    setPatientPickerOpen(false);
    setPatientQuery("");
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("MEDIUM");
    setDraftChecklist([]);
    setNewChecklistItem("");
    setDraftLabelIds([]);
    setDraftFiles([]);
    setErr(null);
    setSaving(false);
    setSavingStage("");
    // Autofocus the title field a tick after the open animation.
    setTimeout(() => titleRef.current?.focus(), 80);
  }, [open, initialPatientId]);

  // Esc to close, Cmd/Ctrl+Enter to save
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patientId, title, description, dueDate, priority, draftChecklist, draftLabelIds, draftFiles]);

  const selectedPatient = useMemo(
    () => clients.find(c => c.patientId === patientId) ?? null,
    [clients, patientId]
  );

  const filteredClients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(q));
  }, [clients, patientQuery]);

  const titleValid = title.trim().length > 0;
  const patientValid = patientId != null;
  const canSave = titleValid && patientValid && !saving;

  const addDraftItem = () => {
    const v = newChecklistItem.trim();
    if (!v) return;
    setDraftChecklist(prev => [...prev, v]);
    setNewChecklistItem("");
    setTimeout(() => checklistInputRef.current?.focus(), 10);
  };

  const moveItem = (i: number, dir: -1 | 1) => {
    setDraftChecklist(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const rejected = incoming.filter(f => f.size > MAX_FILE_BYTES);
    if (rejected.length > 0) {
      setErr(`Bu fayl(lar) çox böyükdür (limit 20 MB): ${rejected.map(f => f.name).join(", ")}`);
    } else {
      setErr(null);
    }
    const accepted = incoming.filter(f => f.size <= MAX_FILE_BYTES);
    setDraftFiles(prev => {
      const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}`));
      const next = [...prev];
      for (const f of accepted) {
        if (!existingKeys.has(`${f.name}-${f.size}`)) next.push(f);
      }
      return next;
    });
  };

  const removeFile = (i: number) => {
    setDraftFiles(prev => prev.filter((_, j) => j !== i));
  };

  async function save() {
    if (!canSave) {
      if (!patientValid) setErr("Müştəri seçin");
      else if (!titleValid) setErr("Başlıq lazımdır");
      return;
    }
    setSaving(true); setErr(null); setSavingStage("");
    try {
      const created = await psychologistApi.createHomework({
        patientId: patientId!,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority,
        checklist: draftChecklist.length > 0 ? draftChecklist : undefined,
        labelIds: draftLabelIds.length > 0 ? draftLabelIds : undefined,
      });

      let withAttachments = created;
      if (draftFiles.length > 0) {
        const uploaded: typeof created.attachments = [...(created.attachments ?? [])];
        for (let i = 0; i < draftFiles.length; i++) {
          const f = draftFiles[i];
          setSavingStage(`Fayl yüklənir (${i + 1}/${draftFiles.length}) · ${f.name}`);
          try {
            const att = await psychologistApi.homeworkUploadAttachment(created.id, f);
            uploaded.push(att);
          } catch (e) {
            setErr(`"${f.name}" yüklənmədi: ${(e as Error).message}. Tapşırıq yaradıldı, sənədi sonra əlavə edə bilərsiniz.`);
          }
        }
        withAttachments = { ...created, attachments: uploaded };
      }

      onCreated(withAttachments);
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); setSavingStage(""); }
  }

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1100,
      background: "rgba(10, 22, 51, 0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "5vh 16px",
      animation: "fanus-fade-in 0.18s ease-out",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 18, maxWidth: 680, width: "100%",
        boxShadow: "0 30px 80px rgba(8, 22, 49, 0.25)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        maxHeight: "90vh",
        animation: "fanus-pop-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px 16px",
          background: "linear-gradient(135deg, var(--brand-50) 0%, #fff 70%)",
          borderBottom: "1px solid var(--oxford-10)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "var(--brand)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <IconPlus />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>
                Yeni tapşırıq
              </h2>
              <div style={{ fontSize: 11.5, color: "var(--oxford-60)", marginTop: 2 }}>
                Pasiyent öz panelindən statusu idarə edəcək
              </div>
            </div>
          </div>
          <button onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "1px solid var(--oxford-10)", background: "#fff",
              color: "var(--oxford-60)", fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }} title="Bağla (Esc)">×</button>
        </div>

        {/* Body — scrollable */}
        <div ref={scrollRef} style={{ overflow: "auto", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Patient picker */}
          <Field label="Müştəri" required>
            {selectedPatient ? (
              <button onClick={() => setPatientPickerOpen(true)}
                style={pickerBtnStyle(true)}>
                <Avatar name={selectedPatient.name} active />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--oxford)" }}>
                    {selectedPatient.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--oxford-60)" }}>Dəyişdirmək üçün klikləyin</div>
                </div>
                <span style={{ color: "var(--oxford-60)", fontSize: 14 }}>›</span>
              </button>
            ) : (
              <button onClick={() => setPatientPickerOpen(true)}
                style={pickerBtnStyle(false)}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "var(--oxford-10)", color: "var(--oxford-60)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <IconUser />
                </div>
                <div style={{ flex: 1, textAlign: "left", fontSize: 13, color: "var(--oxford-60)" }}>
                  Pasiyent seçin
                </div>
                <span style={{ color: "var(--brand)", fontSize: 14 }}>›</span>
              </button>
            )}
          </Field>

          {/* Title */}
          <Field label="Başlıq" required>
            <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Məs. Həftəsonu nəfəs məşqi"
              style={{
                width: "100%", padding: "12px 14px",
                borderRadius: 12,
                border: `1.5px solid ${titleValid ? "var(--oxford-10)" : (title.length > 0 ? "#FCA5A5" : "var(--oxford-10)")}`,
                fontSize: 15, fontWeight: 500, color: "var(--oxford)",
                outline: "none", boxSizing: "border-box",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onFocus={e => (e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16,81,183,0.15)")}
              onBlur={e => (e.currentTarget.style.boxShadow = "none")} />
          </Field>

          {/* Checklist — promoted up so the core "todo" is visible without scrolling */}
          <Field label="Alt-tapşırıqlar" hint={draftChecklist.length > 0 ? `${draftChecklist.length} bənd` : "Pasiyent ayrı-ayrılıqda işarələyəcək"}>
            <div style={{
              border: "1.5px solid var(--oxford-10)", borderRadius: 12,
              padding: 10, background: "var(--brand-50)",
            }}>
              {draftChecklist.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                  {draftChecklist.map((label, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px", borderRadius: 8,
                      background: "#fff", border: "1px solid var(--brand-100)",
                    }}>
                      <div style={{
                        display: "flex", flexDirection: "column",
                        color: "var(--oxford-60)", fontSize: 10, lineHeight: 1,
                      }}>
                        <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                          style={arrowBtn(i === 0)} title="Yuxarı">▲</button>
                        <button onClick={() => moveItem(i, 1)} disabled={i === draftChecklist.length - 1}
                          style={arrowBtn(i === draftChecklist.length - 1)} title="Aşağı">▼</button>
                      </div>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4,
                        border: "1.5px solid var(--brand-200)",
                        flexShrink: 0, background: "#fff",
                      }} />
                      <span style={{ flex: 1, fontSize: 13, color: "var(--oxford)" }}>{label}</span>
                      <button onClick={() => setDraftChecklist(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "transparent", border: "none", color: "var(--oxford-60)", cursor: "pointer", fontSize: 16, padding: 4, lineHeight: 1 }}
                        title="Sil">×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <input ref={checklistInputRef} value={newChecklistItem}
                  onChange={e => setNewChecklistItem(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDraftItem(); } }}
                  placeholder="Yeni alt-tapşırıq və Enter…"
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: 8,
                    border: "1px solid var(--brand-200)", background: "#fff",
                    fontSize: 12.5, outline: "none",
                  }} />
                <button onClick={addDraftItem} disabled={!newChecklistItem.trim()}
                  style={{
                    padding: "9px 14px", borderRadius: 8,
                    border: "none", background: "var(--brand)",
                    color: "#fff", fontSize: 12, fontWeight: 600,
                    cursor: newChecklistItem.trim() ? "pointer" : "not-allowed",
                    opacity: newChecklistItem.trim() ? 1 : 0.5,
                  }}>+ Əlavə et</button>
              </div>
            </div>
          </Field>

          {/* File attachments */}
          <Field label="Fayllar" hint={draftFiles.length > 0 ? `${draftFiles.length} fayl seçildi` : "PDF, şəkil, audio — fayl başına 20 MB"}>
            <div
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              style={{
                border: "1.5px dashed var(--brand-200)", borderRadius: 12,
                padding: 12, background: "var(--brand-50)",
              }}>
              {draftFiles.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                  {draftFiles.map((f, i) => (
                    <div key={`${f.name}-${i}`} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 8,
                      background: "#fff", border: "1px solid var(--brand-100)",
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 7,
                        background: "var(--brand-50)", color: "var(--brand-700)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <IconPaperclip />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12.5, fontWeight: 600, color: "var(--oxford)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{f.name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--oxford-60)", marginTop: 1 }}>
                          {fmtBytes(f.size)}{f.type ? ` · ${f.type}` : ""}
                        </div>
                      </div>
                      <button onClick={() => removeFile(i)}
                        style={{ background: "transparent", border: "none", color: "var(--oxford-60)", cursor: "pointer", fontSize: 16, padding: 4, lineHeight: 1 }}
                        title="Sil">×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 11.5, color: "var(--oxford-60)" }}>
                  Sürükləyib buraxın və ya
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 8,
                    border: "1.5px solid var(--brand-200)", background: "#fff",
                    color: "var(--brand-700)", fontSize: 12, fontWeight: 600,
                    cursor: "pointer",
                  }}>
                  <IconPaperclip /> Fayl seç
                </button>
                <input ref={fileInputRef} type="file" multiple
                  onChange={e => { addFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  style={{ display: "none" }} />
              </div>
            </div>
          </Field>

          {/* Meta row: priority + due date in one compact strip */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "start" }}>
            <Field label="Prioritet">
              <div style={{
                display: "inline-flex",
                padding: 3,
                borderRadius: 10,
                border: "1.5px solid var(--oxford-10)",
                background: "#fff",
                gap: 2,
              }}>
                {(["LOW", "MEDIUM", "HIGH"] as HomeworkPriority[]).map(p => {
                  const pd = PRIORITY[p];
                  const active = priority === p;
                  return (
                    <button key={p} onClick={() => setPriority(p)}
                      title={pd.hint}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "6px 12px", borderRadius: 7,
                        border: "none",
                        background: active ? `${pd.color}1a` : "transparent",
                        color: active ? pd.color : "var(--oxford-60)",
                        fontSize: 12, fontWeight: 700,
                        cursor: "pointer", transition: "all 0.15s",
                      }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: pd.color, flexShrink: 0,
                      }} />
                      {pd.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Son tarix">
              {(() => {
                const presets = [
                  { label: "Bu gün", iso: todayIso() },
                  { label: "Sabah",  iso: daysFromNowIso(1) },
                  { label: "3 gün",  iso: daysFromNowIso(3) },
                  { label: "Həftə",  iso: daysFromNowIso(7) },
                ];
                const matched = presets.find(p => p.iso === dueDate);
                const isCustom = !!dueDate && !matched;
                return (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {presets.map(opt => (
                      <QuickChip key={opt.label}
                        active={dueDate === opt.iso}
                        onClick={() => setDueDate(dueDate === opt.iso ? "" : opt.iso)}>
                        {opt.label}
                      </QuickChip>
                    ))}
                    {isCustom ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "4px 4px 4px 12px", borderRadius: 999,
                        background: "var(--brand)", color: "#fff",
                        fontSize: 11.5, fontWeight: 700,
                        border: "1.5px solid var(--brand)",
                      }}>
                        {fmtDate(dueDate)}
                        <button onClick={() => dueInputRef.current?.showPicker?.()}
                          title="Tarixi dəyişdir"
                          style={{
                            background: "rgba(255,255,255,0.18)", border: "none",
                            color: "#fff", cursor: "pointer",
                            width: 20, height: 20, borderRadius: "50%",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                          }}>
                          <IconCalendar />
                        </button>
                        <button onClick={() => setDueDate("")}
                          title="Təmizlə"
                          style={{
                            background: "rgba(255,255,255,0.18)", border: "none",
                            color: "#fff", cursor: "pointer",
                            width: 20, height: 20, borderRadius: "50%",
                            fontSize: 13, lineHeight: 1,
                          }}>×</button>
                      </span>
                    ) : (
                      <button type="button"
                        onClick={() => dueInputRef.current?.showPicker?.() ?? dueInputRef.current?.focus()}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "5px 12px", borderRadius: 999,
                          border: "1.5px dashed var(--oxford-10)",
                          background: "#fff", color: "var(--oxford-60)",
                          fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                        }}
                        title="Custom tarix seç">
                        <IconCalendar /> Başqa…
                      </button>
                    )}
                    <input ref={dueInputRef} type="date" value={dueDate} min={todayIso()}
                      onChange={e => setDueDate(e.target.value)}
                      style={{
                        position: "absolute", width: 1, height: 1,
                        opacity: 0, pointerEvents: "none",
                      }} />
                  </div>
                );
              })()}
            </Field>
          </div>

          {/* Description (kept after meta so the modal opens with task essentials visible) */}
          <Field label="Təsvir" hint="İstəyə bağlı təlimat və ya kontekst">
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Pasiyent nə etməlidir, hansı qayda ilə?"
              style={{
                width: "100%", padding: "10px 14px",
                borderRadius: 12, border: "1.5px solid var(--oxford-10)",
                fontSize: 13, color: "var(--oxford)", lineHeight: 1.5,
                outline: "none", boxSizing: "border-box", resize: "vertical",
                fontFamily: "inherit", minHeight: 64,
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onFocus={e => (e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16,81,183,0.15)")}
              onBlur={e => (e.currentTarget.style.boxShadow = "none")} />
          </Field>

          {/* Labels */}
          {labels.length > 0 && (
            <Field label="Etiketlər" hint="Tapşırığı kateqoriyalaşdırın (məcburi deyil)">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {labels.map(l => {
                  const active = draftLabelIds.includes(l.id);
                  const c = labelColors(l.color);
                  return (
                    <button key={l.id}
                      onClick={() => setDraftLabelIds(prev =>
                        prev.includes(l.id) ? prev.filter(x => x !== l.id) : [...prev, l.id])}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "5px 12px", borderRadius: 999,
                        background: active ? c.fg : c.bg,
                        color: active ? "#fff" : c.fg,
                        border: `1.5px solid ${active ? c.fg : c.border}`,
                        fontSize: 11.5, fontWeight: 600,
                        cursor: "pointer", transition: "all 0.15s",
                      }}>
                      {active && <IconCheck color="#fff" size={10} />}
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {err && (
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B",
              fontSize: 12.5, fontWeight: 500,
            }}>{err}</div>
          )}
        </div>

        {/* Sticky footer */}
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid var(--oxford-10)",
          background: "#fff",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
        }}>
          <div style={{ fontSize: 11, color: "var(--oxford-60)" }}>
            <kbd style={kbd}>Esc</kbd> bağla · <kbd style={kbd}>⌘</kbd>+<kbd style={kbd}>Enter</kbd> saxla
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose}
              style={{
                padding: "10px 18px", borderRadius: 10,
                border: "1px solid var(--oxford-10)", background: "#fff",
                color: "var(--oxford)", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Ləğv</button>
            <button onClick={save} disabled={!canSave}
              style={{
                padding: "10px 22px", borderRadius: 10,
                border: "none",
                background: canSave ? "var(--brand)" : "var(--oxford-10)",
                color: canSave ? "#fff" : "var(--oxford-60)",
                fontSize: 13, fontWeight: 700,
                cursor: canSave ? "pointer" : "not-allowed",
                boxShadow: canSave ? "0 4px 14px rgba(16,81,183,0.25)" : "none",
                transition: "background 0.15s, transform 0.1s",
              }}
              onMouseDown={e => canSave && (e.currentTarget.style.transform = "translateY(1px)")}
              onMouseUp={e => (e.currentTarget.style.transform = "translateY(0)")}>
              {saving ? (savingStage || "Saxlanılır…") : "Tapşırığı yarat"}
            </button>
          </div>
        </div>
      </div>

      {/* Patient picker sub-dialog */}
      {patientPickerOpen && (
        <div onClick={() => setPatientPickerOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 1200,
          background: "rgba(10, 22, 51, 0.5)", backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 14, maxWidth: 440, width: "100%",
            boxShadow: "0 20px 50px rgba(0,0,0,0.2)", overflow: "hidden",
            maxHeight: "80vh", display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--oxford-10)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)", margin: 0, marginBottom: 8 }}>
                Pasiyent seçin
              </h3>
              <input value={patientQuery} onChange={e => setPatientQuery(e.target.value)}
                autoFocus placeholder="Axtar…"
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 8,
                  border: "1px solid var(--oxford-10)", fontSize: 13,
                  outline: "none", boxSizing: "border-box",
                }} />
            </div>
            <div style={{ overflow: "auto", padding: 8 }}>
              {filteredClients.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--oxford-60)", fontSize: 12 }}>
                  Pasiyent tapılmadı
                </div>
              ) : (
                filteredClients.map(c => (
                  <button key={c.patientId}
                    onClick={() => { setPatientId(c.patientId); setPatientPickerOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 8,
                      background: patientId === c.patientId ? "var(--brand-50)" : "transparent",
                      border: "1px solid transparent",
                      cursor: "pointer", width: "100%", textAlign: "left",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => patientId !== c.patientId && (e.currentTarget.style.background = "var(--brand-50)")}
                    onMouseLeave={e => patientId !== c.patientId && (e.currentTarget.style.background = "transparent")}>
                    <Avatar name={c.name} active={patientId === c.patientId} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name}
                      </div>
                      {c.email && (
                        <div style={{ fontSize: 11, color: "var(--oxford-60)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.email}
                        </div>
                      )}
                    </div>
                    {patientId === c.patientId && <IconCheck color="var(--brand)" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fanus-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fanus-pop-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ─── Building blocks ─────────────────────────────────────────────────────── */

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--oxford)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}{required && <span style={{ color: "#DC2626", marginLeft: 4 }}>*</span>}
        </label>
        {hint && <span style={{ fontSize: 10.5, color: "var(--oxford-60)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function QuickChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{
        padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
        border: `1.5px solid ${active ? "var(--brand)" : "var(--oxford-10)"}`,
        background: active ? "var(--brand)" : "#fff",
        color: active ? "#fff" : "var(--oxford-60)",
        cursor: "pointer", transition: "all 0.15s",
      }}>{children}</button>
  );
}

function Avatar({ name, active }: { name: string; active: boolean }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
      background: active ? "var(--brand)" : "var(--brand-50)",
      color: active ? "#fff" : "var(--brand-700)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700,
      border: `1.5px solid ${active ? "var(--brand)" : "var(--brand-100)"}`,
    }}>{initials(name)}</div>
  );
}

function pickerBtnStyle(filled: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 14px", borderRadius: 12,
    background: filled ? "var(--brand-50)" : "#fff",
    border: `1.5px solid ${filled ? "var(--brand-200)" : "var(--oxford-10)"}`,
    width: "100%", cursor: "pointer",
    transition: "all 0.15s",
  };
}

function arrowBtn(disabled: boolean): React.CSSProperties {
  return {
    background: "transparent", border: "none",
    color: "var(--oxford-60)", fontSize: 9, padding: "0 2px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.3 : 1, lineHeight: 1.2,
  };
}

const kbd: React.CSSProperties = {
  display: "inline-block", padding: "1px 5px",
  background: "var(--oxford-10)", color: "var(--oxford)",
  borderRadius: 4, fontSize: 10, fontFamily: "ui-monospace, monospace",
  fontWeight: 600, marginRight: 1,
};

/* ─── Icons ───────────────────────────────────────────────────────────────── */

const sw = {
  fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

function IconPlus() {
  return (<svg width="18" height="18" {...sw}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
}
function IconUser() {
  return (
    <svg width="18" height="18" {...sw}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="12" height="12" {...sw}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconPaperclip() {
  return (
    <svg width="14" height="14" {...sw}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
function IconCheck({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
