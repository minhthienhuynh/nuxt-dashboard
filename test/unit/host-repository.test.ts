import { beforeEach, describe, expect, it } from 'vitest'
import { hostRepository } from '../../server/utils/repositories/host'
import { prisma, resetDb } from './repo-helpers'

describe('hostRepository', () => {
  beforeEach(resetDb)

  it('creates a host together with nested dependents', async () => {
    const created = await hostRepository.create({
      label: 'web-1',
      address: '10.0.0.11',
      portForwards: { create: [{ forwardType: 'local', bindPort: 8080, destHost: 'localhost', destPort: 80 }] },
      knownHosts: { create: [{ keyType: 'ssh-ed25519', fingerprint: 'SHA256:abc' }] }
    })

    const full = await hostRepository.withRelations(created.id)
    expect(full?.portForwards).toHaveLength(1)
    expect(full?.knownHosts).toHaveLength(1)
  })

  it('withRelations loads group, identity and tags', async () => {
    const group = await prisma.group.create({ data: { name: 'Production' } })
    const identity = await prisma.identity.create({ data: { username: 'deploy', authType: 'key' } })
    const tag = await prisma.tag.create({ data: { name: 'web' } })
    const host = await prisma.host.create({
      data: {
        label: 'web-2',
        address: '10.0.0.12',
        groupId: group.id,
        identityId: identity.id,
        tags: { create: [{ tagId: tag.id }] }
      }
    })

    const full = await hostRepository.withRelations(host.id)
    expect(full?.group?.name).toBe('Production')
    expect(full?.identity?.username).toBe('deploy')
    expect(full?.tags.map(t => t.tag.name)).toContain('web')
  })

  it('creates a host with tags, find-or-creating each by name', async () => {
    const existing = await prisma.tag.create({ data: { name: 'prod' } })

    const created = await hostRepository.create({ label: 'db-1', address: '10.0.0.21', tags: ['prod', 'db'] })
    const full = await hostRepository.withRelations(created.id)

    expect(full?.tags.map(t => t.tag.name).sort()).toEqual(['db', 'prod'])
    // The pre-existing tag is reused, not duplicated; the new one is created.
    expect((await prisma.tag.findUnique({ where: { name: 'prod' } }))?.id).toBe(existing.id)
    expect(await prisma.tag.count()).toBe(2)
  })

  it('update reconciles the tag set to exactly the given names', async () => {
    const created = await hostRepository.create({ label: 'h', address: '10.0.0.22', tags: ['prod', 'db'] })

    await hostRepository.update(created.id, { tags: ['prod', 'web'] })
    const full = await hostRepository.withRelations(created.id)
    expect(full?.tags.map(t => t.tag.name).sort()).toEqual(['prod', 'web'])
  })

  it('update without tags leaves links untouched; empty array clears them', async () => {
    const created = await hostRepository.create({ label: 'h', address: '10.0.0.23', tags: ['keep'] })

    await hostRepository.update(created.id, { label: 'renamed' })
    expect((await hostRepository.withRelations(created.id))?.tags.map(t => t.tag.name)).toEqual(['keep'])

    await hostRepository.update(created.id, { tags: [] })
    expect((await hostRepository.withRelations(created.id))?.tags).toEqual([])
  })

  it('findByTags returns only hosts carrying ALL the given names', async () => {
    const both = await hostRepository.create({ label: 'both', address: '10.0.0.31', tags: ['prod', 'db'] })
    await hostRepository.create({ label: 'prod-only', address: '10.0.0.32', tags: ['prod'] })

    const oneTag = await hostRepository.findByTags(['prod'])
    expect(oneTag).toHaveLength(2)

    const twoTags = await hostRepository.findByTags(['prod', 'db'])
    expect(twoTags.map(h => h.id)).toEqual([both.id])
  })
})
