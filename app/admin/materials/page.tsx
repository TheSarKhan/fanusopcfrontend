"use client";

import { Fragment, useEffect, useState } from "react";
import { adminApi, type Material, type MaterialCategory, type MaterialVersion, type MaterialReq } from "@/lib/api";
import { IconPlus, IconDownload } from "../_components/icons";

const EMPTY: MaterialReq = {
  title: "",
  description: "",
  categoryId: 0,
  active: true,
  sortOrder: 0,
};

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

function fmtSize(bytes?: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MaterialsPage() {
  const [items, setItems] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ item: MaterialReq; id?: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [versions, setVersions] = useState<{ id: number; list: MaterialVersion[] } | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([adminApi.getMaterials(), adminApi.getMaterialCategories()])
      .then(([m, c]) => { setItems(m); setCategories(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () =>
    setModal({ item: { ...EMPTY, categoryId: categories[0]?.id ?? 0 } });
  const openEdit = (m: Material) =>
    setModal({
      id: m.id,
      item: {
        title: m.title,
        description: m.description ?? "",
        categoryId: m.categoryId,
        active: m.active,
        sortOrder: m.sortOrder,
      },
    });
  const close = () => setModal(null);

  const save = async () => {
    if (!modal) return;
    if (!modal.item.title.trim()) { alert("Başlıq tələb olunur."); return; }
    if (!modal.item.categoryId) { alert("Kateqoriya seçin."); return; }
    setSaving(true);
    try {
      const payload: MaterialReq = {
        ...modal.item,
        title: modal.item.title.trim(),
        description: modal.item.description?.trim() || undefined,
      };
      if (modal.id) await adminApi.updateMaterial(modal.id, payload);
      else await adminApi.createMaterial(payload);
      close();
      load();
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Bu materialı silmək istədiyinizə əminsiniz? Bütün versiyaları da silinəcək.")) return;
    try { await adminApi.deleteMaterial(id); load(); }
    catch (e) { alert((e as Error).message); }
  };

  const toggleActive = async (m: Material) => {
    setTogglingId(m.id);
    try {
      await adminApi.setMaterialActive(m.id, !m.active);
      setItems((prev) => prev.map((x) => x.id === m.id ? { ...x, active: !x.active } : x));
    } catch (e) { alert((e as Error).message); }
    finally { setTogglingId(null); }
  };

  const uploadVersion = async (id: number, file: File | undefined) => {
    if (!file) return;
    setUploadingId(id);
    try {
      await adminApi.uploadMaterialVersion(id, file);
      // If the version history panel is open for this material, refresh it.
      if (versions?.id === id) {
        const list = await adminApi.getMaterialVersions(id);
        setVersions({ id, list });
      }
      load();
    } catch (e) { alert((e as Error).message); }
    finally { setUploadingId(null); }
  };

  const showVersions = async (id: number) => {
    if (versions?.id === id) { setVersions(null); return; }
    try {
      const list = await adminApi.getMaterialVersions(id);
      setVersions({ id, list });
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Material kitabxanası</h1>
          <p className="page-sub">Psixoloqlar üçün paylaşılan sənəd və material kitabxanası.</p>
        </div>
        <div className="page-actions">
          <a className="btn ghost" href="/admin/materials/categories">Kateqoriyalar</a>
          <button className="btn primary" onClick={openCreate}>
            <IconPlus size={14} style={{ stroke: "#fff" } as React.CSSProperties} />
            Yeni material
          </button>
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>}

      {!loading && (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Başlıq</th>
                <th>Kateqoriya</th>
                <th>Status</th>
                <th>Versiyalar</th>
                <th>Son fayl</th>
                <th style={{ textAlign: "right" }}>Əməliyyatlar</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 60, textAlign: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>Hələ material yoxdur</div>
                    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>İlk materialı əlavə edin.</div>
                    <button className="btn primary mt-16" onClick={openCreate}>Yeni material</button>
                  </td>
                </tr>
              )}
              {items.map((m) => {
                const isOpen = versions?.id === m.id;
                return (
                  <Fragment key={m.id}>
                    <tr style={{ opacity: m.active ? 1 : 0.6 }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.title}</div>
                        {m.description && (
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {m.description}
                          </div>
                        )}
                      </td>
                      <td>
                        {m.categoryName
                          ? <span className="pill ox">{m.categoryName}</span>
                          : <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            onClick={() => toggleActive(m)}
                            disabled={togglingId === m.id}
                            className={`switch${m.active ? " on" : ""}`}
                            style={{ transform: "scale(0.85)", transformOrigin: "left center" }}
                          />
                          <span style={{ fontSize: 12, color: m.active ? "var(--sage)" : "var(--muted)", fontWeight: 500 }}>
                            {m.active ? "Aktiv" : "Deaktiv"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button className="btn sm ghost" onClick={() => showVersions(m.id)}>
                          {m.versionCount} versiya
                        </button>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {m.latestFileUrl ? (
                          <a className="btn sm ghost" href={m.latestFileUrl} target="_blank" rel="noopener noreferrer">
                            <IconDownload size={14} /> Yüklə
                          </a>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                        {m.latestFileName && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                            v{m.latestVersionNo} · {m.latestFileName} · {fmtSize(m.latestFileSize)}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                          <label className="btn sm ghost" style={{ cursor: uploadingId === m.id ? "default" : "pointer", opacity: uploadingId === m.id ? 0.6 : 1 }}>
                            {uploadingId === m.id ? "Yüklənir…" : "Versiya yüklə"}
                            <input
                              type="file"
                              style={{ display: "none" }}
                              disabled={uploadingId === m.id}
                              onChange={(e) => { uploadVersion(m.id, e.target.files?.[0]); e.target.value = ""; }}
                            />
                          </label>
                          <button className="btn sm ghost" onClick={() => openEdit(m)}>Redaktə</button>
                          <button className="btn sm danger" onClick={() => remove(m.id)}>Sil</button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} style={{ background: "var(--bg, #f8fafc)", padding: 0 }}>
                          <div style={{ padding: "12px 16px" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              Versiya tarixçəsi
                            </div>
                            {versions?.list.length === 0 ? (
                              <div style={{ fontSize: 13, color: "var(--muted)" }}>Hələ versiya yüklənməyib.</div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {versions?.list.map((v) => (
                                  <div key={v.id} className="row" style={{ gap: 10, fontSize: 13, alignItems: "center" }}>
                                    <span className="pill ox">v{v.versionNo}</span>
                                    <span style={{ fontWeight: 600 }}>{v.fileName}</span>
                                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{fmtSize(v.fileSize)}</span>
                                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(v.createdAt)}</span>
                                    <a className="btn sm ghost" href={v.fileUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto" }}>
                                      <IconDownload size={14} /> Yüklə
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="modal">
            <div className="modal-head">
              <div className="modal-title">{modal.id ? "Materialı redaktə et" : "Yeni material"}</div>
              <button className="btn ghost icon-only sm" onClick={close}>✕</button>
            </div>
            <div className="modal-body">
              <Field label="Başlıq">
                <input className="input" value={modal.item.title}
                  onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, title: e.target.value } }))} />
              </Field>
              <div style={{ marginTop: 12 }} />
              <Field label="Təsvir">
                <textarea className="textarea" value={modal.item.description ?? ""}
                  onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, description: e.target.value } }))} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                <Field label="Kateqoriya">
                  <select className="select" value={modal.item.categoryId}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, categoryId: Number(e.target.value) } }))}>
                    <option value={0} disabled>Seçin…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Sıra">
                  <input className="input" type="number" value={modal.item.sortOrder}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, sortOrder: Number(e.target.value) } }))} />
                </Field>
              </div>
              <div className="row" style={{ marginTop: 14, gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Aktiv</span>
                <button className={`switch${modal.item.active ? " on" : ""}`}
                  onClick={() => setModal((m) => m && ({ ...m, item: { ...m.item, active: !m.item.active } }))} />
              </div>
              {categories.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--danger, #dc2626)", marginTop: 12 }}>
                  Heç bir kateqoriya yoxdur. Əvvəlcə kateqoriya əlavə edin.
                </div>
              )}
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
