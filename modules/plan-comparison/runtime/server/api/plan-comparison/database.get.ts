import { BACKUP_PREFIX, DATA_KEY, META_KEY } from '../../utils/storageKeys'
import type { PlanBackup } from '../../utils/planBackup'
import { normalizeBackupKeys, sortBackupKeysNewestFirst } from '../../utils/planBackup'
import type { PlanComparisonDatabase, PlanComparisonPayload, PlanCacheMeta } from '../../../app/types'
import { buildDatabase } from '../../crawl/build'
import { SOURCE_URLS, extractFlightEstimates, extractFlightModels, fetchSources } from '../../crawl/sources'
import { parseGoatEstimates, parseGoatModels } from '../../crawl/goat'
import { parseGoPlanLimits, parsePricingLimits } from '../../crawl/ccpricing'
import { parseOpenCodeEndpoints, parseOpenCodeEstimates, parseOpenCodePricing } from '../../crawl/opencode'
import { parseOpenDesignAllowances, parseOpenDesignModels, parseOpenDesignMultipliers, parseOpenDesignUsage } from '../../crawl/opendesign'
import { parseTokenHarborBoosts, parseTokenHarborCatalogue } from '../../crawl/tokenharbor'
import { crawledDatabaseSchema } from '../../crawl/schemas'
import { AA_MODEL_SLUGS, fetchLeaderboardIntel, scoreFromLeaderboard } from '../../crawl/aa'
import { plans as staticPlans } from '../../data/plans'
import { providers as staticProviders } from '../../data/providers'

let inflight: Promise<PlanComparisonPayload> | null = null

async function crawlFresh(): Promise<PlanComparisonPayload> {
  const fetchedAt = new Date().toISOString()
  const sources = await fetchSources()
  const goatModels = parseGoatModels(extractFlightModels(sources.goatHtml))
  // Every model's intelligence index is AA v5 — vendor-published scores are
  // dropped by design. The only payload that carries v5 scores is the
  // leaderboard's embedded initialModels (v5 model pages embed nothing,
  // verified 2026-11-12), so the fill is a single fetch + in-memory join:
  // variant-aware (effort/speed tiers, highest wins) via labelMatchesModel.
  // The curated AA_MODEL_SLUGS overrides remap known proxies onto board
  // labels (e.g. Qwen3.8-Flash → qwen3-8-flash-next). No v5 score anywhere
  // -> null (rendered as '—'). Per-model page probes are gone for good.
  const leaderboard = await fetchLeaderboardIntel()
  for (const model of goatModels) {
    const label = AA_MODEL_SLUGS[model.id]?.label ?? model.name
    model.intelligenceIndex = scoreFromLeaderboard(leaderboard, label)
  }
  const goatEstimates = parseGoatEstimates(extractFlightEstimates(sources.goatHtml))
  // Go fallback fractions come from the static Go plan limits (3/6/10),
  // not the GOAT defaults (0.2/0.5) inside parseGoatEstimates.
  const goPlanLimits = staticPlans.find(p => p.id === 'cmd-go')?.limits
  const goEstimates = parseGoatEstimates(extractFlightEstimates(sources.goHtml), {
    fiveHour: goPlanLimits?.['5h'] != null ? goPlanLimits['5h'] / goPlanLimits.monthly : 0.3,
    weekly: goPlanLimits?.weekly != null ? goPlanLimits.weekly / goPlanLimits.monthly : 0.6
  })
  const pricingSections = parsePricingLimits(sources.pricingLimitsHtml)
  const goLimits = parseGoPlanLimits(sources.goHtml)
  const ocPricing = parseOpenCodePricing(sources.openCodeGoHtml)
  const ocEstimates = parseOpenCodeEstimates(sources.openCodeGoHtml)
  const ocEndpoints = parseOpenCodeEndpoints(sources.openCodeGoHtml)
  // OpenDesign Go: allowance table (credits + windows) and model catalog (ids,
  // plan access, tier rates) come from two Astro pages, no Flight payload.
  const odAllowances = parseOpenDesignAllowances(sources.openDesignGoHtml)
  const odModels = parseOpenDesignModels(sources.openDesignModelsHtml)
  const odMultipliers = parseOpenDesignMultipliers(sources.openDesignCreditsHtml)
  // The vendor's own request estimates ("Coding Plan usage", Go column) — read
  // the same way Command Code's and OpenCode Go's published counts are.
  const odUsage = parseOpenDesignUsage(sources.openDesignGoHtml)
  // TokenHarbor Agent Pass: the docs publish the coverage rule, the models
  // page's Flight payload the catalogue with rates. The pricing page carries
  // the Model Boost badges the rule's estimate widget shows.
  const thModels = parseTokenHarborCatalogue(sources.tokenHarborModelsHtml)
  const thBoosts = parseTokenHarborBoosts(sources.tokenHarborPricingHtml)
  const built = buildDatabase({
    goatModels,
    goatEstimates: goatEstimates.rows,
    goatFractions: { fiveHour: goatEstimates.fiveHourFraction, weekly: goatEstimates.weeklyFraction },
    goEstimates: goEstimates.rows,
    goFractions: { fiveHour: goEstimates.fiveHourFraction, weekly: goEstimates.weeklyFraction },
    pricingSections,
    goCreditsUsd: goLimits?.creditsUsd ?? null,
    openCodePricing: ocPricing,
    openCodeEstimates: ocEstimates,
    openCodeEndpoints: ocEndpoints,
    openDesignAllowances: odAllowances,
    openDesignModels: odModels,
    openDesignMultipliers: odMultipliers,
    openDesignUsage: odUsage,
    tokenHarborModels: thModels,
    tokenHarborBoosts: thBoosts,
    modelsDevJson: sources.modelsDevJson,
    fetchedAt,
    sourceUrls: {
      goat: SOURCE_URLS.goat,
      go: SOURCE_URLS.go,
      pricingLimits: SOURCE_URLS.pricingLimits,
      openCodeGo: SOURCE_URLS.openCodeGo,
      openDesignPricing: SOURCE_URLS.openDesignGo,
      openDesignModels: SOURCE_URLS.openDesignModels,
      openDesignCredits: SOURCE_URLS.openDesignCredits,
      tokenHarborModels: SOURCE_URLS.tokenHarborModels,
      tokenHarborPricing: SOURCE_URLS.tokenHarborPricing
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
