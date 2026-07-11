import { beforeEach, describe, expect, it } from 'vitest'
import { snippetHandlers } from '../../server/utils/api/handlers'
import { prisma, resetDb } from './repo-helpers'
import { mockH3Event } from './h3-event'

const createSnippet = (body: unknown) =>
  snippetHandlers.collection(mockH3Event({ method: 'POST', path: '/api/snippets', body }))

const listSnippets = (query = '') =>
  snippetHandlers.collection(mockH3Event({ path: `/api/snippets${query}` }))

const snippetItem = (id: string, init: { method?: string, body?: unknown } = {}) =>
  snippetHandlers.item(mockH3Event({
    method: init.method,
    path: `/api/snippets/${id}`,
    params: { id },
    body: init.body
  }))

describe('snippets API handlers (h3 v1 runtime)', () => {
  beforeEach(resetDb)

  it('POST creates a global snippet and GET list includes it', async () => {
    const created = await createSnippet({ label: 'uptime', command: 'uptime' })
    expect(created.id).toBeTruthy()
    expect(created.hosts).toEqual([])

    const list = await listSnippets()
    expect(list.map((s: { id: string }) => s.id)).toContain(created.id)
  })

  it('rejects create with a missing or empty command (400, no write)', async () => {
    await expect(createSnippet({ label: 'x' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(createSnippet({ label: 'x', command: '' })).rejects.toMatchObject({ statusCode: 400 })
    expect(await prisma.snippet.count()).toBe(0)
  })

  it('creates a snippet scoped to hosts', async () => {
    const host = await prisma.host.create({ data: { label: 'h', address: '10.0.0.1' } })
    const created = await createSnippet({
      label: 'ls', command: 'ls', hostIds: [host.id]
    })
    expect(created.hosts.map((l: { hostId: string }) => l.hostId)).toEqual([host.id])
  })

  it('GET by id returns the snippet and unknown id throws 404', async () => {
    const created = await createSnippet({ label: 'ls', command: 'ls -la' })

    const found = await snippetItem(created.id)
    expect(found.id).toBe(created.id)

    await expect(snippetItem('does-not-exist')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('PUT updates and DELETE removes (then 404)', async () => {
    const created = await createSnippet({ label: 'ls', command: 'ls' })

    const updated = await snippetItem(created.id, { method: 'PUT', body: { command: 'ls -la' } })
    expect(updated.command).toBe('ls -la')

    await snippetItem(created.id, { method: 'DELETE' })
    await expect(snippetItem(created.id)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('?hostId= returns global + host snippets, excluding other hosts', async () => {
    const host = await prisma.host.create({ data: { label: 'h', address: '10.0.0.1' } })
    const other = await prisma.host.create({ data: { label: 'o', address: '10.0.0.2' } })

    await createSnippet({ label: 'global', command: 'uptime' })
    await createSnippet({ label: 'host', command: 'ls', hostIds: [host.id] })
    await createSnippet({ label: 'other-host', command: 'w', hostIds: [other.id] })

    const forHost = await listSnippets(`?hostId=${host.id}`)
    expect(forHost.map((s: { label: string }) => s.label).sort())
      .toEqual(['global', 'host'])
  })

  it('without a filter returns all snippets', async () => {
    const host = await prisma.host.create({ data: { label: 'h', address: '10.0.0.1' } })
    await createSnippet({ label: 'global', command: 'uptime' })
    await createSnippet({ label: 'scoped', command: 'ls', hostIds: [host.id] })

    const all = await listSnippets()
    expect(all).toHaveLength(2)
  })
})
