import { z } from 'zod'

const nullableNumber = z.number().nullable()
const nullableString = z.string().nullable()
const nullableFlag = z.boolean().nullable()

const tierRatesSchema = z.object({
  input: nullableNumber,
  output: nullableNumber,
  cacheRead: nullableNumber,
  cacheWrite: nullableNumber
})

export const crawledModelSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  vendor: nullableString,
  category: nullableString,
  contextWindow: nullableNumber,
  reasoning: nullableFlag,
  vision: nullableFlag,
  inputCost: nullableNumber,
  outputCost: nullableNumber,
  cacheReadCost: nullableNumber,
  cacheWriteCost: nullableNumber,
  tiers: z.array(z.object({ rates: tierRatesSchema })),
  minPlanName: nullableString,
  deal: z.object({
    starts: nullableString.optional(),
    expires: nullableString.optional(),
    free: nullableFlag.optional()
  }).nullable(),
  caps: z.object({
    text: nullableFlag.optional(),
    vision: nullableFlag.optional(),
    reasoning: nullableFlag.optional()
  }),
  intelligenceIndex: nullableNumber,
  codingIndex: nullableNumber,
  outputTokensPerSec: nullableNumber,
  releaseDate: nullableString,
  launchedAt: nullableString,
  timeOfDay: z.object({
    offPeak: z.object({
      input: nullableNumber.optional(),
      output: nullableNumber.optional(),
      cacheRead: nullableNumber.optional(),
      cacheWrite: nullableNumber.optional()
    }).nullable(),
    effective: nullableString.optional()
  }).nullable()
})

export const crawledPricingSchema = z.object({
  provider_id: z.string(),
  model_id: z.string(),
  tier: z.string(),
  peak_utc_hours: nullableString,
  input: z.number(),
  output: z.number(),
  cache_read: z.number(),
  cache_write: nullableNumber
})

export const crawledPlanModelSchema = z.object({
  plan_id: z.string(),
  model_id: z.string(),
  monthly_credits_usd: z.number(),
  estimates: z.object({
    per_5h: z.number(),
    per_week: z.number(),
    per_month: z.number()
  }).nullable(),
  sourceUrl: z.string().optional(),
  fetchedAt: z.string().optional()
})

export const crawledDatabaseSchema = z.object({
  models: z.array(crawledModelSchema),
  pricing: z.array(crawledPricingSchema),
  plan_models: z.array(crawledPlanModelSchema)
})
