import { parse as parseHtml } from 'node-html-parser'
import type { HTMLElement } from 'node-html-parser'
import type { Model } from '../../app/types'

import { toNumber } from './parse'
import { round3 } from './estimates'

const VENDOR_PREFIX_MAP: Record<string, string> = {
  deepseek: 'DeepSeek',
  alibaba: 'Alibaba',
  tencent: 'Tencent',
  xiaomi: 'Xiaomi',
  zhipuai: 'Z.ai',
  moonshotai: 'Moonshot AI',
  meituan: 'Meituan',
  minimax: 'MiniMax',
  openai: 'OpenAI',
  google: 'Google',
  anthropic: 'Anthropic',
  xai: 'xAI',
  meta: 'Meta',
  stepfun: 'StepFun'
}

export function openCodeVendor(canonicalId: string | null | undefined, name?: string): string | null {
  if (canonicalId && canonicalId.includes('/')) {
    const prefix = canonicalId.split('/')[0]!.toLowerCase()
    if (VENDOR_PREFIX_MAP[prefix]) return VENDOR_PREFIX_MAP[prefix]
    return prefix.charAt(0).toUpperCase() + prefix.slice(1)
  }
  const n = (name ?? '').toLowerCase()
  if (n.includes('deepseek')) return 'DeepSeek'
  if (n.includes('qwen')) return 'Alibaba'
  if (n.includes('glm')) return 'Z.ai'
  if (n.includes('kimi')) return 'Moonshot AI'
  if (n.includes('mimo')) return 'Xiaomi'
  if (n.includes('minimax')) return 'MiniMax'
  if (n.includes('hy3') || n.includes('hy4')) return 'Tencent'
  if (n.includes('longcat')) return 'Meituan'
  if (n.includes('grok')) return 'xAI'
  if (n.includes('claude')) return 'Anthropic'
  if (n.includes('gemini')) return 'Google'
  if (n.includes('gpt')) return 'OpenAI'
  if (n.includes('step')) return 'StepFun'
  if (n.includes('muse')) return 'Meta'
  return null
}

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

export interface OpenCodeApiResult {
  pricing: OpenCodePricingRow[]
  endpoints: OpenCodeEndpointRow[]
  catalogModels: Model[]
}

/** Parse REST API response from https://opencode.ai/inference/go/v1/models */
export function parseOpenCodeApi(payload: string | unknown): OpenCodeApiResult {
  const data = typeof payload === 'string'
    ? (() => {
        try {
          return JSON.parse(payload)
        } catch {
          return null
        }
      })()
    : payload

  const items = Array.isArray((data as { data?: unknown })?.data)
    ? (data as { data: Record<string, unknown>[] }).data
    : []

  const pricing: OpenCodePricingRow[] = []
  const endpoints: OpenCodeEndpointRow[] = []
  const catalogModels: Model[] = []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const goObj = item.go as Record<string, unknown> | undefined
    const monthlyUsage = goObj?.monthly_usage as Record<string, unknown> | undefined
    const monthlyLimit = toNumber(monthlyUsage?.go)
    // Only paid Go models enter the Go dataset
    if (monthlyLimit == null || monthlyLimit <= 0) continue

    const name = String(item.name ?? item.id ?? '').trim()
    if (!name) continue
    const modelId = String(item.id ?? '').trim()

    const cost = item.cost as Record<string, unknown> | undefined
    const costText = cost?.text as Record<string, unknown> | undefined
    const costInput = costText?.input as Record<string, unknown> | undefined
    const costOutput = costText?.output as Record<string, unknown> | undefined
    const cacheObj = costInput?.cache as Record<string, unknown> | undefined

    const input = toNumber(costInput?.price)
    const output = toNumber(costOutput?.price)
    const cacheRead = toNumber(cacheObj?.read)
    const cacheWrite = toNumber(cacheObj?.write)

    pricing.push({
      name,
      tier: 'standard',
      input,
      output,
      cacheRead,
      cacheWrite,
      monthlyLimit
    })

    if (modelId) {
      endpoints.push({
        name,
        modelId
      })
    }

    const rates = {
      input,
      output,
      cacheRead,
      cacheWrite
    }
    const modalities = item.modalities as Record<string, unknown> | undefined
    const vision = Array.isArray(modalities?.input) && modalities.input.some((m: unknown) => typeof m === 'string' && m.startsWith('image'))
    const capabilities = item.capabilities as Record<string, unknown> | undefined
    const reasoningObj = capabilities?.reasoning as Record<string, unknown> | undefined
    const reasoning = Boolean(reasoningObj?.supported)
    const canonicalId = typeof item.canonical_id === 'string' ? item.canonical_id : null
    const vendor = openCodeVendor(canonicalId, name)
    const slug = modelId.replace(/^opencode\//, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, '')
    const limit = item.limit as Record<string, unknown> | undefined

    catalogModels.push({
      id: modelId,
      slug,
      name,
      vendor,
      category: typeof item.family === 'string' ? item.family : null,
      contextWindow: toNumber(limit?.context),
      reasoning,
      vision,
      inputCost: input,
      outputCost: output,
      cacheReadCost: cacheRead,
      cacheWriteCost: cacheWrite,
      tiers: [{ rates }],
      minPlanName: null,
      deal: null,
      caps: { text: true, vision, reasoning },
      intelligenceIndex: null,
      codingIndex: null,
      outputTokensPerSec: null,
      releaseDate: item.release_date ? String(item.release_date).trim() : null,
      launchedAt: null,
      timeOfDay: null
    })
  }

  return { pricing, endpoints, catalogModels }
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
  const scoped = root.querySelectorAll('[data-plan-panel="go"] table')
  const tables = scoped.length > 0
    ? [...scoped, ...root.querySelectorAll('table').filter(t => !scoped.includes(t))]
    : root.querySelectorAll('table')
  return tables.map(table =>
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

/**
 * Table: Model | requests per 5 hour | requests per week | requests per month
 * Supports both modern Console table (data-allowance-type="requests") with 5h -> week/month scaling,
 * and legacy docs table format.
 */
export function parseOpenCodeEstimates(html: string): OpenCodeEstimateRow[] {
  if (!html) return []
  const root = parseHtml(html)

  // 1. Modern console/go table
  const table = root.querySelector('table')
  if (table && table.querySelector('[data-allowance-type="requests"]')) {
    const trs = table.querySelectorAll('tr')
    const rows: OpenCodeEstimateRow[] = []
    for (const tr of trs.slice(1)) {
      const th = tr.querySelector('th')
      const reqTd = tr.querySelector('td[data-allowance-type="requests"]')
      if (!th || !reqTd) continue

      const rawName = th.querySelector('span')?.text ?? th.text ?? ''
      const name = rawName.replace(/New|Limited.*$/i, '').trim()
      if (!name) continue

      const reqText = reqTd.querySelector('[data-plan="go"] [data-layer="current-value"]')?.text
        ?? reqTd.querySelector('[data-plan="go"]')?.text
        ?? ''
      const per5h = toNumber(reqText)
      if (per5h == null) continue

      const perWeek = round3(per5h * 2.5)
      const perMonth = round3(per5h * 5.0)
      rows.push({
        name,
        per5h,
        perWeek,
        perMonth
      })
    }
    if (rows.length > 0) return rows
  }

  // 2. Legacy docs table format fallback
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
