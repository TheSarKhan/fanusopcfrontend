"use client";

// Admin · Resurslar — platformadakı bütün resurslar (admin platforma resursları + psixoloq
// resursları) bir yerdə. DataTable + paylaşım/müəllif/kateqoriya filtri, sıralama, front+back
// pagination; admin platforma resursu yaradır (birbaşa APPROVED, bütün psixoloqlara görünür),
// istənilən resursu redaktə/sil/gizlət edir, psixoloq paylaşım tələblərini təsdiqləyir/rədd edir.

import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, type PsychResource, type PsychResourceReq, type ResourceStats, type Paged, type SortDir } from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";
import PanelIcon from "@/components/PanelIcon";
import { toast } from "@/components/Toast";
import {
  PageHead, Card, CardPad, DataTable, Status, Button, IconButton,
  SearchInput, Select, Stats, Stat, Modal, Field, Input, Textarea,
  type Column, type StatusTone,
} from "@/components/ui";

const CATEGORIES = ["Protokol", "Şablon", "Tədqiqat", "Məqalə", "Digər"];

const SHARE_TONE: Record<string, StatusTone> = { PRIVATE: "muted", PENDING: "wait", APPROVED: "positive", REJECTED: "risk" };
const SHARE_LABEL: Record<string, string> = { PRIVATE: "Şəxsi", PENDING: "Təsdiq gözləyir", APPROVED: "Paylaşılıb", REJECTED: "Rədd edilib" };

const SHARE_FILTERS = [
  { v: "all", label: "Bütün statuslar" },
  { v: "APPROVED", label: "Paylaşılıb" },
  { v: "PENDING", label: "Təsdiq gözləyir" },
  { v: "PRIVATE", label: "Şəxsi" },
  { v: "REJECTED", label: "Rədd edilib" },
];
const AUTHOR_FILTERS = [
  { v: "all", label: "Bütün müəlliflər" },
  { v: "ADMIN", label: "Platforma (admin)" },
  { v: "PSYCHOLOGIST", label: "Psixoloq" },
];
const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

const authorLabel = (r: PsychResource) => r.authorName || (r.authorRole === "PSYCHOLOGIST" ? "Psixoloq" : "Platforma");
const authorRoleLabel = (r: PsychResource) => (r.authorRole === "PSYCHOLOGIST" ? "Psixoloq" : "Admin");

export default function AdminResourcesPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [summary, setSummary] = useState<ResourceStats | null>(null);
  const loadSummary = useCallback(() => { adminApi.getResourcesSummary().then(setSummary).catch(() => {}); }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const [data, setData] = useState<Paged<PsychResource> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const dq = useDebounce(search, 300);
  const [shareF, setShareF] = useState("all");
  const [authorF, setAuthorF] = useState("all");
  const [catF, setCatF] = useState("all");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(30);
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState<SortDir>("desc");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PsychResource | null>(null);
  const [share, setShare] = useState<{ row: PsychResource; approve: boolean } | null>(null);
  const [formOpen, setFormOpen] = useState<{ resource: PsychResource | null } | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminApi.getResourcesPaged({
      q: dq.trim() || undefined,
      shareStatus: shareF === "all" ? undefined : shareF,
      author: authorF === "all" ? undefined : authorF,
      category: catF === "all" ? undefined : catF,
      sort, dir, page, size,
    })
      .then((res) => { setData(res); if (res.totalPages > 0 && page >= res.totalPages) setPage(0); })
      .catch((e) => setError((e as Error).message || "Resurslar yüklənmədi"))
      .finally(() => setLoading(false));
  }, [dq, shareF, authorF, catF, sort, dir, page, size]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [dq, shareF, authorF, catF]);

  const refresh = useCallback(() => { load(); loadSummary(); }, [load, loadSummary]);
  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(okMsg, "success"); refresh(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };

  const toggleActive = (r: PsychResource) =>
    act(() => adminApi.setResourceActive(r.id, !r.active), r.active ? "Resurs gizlədildi" : "Resurs göstərildi");

  const columns: Column<PsychResource>[] = [
    {
      key: "title", header: "Resurs", sortable: true,
      cell: (r) => (
        <div style={{ minWidth: 0 }}>
          <div className="fx-row__title" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>{r.title}</span>
            {r.shareStatus && r.shareStatus !== "PRIVATE" && <Status tone={SHARE_TONE[r.shareStatus] ?? "neutral"}>{SHARE_LABEL[r.shareStatus] ?? r.shareStatus}</Status>}
            {r.active === false && <Status tone="muted">Gizli</Status>}
          </div>
          <div className="fx-subtitle">{r.category}{r.fileName ? ` · ${r.fileName}` : ""}</div>
        </div>
      ),
    },
    { key: "category", header: "Kateqoriya", sortable: true, hideOnMobile: true, cell: (r) => <span>{r.category}</span> },
    {
      key: "author", header: "Müəllif", hideOnMobile: true,
      cell: (r) => (
        <span style={{ display: "inline-flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span>{authorLabel(r)}</span>
          <span className="fx-subtitle">{authorRoleLabel(r)}</span>
        </span>
      ),
    },
    { key: "shareStatus", header: "Paylaşım", sortable: true, cell: (r) => <Status tone={SHARE_TONE[r.shareStatus] ?? "neutral"}>{SHARE_LABEL[r.shareStatus] ?? r.shareStatus}</Status> },
    { key: "createdAt", header: "Tarix", hideOnMobile: true, cell: (r) => <span className="fx-num" style={{ whiteSpace: "nowrap" }}>{r.createdAt ? azFormatDateTime(r.createdAt) : "—"}</span> },
  ];

  if (!mounted) return null;

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead title="Resurslar" sub="Platformadakı bütün resurslar — admin platforma resursları və psixoloq resursları."
        actions={<Button variant="primary" onClick={() => setFormOpen({ resource: null })} icon={<PanelIcon name="plus" size={16} />}>Yeni resurs</Button>} />

      <Stats style={{ marginBottom: 16, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
        <Stat value={summary?.total ?? "—"} label="Ümumi" />
        <Stat value={summary?.shared ?? "—"} label="Paylaşılıb" />
        <Stat value={summary?.pending ?? "—"} label="Təsdiq gözləyir" />
        <Stat value={summary?.byPlatform ?? "—"} label="Platforma resursu" />
        <Stat value={summary?.byPsychologist ?? "—"} label="Psixoloq resursu" />
      </Stats>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Başlıq və ya təsvir üzrə axtar" aria-label="Axtar" autoComplete="off" />
          </div>
          <Select value={shareF} onChange={(e) => setShareF(e.target.value)} aria-label="Paylaşım süzgəci" style={{ maxWidth: 170 }}>
            {SHARE_FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </Select>
          <Select value={authorF} onChange={(e) => setAuthorF(e.target.value)} aria-label="Müəllif süzgəci" style={{ maxWidth: 170 }}>
            {AUTHOR_FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </Select>
          <Select value={catF} onChange={(e) => setCatF(e.target.value)} aria-label="Kateqoriya süzgəci" style={{ maxWidth: 150 }}>
            <option value="all">Bütün kateqoriyalar</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>

        <CardPad>
          <DataTable
            rows={data?.content ?? []}
            columns={columns}
            rowKey={(r) => r.id}
            loading={loading}
            error={error}
            onRetry={load}
            onRowClick={(r) => setFormOpen({ resource: r })}
            empty={{ title: "Resurs tapılmadı", body: "Filtri dəyişin və ya yeni resurs əlavə edin." }}
            sort={{ key: sort, dir }}
            onSortChange={(s) => { setSort(s.key); setDir(s.dir); setPage(0); }}
            actions={(r) => (
              <span style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                {r.shareStatus === "PENDING" && (
                  <>
                    <IconButton aria-label="Təsdiqlə" title="Paylaşımı təsdiqlə" disabled={busy} onClick={() => setShare({ row: r, approve: true })}><PanelIcon name="check" size={16} /></IconButton>
                    <IconButton aria-label="Rədd et" title="Paylaşımı rədd et" disabled={busy} onClick={() => setShare({ row: r, approve: false })}><PanelIcon name="x" size={16} /></IconButton>
                  </>
                )}
                <IconButton aria-label={r.active === false ? "Göstər" : "Gizlə"} title={r.active === false ? "Göstər" : "Gizlə"} disabled={busy} onClick={() => toggleActive(r)}>
                  <PanelIcon name="eye" size={16} />
                </IconButton>
                <IconButton aria-label="Redaktə et" title="Redaktə et" onClick={() => setFormOpen({ resource: r })}><PanelIcon name="edit" size={16} /></IconButton>
                <IconButton aria-label="Sil" title="Sil" disabled={busy} onClick={() => setDeleteTarget(r)}><PanelIcon name="x" size={16} /></IconButton>
              </span>
            )}
            pagination={{
              page: page + 1, pageCount: Math.max(1, data?.totalPages ?? 1),
              onChange: (p) => setPage(p - 1), pageSize: size,
              onPageSizeChange: (s) => { setSize(s); setPage(0); }, pageSizeOptions: PAGE_SIZE_OPTIONS,
            }}
            totalLabel={data && data.totalElements > 0
              ? `Göstərilir: ${data.page * data.size + 1}–${Math.min((data.page + 1) * data.size, data.totalElements)} / ${data.totalElements}`
              : undefined}
          />
        </CardPad>
      </Card>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Resursu sil"
        text={deleteTarget ? `"${deleteTarget.title}" həmişəlik silinəcək. Bu əməliyyat geri qaytarıla bilməz.` : ""}
        icon={<PanelIcon name="x" size={20} />} iconTone="rose"
        actions={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>İmtina</Button>
          <Button variant="danger" disabled={busy} onClick={() => { const r = deleteTarget; if (!r) return; act(() => adminApi.deleteResource(r.id), "Resurs silindi").then(() => setDeleteTarget(null)); }}>{busy ? "Silinir…" : "Sil"}</Button>
        </>} />

      {share && <ShareDecisionModal row={share.row} approve={share.approve} onClose={() => setShare(null)} onDone={() => { setShare(null); refresh(); }} />}
      {formOpen && <ResourceFormModal resource={formOpen.resource} onClose={() => setFormOpen(null)} onDone={() => { setFormOpen(null); refresh(); }} />}
    </div>
  );
}

// ── Paylaşım təsdiqi/rəddi ───────────────────────────────────────────────────
function ShareDecisionModal({ row, approve, onClose, onDone }: {
  row: PsychResource; approve: boolean; onClose: () => void; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await (approve ? adminApi.approveResource(row.id) : adminApi.rejectResource(row.id));
      toast(approve ? "Paylaşım təsdiqləndi — resurs bütün psixoloqlara açıldı" : "Paylaşım rədd edildi", "success");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose}
      title={approve ? "Paylaşımı təsdiqlə" : "Paylaşımı rədd et"}
      text={approve ? `"${row.title}" bütün psixoloqlara açılacaq.` : `"${row.title}" paylaşımı rədd ediləcək.`}
      icon={<PanelIcon name={approve ? "check" : "x"} size={20} />} iconTone={approve ? "brand" : "rose"}
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant={approve ? "primary" : "danger"} disabled={busy} onClick={submit}>{busy ? "Göndərilir…" : (approve ? "Təsdiqlə" : "Rədd et")}</Button>
      </>} />
  );
}

// ── Resurs yaratma / redaktə forması ─────────────────────────────────────────
function ResourceFormModal({ resource, onClose, onDone }: {
  resource: PsychResource | null; onClose: () => void; onDone: () => void;
}) {
  const editing = !!resource;
  const [title, setTitle] = useState(resource?.title ?? "");
  const [category, setCategory] = useState(resource?.category ?? CATEGORIES[0]);
  const [description, setDescription] = useState(resource?.description ?? "");
  const [content, setContent] = useState(resource?.content ?? "");
  const [fileUrl, setFileUrl] = useState(resource?.fileUrl ?? "");
  const [fileName, setFileName] = useState(resource?.fileName ?? "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ready = title.trim().length > 0 && category.trim().length > 0;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const url = await adminApi.uploadFile(f);
      setFileUrl(url); setFileName(f.name);
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const payload: PsychResourceReq = {
      title: title.trim(), category: category.trim(),
      description: description.trim() || undefined,
      content: content.trim() || undefined,
      fileUrl: fileUrl || undefined,
      fileName: fileName || undefined,
    };
    try {
      if (editing && resource) await adminApi.updateResource(resource.id, payload);
      else await adminApi.createResource(payload);
      toast(editing ? "Resurs yeniləndi" : "Resurs yaradıldı — bütün psixoloqlara açıqdır", "success");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} wide
      title={editing ? "Resursu redaktə et" : "Yeni platforma resursu"}
      icon={<PanelIcon name="content" size={20} />}
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant="primary" disabled={!ready || busy || uploading} onClick={submit}>{busy ? "Saxlanılır…" : (editing ? "Yadda saxla" : "Yarat")}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Başlıq">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resursun başlığı" autoFocus />
        </Field>
        <Field label="Kateqoriya">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Qısa təsvir" help="İxtiyari — siyahıda başlığın altında görünür.">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Məzmun" help="İxtiyari — mətn resursu (protokol, şablon və s.).">
          <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>
        <Field label="Fayl" help="İxtiyari — PDF, sənəd və s. əlavə edin.">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Button variant="ghost" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Yüklənir…" : "Fayl seç"}</Button>
            {fileName && <span className="fx-subtitle">{fileName}</span>}
            {fileName && <Button variant="ghost" size="sm" onClick={() => { setFileUrl(""); setFileName(""); }}>Sil</Button>}
            <input ref={fileRef} type="file" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </Field>
      </div>
    </Modal>
  );
}
