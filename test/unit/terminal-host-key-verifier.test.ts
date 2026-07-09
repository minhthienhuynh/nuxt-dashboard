import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHostKeyVerifier } from '../../server/utils/terminal/host-key-verifier'
import { hostRepository } from '../../server/utils/repositories/host'

// An arbitrary buffer isn't a parseable key, so ssh2.utils.parseKey returns an
// Error and the verifier records the key type as 'unknown'. The fingerprint is
// the sha256 of the buffer, base64, unpadded — computed here the same way the
// verifier does so we can pin it in the stored-host cases.
const KEY = Buffer.from('not-a-real-ssh-key')
const FINGERPRINT = createHash('sha256').update(KEY).digest('base64').replace(/=+$/, '')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createHostKeyVerifier', () => {
  it('persists the fingerprint and accepts on first sight (new)', async () => {
    const addKnownHost = vi.spyOn(hostRepository, 'addKnownHost').mockResolvedValue({} as never)
    const onMismatch = vi.fn()
    const verify = vi.fn()

    const verifier = createHostKeyVerifier({ hostId: 'host-1', knownHosts: [], onMismatch })
    verifier(KEY, verify)

    // The persist is awaited inside a promise chain before verify(true).
    await vi.waitFor(() => expect(verify).toHaveBeenCalledWith(true))
    expect(addKnownHost).toHaveBeenCalledWith('host-1', 'unknown', FINGERPRINT)
    expect(onMismatch).not.toHaveBeenCalled()
  })

  it('accepts a matching fingerprint without writing a duplicate (match)', () => {
    const addKnownHost = vi.spyOn(hostRepository, 'addKnownHost')
    const onMismatch = vi.fn()
    const verify = vi.fn()

    const verifier = createHostKeyVerifier({
      hostId: 'host-1',
      knownHosts: [{ keyType: 'unknown', fingerprint: FINGERPRINT }],
      onMismatch
    })
    verifier(KEY, verify)

    expect(verify).toHaveBeenCalledWith(true)
    expect(addKnownHost).not.toHaveBeenCalled()
    expect(onMismatch).not.toHaveBeenCalled()
  })

  it('refuses and reports a changed fingerprint (mismatch)', () => {
    const addKnownHost = vi.spyOn(hostRepository, 'addKnownHost')
    const onMismatch = vi.fn()
    const verify = vi.fn()

    const verifier = createHostKeyVerifier({
      hostId: 'host-1',
      knownHosts: [{ keyType: 'unknown', fingerprint: 'SHA256:different' }],
      onMismatch
    })
    verifier(KEY, verify)

    expect(onMismatch).toHaveBeenCalledOnce()
    expect(verify).toHaveBeenCalledWith(false)
    expect(addKnownHost).not.toHaveBeenCalled()
  })

  it('still accepts when persisting a new fingerprint fails', async () => {
    vi.spyOn(hostRepository, 'addKnownHost').mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const verify = vi.fn()

    const verifier = createHostKeyVerifier({ hostId: 'host-1', knownHosts: [], onMismatch: vi.fn() })
    verifier(KEY, verify)

    await vi.waitFor(() => expect(verify).toHaveBeenCalledWith(true))
  })
})
