import { beforeEach, describe, expect, it } from 'vitest'
import { snippetRepository } from '../../server/utils/repositories/snippet'
import { prisma, resetDb } from './repo-helpers'

describe('snippetRepository', () => {
  beforeEach(resetDb)

  it('creates a global snippet when no host is given', async () => {
    const created = await snippetRepository.create({ label: 'uptime', command: 'uptime' })
    expect(created.hostId).toBeNull()
  })

  it('creates a host-scoped snippet', async () => {
    const host = await prisma.host.create({ data: { label: 'h', address: '10.0.0.1' } })
    const created = await snippetRepository.create({ label: 'ls', command: 'ls -la', hostId: host.id })
    expect(created.hostId).toBe(host.id)
  })
})
