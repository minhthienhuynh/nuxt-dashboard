import { describe, expect, it } from 'vitest'
import { defaultPlanSelection, normalizePlanComparisonDatabase } from './usePlanComparisonDatabase'
import type { Model, Plan, PlanModelEstimate, PlanComparisonDatabase } from '../types'

function makePlan(id: string, overrides: Partial<Plan> = {}): Plan {
  return {
    id,
    provider_id: 'command-code',
    name: id,
    monthly_price_usd: 10,
    monthly_credit_usd: 10,
    has_api_access: true,
    limits: { '5h': 1, 'weekly': 2, 'monthly': 3 },
    ...overrides
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
    plans: [makePlan('cmd-go'), makePlan('cmd-goat'), makePlan('oc-go'), makeOdPlan(), makeThPlan(), makeThOfficePlan()],
    models,
    pricing: [],
    plan_models: planModels
  }
}

/** TokenHarbor Agent Pass: one shared $10 pool, weekly window only. */
function makeThPlan(overrides: Partial<Plan> = {}): Plan {
  return makePlan('th-agent', {
    provider_id: 'tokenharbor',
    monthly_price_usd: 1.99,
    monthly_credit_usd: 10,
    limits: { '5h': null, 'weekly': 2.5, 'monthly': 10 },
    ...overrides
  })
}

/** TokenHarbor Office Pass: one shared $35 pool, weekly window only. */
function makeThOfficePlan(overrides: Partial<Plan> = {}): Plan {
  return makePlan('th-office', {
    provider_id: 'tokenharbor',
    monthly_price_usd: 9.99,
    monthly_credit_usd: 35,
    limits: { '5h': null, 'weekly': 8.75, 'monthly': 35 },
    ...overrides
  })
}

/** OpenDesign Go: one shared monthly pool ($220) with published $18/$55 windows. */
function makeOdPlan(overrides: Partial<Plan> = {}): Plan {
  return makePlan('od-go', {
    provider_id: 'open-design',
    monthly_price_usd: 10,
    monthly_credit_usd: 220,
    limits: { '5h': 18, 'weekly': 55, 'monthly': 220 },
    ...overrides
  })
}

const baseFilters = { hideOldModels: false, oldBefore: '2026-06-01', hideLowIntel: false, intelThreshold: 30 }

describe('normalizePlanComparisonDatabase - model filtering', () => {
  it('excludes a model with no release date when hideOldModels is on', () => {
    const model = makeModel({ id: 'no-date', releaseDate: null })
    const db = makeDatabase([model], [])
    const result = normalizePlanComparisonDatabase(db, { ...baseFilters, hideOldModels: true })
    expect(result.creditRows.find(r => r.model.id === 'no-date')).toBeUndefined()
    expect(result.skippedModelNames).not.toContain(model.name)
  })

  it('excludes a model released before the cutoff when hideOldModels is on — launch date no longer counts', () => {
    const model = makeModel({ id: 'old', releaseDate: '2026-01-01', launchedAt: '2026-09-01' })
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

describe('normalizePlanComparisonDatabase - plan cards', () => {
  it('exposes the published window fractions for a percent-based plan', () => {
    const db = makeDatabase([], [])
    db.plans = [
      makePlan('cmd-go'),
      makePlan('cmd-goat'),
      makePlan('oc-go', {
        limits: { '5h': 12, 'weekly': 30, 'monthly': 60 },
        limits_percent: { '5h': 20, 'weekly': 50, 'monthly': 100 }
      }),
      makeOdPlan()
    ]
    const oc = normalizePlanComparisonDatabase(db, baseFilters).planCards.find(c => c.id === 'oc-go')
    expect(oc?.limitPercent).toEqual({ '5h': 20, 'weekly': 50, 'monthly': 100 })
    // Dollar limits stay available for the estimate math.
    expect(oc?.limits).toEqual({ '5h': 12, 'weekly': 30, 'monthly': 60 })
  })

  it('leaves flat-dollar plans without window fractions', () => {
    const db = makeDatabase([], [])
    const cards = normalizePlanComparisonDatabase(db, baseFilters).planCards
    expect(cards.find(c => c.id === 'cmd-goat')?.limitPercent).toBeUndefined()
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

describe('normalizePlanComparisonDatabase - shared-pool rows', () => {
  it('carries the pool allocation as a plain usage value', () => {
    // Every plan is one shared pool, so a row holds only the usage the pool
    // funds on that model — no funding flag to branch on anywhere downstream.
    const model = makeModel({ id: 'pooled' })
    const db = makeDatabase([model], [
      { plan_id: 'od-go', model_id: 'pooled', monthly_credits_usd: 220, estimates: { per_5h: 400, per_week: 1250, per_month: 5000 } }
    ])
    const result = normalizePlanComparisonDatabase(db, baseFilters)
    const row = result.creditRows.find(r => r.model.id === 'pooled')
    expect(row?.od).toEqual({ credit: 220, request: 5000 })

    const card = result.planCards.find(c => c.id === 'od-go')
    expect(card?.monthlyCredit).toBe(220)
    expect(card?.modelCount).toBe(1)
    // Published windows reach the card as dollars (a plan without one would
    // carry null and the card would render a dash instead).
    expect(card?.limits).toEqual({ '5h': 18, 'weekly': 55, 'monthly': 220 })
  })

  it('keeps rendering when the stored data predates a registry plan', () => {
    // Production case (2026-11-06): the cache held the 3-plan payload from
    // before OpenDesign Go existed, the registry had 4 — the page 500ed with
    // "Unknown plan id: od-go" and hid its own "Refresh data" button.
    const db = makeDatabase([], [])
    db.plans = [makePlan('cmd-go'), makePlan('cmd-goat'), makePlan('oc-go')]
    const result = normalizePlanComparisonDatabase(db, baseFilters)
    expect(result.planCards.map(card => card.id)).toEqual(['cmd-go', 'cmd-goat', 'oc-go'])
  })
})

describe('normalizePlanComparisonDatabase - plan cards', () => {
  it('reports the per-model allocation range', () => {
    const db = makeDatabase(
      [makeModel({ id: 'cheap' }), makeModel({ id: 'pricey' })],
      [
        { plan_id: 'cmd-goat', model_id: 'cheap', monthly_credits_usd: 20, estimates: null },
        { plan_id: 'cmd-goat', model_id: 'pricey', monthly_credits_usd: 100, estimates: null }
      ]
    )
    const card = normalizePlanComparisonDatabase(db, baseFilters).planCards.find(c => c.id === 'cmd-goat')
    expect(card?.creditRange).toEqual({ min: 20, max: 100 })
  })

  it('leaves the range empty when every model gets the same credit', () => {
    const db = makeDatabase(
      [makeModel({ id: 'only' })],
      [{ plan_id: 'cmd-goat', model_id: 'only', monthly_credits_usd: 100, estimates: null }]
    )
    expect(normalizePlanComparisonDatabase(db, baseFilters).planCards.find(c => c.id === 'cmd-goat')?.creditRange).toBeNull()
  })

  it('reports the allocation span for every plan, pool or not', () => {
    // OpenDesign's rows are the usage its $220 pool funds per model ($55 for a
    // 4× model up to $440 for a 0.5× one) — the spread a reader compares, so it
    // is shown instead of being suppressed.
    const db = makeDatabase(
      [makeModel({ id: 'luna' }), makeModel({ id: 'flash' })],
      [
        { plan_id: 'od-go', model_id: 'luna', monthly_credits_usd: 55, estimates: null },
        { plan_id: 'od-go', model_id: 'flash', monthly_credits_usd: 440, estimates: null }
      ]
    )
    expect(normalizePlanComparisonDatabase(db, baseFilters).planCards.find(c => c.id === 'od-go')?.creditRange)
      .toEqual({ min: 55, max: 440 })
  })
})

describe('normalizePlanComparisonDatabase - plan selection (card checkboxes)', () => {
  const models = [
    makeModel({ id: 'both', slug: 'both', name: 'Both' }),
    makeModel({ id: 'cmd-only', slug: 'cmd-only', name: 'Cmd Only' }),
    makeModel({ id: 'th-only', slug: 'th-only', name: 'Th Only' })
  ]
  const planModels: PlanModelEstimate[] = [
    { plan_id: 'cmd-go', model_id: 'both', monthly_credits_usd: 10, estimates: { per_5h: 1, per_week: 2, per_month: 3 } },
    { plan_id: 'th-agent', model_id: 'both', monthly_credits_usd: 10, estimates: { per_5h: null, per_week: 2, per_month: 3 } },
    { plan_id: 'th-agent', model_id: 'th-only', monthly_credits_usd: 10, estimates: { per_5h: null, per_week: 2, per_month: 3 } },
    { plan_id: 'cmd-go', model_id: 'cmd-only', monthly_credits_usd: 10, estimates: { per_5h: 1, per_week: 2, per_month: 3 } }
  ]
  const db = makeDatabase(models, planModels)
  const ids = (rows: Array<{ model: Model }>) => rows.map(row => row.model.id).sort()

  it('starts with every plan checked, so all funded models are listed', () => {
    expect(ids(normalizePlanComparisonDatabase(db, baseFilters).creditRows)).toEqual(['both', 'cmd-only', 'th-only'])
    expect(Object.values(defaultPlanSelection()).every(Boolean)).toBe(true)
  })

  it('reports the checked plans so the charts draw only those series', () => {
    const result = normalizePlanComparisonDatabase(db, baseFilters, { ...defaultPlanSelection(), th: false })
    expect(result.selectedPlans.map(plan => plan.key)).toEqual(['cmd', 'goat', 'go', 'od', 'th-office'])
  })

  it('drops a model only an unchecked plan funds', () => {
    const result = normalizePlanComparisonDatabase(db, baseFilters, { ...defaultPlanSelection(), th: false })
    expect(ids(result.creditRows)).toEqual(['both', 'cmd-only'])
  })

  it('keeps a model another checked plan still funds', () => {
    const result = normalizePlanComparisonDatabase(db, baseFilters, { ...defaultPlanSelection(), cmd: false })
    expect(ids(result.creditRows)).toEqual(['both', 'th-only'])
  })

  it('empties both charts when no plan is checked', () => {
    const result = normalizePlanComparisonDatabase(db, baseFilters, {
      'cmd': false, 'goat': false, 'go': false, 'od': false, 'th': false, 'th-office': false
    })
    expect(result.creditRows).toEqual([])
    expect(result.dotRows).toEqual([])
  })

  it('reports a model a checked plan funds but publishes no requests for', () => {
    const noRequests = makeDatabase(
      [makeModel({ id: 'quiet', slug: 'quiet', name: 'Quiet' })],
      [{ plan_id: 'cmd-go', model_id: 'quiet', monthly_credits_usd: 10, estimates: null }]
    )
    const result = normalizePlanComparisonDatabase(noRequests, baseFilters, { ...defaultPlanSelection(), th: false })
    expect(ids(result.creditRows)).toEqual(['quiet'])
    expect(result.dotRows).toEqual([])
    expect(result.noRequestModelNames).toEqual(['Quiet'])
  })

  it('keeps the "no plan funds it" list independent of the selection', () => {
    // skippedModelNames answers "does any plan fund this model at all", so
    // unchecking cards must not move a model into that list.
    const orphanDb = makeDatabase([makeModel({ id: 'orphan', slug: 'orphan', name: 'Orphan' })], [])
    const result = normalizePlanComparisonDatabase(orphanDb, baseFilters, { ...defaultPlanSelection(), th: false })
    expect(result.skippedModelNames).toEqual(['Orphan'])
  })
})
