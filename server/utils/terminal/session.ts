import type { Client, ClientChannel, ConnectConfig } from 'ssh2'
import type { ServerMessage } from '#shared/terminal-protocol'

// Clamp an untrusted PTY dimension (from the client) to sane bounds.
export function clampPty(value: string | number | null | undefined, fallback: number): number {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n >= 1 ? Math.min(1000, n) : fallback
}

// Records a session's lifecycle in connection history. Backed by the host
// aggregate (hostRepository) in production; injected so the session is testable
// without a database.
export interface HistoryRecorder {
  recordStart: () => Promise<{ id: string }>
  recordFailed: () => Promise<{ id: string }>
  finish: (historyId: string) => Promise<unknown>
}

export interface SshSessionDeps {
  client: Client
  // ssh2 connect config, including the hostVerifier callback.
  config: ConnectConfig
  pty: { cols: number, rows: number }
  // Relay a server frame to the peer.
  send: (msg: ServerMessage) => void
  // Close the underlying transport (peer).
  closePeer: () => void
  history: HistoryRecorder
  // Best-effort side channel run AFTER the shell opens (e.g. OS detection).
  onShellReady?: (client: Client) => void
}

type Status = 'connecting' | 'connected' | 'closed' | 'error' | 'failed'

// Owns one SSH session's lifecycle and its status invariants. The bridge wires
// a WebSocket peer to an instance: start() on open, write()/resize() on message,
// close() on socket close. Pulling this out of the route keeps the route a thin
// adapter and puts the "a failed row is never overwritten by disconnected"
// invariant in one place.
export class SshSession {
  private readonly deps: SshSessionDeps
  private stream?: ClientChannel
  private historyId?: string
  private status: Status = 'connecting'
  // True once a 'failed' history row was recorded, so close() does not overwrite
  // it with 'disconnected'.
  private failed = false

  constructor(deps: SshSessionDeps) {
    this.deps = deps
  }

  // Wire up the ssh2 client and initiate the connection.
  start() {
    const { client, config, pty, send } = this.deps

    client.on('ready', () => {
      client.shell({ term: 'xterm-256color', cols: pty.cols, rows: pty.rows }, async (err, stream) => {
        if (err) {
          send({ type: 'error', message: err.message })
          await this.recordFailed()
          client.end()
          return
        }
        this.status = 'connected'
        this.stream = stream
        stream.on('data', (chunk: Buffer) => send({ type: 'data', data: chunk.toString('utf8') }))
        stream.on('close', () => {
          send({ type: 'exit' })
          client.end()
        })
        // OS detection runs a side-channel exec AFTER the shell opens: opening an
        // exec channel first suppresses the login MOTD on Ubuntu (shown only on a
        // connection's first session channel). Best-effort, never blocks the shell.
        this.deps.onShellReady?.(client)
        // Record history only once the shell is actually open.
        try {
          const row = await this.deps.history.recordStart()
          this.historyId = row.id
        } catch { /* history is best-effort */ }
      })
    })

    client.on('error', async (err) => {
      this.status = 'error'
      send({ type: 'error', message: err.message })
      await this.recordFailed()
      this.deps.closePeer()
    })
    client.on('close', () => this.deps.closePeer())

    client.connect(config)
  }

  // Forward a client keystroke to the shell.
  write(data: string) {
    this.stream?.write(data)
  }

  // Apply a resize to the PTY. Values are untrusted → clamped.
  resize(cols: number, rows: number) {
    this.stream?.setWindow(clampPty(rows, 24), clampPty(cols, 80), 0, 0)
  }

  // True once the shell is open and input can be written.
  get isReady(): boolean {
    return Boolean(this.stream)
  }

  // Tear down the session. Only a successful session is finalized as
  // 'disconnected'; a 'failed' row already has its endedAt/status set.
  async close() {
    this.status = 'closed'
    try {
      this.stream?.end()
      this.deps.client.end()
    } catch {
      /* already closed */
    }
    if (this.historyId && !this.failed) {
      await this.deps.history.finish(this.historyId).catch(() => {})
    }
  }

  // Record a failed connection once (with endedAt set), so failed attempts are
  // visible in history and close() leaves the 'failed' status intact. A no-op
  // once the shell opened (historyId set) or once already recorded.
  private async recordFailed() {
    if (this.historyId || this.failed) return
    this.failed = true
    this.status = 'failed'
    try {
      const row = await this.deps.history.recordFailed()
      this.historyId = row.id
    } catch { /* history is best-effort */ }
  }
}
