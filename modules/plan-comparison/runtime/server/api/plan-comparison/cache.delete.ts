import { BACKUP_PREFIX, DATA_KEY, META_KEY } from '../../utils/storageKeys'
import type { PlanComparisonDatabase, PlanCacheMeta } from '../../../app/types'
import { backupKey, normalizeBackupKeys, selectBackupsToPrune } from '../../utils/planBackup'

const RESET_MIN_INTERVAL_MS = 60 * 1000

let lastResetAt = 0

export default defineEventHandler(async (event) => {
  const now = Date.now()
  if (now - lastResetAt < RESET_MIN_INTERVAL_MS) {
    setResponseStatus(event, 429)
    return { cleared: false, retryAfterMs: RESET_MIN_INTERVAL_MS - (now - lastResetAt) }
  }
  lastResetAt = now
  const storage = useStorage('plan-comparison')
  const [cached, meta] = await Promise.all([
    storage.getItem<PlanComparisonDatabase>(DATA_KEY),
    storage.getItem<PlanCacheMeta>(META_KEY)
  ])
  let backedUp = false
  if (cached && meta) {
    await storage.setItem(backupKey(now), {
      database: cached,
      fetchedAt: meta.fetchedAt,
      backedUpAt: new Date(now).toISOString(),
      version: meta.version
    })
    backedUp = true
    const staleKeys = selectBackupsToPrune(normalizeBackupKeys(await storage.getKeys(BACKUP_PREFIX)))
    await Promise.all(staleKeys.map(key => storage.removeItem(key)))
  }
  await Promise.all([
    storage.removeItem(DATA_KEY),
    storage.removeItem(META_KEY)
  ])
  return { cleared: true, backedUp }
})
