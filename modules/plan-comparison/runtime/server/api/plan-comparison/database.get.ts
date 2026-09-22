import { BACKUP_PREFIX, DATA_KEY, META_KEY } from '../../utils/storageKeys'
import type { PlanBackup } from '../../utils/planBackup'
import { normalizeBackupKeys, sortBackupKeysNewestFirst } from '../../utils/planBackup'
import type { PlanComparisonDatabase, PlanComparisonPayload, PlanCacheMeta } from '../../../app/types'
import { buildDatabase } from '../../crawl/build'
import { SOURCE_URLS, extractFlightEstimates, extractFlightModels, fetchSources } from '../../crawl/sources'
import { parseGoatEstimates, parseGoatModels } from '../../crawl/goat'
import { parseGoPlanLimits, parsePricingLimits } from '../../crawl/ccpricing'
import { parseOpenCodeEndpoints, parseOpenCodeEstimates, parseOpenCodePricing } from '../../crawl/opencode'
import { crawledDatabaseSchema } from '../../crawl/schemas'
import { AA_MODEL_SLUGS, fetchAaScore, resolveAaScore } from '../../crawl/aa'
import { plans as staticPlans } from '../../data/plans'
import { providers as staticProviders } from '../../data/providers'

let inflight: Promise<PlanComparisonPayload> | null = null

/** Runs `fn` over `items` with at most `limit` concurrent workers. */
async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++]!
      await fn(item)
    }
  })
  await Promise.all(workers)
}

async function crawlFresh(): Promise<PlanComparisonPayload> {
  const fetchedAt = new Date().toISOString()
  const sources = await fetchSources()
  const goatModels = parseGoatModels(extractFlightModels(sources.goatHtml))
  // Fill missing intel scores from AA (CC leaves serving tiers / brand-new
  // models unscored). Generic resolution — no per-model curation; the curated
  // AA_MODEL_SLUGS overrides apply first for user-mandated proxies. Failures
  // leave the score null (AA has not scored the model).
  await mapWithConcurrency(
    goatModels.filter(model => model.intelligenceIndex == null),
    3,
    async (model) => {
      const override = AA_MODEL_SLUGS[model.id]
      const score = override
        ? await fetchAaScore(override.slug, override.label)
        : await resolveAaScore(model)
      if (score != null) model.intelligenceIndex = score
    }
  )
  const goatEstimates = parseGoatEstimates(extractFlightEstimates(sources.goatHtml))
  const pricingSections = parsePricingLimits(sources.pricingLimitsHtml)
  const goLimits = parseGoPlanLimits(sources.goHtml)
  const ocPricing = parseOpenCodePricing(sources.openCodeGoHtml)
  const ocEstimates = parseOpenCodeEstimates(sources.openCodeGoHtml)
  const ocEndpoints = parseOpenCodeEndpoints(sources.openCodeGoHtml)
  const built = buildDatabase({
    goatModels,
    goatEstimates: goatEstimates.rows,
    goatFractions: { fiveHour: goatEstimates.fiveHourFraction, weekly: goatEstimates.weeklyFraction },
    pricingSections,
    goCreditsUsd: goLimits?.creditsUsd ?? null,
    openCodePricing: ocPricing,
    openCodeEstimates: ocEstimates,
    openCodeEndpoints: ocEndpoints,
    fetchedAt,
    sourceUrls: {
      goat: SOURCE_URLS.goat,
      go: SOURCE_URLS.go,
      pricingLimits: SOURCE_URLS.pricingLimits,
      openCodeGo: SOURCE_URLS.openCodeGo
    }
  })
  const validated = crawledDatabaseSchema.safeParse(built)
  if (!validated.success) throw new Error('Crawled database failed validation')
  const database: PlanComparisonDatabase = {
    providers: staticProviders,
    plans: staticPlans,
    models: validated.data.models,
    pricing: validated.data.pricing,
    plan_models: validated.data.plan_models
  }
  const storage = useStorage('plan-comparison')
  const previousMeta = await storage.getItem<PlanCacheMeta>(META_KEY)
  const version = (previousMeta?.version ?? 0) + 1
  await Promise.all([
    storage.setItem(DATA_KEY, database),
    storage.setItem(META_KEY, { fetchedAt, version } satisfies PlanCacheMeta)
  ])
  return { database, fetchedAt, rolledBack: false }
}

// No TTL: cached data is served as-is until the user manually refreshes
// (DELETE /api/plan-comparison/cache, then the next GET recrawls).
// A failed recrawl with empty cache rolls back the newest backup.
export default defineEventHandler(async (event): Promise<PlanComparisonPayload> => {
  const storage = useStorage('plan-comparison')
  const [cached, meta] = await Promise.all([
    storage.getItem<PlanComparisonDatabase>(DATA_KEY),
    storage.getItem<PlanCacheMeta>(META_KEY)
  ])
  if (cached && meta) {
    appendHeader(event, 'X-Plan-Cache', 'HIT')
    return { database: cached, fetchedAt: meta.fetchedAt, rolledBack: false }
  }
  try {
    inflight ??= crawlFresh().finally(() => {
      inflight = null
    })
    const fresh = await inflight
    appendHeader(event, 'X-Plan-Cache', 'FRESH')
    return fresh
  } catch {
    const [newestKey] = sortBackupKeysNewestFirst(normalizeBackupKeys(await storage.getKeys(BACKUP_PREFIX)))
    const restore = newestKey ? await storage.getItem<PlanBackup>(newestKey) : null
    if (restore) {
      await Promise.all([
        storage.setItem(DATA_KEY, restore.database),
        storage.setItem(META_KEY, { fetchedAt: restore.fetchedAt, version: restore.version } satisfies PlanCacheMeta)
      ])
      appendHeader(event, 'X-Plan-Cache', 'ROLLEDBACK')
      return { database: restore.database, fetchedAt: restore.fetchedAt, rolledBack: true }
    }
    appendHeader(event, 'X-Plan-Cache', 'MISS')
    throw createError({ statusCode: 502, statusMessage: 'Plan crawl failed and no cache available' })
  }
})
