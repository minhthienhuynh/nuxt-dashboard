import { BACKUP_PREFIX } from '../../utils/storageKeys'
import { normalizeBackupKeys, sortBackupKeysNewestFirst, summarizeBackup } from '../../utils/planBackup'
import type { PlanBackup } from '../../utils/planBackup'

export default defineEventHandler(async () => {
  const storage = useStorage('plan-comparison')
  const keys = sortBackupKeysNewestFirst(normalizeBackupKeys(await storage.getKeys(BACKUP_PREFIX)))
  const backups = await Promise.all(keys.map(key => storage.getItem<PlanBackup>(key)))
  return {
    backups: backups
      .filter((backup): backup is PlanBackup => backup?.database != null && Array.isArray(backup.database.models))
      .map(backup => summarizeBackup(backup))
  }
})
