"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminApi, type Material, type MaterialCategory, type MaterialVersion, type MaterialReq } from "@/lib/api";
import { toast } from "@/components/Toast";
import { azFormatDate } from "@/lib/datetime";
import { Banner, Button, ButtonLink, DataTable, Status, Switch, type Column } from "@/components/ui";
import { IconPlus, IconDownload } from "../_components/icons";

const EMPTY: MaterialReq = {
  title: "",
  description: "",
  categoryId: 0,
  active: true,
  sortOrder: 0,
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

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
  // Cədvəlin öz yükləmə xətası — toast-a yox, cədvəlin içindəki qutuya gedir.
  const [tableError, setTableError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ item: MaterialReq; id?: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  // Yeni versiya yüklənəndə açıq versiya tarixçələri yenidən oxunsun.
  const [versionNonce, setVersionNonce] = useState(0);

  // Serverdə səhifələnir: backend 0-dan sayır.
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [nonce, setNonce] = useState(0);

  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    setLoading(true);
    setTableError(null);
    adminApi.getMaterialsPaged({ page, size })
      .then((res) => { setItems(res.content); setTotal(res.totalElements); })
      .catch((e) => setTableError((e as Error).message || "Materiallar yüklənmədi"))
      .finally(() => setLoading(false));
  }, [page, size, nonce]);

  useEffect(() => {
    adminApi.getMaterialCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [nonce]);

  const reload = () => setNonce((n) => n + 1);
  const pageCount = Math.max(1, Math.ceil(total / size));

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
    if (!modal.item.title.trim()) { toast("Başlıq tələb olunur.", "error"); return; }
    if (!modal.item.categoryId) { toast("Kateqoriya seçin.", "error"); return; }
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
      reload();
    } catch (e) { toast((e as Error).message || "Material saxlanmadı", "error"); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Bu materialı silmək istədiyinizə əminsiniz? Bütün versiyaları da silinəcək.")) return;
    try { await adminApi.deleteMaterial(id); reload(); }
    catch (e) { toast((e as Error).message || "Material silinmədi", "error"); }
  };

  const toggleActive = async (m: Material) => {
    setTogglingId(m.id);
    try {
      await adminApi.setMaterialActive(m.id, !m.active);
      setItems((prev) => prev.map((x) => x.id === m.id ? { ...x, active: !x.active } : x));
    } catch (e) { toast((e as Error).message || "Status dəyişdirilmədi", "error"); }
    finally { setTogglingId(null); }
  };

  const uploadVersion = async (id: number, file: File | undefined) => {
    if (!file) return;
    setUploadingId(id);
    try {
      await adminApi.uploadMaterialVersion(id, file);
      // Açıq versiya tarixçəsi paneli varsa yenilənsin.
      setVersionNonce((n) => n + 1);
      reload();
    } catch (e) { toast((e as Error).message || "Versiya yüklənmədi", "error"); }
    finally { setUploadingId(null); }
  };

  const columns: Column<Material>[] = useMemo(() => [
    {
      key: "title",
      header: "Başlıq",
      cell: (m) => (
        <div>
          <div style={{ fontWeight: 600 }}>{m.title}</div>
          {m.description && (
            <div className="fx-muted" style={{ fontSize: 12, marginTop: 2, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "categoryName",
      header: "Kateqoriya",
      cell: (m) => (m.categoryName ? <span>{m.categoryName}</span> : <span className="fx-muted">—</span>),
    },
    {
      key: "active",
      header: "Status",
      cell: (m) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Switch
            aria-label={m.active ? "Materialı deaktiv et" : "Materialı aktiv et"}
            checked={m.active}
            disabled={togglingId === m.id}
            onChange={() => toggleActive(m)}
          />
          <Status tone={m.active ? "positive" : "muted"}>{m.active ? "Aktiv" : "Deaktiv"}</Status>
        </div>
      ),
    },
    {
      key: "versionCount",
      header: "Versiyalar",
      cell: (m) => <span>{m.versionCount} versiya</span>,
    },
    {
      key: "latestFile",
      header: "Son fayl",
      hideOnMobile: true,
      cell: (m) => (
        <div>
          {m.latestFileUrl ? (
            <ButtonLink
              variant="ghost"
              size="sm"
              href={m.latestFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              icon={<IconDownload size={14} />}
            >
              Yüklə
            </ButtonLink>
          ) : (
            <span className="fx-muted">—</span>
          )}
          {m.latestFileName && (
            <div className="fx-muted" style={{ fontSize: 11.5, marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
              <span>Versiya: v{m.latestVersionNo}</span>
              <span>Fayl: {m.latestFileName}</span>
              <span>Ölçü: {fmtSize(m.latestFileSize)}</span>
            </div>
          )}
        </div>
      ),
    },
  ], [togglingId]);

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

      <DataTable
        rows={items}
        columns={columns}
        rowKey={(m) => m.id}
        loading={loading}
        error={tableError}
        onRetry={reload}
        minWidth={980}
        empty={{
          title: "Hələ material yoxdur",
          body: "İlk materialı əlavə edin.",
          actions: <Button variant="primary" size="sm" onClick={openCreate}>Yeni material</Button>,
        }}
        renderExpanded={(m) => <MaterialVersions materialId={m.id} nonce={versionNonce} />}
        actionsHeader="Əməliyyatlar"
        actions={(m) => (
          <>
            <input
              type="file"
              style={{ display: "none" }}
              ref={(el) => { fileInputs.current[m.id] = el; }}
              disabled={uploadingId === m.id}
              onChange={(e) => { uploadVersion(m.id, e.target.files?.[0]); e.target.value = ""; }}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={uploadingId === m.id}
              onClick={() => fileInputs.current[m.id]?.click()}
            >
              {uploadingId === m.id ? "Yüklənir…" : "Versiya yüklə"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>Redaktə</Button>
            <Button variant="dangerGhost" size="sm" onClick={() => remove(m.id)}>Sil</Button>
          </>
        )}
        // Backend 0-dan sayır, Pagination 1-dən — çevirmə burada aparılır.
        pagination={{
          page: page + 1,
          pageCount,
          onChange: (p) => setPage(p - 1),
          pageSize: size,
          onPageSizeChange: (n) => { setSize(n); setPage(0); },
          pageSizeOptions: PAGE_SIZE_OPTIONS,
        }}
        totalLabel={`${total ? page * size + 1 : 0}–${Math.min(total, (page + 1) * size)} / ${total}`}
      />

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

/**
 * Açılan sətrin məzmunu — bir materialın versiya tarixçəsi.
 * Yalnız sətir açılanda render olunur, ona görə sorğu da yalnız o zaman gedir.
 */
function MaterialVersions({ materialId, nonce }: { materialId: number; nonce: number }) {
  const [list, setList] = useState<MaterialVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    setList(null);
    adminApi.getMaterialVersions(materialId)
      .then((v) => { if (alive) setList(v); })
      .catch((e) => { if (alive) setError((e as Error).message || "Versiyalar yüklənmədi"); });
    return () => { alive = false; };
  }, [materialId, nonce]);

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Versiya tarixçəsi</div>
      {error ? (
        <Banner tone="error" title="Məlumat yüklənmədi">{error}</Banner>
      ) : list === null ? (
        <div className="fx-skeleton" style={{ height: 13, width: "40%" }} />
      ) : list.length === 0 ? (
        <div className="fx-muted" style={{ fontSize: 13 }}>Hələ versiya yüklənməyib.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>v{v.versionNo}</span>
              <span style={{ fontWeight: 600 }}>{v.fileName}</span>
              <span className="fx-muted" style={{ fontSize: 12 }}>{fmtSize(v.fileSize)}</span>
              <span className="fx-muted" style={{ fontSize: 12 }}>{azFormatDate(v.createdAt)}</span>
              <span style={{ marginLeft: "auto" }}>
                <ButtonLink
                  variant="ghost"
                  size="sm"
                  href={v.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  icon={<IconDownload size={14} />}
                >
                  Yüklə
                </ButtonLink>
              </span>
            </div>
          ))}
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
