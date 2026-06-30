import { createHash } from 'node:crypto'
// ssh2 is CommonJS — default-import and use ssh2.utils. A named ESM import can
// build but crashes at runtime under Nitro's ESM/CJS interop.
import ssh2 from 'ssh2'
import { hostRepository } from '~~/server/utils/repositories/host'
import { verifyHostKey } from '~~/server/utils/terminal/host-key'

// Stored fingerprint per (host, keyType) — the subset of KnownHost this needs.
export interface KnownHostFingerprint {
  keyType: string
  fingerprint: string
}

// What the verifier reports back to its caller so the bridge can surface an
// error and stop, without this module importing the protocol/peer.
export interface HostKeyVerifierDeps {
  hostId: string
  knownHosts: KnownHostFingerprint[]
  // Called on a fingerprint mismatch (TOFU pin changed) before refusing.
  onMismatch: (message: string) => void
}

// Build the ssh2 `hostVerifier` callback. It computes the presented key's
// fingerprint (sha256, base64, unpadded), compares against the pinned value via
// the pure verifyHostKey, refuses on mismatch, and on first sight persists the
// fingerprint through the host aggregate (awaiting the write so a persistence
// failure is surfaced rather than silently leaving the host un-pinned).
export function createHostKeyVerifier(deps: HostKeyVerifierDeps) {
  return (key: Buffer, verify: (valid: boolean) => void) => {
    const parsed = ssh2.utils.parseKey(key)
    const keyType = parsed instanceof Error ? 'unknown' : parsed.type
    const fingerprint = createHash('sha256').update(key).digest('base64').replace(/=+$/, '')
    const known = deps.knownHosts.find(k => k.keyType === keyType)
    const result = verifyHostKey(known?.fingerprint, fingerprint)

    if (result === 'mismatch') {
      deps.onMismatch('Host key verification failed (fingerprint changed)')
      verify(false)
      return
    }
    if (result === 'new') {
      hostRepository
        .addKnownHost(deps.hostId, keyType, fingerprint)
        .then(() => verify(true))
        .catch((e) => {
          console.error('[terminal] failed to persist known host fingerprint:', e)
          verify(true)
        })
      return
    }
    verify(true)
  }
}
