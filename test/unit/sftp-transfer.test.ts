import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client, SFTPWrapper } from 'ssh2'
import downloadHandler from '../../server/api/sftp/download.get'
import uploadHandler from '../../server/api/sftp/upload.post'
import * as sftpConnect from '../../server/utils/terminal/sftp-connect'
import { mockH3Event } from './h3-event'

// Fake Node response/request: EventEmitter-based stand-ins so the handlers'
// stream wiring (res.on('close', ...), req.pipe(writeStream)) works without a
// real socket. h3's sendStream() resolves immediately when res.socket is
// falsy, so no real socket is needed for these tests.
function fakeRes() {
  const res = new EventEmitter() as EventEmitter & {
    setHeader: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
    destroyed: boolean
  }
  res.setHeader = vi.fn()
  res.destroyed = false
  res.destroy = vi.fn(() => {
    res.destroyed = true
  })
  return res
}

function fakeReq() {
  const req = new EventEmitter() as EventEmitter & { pipe: ReturnType<typeof vi.fn> }
  req.pipe = vi.fn()
  return req
}

function eventFor(path: string, opts: { method?: string } = {}) {
  const event = mockH3Event({ method: opts.method, path })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(event as any).node = { req: fakeReq(), res: fakeRes() }
  return event
}

describe('sftp transfer endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects a download request missing hostId or path with 400, before connecting', async () => {
    const spy = vi.spyOn(sftpConnect, 'connectSftp')
    await expect(downloadHandler(eventFor('/api/sftp/download?path=%2Fetc%2Fpasswd')))
      .rejects.toMatchObject({ statusCode: 400 })
    await expect(downloadHandler(eventFor('/api/sftp/download?hostId=abc')))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects an upload request missing hostId or path with 400, before connecting', async () => {
    const spy = vi.spyOn(sftpConnect, 'connectSftp')
    await expect(uploadHandler(eventFor('/api/sftp/upload?path=%2Fetc%2Fpasswd', { method: 'POST' })))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(spy).not.toHaveBeenCalled()
  })

  it('maps an unknown host to 404', async () => {
    vi.spyOn(sftpConnect, 'connectSftp').mockRejectedValue(new Error('Unknown host'))
    await expect(downloadHandler(eventFor('/api/sftp/download?hostId=missing&path=%2Fetc%2Fpasswd')))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('passes the requested path through to createReadStream unchanged — a remote SFTP path, never resolved against the local filesystem', async () => {
    const requestedPath = '/etc/passwd'
    const stream = new EventEmitter()
    const createReadStream = vi.fn(() => {
      // Emit asynchronously so the handler's .once() listeners (attached right
      // after this call returns) are in place before the event fires.
      process.nextTick(() => stream.emit('ready'))
      return stream
    })
    vi.spyOn(sftpConnect, 'connectSftp').mockResolvedValue({
      client: { end: vi.fn() } as unknown as Client,
      sftp: { createReadStream } as unknown as SFTPWrapper
    })

    await downloadHandler(eventFor(`/api/sftp/download?hostId=host-1&path=${encodeURIComponent(requestedPath)}`))

    // The exact string round-trips to the remote SFTP call — no node:path
    // join/resolve against any local directory happened in between.
    expect(createReadStream).toHaveBeenCalledWith(requestedPath)
  })

  it('destroys the response and ends the client when the read stream errors mid-transfer', async () => {
    const stream = new EventEmitter()
    const createReadStream = vi.fn(() => {
      process.nextTick(() => stream.emit('ready'))
      return stream
    })
    const endSpy = vi.fn()
    vi.spyOn(sftpConnect, 'connectSftp').mockResolvedValue({
      client: { end: endSpy } as unknown as Client,
      sftp: { createReadStream } as unknown as SFTPWrapper
    })

    const event = eventFor('/api/sftp/download?hostId=host-1&path=%2Fvar%2Flog%2Fapp.log')
    await downloadHandler(event)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (event as any).node.res as EventEmitter & { destroy: ReturnType<typeof vi.fn> }
    // Simulates a failure after headers were already sent — e.g. the remote
    // connection drops partway through the transfer.
    stream.emit('error', new Error('connection lost'))

    expect(res.destroy).toHaveBeenCalled()
    expect(endSpy).toHaveBeenCalled()
  })

  it('passes the requested path through to createWriteStream unchanged and pipes the raw request body', async () => {
    const requestedPath = '/var/www/app/../../etc/shadow'
    const writeStream = new EventEmitter()
    const createWriteStream = vi.fn(() => writeStream)
    vi.spyOn(sftpConnect, 'connectSftp').mockResolvedValue({
      client: { end: vi.fn() } as unknown as Client,
      sftp: { createWriteStream } as unknown as SFTPWrapper
    })

    const event = eventFor(`/api/sftp/upload?hostId=host-1&path=${encodeURIComponent(requestedPath)}`, { method: 'POST' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = (event as any).node.req as EventEmitter & { pipe: ReturnType<typeof vi.fn> }
    req.pipe.mockImplementation(() => {
      process.nextTick(() => writeStream.emit('close'))
    })

    const result = await uploadHandler(event)

    // The path (even one containing traversal segments) is handed to ssh2
    // verbatim — it addresses the remote host's filesystem, not the server's,
    // so there is nothing to sanitize against a local base directory here.
    expect(createWriteStream).toHaveBeenCalledWith(requestedPath)
    expect(req.pipe).toHaveBeenCalledWith(writeStream)
    expect(result).toEqual({ ok: true })
  })

  it('rejects an upload when the remote write stream errors, without buffering the body first', async () => {
    const writeStream = new EventEmitter()
    const createWriteStream = vi.fn(() => writeStream)
    vi.spyOn(sftpConnect, 'connectSftp').mockResolvedValue({
      client: { end: vi.fn() } as unknown as Client,
      sftp: { createWriteStream } as unknown as SFTPWrapper
    })

    const event = eventFor('/api/sftp/upload?hostId=host-1&path=%2Froot%2Fdenied.txt', { method: 'POST' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = (event as any).node.req as EventEmitter & { pipe: ReturnType<typeof vi.fn> }
    req.pipe.mockImplementation(() => {
      process.nextTick(() => writeStream.emit('error', new Error('permission denied')))
    })

    await expect(uploadHandler(event)).rejects.toMatchObject({ statusCode: 502 })
  })

  it('ends the client and rejects upload when the client closes the connection during upload', async () => {
    const writeStream = new EventEmitter()
    const createWriteStream = vi.fn(() => writeStream)
    const endSpy = vi.fn()
    vi.spyOn(sftpConnect, 'connectSftp').mockResolvedValue({
      client: { end: endSpy } as unknown as Client,
      sftp: { createWriteStream } as unknown as SFTPWrapper
    })

    const event = eventFor('/api/sftp/upload?hostId=host-1&path=%2Froot%2Finterrupted.txt', { method: 'POST' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = (event as any).node.req as EventEmitter & { pipe: ReturnType<typeof vi.fn> }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (event as any).node.res as EventEmitter

    req.pipe.mockImplementation(() => {
      process.nextTick(() => res.emit('close'))
    })

    await expect(uploadHandler(event)).rejects.toMatchObject({ statusCode: 502 })
    expect(endSpy).toHaveBeenCalled()
  })
})
