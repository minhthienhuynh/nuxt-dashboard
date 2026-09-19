export const SOURCE_URLS = {
  goat: 'https://commandcode.ai/docs/plans/goat',
  go: 'https://commandcode.ai/docs/plans/go',
  pricingLimits: 'https://commandcode.ai/docs/resources/pricing-limits',
  openCodeGo: 'https://opencode.ai/docs/go'
} as const

export const CRAWLER_USER_AGENT = 'Mozilla/5.0 (plan-comparison-crawler)'

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

async function fetchText(fetchImpl: FetchImpl, url: string): Promise<string> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchImpl(url, { headers: { 'User-Agent': CRAWLER_USER_AGENT } })
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      return await response.text()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

/** Extracts a bracket-balanced JSON value starting at `start` (the opening bracket). */
function balancedSlice(text: string, start: number): string | null {
  const open = text[start]
  const close = open === '[' ? ']' : open === '{' ? '}' : null
  if (!close) return null
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    // A backslash escapes the next char in both raw JSON and Flight-escaped
    // payloads (where every inner quote arrives as \").
    if (ch === '\\') {
      i++
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function parseFlightJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw)
  } catch {
    try {
      return JSON.parse(raw.replace(/\\"/g, '"').replace(/\\n/g, ''))
    } catch {
      return null
    }
  }
}

/** Iterates candidate JSON values after each occurrence of the given keys. */
function eachJsonCandidate(html: string, keys: string[], open: '[' | '{', visit: (raw: string) => boolean): void {
  for (const key of keys) {
    let from = 0
    while (true) {
      const idx = html.indexOf(key, from)
      if (idx < 0) break
      const openIdx = open === '[' ? html.indexOf('[', idx + key.length) : html.lastIndexOf('{', idx)
      if (openIdx < 0) break
      const raw = balancedSlice(html, openIdx)
      if (raw && visit(raw)) return
      from = (open === '[' ? openIdx : idx) + 1
    }
  }
}

/** Finds the Flight `"models":[...]` array in a Next.js page (escape-aware). */
export function extractFlightModels(html: string): unknown[] {
  let found: unknown[] = []
  eachJsonCandidate(html, ['"models":', '\\"models\\":'], '[', (raw) => {
    const parsed = parseFlightJson(raw)
    if (Array.isArray(parsed)) {
      found = parsed
      return true
    }
    return false
  })
  return found
}

export interface FlightEstimatesPayload {
  rows: unknown
  fiveHourFraction: unknown
  weeklyFraction: unknown
}

/** Finds the `GoatEstimatesTable` payload (`{"rows":[...],"fiveHourFraction":...}`). */
export function extractFlightEstimates(html: string): FlightEstimatesPayload | null {
  let found: FlightEstimatesPayload | null = null
  eachJsonCandidate(html, ['"rows":', '\\"rows\\":'], '{', (raw) => {
    const parsed = parseFlightJson(raw)
    if (parsed != null && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).rows)) {
      const record = parsed as Record<string, unknown>
      if ('fiveHourFraction' in record) {
        found = { rows: record.rows, fiveHourFraction: record.fiveHourFraction, weeklyFraction: record.weeklyFraction }
        return true
      }
    }
    return false
  })
  return found
}

export interface CrawlSources {
  goatHtml: string
  goHtml: string
  pricingLimitsHtml: string
  openCodeGoHtml: string
}

export async function fetchSources(fetchImpl: FetchImpl = fetch): Promise<CrawlSources> {
  const [goatHtml, goHtml, pricingLimitsHtml, openCodeGoHtml] = await Promise.all([
    fetchText(fetchImpl, SOURCE_URLS.goat),
    fetchText(fetchImpl, SOURCE_URLS.go),
    fetchText(fetchImpl, SOURCE_URLS.pricingLimits),
    fetchText(fetchImpl, SOURCE_URLS.openCodeGo)
  ])
  return { goatHtml, goHtml, pricingLimitsHtml, openCodeGoHtml }
}
