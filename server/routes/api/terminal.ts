import { createHash } from 'node:crypto'
// ssh2 is CommonJS — default-import and use ssh2.Client / ssh2.utils. A named
// ESM import can build but crashes at runtime under Nitro's ESM/CJS interop.
import ssh2 from 'ssh2'
import type { Client, ClientChannel } from 'ssh2'
import { hostRepository } from '~~/server/utils/repositories/host'
import { sshKeyRepository } from '~~/server/utils/repositories/sshKey'
import { prisma } from '~~/server/utils/prisma'
import { decryptSecret } from '~~/server/utils/vault'
import { buildConnectConfig } from '~~/server/utils/terminal/connect-config'
import type { ConnectSecrets } from '~~/server/utils/terminal/connect-config'
import { detectOs } from '~~/server/utils/terminal/os-detect'
import { verifyHostKey } from '~~/server/utils/terminal/host-key'
import { decodeClient, encodeServer } from '~~/server/utils/terminal/protocol'

interface Session {
  client: Client
  stream?: ClientChannel
  historyId?: string
  // True once a 'failed' history row was recorded, so close() does not
  // overwrite it with 'disconnected'.
  failed?: boolean
}

// One independent session per WebSocket peer — multiple tabs open multiple
// peers, so multi-session needs nothing extra here.
const sessions = new Map<object, Session>()

// Clamp an untrusted PTY dimension (from the client) to sane bounds.
function clampPty(value: string | number | null | undefined, fallback: number): number {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n >= 1 ? Math.min(1000, n) : fallback
}

// Run `uname -s` over a one-off exec channel and persist the detected OS on the
// host when it differs from what's stored. Best-effort — any failure (no exec,
// missing `uname`, write error) is swallowed and leaves the stored value as-is.
function detectAndStoreOs(client: Client, hostId: string, currentOs: string | null) {
  // Read /etc/os-release for the distro (Ubuntu/Debian/…); fall back to uname.
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
      const secrets: ConnectSecrets = {}
      if (identity?.authType === 'password' && identity.password) {
        secrets.password = decryptSecret(identity.password)
      } else if (identity?.authType === 'key' && identity.sshKeyId) {
        const sshKey = await sshKeyRepository.findById(identity.sshKeyId)
        if (sshKey?.privateKey) {
          secrets.privateKey = decryptSecret(sshKey.privateKey)
          if (sshKey.passphrase) secrets.passphrase = decryptSecret(sshKey.passphrase)
        }
      }
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
    const session: Session = { client }
    sessions.set(peer, session)

    // Record a failed connection once (with endedAt set), so failed attempts
    // are visible in history and close() leaves the 'failed' status intact.
    const recordFailed = async () => {
      if (session.historyId || session.failed) return
      session.failed = true
      try {
        const row = await prisma.connectionHistory.create({ data: { hostId: host.id, status: 'failed', endedAt: new Date() } })
        session.historyId = row.id
      } catch { /* history is best-effort */ }
    }

    client.on('ready', () => {
      client.shell({ term: 'xterm-256color', cols, rows }, async (err, stream) => {
        if (err) {
          peer.send(encodeServer({ type: 'error', message: err.message }))
          await recordFailed()
          client.end()
          return
        }
        session.stream = stream
        stream.on('data', (chunk: Buffer) => peer.send(encodeServer({ type: 'data', data: chunk.toString('utf8') })))
        stream.on('close', () => {
          peer.send(encodeServer({ type: 'exit' }))
          client.end()
        })
        // OS detection runs a side-channel exec AFTER the shell opens: opening an
        // exec channel first suppresses the login MOTD on Ubuntu (shown only on a
        // connection's first session channel). Best-effort, never blocks the shell.
        detectAndStoreOs(client, host.id, host.os)
        // Record history only once the shell is actually open.
        try {
          const row = await prisma.connectionHistory.create({ data: { hostId: host.id, status: 'success' } })
          session.historyId = row.id
        } catch { /* history is best-effort */ }
      })
    })

    const closePeer = () => {
      try {
        peer.close()
      } catch {
        /* already closed */
      }
    }
    client.on('error', async (err) => {
      peer.send(encodeServer({ type: 'error', message: err.message }))
      await recordFailed()
      closePeer()
    })
    client.on('close', closePeer)

    client.connect({
      ...config,
      // Trust-on-first-use host-key verification against KnownHost.
      hostVerifier: (key: Buffer, verify: (valid: boolean) => void) => {
        const parsed = ssh2.utils.parseKey(key)
        const keyType = parsed instanceof Error ? 'unknown' : parsed.type
        const fingerprint = createHash('sha256').update(key).digest('base64').replace(/=+$/, '')
        const known = host.knownHosts.find(k => k.keyType === keyType)
        const result = verifyHostKey(known?.fingerprint, fingerprint)
        if (result === 'mismatch') {
          peer.send(encodeServer({ type: 'error', message: 'Host key verification failed (fingerprint changed)' }))
          verify(false)
          return
        }
        if (result === 'new') {
          // Await the TOFU write so a persistence failure is surfaced rather
          // than silently leaving the host un-pinned forever.
          prisma.knownHost
            .create({ data: { hostId: host.id, keyType, fingerprint } })
            .then(() => verify(true))
            .catch((e) => {
              console.error('[terminal] failed to persist known host fingerprint:', e)
              verify(true)
            })
          return
        }
        verify(true)
      }
    })
  },

  message(peer, message) {
    const session = sessions.get(peer)
    if (!session?.stream) return
    const msg = decodeClient(message.text())
    if (!msg) return
    if (msg.type === 'input') {
      session.stream.write(msg.data)
    } else if (msg.type === 'resize') {
      // Clamp to sane PTY bounds — the client value is untrusted.
      session.stream.setWindow(clampPty(msg.rows, 24), clampPty(msg.cols, 80), 0, 0)
    }
  },

  async close(peer) {
    const session = sessions.get(peer)
    if (!session) return
    sessions.delete(peer)
    try {
      session.stream?.end()
      session.client.end()
    } catch {
      /* already closed */
    }
    // Only finalize a successful session as 'disconnected'; a 'failed' row
    // already has its endedAt/status set.
    if (session.historyId && !session.failed) {
      await prisma.connectionHistory
        .update({ where: { id: session.historyId }, data: { endedAt: new Date(), status: 'disconnected' } })
        .catch(() => {})
    }
  }
})
