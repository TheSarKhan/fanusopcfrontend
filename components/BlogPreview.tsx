const posts = [
  {
    id: 1,
    category: "Narahatlıq",
    categoryColor: "#3B6FA5",
    categoryBg: "#E4EEF8",
    title: "Günlük narahatlığı necə idarə etmək olar?",
    excerpt:
      "Narahatlıq hissi hər kəsin həyatının bir parçasıdır. Lakin bu hiss həddini aşanda gündəlik həyata mane ola bilər. Bəzi sadə üsullarla...",
    readTime: "5 dəq",
    date: "10 Mart 2025",
    emoji: "🌿",
  },
  {
    id: 2,
    category: "Münasibətlər",
    categoryColor: "#7B85C8",
    categoryBg: "#EDE9F8",
    title: "Sağlam münasibət qurmağın 7 açarı",
    excerpt:
      "Sağlam münasibətlər yaranmır — qurulur. Emosional yetkinlik, kommunikasiya bacarığı və özünü tanımaq bu prosesdə kritik rol oynayır...",
    readTime: "7 dəq",
    date: "5 Mart 2025",
    emoji: "💚",
  },
  {
    id: 3,
    category: "Özünü Tanı",
    categoryColor: "#3B6FA5",
    categoryBg: "#E4EEF8",
    title: "Mindfulness: anda qalmağın sənəti",
    excerpt:
      "Mindfulness təcrübəsi stressin azaldılmasında elmi cəhətdən sübuta yetirilmiş bir üsuldur. Hər gün 10 dəqiqəlik praktika ilə...",
    readTime: "4 dəq",
    date: "28 Fevral 2025",
    emoji: "🧘",
  },
  {
    id: 4,
    category: "Depressiya",
    categoryColor: "#7B85C8",
    categoryBg: "#EDE9F8",
    title: "Depressiya ilə yaşamaq mümkündür",
    excerpt:
      "Depressiya zəiflik deyil, tibbi bir vəziyyətdir. Düzgün dəstək, terapiya və gündəlik alışqanlıqlarla depressiyadan çıxmaq mümkündür...",
    readTime: "8 dəq",
    date: "20 Fevral 2025",
    emoji: "🌅",
  },
];

export default function BlogPreview() {
  return (
    <section id="blog" className="section" style={{ background: "#ffffff" }}>
      <div className="container">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <p className="section-label">Bloq</p>
            <h2
              className="text-3xl sm:text-4xl font-bold"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
            >
              Məqalələr & Tövsiyələr
            </h2>
          </div>
          <a href="/blog" className="btn-outline self-start sm:self-auto">
            Hamısına bax →
          </a>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Featured first post */}
          <div
            className="card md:row-span-2 flex flex-col group cursor-pointer"
            style={{ background: "#F4F8FC" }}
          >
            {/* Header area */}
            <div
              className="h-48 rounded-t-[1.25rem] flex items-center justify-center text-7xl"
              style={{ background: "linear-gradient(135deg, #E4EEF8, #EDE9F8)" }}
            >
              {posts[0].emoji}
            </div>
            <div className="p-7 flex flex-col flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: posts[0].categoryBg, color: posts[0].categoryColor }}
                >
                  {posts[0].category}
                </span>
                <span className="text-xs text-[#6B85A0]">{posts[0].readTime} oxuma</span>
              </div>
              <h3
                className="text-xl font-bold text-[#1A2535] mb-3 group-hover:text-[#3B6FA5] transition-colors"
                style={{ fontFamily: "var(--font-playfair, serif)" }}
              >
                {posts[0].title}
              </h3>
              <p className="text-[#6B85A0] leading-relaxed text-sm flex-1">{posts[0].excerpt}</p>
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#D5E3F0]">
                <span className="text-xs text-[#6B85A0]">{posts[0].date}</span>
                <button
                  className="text-sm font-semibold flex items-center gap-1 transition-colors"
                  style={{ color: "#3B6FA5" }}
                >
                  Oxu
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Other posts (compact) */}
          {posts.slice(1).map((post) => (
            <div
              key={post.id}
              className="card p-5 flex gap-4 items-start group cursor-pointer"
              style={{ background: "#F4F8FC" }}
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
                  <span className="text-xs text-[#6B85A0]">{post.readTime}</span>
                </div>
                <h3
                  className="font-bold text-[#1A2535] text-sm leading-snug mb-1.5 group-hover:text-[#3B6FA5] transition-colors"
                >
                  {post.title}
                </h3>
                <p className="text-xs text-[#6B85A0] leading-relaxed line-clamp-2">{post.excerpt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
