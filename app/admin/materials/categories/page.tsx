"use client";

import { useEffect, useState } from "react";
import { adminApi, type MaterialCategory, type MaterialCategoryReq } from "@/lib/api";
import { IconPlus } from "../../_components/icons";

const EMPTY: MaterialCategoryReq = {
  name: "",
  slug: "",
  color: "#1051B7",
  bg: "#F2F6FD",
  active: true,
  sortOrder: 0,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/ə/g, "e").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/ç/g, "c").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function MaterialCategoriesPage() {
  const [items, setItems] = useState<MaterialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ item: MaterialCategoryReq; id?: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.getMaterialCategories().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => setModal({ item: { ...EMPTY } });
  const openEdit = (c: MaterialCategory) =>
    setModal({
      id: c.id,
      item: {
        name: c.name,
        slug: c.slug,
        color: c.color ?? "#1051B7",
        bg: c.bg ?? "#F2F6FD",
        active: c.active,
        sortOrder: c.sortOrder,
      },
    });
  const close = () => setModal(null);

  const save = async () => {
    if (!modal) return;
    if (!modal.item.name.trim()) { alert("Ad tələb olunur."); return; }
    const slug = modal.item.slug.trim() || slugify(modal.item.name);
    if (!slug) { alert("Slug tələb olunur."); return; }
    setSaving(true);
    try {
      const payload: MaterialCategoryReq = { ...modal.item, name: modal.item.name.trim(), slug };
      if (modal.id) await adminApi.updateMaterialCategory(modal.id, payload);
      else await adminApi.createMaterialCategory(payload);
      close();
      load();
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Bu kateqoriyanı silmək istədiyinizə əminsiniz?")) return;
    try { await adminApi.deleteMaterialCategory(id); load(); }
    catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Material kateqoriyaları</h1>
          <p className="page-sub">Material kitabxanasının kateqoriyalarını idarə edin.</p>
        </div>
        <div className="page-actions">
          <a className="btn ghost" href="/admin/materials">Materiallar</a>
          <button className="btn primary" onClick={openCreate}>
            <IconPlus size={14} style={{ stroke: "#fff" } as React.CSSProperties} />
            Yeni kateqoriya
          </button>
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>}

      {!loading && (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Ad</th>
                <th>Slug</th>
                <th>Rənglər</th>
                <th>Sıra</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Əməliyyatlar</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 60, textAlign: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>Hələ kateqoriya yoxdur</div>
                    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>İlk kateqoriyanı əlavə edin.</div>
                    <button className="btn primary mt-16" onClick={openCreate}>Yeni kateqoriya</button>
                  </td>
                </tr>
              )}
              {items.map((c) => (
                <tr key={c.id} style={{ opacity: c.active ? 1 : 0.6 }}>
                  <td>
                    <span className="pill" style={{ background: c.bg ?? "#F2F6FD", color: c.color ?? "#1051B7" }}>{c.name}</span>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--muted)" }}>{c.slug}</td>
                  <td>
                    <div className="row" style={{ gap: 6, alignItems: "center" }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid var(--border)", background: c.color ?? "#1051B7" }} />
                      <span style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid var(--border)", background: c.bg ?? "#F2F6FD" }} />
                      <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{c.color ?? "—"} / {c.bg ?? "—"}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{c.sortOrder}</td>
                  <td>
                    {c.active
                      ? <span className="pill sage"><span className="dot" />Aktiv</span>
                      : <span className="pill muted"><span className="dot" />Deaktiv</span>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                      <button className="btn sm ghost" onClick={() => openEdit(c)}>Redaktə</button>
                      <button className="btn sm danger" onClick={() => remove(c.id)}>Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="modal">
            <div className="modal-head">
              <div className="modal-title">{modal.id ? "Kateqoriyanı redaktə et" : "Yeni kateqoriya"}</div>
              <button className="btn ghost icon-only sm" onClick={close}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Ad">
                  <input className="input" value={modal.item.name}
                    onChange={(e) => setModal((m) => {
                      if (!m) return m;
                      // Auto-fill slug on create until the user edits it manually.
                      const autoSlug = !m.id && (m.item.slug === "" || m.item.slug === slugify(m.item.name));
                      return { ...m, item: { ...m.item, name: e.target.value, slug: autoSlug ? slugify(e.target.value) : m.item.slug } };
                    })} />
                </Field>
                <Field label="Slug">
                  <input className="input mono" value={modal.item.slug}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, slug: e.target.value } }))} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 12 }}>
                <Field label="Rəng">
                  <input className="input mono" value={modal.item.color ?? ""}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, color: e.target.value } }))} />
                </Field>
                <Field label="Arxa plan">
                  <input className="input mono" value={modal.item.bg ?? ""}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, bg: e.target.value } }))} />
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
