import { describe, expect, it } from 'vitest'
import { backupKey, normalizeBackupKeys, selectBackupsToPrune, sortBackupKeysNewestFirst, summarizeBackup } from './planBackup'
import type { PlanBackup } from './planBackup'

function makeBackup(version: number): PlanBackup {
  return {
    database: { providers: [], plans: [], models: [], pricing: [], plan_models: [] },
    fetchedAt: `t${version}`,
    backedUpAt: `b${version}`,
    version
  }
}

describe('backupKey', () => {
  it('embeds millis for chronological sorting', () => {
    expect(backupKey(2) > backupKey(1)).toBe(true)
  })
})

describe('normalizeBackupKeys', () => {
  it('accepts full and relative keys and drops garbage', () => {
    expect(normalizeBackupKeys([
      'plan-comparison:backup:300',
      'backup:200',
      'plan-comparison:database',
      'junk'
    ])).toEqual(['plan-comparison:backup:300', 'plan-comparison:backup:200'])
  })
})

describe('sortBackupKeysNewestFirst', () => {
  it('orders by timestamp desc', () => {
    expect(sortBackupKeysNewestFirst(['plan-comparison:backup:100', 'plan-comparison:backup:300', 'plan-comparison:backup:200']))
      .toEqual(['plan-comparison:backup:300', 'plan-comparison:backup:200', 'plan-comparison:backup:100'])
  })
})

describe('selectBackupsToPrune', () => {
  it('keeps the newest 3', () => {
    const keys = [1, 2, 3, 4, 5].map(n => `plan-comparison:backup:${n}`)
    expect(selectBackupsToPrune(keys)).toEqual(['plan-comparison:backup:2', 'plan-comparison:backup:1'])
  })

  it('prunes nothing at capacity', () => {
    const keys = [1, 2, 3].map(n => `plan-comparison:backup:${n}`)
    expect(selectBackupsToPrune(keys)).toEqual([])
  })
})

describe('summarizeBackup', () => {
  it('returns counts without the payload', () => {
    expect(summarizeBackup(makeBackup(7))).toEqual({
      fetchedAt: 't7',
      backedUpAt: 'b7',
      version: 7,
      models: 0,
      pricing: 0,
      planModels: 0
    })
  })
})
