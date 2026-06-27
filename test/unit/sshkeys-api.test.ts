import { beforeEach, describe, expect, it } from 'vitest'
import sshKeyItem from '../../server/api/ssh-keys/[id]'
import { sshKeyHandlers } from '../../server/utils/api/handlers'
import { resetDb } from './repo-helpers'
import { mockH3Event } from './h3-event'

const createKey = (body: unknown) =>
  sshKeyHandlers.collection(mockH3Event({ method: 'POST', path: '/api/ssh-keys', body }))

interface Revealed { privateKey: string | null, passphrase: string | null }

describe('ssh-keys API reveal (h3 v1 runtime)', () => {
  beforeEach(resetDb)

  it('reveal=true returns the decrypted private key and passphrase', async () => {
    const created = await createKey({
      label: 'k', keyType: 'ed25519', publicKey: 'ssh-ed25519 AAAA', privateKey: 'PRIV-MATERIAL', passphrase: 'pp'
    })
    const revealed = await sshKeyItem(mockH3Event({
      path: `/api/ssh-keys/${created.id}?reveal=true`,
      params: { id: created.id }
    })) as Revealed
    expect(revealed.privateKey).toBe('PRIV-MATERIAL')
    expect(revealed.passphrase).toBe('pp')
  })

  it('plain GET (no reveal) still omits secrets', async () => {
    const created = await createKey({ label: 'k', keyType: 'ed25519', publicKey: 'ssh-ed25519 AAAA', privateKey: 'PRIV' })
    const fetched = await sshKeyItem(mockH3Event({
      path: `/api/ssh-keys/${created.id}`,
      params: { id: created.id }
    }))
    expect(fetched).not.toHaveProperty('privateKey')
    expect(fetched).not.toHaveProperty('passphrase')
  })
})
