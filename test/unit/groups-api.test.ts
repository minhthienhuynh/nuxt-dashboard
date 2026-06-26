import { beforeEach, describe, expect, it } from 'vitest'
import { groupHandlers } from '../../server/utils/api/handlers'
import { prisma, resetDb } from './repo-helpers'
import { mockH3Event } from './h3-event'

const createGroup = (body: unknown) =>
  groupHandlers.collection(mockH3Event({ method: 'POST', path: '/api/groups', body }))

const listGroups = () => groupHandlers.collection(mockH3Event({ path: '/api/groups' }))

const groupItem = (id: string, init: { method?: string, body?: unknown } = {}) =>
  groupHandlers.item(mockH3Event({ method: init.method, path: `/api/groups/${id}`, params: { id }, body: init.body }))

describe('groups API handlers (h3 v1 runtime)', () => {
  beforeEach(resetDb)

  it('POST creates a group and GET list includes it', async () => {
    const created = await createGroup({ name: 'prod' })
    expect(created.id).toBeTruthy()

    const list = await listGroups()
    expect(list.map((g: { id: string }) => g.id)).toContain(created.id)
  })

  it('rejects an invalid create with 400', async () => {
    await expect(createGroup({})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('deleting a group keeps its hosts (they become ungrouped)', async () => {
    const group = await createGroup({ name: 'staging' })
    const host = await prisma.host.create({ data: { label: 'h', address: '1.1.1.1', groupId: group.id } })

    await groupItem(group.id, { method: 'DELETE' })

    const survivor = await prisma.host.findUnique({ where: { id: host.id } })
    expect(survivor).not.toBeNull()
    expect(survivor?.groupId).toBeNull()
  })
})
