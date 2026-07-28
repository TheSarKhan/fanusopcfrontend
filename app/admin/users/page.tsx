"use client";

// Admin · İstifadəçilər modulu — Fanus UI Kit ilə sıfırdan.
//  • Platformadakı bütün hesablar cədvəldə: server axtarış + filtr + sort + səhifələmə.
//  • Filtr: rol, status (aktiv/deaktiv), email təsdiq, qeydiyyat tarixi aralığı.
//  • Sətrə klik → tab-lı ətraflı Drawer: Baxış / Redaktə / Log tarixçəsi / Əməliyyatlar.
//  • Əməliyyatlar: şifrə reset linki, doğrulama emaili, email dəyiş, sessiyaları bağla,
//    aktiv/deaktiv, sil. Rol yalnız Approvals modulunda dəyişir — burada read-only.
//  • Status mətndir (rəngli rozet yox); xətalar toast; təsdiqlər Modal.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminApi,
  type UserRecord,
  type PagedUsersResponse,
  type AuditLogEntry,
  type PatientCard,
  type AppointmentDetail,
  type BookingSeries,
} from "@/lib/api";
import { toast } from "@/components/Toast";
import { azFormatDate, azFormatDateTime } from "@/lib/datetime";
import * as XLSX from "xlsx";
import PanelIcon from "@/components/PanelIcon";
import DatePicker from "@/components/DatePicker";
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
  Switch,
  Button,
  ButtonLink,
  IconButton,
  Drawer,
  DrawerSection,
  Modal,
  Banner,
  EmptyBlock,
  Field,
  FieldRow,
  Input,
  SearchInput,
  Segmented,
  type Column,
} from "@/components/ui";

// ── Tiplər / sabitlər ────────────────────────────────────────────
type RoleFilter = "all" | "PATIENT" | "PSYCHOLOGIST" | "OPERATOR" | "ADMIN";
type StatusFilter = "all" | "active" | "inactive" | "deleted";
type VerifiedFilter = "all" | "yes" | "no";
type EditTab = "overview" | "edit" | "log" | "actions";
type LogScope = "on" | "by";

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: "all", label: "Hamısı" },
  { key: "PATIENT", label: "Pasiyent" },
  { key: "PSYCHOLOGIST", label: "Psixoloq" },
  { key: "OPERATOR", label: "Operator" },
  { key: "ADMIN", label: "Admin" },
];
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Hamısı" },
  { key: "active", label: "Aktiv" },
  { key: "inactive", label: "Deaktiv" },
  { key: "deleted", label: "Silinib" },
];
const VERIFIED_FILTERS: { key: VerifiedFilter; label: string }[] = [
  { key: "all", label: "Hamısı" },
  { key: "yes", label: "Təsdiqli" },
  { key: "no", label: "Təsdiqsiz" },
];

const ROLE_LABELS: Record<string, string> = {
  PATIENT: "Pasiyent", PSYCHOLOGIST: "Psixoloq", OPERATOR: "Operator", ADMIN: "Admin",
};
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const LOG_PAGE_SIZE = 25;

// ── Köməkçilər ──────────────────────────────────────────────────
function fmtDate(s?: string | null) { return s ? azFormatDate(s) : "—"; }
function fmtDateTime(s?: string | null) { return s ? azFormatDateTime(s) : "—"; }
function fullName(u: UserRecord) { return [u.firstName, u.lastName].filter(Boolean).join(" ") || "—"; }
function roleLabel(r: string) { return ROLE_LABELS[r] ?? r; }
function displayName(u: UserRecord) { return fullName(u) !== "—" ? fullName(u) : u.email; }

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

// ── Səhifə ──────────────────────────────────────────────────────
export default function UsersPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [data, setData] = useState<PagedUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtrlər
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const debouncedSearch = useDebounce(search, 300);
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [verified, setVerified] = useState<VerifiedFilter>("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
  }, [searchParams]);

  // Səhifələmə + sort
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [exporting, setExporting] = useState(false);

  // Toplu seçim — server pagination səbəbi ilə YALNIZ cari səhifəyə aiddir.
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const hasFilters = role !== "all" || status !== "all" || verified !== "all" || !!createdFrom || !!createdTo || !!search;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    adminApi.getUsers({
      q: debouncedSearch || undefined,
      role: role === "all" ? undefined : role,
      status: status === "all" ? undefined : status,
      verified: verified === "all" ? undefined : verified === "yes",
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
      page, size, sort, dir,
    }).then((res) => {
      setData(res);
      if (res.totalPages > 0 && page >= res.totalPages) setPage(0);
    }).catch((e) => setError((e as Error).message || "İstifadəçilər yüklənmədi"))
      .finally(() => setLoading(false));
  }, [debouncedSearch, role, status, verified, createdFrom, createdTo, page, size, sort, dir]);

  useEffect(() => { load(); }, [load]);
  // Filtr dəyişəndə boş səhifədə qalmamaq üçün başa qayıt.
  useEffect(() => { setPage(0); }, [debouncedSearch, role, status, verified, createdFrom, createdTo]);
  // Seçim cari səhifəyə aiddir — naviqasiya/filtr dəyişəndə təmizlə.
  useEffect(() => { setSelected(new Set()); }, [page, size, sort, dir, debouncedSearch, role, status, verified, createdFrom, createdTo]);

  const clearFilters = () => {
    setSearch(""); setRole("all"); setStatus("all"); setVerified("all");
    setCreatedFrom(""); setCreatedTo("");
  };

  const downloadExcel = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportUsers({ role: role === "all" ? undefined : role, q: debouncedSearch || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "istifadeciler.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast("İxrac zamanı xəta: " + (e as Error).message, "error");
    } finally {
      setExporting(false);
    }
  };

  // ── Toplu əməliyyatlar (yalnız cari səhifədəki seçilmiş sətirlər) ──
  const selectedUsers = (data?.content ?? []).filter((u) => selected.has(u.id));

  const bulkSetActive = async (active: boolean) => {
    if (selectedUsers.length === 0) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(selectedUsers.map((u) => adminApi.updateUser(u.id, { active })));
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      toast(`${ok} hesab ${active ? "aktivləşdirildi" : "deaktiv edildi"}${fail ? `, ${fail} xəta` : ""}`, fail ? "error" : "success");
      setSelected(new Set());
      load();
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkExport = () => {
    if (selectedUsers.length === 0) return;
    const rows = selectedUsers.map((u) => ({
      Ad: u.firstName ?? "",
      Soyad: u.lastName ?? "",
      Email: u.email,
      Rol: roleLabel(u.role),
      Telefon: u.phone ?? "",
      Status: u.deletedAt ? "Silinib" : u.active ? "Aktiv" : "Deaktiv",
      "Email təsdiq": u.emailVerified ? "Bəli" : "Xeyr",
      "Son giriş": u.lastLogin ? azFormatDateTime(u.lastLogin) : "",
      Qeydiyyat: azFormatDateTime(u.createdAt),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "İstifadəçilər");
    XLSX.writeFile(wb, "secilmis-istifadeciler.xlsx");
  };

  // ── Drawer ──
  const [sel, setSel] = useState<UserRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTab, setEditTab] = useState<EditTab>("overview");

  const openDrawer = (u: UserRecord) => {
    setSel(u);
    setEditTab("overview");
    setDrawerOpen(true);
  };
  const closeDrawer = () => { setDrawerOpen(false); setSel(null); };

  // Mutasiyadan sonra həm cədvəli, həm drawer-dəki qeydi təzələ.
  const refreshSel = useCallback(async (id: number) => {
    try {
      const fresh = await adminApi.getUser(id);
      setSel((prev) => (prev && prev.id === id ? fresh : prev));
      setData((prev) => prev ? { ...prev, content: prev.content.map((x) => x.id === id ? fresh : x) } : prev);
    } catch { /* cədvəl load-u onsuz da təzələyəcək */ }
  }, []);

  const toggleActive = async (u: UserRecord) => {
    try {
      const updated = await adminApi.toggleUserActive(u.id);
      setData((prev) => prev ? { ...prev, content: prev.content.map((x) => x.id === updated.id ? updated : x) } : prev);
      setSel((prev) => (prev && prev.id === updated.id ? updated : prev));
      toast(updated.active ? "Hesab aktivləşdirildi" : "Hesab deaktiv edildi", "success");
    } catch (e) { toast((e as Error).message, "error"); }
  };

  // ── Cədvəl sütunları ──
  const columns: Column<UserRecord>[] = [
    {
      key: "firstName", header: "İstifadəçi", sortable: true,
      cell: (u) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={displayName(u)} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div className="fx-row__title">{fullName(u)}</div>
            <div className="fx-subtitle">{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Rol", sortable: true, cell: (u) => <Status tone="muted">{roleLabel(u.role)}</Status> },
    { key: "phone", header: "Telefon", hideOnMobile: true, cell: (u) => u.phone || <span className="fx-muted">—</span> },
    {
      key: "active", header: "Status",
      // Silinmiş hesabda aktiv/deaktiv açarı mənasızdır — giriş onsuz da bağlıdır,
      // bərpa yalnız detal panelindəki "Hesabı bərpa et" ilə olur.
      cell: (u) => (
        u.deletedAt ? (
          <Status tone="risk">Silinib</Status>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <Switch checked={u.active} onChange={() => toggleActive(u)} aria-label={u.active ? "Deaktiv et" : "Aktivləşdir"} />
            <Status tone={u.active ? "positive" : "muted"}>{u.active ? "Aktiv" : "Deaktiv"}</Status>
          </span>
        )
      ),
    },
    { key: "emailVerified", header: "Email", hideOnMobile: true, cell: (u) => <Status tone={u.emailVerified ? "positive" : "wait"}>{u.emailVerified ? "Təsdiqli" : "Gözləyir"}</Status> },
    { key: "lastLogin", header: "Son giriş", sortable: true, hideOnMobile: true, cell: (u) => fmtDate(u.lastLogin) },
    { key: "createdAt", header: "Qeydiyyat", sortable: true, cell: (u) => fmtDate(u.createdAt) },
  ];

  if (!mounted) return null;

  const rc = data?.roleCounts ?? {};

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead
        title="İstifadəçilər"
        sub="Platformanın bütün hesabları — axtarış, filtr və idarəetmə."
        actions={
          <Button variant="ghost" onClick={downloadExcel} disabled={exporting} icon={<PanelIcon name="download" size={16} />}>
            {exporting ? "Yüklənir…" : "Excel-ə ixrac"}
          </Button>
        }
      />

      <Stats style={{ marginBottom: 16 }}>
        <Stat value={rc.total ?? "—"} label="Ümumi hesab" />
        <Stat value={rc.PATIENT ?? "—"} label="Pasiyentlər" />
        <Stat value={rc.PSYCHOLOGIST ?? "—"} label="Psixoloqlar" />
        <Stat value={rc.OPERATOR ?? "—"} label="Operatorlar" />
        <Stat value={rc.ADMIN ?? "—"} label="Adminlər" />
      </Stats>

      <Card>
        {/* Alət zolağı */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
              <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, email və ya telefon üzrə axtar" aria-label="Axtar" autoComplete="off" />
            </div>
            <Segmented items={ROLE_FILTERS} value={role} onChange={setRole} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <FilterGroup label="Status"><Segmented items={STATUS_FILTERS} value={status} onChange={setStatus} /></FilterGroup>
            <FilterGroup label="Email"><Segmented items={VERIFIED_FILTERS} value={verified} onChange={setVerified} /></FilterGroup>
            <FilterGroup label="Qeydiyyat">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <DatePicker value={createdFrom} onChange={setCreatedFrom} theme="light" size="sm" clearable placeholder="Başlanğıc" max={createdTo || undefined} ariaLabel="Qeydiyyat — başlanğıc" />
                <span className="fx-muted">–</span>
                <DatePicker value={createdTo} onChange={setCreatedTo} theme="light" size="sm" clearable placeholder="Son" min={createdFrom || undefined} ariaLabel="Qeydiyyat — son" />
              </div>
            </FilterGroup>
            {hasFilters && (
              <Button variant="quiet" size="sm" onClick={clearFilters} icon={<PanelIcon name="x" size={14} />}>Filtrləri təmizlə</Button>
            )}
          </div>
        </div>

        <CardPad>
          <DataTable
            rows={data?.content ?? []}
            columns={columns}
            rowKey={(u) => u.id}
            selection={{ selectedKeys: selected, onChange: setSelected }}
            loading={loading}
            error={error}
            onRetry={load}
            onRowClick={openDrawer}
            empty={{
              title: "Nəticə tapılmadı",
              body: "Seçilmiş axtarış və filtrlərə uyğun istifadəçi yoxdur.",
              actions: hasFilters ? <Button variant="ghost" size="sm" onClick={clearFilters}>Filtrləri təmizlə</Button> : undefined,
            }}
            sort={{ key: sort, dir }}
            onSortChange={(s) => { setSort(s.key); setDir(s.dir); setPage(0); }}
            actions={(u) => (
              <IconButton aria-label="Kartı aç" onClick={() => openDrawer(u)}>
                <PanelIcon name="chevron" size={16} />
              </IconButton>
            )}
            pagination={{
              page: page + 1,
              pageCount: Math.max(1, data?.totalPages ?? 1),
              onChange: (p) => setPage(p - 1),
              pageSize: size,
              onPageSizeChange: (s) => { setSize(s); setPage(0); },
              pageSizeOptions: PAGE_SIZE_OPTIONS,
            }}
            totalLabel={data && data.totalElements > 0
              ? `Göstərilir: ${data.page * data.size + 1}–${Math.min((data.page + 1) * data.size, data.totalElements)} / ${data.totalElements}`
              : undefined}
          />
        </CardPad>
      </Card>

      {/* ── Ətraflı Drawer ── */}
      <Drawer open={drawerOpen} onClose={closeDrawer} title={sel ? displayName(sel) : ""}>
        {sel && (
          <UserDrawer
            key={sel.id}
            user={sel}
            editTab={editTab}
            setEditTab={setEditTab}
            onToggleActive={toggleActive}
            onAfterMutation={(id) => { refreshSel(id); load(); }}
            onDeleted={() => { closeDrawer(); load(); }}
          />
        )}
      </Drawer>

      {/* ── Toplu əməliyyat paneli ── */}
      {selected.size > 0 && (
        <div className="fx-bulkbar" role="region" aria-label="Toplu əməliyyatlar">
          <span style={{ fontWeight: 600 }}>{selected.size} seçildi</span>
          <span className="fx-bulkbar__divider" />
          <BulkButton icon="check" disabled={bulkBusy} onClick={() => bulkSetActive(true)}>Aktivləşdir</BulkButton>
          <BulkButton icon="x" disabled={bulkBusy} onClick={() => bulkSetActive(false)}>Deaktiv et</BulkButton>
          <BulkButton icon="download" disabled={bulkBusy} onClick={bulkExport}>İxrac</BulkButton>
          <span className="fx-bulkbar__divider" />
          <BulkButton disabled={bulkBusy} onClick={() => setSelected(new Set())}>Ləğv</BulkButton>
        </div>
      )}
    </div>
  );
}

// Tünd toplu-panel düyməsi (fx-bulkbar üçün açıq-rəngli variant).
function BulkButton({
  icon, disabled, onClick, children,
}: {
  icon?: React.ComponentProps<typeof PanelIcon>["name"];
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: "transparent", color: "#fff", border: "none",
        font: "inherit", fontWeight: 600, cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1, padding: "6px 8px", borderRadius: 8,
      }}
    >
      {icon && <PanelIcon name={icon} size={15} />}
      {children}
    </button>
  );
}

// ── Alət zolağı filtr qrupu (etiket + nəzarət) ──
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="fx-label" style={{ marginBottom: 0 }}>{label}</span>
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Drawer məzmunu
// ════════════════════════════════════════════════════════════════
function UserDrawer({
  user, editTab, setEditTab, onToggleActive, onAfterMutation, onDeleted,
}: {
  user: UserRecord;
  editTab: EditTab;
  setEditTab: (t: EditTab) => void;
  onToggleActive: (u: UserRecord) => void;
  onAfterMutation: (id: number) => void;
  onDeleted: () => void;
}) {
  return (
    <>
      <DrawerSection>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Avatar name={displayName(user)} size="lg" />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Status tone="muted">{roleLabel(user.role)}</Status>
              {user.deletedAt
                ? <Status tone="risk">Silinib</Status>
                : <Status tone={user.active ? "positive" : "muted"}>{user.active ? "Aktiv" : "Deaktiv"}</Status>}
              {!user.deletedAt && user.deletionRequestedAt && <Status tone="wait">Silinmə istəyi</Status>}
              <Status tone={user.emailVerified ? "positive" : "wait"}>{user.emailVerified ? "Email təsdiqli" : "Email gözləyir"}</Status>
            </div>
            <div className="fx-subtitle" style={{ marginTop: 4 }}>{user.email}</div>
          </div>
        </div>
        <div className="fx-subtitle">Qeydiyyat: {fmtDateTime(user.createdAt)}</div>
      </DrawerSection>

      <div style={{ padding: "0 24px" }}>
        <Tabs
          items={[
            { key: "overview", label: "Baxış" },
            { key: "edit", label: "Redaktə" },
            { key: "log", label: "Log" },
            { key: "actions", label: "Əməliyyatlar" },
          ]}
          value={editTab}
          onChange={(k) => setEditTab(k as EditTab)}
        />
      </div>

      {editTab === "overview" && <OverviewTab user={user} />}
      {editTab === "edit" && <EditTab user={user} onSaved={onAfterMutation} />}
      {editTab === "log" && <LogTab user={user} />}
      {editTab === "actions" && (
        <ActionsTab user={user} onToggleActive={onToggleActive} onAfterMutation={onAfterMutation} onDeleted={onDeleted} />
      )}
    </>
  );
}

const APPT_STATUS: Record<string, string> = {
  PENDING: "Gözləyir", SCHEDULED: "Planlanıb", CONFIRMED: "Təsdiqli", COMPLETED: "Tamamlanıb",
  CANCELLED: "Ləğv", REJECTED: "Rədd", NO_SHOW: "Gəlmədi", DISPUTED: "Mübahisəli",
};
function apptStatus(s: string) { return APPT_STATUS[s] ?? s; }

function OverviewTab({ user }: { user: UserRecord }) {
  return (
    <>
      <DrawerSection>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <InfoRow label="Ad" value={user.firstName || "—"} />
          <InfoRow label="Soyad" value={user.lastName || "—"} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Telefon" value={user.phone || "—"} />
          <InfoRow label="Rol" value={roleLabel(user.role)} />
          <InfoRow label="Status" value={user.deletedAt ? "Silinib" : user.active ? "Aktiv" : "Deaktiv"} />
          <InfoRow label="Email təsdiqi" value={user.emailVerified ? "Təsdiqlənib" : "Gözləyir"} />
          <InfoRow label="Son giriş" value={fmtDateTime(user.lastLogin)} />
          <InfoRow label="Qeydiyyat" value={fmtDateTime(user.createdAt)} />
          {user.deletedAt && <InfoRow label="Silinmə tarixi" value={fmtDateTime(user.deletedAt)} />}
          {!user.deletedAt && user.deletionRequestedAt && (
            <InfoRow label="Silinmə istəyi" value={fmtDateTime(user.deletionRequestedAt)} />
          )}
          {user.role === "PSYCHOLOGIST" && (
            <InfoRow label="Saytda görünür" value={user.inPsychologistList ? "Bəli" : "Xeyr"} />
          )}
        </div>
      </DrawerSection>

      {user.role === "PATIENT" && <PatientRelated userId={user.id} />}

      {user.role === "PSYCHOLOGIST" && (
        <DrawerSection>
          <SectionTitle>Psixoloq idarəetməsi</SectionTitle>
          <div className="fx-subtitle" style={{ marginBottom: 10 }}>
            Profil, qiymət, paket və cədvəl idarəsi ayrıca moduldadır.
          </div>
          <ButtonLink href="/admin/psychologists" variant="ghost" size="sm">Psixoloqlar modulunda aç</ButtonLink>
        </DrawerSection>
      )}
    </>
  );
}

// Pasiyent üçün zəngin əlaqəli panel — randevu/paket/risk (getPatientCard).
function PatientRelated({ userId }: { userId: number }) {
  const [card, setCard] = useState<PatientCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    adminApi.getPatientCard(userId)
      .then((c) => { if (alive) setCard(c); })
      .catch((e) => { if (alive) setError((e as Error).message || "Pasiyent məlumatı yüklənmədi"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  if (loading) return <DrawerSection><div className="fx-subtitle" style={{ textAlign: "center", padding: 16 }}>Pasiyent məlumatı yüklənir…</div></DrawerSection>;
  if (error) return <DrawerSection><Banner tone="error" title="Yüklənmədi">{error}</Banner></DrawerSection>;
  if (!card) return null;

  const activePackages = card.series.filter((s) => !s.cancelledAt).length;
  const recentAppts = [...card.appointments]
    .sort((a, b) => (b.startAt ? Date.parse(b.startAt) : 0) - (a.startAt ? Date.parse(a.startAt) : 0))
    .slice(0, 5);

  return (
    <DrawerSection>
      <SectionTitle>Pasiyent məlumatı</SectionTitle>

      {card.blocked && (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="warn" title="Hesab bloklanıb">{card.blockReason || "Səbəb qeyd edilməyib."}</Banner>
        </div>
      )}

      <Stats style={{ marginBottom: 12 }}>
        <Stat value={card.appointments.length} label="Randevu" />
        <Stat value={activePackages} label="Aktiv paket" />
        <Stat value={card.noShowCount} label="Gəlmədi" />
        <Stat value={card.lateCancelCount} label="Gec ləğv" />
        <Stat value={card.rejectCount} label="Rədd" />
      </Stats>

      {(card.riskLevel || card.autoFlag) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {card.riskLevel && <Status tone="wait">Risk: {card.riskLevel}</Status>}
          {card.autoFlag && <Status tone="risk">{card.autoFlag}</Status>}
        </div>
      )}

      <div className="fx-label">Son randevular</div>
      {recentAppts.length === 0 ? (
        <div className="fx-subtitle" style={{ marginBottom: 8 }}>Randevu yoxdur.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 8 }}>
          {recentAppts.map((a: AppointmentDetail) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--hairline)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{a.startAt ? fmtDateTime(a.startAt) : "Tarixsiz"}</div>
                <div className="fx-subtitle">{a.psychologistName || "Psixoloq təyin olunmayıb"}</div>
              </div>
              <Status tone="muted">{apptStatus(a.status)}</Status>
            </div>
          ))}
        </div>
      )}

      {card.series.length > 0 && (
        <>
          <div className="fx-label" style={{ marginTop: 8 }}>Paketlər / seriyalar</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {card.series.map((s: BookingSeries) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--hairline)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{s.requestedPsychologistName || "Psixoloq təyin olunmayıb"}</div>
                  <div className="fx-subtitle">{s.createdAppointments}/{s.totalCount} seans yaradılıb</div>
                </div>
                <Status tone={s.cancelledAt ? "muted" : "positive"}>{s.cancelledAt ? "Ləğv" : "Aktiv"}</Status>
              </div>
            ))}
          </div>
        </>
      )}
    </DrawerSection>
  );
}

function EditTab({ user, onSaved }: { user: UserRecord; onSaved: (id: number) => void }) {
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [emailVerified, setEmailVerified] = useState(user.emailVerified);
  const [saving, setSaving] = useState(false);

  const dirty = firstName !== (user.firstName ?? "") || lastName !== (user.lastName ?? "")
    || phone !== (user.phone ?? "") || emailVerified !== user.emailVerified;

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateUser(user.id, { firstName, lastName, phone, emailVerified });
      toast("Dəyişikliklər saxlanıldı", "success");
      onSaved(user.id);
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <DrawerSection>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <FieldRow>
          <Field label="Ad"><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
          <Field label="Soyad"><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></Field>
        </FieldRow>
        <Field label="Telefon"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+994 __ ___ __ __" /></Field>
        <Field label="Email" help="Email dəyişmək üçün «Əməliyyatlar» tabından istifadə edin.">
          <Input value={user.email} disabled />
        </Field>
        <Field label="Rol">
          <Input value={roleLabel(user.role)} disabled />
        </Field>
        <Switch label="Email təsdiqlənmiş kimi işarələ" checked={emailVerified} onChange={(e) => setEmailVerified(e.target.checked)} />
        <Button variant="primary" block disabled={!dirty || saving} onClick={save}>
          {saving ? "Saxlanır…" : "Dəyişiklikləri saxla"}
        </Button>
      </div>
    </DrawerSection>
  );
}

function LogTab({ user }: { user: UserRecord }) {
  const [scope, setScope] = useState<LogScope>("on");
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const reqId = useRef(0);

  useEffect(() => { setPage(0); }, [scope]);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    const params = scope === "on"
      ? { targetType: "USER", targetId: user.id, page, size: LOG_PAGE_SIZE }
      : { actorId: user.id, page, size: LOG_PAGE_SIZE };
    adminApi.getAuditLogs(params)
      .then((res) => {
        if (id !== reqId.current) return;
        setLogs((prev) => (page === 0 ? res.content : [...prev, ...res.content]));
        setTotalPages(res.totalPages);
      })
      .catch((e) => { if (id === reqId.current) setError((e as Error).message || "Log yüklənmədi"); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [scope, page, user.id]);

  return (
    <DrawerSection>
      <div style={{ marginBottom: 12 }}>
        <Segmented
          items={[{ key: "on" as LogScope, label: "Ona edilənlər" }, { key: "by" as LogScope, label: "Etdikləri" }]}
          value={scope}
          onChange={setScope}
        />
      </div>

      {error && (
        <Banner tone="error" title="Log yüklənmədi">
          {error}
          <div style={{ marginTop: 10 }}><Button variant="ghost" size="sm" onClick={() => setPage(0)}>Yenidən cəhd et</Button></div>
        </Banner>
      )}

      {!error && !loading && logs.length === 0 && (
        <EmptyBlock title="Qeyd yoxdur" body={scope === "on" ? "Bu istifadəçiyə aid heç bir jurnal qeydi tapılmadı." : "Bu istifadəçinin heç bir jurnal qeydi tapılmadı."} />
      )}

      {logs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {logs.map((e) => <LogItem key={e.id} entry={e} scope={scope} />)}
        </div>
      )}

      {loading && <div className="fx-subtitle" style={{ textAlign: "center", padding: 16 }}>Yüklənir…</div>}

      {!loading && page + 1 < totalPages && (
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <Button variant="ghost" size="sm" onClick={() => setPage((p) => p + 1)}>Daha çox göstər</Button>
        </div>
      )}
    </DrawerSection>
  );
}

function LogItem({ entry, scope }: { entry: AuditLogEntry; scope: LogScope }) {
  const meta = scope === "on"
    ? (entry.actorEmail ? `İcraçı: ${entry.actorEmail}` : "Sistem")
    : (entry.targetType ? `Obyekt: ${entry.targetType}${entry.targetId ? ` #${entry.targetId}` : ""}` : "");
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
      <div style={{ flexShrink: 0, marginTop: 2, color: "var(--oxford-60)" }}><PanelIcon name="clock" size={15} /></div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{entry.summary || entry.action}</div>
        <div className="fx-subtitle">{fmtDateTime(entry.createdAt)}</div>
        {meta && <div className="fx-subtitle">{meta}</div>}
        {entry.ip && <div className="fx-subtitle">IP: {entry.ip}</div>}
      </div>
    </div>
  );
}

function ActionsTab({
  user, onToggleActive, onAfterMutation, onDeleted,
}: {
  user: UserRecord;
  onToggleActive: (u: UserRecord) => void;
  onAfterMutation: (id: number) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "reset" | "verify" | "terminate" | "delete" | "restore">(null);
  const [emailModal, setEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const run = async (kind: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(kind);
    try { await fn(); toast(okMsg, "success"); return true; }
    catch (e) { toast((e as Error).message, "error"); return false; }
    finally { setBusy(null); }
  };

  const emailOk = /\S+@\S+\.\S+/.test(newEmail.trim());

  return (
    <DrawerSection>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ActionRow
          title="Şifrə sıfırlama linki göndər"
          desc="İstifadəçinin emailinə reset linki gedir, yeni şifrəni özü təyin edir."
          button={<Button variant="ghost" size="sm" disabled={busy === "reset"} onClick={() => setConfirm("reset")}>Göndər</Button>}
        />
        <ActionRow
          title="Doğrulama emailini yenidən göndər"
          desc={user.emailVerified ? "Email artıq təsdiqlənib." : "Təsdiq linkini yenidən göndərir."}
          button={<Button variant="ghost" size="sm" disabled={user.emailVerified || busy === "verify"} onClick={() => setConfirm("verify")}>Göndər</Button>}
        />
        <ActionRow
          title="Email ünvanını dəyiş"
          desc="Yeni email təyin edir. İstifadəçi yeni ünvanla giriş edəcək."
          button={<Button variant="ghost" size="sm" onClick={() => { setNewEmail(""); setEmailModal(true); }}>Dəyiş</Button>}
        />
        <ActionRow
          title="Aktiv sessiyaları bağla"
          desc="Bütün cihazlarda çıxış edilir — növbəti dəfə yenidən giriş tələb olunur."
          button={<Button variant="ghost" size="sm" disabled={busy === "terminate"} onClick={() => setConfirm("terminate")}>Bağla</Button>}
        />
        <ActionRow
          title={user.active ? "Hesabı deaktiv et" : "Hesabı aktivləşdir"}
          desc={user.active ? "İstifadəçi sistemə girə bilməyəcək." : "İstifadəçinin girişi bərpa olunur."}
          button={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Status tone={user.active ? "positive" : "muted"}>{user.active ? "Aktiv" : "Deaktiv"}</Status>
              <Switch checked={user.active} onChange={() => onToggleActive(user)} aria-label="Hesab statusu" />
            </span>
          }
        />
        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12, marginTop: 4 }}>
          {user.deletedAt ? (
            <ActionRow
              title="Hesabı bərpa et"
              desc="Hesab silinib. Data toxunulmadığı üçün bərpa tamdır — istifadəçi köhnə şifrəsi ilə daxil olur."
              button={
                <Button variant="ghost" size="sm" disabled={busy === "restore"} onClick={() => setConfirm("restore")}>
                  Bərpa et
                </Button>
              }
            />
          ) : (
            <ActionRow
              title="Hesabı sil"
              desc="Giriş bağlanır, məlumatlar isə saxlanılır. Sonradan bərpa edilə bilər."
              button={<Button variant="dangerGhost" size="sm" disabled={busy === "delete"} onClick={() => setConfirm("delete")}>Sil</Button>}
            />
          )}
        </div>
      </div>

      {/* Təsdiq modalları */}
      <Modal
        open={confirm === "reset"}
        onClose={() => setConfirm(null)}
        title="Şifrə sıfırlama linki"
        text={`${user.email} ünvanına şifrə sıfırlama linki göndəriləcək.`}
        icon={<PanelIcon name="lock" size={20} />}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Ləğv et</Button>
            <Button variant="primary" disabled={busy === "reset"} onClick={async () => { if (await run("reset", () => adminApi.sendPasswordReset(user.id), "Reset linki göndərildi")) setConfirm(null); }}>
              {busy === "reset" ? "Göndərilir…" : "Göndər"}
            </Button>
          </>
        }
      />
      <Modal
        open={confirm === "verify"}
        onClose={() => setConfirm(null)}
        title="Doğrulama emaili"
        text={`${user.email} ünvanına təsdiq linki yenidən göndəriləcək.`}
        icon={<PanelIcon name="message" size={20} />}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Ləğv et</Button>
            <Button variant="primary" disabled={busy === "verify"} onClick={async () => { if (await run("verify", () => adminApi.resendVerification(user.id), "Doğrulama emaili göndərildi")) setConfirm(null); }}>
              {busy === "verify" ? "Göndərilir…" : "Göndər"}
            </Button>
          </>
        }
      />
      <Modal
        open={confirm === "terminate"}
        onClose={() => setConfirm(null)}
        title="Sessiyaları bağla"
        text="İstifadəçi bütün cihazlarda sistemdən çıxarılacaq."
        icon={<PanelIcon name="logout" size={20} />}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Ləğv et</Button>
            <Button variant="primary" disabled={busy === "terminate"} onClick={async () => { if (await run("terminate", () => adminApi.terminateUserSessions(user.id), "Sessiyalar bağlandı")) setConfirm(null); }}>
              {busy === "terminate" ? "Bağlanır…" : "Bağla"}
            </Button>
          </>
        }
      />
      <Modal
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Hesabı sil"
        text={`«${user.email}» hesabına giriş bağlanacaq. Randevu, ödəniş və profil məlumatları silinmir — hesab sonradan bərpa edilə bilər.`}
        icon={<PanelIcon name="x" size={20} />}
        iconTone="rose"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Ləğv et</Button>
            <Button variant="danger" disabled={busy === "delete"} onClick={async () => { if (await run("delete", () => adminApi.deleteUser(user.id), "Hesab silindi")) { setConfirm(null); onDeleted(); } }}>
              {busy === "delete" ? "Silinir…" : "Sil"}
            </Button>
          </>
        }
      />
      <Modal
        open={confirm === "restore"}
        onClose={() => setConfirm(null)}
        title="Hesabı bərpa et"
        text={`«${user.email}» hesabı yenidən aktiv olacaq və istifadəçi köhnə şifrəsi ilə daxil ola biləcək.`}
        icon={<PanelIcon name="shield" size={20} />}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Ləğv et</Button>
            {/* Bərpadan sonra drawer bağlanmır — admin nəticəni yerindəcə görsün. */}
            <Button variant="primary" disabled={busy === "restore"} onClick={async () => { if (await run("restore", () => adminApi.restoreUser(user.id), "Hesab bərpa olundu")) { setConfirm(null); onAfterMutation(user.id); } }}>
              {busy === "restore" ? "Bərpa edilir…" : "Bərpa et"}
            </Button>
          </>
        }
      />

      {/* Email dəyiş modalı */}
      <Modal
        open={emailModal}
        onClose={() => setEmailModal(false)}
        title="Email ünvanını dəyiş"
        text={`Cari: ${user.email}`}
        icon={<PanelIcon name="message" size={20} />}
        actions={
          <>
            <Button variant="ghost" onClick={() => setEmailModal(false)}>Ləğv et</Button>
            <Button variant="primary" disabled={!emailOk || busy === "email"} onClick={async () => {
              if (await run("email", () => adminApi.changeUserEmail(user.id, newEmail.trim()), "Email dəyişdirildi")) { setEmailModal(false); onAfterMutation(user.id); }
            }}>
              {busy === "email" ? "Saxlanır…" : "Dəyiş"}
            </Button>
          </>
        }
      >
        <Field label="Yeni email">
          <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="ad.soyad@mail.az" autoComplete="off" autoFocus />
        </Field>
      </Modal>
    </DrawerSection>
  );
}

function ActionRow({ title, desc, button }: { title: string; desc: string; button: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div className="fx-subtitle">{desc}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{button}</div>
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
