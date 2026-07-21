"use client";

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import { adminApi, type BlogPost, type BlogCategory } from "@/lib/api";
import { getMainSiteUrl } from "@/lib/auth";
import ArticleEditor from "@/components/ArticleEditor";
import { COVER_PRESETS, coverPresetPath, type CoverPreset } from "@/components/coverPresets";

export interface ArticleEditorApi {
  createBlogPost: (data: Omit<BlogPost, "id">) => Promise<BlogPost>;
  updateBlogPost: (id: number, data: Omit<BlogPost, "id">) => Promise<BlogPost>;
  getBlogCategories: () => Promise<BlogCategory[]>;
  uploadFile: (file: File) => Promise<string>;
}

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

const STEPS = ["Başlıq", "Məqalə", "Etiketlər", "Önizləmə"] as const;

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;       // matches backend max-file-size
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Aşağı naviqasiya "İrəli / Geri" — düymə deyil, ox+mətn kimi görünən sətir.
const navLinkStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7,
  background: "transparent", border: "none", padding: "8px 6px",
  color: "#52718F", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};

/** Validate a file before we even hit the server so we can give the user a
 *  precise reason instead of a generic "Şəkil yükləmə xətası". */
function validateImage(file: File): string | null {
  if (!file) return "Fayl seçilmədi";
  if (!file.type.startsWith("image/") && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Yalnız şəkil faylları (JPG, PNG, WEBP, GIF) qəbul olunur";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `Şəkil çox böyükdür (${mb} MB). Maksimum 30 MB.`;
  }
  return null;
}

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
  tags: string[];
  featured: boolean;
  active: boolean;
  status: string;
}

interface Props {
  article?: BlogPost;
  api?: ArticleEditorApi;
  backHref?: string;
  backLabel?: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Yan","Fev","Mart","Apr","May","İyun","İyul","Avq","Sen","Okt","Noy","Dek"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function buildPayload(data: FormState): Omit<BlogPost, "id"> {
  // Backend requires @NotBlank title — provide a safe placeholder for drafts
  // so the user can upload a cover or start typing the body first.
  const safeTitle = data.title.trim() || "Başlıqsız qaralama";
  return {
    title: safeTitle,
    content: data.content,
    excerpt: data.excerpt,
    coverImageUrl: data.coverImageUrl || undefined,
    category: data.category.trim() || "Qaralama",
    categoryColor: data.categoryColor,
    categoryBg: data.categoryBg,
    emoji: data.emoji,
    slug: data.slug.trim() || `draft-${Date.now()}`,
    publishedDate: data.publishedDate,
    tags: data.tags,
    featured: data.featured,
    active: data.active,
    status: data.status,
    readTimeMinutes: estimateReadTime(data.content),
  };
}

export default function ArticleEditorPage({
  article,
  api = adminApi,
  backHref = "/admin/blog",
  backLabel = "Məqalələr",
}: Props) {
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
    tags: article?.tags ?? [],
    featured: article?.featured ?? false,
    active: article?.active ?? true,
    status: article?.status ?? "DRAFT",
  };

  const [form, setForm] = useState<FormState>(initialForm);
  const [articleId, setArticleId] = useState<number | null>(article?.id ?? null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  // Mərhələ sihirbazı: 0 Başlıq · 1 Məqalə · 2 Etiketlər · 3 Önizləmə
  const [step, setStep] = useState(0);
  const [popup, setPopup] = useState<string | null>(null);
  const [presetBusyId, setPresetBusyId] = useState<string | null>(null);

  // For new articles: generate a random 4-digit suffix once; existing articles keep their slug
  const [slugSuffix] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
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
    setSaveError(null);
    try {
      const payload = { ...buildPayload(data), status: "DRAFT" };
      if (id) {
        await api.updateBlogPost(id, payload);
        setForm(f => ({ ...f, status: "DRAFT" }));
        setSaveStatus("saved");
        return id;
      } else {
        // Don't fire a create call for a completely empty article (nothing
        // typed AND no cover uploaded). Avoids spamming the DB with empties.
        if (!data.title.trim() && !data.content.trim() && !data.coverImageUrl) {
          setSaveStatus("idle");
          return null;
        }
        const created = await api.createBlogPost(payload);
        setArticleId(created.id);
        articleIdRef.current = created.id;
        setSaveStatus("saved");
        return created.id;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Naməlum xəta";
      setSaveError(msg);
      setSaveStatus("error");
      return id;
    }
  }, [api]);

  /** Fire an immediate save now — used by retry buttons and after explicit
   *  user actions (e.g. uploading a cover) where waiting 2s for debounce
   *  would feel laggy. */
  const flushSave = useCallback(async () => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    return doSave(formRef.current, articleIdRef.current);
  }, [doSave]);

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
        next.slug = base ? `${base}-${slugSuffix}` : "";
      }
      if (isMounted.current) scheduleAutoSave(next);
      return next;
    });
  }, [isExisting, slugSuffix, scheduleAutoSave]);

  // Etiket sahəsindəki qaralamanı təsdiqlə: təmizlə, təkrarı/limit(12)-i yoxla, əlavə et.
  const commitTag = useCallback(() => {
    const raw = tagDraft.trim().replace(/,/g, " ").replace(/\s+/g, " ");
    setTagDraft("");
    if (!raw) return;
    setForm(prev => {
      if (prev.tags.length >= 12 || prev.tags.some(t => t.toLowerCase() === raw.toLowerCase())) return prev;
      const next = { ...prev, tags: [...prev.tags, raw] };
      if (isMounted.current) scheduleAutoSave(next);
      return next;
    });
  }, [tagDraft, scheduleAutoSave]);

  // Cari mərhələ irəli getmək üçün tamamlanmalıdır (qaralama saxlanmağa mane olmur —
  // yalnız növbəti mərhələyə keçidi bloklayır, popup ilə xəbərdarlıq göstərir).
  const stepError = (s: number): string | null => {
    if (s === 0 && !form.title.trim()) return "Zəhmət olmasa əvvəlcə məqalə başlığını yazın.";
    if (s === 1 && !form.content.replace(/<[^>]+>/g, "").trim()) return "Məqalə mətni boşdur — davam etmək üçün nəsə yazın.";
    return null;
  };

  const goStep = (n: number) => {
    if (n > step) {
      const err = stepError(step);
      if (err) { setPopup(err); return; }
    }
    setSaveError(null);
    void flushSave();
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    if (typeof document !== "undefined") {
      document.getElementById("ax-wiz-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    api.getBlogCategories().then(setCategories).catch(() => {});
  }, [api]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, []);

  const handlePublish = async () => {
    // Gözləyən qaralama (DRAFT) autosave-i ləğv et ki, PUBLISHED yazısını sonradan
    // DRAFT ilə əvəz etməsin — "Yayımla" birbaşa canlıya getsin.
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    // Validate explicitly so the backend doesn't reject us with a generic 400.
    const t = formRef.current.title.trim();
    if (!t) { setPopup("Yayımlamadan əvvəl başlıq əlavə edin."); setStep(0); return; }
    if (!formRef.current.content.replace(/<[^>]+>/g, "").trim()) {
      setPopup("Məqalə mətni boşdur — yayımlamaq üçün əvvəlcə məzmun yazın.");
      setStep(1);
      return;
    }

    setPublishing(true);
    setSaveError(null);
    try {
      let id = articleIdRef.current;
      if (!id) {
        const created = await api.createBlogPost({ ...buildPayload(formRef.current), status: "PUBLISHED" });
        setArticleId(created.id);
        articleIdRef.current = created.id;
        id = created.id;
      } else {
        await api.updateBlogPost(id, { ...buildPayload(formRef.current), status: "PUBLISHED" });
      }
      setForm(f => ({ ...f, status: "PUBLISHED" }));
      setSaveStatus("saved");
      // Yayımdan sonra məqalələr siyahısına qayıt (əlavə addım yoxdur).
      if (typeof window !== "undefined") { window.location.assign(backHref); return; }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xəta baş verdi";
      setSaveError(msg);
      setSaveStatus("error");
      setPopup("Yayım uğursuz oldu: " + msg);
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!articleIdRef.current) return;
    try {
      await api.updateBlogPost(articleIdRef.current, { ...buildPayload(formRef.current), status: "DRAFT" });
      setForm(f => ({ ...f, status: "DRAFT" }));
      setSaveStatus("saved");
    } catch (e) {
      setPopup(e instanceof Error ? e.message : "Xəta baş verdi");
    }
  };

  const handleCoverUpload = async (file: File) => {
    const validationError = validateImage(file);
    if (validationError) { setPopup(validationError); return; }

    setCoverUploading(true);
    try {
      const url = await api.uploadFile(file);
      setField("coverImageUrl", url);
      // Push the cover to the server right away — don't wait for the 2s
      // debounce. If we waited and the user navigated quickly, they'd
      // think the cover was lost.
      await flushSave();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Naməlum xəta";
      setPopup(`Şəkil yüklənə bilmədi: ${msg}`);
    } finally {
      setCoverUploading(false);
    }
  };

  // Hazır vektor qapaq seçimi — statik illüstrasyon (public/covers). Mütləq URL
  // (ana sayt origin) saxlanır ki, panel və public bloq eyni şəkli göstərsin.
  const applyPreset = async (preset: CoverPreset) => {
    if (presetBusyId) return;
    setPresetBusyId(preset.id);
    try {
      setField("coverImageUrl", `${getMainSiteUrl()}${coverPresetPath(preset.file)}`);
      await flushSave();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Naməlum xəta";
      setPopup(`Qapaq tətbiq edilə bilmədi: ${msg}`);
    } finally {
      setPresetBusyId(null);
    }
  };

  const handleEditorUpload = async (file: File): Promise<string> => {
    const validationError = validateImage(file);
    if (validationError) {
      // Throw — the rich-text editor expects either a URL or an exception.
      throw new Error(validationError);
    }
    try {
      return await api.uploadFile(file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Naməlum xəta";
      throw new Error(`Şəkil yüklənə bilmədi: ${msg}`);
    }
  };

  const coverInputRef = useRef<HTMLInputElement>(null);

  // ── WIZARD MODE ───────────────────────────────────────────────────────────
  const isPublished = form.status === "PUBLISHED";
  const hasBodyText = !!form.content.replace(/<[^>]+>/g, "").trim();

  return (
    <div id="ax-wiz-scroll" style={{ position: "fixed", inset: 0, zIndex: 200, background: "#F7FAFD", overflowY: "auto" }}>

      {/* Sticky header — back + save vəziyyəti + stepper (birlikte yapışır) */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff", borderBottom: "1px solid #E4EDF6", boxShadow: "0 6px 16px rgba(10,26,51,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 56, gap: 12 }}>
          <a href={backHref}
            style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", color: "#52718F", fontSize: 14, fontWeight: 500, flexShrink: 0 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            {backLabel}
          </a>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {isPublished && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#DCFCE7", color: "#166534" }}>
                Yayımlandı
              </span>
            )}
            {saveStatus === "error" ? (
              <span title={saveError ?? undefined}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#B91C1C", background: "#FEE2E2", padding: "3px 10px", borderRadius: 20, border: "1px solid #FECACA" }}>
                <SaveErrorIcon /> Saxlanmadı{saveError ? `, ${truncate(saveError, 40)}` : ""}
                <button onClick={() => flushSave()}
                  style={{ background: "transparent", border: "none", color: "#991B1B", fontWeight: 700, cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline" }}>
                  Yenidən cəhd et
                </button>
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "#8AAABF" }}>
                {saveStatus === "saving" && "Saxlanır…"}
                {saveStatus === "saved" && (isPublished ? "Yayımlandı" : "Qaralama saxlanıldı")}
              </span>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div style={{ padding: "10px 24px", borderTop: "1px solid #EEF3F9", overflowX: "auto" }}>
          <Stepper step={step} />
        </div>
      </div>

      {/* Step content */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 20px 40px" }}>
        <div key={step} className="wiz-step">

          {/* ── STEP 0 · Başlıq + qapaq şəkli ──────────────────────────────── */}
          {step === 0 && (
            <>
              {form.coverImageUrl ? (
                <div style={{ position: "relative", marginBottom: 28 }}>
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
                  style={{ width: "100%", height: 160, borderRadius: 16, marginBottom: 28, border: "2px dashed #C0D2E6", background: "#F8FAFD", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: coverUploading ? "wait" : "pointer", color: "#8AAABF" }}
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

              {/* Hazır vektor qapaqlar — brendə uyğun, psixologiya temalı dizaynlar */}
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>
                  Hazır qapaqlar
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                  {COVER_PRESETS.map(preset => {
                    const busy = presetBusyId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        disabled={!!presetBusyId}
                        title={preset.label}
                        style={{ position: "relative", padding: 0, border: "1.5px solid #E4EDF6", borderRadius: 10, overflow: "hidden", cursor: presetBusyId ? "wait" : "pointer", background: "#F2F6FD", aspectRatio: "8 / 3", display: "block" }}
                      >
                        <img src={coverPresetPath(preset.file)} alt={preset.label} loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        <span style={{ position: "absolute", left: 8, bottom: 6, fontSize: 11, fontWeight: 700, color: "#1A2535", background: "rgba(255,255,255,0.82)", padding: "1px 7px", borderRadius: 6 }}>
                          {preset.label}
                        </span>
                        {busy && (
                          <span style={{ position: "absolute", inset: 0, background: "rgba(8,47,109,0.45)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                            Tətbiq edilir…
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <textarea
                value={form.title}
                onChange={e => setField("title", e.target.value)}
                placeholder="Başlıq əlavə edin"
                rows={1}
                style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: "2rem", fontWeight: 800, color: "#0F1C2E", lineHeight: 1.3, background: "transparent", marginBottom: 20, fontFamily: "inherit", overflow: "hidden" }}
                onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
              />

              {categories.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>
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
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", border: selected ? `2px solid ${cat.color}` : "2px solid #E4EDF6", background: selected ? cat.bg : "#fff", color: selected ? cat.color : "#52718F" }}
                        >
                          <span>{cat.emoji}</span>
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── STEP 1 · Məqalə mətni ──────────────────────────────────────── */}
          {step === 1 && (
            <ArticleEditor
              value={form.content}
              onChange={v => setField("content", v)}
              onUpload={handleEditorUpload}
            />
          )}

          {/* ── STEP 2 · Etiketlər ─────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                Etiketlər
              </p>
              <p style={{ fontSize: 13, color: "#8AAABF", margin: "0 0 14px" }}>
                Məqaləni tapmağı asanlaşdırır. Yazıb <b>Enter</b> və ya vergül ilə əlavə edin (maks. 12).
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "14px 16px", background: "#F0F5FF", borderRadius: 12, minHeight: 60 }}>
                {form.tags.map(tag => (
                  <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#E0EBF7", color: "#002147", borderRadius: 999, padding: "6px 8px 6px 14px", fontSize: 13.5, fontWeight: 600 }}>
                    {tag}
                    <button type="button" onClick={() => setField("tags", form.tags.filter(t => t !== tag))} aria-label={`${tag} etiketini sil`}
                      style={{ display: "inline-flex", background: "none", border: "none", padding: 0, cursor: "pointer", color: "#5C7C9E" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
                <input
                  value={tagDraft}
                  onChange={e => setTagDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitTag(); }
                    else if (e.key === "Backspace" && !tagDraft && form.tags.length) { setField("tags", form.tags.slice(0, -1)); }
                  }}
                  onBlur={commitTag}
                  placeholder={form.tags.length ? "Daha bir etiket…" : "Etiket yazın, Enter ilə əlavə edin"}
                  style={{ flex: "1 1 180px", minWidth: 160, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "#1A2535", padding: "6px 2px" }}
                />
              </div>
            </div>
          )}

          {/* ── STEP 3 · Önizləmə ──────────────────────────────────────────── */}
          {step === 3 && (
            <div>
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6", overflow: "hidden", boxShadow: "0 8px 24px rgba(10,26,51,0.05)" }}>
                {form.coverImageUrl && (
                  <img src={form.coverImageUrl} alt="cover"
                    style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }} />
                )}
                <div style={{ padding: "32px 32px 40px" }}>
                  {form.category && (
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: form.categoryBg, color: form.categoryColor, display: "inline-block", marginBottom: 16 }}>
                      {form.category}
                    </span>
                  )}
                  <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#0F1C2E", lineHeight: 1.25, margin: "0 0 8px" }}>
                    {form.title || "Başlıqsız məqalə"}
                  </h1>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 13, color: "#8AAABF", margin: "0 0 28px" }}>
                    <span>{formatDate(form.publishedDate)}</span>
                    <span>{estimateReadTime(form.content)} dəq oxu</span>
                  </div>
                  <div
                    className="article-content"
                    dangerouslySetInnerHTML={{ __html: form.content || "<p style='color:#9AB0C8'>Məzmun hələ yazılmayıb.</p>" }}
                    style={{ fontSize: 16, lineHeight: 1.85, color: "#1A2535" }}
                  />
                  {form.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 32, paddingTop: 20, borderTop: "1px solid #EEF3F9" }}>
                      {form.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 12.5, fontWeight: 600, padding: "4px 12px", borderRadius: 999, background: "#F0F5FF", color: "#3C5A78" }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Sticky footer — İrəli / Geri ox+mətn, son mərhələdə Yayımla/Yenilə */}
      <div style={{ position: "sticky", bottom: 0, zIndex: 40, background: "#fff", borderTop: "1px solid #E4EDF6", boxShadow: "0 -6px 16px rgba(10,26,51,0.05)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", gap: 8 }}>
          <div>
            {step > 0 && (
              <button type="button" onClick={() => goStep(step - 1)} style={navLinkStyle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(180deg)" }}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                Geri
              </button>
            )}
          </div>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => goStep(step + 1)} style={navLinkStyle}>
              İrəli
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              {isPublished && (
                <button type="button" onClick={handleUnpublish}
                  style={{ padding: "9px 18px", borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: "pointer", border: "1.5px solid #C0D2E6", background: "#fff", color: "#52718F" }}>
                  Qaralamaya al
                </button>
              )}
              <button type="button" onClick={handlePublish} disabled={publishing}
                style={{ padding: "9px 26px", borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: publishing ? "not-allowed" : "pointer", border: "none", background: publishing ? "#52718F" : "var(--brand)", color: "#fff", opacity: (!hasBodyText && !isPublished) ? 0.6 : 1 }}>
                {publishing ? "…" : (isPublished ? "Yenilə" : "Yayımla")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Qapaq üçün gizli fayl input-u (bütün mərhələlərdə DOM-da qalır) */}
      <input type="file" ref={coverInputRef} accept="image/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ""; }} />

      {popup && <WarningPopup message={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}

// ─── Stepper (yalnız göstəriş — naviqasiya ardıcıl footer ilə) ────────────────
function Stepper({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: "max-content" }}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, border: "1px solid", borderColor: active ? "#52718F" : "transparent", background: active ? "#EEF4F9" : "transparent", color: active ? "#2F4A63" : "#6B7A8D", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", transition: "background .25s ease, border-color .25s ease, color .25s ease" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 999, fontSize: 11, transition: "background .25s ease", background: active ? "#52718F" : done ? "#065F46" : "#EEF2F7", color: active || done ? "#fff" : "#6B7A8D" }}>
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                ) : i + 1}
              </span>
              {label}
            </div>
            {i < STEPS.length - 1 && <span style={{ color: "#DDE6F0", fontSize: 12 }}>—</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Bloklayıcı xəbərdarlıq popup-u ──────────────────────────────────────────
function WarningPopup({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="wiz-pop" role="alertdialog" aria-modal="true"
        style={{ background: "#fff", borderRadius: 16, width: "min(420px, 100%)", padding: 24, textAlign: "center", boxShadow: "0 18px 50px rgba(10,26,51,0.28)" }}>
        <div style={{ width: 46, height: 46, borderRadius: 999, background: "#FEF3C7", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <p style={{ fontSize: 14.5, fontWeight: 600, color: "#1A2535", margin: "0 0 18px", lineHeight: 1.5 }}>{message}</p>
        <button onClick={onClose}
          style={{ background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Anladım
        </button>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function SaveErrorIcon() {
  return (
    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4"
      viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
