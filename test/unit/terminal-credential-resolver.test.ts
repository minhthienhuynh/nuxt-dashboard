import { beforeEach, describe, expect, it } from 'vitest'
import { resolveSecrets } from '../../server/utils/terminal/credential-resolver'
import { sshKeyRepository } from '../../server/utils/repositories/sshKey'
import { encryptSecret } from '../../server/utils/vault'
import { resetDb } from './repo-helpers'

describe('resolveSecrets', () => {
  beforeEach(resetDb)

  it('returns an empty object when there is no identity', async () => {
    expect(await resolveSecrets(null)).toEqual({})
    expect(await resolveSecrets(undefined)).toEqual({})
  })

  it('decrypts a password identity', async () => {
    const secrets = await resolveSecrets({ authType: 'password', password: encryptSecret('hunter2') })
    expect(secrets).toEqual({ password: 'hunter2' })
  })

  it('decrypts a key identity with a passphrase', async () => {
    const key = await sshKeyRepository.create({
      label: 'k',
      keyType: 'ed25519',
      publicKey: 'ssh-ed25519 AAAA',
      privateKey: encryptSecret('PRIVATE'),
      passphrase: encryptSecret('PASS')
    })

    const secrets = await resolveSecrets({ authType: 'key', sshKeyId: key.id })
    expect(secrets).toEqual({ privateKey: 'PRIVATE', passphrase: 'PASS' })
  })

  it('decrypts a key identity without a passphrase', async () => {
    const key = await sshKeyRepository.create({
      label: 'k',
      keyType: 'ed25519',
      publicKey: 'ssh-ed25519 AAAA',
      privateKey: encryptSecret('PRIVATE')
    })

    const secrets = await resolveSecrets({ authType: 'key', sshKeyId: key.id })
    expect(secrets).toEqual({ privateKey: 'PRIVATE' })
  })

  it('returns empty for a key identity whose key is missing', async () => {
    expect(await resolveSecrets({ authType: 'key', sshKeyId: 'no-such-key' })).toEqual({})
  })

  it('returns empty for a password identity with no stored password', async () => {
    expect(await resolveSecrets({ authType: 'password', password: null })).toEqual({})
  })
})
