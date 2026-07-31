import Link from "next/link";
import { getBlogPostBySlug, getBlogPosts } from "@/lib/api";
import { notFound } from "next/navigation";
import ReadingProgressBar from "@/app/blog/components/ReadingProgressBar";
import ShareBar from "@/app/blog/components/ShareBar";
import RelatedPosts from "@/app/blog/components/RelatedPosts";
import Breadcrumb from "@/components/Breadcrumb";
import ViewTracker from "@/components/ViewTracker";
import { displayCategory } from "@/lib/blog";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const months = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** ISO sətrindən yalnız gün hissəsi (YYYY-MM-DD) — müqayisə saat qurşağından asılı olmasın. */
function isoDay(s?: string | null): string | null {
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
}

/**
 * Yenilənmə tarixi YALNIZ dərcdən sonrakı bir gündə redaktə olunubsa qaytarılır.
 * Əks halda hər məqalədə dərc tarixi ilə eyni sətir təkrarlanardı (yazılış anındakı
 * redaktələr də "yenilənib" kimi görünərdi).
 */
function updatedLabel(publishedDate?: string | null, updatedAt?: string | null): string | null {
  const pub = isoDay(publishedDate);
  const upd = isoDay(updatedAt);
  if (!pub || !upd || upd <= pub) return null;
  return formatDate(updatedAt);
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

  // notFound() throws a control-flow error, so per Next.js docs it must be called
  // OUTSIDE a try/catch. Calling it inside the catch made this route return a 500
  // instead of a 404 in Next 16 — which surfaced as "Internal Server Error" on
  // every blog post once the ISR cache went stale and the page re-rendered.
  const post = await getBlogPostBySlug(slug).catch(() => null);
  if (!post) notFound();

  const updated = updatedLabel(post.publishedDate, post.updatedAt);

  const allPosts = await getBlogPosts().catch(() => []);
  const related = allPosts
    .filter(p => p.slug !== slug && p.category === post.category && p.active)
    .slice(0, 3);

  return (
    <>
      {/* Baxış sayğacı (V125) — server komponenti POST edə bilmədiyi üçün
          kiçik klient komponenti. Heç nə render etmir. */}
      <ViewTracker type="BLOG_POST" id={post.id} />
      <ReadingProgressBar />
      <main className="art-detail">

        {/* Başlıq zolağı — tam en */}
        <header className="art-detail__head">
          <div className="fanus-container">
            <div className="art-crumb-wrap">
              <Breadcrumb bare items={[{ label: "Bloq", href: "/blog" }, { label: post.title }]} />
            </div>
            <div className="art-meta">
              {displayCategory(post.category) ? (
                <span className="art-cat" style={{ background: post.categoryBg, color: post.categoryColor }}>
                  {displayCategory(post.category)}
                </span>
              ) : null}
              <span className="art-meta__dot" aria-hidden />
              <span className="art-meta__read">{post.readTimeMinutes} dəq oxu</span>
              {/* Baxış sayı (V125 content_views) — ziyarətçi bu səhifəni açanda ViewTracker
                  onu artırır; burada göstərilən rəqəm cari ziyarətdən əvvəlki saydır. */}
              {post.viewCount != null && post.viewCount > 0 && (
                <>
                  <span className="art-meta__dot" aria-hidden />
                  <span className="art-meta__read">{post.viewCount} baxış</span>
                </>
              )}
            </div>
            <h1 className="art-title">{post.title}</h1>
            {post.excerpt && <p className="art-lead">{post.excerpt}</p>}
            <div className="art-author">
              <div className="art-author__avatar">
                {(post.authorName ?? "F").charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="art-author__name">{post.authorName ?? "Fanus Redaksiyası"}</div>
                <div className="art-author__role">{formatDate(post.publishedDate)}</div>
                {updated && <div className="art-author__role">Yenilənib: {updated}</div>}
              </div>
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

        {/* Gövdə — məqalə + yan panel */}
        <div className="fanus-container art-layout">
          <article className="art-main">
            {post.content ? (
              <div
                className="article-content"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            ) : (
              <p style={{ color: "var(--fanus-ink-3)", fontStyle: "italic" }}>Məzmun mövcud deyil.</p>
            )}

            {/* Əlavə materiallar */}
            {post.attachments && post.attachments.length > 0 && (
              <div className="art-attach">
                <h3>Əlavə materiallar</h3>
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
                      <span className="art-attach__open">Aç</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="art-back">
              <Link href="/blog">← Bütün məqalələr</Link>
            </div>
          </article>

          <aside className="art-side">
            <div className="art-card">
              <div className="art-card__label">Bu məqaləni paylaş</div>
              <ShareBar title={post.title} />
            </div>
            <div className="art-card art-cta">
              <div className="art-cta__title">Peşəkar dəstəyə ehtiyacınız var?</div>
              <div className="art-cta__text">Fanus psixoloqları ilə onlayn seans üçün müraciət edin.</div>
              <Link href="/psychologists" className="fanus-btn fanus-btn-light">Psixoloq seç</Link>
            </div>
          </aside>
        </div>

        {/* Əlaqəli məqalələr */}
        <RelatedPosts posts={related} />

      </main>
    </>
  );
}
