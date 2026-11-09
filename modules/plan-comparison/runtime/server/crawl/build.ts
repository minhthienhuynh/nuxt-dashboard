import type { Model, Plan, PlanLimits, PlanModelEstimate, PricingEntry } from '../../app/types'
import { computeEstimates, computeRowEstimates } from './estimates'
import type { ComputedEstimates, EstimateFractions } from './estimates'
import { mapOpenCodeModelRows, matchName } from './opencode'
import type { FlightEstimateRow, GoatEstimateRow } from './goat'
import type { PricingLimitsSection } from './ccpricing'
import type { OpenCodeEndpointRow, OpenCodeEstimateRow, OpenCodePricingRow } from './opencode'
import type { OpenDesignAllowanceRow, OpenDesignCatalogModel, OpenDesignMultiplierRow } from './opendesign'
import type { TokenHarborBoostRow, TokenHarborModel } from './tokenharbor'
import { TOKEN_HARBOR_AGENT_CAPS, TOKEN_HARBOR_MODEL_ALIASES, TOKEN_HARBOR_OFFICE_CAPS, TOKEN_HARBOR_REQUEST_SHAPE, isAgentPassModel, isOfficePassModel, tokenHarborRequestCost, tokenHarborVendor } from './tokenharbor'
import { plans } from '../data/plans'

export interface BuildInput {
  goatModels: Model[]
  goatEstimates: GoatEstimateRow[]
  pricingSections: PricingLimitsSection[]
  goCreditsUsd: number | null
  goatFractions: EstimateFractions
  goEstimates: FlightEstimateRow[]
  goFractions: EstimateFractions
  openCodePricing: OpenCodePricingRow[]
  openCodeEstimates: OpenCodeEstimateRow[]
  openCodeEndpoints: OpenCodeEndpointRow[]
  openDesignAllowances: OpenDesignAllowanceRow[]
  openDesignModels: OpenDesignCatalogModel[]
  openDesignMultipliers: OpenDesignMultiplierRow[]
  tokenHarborModels: TokenHarborModel[]
  tokenHarborBoosts: TokenHarborBoostRow[]
  fetchedAt: string
  sourceUrls: {
    goat: string
    go: string
    pricingLimits: string
    openCodeGo: string
    /** Where the OpenDesign pool/plan table lives. */
    openDesignPricing: string
    /** Where the OpenDesign per-model rates live. */
    openDesignModels: string
    /** Where the OpenDesign credit multipliers live. */
    openDesignCredits: string
    /** TokenHarbor model catalogue (rates, vendor, intelligence index). */
    tokenHarborModels: string
    /** TokenHarbor pricing page — the Agent Pass widget's Model Boost badges. */
    tokenHarborPricing: string
  }
}

function planById(id: string): Plan {
  const plan = plans.find(p => p.id === id)
  if (!plan) throw new Error(`Unknown plan id: ${id}`)
  return plan
}

/**
 * Allowance row (coding credits + rolling windows) of a named OpenDesign plan,
 * or null when the page no longer lists it.
 */
export function allowanceFor(rows: OpenDesignAllowanceRow[], name: string): OpenDesignAllowanceRow | null {
  return rows.find(row => row.name.toLowerCase() === name.toLowerCase()) ?? null
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

/** Minimal catalog entry for a model a plan funds but no catalog source lists. */
function emptyModel(id: string, name: string): Model {
  return {
    id,
    slug: id.split('/')[1] ?? id,
    name,
    vendor: null,
    category: null,
    contextWindow: null,
    reasoning: null,
    vision: null,
    inputCost: null,
    outputCost: null,
    cacheReadCost: null,
    cacheWriteCost: null,
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
  }
}

/**
 * Catalog entry for a TokenHarbor-only model: the gateway publishes rates,
 * context window, vendor family and its own intelligence index, so the row
 * carries real metadata instead of the `emptyModel` shell.
 */
export function tokenHarborCatalogEntry(id: string, model: TokenHarborModel): Model {
  const rates = {
    input: model.priceIn,
    output: model.priceOut,
    cacheRead: model.cacheRead,
    cacheWrite: model.cacheWrite
  }
  const vision = model.inputModalities.includes('image')
  return {
    id,
    slug: id.split('/')[1] ?? id,
    name: model.label,
    vendor: tokenHarborVendor(model.family),
    category: null,
    contextWindow: model.contextWindow,
    reasoning: null,
    vision,
    inputCost: model.priceIn,
    outputCost: model.priceOut,
    cacheReadCost: model.cacheRead,
    cacheWriteCost: model.cacheWrite,
    tiers: [{ rates }],
    minPlanName: null,
    deal: null,
    caps: { text: true, vision },
    intelligenceIndex: model.intelligenceIndex,
    codingIndex: null,
    outputTokensPerSec: null,
    releaseDate: null,
    launchedAt: null,
    timeOfDay: null
  }
}

/** `DeepSeek V4.1 Flash Eco` → `deepseek-v4-1-flash-eco`. */
export function slugifyModelName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function planModelRow(
  planId: string,
  modelId: string,
  budgetUsd: number | null,
  computed: ComputedEstimates | null,
  sourceUrl: string,
  fetchedAt: string
): PlanModelEstimate {
  return {
    plan_id: planId,
    model_id: modelId,
    monthly_credits_usd: budgetUsd ?? 0,
    estimates: computed ? { per_5h: computed.per5h, per_week: computed.perWeek, per_month: computed.perMonth } : null,
    sourceUrl,
    fetchedAt
  }
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
    return planModelRow(planId, modelId, budgetUsd, null, sourceUrl, fetchedAt)
  }
  const computed = computeEstimates(budgetUsd, rates, rates.vendor, limits)
  return planModelRow(planId, modelId, budgetUsd, computed, sourceUrl, fetchedAt)
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

/**
 * Resolves a provider row (OpenCode endpoint id or OpenDesign panel id) to the
 * CMD catalog model id when it is the same model.
 */
export function resolveCatalogModelId(
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
  const odPlan = planById('od-go')

  const estimateByName = new Map(input.goatEstimates.map(e => [matchName(e.name), e]))
  const goEstimateByName = new Map(input.goEstimates.map(e => [matchName(e.name), e]))
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
    planModels.push(planModelRow('cmd-goat', model.id, goatBudget, goatComputed, input.sourceUrls.goat, input.fetchedAt))
    if (onCmdGo(model)) {
      // Script path: the Go estimates table publishes per-model budgets with
      // its own rates/shape/fractions (Go is per-model credits since 2026-09-28).
      // Models missing from that table fall back to the legacy flat-budget math.
      // A row whose rates fail to parse keeps its budget with null estimates
      // (mirrors estimateRow: null estimates are filtered from the log chart).
      const goEstimate = goEstimateByName.get(matchName(model.name))
      const goBudget = goEstimate?.budgetUsd ?? input.goCreditsUsd ?? goPlan.monthly_credit_usd
      if (goEstimate?.budgetUsd != null) {
        const goComputed = computeRowEstimates(goEstimate.budgetUsd, {
          rates: goEstimate.rates,
          shape: goEstimate.shape,
          timeOfDay: goEstimate.timeOfDay
        }, model.vendor, input.goFractions)
        planModels.push(planModelRow('cmd-go', model.id, goBudget, goComputed, input.sourceUrls.go, input.fetchedAt))
      } else {
        planModels.push(estimateRow('cmd-go', model.id, goBudget, rates, goPlan.limits, input.sourceUrls.go, input.fetchedAt))
      }
    }
  }

  const ocIdByName = new Map(input.openCodeEndpoints.map(e => [matchName(e.name), e.modelId]))
  // The full catalog, including Pro/Max rows the plan scope drops. OC funds
  // some of those models on Go (Gemini 4 Argon is Pro on CMD), and the catalog
  // entry is the only source for their vendor/context/tooltip metadata.
  const catalogById = new Map(input.goatModels.map(model => [model.id, model]))
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
    const endpointId = ocIdByName.get(key) ?? null
    // Same model as a CMD row → reuse the CMD id so pricing/estimates join
    // instead of splitting into a duplicate model row. Models outside the
    // Go/GOAT scope (Pro/Max) still join here for their metadata; the CMD plan
    // loops above never emit rows for them.
    const modelId = resolveCatalogModelId(models, endpointId, displayName)
      ?? resolveCatalogModelId(input.goatModels, endpointId, displayName)
      ?? ocIdFor(key)
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
      const catalogModel = catalogById.get(modelId)
      if (catalogModel) {
        // Resolved against the full catalog (Pro/Max scope): keep the entry's
        // metadata instead of degrading it to an OC-only shell.
        models.push(catalogModel)
      } else {
        const [ocModel] = mapOpenCodeModelRows({
          pricing: price ? [price] : [],
          endpoints: [],
          idFor: () => modelId,
          nameFor: () => displayName
        })
        if (ocModel) models.push(ocModel)
      }
    }
  }

  // OpenDesign Go is a gateway plan: one shared monthly pool funds every
  // eligible model, so each row carries the pool as its credit ("if this model
  // used all of it") and requests are derived from OpenDesign's own rates for
  // that model. Credits and windows come from the live allowance table, with the
  // static plan as fallback (same pattern as cmd-go's `goCreditsUsd`).
  const odAllowance = allowanceFor(input.openDesignAllowances, 'Go')
  const odCredits = odAllowance?.codingCredits ?? odPlan.monthly_credit_usd
  const odLimits: PlanLimits = {
    '5h': odAllowance?.fiveHourWindow ?? odPlan.limits['5h'],
    'weekly': odAllowance?.weeklyWindow ?? odPlan.limits.weekly,
    'monthly': odAllowance?.codingCredits ?? odPlan.limits.monthly
  }
  // Credits spent = model usage × multiplier, so the pool buys `pool / multiplier`
  // dollars of that model's usage, comparable to the per-model credits the other
  // plans grant.

  // Pricing: every catalog-listed OpenDesign model that publishes rates.
  const odRateByName = new Map(input.openDesignModels.map(row => [matchName(row.name), row]))
  for (const od of input.openDesignModels) {
    // A panel with no catalog card is a legacy rate card, not an offering the
    // page sells: skip it whole (no pricing entry, no row).
    if (od.plans.length === 0) continue
    const modelId = resolveCatalogModelId(models, od.id, od.name)
    if (!modelId) continue
    for (const [index, tier] of od.tiers.entries()) {
      // A panel whose rate table failed to render must not publish $0 rates.
      if (tier.input == null && tier.output == null) continue
      pricing.push({
        provider_id: 'open-design',
        model_id: modelId,
        // OpenDesign publishes input-length tiers; `PricingEntry` has no
        // context-tier field, so the first (cheapest) tier is `standard` and
        // the wider ones `extended`. Reference data only: no consumer reads
        // `tier` (it preserves entry order for the price sort).
        tier: index === 0 ? 'standard' : 'extended',
        peak_utc_hours: null,
        input: tier.input ?? 0,
        output: tier.output ?? 0,
        cache_read: tier.cacheRead ?? 0,
        cache_write: tier.cacheWrite
      })
    }
  }

  // Rows: membership is the Design Plan model list from the credits page, which
  // is what Go funds — MiniMax M3.1 Flash and DeepSeek V4.1 Flash Eco are in it
  // but have no /models panel, so a panel-driven loop missed them. A model with
  // no published rates still gets its credit row; its estimates stay null
  // rather than borrowing another provider's prices.
  for (const odModelRow of input.openDesignMultipliers) {
    const key = matchName(odModelRow.name)
    const od = odRateByName.get(key)
    let modelId = resolveCatalogModelId(models, od?.id ?? null, odModelRow.name)
    if (!modelId) {
      modelId = `open-design/${slugifyModelName(odModelRow.name)}`
      if (!seenIds.has(modelId)) {
        seenIds.add(modelId)
        models.push(emptyModel(modelId, odModelRow.name))
      }
    }
    const base = od?.tiers[0]
    const row = estimateRow('od-go', modelId, Math.round((odCredits / odModelRow.multiplier) * 100) / 100, {
      input: base?.input ?? null,
      output: base?.output ?? null,
      cacheRead: base?.cacheRead ?? null,
      vendor: models.find(m => m.id === modelId)?.vendor ?? null
    }, odLimits, input.sourceUrls.openDesignPricing, input.fetchedAt)
    // The credit comes from the plan table (pricing page), the multiplier from
    // the credits page and the rates from the model catalog: one `sourceUrl`
    // cannot stand for all three.
    planModels.push({
      ...row,
      note: `Pool ${odCredits}/mo at ${odModelRow.multiplier}× from ${input.sourceUrls.openDesignCredits}; ${
        od ? `rates from ${input.sourceUrls.openDesignModels}` : 'no published rates'
      }`
    })
  }

  // TokenHarbor passes (Agent, Office): each plan funds a published *rule*
  // (docs) applied to the gateway's public catalogue (models page), so
  // membership is derived rather than copied off a table. Each eligible row
  // carries that pass's pool as its credit — stretched by its Model Boost —
  // and requests come from TokenHarbor's own published profile (10K input,
  // 8K of it cached, + 1K output), which is the basis of the vendor's
  // "estimated requests" widget.
  const thBoostByName = new Map(input.tokenHarborBoosts.map(row => [matchName(row.name), row]))
  const thPasses = [
    { planId: 'th-agent', label: 'Agent Pass', caps: TOKEN_HARBOR_AGENT_CAPS, isPassModel: isAgentPassModel },
    { planId: 'th-office', label: 'Office Pass', caps: TOKEN_HARBOR_OFFICE_CAPS, isPassModel: isOfficePassModel }
  ] as const
  for (const pass of thPasses) {
    const thPlan = planById(pass.planId)
    const thWeeklyFraction = thPlan.limits.weekly == null ? null : thPlan.limits.weekly / thPlan.limits.monthly
    for (const th of input.tokenHarborModels) {
      if (!pass.isPassModel(th)) continue
      const boost = thBoostByName.get(matchName(th.label))
      // A badge whose title calls it a promo is already priced into the
      // published rate (the promo *is* the price difference), so only a standing
      // Model Boost stretches the pool.
      const multiple = boost && !boost.promo ? boost.multiple : 1
      // TokenHarbor's own id can be a dated pin of a catalog model (`-1017`) —
      // resolve through the alias so the row joins that model, not a duplicate.
      const lookupId = TOKEN_HARBOR_MODEL_ALIASES[th.id] ?? th.id
      const catalogModel = models.find(m => sameSlug(m.id.split('/').pop() ?? '', lookupId) || sameSlug(m.slug, lookupId))
        ?? input.goatModels.find(m => m.id === lookupId || sameSlug(m.slug, lookupId))
      // Same model as a CMD row (in or outside the Go/GOAT scope) → reuse that id
      // so pricing/metadata join instead of splitting into a duplicate model.
      const modelId = resolveCatalogModelId(models, lookupId, th.label)
        ?? resolveCatalogModelId(input.goatModels, lookupId, th.label)
        ?? `tokenharbor/${slugifyModelName(lookupId)}`
      if (!catalogModel && !seenIds.has(modelId)) {
        seenIds.add(modelId)
        models.push(tokenHarborCatalogEntry(modelId, th))
      }
      const vendor = catalogModel?.vendor ?? tokenHarborVendor(th.family)
      pricing.push({
        provider_id: 'tokenharbor',
        model_id: modelId,
        // One flat published rate per model; the pass does not price per context
        // tier and TokenHarbor publishes no peak/off-peak split.
        tier: 'standard',
        peak_utc_hours: null,
        input: th.priceIn ?? 0,
        output: th.priceOut ?? 0,
        cache_read: th.cacheRead ?? 0,
        cache_write: th.cacheWrite
      })
      // "A boosted model is billed against the same Pass allowance at a reduced
      // rate, which lets that allowance go further on it" — so the pool buys
      // `pool × boost` dollars of that model's usage, which is exactly the
      // "$10 included usage / up to $20 of usage value" the pass advertises.
      const credits = thPlan.monthly_credit_usd * multiple
      const computed = computeRowEstimates(credits, {
        rates: { inputCost: th.priceIn, outputCost: th.priceOut, cacheReadCost: th.cacheRead },
        shape: { ...TOKEN_HARBOR_REQUEST_SHAPE },
        timeOfDay: null
      }, vendor, { fiveHour: null, weekly: thWeeklyFraction })
      planModels.push({
        plan_id: pass.planId,
        model_id: modelId,
        monthly_credits_usd: credits,
        estimates: computed ? { per_5h: computed.per5h, per_week: computed.perWeek, per_month: computed.perMonth } : null,
        sourceUrl: input.sourceUrls.tokenHarborPricing,
        fetchedAt: input.fetchedAt,
        note: `${pass.label} rule (≤ $${pass.caps.input} in / $${pass.caps.output} out per 1M, plus by-name${pass.planId === 'th-office' ? ', including everything the Agent Pass funds' : ''}) from https://tokenharbor.ai/docs/billing/subscription; rates from ${input.sourceUrls.tokenHarborModels}; request profile 10K in (8K cache) + 1K out = $${(tokenHarborRequestCost(th) ?? 0).toFixed(6)}/req${multiple > 1 ? `; Model Boost ${multiple}×` : ''}${boost?.promo ? '; promo multiplier not applied (promo is in the published rate)' : ''}`
      })
    }
  }

  return {
    models: dedupeBy(models, m => m.slug),
    pricing: dedupeBy(pricing, p => `${p.provider_id}:${p.model_id}:${p.tier}`),
    plan_models: dedupeBy(planModels, p => `${p.plan_id}:${p.model_id}`)
  }
}
