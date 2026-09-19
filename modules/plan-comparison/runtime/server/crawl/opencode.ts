import { parse as parseHtml } from 'node-html-parser'
import type { HTMLElement } from 'node-html-parser'
import type { Model } from '../../app/types'

import { toNumber } from './parse'

export interface OpenCodePricingRow {
  name: string
  tier: string
  input: number | null
  output: number | null
  cacheRead: number | null
  cacheWrite: number | null
  monthlyLimit: number | null
}

export interface OpenCodeEstimateRow {
  name: string
  per5h: number | null
  perWeek: number | null
  perMonth: number | null
}

export interface OpenCodeEndpointRow {
  name: string
  modelId: string
}

/** Display names differ slightly across the three tables — normalize before joining. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Join key: normalized name with parenthetical qualifiers (`(Off-Peak)`, `(latest)`) stripped. */
export function matchName(name: string): string {
  return normalizeName(name.replace(/\([^)]*\)/g, ' '))
}

function allTableRows(html: string): string[][][] {
  const root = parseHtml(html)
  return root.querySelectorAll('table').map(table =>
    table.querySelectorAll('tr').map(tr =>
      tr.querySelectorAll('th, td').map(cell => cellText(cell))
    )
  )
}

/**
 * Deal markup inside a cell (`<del>old</del><br><strong>current</strong>`,
 * `<br><small>deal note</small>`) is stripped so the surviving text is the
 * currently effective value — the number the page shows, which is what quota
 * means until the deal expires (the crawler refreshes every 24h anyway).
 */
function cellText(cell: HTMLElement): string {
  for (const stale of cell.querySelectorAll('small, del')) stale.remove()
  return (cell.text ?? '').replace(/\s+/g, ' ').trim()
}

function findTable(tables: string[][][], ...needles: string[]): string[][] {
  return tables.find(rows => (rows[0] ?? []).some(c => needles.some(n => c.toLowerCase().includes(n)))) ?? []
}

function headerIndex(header: string[], ...needles: string[]): number {
  return header.findIndex(c => needles.some(n => c.toLowerCase().includes(n)))
}

/** Table: Model | Input | Output | Cached Read | Cached Write | Monthly limit */
export function parseOpenCodePricing(html: string): OpenCodePricingRow[] {
  const rows = findTable(allTableRows(html), 'monthly limit')
  if (rows.length === 0) return []
  const header = rows[0] ?? []
  const idx = {
    model: 0,
    input: headerIndex(header, 'input'),
    output: headerIndex(header, 'output'),
    cacheRead: headerIndex(header, 'cached read', 'cache read'),
    cacheWrite: headerIndex(header, 'cached write', 'cache write'),
    monthlyLimit: headerIndex(header, 'monthly limit')
  }
  if (idx.input < 0) return []
  return rows.slice(1).map((cells) => {
    const rawName = cells[idx.model] ?? ''
    // Qualifier rows: "(Off-Peak)" / "(Peak)" become pricing tiers,
    // context qualifiers ("≤ 256K tokens") stay on the standard tier and the
    // cheapest (first) row wins the later dedupe.
    const lower = rawName.toLowerCase()
    const tier = lower.includes('off-peak') ? 'off_peak' : /\bpeak\b/.test(lower) ? 'peak' : 'standard'
    return {
      name: rawName,
      tier,
      input: toNumber(cells[idx.input] ?? ''),
      output: idx.output >= 0 ? toNumber(cells[idx.output] ?? '') : null,
      cacheRead: idx.cacheRead >= 0 ? toNumber(cells[idx.cacheRead] ?? '') : null,
      cacheWrite: idx.cacheWrite >= 0 ? toNumber(cells[idx.cacheWrite] ?? '') : null,
      monthlyLimit: idx.monthlyLimit >= 0 ? toNumber(cells[idx.monthlyLimit] ?? '') : null
    }
  }).filter(row => row.name !== '')
}

/** Table: Model | requests per 5 hour | requests per week | requests per month */
export function parseOpenCodeEstimates(html: string): OpenCodeEstimateRow[] {
  const rows = findTable(allTableRows(html), 'requests per month')
  if (rows.length === 0) return []
  const header = rows[0] ?? []
  const idx = {
    per5h: headerIndex(header, '5 hour'),
    perWeek: headerIndex(header, 'per week'),
    perMonth: headerIndex(header, 'per month')
  }
  if (idx.per5h < 0) return []
  return rows.slice(1).map(cells => ({
    name: cells[0] ?? '',
    per5h: toNumber(cells[idx.per5h] ?? ''),
    perWeek: idx.perWeek >= 0 ? toNumber(cells[idx.perWeek] ?? '') : null,
    perMonth: idx.perMonth >= 0 ? toNumber(cells[idx.perMonth] ?? '') : null
  })).filter(row => row.name !== '')
}

/** Table: Model | Model ID | Endpoint | AI SDK Package */
export function parseOpenCodeEndpoints(html: string): OpenCodeEndpointRow[] {
  const rows = findTable(allTableRows(html), 'model id')
  if (rows.length === 0) return []
  const header = rows[0] ?? []
  const idIdx = headerIndex(header, 'model id')
  if (idIdx < 0) return []
  return rows.slice(1).map(cells => ({
    name: cells[0] ?? '',
    modelId: (cells[idIdx] ?? '').trim()
  })).filter(row => row.name !== '' && row.modelId !== '')
}

export interface OpenCodeModelRows {
  pricing: OpenCodePricingRow[]
  endpoints: OpenCodeEndpointRow[]
  idFor?: (key: string) => string | null
  nameFor?: (key: string) => string | null
}

/**
 * Maps OpenCode Go rows into CMD-shape models. The HTML carries no
 * contextWindow/tiers/launchedAt/index scores, so those stay null — the CMD
 * script remains the source for them when the same model exists there.
 */
export function mapOpenCodeModelRows({ pricing, endpoints, idFor, nameFor }: OpenCodeModelRows): Model[] {
  const priceByKey = new Map<string, OpenCodePricingRow>()
  for (const r of pricing) {
    // Qualifier rows share the base model key; the cheapest (first) wins.
    const key = matchName(r.name)
    if (!priceByKey.has(key)) priceByKey.set(key, r)
  }
  const endpointByKey = new Map(endpoints.map(r => [matchName(r.name), r]))
  const names = new Set([...priceByKey.keys(), ...endpointByKey.keys()])
  const models: Model[] = []
  for (const key of names) {
    const price = priceByKey.get(key)
    const endpoint = endpointByKey.get(key)
    const fallbackId = key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const id = idFor?.(key) ?? endpoint?.modelId ?? `opencode/${fallbackId}`
    const rawName = nameFor?.(key) ?? price?.name ?? endpoint?.name ?? key
    const name = rawName.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
    models.push({
      id,
      slug: id.replace(/^opencode\//, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, ''),
      name,
      vendor: null,
      category: null,
      contextWindow: null,
      reasoning: null,
      vision: null,
      inputCost: price?.input ?? null,
      outputCost: price?.output ?? null,
      cacheReadCost: price?.cacheRead ?? null,
      cacheWriteCost: price?.cacheWrite ?? null,
      tiers: [],
      minPlanName: null,
      deal: null,
      caps: {},
      intelligenceIndex: null,
      codingIndex: null,
      outputTokensPerSec: null,
      releaseDate: null,
      launchedAt: null,
      timeOfDay: null
    })
  }
  return models
}

export function mapOpenCodeModels(html: string): Model[] {
  return mapOpenCodeModelRows({
    pricing: parseOpenCodePricing(html),
    endpoints: parseOpenCodeEndpoints(html)
  })
}
