import { describe, expect, it } from 'vitest'
import { serializeHost, serializeIdentity, serializeSshKey, stripSecrets } from '../../server/utils/api/serialize'

describe('api serializers', () => {
  it('stripSecrets removes secret fields and keeps the rest', () => {
    const out = stripSecrets({ id: '1', username: 'u', password: 'CIPHER', privateKey: 'P', passphrase: 'PP', label: 'k' })
    expect(out).not.toHaveProperty('password')
    expect(out).not.toHaveProperty('privateKey')
    expect(out).not.toHaveProperty('passphrase')
    expect(out.username).toBe('u')
    expect(out.label).toBe('k')
  })

  it('serializeIdentity drops the password', () => {
    expect(serializeIdentity({ id: '1', username: 'u', password: 'CIPHER' })).not.toHaveProperty('password')
  })

  it('serializeSshKey drops privateKey and passphrase', () => {
    const out = serializeSshKey({ id: '1', publicKey: 'pub', privateKey: 'C', passphrase: 'PP' })
    expect(out).not.toHaveProperty('privateKey')
    expect(out).not.toHaveProperty('passphrase')
    expect(out!.publicKey).toBe('pub')
  })

  it('serializeHost redacts the nested identity secret', () => {
    const host = serializeHost({ id: 'h', label: 'x', identity: { id: 'i', username: 'u', password: 'CIPHER' } })
    expect((host!.identity as Record<string, unknown>)).not.toHaveProperty('password')
    expect((host!.identity as Record<string, unknown>).username).toBe('u')
  })

  it('serializers tolerate null', () => {
    expect(serializeIdentity(null)).toBeNull()
    expect(serializeHost(null)).toBeNull()
    expect(serializeSshKey(null)).toBeNull()
  })
})
