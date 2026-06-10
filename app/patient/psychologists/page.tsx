"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getPsychologists, patientApi, type Psychologist } from "@/lib/api";
import { withSlugs } from "@/lib/slug";
import { useT } from "@/lib/i18n/LocaleProvider";

type SortMode = "recommended" | "rating" | "experience" | "newest";

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function ratingNum(r: string | undefined | null): number {
  if (!r) return 0;
  const n = parseFloat(r);
  return Number.isFinite(n) ? n : 0;
}

function experienceNum(s: string | undefined | null): number {
  if (!s) return 0;
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function sessionsNum(s: string | undefined | null): number {
  if (!s) return 0;
  const m = s.replace(/\D/g, "");
  return m ? Number(m) : 0;
}

export default function PatientPsychologistsPage() {
  const { t } = useT();
  const [items, setItems] = useState<Psychologist[]>([]);
  const [favIds, setFavIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [spec, setSpec] = useState<string | null>(null);
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [sort, setSort] = useState<SortMode>("recommended");
  const [busyFav, setBusyFav] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getPsychologists(), patientApi.favorites()])
      .then(([all, favs]) => {
        setItems(all.filter(p => p.active));
        setFavIds(new Set(favs.map(f => f.id)));
      })
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const itemsWithSlug = useMemo(() => withSlugs(items), [items]);

  // Specialization chips with counts
  const specChips = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of itemsWithSlug) {
      for (const s of p.specializations ?? []) {
        if (!s) continue;
        map.set(s, (map.get(s) ?? 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [itemsWithSlug]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = itemsWithSlug.filter(p => {
      if (onlyFavs && !favIds.has(p.id)) return false;
      if (spec && !(p.specializations ?? []).some(s => s === spec)) return false;
      if (query) {
        const hay = [p.name, p.title, ...(p.specializations ?? [])].join(" ").toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "rating":     return ratingNum(b.rating) - ratingNum(a.rating);
        case "experience": return experienceNum(b.experience) - experienceNum(a.experience);
        case "newest":     return (b.displayOrder ?? 0) - (a.displayOrder ?? 0);
        case "recommended":
        default: {
          // Favorites first, then rating, then displayOrder
          const fa = favIds.has(a.id) ? 1 : 0;
          const fb = favIds.has(b.id) ? 1 : 0;
          if (fa !== fb) return fb - fa;
          const r = ratingNum(b.rating) - ratingNum(a.rating);
          if (r !== 0) return r;
          return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
        }
      }
    });
    return list;
  }, [itemsWithSlug, q, spec, onlyFavs, sort, favIds]);

  const toggleFav = async (psyId: number) => {
    setBusyFav(psyId);
    try {
      await patientApi.toggleFavorite(psyId);
      setFavIds(prev => {
        const next = new Set(prev);
        if (next.has(psyId)) next.delete(psyId); else next.add(psyId);
        return next;
      });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyFav(null);
    }
  };

  const clearAll = () => { setQ(""); setSpec(null); setOnlyFavs(false); setSort("recommended"); };
  const hasFilters = q.trim() !== "" || spec !== null || onlyFavs;

  return (
    <div className="pcat">
      <header className="pcat__head">
        <div>
          <h1>{t("patPsy.pageTitle")}</h1>
          <p>{t("patPsy.pageSub")}</p>
        </div>
        <div className="pcat__search-wrap">
          <svg className="pcat__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder={t("patPsy.searchPh")}
            value={q}
            onChange={e => setQ(e.target.value)}
            className="pcat__search"
          />
        </div>
      </header>

      {specChips.length > 0 && (
        <div className="pcat__chips">
          <button
            className={`pcat__chip${spec === null ? " is-active" : ""}`}
            onClick={() => setSpec(null)}>
            Hamısı
            <span className="pcat__chip-n">{itemsWithSlug.length}</span>
          </button>
          {specChips.slice(0, 12).map(([label, count]) => (
            <button key={label}
              className={`pcat__chip${spec === label ? " is-active" : ""}`}
              onClick={() => setSpec(spec === label ? null : label)}>
              {label}
              <span className="pcat__chip-n">{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="pcat__toolbar">
        <div className="pcat__toolbar-left">
          <label className={`pcat__toggle${onlyFavs ? " is-active" : ""}`}>
            <input type="checkbox" checked={onlyFavs} onChange={e => setOnlyFavs(e.target.checked)} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            Yalnız sevimlilər
            {favIds.size > 0 && <span className="pcat__toggle-n">{favIds.size}</span>}
          </label>
          {hasFilters && (
            <button className="pcat__clear" onClick={clearAll}>× filterləri təmizlə</button>
          )}
        </div>
        <div className="pcat__sort">
          <label>Sıralama:</label>
          <select value={sort} onChange={e => setSort(e.target.value as SortMode)}>
            <option value="recommended">Tövsiyə</option>
            <option value="rating">Reytinq</option>
            <option value="experience">Təcrübə</option>
            <option value="newest">Yeni qoşulan</option>
          </select>
        </div>
      </div>

      {err && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {loading ? (
        <div className="pcat__skel">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="pcat__skel-card" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="pcat__empty">
          <div className="pcat__empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div className="pcat__empty-title">
            {hasFilters ? "Bu filtrlərə uyğun nəticə yoxdur" : t("patPsy.empty")}
          </div>
          {hasFilters && (
            <button onClick={clearAll} className="pcat__empty-cta">Filterləri təmizlə</button>
          )}
        </div>
      ) : (
        <div className="pcat__grid">
          {filtered.map(p => (
            <PsyCard
              key={p.id}
              p={p}
              favorite={favIds.has(p.id)}
              busy={busyFav === p.id}
              onToggleFav={() => toggleFav(p.id)}
              minLabel={t("patPsy.min")}
              viewLabel={t("patPsy.viewProfile")}
              bookLabel={t("patPsy.book")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PsyCard({
  p, favorite, busy, onToggleFav, minLabel, viewLabel, bookLabel,
}: {
  p: Psychologist & { slug?: string };
  favorite: boolean;
  busy: boolean;
  onToggleFav: () => void;
  minLabel: string;
  viewLabel: string;
  bookLabel: string;
}) {
  return (
    <article className="pcat-card">
      <button
        type="button"
        onClick={onToggleFav}
        disabled={busy}
        className={`pcat-card__fav${favorite ? " is-active" : ""}`}
        aria-label={favorite ? "Sevimlilərdən sil" : "Sevimliyə əlavə et"}
        title={favorite ? "Sevimlilərdən sil" : "Sevimliyə əlavə et"}>
        <svg width="16" height="16" viewBox="0 0 24 24"
          fill={favorite ? "currentColor" : "none"}
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>

      <div className="pcat-card__top">
        <div className="pcat-card__avatar">
          {p.photoUrl ? (
             
            <img src={p.photoUrl} alt={p.name} />
          ) : (
            <span>{initialsOf(p.name)}</span>
          )}
        </div>
        <div className="pcat-card__head-info">
          <div className="pcat-card__name">{p.name}</div>
          <div className="pcat-card__title">{p.title}</div>
        </div>
      </div>

      {p.specializations && p.specializations.length > 0 && (
        <div className="pcat-card__specs">
          {p.specializations.slice(0, 3).map(s => (
            <span key={s} className="pcat-card__spec">{s}</span>
          ))}
          {p.specializations.length > 3 && (
            <span className="pcat-card__spec pcat-card__spec--more">+{p.specializations.length - 3}</span>
          )}
        </div>
      )}

      <div className="pcat-card__stats">
        {ratingNum(p.rating) > 0 && (
          <div className="pcat-card__stat">
            <div className="pcat-card__stat-val">★ {ratingNum(p.rating).toFixed(1)}</div>
            <div className="pcat-card__stat-label">Reytinq</div>
          </div>
        )}
        {experienceNum(p.experience) > 0 && (
          <div className="pcat-card__stat">
            <div className="pcat-card__stat-val">{experienceNum(p.experience)} il</div>
            <div className="pcat-card__stat-label">Təcrübə</div>
          </div>
        )}
        {sessionsNum(p.sessionsCount) > 0 && (
          <div className="pcat-card__stat">
            <div className="pcat-card__stat-val">{sessionsNum(p.sessionsCount)}</div>
            <div className="pcat-card__stat-label">Seans</div>
          </div>
        )}
      </div>

      {(p.languages || p.defaultSessionMinutes) && (
        <div className="pcat-card__meta">
          {p.languages && <span>{p.languages}</span>}
          {p.defaultSessionMinutes && (
            <span>· {p.defaultSessionMinutes} {minLabel} seans</span>
          )}
        </div>
      )}

      <div className="pcat-card__actions">
        <Link href={p.slug ? `/patient/psychologists/${p.slug}` : "/patient/psychologists"}
          className="pcat-card__btn pcat-card__btn--ghost">
          {viewLabel}
        </Link>
        <Link href={p.slug ? `/patient/book/${p.slug}` : "/patient/psychologists"}
          className="pcat-card__btn pcat-card__btn--primary">
          {bookLabel}
        </Link>
      </div>
    </article>
  );
}
