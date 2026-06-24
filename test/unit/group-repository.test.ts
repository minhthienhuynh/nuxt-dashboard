import { beforeEach, describe, expect, it } from 'vitest'
import { groupRepository } from '../../server/utils/repositories/group'
import { resetDb } from './repo-helpers'

describe('groupRepository', () => {
  beforeEach(resetDb)

  it('creates a group and reads it back by id', async () => {
    const created = await groupRepository.create({ name: 'Production' })
    const found = await groupRepository.findById(created.id)

    expect(found?.id).toBe(created.id)
    expect(found?.name).toBe('Production')
  })

  it('returns null when the id does not exist', async () => {
    expect(await groupRepository.findById('does-not-exist')).toBeNull()
  })

  it('updates and removes a group', async () => {
    const created = await groupRepository.create({ name: 'Staging' })

    const updated = await groupRepository.update(created.id, { name: 'Staging-2' })
    expect(updated.name).toBe('Staging-2')

    await groupRepository.remove(created.id)
    expect(await groupRepository.findById(created.id)).toBeNull()
  })
})
