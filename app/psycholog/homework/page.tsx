"use client";

import { useEffect, useState } from "react";
import { psychologistApi, type ClientSummary, type Homework } from "@/lib/api";

export default function PsychologHomeworkPage() {
  const [items, setItems] = useState<Homework[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [patientId, setPatientId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.homework().catch(() => []),
      psychologistApi.clients().catch(() => []),
    ]).then(([h, c]) => { setItems(h); setClients(c); }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const reset = () => { setShowForm(false); setPatientId(""); setTitle(""); setDescription(""); setDueDate(""); setErr(null); };

  const save = async () => {
    if (!patientId) { setErr("Müştəri seçin"); return; }
    if (!title.trim()) { setErr("Başlıq lazımdır"); return; }
    setSaving(true); setErr(null);
    try {
      const created = await psychologistApi.createHomework({
        patientId: Number(patientId), title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
      });
      setItems(prev => [created, ...prev]);
      reset();
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Tapşırığı silmək istəyirsiniz?")) return;
    try { await psychologistApi.deleteHomework(id); setItems(prev => prev.filter(x => x.id !== id)); }
    catch (e) { alert((e as Error).message); }
  };

  return (
    <div>
      <div className="psy-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535" }}>Tapşırıqlar</h1>
          <p style={{ fontSize: 13, color: "#52718F", marginTop: 4 }}>Müştərilərə homework təyin edin və izləyin</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          + Yeni tapşırıq
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Yeni tapşırıq</h3>
          <select value={patientId} onChange={e => setPatientId(e.target.value ? Number(e.target.value) : "")}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8 }}>
            <option value="">— Müştəri seç —</option>
            {clients.map(c => <option key={c.patientId} value={c.patientId}>{c.name}</option>)}
          </select>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Başlıq"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8 }} />
          <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Təsvir / Təlimat"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8, fontFamily: "inherit", resize: "vertical" }} />
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8 }} />
          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 8 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={reset} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer" }}>Ləğv</button>
            <button onClick={save} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Saxlanılır…" : "Saxla"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", padding: 48, borderRadius: 14, textAlign: "center", color: "#52718F" }}>
          Hələ tapşırıq yoxdur.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map(h => (
            <div key={h.id} style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", border: "1px solid #EFF2F7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, fontSize: 11, color: "#52718F" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: h.status === "COMPLETED" ? "#D1FAE5" : h.status === "SKIPPED" ? "#E5E7EB" : "#FEF3C7", color: h.status === "COMPLETED" ? "#065F46" : h.status === "SKIPPED" ? "#52718F" : "#92400E", fontWeight: 700 }}>
                      {h.status}
                    </span>
                    <span>{h.patientName}</span>
                    {h.dueDate && <span>· {h.dueDate}</span>}
                  </div>
                  <div style={{ fontWeight: 700, color: "#1A2535", fontSize: 14 }}>{h.title}</div>
                  {h.description && <div style={{ fontSize: 12, color: "#52718F", marginTop: 4, whiteSpace: "pre-wrap" }}>{h.description}</div>}
                  {h.completionNote && (
                    <div style={{ fontSize: 12, color: "#1A2535", marginTop: 6, padding: "6px 10px", background: "#EEF2FF", borderRadius: 6 }}>
                      Müştəri qeydi: {h.completionNote}
                    </div>
                  )}
                </div>
                <button onClick={() => remove(h.id)} style={{ fontSize: 11, color: "#991B1B", background: "transparent", border: "1px solid #FECACA", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Sil</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
