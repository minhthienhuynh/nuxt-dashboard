import { computed, ref } from 'vue'
// useFetch/$fetch resolve via Nuxt auto-imports (also keeps vitest green,
// which cannot resolve the '#imports' alias outside a Nuxt build).
import type { Model, Plan, PlanFundingKind, PlanLimitsPercent, PlanModelEstimate, PlanComparisonDatabase, PlanComparisonPayload, PricingEntry } from '../types'
import { buildPricingIndex, inputPrice } from './usePlanComparisonPricing'
import { sortRows } from './usePlanComparisonSort'
import type { SortableModelRow, SortOptionId } from './usePlanComparisonSort'
import { PLAN_COMPARISON_PLANS } from '../plan-colors'
import type { PlanComparisonPlanKey, PlanComparisonPlanMeta } from '../plan-colors'

export const DEFAULT_OLD_BEFORE = '2026-08-26'
export const DEFAULT_INTEL_THRESHOLD = 37

export interface PlanFunding {
  credit: number | null
  request: number | null
  /**
   * True when the plan funds one shared pool instead of a per-model grant:
   * `credit` is then the whole pool on every row (see `PlanFundingKind`).
   */
  pool: boolean
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
  name: string
  monthlyCredit: number
  price: number
  limits: Plan['limits']
  /**
   * Set when the plan publishes its rolling windows as a share of each model's
   * own monthly limit rather than a flat dollar cap (OpenCode Go: 20% / 50% /
   * 100%). The card shows the percentages; `limits` stays the pool-equivalent.
   */
  limitPercent?: PlanLimitsPercent
  /** `pool` plans show one shared credit pool instead of per-model grants. */
  funding: PlanFundingKind
  modelCount: number
}

export interface NormalizedPlanComparisonData {
  planCards: PlanCard[]
  /** Series keys funded from one shared pool — the credit bar chart drops them. */
  poolPlanKeys: PlanComparisonPlanKey[]
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

// The intelligence score used to ride along in the axis label (`Model (42)`);
// the hover/tap popover now carries it, so labels stay plain names.
function labelFor(model: Model): string {
  return model.name
}

// A model with no intel score is treated as low-intel whenever the "hide low intel" filter is active.
function isLowIntel(model: Model, intelThreshold: number): boolean {
  return model.intelligenceIndex == null || model.intelligenceIndex < intelThreshold
}

// A model with no launch date is treated as old whenever the "hide old" filter is active.
function isOld(model: Model, oldBefore: string): boolean {
  return model.launchedAt == null || model.launchedAt < oldBefore
}

export function normalizePlanComparisonDatabase(db: PlanComparisonDatabase, filters: PlanComparisonFilters): NormalizedPlanComparisonData {
  const planModelIndex = new Map<string, PlanModelEstimate>()
  for (const row of db.plan_models) {
    planModelIndex.set(`${row.plan_id}:${row.model_id}`, row)
  }

  // Plan data (funding kind, limits) is looked up by registry id, so a new plan
  // reaches the cards, charts and tooltips through plan-colors.ts alone.
  const planDataById = new Map(db.plans.map(plan => [plan.id, plan]))

  const getFunding = (plan: PlanComparisonPlanMeta, modelId: string): PlanFunding => {
    const planModel = planModelIndex.get(`${plan.planId}:${modelId}`) ?? null
    return {
      credit: planModel?.monthly_credits_usd ?? null,
      request: planModel?.estimates?.per_month ?? null,
      pool: planDataById.get(plan.planId)?.funding === 'pool'
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

  const pricingIndex = buildPricingIndex(db.pricing)

  const visibleModels = db.models.filter((model) => {
    if (filters.hideOldModels && isOld(model, filters.oldBefore)) return false
    if (filters.hideLowIntel && isLowIntel(model, filters.intelThreshold)) return false
    return true
  })

  const enrichedRows: EnrichedModelRow[] = visibleModels.map(model => ({
    model,
    label: labelFor(model),
    release: model.launchedAt ? Date.parse(model.launchedAt) : null,
    name: model.name,
    context: model.contextWindow,
    intelligence: model.intelligenceIndex,
    speed: model.outputTokensPerSec,
    inputPrice: inputPrice(model.id, pricingIndex),
    pricing: pricingIndex.get(model.id) ?? null,
    ...fundingOf(model.id)
  }))

  const creditRows = enrichedRows.filter(fundedByAny)
  const dotRows = creditRows.filter(requestedByAny)

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
  const planCard = (plan: PlanComparisonPlanMeta): PlanCard | null => {
    const data = planDataById.get(plan.planId)
    if (!data) return null
    return {
      id: data.id,
      name: data.name,
      monthlyCredit: data.monthly_credit_usd,
      price: data.monthly_price_usd,
      limits: data.limits,
      limitPercent: data.limits_percent,
      funding: data.funding ?? 'per_model',
      modelCount: db.plan_models.filter(pm => pm.plan_id === data.id).length
    }
  }

  const cards = PLAN_COMPARISON_PLANS.map(planCard).filter((card): card is PlanCard => card != null)
  return {
    planCards: cards,
    // Derived from the plan data (not from the visible rows), so a fully
    // filtered chart keeps the same series list and footnote.
    poolPlanKeys: cards
      .filter(card => card.funding === 'pool')
      .map(card => PLAN_COMPARISON_PLANS.find(plan => plan.planId === card.id)?.key)
      .filter((key): key is PlanComparisonPlanKey => key != null),
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

  const normalized = computed<NormalizedPlanComparisonData | null>(() => {
    if (!data.value) return null
    return normalizePlanComparisonDatabase(data.value, {
      hideOldModels: hideOldModels.value,
      oldBefore: oldBefore.value,
      hideLowIntel: hideLowIntel.value,
      intelThreshold: intelThreshold.value
    })
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
    planCards: computed(() => normalized.value?.planCards ?? []),
    poolPlanKeys: computed(() => normalized.value?.poolPlanKeys ?? []),
    creditRows: computed(() => normalized.value ? sortRows(normalized.value.creditRows, sortOption.value) : []),
    dotRows: computed(() => normalized.value ? sortRows(normalized.value.dotRows, sortOption.value) : []),
    skippedModelNames: computed(() => normalized.value?.skippedModelNames ?? []),
    noRequestModelNames: computed(() => normalized.value?.noRequestModelNames ?? [])
  }
}
