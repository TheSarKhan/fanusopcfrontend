import { getPsychologists, getBlogPosts } from "@/lib/api";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BookingCta from "./BookingCta";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter((w) => w.length > 1)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--amber)" stroke="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"
         viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"
         viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"
         viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function GraduationIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"
         viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" />
      <path d="M6 12v5c3.27 1.8 8.73 1.8 12 0v-5" />
    </svg>
  );
}

export async function generateStaticParams() {
  try {
    const psychologists = await getPsychologists();
    return psychologists.map((p) => ({ id: String(p.id) }));
  } catch {
    return [];
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  try {
    const all = await getPsychologists();
    const p = all.find((x) => x.id === Number(id));
    if (!p) return { title: "Psixoloq – Fanus" };
    return {
      title: `${p.name} – Fanus`,
      description: p.bio ?? `${p.name} — ${p.title}. Fanus platformasında onlayn seans.`,
    };
  } catch {
    return { title: "Psixoloq – Fanus" };
  }
}

export default async function PsychologistProfilePage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [allPsychologists, allPosts] = await Promise.all([
    getPsychologists(),
    getBlogPosts().catch(() => []),
  ]);

  const psychologist = allPsychologists.find((p) => p.id === Number(id));
  if (!psychologist) notFound();

  const posts = allPosts.filter(
    (post) =>
      post.authorName === psychologist.name &&
      post.active &&
      post.status === "PUBLISHED"
  );

  const hasPhoto = !!psychologist.photoUrl?.trim();
  const initials = getInitials(psychologist.name);
  const hasEducation = !!(psychologist.university || psychologist.degree || psychologist.graduationYear);
  const hasInfo = !!(psychologist.languages || psychologist.sessionTypes || psychologist.activityFormat);

  return (
    <main className="psy-profile-page">

      {/* Back */}
      <div className="psy-profile-back-wrap">
        <div className="container">
          <a href="/psychologists" className="psy-profile-back">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"
                 viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Psixoloqlara qayıt
          </a>
        </div>
      </div>

      {/* Hero */}
      <section className="psy-profile-hero" style={{ background: psychologist.bgColor }}>
        <div className="container">
          <div className="psy-profile-hero-inner">

            <div className="psy-profile-photo-wrap">
              {hasPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={psychologist.photoUrl} alt={psychologist.name} className="psy-profile-photo" />
              ) : (
                <div className="psy-profile-initials" style={{ color: psychologist.accentColor }}>
                  {initials}
                </div>
              )}
            </div>

            <div className="psy-profile-hero-body">
              <h1 className="psy-profile-name">{psychologist.name}</h1>
              <p className="psy-profile-title">{psychologist.title}</p>

              <div className="psy-profile-meta">
                <span className="psy-profile-meta-item">
                  <StarIcon /> {psychologist.rating}
                </span>
                <span className="psy-profile-meta-sep" />
                <span className="psy-profile-meta-item">{psychologist.sessionsCount} seans</span>
                <span className="psy-profile-meta-sep" />
                <span className="psy-profile-meta-item">{psychologist.experience} təcrübə</span>
              </div>

              <BookingCta name={psychologist.name} accentColor={psychologist.accentColor} />

              {psychologist.specializations.length > 0 && (
                <div className="psy-profile-tags">
                  {psychologist.specializations.map((tag) => (
                    <span
                      key={tag}
                      className="psy-profile-tag"
                      style={{ background: "rgba(255,255,255,0.55)", color: psychologist.accentColor }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* Content */}
      <div className="psy-profile-content">

        {psychologist.bio && (
          <section className="psy-profile-section">
            <h2 className="psy-profile-section-title">Haqqımda</h2>
            <p className="psy-profile-bio">{psychologist.bio}</p>
          </section>
        )}

        {hasInfo && (
          <section className="psy-profile-section">
            <h2 className="psy-profile-section-title">Məlumatlar</h2>
            <div className="psy-profile-chips">
              {psychologist.languages && (
                <div className="psy-profile-chip">
                  <span className="psy-profile-chip-icon"><GlobeIcon /></span>
                  <div>
                    <div className="psy-profile-chip-label">Dillər</div>
                    <div className="psy-profile-chip-value">{psychologist.languages}</div>
                  </div>
                </div>
              )}
              {psychologist.sessionTypes && (
                <div className="psy-profile-chip">
                  <span className="psy-profile-chip-icon"><MonitorIcon /></span>
                  <div>
                    <div className="psy-profile-chip-label">Seans növü</div>
                    <div className="psy-profile-chip-value">{psychologist.sessionTypes}</div>
                  </div>
                </div>
              )}
              {psychologist.activityFormat && (
                <div className="psy-profile-chip">
                  <span className="psy-profile-chip-icon"><UsersIcon /></span>
                  <div>
                    <div className="psy-profile-chip-label">Format</div>
                    <div className="psy-profile-chip-value">{psychologist.activityFormat}</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {hasEducation && (
          <section className="psy-profile-section">
            <h2 className="psy-profile-section-title">Təhsil</h2>
            <div className="psy-profile-edu">
              <div className="psy-profile-edu-icon"><GraduationIcon /></div>
              <div>
                {psychologist.university && (
                  <div className="psy-profile-edu-uni">{psychologist.university}</div>
                )}
                {(psychologist.degree || psychologist.graduationYear) && (
                  <div className="psy-profile-edu-meta">
                    {[psychologist.degree, psychologist.graduationYear].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {posts.length > 0 && (
          <section className="psy-profile-section">
            <h2 className="psy-profile-section-title">Məqalələr</h2>
            <div className="psy-profile-articles">
              {posts.map((post, i) => (
                <a
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="bl-card bl-card-link"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div className="bl-card-visual">
                    {post.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.coverImageUrl} alt={post.title} className="bl-card-img" />
                    ) : (
                      <div
                        className="bl-card-gradient-bg"
                        style={{ background: `linear-gradient(135deg, ${psychologist.bgColor}, ${psychologist.accentColor})` }}
                      >
                        <span className="bl-card-gradient-label">{post.category}</span>
                      </div>
                    )}
                    <span className="bl-card-cat-badge">{post.category}</span>
                  </div>
                  <div className="bl-card-body">
                    <h3 className="bl-card-title">{post.title}</h3>
                    {post.excerpt && <p className="bl-card-excerpt">{post.excerpt}</p>}
                    <div className="bl-card-author">
                      <div
                        className="bl-author-avatar"
                        style={{ background: `linear-gradient(135deg, ${psychologist.bgColor}, ${psychologist.accentColor})` }}
                      >
                        {psychologist.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="bl-author-name">{psychologist.name}</div>
                        <div className="bl-author-date">{post.readTimeMinutes} dəq · {formatDate(post.publishedDate)}</div>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
