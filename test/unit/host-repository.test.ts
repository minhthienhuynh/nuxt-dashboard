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

  it('finds hosts by tag name', async () => {
    const tag = await prisma.tag.create({ data: { name: 'prod' } })
    const host = await prisma.host.create({
      data: { label: 'db-1', address: '10.0.0.21', tags: { create: [{ tagId: tag.id }] } }
    })

    const found = await hostRepository.findByTag('prod')
    expect(found.map(h => h.id)).toContain(host.id)
  })
})
