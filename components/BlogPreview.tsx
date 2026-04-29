import type { BlogPost } from "@/lib/api";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("az-AZ", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogPreview({ posts }: { posts: BlogPost[] }) {
  if (!posts.length) return null;
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <section id="blog" style={{ background: "#ffffff", padding: "6rem 0" }}>
      <div className="container">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <p className="section-label">Bloq</p>
            <h2
              className="text-3xl sm:text-4xl font-bold"
              style={{  color: "#1A2535" }}
            >
              Məqalələr & Tövsiyələr
            </h2>
          </div>
          <a href="/blog" className="btn-outline self-start sm:self-auto">
            Hamısına bax →
          </a>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Featured */}
          <div
            className="card md:row-span-2 flex flex-col group cursor-pointer"
            style={{ background: "#F4F7FB", border: "1px solid #EDF2F7" }}
          >
            <div
              className="h-48 rounded-t-[1.25rem] flex items-center justify-center text-7xl"
              style={{ background: "linear-gradient(135deg, #E0EBF7, #EDE9F8)" }}
            >
              {featured.emoji}
            </div>
            <div className="p-7 flex flex-col flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: featured.categoryBg, color: featured.categoryColor }}
                >
                  {featured.category}
                </span>
                <span className="text-xs text-[#52718F]">{featured.readTimeMinutes} dəq oxuma</span>
              </div>
              <h3
                className="text-xl font-bold text-[#1A2535] mb-3 group-hover:text-[#002147] transition-colors"
                style={{  }}
              >
                {featured.title}
              </h3>
              <p className="text-[#52718F] leading-relaxed text-sm flex-1">{featured.excerpt}</p>
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#C0D2E6]">
                <span className="text-xs text-[#52718F]">{formatDate(featured.publishedDate)}</span>
                <button
                  className="text-sm font-semibold flex items-center gap-1 transition-colors"
                  style={{ color: "#002147" }}
                >
                  Oxu
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Others */}
          {rest.map((post) => (
            <div
              key={post.id}
              className="card p-5 flex gap-4 items-start group cursor-pointer"
              style={{ background: "#F4F7FB", border: "1px solid #EDF2F7" }}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: post.categoryBg }}
              >
                {post.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: post.categoryBg, color: post.categoryColor }}
                  >
                    {post.category}
                  </span>
                  <span className="text-xs text-[#52718F]">{post.readTimeMinutes} dəq</span>
                </div>
                <h3 className="font-bold text-[#1A2535] text-sm leading-snug mb-1.5 group-hover:text-[#002147] transition-colors">
                  {post.title}
                </h3>
                <p className="text-xs text-[#52718F] leading-relaxed line-clamp-2">{post.excerpt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
