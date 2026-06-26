import { describe, expect, it } from 'vitest'
import { verifyHostKey } from '../../server/utils/terminal/host-key'

describe('verifyHostKey', () => {
  it('returns "new" when there is no stored fingerprint', () => {
    expect(verifyHostKey(null, 'SHA256:abc')).toBe('new')
    expect(verifyHostKey(undefined, 'SHA256:abc')).toBe('new')
  })

  it('returns "match" when the presented fingerprint equals the stored one', () => {
    expect(verifyHostKey('SHA256:abc', 'SHA256:abc')).toBe('match')
  })

  it('returns "mismatch" when the presented fingerprint differs', () => {
    expect(verifyHostKey('SHA256:abc', 'SHA256:xyz')).toBe('mismatch')
  })
})
