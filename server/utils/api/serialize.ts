// Response serializers that strip secret fields at the API boundary. Secrets
// must never leave the server, including secrets on records nested inside
// relations (e.g. a host's identity, or an identity's ssh key).

const SECRET_KEYS = ['password', 'privateKey', 'passphrase']

// A Prisma row is a plain object; Date columns are Date instances and must be
// passed through untouched (recursing into them would corrupt them).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
    && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
}

// Recursively remove secret fields at every level so a secret nested inside a
// relation can never leak, regardless of how deep the row is loaded.
export function stripSecrets<T>(row: T): T {
  if (Array.isArray(row)) return row.map(item => stripSecrets(item)) as T
  if (!isPlainObject(row)) return row
  const copy: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (SECRET_KEYS.includes(key)) continue
    copy[key] = stripSecrets(value)
  }
  return copy as T
}

// Null-safe wrapper shared by every serializer (the recursive strip already
// covers nested relations, so hosts/identities/ssh-keys all use the same one).
function redactRow<T extends Record<string, unknown>>(row: T | null): T | null {
  return row ? stripSecrets(row) : row
}

export const serializeIdentity = redactRow
export const serializeSshKey = redactRow
export const serializeHost = redactRow
