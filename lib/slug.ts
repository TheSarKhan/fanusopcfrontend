// Slug helpers for psychologist URLs.
// Slug = transliterated lowercase name; on collision a stable 4-digit suffix derived from id.

const AZ_MAP: Record<string, string> = {
  "ə": "e", "ı": "i", "ş": "s", "ç": "c",
  "ğ": "g", "ö": "o", "ü": "u",
};

export function nameToSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[əışçğöü]/g, (ch) => AZ_MAP[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Stable 4-digit suffix derived from a numeric id (1000-9999). */
function stableSuffix(id: number): string {
  return String(1000 + (Math.abs(id) * 7919) % 9000);
}

interface NameId { id: number; name: string }

/**
 * Build a stable Map<id, slug> for a list of psychologists. Same name across
 * multiple rows -> all of them get a `-{suffix}` so URLs stay unique.
 */
export function buildSlugMap<T extends NameId>(items: T[]): Map<number, string> {
  const baseCount = new Map<string, number>();
  const bases: string[] = [];
  for (const it of items) {
    const base = nameToSlug(it.name) || `psy-${it.id}`;
    bases.push(base);
    baseCount.set(base, (baseCount.get(base) ?? 0) + 1);
  }

  const out = new Map<number, string>();
  items.forEach((it, i) => {
    const base = bases[i];
    const slug = (baseCount.get(base) ?? 0) > 1
      ? `${base}-${stableSuffix(it.id)}`
      : base;
    out.set(it.id, slug);
  });
  return out;
}

/** Inject `.slug` onto each item using the same map. */
export function withSlugs<T extends NameId>(items: T[]): (T & { slug: string })[] {
  const map = buildSlugMap(items);
  return items.map((it) => ({ ...it, slug: map.get(it.id) ?? String(it.id) }));
}
