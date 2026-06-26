import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// AES-256-GCM vault for SSH secrets at rest. The master key comes from the
// VAULT_KEY env var (base64-encoded 32 bytes). The ciphertext format is
// self-describing — "v1:<iv>:<tag>:<ct>" (all base64) — so the algorithm can
// be revised later without breaking existing values. The key is read per call
// (not cached) so it is never held in memory longer than needed.
const VERSION = 'v1'

function masterKey(): Buffer {
  const raw = process.env.VAULT_KEY
  if (!raw) throw new Error('VAULT_KEY is not set — cannot encrypt or decrypt secrets')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('VAULT_KEY must decode to 32 bytes (base64 of a 256-bit key)')
  return key
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decryptSecret(value: string): string {
  const [version, ivB64, tagB64, ctB64] = value.split(':')
  if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Malformed or unsupported ciphertext')
  }
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
}
