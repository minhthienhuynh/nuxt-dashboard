import { describe, expect, it } from 'vitest'
import { isExcludedModel, isFreeModel, isStealthModel, parseGoatEstimates, parseGoatModel, parseGoatModels } from './goat'

const fullItem = {
  slug: 'deepseek-v4-1-flash',
  id: 'deepseek/deepseek-v4.1-flash',
  name: 'DeepSeek V4.1 Flash',
  vendor: 'DeepSeek',
  category: 'opensource',
  contextWindow: 1000000,
  reasoning: true,
  vision: true,
  inputCost: 0.15,
  outputCost: 0.6,
  cacheReadCost: 0.003,
  cacheWriteCost: '$undefined',
  tiers: [{ rates: { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: '$undefined' } }],
  minPlanName: 'Go',
  deal: null,
  caps: { text: true, vision: true, reasoning: true },
  intelligenceIndex: 40,
  codingIndex: 42,
  outputTokensPerSec: 120,
  releaseDate: '2026-09-01',
  launchedAt: '2026-09-10',
  timeOfDay: null
}

describe('parseGoatModel', () => {
  it('maps every script field and converts $undefined to null', () => {
    const model = parseGoatModel(fullItem)
    expect(model?.id).toBe('deepseek/deepseek-v4.1-flash')
    expect(model?.contextWindow).toBe(1000000)
    expect(model?.cacheWriteCost).toBeNull()
    expect(model?.tiers[0]?.rates.cacheWrite).toBeNull()
    expect(model?.outputTokensPerSec).toBe(120)
    expect(model?.launchedAt).toBe('2026-09-10')
  })

  it('returns null for non-objects', () => {
    expect(parseGoatModel(null)).toBeNull()
    expect(parseGoatModel('x')).toBeNull()
  })
})

describe('isFreeModel', () => {
  it('excludes deal-free rows', () => {
    expect(isFreeModel({ ...fullItem, deal: { free: true } })).toBe(true)
  })

  it('excludes all-zero tier-0 rates', () => {
    const zero = { ...fullItem, tiers: [{ rates: { input: 0, output: 0, cacheRead: 0 } }] }
    expect(isFreeModel(zero)).toBe(true)
  })

  it('keeps paid models', () => {
    expect(isFreeModel(fullItem)).toBe(false)
  })
})

describe('isStealthModel', () => {
  it('excludes placeholders with no lab specs', () => {
    const stealth = { slug: 'omen-alpha', id: 'x/omen-alpha', name: 'Omen Alpha', contextWindow: '$undefined', intelligenceIndex: '$undefined', codingIndex: '$undefined', releaseDate: '$undefined' }
    expect(isStealthModel(stealth)).toBe(true)
    expect(isExcludedModel(stealth)).toBe(true)
  })

  it('keeps real models', () => {
    expect(isStealthModel(fullItem)).toBe(false)
  })
})

describe('parseGoatModels', () => {
  it('drops excluded models and non-objects', () => {
    const models = parseGoatModels([fullItem, { slug: 'free', tiers: [{ rates: { input: 0, output: 0, cacheRead: 0 } }] }, null])
    expect(models.map(m => m.slug)).toEqual(['deepseek-v4-1-flash'])
  })

  it('returns empty for non-arrays', () => {
    expect(parseGoatModels(null)).toEqual([])
  })
})

describe('parseGoatEstimates', () => {
  it('normalizes estimate rows with script keys, shape and timeOfDay', () => {
    const parsed = parseGoatEstimates({
      rows: [{
        name: 'DeepSeek V4.1 Flash',
        budgetUsd: 60,
        rates: { inputCost: 0.15, outputCost: 0.6, cacheReadCost: 0.003 },
        shape: { inputTokens: 800, outputTokens: 200, cacheReadTokens: 50000 },
        timeOfDay: {
          effective: '2026-08-16T16:00:00Z',
          offPeak: { inputCost: 0.15, outputCost: 0.6, cacheReadCost: 0.003 },
          peak: { inputCost: 0.3, outputCost: 1.2, cacheReadCost: 0.006 }
        }
      }],
      fiveHourFraction: 0.2,
      weeklyFraction: 0.5
    })
    expect(parsed.rows[0]?.budgetUsd).toBe(60)
    expect(parsed.rows[0]?.rates?.inputCost).toBe(0.15)
    expect(parsed.rows[0]?.shape?.outputTokens).toBe(200)
    expect(parsed.rows[0]?.timeOfDay?.offPeak?.inputCost).toBe(0.15)
    expect(parsed.fiveHourFraction).toBe(0.2)
  })
})
