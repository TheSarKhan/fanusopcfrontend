"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getPsychologists, patientApi, type Psychologist, type MyReview } from "@/lib/api";
import { toast } from "@/components/Toast";
import { withSlugs } from "@/lib/slug";
import { useT } from "@/lib/i18n/LocaleProvider";
import PageHeader from "@/components/PageHeader";
import ReviewModal from "@/app/patient/appointments/ReviewModal";
import FanusAssignWizard from "@/components/FanusAssignWizard";

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
  const [q, setQ] = useState("");
  const [spec, setSpec] = useState<string | null>(null);
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [sort, setSort] = useState<SortMode>("recommended");
  const [busyFav, setBusyFav] = useState<number | null>(null);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [reviewFor, setReviewFor] = useState<Psychologist | null>(null);
  const [reviewInitial, setReviewInitial] = useState<MyReview | null>(null);
  const [reviewBusy, setReviewBusy] = useState<number | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    Promise.all([getPsychologists(), patientApi.favorites(), patientApi.myReviews().catch(() => [] as MyReview[])])
      .then(([all, favs, revs]) => {
        setItems(all.filter(p => p.active));
        setFavIds(new Set(favs.map(f => f.id)));
        setMyReviews(revs);
      })
      .catch(e => toast((e as Error).message, "error"))
      .finally(() => setLoading(false));
  }, []);

  // Rəy yaz — artıq rəy varsa redaktə; yoxdursa serverdən uyğunluğu (tamamlanmış
  // seans) yoxla, uyğun deyilsə aydın mesaj göstər (backend qaydası ilə eyni).
  const openReview = async (p: Psychologist) => {
    const existing = myReviews.find(r => r.psychologistId === p.id) ?? null;
    if (existing) { setReviewInitial(existing); setReviewFor(p); return; }
    if (reviewBusy) return;
    setReviewBusy(p.id);
    try {
      const { canReview } = await patientApi.canReview(p.id);
      if (!canReview) {
        toast("Rəy yazmaq üçün psixoloqla ən azı bir tamamlanmış seansınız olmalıdır.", "error");
        return;
      }
      setReviewInitial(null); setReviewFor(p);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setReviewBusy(null);
    }
  };

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
    <div style={{ width: "100%" }}>
      <style>{`
        @keyframes psyShimmer { 0% { background-position: -340px 0 } 100% { background-position: 340px 0 } }
        .psy-skel { background: linear-gradient(90deg,#EEF2F9 25%,#E2E9F4 37%,#EEF2F9 63%); background-size: 680px 100%; animation: psyShimmer 1.4s infinite linear; }
        .psy-chips::-webkit-scrollbar { height: 0 }
      `}</style>

      {/* 1. HEADER + SEARCH */}
      <PageHeader
        title={t("patPsy.pageTitle")}
        subtitle={t("patPsy.pageSub")}
        actions={
          <div style={{ position: "relative", minWidth: 280, flex: 1, maxWidth: 360 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9DB0CC" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={t("patPsy.searchPh")}
              aria-label={t("patPsy.searchPh")}
              style={{ width: "100%", border: "1px solid #D6E2F7", background: "#fff", borderRadius: 11, padding: "12px 14px 12px 42px", fontSize: 14, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit", boxShadow: "0 2px 12px rgba(0,0,0,.04)" }}
            />
          </div>
        }
      />

      {/* 2. SPECIALIZATION CHIPS */}
      {specChips.length > 0 && (
        <div className="psy-chips" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, marginBottom: 18 }}>
          <ChipButton label="Hamısı" count={itemsWithSlug.length} active={spec === null} onClick={() => setSpec(null)} />
          {specChips.slice(0, 12).map(([label, count]) => (
            <ChipButton key={label} label={label} count={count} active={spec === label} onClick={() => setSpec(spec === label ? null : label)} />
          ))}
        </div>
      )}

      {/* 3. TOOLBAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setOnlyFavs(v => !v)}
            style={{ display: "inline-flex", alignItems: "center", gap: 9, background: onlyFavs ? "var(--brand-100)" : "#fff", color: onlyFavs ? "var(--brand-700)" : "var(--oxford-60)", border: `1px solid ${onlyFavs ? "var(--brand-100)" : "#D6E2F7"}`, borderRadius: 10, padding: "10px 15px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill={onlyFavs ? "var(--brand-700)" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
            Yalnız sevimlilər
            {favIds.size > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 6px", background: onlyFavs ? "#fff" : "var(--brand-50)", color: "var(--brand-700)", fontSize: 11, fontWeight: 700, borderRadius: 999 }}>{favIds.size}</span>
            )}
          </button>
          {hasFilters && (
            <button type="button" onClick={clearAll} style={{ background: "none", border: "none", color: "var(--oxford-60)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              × Filtrləri təmizlə
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--oxford-60)" }}>Sıralama:</span>
          <div style={{ position: "relative" }}>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortMode)}
              aria-label="Sıralama"
              style={{ appearance: "none", WebkitAppearance: "none", background: "#fff", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 38px 10px 14px", fontSize: 14, fontWeight: 600, color: "var(--oxford)", fontFamily: "inherit", cursor: "pointer" }}>
              <option value="recommended">Tövsiyə</option>
              <option value="rating">Reytinq</option>
              <option value="experience">Təcrübə</option>
              <option value="newest">Yeni qoşulan</option>
            </select>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      {/* 3.5 "Fanus təyin etsin" — hansı psixoloqu seçəcəyini bilməyən pasiyent
          seçimi bizə həvalə edir; müraciət operator hovuzuna düşür. Filtrlərdən
          asılı olmasın deyə şəbəkədən kənarda, həmişə görünür. */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap",
        border: "1.5px solid var(--brand-100, #D8E2EF)",
        background: "var(--brand-50, #F4F8FF)",
        borderRadius: 14, padding: "16px 18px", marginBottom: 20,
      }}>
        <div style={{ minWidth: 240, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford, #0B1A35)" }}>
            Hansı psixoloqu seçəcəyinizi bilmirsiniz?
          </div>
          <div style={{ fontSize: 13, color: "var(--oxford-60, #52718F)", marginTop: 4, lineHeight: 1.55 }}>
            Bir neçə sual verək — ehtiyacınıza uyğun psixoloqu Fanus təyin etsin.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAssignOpen(true)}
          className="fanus-btn fanus-btn-primary"
          style={{ flex: "none" }}
        >
          Fanus təyin etsin
        </button>
      </div>

      {/* 4. CARDS / STATES */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 20 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onClear={clearAll} emptyMsg={t("patPsy.empty")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 20 }}>
          {filtered.map(p => (
            <PsyCard
              key={p.id}
              p={p}
              favorite={favIds.has(p.id)}
              busy={busyFav === p.id}
              onToggleFav={() => toggleFav(p.id)}
              reviewed={myReviews.some(r => r.psychologistId === p.id)}
              reviewChecking={reviewBusy === p.id}
              onReview={() => openReview(p)}
            />
          ))}
        </div>
      )}

      <FanusAssignWizard open={assignOpen} onClose={() => setAssignOpen(false)} />

      {reviewFor && (
        <ReviewModal
          psychologistId={reviewFor.id}
          psychologistName={reviewFor.name}
          initial={reviewInitial ?? undefined}
          onClose={() => { setReviewFor(null); setReviewInitial(null); }}
          onSubmitted={(saved) => {
            setMyReviews(prev => [saved, ...prev.filter(r => r.id !== saved.id)]);
            setReviewFor(null);
            setReviewInitial(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Specialization chip ────────────────────────────────────────────────── */

function ChipButton({
  label, count, active, onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 8, border: `1px solid ${active ? "var(--brand)" : "#D6E2F7"}`, background: active ? "var(--brand)" : "#fff", color: active ? "#fff" : "var(--oxford)", borderRadius: 999, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
      {label}
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 6px", background: active ? "rgba(255,255,255,.22)" : "var(--brand-50)", color: active ? "#fff" : "var(--brand-700)", fontSize: 11, fontWeight: 700, borderRadius: 999 }}>{count}</span>
    </button>
  );
}

/* ─── Psychologist card ──────────────────────────────────────────────────── */

function PsyCard({
  p, favorite, busy, onToggleFav, reviewed, reviewChecking, onReview,
}: {
  p: Psychologist & { slug?: string };
  favorite: boolean;
  busy: boolean;
  onToggleFav: () => void;
  reviewed: boolean;
  reviewChecking: boolean;
  onReview: () => void;
}) {
  const { t } = useT();
  const verified = p.psychologistType === "FANUS";
  const specs = p.specializations ?? [];
  const shown = specs.slice(0, 3);
  const more = specs.length - shown.length;
  const rating = ratingNum(p.rating);
  const years = experienceNum(p.experience);
  const sessions = p.displayedSessionCount ?? sessionsNum(p.sessionsCount);
  const hasPackages = (p.packages?.length ?? 0) > 0;
  const profileHref = p.slug ? `/patient/psychologists/${p.slug}` : "/patient/psychologists";
  const bookHref = p.slug ? `/patient/book/${p.slug}` : "/patient/psychologists";

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 420, background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 22, display: "flex", flexDirection: "column" }}>
      <button
        type="button"
        onClick={onToggleFav}
        disabled={busy}
        title={favorite ? "Sevimlilərdən sil" : "Sevimliyə əlavə et"}
        aria-label={favorite ? "Sevimlilərdən sil" : "Sevimliyə əlavə et"}
        style={{ position: "absolute", top: 16, right: 16, width: 38, height: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", background: favorite ? "var(--brand-100)" : "#fff", border: `1px solid ${favorite ? "var(--brand-100)" : "#E1E9F5"}`, borderRadius: 11, cursor: busy ? "wait" : "pointer" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={favorite ? "var(--brand)" : "none"} stroke={favorite ? "var(--brand)" : "#9DB0CC"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16, paddingRight: 44 }}>
        <span style={{ width: 56, height: 56, borderRadius: 16, background: p.accentColor || "var(--brand-700)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flex: "none", overflow: "hidden" }}>
          {p.photoUrl ? (
             
            <img src={p.photoUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : initialsOf(p.name)}
        </span>
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 16.5, fontWeight: 700, color: "var(--oxford)", lineHeight: 1.2 }}>{p.name}</span>
            {verified && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--brand-100)", color: "var(--brand-700)", fontSize: 10, fontWeight: 800, letterSpacing: ".06em", padding: "3px 8px", borderRadius: 999 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l7 3v6c0 4.5-3 8.3-7 9.5C8 19.3 5 15.5 5 11V5z" /><path d="M9 12l2 2 4-4" />
                </svg>
                FANUS
              </span>
            )}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 600 }}>{p.title}</div>
        </div>
      </div>

      {specs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
          {shown.map(s => (
            <span key={s} style={{ background: "var(--brand-50)", color: "var(--brand-700)", border: "1px solid var(--brand-100)", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 8 }}>{s}</span>
          ))}
          {more > 0 && (
            <span style={{ background: "#fff", color: "var(--oxford-60)", border: "1px solid var(--brand-100)", fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 8 }}>+{more}</span>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "13px 0", borderTop: "1px solid #F0F4FA", borderBottom: "1px solid #F0F4FA", marginBottom: 14, flexWrap: "wrap" }}>
        {rating > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--oxford)" }}>{rating.toFixed(1)}</span>
            <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>{(p.ratingCount ?? 0) > 0 ? `${p.ratingCount} rəy` : "Reytinq"}</span>
          </div>
        )}
        {years > 0 && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--oxford)" }}>{years}</span>
            <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>il təcrübə</span>
          </div>
        )}
        {sessions > 0 && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--oxford)" }}>{sessions}</span>
            <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>seans</span>
          </div>
        )}
      </div>

      {(p.languages || p.defaultSessionMinutes) && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 16, flexWrap: "wrap" }}>
          {p.languages && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
              {p.languages}
            </span>
          )}
          {p.languages && p.defaultSessionMinutes && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#CBD5E6" }} />}
          {p.defaultSessionMinutes && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {p.defaultSessionMinutes} dəq seans
            </span>
          )}
        </div>
      )}

      {hasPackages && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 18 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#D1FAE5", color: "#065F46", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /></svg>
            Paketlər var
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
        <Link href={profileHref} style={{ flex: 1, textAlign: "center", background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          {t("patPsy.viewProfile")}
        </Link>
        <Link href={bookHref} style={{ flex: 1, textAlign: "center", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 600, textDecoration: "none", boxShadow: "0 4px 12px rgba(16,81,183,.24)" }}>
          {t("patPsy.book")}
        </Link>
      </div>

      <button
        type="button"
        onClick={onReview}
        disabled={reviewChecking}
        style={{ marginTop: 10, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "transparent", color: "var(--oxford-60)", border: "none", padding: "6px 0", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: reviewChecking ? "wait" : "pointer" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill={reviewed ? "#F59E0B" : "none"} stroke={reviewed ? "#F59E0B" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
        {reviewChecking ? "Yoxlanılır…" : reviewed ? "Rəyinizi düzəldin" : "Rəy yaz"}
      </button>
    </div>
  );
}

/* ─── Loading skeleton card ──────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 22 }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
        <div className="psy-skel" style={{ width: 56, height: 56, borderRadius: 16, flex: "none" }} />
        <div style={{ flex: 1, paddingTop: 4 }}>
          <div className="psy-skel" style={{ width: "70%", height: 15, borderRadius: 6, marginBottom: 9 }} />
          <div className="psy-skel" style={{ width: "45%", height: 12, borderRadius: 6 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 7, marginBottom: 18 }}>
        <div className="psy-skel" style={{ width: 72, height: 26, borderRadius: 8 }} />
        <div className="psy-skel" style={{ width: 88, height: 26, borderRadius: 8 }} />
        <div className="psy-skel" style={{ width: 60, height: 26, borderRadius: 8 }} />
      </div>
      <div className="psy-skel" style={{ width: "100%", height: 44, borderRadius: 8, marginBottom: 16 }} />
      <div className="psy-skel" style={{ width: "55%", height: 22, borderRadius: 6, marginBottom: 18 }} />
      <div style={{ display: "flex", gap: 10 }}>
        <div className="psy-skel" style={{ flex: 1, height: 42, borderRadius: 10 }} />
        <div className="psy-skel" style={{ flex: 1, height: 42, borderRadius: 10 }} />
      </div>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({
  hasFilters, onClear, emptyMsg,
}: {
  hasFilters: boolean;
  onClear: () => void;
  emptyMsg: string;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "56px 24px", textAlign: "center" }}>
      <div style={{ width: 60, height: 60, borderRadius: 17, background: "var(--brand-50)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18, color: "#9DB0CC" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", marginBottom: 7 }}>
        {hasFilters ? "Bu filtrlərə uyğun nəticə yoxdur" : emptyMsg}
      </div>
      <div style={{ fontSize: 14, color: "var(--oxford-60)", fontWeight: 500, marginBottom: 22 }}>
        Axtarışı dəyişin və ya filtrləri sıfırlayın.
      </div>
      {hasFilters && (
        <button type="button" onClick={onClear} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
          Filterləri təmizlə
        </button>
      )}
    </div>
  );
}
