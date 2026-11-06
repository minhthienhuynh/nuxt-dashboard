import { describe, expect, it } from 'vitest'
import { plans } from './plans'

/**
 * The cards are the only place a reader sees a plan's headline numbers, so the
 * published values are pinned here. Sources (verified 2026-11-06):
 * - Command Code docs/plans/go + docs/plans/goat + commandcode.ai/pricing
 * - opencode.ai/docs/console/go ("5-hour — 20% of the monthly limit; weekly — 50%")
 * - go.open-design.ai "Plan allowances" (Go: $220, $55/7d, $18/5h)
 */
describe('plans - published card values', () => {
  const byId = (id: string) => plans.find(plan => plan.id === id)

  it('prices and credits every plan as published', () => {
    expect(byId('cmd-go')).toMatchObject({ monthly_price_usd: 1, monthly_credit_usd: 10 })
    // "Your $10 buys up to $100 of credits" — not the $70 allowance of one model.
    expect(byId('cmd-goat')).toMatchObject({ monthly_price_usd: 10, monthly_credit_usd: 100 })
    expect(byId('oc-go')).toMatchObject({ monthly_price_usd: 10, monthly_credit_usd: 100, credit_is_per_model: true })
    expect(byId('od-go')).toMatchObject({ monthly_price_usd: 10, monthly_credit_usd: 220, funding: 'pool' })
  })

  it('carries the published rolling windows', () => {
    expect(byId('cmd-go')?.limits).toEqual({ '5h': 3, 'weekly': 6, 'monthly': 10 })
    expect(byId('cmd-goat')?.limits).toEqual({ '5h': 20, 'weekly': 50, 'monthly': 100 })
    expect(byId('od-go')?.limits).toEqual({ '5h': 18, 'weekly': 55, 'monthly': 220 })
    expect(byId('od-go')?.weekly_window_days).toBe(7)
  })

  it('keeps OpenCode Go windows as shares of each model limit', () => {
    expect(byId('oc-go')?.limits_percent).toEqual({ '5h': 20, 'weekly': 50, 'monthly': 100 })
  })
})
