import type { Deal } from '../../app/types'

// Discounted per-token rates from these deals feed DEAL_EFFECTIVE_PRICING in
// ../../app/composables/usePlanComparisonPricing.ts — update both when syncing deals.

export const deals: Deal[] = [
  {
    provider_id: 'command-code',
    model_id: 'minimaxai/minimax-m3',
    kind: 'percent_off',
    percent_off: 50,
    starts_at: null,
    ends_at: null,
    note: '50% off / 2x usage; plan tables quote $0.30 / $1.20 / $0.06'
  },
  {
    provider_id: 'command-code',
    model_id: 'xiaomi/mimo-v2.5',
    kind: 'percent_off',
    percent_off: 83,
    starts_at: null,
    ends_at: null,
    note: 'Price cut; Command Code table: input 83% / output 93% / cache read 98% off (advertised "up to 98%"); plan tables quote $0.14 / $0.28 / $0.0028'
  },
  {
    provider_id: 'command-code',
    model_id: 'xiaomi/mimo-v2.5-pro',
    kind: 'percent_off',
    percent_off: 78,
    starts_at: null,
    ends_at: null,
    note: 'Price cut; Command Code table: input 78% / output 86% / cache read 99% off (advertised "up to 99%"); plan tables quote $0.435 / $0.87 / $0.0036'
  }
]
