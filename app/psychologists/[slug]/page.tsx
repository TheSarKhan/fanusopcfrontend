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
import ProfileView from "./ProfileView";

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

// Reytinq/rəylər həmişə təzə görünsün — ISR/client-router-cache köhnə prefetch verib
// "yalnız refresh-dən sonra görünür" problemini yaradırdı. Dinamik render bunu aradan qaldırır.
export const dynamic = "force-dynamic";
// force-dynamic təkbaşına KİFAYƏT ETMİR: reytinq mənbəyi olan getPsychologists()
// fetch-i öz `revalidate: 30` dəyəri ilə data-keşdən gəlirdi, ona görə ilk açılışda
// köhnə reytinq görünürdü. Bu route-da bütün fetch-lər keşi keçir.
export const fetchCache = "force-no-store";

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

  // Rəy sorğuları backend səksəkəsində (freeze/502) sakitcə boş qayıtmasın:
  // uğursuzluğu qeyd edirik və ProfileView brauzerdən yenidən yükləyir.
  // Əks halda səhifə "Rəy yoxdur" kimi görünür və yalnız refresh-dən sonra düzəlirdi.
  let reviewsDegraded = false;
  const [allPosts, reviews, reviewSummary] = await Promise.all([
    getBlogPosts().catch(() => []),
    getPsychologistReviews(psychologist.id).catch(() => { reviewsDegraded = true; return [] as PublicReview[]; }),
    getPsychologistReviewSummary(psychologist.id).catch(() => {
      reviewsDegraded = true;
      return { total: 0, average: 0, distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } } as ReviewSummary;
    }),
  ]);

  const posts = allPosts.filter(
    (post) => post.authorName === psychologist.name && post.active && post.status === "PUBLISHED"
  );

  return (
    <ProfileView
      psychologist={psychologist}
      posts={posts}
      reviews={reviews}
      reviewSummary={reviewSummary}
      reviewsDegraded={reviewsDegraded}
    />
  );
}
