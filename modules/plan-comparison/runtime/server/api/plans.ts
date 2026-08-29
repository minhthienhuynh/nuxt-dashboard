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
    name: 'GOAT Plan',
    monthly_price_usd: 10,
    monthly_credit_usd: 70,
    has_api_access: true,
    limits: {
      '5h': 14,
      'weekly': 35,
      'monthly': 70
    },
    weekly_window_days: 7
  },
  {
    id: 'oc-go',
    provider_id: 'opencode',
    name: 'OpenCode Go',
    monthly_price_usd: 10,
    first_month_usd: 5,
    monthly_credit_usd: 60,
    has_api_access: true,
    limits: {
      '5h': 12,
      'weekly': 30,
      'monthly': 60
    }
  }
]
