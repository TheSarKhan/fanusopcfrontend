"use client";

// Admin · Mesajlar — publik "Əlaqə" formasından gələn mesajlar. DataTable + status filtri,
// axtarış, sıralama, front+back pagination; detal, status idarəsi (baxılır/həll/spam + qeyd),
// e-poçtla cavab, silmə, toplu əməliyyat.

import { useCallback, useEffect, useState } from "react";
import { adminApi, type ContactMessage, type ContactMessageStats, type Paged, type SortDir } from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";
import PanelIcon from "@/components/PanelIcon";
import { toast } from "@/components/Toast";
import {
  PageHead, Card, CardPad, DataTable, Status, Button, IconButton,
  SearchInput, Select, Stats, Stat, Modal, Field, Textarea,
  type Column, type StatusTone,
} from "@/components/ui";

type Stat4 = ContactMessage["status"];
const STATUS_TONE: Record<string, StatusTone> = { NEW: "wait", IN_REVIEW: "neutral", RESOLVED: "positive", SPAM: "muted" };
const STATUS_LABEL: Record<string, string> = { NEW: "Yeni", IN_REVIEW: "Baxılır", RESOLVED: "Həll olundu", SPAM: "Spam" };

const STATUS_FILTERS = [
  { v: "all", label: "Bütün statuslar" },
  { v: "NEW", label: "Yeni" },
  { v: "IN_REVIEW", label: "Baxılır" },
  { v: "RESOLVED", label: "Həll olundu" },
  { v: "SPAM", label: "Spam" },
];
const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

export default function AdminMessagesPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [summary, setSummary] = useState<ContactMessageStats | null>(null);
  const loadSummary = useCallback(() => { adminApi.getContactMessagesSummary().then(setSummary).catch(() => {}); }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const [data, setData] = useState<Paged<ContactMessage> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const dq = useDebounce(search, 300);
  const [statusF, setStatusF] = useState("all");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(30);
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<ContactMessage | null>(null);
  const [replyFor, setReplyFor] = useState<ContactMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactMessage | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminApi.getContactMessagesPaged({
      q: dq.trim() || undefined,
      status: statusF === "all" ? undefined : statusF,
      sort, dir, page, size,
    })
      .then((res) => { setData(res); if (res.totalPages > 0 && page >= res.totalPages) setPage(0); })
      .catch((e) => setError((e as Error).message || "Mesajlar yüklənmədi"))
      .finally(() => setLoading(false));
  }, [dq, statusF, sort, dir, page, size]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); setSelected(new Set()); }, [dq, statusF]);

  const refresh = useCallback(() => { load(); loadSummary(); }, [load, loadSummary]);
  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(okMsg, "success"); refresh(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };

  const setStatus = (m: ContactMessage, status: Stat4, okMsg: string) =>
    act(() => adminApi.updateContactMessageStatus(m.id, status), okMsg).then(() => setDetail(null));

  const bulk = (action: "RESOLVED" | "SPAM" | "DELETE", okMsg: string) => {
    const ids = [...selected].map(Number);
    if (ids.length === 0) return;
    act(() => adminApi.bulkContactMessageAction(ids, action), okMsg).then(() => setSelected(new Set()));
  };

  const columns: Column<ContactMessage>[] = [
    {
      key: "name", header: "Göndərən", sortable: true,
      cell: (m) => (
        <div style={{ minWidth: 0 }}>
          <div className="fx-row__title">{m.name}</div>
          <div className="fx-subtitle">{m.email || m.phone || "—"}</div>
        </div>
      ),
    },
    {
      key: "subject", header: "Mövzu / Mesaj", hideOnMobile: true,
      cell: (m) => (
        <div style={{ minWidth: 0, maxWidth: 420 }}>
          {m.subject && <div className="fx-row__title" style={{ fontWeight: 600 }}>{m.subject}</div>}
          <div className="fx-subtitle" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.message}</div>
        </div>
      ),
    },
    { key: "status", header: "Status", sortable: true, cell: (m) => <Status tone={STATUS_TONE[m.status] ?? "neutral"}>{STATUS_LABEL[m.status] ?? m.status}</Status> },
    { key: "createdAt", header: "Tarix", cell: (m) => <span className="fx-num" style={{ whiteSpace: "nowrap" }}>{azFormatDateTime(m.createdAt)}</span> },
  ];

  if (!mounted) return null;
  const selCount = selected.size;

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead title="Mesajlar" sub="Əlaqə formasından gələn mesajlar." />

      <Stats style={{ marginBottom: 16, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
        <Stat value={summary?.total ?? "—"} label="Ümumi" />
        <Stat value={summary?.newCount ?? "—"} label="Yeni" />
        <Stat value={summary?.inReview ?? "—"} label="Baxılır" />
        <Stat value={summary?.resolved ?? "—"} label="Həll olundu" />
        <Stat value={summary?.spam ?? "—"} label="Spam" />
      </Stats>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, e-poçt, mövzu, mesaj və ya kod üzrə axtar" aria-label="Axtar" autoComplete="off" />
          </div>
          <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label="Status süzgəci" style={{ maxWidth: 190 }}>
            {STATUS_FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </Select>
        </div>

        {selCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)", background: "var(--surface-2, #f8fafc)" }}>
            <span className="fx-subtitle" style={{ marginRight: 4 }}>{selCount} seçilib:</span>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => bulk("RESOLVED", "Seçilmişlər həll olundu")}>Həll olundu</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => bulk("SPAM", "Seçilmişlər spam işarələndi")}>Spam</Button>
            <Button variant="dangerGhost" size="sm" disabled={busy} onClick={() => setBulkDelete(true)}>Sil</Button>
          </div>
        )}

        <CardPad>
          <DataTable
            rows={data?.content ?? []}
            columns={columns}
            rowKey={(m) => m.id}
            loading={loading}
            error={error}
            onRetry={load}
            onRowClick={(m) => setDetail(m)}
            selection={{ selectedKeys: selected, onChange: setSelected }}
            rowTone={(m) => (m.status === "NEW" ? "attn" : undefined)}
            empty={{ title: "Mesaj tapılmadı", body: "Filtri dəyişin və ya yeni mesaj gözləyin." }}
            sort={{ key: sort, dir }}
            onSortChange={(s) => { setSort(s.key); setDir(s.dir); setPage(0); }}
            actions={(m) => (
              <span style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <IconButton aria-label="Cavab yaz" title="Cavab yaz" disabled={!m.email} onClick={() => setReplyFor(m)}><PanelIcon name="message" size={16} /></IconButton>
                {m.status !== "RESOLVED" && <IconButton aria-label="Həll olundu" title="Həll olundu" disabled={busy} onClick={() => setStatus(m, "RESOLVED", "Həll olundu işarələndi")}><PanelIcon name="check" size={16} /></IconButton>}
                <IconButton aria-label="Sil" title="Sil" disabled={busy} onClick={() => setDeleteTarget(m)}><PanelIcon name="x" size={16} /></IconButton>
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
        <Modal open onClose={() => setDetail(null)} wide title={detail.subject || "Mesaj"}
          icon={<PanelIcon name="message" size={20} />}
          actions={<>
            <Button variant="ghost" onClick={() => setDetail(null)}>Bağla</Button>
            {detail.status !== "SPAM" && <Button variant="ghost" disabled={busy} onClick={() => setStatus(detail, "SPAM", "Spam işarələndi")}>Spam</Button>}
            {detail.status !== "RESOLVED" && <Button variant="ghost" disabled={busy} onClick={() => setStatus(detail, "RESOLVED", "Həll olundu")}>Həll olundu</Button>}
            {detail.email && <Button variant="primary" onClick={() => { const m = detail; setDetail(null); setReplyFor(m); }}>Cavab yaz</Button>}
          </>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Status tone={STATUS_TONE[detail.status] ?? "neutral"}>{STATUS_LABEL[detail.status] ?? detail.status}</Status>
              {detail.ticketCode && <span className="fx-subtitle">Kod: {detail.ticketCode}</span>}
              <span className="fx-subtitle">{azFormatDateTime(detail.createdAt)}</span>
            </div>
            <div><span className="fx-subtitle">Göndərən: </span>{detail.name}</div>
            {detail.email && <div><span className="fx-subtitle">E-poçt: </span>{detail.email}</div>}
            {detail.phone && <div><span className="fx-subtitle">Telefon: </span>{detail.phone}</div>}
            <div style={{ background: "#F6F9FE", borderRadius: 8, padding: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{detail.message}</div>
            {detail.replyText && (
              <div style={{ borderLeft: "3px solid var(--brand)", paddingLeft: 12 }}>
                <div className="fx-subtitle">Cavabınız {detail.repliedAt ? `(${azFormatDateTime(detail.repliedAt)})` : ""}:</div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{detail.replyText}</div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {replyFor && <ReplyModal message={replyFor} onClose={() => setReplyFor(null)} onDone={() => { setReplyFor(null); refresh(); }} />}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Mesajı sil"
        text={deleteTarget ? `"${deleteTarget.name}" göndərən mesaj həmişəlik silinəcək.` : ""}
        icon={<PanelIcon name="x" size={20} />} iconTone="rose"
        actions={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>İmtina</Button>
          <Button variant="danger" disabled={busy} onClick={() => { const m = deleteTarget; if (!m) return; act(() => adminApi.deleteContactMessage(m.id), "Mesaj silindi").then(() => setDeleteTarget(null)); }}>{busy ? "Silinir…" : "Sil"}</Button>
        </>} />

      <Modal open={bulkDelete} onClose={() => setBulkDelete(false)} title={`${selCount} mesajı sil`}
        text="Seçilmiş mesajlar həmişəlik silinəcək."
        icon={<PanelIcon name="x" size={20} />} iconTone="rose"
        actions={<>
          <Button variant="ghost" onClick={() => setBulkDelete(false)}>İmtina</Button>
          <Button variant="danger" disabled={busy} onClick={() => { setBulkDelete(false); bulk("DELETE", "Seçilmişlər silindi"); }}>{busy ? "Silinir…" : `${selCount} mesajı sil`}</Button>
        </>} />
    </div>
  );
}

// ── E-poçtla cavab ───────────────────────────────────────────────────────────
function ReplyModal({ message, onClose, onDone }: { message: ContactMessage; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = text.trim().length > 0;
  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await adminApi.replyContactMessage(message.id, text.trim());
      toast(`Cavab ${message.email}-ə göndərildi`, "success");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} wide title="E-poçtla cavab"
      text={`Cavab ${message.email} ünvanına göndəriləcək.`}
      icon={<PanelIcon name="message" size={20} />}
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant="primary" disabled={!ready || busy} onClick={submit}>{busy ? "Göndərilir…" : "Göndər"}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "#F6F9FE", borderRadius: 8, padding: 12, fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5, maxHeight: 160, overflow: "auto" }}>
          <div className="fx-subtitle" style={{ marginBottom: 4 }}>{message.name}{message.subject ? ` — ${message.subject}` : ""}:</div>
          {message.message}
        </div>
        <Field label="Cavabınız">
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Cavab mətnini yazın…" autoFocus />
        </Field>
      </div>
    </Modal>
  );
}
