"use client";

/**
 * Müraciətlər modulu — saytdan gələn anonim seans müraciətləri (Sayt BRD §8.2).
 * Hovuz (sahibsiz, hamı görür) → Götür → Mənim (yalnız mənə aid) → detal
 * səhifəsində Randevuya çevir / Paket sat. Çoxlu operator olanda qarışıqlıq
 * olmasın deyə görürünmə "Appointment pool"u ilə eyni sahiblik modelinə tabedir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { operatorApi, type SessionRequest } from "@/lib/api";
import { toast as uiToast } from "@/components/Toast";
import PageHeader from "@/components/PageHeader";
import { azFormatDate } from "@/lib/datetime";
import {
  Avatar,
  Button,
  Card,
  DataTable,
  IconButton,
  SearchInput,
  Status,
  Tabs,
  type Column,
  type StatusTone,
  type TabItem,
} from "@/components/ui";
import { IconCheck, IconChevronRight, IconClock, IconMail, IconPhone } from "./icons";

type Tab = "POOL" | "MINE" | "CONVERTED" | "CANCELLED";

const TAB_META: Record<Tab, { label: string }> = {
  POOL: { label: "Hovuz" },
  MINE: { label: "Baxılır" },
  CONVERTED: { label: "Qəbul edilmiş" },
  CANCELLED: { label: "Ləğv edilmiş" },
};

/** Status rəngli rozetlə deyil, mətnlə göstərilir. */
const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  NEW: { label: "Yeni", tone: "wait" },
  IN_REVIEW: { label: "Baxılır", tone: "neutral" },
  CONVERTED: { label: "Qəbul edildi", tone: "positive" },
  CANCELLED: { label: "Ləğv edilib", tone: "muted" },
};

const PAGE_SIZE = 30;
const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "indicə";
  if (min < 60) return `${min} dəq öncə`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} saat öncə`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} gün öncə`;
  return `${Math.round(d / 30)} ay öncə`;
}

export default function SessionRequestsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("POOL");
  const [items, setItems] = useState<SessionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  // Backend `Paged.page` 0-dan başlayır; Pagination komponenti 1-dən.
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZE);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchPage = useCallback((pageNum: number) => {
    if (tab === "POOL") return operatorApi.sessionRequestsPoolPaged({ page: pageNum, size });
    if (tab === "MINE") return operatorApi.sessionRequestsMinePaged({ status: "IN_REVIEW", page: pageNum, size });
    return operatorApi.sessionRequestsMinePaged({ status: tab, page: pageNum, size });
  }, [tab, size]);

  // Tab və ya səhifə ölçüsü dəyişəndə serverdən yenidən sorğu — səhifəni sıfırla.
  useEffect(() => { setPage(0); }, [tab, size]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage(page)
      .then(res => {
        if (cancelled) return;
        setItems(res.content);
        setTotalElements(res.totalElements);
        setTotalPages(res.totalPages);
      })
      .catch(e => { if (!cancelled) setError((e as Error).message || "Müraciətlər yüklənmədi"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchPage, page, reloadNonce]);

  const searching = search.trim().length > 0;

  const filtered = useMemo(() => {
    if (!searching) return items;
    const q = search.toLowerCase();
    return items.filter(x =>
      x.name.toLowerCase().includes(q) ||
      x.phone.includes(q) ||
      (x.email ?? "").toLowerCase().includes(q) ||
      x.reason.toLowerCase().includes(q));
  }, [items, search, searching]);

  const take = (id: number) => {
    setBusyId(id);
    operatorApi.claimSessionRequest(id)
      .then(() => {
        setItems(prev => prev.filter(x => x.id !== id));
        setTotalElements(t => Math.max(0, t - 1));
        uiToast("Müraciət götürüldü", "success");
      })
      .catch(e => uiToast((e as Error).message, "error"))
      .finally(() => setBusyId(null));
  };

  const tabItems: TabItem<Tab>[] = (Object.keys(TAB_META) as Tab[]).map(t => ({
    key: t,
    label: TAB_META[t].label,
    count: t === tab && !loading && totalElements > 0 ? totalElements : undefined,
  }));

  const columns: Column<SessionRequest>[] = useMemo(() => [
    {
      key: "request",
      header: "Müraciət",
      cell: req => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={req.name} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="fx-row__title">{req.name}</span>
              {req.priority ? <Status tone="wait">Prioritet</Status> : null}
            </div>
            {tab === "POOL" && req.claimedByName ? (
              <div className="fx-row__meta">{req.claimedByName} baxır</div>
            ) : null}
            {req.assignedPsychologistName ? (
              <div className="fx-row__meta">Psixoloq: {req.assignedPsychologistName}</div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Əlaqə",
      cell: req => (
        <div className="fx-row__meta" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="fx-num" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <IconPhone className="fx-icon fx-icon--sm" />{req.phone}
          </span>
          {req.email ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <IconMail className="fx-icon fx-icon--sm" />{req.email}
            </span>
          ) : null}
          {req.age ? <span>{req.age} yaş</span> : null}
        </div>
      ),
    },
    {
      key: "reason",
      header: "Səbəb",
      hideOnMobile: true,
      cell: req => (
        <div
          title={req.reason}
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}
        >
          {req.reason}
        </div>
      ),
    },
    {
      key: "preferred",
      header: "Üstünlük tarixi",
      hideOnMobile: true,
      cell: req => (
        req.preferredDate ? (
          <span className="fx-row__meta fx-num" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <IconClock className="fx-icon fx-icon--sm" />
            {azFormatDate(req.preferredDate)}{req.preferredTime ? ` / ${req.preferredTime}` : ""}
          </span>
        ) : <span className="fx-row__meta">—</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: req => {
        const meta = STATUS_META[req.status];
        return meta ? <Status tone={meta.tone}>{meta.label}</Status> : <Status tone="muted">{req.status}</Status>;
      },
    },
    {
      key: "meta",
      header: "ID / Vaxt",
      hideOnMobile: true,
      cell: req => (
        <div className="fx-row__meta fx-num" style={{ whiteSpace: "nowrap" }}>
          <div>#{req.id}</div>
          <div>{timeAgo(req.createdAt)}</div>
        </div>
      ),
    },
  ], [tab]);

  return (
    <div>
      <PageHeader
        title="Sayt müraciətləri"
        subtitle="Saytdan gələn anonim seans müraciətləri. Hovuzdan götürün, uyğunlaşsanız randevuya çevirin və ya paket satın — müraciət sizə aid qalır, başqa operator görmür."
      />

      <Card style={{ overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 20px 0" }}>
          <Tabs items={tabItems} value={tab} onChange={setTab} />
        </div>
        <div className="fx-hairline" />

        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ maxWidth: 360 }}>
            <SearchInput
              aria-label="Müraciət axtar"
              placeholder="Ad, telefon, e-poçt və ya səbəb axtarın..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={req => req.id}
          loading={loading}
          error={error}
          onRetry={() => setReloadNonce(n => n + 1)}
          onRowClick={req => router.push(`/operator/session-requests/${req.id}`)}
          empty={{
            title: searching
              ? "Axtarışa uyğun müraciət yoxdur"
              : tab === "POOL" ? "Hovuz boşdur" : "Bu kateqoriyada müraciət yoxdur",
            body: searching
              ? "Başqa ad, telefon və ya açar söz yoxlayın."
              : tab === "POOL"
                ? "Saytdan yeni seans müraciəti gəldikdə burada görünəcək."
                : "Müraciət götürdükcə və ya çevirdikcə bu siyahı dolacaq.",
          }}
          actions={req => (
            tab === "POOL" ? (
              <Button
                variant="ghost"
                size="sm"
                icon={<IconCheck className="fx-icon fx-icon--sm" />}
                disabled={busyId === req.id}
                onClick={() => take(req.id)}
              >
                Götür
              </Button>
            ) : (
              <IconButton
                aria-label="Müraciət detalını aç"
                onClick={() => router.push(`/operator/session-requests/${req.id}`)}
              >
                <IconChevronRight className="fx-icon fx-icon--sm" />
              </IconButton>
            )
          )}
          // Axtarış aktivdirsə siyahı yalnız cari səhifədən süzülür — səhifələmə gizlədilir.
          pagination={searching ? undefined : {
            page: page + 1,
            pageCount: Math.max(1, totalPages),
            onChange: p => setPage(p - 1),
            pageSize: size,
            onPageSizeChange: setSize,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
          }}
          totalLabel={
            searching
              ? `${filtered.length} nəticə göstərilir`
              : `Göstərilir: ${page * size + 1}–${Math.min((page + 1) * size, totalElements)} / ${totalElements}`
          }
        />
      </Card>
    </div>
  );
}
