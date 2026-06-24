import { beforeEach, describe, expect, it } from 'vitest'
import { sshKeyRepository } from '../../server/utils/repositories/sshKey'
import { resetDb } from './repo-helpers'

describe('sshKeyRepository', () => {
  beforeEach(resetDb)

  it('stores private key and passphrase verbatim (no encryption in the repo)', async () => {
    const created = await sshKeyRepository.create({
      label: 'deploy-key',
      keyType: 'ed25519',
      publicKey: 'ssh-ed25519 AAAA...',
      privateKey: 'CIPHERTEXT-private-xyz',
      passphrase: 'CIPHERTEXT-pass-abc'
    })

    const found = await sshKeyRepository.findById(created.id)
    expect(found?.privateKey).toBe('CIPHERTEXT-private-xyz')
    expect(found?.passphrase).toBe('CIPHERTEXT-pass-abc')
  })
})
