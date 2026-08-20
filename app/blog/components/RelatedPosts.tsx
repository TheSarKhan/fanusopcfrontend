"use client";

import type { BlogPost } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatDateShort } from "@/lib/i18n/dateNames";

const GRADIENTS = [
  "var(--brand)",
  "linear-gradient(135deg,#1a5276,#2e86c1)",
  "linear-gradient(135deg,#145a32,#27ae60)",
  "linear-gradient(135deg,#6e2f8a,#a569bd)",
  "linear-gradient(135deg,#943126,#e74c3c)",
  "linear-gradient(135deg,#1a4d5c,#1abc9c)",
];

function idGradient(id: number) {
  return GRADIENTS[id % GRADIENTS.length];
}

function CalendarIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="2.4" y="3.4" width="11.2" height="10.2" rx="1.6" /><path d="M2.4 6.6h11.2M5.6 2.4v2M10.4 2.4v2" strokeLinecap="round" /></svg>; }
function EyeIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M1.2 8S3.4 3.4 8 3.4 14.8 8 14.8 8 12.6 12.6 8 12.6 1.2 8 1.2 8Z" strokeLinejoin="round" /><circle cx="8" cy="8" r="2.2" /></svg>; }

export default function RelatedPosts({ posts }: { posts: BlogPost[] }) {
  const { t } = useT();
  if (!posts.length) return null;
  return (
    <section className="bl-related">
      <div className="container">
        <h2 className="bl-related-title">{t("article.relatedTitle")}</h2>
        <div className="bl-related-grid">
          {posts.map(post => (
            <a key={post.id} href={`/blog/${post.slug}`} className="bl-card bl-card-link">
              <div className="bl-card-visual">
                {post.coverImageUrl ? (

                  <img src={post.coverImageUrl} alt={post.title} className="bl-card-img" />
                ) : (
                  <div className="bl-card-gradient-bg" style={{ background: idGradient(post.id) }} />
                )}
              </div>
              <div className="bl-card-body">
                <h3 className="bl-card-title">{post.title}</h3>
                {post.excerpt && <p className="bl-card-excerpt">{post.excerpt}</p>}
                <div className="bl-card-author">
                  {post.authorPhotoUrl ? (
                    <img className="bl-author-avatar bl-author-avatar--photo" src={post.authorPhotoUrl} alt={post.authorName ?? ""} />
                  ) : (
                    <div className="bl-author-avatar" style={{ background: "var(--brand)" }}>
                      {(post.authorName ?? "F").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="bl-author-name">{post.authorName ?? t("article.editorial")}</div>
                    {post.authorTitle && <div className="bl-author-role">{post.authorTitle}</div>}
                    <div className="bl-author-date" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                      <span className="bl-meta-item"><CalendarIcon />{formatDateShort(t, post.publishedDate)}</span>
                      {post.viewCount != null && post.viewCount > 0 && (
                        <span className="bl-meta-item"><EyeIcon />{t("pub.viewsCount", { n: post.viewCount })}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
