import type { BlogPost } from "@/lib/api";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Yan","Fev","Mart","Apr","May","İyun","İyul","Avq","Sen","Okt","Noy","Dek"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const GRADIENTS = [
  "linear-gradient(135deg,#002147,#5A4FC8)",
  "linear-gradient(135deg,#1a5276,#2e86c1)",
  "linear-gradient(135deg,#145a32,#27ae60)",
  "linear-gradient(135deg,#6e2f8a,#a569bd)",
  "linear-gradient(135deg,#943126,#e74c3c)",
  "linear-gradient(135deg,#1a4d5c,#1abc9c)",
];

function catGradient(cat: string) {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) & 0xffff;
  return GRADIENTS[h % GRADIENTS.length];
}

export default function RelatedPosts({ posts }: { posts: BlogPost[] }) {
  if (!posts.length) return null;
  return (
    <section className="bl-related">
      <div className="container">
        <h2 className="bl-related-title">Əlaqəli məqalələr</h2>
        <div className="bl-related-grid">
          {posts.map(post => (
            <a key={post.id} href={`/blog/${post.slug}`} className="bl-card bl-card-link">
              <div className="bl-card-visual">
                {post.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.coverImageUrl} alt={post.title} className="bl-card-img" />
                ) : (
                  <div className="bl-card-gradient-bg" style={{ background: catGradient(post.category) }}>
                    <span className="bl-card-gradient-label">{post.category}</span>
                  </div>
                )}
                <span className="bl-card-cat-badge">{post.category}</span>
              </div>
              <div className="bl-card-body">
                <h3 className="bl-card-title">{post.title}</h3>
                {post.excerpt && <p className="bl-card-excerpt">{post.excerpt}</p>}
                <div className="bl-card-author">
                  <div className="bl-author-avatar" style={{ background: "linear-gradient(135deg,#002147,#5A4FC8)" }}>
                    {(post.authorName ?? "F").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="bl-author-name">{post.authorName ?? "Fanus Redaksiyası"}</div>
                    <div className="bl-author-date">{post.readTimeMinutes} dəq · {formatDate(post.publishedDate)}</div>
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
