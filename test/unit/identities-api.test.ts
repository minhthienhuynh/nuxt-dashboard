import { beforeEach, describe, expect, it } from 'vitest'
import identityItem from '../../server/api/identities/[id]'
import { identityHandlers } from '../../server/utils/api/handlers'
import { decryptSecret } from '../../server/utils/vault'
import { prisma, resetDb } from './repo-helpers'
import { mockH3Event } from './h3-event'

const createIdentity = (body: unknown) =>
  identityHandlers.collection(mockH3Event({ method: 'POST', path: '/api/identities', body }))

const getIdentity = (id: string) =>
  identityHandlers.item(mockH3Event({ path: `/api/identities/${id}`, params: { id } }))

describe('identities API with vault (h3 v1 runtime)', () => {
  beforeEach(resetDb)

  it('stores a submitted password encrypted and decryptable', async () => {
    const created = await createIdentity({ username: 'deploy', authType: 'password', password: 'p@ss-w0rd' })

    const row = await prisma.identity.findUnique({ where: { id: created.id } })
    expect(row?.password).toBeTruthy()
    expect(row?.password).not.toBe('p@ss-w0rd')
    if (row?.password) expect(decryptSecret(row.password)).toBe('p@ss-w0rd')
  })

  it('never returns the password in responses', async () => {
    const created = await createIdentity({ username: 'u', authType: 'password', password: 'secret' })
    expect(created).not.toHaveProperty('password')

    const fetched = await getIdentity(created.id)
    expect(fetched).not.toHaveProperty('password')
  })

  it('reveal=true returns the decrypted password for editing', async () => {
    const created = await createIdentity({ username: 'u', authType: 'password', password: 's3cret' })
    const revealed = await identityItem(mockH3Event({
      path: `/api/identities/${created.id}?reveal=true`,
      params: { id: created.id }
    })) as { password: string | null }
    expect(revealed.password).toBe('s3cret')
  })

  it('plain GET (no reveal) still omits the password', async () => {
    const created = await createIdentity({ username: 'u', authType: 'password', password: 'secret' })
    const fetched = await identityItem(mockH3Event({
      path: `/api/identities/${created.id}`,
      params: { id: created.id }
    }))
    expect(fetched).not.toHaveProperty('password')
  })
})
