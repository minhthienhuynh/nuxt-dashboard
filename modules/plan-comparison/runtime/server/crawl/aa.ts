import type { FetchImpl } from './sources'
import { CRAWLER_USER_AGENT } from './sources'
import { normalizeName } from './opencode'

export interface AaScoreEntry {
  label: string
  score: number
}

/**
 * Curated overrides — ONLY for user-mandated proxies that generic resolution
 * must never guess (Qwen3.8-Flash has no AA page; user ordered 2026-09-05 to
 * reuse the Flash-Next score). Every other model resolves generically via
 * `resolveAaScore`.
 */
export const AA_MODEL_SLUGS: Record<string, { slug: string, label: string }> = {
  'Qwen/Qwen3.8-Max-0902': { slug: 'qwen3-8-max', label: 'Qwen3.8 Max (0902)' },
  'Qwen/Qwen3.8-Flash': { slug: 'qwen3-8-flash-next', label: 'Qwen3.8-Flash-Next' }
}

export function round1(n: number): number {
  return Number(n.toFixed(1))
}

/** Extracts exact scores from an AA model page JSON-LD Dataset script. */
export function extractAaScores(html: string): AaScoreEntry[] {
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)
  if (!match) return []
  try {
    const parsed: unknown = JSON.parse(match[1] ?? '')
    if (parsed == null || typeof parsed !== 'object') return []
    const data = (parsed as Record<string, unknown>).data
    if (!Array.isArray(data)) return []
    const entries: AaScoreEntry[] = []
    for (const item of data) {
      if (item == null || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      const score = record.artificialAnalysisIntelligenceIndex
      if (typeof record.label === 'string' && typeof score === 'number' && Number.isFinite(score)) {
        entries.push({ label: record.label, score })
      }
    }
    return entries
  } catch {
    return []
  }
}

/**
 * Finds the entry matching a CMD model label, variant-aware: the parenthetical
 * qualifier is part of the identity (`Qwen3.8 Max (0902)` ≠ `Qwen3.8 Max` — a
 * dated snapshot is a distinct variant, per `TIER_WORDS`). Only formatting
 * noise (case, punctuation, `-` vs space) is normalized away.
 */
export function findAaScore(entries: AaScoreEntry[], label: string): number | null {
  const want = normalizeName(label)
  const hit = entries.find(e => normalizeName(e.label) === want)
  return hit ? round1(hit.score) : null
}

export async function fetchAaScore(slug: string, label: string, fetchImpl: FetchImpl = fetch): Promise<number | null> {
  try {
    const response = await fetchImpl(`https://artificialanalysis.ai/models/${slug}`, {
      headers: { 'User-Agent': CRAWLER_USER_AGENT }
    })
    if (!response.ok) return null
    return findAaScore(extractAaScores(await response.text()), label)
  } catch {
    return null
  }
}

/**
 * Serving-tier / snapshot words that may trail a model name without meaning a
 * different model (the underlying model — and its AA score — is the same).
 * Product-shape words (mini/pro/max/small…) are deliberately NOT here: those
 * are distinct models with their own scores.
 */
const TIER_WORDS = new Set([
  'fast', 'highspeed', 'ultraspeed', 'speed', 'preview', 'exp', 'experimental',
  'latest', 'beta', 'paid', 'free'
])

function tailIsTier(longer: string, shorter: string): boolean {
  if (!longer.startsWith(shorter)) return false
  return TIER_WORDS.has(longer.slice(shorter.length))
}

/** Compact key: parens stripped, everything non-alphanumeric removed, so `Qwen3.8` == `Qwen 3.8`. */
function modelKey(name: string): string {
  return name.replace(/\([^)]*\)/g, ' ').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * True when an AA page label and the CMD model name denote the same model.
 * Parentheticals (`(max)`, `(xhigh)`) are stripped; the remaining difference
 * must be a serving-tier word only (compact key ⇒ the whole suffix).
 */
export function labelMatchesModel(modelName: string, label: string): boolean {
  const model = modelKey(modelName)
  const page = modelKey(label)
  if (!model || !page) return false
  if (model === page) return true
  return tailIsTier(model, page) || tailIsTier(page, model)
}

/** Slug candidates by right-trimming suffix tokens (longest first, capped). */
export function aaSlugCandidates(slug: string): string[] {
  const parts = slug.split('-').filter(Boolean)
  const out: string[] = []
  for (let take = parts.length - 1; take >= 2 && out.length < 2; take--) {
    const candidate = parts.slice(0, take).join('-')
    if (candidate !== slug) out.push(candidate)
  }
  return out
}

export interface AaIntelEntry {
  label: string
  score: number
  slug: string | null
}

/**
 * Collects `Intelligence` dataset records (with their `detailsUrl` slug) from
 * ALL JSON-LD scripts. A model page embeds ~20 datasets (Speed, Cost, …) —
 * only the one named "Intelligence" carries intelligence-index values, and
 * leaderboard entries on the page must never be mistaken for the model itself
 * (guarded by the slug + label checks in `scoreForSlug`).
 */
export function extractAaIntelligence(html: string): AaIntelEntry[] {
  const entries: AaIntelEntry[] = []
  for (const match of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(match[1] ?? '')
    } catch {
      continue
    }
    if (parsed == null || typeof parsed !== 'object') continue
    const record = parsed as Record<string, unknown>
    if (record.name !== 'Intelligence' || !Array.isArray(record.data)) continue
    for (const item of record.data) {
      if (item == null || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const score = row.artificialAnalysisIntelligenceIndex
      if (typeof row.label !== 'string' || typeof score !== 'number' || !Number.isFinite(score)) continue
      const details = typeof row.detailsUrl === 'string' ? row.detailsUrl : null
      const slug = details?.startsWith('/models/') ? details.slice('/models/'.length) : null
      entries.push({ label: row.label, score, slug })
    }
  }
  return entries
}

/**
 * Soft-404 guard: real model pages are 3+ MB; misspelled slugs return a ~300KB
 * generic page (and 404s an empty body). The dataset check below is the second
 * gate.
 */
const AA_MIN_PAGE_BYTES = 1_000_000

/** Overridable size gate for tests (set to 0 by `resolveAaScoreForTest`). */
let gate = AA_MIN_PAGE_BYTES

async function fetchAaPage(slug: string, fetchImpl: FetchImpl): Promise<string | null> {
  try {
    const response = await fetchImpl(`https://artificialanalysis.ai/models/${slug}`, {
      headers: { 'User-Agent': CRAWLER_USER_AGENT }
    })
    if (!response.ok) return null
    const html = await response.text()
    return html.length >= gate ? html : null
  } catch {
    return null
  }
}

/**
 * Score of `slug`'s own entry on its page: the record must point back to the
 * same slug AND its label must denote the same model. Max over variants
 * (AA convention: highest reasoning effort).
 */
function scoreForSlug(entries: AaIntelEntry[], slug: string, modelName: string): number | null {
  const hits = entries.filter(e => e.slug === slug && labelMatchesModel(modelName, e.label))
  return hits.length ? round1(Math.max(...hits.map(e => e.score))) : null
}

function slugKey(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, '')
}

let sitemapCache: Promise<string[]> | null = null

function fetchAaSlugs(fetchImpl: FetchImpl): Promise<string[]> {
  sitemapCache ??= (async () => {
    try {
      const response = await fetchImpl('https://artificialanalysis.ai/sitemap.xml', {
        headers: { 'User-Agent': CRAWLER_USER_AGENT }
      })
      if (!response.ok) return []
      const text = await response.text()
      return [...text.matchAll(/\/models\/([a-z0-9.-]+)<\/loc>/g)]
        .map(match => match[1] ?? '')
        .filter(slug => slug !== '')
    } catch {
      return []
    }
  })()
  return sitemapCache
}

/**
 * Generic AA score resolution for a CMD model — no per-model curation:
 * 1. Direct probe of the CMD slug (it usually IS the AA slug).
 * 2. Right-trimmed slugs (`-fast`, `-exp`, … suffixes the CMD page appends).
 * 3. Sitemap slugs whose normalized form overlaps the CMD slug (renames like
 *    `mimo-v2.5` → `mimo-v2-5-0424`, vendor prefixes like `nvidia-…`).
 * Every candidate is verified by the page's own Intelligence record (slug
 * back-reference + model-name match), so a wrong page yields null, not a
 * wrong score. null means AA has not scored the model — left as null.
 */
export async function resolveAaScore(
  model: { slug: string, name: string },
  fetchImpl: FetchImpl = fetch
): Promise<number | null> {
  const tried = new Set<string>()
  const probe = async (slug: string): Promise<number | null> => {
    if (!slug || tried.has(slug)) return null
    tried.add(slug)
    const html = await fetchAaPage(slug, fetchImpl)
    if (!html) return null
    return scoreForSlug(extractAaIntelligence(html), slug, model.name)
  }

  const direct = await probe(model.slug)
  if (direct != null) return direct

  for (const candidate of aaSlugCandidates(model.slug)) {
    const score = await probe(candidate)
    if (score != null) return score
  }

  const wanted = slugKey(model.slug)
  const sitemap = await fetchAaSlugs(fetchImpl)
  const candidates = sitemap
    .filter((slug) => {
      const key = slugKey(slug)
      return key !== wanted && (key.startsWith(wanted) || wanted.startsWith(key))
    })
    .slice(0, 3)
  for (const candidate of candidates) {
    const score = await probe(candidate)
    if (score != null) return score
  }

  return null
}

/** Test seam: run with a tiny size gate so fixtures pass the soft-404 check. */
export async function resolveAaScoreForTest(
  model: { slug: string, name: string },
  fetchImpl: FetchImpl
): Promise<number | null> {
  const saved = AA_MIN_PAGE_BYTES
  try {
    gate = 0
    return await resolveAaScore(model, fetchImpl)
  } finally {
    gate = saved
  }
}
