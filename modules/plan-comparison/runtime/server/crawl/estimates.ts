import type { PlanLimits } from '../../app/types'

export interface EstimateRates {
  input: number | null
  output: number | null
  cacheRead: number | null
}

export interface ComputedEstimates {
  per5h: number
  perWeek: number
  perMonth: number
}

export interface EstimateFractions {
  fiveHour: number
  weekly: number
}

export interface RowShape {
  inputTokens: number | null
  outputTokens: number | null
  cacheReadTokens: number | null
}

export interface RowRates {
  inputCost: number | null
  outputCost: number | null
  cacheReadCost: number | null
}

export interface RowTimeOfDay {
  effective: string | null
  offPeak: RowRates | null
}

export interface EstimateRowInput {
  rates: RowRates | null
  shape: RowShape | null
  timeOfDay: RowTimeOfDay | null
}

const DEFAULT_SHAPE_IN = 800
const DEFAULT_SHAPE_CACHE_READ = 50000

const VENDOR_OUTPUT_TOKENS: Array<[string, number]> = [
  ['anthropic', 180],
  ['openai', 160],
  ['moonshot', 200],
  ['z.ai', 150],
  ['zai', 150],
  ['minimax', 125],
  ['deepseek', 200],
  ['alibaba', 200],
  ['stepfun', 200]
]

export function outputTokensForVendor(vendor: string | null): number {
  // Script keys are exact provider names ("Z.ai", "Moonshot AI") while crawled
  // vendor strings vary ("Z AI") — compare alphanumeric-only so spacing and
  // dots never drop a model to the 200 fallback (e.g. FlashX 2330 vs 2360).
  const key = (vendor ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  for (const [prefix, tokens] of VENDOR_OUTPUT_TOKENS) {
    if (key.includes(prefix.replace(/[^a-z0-9]+/g, ''))) return tokens
  }
  return 200
}

/** Page rounding: `ku` = `Number(n.toPrecision(3))`. */
export function round3(n: number): number {
  return Number(n.toPrecision(3))
}

function isLive(effective: string | null, now: number): boolean {
  if (!effective) return false
  const parsed = Date.parse(effective)
  return !Number.isNaN(parsed) && now >= parsed
}

/**
 * Mirrors the docs script (`wr`): once a row's time-of-day schedule is live,
 * the table prices off-peak rates.
 */
export function resolveRowRates(row: EstimateRowInput, now = Date.now()): EstimateRates {
  const base = row.rates
  if (row.timeOfDay && isLive(row.timeOfDay.effective, now) && row.timeOfDay.offPeak) {
    const offPeak = row.timeOfDay.offPeak
    return {
      input: offPeak.inputCost ?? base?.inputCost ?? null,
      output: offPeak.outputCost ?? base?.outputCost ?? null,
      cacheRead: offPeak.cacheReadCost ?? base?.cacheReadCost ?? null
    }
  }
  return {
    input: base?.inputCost ?? null,
    output: base?.outputCost ?? null,
    cacheRead: base?.cacheReadCost ?? null
  }
}

/** Mirrors the docs script shape: per-row override, else 800 in / 180 out / 50K cache-read. */
export function resolveRowShape(row: EstimateRowInput, vendor: string | null): { input: number, output: number, cache: number } {
  return {
    input: row.shape?.inputTokens ?? DEFAULT_SHAPE_IN,
    output: row.shape?.outputTokens ?? outputTokensForVendor(vendor),
    cache: row.shape?.cacheReadTokens ?? DEFAULT_SHAPE_CACHE_READ
  }
}

function costPerRequest(rates: EstimateRates, shape: { input: number, output: number, cache: number }): number {
  return (shape.input / 1e6) * (rates.input ?? 0)
    + (shape.output / 1e6) * (rates.output ?? 0)
    + (shape.cache / 1e6) * (rates.cacheRead ?? 0)
}

/**
 * Replicates the docs script estimate path (`v8` + `ku`): exact monthly
 * allowance over cost-per-request, windows as fractions of the exact month.
 */
export function computeRowEstimates(
  budgetUsd: number,
  row: EstimateRowInput,
  vendor: string | null,
  fractions: EstimateFractions,
  now = Date.now()
): ComputedEstimates | null {
  if (!(budgetUsd > 0)) return null
  const cost = costPerRequest(resolveRowRates(row, now), resolveRowShape(row, vendor))
  if (!(cost > 0)) return null
  const exactMonth = budgetUsd / cost
  return {
    perMonth: round3(exactMonth),
    per5h: round3(exactMonth * fractions.fiveHour),
    perWeek: round3(exactMonth * fractions.weekly)
  }
}

/**
 * Derived-request path (no published row, e.g. cmd-go): same script math with
 * the default shape and plan-limit ratios for the windows.
 */
export function computeEstimates(
  budgetUsd: number,
  rates: EstimateRates,
  vendor: string | null,
  planLimits: PlanLimits
): ComputedEstimates | null {
  return computeRowEstimates(budgetUsd, {
    rates: { inputCost: rates.input, outputCost: rates.output, cacheReadCost: rates.cacheRead },
    shape: null,
    timeOfDay: null
  }, vendor, {
    fiveHour: planLimits['5h'] / planLimits.monthly,
    weekly: planLimits.weekly / planLimits.monthly
  })
}
