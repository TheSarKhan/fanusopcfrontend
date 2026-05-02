"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { adminApi, type BlogPost, type BlogCategory } from "@/lib/api";
import { getMainSiteUrl } from "@/lib/auth";
import ArticleEditor from "@/components/ArticleEditor";

const slugify = (t: string) =>
  t.toLowerCase()
    .replace(/[əƏ]/g, "e").replace(/[ıİ]/g, "i").replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u").replace(/[ğĞ]/g, "g").replace(/[şŞ]/g, "s")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function estimateReadTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface FormState {
  title: string;
  content: string;
  excerpt: string;
  coverImageUrl: string;
  category: string;
  categoryColor: string;
  categoryBg: string;
  emoji: string;
  slug: string;
  publishedDate: string;
  featured: boolean;
  active: boolean;
  status: string;
}

interface Props {
  article?: BlogPost;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Yan","Fev","Mart","Apr","May","İyun","İyul","Avq","Sen","Okt","Noy","Dek"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function buildPayload(data: FormState): Omit<BlogPost, "id"> {
  return {
    title: data.title,
    content: data.content,
    excerpt: data.excerpt,
    coverImageUrl: data.coverImageUrl || undefined,
    category: data.category.trim() || "Qaralama",
    categoryColor: data.categoryColor,
    categoryBg: data.categoryBg,
    emoji: data.emoji,
    slug: data.slug.trim() || `draft-${Date.now()}`,
    publishedDate: data.publishedDate,
    featured: data.featured,
    active: data.active,
    status: data.status,
    readTimeMinutes: estimateReadTime(data.content),
  };
}

export default function ArticleEditorPage({ article }: Props) {
  // If article is published and has a pending draft, load the draft version into the editor
  const hasDraft = article?.hasPendingDraft ?? false;
  const initialForm: FormState = {
    title: (hasDraft ? article?.draftTitle : article?.title) ?? article?.title ?? "",
    content: (hasDraft ? article?.draftContent : article?.content) ?? article?.content ?? "",
    excerpt: (hasDraft ? article?.draftExcerpt : article?.excerpt) ?? article?.excerpt ?? "",
    coverImageUrl: (hasDraft ? article?.draftCoverImageUrl : article?.coverImageUrl) ?? article?.coverImageUrl ?? "",
    category: article?.category ?? "",
    categoryColor: article?.categoryColor ?? "#002147",
    categoryBg: article?.categoryBg ?? "#E0EBF7",
    emoji: article?.emoji ?? "📝",
    slug: article?.slug ?? "",
    publishedDate: article?.publishedDate ?? new Date().toISOString().split("T")[0],
    featured: article?.featured ?? false,
    active: article?.active ?? true,
    status: article?.status ?? "DRAFT",
  };

  const [form, setForm] = useState<FormState>(initialForm);
  const [articleId, setArticleId] = useState<number | null>(article?.id ?? null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [categories, setCategories] = useState<BlogCategory[]>([]);

  // For new articles: generate a random 4-digit suffix once; existing articles keep their slug
  const slugSuffix = useRef(Math.floor(1000 + Math.random() * 9000).toString());
  const isExisting = !!article?.slug;

  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const articleIdRef = useRef<number | null>(article?.id ?? null);
  const formRef = useRef<FormState>(initialForm);
  const isMounted = useRef(false);

  // Keep refs in sync
  useEffect(() => { articleIdRef.current = articleId; }, [articleId]);
  useEffect(() => { formRef.current = form; }, [form]);

  const doSave = useCallback(async (data: FormState, id: number | null): Promise<number | null> => {
    setSaveStatus("saving");
    try {
      const payload = { ...buildPayload(data), status: "DRAFT" };
      if (id) {
        await adminApi.updateBlogPost(id, payload);
        setForm(f => ({ ...f, status: "DRAFT" }));
        setSaveStatus("saved");
        return id;
      } else {
        if (!data.title.trim() && !data.content.trim()) {
          setSaveStatus("idle");
          return null;
        }
        const created = await adminApi.createBlogPost(payload);
        setArticleId(created.id);
        articleIdRef.current = created.id;
        setSaveStatus("saved");
        return created.id;
      }
    } catch {
      setSaveStatus("error");
      return id;
    }
  }, []);

  const scheduleAutoSave = useCallback((data: FormState) => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    setSaveStatus("saving"); // optimistic
    autoSaveRef.current = setTimeout(() => {
      doSave(data, articleIdRef.current);
    }, 2000);
  }, [doSave]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === "title" && !isExisting) {
        const base = slugify(value as string);
        next.slug = base ? `${base}-${slugSuffix.current}` : "";
      }
      if (isMounted.current) scheduleAutoSave(next);
      return next;
    });
  }, [isExisting, slugSuffix, scheduleAutoSave]);

  useEffect(() => {
    adminApi.getBlogCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, []);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      let id = articleIdRef.current;
      if (!id) {
        if (!formRef.current.title.trim() && !formRef.current.content.trim()) {
          alert("Başlıq və ya məzmun əlavə edin");
          return;
        }
        const created = await adminApi.createBlogPost({ ...buildPayload(formRef.current), status: "PUBLISHED" });
        setArticleId(created.id);
        articleIdRef.current = created.id;
        id = created.id;
      } else {
        await adminApi.updateBlogPost(id, { ...buildPayload(formRef.current), status: "PUBLISHED" });
      }
      setForm(f => ({ ...f, status: "PUBLISHED" }));
      setSaveStatus("saved");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xəta baş verdi");
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!articleIdRef.current) return;
    try {
      await adminApi.updateBlogPost(articleIdRef.current, { ...buildPayload(formRef.current), status: "DRAFT" });
      setForm(f => ({ ...f, status: "DRAFT" }));
      setSaveStatus("saved");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xəta baş verdi");
    }
  };

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true);
    try {
      const url = await adminApi.uploadFile(file);
      setField("coverImageUrl", url);
    } catch {
      alert("Şəkil yükləmə xətası");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleEditorUpload = async (file: File): Promise<string> => {
    return adminApi.uploadFile(file);
  };

  const handleShare = useCallback(async () => {
    if (!form.slug) return;
    const url = `${getMainSiteUrl()}/blog/${form.slug}`;
    if (navigator.share) {
      await navigator.share({ title: form.title || "Məqalə", url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      alert("Link kopyalandı!");
    }
  }, [form.slug, form.title]);

  const coverInputRef = useRef<HTMLInputElement>(null);

  // ── PREVIEW MODE ─────────────────────────────────────────────────────────
  if (preview) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#F7FAFD", overflowY: "auto" }}>
        {/* Preview top bar */}
        <div style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "#fff", borderBottom: "1px solid #E4EDF6",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 24px", height: 56,
        }}>
          <button
            onClick={() => setPreview(false)}
            style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", cursor: "pointer", color: "#52718F", fontSize: 14, fontWeight: 500 }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Editora qayıt
          </button>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Önizləmə</span>
          <div style={{ width: 100 }} />
        </div>

        {/* Preview content */}
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px 60px" }}>
          {form.coverImageUrl && (
            <img src={form.coverImageUrl} alt="cover"
              style={{ width: "100%", maxHeight: 400, objectFit: "cover", borderRadius: "0 0 16px 16px", display: "block" }} />
          )}
          <div style={{ padding: "40px 0 0" }}>
            {form.category && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: form.categoryBg, color: form.categoryColor, display: "inline-block", marginBottom: 16 }}>
                {form.category}
              </span>
            )}
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#0F1C2E", lineHeight: 1.25, marginBottom: 8 }}>
              {form.title || "Başlıqsız məqalə"}
            </h1>
            <p style={{ fontSize: 13, color: "#8AAABF", marginBottom: 32 }}>
              {formatDate(form.publishedDate)}
            </p>
            <div
              className="article-content"
              dangerouslySetInnerHTML={{ __html: form.content || "<p style='color:#9AB0C8'>Məzmun hələ yazılmayıb.</p>" }}
              style={{ fontSize: 16, lineHeight: 1.85, color: "#1A2535" }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── EDITOR MODE ───────────────────────────────────────────────────────────
  const isPublished = form.status === "PUBLISHED";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#F7FAFD", overflowY: "auto" }}>
      {/* Sticky top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "#fff", borderBottom: "1px solid #E4EDF6",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 56, gap: 12,
      }}>
        {/* Back */}
        <a href="/admin/blog"
          style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", color: "#52718F", fontSize: 14, fontWeight: 500, flexShrink: 0 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Məqalələr
        </a>

        {/* Save status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {form.status === "PUBLISHED" && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#DCFCE7", color: "#166534" }}>
              Yayımlandı
            </span>
          )}
          <span style={{ fontSize: 12, color: saveStatus === "error" ? "#EF4444" : "#8AAABF" }}>
            {saveStatus === "saving" && "Saxlanır..."}
            {saveStatus === "saved" && (form.status === "PUBLISHED" ? "✓ Yayımlandı" : "✓ Qaralama olaraq saxlanıldı")}
            {saveStatus === "error" && "⚠ Saxlanmadı"}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setPreview(true)}
            style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: "1.5px solid #C0D2E6", background: "#fff", color: "#1A2535",
            }}
          >
            Önizləmə
          </button>

          {isPublished && form.slug && (
            <button
              onClick={handleShare}
              title="Linki paylaş"
              style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: "1.5px solid #C0D2E6", background: "#fff", color: "#1A2535",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Paylaş
            </button>
          )}

          <button
            onClick={handlePublish}
            disabled={publishing}
            style={{
              padding: "7px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: publishing ? "not-allowed" : "pointer",
              border: "none",
              background: publishing ? "#52718F" : "linear-gradient(135deg, #002147, #5A4FC8)",
              color: "#fff",
            }}
          >
            {publishing ? "..." : "Yayımla"}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* Cover image */}
        <input type="file" ref={coverInputRef} accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ""; }} />

        {form.coverImageUrl ? (
          <div style={{ position: "relative", marginBottom: 32 }}>
            <img src={form.coverImageUrl} alt="cover"
              style={{ width: "100%", height: 300, objectFit: "cover", borderRadius: 16, display: "block" }} />
            <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", gap: 8 }}>
              <button onClick={() => coverInputRef.current?.click()}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", background: "rgba(255,255,255,0.9)", color: "#1A2535", cursor: "pointer" }}>
                Dəyiş
              </button>
              <button onClick={() => setField("coverImageUrl", "")}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", background: "rgba(255,255,255,0.9)", color: "#EF4444", cursor: "pointer" }}>
                Sil
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => coverInputRef.current?.click()}
            disabled={coverUploading}
            style={{
              width: "100%", height: 140, borderRadius: 16, marginBottom: 32,
              border: "2px dashed #C0D2E6", background: "#F8FAFD",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 8, cursor: coverUploading ? "wait" : "pointer", color: "#8AAABF",
            }}
          >
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {coverUploading ? "Yüklənir..." : "Qapaq şəkli əlavə et"}
            </span>
          </button>
        )}

        {/* Title */}
        <textarea
          value={form.title}
          onChange={e => setField("title", e.target.value)}
          placeholder="Başlıq əlavə edin"
          rows={1}
          style={{
            width: "100%", border: "none", outline: "none", resize: "none",
            fontSize: "2rem", fontWeight: 800, color: "#0F1C2E", lineHeight: 1.3,
            background: "transparent", marginBottom: 20, fontFamily: "inherit",
            overflow: "hidden",
          }}
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = el.scrollHeight + "px";
          }}
        />

        {/* Category badges */}
        {categories.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, margin: "0 0 10px" }}>
              Kateqoriya
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {categories.map(cat => {
                const selected = form.category === cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      if (selected) {
                        setField("category", "");
                        setField("categoryColor", "#002147");
                        setField("categoryBg", "#E0EBF7");
                      } else {
                        setField("category", cat.name);
                        setField("categoryColor", cat.color);
                        setField("categoryBg", cat.bg);
                      }
                    }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.15s",
                      border: selected ? `2px solid ${cat.color}` : "2px solid #E4EDF6",
                      background: selected ? cat.bg : "#fff",
                      color: selected ? cat.color : "#52718F",
                    }}
                  >
                    <span>{cat.emoji}</span>
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Metadata row */}
        <div style={{
          display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap",
          padding: "12px 16px", background: "#F0F5FF", borderRadius: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>Tarix</label>
            <input
              type="date"
              value={form.publishedDate}
              onChange={e => setField("publishedDate", e.target.value)}
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: "#1A2535", fontWeight: 500 }}
            />
          </div>
        </div>

        {/* Rich text editor */}
        <ArticleEditor
          value={form.content}
          onChange={v => setField("content", v)}
          onUpload={handleEditorUpload}
        />
      </div>
    </div>
  );
}
