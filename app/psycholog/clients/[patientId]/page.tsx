"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  psychologistApi,
  type AppointmentDetail,
  type ClientNote,
  type ClientSummary,
  type PatientTag,
  type PatientTagColor,
} from "@/lib/api";

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

type Tab = "history" | "notes";

export default function PatientDetailPage() {
  const params = useParams<{ patientId: string }>();
  const patientId = Number(params.patientId);

  const [client, setClient] = useState<ClientSummary | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDetail[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [tags, setTags] = useState<PatientTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("history");

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

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.notesForPatient(patientId).catch(() => [] as ClientNote[]),
      psychologistApi.clients().then(list => list.find(c => c.patientId === patientId) ?? null).catch(() => null),
      psychologistApi.myAppointments().catch(() => [] as AppointmentDetail[]),
      psychologistApi.patientTags(patientId).catch(() => [] as PatientTag[]),
    ]).then(([n, c, allAppts, t]) => {
      setNotes(n);
      setClient(c);
      setAppointments(allAppts.filter(a => a.patientId === patientId));
      setTags(t);
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
      alert((e as Error).message);
    }
  };

  useEffect(() => { if (Number.isFinite(patientId)) load(); /* eslint-disable-next-line */ }, [patientId]);

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
    if (!confirm("Bu qeydi silmək istəyirsiniz?")) return;
    try {
      await psychologistApi.deleteNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (e) { alert((e as Error).message); }
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
    const now = Date.now();
    return appointments
      .filter(a => a.startAt && new Date(a.startAt).getTime() > now)
      .filter(a => a.status === "ASSIGNED" || a.status === "CONFIRMED")
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())[0] ?? null;
  }, [appointments]);

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
    const tpl = NOTE_TEMPLATES.find(t => t.key === key);
    if (!tpl) return;
    if (!title.trim()) setTitle(tpl.title);
    setBody(prev => prev.trim() ? prev + "\n\n" + tpl.body : tpl.body);
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
              <div className="pcli-hero-pills">
                <span className="pcli-pill pcli-pill--brand">{client.totalSessions} seans</span>
                {completionPct !== null && (
                  <span className={`pcli-pill ${completionPct >= 80 ? "pcli-pill--good" : "pcli-pill--neutral"}`}>
                    %{completionPct} tamamlanma
                  </span>
                )}
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
                    ⚠ {flag.label}
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

          {/* ── Summary strip ──────────────────────────────────────────────── */}
          <div className="pcli-summary">
            <SummaryStat label="Cəmi seans"      value={String(client.totalSessions)} />
            <SummaryStat label="Tamamlanan"      value={String(client.completedSessions)} accent="good" />
            <SummaryStat label="Son seans"
              value={client.lastAppointmentAt ? fmtShort(client.lastAppointmentAt) : "—"}
              sub={client.lastAppointmentAt ? `${daysBetween(client.lastAppointmentAt)} gün öncə` : undefined} />
            <SummaryStat label="Klinik qeyd"     value={String(client.noteCount)} />
            <SummaryStat label="Orta əhval-ruhiyyə" value={moodFromNotes !== null ? `${moodFromNotes}/10` : "—"} accent="brand" />
          </div>

          {/* ── Upcoming session strip (if any) ────────────────────────────── */}
          {upcoming && upcoming.startAt && (
            <div className="pcli-upcoming">
              <div className="pcli-upcoming-icon">📅</div>
              <div className="pcli-upcoming-info">
                <div className="pcli-upcoming-label">Növbəti seans</div>
                <div className="pcli-upcoming-when">
                  {fmtDateTime(upcoming.startAt)}
                  {upcoming.sessionFormat && (
                    <span className="pcli-upcoming-fmt">
                      · {upcoming.sessionFormat === "ONLINE" ? "Onlayn" : "Əyani"}
                    </span>
                  )}
                </div>
              </div>
              <Link href="/psycholog/calendar" className="pcli-btn pcli-btn--ghost">Cədvələ keç</Link>
            </div>
          )}

          {/* ── Last session quick reference ─────────────────────────────── */}
          {lastCompleted && (
            <div className="pcli-last-session">
              <div className="pcli-last-icon">📌</div>
              <div className="pcli-last-info">
                <div className="pcli-last-label">Son tamamlanmış seans</div>
                <div className="pcli-last-when">
                  {fmtShort(lastCompleted.startAt ?? lastCompleted.endAt)}
                  <span className="pcli-last-ago">
                    · {daysBetween(lastCompleted.startAt ?? lastCompleted.endAt)} gün öncə
                  </span>
                  {latestNote?.moodScore && (
                    <span className="pcli-last-mood">· əhval-ruhiyyə {latestNote.moodScore}/10</span>
                  )}
                </div>
                {latestNote?.body && (
                  <p className="pcli-last-note">
                    «{latestNote.body.slice(0, 180)}{latestNote.body.length > 180 ? "…" : ""}»
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Mood trend chart (from notes) ───────────────────────────── */}
          {moodPoints.length >= 2 && (
            <MoodTrendChart points={moodPoints} />
          )}

          {/* ── Original booking note (first appointment's note) ───────────── */}
          {firstNote?.note && (
            <div className="pcli-context">
              <span className="pcli-context-label">📋 İlk müraciət konteksti:</span>
              <span className="pcli-context-text">«{firstNote.note}»</span>
            </div>
          )}

          {/* ── Tabs ────────────────────────────────────────────────────────── */}
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
          </div>

          {tab === "history" && (
            <HistorySection items={sortedHistory} />
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
            />
          )}
        </>
      )}
    </div>
  );
}

/* ─── Summary stat ───────────────────────────────────────────────────────── */

function SummaryStat({
  label, value, sub, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "good" | "brand" | "warn";
}) {
  return (
    <div className="pcli-stat">
      <div className="pcli-stat-label">{label}</div>
      <div className={`pcli-stat-value${accent ? ` is-${accent}` : ""}`}>{value}</div>
      {sub && <div className="pcli-stat-sub">{sub}</div>}
    </div>
  );
}

/* ─── History section ────────────────────────────────────────────────────── */

function HistorySection({ items }: { items: AppointmentDetail[] }) {
  if (items.length === 0) {
    return (
      <div className="pcli-empty">
        <div className="pcli-empty-icon">🌿</div>
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
  const fmt = a.sessionFormat === "ONLINE" ? "Onlayn" : a.sessionFormat === "IN_PERSON" ? "Əyani" : null;
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
          {fmt && <span className="pcli-row-chip">{fmt}</span>}
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
            <strong>⚠ Mübahisə:</strong> «{a.disputeReason}»
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
}) {
  const { notes, filteredNotes, search, setSearch,
          showForm, editing, title, body, mood, saving, error,
          setTitle, setBody, setMood, onSave, onCancel, onEdit, onDelete, onAddNew, onApplyTemplate } = props;

  return (
    <>
      <div className="pcli-encrypt">
        🔒 Bütün qeydlər AES-256-GCM ilə şifrələnir. Yalnız siz oxuya bilərsiniz.
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
              placeholder="🔍 Qeydləri axtar (başlıq və ya mətn)…"
              className="pcli-notes-search"
            />
          )}
        </div>
      )}

      {showForm && (
        <div className="pcli-card pcli-card--form">
          <h3>{editing ? "Qeydi düzəlt" : "Yeni qeyd"}</h3>
          {!editing && (
            <div className="pcli-template-row">
              <label>Şablon:</label>
              {NOTE_TEMPLATES.map(t => (
                <button key={t.key} type="button"
                  onClick={() => onApplyTemplate(t.key)}
                  className="pcli-template-chip">
                  {t.label}
                </button>
              ))}
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
          <div className="pcli-empty-icon">📝</div>
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
