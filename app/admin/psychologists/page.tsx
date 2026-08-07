"use client";

// Admin · Psixoloqlar modulu — 3 tab: Müraciətlər / Psixoloqlar / Planlar.
//  FAZA 1: Müraciətlər tabı — server pagination + filtr, review Modal, fayl
//  preview/download, təsdiq/rədd. Digər iki tab sonrakı fazalarda qurulur.

import { useCallback, useEffect, useState } from "react";
import {
  adminApi,
  type PsychologistApplication,
  type AdminPsychologistRow,
  type PagedPsychologistsResponse,
  type Psychologist,
  type PackageDto,
  type PackageReq,
  type PsychologistPlan,
  type PsychologistPlanReq,
} from "@/lib/api";
import { toast } from "@/components/Toast";
import { azFormatDate, azFormatDateTime } from "@/lib/datetime";
import PanelIcon from "@/components/PanelIcon";
import PlanTickIcon from "@/components/PlanTickIcon";
import TopicPicker from "@/components/TopicPicker";
import {
  PageHead,
  SectionTitle,
  Tabs,
  Stats,
  Stat,
  Card,
  CardPad,
  DataTable,
  Status,
  Avatar,
  Button,
  ButtonLink,
  IconButton,
  Drawer,
  DrawerSection,
  Modal,
  Banner,
  Field,
  FieldRow,
  Input,
  Textarea,
  Switch,
  Select,
  SearchInput,
  Segmented,
  EmptyBlock,
  type Column,
  type StatusTone,
  type TabItem,
} from "@/components/ui";

// ── Tiplər / sabitlər ────────────────────────────────────────────
type MainTab = "applications" | "psychologists" | "plans";
type AppFilter = "all" | "PENDING" | "APPROVED" | "REJECTED";

const APP_FILTERS: { key: AppFilter; label: string }[] = [
  { key: "PENDING", label: "Gözləmədə" },
  { key: "APPROVED", label: "Təsdiqlənmiş" },
  { key: "REJECTED", label: "Rədd edilmiş" },
  { key: "all", label: "Hamısı" },
];

const APP_STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  PENDING: { label: "Gözləmədə", tone: "wait" },
  APPROVED: { label: "Təsdiqlənib", tone: "positive" },
  REJECTED: { label: "Rədd edilib", tone: "risk" },
};

const APP_PAGE_SIZE = 20;
const APP_PAGE_SIZE_OPTIONS = [10, 20, 50];

// ── Köməkçilər ──────────────────────────────────────────────────
function fmtDate(s?: string | null) { return s ? azFormatDate(s) : "—"; }
function fmtDateTime(s?: string | null) { return s ? azFormatDateTime(s) : "—"; }

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

/** Fayl tipini URL uzantısından təxmin et. */
function fileKind(url: string): "image" | "pdf" | "other" {
  const u = url.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp|svg)$/.test(u)) return "image";
  if (/\.pdf$/.test(u)) return "pdf";
  return "other";
}

// ── Səhifə ──────────────────────────────────────────────────────
export default function PsychologistsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [mainTab, setMainTab] = useState<MainTab>("psychologists");

  // Müraciət siyahısı (server pagination)
  const [apps, setApps] = useState<PsychologistApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [appFilter, setAppFilter] = useState<AppFilter>("PENDING");
  const [appSearch, setAppSearch] = useState("");
  const debouncedAppSearch = useDebounce(appSearch, 300);
  const [appPage, setAppPage] = useState(0);
  const [appSize, setAppSize] = useState(APP_PAGE_SIZE);
  const [appTotalElements, setAppTotalElements] = useState(0);
  const [appTotalPages, setAppTotalPages] = useState(0);

  // KPI sayğacları (filtrdən asılı olmayan)
  const [counts, setCounts] = useState<{ pending: number; approved: number; rejected: number }>({ pending: 0, approved: 0, rejected: 0 });

  const [detailApp, setDetailApp] = useState<PsychologistApplication | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: number; firstName: string } | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<PsychologistApplication | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);

  const loadApplications = useCallback(() => {
    setAppsLoading(true);
    setAppsError(null);
    adminApi.getApplicationsPaged({
      page: appPage, size: appSize,
      status: appFilter === "all" ? undefined : appFilter,
      q: debouncedAppSearch || undefined,
    }).then((res) => {
      setApps(res.content);
      setAppTotalElements(res.totalElements);
      setAppTotalPages(res.totalPages);
      if (res.totalPages > 0 && appPage >= res.totalPages) setAppPage(0);
    }).catch((e) => setAppsError((e as Error).message || "Müraciətlər yüklənmədi"))
      .finally(() => setAppsLoading(false));
  }, [appPage, appSize, appFilter, debouncedAppSearch]);

  const loadCounts = useCallback(() => {
    Promise.all([
      adminApi.getApplicationsPaged({ page: 0, size: 1, status: "PENDING" }),
      adminApi.getApplicationsPaged({ page: 0, size: 1, status: "APPROVED" }),
      adminApi.getApplicationsPaged({ page: 0, size: 1, status: "REJECTED" }),
    ]).then(([p, a, r]) => setCounts({ pending: p.totalElements, approved: a.totalElements, rejected: r.totalElements }))
      .catch(() => { /* KPI kritik deyil */ });
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { if (mainTab === "applications") loadApplications(); }, [mainTab, loadApplications]);
  useEffect(() => { setAppPage(0); }, [appFilter, debouncedAppSearch, appSize]);

  const approve = async (id: number) => {
    setActionLoading(true);
    try {
      await adminApi.approveApplication(id);
      loadApplications(); loadCounts();
      setDetailApp(null); setConfirmApprove(null);
      toast("Müraciət təsdiqləndi", "success");
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setActionLoading(false); }
  };

  const openReject = (id: number, firstName: string) => { setRejectNote(""); setRejectModal({ id, firstName }); };
  const confirmReject = async () => {
    if (!rejectModal) return;
    setActionLoading(true);
    try {
      await adminApi.rejectApplication(rejectModal.id, rejectNote || undefined);
      loadApplications(); loadCounts();
      setRejectModal(null); setDetailApp(null);
      toast("Müraciət rədd edildi", "success");
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setActionLoading(false); }
  };

  const appColumns: Column<PsychologistApplication>[] = [
    {
      key: "applicant", header: "Müraciətçi",
      cell: (a) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={`${a.firstName} ${a.lastName}`} src={a.photoUrl} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div className="fx-row__title">{a.firstName} {a.lastName}</div>
            <div className="fx-subtitle">{a.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "education", header: "Universitet / dərəcə", hideOnMobile: true,
      cell: (a) => (
        <div style={{ minWidth: 0 }}>
          <div>{a.university || "—"}</div>
          <div className="fx-subtitle">{[a.degree, a.graduationYear].filter(Boolean).join(", ") || "—"}</div>
        </div>
      ),
    },
    { key: "experience", header: "Təcrübə", hideOnMobile: true, cell: (a) => `${a.experienceYears ?? "—"} il` },
    { key: "createdAt", header: "Tarix", cell: (a) => fmtDate(a.createdAt) },
    { key: "status", header: "Status", cell: (a) => <AppStatus status={a.status} /> },
  ];

  if (!mounted) return null;

  const mainTabs: TabItem<MainTab>[] = [
    { key: "psychologists", label: "Psixoloqlar" },
    { key: "applications", label: "Müraciətlər", count: counts.pending || undefined },
    { key: "plans", label: "Planlar" },
  ];

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead title="Psixoloqlar" sub="Müraciətlər, psixoloq profilləri və planların idarəsi." />

      <div style={{ marginBottom: 16 }}>
        <Tabs items={mainTabs} value={mainTab} onChange={setMainTab} />
      </div>

      {/* ── Müraciətlər ── */}
      {mainTab === "applications" && (
        <>
          <Stats style={{ marginBottom: 16 }}>
            <Stat value={counts.pending} label="Gözləmədə" />
            <Stat value={counts.approved} label="Təsdiqlənmiş" />
            <Stat value={counts.rejected} label="Rədd edilmiş" />
            <Stat value={counts.pending + counts.approved + counts.rejected} label="Ümumi müraciət" />
          </Stats>

          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
              <div style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
                <SearchInput value={appSearch} onChange={(e) => setAppSearch(e.target.value)} placeholder="Ad və ya email üzrə axtar" aria-label="Axtar" autoComplete="off" />
              </div>
              <Segmented items={APP_FILTERS} value={appFilter} onChange={setAppFilter} />
            </div>
            <CardPad>
              <DataTable
                rows={apps}
                columns={appColumns}
                rowKey={(a) => a.id}
                loading={appsLoading}
                error={appsError}
                onRetry={loadApplications}
                onRowClick={(a) => setDetailApp(a)}
                empty={{
                  title: "Müraciət tapılmadı",
                  body: "Seçilmiş statusa və axtarışa uyğun psixoloq müraciəti yoxdur.",
                  actions: <Button variant="ghost" size="sm" onClick={() => { setAppSearch(""); setAppFilter("all"); }}>Filtrləri təmizlə</Button>,
                }}
                actions={(a) => (
                  <IconButton aria-label="Müraciəti aç" onClick={() => setDetailApp(a)}>
                    <PanelIcon name="eye" size={16} />
                  </IconButton>
                )}
                pagination={{
                  page: appPage + 1,
                  pageCount: Math.max(1, appTotalPages),
                  onChange: (p) => setAppPage(p - 1),
                  pageSize: appSize,
                  onPageSizeChange: (s) => { setAppSize(s); setAppPage(0); },
                  pageSizeOptions: APP_PAGE_SIZE_OPTIONS,
                }}
                totalLabel={appTotalElements > 0
                  ? `Göstərilir: ${appPage * appSize + 1}–${Math.min((appPage + 1) * appSize, appTotalElements)} / ${appTotalElements}`
                  : undefined}
              />
            </CardPad>
          </Card>
        </>
      )}

      {/* ── Psixoloqlar ── */}
      {mainTab === "psychologists" && <PsychologistsTab onPreview={setPreview} />}

      {/* ── Planlar ── */}
      {mainTab === "plans" && <PlansTab />}

      {/* ── Müraciət review modalı ── */}
      <Modal
        open={!!detailApp}
        onClose={() => setDetailApp(null)}
        wide
        title={detailApp ? `Müraciət — ${detailApp.firstName} ${detailApp.lastName}` : ""}
        actions={detailApp && detailApp.status === "PENDING" ? (
          <>
            <Button variant="dangerGhost" disabled={actionLoading} onClick={() => openReject(detailApp.id, detailApp.firstName)}>Rədd et</Button>
            <Button variant="primary" disabled={actionLoading} onClick={() => setConfirmApprove(detailApp)}>Təsdiqlə</Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setDetailApp(null)}>Bağla</Button>
        )}
      >
        {detailApp && <ApplicationReview app={detailApp} onPreview={setPreview} />}
      </Modal>

      {/* ── Fayl preview ── */}
      <FilePreviewModal file={preview} onClose={() => setPreview(null)} />

      {/* ── Təsdiq modalı ── */}
      <Modal
        open={!!confirmApprove}
        onClose={() => setConfirmApprove(null)}
        title="Müraciəti təsdiqlə"
        text={confirmApprove ? `${confirmApprove.firstName} ${confirmApprove.lastName} psixoloq kimi qeydə alınacaq.` : ""}
        icon={<PanelIcon name="check" size={20} />}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmApprove(null)}>Ləğv et</Button>
            <Button variant="primary" disabled={actionLoading} onClick={() => confirmApprove && approve(confirmApprove.id)}>
              {actionLoading ? "Təsdiqlənir…" : "Təsdiqlə"}
            </Button>
          </>
        }
      />

      {/* ── Rədd modalı ── */}
      <Modal
        open={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Müraciəti rədd et"
        text={rejectModal ? `${rejectModal.firstName} adlı müraciətçiyə rədd bildirişi göndəriləcək.` : ""}
        icon={<PanelIcon name="x" size={20} />}
        iconTone="rose"
        actions={
          <>
            <Button variant="ghost" onClick={() => setRejectModal(null)}>Ləğv et</Button>
            <Button variant="danger" disabled={actionLoading} onClick={confirmReject}>
              {actionLoading ? "Göndərilir…" : "Rədd et"}
            </Button>
          </>
        }
      >
        <Field label="Rədd səbəbi" help="İxtiyari — müraciətçiyə göndərilir.">
          <Textarea rows={4} placeholder="Sənədlər natamam, ixtisas uyğun gəlmir…" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Psixoloqlar tabı
// ════════════════════════════════════════════════════════════════
type PsyTypeFilter = "all" | "FANUS" | "NORMAL";
type PsyStatusFilter = "all" | "active" | "inactive" | "suspended";
type PsyDrawerTab = "overview" | "files" | "pricing" | "plan" | "actions";

// Plan ilə idarə olunan modullar (backend ALLOWED_MODULES ilə eyni).
const PLAN_MODULES: { key: string; label: string }[] = [
  { key: "packages", label: "Paketlər & Qiymətlər" },
  { key: "tests", label: "Psixoloji Testlər" },
  { key: "homework", label: "Tapşırıqlar" },
  { key: "articles", label: "Məqalələr" },
  { key: "community", label: "İcma" },
  { key: "resources", label: "Resurslar" },
  { key: "reviews", label: "Rəylər" },
];
const PLAN_MODULE_LABELS: Record<string, string> = Object.fromEntries(PLAN_MODULES.map((m) => [m.key, m.label]));

const PSY_TYPE_FILTERS: { key: PsyTypeFilter; label: string }[] = [
  { key: "all", label: "Hamısı" }, { key: "FANUS", label: "Fanus" }, { key: "NORMAL", label: "Adi" },
];
const PSY_STATUS_FILTERS: { key: PsyStatusFilter; label: string }[] = [
  { key: "all", label: "Hamısı" }, { key: "active", label: "Aktiv" },
  { key: "inactive", label: "Deaktiv" }, { key: "suspended", label: "Dayandırılmış" },
];
const PSY_PAGE_SIZE_OPTIONS = [10, 20, 50];

function PsychologistsTab({ onPreview }: { onPreview: (f: { url: string; label: string }) => void }) {
  const [data, setData] = useState<PagedPsychologistsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 300);
  const [type, setType] = useState<PsyTypeFilter>("all");
  const [status, setStatus] = useState<PsyStatusFilter>("all");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [sort, setSort] = useState("displayOrder");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [sel, setSel] = useState<AdminPsychologistRow | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminApi.getPsychologistsPaged({
      q: dq || undefined, type: type === "all" ? undefined : type,
      status: status === "all" ? undefined : status, page, size, sort, dir,
    }).then((res) => { setData(res); if (res.totalPages > 0 && page >= res.totalPages) setPage(0); })
      .catch((e) => setError((e as Error).message || "Psixoloqlar yüklənmədi"))
      .finally(() => setLoading(false));
  }, [dq, type, status, page, size, sort, dir]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [dq, type, status]);

  const rc = data?.counts ?? {};
  const columns: Column<AdminPsychologistRow>[] = [
    {
      key: "name", header: "Psixoloq", sortable: true,
      cell: (p) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={p.name} src={p.photoUrl} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div className="fx-row__title">{p.name}</div>
            <div className="fx-subtitle">{p.title}</div>
          </div>
        </div>
      ),
    },
    { key: "psychologistType", header: "Tip", cell: (p) => <Status tone={p.psychologistType === "FANUS" ? "positive" : "muted"}>{p.psychologistType === "FANUS" ? "Fanus" : "Adi"}</Status> },
    { key: "specializations", header: "İxtisas", hideOnMobile: true, cell: (p) => p.specializations.slice(0, 2).join(", ") || <span className="fx-muted">—</span> },
    { key: "ratingCount", header: "Reytinq", sortable: true, hideOnMobile: true, cell: (p) => `${p.rating} (${p.ratingCount})` },
    { key: "status", header: "Status", cell: (p) => p.suspended ? <Status tone="risk">Dayandırılıb</Status> : <Status tone={p.active ? "positive" : "muted"}>{p.active ? "Aktiv" : "Deaktiv"}</Status> },
    { key: "verified", header: "Təsdiq", hideOnMobile: true,
      cell: (p) => p.verified ? <Status tone="positive">Təsdiqli</Status> : <Status tone="muted">Yox</Status> },
    { key: "plan", header: "Plan", hideOnMobile: true, cell: (p) => p.planName ? <Status tone="neutral">{p.planName}</Status> : <span className="fx-muted">—</span> },
    { key: "individualPrice", header: "Qiymət", hideOnMobile: true, cell: (p) => p.individualPrice != null ? `${p.individualPrice} ${p.currency ?? "AZN"}` : <span className="fx-muted">—</span> },
  ];

  return (
    <>
      <Stats style={{ marginBottom: 16 }}>
        <Stat value={rc.total ?? "—"} label="Ümumi" />
        <Stat value={rc.active ?? "—"} label="Aktiv" />
        <Stat value={rc.suspended ?? "—"} label="Dayandırılmış" />
        <Stat value={rc.FANUS ?? "—"} label="Fanus" />
        <Stat value={rc.NORMAL ?? "—"} label="Adi" />
      </Stats>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 340 }}>
            <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad və ya email üzrə axtar" aria-label="Axtar" autoComplete="off" />
          </div>
          <Segmented items={PSY_TYPE_FILTERS} value={type} onChange={setType} />
          <Segmented items={PSY_STATUS_FILTERS} value={status} onChange={setStatus} />
        </div>
        <CardPad>
          <DataTable
            rows={data?.content ?? []}
            columns={columns}
            rowKey={(p) => p.id}
            loading={loading}
            error={error}
            onRetry={load}
            onRowClick={(p) => setSel(p)}
            empty={{ title: "Psixoloq tapılmadı", body: "Seçilmiş filtrlərə uyğun psixoloq yoxdur." }}
            sort={{ key: sort, dir }}
            onSortChange={(s) => { setSort(s.key); setDir(s.dir); setPage(0); }}
            actions={(p) => <IconButton aria-label="Kartı aç" onClick={() => setSel(p)}><PanelIcon name="chevron" size={16} /></IconButton>}
            pagination={{
              page: page + 1, pageCount: Math.max(1, data?.totalPages ?? 1),
              onChange: (pp) => setPage(pp - 1), pageSize: size,
              onPageSizeChange: (s) => { setSize(s); setPage(0); }, pageSizeOptions: PSY_PAGE_SIZE_OPTIONS,
            }}
            totalLabel={data && data.totalElements > 0
              ? `Göstərilir: ${data.page * data.size + 1}–${Math.min((data.page + 1) * data.size, data.totalElements)} / ${data.totalElements}`
              : undefined}
          />
        </CardPad>
      </Card>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ""}>
        {sel && <PsychologistDrawer key={sel.id} row={sel} onPreview={onPreview} onChanged={load} />}
      </Drawer>
    </>
  );
}

function PsychologistDrawer({ row, onPreview, onChanged }: {
  row: AdminPsychologistRow;
  onPreview: (f: { url: string; label: string }) => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<PsyDrawerTab>("overview");
  const [profile, setProfile] = useState<Psychologist | null>(null);
  const [app, setApp] = useState<PsychologistApplication | null>(null);
  const [loadingP, setLoadingP] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoadingP(true);
    if (row.userId != null) {
      Promise.allSettled([
        adminApi.getUserPsychologistProfile(row.userId),
        adminApi.getUserApplication(row.userId),
      ]).then(([p, a]) => {
        if (!alive) return;
        if (p.status === "fulfilled") setProfile(p.value);
        if (a.status === "fulfilled") setApp(a.value);
      }).finally(() => { if (alive) setLoadingP(false); });
    } else {
      setLoadingP(false);
    }
    return () => { alive = false; };
  }, [row.userId]);

  return (
    <>
      <DrawerSection>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={row.name} src={row.photoUrl} size="lg" />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Status tone={row.psychologistType === "FANUS" ? "positive" : "muted"}>{row.psychologistType === "FANUS" ? "Fanus" : "Adi"}</Status>
              {row.verified && <Status tone="positive">Təsdiqli</Status>}
              {row.suspended ? <Status tone="risk">Dayandırılıb</Status> : <Status tone={row.active ? "positive" : "muted"}>{row.active ? "Aktiv" : "Deaktiv"}</Status>}
            </div>
            <div className="fx-subtitle" style={{ marginTop: 4 }}>{row.title}</div>
            {row.email && <div className="fx-subtitle">{row.email}</div>}
          </div>
        </div>
      </DrawerSection>

      <div style={{ padding: "0 24px" }}>
        <Tabs
          items={[
            { key: "overview", label: "Baxış" },
            { key: "files", label: "Fayllar" },
            { key: "pricing", label: "Tip & Qiymət" },
            { key: "plan", label: "Plan" },
            { key: "actions", label: "Əməliyyatlar" },
          ]}
          value={tab}
          onChange={(k) => setTab(k as PsyDrawerTab)}
        />
      </div>

      {tab === "overview" && <PsyOverview row={row} profile={profile} loading={loadingP} />}
      {tab === "files" && <PsyFiles app={app} loading={loadingP} hasUser={row.userId != null} onPreview={onPreview} />}
      {tab === "pricing" && <PsyPricing row={row} onChanged={onChanged} />}
      {tab === "plan" && <PsyPlanTab row={row} onChanged={onChanged} />}
      {tab === "actions" && <PsyActions row={row} onChanged={onChanged} />}
    </>
  );
}

function PsyOverview({ row, profile, loading }: { row: AdminPsychologistRow; profile: Psychologist | null; loading: boolean }) {
  return (
    <DrawerSection>
      {loading && <div className="fx-subtitle" style={{ textAlign: "center", padding: 12 }}>Profil yüklənir…</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <InfoRow label="Ad" value={row.name} />
        <InfoRow label="Vəzifə" value={row.title || "—"} />
        <InfoRow label="Email" value={row.email || "—"} />
        <InfoRow label="Telefon" value={row.phone || "—"} />
        <InfoRow label="İxtisaslaşma" value={row.specializations.join(", ") || "—"} />
        <InfoRow label="Reytinq" value={`${row.rating} (${row.ratingCount})`} />
        {profile && (
          <>
            <InfoRow label="Təcrübə" value={profile.experience || "—"} />
            <InfoRow label="Dillər" value={profile.languages || "—"} />
            <InfoRow label="Seans növləri" value={profile.sessionTypes || "—"} />
            <InfoRow label="Sıra" value={String(profile.displayOrder)} />
            <div style={{ gridColumn: "1 / -1" }}>
              <InfoRow label="Təhsil" value={<ProfileEducationList educations={profile.educations} fallback={profile.university ? { institution: profile.university, degree: profile.degree ?? "", graduationYear: profile.graduationYear ?? "" } : null} />} />
            </div>
          </>
        )}
      </div>
      {profile?.bio && (
        <div style={{ marginTop: 14 }}>
          <div className="fx-label">Bio</div>
          <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 }}>{profile.bio}</p>
        </div>
      )}
      {profile && row.userId != null && (
        <PsyTopicsEditor userId={row.userId} profile={profile} />
      )}
    </DrawerSection>
  );
}

/**
 * Mövzu teqləri (V133) — ana səhifədəki əhval tövsiyəsinin yeganə mənbəyi.
 * Teq seçilməyən psixoloq heç bir əhval üçün tövsiyə olunmur; bu qəsdəndir,
 * uyğunsuz mütəxəssis göstərməkdənsə heç nə göstərmirik.
 */
function PsyTopicsEditor({ userId, profile }: { userId: number; profile: Psychologist }) {
  const [topics, setTopics] = useState<string[]>(profile.topics ?? []);
  const [saving, setSaving] = useState(false);
  const dirty = topics.join(",") !== (profile.topics ?? []).join(",");

  const save = async () => {
    setSaving(true);
    try {
      const { id: _id, ...rest } = profile;
      await adminApi.updateUserPsychologistProfile(userId, { ...rest, topics });
      toast("Mövzular yadda saxlanıldı");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Yadda saxlanmadı", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 18 }}>
      <TopicPicker
        value={topics}
        onChange={setTopics}
        label="Əhval tövsiyəsi üçün mövzular"
        hint="Ana səhifədəki «Bu gün özünüzü necə hiss edirsiniz?» bölməsi bu teqlərə baxır. Teq seçilməsə, bu psixoloq heç bir əhval üçün tövsiyə olunmayacaq."
      />
      {dirty && (
        <div style={{ marginTop: 10 }}>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saxlanılır…" : "Mövzuları saxla"}
          </Button>
        </div>
      )}
    </div>
  );
}

function PsyFiles({ app, loading, hasUser, onPreview }: {
  app: PsychologistApplication | null; loading: boolean; hasUser: boolean;
  onPreview: (f: { url: string; label: string }) => void;
}) {
  if (loading) return <DrawerSection><div className="fx-subtitle" style={{ textAlign: "center", padding: 12 }}>Yüklənir…</div></DrawerSection>;
  if (!hasUser) return <DrawerSection><EmptyBlock title="Fayl yoxdur" body="Bu psixoloq istifadəçi hesabına bağlı deyil — sənəd tapılmadı." /></DrawerSection>;
  if (!app) return <DrawerSection><EmptyBlock title="Müraciət tapılmadı" body="Bu psixoloq üçün qeydiyyat müraciəti (fayllar) tapılmadı." /></DrawerSection>;
  const certs = app.certificateFileUrls?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  if (!app.diplomaFileUrl && certs.length === 0) return <DrawerSection><div className="fx-subtitle">Sənəd yüklənməyib.</div></DrawerSection>;
  return (
    <DrawerSection>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {app.diplomaFileUrl && <FileCard url={app.diplomaFileUrl} label="Diplom faylı" onPreview={onPreview} />}
        {certs.map((url, i) => <FileCard key={i} url={url} label={`Sertifikat skanı ${i + 1}`} onPreview={onPreview} />)}
      </div>
    </DrawerSection>
  );
}

function PsyPricing({ row, onChanged }: { row: AdminPsychologistRow; onChanged: () => void }) {
  const [type, setType] = useState<"FANUS" | "NORMAL">(row.psychologistType ?? "NORMAL");
  const [price, setPrice] = useState(row.individualPrice != null ? String(row.individualPrice) : "");
  const [packages, setPackages] = useState<PackageDto[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingPkg, setEditingPkg] = useState<PackageDto | "new" | null>(null);
  const [delPkg, setDelPkg] = useState<PackageDto | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const reloadPackages = useCallback(() => {
    adminApi.getPsyPackages(row.id).then(setPackages).catch(() => setPackages([]));
  }, [row.id]);
  useEffect(() => { reloadPackages(); }, [reloadPackages]);

  const saveType = async (t: "FANUS" | "NORMAL") => {
    setBusy("type");
    try { await adminApi.setPsyType(row.id, t); setType(t); toast("Tip yeniləndi", "success"); onChanged(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(null); }
  };
  const savePrice = async () => {
    const n = Number(price);
    if (!Number.isFinite(n) || n < 0) { toast("Düzgün qiymət daxil edin", "error"); return; }
    setBusy("price");
    try { await adminApi.setPsyPricing(row.id, n); toast("Qiymət yeniləndi", "success"); onChanged(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(null); }
  };
  const doDeletePkg = async () => {
    if (!delPkg) return;
    setDelBusy(true);
    try { await adminApi.deletePsyPackage(row.id, delPkg.id); toast("Paket silindi", "success"); setDelPkg(null); reloadPackages(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setDelBusy(false); }
  };

  return (
    <DrawerSection>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Psixoloq tipi" help="Fanus → qiyməti yalnız admin təyin edir, paketlər paneli bağlanır.">
          <Segmented items={[{ key: "NORMAL", label: "Adi" }, { key: "FANUS", label: "Fanus" }] as const} value={type} onChange={(t) => saveType(t)} />
        </Field>
        <Field label={`Fərdi seans qiyməti (${row.currency ?? "AZN"})`}>
          <div style={{ display: "flex", gap: 8 }}>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            <Button variant="primary" disabled={busy === "price"} onClick={savePrice}>{busy === "price" ? "…" : "Saxla"}</Button>
          </div>
        </Field>
        {type === "FANUS" && (
          <Banner tone="info" title="Fanus psixoloqu">
            Paketlər & Qiymətlər modulu bu psixoloqun panelində bağlıdır — qiymət/faiz admin tərəfindən idarə olunur.
          </Banner>
        )}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <span className="fx-label" style={{ marginBottom: 0 }}>Paketlər</span>
            <Button variant="ghost" size="sm" icon={<PanelIcon name="plus" size={14} />} onClick={() => setEditingPkg("new")}>Yeni paket</Button>
          </div>
          {packages === null ? (
            <div className="fx-subtitle">Yüklənir…</div>
          ) : packages.length === 0 ? (
            <div className="fx-subtitle">Hələ paket yoxdur — «Yeni paket» ilə əlavə edin.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {packages.map((pk) => (
                <div key={pk.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--hairline)" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{pk.name}{!pk.active && <span className="fx-muted"> (deaktiv)</span>}</div>
                    <div className="fx-subtitle">{pk.sessionCount} seans</div>
                  </div>
                  <span className="fx-row__amount">{pk.packagePrice} {pk.currency ?? "AZN"}</span>
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    <IconButton aria-label="Paketi redaktə et" onClick={() => setEditingPkg(pk)}><PanelIcon name="edit" size={15} /></IconButton>
                    <IconButton aria-label="Paketi sil" onClick={() => setDelPkg(pk)}><PanelIcon name="x" size={15} /></IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingPkg && (
        <PackageEditor
          psyId={row.id}
          pkg={editingPkg === "new" ? null : editingPkg}
          onClose={() => setEditingPkg(null)}
          onSaved={() => { setEditingPkg(null); reloadPackages(); }}
        />
      )}

      <Modal
        open={!!delPkg}
        onClose={() => setDelPkg(null)}
        title="Paketi sil"
        text={delPkg ? `«${delPkg.name}» paketi silinəcək.` : ""}
        icon={<PanelIcon name="x" size={20} />}
        iconTone="rose"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDelPkg(null)}>Ləğv</Button>
            <Button variant="danger" disabled={delBusy} onClick={doDeletePkg}>{delBusy ? "Silinir…" : "Sil"}</Button>
          </>
        }
      />
    </DrawerSection>
  );
}

function PackageEditor({ psyId, pkg, onClose, onSaved }: { psyId: number; pkg: PackageDto | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(pkg?.name ?? "");
  const [sessionCount, setSessionCount] = useState(pkg ? String(pkg.sessionCount) : "");
  const [packagePrice, setPackagePrice] = useState(pkg ? String(pkg.packagePrice) : "");
  const [active, setActive] = useState(pkg?.active ?? true);
  const [busy, setBusy] = useState(false);

  const sc = Number(sessionCount);
  const pp = Number(packagePrice);
  const perSession = sc > 0 && Number.isFinite(pp) ? pp / sc : null;

  const save = async () => {
    if (!name.trim()) { toast("Ad məcburidir", "error"); return; }
    if (!Number.isInteger(sc) || sc <= 0) { toast("Seans sayı düzgün deyil", "error"); return; }
    if (!Number.isFinite(pp) || pp < 0) { toast("Qiymət düzgün deyil", "error"); return; }
    setBusy(true);
    try {
      const data: PackageReq = { name: name.trim(), sessionCount: sc, packagePrice: pp, active };
      if (pkg) await adminApi.updatePsyPackage(psyId, pkg.id, data);
      else await adminApi.createPsyPackage(psyId, data);
      toast("Paket saxlanıldı", "success");
      onSaved();
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={pkg ? "Paketi redaktə et" : "Yeni paket"}
      icon={<PanelIcon name="package" size={20} />}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Ləğv</Button>
          <Button variant="primary" disabled={busy} onClick={save}>{busy ? "Saxlanır…" : "Saxla"}</Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Paket adı" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Məs: 5 seanslıq paket" autoFocus /></Field>
        <FieldRow>
          <Field label="Seans sayı" required><Input type="number" value={sessionCount} onChange={(e) => setSessionCount(e.target.value)} placeholder="5" /></Field>
          <Field label="Paket qiyməti (AZN)" required><Input type="number" value={packagePrice} onChange={(e) => setPackagePrice(e.target.value)} placeholder="0" /></Field>
        </FieldRow>
        {perSession != null && <div className="fx-subtitle">Seans başına təxminən {perSession.toFixed(2)} AZN</div>}
        <Switch label="Paket aktivdir" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </div>
    </Modal>
  );
}

function PsyActions({ row, onChanged }: { row: AdminPsychologistRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [suspendModal, setSuspendModal] = useState(false);
  const [reason, setReason] = useState("");

  const doSuspend = async () => {
    if (!reason.trim()) { toast("Səbəb məcburidir", "error"); return; }
    setBusy(true);
    try { await adminApi.suspendPsychologist(row.id, reason.trim()); toast("Psixoloq dayandırıldı", "success"); setSuspendModal(false); onChanged(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };
  const doUnsuspend = async () => {
    setBusy(true);
    try { await adminApi.unsuspendPsychologist(row.id); toast("Dayandırma götürüldü", "success"); onChanged(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };

  const toggleVerified = async () => {
    setBusy(true);
    try {
      await adminApi.setPsychologistVerified(row.id, !row.verified);
      toast(row.verified ? "Təsdiq nişanı götürüldü" : "Psixoloq təsdiqləndi", "success");
      onChanged();
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };

  return (
    <DrawerSection>
      {/* Təsdiq nişanı — publik kartda və profil səhifəsində göstərilir.
          Dayandırmadan ayrıdır: dayandırılmış psixoloq təyinat almır, təsdiqsiz
          psixoloq isə işləyir, sadəcə nişanı yoxdur. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>Fanus təsdiqli nişanı</div>
          <div className="fx-subtitle">
            {row.verified
              ? "Nişan saytda göstərilir — kartda və profil səhifəsində."
              : "Nişan göstərilmir. Psixoloq işləyir, yalnız təsdiq nişanı yoxdur."}
          </div>
        </div>
        <Button variant={row.verified ? "dangerGhost" : "primary"} size="sm" disabled={busy} onClick={toggleVerified}>
          {row.verified ? "Nişanı götür" : "Təsdiqlə"}
        </Button>
      </div>

      {row.suspended ? (
        <>
          <Banner tone="warn" title="Dayandırılıb">{row.suspendReason || "Səbəb qeyd edilməyib."}</Banner>
          <div style={{ marginTop: 12 }}>
            <Button variant="primary" disabled={busy} onClick={doUnsuspend}>Dayandırmanı götür</Button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>Psixoloqu dayandır</div>
            <div className="fx-subtitle">Yeni təyinatlar dayandırılır; psixoloqa bildiriş gedir.</div>
          </div>
          <Button variant="dangerGhost" size="sm" onClick={() => { setReason(""); setSuspendModal(true); }}>Dayandır</Button>
        </div>
      )}

      <Modal
        open={suspendModal}
        onClose={() => setSuspendModal(false)}
        title="Psixoloqu dayandır"
        text={`${row.name} müvəqqəti dayandırılacaq.`}
        icon={<PanelIcon name="x" size={20} />}
        iconTone="amber"
        actions={
          <>
            <Button variant="ghost" onClick={() => setSuspendModal(false)}>Ləğv et</Button>
            <Button variant="danger" disabled={busy} onClick={doSuspend}>{busy ? "…" : "Dayandır"}</Button>
          </>
        }
      >
        <Field label="Səbəb" help="Məcburidir — psixoloqa göndərilir.">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sənəd yeniləmə tələbi, şikayət araşdırması…" />
        </Field>
      </Modal>
    </DrawerSection>
  );
}

// Drawer · psixoloqa plan təyini.
function PsyPlanTab({ row, onChanged }: { row: AdminPsychologistRow; onChanged: () => void }) {
  const [plans, setPlans] = useState<PsychologistPlan[] | null>(null);
  const [planId, setPlanId] = useState<number | null>(row.planId ?? null);
  // Tarix boş sətir kimi saxlanılır ki, <input type="date"> idarə olunan qalsın.
  const [expiresAt, setExpiresAt] = useState<string>(row.planExpiresAt ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => { adminApi.getPsychologistPlans().then(setPlans).catch(() => setPlans([])); }, []);

  const current = plans?.find((p) => p.id === planId) ?? null;
  const dirty = planId !== (row.planId ?? null) || expiresAt !== (row.planExpiresAt ?? "");

  const save = async () => {
    setBusy(true);
    try { await adminApi.assignPsychologistPlan(row.id, planId, expiresAt || null); toast("Plan təyin olundu", "success"); onChanged(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };

  return (
    <DrawerSection>
      <Field label="Təyin olunan plan" help="Plan psixoloqun panelində hansı modulların açıq olacağını təyin edir.">
        <Select value={planId ?? ""} onChange={(e) => setPlanId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Plan yoxdur (default)</option>
          {plans?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : " (deaktiv)"}</option>)}
        </Select>
      </Field>

      {planId !== null && (
        <div style={{ marginTop: 12 }}>
          <Field label="Etibarlıdır (bitmə tarixi)" help="Boş buraxılsa plan müddətsizdir. Tarix psixoloqun öz profilində görünür; modulları avtomatik bağlamır.">
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>
        </div>
      )}

      {current && (
        <div style={{ marginTop: 12 }}>
          <div className="fx-label">Bu planla açıq modullar</div>
          {current.enabledModules.length === 0 ? (
            <div className="fx-subtitle">Modul yoxdur.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {current.enabledModules.map((m) => <Status key={m} tone="neutral">{PLAN_MODULE_LABELS[m] ?? m}</Status>)}
            </div>
          )}
          {row.psychologistType === "FANUS" && current.enabledModules.includes("packages") && (
            <div style={{ marginTop: 10 }}>
              <Banner tone="info" title="Fanus qeydi">Bu psixoloq Fanus olduğu üçün «Paketlər» modulu plana baxmayaraq panelində bağlı qalır.</Banner>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Button variant="primary" disabled={busy || !dirty} onClick={save}>{busy ? "Təyin olunur…" : "Planı təyin et"}</Button>
      </div>
    </DrawerSection>
  );
}

// ════════════════════════════════════════════════════════════════
//  Planlar tabı
// ════════════════════════════════════════════════════════════════
function PlansTab() {
  const [plans, setPlans] = useState<PsychologistPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PsychologistPlan | "new" | null>(null);

  const load = useCallback(() => {
    setError(null);
    adminApi.getPsychologistPlans().then(setPlans).catch((e) => { setPlans([]); setError((e as Error).message || "Planlar yüklənmədi"); });
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="fx-subtitle">Modul aç/bağla şablonları — psixoloqa təyin edilir.</div>
        <Button variant="primary" icon={<PanelIcon name="plus" size={16} />} onClick={() => setEditing("new")}>Yeni plan</Button>
      </div>

      {error && <div style={{ marginBottom: 12 }}><Banner tone="error" title="Yüklənmədi">{error}</Banner></div>}

      {plans === null ? (
        <Card><CardPad><div className="fx-subtitle" style={{ textAlign: "center", padding: 20 }}>Yüklənir…</div></CardPad></Card>
      ) : plans.length === 0 ? (
        <Card><CardPad><EmptyBlock title="Plan yoxdur" body="İlk psixoloq planını yaradın — hansı modulların açıq olacağını seçin." actions={<Button variant="primary" size="sm" onClick={() => setEditing("new")}>Yeni plan</Button>} /></CardPad></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {plans.map((pl) => (
            <Card key={pl.id}>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <PlanTickIcon color={pl.tikColor} size={22} />
                  <div style={{ fontWeight: 700, flex: 1, minWidth: 0 }}>{pl.name}</div>
                  {!pl.active && <Status tone="muted">Deaktiv</Status>}
                </div>
                <div className="fx-subtitle" style={{ marginBottom: 10 }}>{pl.assignedCount} psixoloq təyin olunub</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                  {PLAN_MODULES.map((m) => {
                    const on = pl.enabledModules.includes(m.key);
                    return (
                      <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: on ? "var(--oxford)" : "var(--oxford-40)" }}>
                        {on ? <PanelIcon name="check" size={15} color={pl.tikColor} /> : <span aria-hidden style={{ width: 15, textAlign: "center" }}>—</span>}
                        {m.label}
                      </div>
                    );
                  })}
                </div>
                <Button variant="ghost" size="sm" block onClick={() => setEditing(pl)}>Redaktə et</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <PlanEditor plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}

function PlanEditor({ plan, onClose, onSaved }: { plan: PsychologistPlan | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(plan?.name ?? "");
  const [modules, setModules] = useState<string[]>(plan?.enabledModules ?? []);
  const [tikColor, setTikColor] = useState(plan?.tikColor ?? "#3A74D6");
  const [active, setActive] = useState(plan?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const toggle = (k: string) => setModules((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);

  const save = async () => {
    if (!name.trim()) { toast("Ad məcburidir", "error"); return; }
    setBusy(true);
    try {
      const data: PsychologistPlanReq = { name: name.trim(), enabledModules: modules, tikColor, active };
      if (plan) await adminApi.updatePsychologistPlan(plan.id, data);
      else await adminApi.createPsychologistPlan(data);
      toast("Plan saxlanıldı", "success");
      onSaved();
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };

  const del = async () => {
    if (!plan) return;
    setDeleting(true);
    try { await adminApi.deletePsychologistPlan(plan.id); toast("Plan silindi", "success"); onSaved(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setDeleting(false); }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={plan ? "Planı redaktə et" : "Yeni plan"}
        actions={
          <>
            {plan && <Button variant="dangerGhost" onClick={() => setConfirmDel(true)} style={{ marginRight: "auto" }}>Sil</Button>}
            <Button variant="ghost" onClick={onClose}>Ləğv</Button>
            <Button variant="primary" disabled={busy} onClick={save}>{busy ? "Saxlanır…" : "Saxla"}</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Plan adı"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Məs: Tam giriş" autoFocus /></Field>
          <Field label="Plan nişanı və rəngi" help="Nişan planın rəngində çəkilir — rəngi dəyişdikcə aşağıdakı önizləmə də dəyişir.">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* Canlı önizləmə: ikon vektordur, ona görə rəng dərhal tətbiq olunur. */}
              <PlanTickIcon color={tikColor} size={44} title="Plan nişanı" />
              <input type="color" value={tikColor} onChange={(e) => setTikColor(e.target.value)} style={{ width: 44, height: 32, border: "1px solid var(--hairline)", borderRadius: 6, background: "none", cursor: "pointer" }} aria-label="Nişan rəngi" />
              <span className="fx-subtitle">{tikColor}</span>
            </div>
          </Field>
          <div>
            <div className="fx-label">Açıq modullar</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PLAN_MODULES.map((m) => {
                const on = modules.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggle(m.key)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: on ? "var(--surface-muted)" : "transparent", border: "1px solid var(--hairline)", borderRadius: 8, cursor: "pointer", textAlign: "left", font: "inherit" }}
                  >
                    <span style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${on ? tikColor : "var(--hairline)"}`, background: on ? tikColor : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {on && <PanelIcon name="check" size={13} color="#fff" />}
                    </span>
                    <span style={{ fontWeight: on ? 600 : 500 }}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Switch label="Plan aktivdir" checked={active} onChange={(e) => setActive(e.target.checked)} />
        </div>
      </Modal>

      <Modal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="Planı sil"
        text="Bu plana təyin olunmuş psixoloqların planı boşalacaq (default davranışa qayıdır)."
        icon={<PanelIcon name="x" size={20} />}
        iconTone="rose"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmDel(false)}>Ləğv</Button>
            <Button variant="danger" disabled={deleting} onClick={del}>{deleting ? "Silinir…" : "Sil"}</Button>
          </>
        }
      />
    </>
  );
}

// ════════════════════════════════════════════════════════════════
//  Müraciət review
// ════════════════════════════════════════════════════════════════
function ApplicationReview({ app, onPreview }: { app: PsychologistApplication; onPreview: (f: { url: string; label: string }) => void }) {
  const certs = app.certificateFileUrls?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar name={`${app.firstName} ${app.lastName}`} src={app.photoUrl} size="lg" />
        <div style={{ minWidth: 0 }}>
          <AppStatus status={app.status} />
          {app.title && <div className="fx-subtitle" style={{ marginTop: 4 }}>{app.title}</div>}
        </div>
      </div>

      <ReviewSection title="Şəxsi məlumatlar">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfoRow label="Tam ad" value={`${app.firstName} ${app.lastName}`} />
          <InfoRow label="Email" value={app.email} />
          <InfoRow label="Telefon" value={app.phone ?? "—"} />
          <InfoRow label="Doğum tarixi" value={app.birthDate ? fmtDate(app.birthDate) : "—"} />
          <InfoRow label="Cinsiyyət" value={app.gender === "FEMALE" ? "Qadın" : app.gender === "MALE" ? "Kişi" : app.gender === "OTHER" ? "Digər" : "—"} />
          <InfoRow label="FIN / ID" value={app.finId ?? "—"} />
          <InfoRow label="Müraciət tarixi" value={fmtDate(app.createdAt)} />
        </div>
      </ReviewSection>

      <ReviewSection title="Təhsil">
        <EducationList json={app.educationsJson} fallback={app.university ? { institution: app.university, degree: app.degree ?? "", graduationYear: app.graduationYear ?? "" } : null} />
      </ReviewSection>

      <ReviewSection title="Peşəkar məlumatlar">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfoRow label="İxtisas / vəzifə" value={app.title ?? "—"} />
          <InfoRow label="Təcrübə" value={app.experienceYears ?? "—"} />
          <InfoRow label="Dillər" value={app.languages?.split(",").map((s) => s.trim()).filter(Boolean).join(", ") || "—"} />
          <InfoRow label="İxtisaslaşma" value={app.specializations?.split(",").map((s) => s.trim()).filter(Boolean).join(", ") || "—"} />
          <InfoRow label="Seans növləri" value={app.sessionTypes?.split(",").map((s) => s.trim()).filter(Boolean).join(", ") || "—"} />
        </div>
      </ReviewSection>

      {app.bio && <ReviewSection title="Bio"><p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 }}>{app.bio}</p></ReviewSection>}
      {app.motivation && <ReviewSection title="Motivasiya / yanaşma"><p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 }}>{app.motivation}</p></ReviewSection>}

      <ReviewSection title="Sertifikat və seminarlar">
        <CertificateList json={app.certificatesJson} legacyCerts={app.certifications} />
      </ReviewSection>

      <ReviewSection title="Sənədlər və fayllar">
        {app.diplomaFileUrl || certs.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {app.diplomaFileUrl && <FileCard url={app.diplomaFileUrl} label="Diplom faylı" onPreview={onPreview} />}
            {certs.map((url, i) => <FileCard key={i} url={url} label={`Sertifikat skanı ${i + 1}`} onPreview={onPreview} />)}
          </div>
        ) : <div className="fx-subtitle">Sənəd yüklənməyib.</div>}
      </ReviewSection>

      <ReviewSection title="Razılıqlar">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <ConsentLine ok={app.consentEthics} label="Etik kodeks" />
          <ConsentLine ok={app.consentGdpr} label="GDPR / şəxsi məlumat" />
          <ConsentLine ok={app.consentTerms} label="İstifadə şərtləri" />
        </div>
      </ReviewSection>

      {app.adminNote && <ReviewSection title="Admin qeydi"><p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 }}>{app.adminNote}</p></ReviewSection>}
    </div>
  );
}

// Fayl kartı — önizləmə + yüklə.
function FileCard({ url, label, onPreview }: { url: string; label: string; onPreview: (f: { url: string; label: string }) => void }) {
  const kind = fileKind(url);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, border: "1px solid var(--hairline)", borderRadius: 10 }}>
      <div style={{ color: "var(--oxford-60)", flexShrink: 0 }}><PanelIcon name={kind === "image" ? "eye" : "file"} size={18} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{label}</div>
        <div className="fx-subtitle">{kind === "image" ? "Şəkil" : kind === "pdf" ? "PDF sənəd" : "Fayl"}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <Button variant="ghost" size="sm" onClick={() => onPreview({ url, label })} icon={<PanelIcon name="eye" size={14} />}>Bax</Button>
        <ButtonLink href={url} target="_blank" rel="noreferrer" variant="ghost" size="sm" icon={<PanelIcon name="download" size={14} />}>Yüklə</ButtonLink>
      </div>
    </div>
  );
}

function FilePreviewModal({ file, onClose }: { file: { url: string; label: string } | null; onClose: () => void }) {
  if (!file) return null;
  const kind = fileKind(file.url);
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={file.label}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Bağla</Button>
          <ButtonLink href={file.url} target="_blank" rel="noreferrer" variant="primary" icon={<PanelIcon name="download" size={16} />}>Yüklə</ButtonLink>
        </>
      }
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        {kind === "image" && <img src={file.url} alt={file.label} style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 8 }} />}
        {kind === "pdf" && <iframe src={file.url} title={file.label} style={{ width: "100%", height: "60vh", border: "1px solid var(--hairline)", borderRadius: 8 }} />}
        {kind === "other" && <div className="fx-subtitle" style={{ padding: 24 }}>Bu fayl tipi önizlənə bilmir — «Yüklə» ilə açın.</div>}
      </div>
    </Modal>
  );
}

// ── Alt komponentlər ────────────────────────────────────────────
function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function AppStatus({ status }: { status: string }) {
  const meta = APP_STATUS_META[status];
  if (!meta) return <Status tone="muted">{status}</Status>;
  return <Status tone={meta.tone}>{meta.label}</Status>;
}

function ConsentLine({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {ok ? <PanelIcon name="check" size={16} /> : <span aria-hidden style={{ width: 16, textAlign: "center" }}>—</span>}
      <span className={ok ? undefined : "fx-muted"}>{label}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="fx-label">{label}</div>
      <div style={{ overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

/** Təsdiqlənmiş psixoloqun tam təhsil siyahısı (V145) — diplom faylı varsa baxış linki daxil.
 *  `EducationList` (aşağıda) hələ TƏSDİQ GÖZLƏYƏN müraciətin JSON snapshot-unu göstərir. */
function ProfileEducationList({ educations, fallback }: {
  educations?: { id?: number; institution: string; degree?: string; graduationYear?: string; diplomaUrl?: string }[];
  fallback?: { institution: string; degree: string; graduationYear: string } | null;
}) {
  const rows = educations && educations.length > 0 ? educations : (fallback?.institution ? [{ id: 0, ...fallback }] : []);
  if (rows.length === 0) return <span className="fx-subtitle">Təhsil qeyd edilməyib.</span>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r, i) => (
        <div key={r.id || i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{r.institution}</div>
            <div className="fx-subtitle">{[r.degree, r.graduationYear].filter(Boolean).join(", ") || "—"}</div>
          </div>
          {"diplomaUrl" in r && r.diplomaUrl && (
            <a href={r.diplomaUrl} target="_blank" rel="noopener noreferrer" className="fx-subtitle" style={{ flexShrink: 0, color: "var(--accent, #1051B7)" }}>
              Diplomu gör
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function EducationList({ json, fallback }: {
  json?: string;
  fallback?: { institution: string; degree: string; graduationYear: string } | null;
}) {
  let rows: { institution: string; degree?: string; graduationYear?: string; diplomaUrl?: string }[] = [];
  if (json) { try { rows = JSON.parse(json); } catch { /* ignore */ } }
  if (rows.length === 0 && fallback?.institution) rows = [fallback];
  if (rows.length === 0) return <div className="fx-subtitle">Təhsil qeyd edilməyib.</div>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{r.institution}</div>
            <div className="fx-subtitle">{[r.degree, r.graduationYear].filter(Boolean).join(", ") || "—"}</div>
          </div>
          {r.diplomaUrl && (
            <a href={r.diplomaUrl} target="_blank" rel="noopener noreferrer" className="fx-subtitle" style={{ flexShrink: 0, color: "var(--accent, #1051B7)" }}>
              Diplomu gör
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function CertificateList({ json, legacyCerts }: { json?: string; legacyCerts?: string }) {
  let rows: { title: string; issuer?: string; year?: string; type?: string }[] = [];
  if (json) { try { rows = JSON.parse(json); } catch { /* ignore */ } }
  if (rows.length === 0 && legacyCerts) {
    rows = legacyCerts.split(",").map((s) => s.trim()).filter(Boolean).map((title) => ({ title, type: "CERTIFICATE" }));
  }
  if (rows.length === 0) return <div className="fx-subtitle">Sertifikat / seminar yoxdur.</div>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{r.title}</span>
            <span className="fx-subtitle" style={{ flexShrink: 0 }}>{r.type === "SEMINAR" ? "Seminar" : "Sertifikat"}</span>
          </div>
          {(r.issuer || r.year) && <div className="fx-subtitle">{[r.issuer, r.year].filter(Boolean).join(", ")}</div>}
        </div>
      ))}
    </div>
  );
}
