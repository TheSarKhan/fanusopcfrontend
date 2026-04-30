"use client";

import { useEffect, useState } from "react";
import { adminApi, type Announcement } from "@/lib/api";
import { IconPlus } from "../_components/icons";

const EMPTY: Omit<Announcement, "id"> = {
  category: "Yenilik",
  categoryColor: "#002147",
  categoryBg: "#eef1f7",
  title: "",
  excerpt: "",
  publishedDate: new Date().toISOString().split("T")[0],
  iconType: "STAR",
  active: true,
};

const ICONS: Record<string, string> = {
  STAR: "⭐",
  GROUP: "👥",
  VIDEO: "🎥",
};

function statusOf(a: Announcement): "active" | "scheduled" | "archived" {
  if (!a.active) return "archived";
  if (a.publishedDate && new Date(a.publishedDate) > new Date()) return "scheduled";
  return "active";
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Omit<Announcement, "id">; id?: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.getAnnouncements().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => setModal({ open: true, item: { ...EMPTY } });
  const openEdit = (a: Announcement) => setModal({ open: true, item: { ...a }, id: a.id });
  const close = () => setModal(null);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.id) await adminApi.updateAnnouncement(modal.id, modal.item);
      else await adminApi.createAnnouncement(modal.item);
      close();
      load();
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Silmək istədiyinizə əminsiniz?")) return;
    try { await adminApi.deleteAnnouncement(id); load(); }
    catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Elanlar</h1>
          <p className="page-sub">Veb saytın elan bölməsində dərc olunan bildirişlər və kampaniyalar.</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={openCreate}>
            <IconPlus size={14} style={{ stroke: "#fff" } as React.CSSProperties} />
            Yeni elan
          </button>
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>}

      {!loading && (
        <div className="grid-3">
          {items.map((a) => {
            const status = statusOf(a);
            return (
              <div key={a.id} className="card" style={{ overflow: "hidden" }}>
                <div className="img-ph" style={{ height: 140, borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0, background: a.categoryBg, color: a.categoryColor }}>
                  <span style={{ fontSize: 32 }}>{ICONS[a.iconType] ?? "📢"}</span>
                </div>
                <div className="card-pad">
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                    {status === "active" && <span className="pill sage"><span className="dot" />Aktiv</span>}
                    {status === "scheduled" && <span className="pill gold"><span className="dot" />Cədvəldə</span>}
                    {status === "archived" && <span className="pill muted"><span className="dot" />Arxiv</span>}
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{a.publishedDate}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{a.title}</div>
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {a.excerpt}
                  </p>
                  <div className="row" style={{ justifyContent: "space-between", fontSize: 11.5 }}>
                    <span className="pill ox">{a.category}</span>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn sm ghost" onClick={() => openEdit(a)}>Redaktə</button>
                      <button className="btn sm danger" onClick={() => remove(a.id)}>Sil</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button className="card" onClick={openCreate}
            style={{ borderStyle: "dashed", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", padding: 30, cursor: "pointer", color: "var(--muted)", fontFamily: "inherit", fontSize: 13, fontWeight: 600, gap: 8, minHeight: 300 }}>
            <IconPlus size={20} />
            Yeni elan əlavə et
          </button>
        </div>
      )}

      {modal && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="modal">
            <div className="modal-head">
              <div className="modal-title">{modal.id ? "Elanı redaktə et" : "Yeni elan"}</div>
              <button className="btn ghost icon-only sm" onClick={close}>✕</button>
            </div>
            <div className="modal-body">
              <Field label="Başlıq">
                <input className="input" value={modal.item.title}
                  onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, title: e.target.value } }))} />
              </Field>
              <div style={{ marginTop: 12 }} />
              <Field label="Mətn / xülasə">
                <textarea className="textarea" value={modal.item.excerpt}
                  onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, excerpt: e.target.value } }))} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                <Field label="Kateqoriya">
                  <input className="input" value={modal.item.category}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, category: e.target.value } }))} />
                </Field>
                <Field label="İkon">
                  <select className="select" value={modal.item.iconType}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, iconType: e.target.value } }))}>
                    <option value="STAR">⭐ Star</option>
                    <option value="GROUP">👥 Group</option>
                    <option value="VIDEO">🎥 Video</option>
                  </select>
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 12 }}>
                <Field label="Rəng">
                  <input className="input mono" value={modal.item.categoryColor}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, categoryColor: e.target.value } }))} />
                </Field>
                <Field label="Arxa plan">
                  <input className="input mono" value={modal.item.categoryBg}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, categoryBg: e.target.value } }))} />
                </Field>
                <Field label="Tarix">
                  <input className="input" type="date" value={modal.item.publishedDate}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, publishedDate: e.target.value } }))} />
                </Field>
              </div>
              <div className="row" style={{ marginTop: 14, gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Aktiv</span>
                <button className={`switch${modal.item.active ? " on" : ""}`}
                  onClick={() => setModal((m) => m && ({ ...m, item: { ...m.item, active: !m.item.active } }))} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={close}>Ləğv et</button>
              <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Saxlanır…" : "Saxla"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
