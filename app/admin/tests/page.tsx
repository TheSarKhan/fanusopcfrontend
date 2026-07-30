"use client";

// Admin · Testlər — platformadakı bütün psixoloji testlər (admin platforma testləri +
// psixoloq testləri) bir yerdə. DataTable + status/müəllif filtri, sıralama, front+back
// pagination; sürətli yayımla/gizlət, toplu əməliyyat, paylaşım moderasiyası (psixoloqun
// paylaşım tələbini təsdiqlə/rədd et). Psixoloqlar platforma testlərini artıq görür/istifadə edir.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, type PsyTestSummary, type TestStats, type Paged, type SortDir } from "@/lib/api";
import PanelIcon from "@/components/PanelIcon";
import { toast } from "@/components/Toast";
import {
  PageHead, Card, CardPad, DataTable, Status, Button, IconButton,
  SearchInput, Select, Stats, Stat, Modal, Field, Textarea,
  type Column, type StatusTone,
} from "@/components/ui";

const STATUS_TONE: Record<string, StatusTone> = { PUBLISHED: "positive", DRAFT: "muted" };
const statusLabel = (s?: string) => (s === "PUBLISHED" ? "Yayımlandı" : "Qaralama");

const SHARE_TONE: Record<string, StatusTone> = { PRIVATE: "muted", PENDING: "wait", APPROVED: "positive", REJECTED: "risk" };
const SHARE_LABEL: Record<string, string> = { PRIVATE: "Şəxsi", PENDING: "Təsdiq gözləyir", APPROVED: "Paylaşılıb", REJECTED: "Rədd edilib" };

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

const authorLabel = (t: PsyTestSummary) => t.authorName || (t.authorRole === "PSYCHOLOGIST" ? "Psixoloq" : "Platforma");
const authorRoleLabel = (t: PsyTestSummary) => (t.authorRole === "PSYCHOLOGIST" ? "Psixoloq" : "Admin");

export default function AdminTestsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [summary, setSummary] = useState<TestStats | null>(null);
  const loadSummary = useCallback(() => { adminApi.getPsychTestsSummary().then(setSummary).catch(() => {}); }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const [data, setData] = useState<Paged<PsyTestSummary> | null>(null);
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
  const [deleteTarget, setDeleteTarget] = useState<PsyTestSummary | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [share, setShare] = useState<{ row: PsyTestSummary; approve: boolean } | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminApi.getPsychTestsPaged({
      q: dq.trim() || undefined,
      status: statusF === "all" ? undefined : statusF,
      author: authorF === "all" ? undefined : authorF,
      sort, dir, page, size,
    })
      .then((res) => { setData(res); if (res.totalPages > 0 && page >= res.totalPages) setPage(0); })
      .catch((e) => setError((e as Error).message || "Testlər yüklənmədi"))
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

  const togglePublished = (t: PsyTestSummary) =>
    act(() => adminApi.setPsychTestPublished(t.id, !t.published), t.published ? "Test gizlədildi" : "Test yayımlandı");

  const bulk = (action: "PUBLISH" | "UNPUBLISH" | "DELETE", okMsg: string) => {
    const ids = [...selected].map(Number);
    if (ids.length === 0) return;
    act(() => adminApi.bulkPsychTestAction(ids, action), okMsg).then(() => setSelected(new Set()));
  };

  const columns: Column<PsyTestSummary>[] = [
    {
      key: "title", header: "Test", sortable: true,
      cell: (t) => (
        <div style={{ minWidth: 0 }}>
          <div className="fx-row__title" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>{t.title || "Adsız test"}</span>
            {t.shareStatus && t.shareStatus !== "PRIVATE" && <Status tone={SHARE_TONE[t.shareStatus] ?? "neutral"}>{SHARE_LABEL[t.shareStatus] ?? t.shareStatus}</Status>}
          </div>
          <div className="fx-subtitle">{t.questionCount} sual, {t.scaleCount} şkala</div>
        </div>
      ),
    },
    {
      key: "author", header: "Müəllif", hideOnMobile: true,
      cell: (t) => (
        <span style={{ display: "inline-flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span>{authorLabel(t)}</span>
          <span className="fx-subtitle">{authorRoleLabel(t)}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", sortable: true, cell: (t) => <Status tone={STATUS_TONE[t.status] ?? "neutral"}>{statusLabel(t.status)}</Status> },
    { key: "published", header: "Yayımda", sortable: true, cell: (t) => <Status tone={t.published ? "positive" : "muted"}>{t.published ? "Bəli" : "Xeyr"}</Status> },
    { key: "questions", header: "Suallar", sortable: true, numeric: true, cell: (t) => <span className="fx-num">{t.questionCount}</span> },
  ];

  if (!mounted) return null;
  const selCount = selected.size;

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead title="Testlər" sub="Platformadakı bütün psixoloji testlər — admin və psixoloq testləri."
        actions={<Button variant="primary" onClick={() => router.push("/admin/tests/new")} icon={<PanelIcon name="plus" size={16} />}>Yeni test</Button>} />

      <Stats style={{ marginBottom: 16, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
        <Stat value={summary?.total ?? "—"} label="Ümumi" />
        <Stat value={summary?.published ?? "—"} label="Yayımlanmış" />
        <Stat value={summary?.draft ?? "—"} label="Qaralama" />
        <Stat value={summary?.byPsychologist ?? "—"} label="Psixoloq testi" />
        <Stat value={summary?.pendingShares ?? "—"} label="Paylaşım gözləyir" />
      </Stats>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Başlıq və ya təsvir üzrə axtar" aria-label="Axtar" autoComplete="off" />
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
            <Button variant="dangerGhost" size="sm" disabled={busy} onClick={() => setBulkDelete(true)}>Sil</Button>
          </div>
        )}

        <CardPad>
          <DataTable
            rows={data?.content ?? []}
            columns={columns}
            rowKey={(t) => t.id}
            loading={loading}
            error={error}
            onRetry={load}
            onRowClick={(t) => router.push(`/admin/tests/${t.id}/edit`)}
            selection={{ selectedKeys: selected, onChange: setSelected }}
            empty={{ title: "Test tapılmadı", body: "Filtri dəyişin və ya yeni test əlavə edin." }}
            sort={{ key: sort, dir }}
            onSortChange={(s) => { setSort(s.key); setDir(s.dir); setPage(0); }}
            actions={(t) => (
              <span style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                {t.shareStatus === "PENDING" && (
                  <>
                    <IconButton aria-label="Paylaşımı təsdiqlə" title="Paylaşımı təsdiqlə" disabled={busy} onClick={() => setShare({ row: t, approve: true })}><PanelIcon name="check" size={16} /></IconButton>
                    <IconButton aria-label="Paylaşımı rədd et" title="Paylaşımı rədd et" disabled={busy} onClick={() => setShare({ row: t, approve: false })}><PanelIcon name="x" size={16} /></IconButton>
                  </>
                )}
                <IconButton aria-label={t.published ? "Gizlət" : "Yayımla"} title={t.published ? "Gizlət" : "Yayımla"} disabled={busy} onClick={() => togglePublished(t)}>
                  <PanelIcon name={t.published ? "eye" : "check"} size={16} />
                </IconButton>
                <IconButton aria-label="Redaktə et" title="Redaktə et" onClick={() => router.push(`/admin/tests/${t.id}/edit`)}><PanelIcon name="edit" size={16} /></IconButton>
                <IconButton aria-label="Sil" title="Sil" disabled={busy} onClick={() => setDeleteTarget(t)}><PanelIcon name="x" size={16} /></IconButton>
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

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Testi sil"
        text={deleteTarget ? `"${deleteTarget.title || "Adsız test"}" həmişəlik silinəcək. Bu əməliyyat geri qaytarıla bilməz.` : ""}
        icon={<PanelIcon name="x" size={20} />} iconTone="rose"
        actions={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>İmtina</Button>
          <Button variant="danger" disabled={busy} onClick={() => { const t = deleteTarget; if (!t) return; act(() => adminApi.deletePsychTest(t.id), "Test silindi").then(() => setDeleteTarget(null)); }}>{busy ? "Silinir…" : "Sil"}</Button>
        </>} />

      <Modal open={bulkDelete} onClose={() => setBulkDelete(false)} title={`${selCount} testi sil`}
        text="Seçilmiş testlər həmişəlik silinəcək. Bu əməliyyat geri qaytarıla bilməz."
        icon={<PanelIcon name="x" size={20} />} iconTone="rose"
        actions={<>
          <Button variant="ghost" onClick={() => setBulkDelete(false)}>İmtina</Button>
          <Button variant="danger" disabled={busy} onClick={() => { setBulkDelete(false); bulk("DELETE", "Seçilmişlər silindi"); }}>{busy ? "Silinir…" : `${selCount} testi sil`}</Button>
        </>} />

      {share && <ShareDecisionModal row={share.row} approve={share.approve} onClose={() => setShare(null)} onDone={() => { setShare(null); refresh(); }} />}
    </div>
  );
}

// ── Paylaşım təsdiqi/rəddi (psixoloqun paylaşım tələbi) ──────────────────────
function ShareDecisionModal({ row, approve, onClose, onDone }: {
  row: PsyTestSummary; approve: boolean; onClose: () => void; onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await (approve ? adminApi.approveTestShare(row.id, note.trim() || undefined) : adminApi.rejectTestShare(row.id, note.trim() || undefined));
      toast(approve ? "Paylaşım təsdiqləndi — test bütün psixoloqlara açıldı" : "Paylaşım rədd edildi", "success");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose}
      title={approve ? "Paylaşımı təsdiqlə" : "Paylaşımı rədd et"}
      text={approve
        ? `"${row.title}" bütün psixoloqlara açılacaq.`
        : `"${row.title}" paylaşımı rədd ediləcək — yalnız müəllif istifadə edə biləcək.`}
      icon={<PanelIcon name={approve ? "check" : "x"} size={20} />} iconTone={approve ? "brand" : "rose"}
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant={approve ? "primary" : "danger"} disabled={busy} onClick={submit}>{busy ? "Göndərilir…" : (approve ? "Təsdiqlə" : "Rədd et")}</Button>
      </>}>
      <Field label="Qeyd" help="İxtiyari — müəllifə göndərilir.">
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
