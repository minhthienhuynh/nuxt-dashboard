import { describe, expect, it } from 'vitest'
import { computeEstimates, computeRowEstimates, outputTokensForVendor, resolveRowRates, resolveRowShape, round3 } from './estimates'

describe('outputTokensForVendor', () => {
  it('maps known vendors and falls back to 200', () => {
    expect(outputTokensForVendor('Anthropic')).toBe(180)
    expect(outputTokensForVendor('OpenAI')).toBe(160)
    expect(outputTokensForVendor('MiniMax')).toBe(125)
    expect(outputTokensForVendor('DeepSeek')).toBe(200)
    expect(outputTokensForVendor('Z.ai')).toBe(150)
    expect(outputTokensForVendor('Z AI')).toBe(150)
    expect(outputTokensForVendor('Moonshot AI')).toBe(200)
    expect(outputTokensForVendor(null)).toBe(200)
    expect(outputTokensForVendor('Unknown Lab')).toBe(200)
  })

  it('computes FlashX cmd-go as 2360, not 2330', () => {
    const result = computeEstimates(
      10,
      { input: 0.37, output: 1.25, cacheRead: 0.075 },
      'Z AI',
      { '5h': 3, 'weekly': 6, 'monthly': 10 }
    )
    expect(result?.perMonth).toBe(2360)
  })
})

describe('computeRowEstimates', () => {
  const row = {
    rates: { inputCost: 0.15, outputCost: 0.6, cacheReadCost: 0.003 },
    shape: { inputTokens: 800, outputTokens: 200, cacheReadTokens: 50000 },
    timeOfDay: null
  }
  const fractions = { fiveHour: 0.2, weekly: 0.5 }

  it('reproduces the published GOAT numbers from the row itself', () => {
    expect(computeRowEstimates(60, row, 'DeepSeek', fractions)).toEqual({ perMonth: 154000, per5h: 30800, perWeek: 76900 })
  })

  it('honors per-row shape overrides (GLM-5.2 Fast uses 150 output tokens)', () => {
    const fast = { ...row, shape: { inputTokens: 800, outputTokens: 150, cacheReadTokens: 50000 } }
    const result = computeRowEstimates(20, fast, null, fractions)
    const cost = 800 / 1e6 * 0.15 + 150 / 1e6 * 0.6 + 50000 / 1e6 * 0.003
    expect(result?.perMonth).toBe(round3(20 / cost))
  })

  it('prices off-peak rates once the schedule is live', () => {
    const timed = {
      ...row,
      timeOfDay: {
        effective: '2020-01-01T00:00:00Z',
        offPeak: { inputCost: 0.1, outputCost: 0.4, cacheReadCost: 0.002 }
      }
    }
    const live = computeRowEstimates(60, timed, 'DeepSeek', fractions, Date.parse('2026-09-19T00:00:00Z'))
    const future = computeRowEstimates(60, { ...timed, timeOfDay: { ...timed.timeOfDay, effective: '2030-01-01T00:00:00Z' } }, 'DeepSeek', fractions, Date.parse('2026-09-19T00:00:00Z'))
    expect(live?.perMonth).toBeGreaterThan(future?.perMonth ?? 0)
  })

  it('resolves off-peak rates directly', () => {
    expect(resolveRowRates(row, Date.now())).toEqual({ input: 0.15, output: 0.6, cacheRead: 0.003 })
    expect(resolveRowShape(row, 'DeepSeek')).toEqual({ input: 800, output: 200, cache: 50000 })
  })
})

describe('computeEstimates', () => {
  it('reproduces the published GOAT numbers for DeepSeek V4.1 Flash', () => {
    // Synced 2026-09-10: $60 allowance, off-peak $0.15/$0.60/$0.003,
    // published 30800/76900/154000, GOAT limits 14/35/70.
    const result = computeEstimates(
      60,
      { input: 0.15, output: 0.6, cacheRead: 0.003 },
      'DeepSeek',
      { '5h': 14, 'weekly': 35, 'monthly': 70 }
    )
    expect(result).toEqual({ perMonth: 154000, per5h: 30800, perWeek: 76900 })
  })

  it('scales 5h/week windows by plan-limit ratios', () => {
    // Go plan limits 3/6/10: ratios 0.3/0.6 instead of GOAT 0.2/0.5.
    const result = computeEstimates(
      10,
      { input: 0.15, output: 0.6, cacheRead: 0.003 },
      'DeepSeek',
      { '5h': 3, 'weekly': 6, 'monthly': 10 }
    )
    expect(result?.perMonth).toBe(round3(10 / 0.00039))
    expect(result?.per5h).toBe(round3((10 / 0.00039) * 0.3))
    expect(result?.perWeek).toBe(round3((10 / 0.00039) * 0.6))
  })

  it('returns null for zero cost or zero budget', () => {
    expect(computeEstimates(0, { input: 0.15, output: 0.6, cacheRead: 0.003 }, 'DeepSeek', { '5h': 14, 'weekly': 35, 'monthly': 70 })).toBeNull()
    expect(computeEstimates(60, { input: 0, output: 0, cacheRead: 0 }, 'DeepSeek', { '5h': 14, 'weekly': 35, 'monthly': 70 })).toBeNull()
  })
})
