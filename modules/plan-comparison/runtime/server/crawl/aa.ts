import type { FetchImpl } from './sources'
import { CRAWLER_USER_AGENT } from './sources'
import { matchName } from './opencode'

export interface AaScoreEntry {
  label: string
  score: number
}

/**
 * Curated map: CMD model id → AA page slug + label fragment identifying the
 * exact variant. Only verified pairs belong here (page must exist and the
 * label must match the CMD model, e.g. dated snapshots like 0902).
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

/** Finds the entry matching a CMD model (variant-aware: 0902 ≠ base). */
export function findAaScore(entries: AaScoreEntry[], label: string): number | null {
  const want = matchName(label)
  const hit = entries.find(e => matchName(e.label) === want)
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
