"use client";

import { useEffect, useMemo, useState } from "react";
import {
  psychologistApi,
  getPsychologists,
  type BlogPost,
  type Psychologist,
  type FollowSummary,
} from "@/lib/api";
import { getMainSiteUrl } from "@/lib/auth";

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

type Tab = "FEED" | "DISCOVER";

/* ─── page ────────────────────────────────────────────────────────────────── */

export default function PsychologCommunityPage() {
  const [tab, setTab] = useState<Tab>("FEED");
  const [meId, setMeId] = useState<number | null>(null);

  const [feed, setFeed] = useState<BlogPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  const [all, setAll] = useState<Psychologist[]>([]);
  const [following, setFollowing] = useState<FollowSummary[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // İzlədiyim psixoloqların id-ləri — düymə vəziyyəti üçün.
  const followingIds = useMemo(() => new Set(following.map(f => f.id)), [following]);

  const loadFeed = () => {
    setFeedLoading(true);
    psychologistApi.feed().then(setFeed).catch(() => setFeed([])).finally(() => setFeedLoading(false));
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

  const toggleFollow = async (target: Psychologist) => {
    const isFollowing = followingIds.has(target.id);
    setBusyId(target.id);
    try {
      if (isFollowing) {
        await psychologistApi.unfollow(target.id);
        setFollowing(prev => prev.filter(f => f.id !== target.id));
      } else {
        await psychologistApi.follow(target.id);
        setFollowing(prev => [
          { id: target.id, name: target.name, title: target.title, photoUrl: target.photoUrl ?? null },
          ...prev,
        ]);
        // Yeni izləmə feed-i dəyişə bilər — arxa planda yenilə.
        loadFeed();
      }
    } catch (e) {
      alert("Əməliyyat alınmadı: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const discoverList = useMemo(() => {
    let list = all.filter(p => p.active && p.id !== meId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.title?.toLowerCase().includes(q) ||
        (p.specializations || []).some(s => s.toLowerCase().includes(q))
      );
    }
    // İzlənməyənlər öndə (kəşf üçün), sonra izlənənlər.
    return list.sort((a, b) => {
      const af = followingIds.has(a.id) ? 1 : 0;
      const bf = followingIds.has(b.id) ? 1 : 0;
      if (af !== bf) return af - bf;
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    });
  }, [all, meId, search, followingIds]);

  /* ─── render ────────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--oxford)", margin: 0 }}>İcma</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4, marginBottom: 0 }}>
          Həmkarlarınızı izləyin və onların yeni məqalələrindən xəbərdar olun.
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, background: "#fff", borderRadius: 12,
        padding: 6, border: "1px solid var(--oxford-10)", alignSelf: "flex-start",
      }}>
        <TabBtn active={tab === "FEED"} onClick={() => setTab("FEED")} count={feed.length}>Feed</TabBtn>
        <TabBtn active={tab === "DISCOVER"} onClick={() => setTab("DISCOVER")} count={following.length} countLabel="izlənir">
          Psixoloqlar
        </TabBtn>
      </div>

      {tab === "FEED" ? (
        <FeedView loading={feedLoading} items={feed} onGoDiscover={() => setTab("DISCOVER")} />
      ) : (
        <DiscoverView
          loading={discoverLoading}
          list={discoverList}
          followingIds={followingIds}
          busyId={busyId}
          search={search}
          onSearch={setSearch}
          onToggle={toggleFollow}
        />
      )}
    </div>
  );
}

/* ─── Feed tab ────────────────────────────────────────────────────────────── */

function FeedView({ loading, items, onGoDiscover }: {
  loading: boolean; items: BlogPost[]; onGoDiscover: () => void;
}) {
  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ height: 120, background: "var(--oxford-10)" }} />
            <div style={{ padding: 14 }}>
              <div style={{ width: "40%", height: 10, background: "var(--brand-50)", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ width: "85%", height: 14, background: "var(--oxford-10)", borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyCard
        title="Feed hələ boşdur"
        body="İzlədiyiniz psixoloqlar məqalə paylaşanda burada görünəcək. Başlamaq üçün həmkarlarınızı izləyin."
        actionLabel="Psixoloqları kəşf et"
        onAction={onGoDiscover}
      />
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
      {items.map(p => <FeedCard key={p.id} p={p} />)}
    </div>
  );
}

function FeedCard({ p }: { p: BlogPost }) {
  const excerpt = p.excerpt || stripHtml(p.content).slice(0, 150);
  const href = p.slug ? `${getMainSiteUrl()}/blog/${p.slug}` : "#";
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{
        background: "#fff", borderRadius: 14, border: "1px solid var(--oxford-10)",
        textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column",
        overflow: "hidden", transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
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
      <div style={{
        height: 120, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        background: p.coverImageUrl ? "transparent" : (p.categoryBg || "var(--brand-50)"),
      }}>
        {p.coverImageUrl ? (

          <img src={p.coverImageUrl} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 36, fontWeight: 800, color: p.categoryColor || "var(--brand-700)", opacity: 0.5 }}>
            {p.title?.[0]?.toUpperCase() || "A"}
          </span>
        )}
      </div>
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {p.category && (
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, alignSelf: "flex-start",
            background: p.categoryBg || "var(--brand-50)", color: p.categoryColor || "var(--brand-700)",
            textTransform: "uppercase", letterSpacing: 0.3,
          }}>{p.category}</span>
        )}
        <h3 style={{
          fontSize: 14.5, fontWeight: 700, color: "var(--oxford)", margin: 0, lineHeight: 1.3,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>{p.title || "Başlıqsız"}</h3>
        {excerpt && (
          <p style={{
            fontSize: 12.5, color: "var(--oxford-60)", margin: 0, lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{excerpt}</p>
        )}
        <div style={{
          marginTop: "auto", paddingTop: 8, display: "flex", alignItems: "center",
          justifyContent: "space-between", fontSize: 11, color: "var(--oxford-60)",
        }}>
          <span style={{ fontWeight: 600 }}>{p.authorName || "Psixoloq"}</span>
          <span>{fmtDate(p.publishedDate || p.createdAt)}</span>
        </div>
      </div>
    </a>
  );
}

/* ─── Discover tab ────────────────────────────────────────────────────────── */

function DiscoverView({ loading, list, followingIds, busyId, search, onSearch, onToggle }: {
  loading: boolean;
  list: Psychologist[];
  followingIds: Set<number>;
  busyId: number | null;
  search: string;
  onSearch: (v: string) => void;
  onToggle: (p: Psychologist) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ position: "relative", maxWidth: 360 }}>
        <input value={search} onChange={e => onSearch(e.target.value)}
          placeholder="Ad / ixtisas üzrə axtar…"
          style={{
            width: "100%", padding: "9px 12px", borderRadius: 10,
            border: "1.5px solid var(--oxford-10)", fontSize: 13,
            color: "var(--oxford)", outline: "none", boxSizing: "border-box",
          }} />
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 14, height: 96 }} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyCard title="Psixoloq tapılmadı" body="Axtarışa uyğun aktiv psixoloq yoxdur." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {list.map(p => (
            <PsychologistCard
              key={p.id}
              p={p}
              isFollowing={followingIds.has(p.id)}
              busy={busyId === p.id}
              onToggle={() => onToggle(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PsychologistCard({ p, isFollowing, busy, onToggle }: {
  p: Psychologist; isFollowing: boolean; busy: boolean; onToggle: () => void;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1px solid var(--oxford-10)",
      padding: 14, display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {p.photoUrl ? (

          <img src={p.photoUrl} alt={p.name}
            style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: p.bgColor || "var(--brand-50)", color: p.accentColor || "var(--brand-700)",
            fontSize: 16, fontWeight: 800,
          }}>{initials(p.name)}</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "var(--oxford)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{p.name}</div>
          <div style={{
            fontSize: 12, color: "var(--oxford-60)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{p.title}</div>
        </div>
      </div>

      {p.specializations && p.specializations.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {p.specializations.slice(0, 3).map((s, i) => (
            <span key={i} style={{
              fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
              background: "var(--brand-50)", color: "var(--brand-700)",
            }}>{s}</span>
          ))}
        </div>
      )}

      <button onClick={onToggle} disabled={busy}
        style={{
          marginTop: "auto", padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700,
          cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1,
          border: isFollowing ? "1.5px solid var(--oxford-10)" : "none",
          background: isFollowing ? "#fff" : "var(--brand)",
          color: isFollowing ? "var(--oxford-60)" : "#fff",
        }}>
        {busy ? "..." : isFollowing ? "İzlənir" : "İzlə"}
      </button>
    </div>
  );
}

/* ─── shared atoms ────────────────────────────────────────────────────────── */

function TabBtn({ active, count, countLabel, onClick, children }: {
  active: boolean; count: number; countLabel?: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 16px", borderRadius: 8, border: "none",
      background: active ? "var(--brand)" : "transparent",
      color: active ? "#fff" : "var(--oxford-60)",
      fontSize: 13, fontWeight: 700, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 7,
    }}>
      {children}
      <span style={{
        fontSize: 10.5, fontWeight: 700, padding: "0 6px", borderRadius: 999,
        background: active ? "rgba(255,255,255,0.25)" : "var(--oxford-10)",
        color: active ? "#fff" : "var(--oxford-60)", minWidth: 16, textAlign: "center",
      }}>{count}{countLabel ? "" : ""}</span>
    </button>
  );
}

function EmptyCard({ title, body, actionLabel, onAction }: {
  title: string; body: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div style={{
      textAlign: "center", padding: "56px 24px",
      background: "#fff", borderRadius: 16, border: "1px dashed var(--oxford-10)",
    }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", margin: "0 0 4px" }}>{title}</p>
      <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: "0 0 18px", lineHeight: 1.55 }}>{body}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} style={{
          padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: "var(--brand)", color: "#fff", border: "none", cursor: "pointer",
          boxShadow: "0 4px 14px rgba(16,81,183,0.25)",
        }}>{actionLabel}</button>
      )}
    </div>
  );
}
