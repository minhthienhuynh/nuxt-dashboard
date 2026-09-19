export interface Provider {
  id: string
  name: string
}

export interface PlanLimits {
  '5h': number
  'weekly': number
  'monthly': number
}

export interface Plan {
  id: string
  provider_id: string
  name: string
  monthly_price_usd: number
  monthly_credit_usd: number
  has_api_access: boolean
  limits: PlanLimits
  weekly_window_days?: number
  first_month_usd?: number
}

export interface ModelTierRates {
  input: number | null
  output: number | null
  cacheRead: number | null
  cacheWrite: number | null
}

export interface ModelTier {
  rates: ModelTierRates
}

export interface ModelDeal {
  starts?: string | null
  expires?: string | null
  free?: boolean | null
}

export interface ModelCaps {
  text?: boolean | null
  vision?: boolean | null
  reasoning?: boolean | null
}

export interface ModelTimeOfDay {
  offPeak?: Partial<ModelTierRates> | null
  effective?: string | null
}

// Model mirrors the Command Code docs script item (`docs/plans/goat`
// Next.js Flight `"models"` array). OpenCode Go rows crawled from HTML
// tables are mapped into this same shape; fields the HTML has no source
// for stay null.
export interface Model {
  id: string
  slug: string
  name: string
  vendor: string | null
  category: string | null
  contextWindow: number | null
  reasoning: boolean | null
  vision: boolean | null
  inputCost: number | null
  outputCost: number | null
  cacheReadCost: number | null
  cacheWriteCost: number | null
  tiers: ModelTier[]
  minPlanName: string | null
  deal: ModelDeal | null
  caps: ModelCaps
  intelligenceIndex: number | null
  codingIndex: number | null
  outputTokensPerSec: number | null
  releaseDate: string | null
  launchedAt: string | null
  timeOfDay: ModelTimeOfDay | null
}

export interface PricingEntry {
  provider_id: string
  model_id: string
  tier: string
  peak_utc_hours: string | null
  input: number
  output: number
  cache_read: number
  cache_write: number | null
}

export interface PlanModelEstimateValues {
  per_5h: number
  per_week: number
  per_month: number
}

export interface PlanModelEstimate {
  plan_id: string
  model_id: string
  monthly_credits_usd: number
  estimates: PlanModelEstimateValues | null
  note?: string
  sourceUrl?: string
  fetchedAt?: string
}

export interface PlanComparisonDatabase {
  providers: Provider[]
  plans: Plan[]
  models: Model[]
  pricing: PricingEntry[]
  plan_models: PlanModelEstimate[]
}

export interface PlanComparisonPayload {
  database: PlanComparisonDatabase
  fetchedAt: string
  rolledBack: boolean
}

export interface PlanCacheMeta {
  fetchedAt: string
  version: number
}
