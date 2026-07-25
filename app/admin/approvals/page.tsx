"use client";

// Admin · Təsdiqlər — operatorun kritik əməliyyatlarının vahid təsdiq mərkəzi.
// Mənbələr bir siyahıda birləşir: ümumi gate tələbləri (bloklama, ödəniş mark-paid/ləğv,
// komissiya, qiymət — V120), İadə və Hovuz-buraxma. Ön-təsdiq modeli: operator əməliyyatı
// PENDING qalır, admin təsdiqləyənə qədər icra olunmur. Siyahı, süzgəc və səhifələmə
// müştəri tərəfindədir (təsdiqlər az həcmlidir).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminApi,
  type PendingApprovalRow,
  type ApprovalKind,
  type ApprovalStatus,
} from "@/lib/api";
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
  Field,
  Textarea,
  type Column,
  type StatusTone,
} from "@/components/ui";

const STATUS_TONE: Record<ApprovalStatus, StatusTone> = {
  PENDING: "wait", APPROVED: "positive", REJECTED: "muted",
};
const STATUS_LABEL: Record<ApprovalStatus, string> = {
  PENDING: "Gözləyir", APPROVED: "Təsdiqləndi", REJECTED: "Rədd edildi",
};

const KIND_LABEL: Record<ApprovalKind, string> = {
  APPROVAL: "Əməliyyat təsdiqi", REFUND: "İadə", POOL_RELEASE: "Hovuz-buraxma",
};

const STATUS_FILTERS: { v: string; label: string; status?: ApprovalStatus }[] = [
  { v: "PENDING", label: "Gözləyən", status: "PENDING" },
  { v: "APPROVED", label: "Təsdiqlənmiş", status: "APPROVED" },
  { v: "REJECTED", label: "Rədd edilmiş", status: "REJECTED" },
  { v: "all", label: "Hamısı" },
];
const KIND_FILTERS: { v: string; label: string; kind?: ApprovalKind }[] = [
  { v: "all", label: "Bütün növlər" },
  { v: "APPROVAL", label: "Əməliyyat təsdiqi", kind: "APPROVAL" },
  { v: "REFUND", label: "İadə", kind: "REFUND" },
  { v: "POOL_RELEASE", label: "Hovuz-buraxma", kind: "POOL_RELEASE" },
];
const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

const rowKeyOf = (r: PendingApprovalRow) => `${r.kind}-${r.id}`;

export default function AdminApprovalsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [rows, setRows] = useState<PendingApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const dq = useDebounce(search, 300).trim().toLowerCase();
  const [statusF, setStatusF] = useState("PENDING");
  const [kindF, setKindF] = useState("all");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(30);

  const [decision, setDecision] = useState<{ row: PendingApprovalRow; approve: boolean } | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    // Bütün statusları çəkirik ki, KPI tam bölgünü göstərsin; süzgəc müştəridədir.
    adminApi.listAllApprovals()
      .then(setRows)
      .catch((e) => setError((e as Error).message || "Təsdiqlər yüklənmədi"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [dq, statusF, kindF]);

  const counts = useMemo(() => ({
    pending: rows.filter((r) => r.status === "PENDING").length,
    approved: rows.filter((r) => r.status === "APPROVED").length,
    rejected: rows.filter((r) => r.status === "REJECTED").length,
    total: rows.length,
  }), [rows]);

  const filtered = useMemo(() => {
    const st = STATUS_FILTERS.find((f) => f.v === statusF)?.status;
    const kd = KIND_FILTERS.find((f) => f.v === kindF)?.kind;
    return rows.filter((r) => {
      if (st && r.status !== st) return false;
      if (kd && r.kind !== kd) return false;
      if (dq) {
        const hay = `${r.title} ${r.subtitle ?? ""} ${r.requestedByName ?? ""}`.toLowerCase();
        if (!hay.includes(dq)) return false;
      }
      return true;
    });
  }, [rows, statusF, kindF, dq]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const pageRows = useMemo(() => filtered.slice(page * size, (page + 1) * size), [filtered, page, size]);

  const columns: Column<PendingApprovalRow>[] = [
    {
      key: "title", header: "Əməliyyat",
      cell: (r) => (
        <div style={{ minWidth: 0 }}>
          <div className="fx-row__title">{r.title}</div>
          <div className="fx-subtitle">{KIND_LABEL[r.kind]}</div>
        </div>
      ),
    },
    { key: "subtitle", header: "Kontekst", hideOnMobile: true, cell: (r) => r.subtitle ? <span>{r.subtitle}</span> : <span className="fx-subtitle">—</span> },
    { key: "requestedByName", header: "Tələb edən", hideOnMobile: true, cell: (r) => r.requestedByName ?? <span className="fx-subtitle">—</span> },
    { key: "createdAt", header: "Tarix", cell: (r) => <span className="fx-num" style={{ whiteSpace: "nowrap" }}>{azFormatDateTime(r.createdAt)}</span> },
    {
      key: "status", header: "Status",
      cell: (r) => (
        <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
          <Status tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Status>
          {r.status !== "PENDING" && r.decisionNote && <span className="fx-subtitle">{r.decisionNote}</span>}
        </span>
      ),
    },
  ];

  if (!mounted) return null;

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead title="Təsdiqlər" sub="Operatorun kritik əməliyyatları — bloklama, ödəniş, komissiya, qiymət, iadə və hovuz-buraxma bir yerdə." />

      <Stats style={{ marginBottom: 16, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <Stat value={counts.pending} label="Gözləyən" />
        <Stat value={counts.approved} label="Təsdiqlənmiş" />
        <Stat value={counts.rejected} label="Rədd edilmiş" />
        <Stat value={counts.total} label="Ümumi" />
      </Stats>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Əməliyyat, kontekst və ya operator üzrə axtar" aria-label="Axtar" autoComplete="off" />
          </div>
          <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label="Status süzgəci" style={{ maxWidth: 190 }}>
            {STATUS_FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </Select>
          <Select value={kindF} onChange={(e) => setKindF(e.target.value)} aria-label="Növ süzgəci" style={{ maxWidth: 190 }}>
            {KIND_FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </Select>
        </div>
        <CardPad>
          <DataTable
            rows={pageRows}
            columns={columns}
            rowKey={rowKeyOf}
            loading={loading}
            error={error}
            onRetry={load}
            empty={{ title: "Təsdiq tapılmadı", body: "Seçilmiş süzgəcə uyğun təsdiq tələbi yoxdur." }}
            actions={(r) => r.status === "PENDING" ? (
              <span style={{ display: "inline-flex", gap: 6 }}>
                <IconButton aria-label="Təsdiqlə" title="Təsdiqlə" onClick={() => setDecision({ row: r, approve: true })}><PanelIcon name="check" size={16} /></IconButton>
                <IconButton aria-label="Rədd et" title="Rədd et" onClick={() => setDecision({ row: r, approve: false })}><PanelIcon name="x" size={16} /></IconButton>
              </span>
            ) : <span className="fx-subtitle" style={{ whiteSpace: "nowrap" }}>{r.decidedAt ? azFormatDateTime(r.decidedAt) : "—"}</span>}
            pagination={{
              page: page + 1, pageCount,
              onChange: (p) => setPage(p - 1), pageSize: size,
              onPageSizeChange: (s) => { setSize(s); setPage(0); }, pageSizeOptions: PAGE_SIZE_OPTIONS,
            }}
            totalLabel={filtered.length > 0
              ? `Göstərilir: ${page * size + 1}–${Math.min((page + 1) * size, filtered.length)} / ${filtered.length}`
              : undefined}
          />
        </CardPad>
      </Card>

      {decision && (
        <DecisionModal
          row={decision.row}
          approve={decision.approve}
          onClose={() => setDecision(null)}
          onDone={() => { setDecision(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Təsdiq / rədd modalı (səbəb ixtiyari) ────────────────────────────────────
function DecisionModal({ row, approve, onClose, onDone }: {
  row: PendingApprovalRow; approve: boolean; onClose: () => void; onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await adminApi.decideApproval(row.kind, row.id, approve, note.trim() || undefined);
      toast(approve ? "Təsdiqləndi və icra olundu" : "Rədd edildi", "success");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose}
      title={approve ? "Əməliyyatı təsdiqlə" : "Tələbi rədd et"}
      text={approve
        ? `"${row.title}" indi icra olunacaq${row.subtitle ? ` — ${row.subtitle}` : ""}.`
        : `"${row.title}" rədd ediləcək və icra olunmayacaq${row.subtitle ? ` — ${row.subtitle}` : ""}.`}
      icon={<PanelIcon name={approve ? "check" : "x"} size={20} />}
      iconTone={approve ? "brand" : "rose"}
      actions={<>
        <Button variant="ghost" onClick={onClose}>İmtina</Button>
        <Button variant={approve ? "primary" : "danger"} disabled={busy} onClick={submit}>
          {busy ? (approve ? "Təsdiqlənir…" : "Rədd edilir…") : (approve ? "Təsdiqlə" : "Rədd et")}
        </Button>
      </>}>
      <Field label="Qeyd" help="İxtiyari — tələbi edən operatora göndərilir.">
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
