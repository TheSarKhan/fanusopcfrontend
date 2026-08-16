"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  psychologistApi,
  getPsychologists,
  getBlogPosts,
  type BlogPost,
  type Psychologist,
  type FollowStatus,
} from "@/lib/api";
import { toast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { useT } from "@/lib/i18n/LocaleProvider";

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

export default function CommunityProfilePage() {
  const { t } = useT();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [peer, setPeer] = useState<Psychologist | null>(null);
  const [status, setStatus] = useState<FollowStatus | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    setLoading(true);
    Promise.all([
      getPsychologists().then(list => list.find(p => p.id === id) ?? null).catch(() => null),
      psychologistApi.followStatus(id).catch(() => null),
      getBlogPosts().catch(() => [] as BlogPost[]),
    ]).then(([p, st, all]) => {
      setPeer(p);
      setStatus(st);
      setPosts(p?.userId != null ? all.filter(b => b.authorId === p.userId) : []);
    }).finally(() => setLoading(false));
  }, [id]);

  const toggleFollow = async () => {
    if (!peer || !status) return;
    setBusy(true);
    try {
      if (status.following) {
        await psychologistApi.unfollow(peer.id);
        setStatus({ ...status, following: false, followerCount: Math.max(0, status.followerCount - 1) });
      } else {
        await psychologistApi.follow(peer.id);
        setStatus({ ...status, following: true, followerCount: status.followerCount + 1 });
      }
    } catch (e) {
      toast(t("psyCommunity.opFailedPrefix") + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => {
    if (!peer) return [];
    return [
      { label: t("psyCommunity.statRating"), value: peer.rating || "—" },
      { label: t("psyCommunity.statSessions"), value: String(peer.displayedSessionCount ?? peer.sessionsCount ?? "—") },
      { label: t("psyCommunity.statExperience"), value: peer.experience || "—" },
      { label: t("psyCommunity.statFollowers"), value: String(status?.followerCount ?? 0) },
    ];
  }, [peer, status, t]);

  return (
    <div className="pcom-profile">
      <Link href="/psycholog/community" className="pcli-back">{t("psyCommunity.backToCommunity")}</Link>

      {loading ? (
        <div className="ui-skeleton" style={{ height: 220, borderRadius: 16 }} />
      ) : !peer ? (
        <EmptyState title={t("psyCommunity.notFoundTitle")} sub={t("psyCommunity.notFoundSub")} />
      ) : (
        <>
          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="pcom-prof-hero">
            {peer.photoUrl ? (
              <img src={peer.photoUrl} alt={peer.name} className="pcom-prof-avatar" />
            ) : (
              <span className="pcom-prof-avatar pcom-prof-avatar--ph"
                style={{ background: peer.bgColor || "var(--brand-50)", color: peer.accentColor || "var(--brand-700)" }}>
                {initials(peer.name)}
              </span>
            )}
            <div className="pcom-prof-info">
              <h1>{peer.name}</h1>
              <div className="pcom-prof-title">{peer.title}</div>
              {peer.specializations?.length > 0 && (
                <div className="pcom-prof-specs">
                  {peer.specializations.slice(0, 5).map((s, i) => (
                    <span key={i} className="pcom-spec">{s}</span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={toggleFollow} disabled={busy}
              className={`pcom-follow-btn pcom-follow-btn--lg${status?.following ? " is-following" : ""}`}>
              {busy ? t("psyCommunity.busyEllipsis") : status?.following ? t("psyCommunity.following") : t("psyCommunity.followCtaShort")}
            </button>
          </div>

          {/* ── Stats ──────────────────────────────────────────────── */}
          <div className="pcom-prof-stats">
            {stats.map(s => (
              <div key={s.label} className="pcom-prof-stat">
                <div className="pcom-prof-stat__val">{s.value}</div>
                <div className="pcom-prof-stat__lbl">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Bio ────────────────────────────────────────────────── */}
          {peer.bio && (
            <div className="pcom-prof-card">
              <div className="pcom-section-title">{t("psyCommunity.aboutTitle")}</div>
              <p className="pcom-prof-bio">{peer.bio}</p>
            </div>
          )}

          {/* ── Articles ───────────────────────────────────────────── */}
          <div className="pcom-prof-card">
            <div className="pcom-section-title">{t("psyCommunity.articlesTitle")} <span className="pcom-count">{posts.length}</span></div>
            {posts.length === 0 ? (
              <div className="pcom-muted-note">{t("psyCommunity.noArticles")}</div>
            ) : (
              <div className="pcom-prof-articles">
                {posts.map(p => (
                  <Link key={p.id} href={`/psycholog/community/post/${p.id}`} className="pcom-art-row">
                    <div className="pcom-art-row__main">
                      <div className="pcom-art-row__title">{p.title || t("psyCommunity.untitled")}</div>
                      <p className="pcom-art-row__ex">{p.excerpt || stripHtml(p.content).slice(0, 140)}</p>
                    </div>
                    <span className="pcom-art-row__date">{fmtDate(p.publishedDate || p.createdAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
