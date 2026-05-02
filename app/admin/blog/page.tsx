"use client";

import { useEffect, useState, useMemo } from "react";
import { adminApi, type BlogPost } from "@/lib/api";
import { getMainSiteUrl } from "@/lib/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

function fmtDateTime(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim();
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconEye = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconLink = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
);
const IconCheck = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconEdit = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconTrash = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);
const IconStar = ({ filled }: { filled: boolean }) => (
  <svg width="15" height="15" fill={filled ? "#F59E0B" : "none"} stroke={filled ? "#F59E0B" : "currentColor"} strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const IconFilter = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);
const IconX = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconPlus = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconExternal = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, border: "1px solid #E4EDF6",
      padding: "14px 20px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status, onClick }: { status: string; onClick?: () => void }) {
  const published = status === "PUBLISHED";
  return (
    <button
      onClick={onClick}
      title={onClick ? (published ? "Qaralamaya keçir" : "Yayımla") : undefined}
      style={{
        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, border: "none",
        background: published ? "#DCFCE7" : "#FEF3C7",
        color: published ? "#166534" : "#92400E",
        cursor: onClick ? "pointer" : "default",
        whiteSpace: "nowrap",
        transition: "opacity 0.15s",
      }}
    >
      {published ? "Yayımlandı" : "Qaralama"}
    </button>
  );
}

function AuthorBadge({ name, isAdmin }: { name?: string; isAdmin?: boolean }) {
  if (!name) return <span style={{ fontSize: 12, color: "#C0D2E6" }}>—</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%",
        background: isAdmin ? "#EEF5FF" : "#F0FDF4",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700,
        color: isAdmin ? "#002147" : "#166534",
        flexShrink: 0,
      }}>
        {name.charAt(0).toUpperCase()}
      </div>
      <span style={{ fontSize: 12, color: "#374151", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </span>
    </div>
  );
}

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
          background: "#1A2535", color: "#fff", fontSize: 11, fontWeight: 500,
          padding: "4px 8px", borderRadius: 6, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 99,
        }}>
          {text}
          <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", borderWidth: 4, borderStyle: "solid", borderColor: "#1A2535 transparent transparent transparent" }}/>
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <p style={{ fontSize: 15, color: "#1A2535", margin: "0 0 24px", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "8px 20px", borderRadius: 8, border: "1.5px solid #E4EDF6", background: "#fff", color: "#52718F", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Ləğv et
          </button>
          <button onClick={onConfirm} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ArticlesPage() {
  const [items, setItems] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "PUBLISHED" | "DRAFT">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAuthor, setFilterAuthor] = useState<"all" | "admin" | "psychologist">("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ ids: number[]; message: string } | null>(null);
  const [bulkStatus, setBulkStatus] = useState<"idle" | "loading">("idle");

  const load = () => {
    setLoading(true);
    adminApi.getBlogPosts().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter(p => p.status === "PUBLISHED").length,
    draft: items.filter(p => p.status === "DRAFT").length,
    pending: items.filter(p => p.hasPendingDraft).length,
  }), [items]);

  const categories = useMemo(() => {
    const cats = new Set(items.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [items]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.excerpt?.toLowerCase().includes(q) ||
        p.authorName?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") list = list.filter(p => p.status === filterStatus);
    if (filterCategory !== "all") list = list.filter(p => p.category === filterCategory);
    if (filterAuthor === "psychologist") list = list.filter(p => p.authorId);
    if (filterAuthor === "admin") list = list.filter(p => !p.authorId);
    return list;
  }, [items, search, filterStatus, filterCategory, filterAuthor]);

  const hasActiveFilters = search || filterStatus !== "all" || filterCategory !== "all" || filterAuthor !== "all";

  // ── Actions ───────────────────────────────────────────────────────────────
  const copyLink = (p: BlogPost) => {
    navigator.clipboard.writeText(`${getMainSiteUrl()}/blog/${p.slug}`).then(() => {
      setCopied(p.id);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  const toggleStatus = async (p: BlogPost) => {
    setTogglingId(p.id);
    try {
      const newStatus = p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      await adminApi.updateBlogPost(p.id, { ...p, status: newStatus, content: p.content ?? "" });
      setItems(prev => prev.map(x => x.id === p.id ? { ...x, status: newStatus } : x));
    } catch {
      /* silent */
    } finally {
      setTogglingId(null);
    }
  };

  const toggleFeatured = async (p: BlogPost) => {
    try {
      await adminApi.updateBlogPost(p.id, { ...p, featured: !p.featured, content: p.content ?? "" });
      setItems(prev => prev.map(x => x.id === p.id ? { ...x, featured: !x.featured } : x));
    } catch { /* silent */ }
  };

  const deleteItems = async (ids: number[]) => {
    await Promise.all(ids.map(id => adminApi.deleteBlogPost(id)));
    setItems(prev => prev.filter(p => !ids.includes(p.id)));
    setSelected(new Set());
  };

  const askDelete = (ids: number[]) => {
    const msg = ids.length === 1
      ? "Bu məqaləni silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz."
      : `${ids.length} məqaləni silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.`;
    setConfirm({ ids, message: msg });
  };

  const bulkPublish = async (status: "PUBLISHED" | "DRAFT") => {
    if (selected.size === 0) return;
    setBulkStatus("loading");
    const ids = Array.from(selected);
    const targets = items.filter(p => ids.includes(p.id));
    await Promise.all(targets.map(p =>
      adminApi.updateBlogPost(p.id, { ...p, status, content: p.content ?? "" })
    ));
    setItems(prev => prev.map(p => ids.includes(p.id) ? { ...p, status } : p));
    setSelected(new Set());
    setBulkStatus("idle");
  };

  // ── Selection ─────────────────────────────────────────────────────────────
  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(p => p.id)));
    }
  };

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1A2535", margin: 0 }}>Məqalələr</h1>
          <p style={{ fontSize: 13, color: "#8AAABF", marginTop: 3, marginBottom: 0 }}>
            Admin və psixoloq məqalələrinin idarəsi
          </p>
        </div>
        <a
          href="/admin/blog/new"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: "linear-gradient(135deg,#002147,#5A4FC8)", color: "#fff", textDecoration: "none",
          }}
        >
          <IconPlus /> Yeni məqalə
        </a>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
        <StatCard label="Ümumi" value={stats.total} color="#1A2535" />
        <StatCard label="Yayımlandı" value={stats.published} color="#166534" />
        <StatCard label="Qaralama" value={stats.draft} color="#92400E" />
        <StatCard label="Gözlənilən" value={stats.pending} color="#5A4FC8" />
      </div>

      {/* ── Filter bar ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E4EDF6", padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <IconFilter />

        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8AAABF" }} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Axtarış — başlıq, müəllif, kateqoriya..."
            style={{ width: "100%", paddingLeft: 32, paddingRight: search ? 32 : 12, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: "1.5px solid #E4EDF6", fontSize: 13, color: "#1A2535", outline: "none", boxSizing: "border-box" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8AAABF", display: "flex", padding: 2 }}>
              <IconX />
            </button>
          )}
        </div>

        {/* Status */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E4EDF6", fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer" }}
        >
          <option value="all">Bütün statuslar</option>
          <option value="PUBLISHED">Yayımlandı</option>
          <option value="DRAFT">Qaralama</option>
        </select>

        {/* Category */}
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E4EDF6", fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer" }}
        >
          <option value="all">Bütün kateqoriyalar</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Author type */}
        <select
          value={filterAuthor}
          onChange={e => setFilterAuthor(e.target.value as typeof filterAuthor)}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E4EDF6", fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer" }}
        >
          <option value="all">Bütün müəlliflər</option>
          <option value="psychologist">Psixoloqlar</option>
          <option value="admin">Admin</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(""); setFilterStatus("all"); setFilterCategory("all"); setFilterAuthor("all"); }}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #E4EDF6", background: "#FEF2F2", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
          >
            <IconX /> Filtri sıfırla
          </button>
        )}
      </div>

      {/* ── Bulk actions bar ── */}
      {someSelected && (
        <div style={{
          background: "#1A2535", borderRadius: 10, padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
            {selected.size} məqalə seçildi
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => bulkPublish("PUBLISHED")}
            disabled={bulkStatus === "loading"}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#DCFCE7", color: "#166534", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Yayımla
          </button>
          <button
            onClick={() => bulkPublish("DRAFT")}
            disabled={bulkStatus === "loading"}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#FEF3C7", color: "#92400E", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Qaralamaya çevir
          </button>
          <button
            onClick={() => askDelete(Array.from(selected))}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#FEE2E2", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Seçilənləri sil
          </button>
          <button
            onClick={() => setSelected(new Set())}
            style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Ləğv et
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#8AAABF", padding: "80px 0", background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          Yüklənir...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#1A2535", margin: "0 0 6px" }}>
            {hasActiveFilters ? "Filter nəticəsi tapılmadı" : "Hələ məqalə yoxdur"}
          </p>
          <p style={{ fontSize: 13, color: "#8AAABF", margin: "0 0 20px" }}>
            {hasActiveFilters ? "Axtarış parametrlərini dəyişin" : "İlk məqaləni yazın"}
          </p>
          {hasActiveFilters ? (
            <button onClick={() => { setSearch(""); setFilterStatus("all"); setFilterCategory("all"); setFilterAuthor("all"); }}
              style={{ padding: "8px 18px", borderRadius: 8, border: "1.5px solid #E4EDF6", background: "#fff", color: "#002147", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Filtri sıfırla
            </button>
          ) : (
            <a href="/admin/blog/new" style={{ display: "inline-block", padding: "8px 18px", borderRadius: 8, background: "linear-gradient(135deg,#002147,#5A4FC8)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              İlk məqaləni yaz
            </a>
          )}
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6", overflow: "hidden" }}>

          {/* Table head */}
          <div style={{ display: "grid", gridTemplateColumns: "40px 52px 1fr 140px 130px 120px 100px 130px", alignItems: "center", padding: "10px 16px", borderBottom: "1.5px solid #E4EDF6", background: "#F8FAFC" }}>
            <div>
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#002147" }} />
            </div>
            <div />
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Məqalə</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Müəllif</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Kateqoriya</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tarix</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Əməliyyatlar</div>
          </div>

          {/* Rows */}
          {filtered.map((p, idx) => {
            const isSelected = selected.has(p.id);
            const isToggling = togglingId === p.id;
            const excerpt = p.excerpt || (p.content ? stripHtml(p.content).slice(0, 100) : "");

            return (
              <div
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 52px 1fr 140px 130px 120px 100px 130px",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: idx < filtered.length - 1 ? "1px solid #F1F5F9" : "none",
                  background: isSelected ? "#F0F7FF" : "#fff",
                  transition: "background 0.15s",
                }}
              >
                {/* Checkbox */}
                <div>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#002147" }} />
                </div>

                {/* Thumbnail */}
                <div>
                  {p.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverImageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
                  ) : (
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, fontSize: 20,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: p.categoryBg || "#EEF5FF",
                    }}>
                      {p.emoji || "📝"}
                    </div>
                  )}
                </div>

                {/* Title + meta */}
                <div style={{ minWidth: 0, paddingRight: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#1A2535", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                      {p.title || "Başlıqsız"}
                    </span>
                    {p.featured && (
                      <span title="Seçilmiş məqalə" style={{ color: "#F59E0B", display: "flex" }}>
                        <IconStar filled />
                      </span>
                    )}
                    {p.hasPendingDraft && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 10, background: "#EEF5FF", color: "#5A4FC8" }}>
                        Gözlənilən dəyişiklik
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#8AAABF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>
                      {excerpt || "—"}
                    </span>
                    <span style={{ fontSize: 11, color: "#C0D2E6", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {p.readTimeMinutes} dəq
                    </span>
                  </div>
                </div>

                {/* Author */}
                <div>
                  <AuthorBadge name={p.authorName} isAdmin={!p.authorId} />
                </div>

                {/* Category */}
                <div>
                  {p.category ? (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                      background: p.categoryBg || "#EEF5FF",
                      color: p.categoryColor || "#002147",
                      whiteSpace: "nowrap",
                    }}>
                      {p.emoji && `${p.emoji} `}{p.category}
                    </span>
                  ) : <span style={{ fontSize: 12, color: "#C0D2E6" }}>—</span>}
                </div>

                {/* Status toggle */}
                <div style={{ opacity: isToggling ? 0.5 : 1, transition: "opacity 0.2s" }}>
                  <StatusBadge
                    status={p.status ?? "DRAFT"}
                    onClick={isToggling ? undefined : () => toggleStatus(p)}
                  />
                </div>

                {/* Date */}
                <div>
                  <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
                    {p.publishedDate ? fmtDate(p.publishedDate) : "—"}
                  </div>
                  {p.updatedAt && (
                    <div style={{ fontSize: 10, color: "#C0D2E6", marginTop: 1 }}>
                      {fmtDateTime(p.updatedAt)}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <Tooltip text="Seçilmiş et">
                    <button
                      onClick={() => toggleFeatured(p)}
                      style={{
                        width: 30, height: 30, borderRadius: 7, border: "1px solid #E4EDF6",
                        background: p.featured ? "#FFFBEB" : "#F8FAFC",
                        color: p.featured ? "#F59E0B" : "#8AAABF",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <IconStar filled={p.featured} />
                    </button>
                  </Tooltip>

                  <Tooltip text="Məqaləyə bax">
                    <a
                      href={`${getMainSiteUrl()}/blog/${p.slug}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        width: 30, height: 30, borderRadius: 7, border: "1px solid #E4EDF6",
                        background: "#F8FAFC", color: "#52718F",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        textDecoration: "none",
                      }}
                    >
                      <IconExternal />
                    </a>
                  </Tooltip>

                  <Tooltip text={copied === p.id ? "Kopyalandı!" : "Linki kopyala"}>
                    <button
                      onClick={() => copyLink(p)}
                      style={{
                        width: 30, height: 30, borderRadius: 7, border: "1px solid #E4EDF6",
                        background: copied === p.id ? "#DCFCE7" : "#F8FAFC",
                        color: copied === p.id ? "#166534" : "#52718F",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      {copied === p.id ? <IconCheck /> : <IconLink />}
                    </button>
                  </Tooltip>

                  <Tooltip text="Redaktə et">
                    <a
                      href={`/admin/blog/${p.id}/edit`}
                      style={{
                        width: 30, height: 30, borderRadius: 7, border: "1px solid #E4EDF6",
                        background: "#EEF5FF", color: "#002147",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        textDecoration: "none",
                      }}
                    >
                      <IconEdit />
                    </a>
                  </Tooltip>

                  <Tooltip text="Sil">
                    <button
                      onClick={() => askDelete([p.id])}
                      style={{
                        width: 30, height: 30, borderRadius: 7, border: "1px solid #E4EDF6",
                        background: "#FFF1F1", color: "#DC2626",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <IconTrash />
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })}

          {/* Table footer */}
          <div style={{ padding: "10px 16px", borderTop: "1.5px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFC" }}>
            <span style={{ fontSize: 12, color: "#8AAABF" }}>
              {filtered.length} / {items.length} məqalə göstərilir
            </span>
            {someSelected && (
              <span style={{ fontSize: 12, color: "#5A4FC8", fontWeight: 600 }}>
                {selected.size} seçildi
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm modal ── */}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={async () => {
            await deleteItems(confirm.ids);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
