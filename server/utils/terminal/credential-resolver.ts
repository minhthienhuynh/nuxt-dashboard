import { sshKeyRepository } from '~~/server/utils/repositories/sshKey'
import { decryptSecret } from '~~/server/utils/vault'
import type { ConnectSecrets } from '~~/server/utils/terminal/connect-config'

// Resolves and decrypts the secret material an identity needs to authenticate.
// This is the only place SSH secrets exist in plaintext on the server: the WS
// bridge passes the result straight into buildConnectConfig and never sends it
// to the client. Kept separate from the pure config builder so decryption (an
// I/O + vault concern) stays out of the testable builder.

// The subset of a resolved host this resolver needs. Matches the `identity`
// relation loaded by hostRepository.withRelations.
export interface ResolvableIdentity {
  authType: string
  password?: string | null
  sshKeyId?: string | null
}

// Decrypt the credentials for the host's identity. Returns an empty object when
// the identity is absent or carries no usable secret (buildConnectConfig then
// throws a precise "missing credential" error). Decryption itself can throw
// (missing/rotated VAULT_KEY, malformed ciphertext); the caller guards for it.
export async function resolveSecrets(identity: ResolvableIdentity | null | undefined): Promise<ConnectSecrets> {
  const secrets: ConnectSecrets = {}
  if (!identity) return secrets

  if (identity.authType === 'password' && identity.password) {
    secrets.password = decryptSecret(identity.password)
  } else if (identity.authType === 'key' && identity.sshKeyId) {
    const sshKey = await sshKeyRepository.findById(identity.sshKeyId)
    if (sshKey?.privateKey) {
      secrets.privateKey = decryptSecret(sshKey.privateKey)
      if (sshKey.passphrase) secrets.passphrase = decryptSecret(sshKey.passphrase)
    }
  }
  return secrets
}
