"use client";

/**
 * Məqalə səhifəsinin görüntü hissəsi. Data-fetching və notFound server
 * komponentində (page.tsx) qalır — burada yalnız render var ki, `useT()` ilə
 * dörd dilə tərcümə oluna bilsin.
 */

import Link from "next/link";
import type { BlogPost } from "@/lib/api";
import ReadingProgressBar from "@/app/blog/components/ReadingProgressBar";
import ShareBar from "@/app/blog/components/ShareBar";
import RelatedPosts from "@/app/blog/components/RelatedPosts";
import Breadcrumb from "@/components/Breadcrumb";
import ViewTracker from "@/components/ViewTracker";
import { displayCategory } from "@/lib/blog";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatDateLong } from "@/lib/i18n/dateNames";

/** ISO sətrindən yalnız gün hissəsi (YYYY-MM-DD) — müqayisə saat qurşağından asılı olmasın. */
function isoDay(s?: string | null): string | null {
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
}

/**
 * Yenilənmə tarixi YALNIZ dərcdən sonrakı bir gündə redaktə olunubsa göstərilir.
 * Əks halda hər məqalədə dərc tarixi ilə eyni sətir təkrarlanardı.
 */
function isUpdatedLater(publishedDate?: string | null, updatedAt?: string | null): boolean {
  const pub = isoDay(publishedDate);
  const upd = isoDay(updatedAt);
  return !!pub && !!upd && upd > pub;
}

function AttachmentIcon({ type }: { type: string }) {
  if (type === "IMAGE") {
    return (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }
  if (type === "VIDEO") {
    return (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export default function ArticleView({ post, related }: { post: BlogPost; related: BlogPost[] }) {
  const { t } = useT();
  const updated = isUpdatedLater(post.publishedDate, post.updatedAt)
    ? formatDateLong(t, post.updatedAt)
    : null;
  const categoryLabel = displayCategory(post.category);

  return (
    <>
      {/* Baxış sayğacı (V125) — heç nə render etmir. */}
      <ViewTracker type="BLOG_POST" id={post.id} />
      <ReadingProgressBar />
      <main className="art-detail">

        {/* Başlıq zolağı — tam en */}
        <header className="art-detail__head">
          <div className="fanus-container">
            <div className="art-crumb-wrap">
              <Breadcrumb bare items={[{ label: t("pub.crumbBlog"), href: "/blog" }, { label: post.title }]} />
            </div>
            <div className="art-meta">
              {categoryLabel ? (
                <span className="art-cat" style={{ background: post.categoryBg, color: post.categoryColor }}>
                  {categoryLabel}
                </span>
              ) : null}
              {/* Baxış sayı (V125 content_views) — ziyarətçi bu səhifəni açanda ViewTracker
                  onu artırır; burada göstərilən rəqəm cari ziyarətdən əvvəlki saydır. */}
              {post.viewCount != null && post.viewCount > 0 && (
                <>
                  {categoryLabel && <span className="art-meta__dot" aria-hidden />}
                  <span className="art-meta__read">{t("pub.viewsCount", { n: post.viewCount })}</span>
                </>
              )}
            </div>
            <h1 className="art-title">{post.title}</h1>
            {post.excerpt && <p className="art-lead">{post.excerpt}</p>}
            <div className="art-head-row">
              <div className="art-author">
                {post.authorPhotoUrl ? (
                  <img className="art-author__avatar art-author__avatar--photo" src={post.authorPhotoUrl} alt={post.authorName ?? ""} />
                ) : (
                  <div className="art-author__avatar">
                    {(post.authorName ?? "F").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="art-author__name">{post.authorName ?? t("article.editorial")}</div>
                  <div className="art-author__role">{formatDateLong(t, post.publishedDate)}</div>
                  {updated && <div className="art-author__role">{t("article.updatedAt", { date: updated })}</div>}
                </div>
                {post.authorRole === "PSYCHOLOGIST" && post.authorId && (
                  <Link href={`/psychologists/${post.authorId}`} className="art-author__profile-btn">
                    {t("article.viewProfile")}
                  </Link>
                )}
              </div>
              <ShareBar className="art-copy-link" />
            </div>
          </div>
        </header>

        {/* Cover şəkli — tam konteyner eni */}
        {post.coverImageUrl && (
          <div className="fanus-container art-cover">
            { }
            <img className="art-cover__img" src={post.coverImageUrl} alt={post.title} />
          </div>
        )}

        {/* Gövdə — məqalə mətni, tam en */}
        <div className="fanus-container art-layout">
          <article className="art-main">
            {post.content ? (
              <div
                className="article-content"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            ) : (
              <p style={{ color: "var(--fanus-ink-3)", fontStyle: "italic" }}>{t("article.noContent")}</p>
            )}

            {/* Əlavə materiallar */}
            {post.attachments && post.attachments.length > 0 && (
              <div className="art-attach">
                <h3>{t("article.attachments")}</h3>
                <div className="art-attach__list">
                  {post.attachments.map(att => (
                    <a
                      key={att.id}
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="art-attach__link"
                    >
                      <AttachmentIcon type={att.fileType} />
                      <span className="art-attach__name">{att.fileName}</span>
                      <span className="art-attach__open">{t("article.openAttachment")}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="art-back">
              <Link href="/blog">← {t("article.allArticles")}</Link>
            </div>
          </article>
        </div>

        {/* Əlaqəli məqalələr */}
        <RelatedPosts posts={related} />

      </main>
    </>
  );
}
