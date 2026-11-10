/**
 * models.dev — cross-provider model database (https://models.dev/api.json),
 * consulted only when neither Command Code's payload nor the audited static
 * map (release-dates.ts) has a date for a model.
 *
 * The payload nests providers → models → `release_date`; the same model shows up
 * under many aggregators, so a lookup ballots every provider entry that matches
 * the model on a compact key (letters and digits only, so `Qwen3.8 Flash` =
 * `Qwen 3.8 Flash`, `Muse Ember` = `meta/muse-ember`). The winning date is the
 * one the most providers agree on; a tie falls to the most recent date, since
 * aggregators copy an older base-model date onto speed variants far more often
 * than they invent a newer one.
 *
 * Deliberately conservative: a single provider is enough only when nothing else
 * matches, and the caller keeps the value only if the model had no date at all.
 * A wrong date here cannot overwrite a published one.
 */

/** Compact key: lowercase, letters and digits only (`minimax-m2.5` → `minimaxm25`). */
function compactKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

interface Vote {
  date: string
  providers: Set<string>
}

export interface ModelsDevIndex {
  /** Compact key → the dates published for it, keyed by date. */
  byKey: Map<string, Map<string, Set<string>>>
}

interface RawModel {
  name?: unknown
  release_date?: unknown
}

interface RawProvider {
  models?: unknown
}

/** Builds the lookup once per crawl (the payload is ~6 MB). */
export function indexModelsDev(json: string): ModelsDevIndex {
  const byKey = new Map<string, Map<string, Set<string>>>()
  if (!json) return { byKey }
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { byKey }
  }
  if (parsed == null || typeof parsed !== 'object') return { byKey }
  for (const [providerId, provider] of Object.entries(parsed as Record<string, RawProvider>)) {
    const models = provider?.models
    if (models == null || typeof models !== 'object') continue
    for (const [modelId, raw] of Object.entries(models as Record<string, RawModel>)) {
      const date = typeof raw?.release_date === 'string' ? raw.release_date.slice(0, 10) : null
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      const keys = new Set(
        [typeof raw?.name === 'string' ? raw.name : '', modelId, modelId.split('/').pop() ?? '']
          .map(compactKey)
          .filter(key => key !== '')
      )
      for (const key of keys) {
        const dates = byKey.get(key) ?? new Map<string, Set<string>>()
        const providers = dates.get(date) ?? new Set<string>()
        providers.add(providerId)
        dates.set(date, providers)
        byKey.set(key, dates)
      }
    }
  }
  return { byKey }
}

/**
 * The date models.dev reports for this model, or null when it has no entry.
 * `keys` are the compact keys to try, most specific first (slug, then name).
 */
export function modelsDevReleaseDate(index: ModelsDevIndex, keys: string[]): string | null {
  const votes = new Map<string, Vote>()
  for (const key of keys) {
    const compact = compactKey(key)
    if (compact === '') continue
    for (const [date, providers] of index.byKey.get(compact) ?? []) {
      const vote = votes.get(date) ?? { date, providers: new Set<string>() }
      for (const provider of providers) vote.providers.add(provider)
      votes.set(date, vote)
    }
  }
  if (votes.size === 0) return null
  return [...votes.values()]
    .sort((a, b) => b.providers.size - a.providers.size || b.date.localeCompare(a.date))
    .at(0)!
    .date
}
