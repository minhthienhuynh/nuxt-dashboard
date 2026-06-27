import { beforeEach, describe, expect, it } from 'vitest'
import { hostHandlers } from '../../server/utils/api/handlers'
import { prisma, resetDb } from './repo-helpers'
import { mockH3Event } from './h3-event'

const createHost = (body: unknown) =>
  hostHandlers.collection(mockH3Event({ method: 'POST', path: '/api/hosts', body }))

const listHosts = (query = '') =>
  hostHandlers.collection(mockH3Event({ path: `/api/hosts${query}` }))

const hostItem = (id: string, init: { method?: string, body?: unknown, query?: string } = {}) =>
  hostHandlers.item(mockH3Event({
    method: init.method,
    path: `/api/hosts/${id}${init.query ?? ''}`,
    params: { id },
    body: init.body
  }))

describe('hosts API handlers (h3 v1 runtime)', () => {
  beforeEach(resetDb)

  it('POST creates a host and GET list includes it', async () => {
    const created = await createHost({ label: 'web-1', address: '10.0.0.1' })
    expect(created.id).toBeTruthy()

    const list = await listHosts()
    expect(list.map((h: { id: string }) => h.id)).toContain(created.id)
  })

  it('GET by id returns the host and unknown id throws 404', async () => {
    const created = await createHost({ label: 'h', address: '1.1.1.1' })

    const found = await hostItem(created.id)
    expect(found.id).toBe(created.id)

    await expect(hostItem('does-not-exist')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('PUT updates and DELETE removes', async () => {
    const created = await createHost({ label: 'h', address: '1.1.1.1' })

    const updated = await hostItem(created.id, { method: 'PUT', body: { label: 'h2' } })
    expect(updated.label).toBe('h2')

    await hostItem(created.id, { method: 'DELETE' })
    await expect(hostItem(created.id)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('?relations=true includes relations with the identity secret redacted', async () => {
    const identity = await prisma.identity.create({ data: { username: 'deploy', authType: 'password', password: 'CIPHER' } })
    const created = await createHost({ label: 'h', address: '1.1.1.1', identityId: identity.id })

    const full = await hostItem(created.id, { query: '?relations=true' })
    expect(full.identity.username).toBe('deploy')
    expect(full.identity).not.toHaveProperty('password')
  })

  it('?tag filters hosts by tag name', async () => {
    const tag = await prisma.tag.create({ data: { name: 'prod' } })
    const created = await createHost({ label: 'h', address: '1.1.1.1' })
    await prisma.hostTag.create({ data: { hostId: created.id, tagId: tag.id } })

    const list = await listHosts('?tag=prod')
    expect(list.map((h: { id: string }) => h.id)).toContain(created.id)
  })

  it('POST with tags links them (creating missing tags)', async () => {
    const created = await createHost({ label: 'h', address: '1.1.1.1', tags: ['prod', 'db'] })

    const full = await hostItem(created.id, { query: '?relations=true' })
    expect(full.tags.map((l: { tag: { name: string } }) => l.tag.name).sort()).toEqual(['db', 'prod'])
  })

  it('PUT with empty tags clears links; omitting tags leaves them', async () => {
    const created = await createHost({ label: 'h', address: '1.1.1.1', tags: ['keep'] })

    await hostItem(created.id, { method: 'PUT', body: { label: 'renamed' } })
    expect((await hostItem(created.id, { query: '?relations=true' }))
      .tags.map((l: { tag: { name: string } }) => l.tag.name)).toEqual(['keep'])

    await hostItem(created.id, { method: 'PUT', body: { tags: [] } })
    expect((await hostItem(created.id, { query: '?relations=true' })).tags).toEqual([])
  })

  it('?tag=a&tag=b filters hosts by ALL tags (AND)', async () => {
    const both = await createHost({ label: 'both', address: '1.1.1.1', tags: ['prod', 'db'] })
    await createHost({ label: 'prod-only', address: '2.2.2.2', tags: ['prod'] })

    const list = await listHosts('?tag=prod&tag=db')
    expect(list.map((h: { id: string }) => h.id)).toEqual([both.id])
  })

  it('rejects an invalid create with 400 and without persisting', async () => {
    await expect(createHost({ label: 'no-address' })).rejects.toMatchObject({ statusCode: 400 })
    // An empty/non-string tag name is rejected before any write.
    await expect(createHost({ label: 'h', address: '1.1.1.1', tags: [''] })).rejects.toMatchObject({ statusCode: 400 })
    await expect(createHost({ label: 'h', address: '1.1.1.1', tags: [123] })).rejects.toMatchObject({ statusCode: 400 })
    expect(await prisma.host.count()).toBe(0)
  })
})
