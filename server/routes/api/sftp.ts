// ssh2 is CommonJS — default-import and use ssh2.Client. A named ESM import can
// build but crashes at runtime under Nitro's ESM/CJS interop.
import ssh2 from 'ssh2'
import { hostRepository } from '~~/server/utils/repositories/host'
import { buildConnectConfig } from '~~/server/utils/terminal/connect-config'
import { resolveSecrets } from '~~/server/utils/terminal/credential-resolver'
import { createHostKeyVerifier } from '~~/server/utils/terminal/host-key-verifier'
import { SftpSession } from '~~/server/utils/terminal/sftp-session'
import { decodeSftpClient, encodeSftpServer } from '#shared/sftp-protocol'

// One independent session per WebSocket peer — multiple tabs open multiple
// peers, so multi-session needs nothing extra here.
const sessions = new Map<object, SftpSession>()

export default defineWebSocketHandler({
  async open(peer) {
    // Use a base so a relative URL still parses (avoids "Invalid URL").
    const rawUrl = peer.request?.url
    const url = rawUrl ? new URL(rawUrl, 'http://localhost') : null
    const hostId = url?.searchParams.get('hostId') ?? null
    const host = hostId ? await hostRepository.withRelations(hostId) : null
    if (!host) {
      peer.send(encodeSftpServer({ type: 'error', message: 'Unknown host' }))
      peer.close()
      return
    }

    // Resolve + decrypt credentials and build the ssh2 config server-side
    // (secrets are never sent to the client). Decryption can throw (missing or
    // rotated VAULT_KEY, malformed ciphertext), so it must be inside the guard.
    let config
    try {
      const identity = host.identity
      const secrets = await resolveSecrets(identity)
      config = buildConnectConfig(
        { address: host.address, port: host.port },
        identity ? { username: identity.username, authType: identity.authType as 'password' | 'key' } : null,
        secrets
      )
    } catch (err) {
      peer.send(encodeSftpServer({ type: 'error', message: (err as Error).message }))
      peer.close()
      return
    }

    const client = new ssh2.Client()
    const closePeer = () => {
      try {
        peer.close()
      } catch {
        /* already closed */
      }
    }

    const session = new SftpSession({
      client,
      config: {
        ...config,
        // Trust-on-first-use host-key verification against KnownHost.
        hostVerifier: createHostKeyVerifier({
          hostId: host.id,
          knownHosts: host.knownHosts,
          onMismatch: message => peer.send(encodeSftpServer({ type: 'error', message }))
        })
      },
      send: msg => peer.send(encodeSftpServer(msg)),
      closePeer
    })
    sessions.set(peer, session)
    session.start()
  },

  async message(peer, message) {
    const session = sessions.get(peer)
    if (!session) return
    const msg = decodeSftpClient(message.text())
    if (!msg) return
    // Dispatch unconditionally: SftpSession queues a request internally when
    // the SFTP subsystem isn't open yet (the control socket connects to this
    // server well before the SSH handshake to the remote host completes), so
    // there is no "not ready" case to drop here.

    if (msg.type === 'list') {
      session.list(msg.requestId, msg.path)
    } else if (msg.type === 'mkdir') {
      session.mkdir(msg.requestId, msg.path)
    } else if (msg.type === 'rename') {
      session.rename(msg.requestId, msg.from, msg.to)
    } else if (msg.type === 'delete') {
      session.delete(msg.requestId, msg.path, msg.isDirectory)
    }
  },

  async close(peer) {
    const session = sessions.get(peer)
    if (!session) return
    sessions.delete(peer)
    session.close()
  }
})
