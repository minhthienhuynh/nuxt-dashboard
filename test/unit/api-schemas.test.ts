import { describe, expect, it } from 'vitest'
import {
  hostCreateSchema,
  identityCreateSchema,
  sshKeyCreateSchema,
  tagCreateSchema
} from '../../server/utils/api/schemas'

describe('api validation schemas', () => {
  it('hostCreateSchema accepts a valid payload', () => {
    expect(hostCreateSchema.safeParse({ label: 'web-1', address: '10.0.0.1' }).success).toBe(true)
  })

  it('hostCreateSchema rejects a payload missing the required address', () => {
    expect(hostCreateSchema.safeParse({ label: 'web-1' }).success).toBe(false)
  })

  it('tagCreateSchema accepts a name', () => {
    expect(tagCreateSchema.safeParse({ name: 'prod' }).success).toBe(true)
  })

  it('identityCreateSchema accepts an optional password (encrypted before persisting)', () => {
    expect(identityCreateSchema.safeParse({ username: 'u', authType: 'password', password: 'secret' }).success).toBe(true)
  })

  it('sshKeyCreateSchema accepts privateKey and passphrase', () => {
    const result = sshKeyCreateSchema.safeParse({ label: 'k', keyType: 'ed25519', publicKey: 'pub', privateKey: 'C', passphrase: 'PP' })
    expect(result.success).toBe(true)
  })

  it('still rejects unknown fields (strict)', () => {
    expect(identityCreateSchema.safeParse({ username: 'u', authType: 'key', bogus: 'x' }).success).toBe(false)
  })
})
