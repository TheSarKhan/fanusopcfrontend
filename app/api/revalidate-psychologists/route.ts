import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

/** Called by lib/api.ts right after a psychologist/admin mutates a psychologist's
 *  public profile (photo, bio, pricing, etc). Mutations go straight to the Spring
 *  backend from the browser, so Next's own Data Cache has no idea anything changed
 *  — without this ping the public /psychologists pages keep serving the stale
 *  cached response for up to the fetch's revalidate window. `{ expire: 0 }` forces
 *  immediate invalidation instead of stale-while-revalidate, since the whole point
 *  is the psychologist seeing their edit reflected right away, not after another
 *  background fetch. */
export async function POST() {
  revalidateTag("psychologists", { expire: 0 });
  return NextResponse.json({ revalidated: true });
}
