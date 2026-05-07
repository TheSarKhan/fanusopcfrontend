"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { psychologistApi, type ClientNote, type ClientSummary } from "@/lib/api";

function fmt(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function PatientNotesPage() {
  const params = useParams<{ patientId: string }>();
  const patientId = Number(params.patientId);

  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [client, setClient] = useState<ClientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClientNote | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.notesForPatient(patientId).catch(() => []),
      psychologistApi.clients().then(list => list.find(c => c.patientId === patientId) ?? null).catch(() => null),
    ]).then(([n, c]) => { setNotes(n); setClient(c); }).finally(() => setLoading(false));
  };

  useEffect(() => { if (Number.isFinite(patientId)) load(); /* eslint-disable-next-line */ }, [patientId]);

  const reset = () => {
    setEditing(null); setTitle(""); setBody(""); setMood(""); setShowForm(false); setError(null);
  };

  const startEdit = (n: ClientNote) => {
    setEditing(n);
    setTitle(n.title ?? "");
    setBody(n.body);
    setMood(n.moodScore ?? "");
    setShowForm(true);
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

  const avgMood = useMemo(() => {
    const arr = notes.map(n => n.moodScore).filter((x): x is number => typeof x === "number");
    if (!arr.length) return null;
    return (arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(1);
  }, [notes]);

  return (
    <div>
      <a href="/psycholog/clients" style={{ color: "#52718F", textDecoration: "none", fontSize: 13 }}>← Müştərilərə qayıt</a>

      <div style={{ marginTop: 12, marginBottom: 20, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535" }}>
            {client?.name ?? "Müştəri"}
          </h1>
          <p style={{ fontSize: 13, color: "#52718F", marginTop: 4 }}>
            {client?.email}{client?.phone ? ` · ${client.phone}` : ""}
            {client && ` · ${client.totalSessions} seans`}
            {avgMood && ` · orta ovqat ${avgMood}/10`}
          </p>
        </div>
        <button onClick={() => { reset(); setShowForm(true); }}
          style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#1a1040,#2d1b69)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          + Qeyd əlavə et
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1A2535", marginBottom: 12 }}>
            {editing ? "Qeydi düzəlt" : "Yeni qeyd"}
          </h3>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Başlıq (məcburi deyil)"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8 }} />
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
            placeholder="Seans qeydləri burada saxlanır — yalnız siz görə bilərsiniz."
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8, fontFamily: "inherit", resize: "vertical" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#52718F" }}>Ovqat (1–10):</label>
            <input type="number" min={1} max={10} value={mood}
              onChange={e => { const v = e.target.value; setMood(v === "" ? "" : Math.max(1, Math.min(10, Number(v)))); }}
              style={{ width: 80, padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
          </div>
          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={reset} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>Ləğv</button>
            <button onClick={save} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg,#1a1040,#2d1b69)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saxlanılır…" : (editing ? "Yenilə" : "Saxla")}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: "#EEF2FF", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#3730A3", marginBottom: 12 }}>
        🔒 Bütün qeydlər AES-256-GCM ilə server tərəfində şifrələnərək saxlanır. Yalnız siz oxuya bilərsiniz.
      </div>

      {loading ? (
        <div style={{ background: "#fff", padding: 30, borderRadius: 12, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : notes.length === 0 ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 12, textAlign: "center", color: "#52718F" }}>
          Bu müştəri üçün hələ qeyd yoxdur.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {notes.map(n => (
            <div key={n.id} style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", border: "1px solid #EFF2F7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  {n.title && <div style={{ fontWeight: 700, color: "#1A2535", fontSize: 14, marginBottom: 2 }}>{n.title}</div>}
                  <div style={{ fontSize: 11, color: "#8AAABF" }}>
                    {fmt(n.createdAt)}
                    {n.updatedAt && n.updatedAt !== n.createdAt && ` · düzəldildi ${fmt(n.updatedAt)}`}
                    {typeof n.moodScore === "number" && ` · ovqat ${n.moodScore}/10`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => startEdit(n)} style={{ fontSize: 11, color: "#52718F", background: "transparent", border: "1px solid #E5E7EB", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Düzəlt</button>
                  <button onClick={() => remove(n.id)} style={{ fontSize: 11, color: "#991B1B", background: "transparent", border: "1px solid #FECACA", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Sil</button>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#1A2535", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
