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
    context_tokens: 100000,
    intelligence: null,
    tok_per_sec: null,
    open_weight: true,
    release_date: '2026-08-01',
    has_text: true,
    has_vision: false,
    has_reasoning: true,
    best_for: 'testing',
    aa: 50,
    ...overrides
  }
}

function makeDatabase(models: Model[], planModels: PlanModelEstimate[]): PlanComparisonDatabase {
  return {
    providers: [{ id: 'command-code', name: 'Command Code' }],
    plans: [makePlan('cmd-go'), makePlan('cmd-goat'), makePlan('oc-go')],
    models,
    pricing: [],
    plan_models: planModels,
    deals: []
  }
}

const baseFilters = { hideOldModels: false, oldBefore: '2026-06-01', hideLowAA: false, aaThreshold: 50 }

describe('normalizePlanComparisonDatabase - model filtering', () => {
  it('excludes a model with no release date when hideOldModels is on', () => {
    const model = makeModel({ id: 'no-date', release_date: null })
    const db = makeDatabase([model], [])
    const result = normalizePlanComparisonDatabase(db, { ...baseFilters, hideOldModels: true })
    expect(result.creditRows.find(r => r.model.id === 'no-date')).toBeUndefined()
    expect(result.skippedModelNames).not.toContain(model.name)
  })

  it('excludes a model older than the cutoff when hideOldModels is on', () => {
    const model = makeModel({ id: 'old', release_date: '2026-01-01' })
    const db = makeDatabase([model], [])
    const result = normalizePlanComparisonDatabase(db, { ...baseFilters, hideOldModels: true, oldBefore: '2026-06-01' })
    expect(result.creditRows.find(r => r.model.id === 'old')).toBeUndefined()
  })

  it('excludes a model with no AA score when hideLowAA is on', () => {
    const model = makeModel({ id: 'no-aa', aa: null })
    const db = makeDatabase([model], [{ plan_id: 'cmd-go', model_id: 'no-aa', monthly_credits_usd: 10, estimates: null }])
    const result = normalizePlanComparisonDatabase(db, { ...baseFilters, hideLowAA: true, aaThreshold: 50 })
    expect(result.creditRows.find(r => r.model.id === 'no-aa')).toBeUndefined()
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

  it('includes a model funded by at least one plan', () => {
    const model = makeModel({ id: 'funded' })
    const db = makeDatabase([model], [
      { plan_id: 'cmd-go', model_id: 'funded', monthly_credits_usd: 10, estimates: { per_5h: 1, per_week: 2, per_month: 3 } }
    ])
    const result = normalizePlanComparisonDatabase(db, baseFilters)
    const row = result.creditRows.find(r => r.model.id === 'funded')
    expect(row).toBeDefined()
    expect(row?.cmd.credit).toBe(10)
    expect(row?.goat.credit).toBeNull()
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
