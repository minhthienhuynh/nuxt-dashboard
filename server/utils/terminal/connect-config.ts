import type { ConnectConfig } from 'ssh2'

// Pure builder for an ssh2 ConnectConfig. Takes the host endpoint, the resolved
// identity, and the already-decrypted secrets (the WS bridge decrypts via the
// vault before calling this — keeping this function pure and testable). Throws
// when the credentials required by the identity's authType are missing.

export interface ConnectHost {
  address: string
  port: number
}

export interface ConnectIdentity {
  username: string
  authType: 'password' | 'key'
}

export interface ConnectSecrets {
  password?: string
  privateKey?: string
  passphrase?: string
}

export function buildConnectConfig(
  host: ConnectHost,
  identity: ConnectIdentity | null,
  secrets: ConnectSecrets
): ConnectConfig {
  if (!identity) throw new Error('Host has no identity to authenticate with')

  const base: ConnectConfig = {
    host: host.address,
    port: host.port,
    username: identity.username
  }

  if (identity.authType === 'key') {
    if (!secrets.privateKey) throw new Error('Key identity is missing a private key')
    return {
      ...base,
      privateKey: secrets.privateKey,
      ...(secrets.passphrase ? { passphrase: secrets.passphrase } : {})
    }
  }

  // password
  if (!secrets.password) throw new Error('Password identity is missing a password')
  return { ...base, password: secrets.password }
}
