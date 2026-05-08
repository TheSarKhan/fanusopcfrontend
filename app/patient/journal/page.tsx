"use client";

import { useEffect, useMemo, useState } from "react";
import { patientApi, type JournalEntry, type MoodTrend } from "@/lib/api";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(date: string) {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

const MOOD_COLOR = (m: number | null | undefined) => {
  if (m == null) return "#E5E7EB";
  if (m <= 3) return "#DC2626";
  if (m <= 5) return "#F59E0B";
  if (m <= 7) return "#3B82F6";
  return "#10B981";
};

export default function PatientJournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [trend, setTrend] = useState<MoodTrend | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [mood, setMood] = useState<number | "">(7);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      patientApi.journalList().then(r => ({ ok: true, data: r as JournalEntry[] })).catch(() => ({ ok: false, data: [] as JournalEntry[] })),
      patientApi.journalTrend(30).then(r => ({ ok: true, data: r as MoodTrend })).catch(() => ({ ok: false as boolean, data: null as MoodTrend | null })),
    ]).then(([listRes, trendRes]) => {
      // Only overwrite on success — transient errors shouldn't blank the screen
      if (listRes.ok) setEntries(listRes.data);
      if (trendRes.ok) setTrend(trendRes.data);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const reset = () => {
    setEditing(null); setShowForm(false);
    setDate(todayIso()); setMood(7); setTitle(""); setBody(""); setErr(null);
  };

  const startEdit = (e: JournalEntry) => {
    setEditing(e); setDate(e.entryDate); setMood(e.moodScore ?? "");
    setTitle(e.title ?? ""); setBody(e.body ?? "");
    setShowForm(true);
  };

  const save = async () => {
    if (!date) { setErr("Tarix seçin"); return; }
    if (!body.trim() && !title.trim() && mood === "") { setErr("Ən azı bir sahə doldurun"); return; }
    setSaving(true); setErr(null);
    try {
      const payload = {
        entryDate: date,
        moodScore: typeof mood === "number" ? mood : null,
        title: title.trim() || null,
        body: body.trim() || null,
      };
      if (editing) {
        const updated = await patientApi.updateJournal(editing.id, payload);
        setEntries(prev => prev.map(x => x.id === updated.id ? updated : x));
      } else {
        const created = await patientApi.createJournal(payload);
        setEntries(prev => [created, ...prev]);
      }
      // Refresh trend
      patientApi.journalTrend(30).then(setTrend).catch(() => {});
      reset();
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Bu qeydi silmək istəyirsiniz?")) return;
    try {
      await patientApi.deleteJournal(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      patientApi.journalTrend(30).then(setTrend).catch(() => {});
    } catch (e) { alert((e as Error).message); }
  };

  const headerStat = useMemo(() => {
    if (!trend) return null;
    return { avg7: trend.averageLast7, avg30: trend.averageLast30, total: trend.totalEntries };
  }, [trend]);

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A2535" }}>Şəxsi Jurnal</h1>
          <p style={{ fontSize: 13, color: "#52718F", marginTop: 4 }}>
            Hisslərinizi gündəlik qeyd edin. Yalnız sizə görünür.
          </p>
        </div>
        <button onClick={() => { reset(); setShowForm(true); }}
          style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          + Yeni qeyd
        </button>
      </div>

      {/* Stats */}
      {headerStat && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Stat label="Son 7 gün ortalama" value={headerStat.avg7?.toFixed(1) ?? "—"} suffix="/10" color="var(--brand)" />
          <Stat label="Son 30 gün ortalama" value={headerStat.avg30?.toFixed(1) ?? "—"} suffix="/10" color="#3B82F6" />
          <Stat label="Cəmi qeyd" value={String(headerStat.total)} color="#065F46" />
        </div>
      )}

      {/* Mood chart */}
      {trend && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2535", marginBottom: 12 }}>Son 30 günlük ovqat</h2>
          <MoodChart data={trend.daily} />
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1A2535", marginBottom: 12 }}>
            {editing ? "Qeydi düzəlt" : "Yeni qeyd"}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8, marginBottom: 12 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }} />
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Başlıq (məcburi deyil)"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#52718F", fontWeight: 600, display: "block", marginBottom: 6 }}>
              Ovqat: {mood === "" ? "—" : `${mood}/10`}
            </label>
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <button key={n} type="button" onClick={() => setMood(n)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 6,
                    border: mood === n ? `2px solid ${MOOD_COLOR(n)}` : "1px solid #E5E7EB",
                    background: mood === n ? MOOD_COLOR(n) : "#fff",
                    color: mood === n ? "#fff" : "#1A2535",
                    fontWeight: 600, fontSize: 12, cursor: "pointer",
                  }}>{n}</button>
              ))}
            </div>
          </div>

          <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
            placeholder="Bu gün necə hiss edirsiniz?"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 12, fontFamily: "inherit", resize: "vertical" }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={reset} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>Ləğv</button>
            <button onClick={save} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saxlanılır…" : (editing ? "Yenilə" : "Saxla")}
            </button>
          </div>
        </div>
      )}

      {/* Entries list */}
      {loading ? (
        <div style={{ background: "#fff", padding: 30, borderRadius: 14, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : entries.length === 0 ? (
        <div style={{ background: "#fff", padding: 48, borderRadius: 14, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📝</div>
          <div style={{ fontWeight: 600, color: "#1A2535", marginBottom: 4 }}>Hələ qeyd yoxdur</div>
          <p style={{ fontSize: 13, color: "#52718F" }}>İlk qeydinizi yazıb hisslərinizi izləməyə başlayın.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {entries.map(e => (
            <div key={e.id} style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", border: "1px solid #EFF2F7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <div style={{ fontSize: 11, color: "#52718F", fontWeight: 600 }}>{fmt(e.entryDate)}</div>
                    {typeof e.moodScore === "number" && (
                      <span style={{ background: MOOD_COLOR(e.moodScore), color: "#fff", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                        {e.moodScore}/10
                      </span>
                    )}
                  </div>
                  {e.title && <div style={{ fontSize: 14, fontWeight: 700, color: "#1A2535" }}>{e.title}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => startEdit(e)} style={{ fontSize: 11, color: "#52718F", background: "transparent", border: "1px solid #E5E7EB", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Düzəlt</button>
                  <button onClick={() => remove(e.id)} style={{ fontSize: 11, color: "#991B1B", background: "transparent", border: "1px solid #FECACA", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Sil</button>
                </div>
              </div>
              {e.body && <div style={{ fontSize: 13, color: "#1A2535", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{e.body}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, suffix, color }: { label: string; value: string; suffix?: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 11, color: "#52718F", fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 4 }}>
        {value}{suffix && <span style={{ fontSize: 14, color: "#8AAABF", marginLeft: 2 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function MoodChart({ data }: { data: { date: string; averageMood: number | null; entryCount: number }[] }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 100 }}>
        {data.map((d, i) => {
          const h = d.averageMood != null ? (d.averageMood / 10) * 100 : 0;
          return (
            <div key={i} title={`${d.date}: ${d.averageMood ?? "—"}/10 (${d.entryCount} qeyd)`}
              style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", position: "relative" }}>
              <div style={{ width: "100%", background: MOOD_COLOR(d.averageMood), borderRadius: 2, height: `${Math.max(0, h)}%`, minHeight: d.averageMood != null ? 3 : 0, opacity: d.entryCount > 0 ? 1 : 0.3 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#8AAABF" }}>
        <span>{data[0]?.date}</span>
        <span>bu gün</span>
      </div>
    </div>
  );
}
