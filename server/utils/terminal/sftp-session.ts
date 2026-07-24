import type { Client, ConnectConfig, SFTPWrapper, Stats } from 'ssh2'
import type { SftpEntry, SftpEntryType, SftpServerMessage } from '#shared/sftp-protocol'

export interface SftpSessionDeps {
  client: Client
  // ssh2 connect config, including the hostVerifier callback.
  config: ConnectConfig
  // Relay a server frame to the peer.
  send: (msg: SftpServerMessage) => void
  // Close the underlying transport (peer).
  closePeer: () => void
}

function statsToType(stats: Stats): SftpEntryType {
  if (stats.isDirectory()) return 'directory'
  if (stats.isSymbolicLink()) return 'symlink'
  if (stats.isFile()) return 'file'
  return 'other'
}

// Owns one SFTP session's lifecycle over an ssh2.Client. Mirrors SshSession's
// shape (deps-injected client+config, start()/close()) but opens client.sftp()
// instead of client.shell() and exposes directory/file operations correlated by
// requestId instead of a single interactive stream.
export class SftpSession {
  private readonly deps: SftpSessionDeps
  private sftp?: SFTPWrapper
  // Requests that arrive before the SFTP subsystem finishes opening (the
  // control WebSocket connects to this server almost instantly, well before
  // the SSH handshake to the remote host completes) are queued here in order
  // and replayed once ready, rather than dropped — every request expects
  // exactly one reply, so silently ignoring an early one would leave the
  // caller's promise unresolved forever.
  private pending: (() => void)[] = []

  constructor(deps: SftpSessionDeps) {
    this.deps = deps
  }

  start() {
    const { client, config, send } = this.deps

    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          send({ type: 'error', message: err.message })
          client.end()
          return
        }
        this.sftp = sftp
        const queued = this.pending
        this.pending = []
        for (const run of queued) run()
      })
    })

    client.on('error', (err) => {
      send({ type: 'error', message: err.message })
      this.deps.closePeer()
    })
    client.on('close', () => this.deps.closePeer())

    client.connect(config)
  }

  // True once the SFTP subsystem is open and operations can be issued.
  get isReady(): boolean {
    return Boolean(this.sftp)
  }

  list(requestId: string, path: string) {
    this.withSftp(requestId, (sftp) => {
      // Resolve to an absolute path first (the initial request may send a
      // relative path like '.' for the SFTP default directory) so the client
      // always receives an absolute path to build the breadcrumb and child
      // paths from.
      sftp.realpath(path, (realErr, absPath) => {
        if (realErr) {
          this.deps.send({ type: 'error', requestId, message: realErr.message })
          return
        }
        sftp.readdir(absPath, (err, list) => {
          if (err) {
            this.deps.send({ type: 'error', requestId, message: err.message })
            return
          }
          const entries: SftpEntry[] = list.map(e => ({
            name: e.filename,
            type: statsToType(e.attrs),
            size: e.attrs.size,
            mtime: e.attrs.mtime,
            mode: e.attrs.mode
          }))
          this.deps.send({ type: 'listing', requestId, path: absPath, entries })
        })
      })
    })
  }

  mkdir(requestId: string, path: string) {
    this.withSftp(requestId, sftp => sftp.mkdir(path, err => this.reportResult(requestId, err)))
  }

  rename(requestId: string, from: string, to: string) {
    this.withSftp(requestId, sftp => sftp.rename(from, to, err => this.reportResult(requestId, err)))
  }

  delete(requestId: string, path: string, isDirectory: boolean) {
    this.withSftp(requestId, (sftp) => {
      const cb = (err: Error | null | undefined) => this.reportResult(requestId, err)
      if (isDirectory) {
        sftp.rmdir(path, cb)
      } else {
        sftp.unlink(path, cb)
      }
    })
  }

  // Run an operation against the live SFTP subsystem, or queue it when the
  // subsystem isn't open yet — see the `pending` field for why requests are
  // queued rather than dropped or errored. If the subsystem never opens (the
  // connection fails or closes first), the WebSocket close on the caller's end
  // settles the request instead; nothing further is needed here.
  private withSftp(requestId: string, fn: (sftp: SFTPWrapper) => void) {
    if (!this.sftp) {
      this.pending.push(() => this.withSftp(requestId, fn))
      return
    }
    fn(this.sftp)
  }

  private reportResult(requestId: string, err: Error | null | undefined) {
    if (err) {
      this.deps.send({ type: 'error', requestId, message: err.message })
      return
    }
    this.deps.send({ type: 'ok', requestId })
  }

  // Tear down the session: close the SFTP subsystem and end the SSH client.
  close() {
    try {
      this.sftp?.end()
      this.deps.client.end()
    } catch {
      /* already closed */
    }
  }
}
