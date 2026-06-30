import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { Client, ConnectConfig } from 'ssh2'
import { SshSession, clampPty } from '../../server/utils/terminal/session'
import type { ServerMessage } from '../../shared/terminal-protocol'

// Minimal ssh2 stand-ins. The fake stream is an EventEmitter with the write /
// setWindow / end methods the session calls.
function makeFakeStream() {
  const stream = new EventEmitter() as EventEmitter & {
    write: ReturnType<typeof vi.fn>
    setWindow: ReturnType<typeof vi.fn>
    end: ReturnType<typeof vi.fn>
  }
  stream.write = vi.fn()
  stream.setWindow = vi.fn()
  stream.end = vi.fn()
  return stream
}

interface FakeClient extends EventEmitter {
  shell: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
}

function makeFakeClient(): FakeClient {
  const client = new EventEmitter() as FakeClient
  client.shell = vi.fn()
  client.connect = vi.fn()
  client.end = vi.fn()
  return client
}

function makeHistory() {
  return {
    recordStart: vi.fn(async () => ({ id: 'start-1' })),
    recordFailed: vi.fn(async () => ({ id: 'failed-1' })),
    finish: vi.fn(async () => undefined)
  }
}

function setup(overrides: { stream?: ReturnType<typeof makeFakeStream> | null } = {}) {
  const client = makeFakeClient()
  const stream = overrides.stream === undefined ? makeFakeStream() : overrides.stream
  const sent: ServerMessage[] = []
  const history = makeHistory()
  const closePeer = vi.fn()
  const onShellReady = vi.fn()

  const session = new SshSession({
    client: client as unknown as Client,
    config: {} as ConnectConfig,
    pty: { cols: 100, rows: 30 },
    send: msg => sent.push(msg),
    closePeer,
    history,
    onShellReady
  })

  // Default shell behavior: succeed with the provided stream.
  client.shell.mockImplementation((_opts, cb) => {
    if (stream) cb(null, stream)
  })

  return { session, client, stream, sent, history, closePeer, onShellReady }
}

describe('clampPty', () => {
  it('clamps to bounds and falls back on garbage', () => {
    expect(clampPty('120', 80)).toBe(120)
    expect(clampPty(5000, 80)).toBe(1000)
    expect(clampPty(0, 24)).toBe(24)
    expect(clampPty('nope', 24)).toBe(24)
    expect(clampPty(null, 80)).toBe(80)
  })
})

describe('SshSession', () => {
  it('opens the shell at the requested PTY size on ready', async () => {
    const { session, client } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(client.shell).toHaveBeenCalled())
    expect(client.shell).toHaveBeenCalledWith({ term: 'xterm-256color', cols: 100, rows: 30 }, expect.any(Function))
  })

  it('relays shell data as data frames and becomes ready', async () => {
    const { session, client, stream, sent } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(session.isReady).toBe(true))

    stream!.emit('data', Buffer.from('hello'))
    expect(sent).toContainEqual({ type: 'data', data: 'hello' })
  })

  it('records a success history row once the shell opens', async () => {
    const { session, client, history } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(history.recordStart).toHaveBeenCalledOnce())
    expect(history.recordFailed).not.toHaveBeenCalled()
  })

  it('finalizes a successful session as disconnected on close', async () => {
    const { session, client, history } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(session.isReady).toBe(true))

    await session.close()
    expect(history.finish).toHaveBeenCalledWith('start-1')
  })

  it('records a failed row and does not finish it on close (no downgrade)', async () => {
    const { session, client, sent, history, closePeer } = setup()
    session.start()
    client.emit('error', new Error('connect refused'))
    await vi.waitFor(() => expect(history.recordFailed).toHaveBeenCalledOnce())

    expect(sent).toContainEqual({ type: 'error', message: 'connect refused' })
    await vi.waitFor(() => expect(closePeer).toHaveBeenCalled())

    await session.close()
    // The failed row is terminal — close() must not overwrite it via finish().
    expect(history.finish).not.toHaveBeenCalled()
  })

  it('records a failed row when the shell fails to open', async () => {
    const { session, client, sent, history } = setup({ stream: null })
    client.shell.mockImplementation((_opts, cb) => cb(new Error('shell denied')))
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(history.recordFailed).toHaveBeenCalledOnce())
    expect(sent).toContainEqual({ type: 'error', message: 'shell denied' })
    expect(session.isReady).toBe(false)
  })

  it('writes input and clamps resize values', async () => {
    const { session, client, stream } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(session.isReady).toBe(true))

    session.write('ls\n')
    expect(stream!.write).toHaveBeenCalledWith('ls\n')

    session.resize(5000, 0)
    // setWindow(rows, cols, ...) with clamped values: rows 0 → 24, cols 5000 → 1000.
    expect(stream!.setWindow).toHaveBeenCalledWith(24, 1000, 0, 0)
  })

  it('ignores input before the shell is ready', () => {
    const { session } = setup()
    session.start()
    expect(session.isReady).toBe(false)
    expect(() => session.write('x')).not.toThrow()
  })

  it('emits exit and ends the client when the shell stream closes', async () => {
    const { session, client, stream, sent } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(session.isReady).toBe(true))

    stream!.emit('close')
    expect(sent).toContainEqual({ type: 'exit' })
    expect(client.end).toHaveBeenCalled()
  })

  it('runs the side channel after the shell opens', async () => {
    const { session, client, onShellReady } = setup()
    session.start()
    client.emit('ready')
    await vi.waitFor(() => expect(onShellReady).toHaveBeenCalledOnce())
  })
})
