import { getBlogPostBySlug, getBlogPosts } from "@/lib/api";
import { notFound } from "next/navigation";
import ReadingProgressBar from "@/app/blog/components/ReadingProgressBar";
import ShareBar from "@/app/blog/components/ShareBar";
import RelatedPosts from "@/app/blog/components/RelatedPosts";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
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

export async function generateStaticParams() {
  try {
    const posts = await getBlogPosts();
    return posts.map(p => ({ slug: p.slug }));
  } catch { return []; }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let post;
  try {
    post = await getBlogPostBySlug(slug);
  } catch {
    notFound();
  }

  const allPosts = await getBlogPosts().catch(() => []);
  const related = allPosts
    .filter(p => p.slug !== slug && p.category === post.category && p.active)
    .slice(0, 3);

  return (
    <>
      <ReadingProgressBar />
      <main className="bl-detail-page">

        {/* Header */}
        <div className="bl-detail-header">
          <div className="bl-detail-header-inner">
            <div className="bl-detail-category">
              <span
                className="bl-detail-cat-tag"
                style={{ background: post.categoryBg, color: post.categoryColor }}
              >
                {post.category}
              </span>
              <span className="bl-detail-read-time">{post.readTimeMinutes} dəq oxu</span>
            </div>
            <h1 className="bl-detail-title">{post.title}</h1>
            {post.excerpt && (
              <p className="bl-detail-excerpt">{post.excerpt}</p>
            )}
            <div className="bl-detail-author">
              <div
                className="bl-detail-avatar"
                style={{ background: "linear-gradient(135deg,#002147,#5A4FC8)" }}
              >
                {(post.authorName ?? "F").charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="bl-detail-author-name">{post.authorName ?? "Fanus Redaksiyası"}</div>
                <div className="bl-detail-author-date">{formatDate(post.publishedDate)}</div>
              </div>
            </div>
            <ShareBar title={post.title} />
          </div>
        </div>

        {/* Cover image */}
        {post.coverImageUrl && (
          <div className="bl-detail-cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverImageUrl} alt={post.title} />
          </div>
        )}

        {/* Article content */}
        <article className="bl-detail-article">
          {post.content ? (
            <div
              className="article-content"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          ) : (
            <p style={{ color: "#8AAABF", fontStyle: "italic" }}>Məzmun mövcud deyil.</p>
          )}

          {/* Attachments */}
          {post.attachments && post.attachments.length > 0 && (
            <div className="bl-detail-attachments">
              <h3>Əlavə materiallar</h3>
              <div className="bl-detail-att-list">
                {post.attachments.map(att => (
                  <a
                    key={att.id}
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bl-detail-att-link"
                  >
                    <AttachmentIcon type={att.fileType} />
                    <span className="bl-detail-att-name">{att.fileName}</span>
                    <span className="bl-detail-att-open">Aç</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Back link */}
        <div className="bl-detail-back">
          <a href="/blog">← Bütün məqalələr</a>
        </div>

        {/* Related posts */}
        <RelatedPosts posts={related} />

      </main>
    </>
  );
}
