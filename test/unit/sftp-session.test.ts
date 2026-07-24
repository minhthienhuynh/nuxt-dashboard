import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { Client, ConnectConfig, SFTPWrapper } from 'ssh2'
import { SftpSession } from '../../server/utils/terminal/sftp-session'
import type { SftpServerMessage } from '../../shared/sftp-protocol'

// Minimal ssh2 SFTPWrapper stand-in — just the methods SftpSession calls.
function makeFakeSftp() {
  return {
    realpath: vi.fn((path: string, cb: (err: Error | undefined, absPath: string) => void) =>
      cb(undefined, path === '.' ? '/home/user' : path)),
    readdir: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn(),
    end: vi.fn()
  }
}

function makeStats(overrides: { dir?: boolean, symlink?: boolean, size?: number, mtime?: number, mode?: number } = {}) {
  return {
    isDirectory: () => Boolean(overrides.dir),
    isFile: () => !overrides.dir && !overrides.symlink,
    isSymbolicLink: () => Boolean(overrides.symlink),
    size: overrides.size ?? 0,
    mtime: overrides.mtime ?? 0,
    mode: overrides.mode ?? 0
  }
}

interface FakeClient extends EventEmitter {
  sftp: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
}

function makeFakeClient(): FakeClient {
  const client = new EventEmitter() as FakeClient
  client.sftp = vi.fn()
  client.connect = vi.fn()
  client.end = vi.fn()
  return client
}

function setup(overrides: { sftp?: ReturnType<typeof makeFakeSftp> | null } = {}) {
  const client = makeFakeClient()
  const sftp = overrides.sftp === undefined ? makeFakeSftp() : overrides.sftp
  const sent: SftpServerMessage[] = []
  const closePeer = vi.fn()

  const session = new SftpSession({
    client: client as unknown as Client,
    config: {} as ConnectConfig,
    send: msg => sent.push(msg),
    closePeer
  })

  // Default sftp() behavior: succeed with the provided fake wrapper.
  client.sftp.mockImplementation((cb: (err: Error | undefined, sftp: SFTPWrapper) => void) => {
    if (sftp) cb(undefined, sftp as unknown as SFTPWrapper)
  })

  return { session, client, sftp, sent, closePeer }
}

describe('SftpSession', () => {
  it('opens the SFTP subsystem on ready and becomes ready', async () => {
    const { session, client } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(client.sftp).toHaveBeenCalled())
    expect(session.isReady).toBe(true)
    expect(client.connect).toHaveBeenCalled()
  })

  it('resolves the path via realpath and maps readdir entries to SftpEntry', async () => {
    const { session, client, sftp, sent } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(session.isReady).toBe(true))

    sftp.readdir.mockImplementation((_path: string, cb: (err: undefined, list: unknown[]) => void) => {
      cb(undefined, [
        { filename: 'docs', longname: '', attrs: makeStats({ dir: true, mtime: 100, mode: 0o755 }) },
        { filename: 'readme.txt', longname: '', attrs: makeStats({ size: 42, mtime: 200, mode: 0o644 }) }
      ])
    })

    session.list('r1', '.')
    await vi.waitFor(() => expect(sent).toContainEqual(expect.objectContaining({ type: 'listing', requestId: 'r1' })))

    expect(sftp.realpath).toHaveBeenCalledWith('.', expect.any(Function))
    expect(sftp.readdir).toHaveBeenCalledWith('/home/user', expect.any(Function))
    expect(sent).toContainEqual({
      type: 'listing',
      requestId: 'r1',
      path: '/home/user',
      entries: [
        { name: 'docs', type: 'directory', size: 0, mtime: 100, mode: 0o755 },
        { name: 'readme.txt', type: 'file', size: 42, mtime: 200, mode: 0o644 }
      ]
    })
  })

  it('reports a per-request error on readdir failure without closing the session', async () => {
    const { session, client, sftp, sent, closePeer } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(session.isReady).toBe(true))

    sftp.readdir.mockImplementation((_path: string, cb: (err: Error) => void) => cb(new Error('permission denied')))

    session.list('r1', '/root')
    await vi.waitFor(() => expect(sent).toContainEqual({ type: 'error', requestId: 'r1', message: 'permission denied' }))
    expect(session.isReady).toBe(true)
    expect(closePeer).not.toHaveBeenCalled()
  })

  it('reports a per-request error on realpath failure', async () => {
    const { session, client, sftp, sent } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(session.isReady).toBe(true))

    sftp.realpath.mockImplementation((_path: string, cb: (err: Error) => void) => cb(new Error('no such file')))

    session.list('r1', '/missing')
    await vi.waitFor(() => expect(sent).toContainEqual({ type: 'error', requestId: 'r1', message: 'no such file' }))
    expect(sftp.readdir).not.toHaveBeenCalled()
  })

  it('resolves mkdir/rename/delete to ok on success', async () => {
    const { session, client, sftp, sent } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(session.isReady).toBe(true))

    sftp.mkdir.mockImplementation((_p: string, cb: (err?: Error) => void) => cb())
    sftp.rename.mockImplementation((_f: string, _t: string, cb: (err?: Error) => void) => cb())
    sftp.unlink.mockImplementation((_p: string, cb: (err?: Error) => void) => cb())
    sftp.rmdir.mockImplementation((_p: string, cb: (err?: Error) => void) => cb())

    session.mkdir('r1', '/tmp/new')
    session.rename('r2', '/a', '/b')
    session.delete('r3', '/file.txt', false)
    session.delete('r4', '/dir', true)

    await vi.waitFor(() => expect(sent).toHaveLength(4))
    expect(sent).toContainEqual({ type: 'ok', requestId: 'r1' })
    expect(sent).toContainEqual({ type: 'ok', requestId: 'r2' })
    expect(sent).toContainEqual({ type: 'ok', requestId: 'r3' })
    expect(sent).toContainEqual({ type: 'ok', requestId: 'r4' })
    expect(sftp.unlink).toHaveBeenCalledWith('/file.txt', expect.any(Function))
    expect(sftp.rmdir).toHaveBeenCalledWith('/dir', expect.any(Function))
  })

  it('reports a per-request error when a mutation fails, without closing the session', async () => {
    const { session, client, sftp, sent, closePeer } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(session.isReady).toBe(true))

    sftp.mkdir.mockImplementation((_p: string, cb: (err?: Error) => void) => cb(new Error('exists')))

    session.mkdir('r1', '/tmp/dup')
    await vi.waitFor(() => expect(sent).toContainEqual({ type: 'error', requestId: 'r1', message: 'exists' }))
    expect(session.isReady).toBe(true)
    expect(closePeer).not.toHaveBeenCalled()
  })

  it('queues an operation issued before the SFTP subsystem opens and replays it once ready', async () => {
    const { session, client, sftp, sent } = setup()
    sftp.readdir.mockImplementation((_path: string, cb: (err: undefined, list: unknown[]) => void) => cb(undefined, []))
    session.start()

    // Issued before 'ready' fires — the control WebSocket to this server opens
    // well before the SSH handshake to the remote host completes, so a request
    // this early must not be dropped (it would leave the caller's promise
    // unresolved forever).
    session.list('r1', '.')
    expect(sftp.realpath).not.toHaveBeenCalled()
    expect(sent).toHaveLength(0)

    client.emit('ready')
    await vi.waitFor(() => expect(sent).toContainEqual(expect.objectContaining({ type: 'listing', requestId: 'r1' })))
    expect(sftp.realpath).toHaveBeenCalledWith('.', expect.any(Function))
  })

  it('replays multiple queued operations in order once ready', async () => {
    const { session, client, sftp, sent } = setup()
    session.start()

    sftp.mkdir.mockImplementation((_p: string, cb: (err?: Error) => void) => cb())
    session.mkdir('r1', '/tmp/a')
    session.mkdir('r2', '/tmp/b')
    expect(sftp.mkdir).not.toHaveBeenCalled()

    client.emit('ready')
    await vi.waitFor(() => expect(sent).toHaveLength(2))
    expect(sent).toEqual([{ type: 'ok', requestId: 'r1' }, { type: 'ok', requestId: 'r2' }])
  })

  it('sends an error and ends the client when opening the SFTP subsystem fails', async () => {
    const { session, client, sent } = setup({ sftp: null })
    client.sftp.mockImplementation((cb: (err: Error) => void) => cb(new Error('sftp denied')))
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(sent).toContainEqual({ type: 'error', message: 'sftp denied' }))
    expect(session.isReady).toBe(false)
    expect(client.end).toHaveBeenCalled()
  })

  it('sends an error and closes the peer on a client error', () => {
    const { session, client, sent, closePeer } = setup()
    session.start()
    client.emit('error', new Error('connect refused'))
    expect(sent).toContainEqual({ type: 'error', message: 'connect refused' })
    expect(closePeer).toHaveBeenCalled()
  })

  it('closes the peer when the client closes', () => {
    const { session, client, closePeer } = setup()
    session.start()
    client.emit('close')
    expect(closePeer).toHaveBeenCalled()
  })

  it('close() ends the SFTP subsystem and the SSH client', async () => {
    const { session, client, sftp } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(session.isReady).toBe(true))

    session.close()
    expect(sftp.end).toHaveBeenCalled()
    expect(client.end).toHaveBeenCalled()
  })
})
