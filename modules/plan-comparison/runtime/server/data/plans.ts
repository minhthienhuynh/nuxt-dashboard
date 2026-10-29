import type { Plan } from '../../app/types'

export const plans: Plan[] = [
  {
    id: 'cmd-go',
    provider_id: 'command-code',
    name: 'Go Plan',
    monthly_price_usd: 1,
    monthly_credit_usd: 10,
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
    name: 'Cmd GOAT Plan',
    monthly_price_usd: 10,
    monthly_credit_usd: 70,
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
    monthly_credit_usd: 60,
    has_api_access: true,
    // OpenCode sizes the windows per model, not per plan: "5-hour — 20% of the
    // monthly limit; weekly — 50%; monthly — 100%" (opencode.ai/v2/docs/
    // console/go/). A model with a $15 limit therefore gets $3 / $7.50, not
    // the $12 / $30 the $60 pool would imply. `limits` keeps the pool-equivalent
    // dollars (the estimate math's fallback); the card renders the percentages.
    limits: {
      '5h': 12,
      'weekly': 30,
      'monthly': 60
    },
    limits_percent: {
      '5h': 20,
      'weekly': 50,
      'monthly': 100
    }
  }
]
