import type { Model, ModelCaps, ModelDeal, ModelTier, ModelTimeOfDay } from '../../app/types'
import type { RowRates, RowShape, RowTimeOfDay } from './estimates'
import { toNumber, UNDEFINED_SENTINEL } from './parse'

function parseText(value: unknown): string | null {
  if (value == null || value === UNDEFINED_SENTINEL) return null
  return typeof value === 'string' ? value : null
}

function parseFlag(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function parseTierRates(tiers: unknown): ModelTier[] {
  if (!Array.isArray(tiers)) return []
  return tiers
    .filter(tier => tier != null && typeof tier === 'object')
    .map((tier) => {
      const record = tier as Record<string, unknown>
      const rates = (record.rates != null && typeof record.rates === 'object'
        ? record.rates
        : record) as Record<string, unknown>
      return {
        rates: {
          input: toNumber(rates.input),
          output: toNumber(rates.output),
          cacheRead: toNumber(rates.cacheRead ?? rates.cache_read),
          cacheWrite: toNumber(rates.cacheWrite ?? rates.cache_write)
        }
      }
    })
}

function parseDeal(value: unknown): ModelDeal | null {
  if (value == null || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return {
    starts: parseText(record.starts),
    expires: parseText(record.expires),
    free: parseFlag(record.free)
  }
}

function parseCaps(value: unknown): ModelCaps {
  if (value == null || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  return {
    text: parseFlag(record.text),
    vision: parseFlag(record.vision),
    reasoning: parseFlag(record.reasoning)
  }
}

function parseTimeOfDay(value: unknown): ModelTimeOfDay | null {
  if (value == null || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const offPeak = record.offPeak != null && typeof record.offPeak === 'object'
    ? record.offPeak as Record<string, unknown>
    : null
  return {
    offPeak: offPeak
      ? {
          input: toNumber(offPeak.input),
          output: toNumber(offPeak.output),
          cacheRead: toNumber(offPeak.cacheRead),
          cacheWrite: toNumber(offPeak.cacheWrite)
        }
      : null,
    effective: parseText(record.effective)
  }
}

/** A 100% free row (deal "FREE while capacity lasts" or $0 tier-0 rates). Never enters the dataset.
 * A deal with `free:true` but a past `expires` is treated as paid — e.g. typesafe/jev
 * switched from $0 (FREE through 2026-09-24) to $0.042 on 2026-09-25 and must enter
 * the dataset once the promo window closes. */
export function isFreeModel(item: Record<string, unknown>): boolean {
  const deal = item.deal
  if (deal != null && typeof deal === 'object') {
    const record = deal as Record<string, unknown>
    if (record.free === true) {
      const expires = parseText(record.expires)
      if (expires) {
        const t = Date.parse(expires)
        if (!Number.isNaN(t) && t < Date.now()) return false
      }
      return true
    }
  }
  const tiers = Array.isArray(item.tiers) ? parseTierRates(item.tiers) : []
  const first = tiers[0]?.rates
  return !!first && first.input === 0 && first.output === 0 && first.cacheRead === 0
}

/**
 * Stealth/temporary model heuristic: anonymous placeholder with no official
 * lab specs (no context window, no index scores, no lab release date).
 * Never enters the dataset.
 */
export function isStealthModel(item: Record<string, unknown>): boolean {
  return toNumber(item.contextWindow) == null
    && toNumber(item.intelligenceIndex) == null
    && toNumber(item.codingIndex) == null
    && parseText(item.releaseDate) == null
}

export function isExcludedModel(item: Record<string, unknown>): boolean {
  return isFreeModel(item) || isStealthModel(item)
}

export function parseGoatModel(item: unknown): Model | null {
  if (item == null || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  if (isExcludedModel(record)) return null
  return {
    id: parseText(record.id) ?? parseText(record.slug) ?? '',
    slug: parseText(record.slug) ?? '',
    name: parseText(record.name) ?? '',
    vendor: parseText(record.vendor),
    category: parseText(record.category),
    contextWindow: toNumber(record.contextWindow),
    reasoning: parseFlag(record.reasoning),
    vision: parseFlag(record.vision),
    inputCost: toNumber(record.inputCost),
    outputCost: toNumber(record.outputCost),
    cacheReadCost: toNumber(record.cacheReadCost),
    cacheWriteCost: toNumber(record.cacheWriteCost),
    tiers: parseTierRates(record.tiers),
    minPlanName: parseText(record.minPlanName),
    deal: parseDeal(record.deal),
    caps: parseCaps(record.caps ?? { text: true, vision: record.vision, reasoning: record.reasoning }),
    intelligenceIndex: toNumber(record.intelligenceIndex),
    codingIndex: toNumber(record.codingIndex),
    outputTokensPerSec: toNumber(record.outputTokensPerSec),
    releaseDate: parseText(record.releaseDate),
    launchedAt: parseText(record.launchedAt),
    timeOfDay: parseTimeOfDay(record.timeOfDay)
  }
}

export function parseGoatModels(items: unknown): Model[] {
  if (!Array.isArray(items)) return []
  const models: Model[] = []
  for (const item of items) {
    const model = parseGoatModel(item)
    if (model) models.push(model)
  }
  return models
}

function parseRateCosts(value: unknown): RowRates | null {
  if (value == null || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return {
    inputCost: toNumber(record.inputCost ?? record.input),
    outputCost: toNumber(record.outputCost ?? record.output),
    cacheReadCost: toNumber(record.cacheReadCost ?? record.cacheRead ?? record.cache_read)
  }
}

function parseShape(value: unknown): RowShape | null {
  if (value == null || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return {
    inputTokens: toNumber(record.inputTokens),
    outputTokens: toNumber(record.outputTokens),
    cacheReadTokens: toNumber(record.cacheReadTokens)
  }
}

function parseRowTimeOfDay(value: unknown): RowTimeOfDay | null {
  if (value == null || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return {
    effective: parseText(record.effective),
    offPeak: parseRateCosts(record.offPeak)
  }
}

export interface GoatEstimateRow {
  name: string
  budgetUsd: number | null
  rates: RowRates | null
  shape: RowShape | null
  timeOfDay: RowTimeOfDay | null
}

export function parseGoatEstimates(payload: unknown): { rows: GoatEstimateRow[], fiveHourFraction: number, weeklyFraction: number } {
  const fallback = { rows: [] as GoatEstimateRow[], fiveHourFraction: 0.2, weeklyFraction: 0.5 }
  if (payload == null || typeof payload !== 'object') return fallback
  const record = payload as Record<string, unknown>
  const rows = Array.isArray(record.rows) ? record.rows : []
  return {
    rows: rows
      .filter(row => row != null && typeof row === 'object')
      .map((row) => {
        const r = row as Record<string, unknown>
        return {
          name: parseText(r.name) ?? '',
          budgetUsd: toNumber(r.budgetUsd ?? r.budget_usd),
          rates: parseRateCosts(r.rates),
          shape: parseShape(r.shape),
          timeOfDay: parseRowTimeOfDay(r.timeOfDay ?? r.time_of_day)
        }
      }),
    fiveHourFraction: toNumber(record.fiveHourFraction) ?? 0.2,
    weeklyFraction: toNumber(record.weeklyFraction) ?? 0.5
  }
}
