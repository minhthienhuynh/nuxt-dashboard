import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const repoDir = 'server/utils/repositories'

describe('repositories directory', () => {
  it('has a module for every aggregate root', () => {
    const files = readdirSync(repoDir)
    for (const aggregate of ['host', 'group', 'identity', 'sshKey', 'tag', 'snippet']) {
      expect(files).toContain(`${aggregate}.ts`)
    }
  })

  it('has no standalone repository for host dependents', () => {
    const files = readdirSync(repoDir).map(f => f.toLowerCase())
    for (const dependent of ['portforward', 'knownhost', 'connectionhistory', 'hosttag']) {
      expect(files.some(f => f.startsWith(dependent))).toBe(false)
    }
  })
})
