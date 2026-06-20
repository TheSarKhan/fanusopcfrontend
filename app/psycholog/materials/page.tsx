"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { psychologistApi, type Material, type MaterialCategory, type MaterialVersion } from "@/lib/api";
import PsychResourceTabs from "@/components/PsychResourceTabs";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function fmtDate(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

function fmtSize(bytes?: number | null): string {
  if (bytes == null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExt(type?: string | null, name?: string | null): string {
  const t = (type || "").trim();
  if (t) return t.toUpperCase();
  const n = name || "";
  const dot = n.lastIndexOf(".");
  if (dot >= 0 && dot < n.length - 1) return n.slice(dot + 1).toUpperCase();
  return "FAYL";
}

/* ─── page ────────────────────────────────────────────────────────────────── */

export default function PsychologMaterialsPage() {
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Categories load once.
  useEffect(() => {
    psychologistApi.psyMaterialCategories()
      .then(cs => setCategories(cs.filter(c => c.active)))
      .catch(() => {});
  }, []);

  // Materials reload on category / debounced search change. The list comes
  // pre-filtered from the server, so we don't filter again client-side.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const handle = setTimeout(() => {
      psychologistApi.psyMaterials(categoryId ?? undefined, search.trim() || undefined)
        .then(ms => { if (!cancelled) setItems(ms); })
        .catch(() => { if (!cancelled) setError("Materialları yükləmək mümkün olmadı."); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [categoryId, search]);

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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isFiltered = search.trim() !== "" || categoryId != null;
  const clearFilters = () => { setSearch(""); setCategoryId(null); };

  /* ─── render ────────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      <PsychResourceTabs />

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--oxford)", margin: 0 }}>Material kitabxanası</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4, marginBottom: 0 }}>
          Pasiyentlərlə paylaşmaq üçün hazır materialları nəzərdən keçirin və yükləyin.
        </p>
      </div>

      {/* Toolbar: search */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        background: "#fff", borderRadius: 14, padding: "10px 12px",
        border: "1px solid var(--oxford-10)",
      }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <IconSearch />
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Axtar (başlıq / təsvir)…"
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
        {isFiltered && (
          <button onClick={clearFilters} style={ghostBtn}>Filtri təmizlə</button>
        )}
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Chip active={categoryId == null} onClick={() => setCategoryId(null)}>Hamısı</Chip>
          {categories.map(c => (
            <Chip key={c.id} active={categoryId === c.id} color={c.color} bg={c.bg}
              onClick={() => setCategoryId(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState filtered={isFiltered} onClear={clearFilters} />
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}>
          {items.map(m => <MaterialCard key={m.id} m={m} />)}
        </div>
      )}
    </div>
  );
}

/* ─── Material card ───────────────────────────────────────────────────────── */

function MaterialCard({ m }: { m: Material }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<MaterialVersion[] | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionsError, setVersionsError] = useState(false);

  const ext = fileExt(m.latestFileType, m.latestFileName);
  const size = fmtSize(m.latestFileSize);
  const hasMultiple = m.versionCount > 1;

  const toggleVersions = () => {
    const next = !open;
    setOpen(next);
    // Lazy-load on first expand.
    if (next && versions == null && !loadingVersions) {
      setLoadingVersions(true);
      setVersionsError(false);
      psychologistApi.psyMaterialVersions(m.id)
        .then(setVersions)
        .catch(() => setVersionsError(true))
        .finally(() => setLoadingVersions(false));
    }
  };

  return (
    <div style={{
      background: "#fff", borderRadius: 14,
      border: "1px solid var(--oxford-10)",
      display: "flex", flexDirection: "column",
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

      {/* Body */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: "var(--brand-50)", color: "var(--brand-700)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconFile />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            {m.categoryName && (
              <span style={{
                fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                background: "var(--brand-50)", color: "var(--brand-700)",
                display: "inline-block", marginBottom: 4,
                textTransform: "uppercase", letterSpacing: 0.3,
              }}>{m.categoryName}</span>
            )}
            <h3 style={{
              fontSize: 14.5, fontWeight: 700, color: "var(--oxford)",
              margin: 0, lineHeight: 1.3, display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>{m.title}</h3>
          </div>
        </div>

        {m.description && (
          <p style={{
            fontSize: 12.5, color: "var(--oxford-60)", margin: 0, lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>{m.description}</p>
        )}

        {/* Meta */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          fontSize: 11, color: "var(--oxford-60)", marginTop: 2,
        }}>
          <span style={{
            padding: "2px 8px", borderRadius: 6, fontWeight: 700,
            background: "var(--oxford-10)", color: "var(--oxford)",
          }}>{ext}</span>
          {size && <span>{size}</span>}
          {m.latestVersionNo != null && <span>v{m.latestVersionNo}</span>}
          {m.createdAt && <span>{fmtDate(m.createdAt)}</span>}
        </div>

        {/* Versions expander */}
        {open && (
          <div style={{
            marginTop: 4, borderTop: "1px solid var(--oxford-10)", paddingTop: 10,
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            {loadingVersions ? (
              <span style={{ fontSize: 12, color: "var(--oxford-60)" }}>Yüklənir…</span>
            ) : versionsError ? (
              <span style={{ fontSize: 12, color: "#DC2626" }}>Versiyalar yüklənmədi.</span>
            ) : versions && versions.length > 0 ? (
              versions.map(v => (
                <div key={v.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 8, fontSize: 12, color: "var(--oxford)",
                }}>
                  <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
                      background: "var(--brand-50)", color: "var(--brand-700)", flexShrink: 0,
                    }}>v{v.versionNo}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.fileName}
                    </span>
                  </span>
                  <a href={v.fileUrl} target="_blank" rel="noopener noreferrer"
                    title="Yüklə"
                    style={{
                      flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 11.5, fontWeight: 700, color: "var(--brand-700)",
                      textDecoration: "none",
                    }}>
                    <IconDownload /> Yüklə
                  </a>
                </div>
              ))
            ) : (
              <span style={{ fontSize: 12, color: "var(--oxford-60)" }}>Versiya tapılmadı.</span>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 16px", borderTop: "1px solid var(--oxford-10)",
      }}>
        {m.latestFileUrl ? (
          <a href={m.latestFileUrl} target="_blank" rel="noopener noreferrer"
            style={primaryBtnLink}>
            <IconDownload /> Yüklə
          </a>
        ) : (
          <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>Fayl yoxdur</span>
        )}
        {hasMultiple && (
          <button onClick={toggleVersions} style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconChevron open={open} /> Versiyalar ({m.versionCount})
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Category chip ───────────────────────────────────────────────────────── */

function Chip({ active, color, bg, onClick, children }: {
  active: boolean; color?: string | null; bg?: string | null;
  onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700,
      border: active ? "1.5px solid var(--brand)" : "1.5px solid var(--oxford-10)",
      background: active ? "var(--brand)" : (bg || "#fff"),
      color: active ? "#fff" : (color || "var(--oxford)"),
      cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
    }}>
      {children}
    </button>
  );
}

/* ─── Empty / error states ────────────────────────────────────────────────── */

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
        <IconFolder />
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", margin: "0 0 4px" }}>
        {filtered ? "Filtrlərə uyğun material yoxdur" : "Hələ material yoxdur"}
      </p>
      <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: "0 0 18px" }}>
        {filtered
          ? "Axtarışı və ya kateqoriyanı sıfırlamaq üçün aşağıdakı düyməyə basın."
          : "Material kitabxanası tezliklə doldurulacaq."}
      </p>
      {filtered && <button onClick={onClear} style={ghostBtn}>Filtri təmizlə</button>}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{
      textAlign: "center", padding: "40px 24px",
      background: "#fff", borderRadius: 16, border: "1px solid #FECACA",
    }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: "#991B1B", margin: 0 }}>{message}</p>
    </div>
  );
}

/* ─── Skeleton ────────────────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--oxford-10)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: "40%", height: 10, background: "var(--brand-50)", borderRadius: 4, marginBottom: 8 }} />
            <div style={{ width: "85%", height: 14, background: "var(--oxford-10)", borderRadius: 4 }} />
          </div>
        </div>
        <div style={{ width: "100%", height: 10, background: "var(--brand-50)", borderRadius: 4, marginBottom: 6 }} />
        <div style={{ width: "70%", height: 10, background: "var(--brand-50)", borderRadius: 4 }} />
      </div>
      <div style={{ borderTop: "1px solid var(--oxford-10)", padding: "10px 16px" }}>
        <div style={{ width: 90, height: 28, background: "var(--oxford-10)", borderRadius: 8 }} />
      </div>
    </div>
  );
}

/* ─── Shared styles ───────────────────────────────────────────────────────── */

const primaryBtnLink: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 700,
  background: "var(--brand)", color: "#fff", textDecoration: "none",
  boxShadow: "0 4px 14px rgba(16,81,183,0.25)",
};

const ghostBtn: React.CSSProperties = {
  padding: "7px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 600,
  background: "#fff", color: "var(--oxford)",
  border: "1px solid var(--oxford-10)", cursor: "pointer",
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

const IconSearch = () => (
  <svg width="16" height="16" strokeWidth="2" {...sw}
    style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--oxford-60)" }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const IconFile = () => (
  <svg width="20" height="20" strokeWidth="1.8" {...sw}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);
const IconDownload = () => (
  <svg width="14" height="14" strokeWidth="2" {...sw}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const IconFolder = () => (
  <svg width="28" height="28" strokeWidth="1.8" {...sw}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="13" height="13" strokeWidth="2.2" {...sw}
    style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
