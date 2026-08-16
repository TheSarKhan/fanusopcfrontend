"use client";

// Admin · Məqalələr — platformadakı bütün məqalələr (admin + psixoloq yazıları) bir
// yerdə. Vahid DataTable + front/back pagination, status/müəllif filtri, sıralama
// (baxış sayına görə də), sürətli yayımla/gizlət, featured toggle, toplu əməliyyat.
// Moderasiya modeli: sonradan nəzarət — psixoloq məqaləsi dərhal dərc olunur, admin
// istənilən vaxt gizlədə/redaktə/sil edə bilər.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, type BlogPost, type BlogSummary, type Paged, type SortDir } from "@/lib/api";
import { getMainSiteUrl } from "@/lib/auth";
import { azFormatDateTime } from "@/lib/datetime";
import PanelIcon from "@/components/PanelIcon";
import { toast } from "@/components/Toast";
import {
  PageHead,
  Card,
  CardPad,
  DataTable,
  Status,
  Button,
  IconButton,
  SearchInput,
  Select,
  Stats,
  Stat,
  Modal,
  type Column,
  type StatusTone,
} from "@/components/ui";

const STATUS_TONE: Record<string, StatusTone> = { PUBLISHED: "positive", DRAFT: "muted" };
const statusLabel = (s?: string) => (s === "PUBLISHED" ? "Yayımlandı" : "Qaralama");

const STATUS_FILTERS = [
  { v: "all", label: "Bütün statuslar" },
  { v: "PUBLISHED", label: "Yayımlanmış" },
  { v: "DRAFT", label: "Qaralama" },
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

const authorLabel = (p: BlogPost) => (p.authorId ? (p.authorName || "Psixoloq") : "Platforma");
const authorRoleLabel = (p: BlogPost) => (p.authorRole === "PSYCHOLOGIST" ? "Psixoloq" : "Admin");

export default function AdminBlogPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [summary, setSummary] = useState<BlogSummary | null>(null);
  const loadSummary = useCallback(() => { adminApi.getBlogSummary().then(setSummary).catch(() => {}); }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const [data, setData] = useState<Paged<BlogPost> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const dq = useDebounce(search, 300);
  const [statusF, setStatusF] = useState("all");
  const [authorF, setAuthorF] = useState("all");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(30);
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminApi.getBlogPostsPaged({
      q: dq.trim() || undefined,
      status: statusF === "all" ? undefined : statusF,
      author: authorF === "all" ? undefined : authorF,
      sort, dir, page, size,
    })
      .then((res) => { setData(res); if (res.totalPages > 0 && page >= res.totalPages) setPage(0); })
      .catch((e) => setError((e as Error).message || "Məqalələr yüklənmədi"))
      .finally(() => setLoading(false));
  }, [dq, statusF, authorF, sort, dir, page, size]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); setSelected(new Set()); }, [dq, statusF, authorF]);

  const refresh = useCallback(() => { load(); loadSummary(); }, [load, loadSummary]);

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(okMsg, "success"); refresh(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };

  const toggleStatus = (p: BlogPost) =>
    act(() => adminApi.setBlogPostStatus(p.id, p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"),
      p.status === "PUBLISHED" ? "Məqalə gizlədildi" : "Məqalə yayımlandı");
  const toggleFeatured = (p: BlogPost) =>
    act(() => adminApi.setBlogPostFeatured(p.id, !p.featured),
      p.featured ? "Önə çıxarmadan çıxarıldı" : "Önə çıxarıldı");

  const bulk = (action: "PUBLISH" | "UNPUBLISH" | "FEATURE" | "UNFEATURE" | "DELETE", okMsg: string) => {
    const ids = [...selected].map(Number);
    if (ids.length === 0) return;
    act(() => adminApi.bulkBlogAction(ids, action), okMsg).then(() => setSelected(new Set()));
  };

  const columns: Column<BlogPost>[] = [
    {
      key: "title", header: "Başlıq", sortable: true,
      cell: (p) => (
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
          {p.featured && <PanelIcon name="star" size={15} color="var(--brand)" />}
          <div style={{ minWidth: 0 }}>
            <div className="fx-row__title" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{p.title}</span>
              {p.hasPendingDraft && <Status tone="wait">Gözləyən dəyişiklik</Status>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "author", header: "Müəllif", hideOnMobile: true,
      cell: (p) => (
        <span style={{ display: "inline-flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span>{authorLabel(p)}</span>
          <span className="fx-subtitle">{authorRoleLabel(p)}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", sortable: true, cell: (p) => <Status tone={STATUS_TONE[p.status] ?? "neutral"}>{statusLabel(p.status)}</Status> },
    { key: "views", header: "Baxış", sortable: true, numeric: true, cell: (p) => <span className="fx-num">{p.viewCount ?? 0}</span> },
    { key: "createdAt", header: "Tarix", sortable: true, hideOnMobile: true, cell: (p) => <span className="fx-num" style={{ whiteSpace: "nowrap" }}>{p.createdAt ? azFormatDateTime(p.createdAt) : "—"}</span> },
  ];

  if (!mounted) return null;

  const selCount = selected.size;

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead title="Məqalələr" sub="Platformadakı bütün məqalələr — admin və psixoloq yazıları."
        actions={<Button variant="primary" onClick={() => router.push("/admin/blog/new")} icon={<PanelIcon name="plus" size={16} />}>Yeni məqalə</Button>} />

      <Stats style={{ marginBottom: 16, gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
        <Stat value={summary?.total ?? "—"} label="Ümumi" />
        <Stat value={summary?.published ?? "—"} label="Yayımlanmış" />
        <Stat value={summary?.draft ?? "—"} label="Qaralama" />
        <Stat value={summary?.byPsychologist ?? "—"} label="Psixoloq yazısı" />
        <Stat value={summary?.pendingDrafts ?? "—"} label="Gözləyən dəyişiklik" />
        <Stat value={summary?.totalViews ?? "—"} label="Cəmi baxış" />
      </Stats>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Başlıq, kateqoriya və ya müəllif üzrə axtar" aria-label="Axtar" autoComplete="off" />
          </div>
          <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label="Status süzgəci" style={{ maxWidth: 180 }}>
            {STATUS_FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </Select>
          <Select value={authorF} onChange={(e) => setAuthorF(e.target.value)} aria-label="Müəllif süzgəci" style={{ maxWidth: 180 }}>
            {AUTHOR_FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </Select>
        </div>

        {selCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)", background: "var(--surface-2, #f8fafc)" }}>
            <span className="fx-subtitle" style={{ marginRight: 4 }}>{selCount} seçilib:</span>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => bulk("PUBLISH", "Seçilmişlər yayımlandı")}>Yayımla</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => bulk("UNPUBLISH", "Seçilmişlər gizlədildi")}>Gizlət</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => bulk("FEATURE", "Seçilmişlər önə çıxarıldı")}>Önə çıxar</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => bulk("UNFEATURE", "Seçilmişlər önə çıxarılmadan çıxarıldı")}>Çıxarma</Button>
            <Button variant="dangerGhost" size="sm" disabled={busy} onClick={() => setBulkDelete(true)}>Sil</Button>
          </div>
        )}

        <CardPad>
          <DataTable
            rows={data?.content ?? []}
            columns={columns}
            rowKey={(p) => p.id}
            loading={loading}
            error={error}
            onRetry={load}
            onRowClick={(p) => router.push(`/admin/blog/${p.id}/edit`)}
            selection={{ selectedKeys: selected, onChange: setSelected }}
            empty={{ title: "Məqalə tapılmadı", body: "Filtri dəyişin və ya yeni məqalə əlavə edin." }}
            sort={{ key: sort, dir }}
            onSortChange={(s) => { setSort(s.key); setDir(s.dir); setPage(0); }}
            actions={(p) => (
              <span style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <IconButton aria-label={p.featured ? "Önə çıxarmadan çıxar" : "Önə çıxar"} title={p.featured ? "Önə çıxarmadan çıxar" : "Önə çıxar"} disabled={busy} onClick={() => toggleFeatured(p)}>
                  <PanelIcon name="star" size={16} color={p.featured ? "var(--brand)" : "currentColor"} />
                </IconButton>
                <IconButton aria-label={p.status === "PUBLISHED" ? "Gizlət" : "Yayımla"} title={p.status === "PUBLISHED" ? "Gizlət" : "Yayımla"} disabled={busy} onClick={() => toggleStatus(p)}>
                  <PanelIcon name={p.status === "PUBLISHED" ? "eye" : "check"} size={16} />
                </IconButton>
                <IconButton aria-label="Saytda bax" title="Saytda bax" onClick={() => window.open(`${getMainSiteUrl()}/blog/${p.slug}`, "_blank", "noopener")}>
                  <PanelIcon name="arrow-right" size={16} />
                </IconButton>
                <IconButton aria-label="Redaktə et" title="Redaktə et" onClick={() => router.push(`/admin/blog/${p.id}/edit`)}>
                  <PanelIcon name="edit" size={16} />
                </IconButton>
                <IconButton aria-label="Sil" title="Sil" disabled={busy} onClick={() => setDeleteTarget(p)}>
                  <PanelIcon name="x" size={16} />
                </IconButton>
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

      {/* Tək məqalə silmə təsdiqi */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Məqaləni sil"
        text={deleteTarget ? `"${deleteTarget.title}" həmişəlik silinəcək. Bu əməliyyat geri qaytarıla bilməz.` : ""}
        icon={<PanelIcon name="x" size={20} />} iconTone="rose"
        actions={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>İmtina</Button>
          <Button variant="danger" disabled={busy} onClick={() => {
            const t = deleteTarget; if (!t) return;
            act(() => adminApi.deleteBlogPost(t.id, t.slug), "Məqalə silindi").then(() => setDeleteTarget(null));
          }}>{busy ? "Silinir…" : "Sil"}</Button>
        </>} />

      {/* Toplu silmə təsdiqi */}
      <Modal open={bulkDelete} onClose={() => setBulkDelete(false)} title={`${selCount} məqaləni sil`}
        text="Seçilmiş məqalələr həmişəlik silinəcək. Bu əməliyyat geri qaytarıla bilməz."
        icon={<PanelIcon name="x" size={20} />} iconTone="rose"
        actions={<>
          <Button variant="ghost" onClick={() => setBulkDelete(false)}>İmtina</Button>
          <Button variant="danger" disabled={busy} onClick={() => { setBulkDelete(false); bulk("DELETE", "Seçilmişlər silindi"); }}>{busy ? "Silinir…" : `${selCount} məqaləni sil`}</Button>
        </>} />
    </div>
  );
}
