import { getBlogPostBySlug, getBlogPosts } from "@/lib/api";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
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

  return (
    <>
      <Navbar />
      <main style={{ background: "#F7FAFD", minHeight: "100vh", paddingTop: "76px" }}>
        {/* Hero */}
        <div style={{ background: "#fff", borderBottom: "1px solid #E4EDF6" }}>
          <div className="container" style={{ maxWidth: 760, padding: "3rem 1rem 2rem" }}>
            {/* Category */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: post.categoryBg, color: post.categoryColor }}>
                {post.category}
              </span>
              <span className="text-xs text-[#8AAABF]">{post.readTimeMinutes} dəq oxu</span>
            </div>
            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0F1C2E] mb-4" style={{ lineHeight: 1.25 }}>
              {post.title}
            </h1>
            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-lg text-[#52718F] mb-6" style={{ lineHeight: 1.7 }}>{post.excerpt}</p>
            )}
            {/* Meta */}
            <div className="flex items-center gap-3 text-sm text-[#8AAABF]">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: "linear-gradient(135deg,#002147,#5A4FC8)" }}>
                {post.authorName ? post.authorName.charAt(0).toUpperCase() : "F"}
              </div>
              <span className="font-medium text-[#1A2535]">{post.authorName ?? "Fanus Redaksiyası"}</span>
              <span>·</span>
              <span>{formatDate(post.publishedDate)}</span>
            </div>
          </div>
        </div>

        {/* Cover image */}
        {post.coverImageUrl && (
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 1rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverImageUrl} alt={post.title}
              style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: "0 0 16px 16px" }} />
          </div>
        )}

        {/* Content */}
        <article style={{ maxWidth: 760, margin: "0 auto", padding: "2.5rem 1rem" }}>
          {post.content ? (
            <div
              className="article-content"
              dangerouslySetInnerHTML={{ __html: post.content }}
              style={{ fontSize: 16, lineHeight: 1.85, color: "#1A2535" }}
            />
          ) : (
            <p style={{ color: "#8AAABF", fontStyle: "italic" }}>Məzmun mövcud deyil.</p>
          )}

          {/* Attachments */}
          {post.attachments && post.attachments.length > 0 && (
            <div style={{ marginTop: 40, padding: "24px", background: "#F5F8FF", borderRadius: 16, border: "1px solid #E4EDF6" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1A2535", marginBottom: 12 }}>Əlavə materiallar</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {post.attachments.map(att => (
                  <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                      background: "#fff", borderRadius: 10, border: "1px solid #E4EDF6",
                      textDecoration: "none", color: "#1A2535", fontSize: 13 }}>
                    <span>{att.fileType === "IMAGE" ? "🖼" : att.fileType === "VIDEO" ? "🎬" : "📎"}</span>
                    <span style={{ flex: 1 }}>{att.fileName}</span>
                    <span style={{ fontSize: 11, color: "#8AAABF" }}>Aç →</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Back */}
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 1rem 4rem" }}>
          <a href="/blog" style={{ display: "inline-flex", alignItems: "center", gap: 6,
            color: "#002147", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
            ← Bütün məqalələr
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
