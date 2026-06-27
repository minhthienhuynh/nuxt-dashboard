// Values used to prefill the key form when importing key files from disk.
export interface KeyFormPrefill {
  label?: string
  keyType?: string
  publicKey?: string
  privateKey?: string
}

// Map an OpenSSH public-key prefix to our keyType enum value.
const PUBLIC_KEY_TYPES: Record<string, string> = {
  'ssh-ed25519': 'ed25519',
  'ssh-rsa': 'rsa',
  'ecdsa-sha2-nistp256': 'ecdsa',
  'ecdsa-sha2-nistp384': 'ecdsa',
  'ecdsa-sha2-nistp521': 'ecdsa'
}

// Infer the key type from a public key's leading algorithm token.
export function detectKeyType(publicKey: string): string | undefined {
  const prefix = publicKey.trim().split(/\s+/)[0]
  return prefix ? PUBLIC_KEY_TYPES[prefix] : undefined
}

// Parse one or more imported key files into form prefill values: a public-key
// file (e.g. `id_ed25519.pub`) fills the public key and infers the key type; a
// private-key file fills the private key. The label defaults to the public key
// file name without `.pub`, otherwise the private key file name. Order-independent.
export function parseImportedKeyFiles(files: Array<{ name: string, content: string }>): KeyFormPrefill {
  const prefill: KeyFormPrefill = {}
  let pubName: string | undefined
  let privName: string | undefined

  for (const file of files) {
    const content = file.content.trim()
    if (/^(ssh-|ecdsa-)/.test(content)) {
      prefill.publicKey = content
      const type = detectKeyType(content)
      if (type) prefill.keyType = type
      pubName = file.name
    } else if (content.includes('PRIVATE KEY')) {
      prefill.privateKey = content
      privName = file.name
    }
  }

  const base = pubName?.replace(/\.pub$/i, '') ?? privName
  if (base) prefill.label = base
  return prefill
}

// Filter keychain entries (SSH keys, identities) by a case-insensitive search.
// `fields` returns the searchable strings for an item, so the same helper serves
// keys (label) and identities (label + username). A blank query returns the list
// unchanged; null/undefined fields are skipped.
export function filterKeychainBySearch<T>(
  items: T[],
  query: string,
  fields: (item: T) => Array<string | null | undefined>
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter(item =>
    fields(item).some(value => value != null && value.toLowerCase().includes(q)))
}
