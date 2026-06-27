import { describe, expect, it } from 'vitest'
import { detectKeyType, filterKeychainBySearch, parseImportedKeyFiles } from '../../layers/termius/app/utils/keychain'

interface Row { id: string, label: string | null, username?: string }

const rows: Row[] = [
  { id: 'k1', label: 'Prod key', username: 'deploy' },
  { id: 'k2', label: 'Laptop', username: 'root' },
  { id: 'k3', label: null, username: 'admin' }
]

describe('filterKeychainBySearch', () => {
  it('matches a field (case-insensitive)', () => {
    expect(filterKeychainBySearch(rows, 'PROD', r => [r.label]).map(r => r.id)).toEqual(['k1'])
  })

  it('searches across multiple fields and skips null ones', () => {
    expect(filterKeychainBySearch(rows, 'admin', r => [r.label, r.username]).map(r => r.id)).toEqual(['k3'])
  })

  it('blank query returns the full list unchanged', () => {
    expect(filterKeychainBySearch(rows, '   ', r => [r.label])).toHaveLength(3)
    expect(filterKeychainBySearch(rows, '', r => [r.label])).toHaveLength(3)
  })
})

describe('detectKeyType', () => {
  it('maps OpenSSH public-key prefixes to key types', () => {
    expect(detectKeyType('ssh-ed25519 AAAAC3Nza...')).toBe('ed25519')
    expect(detectKeyType('ssh-rsa AAAAB3Nza...')).toBe('rsa')
    expect(detectKeyType('ecdsa-sha2-nistp256 AAAA...')).toBe('ecdsa')
  })

  it('returns undefined for an unknown prefix', () => {
    expect(detectKeyType('not-a-key blob')).toBeUndefined()
  })
})

describe('parseImportedKeyFiles', () => {
  it('fills public key, infers type, and labels from the .pub file name', () => {
    const result = parseImportedKeyFiles([
      { name: 'id_ed25519.pub', content: 'ssh-ed25519 AAAAC3Nza... user@host\n' }
    ])
    expect(result.publicKey).toBe('ssh-ed25519 AAAAC3Nza... user@host')
    expect(result.keyType).toBe('ed25519')
    expect(result.label).toBe('id_ed25519')
  })

  it('fills the private key from a private-key file', () => {
    const priv = '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----'
    const result = parseImportedKeyFiles([{ name: 'id_ed25519', content: priv }])
    expect(result.privateKey).toBe(priv)
    expect(result.label).toBe('id_ed25519')
  })

  it('combines a public + private pair regardless of order, preferring the .pub label', () => {
    const priv = '-----BEGIN OPENSSH PRIVATE KEY-----\nx\n-----END OPENSSH PRIVATE KEY-----'
    const result = parseImportedKeyFiles([
      { name: 'mykey', content: priv },
      { name: 'mykey.pub', content: 'ssh-rsa AAAAB3Nza...' }
    ])
    expect(result.privateKey).toBe(priv)
    expect(result.publicKey).toBe('ssh-rsa AAAAB3Nza...')
    expect(result.keyType).toBe('rsa')
    expect(result.label).toBe('mykey')
  })
})
