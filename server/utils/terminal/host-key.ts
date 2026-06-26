// Trust-on-first-use host-key decision. Pure: the WS bridge looks up the stored
// fingerprint (per host + key type) and persists on 'new'; this only decides.
export function verifyHostKey(
  known: string | null | undefined,
  presentedFingerprint: string
): 'new' | 'match' | 'mismatch' {
  if (!known) return 'new'
  return known === presentedFingerprint ? 'match' : 'mismatch'
}
