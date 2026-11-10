/**
 * Release dates where the live sources are wrong or silent — everything else is
 * resolved at crawl time (see `buildDatabase`): the Command Code Flight payload
 * first, then models.dev, then the family date of a variant.
 *
 * The list is intentionally tiny. An entry means "the live data disagrees with
 * the evidence", so each one carries that evidence:
 *
 * - `zai-org/GLM-5.2-Fast` — models.dev's providers copy GLM-5.2's base date
 *   (2026-06-13) onto the speed variant; the lab announced the variant on
 *   2026-06-23.
 * - `deepseek/deepseek-v4-flash-fast` — a lone aggregator date (2026-04-24)
 *   contradicts the V4 Flash family (2026-07-31) and Command Code listing the
 *   model on 2026-08-22.
 * - `typesafe/jev`, `typesafe/jev-1.14.0` — models.dev has dedicated pages for
 *   these but omits them from the `api.json` payload the crawl reads; the dates
 *   come from those pages (2026-09-15 / 2026-10-14).
 *
 * Keyed by dataset model id; only applied when the payload has no date of its
 * own, so a date Command Code starts publishing always wins.
 */
export const RELEASE_DATE_OVERRIDES: Record<string, string> = {
  'zai-org/GLM-5.2-Fast': '2026-06-23',
  'deepseek/deepseek-v4-flash-fast': '2026-07-31',
  'typesafe/jev': '2026-09-15',
  'typesafe/jev-1.14.0': '2026-10-14'
}

/** A trailing variant word (`-ultrafast`, `-eco`, `-fast`) — never a snapshot id (`-1019`). */
const VARIANT_SUFFIX = /^[a-z]{2,12}$/

function compactSlug(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * The date a variant inherits from its base model, for the variants neither the
 * payload nor models.dev dates (`deepseek-v4.1-flash-ultrafast` reads the
 * `deepseek-v4.1-flash` date). It reads the payload's own models, so the
 * inherited date follows the base model instead of being a hand-maintained copy
 * that goes stale.
 *
 * Only a letters-only suffix counts — a numeric one is a snapshot id with its
 * own release — and the closest (longest) dated base wins. `dated` are the
 * models whose date is already resolved.
 */
export function familyReleaseDate(
  model: { slug: string },
  dated: { slug: string, releaseDate: string | null }[]
): string | null {
  const self = compactSlug(model.slug)
  let best: { date: string, length: number } | null = null
  for (const sibling of dated) {
    if (sibling.releaseDate == null || sibling.slug === model.slug) continue
    const base = compactSlug(sibling.slug)
    if (base.length >= self.length || !self.startsWith(base)) continue
    if (!VARIANT_SUFFIX.test(self.slice(base.length))) continue
    if (best != null && best.length >= base.length) continue
    best = { date: sibling.releaseDate, length: base.length }
  }
  return best?.date ?? null
}
