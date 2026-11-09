import { describe, expect, it } from 'vitest'
import { allowanceFor, buildDatabase, dedupeBy, effectiveRates, isGoGoatModel, resolveCatalogModelId, sameSlug } from './build'
import { matchName } from './opencode'
import type { Model } from '../../app/types'
import type { OpenDesignCatalogModel } from './opendesign'
import type { TokenHarborModel } from './tokenharbor'

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
  goEstimates: [],
  goFractions: { fiveHour: 0.3, weekly: 0.6 },
  openCodePricing: [],
  openCodeEstimates: [],
  openCodeEndpoints: [],
  openDesignAllowances: [],
  openDesignModels: [],
  openDesignMultipliers: [],
  tokenHarborModels: [],
  tokenHarborBoosts: [],
  fetchedAt: '2026-09-19T00:00:00.000Z',
  sourceUrls: { goat: 'g', go: 'o', pricingLimits: 'p', openCodeGo: 'oc', openDesignPricing: 'odp', openDesignModels: 'odm', openDesignCredits: 'odc', tokenHarborModels: 'thm', tokenHarborPricing: 'thp' }
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

describe('resolveCatalogModelId', () => {
  const cmd = [makeModel({ id: 'deepseek/deepseek-v4.1-flash', slug: 'deepseek-v4-1-flash', name: 'DeepSeek V4.1 Flash' })]

  it('reuses the CMD id despite missing vendor prefix and dot/dash drift', () => {
    expect(resolveCatalogModelId(cmd, 'deepseek-v4.1-flash', 'DeepSeek V4.1 Flash')).toBe('deepseek/deepseek-v4.1-flash')
  })

  it('falls back to display-name matching', () => {
    expect(resolveCatalogModelId(cmd, 'something-else', 'DeepSeek V4.1 Flash')).toBe('deepseek/deepseek-v4.1-flash')
  })

  it('returns null for genuinely new models', () => {
    expect(resolveCatalogModelId(cmd, 'grok-4.6', 'Grok 4.6')).toBeNull()
  })

  it('joins a bare endpoint id to the CMD variant row', () => {
    const hy = [makeModel({ id: 'tencent/hy3-paid', slug: 'tencent-hy3', name: 'Tencent Hy3' })]
    expect(resolveCatalogModelId(hy, 'hy3', 'Hy3')).toBe('tencent/hy3-paid')
  })

  it('leaves an ambiguous bare id unresolved instead of picking a variant', () => {
    const variants = [
      makeModel({ id: 'acme/widget-paid', slug: 'widget-paid', name: 'Widget Paid' }),
      makeModel({ id: 'acme/widget-free', slug: 'widget-free', name: 'Widget Free' })
    ]
    expect(resolveCatalogModelId(variants, 'widget', 'Widget')).toBeNull()
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

  it('uses the Go estimates table for cmd-go budgets (per-model credits)', () => {
    const db = buildDatabase({
      ...baseInput,
      goEstimates: [{ name: 'Widget', budgetUsd: 6, rates: { inputCost: 1, outputCost: 4, cacheReadCost: 0.1 }, shape: { inputTokens: 800, outputTokens: 200, cacheReadTokens: 50000 }, timeOfDay: null }]
    })
    const go = db.plan_models.find(p => p.plan_id === 'cmd-go')
    expect(go?.monthly_credits_usd).toBe(6)
    // Go fractions 0.3/0.6: 6 credits at cost 0.0066/req = 909/mo → 273/545/909
    expect(go?.estimates).toEqual({ per_5h: 273, per_week: 545, per_month: 909 })
  })

  it('falls back to flat-budget math when the model is missing from the Go table', () => {
    const db = buildDatabase(baseInput)
    const go = db.plan_models.find(p => p.plan_id === 'cmd-go')
    expect(go?.monthly_credits_usd).toBe(10)
    // Flat $10 at cost 0.0066/req: exact 1515.15/mo → round3 (3 sig digits) 1520;
    // windows on exact month with Go limits 3/6/10 → 455/909/1520
    expect(go?.estimates).toEqual({ per_5h: 455, per_week: 909, per_month: 1520 })
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

  it('keeps catalog metadata when an OC row funds a Pro-only model', () => {
    // Gemini 4 Argon is a Pro model on CMD but Go on OpenCode Go; the OC row
    // still needs the catalog's vendor/context/AA instead of a bare shell.
    const db = buildDatabase({
      ...baseInput,
      goatModels: [makeModel({
        id: 'google/gemini-4-argon',
        slug: 'gemini-4-argon',
        name: 'Gemini 4 Argon',
        vendor: 'Google',
        minPlanName: 'Pro',
        contextWindow: 1000000,
        intelligenceIndex: 52.6
      })],
      openCodePricing: [{ name: 'Gemini 4 Argon', tier: 'standard', input: 2, output: 10, cacheRead: 0.1, cacheWrite: null, monthlyLimit: 30 }],
      openCodeEstimates: [{ name: 'Gemini 4 Argon', per5h: 530, perWeek: 1060, perMonth: 2120 }],
      openCodeEndpoints: [{ name: 'Gemini 4 Argon', modelId: 'gemini-4-argon' }]
    })
    const oc = db.plan_models.filter(p => p.plan_id === 'oc-go')
    expect(oc).toHaveLength(1)
    expect(oc[0]?.model_id).toBe('google/gemini-4-argon')
    expect(db.models.find(m => m.id === 'google/gemini-4-argon')?.vendor).toBe('Google')
    expect(db.models.find(m => m.id === 'google/gemini-4-argon')?.intelligenceIndex).toBe(52.6)
    // Pro models still get no CMD plan row or CMD pricing entry.
    expect(db.plan_models.some(p => p.plan_id === 'cmd-go' && p.model_id === 'google/gemini-4-argon')).toBe(false)
    expect(db.pricing.some(p => p.provider_id === 'command-code' && p.model_id === 'google/gemini-4-argon')).toBe(false)
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

  it('drops free OC promo rows entirely, like goat free models', () => {
    // Live OC page: "Space Bunny Free | Free | Free | Free | - | Unlimited"
    // parses to null rates + null estimates, then borrows the $60 plan
    // credit and enters chart 1 as a phantom paid model.
    const db = buildDatabase({
      ...baseInput,
      openCodePricing: [{ name: 'Space Bunny Free', tier: 'standard', input: null, output: null, cacheRead: null, cacheWrite: null, monthlyLimit: null }],
      openCodeEstimates: [{ name: 'Space Bunny Free', per5h: null, perWeek: null, perMonth: null }],
      openCodeEndpoints: [{ name: 'Space Bunny Free', modelId: 'space-bunny-free' }]
    })
    expect(db.models.some(m => m.id === 'space-bunny-free')).toBe(false)
    expect(db.plan_models.some(p => p.model_id === 'space-bunny-free')).toBe(false)
    expect(db.pricing.some(p => p.model_id === 'space-bunny-free')).toBe(false)
  })

  it('keeps OC rows with null rates but a published monthly limit', () => {
    // A paid row whose rate cells failed to parse must not be dropped
    // silently: the published limit proves it is a real offering.
    const db = buildDatabase({
      ...baseInput,
      openCodePricing: [{ name: 'Glitch', tier: 'standard', input: null, output: null, cacheRead: null, cacheWrite: null, monthlyLimit: 60 }],
      openCodeEstimates: [],
      openCodeEndpoints: []
    })
    expect(db.models.some(m => m.id === 'opencode/glitch')).toBe(true)
    expect(db.plan_models.some(p => p.model_id === 'opencode/glitch')).toBe(true)
  })
})

const odAllowancesFixture = [{ name: 'Go', monthly: 10, codingCredits: 220, weeklyWindow: 55, fiveHourWindow: 18 }]

function odModel(overrides: Partial<OpenDesignCatalogModel> = {}): OpenDesignCatalogModel {
  return {
    id: 'widget',
    slug: 'widget',
    name: 'Widget',
    vendor: 'Acme',
    plans: ['go', 'plus', 'pro', 'max'],
    tiers: [{ input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: null }],
    ...overrides
  }
}

describe('allowanceFor', () => {
  it('reads the Coding Plan credits and windows of the named plan', () => {
    expect(allowanceFor(odAllowancesFixture, 'go')?.codingCredits).toBe(220)
    expect(allowanceFor(odAllowancesFixture, 'go')?.weeklyWindow).toBe(55)
    expect(allowanceFor(odAllowancesFixture, 'Missing')).toBeNull()
  })
})

describe('buildDatabase - OpenDesign Go pool plan', () => {
  it('gives every Go-eligible model the whole shared pool as its credit', () => {
    const db = buildDatabase({
      ...baseInput,
      openDesignAllowances: odAllowancesFixture,
      openDesignModels: [odModel()],
      openDesignMultipliers: [{ name: 'Widget', multiplier: 1 }]
    })
    const row = db.plan_models.find(p => p.plan_id === 'od-go')
    expect(row?.model_id).toBe('acme/widget')
    expect(row?.monthly_credits_usd).toBe(220)
    // 800 in + 200 out + 50K cache at $0.3/$1.2/$0.006 = $0.00078/req
    // → 282,051 req/mo → round3 282000; windows from the allowance table
    // ($18 per 5h, $55 per 7d over a $220 pool) → 23100 / 70500.
    expect(row?.estimates).toEqual({ per_5h: 23100, per_week: 70500, per_month: 282000 })
    // Credit from the plan table, multiplier from the credits page, rates from
    // the catalog: all three recorded.
    expect(row?.sourceUrl).toBe('odp')
    expect(row?.note).toBe('Pool 220/mo at 1× from odc; rates from odm')
  })

  it('falls back to the static pool when the page stops listing the Go row', () => {
    const db = buildDatabase({
      ...baseInput,
      openDesignModels: [odModel()],
      openDesignMultipliers: [{ name: 'Widget', multiplier: 1 }]
    })
    expect(db.plan_models.find(p => p.plan_id === 'od-go')?.monthly_credits_usd).toBe(220)
  })

  it('prices a plan-only model without granting it Go credit', () => {
    const db = buildDatabase({
      ...baseInput,
      openDesignAllowances: odAllowancesFixture,
      openDesignModels: [odModel({ plans: ['pro', 'max'] })]
    })
    expect(db.pricing.filter(p => p.provider_id === 'open-design').map(p => p.model_id)).toEqual(['acme/widget'])
    expect(db.plan_models.some(p => p.plan_id === 'od-go')).toBe(false)
  })

  it('maps input-length tiers to standard then extended', () => {
    const db = buildDatabase({
      ...baseInput,
      openDesignAllowances: odAllowancesFixture,
      openDesignModels: [odModel({
        tiers: [
          { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
          { input: 4, output: 15, cacheRead: 0.2, cacheWrite: 5 }
        ]
      })]
    })
    expect(db.pricing.filter(p => p.provider_id === 'open-design').map(p => p.tier)).toEqual(['standard', 'extended'])
  })

  it('converts the pool by the model credit multiplier', () => {
    // Credits spent = usage × multiplier, so a 0.5× model gets $440 of usage
    // from the $220 pool, a 2× model $110 and a 4× model $55
    // (open-design.ai/model-credits). Only one catalog model is available here,
    // so each multiplier gets its own build.
    const build = (multiplier: number) => {
      const db = buildDatabase({
        ...baseInput,
        openDesignAllowances: odAllowancesFixture,
        openDesignModels: [odModel()],
        openDesignMultipliers: [{ name: 'Widget', multiplier }]
      })
      const row = db.plan_models.find(p => p.plan_id === 'od-go')
      return { credits: row?.monthly_credits_usd, perMonth: row?.estimates?.per_month, note: row?.note }
    }
    // $440 of usage at $0.00078/req = 564,102 → round3 564000.
    expect(build(0.5)).toMatchObject({ credits: 440, perMonth: 564000 })
    expect(build(2)).toMatchObject({ credits: 110, perMonth: 141000 })
    expect(build(4)).toMatchObject({ credits: 55, perMonth: 70500 })
    expect(build(1)).toMatchObject({ credits: 220, perMonth: 282000 })
    expect(build(0.5).note).toBe('Pool 220/mo at 0.5× from odc; rates from odm')
  })

  it('skips a legacy panel that has no catalog card at all', () => {
    // 13 live panels are legacy rate cards (older Grok/GLM/Opus versions) with
    // no `a.catalog-card`: they are not offered by any plan, so neither their
    // rates nor a row may enter the dataset.
    const db = buildDatabase({
      ...baseInput,
      openDesignAllowances: odAllowancesFixture,
      openDesignModels: [odModel({ plans: [] })]
    })
    expect(db.pricing.some(p => p.provider_id === 'open-design')).toBe(false)
    expect(db.plan_models.some(p => p.plan_id === 'od-go')).toBe(false)
  })

  it('funds every Design Plan model, including ones with no /models panel', () => {
    // Go's model list includes MiniMax M3.1 Flash and DeepSeek V4.1 Flash Eco,
    // neither of which has a panel with rates: membership comes from the credit
    // multiplier table, and their rows carry credit with null estimates.
    const db = buildDatabase({
      ...baseInput,
      openDesignAllowances: odAllowancesFixture,
      openDesignModels: [odModel()],
      openDesignMultipliers: [
        { name: 'Widget', multiplier: 1 },
        { name: 'MiniMax M3.1 Flash', multiplier: 1 },
        { name: 'DeepSeek V4.1 Flash Eco', multiplier: 0.27 }
      ]
    })
    const rows = db.plan_models.filter(p => p.plan_id === 'od-go')
    expect(rows).toHaveLength(3)
    const byModel = new Map(db.models.map(m => [m.id, m.name]))
    const summary = rows.map(r => [byModel.get(r.model_id), r.monthly_credits_usd, r.estimates])
    expect(summary).toEqual([
      ['Widget', 220, { per_5h: 23100, per_week: 70500, per_month: 282000 }],
      // In the catalog, but OpenDesign publishes no rates for it.
      ['MiniMax M3.1 Flash', 220, null],
      // Not in any catalog source: gets a minimal entry so the row can exist.
      ['DeepSeek V4.1 Flash Eco', 814.81, null]
    ])
    expect(rows[2]?.note).toBe('Pool 220/mo at 0.27× from odc; no published rates')
  })

  it('leaves models outside the catalog out of the dataset', () => {
    const db = buildDatabase({
      ...baseInput,
      openDesignAllowances: odAllowancesFixture,
      openDesignModels: [odModel({ id: 'ghost-1', slug: 'ghost-1', name: 'Ghost' })]
    })
    expect(db.models.map(m => m.id)).toEqual(['acme/widget'])
    expect(db.pricing.some(p => p.provider_id === 'open-design')).toBe(false)
    expect(db.plan_models.some(p => p.plan_id === 'od-go')).toBe(false)
  })
})

function thModel(overrides: Partial<TokenHarborModel> = {}): TokenHarborModel {
  return {
    id: 'widget',
    label: 'Widget',
    family: 'acme',
    tier: 'value',
    priceIn: 0.1,
    priceOut: 0.5,
    cacheRead: 0.01,
    cacheWrite: null,
    contextWindow: 100000,
    maxOutput: null,
    intelligenceIndex: null,
    inputModalities: ['text'],
    isFree: false,
    speedOf: null,
    ...overrides
  }
}

describe('buildDatabase - TokenHarbor Agent Pass', () => {
  const agentModels = [
    thModel({ id: 'glm-5.3-flash', label: 'GLM 5.3 Flash', family: 'z-ai', priceIn: 0.15, priceOut: 0.5, cacheRead: 0.03, contextWindow: 1000000, intelligenceIndex: 27.8 }),
    // By-name: above the output cap and still funded.
    thModel({ id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', family: 'openai', priceIn: 0.2, priceOut: 1.2, cacheRead: 0.02 }),
    thModel({ id: 'claude-opus-5.5', label: 'Claude Opus 5.5', family: 'anthropic', priceIn: 4, priceOut: 20 }),
    thModel({ id: 'mimo-v2.5:free', label: 'MiMo V2.5', priceIn: 0, priceOut: 0, isFree: true })
  ]

  it('funds only the rule-eligible paid models and prices the published profile', () => {
    const db = buildDatabase({
      ...baseInput,
      tokenHarborModels: agentModels,
      tokenHarborBoosts: [{ name: 'GLM 5.3 Flash', multiple: 2, promo: false }]
    })
    const rows = db.plan_models.filter(p => p.plan_id === 'th-agent')
    // Opus is outside the price caps and the free route is never funded.
    expect(rows.map(r => r.model_id).sort()).toEqual(['tokenharbor/glm-5-3-flash', 'tokenharbor/gpt-5-6-luna'])

    const glm = rows.find(r => r.model_id === 'tokenharbor/glm-5-3-flash')
    // Model Boost 2× stretches the $10 pool to $20 of usage; 10K in (8K cache)
    // + 1K out at $0.15/$0.5/$0.03 = $0.00104/req → 19231/4810 per month/week.
    expect(glm?.monthly_credits_usd).toBe(20)
    expect(glm?.estimates).toEqual({ per_5h: null, per_week: 4810, per_month: 19200 })
    expect(glm?.sourceUrl).toBe('thp')
    expect(glm?.note).toContain('Model Boost 2×')

    const luna = rows.find(r => r.model_id === 'tokenharbor/gpt-5-6-luna')
    expect(luna?.monthly_credits_usd).toBe(10)
    // $0.00176/req → 5681.8/mo → round3; the pass publishes no 5-hour window.
    expect(luna?.estimates).toEqual({ per_5h: null, per_week: 1420, per_month: 5680 })

    // Gateway-only models still carry real metadata: vendor from the published
    // family and the vendor's own intelligence index.
    const entry = db.models.find(m => m.id === 'tokenharbor/glm-5-3-flash')
    expect(entry).toMatchObject({ vendor: 'Z.ai', contextWindow: 1000000, intelligenceIndex: 27.8 })
    expect(db.pricing.filter(p => p.provider_id === 'tokenharbor').map(p => [p.model_id, p.input, p.output]))
      .toEqual([
        ['tokenharbor/glm-5-3-flash', 0.15, 0.5],
        ['tokenharbor/gpt-5-6-luna', 0.2, 1.2]
      ])
  })

  it('does not stretch the pool for a promo badge', () => {
    // "2x usage during the promo" is promo-shaped: the promo already sits in
    // the published rate, so the pool must not be doubled on top of it.
    const db = buildDatabase({
      ...baseInput,
      tokenHarborModels: [agentModels[0]!],
      tokenHarborBoosts: [{ name: 'GLM 5.3 Flash', multiple: 2, promo: true }]
    })
    const row = db.plan_models.find(p => p.plan_id === 'th-agent')
    expect(row?.monthly_credits_usd).toBe(10)
    expect(row?.note).toContain('promo multiplier not applied')
  })

  it('merges a TokenHarbor model into the CMD catalog row instead of duplicating it', () => {
    const db = buildDatabase({
      ...baseInput,
      tokenHarborModels: [thModel({ id: 'widget', label: 'Widget', priceIn: 0.1, priceOut: 0.5, cacheRead: 0.01 })]
    })
    expect(db.models.filter(m => m.slug === 'widget')).toHaveLength(1)
    expect(db.plan_models.find(p => p.plan_id === 'th-agent')?.model_id).toBe('acme/widget')
  })

  it('joins a dated TokenHarbor pin to the catalog row that other plans use', () => {
    // TokenHarbor sells "deepseek-v4.1-flash-1017" while Command Code lists the
    // same model as deepseek/deepseek-v4.1-flash ("(latest)"): without the alias
    // the pass quota would sit on a second, metadata-poor row.
    const db = buildDatabase({
      ...baseInput,
      goatModels: [makeModel({
        id: 'deepseek/deepseek-v4.1-flash',
        slug: 'deepseek-v4-1-flash',
        name: 'DeepSeek V4.1 Flash (latest)',
        vendor: 'DeepSeek',
        inputCost: 0.3,
        outputCost: 1.2,
        cacheReadCost: 0.003,
        contextWindow: 1048576,
        intelligenceIndex: 39.5
      })],
      tokenHarborModels: [thModel({
        id: 'deepseek-v4.1-flash-1017',
        label: 'DeepSeek V4.1 Flash 1017',
        family: 'deepseek',
        priceIn: 0.15,
        priceOut: 0.6,
        cacheRead: 0.003,
        contextWindow: 1048576
      })]
    })
    const row = db.plan_models.find(p => p.plan_id === 'th-agent')
    expect(row?.model_id).toBe('deepseek/deepseek-v4.1-flash')
    // $10 pool at $0.000924/req (the published promo rate) → 10823 → round3.
    expect(row?.monthly_credits_usd).toBe(10)
    expect(row?.estimates).toEqual({ per_5h: null, per_week: 2710, per_month: 10800 })
    expect(db.models.filter(m => m.slug === 'deepseek-v4-1-flash')).toHaveLength(1)
    expect(db.pricing.filter(p => p.provider_id === 'tokenharbor').map(p => p.model_id))
      .toEqual(['deepseek/deepseek-v4.1-flash'])
  })
})
