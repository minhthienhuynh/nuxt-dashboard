import { beforeEach, describe, expect, it } from 'vitest'
import { snippetRepository } from '../../server/utils/repositories/snippet'
import { prisma, resetDb } from './repo-helpers'

describe('snippetRepository', () => {
  beforeEach(resetDb)

  it('creates a global snippet with no links', async () => {
    const created = await snippetRepository.create({ label: 'uptime', command: 'uptime' })
    expect(created.hosts).toEqual([])
  })

  it('creates a snippet linked to hosts', async () => {
    const host = await prisma.host.create({ data: { label: 'h', address: '10.0.0.1' } })
    const created = await snippetRepository.create({
      label: 'ls', command: 'ls -la', hostIds: [host.id]
    })
    expect(created.hosts.map(l => l.hostId)).toEqual([host.id])
  })

  it('reconciles links on update; omitting them leaves links untouched', async () => {
    const h1 = await prisma.host.create({ data: { label: 'h1', address: '10.0.0.1' } })
    const h2 = await prisma.host.create({ data: { label: 'h2', address: '10.0.0.2' } })
    const created = await snippetRepository.create({ label: 's', command: 'ls', hostIds: [h1.id] })

    // Omitting hostIds leaves the existing link.
    const renamed = await snippetRepository.update(created.id, { command: 'ls -la' })
    expect(renamed.hosts.map(l => l.hostId)).toEqual([h1.id])

    // Supplying hostIds reconciles to exactly that set.
    const rescoped = await snippetRepository.update(created.id, { hostIds: [h2.id] })
    expect(rescoped.hosts.map(l => l.hostId)).toEqual([h2.id])

    // An empty array clears the links (makes it global).
    const cleared = await snippetRepository.update(created.id, { hostIds: [] })
    expect(cleared.hosts).toEqual([])
  })

  describe('findForHost', () => {
    it('returns global + host-linked, excluding other hosts', async () => {
      const hostA = await prisma.host.create({ data: { label: 'a', address: '10.0.0.1' } })
      const hostB = await prisma.host.create({ data: { label: 'b', address: '10.0.0.2' } })
      await snippetRepository.create({ label: 'global', command: 'uptime' })
      await snippetRepository.create({ label: 'a-only', command: 'ls', hostIds: [hostA.id] })
      await snippetRepository.create({ label: 'b-only', command: 'df', hostIds: [hostB.id] })

      const forA = await snippetRepository.findForHost(hostA.id)
      expect(forA.map(s => s.label).sort()).toEqual(['a-only', 'global'])
    })

    it('returns only globals for an unknown host id', async () => {
      await snippetRepository.create({ label: 'global', command: 'uptime' })
      const host = await prisma.host.create({ data: { label: 'h', address: '10.0.0.1' } })
      await snippetRepository.create({ label: 'scoped', command: 'ls', hostIds: [host.id] })

      const forUnknown = await snippetRepository.findForHost('does-not-exist')
      expect(forUnknown.map(s => s.label)).toEqual(['global'])
    })
  })
})
