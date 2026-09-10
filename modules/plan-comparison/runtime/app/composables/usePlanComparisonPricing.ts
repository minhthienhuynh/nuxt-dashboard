import type { PricingEntry } from '../types'

// Price sort reads the same number the Command Code plan tables show in their
// "Input" column ($ per 1M tokens): the cheapest context tier, or the list price
// for models that are on a deal.
const PRICING_PROVIDER_ID = 'command-code'

/** First `command-code` entry per model — the one the plan tables' "Input" column quotes. */
export function buildPricingIndex(pricing: PricingEntry[]): Map<string, PricingEntry> {
  const index = new Map<string, PricingEntry>()
  for (const entry of pricing) {
    if (entry.provider_id !== PRICING_PROVIDER_ID) continue
    if (!index.has(entry.model_id)) index.set(entry.model_id, entry)
  }
  return index
}

/** Listed input price ($ per 1M tokens), or null when the model has no published rate. */
export function inputPrice(modelId: string, pricingIndex: Map<string, PricingEntry>): number | null {
  return pricingIndex.get(modelId)?.input ?? null
}
