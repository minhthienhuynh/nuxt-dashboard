import type { PlanComparisonDatabase } from '../../app/types'
import { BACKUP_PREFIX } from './storageKeys'

export const MAX_BACKUPS = 3

export interface PlanBackup {
  database: PlanComparisonDatabase
  fetchedAt: string
  backedUpAt: string
  version: number
}

export interface PlanBackupSummary {
  fetchedAt: string
  backedUpAt: string
  version: number
  models: number
  pricing: number
  planModels: number
}

/** Each backup is its own object so concurrent resets never clobber each other. */
export function backupKey(nowMs: number): string {
  return `${BACKUP_PREFIX}${nowMs}`
}

function backupTimeMs(key: string): number | null {
  const tail = key.split(':').pop() ?? ''
  const n = Number(tail)
  return tail !== '' && Number.isFinite(n) ? n : null
}

/** Strips a mount prefix when the driver returns full keys. */
export function normalizeBackupKeys(keys: string[]): string[] {
  return keys
    .map(key => key.startsWith(BACKUP_PREFIX) ? key : `${BACKUP_PREFIX}${key.split(':').pop() ?? key}`)
    .filter(key => backupTimeMs(key) != null)
}

export function sortBackupKeysNewestFirst(keys: string[]): string[] {
  return [...keys].sort((a, b) => (backupTimeMs(b) ?? 0) - (backupTimeMs(a) ?? 0))
}

/** Keys beyond the newest MAX_BACKUPS entries — deleted after each reset. */
export function selectBackupsToPrune(keys: string[], max = MAX_BACKUPS): string[] {
  return sortBackupKeysNewestFirst(keys).slice(max)
}

export function summarizeBackup(backup: PlanBackup): PlanBackupSummary {
  return {
    fetchedAt: backup.fetchedAt,
    backedUpAt: backup.backedUpAt,
    version: backup.version,
    models: backup.database.models.length,
    pricing: backup.database.pricing.length,
    planModels: backup.database.plan_models.length
  }
}
