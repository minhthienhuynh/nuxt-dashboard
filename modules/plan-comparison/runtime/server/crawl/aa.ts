import type { FetchImpl } from './sources'
import { CRAWLER_USER_AGENT } from './sources'
import { normalizeName } from './opencode'

export interface AaScoreEntry {
  label: string
  score: number
}

export interface AaIntelEntry {
  label: string
  score: number
  slug: string | null
}

/**
 * Curated overrides — ONLY for user-mandated proxies that generic resolution
 * must never guess (Qwen3.8-Flash has no AA page; user ordered 2026-09-05 to
 * reuse the Flash-Next score). Every other model resolves generically via
 * `resolveAaScore`.
 */
export const AA_MODEL_SLUGS: Record<string, { slug: string, label: string }> = {
  'Qwen/Qwen3.8-Max-0902': { slug: 'qwen3-8-max', label: 'Qwen3.8 Max (0902)' },
  'Qwen/Qwen3.8-Flash': { slug: 'qwen3-8-flash-next', label: 'Qwen3.8-Flash-Next' },
  // User-mandated join (2026-11-12): CC 'DeepSeek V4 Pro (latest)' (launchedAt
  // 2026-08-13) IS the AA '0813' snapshot — board entry labels both variants,
  // (Max) headlines it.
  'deepseek/deepseek-v4-pro': { slug: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro 0813 (Max)' },
  // User-mandated join (2026-11-12): CC 'DeepSeek V4.1 Flash (latest)' IS the
  // AA '1017' snapshot (releaseDate 2026-10-17) — board headline is (Max).
  'deepseek/deepseek-v4.1-flash': { slug: 'deepseek-v4-1-flash-1017', label: 'DeepSeek V4.1 Flash 1017 (Max)' },
  // Serving-tier and speed variants inheriting DeepSeek V4.1 Flash (1017 snapshot) score:
  'deepseek/deepseek-v4.1-flash-fast': { slug: 'deepseek-v4-1-flash-1017', label: 'DeepSeek V4.1 Flash 1017 (Max)' },
  'deepseek/deepseek-v4.1-flash-ultrafast': { slug: 'deepseek-v4-1-flash-1017', label: 'DeepSeek V4.1 Flash 1017 (Max)' },
  'open-design/deepseek-v4-1-flash-eco': { slug: 'deepseek-v4-1-flash-1017', label: 'DeepSeek V4.1 Flash 1017 (Max)' },
  // Z AI accelerated serving tier inheriting GLM-5.3 Flash score:
  'z-ai/glm-5.3-flashx': { slug: 'glm-5-3-flash', label: 'GLM-5.3-Flash' },
  // inclusionAI unversioned catalog alias matching AA 1019 snapshot entry:
  'inclusionai/ling-3.1-flash': { slug: 'ling-3-1-flash', label: 'Ling 3.1 Flash 1019' },
  // NVIDIA Nemotron 3 Ultra matching AA 550B A55B board label:
  'nvidia/nemotron-3-ultra-550b-a55b': { slug: 'nemotron-3-ultra-550b-a55b', label: 'Nemotron 3 Ultra 550B A55B' }
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

/**
 * Extracts intelligence index score for a specific model from a rendered
 * `/models/<slug>` page. AA embeds its intelligence score inside JSON-LD
 * Dataset chunks and table cells.
 */
export function extractAaIntelligence(html: string): AaScoreEntry[] {
  return extractAaScores(html)
}

export function scoreForSlug(
  entries: AaScoreEntry[],
  slug: string,
  modelName: string
): number | null {
  for (const entry of entries) {
    if (labelMatchesModel(modelName, entry.label)) return round1(entry.score)
  }
  return null
}

const AA_MIN_PAGE_BYTES = 5_000
let gate = AA_MIN_PAGE_BYTES

async function fetchAaPage(slug: string, fetchImpl: FetchImpl): Promise<string | null> {
  try {
    const response = await fetchImpl(`https://artificialanalysis.ai/models/${slug}`, {
      headers: { 'User-Agent': CRAWLER_USER_AGENT }
    })
    if (!response.ok) return null
    const text = await response.text()
    if (text.length < gate) return null
    return text
  } catch {
    return null
  }
}

/**
 * Parses the AA sitemap to discover current model slugs.
 */
export function parseAaSitemap(xml: string): string[] {
  const matches = xml.matchAll(/<loc>https:\/\/artificialanalysis\.ai\/models\/([^<]+)<\/loc>/g)
  const slugs: string[] = []
  for (const m of matches) {
    const slug = m[1]
    if (slug && !slug.includes('/')) slugs.push(slug)
  }
  return slugs
}

let sitemapCache: { fetchedAt: number, slugs: string[] } | null = null
const SITEMAP_TTL_MS = 60 * 60 * 1000

export async function fetchAaSlugs(fetchImpl: FetchImpl = fetch): Promise<string[]> {
  const now = Date.now()
  if (sitemapCache && now - sitemapCache.fetchedAt < SITEMAP_TTL_MS) {
    return sitemapCache.slugs
  }
  try {
    const response = await fetchImpl('https://artificialanalysis.ai/sitemap.xml', {
      headers: { 'User-Agent': CRAWLER_USER_AGENT }
    })
    if (!response.ok) return []
    const slugs = parseAaSitemap(await response.text())
    sitemapCache = { fetchedAt: now, slugs }
    return slugs
  } catch {
    return []
  }
}

function slugKey(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Resolves AA intelligence index score by checking:
 * 1. Exact slug `/models/<slug>`
 * 2. Prefix-trimmed slugs via `aaSlugCandidates`
 * 3. Sitemap slug prefix matches
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

/**
 * Parses intelligence scores from the AA leaderboard page
 * (`/leaderboards/models`). Intelligence Index v5 (v5.0.1, 2026-10-27) embeds
 * an `initialModels` array inside a flight chunk — one record per model with
 * slug/name/intelligenceIndex (null when AA has not measured it) and
 * intelligenceIndexIsEstimated. The chunk keeps every inner quote escaped,
 * so the array is sliced out by bracket balancing and unescaped before a
 * plain JSON parse. Only exact scores are kept (null and estimated entries
 * are dropped), rounded with `round1`. Duplicate slugs keep the first record.
 */
export function parseLeaderboardIntel(html: string): AaIntelEntry[] {
  const key = html.indexOf('initialModels')
  if (key < 0) return []
  const start = html.indexOf('[', key)
  if (start < 0) return []
  let depth = 0
  let end = -1
  let inString = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (ch === '"' && html[i - 1] !== '\\') inString = !inString
    if (inString) continue
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  if (end < 0) return []
  const raw = html.slice(start, end).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  let values: unknown
  try {
    values = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(values)) return []
  const entries: AaIntelEntry[] = []
  const seen = new Set<string>()
  for (const item of values) {
    if (item == null || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const release = row.release && typeof row.release === 'object' ? row.release as Record<string, unknown> : null
    const slug = typeof row.slug === 'string'
      ? row.slug.toLowerCase()
      : typeof release?.slug === 'string'
        ? release.slug.toLowerCase()
        : null
    const name = typeof row.name === 'string' ? row.name : null
    const dedupeKey = typeof row.slug === 'string'
      ? slug
      : (typeof row.id === 'string' ? row.id : (slug && name ? `${slug}:${name}` : slug))
    if (!slug || !name || (dedupeKey && seen.has(dedupeKey))) continue
    if (row.intelligenceIndexIsEstimated === true) continue
    const score = row.intelligenceIndex
    if (typeof score !== 'number' || !Number.isFinite(score)) continue
    if (dedupeKey) seen.add(dedupeKey)
    entries.push({ label: name, score: round1(score), slug })
  }
  return entries
}

/**
 * Variant-aware leaderboard join: every entry whose label denotes the same
 * model (effort and speed variants included, per `labelMatchesModel`)
 * contributes; the highest score wins — AA convention for picking a model's
 * headline score (highest reasoning effort). `null` = no v5 measurement of
 * this model on the board.
 */
export function scoreFromLeaderboard(entries: AaIntelEntry[], modelName: string): number | null {
  let best: number | null = null
  for (const entry of entries) {
    if (!labelMatchesModel(modelName, entry.label)) continue
    if (best == null || entry.score > best) best = entry.score
  }
  return best == null ? null : round1(best)
}

/** Fetches the leaderboard once; failures yield [] (callers fall back to per-model probes). */
export async function fetchLeaderboardIntel(fetchImpl: FetchImpl = fetch): Promise<AaIntelEntry[]> {
  try {
    const response = await fetchImpl('https://artificialanalysis.ai/leaderboards/models', {
      headers: { 'User-Agent': CRAWLER_USER_AGENT }
    })
    if (!response.ok) return []
    return parseLeaderboardIntel(await response.text())
  } catch {
    return []
  }
}
