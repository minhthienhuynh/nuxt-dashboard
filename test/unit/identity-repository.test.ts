import { beforeEach, describe, expect, it } from 'vitest'
import { identityRepository } from '../../server/utils/repositories/identity'
import { resetDb } from './repo-helpers'

describe('identityRepository', () => {
  beforeEach(resetDb)

  it('stores the password verbatim (ciphertext passed through unchanged)', async () => {
    const created = await identityRepository.create({
      username: 'deploy',
      authType: 'password',
      password: 'CIPHERTEXT-secret-123'
    })

    expect((await identityRepository.findById(created.id))?.password).toBe('CIPHERTEXT-secret-123')
  })
})
