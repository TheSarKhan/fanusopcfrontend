"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  psychologistApi,
  getPsychologists,
  type ArticleComment,
  type ArticleReader,
  type Psychologist,
} from "@/lib/api";
import { toast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function fmtDateTime(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  const date = `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
  const time = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  return `${date} · ${time}`;
}
function initials(name?: string | null) {
  return (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "P";
}

/* ─── page ────────────────────────────────────────────────────────────────── */

export default function CommunityArticleReaderPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [data, setData] = useState<ArticleReader | null>(null);
  const [authorPsy, setAuthorPsy] = useState<Psychologist | null>(null);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [liking, setLiking] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.communityPost(id),
      psychologistApi.communityComments(id).catch(() => [] as ArticleComment[]),
      getPsychologists().catch(() => [] as Psychologist[]),
    ]).then(([reader, cmts, psys]) => {
      setData(reader);
      setComments(cmts);
      const a = reader.post.authorId != null ? psys.find(p => p.userId === reader.post.authorId) ?? null : null;
      setAuthorPsy(a);
    }).catch(() => setNotFound(true)).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!Number.isFinite(id)) { setNotFound(true); setLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toggleLike = async () => {
    if (!data || liking) return;
    setLiking(true);
    try {
      const updated = data.likedByMe
        ? await psychologistApi.unlikePost(id)
        : await psychologistApi.likePost(id);
      setData(updated);
    } catch (e) {
      toast("Əməliyyat alınmadı: " + (e as Error).message, "error");
    } finally {
      setLiking(false);
    }
  };

  const refreshComments = async () => {
    const [cmts, reader] = await Promise.all([
      psychologistApi.communityComments(id).catch(() => comments),
      psychologistApi.communityPost(id).catch(() => data!),
    ]);
    setComments(cmts);
    if (reader) setData(reader);
  };

  const post = data?.post;

  return (
    <div className="pread">
      <Link href="/psycholog/community" className="pcli-back">← İcmaya qayıt</Link>

      {loading ? (
        <>
          <div className="ui-skeleton" style={{ height: 260, borderRadius: 16, marginBottom: 16 }} />
          <div className="ui-skeleton" style={{ height: 200, borderRadius: 16 }} />
        </>
      ) : notFound || !post ? (
        <EmptyState title="Məqalə tapılmadı" sub="Bu məqalə mövcud deyil və ya artıq dərc olunmur." />
      ) : (
        <>
          {/* ── Article ─────────────────────────────────────────────── */}
          <article className="pread-article">
            {post.coverImageUrl && (
              <div className="pread-cover">
                <img src={post.coverImageUrl} alt={post.title} />
              </div>
            )}

            <div className="pread-body">
              {post.category && (
                <span className="pcom-feedcard__cat"
                  style={{ background: post.categoryBg || "var(--brand-50)", color: post.categoryColor || "var(--brand-700)" }}>
                  {post.category}
                </span>
              )}
              <h1 className="pread-title">{post.title}</h1>

              {/* author + meta */}
              <div className="pread-meta">
                {authorPsy ? (
                  <Link href={`/psycholog/community/${authorPsy.id}`} className="pread-author">
                    {authorPsy.photoUrl ? (
                      <img src={authorPsy.photoUrl} alt={authorPsy.name} className="pread-author__avatar" />
                    ) : (
                      <span className="pread-author__avatar pread-author__avatar--ph">{initials(post.authorName)}</span>
                    )}
                    <span className="pread-author__txt">
                      <span className="pread-author__name">{authorPsy.name}</span>
                      <span className="pread-author__sub">{authorPsy.title}</span>
                    </span>
                  </Link>
                ) : (
                  <span className="pread-author">
                    <span className="pread-author__avatar pread-author__avatar--ph">{initials(post.authorName)}</span>
                    <span className="pread-author__txt">
                      <span className="pread-author__name">{post.authorName || "Psixoloq"}</span>
                    </span>
                  </span>
                )}
                <span className="pread-meta__dot">·</span>
                <span className="pread-meta__date">{fmtDateTime(post.publishedDate || post.createdAt)}</span>
                {post.readTimeMinutes > 0 && (
                  <>
                    <span className="pread-meta__dot">·</span>
                    <span className="pread-meta__read">{post.readTimeMinutes} dəq oxu</span>
                  </>
                )}
              </div>

              {/* content */}
              {post.content
                ? <div className="article-content pread-content" dangerouslySetInnerHTML={{ __html: post.content }} />
                : <p className="pread-content">{post.excerpt}</p>}

              {/* attachments */}
              {post.attachments && post.attachments.length > 0 && (
                <div className="pread-attach">
                  <div className="pcom-section-title">Əlavələr</div>
                  <div className="pread-attach__list">
                    {post.attachments.map(a => (
                      <a key={a.id} href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="pread-attach__item">
                        <span className="pread-attach__icon" aria-hidden>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                        </span>
                        <span className="pread-attach__name">{a.fileName}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* action bar */}
            <div className="pread-actions">
              <button onClick={toggleLike} disabled={liking}
                className={`pread-like${data?.likedByMe ? " is-active" : ""}`}>
                <svg width="18" height="18" viewBox="0 0 24 24"
                  fill={data?.likedByMe ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span>{data?.likeCount ?? 0}</span>
              </button>
              <span className="pread-cmtcount">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>{data?.commentCount ?? 0} şərh</span>
              </span>
            </div>
          </article>

          {/* ── Comments ────────────────────────────────────────────── */}
          <section className="pcmt">
            <div className="pcom-section-title">Şərhlər <span className="pcom-count">{data?.commentCount ?? 0}</span></div>

            <CommentComposer postId={id} onPosted={refreshComments} />

            {comments.length === 0 ? (
              <div className="pcmt-empty">Hələ şərh yoxdur. İlk fikri siz bildirin.</div>
            ) : (
              <div className="pcmt-list">
                {comments.map(c => (
                  <CommentNode key={c.id} c={c} postId={id} onChanged={refreshComments} depth={0} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ─── Composer ────────────────────────────────────────────────────────────── */

function CommentComposer({ postId, parentId, onPosted, autoFocus, placeholder, onCancel }: {
  postId: number; parentId?: number; onPosted: () => void | Promise<void>;
  autoFocus?: boolean; placeholder?: string; onCancel?: () => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const submit = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await psychologistApi.addComment(postId, text, parentId ?? null);
      setBody("");
      await onPosted();
      onCancel?.();
    } catch (e) {
      toast("Şərh göndərilmədi: " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`pcmt-composer${parentId ? " pcmt-composer--reply" : ""}`}>
      <textarea
        ref={ref}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={placeholder || "Şərhinizi yazın…"}
        rows={parentId ? 2 : 3}
        maxLength={4000}
        className="pcmt-input"
      />
      <div className="pcmt-composer__row">
        {onCancel && (
          <button type="button" className="pcmt-btn pcmt-btn--ghost" onClick={onCancel} disabled={busy}>Ləğv et</button>
        )}
        <button type="button" className="pcmt-btn pcmt-btn--primary" onClick={submit} disabled={busy || !body.trim()}>
          {busy ? "Göndərilir…" : parentId ? "Cavab yaz" : "Şərh yaz"}
        </button>
      </div>
    </div>
  );
}

/* ─── Comment node (top-level + replies) ──────────────────────────────────── */

function CommentNode({ c, postId, onChanged, depth }: {
  c: ArticleComment; postId: number; onChanged: () => void | Promise<void>; depth: number;
}) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState(c.body ?? "");
  const [busy, setBusy] = useState(false);

  const saveEdit = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await psychologistApi.editComment(c.id, text);
      setEditing(false);
      await onChanged();
    } catch (e) {
      toast("Yadda saxlanmadı: " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: "Şərhi sil",
      message: "Bu şərhi silmək istədiyinizə əminsiniz?",
      confirmLabel: "Sil",
      danger: true,
    });
    if (!ok) return;
    try {
      await psychologistApi.deleteComment(c.id);
      await onChanged();
    } catch (e) {
      toast("Silinmədi: " + (e as Error).message, "error");
    }
  };

  return (
    <div className={`pcmt-node${depth > 0 ? " pcmt-node--reply" : ""}`}>
      <div className="pcmt-row">
        {c.deleted ? (
          <span className="pcmt-avatar pcmt-avatar--ph" aria-hidden>—</span>
        ) : c.authorPhotoUrl ? (
          <img src={c.authorPhotoUrl} alt={c.authorName || ""} className="pcmt-avatar" />
        ) : (
          <span className="pcmt-avatar pcmt-avatar--ph">{initials(c.authorName)}</span>
        )}

        <div className="pcmt-main">
          <div className="pcmt-bubble">
            <div className="pcmt-head">
              <span className="pcmt-name">{c.deleted ? "Silinmiş şərh" : (c.authorName || "Psixoloq")}</span>
              <span className="pcmt-time">
                {fmtDateTime(c.createdAt)}{c.editedAt && !c.deleted ? " · redaktə olunub" : ""}
              </span>
            </div>

            {c.deleted ? (
              <p className="pcmt-text pcmt-text--deleted">Bu şərh silinib.</p>
            ) : editing ? (
              <div className="pcmt-composer pcmt-composer--reply">
                <textarea className="pcmt-input" rows={2} value={draft} maxLength={4000}
                  onChange={e => setDraft(e.target.value)} />
                <div className="pcmt-composer__row">
                  <button className="pcmt-btn pcmt-btn--ghost" onClick={() => { setEditing(false); setDraft(c.body ?? ""); }} disabled={busy}>Ləğv et</button>
                  <button className="pcmt-btn pcmt-btn--primary" onClick={saveEdit} disabled={busy || !draft.trim()}>Yadda saxla</button>
                </div>
              </div>
            ) : (
              <p className="pcmt-text">{c.body}</p>
            )}
          </div>

          {!c.deleted && !editing && (
            <div className="pcmt-actions">
              {depth === 0 && (
                <button className="pcmt-link" onClick={() => setReplying(r => !r)}>Cavab ver</button>
              )}
              {c.mine && (
                <>
                  <button className="pcmt-link" onClick={() => { setEditing(true); setDraft(c.body ?? ""); }}>Redaktə</button>
                  <button className="pcmt-link pcmt-link--danger" onClick={remove}>Sil</button>
                </>
              )}
            </div>
          )}

          {replying && (
            <CommentComposer
              postId={postId}
              parentId={c.id}
              autoFocus
              placeholder={`${c.authorName || "Psixoloq"}-a cavab…`}
              onPosted={onChanged}
              onCancel={() => setReplying(false)}
            />
          )}

          {c.replies && c.replies.length > 0 && (
            <div className="pcmt-replies">
              {c.replies.map(r => (
                <CommentNode key={r.id} c={r} postId={postId} onChanged={onChanged} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
