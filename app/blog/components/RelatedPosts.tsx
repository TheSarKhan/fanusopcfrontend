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
                  <div className="bl-author-avatar" style={{ background: "var(--brand)" }}>
                    {(post.authorName ?? "F").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="bl-author-name">{post.authorName ?? t("article.editorial")}</div>
                    <div className="bl-author-date" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <span>{t("pub.readMinutes", { n: post.readTimeMinutes })}</span>
                      <span>{formatDateShort(t, post.publishedDate)}</span>
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
