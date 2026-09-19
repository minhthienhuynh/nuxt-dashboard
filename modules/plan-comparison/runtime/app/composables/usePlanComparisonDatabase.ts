import { computed, ref } from 'vue'
// useFetch/$fetch resolve via Nuxt auto-imports (also keeps vitest green,
// which cannot resolve the '#imports' alias outside a Nuxt build).
import type { Model, Plan, PlanModelEstimate, PlanComparisonDatabase, PlanComparisonPayload } from '../types'
import { buildPricingIndex, inputPrice } from './usePlanComparisonPricing'
import { sortRows } from './usePlanComparisonSort'
import type { SortableModelRow, SortOptionId } from './usePlanComparisonSort'

const PLAN_IDS = {
  cmd: 'cmd-go',
  goat: 'cmd-goat',
  go: 'oc-go'
} as const

export const DEFAULT_OLD_BEFORE = '2026-07-31'
export const DEFAULT_INTEL_THRESHOLD = 30

export interface PlanFunding {
  credit: number | null
  request: number | null
}

export interface EnrichedModelRow extends SortableModelRow {
  model: Model
  label: string
  cmd: PlanFunding
  goat: PlanFunding
  go: PlanFunding
}

export interface PlanCard {
  id: string
  name: string
  monthlyCredit: number
  price: number
  limits: Plan['limits']
  modelCount: number
}

export interface NormalizedPlanComparisonData {
  planCards: PlanCard[]
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

function intelLabel(intel: number | null): string {
  if (intel == null) return '—'
  return Number.isInteger(intel) ? String(intel) : intel.toFixed(1)
}

function labelFor(model: Model): string {
  return `${model.name} (${intelLabel(model.intelligenceIndex)})`
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

  const getFunding = (planId: string, modelId: string): PlanFunding => {
    const planModel = planModelIndex.get(`${planId}:${modelId}`) ?? null
    return {
      credit: planModel?.monthly_credits_usd ?? null,
      request: planModel?.estimates?.per_month ?? null
    }
  }

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
    cmd: getFunding(PLAN_IDS.cmd, model.id),
    goat: getFunding(PLAN_IDS.goat, model.id),
    go: getFunding(PLAN_IDS.go, model.id)
  }))

  const creditRows = enrichedRows.filter(row => row.cmd.credit != null || row.goat.credit != null || row.go.credit != null)
  const dotRows = creditRows.filter(row => row.cmd.request != null || row.goat.request != null || row.go.request != null)

  const skippedModelNames = enrichedRows
    .filter(row => row.cmd.credit == null && row.goat.credit == null && row.go.credit == null)
    .map(row => row.model.name)

  const noRequestModelNames = creditRows
    .filter(row => row.cmd.request == null && row.goat.request == null && row.go.request == null)
    .map(row => row.model.name)

  const planCard = (planId: string): PlanCard => {
    const plan = db.plans.find(p => p.id === planId)
    if (!plan) throw new Error(`Unknown plan id: ${planId}`)
    return {
      id: plan.id,
      name: plan.name,
      monthlyCredit: plan.monthly_credit_usd,
      price: plan.monthly_price_usd,
      limits: plan.limits,
      modelCount: db.plan_models.filter(pm => pm.plan_id === planId).length
    }
  }

  return {
    planCards: [planCard(PLAN_IDS.cmd), planCard(PLAN_IDS.goat), planCard(PLAN_IDS.go)],
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
    return fetchError.value instanceof Error ? fetchError.value : new Error('Không tải được dữ liệu so sánh')
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
    creditRows: computed(() => normalized.value ? sortRows(normalized.value.creditRows, sortOption.value) : []),
    dotRows: computed(() => normalized.value ? sortRows(normalized.value.dotRows, sortOption.value) : []),
    skippedModelNames: computed(() => normalized.value?.skippedModelNames ?? []),
    noRequestModelNames: computed(() => normalized.value?.noRequestModelNames ?? [])
  }
}
