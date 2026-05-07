"use client";

import { useEffect, useState } from "react";
import { psychologistApi, type ClientSummary, type FollowupTemplate, type ResourceItem } from "@/lib/api";

export default function PsychologResourcesPage() {
  const [tab, setTab] = useState<"resources" | "templates">("resources");

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535", marginBottom: 6 }}>Resurslar & Template-lər</h1>
      <p style={{ fontSize: 13, color: "#52718F", marginBottom: 16 }}>
        Müştərilərə yollamaq üçün material kitabxanası və follow-up template-ləri
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["resources", "templates"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: tab === t ? "2px solid #5A4FC8" : "1px solid #E5E7EB",
              background: tab === t ? "#EEECFB" : "#fff", color: tab === t ? "#5A4FC8" : "#52718F",
              cursor: "pointer",
            }}>
            {t === "resources" ? "📚 Resurs kitabxanası" : "🔁 Follow-up template-ləri"}
          </button>
        ))}
      </div>

      {tab === "resources" ? <ResourcesTab /> : <TemplatesTab />}
    </div>
  );
}

function ResourcesTab() {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [resourceType, setResourceType] = useState<"FILE" | "LINK" | "ARTICLE">("LINK");
  const [shareFor, setShareFor] = useState<ResourceItem | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.resources().catch(() => []),
      psychologistApi.clients().catch(() => []),
    ]).then(([r, c]) => { setItems(r); setClients(c); }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const reset = () => { setShowForm(false); setTitle(""); setDescription(""); setExternalUrl(""); setResourceType("LINK"); };

  const save = async () => {
    if (!title.trim()) return;
    try {
      const created = await psychologistApi.createResource({
        title: title.trim(),
        description: description.trim() || undefined,
        externalUrl: resourceType === "LINK" ? externalUrl.trim() || undefined : undefined,
        fileUrl: resourceType === "FILE" ? externalUrl.trim() || undefined : undefined,
        resourceType,
      });
      setItems(prev => [created, ...prev]);
      reset();
    } catch (e) { alert((e as Error).message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Silmək istəyirsiniz?")) return;
    try { await psychologistApi.deleteResource(id); setItems(prev => prev.filter(x => x.id !== id)); }
    catch (e) { alert((e as Error).message); }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => setShowForm(true)}
          style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#1a1040,#2d1b69)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          + Yeni resurs
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Yeni resurs</h3>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Başlıq"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8 }} />
          <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Təsvir"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8, fontFamily: "inherit" }} />
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, marginBottom: 12 }}>
            <select value={resourceType} onChange={e => setResourceType(e.target.value as "FILE" | "LINK" | "ARTICLE")}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }}>
              <option value="LINK">🔗 Link</option>
              <option value="FILE">📄 Fayl URL</option>
              <option value="ARTICLE">📝 Məqalə</option>
            </select>
            <input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://…"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={reset} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer" }}>Ləğv</button>
            <button onClick={save}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: "linear-gradient(135deg,#1a1040,#2d1b69)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Saxla
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>Hələ resurs yoxdur.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map(r => (
            <div key={r.id} style={{ background: "#fff", borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 12, border: "1px solid #EFF2F7" }}>
              <span style={{ fontSize: 18 }}>{r.resourceType === "FILE" ? "📄" : r.resourceType === "ARTICLE" ? "📝" : "🔗"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#1A2535", fontSize: 13 }}>{r.title}</div>
                {r.description && <div style={{ fontSize: 11, color: "#52718F" }}>{r.description}</div>}
              </div>
              <button onClick={() => setShareFor(r)}
                style={{ padding: "6px 12px", fontSize: 11, border: "1px solid #C7D2FE", color: "#3730A3", background: "#EEF2FF", borderRadius: 6, cursor: "pointer" }}>
                Paylaş
              </button>
              <button onClick={() => remove(r.id)}
                style={{ fontSize: 11, color: "#991B1B", background: "transparent", border: "1px solid #FECACA", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
                Sil
              </button>
            </div>
          ))}
        </div>
      )}

      {shareFor && <ShareModal resource={shareFor} clients={clients} onClose={() => setShareFor(null)} />}
    </>
  );
}

function ShareModal({ resource, clients, onClose }: { resource: ResourceItem; clients: ClientSummary[]; onClose: () => void }) {
  const [patientId, setPatientId] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const send = async () => {
    if (!patientId) return;
    setSaving(true);
    try {
      await psychologistApi.shareResource({ resourceId: resource.id, patientId: Number(patientId), note: note.trim() || undefined });
      onClose();
    } catch (e) { alert((e as Error).message); setSaving(false); }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, padding: 22, width: "min(440px,100%)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", marginBottom: 12 }}>Paylaş: {resource.title}</h3>
        <select value={patientId} onChange={e => setPatientId(e.target.value ? Number(e.target.value) : "")}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8 }}>
          <option value="">— Müştəri seç —</option>
          {clients.map(c => <option key={c.patientId} value={c.patientId}>{c.name}</option>)}
        </select>
        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Qeyd (məcburi deyil)"
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer" }}>Bağla</button>
          <button onClick={send} disabled={saving || !patientId}
            style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: "linear-gradient(135deg,#1a1040,#2d1b69)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: !patientId ? 0.6 : 1 }}>
            Paylaş
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const [items, setItems] = useState<FollowupTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<FollowupTemplate | null>(null);

  const load = () => {
    setLoading(true);
    psychologistApi.templates().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const reset = () => { setName(""); setBody(""); setEditing(null); };

  const save = async () => {
    if (!name.trim() || !body.trim()) return;
    try {
      if (editing) {
        const updated = await psychologistApi.updateTemplate(editing.id, { name: name.trim(), body: body.trim() });
        setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
      } else {
        const created = await psychologistApi.createTemplate({ name: name.trim(), body: body.trim() });
        setItems(prev => [created, ...prev]);
      }
      reset();
    } catch (e) { alert((e as Error).message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Silmək istəyirsiniz?")) return;
    try { await psychologistApi.deleteTemplate(id); setItems(prev => prev.filter(x => x.id !== id)); }
    catch (e) { alert((e as Error).message); }
  };

  const startEdit = (t: FollowupTemplate) => { setEditing(t); setName(t.name); setBody(t.body); };

  const copy = (text: string) => {
    try { navigator.clipboard.writeText(text); alert("Kopyalandı"); } catch { /* ignore */ }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{editing ? "Düzəlt" : "Yeni template"}</h3>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Template adı (məs. 'İlk seans follow-up')"
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8 }} />
        <textarea rows={10} value={body} onChange={e => setBody(e.target.value)} placeholder="Mətn..."
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 8 }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {editing && <button onClick={reset} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer" }}>Ləğv</button>}
          <button onClick={save}
            style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: "linear-gradient(135deg,#1a1040,#2d1b69)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {editing ? "Yenilə" : "Saxla"}
          </button>
        </div>
      </div>

      <div>
        {loading ? (
          <div style={{ background: "#fff", padding: 30, borderRadius: 14, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
        ) : items.length === 0 ? (
          <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>Template yoxdur.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map(t => (
              <div key={t.id} style={{ background: "#fff", borderRadius: 10, padding: 14, border: "1px solid #EFF2F7" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <strong style={{ color: "#1A2535", fontSize: 13 }}>{t.name}</strong>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => copy(t.body)} style={{ fontSize: 11, color: "#3730A3", background: "#EEF2FF", border: "1px solid #C7D2FE", padding: "3px 8px", borderRadius: 6, cursor: "pointer" }}>Kopyala</button>
                    <button onClick={() => startEdit(t)} style={{ fontSize: 11, color: "#52718F", background: "transparent", border: "1px solid #E5E7EB", padding: "3px 8px", borderRadius: 6, cursor: "pointer" }}>Düzəlt</button>
                    <button onClick={() => remove(t.id)} style={{ fontSize: 11, color: "#991B1B", background: "transparent", border: "1px solid #FECACA", padding: "3px 8px", borderRadius: 6, cursor: "pointer" }}>Sil</button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#52718F", whiteSpace: "pre-wrap", maxHeight: 100, overflow: "hidden", lineHeight: 1.5 }}>
                  {t.body}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
