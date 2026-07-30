"use client";

// Admin · Rəylər — psixoloqlara yazılmış bütün rəylər. DataTable + status/reytinq filtri,
// axtarış, sıralama, front+back pagination; moderasiya (təsdiqlə/rədd et/sil). Rəylər
// avtomatik dərc olunur (APPROVED); admin uyğunsuz olanı rədd edir/silir.

import { useCallback, useEffect, useState } from "react";
import { adminApi, type AdminReview, type ReviewStats, type Paged, type SortDir } from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";
import PanelIcon from "@/components/PanelIcon";
import { toast } from "@/components/Toast";
import {
  PageHead, Card, CardPad, DataTable, Status, Button, IconButton,
  SearchInput, Select, Stats, Stat, Modal, Field, Textarea, Avatar,
  type Column, type StatusTone,
} from "@/components/ui";

const STATUS_TONE: Record<string, StatusTone> = { PENDING: "wait", APPROVED: "positive", REJECTED: "risk" };
const STATUS_LABEL: Record<string, string> = { PENDING: "Gözləyir", APPROVED: "Təsdiqlənib", REJECTED: "Rədd edilib" };

const STATUS_FILTERS = [
  { v: "all", label: "Bütün statuslar" },
  { v: "APPROVED", label: "Təsdiqlənib" },
  { v: "PENDING", label: "Gözləyir" },
  { v: "REJECTED", label: "Rədd edilib" },
];
const RATING_FILTERS = [
  { v: "all", label: "Bütün reytinqlər" },
  { v: "5", label: "5 ulduz" }, { v: "4", label: "4 ulduz" }, { v: "3", label: "3 ulduz" },
  { v: "2", label: "2 ulduz" }, { v: "1", label: "1 ulduz" },
];
const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

const Stars = ({ n }: { n: number }) => (
  <span style={{ color: "#F5B301", fontWeight: 700, whiteSpace: "nowrap" }} aria-label={`${n} ulduz`}>
    {"★".repeat(Math.max(0, Math.min(5, n)))}<span style={{ color: "var(--fanus-line, #dde5f0)" }}>{"★".repeat(5 - Math.max(0, Math.min(5, n)))}</span>
  </span>
);

export default function AdminReviewsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [summary, setSummary] = useState<ReviewStats | null>(null);
  const loadSummary = useCallback(() => { adminApi.getReviewsSummary().then(setSummary).catch(() => {}); }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const [data, setData] = useState<Paged<AdminReview> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const dq = useDebounce(search, 300);
  const [statusF, setStatusF] = useState("all");
  const [ratingF, setRatingF] = useState("all");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(30);
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState<SortDir>("desc");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<AdminReview | null>(null);
  const [reject, setReject] = useState<AdminReview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminReview | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminApi.getReviewsPaged({
      q: dq.trim() || undefined,
      status: statusF === "all" ? undefined : statusF,
      rating: ratingF === "all" ? undefined : Number(ratingF),
      sort, dir, page, size,
    })
      .then((res) => { setData(res); if (res.totalPages > 0 && page >= res.totalPages) setPage(0); })
      .catch((e) => setError((e as Error).message || "Rəylər yüklənmədi"))
      .finally(() => setLoading(false));
  }, [dq, statusF, ratingF, sort, dir, page, size]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [dq, statusF, ratingF]);

  const refresh = useCallback(() => { load(); loadSummary(); }, [load, loadSummary]);
  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(okMsg, "success"); refresh(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };

  const approve = (r: AdminReview) => act(() => adminApi.approveReview(r.id), "Rəy təsdiqləndi").then(() => setDetail(null));

  const columns: Column<AdminReview>[] = [
    {
      key: "psychologist", header: "Psixoloq",
      cell: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={r.psychologistName ?? "—"} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div className="fx-row__title">{r.psychologistName ?? "—"}</div>
            <div className="fx-subtitle">Pasiyent: {r.patientName ?? "—"}</div>
          </div>
        </div>
      ),
    },
    { key: "rating", header: "Reytinq", sortable: true, cell: (r) => <Stars n={r.rating} /> },
    {
      key: "comment", header: "Rəy", hideOnMobile: true,
      cell: (r) => <div style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.comment}</div>,
    },
    { key: "status", header: "Status", sortable: true, cell: (r) => <Status tone={STATUS_TONE[r.status] ?? "neutral"}>{STATUS_LABEL[r.status] ?? r.status}</Status> },
    { key: "createdAt", header: "Tarix", cell: (r) => <span className="fx-num" style={{ whiteSpace: "nowrap" }}>{azFormatDateTime(r.createdAt)}</span> },
  ];

  if (!mounted) return null;

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead title="Rəylər" sub="Psixoloqlara yazılmış bütün rəylər." />

      <Stats style={{ marginBottom: 16, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
        <Stat value={summary?.total ?? "—"} label="Ümumi" />
        <Stat value={summary?.approved ?? "—"} label="Təsdiqlənib" />
        <Stat value={summary?.pending ?? "—"} label="Gözləyir" />
        <Stat value={summary?.rejected ?? "—"} label="Rədd edilib" />
        <Stat value={summary ? summary.avgRating.toFixed(1) : "—"} label="Orta reytinq" />
      </Stats>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 340 }}>
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Psixoloq, pasiyent və ya rəy mətni üzrə axtar" aria-label="Axtar" autoComplete="off" />
          </div>
          <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label="Status süzgəci" style={{ maxWidth: 170 }}>
            {STATUS_FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </Select>
          <Select value={ratingF} onChange={(e) => setRatingF(e.target.value)} aria-label="Reytinq süzgəci" style={{ maxWidth: 150 }}>
            {RATING_FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
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
            onRowClick={(r) => setDetail(r)}
            empty={{ title: "Rəy tapılmadı", body: "Filtri dəyişin və ya yeni rəy gözləyin." }}
            sort={{ key: sort, dir }}
            onSortChange={(s) => { setSort(s.key); setDir(s.dir); setPage(0); }}
            actions={(r) => (
              <span style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                {r.status !== "APPROVED" && <IconButton aria-label="Təsdiqlə" title="Təsdiqlə" disabled={busy} onClick={() => approve(r)}><PanelIcon name="check" size={16} /></IconButton>}
                {r.status !== "REJECTED" && <IconButton aria-label="Rədd et" title="Rədd et" disabled={busy} onClick={() => setReject(r)}><PanelIcon name="flag" size={16} /></IconButton>}
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

      {/* Detal */}
      {detail && (
        <Modal open onClose={() => setDetail(null)} wide title="Rəy"
          icon={<PanelIcon name="star" size={20} />}
          actions={<>
            <Button variant="ghost" onClick={() => setDetail(null)}>Bağla</Button>
            {detail.status !== "REJECTED" && <Button variant="ghost" disabled={busy} onClick={() => { const r = detail; setDetail(null); setReject(r); }}>Rədd et</Button>}
            {detail.status !== "APPROVED" && <Button variant="primary" disabled={busy} onClick={() => approve(detail)}>Təsdiqlə</Button>}
          </>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Stars n={detail.rating} />
              <Status tone={STATUS_TONE[detail.status] ?? "neutral"}>{STATUS_LABEL[detail.status] ?? detail.status}</Status>
              <span className="fx-subtitle">{azFormatDateTime(detail.createdAt)}</span>
            </div>
            <div><span className="fx-subtitle">Psixoloq: </span>{detail.psychologistName}</div>
            <div><span className="fx-subtitle">Pasiyent: </span>{detail.patientName}</div>
            <div style={{ background: "#F6F9FE", borderRadius: 8, padding: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{detail.comment}</div>
            {detail.reply && (
              <div style={{ borderLeft: "3px solid var(--brand)", paddingLeft: 12 }}>
                <div className="fx-subtitle">Psixoloqun cavabı:</div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{detail.reply}</div>
              </div>
            )}
            {detail.moderationNote && <div className="fx-subtitle">Moderasiya qeydi: {detail.moderationNote}{detail.moderatedByEmail ? ` (${detail.moderatedByEmail})` : ""}</div>}
          </div>
        </Modal>
      )}

      {/* Rədd et (səbəb ixtiyari) */}
      {reject && <RejectModal review={reject} onClose={() => setReject(null)} onDone={() => { setReject(null); refresh(); }} />}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Rəyi sil"
        text={deleteTarget ? `${deleteTarget.psychologistName} haqqında rəy həmişəlik silinəcək.` : ""}
        icon={<PanelIcon name="x" size={20} />} iconTone="rose"
        actions={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>İmtina</Button>
          <Button variant="danger" disabled={busy} onClick={() => { const r = deleteTarget; if (!r) return; act(() => adminApi.deleteReview(r.id), "Rəy silindi").then(() => setDeleteTarget(null)); }}>{busy ? "Silinir…" : "Sil"}</Button>
        </>} />
    </div>
  );
}

// ── Rədd et modalı ───────────────────────────────────────────────────────────
function RejectModal({ review, onClose, onDone }: { review: AdminReview; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await adminApi.rejectReview(review.id, note.trim() || undefined);
      toast("Rəy rədd edildi — saytda görünməyəcək", "success");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Rəyi rədd et"
      text={`${review.psychologistName} haqqında rəy rədd ediləcək və saytda görünməyəcək.`}
      icon={<PanelIcon name="flag" size={20} />} iconTone="rose"
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant="danger" disabled={busy} onClick={submit}>{busy ? "Göndərilir…" : "Rədd et"}</Button>
      </>}>
      <Field label="Səbəb" help="İxtiyari — daxili moderasiya qeydi.">
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
