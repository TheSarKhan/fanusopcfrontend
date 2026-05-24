"use client";

import { useEffect, useMemo, useState } from "react";
import { psychologistApi, type BlogPost } from "@/lib/api";
import { getMainSiteUrl } from "@/lib/auth";

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim();
}

const IconPlus = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconEdit = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconTrash = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
  </svg>
);
const IconExternal = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E4EDF6", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status, onClick, disabled }: { status: string; onClick?: () => void; disabled?: boolean }) {
  const published = status === "PUBLISHED";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={onClick ? (published ? "Qaralamaya keçir" : "Yayımla") : undefined}
      style={{
        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, border: "none",
        background: published ? "#DCFCE7" : "#FEF3C7",
        color: published ? "#166534" : "#92400E",
        cursor: onClick && !disabled ? "pointer" : "default",
        whiteSpace: "nowrap",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {published ? "Yayımlandı" : "Qaralama"}
    </button>
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

export default function PsychologArticlesPage() {
  const [items, setItems] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "PUBLISHED" | "DRAFT">("all");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ id: number } | null>(null);

  const load = () => {
    setLoading(true);
    psychologistApi.listArticles().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter(p => p.status === "PUBLISHED").length,
    draft: items.filter(p => p.status === "DRAFT").length,
  }), [items]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.excerpt?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") list = list.filter(p => p.status === filterStatus);
    return list;
  }, [items, search, filterStatus]);

  const toggleStatus = async (p: BlogPost) => {
    setTogglingId(p.id);
    try {
      const newStatus = p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      await psychologistApi.updateArticle(p.id, { ...p, status: newStatus, content: p.content ?? "" });
      setItems(prev => prev.map(x => x.id === p.id ? { ...x, status: newStatus } : x));
    } finally {
      setTogglingId(null);
    }
  };

  const deleteArticle = async (id: number) => {
    await psychologistApi.deleteArticle(id);
    setItems(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1A2535", margin: 0 }}>Məqalələrim</h1>
          <p style={{ fontSize: 13, color: "#8AAABF", marginTop: 3, marginBottom: 0 }}>
            Yazdığınız məqalələri idarə edin, qaralamadan yayımlayın
          </p>
        </div>
        <a
          href="/psycholog/articles/new"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: "var(--brand)", color: "#fff", textDecoration: "none",
          }}
        >
          <IconPlus /> Yeni məqalə
        </a>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
        <StatCard label="Ümumi" value={stats.total} color="#1A2535" />
        <StatCard label="Yayımlandı" value={stats.published} color="#166534" />
        <StatCard label="Qaralama" value={stats.draft} color="#92400E" />
      </div>

      {/* Filter bar */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E4EDF6", padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Başlıq və ya kateqoriyaya görə axtarış…"
          style={{ flex: "1 1 240px", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E4EDF6", fontSize: 13, color: "#1A2535", outline: "none" }}
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E4EDF6", fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer" }}
        >
          <option value="all">Bütün statuslar</option>
          <option value="PUBLISHED">Yayımlandı</option>
          <option value="DRAFT">Qaralama</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#8AAABF", padding: "60px 0", background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6" }}>
          Yüklənir…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#1A2535", margin: "0 0 6px" }}>
            {search || filterStatus !== "all" ? "Filter nəticəsi tapılmadı" : "Hələ məqalə yoxdur"}
          </p>
          <p style={{ fontSize: 13, color: "#8AAABF", margin: "0 0 20px" }}>
            {search || filterStatus !== "all" ? "Axtarış parametrlərini dəyişin" : "İlk məqalənizi yazın"}
          </p>
          {!search && filterStatus === "all" && (
            <a href="/psycholog/articles/new" style={{ display: "inline-block", padding: "8px 18px", borderRadius: 8, background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              İlk məqaləni yaz
            </a>
          )}
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6", overflow: "hidden" }}>
          {filtered.map((p, idx) => {
            const excerpt = p.excerpt || (p.content ? stripHtml(p.content).slice(0, 120) : "");
            const isToggling = togglingId === p.id;
            return (
              <div
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "52px 1fr auto auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderBottom: idx < filtered.length - 1 ? "1px solid #F1F5F9" : "none",
                }}
              >
                {/* Thumb */}
                <div>
                  {p.coverImageUrl ? (
                    <img src={p.coverImageUrl} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                  ) : (
                    <div style={{
                      width: 44, height: 44, borderRadius: 8, fontSize: 22,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: p.categoryBg || "#EEF5FF",
                    }}>
                      {p.emoji || "📝"}
                    </div>
                  )}
                </div>

                {/* Title + meta */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#1A2535", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 360 }}>
                      {p.title || "Başlıqsız"}
                    </span>
                    {p.category && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                        background: p.categoryBg || "#EEF5FF", color: p.categoryColor || "#002147",
                      }}>
                        {p.category}
                      </span>
                    )}
                    {p.hasPendingDraft && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 10, background: "#EEF5FF", color: "var(--brand)" }}>
                        Gözlənilən dəyişiklik
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#8AAABF" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>
                      {excerpt || "—"}
                    </span>
                    {p.publishedDate && <span style={{ whiteSpace: "nowrap", color: "#C0D2E6" }}>{fmtDate(p.publishedDate)}</span>}
                  </div>
                </div>

                {/* Status */}
                <StatusBadge status={p.status ?? "DRAFT"} onClick={() => toggleStatus(p)} disabled={isToggling} />

                {/* Actions */}
                <div style={{ display: "flex", gap: 4 }}>
                  {p.status === "PUBLISHED" && p.slug && (
                    <a
                      href={`${getMainSiteUrl()}/blog/${p.slug}`}
                      target="_blank" rel="noopener noreferrer"
                      title="Yayımlanmış məqaləyə bax"
                      style={{
                        width: 30, height: 30, borderRadius: 7, border: "1px solid #E4EDF6",
                        background: "#F8FAFC", color: "#52718F",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        textDecoration: "none",
                      }}
                    >
                      <IconExternal />
                    </a>
                  )}
                  <a
                    href={`/psycholog/articles/${p.id}/edit`}
                    title="Redaktə et"
                    style={{
                      width: 30, height: 30, borderRadius: 7, border: "1px solid #E4EDF6",
                      background: "#EEF5FF", color: "#002147",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      textDecoration: "none",
                    }}
                  >
                    <IconEdit />
                  </a>
                  <button
                    onClick={() => setConfirm({ id: p.id })}
                    title="Sil"
                    style={{
                      width: 30, height: 30, borderRadius: 7, border: "1px solid #E4EDF6",
                      background: "#FFF1F1", color: "#DC2626",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          message="Bu məqaləni silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz."
          onConfirm={async () => {
            await deleteArticle(confirm.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
