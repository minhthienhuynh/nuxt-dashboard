/**
 * TokenHarbor (`tokenharbor.ai`) is an OpenAI-compatible gateway that sells
 * gateway Passes. The Agent Pass funds a **rule**, not a published model table:
 * "Every model priced at or under $0.20 per 1M input tokens and $1 per 1M
 * output tokens. Also, by name, even when priced above that: `gpt-5.6-luna`
 * and `mimo-v2.5-pro`" (tokenharbor.ai/docs/billing/subscription). The docs
 * say so themselves: "The Plans page lists every model each Pass reaches
 * today... The summary below is the rule itself".
 *
 * So membership is derived here (docs publish the rule, the models page
 * publishes the rates) instead of being copied off a page table:
 * - catalogue: the public Next.js Flight payload on `tokenharbor.ai/models`
 *   (one array per tab) carries per-model `priceIn`/`priceOut`, cache rates,
 *   context window, vendor family and the vendor's own Intelligence Index;
 * - Model Boost: the `Agent Pass · estimated requests` widget on `/pricing`
 *   badges boosted models (`2×`) with a `title` when the multiplier is a promo
 *   ("2x usage during the promo") — a promo multiplier is not baked, because
 *   the promo is already inside the published `priceIn`/`priceOut`.
 */

export interface TokenHarborModel {
  /** API model id, bare (`deepseek-v4.1-flash-1017`). */
  id: string
  label: string
  /** Vendor family slug as published (`deepseek`, `anthropic`, `z-ai`). */
  family: string | null
  tier: string | null
  priceIn: number | null
  priceOut: number | null
  cacheRead: number | null
  cacheWrite: number | null
  contextWindow: number | null
  maxOutput: number | null
  intelligenceIndex: number | null
  /** Published input modalities (`text` / `image` / `file` / `audio`). */
  inputModalities: string[]
  isFree: boolean
  /** Speed variant of another catalogue entry (`gpt-6-luna-fast`). */
  speedOf: string | null
}

/** Row of the `/pricing` pass widget: a model plus its Model Boost badge. */
export interface TokenHarborBoostRow {
  name: string
  multiple: number
  /** The badge's `title` calls it a promo ("2x usage during the promo"). */
  promo: boolean
}

/**
 * Published membership rule of the Agent Pass. Models named here are funded
 * even though their price is above the caps, and they are absent from the
 * pricing page's own comparison map — a count taken from that page is short
 * by these.
 */
export const TOKEN_HARBOR_AGENT_CAPS = { input: 0.2, output: 1 } as const

export const TOKEN_HARBOR_AGENT_BY_NAME = ['gpt-5.6-luna', 'mimo-v2.5-pro'] as const

/**
 * The company's published estimate basis: "a typical agent request of about
 * 10K input (8K from cache) + 1K output". The shape buckets those 10K the way
 * the billing does — 2K billed at the input rate, 8K at the cache-read rate —
 * because the repo's cost math bills `inputTokens` and `cacheReadTokens`
 * separately.
 */
export const TOKEN_HARBOR_REQUEST_SHAPE = {
  inputTokens: 2_000,
  outputTokens: 1_000,
  cacheReadTokens: 8_000
} as const

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function num(value: unknown): number | null {
  return toNumber(value)
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/** Extracts a bracket-balanced JSON value starting at `start` (the opener). */
function balancedSlice(text: string, start: number): string | null {
  const open = text[start]
  const close = open === '[' ? ']' : open === '{' ? '}' : null
  if (!close) return null
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    // A backslash escapes the next char in raw JSON and in the Flight payload
    // (where every inner quote arrives as \").
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

function parseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw)
  } catch {
    try {
      return JSON.parse(raw.replace(/\\"/g, '"'))
    } catch {
      return null
    }
  }
}

interface RawEntry {
  surface?: unknown
  label?: unknown
  family?: unknown
  tier?: unknown
  priceIn?: unknown
  priceOut?: unknown
  cache?: unknown
  contextWindow?: unknown
  maxOutput?: unknown
  intelligenceIndex?: unknown
  inputModalities?: unknown
  isFree?: unknown
  speedBuild?: unknown
}

function cacheRates(cache: unknown): { read: number | null, write: number | null } {
  if (cache == null || typeof cache !== 'object') return { read: null, write: null }
  const record = cache as Record<string, unknown>
  return { read: num(record.read), write: num(record.write) }
}

function modalities(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function entryModel(entry: RawEntry, speedOf: string | null, fallback: { family: string | null, tier: string | null, contextWindow: number | null, maxOutput: number | null, cache: { read: number | null, write: number | null }, intelligenceIndex: number | null, inputModalities: string[] }): TokenHarborModel | null {
  const id = nullableString(entry.surface)
  if (!id) return null
  const isVariant = speedOf != null
  return {
    id,
    label: nullableString(entry.label) ?? id,
    family: isVariant ? fallback.family : nullableString(entry.family),
    tier: isVariant ? fallback.tier : nullableString(entry.tier),
    priceIn: num(entry.priceIn),
    priceOut: num(entry.priceOut),
    // A speed variant only publishes its own rates; cache/context are the base
    // model's (the page renders the variant as a child row of it).
    cacheRead: isVariant ? fallback.cache.read : cacheRates(entry.cache).read,
    cacheWrite: isVariant ? fallback.cache.write : cacheRates(entry.cache).write,
    contextWindow: isVariant ? fallback.contextWindow : num(entry.contextWindow),
    maxOutput: isVariant ? fallback.maxOutput : num(entry.maxOutput),
    intelligenceIndex: isVariant ? fallback.intelligenceIndex : num(entry.intelligenceIndex),
    inputModalities: isVariant ? fallback.inputModalities : modalities(entry.inputModalities),
    isFree: entry.isFree === true || id.includes(':free'),
    speedOf
  }
}

/**
 * Reads every catalogue array in the models page payload: the table renders
 * one array per tab (paid tabs + the free tab) and each paid entry may carry a
 * `speedBuild` variant, which the page shows as its own rate row.
 */
export function parseTokenHarborCatalogue(html: string): TokenHarborModel[] {
  const text = html.replace(/\\"/g, '"')
  const models: TokenHarborModel[] = []
  const seen = new Set<string>()
  let from = 0
  while (true) {
    const marker = text.indexOf('{"surface":', from)
    if (marker < 0) break
    const start = text.lastIndexOf('[', marker)
    const raw = start >= 0 ? balancedSlice(text, start) : null
    from = marker + 1
    if (!raw) continue
    const parsed = parseJson(raw)
    if (!Array.isArray(parsed)) continue
    for (const item of parsed) {
      if (item == null || typeof item !== 'object') continue
      const entry = item as RawEntry
      const id = nullableString(entry.surface)
      if (!id) continue
      const cache = cacheRates(entry.cache)
      const base = {
        family: nullableString(entry.family),
        tier: nullableString(entry.tier),
        contextWindow: num(entry.contextWindow),
        maxOutput: num(entry.maxOutput),
        cache,
        intelligenceIndex: num(entry.intelligenceIndex),
        inputModalities: modalities(entry.inputModalities)
      }
      const model = entryModel(entry, null, base)
      if (!model || seen.has(model.id)) continue
      seen.add(model.id)
      models.push(model)
      const speed = entry.speedBuild
      if (speed == null || typeof speed !== 'object') continue
      const variant = entryModel(speed as RawEntry, model.id, base)
      if (!variant || seen.has(variant.id)) continue
      seen.add(variant.id)
      models.push(variant)
    }
  }
  return models
}

const WIDGET_ROW = /<li class="flex items-center gap-3">([\s\S]*?)<\/li>/g
const WIDGET_NAME = /text-foreground">([^<]+)<\/span>/
const WIDGET_BADGE = /<span[^>]*class="[^"]*accent-lime-soft[^"]*"([^>]*)>([^<]*)<\/span>/

/**
 * Reads the Model Boost badges of the `Agent Pass · estimated requests`
 * widget. The multiplier is a Pass feature when the badge is a bare `2×`, and
 * a promo when its `title` says so — same shape, different permanence.
 */
export function parseTokenHarborBoosts(html: string): TokenHarborBoostRow[] {
  const text = html.replace(/\\"/g, '"')
  const marker = text.search(/estimated requests/)
  if (marker < 0) return []
  // Only the rendered widget (the other tabs are client-side).
  const section = text.slice(marker)
  const rows: TokenHarborBoostRow[] = []
  for (const match of section.matchAll(WIDGET_ROW)) {
    const body = match[1] ?? ''
    const name = WIDGET_NAME.exec(body)?.[1]?.trim()
    if (!name) continue
    const badge = WIDGET_BADGE.exec(body)
    if (!badge) continue
    const attrs = badge[1] ?? ''
    // `2×` (feature) and `2x` (promo) both parse here; the title decides.
    const multiple = num((badge[2] ?? '').replace(/[×x]\s*$/i, ''))
    if (multiple == null || multiple <= 1) continue
    rows.push({ name, multiple, promo: /title="[^"]*promo/i.test(attrs) })
  }
  return rows
}

/** Paid models the Agent Pass funds: the price rule, plus the by-name list. */
export function isAgentPassModel(model: TokenHarborModel): boolean {
  if (model.isFree) return false
  if (TOKEN_HARBOR_AGENT_BY_NAME.includes(model.id as typeof TOKEN_HARBOR_AGENT_BY_NAME[number])) return true
  if (model.priceIn == null || model.priceOut == null) return false
  return model.priceIn <= TOKEN_HARBOR_AGENT_CAPS.input && model.priceOut <= TOKEN_HARBOR_AGENT_CAPS.output
}

/**
 * Cost of one published-profile request ($), or null when the model publishes
 * no rates. Cache-less models bill the whole input at the input rate.
 */
export function tokenHarborRequestCost(model: TokenHarborModel): number | null {
  if (model.priceIn == null || model.priceOut == null) return null
  const cacheRead = model.cacheRead ?? model.priceIn
  return (TOKEN_HARBOR_REQUEST_SHAPE.inputTokens * model.priceIn
    + TOKEN_HARBOR_REQUEST_SHAPE.cacheReadTokens * cacheRead
    + TOKEN_HARBOR_REQUEST_SHAPE.outputTokens * model.priceOut) / 1e6
}

const FAMILY_LABELS: Record<string, string> = {
  'anthropic': 'Anthropic',
  'openai': 'OpenAI',
  'google': 'Google',
  'deepseek': 'DeepSeek',
  'qwen': 'Alibaba',
  'z-ai': 'Z.ai',
  'xiaomi': 'Xiaomi',
  'minimax': 'MiniMax',
  'moonshot': 'Moonshot AI',
  'xai': 'xAI',
  'mistral': 'Mistral'
}

/** Vendor label for a family slug; the slug itself when unpublished. */
export function tokenHarborVendor(family: string | null): string | null {
  if (family == null) return null
  return FAMILY_LABELS[family] ?? family
}
