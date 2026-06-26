// Response serializers that strip secret fields at the API boundary. Secrets
// must never leave the server, including secrets on records nested inside
// relations (e.g. a host's identity).

export function stripSecrets<T extends Record<string, unknown>>(row: T): T {
  const copy: Record<string, unknown> = { ...row }
  delete copy.password
  delete copy.privateKey
  delete copy.passphrase
  return copy as T
}

export function serializeIdentity<T extends Record<string, unknown>>(row: T | null): T | null {
  return row ? stripSecrets(row) : row
}

export function serializeSshKey<T extends Record<string, unknown>>(row: T | null): T | null {
  return row ? stripSecrets(row) : row
}

// Host has no direct secret, but its related identity (when loaded via
// ?relations) does, so redact the nested identity.
export function serializeHost<T extends Record<string, unknown>>(row: T | null): T | null {
  if (!row) return row
  const copy: Record<string, unknown> = { ...row }
  if (copy.identity && typeof copy.identity === 'object') {
    copy.identity = stripSecrets(copy.identity as Record<string, unknown>)
  }
  return copy as T
}
