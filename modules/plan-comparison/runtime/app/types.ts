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
 * Every plan in this comparison sells ONE shared pool, not a separate wallet per
 * model: Command Code ("one shared pool with a monthly usage on every model"),
 * OpenDesign ("credit allocation — shared pool"), Token Harbor (one "included
 * usage" allowance + Model Boost) and OpenCode Go (a single `{rolling, weekly,
 * monthly}` subscription limit, each request weighted by `60 / monthly limit` —
 * see plans.ts). So a plan row is never a grant: it is the usage value the pool
 * funds on that model, and there is no per-plan flag to branch on.
 */

/**
 * Every plan sizes its windows as a share of its own pool, so the card reads all
 * six in one unit: Command Code Go is $3/5h on a $10 pool (30%), GOAT $20 on
 * $100 (20%), OpenCode Go states 20/50/100 outright, OpenDesign $18 against its
 * $220 allocation (8.2%) and Token Harbor's weekly $2.50 of $10 (25%). A null
 * window means the plan publishes no such cap (Token Harbor sells one monthly
 * pool). `limits` keeps the dollars the estimate math needs.
 */
export interface PlanLimitsPercent {
  '5h': number | null
  'weekly': number | null
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
   * The usage value this plan's shared pool funds on this model — its
   * per-model allocation: Command Code's published credit allocation
   * ($6–$10 on Go, $10–$70 on GOAT), OpenDesign's "Monthly usage" cell
   * ($60/$120/$220 …), Token Harbor's `pool × Model Boost`, OpenCode Go's
   * published monthly limit ($15–$100, i.e. `60 ÷ multiplier`). Never the pool
   * itself, and never a separate per-model wallet.
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
