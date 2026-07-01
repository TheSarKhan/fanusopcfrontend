import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

/** Called by lib/api.ts right after a psychologist/admin mutates a blog post.
 *  Mutations go straight to the Spring backend from the browser, so Next's
 *  own Data Cache has no idea the article changed — without this ping the
 *  public /blog pages keep serving the stale cached response for up to the
 *  fetch's revalidate window. `{ expire: 0 }` forces immediate invalidation
 *  instead of stale-while-revalidate, since the whole point is the psychologist
 *  seeing their edit reflected right away, not after another background fetch. */
export async function POST(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  revalidateTag("blog-posts", { expire: 0 });
  if (slug) revalidateTag(`blog-post-${slug}`, { expire: 0 });

  return NextResponse.json({ revalidated: true });
}
