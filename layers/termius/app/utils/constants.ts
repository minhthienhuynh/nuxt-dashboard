// Shared UI constants for the SSH manager forms and lists.

// Reka UI (USelect) forbids an empty-string item value (reserved for clearing),
// so the "none" option uses a non-empty sentinel — real values are UUIDs or a
// fixed enum, so it never collides.
export const SELECT_NONE = 'none'

// Authentication methods offered by the host and identity forms (SSH agent is
// not supported). Typed so the value narrows to the Identity authType union.
export const AUTH_TYPE_ITEMS: { label: string, value: 'password' | 'key' }[] = [
  { label: 'Password', value: 'password' },
  { label: 'Key', value: 'key' }
]

// SSH key types offered by the keychain key form.
export const KEY_TYPE_ITEMS = [
  { label: 'ed25519', value: 'ed25519' },
  { label: 'rsa', value: 'rsa' },
  { label: 'ecdsa', value: 'ecdsa' }
]
