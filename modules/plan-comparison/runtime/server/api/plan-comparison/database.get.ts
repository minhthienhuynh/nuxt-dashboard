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
import { AA_MODEL_SLUGS, fetchAaScore } from '../../crawl/aa'
import { plans as staticPlans } from '../../data/plans'
import { providers as staticProviders } from '../../data/providers'

let inflight: Promise<PlanComparisonPayload> | null = null

async function crawlFresh(): Promise<PlanComparisonPayload> {
  const fetchedAt = new Date().toISOString()
  const sources = await fetchSources()
  const goatModels = parseGoatModels(extractFlightModels(sources.goatHtml))
  // Fill missing intel scores from AA exact scores (rounded to 1 decimal).
  // Only curated slug pairs are fetched; failures leave the score null.
  await Promise.all(goatModels
    .filter(model => model.intelligenceIndex == null && AA_MODEL_SLUGS[model.id])
    .map(async (model) => {
      const mapping = AA_MODEL_SLUGS[model.id]
      if (!mapping) return
      const score = await fetchAaScore(mapping.slug, mapping.label)
      if (score != null) model.intelligenceIndex = score
    }))
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
