import type { Plan } from '../../app/types'

export const plans: Plan[] = [
  {
    id: 'cmd-go',
    provider_id: 'command-code',
    name: 'Go Plan',
    monthly_price_usd: 1,
    monthly_credit_usd: 10,
    // docs/plans/go says "$3 / $6 / $10 of usage"; the pricing-limits table
    // lists "$2 / $5" for the same windows. The plan page is authoritative for
    // its own plan, so these follow it (verified 2026-11-06).
    has_api_access: false,
    limits: {
      '5h': 3,
      'weekly': 6,
      'monthly': 10
    }
  },
  {
    id: 'cmd-goat',
    provider_id: 'command-code',
    name: 'GOAT Plan',
    monthly_price_usd: 10,
    // "Your $10 buys up to $100 of credits" (docs/plans/goat intro) and the
    // usage-limits block says "Monthly limit - up to $100 of usage", which the
    // pricing-limits table repeats ("GOAT | $10 | Up to $100 of usage"). The
    // per-model allowances in the same doc table run $10-$100, so $70 is one
    // model's allowance (GLM-5.2 / Tencent Hy3 / Qwen 3.8 27B), not the plan's.
    monthly_credit_usd: 100,
    has_api_access: true,
    // Published as dollar usage windows ("5-hour up to $20 / weekly up to $50 /
    // monthly up to $100", docs/plans/goat + pricing-limits). The ratios
    // (0.2 / 0.5) are what the estimate math consumes, so storing the published
    // dollars keeps the card truthful without moving any request count.
    limits: {
      '5h': 20,
      'weekly': 50,
      'monthly': 100
    },
    weekly_window_days: 7
  },
  {
    id: 'oc-go',
    provider_id: 'opencode',
    name: 'OpenCode Go',
    monthly_price_usd: 10,
    // OpenCode publishes no plan-wide pool: each model carries its own monthly
    // limit (docs table: GLM-5.3-Flash $60, Kimi K3 $15, MiniMax M3.1 $20,
    // Qwen3.8 Flash $30, DeepSeek V4.1 Flash $100), so the headline is the
    // largest of them and the card labels it "max per model".
    monthly_credit_usd: 100,
    has_api_access: true,
    credit_is_per_model: true,
    // Windows are shares of each model's own limit: "5-hour — 20% of the
    // monthly limit; weekly — 50%; monthly — 100%" (opencode.ai/docs/console/
    // go/). A $15 model therefore gets $3 / $7.50. `limits` keeps the
    // pool-equivalent dollars (the estimate math's fallback for a model with no
    // parsed limit); the card renders the percentages.
    limits: {
      '5h': 20,
      'weekly': 50,
      'monthly': 100
    },
    limits_percent: {
      '5h': 20,
      'weekly': 50,
      'monthly': 100
    }
  },
  {
    id: 'od-go',
    provider_id: 'open-design',
    name: 'OpenDesign Go',
    // List price $10/mo. The page also shows a first-month price ($8) and a
    // yearly equivalent ($7/mo, $84/yr) — promo-shaped numbers, not stored.
    monthly_price_usd: 10,
    // "Total monthly credits, up to $220": one shared Coding Plan pool, not a
    // per-model grant (pricing page settings: design 220, pool 0).
    monthly_credit_usd: 220,
    has_api_access: true,
    funding: 'pool',
    // Published in the pricing page's "Plan allowances" table: coding credits
    // $220/month with a $55 per 7-day and $18 per 5-hour window (the windows
    // apply to Coding Plan credits only). The crawl reads the same table live
    // and falls back to these numbers.
    limits: {
      '5h': 18,
      'weekly': 55,
      'monthly': 220
    },
    weekly_window_days: 7
  },
  {
    id: 'th-agent',
    provider_id: 'tokenharbor',
    name: 'Agent Pass',
    // Standard renewal price. The pass is also sold at $0.99 for the first
    // month and yearly — promo-shaped numbers, not stored (same rule as
    // OpenDesign's first-month price).
    monthly_price_usd: 1.99,
    // One shared allowance: "Agent Pass includes $10 of usage value" spent
    // across every eligible model, so every row carries the pool ("if this
    // model used all of it"). A boosted model stretches it (see the crawl:
    // credit = pool × Model Boost, up to $20).
    monthly_credit_usd: 10,
    has_api_access: true,
    funding: 'pool',
    // "Each Pass allowance covers a four-week cycle and is divided into four
    // 7-day windows: each 7-day window contains one quarter of the four-week
    // allowance." So the weekly window is $2.50 of the $10; the pass publishes
    // no 5-hour window at all (null renders `—` instead of an invented cap).
    limits: {
      '5h': null,
      'weekly': 2.5,
      'monthly': 10
    },
    weekly_window_days: 7
  }
]
