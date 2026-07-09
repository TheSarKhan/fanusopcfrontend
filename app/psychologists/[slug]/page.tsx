import {
  getPsychologists,
  getBlogPosts,
  getPsychologistReviews,
  getPsychologistReviewSummary,
  type PublicReview,
  type ReviewSummary,
} from "@/lib/api";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import BookingCta from "./BookingCta";
import Breadcrumb from "@/components/Breadcrumb";

function getInitials(name: string) {
  return name.split(" ").filter((w) => w.length > 1).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1.2" strokeLinejoin="round">
      <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
    </svg>
  );
}

function StarRow({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span aria-label={`${value} ulduz`} style={{ display: "inline-flex", gap: 1 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ opacity: i < value ? 1 : 0.22 }}><StarIcon size={size} /></span>
      ))}
    </span>
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
function resolvePsychologist(all: import("@/lib/api").Psychologist[], param: string) {
  const bySlug = all.find((p) => p.slug === param);
  if (bySlug) return bySlug;
  const numeric = parseInt(param, 10);
  if (!isNaN(numeric)) return all.find((p) => p.id === numeric) ?? null;
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

const layoutCss = `
  .ppx-grid { display: grid; grid-template-columns: minmax(0,1fr) 350px; grid-template-areas: "hero book" "body book"; gap: 22px; align-items: start; }
  .ppx-hero { grid-area: hero; }
  .ppx-book { grid-area: book; position: sticky; top: 24px; }
  .ppx-body { grid-area: body; display: flex; flex-direction: column; gap: 18px; min-width: 0; }
  .ppx-bottombar { display: none; }
  @media (max-width: 980px) {
    .ppx-grid { grid-template-columns: 1fr; grid-template-areas: "hero" "book" "body"; }
    .ppx-book { position: static; }
    .ppx-app { padding-bottom: 104px !important; }
    .ppx-bottombar { display: flex; }
  }
`;

export default async function PsychologistProfilePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const allPsychologists = await getPsychologists();
  const psychologist = resolvePsychologist(allPsychologists, slug);
  if (!psychologist) notFound();

  // Canonical URL: numeric ids and stale slugs redirect to current slug
  if (psychologist.slug && psychologist.slug !== slug) {
    redirect(`/psychologists/${psychologist.slug}`);
  }

  const [allPosts, reviews, reviewSummary] = await Promise.all([
    getBlogPosts().catch(() => []),
    getPsychologistReviews(psychologist.id).catch(() => [] as PublicReview[]),
    getPsychologistReviewSummary(psychologist.id).catch(
      () => ({ total: 0, average: 0, distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } } as ReviewSummary)
    ),
  ]);

  const posts = allPosts.filter(
    (post) => post.authorName === psychologist.name && post.active && post.status === "PUBLISHED"
  );

  const hasPhoto = !!psychologist.photoUrl?.trim();
  const initials = getInitials(psychologist.name);
  const educations = (psychologist.university || psychologist.degree || psychologist.graduationYear)
    ? [{ institution: psychologist.university ?? "", degree: psychologist.degree ?? "", graduationYear: psychologist.graduationYear ?? "" }]
    : [];
  const sessionMinutes = psychologist.defaultSessionMinutes ?? 50;
  const accent = psychologist.accentColor || "#082F6D";

  return (
    <main style={{ background: "#F0F4FA", minHeight: "100vh", width: "100%", fontFamily: "'Inter', system-ui, sans-serif", color: "var(--oxford)" }}>
      <style>{layoutCss}</style>
      <div className="ppx-app" style={{ width: "100%", padding: "24px 32px 56px", maxWidth: "min(1360px, 94vw)", margin: "0 auto" }}>

        <div style={{ marginBottom: 18 }}>
          <Breadcrumb bare items={[{ label: "Psixoloqlar", href: "/psychologists" }, { label: psychologist.name }]} />
        </div>

        <div className="ppx-grid">

          {/* ===== HERO IDENTITY ===== */}
          <div className="ppx-hero" style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#F2F6FD 0%,#E4ECFA 100%)", border: "1px solid #D6E2F7", borderRadius: 18, padding: 26, boxShadow: "0 2px 12px rgba(8,47,109,.07)" }}>
            <div aria-hidden style={{ position: "absolute", top: -70, right: -50, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle,rgba(16,81,183,.10),transparent 70%)", pointerEvents: "none" }} />
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap", position: "relative" }}>
              <span style={{ width: 100, height: 100, borderRadius: 22, background: accent, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 700, flex: "none", boxShadow: "0 8px 22px rgba(8,47,109,.28)", overflow: "hidden" }}>
                {hasPhoto
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={psychologist.photoUrl} alt={psychologist.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : initials}
              </span>
              <div style={{ flex: 1, minWidth: 230 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 4 }}>
                  <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-.02em" }}>{psychologist.name}</h1>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--brand)", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: ".04em", padding: "4px 10px", borderRadius: 999 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l7 3v6c0 4.5-3 8.3-7 9.5C8 19.3 5 15.5 5 11V5z" /><path d="M9 12l2 2 4-4" /></svg>
                    Doğrulanmış
                  </span>
                </div>
                <div style={{ fontSize: 15, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 16 }}>{psychologist.title}</div>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 18 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><StarIcon size={17} /><span style={{ fontSize: 18, fontWeight: 800 }}>{psychologist.rating}</span></span>
                    <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>Reytinq</span>
                  </div>
                  {psychologist.displayedSessionCount != null && psychologist.displayedSessionCount > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 18, fontWeight: 800 }}>{psychologist.displayedSessionCount}</span>
                      <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>
                        {psychologist.statsSource === "FANUS_PLATFORM" ? "Fanus seansı" : "Əvvəlki seanslar"}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{psychologist.experience}</span>
                    <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>il təcrübə</span>
                  </div>
                </div>
                {psychologist.specializations.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {psychologist.specializations.slice(0, 6).map((tag) => (
                      <span key={tag} style={{ background: "#fff", color: "var(--brand-700)", border: "1px solid #D6E2F7", fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 8 }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===== STICKY BOOKING CARD ===== */}
          <aside className="ppx-book">
            <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 8px 30px rgba(8,47,109,.12)", border: "1px solid #EDF1F8", padding: 22 }}>
              {psychologist.packages && psychologist.packages.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 10 }}>Seans seçimləri</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
                    {psychologist.packages.map((pkg) => (
                      <div key={pkg.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 11, padding: "11px 13px" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{pkg.name}</div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand-700)" }}>{pkg.sessionCount} seans</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 16 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                Seans müddəti: {sessionMinutes} dəq
              </div>

              <BookingCta psychologistId={psychologist.id} psychologistSlug={psychologist.slug} name={psychologist.name} />

              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 16, paddingTop: 16, borderTop: "1px solid #F0F4FA" }}>
                {["Doğrulanmış psixoloq", "Tam məxfilik", "Onlayn video seans"].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, fontWeight: 600, color: "var(--oxford)" }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#D1FAE5", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ===== BODY ===== */}
          <div className="ppx-body">

            {/* Haqqımda */}
            {psychologist.bio && (
              <Block icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>} title="Haqqımda">
                <p style={{ margin: 0, fontSize: 14.5, color: "var(--oxford)", lineHeight: 1.7, fontWeight: 500 }}>{psychologist.bio}</p>
              </Block>
            )}

            {/* İxtisaslar | Təhsil */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 18 }}>
              {psychologist.specializations.length > 0 && (
                <Block icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>} title="İxtisaslar / Yanaşma">
                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    {psychologist.specializations.map((s) => (
                      <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--brand-100)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </Block>
              )}

              {educations.length > 0 && (
                <Block icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5" /></svg>} title="Təhsil">
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {educations.map((e, i) => (
                      <div key={i} style={{ display: "flex", gap: 12 }}>
                        <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-50)", border: "1px solid var(--brand-100)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", color: "var(--brand)" }}>
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z" /></svg>
                        </span>
                        <div>
                          {e.degree && <div style={{ fontSize: 14, fontWeight: 700 }}>{e.degree}</div>}
                          {e.institution && <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>{e.institution}</div>}
                          {e.graduationYear && <div style={{ fontSize: 12, color: "#9DB0CC", fontWeight: 600, marginTop: 1 }}>{e.graduationYear}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Block>
              )}
            </div>

            {/* Dillər və seans */}
            {(psychologist.languages || psychologist.sessionTypes) && (
              <Block icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>} title="Dillər və seans">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  {psychologist.languages && <InfoStat label="Dillər" value={psychologist.languages} />}
                  {psychologist.sessionTypes && <InfoStat label="Seans tipi" value={psychologist.sessionTypes} />}
                  <InfoStat label="Müddət" value={`${sessionMinutes} dəq`} />
                </div>
              </Block>
            )}

            {/* Müştəri rəyləri */}
            <Block icon={<StarIcon size={18} />} title="Müştəri rəyləri">
              <CompactReviews reviews={reviews} summary={reviewSummary} />
            </Block>

            {/* Müəllifin məqalələri */}
            <Block
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>}
              title="Müəllifin məqalələri"
              right={posts.length > 0 ? <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-700)", background: "var(--brand-50)", padding: "4px 10px", borderRadius: 999 }}>{posts.length} məqalə</span> : undefined}
            >
              {posts.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                  {posts.map((post) => (
                    <a key={post.id} href={`/blog/${post.slug}`} style={{ display: "flex", flexDirection: "column", border: "1px solid #EDF1F8", borderRadius: 12, overflow: "hidden", textDecoration: "none", background: "#fff" }}>
                      <div style={{ position: "relative", height: 120, background: "linear-gradient(135deg,var(--brand-50),var(--brand))" }}>
                        {post.coverImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.coverImageUrl} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                        <span style={{ position: "absolute", top: 10, left: 10, background: "rgba(255,255,255,.92)", color: "var(--brand-700)", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{post.category}</span>
                      </div>
                      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--oxford)", lineHeight: 1.35 }}>{post.title}</h3>
                        {post.excerpt && <p style={{ margin: 0, fontSize: 13, color: "var(--oxford-60)", lineHeight: 1.5, flex: 1 }}>{post.excerpt}</p>}
                        <div style={{ fontSize: 12, color: "#9DB0CC", fontWeight: 600 }}>{post.readTimeMinutes} dəq · {formatDate(post.publishedDate)}</div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ background: "var(--brand-50)", borderRadius: 12, padding: "32px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>Hələ dərc edilmiş məqalə yoxdur</div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--oxford-60)" }}>{psychologist.name.split(" ")[0]} burada öz peşəkar yazılarını paylaşacaq.</p>
                </div>
              )}
            </Block>

          </div>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM BAR */}
      <div className="ppx-bottombar" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, background: "#fff", borderTop: "1px solid #E1E9F5", boxShadow: "0 -4px 20px rgba(8,47,109,.10)", padding: "12px 18px", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <BookingCta psychologistId={psychologist.id} psychologistSlug={psychologist.slug} name={psychologist.name} />
        </div>
      </div>
    </main>
  );
}

/* ─── Section block wrapper ──────────────────────────────────────────────── */

function Block({ icon, title, right, children }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {icon}
          <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 11, padding: 13 }}>
      <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

/* ─── Reviews ────────────────────────────────────────────────────────────── */

function CompactReviews({ reviews, summary }: { reviews: PublicReview[]; summary: ReviewSummary }) {
  if (summary.total === 0) {
    return (
      <div style={{ textAlign: "center", padding: "24px 12px" }}>
        <div style={{ marginBottom: 8 }}><StarIcon size={26} /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>Hələ rəy yoxdur</div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--oxford-60)" }}>Bu psixoloqla seans keçmisinizsə, ilk rəyi siz yaza bilərsiniz.</p>
      </div>
    );
  }

  const distMax = Math.max(1, ...[1, 2, 3, 4, 5].map((r) => Number(summary.distribution[String(r)] ?? 0)));

  return (
    <div>
      <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap", paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid #F0F4FA" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 38, fontWeight: 800, color: "var(--oxford)", lineHeight: 1 }}>{summary.average.toFixed(1)}</div>
          <div style={{ margin: "6px 0 2px" }}><StarRow value={Math.round(summary.average)} /></div>
          <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>{summary.total} rəy</span>
        </div>
        <ul style={{ flex: 1, minWidth: 200, listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          {[5, 4, 3, 2, 1].map((r) => {
            const count = Number(summary.distribution[String(r)] ?? 0);
            const pct = (count / distMax) * 100;
            return (
              <li key={r} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>
                <span style={{ width: 10 }}>{r}</span>
                <span style={{ flex: 1, height: 7, background: "#EEF2F9", borderRadius: 999, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${pct}%`, background: "var(--brand)", borderRadius: 999 }} />
                </span>
                <span style={{ width: 22, textAlign: "right" }}>{count}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        {reviews.slice(0, 3).map((r) => (
          <li key={r.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--brand-700)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flex: "none" }}>{r.authorInitials}</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.authorDisplayName}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StarRow value={r.rating} size={11} />
                  <span style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600 }}>{formatRelative(r.createdAt)}</span>
                </div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford)", lineHeight: 1.55 }}>{r.comment}</p>
            {r.reply && (
              <div style={{ marginTop: 8, borderLeft: "3px solid var(--brand)", background: "var(--brand-50)", borderRadius: "0 8px 8px 0", padding: "8px 12px" }}>
                <strong style={{ color: "var(--brand-700)", fontSize: 12.5 }}>Psixoloqun cavabı:</strong>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--oxford)", lineHeight: 1.5 }}>{r.reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {reviews.length > 3 && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, textAlign: "center" }}>Cəmi {summary.total} rəy var</div>
      )}
    </div>
  );
}
