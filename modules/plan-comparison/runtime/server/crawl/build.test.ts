import { describe, expect, it } from 'vitest'
import { buildDatabase, dedupeBy, effectiveRates, isGoGoatModel, resolveOcModelId, sameSlug } from './build'
import { matchName } from './opencode'
import type { Model } from '../../app/types'

function makeModel(overrides: Partial<Model> = {}): Model {
  return {
    id: 'acme/widget',
    slug: 'widget',
    name: 'Widget',
    vendor: 'Acme',
    category: 'opensource',
    contextWindow: 100000,
    reasoning: true,
    vision: false,
    inputCost: 1,
    outputCost: 4,
    cacheReadCost: 0.1,
    cacheWriteCost: null,
    tiers: [{ rates: { input: 1, output: 4, cacheRead: 0.1, cacheWrite: null } }],
    minPlanName: 'Go',
    deal: null,
    caps: {},
    intelligenceIndex: 50,
    codingIndex: 55,
    outputTokensPerSec: 100,
    releaseDate: null,
    launchedAt: '2026-09-01',
    timeOfDay: null,
    ...overrides
  }
}

const baseInput = {
  goatModels: [makeModel()],
  goatEstimates: [{ name: 'Widget', budgetUsd: 70, rates: { inputCost: 1, outputCost: 4, cacheReadCost: 0.1 }, shape: { inputTokens: 800, outputTokens: 200, cacheReadTokens: 50000 }, timeOfDay: null }],
  pricingSections: [{ slug: 'widget', rates: { input: 1, output: 4, cacheRead: 0.1, cacheWrite: null } }],
  goCreditsUsd: 10,
  goatFractions: { fiveHour: 0.2, weekly: 0.5 },
  openCodePricing: [],
  openCodeEstimates: [],
  openCodeEndpoints: [],
  fetchedAt: '2026-09-19T00:00:00.000Z',
  sourceUrls: { goat: 'g', go: 'o', pricingLimits: 'p', openCodeGo: 'oc' }
}

describe('matchName', () => {
  it('strips parentheticals like (latest)', () => {
    expect(matchName('DeepSeek V4 Flash (latest)')).toBe(matchName('deepseek v4 flash'))
  })
})

describe('sameSlug', () => {
  it('unifies dots, dashes and case', () => {
    expect(sameSlug('deepseek-v4-1-flash', 'deepseek-v4.1-flash')).toBe(true)
    expect(sameSlug('qwen3-8-max', 'qwen3.8-max')).toBe(true)
    expect(sameSlug('minimax-m2-7', 'minimax-m2.7')).toBe(true)
    expect(sameSlug('kimi-k3', 'kimi-k2.6')).toBe(false)
  })
})

describe('resolveOcModelId', () => {
  const cmd = [makeModel({ id: 'deepseek/deepseek-v4.1-flash', slug: 'deepseek-v4-1-flash', name: 'DeepSeek V4.1 Flash' })]

  it('reuses the CMD id despite missing vendor prefix and dot/dash drift', () => {
    expect(resolveOcModelId(cmd, 'deepseek-v4.1-flash', 'DeepSeek V4.1 Flash')).toBe('deepseek/deepseek-v4.1-flash')
  })

  it('falls back to display-name matching', () => {
    expect(resolveOcModelId(cmd, 'something-else', 'DeepSeek V4.1 Flash')).toBe('deepseek/deepseek-v4.1-flash')
  })

  it('returns null for genuinely new models', () => {
    expect(resolveOcModelId(cmd, 'grok-4.6', 'Grok 4.6')).toBeNull()
  })

  it('joins a bare endpoint id to the CMD variant row', () => {
    const hy = [makeModel({ id: 'tencent/hy3-paid', slug: 'tencent-hy3', name: 'Tencent Hy3' })]
    expect(resolveOcModelId(hy, 'hy3', 'Hy3')).toBe('tencent/hy3-paid')
  })

  it('leaves an ambiguous bare id unresolved instead of picking a variant', () => {
    const variants = [
      makeModel({ id: 'acme/widget-paid', slug: 'widget-paid', name: 'Widget Paid' }),
      makeModel({ id: 'acme/widget-free', slug: 'widget-free', name: 'Widget Free' })
    ]
    expect(resolveOcModelId(variants, 'widget', 'Widget')).toBeNull()
  })
})
describe('dedupeBy', () => {
  it('keeps the first occurrence per key', () => {
    expect(dedupeBy([{ k: 'a', v: 1 }, { k: 'a', v: 2 }, { k: 'b', v: 3 }], r => r.k)).toEqual([
      { k: 'a', v: 1 },
      { k: 'b', v: 3 }
    ])
  })
})

describe('effectiveRates', () => {
  it('prefers off-peak overrides', () => {
    const model = makeModel({ timeOfDay: { offPeak: { input: 0.5 }, effective: 'x' } })
    expect(effectiveRates(model).input).toBe(0.5)
    expect(effectiveRates(model).output).toBe(4)
  })
})

describe('isGoGoatModel', () => {
  it('keeps Go/GOAT and drops Pro/Max premium rows', () => {
    expect(isGoGoatModel(makeModel({ minPlanName: 'Go' }))).toBe(true)
    expect(isGoGoatModel(makeModel({ minPlanName: 'GOAT' }))).toBe(true)
    expect(isGoGoatModel(makeModel({ minPlanName: 'Pro' }))).toBe(false)
    expect(isGoGoatModel(makeModel({ minPlanName: 'Max' }))).toBe(false)
  })
})

describe('buildDatabase scope', () => {
  it('excludes premium models and their rows entirely', () => {
    const db = buildDatabase({ ...baseInput, goatModels: [makeModel({ id: 'a', minPlanName: 'Go' }), makeModel({ id: 'p', name: 'Premium', minPlanName: 'Pro' })] })
    expect(db.models.map(m => m.id)).toEqual(['a'])
    expect(db.plan_models.some(p => p.model_id === 'p')).toBe(false)
    expect(db.pricing.some(p => p.model_id === 'p')).toBe(false)
  })
})

describe('buildDatabase', () => {
  it('emits list-price-first pricing and goat/go rows', () => {
    const db = buildDatabase(baseInput)
    const cmd = db.pricing.filter(p => p.provider_id === 'command-code')
    expect(cmd[0]?.tier).toBe('standard')
    expect(cmd.map(p => p.tier)).toContain('standard')
    const plans = db.plan_models.map(p => p.plan_id).sort()
    expect(plans).toEqual(['cmd-go', 'cmd-goat'])
    expect(db.plan_models[0]?.sourceUrl).toBe('g')
    expect(db.plan_models[0]?.fetchedAt).toBe(baseInput.fetchedAt)
  })

  it('skips the cmd-go row when minPlanName requires GOAT', () => {
    const db = buildDatabase({ ...baseInput, goatModels: [makeModel({ minPlanName: 'GOAT' })] })
    expect(db.plan_models.map(p => p.plan_id)).toEqual(['cmd-goat'])
  })

  it('merges OC rows into the CMD model instead of duplicating it', () => {
    const db = buildDatabase({
      ...baseInput,
      openCodePricing: [{ name: 'Widget', tier: 'standard', input: 0.2, output: 0.4, cacheRead: 0.01, cacheWrite: null, monthlyLimit: 15 }],
      openCodeEstimates: [{ name: 'Widget', per5h: 100, perWeek: 200, perMonth: 400 }],
      openCodeEndpoints: [{ name: 'Widget', modelId: 'widget' }]
    })
    expect(db.models.filter(m => m.name === 'Widget')).toHaveLength(1)
    const oc = db.plan_models.filter(p => p.plan_id === 'oc-go')
    expect(oc).toHaveLength(1)
    expect(oc[0]?.model_id).toBe('acme/widget')
  })

  it('joins an OpenCode bare id to the CMD variant row instead of duplicating it', () => {
    const db = buildDatabase({
      ...baseInput,
      goatModels: [makeModel({ id: 'tencent/hy3-paid', slug: 'tencent-hy3', name: 'Tencent Hy3' })],
      openCodePricing: [{ name: 'Hy3', tier: 'standard', input: 0.14, output: 0.58, cacheRead: 0.035, cacheWrite: null, monthlyLimit: 60 }],
      openCodeEstimates: [{ name: 'Hy3', per5h: 4300, perWeek: 10750, perMonth: 21500 }],
      openCodeEndpoints: [{ name: 'Hy3', modelId: 'hy3' }]
    })
    expect(db.models.map(m => m.id)).toEqual(['tencent/hy3-paid'])
    const oc = db.plan_models.filter(p => p.plan_id === 'oc-go')
    expect(oc).toHaveLength(1)
    expect(oc[0]?.model_id).toBe('tencent/hy3-paid')
    expect(db.pricing.filter(p => p.provider_id === 'opencode').map(p => p.model_id)).toEqual(['tencent/hy3-paid'])
  })

  it('maps OC tables with generated ids for rows lacking endpoints', () => {
    const db = buildDatabase({
      ...baseInput,
      openCodePricing: [{ name: 'Solo', tier: 'standard', input: 0.2, output: 0.4, cacheRead: 0.01, cacheWrite: null, monthlyLimit: 15 }],
      openCodeEstimates: [{ name: 'Solo', per5h: 100, perWeek: 200, perMonth: 400 }],
      openCodeEndpoints: []
    })
    const oc = db.plan_models.filter(p => p.plan_id === 'oc-go')
    expect(oc).toHaveLength(1)
    expect(oc[0]?.monthly_credits_usd).toBe(15)
    expect(oc[0]?.estimates?.per_month).toBe(400)
    expect(db.models.some(m => m.id === 'opencode/solo')).toBe(true)
  })
})
