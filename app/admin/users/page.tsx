"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, type UserRecord, type Psychologist, type PagedUsersResponse, type PsychologistApplication } from "@/lib/api";
import { IconSearch, IconChevron, IconUser, IconUsers, IconSettings, IconClock, IconEye, IconCheck, IconX, IconAlert, IconDownload } from "../_components/icons";

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
const ROLE_COLORS: Record<string, string> = {
  PATIENT: "muted", PSYCHOLOGIST: "sage", OPERATOR: "gold", ADMIN: "ox",
};
const ROLE_ICONS: Record<string, React.ReactNode> = {
  PATIENT: <IconUser size={14} />,
  PSYCHOLOGIST: <span style={{ fontSize: 13 }}>🧠</span>,
  OPERATOR: <IconSettings size={14} />,
  ADMIN: <IconSettings size={14} />, // Changed to simple settings icon as fallback
};

const AV_COLORS = ["#7c6f99", "#7c9a86", "#b58a3c", "#2f5283", "#0a2d59", "#5d6b85"];

// ── Helpers ──────────────────────────────────────────────────────
function initials(u: UserRecord) {
  const parts = [u.firstName, u.lastName].filter(Boolean);
  return parts.length ? parts.map((p) => p![0]).join("").toUpperCase() : u.email[0].toUpperCase();
}
function avatarColor(seed: string) {
  return AV_COLORS[Array.from(seed).reduce((s, c) => s + c.charCodeAt(0), 0) % AV_COLORS.length];
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}
function fmtDateTime(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()} ${hours}:${mins}`;
}
function fullName(u: UserRecord) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
}

const EMPTY_PROFILE: Omit<Psychologist, "id"> = {
  name: "", title: "Psixoloq", specializations: [], experience: "—",
  sessionsCount: "0", rating: "0.0", photoUrl: "", bio: "", phone: "",
  email: "", languages: "", sessionTypes: "", activityFormat: "",
  university: "", degree: "", graduationYear: "",
  accentColor: "#2f5283", bgColor: "#eef1f7", displayOrder: 0, active: true,
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [data, setData]         = useState<PagedUsersResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  
  // Params
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [search, setSearch]     = useState("");
  const debouncedSearch = useDebounce(search, 300);
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
  const [appData, setAppData] = useState<any>(null);
  const [appLoading, setAppLoading] = useState(false);

  // Profile Form state
  const [profData, setProfData] = useState<Omit<Psychologist, "id"> | null>(null);
  const [specsInput, setSpecsInput] = useState("");
  const [profLoading, setProfLoading] = useState(false);
  const [profExists, setProfExists] = useState(false);

  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Application List state
  const [mainTab, setMainTab] = useState<MainTab>("users");
  const [apps, setApps] = useState<PsychologistApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appFilter, setAppFilter] = useState<AppFilter>("PENDING");
  const [appSearch, setAppSearch] = useState("");
  const [detailApp, setDetailApp] = useState<PsychologistApplication | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: number; firstName: string } | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Load Data
  const load = useCallback(() => {
    setLoading(true);
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
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [roleFilter, debouncedSearch, page, size, sort, dir]);

  useEffect(() => { load(); }, [load]);

  const loadApplications = useCallback(() => {
    setAppsLoading(true);
    adminApi.getApplications().then(setApps).catch(() => {}).finally(() => setAppsLoading(false));
  }, []);

  useEffect(() => {
    if (mainTab === "applications") loadApplications();
  }, [mainTab, loadApplications]);

  // Reset page to 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [roleFilter, debouncedSearch]);

  // Handlers
  const handleSort = (field: string) => {
    if (sort === field) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setDir("asc");
    }
  };

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
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  };

  const saveProfile = async () => {
    if (!editUser || !profData) return;
    setSaving(true);
    try {
      const pData: Omit<Psychologist, "id"> = {
        ...profData,
        specializations: specsInput.split(",").map((s) => s.trim()).filter(Boolean),
        accentColor: profData.accentColor || "#2f5283",
        bgColor: profData.bgColor || "#eef1f7",
        displayOrder: profData.displayOrder || 0,
        active: profData.active ?? true
      };
      await adminApi.updateUserPsychologistProfile(editUser.id, pData);
      alert("Profil yadda saxlanıldı!");
      load();
      closeDrawer();
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  };

  const addToModule = async () => {
    if (!editUser) return;
    try {
      const res = await adminApi.addToPsychologists(editUser.id);
      alert(res.message || "Uğurla əlavə edildi");
      load();
      closeDrawer();
    } catch (e) { alert((e as Error).message); }
  };

  // Application actions
  const approve = async (id: number) => {
    if (!confirm("Bu müraciəti təsdiqləyirsiniz? İstifadəçinin rolu Psixoloq olaraq dəyişəcək.")) return;
    setActionLoading(true);
    try {
      await adminApi.approveApplication(id);
      loadApplications();
      load();
      setDetailApp(null);
    } catch (e) { alert((e as Error).message); }
    finally { setActionLoading(false); }
  };

  const openReject = (id: number, firstName: string) => { setRejectNote(""); setRejectModal({ id, firstName }); };
  const confirmReject = async () => {
    if (!rejectModal) return;
    setActionLoading(true);
    try {
      await adminApi.rejectApplication(rejectModal.id, rejectNote || undefined);
      loadApplications();
      setRejectModal(null);
      setDetailApp(null);
    } catch (e) { alert((e as Error).message); }
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
    } catch (e) { alert((e as Error).message); }
  };

  const remove = async (u: UserRecord) => {
    if (!confirm(`"${u.email}" istifadəçisini silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.`)) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(u.id);
      load();
      closeDrawer();
    } catch (e) { alert((e as Error).message); }
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
      alert("İxrac zamanı xəta baş verdi: " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const rolePill = (role: string) => (
    <span className={`pill ${ROLE_COLORS[role] ?? "muted"}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );

  const SortIndicator = ({ field }: { field: string }) => {
    if (sort !== field) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
    return <span style={{ marginLeft: 4, color: "var(--ox)" }}>{dir === "asc" ? "↑" : "↓"}</span>;
  };

  const roleCounts = data?.roleCounts ?? {};
  
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
              İstifadəçilər
            </button>
            <button className={`btn sm ${mainTab === "applications" ? "primary" : "ghost"}`} onClick={() => setMainTab("applications")}>
              Psixoloq müraciətləri
              {apps.filter(a => a.status === "PENDING").length > 0 && (
                <span className="pill danger" style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px" }}>
                  {apps.filter(a => a.status === "PENDING").length}
                </span>
              )}
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
              <span style={{ fontSize: 14 }}>🧠</span>
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
        <table className="t">
          <thead>
            <tr>
              <th onClick={() => handleSort("firstName")} style={{ cursor: "pointer" }}>İstifadəçi <SortIndicator field="firstName" /></th>
              <th onClick={() => handleSort("role")} style={{ cursor: "pointer" }}>Rol <SortIndicator field="role" /></th>
              <th>Telefon</th>
              <th>Status</th>
              <th onClick={() => handleSort("lastLogin")} style={{ cursor: "pointer" }}>Son giriş <SortIndicator field="lastLogin" /></th>
              <th onClick={() => handleSort("createdAt")} style={{ cursor: "pointer" }}>Qeydiyyat <SortIndicator field="createdAt" /></th>
              <th style={{ width: 60, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</td></tr>
            )}
            {!loading && (!data?.content || data.content.length === 0) && (
              <tr>
                <td colSpan={7} style={{ padding: 60, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>Nəticə tapılmadı</div>
                  <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Axtarışa və ya filtrlərə uyğun istifadəçi yoxdur.</div>
                  <button className="btn mt-16" onClick={() => {setSearch(""); setRoleFilter("all");}}>Filtrləri təmizlə</button>
                </td>
              </tr>
            )}
            {!loading && data?.content?.map((u) => (
              <tr key={u.id} style={{ opacity: u.active ? 1 : 0.6, cursor: "pointer", transition: "background 0.2s" }} onClick={() => openDrawer(u)} className="hover-row">
                <td>
                  <div className="row-avatar">
                    <div className="av" style={{ background: avatarColor(u.email) }}>{initials(u)}</div>
                    <div>
                      <div className="nm" style={{ fontWeight: 600 }}>{fullName(u)}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>{rolePill(u.role)}</td>
                <td style={{ fontSize: 13 }}>{u.phone || "—"}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button 
                      onClick={() => toggleActiveInline(u)}
                      className={`switch${u.active ? " on" : ""}`} 
                      style={{ transform: "scale(0.85)", transformOrigin: "left center" }}
                    />
                    <span style={{ fontSize: 12, color: u.active ? "var(--sage)" : "var(--muted)", fontWeight: 500 }}>
                      {u.active ? "Aktiv" : "Deaktiv"}
                    </span>
                  </div>
                </td>
                <td style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {u.lastLogin ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <IconClock size={12} /> {fmtDate(u.lastLogin)}
                    </div>
                  ) : "—"}
                </td>
                <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{fmtDate(u.createdAt)}</td>
                <td style={{ textAlign: "right" }}>
                  <IconChevron size={16} style={{ color: "var(--muted)", transform: "rotate(-90deg)" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Pagination ── */}
        {data && data.totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Göstərilir: {data.page * data.size + 1} - {Math.min((data.page + 1) * data.size, data.totalElements)} / {data.totalElements}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button 
                className="btn sm ghost" 
                disabled={data.page === 0} 
                onClick={() => setPage(p => p - 1)}
              >
                Əvvəlki
              </button>
              {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                // Show sliding window of 5 pages
                let p = i;
                if (data.totalPages > 5 && data.page > 2) {
                  p = data.page - 2 + i;
                  if (p >= data.totalPages) p = data.totalPages - (5 - i); // adjust end bounds
                }
                if (p < 0 || p >= data.totalPages) return null;
                return (
                  <button 
                    key={p} 
                    className={`btn sm ${data.page === p ? "primary" : "ghost"}`}
                    onClick={() => setPage(p)}
                  >
                    {p + 1}
                  </button>
                );
              })}
              <button 
                className="btn sm ghost" 
                disabled={data.page >= data.totalPages - 1} 
                onClick={() => setPage(p => p + 1)}
              >
                Sonrakı
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Səhifə başı:</span>
              <select 
                className="input sm" 
                value={size} 
                onChange={(e) => {setSize(Number(e.target.value)); setPage(0);}}
                style={{ padding: "4px 8px", height: "auto" }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        )}
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
          <table className="t">
            <thead>
              <tr>
                <th>Müraciətçi</th>
                <th>Universitet / Dərəcə</th>
                <th>Təcrübə</th>
                <th>Tarix</th>
                <th>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {appsLoading && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</td></tr>
              )}
              {!appsLoading && apps
                .filter(a => {
                   if (appFilter !== "all" && a.status !== appFilter) return false;
                   if (appSearch) {
                      const q = appSearch.toLowerCase();
                      return `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(q);
                   }
                   return true;
                })
                .map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="nm" style={{ fontWeight: 600 }}>{a.firstName} {a.lastName}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.email}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{a.university}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{a.degree} ({a.graduationYear})</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{a.experienceYears} il</td>
                  <td style={{ fontSize: 13 }}>{fmtDate(a.createdAt)}</td>
                  <td>{statusPill(a.status)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn sm ghost icon-only" onClick={() => setDetailApp(a)}>
                      <IconEye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Application detail modal (Review Mode) ────────────────────────── */}
      {detailApp && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) setDetailApp(null); }}>
          <div className="modal" style={{ maxWidth: 1000, width: "95%" }}>
            <div className="modal-head">
              <div className="modal-title">Müraciət Review — {detailApp.firstName} {detailApp.lastName}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {statusPill(detailApp.status)}
                  <button className="btn ghost icon-only sm" onClick={() => setDetailApp(null)}>✕</button>
              </div>
            </div>
            <div className="modal-body" style={{ maxHeight: "80vh", overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>Şəxsi məlumatlar</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <InfoRow label="Tam Ad" value={`${detailApp.firstName} ${detailApp.lastName}`} />
                        <InfoRow label="Email" value={detailApp.email} />
                        <InfoRow label="Telefon" value={detailApp.phone ?? "—"} />
                        <InfoRow label="Tarix" value={fmtDate(detailApp.createdAt)} />
                    </div>
                </div>

                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>Təhsil və Təcrübə</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <InfoRow label="Universitet" value={detailApp.university} />
                        <InfoRow label="Dərəcə" value={`${detailApp.degree}, ${detailApp.graduationYear}`} />
                        <InfoRow label="Təcrübə" value={detailApp.experienceYears ? `${detailApp.experienceYears} il` : "—"} />
                        <InfoRow label="Format" value={
                          detailApp.activityFormat === "BOTH" ? "Həm onlayn, həm də əyani" :
                          detailApp.activityFormat === "ONLINE" ? "Onlayn" :
                          detailApp.activityFormat === "IN_PERSON" ? "Əyani" :
                          (detailApp.activityFormat ?? "—")
                        } />
                    </div>
                </div>

                <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>Haqqında</div>
                    <div style={{ background: "var(--surface)", padding: 16, borderRadius: 12, border: "1px solid var(--border)", fontSize: 14, lineHeight: 1.6, color: "var(--ink)" }}>
                        {detailApp.bio || "Bioqrafiya qeyd edilməyib."}
                    </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 24, borderLeft: "1px solid var(--border)", paddingLeft: 32 }}>
                 <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>Sənədlər və Fayllar</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {detailApp.diplomaFileUrl && (
                            <a href={detailApp.diplomaFileUrl} target="_blank" rel="noreferrer" className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, textDecoration: "none", color: "inherit" }}>
                                <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--ox-50)", color: "var(--ox)", display: "flex", alignItems: "center", justifyContent: "center" }}>📄</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>Diplom faylı</div>
                                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Baxmaq üçün klikləyin</div>
                                </div>
                            </a>
                        )}
                        {detailApp.certificateFileUrls && detailApp.certificateFileUrls.split(",").map((url, i) => (
                             <a key={i} href={url} target="_blank" rel="noreferrer" className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, textDecoration: "none", color: "inherit" }}>
                                <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--sage-50)", color: "var(--sage)", display: "flex", alignItems: "center", justifyContent: "center" }}>📜</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>Sertifikat {i + 1}</div>
                                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Baxmaq üçün klikləyin</div>
                                </div>
                            </a>
                        ))}
                    </div>
                 </div>

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
                  {rolePill(editUser.role)}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{editUser.email}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <IconClock size={12} /> Qeydiyyat: {fmtDateTime(editUser.createdAt)}
                </div>
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Ad">
                    <input className="input" value={accForm.firstName}
                      onChange={(e) => setAccForm((f) => ({ ...f, firstName: e.target.value }))} />
                  </Field>
                  <Field label="Soyad">
                    <input className="input" value={accForm.lastName}
                      onChange={(e) => setAccForm((f) => ({ ...f, lastName: e.target.value }))} />
                  </Field>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <Field label="Əlaqə telefonu">
                        <input className="input" value={profData.phone ?? ""}
                          onChange={(e) => setProfData((p) => p && ({ ...p, phone: e.target.value }))} />
                      </Field>
                      <Field label="Əlaqə emaili">
                        <input className="input" value={profData.email ?? ""}
                          onChange={(e) => setProfData((p) => p && ({ ...p, email: e.target.value }))} />
                      </Field>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <Field label="Fəaliyyət formatı">
                        <input className="input" placeholder="Onlayn / Əyani / Həm onlayn, həm də əyani" value={profData.activityFormat ?? ""}
                          onChange={(e) => setProfData((p) => p && ({ ...p, activityFormat: e.target.value }))} />
                      </Field>
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
                               <span className={`pill ${appData.status === "APPROVED" ? "sage" : appData.status === "REJECTED" ? "ox" : "gold"}`}>
                                    {appData.status === "APPROVED" ? "Təsdiqlənib" : appData.status === "REJECTED" ? "Rədd edilib" : "Gözləmədə"}
                               </span>
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
                                    📄 Diplom
                                </a>
                            )}
                            {appData.certificateFileUrls && appData.certificateFileUrls.split(",").map((url: string, i: number) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer" className="btn sm outline" style={{ gap: 8 }}>
                                    📜 Sertifikat {i+1}
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

      <style jsx global>{`
        .hover-row:hover {
          background-color: var(--surface);
        }
      `}</style>
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
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function statusPill(status: string) {
  switch (status) {
    case "PENDING": return <span className="pill gold">Gözləmədə</span>;
    case "APPROVED": return <span className="pill sage">Təsdiqlənib</span>;
    case "REJECTED": return <span className="pill ox">Rədd edilib</span>;
    default: return <span className="pill muted">{status}</span>;
  }
}

function SortIndicator({ field }: { field: string }) {
  return null;
}
