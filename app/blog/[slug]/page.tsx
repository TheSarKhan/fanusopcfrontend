import { getBlogPostBySlug, getBlogPosts } from "@/lib/api";
import { notFound } from "next/navigation";
import ArticleView from "./ArticleView";

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

  const allPosts = await getBlogPosts().catch(() => []);
  const related = allPosts
    .filter(p => p.slug !== slug && p.category === post.category && p.active)
    .slice(0, 3);

  return <ArticleView post={post} related={related} />;
}
