"use client";

// Admin · Audit log — platformadakı bütün önəmli əməliyyatların izi. Kim, nə əməliyyat,
// nə vaxt, hansı hədəf üzərində, xülasə, IP və user-agent. Backend paged + filter
// (əməliyyat, hədəf tipi, tarix aralığı, sərbəst axtarış). Detal modalı bütün sahələri göstərir.

import { useCallback, useEffect, useState } from "react";
import { adminApi, type AuditLogEntry, type PagedAuditLogs } from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";
import PanelIcon from "@/components/PanelIcon";
import {
  PageHead, Card, CardPad, DataTable, Status, IconButton,
  SearchInput, Select, Input, Modal, Button,
  type Column, type StatusTone,
} from "@/components/ui";

const PAGE_SIZE_OPTIONS = [30, 50, 100];

// Əməliyyat kodunu kateqoriyaya salır (vizual qruplaşdırma).
function categoryOf(action: string): { label: string; tone: StatusTone } {
  const a = action || "";
  if (/^(USER_|ADMIN_CHANGE_EMAIL|ADMIN_RESEND|ADMIN_SEND_PASSWORD|ADMIN_TERMINATE|OPERATOR_RESEND|PATIENT_CREATE)/.test(a)) return { label: "İstifadəçi", tone: "neutral" };
  if (/^(APPT_|ADMIN_APPT_)/.test(a)) return { label: "Randevu", tone: "neutral" };
  if (/^(RESCHEDULE_|ADMIN_SERIES_)/.test(a)) return { label: "Vaxt dəyişikliyi", tone: "neutral" };
  if (/^(PAYMENT_|PAYOUT_|COMMISSION_|REFUND_)/.test(a)) return { label: "Maliyyə", tone: "risk" };
  if (/^(PACKAGE_|FREE_INTRO|PSY_PACKAGE)/.test(a)) return { label: "Paket", tone: "neutral" };
  if (/^PSY_/.test(a)) return { label: "Psixoloq", tone: "neutral" };
  if (/^(APPROVAL_|POOL_RELEASE_|REVIEW_DELETION_)/.test(a)) return { label: "Təsdiqlər", tone: "wait" };
  if (/^SUBSCRIPTION_/.test(a)) return { label: "Abunə", tone: "neutral" };
  if (/^REFERRAL_/.test(a)) return { label: "Referral", tone: "neutral" };
  if (/^CLINICAL_/.test(a)) return { label: "Klinik", tone: "risk" };
  if (/^SYSTEM_/.test(a)) return { label: "Sistem", tone: "muted" };
  return { label: "Digər", tone: "muted" };
}

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

export default function AdminAuditLogsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [facets, setFacets] = useState<{ actions: string[]; targetTypes: string[] }>({ actions: [], targetTypes: [] });
  useEffect(() => { adminApi.getAuditFacets().then(setFacets).catch(() => {}); }, []);

  const [data, setData] = useState<PagedAuditLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const dq = useDebounce(search, 300);
  const [action, setAction] = useState("all");
  const [targetType, setTargetType] = useState("all");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(30);
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminApi.getAuditLogs({
      q: dq.trim() || undefined,
      action: action === "all" ? undefined : action,
      targetType: targetType === "all" ? undefined : targetType,
      since: since || undefined,
      until: until ? `${until}T23:59:59` : undefined,
      page, size,
    })
      .then((res) => { setData(res); if (res.totalPages > 0 && page >= res.totalPages) setPage(0); })
      .catch((e) => setError((e as Error).message || "Audit log yüklənmədi"))
      .finally(() => setLoading(false));
  }, [dq, action, targetType, since, until, page, size]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [dq, action, targetType, since, until]);

  const columns: Column<AuditLogEntry>[] = [
    { key: "createdAt", header: "Vaxt", cell: (r) => <span className="fx-num" style={{ whiteSpace: "nowrap" }}>{r.createdAt ? azFormatDateTime(r.createdAt) : "—"}</span> },
    {
      key: "actor", header: "Aktor",
      cell: (r) => (
        <div style={{ minWidth: 0 }}>
          <div className="fx-row__title">{r.actorEmail || "Sistem"}</div>
          {r.actorRole && <div className="fx-subtitle">{r.actorRole}</div>}
        </div>
      ),
    },
    {
      key: "action", header: "Əməliyyat",
      cell: (r) => {
        const c = categoryOf(r.action);
        return (
          <div style={{ minWidth: 0, display: "inline-flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontFamily: "var(--mono, ui-monospace, monospace)", fontSize: 12.5, fontWeight: 600 }}>{r.action}</span>
            <Status tone={c.tone}>{c.label}</Status>
          </div>
        );
      },
    },
    { key: "target", header: "Hədəf", hideOnMobile: true, cell: (r) => r.targetType ? <span className="fx-subtitle" style={{ whiteSpace: "nowrap" }}>{r.targetType}{r.targetId != null ? ` #${r.targetId}` : ""}</span> : <span className="fx-subtitle">—</span> },
    { key: "summary", header: "Xülasə", hideOnMobile: true, cell: (r) => <div style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.summary || "—"}</div> },
    { key: "ip", header: "IP", hideOnMobile: true, cell: (r) => <span className="fx-num fx-subtitle" style={{ whiteSpace: "nowrap" }}>{r.ip || "—"}</span> },
  ];

  if (!mounted) return null;

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead title="Audit log" sub="Platformadakı bütün önəmli əməliyyatların izi — kim, nə, nə vaxt, haradan." />

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 300 }}>
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Aktor, əməliyyat və ya xülasə üzrə axtar" aria-label="Axtar" autoComplete="off" />
          </div>
          <Select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Əməliyyat süzgəci" style={{ maxWidth: 220 }}>
            <option value="all">Bütün əməliyyatlar</option>
            {facets.actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <Select value={targetType} onChange={(e) => setTargetType(e.target.value)} aria-label="Hədəf tipi süzgəci" style={{ maxWidth: 170 }}>
            <option value="all">Bütün hədəflər</option>
            {facets.targetTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} aria-label="Başlanğıc tarix" style={{ maxWidth: 160 }} />
            <span className="fx-subtitle">–</span>
            <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="Son tarix" style={{ maxWidth: 160 }} />
          </div>
          {(since || until || action !== "all" || targetType !== "all" || dq) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setAction("all"); setTargetType("all"); setSince(""); setUntil(""); }}>Sıfırla</Button>
          )}
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
            empty={{ title: "Qeyd tapılmadı", body: "Filtri dəyişin və ya tarix aralığını genişləndirin." }}
            actions={(r) => <IconButton aria-label="Detal" onClick={() => setDetail(r)}><PanelIcon name="chevron" size={16} /></IconButton>}
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

      {detail && (
        <Modal open onClose={() => setDetail(null)} wide title="Audit qeydi"
          icon={<PanelIcon name="clock" size={20} />}
          actions={<Button variant="ghost" onClick={() => setDetail(null)}>Bağla</Button>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--mono, ui-monospace, monospace)", fontWeight: 700 }}>{detail.action}</span>
              <Status tone={categoryOf(detail.action).tone}>{categoryOf(detail.action).label}</Status>
              <span className="fx-subtitle">{detail.createdAt ? azFormatDateTime(detail.createdAt) : "—"}</span>
            </div>
            <Row label="Aktor" value={detail.actorEmail || "Sistem"} />
            <Row label="Rol" value={detail.actorRole || "—"} />
            <Row label="Aktor ID" value={detail.actorUserId != null ? String(detail.actorUserId) : "—"} />
            <Row label="Hədəf" value={detail.targetType ? `${detail.targetType}${detail.targetId != null ? ` #${detail.targetId}` : ""}` : "—"} />
            <Row label="IP" value={detail.ip || "—"} mono />
            <Row label="User-agent" value={detail.userAgent || "—"} />
            <div>
              <div className="fx-subtitle" style={{ marginBottom: 4 }}>Xülasə</div>
              <div style={{ background: "#F6F9FE", borderRadius: 8, padding: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{detail.summary || "—"}</div>
            </div>
            {detail.metadata && (
              <div>
                <div className="fx-subtitle" style={{ marginBottom: 4 }}>Əlavə məlumat</div>
                <pre style={{ background: "#0F1C2E", color: "#D6E4FF", borderRadius: 8, padding: 12, fontSize: 12, overflow: "auto", margin: 0 }}>{detail.metadata}</pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <span className="fx-subtitle" style={{ minWidth: 90 }}>{label}:</span>
      <span style={mono ? { fontFamily: "var(--mono, ui-monospace, monospace)" } : undefined}>{value}</span>
    </div>
  );
}
