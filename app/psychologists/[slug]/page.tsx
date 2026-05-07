import {
  getPsychologists,
  getBlogPosts,
  getPsychologistReviews,
  getPsychologistReviewSummary,
  type PublicReview,
  type ReviewSummary,
} from "@/lib/api";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BookingCta from "./BookingCta";

// Fanus brand palette — keep this page on-brand (#1051B7 və tonları)
const BRAND      = "#1051B7";
const BRAND_700  = "#082F6D";
const BRAND_100  = "#E4ECFA";
const BRAND_50   = "#F2F6FD";

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

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return "bu gün";
  const days = Math.floor(diffMs / day);
  if (days < 7) return `${days} gün öncə`;
  if (days < 30) return `${Math.floor(days / 7)} həftə öncə`;
  if (days < 365) return `${Math.floor(days / 30)} ay öncə`;
  return formatDate(dateStr);
}

function StarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--amber)" stroke="none">
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

function ClockIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"
         viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2"
         viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"
         viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export async function generateStaticParams() {
  try {
    const psychologists = await getPsychologists();
    return psychologists.map((p) => ({ slug: p.slug ?? String(p.id) }));
  } catch {
    return [];
  }
}

/** Resolve a slug-or-id route param to a Psychologist (or null). */
function resolvePsychologist(
  all: import("@/lib/api").Psychologist[],
  param: string,
) {
  const bySlug = all.find((p) => p.slug === param);
  if (bySlug) return bySlug;
  const numeric = parseInt(param, 10);
  if (!isNaN(numeric)) {
    return all.find((p) => p.id === numeric) ?? null;
  }
  return null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  try {
    const all = await getPsychologists();
    const p = resolvePsychologist(all, slug);
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
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const allPsychologists = await getPsychologists();
  const psychologist = resolvePsychologist(allPsychologists, slug);
  if (!psychologist) notFound();

  const [allPosts, reviews, reviewSummary] = await Promise.all([
    getBlogPosts().catch(() => []),
    getPsychologistReviews(psychologist.id).catch(() => [] as PublicReview[]),
    getPsychologistReviewSummary(psychologist.id).catch(
      () => ({ total: 0, average: 0, distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } } as ReviewSummary)
    ),
  ]);

  const posts = allPosts.filter(
    (post) =>
      post.authorName === psychologist.name &&
      post.active &&
      post.status === "PUBLISHED"
  );

  const hasPhoto = !!psychologist.photoUrl?.trim();
  const initials = getInitials(psychologist.name);
  const educations = (psychologist.university || psychologist.degree || psychologist.graduationYear)
    ? [{
        institution: psychologist.university ?? "",
        degree: psychologist.degree ?? "",
        graduationYear: psychologist.graduationYear ?? "",
      }]
    : [];
  const hasInfo = !!(psychologist.languages || psychologist.sessionTypes || psychologist.activityFormat);
  const activityFormatLabel =
    psychologist.activityFormat === "BOTH"      ? "Onlayn & Əyani"
  : psychologist.activityFormat === "ONLINE"    ? "Onlayn"
  : psychologist.activityFormat === "IN_PERSON" ? "Əyani"
  : psychologist.activityFormat ?? "";
  const sessionMinutes = psychologist.defaultSessionMinutes ?? 50;

  const ratingNum = parseFloat(psychologist.rating);
  const filledStars = isFinite(ratingNum) ? Math.round(ratingNum) : 0;

  return (
    <main className="prof-page">

      {/* ── Hero (3-col): avatar + identity + sticky booking ───────────── */}
      <section
        className="prof-hero"
        style={{ background: `linear-gradient(180deg, ${BRAND_50} 0%, ${BRAND_100} 100%)` }}
      >
        <div
          aria-hidden
          className="prof-hero__orb"
          style={{ background: `radial-gradient(circle, ${BRAND}26, transparent 70%)` }}
        />
        <div className="prof-shell">
          <a href="/psychologists" className="prof-back">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4"
                 viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Psixoloqlara qayıt
          </a>

          <div className="prof-hero__grid">
            {/* Avatar */}
            <div className="prof-avatar">
              <div className="prof-avatar__inner" style={{ background: BRAND }}>
                {hasPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={psychologist.photoUrl} alt={psychologist.name} />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
            </div>

            {/* Identity */}
            <div className="prof-id">
              <h1>
                {psychologist.name}
                <span
                  className="prof-verified"
                  style={{ color: BRAND }}
                  title="Doğrulanmış psixoloq"
                  aria-label="Doğrulanmış psixoloq"
                >
                  <ShieldIcon size={22} />
                </span>
              </h1>
              <div className="prof-role" style={{ color: BRAND }}>{psychologist.title}</div>

              <div className="prof-quick">
                <div className="prof-quick__item">
                  <span className="prof-quick__icon" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
                    <StarIcon size={14} />
                  </span>
                  <strong>{psychologist.rating}</strong>
                  <span className="prof-quick__sub">Reytinq</span>
                </div>
                <div className="prof-quick__item">
                  <span className="prof-quick__icon" style={{ background: BRAND_50, color: BRAND }}>
                    <UsersIcon />
                  </span>
                  <strong>{psychologist.sessionsCount}</strong>
                  <span className="prof-quick__sub">Seans</span>
                </div>
                <div className="prof-quick__item">
                  <span className="prof-quick__icon" style={{ background: BRAND_100, color: BRAND_700 }}>
                    <ClockIcon />
                  </span>
                  <strong>{psychologist.experience}</strong>
                  <span className="prof-quick__sub">Təcrübə</span>
                </div>
                {psychologist.activityFormat && (
                  <div className="prof-quick__item">
                    <span className="prof-quick__icon" style={{ background: BRAND_50, color: BRAND }}>
                      <MonitorIcon />
                    </span>
                    <strong>{activityFormatLabel}</strong>
                    <span className="prof-quick__sub">Format</span>
                  </div>
                )}
              </div>

              {psychologist.specializations.length > 0 && (
                <div className="prof-tags">
                  {psychologist.specializations.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="prof-tag"
                      style={{ color: BRAND, borderColor: "var(--brand-200)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Sticky booking */}
            <aside className="prof-book">
              <div className="prof-book__price">
                <span>Standart seans</span>
                <strong>{sessionMinutes} dəq</strong>
              </div>
              <BookingCta
                psychologistId={psychologist.id}
                name={psychologist.name}
                accentColor={BRAND}
              />
              <ul className="prof-book__list">
                <li><ShieldIcon size={14} /> Sertifikatlı və doğrulanmış</li>
                <li><HeartIcon /> Tam məxfilik</li>
                <li><ClockIcon /> Təsdiqdən sonra ödəniş</li>
              </ul>
            </aside>
          </div>
        </div>
      </section>

      {/* ── Body: optimized 2-col grid ─────────────────────────────────── */}
      <section className="prof-body">
        <div className="prof-shell">
          <div className="prof-grid">

            {/* Row 1 — Haqqımda (full width) */}
            {psychologist.bio && (
              <article className="prof-block prof-block--full">
                <div className="prof-block__head">
                  <span className="prof-block__eyebrow" style={{ color: BRAND }}>
                    <span className="prof-block__dash" style={{ background: BRAND }} /> Tanış olaq
                  </span>
                  <h2 className="prof-block__title">Haqqımda</h2>
                </div>
                <p className="prof-bio">{psychologist.bio}</p>
              </article>
            )}

            {/* Row 2 — Yanaşma | Təhsil */}
            {psychologist.specializations.length > 0 && (
              <article className="prof-block">
                <div className="prof-block__head">
                  <span className="prof-block__eyebrow" style={{ color: BRAND }}>
                    <span className="prof-block__dash" style={{ background: BRAND }} /> İxtisaslaşma
                  </span>
                  <h2 className="prof-block__title">Yanaşma və mütəxəssis sahələri</h2>
                </div>
                <div className="prof-skills">
                  {psychologist.specializations.map((s) => (
                    <span key={s} className="prof-skill" style={{ background: BRAND_50 }}>
                      <CheckIcon />
                      <span>{s}</span>
                    </span>
                  ))}
                </div>
              </article>
            )}

            {educations.length > 0 && (
              <article className="prof-block">
                <div className="prof-block__head">
                  <span className="prof-block__eyebrow" style={{ color: BRAND }}>
                    <span className="prof-block__dash" style={{ background: BRAND }} /> Akademik fon
                  </span>
                  <h2 className="prof-block__title">Təhsil</h2>
                </div>
                <ol className="prof-edu" aria-label="Təhsil tarixçəsi">
                  {educations.map((e, i) => (
                    <li key={i} className="prof-edu__item" style={{ background: BRAND_50 }}>
                      {e.graduationYear && (
                        <div className="prof-edu__year" style={{ color: BRAND }}>{e.graduationYear}</div>
                      )}
                      <div className="prof-edu__body">
                        {e.institution && <div className="prof-edu__name">{e.institution}</div>}
                        {e.degree && <div className="prof-edu__deg">{e.degree}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            )}

            {/* Row 3 — Format və dillər | Müştəri rəyləri */}
            {hasInfo && (
              <article className="prof-block">
                <div className="prof-block__head">
                  <span className="prof-block__eyebrow" style={{ color: BRAND }}>
                    <span className="prof-block__dash" style={{ background: BRAND }} /> Seans məlumatı
                  </span>
                  <h2 className="prof-block__title">Format və dillər</h2>
                </div>
                <div className="prof-info">
                  {psychologist.languages && (
                    <div className="prof-info__row">
                      <span>Dillər</span>
                      <strong>{psychologist.languages}</strong>
                    </div>
                  )}
                  {psychologist.activityFormat && (
                    <div className="prof-info__row">
                      <span>Format</span>
                      <strong>{activityFormatLabel}</strong>
                    </div>
                  )}
                  {psychologist.sessionTypes && (
                    <div className="prof-info__row">
                      <span>Seans növü</span>
                      <strong>{psychologist.sessionTypes}</strong>
                    </div>
                  )}
                  <div className="prof-info__row">
                    <span>Seans müddəti</span>
                    <strong>{sessionMinutes} dəqiqə</strong>
                  </div>
                </div>
              </article>
            )}

            <article className="prof-block">
              <div className="prof-block__head">
                <span className="prof-block__eyebrow" style={{ color: BRAND }}>
                  <span className="prof-block__dash" style={{ background: BRAND }} /> Pasiyent rəyləri
                </span>
                <h2 className="prof-block__title">Müştərilər nə deyir</h2>
              </div>
              <CompactReviews reviews={reviews} summary={reviewSummary} accentColor={BRAND} />
            </article>

            {/* Row 4 — Məqalələr (full width) */}
            <article className="prof-block prof-block--full">
              <div className="prof-block__head prof-block__head--row">
                <div>
                  <span className="prof-block__eyebrow" style={{ color: BRAND }}>
                    <span className="prof-block__dash" style={{ background: BRAND }} /> Bloq
                  </span>
                  <h2 className="prof-block__title">Müəllifin məqalələri</h2>
                </div>
                {posts.length > 0 && (
                  <span className="prof-pill" style={{ color: BRAND, background: BRAND_50 }}>
                    {posts.length} məqalə
                  </span>
                )}
              </div>

              {posts.length > 0 ? (
                <div className="prof-articles">
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
                            style={{ background: `linear-gradient(135deg, ${BRAND_50}, ${BRAND})` }}
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
                            style={{ background: `linear-gradient(135deg, ${BRAND_50}, ${BRAND})` }}
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
              ) : (
                <div className="prof-empty" style={{ background: BRAND_50 }}>
                  <span className="prof-empty__icon">
                    <BookIcon />
                  </span>
                  <h4>Hələ dərc edilmiş məqalə yoxdur</h4>
                  <p>{psychologist.name.split(" ")[0]} burada öz peşəkar yazılarını paylaşacaq.</p>
                </div>
              )}
            </article>

          </div>
        </div>
      </section>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3"
         viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"
         viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function CompactReviews({
  reviews,
  summary,
  accentColor,
}: {
  reviews: PublicReview[];
  summary: ReviewSummary;
  accentColor: string;
}) {
  if (summary.total === 0) {
    return (
      <div className="ppd-rev-empty">
        <div className="ppd-rev-empty__icon" style={{ color: accentColor }}>
          <StarIcon size={26} />
        </div>
        <div className="ppd-rev-empty__title">Hələ rəy yoxdur</div>
        <p className="ppd-rev-empty__body">
          Bu psixoloqla seans keçmisinizsə, ilk rəyi siz yaza bilərsiniz.
        </p>
      </div>
    );
  }

  const distMax = Math.max(
    1,
    ...[1, 2, 3, 4, 5].map((r) => Number(summary.distribution[String(r)] ?? 0))
  );

  return (
    <div className="ppd-rev">
      <div className="ppd-rev__summary">
        <div className="ppd-rev__avg">{summary.average.toFixed(1)}</div>
        <div className="ppd-rev__avg-meta">
          <StarRow value={Math.round(summary.average)} />
          <span>{summary.total} rəy</span>
        </div>
        <ul className="ppd-rev__dist">
          {[5, 4, 3, 2, 1].map((r) => {
            const count = Number(summary.distribution[String(r)] ?? 0);
            const pct = (count / distMax) * 100;
            return (
              <li key={r}>
                <span>{r}</span>
                <span className="ppd-rev__dist-bar">
                  <span
                    className="ppd-rev__dist-fill"
                    style={{ width: `${pct}%`, background: accentColor }}
                  />
                </span>
                <span className="ppd-rev__dist-count">{count}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="ppd-rev__list">
        {reviews.slice(0, 3).map((r) => (
          <li key={r.id} className="ppd-rev__item">
            <div className="ppd-rev__item-head">
              <div className="ppd-rev__avatar" style={{ background: accentColor }} aria-hidden>
                {r.authorInitials}
              </div>
              <div className="ppd-rev__item-meta">
                <div className="ppd-rev__item-author">{r.authorDisplayName}</div>
                <div className="ppd-rev__item-line">
                  <StarRow value={r.rating} size={11} />
                  <span>{formatRelative(r.createdAt)}</span>
                </div>
              </div>
            </div>
            <p className="ppd-rev__item-comment">{r.comment}</p>
            {r.reply && (
              <div className="ppd-rev__reply" style={{ borderLeftColor: accentColor }}>
                <strong style={{ color: accentColor }}>Psixoloqun cavabı:</strong>
                <p>{r.reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {reviews.length > 3 && (
        <div className="ppd-rev__more">
          Cəmi {summary.total} rəy var
        </div>
      )}
    </div>
  );
}

function StarRow({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="ppd-stars" aria-label={`${value} ulduz`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ opacity: i < value ? 1 : 0.22 }}>
          <StarIcon size={size} />
        </span>
      ))}
    </span>
  );
}
