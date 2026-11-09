import { parse as parseHtml } from 'node-html-parser'

import { toNumber } from './parse'

/**
 * OpenDesign Go (`go.open-design.ai`) is an Astro static site: no Flight/RSC
 * payload, but two machine-readable sources in plain HTML —
 * - the pricing page's "Plan allowances" table (`Model credits by plan`) gives
 *   each plan's coding credits and its rolling windows; its JSON settings block
 *   was the earlier source for credits but carries no windows;
 * - the models index carries one `[data-model-panel]` per catalog model (API
 *   model id + input-length tiers with 4 rates) and one `a.catalog-card` per
 *   model (vendor + the plan list that may use it).
 */

export interface OpenDesignTierRates {
  input: number | null
  output: number | null
  cacheRead: number | null
  cacheWrite: number | null
}

/**
 * Row of the pricing page's "Plan allowances" table (`Model credits by plan`):
 * the plan's monthly maximum split into plan-model credits and Coding Plan
 * credits, plus the rolling windows — which apply to Coding Plan credits only
 * ("No limit window" tables as null).
 */
export interface OpenDesignAllowanceRow {
  name: string
  /** Regular monthly price. Validity gate for the row; the card price is static. */
  monthly: number
  /** Coding Plan credits: the pool the plan's coding models draw on. */
  codingCredits: number | null
  /** Seven-day credit window, null when the plan has none. */
  weeklyWindow: number | null
  /** Five-hour credit window, null when the plan has none. */
  fiveHourWindow: number | null
}

/**
 * Design Plan model → credit multiplier (open-design.ai/model-credits). Credits
 * spent = model usage in dollars × multiplier, so a pool of N credits buys
 * `N / multiplier` dollars of that model's usage.
 */
export interface OpenDesignMultiplierRow {
  name: string
  multiplier: number
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

/** `$1,234 Bonus` / `$220` → 1234 / 220; `No limit window` → null. */
function money(text: string): number | null {
  const match = /\$\s*([\d,.]+)/.exec(text)
  return match?.[1] ? toNumber(match[1]) : null
}

function cellTextOf(cell: { text?: string } | null | undefined): string {
  return (cell?.text ?? '').replace(/\s+/g, ' ').trim()
}

export function parseOpenDesignAllowances(html: string): OpenDesignAllowanceRow[] {
  const root = parseHtml(html)
  const table = root.querySelectorAll('table').find(candidate =>
    candidate.querySelectorAll('th, td').some(cell => cellTextOf(cell).toLowerCase().includes('coding plan'))
  )
  if (!table) return []

  const rows = table.querySelectorAll('tr').map(tr => tr.querySelectorAll('th, td').map(cellTextOf))
  const headerCells = rows.flat()
  const headerIndex = (needle: string): number =>
    rows.findIndex(row => row.some(cell => cell.toLowerCase().includes(needle)))
  const headerHas = (needle: string): boolean =>
    rows.some(row => row.some(cell => cell.toLowerCase().includes(needle)))

  const priceCol = headerCells.findIndex(cell => cell.toLowerCase().includes('price'))
  const codingCol = headerCells.findIndex(cell => cell.toLowerCase().includes('coding plan'))
  // The two window headers sit on a second header row that only spans the
  // right-hand columns, so their own cell indexes do not line up with the data
  // rows: the windows are the two columns directly after `Coding Plan`. Their
  // presence is still required, so a layout change fails loudly (empty result)
  // instead of reading the price column as a window.
  if (priceCol < 0 || codingCol < 0 || !headerHas('7-day window') || !headerHas('5-hour window')) return []
  const weeklyCol = codingCol + 1
  const fiveHourCol = codingCol + 2
  const headerRows = new Set([headerIndex('coding plan'), headerIndex('7-day window')].filter(i => i >= 0))

  const allowances: OpenDesignAllowanceRow[] = []
  rows.forEach((cells, index) => {
    if (headerRows.has(index)) return
    const name = cells[0] ?? ''
    const monthly = money(cells[priceCol] ?? '')
    // A row without a plan name or a price is layout, not a plan.
    if (name === '' || monthly == null) return
    allowances.push({
      name,
      monthly,
      codingCredits: money(cells[codingCol] ?? ''),
      weeklyWindow: money(cells[weeklyCol] ?? ''),
      fiveHourWindow: money(cells[fiveHourCol] ?? '')
    })
  })
  return allowances
}

/**
 * Row of the pricing page's "Coding Plan usage" table, Go column: the vendor's
 * own request estimate (per 7 days) and the usage value it quotes. The usage
 * column is a normalisation constant (`usage × multiplier` = the plan's
 * baseline, $60 on Go), NOT an allocation — so only the request count is read.
 */
export interface OpenDesignUsageRow {
  name: string
  /** Vendor "Est. requests / 7 days" for the Go plan, null when not quoted. */
  requestsPerWeek: number | null
}

/**
 * Parses the "Coding Plan usage" table. Rows are `div.dpu-row` (not table rows):
 * the first number cell holds the per-plan request estimates, the second the
 * normalised usage values. Only the Go column is read — the dataset compares
 * the Go plan.
 *
 * The off-peak promo row (`DeepSeek V4.1 Flash Off-peak promo`) quotes a weekly
 * campaign figure instead of a monthly one and is skipped, as everywhere else
 * promos are not baked into the dataset.
 */
export function parseOpenDesignUsage(html: string): OpenDesignUsageRow[] {
  const root = parseHtml(html)
  const rows: OpenDesignUsageRow[] = []
  for (const row of root.querySelectorAll('.dpu-row')) {
    const name = row.querySelector('.dpu-model strong')?.text.replace(/\s+/g, ' ').trim() ?? ''
    if (!name || /promo/i.test(name)) continue
    const cells = row.querySelectorAll('.dpu-number')
    const requestCell = cells[0]
    const usageCell = cells[1]
    if (!requestCell) continue
    // A campaign row quotes "$60 / week" in the usage cell — not a monthly value.
    if (usageCell && /\/\s*week/i.test(usageCell.text)) continue
    const raw = requestCell.querySelector('[data-usage-value="go"]')?.text ?? ''
    rows.push({ name, requestsPerWeek: toNumber(raw.replace(/,/g, '')) })
  }
  return rows
}

/**
 * Parses the "Design Plan models and credit multipliers" table. The Go tab's
 * rate wins (`data-go-rate`, which the model-level rows such as Eco carry);
 * plain rows are the same across tabs and expose the value as text.
 *
 * Promo rows (`DeepSeek V4.1 Flash Off-peak promo`, a separate row with its own
 * dated window) are skipped: the dataset never bakes a promo, and the model's
 * own row carries the regular multiplier.
 */
export function parseOpenDesignMultipliers(html: string): OpenDesignMultiplierRow[] {
  const root = parseHtml(html)
  const table = root.querySelectorAll('table').find(candidate =>
    candidate.querySelectorAll('th, td').some(cell => cellTextOf(cell).toLowerCase() === 'credit multiplier')
  )
  if (!table) return []

  const rows: OpenDesignMultiplierRow[] = []
  for (const row of table.querySelectorAll('tr')) {
    const name = cellTextOf(row.querySelector('th'))
    if (name === '' || name.toLowerCase() === 'model') continue
    if (/promo/i.test(name)) continue
    const value = row.querySelector('.multiplier-value')
    const raw = value?.getAttribute('data-go-rate') ?? cellTextOf(value)
    const multiplier = toNumber(raw.replace(/×/g, ''))
    if (multiplier == null || multiplier <= 0) continue
    rows.push({ name, multiplier })
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
