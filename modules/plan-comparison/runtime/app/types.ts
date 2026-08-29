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

export interface Model {
  id: string
  slug: string
  name: string
  context_tokens: number
  intelligence: number | null
  tok_per_sec: number | null
  open_weight: boolean | null
  release_date: string | null
  has_text: boolean
  has_vision: boolean
  has_reasoning: boolean | null
  best_for: string
  aa: number | null
}

export interface PricingEntry {
  provider_id: string
  model_id: string
  tier: string
  max_context_tokens: number | null
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
}

export interface Deal {
  provider_id: string
  model_id: string
  kind: string
  // percent_off is relative to the listed input price ($/1M); per-component discounts live in `note`.
  percent_off: number
  starts_at: string | null
  ends_at: string | null
  note: string
}

export interface PlanComparisonDatabase {
  providers: Provider[]
  plans: Plan[]
  models: Model[]
  pricing: PricingEntry[]
  plan_models: PlanModelEstimate[]
  deals: Deal[]
}
