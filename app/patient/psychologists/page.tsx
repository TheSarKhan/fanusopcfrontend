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

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = itemsWithSlug.filter(p => {
      if (onlyFavs && !favIds.has(p.id)) return false;
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
  }, [itemsWithSlug, q, onlyFavs, sort, favIds]);

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

  const clearAll = () => { setQ(""); setOnlyFavs(false); setSort("recommended"); };
  const hasFilters = q.trim() !== "" || onlyFavs;

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        @keyframes psyShimmer { 0% { background-position: -340px 0 } 100% { background-position: 340px 0 } }
        .psy-skel { background: linear-gradient(90deg,#EEF2F9 25%,#E2E9F4 37%,#EEF2F9 63%); background-size: 680px 100%; animation: psyShimmer 1.4s infinite linear; }
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

      {/* 2. TOOLBAR */}
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
  // Yalnız ilk üç ixtisas göstərilir; qalanı profil səhifəsindədir.
  const shown = specs.slice(0, 3);
  const rating = ratingNum(p.rating);
  const years = experienceNum(p.experience);
  const sessions = p.displayedSessionCount ?? sessionsNum(p.sessionsCount);
  const hasPackages = (p.packages?.length ?? 0) > 0;
  const profileHref = p.slug ? `/patient/psychologists/${p.slug}` : "/patient/psychologists";
  const bookHref = p.slug ? `/patient/book/${p.slug}` : "/patient/psychologists";

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 460, background: "#fff", borderRadius: 20, boxShadow: "0 2px 14px rgba(8,47,109,.06)", border: "1px solid #EDF1F8", padding: 24, display: "flex", flexDirection: "column" }}>
      <button
        type="button"
        onClick={onToggleFav}
        disabled={busy}
        title={favorite ? "Sevimlilərdən sil" : "Sevimliyə əlavə et"}
        aria-label={favorite ? "Sevimlilərdən sil" : "Sevimliyə əlavə et"}
        style={{ position: "absolute", top: 22, right: 22, width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", background: favorite ? "var(--brand-50)" : "#fff", border: "1.5px solid var(--brand-100)", borderRadius: 13, cursor: busy ? "wait" : "pointer" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill={favorite ? "var(--brand)" : "none"} stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
      </button>

      {/* Kimlik — dairəvi şəkil, təsdiq nişanı şəklin üstündə (ad yanında ayrıca
          etiket deyil), sonra ad və ixtisas. */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18, paddingRight: 56 }}>
        <span style={{ position: "relative", flex: "none" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 76, height: 76, borderRadius: "50%", background: p.accentColor || "var(--brand-700)", color: "#fff", fontSize: 22, fontWeight: 700, overflow: "hidden", boxShadow: "0 0 0 4px #fff, 0 0 0 5px #EDF1F8" }}>
            {p.photoUrl ? (

              <img src={p.photoUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : initialsOf(p.name)}
          </span>
          {verified && (
            <span
              title="Fanus təsdiqli psixoloq"
              aria-label="Fanus təsdiqli psixoloq"
              style={{ position: "absolute", right: -1, bottom: -1, width: 24, height: 24, borderRadius: "50%", background: "#10B981", border: "3px solid #fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </span>
          )}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: "var(--oxford)", lineHeight: 1.2, letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
          <div style={{ fontSize: 14.5, color: "var(--oxford-60)", fontWeight: 600, marginTop: 4 }}>{p.title}</div>
        </div>
      </div>

      {specs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBottom: 18 }}>
          {shown.map(s => (
            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 11 }}>
              <SpecIcon name={s} />{s}
            </span>
          ))}
        </div>
      )}

      {/* Rəqəmlər — dəyər üstdə, izah altda; aralarında nazik ayırıcı. */}
      <div style={{ display: "flex", alignItems: "stretch", padding: "16px 0", borderTop: "1px solid #F0F4FA", borderBottom: "1px solid #F0F4FA", marginBottom: 16 }}>
        {rating > 0 && (
          <StatCell
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="#F5B400" stroke="#F5B400" strokeWidth="1.5" strokeLinejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>}
            value={rating.toFixed(1)}
            label={(p.ratingCount ?? 0) > 0 ? `${p.ratingCount} rəy` : "Reytinq"}
            first
          />
        )}
        {years > 0 && (
          <StatCell
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-5A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" /></svg>}
            value={`${years} il`}
            label="təcrübə"
          />
        )}
        {p.defaultSessionMinutes && (
          <StatCell
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>}
            value={`${p.defaultSessionMinutes} dəq`}
            label="seans"
          />
        )}
        {sessions > 0 && (
          <StatCell
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>}
            value={String(sessions)}
            label="seans"
          />
        )}
      </div>

      {/* Detallar — ayırıcı nöqtə yoxdur, hər məlumat öz sətrindədir. */}
      {(p.languages || p.defaultSessionMinutes || hasPackages) && (
        <div style={{ background: "#F6F8FC", borderRadius: 14, padding: "16px 18px", marginBottom: 18, display: "grid", gap: 13 }}>
          {p.languages && (
            <InfoLine
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>}
              text={p.languages}
            />
          )}
          {p.defaultSessionMinutes && (
            <InfoLine
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>}
              text={`${p.defaultSessionMinutes} dəq seans`}
            />
          )}
          {hasPackages && (
            <InfoLine
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /></svg>}
              text="Paket təklifi var"
            />
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: "auto" }}>
        <Link href={profileHref} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, background: "#fff", color: "var(--brand)", border: "1.5px solid var(--brand-100)", borderRadius: 13, padding: "14px 0", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          {t("patPsy.viewProfile")}
        </Link>
        <Link href={bookHref} style={{ flex: 1.4, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, background: "var(--brand)", color: "#fff", border: "1.5px solid var(--brand)", borderRadius: 13, padding: "14px 0", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>
          {t("patPsy.book")}
        </Link>
      </div>

      <button
        type="button"
        onClick={onReview}
        disabled={reviewChecking}
        style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #F0F4FA", width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, background: "transparent", color: "var(--oxford-60)", border: "none", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: reviewChecking ? "wait" : "pointer" }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill={reviewed ? "#F5B400" : "none"} stroke={reviewed ? "#F5B400" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
        {reviewChecking ? "Yoxlanılır…" : reviewed ? "Rəyinizi düzəldin" : "Rəy yaz"}
      </button>
    </div>
  );
}

/** Rəqəm xanası — dəyər üstdə, izah altda, solunda nazik ayırıcı. */
function StatCell({ icon, value, label, first }: {
  icon: React.ReactNode; value: string; label: string; first?: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "0 6px", borderLeft: first ? "none" : "1px solid #F0F4FA" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        {icon}
        <span style={{ fontSize: 17, fontWeight: 800, color: "var(--oxford)", whiteSpace: "nowrap" }}>{value}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, marginTop: 3 }}>{label}</div>
    </div>
  );
}

/** Detal sətri — ikon + mətn, ayırıcı işarə işlədilmir. */
function InfoLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, fontWeight: 600, color: "var(--oxford)" }}>
      <span style={{ flex: "none", display: "inline-flex" }}>{icon}</span>
      <span style={{ minWidth: 0 }}>{text}</span>
    </div>
  );
}

/** İxtisas çipinin ikonu — ada görə seçilir, tapılmasa ümumi işarə. */
function SpecIcon({ name }: { name: string }) {
  const s = name.toLocaleLowerCase("az");
  const sw = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (s.includes("depress"))
    return <svg {...sw} aria-hidden><path d="M12 4a4 4 0 0 0-4 4 3 3 0 0 0-1 5.8V16a3 3 0 0 0 5 2.2A3 3 0 0 0 17 16v-2.2A3 3 0 0 0 16 8a4 4 0 0 0-4-4z" /><path d="M12 4v15" /></svg>;
  if (s.includes("anksi") || s.includes("stres") || s.includes("təşviş"))
    return <svg {...sw} aria-hidden><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 1 7 0" /><path d="M9 9h.01M15 9h.01" /></svg>;
  if (s.includes("münasibət") || s.includes("ailə") || s.includes("cütlük"))
    return <svg {...sw} aria-hidden><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1z" /></svg>;
  if (s.includes("uşaq") || s.includes("yeniyetmə"))
    return <svg {...sw} aria-hidden><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>;
  return <svg {...sw} aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>;
}

/* ─── Loading skeleton card ──────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 20, boxShadow: "0 2px 14px rgba(8,47,109,.06)", border: "1px solid #EDF1F8", padding: 24 }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 18, alignItems: "center" }}>
        <div className="psy-skel" style={{ width: 76, height: 76, borderRadius: "50%", flex: "none" }} />
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
