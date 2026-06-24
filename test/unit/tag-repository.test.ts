import { beforeEach, describe, expect, it } from 'vitest'
import { tagRepository } from '../../server/utils/repositories/tag'
import { prisma, resetDb } from './repo-helpers'

describe('tagRepository', () => {
  beforeEach(resetDb)

  it('supports base CRUD', async () => {
    const created = await tagRepository.create({ name: 'web' })
    expect((await tagRepository.findById(created.id))?.name).toBe('web')
  })

  it('find-or-create is idempotent on the unique name', async () => {
    const first = await tagRepository.findOrCreate('production')
    const second = await tagRepository.findOrCreate('production')

    expect(second.id).toBe(first.id)
    expect(await prisma.tag.count({ where: { name: 'production' } })).toBe(1)
  })
})
