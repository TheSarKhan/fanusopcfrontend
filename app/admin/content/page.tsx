"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi, type BlogPost } from "@/lib/api";
import { IconSearch, IconPlus, IconDownload } from "../_components/icons";

type Tab = "articles" | "home" | "categories" | "media";
type StatusFilter = "all" | "published" | "draft" | "archived";

const EMPTY_POST: Omit<BlogPost, "id"> = {
  category: "Mental sağlamlıq",
  categoryColor: "#002147",
  categoryBg: "#eef1f7",
  title: "",
  excerpt: "",
  readTimeMinutes: 5,
  publishedDate: new Date().toISOString().split("T")[0],
  emoji: "📝",
  slug: "",
  featured: false,
  active: true,
};

const AV_COLORS = ["#7c6f99", "#7c9a86", "#b58a3c", "#2f5283", "#0a2d59"];

function avatarColor(s: string) {
  const h = Array.from(s).reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return AV_COLORS[h % AV_COLORS.length];
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ə/g, "e").replace(/ş/g, "s").replace(/ç/g, "c")
    .replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function statusOf(p: BlogPost): "published" | "draft" | "archived" {
  if (!p.active) return "archived";
  if (!p.publishedDate || new Date(p.publishedDate) > new Date()) return "draft";
  return "published";
}

export default function ContentPage() {
  const [tab, setTab] = useState<Tab>("articles");
  const [items, setItems] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [modal, setModal] = useState<{ open: boolean; item: Omit<BlogPost, "id">; id?: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.getBlogPosts().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { all: items.length, published: 0, draft: 0, archived: 0, views: 0 };
    items.forEach((p) => { c[statusOf(p)] += 1; });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (filter !== "all" && statusOf(p) !== filter) return false;
      if (q && !`${p.title} ${p.category} ${p.slug}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, filter]);

  const openCreate = () => setModal({ open: true, item: { ...EMPTY_POST } });
  const openEdit = (p: BlogPost) => setModal({ open: true, item: { ...p }, id: p.id });
  const close = () => setModal(null);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      const data = {
        ...modal.item,
        slug: modal.item.slug || slugify(modal.item.title || "post"),
      };
      if (modal.id) await adminApi.updateBlogPost(modal.id, data);
      else await adminApi.createBlogPost(data);
      close();
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Silmək istədiyinizə əminsiniz?")) return;
    try {
      await adminApi.deleteBlogPost(id);
      load();
    } catch (e) { alert((e as Error).message); }
  };

  const toggleActive = async (p: BlogPost) => {
    try {
      await adminApi.updateBlogPost(p.id, { ...p, active: !p.active });
      load();
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Kontent idarəsi</h1>
          <p className="page-sub">Məqalələri, ana səhifə bloklarını və bütün dərc olunan kontenti idarə edin.</p>
        </div>
        <div className="page-actions">
          <button className="btn">
            <IconDownload size={14} />
            İxrac
          </button>
          <button className="btn primary" onClick={openCreate}>
            <IconPlus size={14} style={{ stroke: "#fff" } as React.CSSProperties} />
            Yeni məqalə
          </button>
        </div>
      </div>

      <div className="tabs">
        {([
          { k: "articles", l: `Məqalələr (${counts.all})` },
          { k: "home", l: "Ana səhifə blokları" },
          { k: "categories", l: "Kateqoriyalar" },
          { k: "media", l: "Media kitabxanası" },
        ] as const).map((t) => (
          <button key={t.k} className={`tab${tab === t.k ? " active" : ""}`} onClick={() => setTab(t.k)}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === "articles" && (
        <>
          <div className="stats-grid col-4">
            <div className="stat">
              <div className="stat-label">Dərc edilmiş</div>
              <div className="stat-value">{counts.published}</div>
              <div className="stat-meta"><span className="delta up">↑</span><span>aktiv</span></div>
            </div>
            <div className="stat">
              <div className="stat-label">Draft</div>
              <div className="stat-value">{counts.draft}</div>
              <div className="stat-meta"><span className="delta flat">—</span><span>baxış gözləyir</span></div>
            </div>
            <div className="stat">
              <div className="stat-label">Arxiv</div>
              <div className="stat-value">{counts.archived}</div>
              <div className="stat-meta"><span className="delta flat">—</span><span>passiv</span></div>
            </div>
            <div className="stat">
              <div className="stat-label">Ümumi qeyd</div>
              <div className="stat-value">{counts.all}</div>
              <div className="stat-meta"><span className="delta up">↑</span><span>bu ay</span></div>
            </div>
          </div>

          <div className="table-wrap mt-16">
            <div className="toolbar">
              <div className="search">
                <IconSearch size={13} style={{ color: "var(--muted)" }} />
                <input placeholder="Başlıq, kateqoriya, slug..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {([
                { k: "all", l: `Hamısı (${counts.all})` },
                { k: "published", l: `Dərc (${counts.published})` },
                { k: "draft", l: `Draft (${counts.draft})` },
                { k: "archived", l: `Arxiv (${counts.archived})` },
              ] as const).map((f) => (
                <button key={f.k} className={`filter${filter === f.k ? " active" : ""}`} onClick={() => setFilter(f.k)}>
                  {f.l}
                </button>
              ))}
              <div className="toolbar-spacer" />
            </div>

            <table className="t">
              <thead>
                <tr>
                  <th>Başlıq</th>
                  <th>Status</th>
                  <th>Kateqoriya</th>
                  <th className="num">Oxuma</th>
                  <th>Dərc tarixi</th>
                  <th style={{ width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Məqalə tapılmadı</td></tr>
                )}
                {!loading && filtered.map((p) => {
                  const status = statusOf(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          <span style={{ fontSize: 22 }}>{p.emoji}</span>
                          <div>
                            <div className="strong">{p.title}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                              /blog/{p.slug} · {p.readTimeMinutes} dəq oxu
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {status === "published" && <span className="pill sage"><span className="dot" />Dərc</span>}
                        {status === "draft" && <span className="pill gold"><span className="dot" />Draft</span>}
                        {status === "archived" && <span className="pill muted"><span className="dot" />Arxiv</span>}
                        {p.featured && <span className="pill ox" style={{ marginLeft: 4 }}>★ öne</span>}
                      </td>
                      <td><span className="pill ox">{p.category}</span></td>
                      <td className="num strong">{p.readTimeMinutes} dəq</td>
                      <td>
                        {p.publishedDate
                          ? new Date(p.publishedDate).toLocaleDateString("az-AZ", { day: "numeric", month: "short", year: "numeric" })
                          : <span className="text-muted">—</span>}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <button className="btn sm ghost" onClick={() => openEdit(p)}>Redaktə</button>
                          <button className="btn sm ghost" onClick={() => toggleActive(p)}>{p.active ? "Arxivlə" : "Aktivləşdir"}</button>
                          <button className="btn sm danger" onClick={() => remove(p.id)}>Sil</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab !== "articles" && (
        <div className="card card-pad" style={{ textAlign: "center", color: "var(--muted)", padding: 60 }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            {tab === "home" && "Ana səhifə blokları"}
            {tab === "categories" && "Kateqoriyalar"}
            {tab === "media" && "Media kitabxanası"}
          </div>
          <div style={{ fontSize: 12 }}>Bu bölmə tezliklə əlavə olunacaq.</div>
        </div>
      )}

      {modal && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="modal lg">
            <div className="modal-head">
              <div className="modal-title">{modal.id ? "Məqaləni redaktə et" : "Yeni məqalə yarat"}</div>
              <button className="btn ghost icon-only sm" onClick={close}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
                <div>
                  <Field label="Başlıq">
                    <input className="input" value={modal.item.title}
                      onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, title: e.target.value, slug: m.id ? m.item.slug : slugify(e.target.value) } }))} />
                  </Field>
                  <div style={{ marginTop: 12 }} />
                  <Field label={`Slug · /blog/${modal.item.slug || "yeni-meqale"}`}>
                    <input className="input mono" value={modal.item.slug}
                      onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, slug: e.target.value } }))} />
                  </Field>
                  <div style={{ marginTop: 12 }} />
                  <Field label="Xülasə">
                    <textarea className="textarea" value={modal.item.excerpt}
                      onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, excerpt: e.target.value } }))} />
                  </Field>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Parametrlər</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <Field label="Status">
                      <select className="select" value={statusOf({ id: 0, ...modal.item })}
                        onChange={(e) => {
                          const s = e.target.value;
                          setModal((m) => m && ({
                            ...m,
                            item: {
                              ...m.item,
                              active: s !== "archived",
                              publishedDate: s === "draft"
                                ? new Date(Date.now() + 86400000).toISOString().split("T")[0]
                                : new Date().toISOString().split("T")[0],
                            },
                          }));
                        }}>
                        <option value="published">Dərc et</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Arxivlə</option>
                      </select>
                    </Field>
                    <Field label="Kateqoriya">
                      <input className="input" value={modal.item.category}
                        onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, category: e.target.value } }))} />
                    </Field>
                    <Field label="Emoji">
                      <input className="input" value={modal.item.emoji}
                        onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, emoji: e.target.value } }))} />
                    </Field>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <Field label="Rəng">
                        <input className="input mono" value={modal.item.categoryColor}
                          onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, categoryColor: e.target.value } }))} />
                      </Field>
                      <Field label="Arxa plan">
                        <input className="input mono" value={modal.item.categoryBg}
                          onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, categoryBg: e.target.value } }))} />
                      </Field>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <Field label="Oxuma (dəq)">
                        <input className="input" type="number" value={modal.item.readTimeMinutes}
                          onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, readTimeMinutes: Number(e.target.value) } }))} />
                      </Field>
                      <Field label="Dərc tarixi">
                        <input className="input" type="date" value={modal.item.publishedDate}
                          onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, publishedDate: e.target.value } }))} />
                      </Field>
                    </div>
                    <div className="row" style={{ gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Öne çıxan</span>
                      <button className={`switch${modal.item.featured ? " on" : ""}`}
                        onClick={() => setModal((m) => m && ({ ...m, item: { ...m.item, featured: !m.item.featured } }))} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={close}>Ləğv et</button>
              <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Saxlanır…" : "Saxla"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
