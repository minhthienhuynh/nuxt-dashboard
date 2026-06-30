// ssh2 is CommonJS — default-import and use ssh2.Client. A named ESM import can
// build but crashes at runtime under Nitro's ESM/CJS interop.
import ssh2 from 'ssh2'
import type { Client } from 'ssh2'
import { hostRepository } from '~~/server/utils/repositories/host'
import { buildConnectConfig } from '~~/server/utils/terminal/connect-config'
import { resolveSecrets } from '~~/server/utils/terminal/credential-resolver'
import { detectOs } from '~~/server/utils/terminal/os-detect'
import { createHostKeyVerifier } from '~~/server/utils/terminal/host-key-verifier'
import { SshSession, clampPty } from '~~/server/utils/terminal/session'
import { decodeClient, encodeServer } from '#shared/terminal-protocol'

// One independent session per WebSocket peer — multiple tabs open multiple
// peers, so multi-session needs nothing extra here.
const sessions = new Map<object, SshSession>()

// Run `cat /etc/os-release || uname -s` over a one-off exec channel and persist
// the detected OS on the host when it differs. Best-effort — any failure (no
// exec, missing command, write error) is swallowed and leaves the value as-is.
function detectAndStoreOs(client: Client, hostId: string, currentOs: string | null) {
  client.exec('cat /etc/os-release 2>/dev/null || uname -s', (err, stream) => {
    if (err) return
    let out = ''
    stream.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8')
    })
    stream.on('close', () => {
      const os = detectOs(out)
      if (os && os !== currentOs) {
        hostRepository.update(hostId, { os }).catch(() => { /* best-effort */ })
      }
    })
  })
}

export default defineWebSocketHandler({
  async open(peer) {
    // Use a base so a relative URL still parses (avoids "Invalid URL").
    const rawUrl = peer.request?.url
    const url = rawUrl ? new URL(rawUrl, 'http://localhost') : null
    const hostId = url?.searchParams.get('hostId') ?? null
    // Initial PTY size from the client (untrusted → clamp). Opening the shell at
    // the right size avoids the resize-after-connect race that would otherwise
    // leave the PTY at its 80x24 default.
    const cols = clampPty(url?.searchParams.get('cols'), 80)
    const rows = clampPty(url?.searchParams.get('rows'), 24)
    const host = hostId ? await hostRepository.withRelations(hostId) : null
    if (!host) {
      peer.send(encodeServer({ type: 'error', message: 'Unknown host' }))
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
      peer.send(encodeServer({ type: 'error', message: (err as Error).message }))
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

    const session = new SshSession({
      client,
      config: {
        ...config,
        // Trust-on-first-use host-key verification against KnownHost.
        hostVerifier: createHostKeyVerifier({
          hostId: host.id,
          knownHosts: host.knownHosts,
          onMismatch: message => peer.send(encodeServer({ type: 'error', message }))
        })
      },
      pty: { cols, rows },
      send: msg => peer.send(encodeServer(msg)),
      closePeer,
      history: {
        recordStart: () => hostRepository.recordConnectionStart(host.id),
        recordFailed: () => hostRepository.recordConnectionFailed(host.id),
        finish: historyId => hostRepository.finishConnection(historyId)
      },
      onShellReady: c => detectAndStoreOs(c, host.id, host.os)
    })
    sessions.set(peer, session)
    session.start()
  },

  message(peer, message) {
    const session = sessions.get(peer)
    if (!session?.isReady) return
    const msg = decodeClient(message.text())
    if (!msg) return
    if (msg.type === 'input') {
      session.write(msg.data)
    } else if (msg.type === 'resize') {
      session.resize(msg.cols, msg.rows)
    }
  },

  async close(peer) {
    const session = sessions.get(peer)
    if (!session) return
    sessions.delete(peer)
    await session.close()
  }
})
