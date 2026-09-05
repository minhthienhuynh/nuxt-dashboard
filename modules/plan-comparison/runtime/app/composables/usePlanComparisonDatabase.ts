import { computed, ref } from 'vue'
import type { Model, Plan, PlanModelEstimate, PlanComparisonDatabase } from '../types'
import { buildPricingIndex, effectiveCost } from './usePlanComparisonPricing'
import { sortRows } from './usePlanComparisonSort'
import type { SortableModelRow, SortOptionId } from './usePlanComparisonSort'
import { providers } from '../../server/api/providers'
import { plans } from '../../server/api/plans'
import { models } from '../../server/api/models'
import { pricing } from '../../server/api/pricing'
import { planModels } from '../../server/api/plan_models'
import { deals } from '../../server/api/deals'

const staticDatabase: PlanComparisonDatabase = {
  providers,
  plans,
  models,
  pricing,
  plan_models: planModels,
  deals
}

const PLAN_IDS = {
  cmd: 'cmd-go',
  goat: 'cmd-goat',
  go: 'oc-go'
} as const

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
  creditLevels: number[]
  skippedModelNames: string[]
  noRequestModelNames: string[]
}

export interface PlanComparisonFilters {
  hideOldModels: boolean
  oldBefore: string
  hideLowAA: boolean
  aaThreshold: number
}

function labelFor(model: Model): string {
  return `${model.name} (${model.aa == null ? '—' : model.aa.toFixed(1)})`
}

// A model with no release date is treated as old whenever the "hide old" filter is active.
function isOld(model: Model, oldBefore: string): boolean {
  return model.release_date == null || model.release_date < oldBefore
}

// A model with no AA score is treated as low-AA whenever the "hide low AA" filter is active.
function isLowAA(model: Model, aaThreshold: number): boolean {
  return model.aa == null || model.aa < aaThreshold
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
    if (filters.hideLowAA && isLowAA(model, filters.aaThreshold)) return false
    return true
  })

  const enrichedRows: EnrichedModelRow[] = visibleModels.map(model => ({
    model,
    label: labelFor(model),
    release: model.release_date ? Date.parse(model.release_date) : null,
    name: model.name,
    context: model.context_tokens,
    aa: model.aa,
    tps: model.tok_per_sec,
    effective: effectiveCost(model.id, pricingIndex),
    cmd: getFunding(PLAN_IDS.cmd, model.id),
    goat: getFunding(PLAN_IDS.goat, model.id),
    go: getFunding(PLAN_IDS.go, model.id)
  }))

  const creditRows = enrichedRows.filter(row => row.cmd.credit != null || row.goat.credit != null || row.go.credit != null)
  const dotRows = creditRows.filter(row => row.cmd.request != null || row.goat.request != null || row.go.request != null)

  const creditLevels = [...new Set(
    creditRows
      .flatMap(row => [row.cmd.credit, row.goat.credit, row.go.credit])
      .filter((value): value is number => value != null)
  )].sort((a, b) => a - b)

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
    creditLevels,
    skippedModelNames,
    noRequestModelNames
  }
}

export function usePlanComparisonDatabase() {
  // Direct import — no Nitro route (database.get.ts removed per restructuring)
  const data = ref(staticDatabase)
  const status = ref<'idle' | 'pending' | 'success' | 'error'>('success')
  const error = ref<Error | null>(null)

  const hideOldModels = ref(true)
  const oldBefore = ref('2026-07-09')
  const hideLowAA = ref(false)
  const aaThreshold = ref(40)
  const sortOption = ref<SortOptionId>('newest')

  const normalized = computed<NormalizedPlanComparisonData | null>(() => {
    if (!data.value) return null
    return normalizePlanComparisonDatabase(data.value, {
      hideOldModels: hideOldModels.value,
      oldBefore: oldBefore.value,
      hideLowAA: hideLowAA.value,
      aaThreshold: aaThreshold.value
    })
  })

  return {
    status,
    error,
    hideOldModels,
    oldBefore,
    hideLowAA,
    aaThreshold,
    sortOption,
    planCards: computed(() => normalized.value?.planCards ?? []),
    creditRows: computed(() => normalized.value ? sortRows(normalized.value.creditRows, sortOption.value) : []),
    dotRows: computed(() => normalized.value ? sortRows(normalized.value.dotRows, sortOption.value) : []),
    creditLevels: computed(() => normalized.value?.creditLevels ?? []),
    skippedModelNames: computed(() => normalized.value?.skippedModelNames ?? []),
    noRequestModelNames: computed(() => normalized.value?.noRequestModelNames ?? [])
  }
}
