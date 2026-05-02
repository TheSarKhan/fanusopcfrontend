"use client";

import { useEffect, useState } from "react";
import { adminApi, type BlogPost } from "@/lib/api";
import { getMainSiteUrl } from "@/lib/auth";

type ViewMode = "list" | "card";

function StatusBadge({ status }: { status: string }) {
  const published = status === "PUBLISHED";
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
      background: published ? "#DCFCE7" : "#FEF3C7",
      color: published ? "#166534" : "#92400E",
    }}>
      {published ? "Yayımlandı" : "Qaralama"}
    </span>
  );
}

function formatDate(d: string) {
  const dt = new Date(d);
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${dt.getFullYear()}`;
}

export default function ArticlesListPage() {
  const [items, setItems] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("list");
  const [copied, setCopied] = useState<number | null>(null);

  const copyLink = (p: BlogPost) => {
    const url = `${getMainSiteUrl()}/blog/${p.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(p.id);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  const load = () => {
    setLoading(true);
    adminApi.getBlogPosts().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Bu məqaləni silmək istədiyinizə əminsiniz?")) return;
    try {
      await adminApi.deleteBlogPost(id);
      load();
    } catch (e) { alert(e instanceof Error ? e.message : "Xəta"); }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1A2535", margin: 0 }}>Məqalələr</h1>
          <p style={{ fontSize: 13, color: "#52718F", marginTop: 2 }}>{items.length} məqalə</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* View toggle */}
          <div style={{ display: "flex", border: "1.5px solid #C0D2E6", borderRadius: 8, overflow: "hidden" }}>
            <button
              onClick={() => setView("list")}
              title="Siyahı görünüşü"
              style={{ padding: "7px 11px", border: "none", cursor: "pointer", background: view === "list" ? "#E8F0FE" : "#fff", color: view === "list" ? "#002147" : "#8AAABF", display: "flex", alignItems: "center" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <button
              onClick={() => setView("card")}
              title="Kart görünüşü"
              style={{ padding: "7px 11px", border: "none", cursor: "pointer", background: view === "card" ? "#E8F0FE" : "#fff", color: view === "card" ? "#002147" : "#8AAABF", display: "flex", alignItems: "center", borderLeft: "1.5px solid #C0D2E6" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>
          </div>
          {/* New article */}
          <a
            href="/admin/blog/new"
            style={{
              padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: "linear-gradient(135deg, #002147, #5A4FC8)", color: "#fff",
              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Yeni məqalə
          </a>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#52718F", padding: "60px 0" }}>Yüklənir...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6", color: "#8AAABF" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#1A2535", marginBottom: 8 }}>Hələ məqalə yoxdur</p>
          <a href="/admin/blog/new" style={{ fontSize: 13, color: "#002147", fontWeight: 600 }}>İlk məqaləni yaz →</a>
        </div>
      ) : view === "list" ? (
        /* ── LIST VIEW ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {items.map(p => (
            <div
              key={p.id}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                background: "#fff", borderRadius: 12, border: "1px solid #E4EDF6",
              }}
            >
              {/* Thumbnail */}
              {p.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverImageUrl} alt=""
                  style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 52, height: 52, borderRadius: 8, flexShrink: 0, fontSize: 22,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: p.categoryBg || "#E8F0FE",
                }}>
                  {p.emoji || "📝"}
                </div>
              )}

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#1A2535", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 }}>
                    {p.title || "Başlıqsız"}
                  </span>
                  <StatusBadge status={p.status ?? "DRAFT"} />
                  {p.featured && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "#FFF3EC", color: "#D97706" }}>Öne çıxan</span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "#8AAABF" }}>
                  {p.category || "—"} · {p.readTimeMinutes} dəq · {formatDate(p.publishedDate)}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <a href={`${getMainSiteUrl()}/blog/${p.slug}`} target="_blank" rel="noopener noreferrer"
                  title="Məqaləyə bax"
                  style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#F0FDF4", color: "#166534", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
                <button onClick={() => copyLink(p)} title="Linki kopyala"
                  style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: copied === p.id ? "#DCFCE7" : "#F8FAFC", color: copied === p.id ? "#166534" : "#52718F", border: "1px solid #E4EDF6", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                  {copied === p.id ? (
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                  )}
                </button>
                <a href={`/admin/blog/${p.id}/edit`}
                  style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#EEF5FF", color: "#002147", textDecoration: "none" }}>
                  Redaktə
                </a>
                <button onClick={() => handleDelete(p.id)}
                  style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fee2e2", color: "#dc2626", border: "none", cursor: "pointer" }}>
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── CARD VIEW ── */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {items.map(p => (
            <div
              key={p.id}
              style={{ background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6", overflow: "hidden" }}
            >
              {/* Cover */}
              {p.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverImageUrl} alt=""
                  style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{
                  width: "100%", height: 160, background: p.categoryBg || "#EEF5FF",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40,
                }}>
                  {p.emoji || "📝"}
                </div>
              )}
              {/* Body */}
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  <StatusBadge status={p.status ?? "DRAFT"} />
                  {p.category && (
                    <span style={{ fontSize: 11, color: "#8AAABF" }}>{p.category}</span>
                  )}
                </div>
                <p style={{ fontWeight: 700, fontSize: 14, color: "#1A2535", marginBottom: 8, lineHeight: 1.4 }}>
                  {p.title || "Başlıqsız"}
                </p>
                <p style={{ fontSize: 12, color: "#8AAABF", marginBottom: 14 }}>
                  {p.readTimeMinutes} dəq · {formatDate(p.publishedDate)}
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <a href={`${getMainSiteUrl()}/blog/${p.slug}`} target="_blank" rel="noopener noreferrer"
                    style={{ padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#F0FDF4", color: "#166534", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                  <button onClick={() => copyLink(p)} title="Linki kopyala"
                    style={{ padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: copied === p.id ? "#DCFCE7" : "#F8FAFC", color: copied === p.id ? "#166534" : "#52718F", border: "1px solid #E4EDF6", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                    {copied === p.id ? (
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                    )}
                  </button>
                  <a href={`/admin/blog/${p.id}/edit`}
                    style={{ flex: 1, padding: "7px 0", textAlign: "center", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#EEF5FF", color: "#002147", textDecoration: "none" }}>
                    Redaktə
                  </a>
                  <button onClick={() => handleDelete(p.id)}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fee2e2", color: "#dc2626", border: "none", cursor: "pointer" }}>
                    Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
