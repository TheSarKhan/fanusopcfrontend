"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { adminApi, type UserRecord, type Psychologist, type PagedUsersResponse, type PsychologistApplication } from "@/lib/api";
import { IconSearch, IconChevron, IconUser, IconUsers, IconSettings, IconClock, IconEye, IconCheck, IconX, IconAlert, IconDownload } from "../_components/icons";
import { useT } from "@/lib/i18n/LocaleProvider";
import { toast } from "@/components/Toast";
import { azFormatDate, azFormatDateTime } from "@/lib/datetime";
import {
  Avatar,
  Button,
  DataTable,
  IconButton,
  Status,
  Switch,
  type Column,
  type StatusTone,
} from "@/components/ui";

// ── Types ────────────────────────────────────────────────────────
type RoleFilter = "all" | "PATIENT" | "PSYCHOLOGIST" | "OPERATOR" | "ADMIN";
type MainTab = "users" | "applications";
type AppFilter = "all" | "PENDING" | "APPROVED" | "REJECTED";

const ROLES: { k: RoleFilter; label: string }[] = [
  { k: "all",          label: "Hamısı"   },
  { k: "PATIENT",      label: "Pasiyent" },
  { k: "PSYCHOLOGIST", label: "Psixoloq" },
  { k: "OPERATOR",     label: "Operator" },
  { k: "ADMIN",        label: "Admin"    },
];

const ROLE_LABELS: Record<string, string> = {
  PATIENT: "Pasiyent", PSYCHOLOGIST: "Psixoloq", OPERATOR: "Operator", ADMIN: "Admin",
};
const ROLE_ICONS: Record<string, React.ReactNode> = {
  PATIENT: <IconUser size={14} />,
  PSYCHOLOGIST: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4.5 4.5 0 0 0-4.5 4.5c0 .5.08.98.23 1.43A3.5 3.5 0 0 0 5 11.5a3.5 3.5 0 0 0 1.5 2.87V15a3 3 0 0 0 3 3h.5v3"/><path d="M12 2a4.5 4.5 0 0 1 4.5 4.5c0 .5-.08.98-.23 1.43A3.5 3.5 0 0 1 19 11.5a3.5 3.5 0 0 1-1.5 2.87V15a3 3 0 0 1-3 3H14v3"/></svg>,
  OPERATOR: <IconSettings size={14} />,
  ADMIN: <IconSettings size={14} />, // Changed to simple settings icon as fallback
};

const AV_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#3A74D6", "#082F6D", "#5d6b85"];

const USER_PAGE_SIZE_OPTIONS = [10, 20, 50];
const APP_PAGE_SIZE = 20;
const APP_PAGE_SIZE_OPTIONS = [10, 20, 50];

/** Müraciət statusu — rəngli rozet yox, mətn. */
const APP_STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  PENDING:  { label: "Gözləmədə",  tone: "wait" },
  APPROVED: { label: "Təsdiqlənib", tone: "positive" },
  REJECTED: { label: "Rədd edilib", tone: "risk" },
};

// ── Helpers ──────────────────────────────────────────────────────
function initials(u: UserRecord) {
  const parts = [u.firstName, u.lastName].filter(Boolean);
  return parts.length ? parts.map((p) => p![0]).join("").toUpperCase() : u.email[0].toUpperCase();
}
function avatarColor(seed: string) {
  return AV_COLORS[Array.from(seed).reduce((s, c) => s + c.charCodeAt(0), 0) % AV_COLORS.length];
}
/** gg.aa.iiii — boş dəyər üçün tire. */
function fmtDate(s?: string | null) {
  return s ? azFormatDate(s) : "—";
}
/** gg.aa.iiii ss:dd — boş dəyər üçün tire. */
function fmtDateTime(s?: string | null) {
  return s ? azFormatDateTime(s) : "—";
}
function fullName(u: UserRecord) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
}

const EMPTY_PROFILE: Omit<Psychologist, "id"> = {
  name: "", title: "Psixoloq", specializations: [], experience: "—",
  sessionsCount: "0", rating: "0.0", photoUrl: "", bio: "", phone: "",
  email: "", languages: "", sessionTypes: "",
  university: "", degree: "", graduationYear: "",
  accentColor: "#3A74D6", bgColor: "#F2F6FD", displayOrder: 0, active: true,
};

// ── Custom Hook for Debounce ─────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ── Main Page Component ──────────────────────────────────────────
export default function UsersPage() {
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [data, setData]         = useState<PagedUsersResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Params
  const searchParams = useSearchParams();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [search, setSearch]     = useState(() => searchParams.get("q") ?? "");
  const debouncedSearch = useDebounce(search, 300);

  // React to topbar search updates
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
  }, [searchParams]);
  const [page, setPage]         = useState(0);
  const [size, setSize]         = useState(20);
  const [sort, setSort]         = useState("createdAt");
  const [dir, setDir]           = useState<"asc" | "desc">("desc");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);

  // Form states
  const [accForm, setAccForm] = useState({ firstName: "", lastName: "", phone: "", role: "", emailVerified: false });

  // Drawer Edit Tabs
  type EditTab = "account" | "profile" | "application";
  const [editTab, setEditTab] = useState<EditTab>("account");

  // Application state
  const [appData, setAppData] = useState<PsychologistApplication | null>(null);
  const [appLoading, setAppLoading] = useState(false);

  // Profile Form state
  const [profData, setProfData] = useState<Omit<Psychologist, "id"> | null>(null);
  const [specsInput, setSpecsInput] = useState("");
  const [profLoading, setProfLoading] = useState(false);
  const [profExists, setProfExists] = useState(false);

  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Application List state — serverdə səhifələnir (status + axtarış da server parametridir)
  const [mainTab, setMainTab] = useState<MainTab>("users");
  const [apps, setApps] = useState<PsychologistApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [appFilter, setAppFilter] = useState<AppFilter>("PENDING");
  const [appSearch, setAppSearch] = useState("");
  const debouncedAppSearch = useDebounce(appSearch, 300);
  // Backend `Paged.page` 0-dan başlayır; Pagination komponenti 1-dən.
  const [appPage, setAppPage] = useState(0);
  const [appSize, setAppSize] = useState(APP_PAGE_SIZE);
  const [appTotalElements, setAppTotalElements] = useState(0);
  const [appTotalPages, setAppTotalPages] = useState(0);
  /** Tab nişanındakı say — filtrdən asılı olmasın deyə ayrıca sorğu ilə alınır. */
  const [pendingCount, setPendingCount] = useState(0);
  const [detailApp, setDetailApp] = useState<PsychologistApplication | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: number; firstName: string } | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Load Data
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    adminApi.getUsers({
      role: roleFilter === "all" ? undefined : roleFilter,
      q: debouncedSearch,
      page,
      size,
      sort,
      dir
    }).then(res => {
      setData(res);
      // If current page is beyond total pages (due to filter change), reset to page 0
      if (res.totalPages > 0 && page >= res.totalPages) {
        setPage(0);
      }
    }).catch(e => setError((e as Error).message || "İstifadəçilər yüklənmədi"))
      .finally(() => setLoading(false));
  }, [roleFilter, debouncedSearch, page, size, sort, dir]);

  useEffect(() => { load(); }, [load]);

  const loadApplications = useCallback(() => {
    setAppsLoading(true);
    setAppsError(null);
    adminApi.getApplicationsPaged({
      page: appPage,
      size: appSize,
      status: appFilter === "all" ? undefined : appFilter,
      q: debouncedAppSearch || undefined,
    }).then(res => {
      setApps(res.content);
      setAppTotalElements(res.totalElements);
      setAppTotalPages(res.totalPages);
      if (res.totalPages > 0 && appPage >= res.totalPages) setAppPage(0);
    }).catch(e => setAppsError((e as Error).message || "Müraciətlər yüklənmədi"))
      .finally(() => setAppsLoading(false));
  }, [appPage, appSize, appFilter, debouncedAppSearch]);

  /** Nişandakı "gözləyən" sayı — açıq filtrdən asılı olmadan serverdən alınır. */
  const loadPendingCount = useCallback(() => {
    adminApi.getApplicationsPaged({ page: 0, size: 1, status: "PENDING" })
      .then(res => setPendingCount(res.totalElements))
      .catch(() => {});
  }, []);

  useEffect(() => { loadPendingCount(); }, [loadPendingCount]);

  useEffect(() => {
    if (mainTab === "applications") loadApplications();
  }, [mainTab, loadApplications]);

  // Reset page to 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [roleFilter, debouncedSearch]);

  // Server filtri dəyişəndə boş səhifədə qalmamaq üçün başa qayıdırıq.
  useEffect(() => {
    setAppPage(0);
  }, [appFilter, debouncedAppSearch, appSize]);

  const openDrawer = (u: UserRecord) => {
    setAccForm({ firstName: u.firstName ?? "", lastName: u.lastName ?? "", phone: u.phone ?? "", role: u.role, emailVerified: u.emailVerified });
    setEditTab("account");
    setProfData(null);
    setProfExists(false);
    setEditUser(u);
    setDrawerOpen(true);

    if (u.role === "PSYCHOLOGIST") {
      setProfLoading(true);
      adminApi.getUserPsychologistProfile(u.id)
        .then((p) => {
          setProfExists(true);
          const d = { ...EMPTY_PROFILE, ...p };
          setProfData(d);
          setSpecsInput(p.specializations?.join(", ") ?? "");
        })
        .catch(() => {
          setProfExists(false);
          const base = { ...EMPTY_PROFILE, name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email, phone: u.phone ?? "", email: u.email };
          setProfData(base);
          setSpecsInput("");
        })
        .finally(() => setProfLoading(false));

      // Fetch original application
      setAppLoading(true);
      setAppData(null);
      adminApi.getUserApplication(u.id)
        .then(res => setAppData(res))
        .catch(() => setAppData(null))
        .finally(() => setAppLoading(false));
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setEditUser(null), 300); // Wait for transition
  };

  const saveAccount = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await adminApi.updateUser(editUser.id, accForm);
      load(); // Reload table
      closeDrawer();
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };

  const saveProfile = async () => {
    if (!editUser || !profData) return;
    setSaving(true);
    try {
      const pData: Omit<Psychologist, "id"> = {
        ...profData,
        specializations: specsInput.split(",").map((s) => s.trim()).filter(Boolean),
        accentColor: profData.accentColor || "#3A74D6",
        bgColor: profData.bgColor || "#F2F6FD",
        displayOrder: profData.displayOrder || 0,
        active: profData.active ?? true
      };
      await adminApi.updateUserPsychologistProfile(editUser.id, pData);
      toast("Profil yadda saxlanıldı", "success");
      load();
      closeDrawer();
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };

  const addToModule = async () => {
    if (!editUser) return;
    try {
      const res = await adminApi.addToPsychologists(editUser.id);
      toast(res.message || "Uğurla əlavə edildi", "success");
      load();
      closeDrawer();
    } catch (e) { toast((e as Error).message, "error"); }
  };

  // Application actions
  const approve = async (id: number) => {
    if (!confirm("Bu müraciəti təsdiqləyirsiniz? İstifadəçinin rolu Psixoloq olaraq dəyişəcək.")) return;
    setActionLoading(true);
    try {
      await adminApi.approveApplication(id);
      loadApplications();
      loadPendingCount();
      load();
      setDetailApp(null);
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setActionLoading(false); }
  };

  const openReject = (id: number, firstName: string) => { setRejectNote(""); setRejectModal({ id, firstName }); };
  const confirmReject = async () => {
    if (!rejectModal) return;
    setActionLoading(true);
    try {
      await adminApi.rejectApplication(rejectModal.id, rejectNote || undefined);
      loadApplications();
      loadPendingCount();
      setRejectModal(null);
      setDetailApp(null);
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setActionLoading(false); }
  };

  const toggleActiveInline = async (u: UserRecord) => {
    try {
      const updated = await adminApi.toggleUserActive(u.id);
      setData(prev => prev ? {
        ...prev,
        content: prev.content.map(x => x.id === updated.id ? updated : x)
      } : null);
      if (editUser?.id === updated.id) {
        setEditUser(updated);
      }
    } catch (e) { toast((e as Error).message, "error"); }
  };

  const remove = async (u: UserRecord) => {
    if (!confirm(`"${u.email}" istifadəçisini silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.`)) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(u.id);
      load();
      closeDrawer();
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setDeleting(false); }
  };

  const [exporting, setExporting] = useState(false);

  const downloadExcel = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportUsers({
        role: roleFilter === "all" ? undefined : roleFilter,
        q: debouncedSearch,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "istifadeciler.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast("İxrac zamanı xəta baş verdi: " + (e as Error).message, "error");
    } finally {
      setExporting(false);
    }
  };

  // Rol rəngli rozetlə deyil, mətnlə göstərilir.
  const roleLabel = (role: string) => (
    <Status tone="muted">{ROLE_LABELS[role] ?? role}</Status>
  );

  const roleCounts = data?.roleCounts ?? {};

  // ── İstifadəçi cədvəlinin sütunları (sıralama serverdədir) ──────
  const userColumns: Column<UserRecord>[] = [
    {
      key: "firstName",
      header: "İstifadəçi",
      sortable: true,
      cell: (u) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={fullName(u) !== "—" ? fullName(u) : u.email} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{fullName(u)}</div>
            <div className="fx-subtitle">{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Rol", sortable: true, cell: (u) => roleLabel(u.role) },
    { key: "phone", header: "Telefon", cell: (u) => u.phone || "—", hideOnMobile: true },
    {
      key: "active",
      header: "Status",
      cell: (u) => (
        // Açar sətir klikini (drawer) tetikləməməlidir.
        <span
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            checked={u.active}
            onChange={() => toggleActiveInline(u)}
            aria-label={u.active ? "Hesabı deaktiv et" : "Hesabı aktivləşdir"}
          />
          <Status tone={u.active ? "positive" : "muted"}>{u.active ? "Aktiv" : "Deaktiv"}</Status>
        </span>
      ),
    },
    {
      key: "lastLogin",
      header: "Son giriş",
      sortable: true,
      hideOnMobile: true,
      cell: (u) => (u.lastLogin ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <IconClock size={12} /> {fmtDate(u.lastLogin)}
        </span>
      ) : "—"),
    },
    { key: "createdAt", header: "Qeydiyyat", sortable: true, cell: (u) => fmtDate(u.createdAt) },
  ];

  // ── Müraciət cədvəlinin sütunları ──────────────────────────────
  const appColumns: Column<PsychologistApplication>[] = [
    {
      key: "applicant",
      header: "Müraciətçi",
      cell: (a) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{a.firstName} {a.lastName}</div>
          <div className="fx-subtitle">{a.email}</div>
        </div>
      ),
    },
    {
      key: "education",
      header: "Universitet / dərəcə",
      hideOnMobile: true,
      cell: (a) => (
        <div style={{ minWidth: 0 }}>
          <div>{a.university}</div>
          <div className="fx-subtitle">{a.degree} ({a.graduationYear})</div>
        </div>
      ),
    },
    { key: "experience", header: "Təcrübə", cell: (a) => `${a.experienceYears} il` },
    { key: "createdAt", header: "Tarix", cell: (a) => fmtDate(a.createdAt) },
    { key: "status", header: "Status", cell: (a) => <AppStatus status={a.status} /> },
  ];
  
  // Drawer animations
  const drawerStyle: React.CSSProperties = {
    position: "fixed", top: 0, right: 0, bottom: 0, width: "100%", maxWidth: 500,
    background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)", zIndex: 100,
    transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
    display: "flex", flexDirection: "column"
  };
  const overlayStyle: React.CSSProperties = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.4)", zIndex: 99,
    opacity: drawerOpen ? 1 : 0, pointerEvents: drawerOpen ? "auto" : "none",
    transition: "opacity 0.3s ease"
  };

  if (!mounted) return null;

  return (
    <div className="page" style={{ paddingBottom: 60 }} suppressHydrationWarning>
      {/* ── Header ── */}
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
          <div className="btn-group sm" style={{ background: "var(--surface)", padding: 4, borderRadius: 10, border: "1px solid var(--border)" }}>
            <button className={`btn sm ${mainTab === "users" ? "primary" : "ghost"}`} onClick={() => setMainTab("users")}>
              {t("staff.adminUsersTitle")}
            </button>
            <button className={`btn sm ${mainTab === "applications" ? "primary" : "ghost"}`} onClick={() => setMainTab("applications")}>
              Psixoloq müraciətləri{pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          </div>
        </div>
      </div>

      {mainTab === "users" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          <div className="stat card">
            <div className="stat-label">
              <IconUsers className="ic" size={16} />
              <span>Ümumi</span>
            </div>
            <div className="stat-value">{roleCounts.total ?? "—"}</div>
          </div>
          <div className="stat card">
            <div className="stat-label">
              <IconUser className="ic" size={16} />
              <span>Pasiyentlər</span>
            </div>
            <div className="stat-value">{roleCounts.PATIENT ?? "—"}</div>
          </div>
          <div className="stat card">
            <div className="stat-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4.5 4.5 0 0 0-4.5 4.5c0 .5.08.98.23 1.43A3.5 3.5 0 0 0 5 11.5a3.5 3.5 0 0 0 1.5 2.87V15a3 3 0 0 0 3 3h.5v3"/><path d="M12 2a4.5 4.5 0 0 1 4.5 4.5c0 .5-.08.98-.23 1.43A3.5 3.5 0 0 1 19 11.5a3.5 3.5 0 0 1-1.5 2.87V15a3 3 0 0 1-3 3H14v3"/></svg>
              <span style={{ marginLeft: 6 }}>Psixoloqlar</span>
            </div>
            <div className="stat-value">{roleCounts.PSYCHOLOGIST ?? "—"}</div>
          </div>
          <div className="stat card">
            <div className="stat-label">
              <IconSettings className="ic" size={16} />
              <span>Operatorlar</span>
            </div>
            <div className="stat-value">{roleCounts.OPERATOR ?? "—"}</div>
          </div>
        </div>
      )}

      {/* ── User List Tab ── */}
      {mainTab === "users" && (
        <div className="table-wrap">
          <div className="toolbar" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 0 }}>
            <div className="search" style={{ width: 280 }}>
              <IconSearch size={14} style={{ color: "var(--muted)" }} />
              <input 
                placeholder="Ad, email, telefon axtar..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
            <div className="row" style={{ gap: 8, overflowX: "auto" }}>
              {ROLES.map((r) => (
                <button 
                  key={r.k} 
                  className={`filter${roleFilter === r.k ? " active" : ""}`} 
                  onClick={() => setRoleFilter(r.k)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: "auto" }}>
              <button className="btn sm ghost" onClick={downloadExcel} disabled={exporting}>
                <IconDownload size={14} /> {exporting ? "Yüklənir…" : "Excel-ə ixrac"}
              </button>
            </div>
          </div>

        {/* ── Table ── */}
        <DataTable
          rows={data?.content ?? []}
          columns={userColumns}
          rowKey={(u) => u.id}
          loading={loading}
          error={error}
          onRetry={load}
          onRowClick={openDrawer}
          empty={{
            title: "Nəticə tapılmadı",
            body: "Axtarışa və ya filtrlərə uyğun istifadəçi yoxdur.",
            actions: (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setRoleFilter("all"); }}>
                Filtrləri təmizlə
              </Button>
            ),
          }}
          // Sıralama serverdədir — sütun açarları backend sahə adlarıdır.
          sort={{ key: sort, dir }}
          onSortChange={(s) => { setSort(s.key); setDir(s.dir); setPage(0); }}
          actions={(u) => (
            <IconButton aria-label="İstifadəçi kartını aç" onClick={() => openDrawer(u)}>
              <IconChevron size={16} style={{ transform: "rotate(-90deg)" }} />
            </IconButton>
          )}
          // Backend `page` 0-dan, Pagination komponenti 1-dən başlayır.
          pagination={{
            page: page + 1,
            pageCount: Math.max(1, data?.totalPages ?? 1),
            onChange: (p) => setPage(p - 1),
            pageSize: size,
            onPageSizeChange: (s) => { setSize(s); setPage(0); },
            pageSizeOptions: USER_PAGE_SIZE_OPTIONS,
          }}
          totalLabel={
            data && data.totalElements > 0
              ? `Göstərilir: ${data.page * data.size + 1}–${Math.min((data.page + 1) * data.size, data.totalElements)} / ${data.totalElements}`
              : undefined
          }
        />
        </div>
      )}

      {/* ── Applications Tab ── */}
      {mainTab === "applications" && (
        <div className="table-wrap">
          <div className="toolbar" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 0 }}>
            <div className="search" style={{ width: 300 }}>
              <IconSearch size={14} style={{ color: "var(--muted)" }} />
              <input placeholder="Ad, email axtar..." value={appSearch} onChange={(e) => setAppSearch(e.target.value)} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              {["all", "PENDING", "APPROVED", "REJECTED"].map((f) => (
                <button key={f} className={`filter${appFilter === f ? " active" : ""}`} onClick={() => setAppFilter(f as AppFilter)}>
                  {f === "all" ? "Hamısı" : f === "PENDING" ? "Gözləmədə" : f === "APPROVED" ? "Təsdiqlənmiş" : "Rədd edilmiş"}
                </button>
              ))}
            </div>
          </div>
          <DataTable
            rows={apps}
            columns={appColumns}
            rowKey={(a) => a.id}
            loading={appsLoading}
            error={appsError}
            onRetry={loadApplications}
            empty={{
              title: "Müraciət tapılmadı",
              body: "Seçilmiş statusa və axtarışa uyğun psixoloq müraciəti yoxdur.",
              actions: (
                <Button variant="ghost" size="sm" onClick={() => { setAppSearch(""); setAppFilter("all"); }}>
                  Filtrləri təmizlə
                </Button>
              ),
            }}
            actions={(a) => (
              <IconButton aria-label="Müraciəti aç" onClick={() => setDetailApp(a)}>
                <IconEye size={16} />
              </IconButton>
            )}
            // Backend `page` 0-dan, Pagination komponenti 1-dən başlayır.
            pagination={{
              page: appPage + 1,
              pageCount: Math.max(1, appTotalPages),
              onChange: (p) => setAppPage(p - 1),
              pageSize: appSize,
              onPageSizeChange: (s) => { setAppSize(s); setAppPage(0); },
              pageSizeOptions: APP_PAGE_SIZE_OPTIONS,
            }}
            totalLabel={
              appTotalElements > 0
                ? `Göstərilir: ${appPage * appSize + 1}–${Math.min((appPage + 1) * appSize, appTotalElements)} / ${appTotalElements}`
                : undefined
            }
          />
        </div>
      )}


      {/* ─── Application detail modal (Review Mode) ────────────────────────── */}
      {detailApp && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) setDetailApp(null); }}>
          <div className="modal" style={{ maxWidth: 1280, width: "96vw" }}>
            <div className="modal-head">
              <div className="modal-title">Müraciət Review — {detailApp.firstName} {detailApp.lastName}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <AppStatus status={detailApp.status} />
                  <button className="btn ghost icon-only sm" onClick={() => setDetailApp(null)}>✕</button>
              </div>
            </div>
            <div className="modal-body" style={{ maxHeight: "calc(92vh - 80px)", overflowY: "auto", overflowX: "hidden", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 24, padding: 20 }}>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                {/* Photo + name header */}
                {detailApp.photoUrl && (
                  <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                    { }
                    <img src={detailApp.photoUrl} alt={detailApp.firstName}
                      style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", border: "2px solid var(--border)" }} />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                        {detailApp.firstName} {detailApp.lastName}
                      </div>
                      {detailApp.title && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{detailApp.title}</div>}
                    </div>
                  </div>
                )}

                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8, fontWeight: 600 }}>Şəxsi məlumatlar</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <InfoRow label="Tam Ad" value={`${detailApp.firstName} ${detailApp.lastName}`} />
                    <InfoRow label="Email" value={detailApp.email} />
                    <InfoRow label="Telefon" value={detailApp.phone ?? "—"} />
                    <InfoRow label="Doğum tarixi" value={detailApp.birthDate ? fmtDate(detailApp.birthDate) : "—"} />
                    <InfoRow label="Cinsiyyət" value={
                      detailApp.gender === "FEMALE" ? "Qadın" :
                      detailApp.gender === "MALE" ? "Kişi" :
                      detailApp.gender === "OTHER" ? "Digər" : "—"
                    } />
                    <InfoRow label="FIN / ID" value={detailApp.finId ?? "—"} />
                    <InfoRow label="Müraciət tarixi" value={fmtDate(detailApp.createdAt)} />
                  </div>
                </div>

                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8, fontWeight: 600 }}>Təhsillər</div>
                  <EducationList json={detailApp.educationsJson}
                    fallback={detailApp.university ? { institution: detailApp.university, degree: detailApp.degree ?? "", graduationYear: detailApp.graduationYear ?? "" } : null} />
                </div>

                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8, fontWeight: 600 }}>Peşəkar məlumatlar</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <InfoRow label="İxtisas / vəzifə" value={detailApp.title ?? "—"} />
                    <InfoRow label="Təcrübə" value={detailApp.experienceYears ?? "—"} />
                    <InfoRow label="Dillər" value={detailApp.languages?.split(",").map(s => s.trim()).filter(Boolean).join(", ") || "—"} />
                  </div>
                  {detailApp.specializations && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>İxtisaslaşma sahələri</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {detailApp.specializations.split(",").map(s => s.trim()).filter(Boolean).map(s => (
                          <span key={s} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "var(--ox-50)", color: "var(--ox)", fontWeight: 600 }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailApp.sessionTypes && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Seans növləri</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {detailApp.sessionTypes.split(",").map(s => s.trim()).filter(Boolean).map(s => (
                          <span key={s} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "var(--sage-50)", color: "var(--sage)", fontWeight: 600 }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {detailApp.bio && (
                  <div style={{ borderBottom: detailApp.motivation ? "1px solid var(--border)" : "none", paddingBottom: detailApp.motivation ? 12 : 0, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8, fontWeight: 600 }}>Bio (haqqında)</div>
                    <div style={{ background: "var(--surface)", padding: 14, borderRadius: 10, border: "1px solid var(--border)", fontSize: 13.5, lineHeight: 1.6, color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      {detailApp.bio}
                    </div>
                  </div>
                )}

                {detailApp.motivation && (
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8, fontWeight: 600 }}>Motivasiya / yanaşma</div>
                    <div style={{ background: "var(--surface)", padding: 14, borderRadius: 10, border: "1px solid var(--border)", fontSize: 13.5, lineHeight: 1.6, color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      {detailApp.motivation}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, borderLeft: "1px solid var(--border)", paddingLeft: 20, minWidth: 0 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8, fontWeight: 600 }}>Sertifikat və seminarlar</div>
                  <CertificateList json={detailApp.certificatesJson} legacyCerts={detailApp.certifications} />
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8, fontWeight: 600 }}>Sənədlər və fayllar</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {detailApp.diplomaFileUrl && (
                      <a href={detailApp.diplomaFileUrl} target="_blank" rel="noreferrer" className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, textDecoration: "none", color: "inherit" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--ox-50)", color: "var(--ox)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>Diplom faylı</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>Baxmaq üçün klikləyin</div>
                        </div>
                      </a>
                    )}
                    {detailApp.certificateFileUrls && detailApp.certificateFileUrls.split(",").map(s => s.trim()).filter(Boolean).map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, textDecoration: "none", color: "inherit" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--sage-50)", color: "var(--sage)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>Sertifikat skanı {i + 1}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>Baxmaq üçün klikləyin</div>
                        </div>
                      </a>
                    ))}
                    {!detailApp.diplomaFileUrl && !detailApp.certificateFileUrls && (
                      <div style={{ fontSize: 12, color: "var(--muted)", padding: 12 }}>Sənəd yüklənməyib.</div>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8, fontWeight: 600 }}>Razılıqlar</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                    <ConsentLine ok={detailApp.consentEthics} label="Etik kodeks" />
                    <ConsentLine ok={detailApp.consentGdpr} label="GDPR / şəxsi məlumat" />
                    <ConsentLine ok={detailApp.consentTerms} label="İstifadə şərtləri" />
                  </div>
                </div>

                {detailApp.adminNote && (
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8, fontWeight: 600 }}>Admin qeydi</div>
                    <div style={{ background: "var(--surface)", padding: 12, borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, color: "var(--ink)", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      {detailApp.adminNote}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: "auto", background: "var(--surface)", padding: 20, borderRadius: 16, border: "1px solid var(--border)" }}>
                  {detailApp.status === "PENDING" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <button className="btn lg danger" disabled={actionLoading} onClick={() => openReject(detailApp.id, detailApp.firstName)}>
                        <IconX size={16} /> Rədd et
                      </button>
                      <button className="btn lg" style={{ background: "var(--sage)", color: "#fff", border: "none" }} disabled={actionLoading} onClick={() => approve(detailApp.id)}>
                        <IconCheck size={16} /> Təsdiqlə
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>Müraciət artıq dəyərləndirilib</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reject modal ─────────────────────────────────────────────────── */}
      {rejectModal && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) setRejectModal(null); }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <div className="modal-title">Müraciəti rədd et</div>
              <button className="btn ghost icon-only sm" onClick={() => setRejectModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: "var(--ink)", marginBottom: 14 }}>
                <strong>{rejectModal.firstName}</strong> adlı müraciətçiyə rədd bildirişi göndəriləcək.
              </p>
              <Field label="Rədd səbəbi (ixtiyari)">
                <textarea className="input" rows={4} style={{ resize: "vertical", width: "100%", boxSizing: "border-box" }}
                  placeholder="Sənədlər natamam, ixtisas uyğun gəlmir..." value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)} />
              </Field>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setRejectModal(null)}>Ləğv et</button>
              <button className="btn danger" disabled={actionLoading} onClick={confirmReject}>
                {actionLoading ? "Göndərilir…" : "Rədd et"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Slide-over Drawer (Edit/View) ── */}
      <div style={overlayStyle} onClick={closeDrawer} />
      <div style={drawerStyle}>
        {editUser && (
          <>
            {/* Drawer Header */}
            <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 16, background: "var(--surface)" }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, background: avatarColor(editUser.email), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                {initials(editUser)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {fullName(editUser)}
                  </h2>
                  {roleLabel(editUser.role)}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{editUser.email}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <IconClock size={12} /> Qeydiyyat: {fmtDateTime(editUser.createdAt)}
                </div>
                {/* MODUL 3: tam kart səhifəsi (pasiyent/psixoloq/operator) */}
                <a href={`/admin/users/${editUser.id}`} className="btn sm" style={{ marginTop: 10, display: "inline-flex", textDecoration: "none" }}>
                  Tam kartı aç →
                </a>
              </div>
              <button className="btn ghost icon-only" onClick={closeDrawer} style={{ margin: "-8px -8px 0 0" }}>✕</button>
            </div>

            {/* Tabs */}
            {editUser.role === "PSYCHOLOGIST" && (
              <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 24px", overflowX: "auto" }}>
                {(["account", "profile", "application"] as EditTab[]).map((t) => (
                  <button key={t} onClick={() => setEditTab(t)}
                    style={{ padding: "14px 16px", fontSize: 13, fontWeight: editTab === t ? 600 : 500, color: editTab === t ? "var(--ox)" : "var(--muted)", background: "none", border: "none", borderBottom: editTab === t ? "2px solid var(--ox)" : "2px solid transparent", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}>
                    {t === "account" ? "Hesab" : t === "profile" ? "Profil" : "Qeydiyyat müraciəti"}
                  </button>
                ))}
              </div>
            )}

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              
              {/* Account Tab */}
              {(editUser.role !== "PSYCHOLOGIST" || editTab === "account") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    {editUser.emailVerified
                      ? <span className="pill sage"><span className="dot" />Email təsdiqlənib</span>
                      : <span className="pill gold"><span className="dot" />Email gözləyir</span>}
                    {editUser.role === "PSYCHOLOGIST" && (
                      editUser.inPsychologistList
                        ? <span className="pill sage"><span className="dot" />Websayt siyahısında</span>
                        : <span className="pill muted"><span className="dot" />Siyahıda deyil</span>
                    )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Ad">
                    <input className="input" value={accForm.firstName}
                      onChange={(e) => setAccForm((f) => ({ ...f, firstName: e.target.value }))} />
                  </Field>
                  <Field label="Soyad">
                    <input className="input" value={accForm.lastName}
                      onChange={(e) => setAccForm((f) => ({ ...f, lastName: e.target.value }))} />
                  </Field>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Telefon">
                    <input className="input" value={accForm.phone}
                      onChange={(e) => setAccForm((f) => ({ ...f, phone: e.target.value }))} />
                  </Field>
                  <Field label="Rol">
                    <div className="input" style={{ background: "var(--surface)", color: "var(--muted)", display: "flex", alignItems: "center" }}>
                      {accForm.role === "PATIENT" ? "Pasiyent" : accForm.role === "PSYCHOLOGIST" ? "Psixoloq" : accForm.role === "OPERATOR" ? "Operator" : accForm.role === "ADMIN" ? "Admin" : accForm.role}
                    </div>
                  </Field>
                </div>

                <div style={{ background: "var(--ox-50)", border: "1px solid var(--ox-100)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Email ünvanı (dəyişdirilə bilməz)</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{editUser.email}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Email təsdiqlənib</span>
                    <button 
                      className={`switch${accForm.emailVerified ? " on" : ""}`}
                      onClick={() => setAccForm((f) => ({ ...f, emailVerified: !f.emailVerified }))} 
                    />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", padding: 16, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Hesab statusu</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>İstifadəçinin sistemə girişi</div>
                  </div>
                  <button 
                    onClick={() => toggleActiveInline(editUser)}
                    className={`switch${editUser.active ? " on" : ""}`} 
                  />
                </div>

                {editUser.role === "PSYCHOLOGIST" && !editUser.inPsychologistList && (
                  <div style={{ marginTop: 12, background: "var(--gold-light, #FFF8E6)", border: "1px solid var(--gold)", borderRadius: 8, padding: 16 }}>
                    <div style={{ fontWeight: 600, color: "var(--gold-dark, #B28200)", fontSize: 14, marginBottom: 4 }}>Saytda görünmür</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Bu istifadəçi psixoloqdur, lakin vebsaytda (Psixoloqlar modulunda) yoxdur.</div>
                    <button className="btn outline" style={{ background: "#fff", borderColor: "var(--gold)", color: "var(--gold-dark)" }} onClick={addToModule}>
                      Psixoloqlar moduluna əlavə et
                    </button>
                  </div>
                )}

                <div style={{ marginTop: "auto", paddingTop: 40 }}>
                  <button className="btn danger ghost" onClick={() => remove(editUser)} style={{ width: "100%", justifyContent: "center" }}>
                    Hesabı birdəfəlik sil
                  </button>
                </div>
              </div>
            )}

            {/* Profile Tab */}
            {editUser.role === "PSYCHOLOGIST" && editTab === "profile" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {profLoading && <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Profil məlumatları yüklənir…</div>}
                {!profLoading && !profExists && (
                  <div style={{ background: "var(--gold-light, #FFF8E6)", border: "1px solid var(--gold)", borderRadius: 8, padding: 16 }}>
                    <div style={{ fontWeight: 600, color: "var(--gold-dark, #B28200)", fontSize: 14 }}>Psixoloq məlumatları yoxdur</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Aşağıdakı formu dolduraraq bu psixoloqun qeydiyyat detallarını dərhal əlavə edə bilərsiniz.</div>
                  </div>
                )}
                {!profLoading && profData && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Ad Soyad">
                        <input className="input" value={profData.name}
                          onChange={(e) => setProfData((p) => p && ({ ...p, name: e.target.value }))} />
                      </Field>
                      <Field label="Vəzifə / Titul">
                        <input className="input" value={profData.title}
                          onChange={(e) => setProfData((p) => p && ({ ...p, title: e.target.value }))} />
                      </Field>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      <Field label="Təcrübə (il)">
                        <input className="input" value={profData.experience}
                          onChange={(e) => setProfData((p) => p && ({ ...p, experience: e.target.value }))} />
                      </Field>
                      <Field label="Sessiya sayı">
                        <input className="input" value={profData.sessionsCount}
                          onChange={(e) => setProfData((p) => p && ({ ...p, sessionsCount: e.target.value }))} />
                      </Field>
                      <Field label="Reytinq">
                        <input className="input" value={profData.rating}
                          onChange={(e) => setProfData((p) => p && ({ ...p, rating: e.target.value }))} />
                      </Field>
                    </div>
                    <Field label="İxtisaslar (vergüllə)">
                      <input className="input" placeholder="Məs: Klinik psixoloq, Ailə terapevti..." value={specsInput}
                        onChange={(e) => setSpecsInput(e.target.value)} />
                    </Field>
                    <Field label="Haqqında (Bio)">
                      <textarea className="input" rows={4} style={{ resize: "vertical", width: "100%", boxSizing: "border-box" }}
                        value={profData.bio ?? ""}
                        onChange={(e) => setProfData((p) => p && ({ ...p, bio: e.target.value }))} />
                    </Field>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Dillər (vergüllə)">
                        <input className="input" value={profData.languages ?? ""}
                          onChange={(e) => setProfData((p) => p && ({ ...p, languages: e.target.value }))} />
                      </Field>
                      <Field label="Sessiya növləri (vergüllə)">
                        <input className="input" value={profData.sessionTypes ?? ""}
                          onChange={(e) => setProfData((p) => p && ({ ...p, sessionTypes: e.target.value }))} />
                      </Field>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      <Field label="Universitet">
                        <input className="input" value={profData.university ?? ""}
                          onChange={(e) => setProfData((p) => p && ({ ...p, university: e.target.value }))} />
                      </Field>
                      <Field label="Dərəcə">
                        <input className="input" value={profData.degree ?? ""}
                          onChange={(e) => setProfData((p) => p && ({ ...p, degree: e.target.value }))} />
                      </Field>
                      <Field label="Buraxılış ili">
                        <input className="input" value={profData.graduationYear ?? ""}
                          onChange={(e) => setProfData((p) => p && ({ ...p, graduationYear: e.target.value }))} />
                      </Field>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Əlaqə telefonu">
                        <input className="input" value={profData.phone ?? ""}
                          onChange={(e) => setProfData((p) => p && ({ ...p, phone: e.target.value }))} />
                      </Field>
                      <Field label="Əlaqə emaili">
                        <input className="input" value={profData.email ?? ""}
                          onChange={(e) => setProfData((p) => p && ({ ...p, email: e.target.value }))} />
                      </Field>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                      <Field label="Şəkil URL">
                        <input className="input" placeholder="https://..." value={profData.photoUrl ?? ""}
                          onChange={(e) => setProfData((p) => p && ({ ...p, photoUrl: e.target.value }))} />
                      </Field>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Application Tab */}
            {editUser.role === "PSYCHOLOGIST" && editTab === "application" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {appLoading && <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Müraciət məlumatları yüklənir…</div>}
                {!appLoading && !appData && (
                  <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Bu istifadəçi üçün qeydiyyat müraciəti tapılmadı.</div>
                )}
                {!appLoading && appData && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 16, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
                        {appData.photoUrl ? (
                            <img src={appData.photoUrl} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover" }} />
                        ) : (
                            <div style={{ width: 64, height: 64, borderRadius: 10, background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "var(--muted)" }}>
                                {appData.firstName[0]}{appData.lastName[0]}
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Müraciət statusu</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                               <AppStatus status={appData.status} />
                               <span style={{ fontSize: 12, color: "var(--muted)" }}>Tarix: {fmtDateTime(appData.createdAt)}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <Field label="Tam Ad">
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{appData.firstName} {appData.lastName}</div>
                        </Field>
                        <Field label="Əlaqə">
                            <div style={{ fontSize: 14 }}>{appData.phone}<br/>{appData.email}</div>
                        </Field>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <Field label="Universitet">
                            <div style={{ fontSize: 14 }}>{appData.university}</div>
                        </Field>
                        <Field label="Dərəcə / İl">
                            <div style={{ fontSize: 14 }}>{appData.degree} ({appData.graduationYear})</div>
                        </Field>
                    </div>

                    <Field label="Haqqında (Bio)">
                        <div style={{ fontSize: 14, lineHeight: 1.5, background: "var(--surface)", padding: 12, borderRadius: 8 }}>{appData.bio || "—"}</div>
                    </Field>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <Field label="İxtisaslar">
                            <div style={{ fontSize: 14 }}>{appData.specializations || "—"}</div>
                        </Field>
                        <Field label="Təcrübə">
                            <div style={{ fontSize: 14 }}>{appData.experienceYears} il</div>
                        </Field>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Sənədlər</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                            {appData.diplomaFileUrl && (
                                <a href={appData.diplomaFileUrl} target="_blank" rel="noreferrer" className="btn sm outline" style={{ gap: 8 }}>
                                    Diplom
                                </a>
                            )}
                            {appData.certificateFileUrls && appData.certificateFileUrls.split(",").map((url: string, i: number) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer" className="btn sm outline" style={{ gap: 8 }}>
                                    Sertifikat {i+1}
                                </a>
                            ))}
                        </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>

            {/* Drawer Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 12, background: "#fff", zIndex: 10 }}>
              <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={closeDrawer}>Ləğv et</button>
              {(editUser.role !== "PSYCHOLOGIST" || editTab === "account") && (
                <button className="btn primary" style={{ flex: 1, justifyContent: "center" }} disabled={saving} onClick={saveAccount}>
                  {saving ? "Saxlanır…" : "Dəyişiklikləri saxla"}
                </button>
              )}
              {editUser.role === "PSYCHOLOGIST" && editTab === "profile" && (
                <button className="btn primary" style={{ flex: 1, justifyContent: "center" }} disabled={saving || profLoading} onClick={saveProfile}>
                  {saving ? "Saxlanır…" : "Məlumatları saxla"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}

// ── Components ───────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={typeof value === "string" ? value : undefined}>
        {value}
      </div>
    </div>
  );
}

/** Müraciət statusu — rəngli rozet yox, mətn. */
function AppStatus({ status }: { status: string }) {
  const meta = APP_STATUS_META[status];
  if (!meta) return <Status tone="muted">{status}</Status>;
  return <Status tone={meta.tone}>{meta.label}</Status>;
}

function ConsentLine({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{
        width: 16, height: 16, borderRadius: "50%",
        background: ok ? "#10B981" : "#E5E7EB",
        color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 700, flexShrink: 0,
      }}>{ok ? "✓" : ""}</span>
      <span style={{ color: ok ? "var(--ink)" : "var(--muted)" }}>{label}</span>
    </div>
  );
}

function EducationList({ json, fallback }: {
  json?: string;
  fallback?: { institution: string; degree: string; graduationYear: string } | null;
}) {
  let rows: { institution: string; degree?: string; graduationYear?: string }[] = [];
  if (json) {
    try { rows = JSON.parse(json); } catch { /* ignore */ }
  }
  if (rows.length === 0 && fallback?.institution) rows = [fallback];
  if (rows.length === 0) return <div style={{ fontSize: 12, color: "var(--muted)" }}>Təhsil qeyd edilməyib.</div>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ background: "var(--surface)", padding: 12, borderRadius: 10, border: "1px solid var(--border)", minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflowWrap: "anywhere", wordBreak: "break-word" }}>{r.institution}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {[r.degree, r.graduationYear].filter(Boolean).join(", ") || "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function CertificateList({ json, legacyCerts }: { json?: string; legacyCerts?: string }) {
  let rows: { title: string; issuer?: string; year?: string; type?: string }[] = [];
  if (json) {
    try { rows = JSON.parse(json); } catch { /* ignore */ }
  }
  // Legacy fallback (comma-separated free text)
  if (rows.length === 0 && legacyCerts) {
    rows = legacyCerts.split(",").map(s => s.trim()).filter(Boolean).map(t => ({ title: t, type: "CERTIFICATE" }));
  }
  if (rows.length === 0) return <div style={{ fontSize: 12, color: "var(--muted)" }}>Sertifikat / seminar yoxdur.</div>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ background: "var(--surface)", padding: 12, borderRadius: 10, border: "1px solid var(--border)", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflowWrap: "anywhere", wordBreak: "break-word", flex: 1, minWidth: 0 }}>{r.title}</div>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: r.type === "SEMINAR" ? "var(--sage-50)" : "var(--ox-50)", color: r.type === "SEMINAR" ? "var(--sage)" : "var(--ox)", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
              {r.type === "SEMINAR" ? "SEMİNAR" : "SERTİFİKAT"}
            </span>
          </div>
          {(r.issuer || r.year) && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {[r.issuer, r.year].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
