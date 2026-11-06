import { parse as parseHtml } from 'node-html-parser'

import { toNumber } from './parse'

/**
 * OpenDesign Go (`go.open-design.ai`) is an Astro static site: no Flight/RSC
 * payload, but two machine-readable sources in plain HTML —
 *
 * - the pricing page embeds `<script type="application/json"
 *   data-corouter-settings>` with one entry per plan (`monthly`/`first`/
 *   `annual`/`year` plus the two credit pools: `design` = Coding Plan credits,
 *   `pool` = plan-model credits);
 * - the models index carries one `[data-model-panel]` per catalog model (API
 *   model id + input-length tiers with 4 rates) and one `a.catalog-card` per
 *   model (vendor + the plan list that may use it).
 */

export interface OpenDesignPlanRow {
  /** `Go` / `Plus` / `Pro` / `Max`. */
  name: string
  /** Regular monthly price — the validity gate for the row (never stored: the
   * card price lives in `data/plans.ts`, promos are not baked into the dataset). */
  monthly: number
  /** Coding Plan credits: the pool the plan's coding models draw on. */
  design: number
}

export interface OpenDesignTierRates {
  input: number | null
  output: number | null
  cacheRead: number | null
  cacheWrite: number | null
}

export interface OpenDesignCatalogModel {
  /** API model id as published by the console (`deepseek-v4.1-flash`). */
  id: string
  slug: string
  name: string
  vendor: string | null
  /** Plan slugs that may call the model: `go` / `plus` / `pro` / `max`. */
  plans: string[]
  /** Input-length tiers, cheapest first, as displayed on the catalog page. */
  tiers: OpenDesignTierRates[]
}

const SETTINGS_RE = /<script[^>]*type="application\/json"[^>]*data-corouter-settings[^>]*>([\s\S]*?)<\/script>/

/** Parses the plan table embedded in the pricing page's JSON settings block. */
export function parseOpenDesignPlans(html: string): OpenDesignPlanRow[] {
  const match = SETTINGS_RE.exec(html)
  if (!match?.[1]) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(match[1])
  } catch {
    return []
  }
  const plans = (parsed as { plans?: unknown })?.plans
  if (!Array.isArray(plans)) return []
  const rows: OpenDesignPlanRow[] = []
  for (const entry of plans) {
    if (entry == null || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const monthly = toNumber(record.monthly)
    // A row without a name or a price is not a plan the card can render. The
    // promo fields (`first`/`annual`/`year`) and plan-model `pool` are read off
    // the page but deliberately not carried: nothing in the dataset consumes
    // them, and stored promos go stale the day they end.
    if (name === '' || monthly == null) continue
    rows.push({
      name,
      monthly,
      design: toNumber(record.design) ?? 0
    })
  }
  return rows
}

/** `Go / Plus / Pro / Max` → `['go', 'plus', 'pro', 'max']`. */
export function parsePlanAccess(text: string): string[] {
  return text
    .split('/')
    .map(part => part.trim().toLowerCase())
    .filter(part => ['go', 'plus', 'pro', 'max'].includes(part))
}

const RATE_KEYS: Array<[keyof OpenDesignTierRates, string]> = [
  ['cacheRead', 'cache read'],
  ['cacheWrite', 'cache write'],
  ['input', 'input'],
  ['output', 'output']
]

function parseTier(tier: { querySelectorAll: (selector: string) => Array<{ querySelector: (selector: string) => { text?: string } | null }> }): OpenDesignTierRates {
  const rates: OpenDesignTierRates = { input: null, output: null, cacheRead: null, cacheWrite: null }
  for (const row of tier.querySelectorAll('dl > div')) {
    const label = (row.querySelector('dt')?.text ?? '').toLowerCase()
    const value = toNumber(row.querySelector('dd')?.text ?? '')
    // Longest labels first: "cache read" also contains no "input", but the
    // explicit order keeps a future "input cache" label from matching twice.
    const hit = RATE_KEYS.find(([, needle]) => label.includes(needle))
    if (hit) rates[hit[0]] = value
  }
  return rates
}

/**
 * Parses the models index: every catalog model with its vendor, the plans that
 * may use it, and its input-length tiers. Cards and panels join on the URL
 * slug, which both carry (`/models/<slug>/` and `id="model-panel-<slug>"`).
 */
export function parseOpenDesignModels(html: string): OpenDesignCatalogModel[] {
  const root = parseHtml(html)

  interface Card { name: string, vendor: string | null, plans: string[] }
  const cards = new Map<string, Card>()
  for (const card of root.querySelectorAll('a.catalog-card')) {
    const slug = /\/models\/([^/]+)\/?$/.exec(card.getAttribute('href') ?? '')?.[1]
    if (!slug) continue
    const access = (card.querySelector('.catalog-card-foot span')?.text ?? '').trim()
    cards.set(slug, {
      name: (card.querySelector('h2')?.text ?? '').trim(),
      vendor: (card.querySelector('.model-tag')?.text ?? '').trim() || null,
      plans: parsePlanAccess(access)
    })
  }

  const models: OpenDesignCatalogModel[] = []
  for (const panel of root.querySelectorAll('[data-model-panel]')) {
    const id = (panel.getAttribute('data-model-panel') ?? '').trim()
    if (id === '') continue
    const slug = (panel.getAttribute('id') ?? '').replace(/^model-panel-/, '')
    const card = cards.get(slug)
    models.push({
      id,
      slug,
      name: (panel.querySelector('h3')?.text ?? '').trim() || card?.name || id,
      vendor: card?.vendor ?? null,
      plans: card?.plans ?? [],
      // A missing header means the panel's rate table did not render: keep the
      // model (it still exists on the plan) with no tiers rather than a
      // zero-priced row.
      tiers: panel.querySelectorAll('.model-explorer-tier').map(parseTier)
    })
  }
  return models
}
