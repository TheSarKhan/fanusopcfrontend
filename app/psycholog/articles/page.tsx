"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { psychologistApi, type BlogPost } from "@/lib/api";
import { getMainSiteUrl } from "@/lib/auth";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

function timeAgo(d: string): string {
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "indi";
  if (min < 60) return `${min} dəq əvvəl`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} saat əvvəl`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} gün əvvəl`;
  const mo = Math.round(days / 30);
  if (mo < 12) return `${mo} ay əvvəl`;
  return `${Math.round(mo / 12)} il əvvəl`;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function estimateReadTime(content: string | undefined, fallback: number): number {
  if (!content) return fallback || 1;
  const words = stripHtml(content).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest" | "title";
type Tab = "ALL" | "PUBLISHED" | "DRAFT";

/* ─── page ────────────────────────────────────────────────────────────────── */

export default function PsychologArticlesPage() {
  const [items, setItems] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string | "ALL">("ALL");
  const [sort, setSort] = useState<SortMode>("newest");
  const [view, setView] = useState<ViewMode>("grid");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; title: string } | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const load = () => {
    setLoading(true);
    psychologistApi.listArticles().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  // "/" focuses search (Notion / GitHub / Linear convention).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          searchRef.current?.focus();
        }
      }
      if (e.key === "Escape" && openMenuId != null) setOpenMenuId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openMenuId]);

  // Click-outside closes the kebab menu.
  useEffect(() => {
    if (openMenuId == null) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-article-menu]")) setOpenMenuId(null);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [openMenuId]);

  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter(p => p.status === "PUBLISHED").length,
    draft: items.filter(p => p.status === "DRAFT").length,
  }), [items]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [items]);

  // Treat the most recently published article (with a cover image preferred)
  // as the hero. Only when no filter/search is active so we don't strand it.
  const hero = useMemo<BlogPost | null>(() => {
    if (search.trim() || tab !== "ALL" || categoryFilter !== "ALL") return null;
    const candidates = items
      .filter(p => p.status === "PUBLISHED")
      .sort((a, b) => new Date(b.publishedDate || b.createdAt || 0).getTime()
                    - new Date(a.publishedDate || a.createdAt || 0).getTime());
    return candidates.find(c => !!c.coverImageUrl) ?? candidates[0] ?? null;
  }, [items, search, tab, categoryFilter]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (hero) list = list.filter(p => p.id !== hero.id);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.excerpt?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    if (tab !== "ALL") list = list.filter(p => p.status === tab);
    if (categoryFilter !== "ALL") list = list.filter(p => p.category === categoryFilter);

    list.sort((a, b) => {
      if (sort === "title") return (a.title || "").localeCompare(b.title || "");
      const aT = new Date(a.publishedDate || a.createdAt || 0).getTime();
      const bT = new Date(b.publishedDate || b.createdAt || 0).getTime();
      return sort === "newest" ? bT - aT : aT - bT;
    });
    return list;
  }, [items, hero, search, tab, categoryFilter, sort]);

  const toggleStatus = async (p: BlogPost) => {
    setTogglingId(p.id);
    try {
      const newStatus = p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      const updated = await psychologistApi.setArticleStatus(p.id, newStatus);
      setItems(prev => prev.map(x => x.id === p.id ? updated : x));
    } catch (e) {
      alert("Status dəyişdirilə bilmədi: " + (e as Error).message);
    } finally {
      setTogglingId(null);
    }
  };

  const deleteArticle = async (id: number) => {
    await psychologistApi.deleteArticle(id);
    setItems(prev => prev.filter(p => p.id !== id));
  };

  /* ─── render ────────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--oxford)", margin: 0 }}>Məqalələrim</h1>
          <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4, marginBottom: 0 }}>
            Yazılarınızı toplayın, qaralamadan yayımlayın və paylaşın.
          </p>
        </div>
        <a href="/psycholog/articles/new" style={primaryBtnLink}>
          <IconPlus /> Yeni məqalə
        </a>
      </div>

      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <StatCell label="Ümumi"      value={stats.total}     tone="brand" />
        <StatCell label="Yayımlandı" value={stats.published} tone="good" />
        <StatCell label="Qaralama"   value={stats.draft}     tone="warn" />
      </div>

      {/* Toolbar: tabs + search + sort + view toggle */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        background: "#fff", borderRadius: 14, padding: "10px 12px",
        border: "1px solid var(--oxford-10)",
      }}>
        <div style={{ display: "flex", gap: 4 }}>
          <TabBtn active={tab === "ALL"}       count={stats.total}     onClick={() => setTab("ALL")}>Hamısı</TabBtn>
          <TabBtn active={tab === "PUBLISHED"} count={stats.published} onClick={() => setTab("PUBLISHED")}>Yayımlandı</TabBtn>
          <TabBtn active={tab === "DRAFT"}     count={stats.draft}     onClick={() => setTab("DRAFT")}>Qaralama</TabBtn>
        </div>

        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <IconSearch />
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Axtar (başlıq / kateqoriya)…"
            style={{
              width: "100%", padding: "9px 12px 9px 36px", borderRadius: 10,
              border: "1.5px solid var(--oxford-10)", fontSize: 13,
              color: "var(--oxford)", outline: "none", boxSizing: "border-box",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
            onFocus={e => (e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16,81,183,0.15)")}
            onBlur={e => (e.currentTarget.style.boxShadow = "none")} />
          <kbd style={kbdStyle}>/</kbd>
        </div>

        {categories.length > 0 && (
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            style={selectStyle}>
            <option value="ALL">Bütün kateqoriyalar</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <select value={sort} onChange={e => setSort(e.target.value as SortMode)}
          style={selectStyle}>
          <option value="newest">Ən yeni</option>
          <option value="oldest">Ən köhnə</option>
          <option value="title">Başlıq A–Z</option>
        </select>

        <div style={{ display: "flex", gap: 2, padding: 2, background: "var(--oxford-10)", borderRadius: 8 }}>
          <ViewToggleBtn active={view === "grid"} onClick={() => setView("grid")} title="Şəbəkə görünüşü">
            <IconGrid />
          </ViewToggleBtn>
          <ViewToggleBtn active={view === "list"} onClick={() => setView("list")} title="Siyahı görünüşü">
            <IconList />
          </ViewToggleBtn>
        </div>
      </div>

      {/* Hero featured */}
      {!loading && hero && (
        <HeroArticle p={hero}
          onEdit={() => window.location.assign(`/psycholog/articles/${hero.id}/edit`)}
          onView={() => window.open(`${getMainSiteUrl()}/blog/${hero.slug}`, "_blank")}
          onToggle={() => toggleStatus(hero)}
          onDelete={() => setConfirm({ id: hero.id, title: hero.title || "Başlıqsız" })}
          isToggling={togglingId === hero.id} />
      )}

      {/* Cards / list */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: view === "grid" ? "repeat(auto-fill, minmax(260px, 1fr))" : "1fr", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} mode={view} />)}
        </div>
      ) : filtered.length === 0 && !hero ? (
        // Only show the "no articles" empty state when there's truly nothing
        // to show. If the hero banner is visible, the user already sees an
        // article on the page — no need for the empty state alongside it.
        <EmptyState
          filtered={search.trim() !== "" || tab !== "ALL" || categoryFilter !== "ALL"}
          onClear={() => { setSearch(""); setTab("ALL"); setCategoryFilter("ALL"); }}
        />
      ) : filtered.length === 0 ? null : view === "grid" ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 12,
        }}>
          {filtered.map(p => (
            <GridCard key={p.id} p={p}
              onToggle={() => toggleStatus(p)}
              isToggling={togglingId === p.id}
              onDelete={() => setConfirm({ id: p.id, title: p.title || "Başlıqsız" })}
              menuOpen={openMenuId === p.id}
              onMenuToggle={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
            />
          ))}
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--oxford-10)", overflow: "hidden" }}>
          {filtered.map((p, idx) => (
            <ListRow key={p.id} p={p}
              divider={idx < filtered.length - 1}
              onToggle={() => toggleStatus(p)}
              isToggling={togglingId === p.id}
              onDelete={() => setConfirm({ id: p.id, title: p.title || "Başlıqsız" })}
            />
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          onConfirm={async () => { await deleteArticle(confirm.id); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

/* ─── Hero featured banner ────────────────────────────────────────────────── */

function HeroArticle({ p, onEdit, onView, onToggle, onDelete, isToggling }: {
  p: BlogPost;
  onEdit: () => void;
  onView: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isToggling: boolean;
}) {
  const published = p.status === "PUBLISHED";
  const readTime = estimateReadTime(p.content, p.readTimeMinutes);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: p.coverImageUrl ? "minmax(0, 1.1fr) minmax(0, 1fr)" : "1fr",
      gap: 0,
      borderRadius: 18, overflow: "hidden",
      background: "linear-gradient(135deg, var(--brand-700) 0%, var(--brand) 70%)",
      boxShadow: "0 8px 30px rgba(16, 81, 183, 0.18)",
      minHeight: 200,
      position: "relative",
    }}>
      {p.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.coverImageUrl} alt={p.title}
          style={{ width: "100%", height: "100%", objectFit: "cover", minHeight: 200, maxHeight: 280 }} />
      )}
      <div style={{
        padding: "22px 26px", color: "#fff",
        display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14,
      }}>
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 10px", borderRadius: 999,
            background: "rgba(255,255,255,0.18)", color: "#fff",
            fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
            marginBottom: 10,
          }}>
            <IconSparkle /> Ən son
            {p.category && <span style={{ opacity: 0.8 }}>· {p.category}</span>}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.25, color: "#fff" }}>
            {p.title || "Başlıqsız"}
          </h2>
          {p.excerpt && (
            <p style={{
              fontSize: 13.5, color: "rgba(255,255,255,0.85)", margin: "8px 0 0",
              lineHeight: 1.55, display: "-webkit-box",
              WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>{p.excerpt}</p>
          )}
        </div>

        <div>
          <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "rgba(255,255,255,0.85)", marginBottom: 12, flexWrap: "wrap" }}>
            <span>{p.publishedDate ? fmtDate(p.publishedDate) : (p.createdAt ? timeAgo(p.createdAt) : "—")}</span>
            <span>· {readTime} dəq oxunma</span>
            <span style={{
              padding: "1px 8px", borderRadius: 999,
              background: published ? "rgba(16, 185, 129, 0.25)" : "rgba(251, 191, 36, 0.25)",
              color: published ? "#A7F3D0" : "#FDE68A",
              fontWeight: 700,
            }}>{published ? "Yayımlandı" : "Qaralama"}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={onEdit} style={heroBtn(true)}>
              <IconEdit /> Redaktə et
            </button>
            {published && p.slug && (
              <button onClick={onView} style={heroBtn(false)}>
                <IconExternal /> Bax
              </button>
            )}
            <button onClick={onToggle} disabled={isToggling} style={heroBtn(false)}>
              {published ? "Qaralamaya keçir" : "Yayımla"}
            </button>
            <button onClick={onDelete} style={heroBtnDanger}>
              <IconTrash /> Sil
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Grid card ───────────────────────────────────────────────────────────── */

function GridCard({ p, onToggle, isToggling, onDelete, menuOpen, onMenuToggle }: {
  p: BlogPost;
  onToggle: () => void;
  isToggling: boolean;
  onDelete: () => void;
  menuOpen: boolean;
  onMenuToggle: () => void;
}) {
  const published = p.status === "PUBLISHED";
  const readTime = estimateReadTime(p.content, p.readTimeMinutes);
  const excerpt = p.excerpt || (p.content ? stripHtml(p.content).slice(0, 140) : "");

  return (
    <div style={{
      position: "relative",
      // No overflow:hidden on the card itself — would clip the open kebab
      // dropdown and the menu items would visually fall behind sibling cards.
      // The cover image is clipped by its own container below.
      background: "#fff", borderRadius: 14,
      border: "1px solid var(--oxford-10)",
      display: "flex", flexDirection: "column",
      transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
      // The card needs to participate in a stacking context so its open
      // dropdown floats above neighbouring cards. We bump z-index only when
      // the menu is actually open (avoids permanent stacking weirdness).
      zIndex: menuOpen ? 20 : "auto",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 12px 30px rgba(15, 23, 42, 0.10)";
        e.currentTarget.style.borderColor = "var(--brand-200)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--oxford-10)";
      }}>
      {/* Cover — overflow:hidden so the image clips inside its rounded top
          corners. Status pill + pending-draft pill stay inside because they
          don't need to overflow. */}
      <div style={{
        position: "relative", height: 130,
        background: p.coverImageUrl ? "transparent" : (p.categoryBg || "var(--brand-50)"),
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        borderRadius: "14px 14px 0 0",
      }}>
        {p.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverImageUrl} alt={p.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{
            fontSize: 40, fontWeight: 800, color: p.categoryColor || "var(--brand-700)",
            fontFamily: "var(--serif, serif)", opacity: 0.5,
          }}>{p.title?.[0]?.toUpperCase() || "A"}</span>
        )}
        {/* Status pill overlay */}
        <div style={{ position: "absolute", top: 8, left: 8 }}>
          <span style={{
            padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 700,
            background: published ? "rgba(16, 185, 129, 0.92)" : "rgba(251, 191, 36, 0.92)",
            color: "#fff", backdropFilter: "blur(4px)",
          }}>{published ? "Yayımlandı" : "Qaralama"}</span>
        </div>
        {p.hasPendingDraft && (
          <div style={{
            position: "absolute", bottom: 8, right: 8,
            padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
            background: "rgba(255,255,255,0.92)", color: "var(--brand-700)",
          }}>Gözlənilən dəyişiklik</div>
        )}
      </div>

      {/* Kebab — lives outside the overflow:hidden cover so the open dropdown
          can extend past the cover into the body / past the card border. */}
      <div data-article-menu style={{ position: "absolute", top: 8, right: 8, zIndex: 25 }}>
        <button onClick={onMenuToggle} style={{
          width: 30, height: 30, borderRadius: 8,
          background: "rgba(255,255,255,0.92)", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", backdropFilter: "blur(4px)",
          color: "var(--oxford)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
        }} title="Daha çox">
          <IconKebab />
        </button>
        {menuOpen && (
          <KebabMenu
            p={p}
            onToggle={onToggle}
            isToggling={isToggling}
            onDelete={onDelete}
            onClose={onMenuToggle}
          />
        )}
      </div>

      {/* Body */}
      <a href={`/psycholog/articles/${p.id}/edit`}
        style={{
          padding: "12px 14px 14px", textDecoration: "none", color: "inherit",
          display: "flex", flexDirection: "column", gap: 6, flex: 1,
        }}>
        {p.category && (
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: p.categoryBg || "var(--brand-50)", color: p.categoryColor || "var(--brand-700)",
            alignSelf: "flex-start", textTransform: "uppercase", letterSpacing: 0.3,
          }}>{p.category}</span>
        )}
        <h3 style={{
          fontSize: 14.5, fontWeight: 700, color: "var(--oxford)",
          margin: 0, lineHeight: 1.3, display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>{p.title || "Başlıqsız"}</h3>
        {excerpt && (
          <p style={{
            fontSize: 12.5, color: "var(--oxford-60)", margin: 0, lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>{excerpt}</p>
        )}
        <div style={{
          marginTop: "auto", paddingTop: 8,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 11, color: "var(--oxford-60)",
        }}>
          <span>{p.publishedDate ? fmtDate(p.publishedDate) : (p.createdAt ? timeAgo(p.createdAt) : "")}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <IconClock /> {readTime} dəq
          </span>
        </div>
      </a>
    </div>
  );
}

/* ─── List row (compact view) ─────────────────────────────────────────────── */

function ListRow({ p, divider, onToggle, isToggling, onDelete }: {
  p: BlogPost;
  divider: boolean;
  onToggle: () => void;
  isToggling: boolean;
  onDelete: () => void;
}) {
  const published = p.status === "PUBLISHED";
  const readTime = estimateReadTime(p.content, p.readTimeMinutes);
  const excerpt = p.excerpt || (p.content ? stripHtml(p.content).slice(0, 120) : "");
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "60px minmax(0, 1fr) auto auto",
      alignItems: "center", gap: 14,
      padding: "14px 16px",
      borderBottom: divider ? "1px solid var(--oxford-10)" : "none",
      transition: "background 0.1s",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--brand-50)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <div>
        {p.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverImageUrl} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover" }} />
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: p.categoryBg || "var(--brand-50)",
            color: p.categoryColor || "var(--brand-700)",
            fontSize: 22, fontWeight: 800, fontFamily: "var(--serif, serif)",
          }}>{p.title?.[0]?.toUpperCase() || "A"}</div>
        )}
      </div>
      <a href={`/psycholog/articles/${p.id}/edit`}
        style={{ minWidth: 0, textDecoration: "none", color: "inherit" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--oxford)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 380 }}>
            {p.title || "Başlıqsız"}
          </span>
          {p.category && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: "1px 8px", borderRadius: 999,
              background: p.categoryBg || "var(--brand-50)", color: p.categoryColor || "var(--brand-700)",
            }}>{p.category}</span>
          )}
          {p.hasPendingDraft && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
              background: "var(--brand-50)", color: "var(--brand-700)",
            }}>Gözlənilən dəyişiklik</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11.5, color: "var(--oxford-60)" }}>
          {excerpt && (
            <span style={{
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 380,
            }}>{excerpt}</span>
          )}
          <span style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }}>
            <IconClock /> {readTime} dəq
          </span>
          {p.publishedDate && (
            <span style={{ whiteSpace: "nowrap", color: "var(--oxford-60)" }}>{fmtDate(p.publishedDate)}</span>
          )}
        </div>
      </a>
      <button onClick={onToggle} disabled={isToggling}
        style={{
          fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 999, border: "none",
          background: published ? "#D1FAE5" : "#FEF3C7",
          color: published ? "#065F46" : "#92400E",
          cursor: isToggling ? "wait" : "pointer", opacity: isToggling ? 0.6 : 1,
          whiteSpace: "nowrap",
        }}>
        {published ? "Yayımlandı" : "Qaralama"}
      </button>
      <div style={{ display: "flex", gap: 4 }}>
        {p.status === "PUBLISHED" && p.slug && (
          <a href={`${getMainSiteUrl()}/blog/${p.slug}`} target="_blank" rel="noopener noreferrer"
            title="Bax" style={iconActionStyle("#52718F", "var(--oxford-10)")}>
            <IconExternal />
          </a>
        )}
        <a href={`/psycholog/articles/${p.id}/edit`} title="Redaktə et"
          style={iconActionStyle("var(--brand-700)", "var(--brand-50)")}>
          <IconEdit />
        </a>
        <button onClick={onDelete} title="Sil"
          style={{ ...iconActionStyle("#DC2626", "#FEE2E2"), border: "none", cursor: "pointer" }}>
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

/* ─── Kebab menu ──────────────────────────────────────────────────────────── */

function KebabMenu({ p, onToggle, isToggling, onDelete, onClose }: {
  p: BlogPost;
  onToggle: () => void;
  isToggling: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  const published = p.status === "PUBLISHED";
  return (
    <div style={{
      position: "absolute", top: 36, right: 0,
      background: "#fff", borderRadius: 10,
      boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
      border: "1px solid var(--oxford-10)",
      overflow: "hidden", zIndex: 30, minWidth: 180,
    }}>
      <MenuItem onClick={() => { onClose(); window.location.assign(`/psycholog/articles/${p.id}/edit`); }}>
        <IconEdit /> Redaktə et
      </MenuItem>
      {published && p.slug && (
        <MenuItem onClick={() => { onClose(); window.open(`${getMainSiteUrl()}/blog/${p.slug}`, "_blank"); }}>
          <IconExternal /> Yayımlanmışa bax
        </MenuItem>
      )}
      <MenuItem onClick={() => { onClose(); onToggle(); }} disabled={isToggling}>
        {published ? <><IconDraft /> Qaralamaya keçir</> : <><IconPublish /> Yayımla</>}
      </MenuItem>
      <div style={{ height: 1, background: "var(--oxford-10)" }} />
      <MenuItem danger onClick={() => { onClose(); onDelete(); }}>
        <IconTrash /> Sil
      </MenuItem>
    </div>
  );
}

function MenuItem({ children, onClick, danger, disabled }: {
  children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", padding: "9px 14px",
        background: "transparent", border: "none",
        color: danger ? "#991B1B" : "var(--oxford)",
        fontSize: 12.5, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", textAlign: "left",
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.background = danger ? "#FEE2E2" : "var(--brand-50)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      {children}
    </button>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div style={{
      textAlign: "center", padding: "56px 24px",
      background: "#fff", borderRadius: 16, border: "1px dashed var(--oxford-10)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "var(--brand-50)", color: "var(--brand-700)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginBottom: 14,
      }}>
        <IconBook />
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", margin: "0 0 4px" }}>
        {filtered ? "Filtrlərə uyğun məqalə yoxdur" : "Hələ məqalə yoxdur"}
      </p>
      <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: "0 0 18px" }}>
        {filtered
          ? "Axtarışı və ya filtrləri sıfırlamaq üçün aşağıdakı düyməyə basın."
          : "Pasiyentlərə paylaşmaq və biliklərinizi yaymaq üçün ilk məqaləni yazın."}
      </p>
      {filtered ? (
        <button onClick={onClear} style={ghostBtn}>Filtri təmizlə</button>
      ) : (
        <a href="/psycholog/articles/new" style={primaryBtnLink}><IconPlus /> İlk məqaləni yaz</a>
      )}
    </div>
  );
}

/* ─── Skeleton ────────────────────────────────────────────────────────────── */

function SkeletonCard({ mode }: { mode: ViewMode }) {
  if (mode === "list") {
    return (
      <div style={{
        background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 14,
        padding: 14, display: "flex", gap: 14, alignItems: "center",
      }}>
        <div style={{ width: 52, height: 52, borderRadius: 10, background: "var(--oxford-10)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: "60%", height: 14, background: "var(--oxford-10)", borderRadius: 4, marginBottom: 8 }} />
          <div style={{ width: "80%", height: 10, background: "var(--brand-50)", borderRadius: 4 }} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ height: 130, background: "var(--oxford-10)" }} />
      <div style={{ padding: 14 }}>
        <div style={{ width: "40%", height: 10, background: "var(--brand-50)", borderRadius: 4, marginBottom: 8 }} />
        <div style={{ width: "85%", height: 14, background: "var(--oxford-10)", borderRadius: 4, marginBottom: 8 }} />
        <div style={{ width: "60%", height: 10, background: "var(--brand-50)", borderRadius: 4 }} />
      </div>
    </div>
  );
}

/* ─── Confirm modal ───────────────────────────────────────────────────────── */

function ConfirmModal({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(10, 22, 51, 0.55)", backdropFilter: "blur(4px)",
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, padding: "26px 28px",
        maxWidth: 420, width: "100%", boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "#FEE2E2", color: "#DC2626",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 14,
        }}>
          <IconTrash />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)", margin: 0, marginBottom: 6 }}>
          Məqaləni sil
        </h3>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", lineHeight: 1.55, margin: 0, marginBottom: 20 }}>
          <b>"{title}"</b> silinəcək. Bu əməliyyat geri qaytarıla bilməz.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid var(--oxford-10)",
            background: "#fff", color: "var(--oxford)", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Ləğv et</button>
          <button onClick={onConfirm} style={{
            padding: "8px 20px", borderRadius: 8, border: "none",
            background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>Sil</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Small UI atoms ──────────────────────────────────────────────────────── */

function StatCell({ label, value, tone }: { label: string; value: number; tone: "brand" | "good" | "warn" }) {
  const palette: Record<typeof tone, { color: string }> = {
    brand: { color: "var(--brand-700)" },
    good:  { color: "#065F46" },
    warn:  { color: "#92400E" },
  };
  const p = palette[tone];
  return (
    <div style={{
      background: "#fff", borderRadius: 10, padding: "12px 16px",
      border: "1px solid var(--oxford-10)",
      borderLeft: `3px solid ${p.color}`,
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--oxford)", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function TabBtn({ active, count, onClick, children }: {
  active: boolean; count: number; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px", borderRadius: 8,
      border: "none",
      background: active ? "var(--brand)" : "transparent",
      color: active ? "#fff" : "var(--oxford-60)",
      fontSize: 12.5, fontWeight: 600,
      cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      transition: "background 0.15s",
    }}>
      {children}
      <span style={{
        fontSize: 10.5, fontWeight: 700,
        padding: "0 6px", borderRadius: 999,
        background: active ? "rgba(255,255,255,0.25)" : "var(--oxford-10)",
        color: active ? "#fff" : "var(--oxford-60)",
        minWidth: 16, textAlign: "center",
      }}>{count}</span>
    </button>
  );
}

function ViewToggleBtn({ active, onClick, title, children }: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 30, height: 30, borderRadius: 6, border: "none",
      background: active ? "#fff" : "transparent",
      color: active ? "var(--brand-700)" : "var(--oxford-60)",
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer",
      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
    }}>{children}</button>
  );
}

function heroBtn(primary: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700,
    border: "none", cursor: "pointer",
    background: primary ? "#fff" : "rgba(255,255,255,0.18)",
    color: primary ? "var(--brand-700)" : "#fff",
    backdropFilter: primary ? "none" : "blur(4px)",
  };
}

const heroBtnDanger: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700,
  border: "1px solid rgba(255, 200, 200, 0.4)",
  background: "rgba(220, 38, 38, 0.18)",
  color: "#FECACA", backdropFilter: "blur(4px)",
  cursor: "pointer",
};

function iconActionStyle(color: string, bg: string): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 7,
    background: bg, color,
    display: "flex", alignItems: "center", justifyContent: "center",
    textDecoration: "none", border: "1px solid transparent",
  };
}

const primaryBtnLink: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
  background: "var(--brand)", color: "#fff", textDecoration: "none",
  boxShadow: "0 4px 14px rgba(16,81,183,0.25)",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
  background: "#fff", color: "var(--oxford)",
  border: "1px solid var(--oxford-10)", cursor: "pointer",
};

const selectStyle: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 8, border: "1.5px solid var(--oxford-10)",
  fontSize: 12.5, color: "var(--oxford)", background: "#fff", cursor: "pointer",
};

const kbdStyle: React.CSSProperties = {
  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
  padding: "1px 6px", background: "var(--oxford-10)", color: "var(--oxford-60)",
  borderRadius: 4, fontSize: 10, fontFamily: "ui-monospace, monospace",
  fontWeight: 600, pointerEvents: "none",
};

/* ─── Inline SVG icons ────────────────────────────────────────────────────── */

const sw = {
  fill: "none", stroke: "currentColor", strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const, viewBox: "0 0 24 24",
};

const IconPlus = () => (
  <svg width="14" height="14" strokeWidth="2.5" {...sw}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" strokeWidth="1.8" {...sw}>
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" strokeWidth="1.8" {...sw}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
  </svg>
);
const IconExternal = () => (
  <svg width="14" height="14" strokeWidth="1.8" {...sw}>
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const IconSearch = () => (
  <svg width="16" height="16" strokeWidth="2" {...sw}
    style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--oxford-60)" }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const IconClock = () => (
  <svg width="11" height="11" strokeWidth="2" {...sw}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconGrid = () => (
  <svg width="14" height="14" strokeWidth="2" {...sw}>
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);
const IconList = () => (
  <svg width="14" height="14" strokeWidth="2" {...sw}>
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconKebab = () => (
  <svg width="14" height="14" strokeWidth="2" {...sw}>
    <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
  </svg>
);
const IconBook = () => (
  <svg width="28" height="28" strokeWidth="1.8" {...sw}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const IconSparkle = () => (
  <svg width="11" height="11" strokeWidth="2" {...sw}>
    <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
  </svg>
);
const IconPublish = () => (
  <svg width="14" height="14" strokeWidth="1.8" {...sw}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const IconDraft = () => (
  <svg width="14" height="14" strokeWidth="1.8" {...sw}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);
