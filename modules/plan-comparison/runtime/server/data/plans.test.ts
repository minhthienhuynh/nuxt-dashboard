import { describe, expect, it } from 'vitest'
import { plans } from './plans'

/**
 * The cards are the only place a reader sees a plan's headline numbers, so the
 * published values are pinned here. Sources (verified 2026-11-06):
 * - Command Code docs/plans/go + docs/plans/goat + commandcode.ai/pricing
 * - opencode.ai/docs/console/go ("5-hour — 20% of the monthly limit; weekly — 50%")
 * - go.open-design.ai "Plan allowances" (Go: $220, $55/7d, $18/5h)
 * - tokenharbor.ai/docs/billing/subscription (Office Pass $9.99/mo, $35 per
 *   four-week cycle divided into four 7-day windows)
 */
describe('plans - published card values', () => {
  const byId = (id: string) => plans.find(plan => plan.id === id)

  it('prices and credits every plan as published', () => {
    expect(byId('cmd-go')).toMatchObject({ monthly_price_usd: 1, monthly_credit_usd: 10 })
    // "Your $10 buys up to $100 of credits" — not the $70 allowance of one model.
    expect(byId('cmd-goat')).toMatchObject({ monthly_price_usd: 10, monthly_credit_usd: 100 })
    // One shared $60 pool: OpenCode weights each request by `60 ÷ model monthly
    // limit`, so the docs table's $15–$100 column is the per-model allocation,
    // not a plan price.
    expect(byId('oc-go')).toMatchObject({ monthly_price_usd: 10, monthly_credit_usd: 60 })
    // $60 pool, not the $220 headline: every usage row on the vendor's table is
    // `60 ÷ multiplier`, so $220 is the largest allocation (Eco at 0.27×) — the
    // same shape as OpenCode Go's $100 column under a $60 cap.
    expect(byId('od-go')).toMatchObject({ monthly_price_usd: 10, monthly_credit_usd: 60 })
    // Agent Pass: $1.99 standard renewal ($0.99 is the first-month promo, not
    // stored) and one shared $10 allowance every eligible model drains.
    expect(byId('th-agent')).toMatchObject({ monthly_price_usd: 1.99, monthly_credit_usd: 10 })
    // Office Pass: flat price ("cost the same amount every month, including
    // the first") and one shared $35 allowance.
    expect(byId('th-office')).toMatchObject({ monthly_price_usd: 9.99, monthly_credit_usd: 35 })
  })

  it('carries the published rolling windows', () => {
    expect(byId('cmd-go')?.limits).toEqual({ '5h': 3, 'weekly': 6, 'monthly': 10 })
    expect(byId('cmd-goat')?.limits).toEqual({ '5h': 20, 'weekly': 50, 'monthly': 100 })
    // The table's $18/5h and $55/7d are quoted against the $220 allocation —
    // 8.2% and 25% of it — so on the $60 pool they are $4.91 and $15.
    expect(byId('od-go')?.limits).toEqual({ '5h': 4.91, 'weekly': 15, 'monthly': 60 })
    expect(byId('od-go')?.weekly_window_days).toBe(7)
    // "divided into four 7-day windows" → $2.50 of the $10 per week; the pass
    // publishes no 5-hour window, so it stays null rather than invented.
    expect(byId('th-agent')?.limits).toEqual({ '5h': null, 'weekly': 2.5, 'monthly': 10 })
    expect(byId('th-agent')?.weekly_window_days).toBe(7)
    // Same four-week cycle → $8.75 of the $35 per week; no 5-hour window.
    expect(byId('th-office')?.limits).toEqual({ '5h': null, 'weekly': 8.75, 'monthly': 35 })
    expect(byId('th-office')?.weekly_window_days).toBe(7)
  })

  it('keeps OpenCode Go windows as shares of each model limit', () => {
    expect(byId('oc-go')?.limits_percent).toEqual({ '5h': 20, 'weekly': 50, 'monthly': 100 })
  })
})

/**
 * Every plan in the comparison sells ONE shared pool with per-model allocations,
 * which is why there is no `funding` flag left to get wrong. Verified against
 * each vendor 2026-11-10; the evidence lives next to each plan in plans.ts.
 */
describe('plans - one shared pool each', () => {
  const byId = (id: string) => plans.find(plan => plan.id === id)

  it('states the pool as the plan credit on every plan', () => {
    // Command Code Go: "one shared pool with a monthly usage on every model".
    // GOAT: "your $10 buys up to $100 of credits" — the Go doc calls Go "the
    // same structure GOAT plan subscribers get, scaled to a $10 pool".
    // OpenDesign: "credit allocation — shared pool". Token Harbor: one "included
    // usage" allowance + Model Boost. OpenCode: one subscription-wide limit with
    // a per-request `60 ÷ monthly limit` weight.
    const pools = Object.fromEntries(plans.map(plan => [plan.id, plan.monthly_credit_usd]))
    expect(pools).toEqual({
      'cmd-go': 10,
      'cmd-goat': 100,
      'oc-go': 60,
      'od-go': 60,
      'th-agent': 10,
      'th-office': 35
    })
  })

  it('expresses OpenCode windows in the shared pool dollars', () => {
    // "5-hour — 20% of the monthly limit; weekly — 50%; monthly — 100%" of $60.
    expect(byId('oc-go')?.limits).toEqual({ '5h': 12, 'weekly': 30, 'monthly': 60 })
    expect(byId('oc-go')?.limits_percent).toEqual({ '5h': 20, 'weekly': 50, 'monthly': 100 })
  })
})
