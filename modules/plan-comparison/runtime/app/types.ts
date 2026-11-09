export interface Provider {
  id: string
  name: string
}

/**
 * Rolling windows in dollars. `null` means the plan does not publish that
 * window: gateway plans (OpenDesign Go) sell one shared monthly pool and
 * publish no 5-hour or weekly cap, so the card renders `—` rather than a
 * number nobody published.
 */
export interface PlanLimits {
  '5h': number | null
  'weekly': number | null
  'monthly': number
}

/**
 * `per_model` = every model carries its own monthly credit (Command Code,
 * OpenCode Go). `pool` = the plan funds one shared credit pool that any
 * eligible model can drain, so a row's `monthly_credits_usd` is not a grant:
 * it is the usage value that pool funds on that model — the vendor's published
 * monthly-usage figure where they publish one (OpenDesign), else the pool
 * scaled by the model's rate (`pool × Model Boost` on Token Harbor, or
 * `pool ÷ credit multiplier` as the fallback). One pool, many per-model values.
 */
export type PlanFundingKind = 'per_model' | 'pool'

/**
 * Plans that publish rolling windows as a share of each model's own monthly
 * limit (OpenCode Go: "5-hour — 20% of the monthly limit; weekly — 50%;
 * monthly — 100%") carry the fractions here. `limits` then holds the
 * pool-equivalent dollars the estimate math derives from those fractions.
 */
export interface PlanLimitsPercent {
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
  limits_percent?: PlanLimitsPercent
  weekly_window_days?: number
  /** Defaults to `per_model` when absent. */
  funding?: PlanFundingKind
  /**
   * The plan sells per-model monthly limits only (no plan-wide pool), so
   * `monthly_credit_usd` is the largest of them and the card must say so.
   * OpenCode Go: $15–$100 per model, no shared pool.
   */
  credit_is_per_model?: boolean
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
  /** Null when the plan publishes no 5-hour window (see `PlanLimits`). */
  per_5h: number | null
  /** Null when the plan publishes no weekly window (see `PlanLimits`). */
  per_week: number | null
  per_month: number
}

export interface PlanModelEstimate {
  plan_id: string
  model_id: string
  /**
   * What this model gets per month on this plan. `per_model` plans: the
   * published per-model credit (Command Code `$20`, OpenCode Go `$15–$100`).
   * `pool` plans: the usage value the shared pool funds here — OpenDesign's
   * published "Monthly usage" cell ($60/$120/$220 …), Token Harbor's
   * `pool × Model Boost`. Never the pool itself, and never a per-model grant.
   */
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
