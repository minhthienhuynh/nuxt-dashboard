import { beforeEach, describe, expect, it } from 'vitest'
import { tagHandlers } from '../../server/utils/api/handlers'
import { resetDb } from './repo-helpers'
import { mockH3Event } from './h3-event'

const createTag = (body: unknown) =>
  tagHandlers.collection(mockH3Event({ method: 'POST', path: '/api/tags', body }))

const listTags = () => tagHandlers.collection(mockH3Event({ path: '/api/tags' }))

describe('tags API handlers (h3 v1 runtime)', () => {
  beforeEach(resetDb)

  it('POST creates a tag and GET list includes it', async () => {
    const created = await createTag({ name: 'prod' })
    expect(created.id).toBeTruthy()

    const list = await listTags()
    expect(list.map((t: { name: string }) => t.name)).toContain('prod')
  })

  it('rejects an invalid create with 400', async () => {
    await expect(createTag({})).rejects.toMatchObject({ statusCode: 400 })
  })
})
