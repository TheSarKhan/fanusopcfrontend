"use client";

// Admin — material kateqoriyaları.
// Cədvəl <DataTable>-dır; API sadə massiv qaytarır, ona görə səhifələmə
// client-side: tam siyahı state-də saxlanılır, cari səhifə kəsilir.

import { useEffect, useMemo, useState } from "react";
import { adminApi, type MaterialCategory, type MaterialCategoryReq } from "@/lib/api";
import { toast } from "@/components/Toast";
import { Button, DataTable, Status, type Column } from "@/components/ui";
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
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ item: MaterialCategoryReq; id?: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = () => {
    setLoading(true);
    setError(null);
    adminApi.getMaterialCategories()
      .then(setItems)
      .catch(e => setError((e as Error).message || "Kateqoriyalar yüklənmədi."))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const pageRows = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]);

  // Siyahı və ya səhifə ölçüsü dəyişəndə boş səhifədə qalmamaq üçün 1-ə qayıt.
  useEffect(() => { setPage(1); }, [items, pageSize]);

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
    if (!modal.item.name.trim()) { toast("Ad tələb olunur.", "error"); return; }
    const slug = modal.item.slug.trim() || slugify(modal.item.name);
    if (!slug) { toast("Slug tələb olunur.", "error"); return; }
    setSaving(true);
    try {
      const payload: MaterialCategoryReq = { ...modal.item, name: modal.item.name.trim(), slug };
      if (modal.id) await adminApi.updateMaterialCategory(modal.id, payload);
      else await adminApi.createMaterialCategory(payload);
      close();
      load();
    } catch (e) { toast((e as Error).message || "Kateqoriya saxlanmadı", "error"); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Bu kateqoriyanı silmək istədiyinizə əminsiniz?")) return;
    try { await adminApi.deleteMaterialCategory(id); load(); }
    catch (e) { toast((e as Error).message || "Kateqoriya silinmədi", "error"); }
  };

  const columns: Column<MaterialCategory>[] = [
    { key: "name", header: "Ad", cell: c => <span className="fx-row__title">{c.name}</span> },
    { key: "slug", header: "Slug", cell: c => <span className="mono fx-subtitle">{c.slug}</span> },
    {
      key: "colors",
      header: "Rənglər",
      hideOnMobile: true,
      cell: c => (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid var(--border)", background: c.color ?? "#1051B7" }} />
          <span style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid var(--border)", background: c.bg ?? "#F2F6FD" }} />
          <span className="mono fx-subtitle" style={{ fontSize: 11 }}>{c.color ?? "—"} / {c.bg ?? "—"}</span>
        </div>
      ),
    },
    { key: "sortOrder", header: "Sıra", numeric: true, cell: c => c.sortOrder },
    {
      key: "status",
      header: "Status",
      cell: c => (c.active ? <Status tone="positive">Aktiv</Status> : <Status tone="muted">Deaktiv</Status>),
    },
  ];

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

      <DataTable
        rows={pageRows}
        columns={columns}
        rowKey={c => c.id}
        loading={loading}
        error={error}
        onRetry={load}
        actionsHeader="Əməliyyatlar"
        empty={{
          title: "Hələ kateqoriya yoxdur",
          body: "İlk kateqoriyanı əlavə edin.",
          actions: <Button variant="primary" size="sm" onClick={openCreate}>Yeni kateqoriya</Button>,
        }}
        actions={c => (
          <>
            <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Redaktə</Button>
            <Button variant="dangerGhost" size="sm" onClick={() => remove(c.id)}>Sil</Button>
          </>
        )}
        pagination={{
          page,
          pageCount,
          onChange: setPage,
          pageSize,
          onPageSizeChange: setPageSize,
        }}
        totalLabel={`${items.length} kateqoriya`}
      />

      {modal && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="modal">
            <div className="modal-head">
              <div className="modal-title">{modal.id ? "Kateqoriyanı redaktə et" : "Yeni kateqoriya"}</div>
              <button className="btn ghost icon-only sm" onClick={close} aria-label="Bağla">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
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
