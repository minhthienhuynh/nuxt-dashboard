import { describe, expect, it } from 'vitest'
import { buildPricingIndex, inputPrice } from './usePlanComparisonPricing'
import type { PricingEntry } from '../types'

const pricing: PricingEntry[] = [
  {
    provider_id: 'command-code',
    model_id: 'xiaomi/mimo-v2.5',
    tier: 'standard',
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
    peak_utc_hours: null,
    input: 1.5,
    output: 7.5,
    cache_read: 0.15,
    cache_write: null
  },
  {
    // Tiered model: the first entry is the cheapest tier, which is what the
    // Command Code "Input" column quotes, so the sort must use this one.
    provider_id: 'command-code',
    model_id: 'qwen/qwen3.7-flash',
    tier: 'standard',
    peak_utc_hours: null,
    input: 0.03,
    output: 0.13,
    cache_read: 0.006,
    cache_write: null
  },
  {
    // Same model on another provider — must not shadow the command-code entry.
    provider_id: 'opencode',
    model_id: 'xiaomi/mimo-v2.5',
    tier: 'standard',
    peak_utc_hours: null,
    input: 0.14,
    output: 0.28,
    cache_read: 0.0028,
    cache_write: null
  }
]

describe('inputPrice', () => {
  const pricingIndex = buildPricingIndex(pricing)

  it('returns the listed input price for a model', () => {
    expect(inputPrice('google/gemini-3.7-flash', pricingIndex)).toBe(1.5)
  })

  it('uses the command-code entry, not another provider with the same model id', () => {
    expect(inputPrice('xiaomi/mimo-v2.5', pricingIndex)).toBe(0.8)
  })

  it('quotes the first (cheapest) context tier, matching the plan table', () => {
    expect(inputPrice('qwen/qwen3.7-flash', pricingIndex)).toBe(0.03)
  })

  it('returns null when the model has no published price', () => {
    expect(inputPrice('unknown/model', pricingIndex)).toBeNull()
  })
})
