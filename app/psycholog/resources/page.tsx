"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { psychologistApi, type Paged, type PsychResource, type PsychResourceReq } from "@/lib/api";
import PsychResourceTabs from "@/components/PsychResourceTabs";

/* ─── kateqoriyalar (sabit dəst) ──────────────────────────────────────────── */

const CATEGORIES = ["Protokol", "Şablon", "Tədqiqat", "Məqalə", "Digər"] as const;
type Category = (typeof CATEGORIES)[number];

const CAT_STYLE: Record<string, { color: string; bg: string }> = {
  "Protokol":  { color: "#2563eb", bg: "#eff6ff" },
  "Şablon":    { color: "#16a34a", bg: "#f0fdf4" },
  "Tədqiqat":  { color: "#9333ea", bg: "#faf5ff" },
  "Məqalə":    { color: "#ea580c", bg: "#fff7ed" },
  "Digər":     { color: "#475569", bg: "#f1f5f9" },
};
const catStyle = (c: string) => CAT_STYLE[c] ?? CAT_STYLE["Digər"];

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

function initials(name?: string | null) {
  if (!name) return "P";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "P";
}

const PAGE_SIZE = 30;
const EMPTY_PAGE: Paged<PsychResource> = { content: [], totalElements: 0, totalPages: 0, page: 0, size: PAGE_SIZE };

/* ─── page ────────────────────────────────────────────────────────────────── */

export default function PsychologResourcesPage() {
  const [items, setItems] = useState<PsychResource[]>([]);   // shared library (approved)
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsPage, setItemsPage] = useState(0);
  const [itemsLoadingMore, setItemsLoadingMore] = useState(false);
  const [mine, setMine] = useState<PsychResource[]>([]);     // own resources (any state)
  const [mineTotal, setMineTotal] = useState(0);
  const [minePage, setMinePage] = useState(0);
  const [mineLoadingMore, setMineLoadingMore] = useState(false);
  const [tab, setTab] = useState<"library" | "mine">("library");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<"ALL" | Category>("ALL");
  const [editing, setEditing] = useState<PsychResource | "new" | null>(null);
  const [viewing, setViewing] = useState<PsychResource | null>(null);
  const [confirm, setConfirm] = useState<PsychResource | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.listResourcesPaged({ page: 0, size: PAGE_SIZE }).catch(() => EMPTY_PAGE),
      psychologistApi.myResourcesPaged({ page: 0, size: PAGE_SIZE }).catch(() => EMPTY_PAGE),
    ]).then(([lib, m]) => {
      setItems(lib.content); setItemsTotal(lib.totalElements); setItemsPage(0);
      setMine(m.content); setMineTotal(m.totalElements); setMinePage(0);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const loadMoreLibrary = () => {
    setItemsLoadingMore(true);
    psychologistApi.listResourcesPaged({ page: itemsPage + 1, size: PAGE_SIZE })
      .then(res => {
        setItems(prev => [...prev, ...res.content]);
        setItemsTotal(res.totalElements);
        setItemsPage(res.page);
      })
      .catch(() => {})
      .finally(() => setItemsLoadingMore(false));
  };

  const loadMoreMine = () => {
    setMineLoadingMore(true);
    psychologistApi.myResourcesPaged({ page: minePage + 1, size: PAGE_SIZE })
      .then(res => {
        setMine(prev => [...prev, ...res.content]);
        setMineTotal(res.totalElements);
        setMinePage(res.page);
      })
      .catch(() => {})
      .finally(() => setMineLoadingMore(false));
  };

  // Yaratma/silmə sonrası "Mənim resurslarım" siyahısını 0-cı səhifədən yenilə.
  const reloadMine = () => {
    psychologistApi.myResourcesPaged({ page: 0, size: PAGE_SIZE })
      .then(res => { setMine(res.content); setMineTotal(res.totalElements); setMinePage(0); })
      .catch(() => {});
  };

  // Bildiriş deep-link: ?id=… → resursu aç.
  useEffect(() => {
    if (loading) return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    const found = items.find(r => r.id === Number(id));
    if (found) setViewing(found);
  }, [loading, items]);

  const activeList = tab === "library" ? items : mine;
  const filtered = useMemo(() => {
    let list = [...activeList];
    if (catFilter !== "ALL") list = list.filter(r => r.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.authorName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeList, catFilter, search]);

  const activeTotal = tab === "library" ? itemsTotal : mineTotal;
  const activeLoadingMore = tab === "library" ? itemsLoadingMore : mineLoadingMore;
  const activeLoadMore = tab === "library" ? loadMoreLibrary : loadMoreMine;

  const onSaved = (saved: PsychResource, isNew: boolean) => {
    if (isNew) {
      // A new resource is PRIVATE — it lives under "Mənim resurslarım" until shared.
      reloadMine();
      setTab("mine");
    } else {
      setItems(prev => prev.map(r => r.id === saved.id ? saved : r));
      setMine(prev => prev.map(r => r.id === saved.id ? saved : r));
    }
    setEditing(null);
  };

  const onDelete = async (r: PsychResource) => {
    await psychologistApi.deleteResource(r.id);
    if (items.some(x => x.id === r.id)) {
      setItems(prev => prev.filter(x => x.id !== r.id));
      setItemsTotal(t => Math.max(0, t - 1));
    }
    reloadMine();
    setConfirm(null);
    if (viewing?.id === r.id) setViewing(null);
  };

  const requestShare = async (r: PsychResource) => {
    if (!window.confirm(`"${r.title}" resursunu digər psixoloqlarla paylaşmaq üçün admin təsdiqinə göndərək?`)) return;
    try {
      const updated = await psychologistApi.requestShareResource(r.id);
      setMine(prev => prev.map(x => x.id === r.id ? updated : x));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  /* ─── render ────────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      <PsychResourceTabs />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--oxford)", margin: 0 }}>Bilik bazası</h1>
          <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4, marginBottom: 0 }}>
            Həmkarlarınızla protokol, şablon və materialları paylaşın. Yeni resurs əvvəlcə şəxsidir;
            paylaşmaq üçün admin təsdiqinə göndərin.
          </p>
        </div>
        <button onClick={() => setEditing("new")} style={primaryBtn}>
          <IconPlus /> Resurs əlavə et
        </button>
      </div>

      {/* View switcher */}
      <div style={{ display: "flex", gap: 6, background: "#fff", padding: 6, borderRadius: 10, border: "1px solid var(--oxford-10)", width: "fit-content" }}>
        <ViewTab active={tab === "library"} onClick={() => setTab("library")}>Paylaşılan kitabxana ({itemsTotal})</ViewTab>
        <ViewTab active={tab === "mine"} onClick={() => setTab("mine")}>Mənim resurslarım ({mineTotal})</ViewTab>
      </div>

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        background: "#fff", borderRadius: 14, padding: "10px 12px", border: "1px solid var(--oxford-10)",
      }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <FilterChip active={catFilter === "ALL"} onClick={() => setCatFilter("ALL")}>Hamısı</FilterChip>
          {CATEGORIES.map(c => (
            <FilterChip key={c} active={catFilter === c} onClick={() => setCatFilter(c)}>{c}</FilterChip>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Axtar (başlıq / müəllif)…"
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 10,
              border: "1.5px solid var(--oxford-10)", fontSize: 13,
              color: "var(--oxford)", outline: "none", boxSizing: "border-box",
            }} />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 14, height: 150 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "56px 24px",
          background: "#fff", borderRadius: 16, border: "1px dashed var(--oxford-10)",
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", margin: "0 0 4px" }}>
            {search.trim() || catFilter !== "ALL"
              ? "Uyğun resurs tapılmadı"
              : tab === "mine" ? "Hələ resurs əlavə etməmisiniz" : "Paylaşılan resurs yoxdur"}
          </p>
          <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: "0 0 18px" }}>
            {tab === "mine"
              ? "İlk resursunuzu əlavə edin; sonra paylaşım üçün admin təsdiqinə göndərə bilərsiniz."
              : "Təsdiqlənmiş resurslar burada görünəcək."}
          </p>
          <button onClick={() => setEditing("new")} style={primaryBtn}><IconPlus /> Resurs əlavə et</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {filtered.map(r => (
            <ResourceCard key={r.id} r={r}
              showShare={tab === "mine"}
              onView={() => setViewing(r)}
              onEdit={() => setEditing(r)}
              onDelete={() => setConfirm(r)}
              onRequestShare={() => requestShare(r)} />
          ))}
        </div>
      )}

      {!loading && activeList.length < activeTotal && (
        <div style={{ textAlign: "center" }}>
          <button type="button" onClick={activeLoadMore} disabled={activeLoadingMore}
            style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: activeLoadingMore ? "wait" : "pointer", opacity: activeLoadingMore ? 0.7 : 1 }}>
            {activeLoadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, activeTotal - activeList.length)})`}
          </button>
        </div>
      )}

      {editing && (
        <ResourceForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved} />
      )}

      {viewing && (
        <ResourceDetail
          r={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
          onDelete={() => setConfirm(viewing)} />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          onCancel={() => setConfirm(null)}
          onConfirm={() => onDelete(confirm)} />
      )}
    </div>
  );
}

/* ─── View tab + share badge ──────────────────────────────────────────────── */

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: 8, border: "none",
      background: active ? "var(--brand)" : "transparent",
      color: active ? "#fff" : "var(--oxford-60)",
      fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

const RES_SHARE: Record<string, { label: string; color: string; bg: string }> = {
  PRIVATE:  { label: "Şəxsi",           color: "#374151", bg: "#F3F4F6" },
  PENDING:  { label: "Təsdiq gözləyir", color: "#92400E", bg: "#FEF3C7" },
  APPROVED: { label: "Paylaşılıb",      color: "#065F46", bg: "#D1FAE5" },
  REJECTED: { label: "Rədd edildi",     color: "#991B1B", bg: "#FEE2E2" },
};

function ResShareBadge({ status }: { status: string }) {
  const b = RES_SHARE[status] ?? RES_SHARE.PRIVATE;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: b.color, background: b.bg }}>
      {b.label}
    </span>
  );
}

/* ─── Resource card ───────────────────────────────────────────────────────── */

function ResourceCard({ r, onView, onEdit, onDelete, showShare, onRequestShare }: {
  r: PsychResource; onView: () => void; onEdit: () => void; onDelete: () => void;
  showShare?: boolean; onRequestShare?: () => void;
}) {
  const cs = catStyle(r.category);
  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1px solid var(--oxford-10)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
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
      <button onClick={onView} style={{
        appearance: "none", border: "none", background: "transparent", textAlign: "left",
        cursor: "pointer", padding: "14px 14px 10px", display: "flex", flexDirection: "column", gap: 8, flex: 1,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: cs.bg, color: cs.color, textTransform: "uppercase", letterSpacing: 0.3,
          }}>{r.category}</span>
          {r.fileUrl && <IconPaperclip />}
        </div>
        <h3 style={{
          fontSize: 15, fontWeight: 700, color: "var(--oxford)", margin: 0, lineHeight: 1.3,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>{r.title}</h3>
        {r.description && (
          <p style={{
            fontSize: 12.5, color: "var(--oxford-60)", margin: 0, lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{r.description}</p>
        )}
      </button>
      {showShare && (
        <div style={{ padding: "0 14px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <ResShareBadge status={r.shareStatus} />
          {(r.shareStatus === "PRIVATE" || r.shareStatus === "REJECTED") && (
            <button onClick={onRequestShare} style={{
              fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 7,
              background: "var(--brand-50)", color: "var(--brand-700)", border: "1px solid transparent", cursor: "pointer",
            }}>Paylaşım üçün göndər</button>
          )}
          {r.shareStatus === "REJECTED" && r.adminNote && (
            <span style={{ fontSize: 11, color: "#991B1B" }}>Səbəb: {r.adminNote}</span>
          )}
        </div>
      )}
      <div style={{
        padding: "10px 14px", borderTop: "1px solid var(--oxford-10)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 11, fontWeight: 700,
            overflow: "hidden",
          }}>
            {r.authorPhotoUrl ? (
              <img src={r.authorPhotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : initials(r.authorName)}
          </div>
          <span style={{
            fontSize: 11.5, color: "var(--oxford-60)", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{r.authorName || "Psixoloq"} · {fmtDate(r.createdAt)}</span>
        </div>
        {r.mine && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={onEdit} title="Redaktə et" style={iconBtn("var(--brand-700)", "var(--brand-50)")}><IconEdit /></button>
            <button onClick={onDelete} title="Sil" style={iconBtn("#DC2626", "#FEE2E2")}><IconTrash /></button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Create / edit form ──────────────────────────────────────────────────── */

function ResourceForm({ initial, onClose, onSaved }: {
  initial: PsychResource | null;
  onClose: () => void;
  onSaved: (r: PsychResource, isNew: boolean) => void;
}) {
  const isNew = initial === null;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? CATEGORIES[0]);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [fileUrl, setFileUrl] = useState<string | null>(initial?.fileUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(initial?.fileName ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onPickFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const url = await psychologistApi.uploadFile(file);
      setFileUrl(url);
      setFileName(file.name);
    } catch (e) {
      setError("Fayl yüklənmədi: " + (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!title.trim()) { setError("Başlıq mütləqdir."); return; }
    setSaving(true);
    setError(null);
    const payload: PsychResourceReq = {
      title: title.trim(),
      description: description.trim() || undefined,
      content: content.trim() || undefined,
      fileUrl: fileUrl ?? undefined,
      fileName: fileName ?? undefined,
      category,
    };
    try {
      const saved = isNew
        ? await psychologistApi.createResource(payload)
        : await psychologistApi.updateResource(initial!.id, payload);
      onSaved(saved, isNew);
    } catch (e) {
      setError("Yadda saxlanmadı: " + (e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} wide>
      <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--oxford)", margin: "0 0 16px" }}>
        {isNew ? "Yeni resurs paylaş" : "Resursu redaktə et"}
      </h3>

      <Field label="Başlıq">
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={300}
          placeholder="Məs: Panik atak üçün CBT protokolu" style={inputStyle} autoFocus />
      </Field>

      <Field label="Kateqoriya">
        <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Qısa təsvir">
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={5000}
          placeholder="Bir-iki cümlə ilə nə haqdadır…" style={{ ...inputStyle, resize: "vertical" }} />
      </Field>

      <Field label="Məzmun (istəyə bağlı)">
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={6}
          placeholder="Tam mətn / qeydlər…" style={{ ...inputStyle, resize: "vertical" }} />
      </Field>

      <Field label="Fayl (istəyə bağlı)">
        <input ref={fileRef} type="file" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) onPickFile(f); }} />
        {fileUrl ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
            background: "var(--brand-50)", borderRadius: 10, fontSize: 13,
          }}>
            <IconPaperclip />
            <span style={{ flex: 1, color: "var(--oxford)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fileName || "Fayl"}
            </span>
            <button onClick={() => { setFileUrl(null); setFileName(null); }}
              style={{ border: "none", background: "transparent", color: "#DC2626", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              Sil
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={ghostBtn}>
            {uploading ? "Yüklənir…" : "Fayl seç"}
          </button>
        )}
      </Field>

      {error && <p style={{ color: "#DC2626", fontSize: 12.5, margin: "4px 0 0" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={ghostBtn}>Ləğv et</button>
        <button onClick={save} disabled={saving || uploading} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saxlanılır…" : isNew ? "Paylaş" : "Yadda saxla"}
        </button>
      </div>
    </Modal>
  );
}

/* ─── Detail view ─────────────────────────────────────────────────────────── */

function ResourceDetail({ r, onClose, onEdit, onDelete }: {
  r: PsychResource; onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const cs = catStyle(r.category);
  return (
    <Modal onClose={onClose} wide>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
          background: cs.bg, color: cs.color, textTransform: "uppercase", letterSpacing: 0.3,
        }}>{r.category}</span>
        <span style={{ fontSize: 11.5, color: "var(--oxford-60)" }}>{fmtDate(r.createdAt)}</span>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--oxford)", margin: "0 0 6px", lineHeight: 1.3 }}>
        {r.title}
      </h2>
      <p style={{ fontSize: 12.5, color: "var(--oxford-60)", margin: "0 0 16px" }}>
        Müəllif: {r.authorName || "Psixoloq"}
      </p>

      {r.description && (
        <p style={{ fontSize: 14, color: "var(--oxford)", lineHeight: 1.6, margin: "0 0 14px", fontWeight: 600 }}>
          {r.description}
        </p>
      )}
      {r.content && (
        <div style={{ fontSize: 13.5, color: "var(--oxford)", lineHeight: 1.65, whiteSpace: "pre-wrap", marginBottom: 16 }}>
          {r.content}
        </div>
      )}
      {r.fileUrl && (
        <a href={r.fileUrl} target="_blank" rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px",
            background: "var(--brand-50)", borderRadius: 10, fontSize: 13, fontWeight: 600,
            color: "var(--brand-700)", textDecoration: "none",
          }}>
          <IconPaperclip /> {r.fileName || "Faylı aç"}
        </a>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 22 }}>
        {r.mine && (
          <>
            <button onClick={onDelete} style={{ ...ghostBtn, color: "#DC2626", borderColor: "#FECACA" }}>Sil</button>
            <button onClick={onEdit} style={ghostBtn}>Redaktə et</button>
          </>
        )}
        <button onClick={onClose} style={primaryBtn}>Bağla</button>
      </div>
    </Modal>
  );
}

/* ─── shared atoms ────────────────────────────────────────────────────────── */

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(10, 22, 51, 0.55)", backdropFilter: "blur(4px)", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, padding: "24px 26px",
        maxWidth: wide ? 560 : 440, width: "100%", maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
      }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--oxford)", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px", borderRadius: 8, border: "none",
      background: active ? "var(--brand)" : "transparent",
      color: active ? "#fff" : "var(--oxford-60)",
      fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    }}>{children}</button>
  );
}

function ConfirmModal({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal onClose={onCancel}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)", margin: "0 0 6px" }}>Resursu sil</h3>
      <p style={{ fontSize: 13, color: "var(--oxford-60)", lineHeight: 1.55, margin: "0 0 20px" }}>
        <b>"{title}"</b> silinəcək. Bu əməliyyat geri qaytarıla bilməz.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={ghostBtn}>Ləğv et</button>
        <button onClick={onConfirm} style={{
          padding: "8px 20px", borderRadius: 8, border: "none",
          background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>Sil</button>
      </div>
    </Modal>
  );
}

/* ─── styles ──────────────────────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  border: "1.5px solid var(--oxford-10)", fontSize: 13,
  color: "var(--oxford)", outline: "none", boxSizing: "border-box",
  fontFamily: "inherit", background: "#fff",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
  background: "var(--brand)", color: "#fff", border: "none", cursor: "pointer",
  boxShadow: "0 4px 14px rgba(16,81,183,0.25)",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
  background: "#fff", color: "var(--oxford)",
  border: "1px solid var(--oxford-10)", cursor: "pointer",
};

function iconBtn(color: string, bg: string): React.CSSProperties {
  return {
    width: 28, height: 28, borderRadius: 7, background: bg, color,
    display: "flex", alignItems: "center", justifyContent: "center",
    border: "none", cursor: "pointer",
  };
}

/* ─── icons ───────────────────────────────────────────────────────────────── */

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
  <svg width="13" height="13" strokeWidth="1.8" {...sw}>
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" strokeWidth="1.8" {...sw}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
  </svg>
);
const IconPaperclip = () => (
  <svg width="14" height="14" strokeWidth="1.8" {...sw} style={{ color: "var(--brand-700)", flexShrink: 0 }}>
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
  </svg>
);
