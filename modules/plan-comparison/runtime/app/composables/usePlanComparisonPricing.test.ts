import { describe, expect, it } from 'vitest'
import { buildPricingIndex, effectiveCost } from './usePlanComparisonPricing'
import type { PricingEntry } from '../types'

const pricing: PricingEntry[] = [
  {
    provider_id: 'command-code',
    model_id: 'xiaomi/mimo-v2.5',
    tier: 'standard',
    max_context_tokens: null,
    peak_utc_hours: null,
    input: 0.8,
    output: 4,
    cache_read: 0.16,
    cache_write: null
  },
  {
    provider_id: 'command-code',
    model_id: 'google/gemini-3.7-flash',
    tier: 'standard',
    max_context_tokens: null,
    peak_utc_hours: null,
    input: 1.5,
    output: 7.5,
    cache_read: 0.15,
    cache_write: 0.08334
  },
  {
    provider_id: 'command-code',
    model_id: 'tencent/hy3-paid',
    tier: 'standard',
    max_context_tokens: null,
    peak_utc_hours: null,
    input: 0.14,
    output: 0.58,
    cache_read: 0.035,
    cache_write: null
  },
  {
    provider_id: 'command-code',
    model_id: 'zai-org/glm-5.3',
    tier: 'standard',
    max_context_tokens: null,
    peak_utc_hours: null,
    input: 1.4,
    output: 4.4,
    cache_read: 0.26,
    cache_write: null
  }
]

describe('effectiveCost', () => {
  const pricingIndex = buildPricingIndex(pricing)

  it('uses the deal-effective override price for an overridden model', () => {
    expect(effectiveCost('xiaomi/mimo-v2.5', pricingIndex)).toBeCloseTo(0.000308, 6)
  })

  it('falls back to the listed price when the deal expires (gemini 3.7 flash)', () => {
    expect(effectiveCost('google/gemini-3.7-flash', pricingIndex)).toBeCloseTo(0.0102, 6)
  })

  it('uses the listed price and default output tokens for a non-overridden model', () => {
    expect(effectiveCost('tencent/hy3-paid', pricingIndex)).toBeCloseTo(0.001978, 6)
  })

  it('uses the family-specific output token count when applicable', () => {
    expect(effectiveCost('zai-org/glm-5.3', pricingIndex)).toBeCloseTo(0.01478, 5)
  })

  it('returns null when no pricing is available', () => {
    expect(effectiveCost('unknown/model', pricingIndex)).toBeNull()
  })
})
