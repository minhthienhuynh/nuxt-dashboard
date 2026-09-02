import type { PricingEntry } from '../types'

const PRICING_PROVIDER_ID = 'command-code'
const INPUT_TOKENS = 800
const CACHE_READ_TOKENS = 50000
const DEFAULT_OUTPUT_TOKENS = 200

type EffectivePricing = Pick<PricingEntry, 'input' | 'output' | 'cache_read'>

// Effective price overrides for time-limited deals; formula uses these instead of the model's listed input price.
// Keep in sync with deals in ../../server/api/deals.ts (same models, discounted per-token rates).
const DEAL_EFFECTIVE_PRICING: Record<string, EffectivePricing> = {
  'google/gemini-3.7-flash': { input: 0.75, output: 3.75, cache_read: 0.075 },
  'xiaomi/mimo-v2.5': { input: 0.14, output: 0.28, cache_read: 0.0028 },
  'xiaomi/mimo-v2.5-pro': { input: 0.435, output: 0.87, cache_read: 0.0036 },
  'minimaxai/minimax-m3': { input: 0.30, output: 1.20, cache_read: 0.06 }
}

// Assumed output-token count per model family for the effective-cost formula; models not listed use DEFAULT_OUTPUT_TOKENS.
const OUTPUT_TOKENS_BY_MODEL: Record<string, number> = {
  'zai-org/glm-5.3': 150,
  'zai-org/glm-5.2': 150,
  'zai-org/glm-5.2-fast': 150,
  'zai-org/glm-5.1': 150,
  'zai-org/glm-5': 150,
  'minimaxai/minimax-m3': 125,
  'minimaxai/minimax-m2.7': 125,
  'minimaxai/minimax-m2.5': 125,
  'gpt-5.6-luna': 160
}

export function buildPricingIndex(pricing: PricingEntry[]): Map<string, PricingEntry> {
  const index = new Map<string, PricingEntry>()
  for (const entry of pricing) {
    if (entry.provider_id !== PRICING_PROVIDER_ID) continue
    if (!index.has(entry.model_id)) index.set(entry.model_id, entry)
  }
  return index
}

export function getEffectivePricing(modelId: string, pricingIndex: Map<string, PricingEntry>): EffectivePricing | null {
  return DEAL_EFFECTIVE_PRICING[modelId] ?? pricingIndex.get(modelId) ?? null
}

/** Estimated $/month for a fixed usage profile: 800 input tokens, family-specific output tokens, 50K cache-read tokens. */
export function effectiveCost(modelId: string, pricingIndex: Map<string, PricingEntry>): number | null {
  const pricing = getEffectivePricing(modelId, pricingIndex)
  if (!pricing) return null
  const outputTokens = OUTPUT_TOKENS_BY_MODEL[modelId] ?? DEFAULT_OUTPUT_TOKENS
  return (pricing.input * INPUT_TOKENS + pricing.output * outputTokens + pricing.cache_read * CACHE_READ_TOKENS) / 1e6
}

export function usePlanComparisonPricing(pricing: PricingEntry[]) {
  const pricingIndex = buildPricingIndex(pricing)

  return {
    getPricing: (modelId: string) => pricingIndex.get(modelId) ?? null,
    getEffectivePricing: (modelId: string) => getEffectivePricing(modelId, pricingIndex),
    effectiveCost: (modelId: string) => effectiveCost(modelId, pricingIndex)
  }
}
