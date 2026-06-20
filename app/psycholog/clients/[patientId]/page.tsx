"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  psychologistApi,
  type AppointmentDetail,
  type ClientNote,
  type ClientSummary,
  type CrisisCheckIn,
  type FollowupTemplate,
  type PatientGoal,
  type PatientGoalPayload,
  type PatientGoalStatus,
  type PatientTag,
  type PatientTagColor,
} from "@/lib/api";
import { FEATURE_GOALS } from "@/lib/features";
import { toast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";

const TAG_COLORS: { value: PatientTagColor; label: string; swatch: string }[] = [
  { value: "brand",   label: "Mavi",     swatch: "var(--brand)" },
  { value: "good",    label: "Yaşıl",    swatch: "#10B981" },
  { value: "warn",    label: "Sarı",     swatch: "#F59E0B" },
  { value: "danger",  label: "Qırmızı",  swatch: "#EF4444" },
  { value: "neutral", label: "Boz",      swatch: "#6B7280" },
  { value: "purple",  label: "Bənövşəyi", swatch: "#8B5CF6" },
  { value: "teal",    label: "Firuzəyi",  swatch: "#14B8A6" },
];

const TAG_PRESETS = [
  "Yüksək risk", "Aşağı risk",
  "Anksiyete", "Depressiya", "Travma", "Münasibətlər",
  "İlk müraciət", "Uzun müddətli",
  "Daimi müştəri", "VIP",
];

const MONTHS_AZ = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtTime(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${fmtTime(d)}`;
}
function fmtShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad2(d.getDate())} ${MONTHS_AZ[d.getMonth()]} ${d.getFullYear()}`;
}
function daysBetween(iso?: string | null) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

const STATUS: Record<string, { label: string; color: string; bg: string; accent: string }> = {
  PENDING:               { label: "Yeni",          color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  ASSIGNED:              { label: "Təyin edilib",  color: "var(--brand-700)", bg: "var(--brand-50)", accent: "var(--brand)" },
  CONFIRMED:             { label: "Təsdiqli",      color: "#065F46",          bg: "#D1FAE5",         accent: "#10B981" },
  AWAITING_CONFIRMATION: { label: "Təsdiq gözl.",  color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  DISPUTED:              { label: "Mübahisəli",    color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  COMPLETED:             { label: "Tamamlandı",    color: "#374151",          bg: "#F3F4F6",         accent: "#9CA3AF" },
  CANCELLED:             { label: "Ləğv",          color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  REJECTED:              { label: "Rədd",          color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
};

const FLAG_META: Record<string, { label: string; tone: string }> = {
  HIGH_NO_SHOW:     { label: "Yüksək no-show",      tone: "danger" },
  HIGH_LATE_CANCEL: { label: "Yüksək geç ləğv",      tone: "warn" },
  HIGH_REJECT:      { label: "Çox rədd alıb",        tone: "warn" },
  MANUAL:           { label: "Manual işarə",         tone: "warn" },
};

const NOTE_TEMPLATES: { key: string; label: string; title: string; body: string }[] = [
  {
    key: "intake",
    label: "İlk qiymətləndirmə",
    title: "İlk qiymətləndirmə",
    body:
      "Müraciət səbəbi:\n\nSimptomların başlanğıcı və müddəti:\n\nÖnəmli həyat hadisələri:\n\nDəstək sistemi (ailə / dost):\n\nƏvvəlki terapiya təcrübəsi:\n\nİlk təəssürat və hipotez:\n\nRazılaşdırılmış hədəflər:",
  },
  {
    key: "progress",
    label: "Progress note",
    title: "Seans qeydi",
    body:
      "Hal-hazırkı vəziyyət:\n\nBu seansda işlənən mövzu:\n\nİstifadə olunan texnika:\n\nMüştəri reaksiyası / inkişaf:\n\nEv tapşırığı:\n\nNövbəti seans üçün plan:",
  },
  {
    key: "closure",
    label: "Sonlanma notu",
    title: "Terapiya sonlanması",
    body:
      "Ümumi nəticə və qazanımlar:\n\nQalan risklər / diqqət olunmalı sahələr:\n\nMüştərinin öz qiymətləndirməsi:\n\nGələcək tövsiyələr:\n\nİstinad üçün resurslar:",
  },
];

const REASON_LABELS: Record<string, string> = {
  PATIENT_BUSY: "Məşğul oldu",
  PATIENT_HEALTH: "Xəstələndi",
  PATIENT_FORGOT: "Unutdu",
  PATIENT_NOT_NEEDED: "Lazım deyildi",
  PATIENT_TECHNICAL: "Texniki problem",
  PATIENT_TIME_CONFLICT: "Vaxt uyğun deyildi",
  PATIENT_OTHER: "Digər",
  PSY_HEALTH: "Psixoloq xəstələndi",
  PSY_EMERGENCY: "Psixoloq təcili",
  PSY_TECHNICAL: "Texniki problem",
  PSY_INCOMPATIBLE: "Profil uyğun deyildi",
  PSY_OTHER: "Digər",
  OPERATOR_PATIENT_REQUEST: "Pasient telefonla bildirdi",
  OPERATOR_PSY_UNAVAILABLE: "Psixoloq mövcud deyildi",
  OPERATOR_DISPUTE_RESOLUTION: "Mübahisə həlli",
  OPERATOR_NO_SHOW_BOTH: "İkisi də gəlmədi",
  OPERATOR_PATIENT_BLOCKED: "Pasient bloklandı",
  OPERATOR_OTHER: "Digər",
};

type Tab = "history" | "notes" | "goals";


const GOAL_STATUS_META: Record<PatientGoalStatus, { label: string; bg: string; fg: string; border: string }> = {
  OPEN:        { label: "Açıq",       bg: "var(--brand-50)", fg: "var(--brand-700)", border: "var(--brand-100)" },
  IN_PROGRESS: { label: "Davam edir", bg: "#FEF3C7",         fg: "#92400E",         border: "#FDE68A" },
  ACHIEVED:    { label: "Çatdı",      bg: "#D1FAE5",         fg: "#065F46",         border: "#A7F3D0" },
  ABANDONED:   { label: "Tərk edilib", bg: "#F3F4F6",        fg: "#374151",         border: "#E5E7EB" },
};

export default function PatientDetailPage() {
  const params = useParams<{ patientId: string }>();
  const patientId = Number(params.patientId);

  const [client, setClient] = useState<ClientSummary | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDetail[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [tags, setTags] = useState<PatientTag[]>([]);
  const [goals, setGoals] = useState<PatientGoal[]>([]);
  const [crisis, setCrisis] = useState<CrisisCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>("history");
  const [goalModalGoal, setGoalModalGoal] = useState<PatientGoal | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  // Tags inline composer
  const [tagDraft, setTagDraft] = useState("");
  const [tagColor, setTagColor] = useState<PatientTagColor>("brand");
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  // Notes editor
  const [editing, setEditing] = useState<ClientNote | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteSearch, setNoteSearch] = useState("");

  // Custom note templates (backend-managed, reusable across patients)
  const [customTemplates, setCustomTemplates] = useState<FollowupTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplSaving, setTplSaving] = useState(false);
  const [tplError, setTplError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.notesForPatient(patientId).catch(() => [] as ClientNote[]),
      psychologistApi.clients().then(list => list.find(c => c.patientId === patientId) ?? null).catch(() => null),
      psychologistApi.myAppointments().catch(() => [] as AppointmentDetail[]),
      psychologistApi.patientTags(patientId).catch(() => [] as PatientTag[]),
      psychologistApi.templates().catch(() => [] as FollowupTemplate[]),
      // Goals gizlidirsə sorğu ümumiyyətlə getməsin.
      FEATURE_GOALS
        ? psychologistApi.patientGoals(patientId).catch(() => [] as PatientGoal[])
        : Promise.resolve([] as PatientGoal[]),
      psychologistApi.patientCrisisHistory(patientId).catch(() => [] as CrisisCheckIn[]),
    ]).then(([n, c, allAppts, t, tpls, gs, ch]) => {
      setNotes(n);
      setClient(c);
      setAppointments(allAppts.filter(a => a.patientId === patientId));
      setTags(t);
      setCustomTemplates(tpls);
      setGoals(gs);
      setCrisis(ch);
    }).finally(() => setLoading(false));
  };

  const addTag = async (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setTagSaving(true); setTagError(null);
    try {
      const created = await psychologistApi.createPatientTag(patientId, { label: trimmed, color: tagColor });
      setTags(prev => [...prev, created]);
      setTagDraft("");
      setTagPickerOpen(false);
    } catch (e) {
      setTagError((e as Error).message);
    } finally {
      setTagSaving(false);
    }
  };

  const removeTag = async (tagId: number) => {
    try {
      await psychologistApi.deletePatientTag(tagId);
      setTags(prev => prev.filter(t => t.id !== tagId));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load identity changes every render; re-fetch only on patientId change
  useEffect(() => { if (Number.isFinite(patientId)) load(); }, [patientId]);

  const reset = () => { setEditing(null); setTitle(""); setBody(""); setMood(""); setShowForm(false); setError(null); };

  const startEdit = (n: ClientNote) => {
    setEditing(n); setTitle(n.title ?? ""); setBody(n.body); setMood(n.moodScore ?? ""); setShowForm(true);
  };

  const save = async () => {
    if (!body.trim()) { setError("Qeyd mətni boş ola bilməz"); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        patientId,
        title: title.trim() || null,
        body: body.trim(),
        moodScore: typeof mood === "number" ? mood : null,
      };
      if (editing) {
        const updated = await psychologistApi.updateNote(editing.id, payload);
        setNotes(prev => prev.map(x => x.id === updated.id ? updated : x));
      } else {
        const created = await psychologistApi.createNote(payload);
        setNotes(prev => [created, ...prev]);
      }
      reset();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!(await confirmDialog({ title: "Qeydi sil", message: "Bu qeydi silmək istəyirsiniz?", confirmLabel: "Sil", danger: true }))) return;
    try {
      await psychologistApi.deleteNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (e) { toast((e as Error).message, "error"); }
  };

  // ── Derived metrics ──────────────────────────────────────────────────
  const moodFromNotes = useMemo(() => {
    const arr = notes.map(n => n.moodScore).filter((x): x is number => typeof x === "number");
    if (!arr.length) return null;
    return Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10;
  }, [notes]);

  const completionPct = useMemo(() => {
    if (!client || client.totalSessions === 0) return null;
    return Math.round((client.completedSessions / client.totalSessions) * 100);
  }, [client]);

  const sortedHistory = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const ta = new Date(a.startAt ?? a.createdAt).getTime();
      const tb = new Date(b.startAt ?? b.createdAt).getTime();
      return tb - ta;
    });
  }, [appointments]);

  const upcoming = useMemo(() => {
    return appointments
      .filter(a => a.startAt && new Date(a.startAt).getTime() > now)
      .filter(a => a.status === "ASSIGNED" || a.status === "CONFIRMED")
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())[0] ?? null;
  }, [appointments, now]);

  const firstNote = useMemo(() => {
    return appointments
      .filter(a => a.note)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0] ?? null;
  }, [appointments]);

  // Most recent COMPLETED session + matching clinical note (if any) — quick reference
  const lastCompleted = useMemo(() => {
    return appointments
      .filter(a => a.status === "COMPLETED")
      .sort((a, b) => new Date(b.startAt ?? b.endAt ?? 0).getTime() - new Date(a.startAt ?? a.endAt ?? 0).getTime())[0] ?? null;
  }, [appointments]);

  const latestNote = notes[0] ?? null; // notes are returned newest first

  const filteredNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(n =>
      (n.title ?? "").toLowerCase().includes(q) ||
      n.body.toLowerCase().includes(q)
    );
  }, [notes, noteSearch]);

  const applyTemplate = (key: string) => {
    if (key.startsWith("custom:")) {
      const id = Number(key.slice("custom:".length));
      const tpl = customTemplates.find(t => t.id === id);
      if (!tpl) return;
      if (!title.trim()) setTitle(tpl.name);
      setBody(prev => prev.trim() ? prev + "\n\n" + tpl.body : tpl.body);
      return;
    }
    const tpl = NOTE_TEMPLATES.find(t => t.key === key);
    if (!tpl) return;
    if (!title.trim()) setTitle(tpl.title);
    setBody(prev => prev.trim() ? prev + "\n\n" + tpl.body : tpl.body);
  };

  const saveTemplate = async () => {
    if (!tplName.trim() || !tplBody.trim()) {
      setTplError("Ad və mətn lazımdır");
      return;
    }
    setTplSaving(true); setTplError(null);
    try {
      const created = await psychologistApi.createTemplate({ name: tplName.trim(), body: tplBody.trim() });
      setCustomTemplates(prev => [...prev, created]);
      setTplName(""); setTplBody(""); setShowTemplateModal(false);
    } catch (e) {
      setTplError((e as Error).message);
    } finally {
      setTplSaving(false);
    }
  };

  const deleteTemplate = async (id: number) => {
    if (!(await confirmDialog({ title: "Şablonu sil", message: "Bu şablonu silmək istəyirsiniz?", confirmLabel: "Sil", danger: true }))) return;
    try {
      await psychologistApi.deleteTemplate(id);
      setCustomTemplates(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  // Mood trend points from notes (chronological asc)
  const moodPoints = useMemo(() => {
    return [...notes]
      .filter(n => typeof n.moodScore === "number")
      .map(n => ({ date: n.createdAt, score: n.moodScore as number }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [notes]);

  const flag = client?.autoFlag ? FLAG_META[client.autoFlag] : null;

  return (
    <div className="pcli-page">
      <Link href="/psycholog/clients" className="pcli-back">← Müştərilərə qayıt</Link>

      {loading ? (
        <div className="pcli-loading">Yüklənir…</div>
      ) : !client ? (
        <div className="pcli-error">Müştəri tapılmadı.</div>
      ) : (
        <>
          {/* ── Header card ─────────────────────────────────────────────────── */}
          <div className="pcli-hero">
            <div className="pcli-hero-avatar">{initialsOf(client.name)}</div>
            <div className="pcli-hero-info">
              <h1 className="pcli-hero-name">{client.name}</h1>
              <p className="pcli-hero-meta">
                {client.email}{client.phone ? ` · ${client.phone}` : ""}
              </p>
              <div className="pcli-hero-stats">
                <span><b>{client.totalSessions}</b> seans</span>
                <span><b>{client.completedSessions}</b> tamamlanan</span>
                {client.lastAppointmentAt && <span>son seans: <b>{fmtShort(client.lastAppointmentAt)}</b></span>}
                {moodFromNotes !== null && <span>əhval <b>{moodFromNotes}/10</b></span>}
              </div>
              <div className="pcli-hero-pills">
                {client.noShowCount > 0 && (
                  <span className="pcli-pill pcli-pill--warn">
                    {client.noShowCount} no-show
                  </span>
                )}
                {client.lateCancelCount > 0 && (
                  <span className="pcli-pill pcli-pill--warn">
                    {client.lateCancelCount} geç ləğv
                  </span>
                )}
                {flag && (
                  <span className={`pcli-pill pcli-pill--${flag.tone}`}>
                    {flag.label}
                  </span>
                )}
              </div>
            </div>
            <div className="pcli-hero-actions">
              <button onClick={() => { reset(); setShowForm(true); setTab("notes"); }}
                className="pcli-btn pcli-btn--primary">
                + Qeyd əlavə et
              </button>
            </div>
          </div>

          {/* ── Tags row ─────────────────────────────────────────────────────── */}
          <div className="pcli-tags-row">
            <span className="pcli-tags-label">Etiketlər:</span>
            {tags.length === 0 && !tagPickerOpen && (
              <span className="pcli-tags-empty">hələ etiket yoxdur</span>
            )}
            {tags.map(t => (
              <span key={t.id} className="pcli-tag" data-color={t.color}>
                {t.label}
                <button
                  type="button"
                  className="pcli-tag-x"
                  onClick={() => removeTag(t.id)}
                  aria-label={`${t.label} sil`}
                >×</button>
              </span>
            ))}
            {!tagPickerOpen ? (
              <button
                type="button"
                className="pcli-tag-add"
                onClick={() => { setTagPickerOpen(true); setTagError(null); }}
              >+ etiket</button>
            ) : (
              <div className="pcli-tag-picker">
                <input
                  value={tagDraft}
                  onChange={e => setTagDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); addTag(tagDraft); }
                    if (e.key === "Escape") { setTagPickerOpen(false); setTagDraft(""); setTagError(null); }
                  }}
                  placeholder="Etiket adı…"
                  className="pcli-tag-input"
                  autoFocus
                  maxLength={40}
                />
                <div className="pcli-tag-color-row">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setTagColor(c.value)}
                      className={`pcli-tag-swatch${tagColor === c.value ? " is-active" : ""}`}
                      style={{ background: c.swatch }}
                    />
                  ))}
                </div>
                <div className="pcli-tag-presets">
                  {TAG_PRESETS.filter(p => !tags.some(t => t.label.toLowerCase() === p.toLowerCase())).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => addTag(p)}
                      className="pcli-tag-preset"
                      disabled={tagSaving}
                    >{p}</button>
                  ))}
                </div>
                {tagError && <div className="pcli-tag-err">{tagError}</div>}
                <div className="pcli-tag-actions">
                  <button
                    type="button"
                    onClick={() => { setTagPickerOpen(false); setTagDraft(""); setTagError(null); }}
                    className="pcli-btn pcli-btn--ghost pcli-btn--mini"
                  >Ləğv</button>
                  <button
                    type="button"
                    onClick={() => addTag(tagDraft)}
                    disabled={tagSaving || !tagDraft.trim()}
                    className="pcli-btn pcli-btn--primary pcli-btn--mini"
                  >{tagSaving ? "Əlavə olunur…" : "Əlavə et"}</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Context cards: next + last session side by side ───────────── */}
          {(upcoming?.startAt || lastCompleted) && (
            <div className="pcli-context-grid">
              {upcoming && upcoming.startAt && (
                <div className="pcli-upcoming">
                  <div className="pcli-upcoming-info">
                    <div className="pcli-upcoming-label">Növbəti seans</div>
                    <div className="pcli-upcoming-when">{fmtDateTime(upcoming.startAt)}</div>
                  </div>
                  <Link href="/psycholog/calendar" className="pcli-btn pcli-btn--ghost">Cədvələ keç</Link>
                </div>
              )}
              {lastCompleted && (
                <div className="pcli-last-session">
                  <div className="pcli-last-info">
                    <div className="pcli-last-label">Son tamamlanmış seans</div>
                    <div className="pcli-last-when">
                      {fmtShort(lastCompleted.startAt ?? lastCompleted.endAt)}
                      <span className="pcli-last-ago">· {daysBetween(lastCompleted.startAt ?? lastCompleted.endAt)} gün öncə</span>
                      {latestNote?.moodScore && (
                        <span className="pcli-last-mood">· əhval-ruhiyyə {latestNote.moodScore}/10</span>
                      )}
                    </div>
                    {latestNote?.body && (
                      <p className="pcli-last-note">«{latestNote.body.slice(0, 180)}{latestNote.body.length > 180 ? "…" : ""}»</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {crisis.length > 0 && <CrisisHistoryCard items={crisis} />}

          {moodPoints.length >= 2 && <MoodTrendChart points={moodPoints} />}

          {firstNote?.note && (
            <div className="pcli-context">
              <span className="pcli-context-label">İlk müraciət konteksti:</span>
              <span className="pcli-context-text">«{firstNote.note}»</span>
            </div>
          )}

          {/* ── Tabs ──────────────────────────────────────────────────────── */}
          <div className="pcli-tabs" role="tablist">
            <button role="tab" aria-selected={tab === "history"}
              className={`pcli-tab${tab === "history" ? " is-active" : ""}`}
              onClick={() => setTab("history")}>
              Tarixçə <span>{appointments.length}</span>
            </button>
            <button role="tab" aria-selected={tab === "notes"}
              className={`pcli-tab${tab === "notes" ? " is-active" : ""}`}
              onClick={() => setTab("notes")}>
              Klinik qeydlər <span>{notes.length}</span>
            </button>
            {FEATURE_GOALS && (
              <button role="tab" aria-selected={tab === "goals"}
                className={`pcli-tab${tab === "goals" ? " is-active" : ""}`}
                onClick={() => setTab("goals")}>
                Hədəflər <span>{goals.length}</span>
              </button>
            )}
          </div>

          {tab === "history" && (
            <HistorySection items={sortedHistory} />
          )}

          {FEATURE_GOALS && tab === "goals" && (
            <GoalsSection
              goals={goals}
              onCreate={() => { setGoalModalGoal(null); setGoalModalOpen(true); }}
              onEdit={(g) => { setGoalModalGoal(g); setGoalModalOpen(true); }}
              onDelete={async (id) => {
                if (!(await confirmDialog({ title: "Hədəfi sil", message: "Bu hədəfi silmək istəyirsiniz?", confirmLabel: "Sil", danger: true }))) return;
                try {
                  await psychologistApi.deleteGoal(id);
                  setGoals(prev => prev.filter(g => g.id !== id));
                } catch (e) { toast((e as Error).message, "error"); }
              }}
            />
          )}

          {tab === "notes" && (
            <NotesSection
              notes={notes}
              filteredNotes={filteredNotes}
              search={noteSearch}
              setSearch={setNoteSearch}
              showForm={showForm}
              editing={editing}
              title={title} body={body} mood={mood}
              setTitle={setTitle} setBody={setBody} setMood={setMood}
              saving={saving} error={error}
              onSave={save} onCancel={reset}
              onEdit={startEdit} onDelete={remove}
              onAddNew={() => { reset(); setShowForm(true); }}
              onApplyTemplate={applyTemplate}
              customTemplates={customTemplates}
              onCreateTemplate={() => { setTplName(""); setTplBody(""); setTplError(null); setShowTemplateModal(true); }}
              onDeleteCustomTemplate={deleteTemplate}
            />
          )}
        </>
      )}

      {FEATURE_GOALS && goalModalOpen && (
        <GoalModal
          patientId={patientId}
          goal={goalModalGoal}
          onClose={() => { setGoalModalOpen(false); setGoalModalGoal(null); }}
          onSaved={(saved) => {
            setGoals(prev => {
              if (goalModalGoal) return prev.map(g => g.id === saved.id ? saved : g);
              return [saved, ...prev];
            });
            setGoalModalOpen(false); setGoalModalGoal(null);
          }}
        />
      )}

      {showTemplateModal && (
        <div onClick={() => setShowTemplateModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 540, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", margin: "0 0 4px" }}>Yeni şablon</h3>
            <p style={{ fontSize: 12, color: "#52718F", margin: "0 0 16px" }}>
              Tez-tez istifadə etdiyiniz qeyd strukturunu şablon olaraq saxlayın
            </p>
            <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Şablon adı (məs. Anksiyete qiymətləndirməsi)"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />
            <textarea rows={8} value={tplBody} onChange={e => setTplBody(e.target.value)} placeholder="Şablon mətni — başlıqlar, sual çərçivəsi, vs."
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
            {tplError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>{tplError}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowTemplateModal(false)}
                style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer" }}>Ləğv</button>
              <button onClick={saveTemplate} disabled={tplSaving}
                style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: tplSaving ? "wait" : "pointer" }}>
                {tplSaving ? "Saxlanılır…" : "Şablonu saxla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Crisis check-in history ────────────────────────────────────────────── */

function CrisisHistoryCard({ items }: { items: CrisisCheckIn[] }) {
  // Restrict to last 30 days for the sparkline.
  const [cutoff] = useState(() => Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = items.filter(c => new Date(c.createdAt).getTime() >= cutoff);
  if (recent.length === 0) return null;
  const lowCount = recent.filter(c => c.moodScore <= 2).length;
  const sortedAsc = [...recent].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const sparkW = 240, sparkH = 36;
  const dots = sortedAsc.map((c, i) => {
    const x = sortedAsc.length === 1 ? sparkW / 2 : (i / (sortedAsc.length - 1)) * (sparkW - 12) + 6;
    const y = sparkH - ((c.moodScore - 1) / 4) * (sparkH - 10) - 5;
    return { x, y, mood: c.moodScore, ts: c.createdAt };
  });
  const path = dots.map((d, i) => `${i === 0 ? "M" : "L"} ${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(" ");

  return (
    <div className="pcli-crisis">
      <div className="pcli-crisis__head">
        <div>
          <h3>Böhran check-in tarixçəsi</h3>
          <p>Son 30 gündə {recent.length} check-in
            {lowCount > 0 && <> · <strong style={{ color: "#991B1B" }}>{lowCount} aşağı əhval</strong></>}
          </p>
        </div>
      </div>
      <svg className="pcli-crisis__spark" viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none">
        <line x1="0" y1={sparkH - 5} x2={sparkW} y2={sparkH - 5} stroke="#FCA5A5" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.6" />
        {dots.length > 1 && (
          <path d={path} fill="none" stroke="var(--brand)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="3"
            fill={d.mood <= 2 ? "#DC2626" : d.mood === 3 ? "#F59E0B" : "#10B981"}>
            <title>{`${d.mood}/5 · ${new Date(d.ts).toLocaleDateString("az-AZ")}`}</title>
          </circle>
        ))}
      </svg>
      <div className="pcli-crisis__list">
        {recent.slice(0, 5).map(c => (
          <div key={c.id} className="pcli-crisis__row" data-tone={c.moodScore <= 2 ? "low" : c.moodScore === 3 ? "mid" : "good"}>
            <span className="pcli-crisis__row-mood">{c.moodScore}/5</span>
            <div className="pcli-crisis__row-body">
              {c.note && <div className="pcli-crisis__row-note">«{c.note}»</div>}
              <div className="pcli-crisis__row-time">{fmtDateTime(c.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Goals section ──────────────────────────────────────────────────────── */

function GoalsSection({
  goals, onCreate, onEdit, onDelete,
}: {
  goals: PatientGoal[];
  onCreate: () => void;
  onEdit: (g: PatientGoal) => void;
  onDelete: (id: number) => void;
}) {
  const grouped = useMemo(() => {
    const open = goals.filter(g => g.status === "OPEN" || g.status === "IN_PROGRESS");
    const done = goals.filter(g => g.status === "ACHIEVED");
    const abandoned = goals.filter(g => g.status === "ABANDONED");
    return { open, done, abandoned };
  }, [goals]);

  return (
    <div className="pcli-goals">
      <div className="pcli-goals__head">
        <div>
          <h3>Terapiya hədəfləri</h3>
          <p>Müştəri ilə razılaşdırılmış hədəflər və onların inkişafı</p>
        </div>
        <button onClick={onCreate} className="pcli-btn pcli-btn--primary">+ Yeni hədəf</button>
      </div>

      {goals.length === 0 ? (
        <div className="pcli-goals__empty">
          <div className="pcli-goals__empty-title">Hələ hədəf əlavə edilməyib</div>
          <div className="pcli-goals__empty-body">
            Hədəf əlavə edərək müştərinin inkişafını ölçə bilərsiniz: "anksiyetə hücumlarını azaltmaq", "gündəlik rituallar yaratmaq" və s.
          </div>
        </div>
      ) : (
        <>
          {grouped.open.length > 0 && (
            <GoalList title="Aktiv" goals={grouped.open} onEdit={onEdit} onDelete={onDelete} />
          )}
          {grouped.done.length > 0 && (
            <GoalList title="Çatdı" goals={grouped.done} onEdit={onEdit} onDelete={onDelete} />
          )}
          {grouped.abandoned.length > 0 && (
            <GoalList title="Tərk edilib" goals={grouped.abandoned} onEdit={onEdit} onDelete={onDelete} />
          )}
        </>
      )}
    </div>
  );
}

function GoalList({
  title, goals, onEdit, onDelete,
}: {
  title: string; goals: PatientGoal[];
  onEdit: (g: PatientGoal) => void; onDelete: (id: number) => void;
}) {
  return (
    <div className="pcli-goals__group">
      <div className="pcli-goals__group-title">{title} <span>{goals.length}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 8 }}>
        {goals.map(g => <GoalCard key={g.id} g={g} onEdit={() => onEdit(g)} onDelete={() => onDelete(g.id)} />)}
      </div>
    </div>
  );
}

function GoalCard({ g, onEdit, onDelete }: { g: PatientGoal; onEdit: () => void; onDelete: () => void }) {
  const [now] = useState(() => Date.now());
  const meta = GOAL_STATUS_META[g.status];
  const overdue = g.targetDate && g.status !== "ACHIEVED" && g.status !== "ABANDONED"
    && new Date(g.targetDate + "T23:59:59").getTime() < now;
  return (
    <div className="pcli-goal-card">
      <div className="pcli-goal-card__top">
        <div className="pcli-goal-card__title">{g.title}</div>
        <span className="pcli-goal-card__status" style={{ background: meta.bg, color: meta.fg, borderColor: meta.border }}>
          {meta.label}
        </span>
      </div>
      {g.description && <div className="pcli-goal-card__desc">{g.description}</div>}
      <div className="pcli-goal-card__progress">
        <div className="pcli-goal-card__progress-bar">
          <div className="pcli-goal-card__progress-fill" style={{ width: `${g.progressPct}%` }} />
        </div>
        <span className="pcli-goal-card__progress-val">{g.progressPct}%</span>
      </div>
      <div className="pcli-goal-card__meta">
        {g.targetDate && (
          <span className={`pcli-goal-card__date${overdue ? " is-overdue" : ""}`}>
            Hədəf tarixi: {fmtShort(g.targetDate)}
            {overdue && " · gecikib"}
          </span>
        )}
        {g.achievedAt && (
          <span>Tamamlandı: {fmtShort(g.achievedAt)}</span>
        )}
        <div className="pcli-goal-card__actions">
          <button onClick={onEdit} className="pcli-btn pcli-btn--ghost pcli-btn--mini">Redaktə</button>
          <button onClick={onDelete} className="pcli-btn pcli-btn--ghost pcli-btn--mini" style={{ color: "#991B1B" }}>Sil</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Goal modal ─────────────────────────────────────────────────────────── */

function GoalModal({
  patientId, goal, onClose, onSaved,
}: {
  patientId: number;
  goal: PatientGoal | null;
  onClose: () => void;
  onSaved: (g: PatientGoal) => void;
}) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [status, setStatus] = useState<PatientGoalStatus>(goal?.status ?? "OPEN");
  const [progressPct, setProgressPct] = useState<number>(goal?.progressPct ?? 0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) { setErr("Başlıq tələb olunur"); return; }
    setSaving(true); setErr(null);
    try {
      const payload: PatientGoalPayload = {
        title: title.trim(),
        description: description.trim() || null,
        targetDate: targetDate || null,
        status,
        progressPct: status === "ACHIEVED" ? 100 : progressPct,
      };
      const saved = goal
        ? await psychologistApi.updateGoal(goal.id, payload)
        : await psychologistApi.createGoal(patientId, payload);
      onSaved(saved);
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(10,22,51,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, padding: 0, maxWidth: 560, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--brand-100)" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>
            {goal ? "Hədəfi redaktə et" : "Yeni hədəf"}
          </h3>
        </div>
        <div style={{ padding: 22, display: "grid", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--oxford)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
              Başlıq *
            </label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Məs. Anksiyetə hücumlarını həftədə 2-dən aşağı endirmək"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1.5px solid var(--brand-100)", fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--oxford)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
              Təfərrüat
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="İstifadə olunan strategiya, ölçü meyarları…"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1.5px solid var(--brand-100)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--oxford)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                Hədəf tarixi
              </label>
              <input type="date" value={targetDate ?? ""} onChange={e => setTargetDate(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1.5px solid var(--brand-100)", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--oxford)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                Status
              </label>
              <select value={status} onChange={e => setStatus(e.target.value as PatientGoalStatus)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1.5px solid var(--brand-100)", fontSize: 13, boxSizing: "border-box", background: "#fff" }}>
                <option value="OPEN">Açıq</option>
                <option value="IN_PROGRESS">Davam edir</option>
                <option value="ACHIEVED">Çatdı</option>
                <option value="ABANDONED">Tərk edilib</option>
              </select>
            </div>
          </div>
          {status !== "ACHIEVED" && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--oxford)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                İrəliləyiş: <strong>{progressPct}%</strong>
              </label>
              <input type="range" min={0} max={100} step={5}
                value={progressPct}
                onChange={e => setProgressPct(Number(e.target.value))}
                style={{ width: "100%" }} />
            </div>
          )}

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose}
              style={{ padding: "8px 14px", border: "1px solid var(--brand-100)", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer", fontWeight: 600 }}>
              Bağla
            </button>
            <button onClick={save} disabled={saving}
              style={{ padding: "8px 20px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saxlanılır…" : (goal ? "Yenilə" : "Yarat")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Summary stat ───────────────────────────────────────────────────────── */

/* ─── History section ────────────────────────────────────────────────────── */

function HistorySection({ items }: { items: AppointmentDetail[] }) {
  if (items.length === 0) {
    return (
      <div className="pcli-empty">
        <div className="pcli-empty-icon"></div>
        <div className="pcli-empty-title">Hələ randevu yoxdur</div>
        <p className="pcli-empty-sub">İlk randevu təyin olunduğunda burada görünəcək.</p>
      </div>
    );
  }
  return (
    <div className="pcli-history">
      {items.map(a => <HistoryRow key={a.id} a={a} />)}
    </div>
  );
}

function HistoryRow({ a }: { a: AppointmentDetail }) {
  const status = STATUS[a.status] ?? STATUS.ASSIGNED;
  const ref = a.startAt ?? a.endAt ?? a.createdAt;
  const d = new Date(ref);
  const isCancelled = a.status === "CANCELLED";
  const isCompleted = a.status === "COMPLETED";

  return (
    <div className="pcli-row" style={{ borderLeft: `3px solid ${status.accent}` }}>
      <div className="pcli-row-date">
        <strong>{pad2(d.getDate())} {MONTHS_AZ[d.getMonth()]} {d.getFullYear()}</strong>
        <span>{fmtTime(d)}</span>
      </div>
      <div className="pcli-row-main">
        <div className="pcli-row-line">
          <span className="pcli-row-badge" style={{ color: status.color, background: status.bg }}>
            {status.label}
          </span>
          {a.lateCancel && <span className="pcli-row-chip pcli-row-chip--warn">Geç ləğv</span>}
          {isCompleted && a.autoConfirmedAt && (
            <span className="pcli-row-chip">Auto-təsdiq</span>
          )}
          {isCompleted && a.patientConfirmedAt && a.psychologistConfirmedAt && !a.autoConfirmedAt && (
            <span className="pcli-row-chip pcli-row-chip--good">Qarşılıqlı təsdiq</span>
          )}
        </div>
        {a.note && (
          <div className="pcli-row-note">«{a.note}»</div>
        )}
        {isCancelled && (
          <div className="pcli-row-cancel">
            <strong>Ləğv:</strong>{" "}
            {a.cancelledBy === "PATIENT" && "Pasient ləğv etdi"}
            {a.cancelledBy === "PSYCHOLOGIST" && "Psixoloq ləğv etdi"}
            {a.cancelledBy === "OPERATOR" && "Operator ləğv etdi"}
            {a.cancelReasonCode && (
              <> · <em>{REASON_LABELS[a.cancelReasonCode] ?? a.cancelReasonCode}</em></>
            )}
            {a.cancelledAt && <> · {fmtDateTime(a.cancelledAt)}</>}
          </div>
        )}
        {a.cancelReasonText && (
          <div className="pcli-row-reason-text">«{a.cancelReasonText}»</div>
        )}
        {a.status === "DISPUTED" && a.disputeReason && (
          <div className="pcli-row-cancel pcli-row-cancel--danger">
            <strong>Mübahisə:</strong> «{a.disputeReason}»
          </div>
        )}
        {a.operatorNote && (
          <div className="pcli-row-op-note">
            <strong>Operator:</strong> {a.operatorNote}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Notes section ──────────────────────────────────────────────────────── */

function NotesSection(props: {
  notes: ClientNote[];
  filteredNotes: ClientNote[];
  search: string;
  setSearch: (v: string) => void;
  showForm: boolean;
  editing: ClientNote | null;
  title: string; body: string; mood: number | "";
  setTitle: (v: string) => void;
  setBody: (v: string) => void;
  setMood: (v: number | "") => void;
  saving: boolean; error: string | null;
  onSave: () => void; onCancel: () => void;
  onEdit: (n: ClientNote) => void;
  onDelete: (id: number) => void;
  onAddNew: () => void;
  onApplyTemplate: (key: string) => void;
  customTemplates: FollowupTemplate[];
  onCreateTemplate: () => void;
  onDeleteCustomTemplate: (id: number) => void;
}) {
  const { notes, filteredNotes, search, setSearch,
          showForm, editing, title, body, mood, saving, error,
          setTitle, setBody, setMood, onSave, onCancel, onEdit, onDelete, onAddNew, onApplyTemplate,
          customTemplates, onCreateTemplate, onDeleteCustomTemplate } = props;

  return (
    <>
      <div className="pcli-encrypt">
        Bütün qeydlər AES-256-GCM ilə şifrələnir. Yalnız siz oxuya bilərsiniz.
      </div>

      {!showForm && (
        <div className="pcli-notes-toolbar">
          <button onClick={onAddNew} className="pcli-btn pcli-btn--primary">
            + Yeni qeyd
          </button>
          {notes.length > 0 && (
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Qeydləri axtar (başlıq və ya mətn)…"
              className="pcli-notes-search"
            />
          )}
        </div>
      )}

      {showForm && (
        <div className="pcli-card pcli-card--form">
          <h3>{editing ? "Qeydi düzəlt" : "Yeni qeyd"}</h3>
          {!editing && (
            <div className="pcli-template-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 11, color: "#52718F", fontWeight: 600, marginRight: 4 }}>Şablon:</label>
              {NOTE_TEMPLATES.map(t => (
                <button key={t.key} type="button"
                  onClick={() => onApplyTemplate(t.key)}
                  className="pcli-template-chip">
                  {t.label}
                </button>
              ))}
              {customTemplates.length > 0 && (
                <span style={{ width: 1, height: 18, background: "#E5E7EB", margin: "0 4px" }} aria-hidden />
              )}
              {customTemplates.map(tpl => (
                <span key={tpl.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <button type="button" onClick={() => onApplyTemplate(`custom:${tpl.id}`)}
                    className="pcli-template-chip"
                    style={{ background: "#EEF5FF", color: "#1E40AF", borderColor: "#BFDBFE" }}>
                    {tpl.name}
                  </button>
                  <button type="button" onClick={() => onDeleteCustomTemplate(tpl.id)}
                    title="Şablonu sil"
                    style={{ width: 18, height: 18, borderRadius: 4, border: "1px solid #E5E7EB", background: "#fff", color: "#991B1B", cursor: "pointer", fontSize: 11, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
              <button type="button" onClick={onCreateTemplate}
                style={{ padding: "4px 10px", border: "1px dashed #C0D2E6", borderRadius: 999, background: "#fff", color: "#52718F", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                + Yeni şablon
              </button>
            </div>
          )}
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Başlıq (məcburi deyil)"
            className="pcli-input" />
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={8}
            placeholder="Seans qeydləri burada saxlanır — yalnız siz görə bilərsiniz."
            className="pcli-textarea" />
          <div className="pcli-mood-row">
            <label>Əhval-ruhiyyə (1–10):</label>
            <input type="number" min={1} max={10} value={mood}
              onChange={e => { const v = e.target.value; setMood(v === "" ? "" : Math.max(1, Math.min(10, Number(v)))); }}
              className="pcli-input" style={{ width: 80 }} />
          </div>
          {error && <div className="pcli-err">{error}</div>}
          <div className="pcli-form-actions">
            <button onClick={onCancel} className="pcli-btn pcli-btn--ghost">Ləğv</button>
            <button onClick={onSave} disabled={saving} className="pcli-btn pcli-btn--primary">
              {saving ? "Saxlanılır…" : (editing ? "Yenilə" : "Saxla")}
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 && !showForm ? (
        <div className="pcli-empty">
          <div className="pcli-empty-icon"></div>
          <div className="pcli-empty-title">Hələ klinik qeyd yoxdur</div>
          <p className="pcli-empty-sub">Bu müştəri üçün ilk qeydinizi yazın.</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="pcli-notes-empty-search">
          «{search}» üzrə uyğun qeyd tapılmadı.
        </div>
      ) : (
        <div className="pcli-notes">
          {filteredNotes.map(n => (
            <div key={n.id} className="pcli-note">
              <div className="pcli-note-head">
                <div>
                  {n.title && <div className="pcli-note-title">{n.title}</div>}
                  <div className="pcli-note-meta">
                    {fmtDateTime(n.createdAt)}
                    {n.updatedAt && n.updatedAt !== n.createdAt && ` · düzəldildi ${fmtDateTime(n.updatedAt)}`}
                    {typeof n.moodScore === "number" && ` · əhval-ruhiyyə ${n.moodScore}/10`}
                  </div>
                </div>
                <div className="pcli-note-actions">
                  <button onClick={() => onEdit(n)} className="pcli-btn pcli-btn--mini">Düzəlt</button>
                  <button onClick={() => onDelete(n.id)} className="pcli-btn pcli-btn--mini pcli-btn--danger">Sil</button>
                </div>
              </div>
              <div className="pcli-note-body">{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ─── Mood trend chart (mini SVG) ────────────────────────────────────────── */

function MoodTrendChart({ points }: { points: { date: string; score: number }[] }) {
  const W = 720, H = 140, P = 28;
  const minScore = 1, maxScore = 10;
  const xs = points.map((_p, i) => P + (i * (W - P * 2)) / Math.max(1, points.length - 1));
  const ys = points.map(p => P + ((maxScore - p.score) / (maxScore - minScore)) * (H - P * 2));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");

  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.score - first.score;
  const trendLabel = delta > 0.5 ? `↑ +${delta.toFixed(1)} yaxşılaşma`
                   : delta < -0.5 ? `↓ ${delta.toFixed(1)} azalma`
                   : "stabil";
  const trendTone = delta > 0.5 ? "good" : delta < -0.5 ? "warn" : "neutral";

  return (
    <div className="pcli-card pcli-mood-chart">
      <div className="pcli-mood-head">
        <h3>Əhval-ruhiyyə tendensiyası</h3>
        <span className="pcli-mood-trend" data-tone={trendTone}>{trendLabel}</span>
      </div>
      <div className="pcli-mood-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="pcli-mood-svg">
          {[1, 5, 10].map(level => {
            const y = P + ((maxScore - level) / (maxScore - minScore)) * (H - P * 2);
            return (
              <g key={level}>
                <line x1={P} y1={y} x2={W - P} y2={y} stroke="var(--brand-100)" strokeWidth="1" strokeDasharray="3 4" />
                <text x={P - 6} y={y + 3} fontSize="10" fill="var(--oxford-60)" textAnchor="end">{level}</text>
              </g>
            );
          })}
          <defs>
            <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${path} L${xs[xs.length - 1].toFixed(1)},${H - P} L${xs[0].toFixed(1)},${H - P} Z`}
            fill="url(#moodFill)"
          />
          <path d={path} stroke="var(--brand)" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle key={i} cx={xs[i]} cy={ys[i]} r="4"
              fill={p.score >= 7 ? "#10B981" : p.score <= 4 ? "#EF4444" : "var(--brand)"}
              stroke="#fff" strokeWidth="2" />
          ))}
        </svg>
      </div>
      <div className="pcli-mood-foot">
        <span>{new Date(first.date).toLocaleDateString("az-AZ", { day: "2-digit", month: "short" })}</span>
        <span>{points.length} qeyd</span>
        <span>{new Date(last.date).toLocaleDateString("az-AZ", { day: "2-digit", month: "short" })}</span>
      </div>
    </div>
  );
}
