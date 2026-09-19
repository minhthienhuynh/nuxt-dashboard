import { describe, expect, it } from 'vitest'
import { crawledDatabaseSchema } from './schemas'

const validModel = {
  id: 'deepseek/deepseek-v4.1-flash',
  slug: 'deepseek-v4-1-flash',
  name: 'DeepSeek V4.1 Flash',
  vendor: 'DeepSeek',
  category: 'opensource',
  contextWindow: 1000000,
  reasoning: true,
  vision: true,
  inputCost: 0.15,
  outputCost: 0.6,
  cacheReadCost: 0.003,
  cacheWriteCost: null,
  tiers: [{ rates: { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: null } }],
  minPlanName: 'Go',
  deal: null,
  caps: {},
  intelligenceIndex: 40,
  codingIndex: 42,
  outputTokensPerSec: 120,
  releaseDate: '2026-09-01',
  launchedAt: '2026-09-10',
  timeOfDay: null
}

describe('crawledDatabaseSchema', () => {
  it('accepts a well-formed crawl result', () => {
    const result = crawledDatabaseSchema.safeParse({
      models: [validModel],
      pricing: [{ provider_id: 'command-code', model_id: 'deepseek/deepseek-v4.1-flash', tier: 'standard', peak_utc_hours: null, input: 0.15, output: 0.6, cache_read: 0.003, cache_write: null }],
      plan_models: [{ plan_id: 'cmd-goat', model_id: 'deepseek/deepseek-v4.1-flash', monthly_credits_usd: 60, estimates: { per_5h: 30800, per_week: 76900, per_month: 154000 } }]
    })
    expect(result.success).toBe(true)
  })

  it('rejects a broken payload', () => {
    expect(crawledDatabaseSchema.safeParse({ models: [{ ...validModel, contextWindow: 'big' }], pricing: [], plan_models: [] }).success).toBe(false)
    expect(crawledDatabaseSchema.safeParse({ pricing: [], plan_models: [] }).success).toBe(false)
    expect(crawledDatabaseSchema.safeParse(null).success).toBe(false)
  })
})
