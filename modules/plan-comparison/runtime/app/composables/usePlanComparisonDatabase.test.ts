import { describe, expect, it } from 'vitest'
import { normalizePlanComparisonDatabase } from './usePlanComparisonDatabase'
import type { Model, Plan, PlanModelEstimate, PlanComparisonDatabase } from '../types'

function makePlan(id: string): Plan {
  return {
    id,
    provider_id: 'command-code',
    name: id,
    monthly_price_usd: 10,
    monthly_credit_usd: 10,
    has_api_access: true,
    limits: { '5h': 1, 'weekly': 2, 'monthly': 3 }
  }
}

function makeModel(overrides: Partial<Model>): Model {
  return {
    id: 'model-a',
    slug: 'model-a',
    name: 'Model A',
    vendor: 'Acme',
    category: 'opensource',
    contextWindow: 100000,
    reasoning: true,
    vision: false,
    inputCost: 1,
    outputCost: 4,
    cacheReadCost: 0.1,
    cacheWriteCost: null,
    tiers: [],
    minPlanName: 'Go',
    deal: null,
    caps: {},
    intelligenceIndex: 50,
    codingIndex: 55,
    outputTokensPerSec: 100,
    releaseDate: null,
    launchedAt: '2026-08-01',
    timeOfDay: null,
    ...overrides
  }
}

function makeDatabase(models: Model[], planModels: PlanModelEstimate[]): PlanComparisonDatabase {
  return {
    providers: [{ id: 'command-code', name: 'Command Code' }],
    plans: [makePlan('cmd-go'), makePlan('cmd-goat'), makePlan('oc-go')],
    models,
    pricing: [],
    plan_models: planModels
  }
}

const baseFilters = { hideOldModels: false, oldBefore: '2026-06-01', hideLowIntel: false, intelThreshold: 30 }

describe('normalizePlanComparisonDatabase - model filtering', () => {
  it('excludes a model with no launch date when hideOldModels is on', () => {
    const model = makeModel({ id: 'no-date', launchedAt: null })
    const db = makeDatabase([model], [])
    const result = normalizePlanComparisonDatabase(db, { ...baseFilters, hideOldModels: true })
    expect(result.creditRows.find(r => r.model.id === 'no-date')).toBeUndefined()
    expect(result.skippedModelNames).not.toContain(model.name)
  })

  it('excludes a model launched before the cutoff when hideOldModels is on', () => {
    const model = makeModel({ id: 'old', launchedAt: '2026-01-01' })
    const db = makeDatabase([model], [])
    const result = normalizePlanComparisonDatabase(db, { ...baseFilters, hideOldModels: true, oldBefore: '2026-06-01' })
    expect(result.creditRows.find(r => r.model.id === 'old')).toBeUndefined()
  })

  it('excludes a model below the intel threshold when hideLowIntel is on', () => {
    const model = makeModel({ id: 'low-intel', intelligenceIndex: 20 })
    const db = makeDatabase([model], [
      { plan_id: 'cmd-go', model_id: 'low-intel', monthly_credits_usd: 10, estimates: null }
    ])
    const result = normalizePlanComparisonDatabase(db, { ...baseFilters, hideLowIntel: true, intelThreshold: 30 })
    expect(result.creditRows.find(r => r.model.id === 'low-intel')).toBeUndefined()
  })

  it('excludes a model with no intel score when hideLowIntel is on', () => {
    const model = makeModel({ id: 'no-intel', intelligenceIndex: null })
    const db = makeDatabase([model], [
      { plan_id: 'cmd-go', model_id: 'no-intel', monthly_credits_usd: 10, estimates: null }
    ])
    const result = normalizePlanComparisonDatabase(db, { ...baseFilters, hideLowIntel: true, intelThreshold: 30 })
    expect(result.creditRows.find(r => r.model.id === 'no-intel')).toBeUndefined()
  })
})

describe('normalizePlanComparisonDatabase - row label', () => {
  it('labels rows with plain model names', () => {
    const db = makeDatabase(
      [makeModel({ id: 'a', intelligenceIndex: 42 }), makeModel({ id: 'b', name: 'Model B', intelligenceIndex: null })],
      [
        { plan_id: 'cmd-go', model_id: 'a', monthly_credits_usd: 10, estimates: null },
        { plan_id: 'cmd-go', model_id: 'b', monthly_credits_usd: 10, estimates: null }
      ]
    )
    const result = normalizePlanComparisonDatabase(db, baseFilters)
    const labels = Object.fromEntries(result.creditRows.map(r => [r.model.id, r.label]))
    expect(labels).toEqual({ a: 'Model A', b: 'Model B' })
  })
})

describe('normalizePlanComparisonDatabase - credit rows', () => {
  it('excludes a model funded by zero plans from credit rows', () => {
    const model = makeModel({ id: 'unfunded' })
    const db = makeDatabase([model], [])
    const result = normalizePlanComparisonDatabase(db, baseFilters)
    expect(result.creditRows.find(r => r.model.id === 'unfunded')).toBeUndefined()
    expect(result.skippedModelNames).toContain(model.name)
  })

  it('includes a model funded by at least one plan with intel/speed fields', () => {
    const model = makeModel({ id: 'funded' })
    const db = makeDatabase([model], [
      { plan_id: 'cmd-go', model_id: 'funded', monthly_credits_usd: 10, estimates: { per_5h: 1, per_week: 2, per_month: 3 } }
    ])
    const result = normalizePlanComparisonDatabase(db, baseFilters)
    const row = result.creditRows.find(r => r.model.id === 'funded')
    expect(row).toBeDefined()
    expect(row?.cmd.credit).toBe(10)
    expect(row?.goat.credit).toBeNull()
    expect(row?.label).toBe('Model A')
    expect(row?.intelligence).toBe(50)
    expect(row?.speed).toBe(100)
    expect(row?.context).toBe(100000)
  })
})

describe('normalizePlanComparisonDatabase - dot rows', () => {
  it('excludes a model with no plan reporting a request estimate', () => {
    const model = makeModel({ id: 'no-req' })
    const db = makeDatabase([model], [
      { plan_id: 'cmd-go', model_id: 'no-req', monthly_credits_usd: 10, estimates: null }
    ])
    const result = normalizePlanComparisonDatabase(db, baseFilters)
    expect(result.creditRows.find(r => r.model.id === 'no-req')).toBeDefined()
    expect(result.dotRows.find(r => r.model.id === 'no-req')).toBeUndefined()
    expect(result.noRequestModelNames).toContain(model.name)
  })
})
