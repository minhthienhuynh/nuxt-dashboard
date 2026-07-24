// ssh2 is CommonJS — default-import and use ssh2.Client. A named ESM import can
// build but crashes at runtime under Nitro's ESM/CJS interop.
import ssh2 from 'ssh2'
import type { Client, SFTPWrapper } from 'ssh2'
import { hostRepository } from '~~/server/utils/repositories/host'
import { buildConnectConfig } from '~~/server/utils/terminal/connect-config'
import { resolveSecrets } from '~~/server/utils/terminal/credential-resolver'
import { createHostKeyVerifier } from '~~/server/utils/terminal/host-key-verifier'

export interface ConnectedSftp {
  client: Client
  sftp: SFTPWrapper
}

// Opens a one-off SFTP subsystem for a single HTTP transfer request, reusing
// the same connect/credential/host-key chain as the WebSocket bridge. Each
// HTTP request gets its own SSH connection — no session reuse across requests
// — so a transfer's lifetime is scoped to the request. Throws 'Unknown host'
// for a missing hostId, or the underlying connect/credential/host-key error
// otherwise; callers map these to an HTTP status.
export async function connectSftp(hostId: string): Promise<ConnectedSftp> {
  const host = await hostRepository.withRelations(hostId)
  if (!host) throw new Error('Unknown host')

  const identity = host.identity
  const secrets = await resolveSecrets(identity)
  const config = buildConnectConfig(
    { address: host.address, port: host.port },
    identity ? { username: identity.username, authType: identity.authType as 'password' | 'key' } : null,
    secrets
  )

  const client = new ssh2.Client()
  let hostKeyError: string | undefined

  return new Promise((resolve, reject) => {
    const fail = (err: Error) => {
      client.end()
      reject(hostKeyError ? new Error(hostKeyError) : err)
    }

    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          fail(err)
          return
        }
        resolve({ client, sftp })
      })
    })
    client.on('error', fail)
    client.connect({
      ...config,
      // Trust-on-first-use host-key verification against KnownHost.
      hostVerifier: createHostKeyVerifier({
        hostId: host.id,
        knownHosts: host.knownHosts,
        onMismatch: (message) => { hostKeyError = message }
      })
    })
  })
}
