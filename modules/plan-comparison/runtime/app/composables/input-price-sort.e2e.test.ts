import { describe, expect, it } from 'vitest'
import { pricing } from '../../server/api/pricing'
import { models } from '../../server/api/models'
import { buildPricingIndex, inputPrice } from './usePlanComparisonPricing'
import { sortRows } from './usePlanComparisonSort'
import type { SortableModelRow } from './usePlanComparisonSort'
import type { Model } from '../types'

// The row shape `normalizePlanComparisonDatabase` produces for the sort.
type Row = SortableModelRow & { id: string }

// The "cheapest" sort must quote the same number the Command Code plan tables
// show in their "Input" column, so the two agree when compared side by side.
describe('cheapest sort with the real dataset', () => {
  const index = buildPricingIndex(pricing)
  const rows: Row[] = models.map((m: Model) => ({
    id: m.id,
    name: m.name,
    release: m.release_date ? Date.parse(m.release_date) : null,
    context: m.context_tokens,
    aa: m.aa,
    tps: m.tok_per_sec,
    inputPrice: inputPrice(m.id, index)
  }))

  it('quotes qwen3.7-flash at $0.03, the tier the plan table lists', () => {
    expect(inputPrice('qwen/qwen3.7-flash', index)).toBe(0.03)
  })

  it('quotes the list price for a model that is on a deal', () => {
    // MiMo V2.5's table row shows $0.80 struck through, then $0.14.
    expect(inputPrice('xiaomi/mimo-v2.5', index)).toBe(0.8)
  })

  it('orders strictly non-decreasing by input price, models without a price last', () => {
    const sorted = sortRows(rows, 'cheapest')
    const prices = sorted.map((r: Row) => r.inputPrice)
    const firstNull = prices.findIndex((p: number | null) => p === null)
    const head = firstNull === -1 ? prices : prices.slice(0, firstNull)
    for (let i = 1; i < head.length; i++) {
      expect(head[i] as number).toBeGreaterThanOrEqual(head[i - 1] as number)
    }
    if (firstNull !== -1) {
      expect(prices.slice(firstNull).every((p: number | null) => p === null)).toBe(true)
    }
  })

  it('puts the priciest priced model first under "priciest"', () => {
    const asc = sortRows(rows, 'cheapest')
    const desc = sortRows(rows, 'priciest')
    const lastPriced = [...asc].reverse().find((r: Row) => r.inputPrice !== null)!
    expect(desc[0]!.id).toBe(lastPriced.id)
  })
})
