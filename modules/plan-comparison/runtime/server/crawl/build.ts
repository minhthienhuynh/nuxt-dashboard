import type { Model, Plan, PlanLimits, PlanModelEstimate, PricingEntry } from '../../app/types'
import { computeEstimates, computeRowEstimates } from './estimates'
import type { EstimateFractions } from './estimates'
import { mapOpenCodeModelRows, matchName } from './opencode'
import type { GoatEstimateRow } from './goat'
import type { PricingLimitsSection } from './ccpricing'
import type { OpenCodeEndpointRow, OpenCodeEstimateRow, OpenCodePricingRow } from './opencode'
import { plans } from '../data/plans'

export interface BuildInput {
  goatModels: Model[]
  goatEstimates: GoatEstimateRow[]
  pricingSections: PricingLimitsSection[]
  goCreditsUsd: number | null
  goatFractions: EstimateFractions
  openCodePricing: OpenCodePricingRow[]
  openCodeEstimates: OpenCodeEstimateRow[]
  openCodeEndpoints: OpenCodeEndpointRow[]
  fetchedAt: string
  sourceUrls: {
    goat: string
    go: string
    pricingLimits: string
    openCodeGo: string
  }
}

function planById(id: string): Plan {
  const plan = plans.find(p => p.id === id)
  if (!plan) throw new Error(`Unknown plan id: ${id}`)
  return plan
}

interface EffectiveRates {
  input: number | null
  output: number | null
  cacheRead: number | null
}

/** Page-displayed rates: off-peak override when the model has time-of-day pricing, else tier-0. */
export function effectiveRates(model: Model): EffectiveRates {
  const tier0 = model.tiers[0]?.rates
  const offPeak = model.timeOfDay?.offPeak
  if (offPeak) {
    return {
      input: offPeak.input ?? tier0?.input ?? model.inputCost,
      output: offPeak.output ?? tier0?.output ?? model.outputCost,
      cacheRead: offPeak.cacheRead ?? tier0?.cacheRead ?? model.cacheReadCost
    }
  }
  return {
    input: tier0?.input ?? model.inputCost,
    output: tier0?.output ?? model.outputCost,
    cacheRead: tier0?.cacheRead ?? model.cacheReadCost
  }
}

function pricingEntriesForModel(
  model: Model,
  providerId: string,
  listRates: { input: number | null, output: number | null, cacheRead: number | null, cacheWrite: number | null } | null
): PricingEntry[] {
  const entries: PricingEntry[] = []
  // First entry is the list price the plan tables quote (Was column).
  if (listRates && (listRates.input != null || listRates.output != null)) {
    entries.push({
      provider_id: providerId,
      model_id: model.id,
      tier: 'standard',
      peak_utc_hours: null,
      input: listRates.input ?? 0,
      output: listRates.output ?? 0,
      cache_read: listRates.cacheRead ?? 0,
      cache_write: listRates.cacheWrite ?? null
    })
  }
  const effective = effectiveRates(model)
  if (effective.input != null || effective.output != null) {
    entries.push({
      provider_id: providerId,
      model_id: model.id,
      tier: model.timeOfDay ? 'off_peak' : 'standard',
      peak_utc_hours: null,
      input: effective.input ?? 0,
      output: effective.output ?? 0,
      cache_read: effective.cacheRead ?? 0,
      cache_write: model.tiers[0]?.rates.cacheWrite ?? model.cacheWriteCost ?? null
    })
  }
  return entries
}

function estimateRow(
  planId: string,
  modelId: string,
  budgetUsd: number | null,
  rates: EffectiveRates & { vendor: string | null },
  limits: PlanLimits,
  sourceUrl: string,
  fetchedAt: string
): PlanModelEstimate {
  if (budgetUsd == null || budgetUsd <= 0) {
    return { plan_id: planId, model_id: modelId, monthly_credits_usd: budgetUsd ?? 0, estimates: null, sourceUrl, fetchedAt }
  }
  const computed = computeEstimates(budgetUsd, rates, rates.vendor, limits)
  return {
    plan_id: planId,
    model_id: modelId,
    monthly_credits_usd: budgetUsd,
    estimates: computed ? { per_5h: computed.per5h, per_week: computed.perWeek, per_month: computed.perMonth } : null,
    sourceUrl,
    fetchedAt
  }
}

function onCmdGo(model: Model): boolean {
  const min = (model.minPlanName ?? '').toLowerCase()
  return min === '' || min === 'go'
}

/** Dataset scope: only Go/GOAT models. Pro/Max premium rows are dropped. */
export function isGoGoatModel(model: Model): boolean {
  const min = (model.minPlanName ?? '').toLowerCase()
  return min === 'go' || min === 'goat'
}

/**
 * OC promo rows quote "Free" in every rate cell, which parses to null. Left in,
 * they borrow the plan's monthly credit as a phantom paid model on the charts —
 * the same class of row `isFreeModel` drops on the goat path. A published
 * monthly limit proves a real offering, so rows that have one are kept even
 * when their rate cells failed to parse (never drop a paid row silently).
 */
export function isFreeOcPricing(row: OpenCodePricingRow): boolean {
  return row.input == null && row.output == null && row.cacheRead == null && row.monthlyLimit == null
}

/**
 * CMD slugs dash-separate version dots (`deepseek-v4-1-flash`) while OpenCode
 * Model IDs keep them (`deepseek-v4.1-flash`) and drop the vendor prefix.
 * Compare with dots/dashes/underscores unified so the same model joins
 * instead of splitting into two rows.
 */
export function sameSlug(a: string, b: string): boolean {
  const norm = (s: string): string => s.toLowerCase().replace(/[._]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return norm(a) === norm(b)
}

/**
 * CMD encodes the plan variant in the id suffix (`tencent/hy3-paid`) while
 * OpenCode publishes the bare model id (`hy3`), so the id suffixes and the
 * display names ("Tencent Hy3" vs "Hy3") both miss and the row would split
 * into a metadata-less duplicate.
 */
const VARIANT_SUFFIX = /-(paid|free|exp|experimental|preview|latest|beta)$/

function withoutVariant(id: string): string {
  return id.replace(VARIANT_SUFFIX, '')
}

/** Resolves an OpenCode row to the CMD model id when it is the same model. */
export function resolveOcModelId(
  cmdModels: Model[],
  endpointId: string | null,
  displayName: string
): string | null {
  if (endpointId && cmdModels.some(m => m.id === endpointId)) return endpointId
  if (endpointId) {
    const bySlug = cmdModels.find(m => sameSlug(m.slug, endpointId) || sameSlug(m.id.split('/').pop() ?? '', endpointId))
    if (bySlug) return bySlug.id
    // Same id once the plan-variant qualifier is ignored on either side
    // (`hy3` ↔ `tencent/hy3-paid`). Only a unique match joins: when the
    // catalog holds several variants (`x-paid` and `x-free`) the endpoint id
    // is genuinely ambiguous, so the row keeps its own id instead of joining
    // the wrong variant.
    const bare = withoutVariant(endpointId)
    const variants = cmdModels.filter(m => sameSlug(withoutVariant(m.id.split('/').pop() ?? ''), bare))
    if (variants.length === 1) return variants[0]!.id
  }
  const byName = cmdModels.find(m => matchName(m.name) === matchName(displayName))
  if (byName) return byName.id
  return null
}

export interface BuiltDatabase {
  models: Model[]
  pricing: PricingEntry[]
  plan_models: PlanModelEstimate[]
}

/**
 * Dedupes rows by key, keeping the first occurrence. Pricing is emitted
 * list-price-first, so the surviving row is the list price the plan tables
 * quote; models resolve to one row per slug.
 */
export function dedupeBy<T>(rows: T[], keyOf: (row: T) => string): T[] {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = keyOf(row)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function buildDatabase(input: BuildInput): BuiltDatabase {
  const goatPlan = planById('cmd-goat')
  const goPlan = planById('cmd-go')
  const ocPlan = planById('oc-go')

  const estimateByName = new Map(input.goatEstimates.map(e => [matchName(e.name), e]))
  const listBySlug = new Map(input.pricingSections.map(s => [s.slug, s.rates]))
  const ocEstimateByName = new Map(input.openCodeEstimates.map(e => [matchName(e.name), e]))

  const models: Model[] = input.goatModels.filter(isGoGoatModel)
  const pricing: PricingEntry[] = []
  const planModels: PlanModelEstimate[] = []
  const seenIds = new Set(models.map(m => m.id))

  for (const model of models) {
    pricing.push(...pricingEntriesForModel(model, 'command-code', listBySlug.get(model.slug) ?? null))
    const rates = { ...effectiveRates(model), vendor: model.vendor }
    const estimate = estimateByName.get(matchName(model.name))
    // Script path: the estimate row carries its own rates/shape/fractions.
    // Models missing from the estimates table fall back to derived math.
    const goatComputed = estimate?.budgetUsd != null
      ? computeRowEstimates(estimate.budgetUsd, {
          rates: estimate.rates,
          shape: estimate.shape,
          timeOfDay: estimate.timeOfDay
        }, model.vendor, input.goatFractions)
      : computeEstimates(goatPlan.monthly_credit_usd, rates, model.vendor, goatPlan.limits)
    const goatBudget = estimate?.budgetUsd ?? goatPlan.monthly_credit_usd
    planModels.push({
      plan_id: 'cmd-goat',
      model_id: model.id,
      monthly_credits_usd: goatBudget,
      estimates: goatComputed ? { per_5h: goatComputed.per5h, per_week: goatComputed.perWeek, per_month: goatComputed.perMonth } : null,
      sourceUrl: input.sourceUrls.goat,
      fetchedAt: input.fetchedAt
    })
    if (onCmdGo(model)) {
      const goBudget = input.goCreditsUsd ?? goPlan.monthly_credit_usd
      planModels.push(estimateRow('cmd-go', model.id, goBudget, rates, goPlan.limits, input.sourceUrls.go, input.fetchedAt))
    }
  }

  const ocIdByName = new Map(input.openCodeEndpoints.map(e => [matchName(e.name), e.modelId]))
  // Union of all OC table keys: rows with an endpoint Model ID use it,
  // otherwise a deterministic `opencode/<slug>` id keeps the three OC
  // tables joinable with each other.
  const ocKeys = new Set([
    ...input.openCodePricing.map(p => matchName(p.name)),
    ...input.openCodeEstimates.map(e => matchName(e.name)),
    ...ocIdByName.keys()
  ])
  const ocNameByKey = new Map<string, string>()
  for (const p of input.openCodePricing) ocNameByKey.set(matchName(p.name), p.name)
  for (const e of input.openCodeEndpoints) ocNameByKey.set(matchName(e.name), e.name)
  const ocIdFor = (key: string): string =>
    ocIdByName.get(key) ?? `opencode/${key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

  for (const key of ocKeys) {
    const displayName = ocNameByKey.get(key) ?? input.openCodePricing.find(p => matchName(p.name) === key)?.name ?? key
    // Same model as a CMD row → reuse the CMD id so pricing/estimates join
    // instead of splitting into a duplicate model row.
    const modelId = resolveOcModelId(models, ocIdByName.get(key) ?? null, displayName) ?? ocIdFor(key)
    const priceRows = input.openCodePricing.filter(p => matchName(p.name) === key)
    const price = priceRows[0]
    // Free promo rows never enter the dataset (mirrors goat isFreeModel).
    if (price && isFreeOcPricing(price)) continue
    const estimate = ocEstimateByName.get(key)
    for (const row of priceRows) {
      pricing.push({
        provider_id: 'opencode',
        model_id: modelId,
        tier: row.tier,
        peak_utc_hours: null,
        input: row.input ?? 0,
        output: row.output ?? 0,
        cache_read: row.cacheRead ?? 0,
        cache_write: row.cacheWrite ?? null
      })
    }
    const budget = price?.monthlyLimit ?? ocPlan.monthly_credit_usd
    // Partial published rows are treated as no data: a 0 would corrupt the
    // log-scale dot chart, which only filters null.
    if (estimate?.perMonth != null && estimate.per5h != null && estimate.perWeek != null) {
      planModels.push({
        plan_id: 'oc-go',
        model_id: modelId,
        monthly_credits_usd: budget,
        estimates: { per_5h: estimate.per5h, per_week: estimate.perWeek, per_month: estimate.perMonth },
        sourceUrl: input.sourceUrls.openCodeGo,
        fetchedAt: input.fetchedAt
      })
    } else {
      planModels.push(estimateRow('oc-go', modelId, budget, {
        input: price?.input ?? null,
        output: price?.output ?? null,
        cacheRead: price?.cacheRead ?? null,
        vendor: null
      }, ocPlan.limits, input.sourceUrls.openCodeGo, input.fetchedAt))
    }
    if (!seenIds.has(modelId)) {
      seenIds.add(modelId)
      const [ocModel] = mapOpenCodeModelRows({
        pricing: price ? [price] : [],
        endpoints: [],
        idFor: () => modelId,
        nameFor: () => displayName
      })
      if (ocModel) models.push(ocModel)
    }
  }

  return {
    models: dedupeBy(models, m => m.slug),
    pricing: dedupeBy(pricing, p => `${p.provider_id}:${p.model_id}:${p.tier}`),
    plan_models: dedupeBy(planModels, p => `${p.plan_id}:${p.model_id}`)
  }
}
