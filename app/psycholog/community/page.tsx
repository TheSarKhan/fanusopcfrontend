"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  psychologistApi,
  getPsychologists,
  type BlogPost,
  type Psychologist,
  type FollowSummary,
} from "@/lib/api";
import { toast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}
function stripHtml(html?: string) {
  return (html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "P";
}

const FEED_PAGE_SIZE = 20;

/* ─── page (full-width feed + üfüqi tövsiyə karuseli) ───────────────────────── */

export default function PsychologCommunityPage() {
  const [meId, setMeId] = useState<number | null>(null);
  const [feed, setFeed] = useState<BlogPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedTotal, setFeedTotal] = useState(0);
  const [feedPage, setFeedPage] = useState(0);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [all, setAll] = useState<Psychologist[]>([]);
  const [following, setFollowing] = useState<FollowSummary[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const followingIds = useMemo(() => new Set(following.map(f => f.id)), [following]);

  const loadFeed = () => {
    setFeedLoading(true);
    psychologistApi.feedPaged({ page: 0, size: FEED_PAGE_SIZE })
      .then(res => { setFeed(res.content); setFeedTotal(res.totalElements); setFeedPage(0); })
      .catch(() => { setFeed([]); setFeedTotal(0); setFeedPage(0); })
      .finally(() => setFeedLoading(false));
  };
  const loadMoreFeed = () => {
    setFeedLoadingMore(true);
    psychologistApi.feedPaged({ page: feedPage + 1, size: FEED_PAGE_SIZE })
      .then(res => {
        setFeed(prev => [...prev, ...res.content]);
        setFeedTotal(res.totalElements);
        setFeedPage(res.page);
      })
      .catch(() => {})
      .finally(() => setFeedLoadingMore(false));
  };
  const loadDiscover = () => {
    setDiscoverLoading(true);
    Promise.all([getPsychologists(), psychologistApi.following()])
      .then(([list, mine]) => { setAll(list); setFollowing(mine); })
      .catch(() => { setAll([]); setFollowing([]); })
      .finally(() => setDiscoverLoading(false));
  };

  useEffect(() => {
    psychologistApi.me().then(p => setMeId(p.id)).catch(() => {});
    loadFeed();
    loadDiscover();
  }, []);

  const follow = async (target: Psychologist) => {
    setBusyId(target.id);
    try {
      await psychologistApi.follow(target.id);
      setFollowing(prev => [
        { id: target.id, name: target.name, title: target.title, photoUrl: target.photoUrl ?? null },
        ...prev,
      ]);
      loadFeed();
    } catch (e) {
      toast("Əməliyyat alınmadı: " + (e as Error).message, "error");
    } finally {
      setBusyId(null);
    }
  };

  // Kəşf karuseli: aktiv, mən deyiləm, hələ izləmədiyim psixoloqlar.
  const recommend = useMemo(() => {
    return all
      .filter(p => p.active && p.id !== meId && !followingIds.has(p.id))
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }, [all, meId, followingIds]);

  return (
    <div className="pcom-page">
      <PageHeader
        title="İcma"
        subtitle="Həmkarlarınızı izləyin, profillərinə baxın və yeni məqalələrindən xəbərdar olun."
      />

      {/* ── Tövsiyə karuseli ──────────────────────────────────────────── */}
      {discoverLoading ? (
        <RecommendCarouselSkeleton />
      ) : recommend.length > 0 ? (
        <RecommendCarousel
          items={recommend}
          busyId={busyId}
          onFollow={follow}
        />
      ) : null}

      {/* ── Feed (tam en) ─────────────────────────────────────────────── */}
      <main className="pcom-main">
        <div className="pcom-section-title">
          İzlədiklərinizin məqalələri
          {following.length > 0 && <span className="pcom-count">{following.length} izlənir</span>}
        </div>

        {feedLoading ? (
          <div className="pcom-feed">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="pcom-feedcard">
                <div className="ui-skeleton" style={{ height: 130, borderRadius: 0 }} />
                <div style={{ padding: 14 }}>
                  <div className="ui-skeleton" style={{ width: "40%", height: 10, marginBottom: 8 }} />
                  <div className="ui-skeleton" style={{ width: "85%", height: 14 }} />
                </div>
              </div>
            ))}
          </div>
        ) : feed.length === 0 ? (
          <EmptyState
            title="Feed hələ boşdur"
            sub="İzlədiyiniz psixoloqlar məqalə paylaşanda burada görünəcək. Yuxarıdakı tövsiyələrdən başlayın."
          />
        ) : (
          <>
            <div className="pcom-feed">
              {feed.map(p => <FeedCard key={p.id} p={p} />)}
            </div>
            {feed.length < feedTotal && (
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button type="button" onClick={loadMoreFeed} disabled={feedLoadingMore}
                  style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: feedLoadingMore ? "wait" : "pointer", opacity: feedLoadingMore ? 0.7 : 1 }}>
                  {feedLoadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(FEED_PAGE_SIZE, feedTotal - feed.length)})`}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ─── Tövsiyə karuseli ──────────────────────────────────────────────────────── */

function RecommendCarousel({ items, busyId, onFollow }: {
  items: Psychologist[]; busyId: number | null; onFollow: (p: Psychologist) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  return (
    <section className="pcom-carousel">
      <div className="pcom-carousel__head">
        <div className="pcom-section-title">Tanıya biləcəyiniz psixoloqlar</div>
        <div className="pcom-carousel__nav">
          <button type="button" aria-label="Geri" onClick={() => scrollBy(-1)} className="pcom-carousel__arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button type="button" aria-label="İrəli" onClick={() => scrollBy(1)} className="pcom-carousel__arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      <div className="pcom-carousel__track" ref={trackRef}>
        {items.map(p => (
          <PsyCard key={p.id} p={p} busy={busyId === p.id} onFollow={() => onFollow(p)} />
        ))}
      </div>
    </section>
  );
}

function PsyCard({ p, busy, onFollow }: { p: Psychologist; busy: boolean; onFollow: () => void }) {
  const sessions = p.displayedSessionCount ?? p.sessionsCount ?? null;
  const specs = (p.specializations || []).slice(0, 2);
  return (
    <div className="pcom-pcard">
      <Link href={`/psycholog/community/${p.id}`} className="pcom-pcard__top">
        {p.photoUrl ? (
          <img src={p.photoUrl} alt={p.name} className="pcom-pcard__avatar" />
        ) : (
          <span className="pcom-pcard__avatar pcom-pcard__avatar--ph"
            style={{ background: p.bgColor || "var(--brand-50)", color: p.accentColor || "var(--brand-700)" }}>
            {initials(p.name)}
          </span>
        )}
        <div className="pcom-pcard__name">{p.name}</div>
        <div className="pcom-pcard__title">{p.title}</div>

        {specs.length > 0 && (
          <div className="pcom-pcard__specs">
            {specs.map((s, i) => <span key={i} className="pcom-spec">{s}</span>)}
          </div>
        )}

        {(p.rating || sessions != null) && (
          <div className="pcom-pcard__stat">
            {p.rating && (
              <span className="pcom-pcard__rating">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" /></svg>
                {p.rating}
              </span>
            )}
            {sessions != null && <span className="pcom-pcard__sessions">{sessions} seans</span>}
          </div>
        )}
      </Link>

      <button onClick={onFollow} disabled={busy} className="pcom-follow-btn pcom-pcard__follow">
        {busy ? "…" : "+ İzlə"}
      </button>
    </div>
  );
}

function RecommendCarouselSkeleton() {
  return (
    <section className="pcom-carousel">
      <div className="pcom-carousel__head">
        <div className="ui-skeleton" style={{ width: 220, height: 16 }} />
      </div>
      <div className="pcom-carousel__track">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="pcom-pcard">
            <div className="ui-skeleton" style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 10px" }} />
            <div className="ui-skeleton" style={{ width: "70%", height: 12, margin: "0 auto 6px" }} />
            <div className="ui-skeleton" style={{ width: "50%", height: 10, margin: "0 auto 14px" }} />
            <div className="ui-skeleton" style={{ width: "100%", height: 32, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Feed card ──────────────────────────────────────────────────────────── */

function FeedCard({ p }: { p: BlogPost }) {
  const excerpt = p.excerpt || stripHtml(p.content).slice(0, 160);
  return (
    <Link href={`/psycholog/community/post/${p.id}`} className="pcom-feedcard pcom-feedcard--link">
      <div className="pcom-feedcard__cover" style={{ background: p.coverImageUrl ? "transparent" : (p.categoryBg || "var(--brand-50)") }}>
        {p.coverImageUrl ? (
          <img src={p.coverImageUrl} alt={p.title} />
        ) : (
          <span style={{ color: p.categoryColor || "var(--brand-700)" }}>{p.title?.[0]?.toUpperCase() || "A"}</span>
        )}
      </div>
      <div className="pcom-feedcard__body">
        {p.category && (
          <span className="pcom-feedcard__cat" style={{ background: p.categoryBg || "var(--brand-50)", color: p.categoryColor || "var(--brand-700)" }}>
            {p.category}
          </span>
        )}
        <h3>{p.title || "Başlıqsız"}</h3>
        {excerpt && <p>{excerpt}</p>}
        <div className="pcom-feedcard__foot">
          <span>{p.authorName || "Psixoloq"}</span>
          <span>{fmtDate(p.publishedDate || p.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
