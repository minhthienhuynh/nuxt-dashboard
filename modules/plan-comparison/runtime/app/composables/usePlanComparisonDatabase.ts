import { computed, ref } from 'vue'
// useFetch/$fetch resolve via Nuxt auto-imports (also keeps vitest green,
// which cannot resolve the '#imports' alias outside a Nuxt build).
import type { Model, Plan, PlanLimitsPercent, PlanModelEstimate, PlanComparisonDatabase, PlanComparisonPayload, PricingEntry } from '../types'
import { buildPricingIndex, inputPrice } from './usePlanComparisonPricing'
import { sortRows } from './usePlanComparisonSort'
import type { SortableModelRow, SortOptionId } from './usePlanComparisonSort'
import { PLAN_COMPARISON_PLANS } from '../plan-colors'
import type { PlanComparisonPlanKey, PlanComparisonPlanMeta } from '../plan-colors'

/**
 * Default cutoff for the "hide old models" filter: GLM-5.3 Flash's release
 * date, i.e. the wave baseline — "GLM-5.3 Flash and newer". Deliberately a
 * fixed date and not a rolling window: a window would keep moving forward and
 * hide models that are still funded but older than it. Bump by hand when the
 * baseline wave changes; the filter bar lets the reader pick any other date.
 */
export const DEFAULT_OLD_BEFORE = '2026-08-26'
export const DEFAULT_INTEL_THRESHOLD = 37

/**
 * What one plan funds on one model. `credit` is the usage value the plan's
 * shared pool funds there (its per-model allocation), `request` the request
 * count the vendor publishes for it — see `PlanModelEstimate`.
 */
export interface PlanFunding {
  credit: number | null
  request: number | null
}

/** One funding entry per plan in the registry, keyed by its chart series key. */
export type PlanFundingByPlan = Record<PlanComparisonPlanKey, PlanFunding>

export interface EnrichedModelRow extends SortableModelRow, PlanFundingByPlan {
  model: Model
  label: string
  /** First `command-code` pricing entry (the one `inputPrice` sorts on). */
  pricing: PricingEntry | null
}

export interface PlanCard {
  id: string
  /** Registry series key, so the card can toggle the plan's models. */
  key: PlanComparisonPlanKey
  name: string
  /** Registry label (`Command Code Go`), unique across cards and shared with the charts. */
  label: string
  price: number
  /**
   * The plan's windows as a share of its own pool, which is the card's unit.
   * `undefined` only for a plan with no monthly value to take a share of.
   */
  limitPercent?: PlanLimitsPercent
  modelCount: number
  /**
   * Span of the per-model allocations this plan publishes — how much usage its
   * pool funds on the cheapest and the priciest model. `null` when every model
   * gets the same allocation, so the card only shows a range that is real.
   */
  creditRange: { min: number, max: number } | null
}

export interface NormalizedPlanComparisonData {
  planCards: PlanCard[]
  /**
   * Registry meta of the checked plans, in registry order — the charts draw one
   * series per entry, so an unchecked plan disappears from the bars, the dots
   * and every model's tooltip instead of lingering as an empty column.
   */
  selectedPlans: PlanComparisonPlanMeta[]
  creditRows: EnrichedModelRow[]
  dotRows: EnrichedModelRow[]
  skippedModelNames: string[]
  noRequestModelNames: string[]
}

export interface PlanComparisonFilters {
  hideOldModels: boolean
  oldBefore: string
  hideLowIntel: boolean
  intelThreshold: number
}

/**
 * Which plans feed the charts, keyed by registry series key. Every plan starts
 * selected, so the charts show the full comparison until the reader narrows it
 * down from a plan card.
 */
export type PlanSelection = Record<PlanComparisonPlanKey, boolean>

/** All plans selected: the default ("full") chart. */
export function defaultPlanSelection(): PlanSelection {
  return Object.fromEntries(PLAN_COMPARISON_PLANS.map(plan => [plan.key, true])) as PlanSelection
}

// The intelligence score used to ride along in the axis label (`Model (42)`);
// the hover/tap popover now carries it, so labels stay plain names.

/** Windows as a share of the plan's own pool — see `PlanLimitsPercent`. */
function sharesOf(limits: Plan['limits'], pool: number): PlanLimitsPercent | undefined {
  if (!(pool > 0)) return undefined
  // One decimal: OpenDesign's $4.91 of $60 is 8.2%, not a round number.
  const share = (value: number): number => Math.round((value / pool) * 1000) / 10
  const optional = (value: number | null): number | null => value == null ? null : share(value)
  return { '5h': optional(limits['5h']), 'weekly': optional(limits.weekly), 'monthly': share(limits.monthly) }
}

function labelFor(model: Model): string {
  return model.name
}

// A model with no intel score is treated as low-intel whenever the "hide low intel" filter is active.
function isLowIntel(model: Model, intelThreshold: number): boolean {
  return model.intelligenceIndex == null || model.intelligenceIndex < intelThreshold
}

// The "hide old" filter works on the lab release date (models.dev fills what
// CC's payload leaves unset — see the crawl's release-dates.ts), not the
// later date Command Code listed the model. A model with no release date is
// treated as old whenever the filter is active.
function isOld(model: Model, oldBefore: string): boolean {
  return model.releaseDate == null || model.releaseDate < oldBefore
}

export function normalizePlanComparisonDatabase(db: PlanComparisonDatabase, filters: PlanComparisonFilters, selection: PlanSelection = defaultPlanSelection()): NormalizedPlanComparisonData {
  const planModelIndex = new Map<string, PlanModelEstimate>()
  for (const row of db.plan_models) {
    planModelIndex.set(`${row.plan_id}:${row.model_id}`, row)
  }

  // Plan data (limits, price, pool) is looked up by registry id, so a new plan
  // reaches the cards, charts and tooltips through plan-colors.ts alone.
  const planDataById = new Map(db.plans.map(plan => [plan.id, plan]))

  const getFunding = (plan: PlanComparisonPlanMeta, modelId: string): PlanFunding => {
    const planModel = planModelIndex.get(`${plan.planId}:${modelId}`) ?? null
    return {
      credit: planModel?.monthly_credits_usd ?? null,
      request: planModel?.estimates?.per_month ?? null
    }
  }

  const fundingOf = (modelId: string): PlanFundingByPlan => {
    const funding = {} as PlanFundingByPlan
    for (const plan of PLAN_COMPARISON_PLANS) funding[plan.key] = getFunding(plan, modelId)
    return funding
  }

  const fundedByAny = (row: EnrichedModelRow): boolean =>
    PLAN_COMPARISON_PLANS.some(plan => row[plan.key].credit != null)
  const requestedByAny = (row: EnrichedModelRow): boolean =>
    PLAN_COMPARISON_PLANS.some(plan => row[plan.key].request != null)
  // Charts follow the cards' checkboxes: a row is listed while at least one
  // SELECTED plan funds it (deselecting every plan leaves the charts empty
  // rather than silently showing everything again).
  const selectedPlans = PLAN_COMPARISON_PLANS.filter(plan => selection[plan.key] !== false)
  const fundedBySelected = (row: EnrichedModelRow): boolean =>
    selectedPlans.some(plan => row[plan.key].credit != null)
  const requestedBySelected = (row: EnrichedModelRow): boolean =>
    selectedPlans.some(plan => row[plan.key].request != null)

  const pricingIndex = buildPricingIndex(db.pricing)

  const visibleModels = db.models.filter((model) => {
    if (filters.hideOldModels && isOld(model, filters.oldBefore)) return false
    if (filters.hideLowIntel && isLowIntel(model, filters.intelThreshold)) return false
    return true
  })

  const enrichedRows: EnrichedModelRow[] = visibleModels.map(model => ({
    model,
    label: labelFor(model),
    release: model.releaseDate ? Date.parse(model.releaseDate) : null,
    name: model.name,
    context: model.contextWindow,
    intelligence: model.intelligenceIndex,
    speed: model.outputTokensPerSec,
    inputPrice: inputPrice(model.id, pricingIndex),
    pricing: pricingIndex.get(model.id) ?? null,
    ...fundingOf(model.id)
  }))

  const creditRows = enrichedRows.filter(fundedBySelected)
  const dotRows = creditRows.filter(requestedBySelected)

  const skippedModelNames = enrichedRows
    .filter(row => !fundedByAny(row))
    .map(row => row.model.name)

  const noRequestModelNames = creditRows
    .filter(row => !requestedByAny(row))
    .map(row => row.model.name)

  // A registry plan the stored data does not carry yet (payload cached before
  // the plan was added, no TTL on the cache) must not take the page down:
  // skipping the card keeps Old data rendering instead of 500ing with
  // "Unknown plan id", which used to hide the very "Refresh data" button that
  // fixes it.
  /** Span of the per-model allocations the vendor publishes for this plan. */
  const creditRangeOf = (plan: Plan): { min: number, max: number } | null => {
    const credits = db.plan_models
      .filter(pm => pm.plan_id === plan.id)
      .map(pm => pm.monthly_credits_usd)
      .filter((credit): credit is number => credit != null && credit > 0)
    if (credits.length === 0) return null
    const min = Math.min(...credits)
    const max = Math.max(...credits)
    return min === max ? null : { min, max }
  }

  const planCard = (plan: PlanComparisonPlanMeta): PlanCard | null => {
    const data = planDataById.get(plan.planId)
    if (!data) return null
    return {
      id: data.id,
      key: plan.key,
      name: data.name,
      label: plan.label,
      price: data.monthly_price_usd,
      // Explicit shares when the vendor states them (OpenCode Go), else derived.
      limitPercent: data.limits_percent ?? sharesOf(data.limits, data.monthly_credit_usd),
      modelCount: db.plan_models.filter(pm => pm.plan_id === data.id).length,
      creditRange: creditRangeOf(data)
    }
  }

  const cards = PLAN_COMPARISON_PLANS.map(planCard).filter((card): card is PlanCard => card != null)
  return {
    planCards: cards,
    selectedPlans,
    creditRows,
    dotRows,
    skippedModelNames,
    noRequestModelNames
  }
}

export type PlanComparisonStatus = 'idle' | 'pending' | 'success' | 'error'

export function usePlanComparisonDatabase() {
  const { data: payload, status: fetchStatus, error: fetchError, refresh } = useFetch<PlanComparisonPayload>('/api/plan-comparison/database')

  const data = computed<PlanComparisonDatabase | null>(() => payload.value?.database ?? null)
  const fetchedAt = computed<string | null>(() => payload.value?.fetchedAt ?? null)
  const rolledBack = computed(() => payload.value?.rolledBack ?? false)

  const status = computed<PlanComparisonStatus>(() => {
    if (fetchStatus.value === 'pending' && !payload.value) return 'pending'
    if (fetchError.value && !payload.value) return 'error'
    return 'success'
  })
  const error = computed<Error | null>(() => {
    if (!fetchError.value) return null
    return fetchError.value instanceof Error ? fetchError.value : new Error('Failed to load comparison data')
  })

  const resetting = ref(false)
  async function resetCache(): Promise<void> {
    resetting.value = true
    try {
      await $fetch('/api/plan-comparison/cache', { method: 'DELETE' })
      await refresh()
    } finally {
      resetting.value = false
    }
  }

  const hideOldModels = ref(true)
  const oldBefore = ref(DEFAULT_OLD_BEFORE)
  const hideLowIntel = ref(false)
  const intelThreshold = ref(DEFAULT_INTEL_THRESHOLD)
  const sortOption = ref<SortOptionId>('newest')
  // Every plan starts checked ("full"): the charts show the whole comparison
  // until the reader unchecks a card to take that plan's models out.
  const planSelection = ref<PlanSelection>(defaultPlanSelection())

  function setPlanSelected(key: PlanComparisonPlanKey, selected: boolean): void {
    planSelection.value = { ...planSelection.value, [key]: selected }
  }

  function togglePlan(key: PlanComparisonPlanKey): void {
    setPlanSelected(key, planSelection.value[key] === false)
  }

  const normalized = computed<NormalizedPlanComparisonData | null>(() => {
    if (!data.value) return null
    return normalizePlanComparisonDatabase(data.value, {
      hideOldModels: hideOldModels.value,
      oldBefore: oldBefore.value,
      hideLowIntel: hideLowIntel.value,
      intelThreshold: intelThreshold.value
    }, planSelection.value)
  })

  return {
    status,
    error,
    fetchedAt,
    rolledBack,
    resetting,
    resetCache,
    hideOldModels,
    oldBefore,
    hideLowIntel,
    intelThreshold,
    sortOption,
    planSelection,
    setPlanSelected,
    togglePlan,
    planCards: computed(() => normalized.value?.planCards ?? []),
    selectedPlans: computed(() => normalized.value?.selectedPlans ?? []),
    creditRows: computed(() => normalized.value ? sortRows(normalized.value.creditRows, sortOption.value) : []),
    dotRows: computed(() => normalized.value ? sortRows(normalized.value.dotRows, sortOption.value) : []),
    selectedModelCount: computed(() => normalized.value?.creditRows.length ?? 0),
    skippedModelNames: computed(() => normalized.value?.skippedModelNames ?? []),
    noRequestModelNames: computed(() => normalized.value?.noRequestModelNames ?? [])
  }
}
