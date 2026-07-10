"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DatePicker from "@/components/DatePicker";
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
import { azFormatDate } from "@/lib/datetime";
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
  return Math.abs(Math.floor(ms / (1000 * 60 * 60 * 24)));
}
function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

const AVATAR_TINTS = [
  { bg: "#E0EBFA", fg: "#1E3A8A" },
  { bg: "#D1FAE5", fg: "#065F46" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#EDE9FE", fg: "#5B21B6" },
  { bg: "#CCFBF1", fg: "#115E59" },
];
function avatarTint(name?: string | null) {
  const s = name ?? "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

/** Tag color → soft tint (bg / text / border) for inline chips. */
const TAG_TINTS: Record<string, { bg: string; color: string; border: string }> = {
  brand:   { bg: "#E4ECFA", color: "#082F6D", border: "#C7DBF6" },
  good:    { bg: "#D1FAE5", color: "#065F46", border: "#A7F3D0" },
  warn:    { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  danger:  { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
  neutral: { bg: "#F3F4F6", color: "#374151", border: "#E5E7EB" },
  purple:  { bg: "#EDE9FE", color: "#5B21B6", border: "#DDD6FE" },
  teal:    { bg: "#CCFBF1", color: "#115E59", border: "#99F6E4" },
};

const STATUS: Record<string, { label: string; color: string; bg: string; accent: string }> = {
  PENDING:               { label: "Yeni",          color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  ASSIGNED:              { label: "Təyin edilib",  color: "var(--brand-700)", bg: "var(--brand-50)", accent: "var(--brand)" },
  CONFIRMED:             { label: "Təsdiqli",      color: "#065F46",          bg: "#D1FAE5",         accent: "#10B981" },
  AWAITING_CONFIRMATION: { label: "Təsdiq gözl.",  color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  DISPUTED:              { label: "Mübahisəli",    color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  COMPLETED:             { label: "Tamamlandı",    color: "#374151",          bg: "#F3F4F6",         accent: "#9CA3AF" },
  CANCELLED:             { label: "Ləğv",          color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  CANCEL_REQUESTED:      { label: "Ləğv gözlənir", color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
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

type Tab = "overview" | "history" | "packages" | "notes" | "goals";


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
  const [tab, setTab] = useState<Tab>("overview");
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

  // "Seanslar" tabı — yalnız tək (paketsiz) seanslar; paketlilər öz tabındadır.
  const singleAppts = useMemo(
    () => sortedHistory.filter(a => a.patientPackageId == null),
    [sortedHistory],
  );

  // "Paketlər" tabı — patientPackageId üzrə qruplar (ən son aktivliyi olan üstdə).
  const packageGroups = useMemo(() => {
    const map = new Map<number, AppointmentDetail[]>();
    for (const a of appointments) {
      if (a.patientPackageId != null) {
        const arr = map.get(a.patientPackageId) ?? [];
        arr.push(a);
        map.set(a.patientPackageId, arr);
      }
    }
    return Array.from(map.entries())
      .map(([id, appts]) => ({ id, appts: [...appts].sort((x, y) => apptTs(x) - apptTs(y)) }))
      .sort((x, y) => Math.max(...y.appts.map(apptTs)) - Math.max(...x.appts.map(apptTs)));
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
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <style>{`
.m360-2col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.m360-goalgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
@media(max-width:760px){.m360-2col{grid-template-columns:1fr}}
@keyframes m360Fade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes m360Sheet{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.m360-link:hover{text-decoration:underline}
.m360-ghost:hover{border-color:var(--brand) !important;color:var(--brand) !important}
.m360-soft:hover{background:#FEE2E2 !important}
.m360-primary:hover{background:var(--brand-700) !important}
      `}</style>

      <Link href="/psycholog/clients" className="m360-link" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--oxford-60)", textDecoration: "none", marginBottom: 16 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
        Müştərilərə qayıt
      </Link>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)", border: "1px solid #EDF1F8" }}>Yüklənir…</div>
      ) : !client ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)", border: "1px solid #EDF1F8" }}>Müştəri tapılmadı.</div>
      ) : (
        <>
          {/* ── Hero ─────────────────────────────────────────────────────────── */}
          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 22, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
              <span style={{ width: 72, height: 72, borderRadius: 18, background: avatarTint(client.name).bg, color: avatarTint(client.name).fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, flex: "none" }}>{initialsOf(client.name)}</span>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h1 style={{ margin: "0 0 5px", fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", color: "var(--oxford)" }}>{client.name}</h1>
                <div style={{ fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 11 }}>
                  {client.email}{client.phone ? ` · ${client.phone}` : ""}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", fontSize: 13, fontWeight: 600, color: "var(--oxford)", marginBottom: 12 }}>
                  <span><strong style={{ fontWeight: 800 }}>{client.totalSessions}</strong> seans</span>
                  <span style={{ color: "#CBD5E6" }}>·</span>
                  <span><strong style={{ fontWeight: 800 }}>{client.completedSessions}</strong> tamamlanan</span>
                  {client.lastAppointmentAt && <><span style={{ color: "#CBD5E6" }}>·</span><span style={{ color: "var(--oxford-60)" }}>son seans: <strong style={{ fontWeight: 700, color: "var(--oxford)" }}>{fmtShort(client.lastAppointmentAt)}</strong></span></>}
                  {moodFromNotes !== null && <><span style={{ color: "#CBD5E6" }}>·</span><span style={{ color: "var(--oxford-60)" }}>əhval <strong style={{ fontWeight: 800, color: "var(--oxford)" }}>{moodFromNotes}/10</strong></span></>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {client.noShowCount > 0 && <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999 }}>{client.noShowCount} no-show</span>}
                  {client.lateCancelCount > 0 && <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999 }}>{client.lateCancelCount} geç ləğv</span>}
                  {flag && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: flag.tone === "danger" ? "#FEE2E2" : "#FEF3C7", color: flag.tone === "danger" ? "#991B1B" : "#92400E", fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
                      {flag.label}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => { reset(); setShowForm(true); setTab("notes"); }} className="m360-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 16px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 12px rgba(16,81,183,.24)", flex: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>Qeyd əlavə et
              </button>
            </div>

            {/* ── Etiketlər — hero kartının içində (ayrıca kart yığını azaldılıb) ── */}
            <div style={{ borderTop: "1px solid #F0F4FA", marginTop: 16, paddingTop: 14, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford-60)" }}>Etiketlər:</span>
              {tags.length === 0 && !tagPickerOpen && (
                <span style={{ fontSize: 12.5, color: "#A9B8CC", fontWeight: 500 }}>hələ etiket yoxdur</span>
              )}
              {tags.map(t => {
                const tt = TAG_TINTS[t.color] ?? TAG_TINTS.neutral;
                return (
                  <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: tt.bg, color: tt.color, border: `1px solid ${tt.border}`, fontSize: 12.5, fontWeight: 700, padding: "4px 8px 4px 11px", borderRadius: 999 }}>
                    {t.label}
                    <button type="button" onClick={() => removeTag(t.id)} aria-label={`${t.label} sil`}
                      style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.08)", border: "none", borderRadius: "50%", cursor: "pointer", color: "inherit" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </span>
                );
              })}
              {!tagPickerOpen && (
                <button type="button" onClick={() => { setTagPickerOpen(true); setTagError(null); }} className="m360-ghost"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "var(--brand)", border: "1px dashed #B6C9E8", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>+ etiket</button>
              )}
            </div>

            {tagPickerOpen && (
              <div style={{ position: "absolute", left: 0, top: 46, zIndex: 20, width: 330, maxWidth: "100%", background: "#fff", border: "1px solid #E1E9F5", borderRadius: 13, boxShadow: "0 12px 40px rgba(8,47,109,.18)", padding: 15, animation: "m360Fade .18s ease" }}>
                <input value={tagDraft} onChange={e => setTagDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); addTag(tagDraft); }
                    if (e.key === "Escape") { setTagPickerOpen(false); setTagDraft(""); setTagError(null); }
                  }}
                  placeholder="Etiket adı…" autoFocus maxLength={40}
                  style={{ width: "100%", border: "1px solid #D6E2F7", borderRadius: 9, padding: "9px 11px", fontSize: 13.5, fontWeight: 600, color: "var(--oxford)", fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box" }} />
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 8 }}>Rəng</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {TAG_COLORS.map(c => {
                    const sel = tagColor === c.value;
                    return (
                      <button key={c.value} type="button" title={c.label} onClick={() => setTagColor(c.value)}
                        style={{ width: 26, height: 26, borderRadius: 8, background: c.swatch, border: `2px solid ${sel ? "var(--oxford)" : "transparent"}`, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: sel ? 1 : 0 }} aria-hidden><path d="M20 6L9 17l-5-5" /></svg>
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 8 }}>Hazır</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 15 }}>
                  {TAG_PRESETS.filter(p => !tags.some(t => t.label.toLowerCase() === p.toLowerCase())).map(p => (
                    <button key={p} type="button" onClick={() => addTag(p)} disabled={tagSaving} className="m360-ghost"
                      style={{ background: "#F2F6FD", color: "#082F6D", border: "1px solid #E4ECFA", borderRadius: 999, padding: "5px 11px", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>{p}</button>
                  ))}
                </div>
                {tagError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 8, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{tagError}</div>}
                <div style={{ display: "flex", gap: 9 }}>
                  <button type="button" onClick={() => { setTagPickerOpen(false); setTagDraft(""); setTagError(null); }}
                    style={{ flex: 1, background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 9, padding: 9, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Ləğv</button>
                  <button type="button" onClick={() => addTag(tagDraft)} disabled={tagSaving || !tagDraft.trim()} className="m360-primary"
                    style={{ flex: 1, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 9, padding: 9, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>{tagSaving ? "Əlavə olunur…" : "Əlavə et"}</button>
                </div>
              </div>
            )}
            </div>
          </div>

          {/* ── Tabs (pill) — İcmal | Seanslar | Klinik qeydlər | Hədəflər ── */}
          <div role="tablist" style={{ display: "inline-flex", maxWidth: "100%", overflowX: "auto", gap: 4, background: "#fff", border: "1px solid #EDF1F8", borderRadius: 12, padding: 5, boxShadow: "0 2px 12px rgba(0,0,0,.04)", marginBottom: 18 }}>
            {(
              [
                ["overview", "İcmal", null],
                ["history", "Seanslar", singleAppts.length],
                ["packages", "Paketlər", packageGroups.length],
                ["notes", "Klinik qeydlər", notes.length],
                ...(FEATURE_GOALS ? ([["goals", "Hədəflər", goals.length]] as [Tab, string, number | null][]) : []),
              ] as [Tab, string, number | null][]
            ).map(([key, label, count]) => {
              const active = tab === key;
              return (
                <button key={key} type="button" role="tab" aria-selected={active} onClick={() => setTab(key)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, background: active ? "var(--brand)" : "transparent", color: active ? "#fff" : "var(--oxford)", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", flex: "none" }}>
                  {label}
                  {count != null && count > 0 && (
                    <span style={{ background: active ? "rgba(255,255,255,.22)" : "var(--brand-50)", color: active ? "#fff" : "var(--brand-700)", fontSize: 11.5, fontWeight: 700, minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── İcmal tabı — kontekst kartları, böhran, əhval trendi, ilk müraciət ── */}
          {tab === "overview" && (
            <div style={{ animation: "m360Fade .2s ease" }}>
          {(upcoming?.startAt || lastCompleted) && (
            <div className="m360-2col" style={{ marginBottom: 14 }}>
              {upcoming && upcoming.startAt && (
                <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 12 }}>Növbəti seans</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
                    <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--brand-100)", color: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                    </span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--oxford)" }}>{fmtShort(upcoming.startAt)}</div>
                      <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>{fmtTime(new Date(upcoming.startAt))}</div>
                    </div>
                  </div>
                  <Link href="/psycholog/calendar" className="m360-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none" }}>
                    Cədvələ keç<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </Link>
                </div>
              )}
              {lastCompleted && (
                <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 12 }}>Son tamamlanmış seans</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "var(--oxford)" }}>{fmtShort(lastCompleted.startAt ?? lastCompleted.endAt)}</span>
                    <span style={{ background: "#F3F4F6", color: "#374151", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>{daysBetween(lastCompleted.startAt ?? lastCompleted.endAt)} gün öncə</span>
                    {latestNote?.moodScore && (
                      <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>əhval-ruhiyyə {latestNote.moodScore}/10</span>
                    )}
                  </div>
                  {latestNote?.body && (
                    <div style={{ fontSize: 13, color: "var(--oxford)", fontStyle: "italic", fontWeight: 500, lineHeight: 1.5, background: "#F8FAFD", borderRadius: 9, padding: "10px 12px" }}>«{latestNote.body.slice(0, 180)}{latestNote.body.length > 180 ? "…" : ""}»</div>
                  )}
                </div>
              )}
            </div>
          )}

          {crisis.length > 0 && <CrisisHistoryCard items={crisis} />}

          {moodPoints.length >= 2 && <MoodTrendChart points={moodPoints} />}

          {firstNote?.note && (
            <div style={{ background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 12, padding: "13px 16px", marginBottom: 18, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9DB0CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }} aria-hidden><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 500, lineHeight: 1.5 }}>
                <strong style={{ color: "var(--oxford)", fontWeight: 700 }}>İlk müraciət konteksti:</strong> <span style={{ fontStyle: "italic" }}>«{firstNote.note}»</span>
              </span>
            </div>
          )}

          {/* Heç bir icmal məlumatı yoxdursa boş vəziyyət */}
          {!upcoming?.startAt && !lastCompleted && crisis.length === 0 && moodPoints.length < 2 && !firstNote?.note && (
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "32px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>Hələ icmal üçün məlumat azdır</div>
              <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: 0 }}>Seanslar keçirildikcə növbəti seans, əhval tendensiyası və son qeyd burada görünəcək.</p>
            </div>
          )}
            </div>
          )}

          {tab === "history" && (
            <SessionsSection items={singleAppts} />
          )}

          {tab === "packages" && (
            <div style={{ animation: "m360Fade .2s ease" }}>
              {packageGroups.length === 0 ? (
                <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "32px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>Bu müştərinin paketi yoxdur</div>
                  <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: 0 }}>Paket alındıqda proqram və seansları burada görünəcək.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {packageGroups.map(p => <PackageProgramCard key={p.id} appts={p.appts} />)}
                </div>
              )}
            </div>
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
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 15, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: "#FEE2E2", color: "#991B1B", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>Böhran check-in tarixçəsi</span>
        </div>
        <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>
          Son 30 gündə <strong style={{ color: "var(--oxford)" }}>{recent.length} check-in</strong>
          {lowCount > 0 && <> · <strong style={{ color: "#991B1B" }}>{lowCount} aşağı əhval</strong></>}
        </span>
      </div>
      <svg viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" style={{ width: "100%", height: 40, display: "block", marginBottom: 14 }}>
        <line x1="0" y1={sparkH - 5} x2={sparkW} y2={sparkH - 5} stroke="#FCA5A5" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.6" />
        {dots.length > 1 && (
          <path d={path} fill="none" stroke="var(--brand)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="3"
            fill={d.mood <= 2 ? "#DC2626" : d.mood === 3 ? "#F59E0B" : "#10B981"}>
            <title>{`${d.mood}/5 · ${azFormatDate(d.ts)}`}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {recent.slice(0, 5).map(c => {
          const low = c.moodScore <= 2, mid = c.moodScore === 3;
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ background: low ? "#FEE2E2" : mid ? "#FEF3C7" : "#D1FAE5", color: low ? "#991B1B" : mid ? "#92400E" : "#065F46", fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 8, flex: "none" }}>{c.moodScore}/5</span>
              {c.note
                ? <span style={{ flex: 1, fontSize: 13, color: "var(--oxford)", fontStyle: "italic", fontWeight: 500 }}>«{c.note}»</span>
                : <span style={{ flex: 1, fontSize: 13, color: "#A9B8CC", fontWeight: 500 }}>Qeyd yoxdur</span>}
              <span style={{ fontSize: 12, color: "#9DB0CC", fontWeight: 600, flex: "none" }}>{fmtDateTime(c.createdAt)}</span>
            </div>
          );
        })}
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
    <div style={{ animation: "m360Fade .2s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>Terapiya hədəfləri</span>
        <button onClick={onCreate} className="m360-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 15px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>Yeni hədəf
        </button>
      </div>

      {goals.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>Hələ hədəf əlavə edilməyib</div>
          <div style={{ fontSize: 13, color: "var(--oxford-60)", maxWidth: 460, margin: "0 auto", lineHeight: 1.5 }}>
            Hədəf əlavə edərək müştərinin inkişafını ölçə bilərsiniz: «anksiyetə hücumlarını azaltmaq», «gündəlik rituallar yaratmaq» və s.
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
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 11 }}>{title} <span style={{ color: "#A9B8CC" }}>{goals.length}</span></div>
      <div className="m360-goalgrid">
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
  const achieved = g.status === "ACHIEVED";
  const miniBtn: React.CSSProperties = { borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: "#fff" };
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 17, opacity: achieved ? 0.85 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 9, marginBottom: 8 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--oxford)" }}>{g.title}</div>
        <span style={{ background: meta.bg, color: meta.fg, border: `1px solid ${meta.border}`, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, flex: "none" }}>{meta.label}</span>
      </div>
      {g.description && <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, lineHeight: 1.5, marginBottom: 13 }}>{g.description}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 8, background: achieved ? "#D1FAE5" : "var(--brand-100)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${g.progressPct}%`, height: "100%", background: achieved ? "#10B981" : "linear-gradient(90deg,#1051B7,#3A74D6)", borderRadius: 999 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: achieved ? "#065F46" : "#082F6D" }}>{g.progressPct}%</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: overdue ? 700 : 600, color: overdue ? "#991B1B" : "var(--oxford-60)" }}>
          {g.achievedAt
            ? `Tamamlandı: ${fmtShort(g.achievedAt)}`
            : g.targetDate ? `Hədəf: ${fmtShort(g.targetDate)}${overdue ? " · gecikib" : ""}` : "—"}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onEdit} className="m360-ghost" style={{ ...miniBtn, color: "#082F6D", border: "1px solid #D6E2F7" }}>Redaktə</button>
          <button onClick={onDelete} className="m360-soft" style={{ ...miniBtn, color: "#991B1B", border: "1px solid #F3D6D6" }}>Sil</button>
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

  const mLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 };
  const mInput: React.CSSProperties = { width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 13px", fontSize: 14, fontWeight: 600, color: "var(--oxford)", fontFamily: "inherit", boxSizing: "border-box", background: "#fff" };
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(10,26,51,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(8,47,109,.3)", overflow: "hidden", animation: "m360Sheet .22s ease" }}>
        <div style={{ background: "linear-gradient(135deg,#F2F6FD,#E4ECFA)", borderBottom: "1px solid #D6E2F7", padding: "18px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#082F6D" }}>{goal ? "Hədəfi redaktə et" : "Yeni hədəf"}</div>
            <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 2 }}>Pasient üçün terapiya hədəfi {goal ? "yeniləyin" : "yaradın"}.</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.7)", border: "none", borderRadius: 8, cursor: "pointer", flex: "none" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13 }}>
          <label><span style={mLabel}>Başlıq *</span>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Məs. Anksiyetə hücumlarını azaltmaq" style={mInput} />
          </label>
          <label><span style={mLabel}>Təsvir</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="İstifadə olunan strategiya, ölçü meyarları…" style={{ ...mInput, fontWeight: 500, fontSize: 13.5, resize: "vertical", lineHeight: 1.5 }} />
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ flex: 1 }}><span style={mLabel}>Hədəf tarixi</span>
              <DatePicker value={targetDate ?? ""} onChange={setTargetDate} theme="light" size="sm" style={{ width: "100%" }} />
            </label>
            <label style={{ flex: 1 }}><span style={mLabel}>Status</span>
              <div style={{ position: "relative" }}>
                <select value={status} onChange={e => setStatus(e.target.value as PatientGoalStatus)} style={{ ...mInput, fontSize: 13.5, appearance: "none", WebkitAppearance: "none", paddingRight: 34, cursor: "pointer" }}>
                  <option value="OPEN">Açıq</option>
                  <option value="IN_PROGRESS">Davam edir</option>
                  <option value="ACHIEVED">Çatdı</option>
                  <option value="ABANDONED">Tərk edilib</option>
                </select>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} aria-hidden><path d="M6 9l6 6 6-6" /></svg>
              </div>
            </label>
          </div>
          {status !== "ACHIEVED" && (
            <label><span style={mLabel}>İrəliləyiş: <strong style={{ color: "#082F6D" }}>{progressPct}%</strong></span>
              <input type="range" min={0} max={100} step={5} value={progressPct} onChange={e => setProgressPct(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--brand)" }} />
            </label>
          )}
          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12 }}>{err}</div>}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "16px 20px", borderTop: "1px solid #F0F4FA" }}>
          <button onClick={onClose} style={{ flex: 1, background: "#fff", color: "#082F6D", border: "1px solid #D6E2F7", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Bağla</button>
          <button onClick={save} disabled={saving} className="m360-primary" style={{ flex: 1, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "Saxlanılır…" : (goal ? "Yenilə" : "Yarat")}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Seanslar tabı — tək seanslar kart görünüşündə ──────────────────────── */

const apptTs = (a: AppointmentDetail) => new Date(a.startAt ?? a.endAt ?? a.createdAt).getTime();

function SessionsSection({ items }: { items: AppointmentDetail[] }) {
  if (items.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "32px 24px", textAlign: "center", animation: "m360Fade .2s ease" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>Tək seans yoxdur</div>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: 0 }}>Bu müştəri ilə paketdən kənar seans təyin olunduqda burada görünəcək.</p>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, alignItems: "start", animation: "m360Fade .2s ease" }}>
      {items.map(a => <SessionCard360 key={a.id} a={a} />)}
    </div>
  );
}

/* Seans kartı — randevu səhifələrindəki kart dili ilə (yalnız oxu). */
function SessionCard360({ a }: { a: AppointmentDetail }) {
  const st = STATUS[a.status] ?? STATUS.ASSIGNED;
  const when = a.startAt ?? a.requestedStartAt ?? a.createdAt;
  const d = new Date(when);
  const hasBadges = (!!a.cancelReasonCode && a.cancelReasonCode.includes("NO_SHOW"))
    || !!a.lateCancel
    || (a.status === "COMPLETED" && (!!a.autoConfirmedAt || (!!a.patientConfirmedAt && !!a.psychologistConfirmedAt)));
  return (
    <div className="psy-card" style={{ borderLeft: `3px solid ${st.accent}`, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span className="psy-card__time">{fmtShort(when)} · {fmtTime(d)}</span>
        <span className="psy-card__badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
      </div>
      {hasBadges && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <SessionBadges a={a} />
        </div>
      )}
      <SessionDetail a={a} />
    </div>
  );
}

/** Kiçik nişan (pill) stili — təkrar üçün. */
const miniPill = (bg: string, color: string) => ({ background: bg, color, fontSize: 10.5, fontWeight: 700 as const, padding: "3px 9px", borderRadius: 999 });

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8AAABF", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: danger ? "#991B1B" : "var(--oxford)" }}>{value}</div>
    </div>
  );
}

/** Seansın əlavə nişanları (geç ləğv / təsdiq tipi). */
function SessionBadges({ a }: { a: AppointmentDetail }) {
  const done = a.status === "COMPLETED";
  const noShow = !!a.cancelReasonCode && a.cancelReasonCode.includes("NO_SHOW");
  return (
    <>
      {noShow && <span style={miniPill("#FEE2E2", "#991B1B")}>No-show</span>}
      {a.lateCancel && <span style={miniPill("#FEF3C7", "#92400E")}>Geç ləğv</span>}
      {done && a.autoConfirmedAt && <span style={miniPill("#F2F6FD", "#082F6D")}>Auto-təsdiq</span>}
      {done && a.patientConfirmedAt && a.psychologistConfirmedAt && !a.autoConfirmedAt && (
        <span style={miniPill("#D1FAE5", "#065F46")}>Qarşılıqlı təsdiq</span>
      )}
    </>
  );
}

/** Seansa aid mətn detalları (qeyd / ləğv / mübahisə / operator notu) — paket sətri və timeline üçün ortaq. */
function SessionDetail({ a }: { a: AppointmentDetail }) {
  const cancelledBy = a.cancelledBy === "PATIENT" ? "Pasient ləğv etdi"
    : a.cancelledBy === "PSYCHOLOGIST" ? "Psixoloq ləğv etdi"
    : a.cancelledBy === "OPERATOR" ? "Operator ləğv etdi" : "Ləğv edildi";
  return (
    <>
      {a.note && (
        <div style={{ fontSize: 12.5, color: "var(--oxford)", fontStyle: "italic", fontWeight: 500, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 8, padding: "7px 10px", marginTop: 7, lineHeight: 1.45 }}>«{a.note}»</div>
      )}
      {a.status === "CANCELLED" && (
        <div style={{ fontSize: 12, color: "#991B1B", fontWeight: 600, marginTop: 6 }}>
          Ləğv: {cancelledBy}
          {a.cancelReasonCode && <> · «{REASON_LABELS[a.cancelReasonCode] ?? a.cancelReasonCode}»</>}
          {a.cancelledAt && <> · {fmtDateTime(a.cancelledAt)}</>}
        </div>
      )}
      {a.cancelReasonText && (
        <div style={{ fontSize: 12, color: "var(--oxford-60)", fontStyle: "italic", fontWeight: 500, marginTop: 4 }}>«{a.cancelReasonText}»</div>
      )}
      {a.status === "DISPUTED" && a.disputeReason && (
        <div style={{ fontSize: 12.5, color: "#991B1B", fontWeight: 600, marginTop: 6 }}><strong>Mübahisə:</strong> «{a.disputeReason}»</div>
      )}
      {a.operatorNote && (
        <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginTop: 6, display: "flex", alignItems: "flex-start", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8AAABF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }} aria-hidden><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
          <span><strong style={{ color: "var(--oxford)" }}>Operator:</strong> {a.operatorNote}</span>
        </div>
      )}
    </>
  );
}

/** Paket = vahid proqram kartı: ad + sayğac + gedişat + stat + nömrəli seans sətirləri (+ qalan yerlər). */
function PackageProgramCard({ appts }: { appts: AppointmentDetail[] }) {
  const name = appts[0]?.packageName || "Paket";
  const total = appts[0]?.packageTotal ?? appts.length;
  const completed = appts.filter(a => a.status === "COMPLETED").length;
  const cancelled = appts.filter(a => a.status === "CANCELLED").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(0, total - appts.length);
  const dated = appts.filter(a => a.startAt);
  const rangeFrom = dated.length ? fmtShort(dated[0].startAt) : "—";
  const rangeTo = dated.length ? fmtShort(dated[dated.length - 1].startAt) : "—";

  return (
    <div style={{ background: "linear-gradient(180deg,#F8FBFF,#fff 120px)", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #E4ECFA", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand-100)", color: "var(--brand-700)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 7, marginBottom: 9 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" />
            </svg>
            Paket
          </span>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--oxford)" }}>{name}</div>
        </div>
        <span style={{ background: "#F2F6FD", border: "1px solid #D6E2F7", color: "#082F6D", fontSize: 21, fontWeight: 800, padding: "6px 14px", borderRadius: 11, flex: "none" }}>
          {completed}<span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford-60)" }}>/{total}</span>
        </span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#082F6D" }}>Gedişat</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--oxford-60)" }}>{pct}%</span>
        </div>
        <div style={{ height: 9, background: "#E4ECFA", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#1051B7,#3A74D6)", borderRadius: 999 }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "11px 0", borderTop: "1px solid #EDF1F8", borderBottom: "1px solid #EDF1F8", marginBottom: 14 }}>
        <Stat label="Aralıq" value={`${rangeFrom} – ${rangeTo}`} />
        <Stat label="Seans" value={String(total)} />
        {cancelled > 0 && <Stat label="Ləğv" value={String(cancelled)} danger />}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {appts.map((a, i) => (
          <PackageSessionRow key={a.id} a={a} index={i + 1} last={i === appts.length - 1 && remaining === 0} />
        ))}
        {Array.from({ length: remaining }).map((_, i) => (
          <PackageRemainingRow key={`rem-${i}`} index={appts.length + i + 1} last={i === remaining - 1} />
        ))}
      </div>
    </div>
  );
}

function PackageSessionRow({ a, index, last }: { a: AppointmentDetail; index: number; last: boolean }) {
  const st = STATUS[a.status] ?? STATUS.ASSIGNED;
  const when = a.startAt ?? a.requestedStartAt;
  const d = when ? new Date(when) : null;
  const isCancelled = a.status === "CANCELLED";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "10px 0", borderBottom: last ? "none" : "1px solid #F4F7FB" }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, background: st.bg, color: st.color, fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", marginTop: 1 }}>{index}</span>
      <div style={{ width: 96, flex: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isCancelled ? "#991B1B" : "var(--oxford)" }}>{d ? `${pad2(d.getDate())} ${MONTHS_AZ[d.getMonth()]}` : "—"}</div>
        <div style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600 }}>{d ? fmtTime(d) : "planlaşmayıb"}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ ...miniPill(st.bg, st.color), fontSize: 11 }}>{st.label}</span>
          <SessionBadges a={a} />
        </div>
        <SessionDetail a={a} />
      </div>
    </div>
  );
}

function PackageRemainingRow({ index, last }: { index: number; last: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "10px 0", borderBottom: last ? "none" : "1px solid #F4F7FB" }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, background: "#fff", border: "1.5px solid #D6E2F7", color: "#9DB0CC", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", marginTop: 1 }}>{index}</span>
      <div style={{ width: 96, flex: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford-60)" }}>—</div>
        <div style={{ fontSize: 11.5, color: "#9DB0CC", fontWeight: 600 }}>planlaşmayıb</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={miniPill("#F2F6FD", "#082F6D")}>Qalıb</span>
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
    <div style={{ animation: "m360Fade .2s ease" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#F2F6FD", border: "1px solid #D9E6FA", borderRadius: 11, padding: "12px 14px", marginBottom: 14 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        <span style={{ fontSize: 12.5, color: "#082F6D", fontWeight: 600, lineHeight: 1.45 }}>Bütün qeydlər AES-256-GCM ilə şifrələnir. Yalnız siz oxuya bilərsiniz.</span>
      </div>

      {!showForm && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <button onClick={onAddNew} className="m360-primary" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 15px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>Yeni qeyd
          </button>
          {notes.length > 0 && (
            <div style={{ position: "relative", flex: 1, minWidth: 180, maxWidth: 300 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9DB0CC" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} aria-hidden><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Qeydləri axtar…" style={{ width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "9px 12px 9px 36px", fontSize: 13.5, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #C7DBF6", borderTop: "3px solid var(--brand)", padding: 18, marginBottom: 16 }}>
          {!editing && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
              {NOTE_TEMPLATES.map(t => (
                <button key={t.key} type="button" onClick={() => onApplyTemplate(t.key)}
                  style={{ background: "#E4ECFA", color: "#082F6D", fontSize: 12, fontWeight: 600, padding: "6px 11px", borderRadius: 999, border: "none", fontFamily: "inherit", cursor: "pointer" }}>{t.label}</button>
              ))}
              {customTemplates.map(tpl => (
                <span key={tpl.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#E4ECFA", color: "#082F6D", fontSize: 12, fontWeight: 600, padding: "6px 11px", borderRadius: 999 }}>
                  <button type="button" onClick={() => onApplyTemplate(`custom:${tpl.id}`)} style={{ background: "none", border: "none", color: "inherit", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", padding: 0 }}>{tpl.name}</button>
                  <button type="button" onClick={() => onDeleteCustomTemplate(tpl.id)} title="Şablonu sil" style={{ width: 15, height: 15, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(8,47,109,.12)", border: "none", borderRadius: "50%", color: "#082F6D", cursor: "pointer", padding: 0 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
              <button type="button" onClick={onCreateTemplate} className="m360-ghost"
                style={{ background: "#fff", color: "var(--oxford-60)", border: "1.5px dashed #C7D3E6", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>+ Yeni şablon</button>
            </div>
          )}
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Başlıq (məcburi deyil)"
            style={{ width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 13px", fontSize: 14.5, fontWeight: 700, color: "var(--oxford)", fontFamily: "inherit", marginBottom: 11, boxSizing: "border-box" }} />
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Seans qeydləri burada saxlanır — yalnız siz görə bilərsiniz."
            style={{ width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "12px 13px", fontSize: 13.5, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6, marginBottom: 12, boxSizing: "border-box" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--oxford-60)" }}>Əhval-ruhiyyə (1–10)</span>
              <input type="number" min={1} max={10} value={mood}
                onChange={e => { const v = e.target.value; setMood(v === "" ? "" : Math.max(1, Math.min(10, Number(v)))); }}
                style={{ width: 64, border: "1px solid #D6E2F7", borderRadius: 9, padding: "8px 10px", fontSize: 14, fontWeight: 700, color: "var(--oxford)", fontFamily: "inherit" }} />
            </label>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={onCancel} style={{ background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Ləğv</button>
              <button onClick={onSave} disabled={saving} className="m360-primary" style={{ background: "var(--brand)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "wait" : "pointer" }}>{saving ? "Saxlanılır…" : (editing ? "Yenilə" : "Saxla")}</button>
            </div>
          </div>
          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 12 }}>{error}</div>}
        </div>
      )}

      {notes.length === 0 && !showForm ? (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>Hələ klinik qeyd yoxdur</div>
          <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: 0 }}>Bu müştəri üçün ilk qeydinizi yazın.</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EDF1F8", padding: 24, textAlign: "center", fontSize: 13, color: "var(--oxford-60)" }}>«{search}» üzrə uyğun qeyd tapılmadı.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredNotes.map(n => (
            <div key={n.id} style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 17 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 9 }}>
                <div>
                  {n.title && <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--oxford)" }}>{n.title}</div>}
                  <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginTop: n.title ? 2 : 0 }}>
                    {fmtDateTime(n.createdAt)}
                    {n.updatedAt && n.updatedAt !== n.createdAt && ` · düzəldildi ${fmtDateTime(n.updatedAt)}`}
                    {typeof n.moodScore === "number" && ` · əhval-ruhiyyə ${n.moodScore}/10`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flex: "none" }}>
                  <button onClick={() => onEdit(n)} className="m360-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "#082F6D", border: "1px solid #D6E2F7", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Düzəlt</button>
                  <button onClick={() => onDelete(n.id)} className="m360-soft" style={{ background: "#fff", color: "#991B1B", border: "1px solid #F3D6D6", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Sil</button>
                </div>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--oxford)", fontWeight: 500, lineHeight: 1.6, whiteSpace: "pre-line" }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
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
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>Əhval-ruhiyyə tendensiyası</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: trendTone === "good" ? "#D1FAE5" : trendTone === "warn" ? "#FEF3C7" : "#F3F4F6", color: trendTone === "good" ? "#065F46" : trendTone === "warn" ? "#92400E" : "#374151", fontSize: 12, fontWeight: 700, padding: "4px 11px", borderRadius: 999 }}>{trendLabel}</span>
      </div>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "auto", display: "block" }}>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, fontSize: 11.5, color: "#9DB0CC", fontWeight: 600 }}>
        <span>{azFormatDate(first.date)}</span>
        <span>{points.length} qeyd</span>
        <span>{azFormatDate(last.date)}</span>
      </div>
    </div>
  );
}
