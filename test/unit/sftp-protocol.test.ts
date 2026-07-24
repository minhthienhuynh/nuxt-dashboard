import { describe, expect, it } from 'vitest'
import { decodeSftpClient, decodeSftpServer, encodeSftpClient, encodeSftpServer } from '../../shared/sftp-protocol'

describe('sftp protocol', () => {
  it('encodes client messages to JSON', () => {
    expect(JSON.parse(encodeSftpClient({ type: 'list', requestId: 'r1', path: '/tmp' })))
      .toEqual({ type: 'list', requestId: 'r1', path: '/tmp' })
    expect(JSON.parse(encodeSftpClient({ type: 'mkdir', requestId: 'r2', path: '/tmp/new' })))
      .toEqual({ type: 'mkdir', requestId: 'r2', path: '/tmp/new' })
    expect(JSON.parse(encodeSftpClient({ type: 'rename', requestId: 'r3', from: '/a', to: '/b' })))
      .toEqual({ type: 'rename', requestId: 'r3', from: '/a', to: '/b' })
    expect(JSON.parse(encodeSftpClient({ type: 'delete', requestId: 'r4', path: '/a', isDirectory: true })))
      .toEqual({ type: 'delete', requestId: 'r4', path: '/a', isDirectory: true })
  })

  it('encodes server messages to JSON', () => {
    const entries = [{ name: 'a.txt', type: 'file' as const, size: 10, mtime: 100, mode: 0o644 }]
    expect(JSON.parse(encodeSftpServer({ type: 'listing', requestId: 'r1', path: '/tmp', entries })))
      .toEqual({ type: 'listing', requestId: 'r1', path: '/tmp', entries })
    expect(JSON.parse(encodeSftpServer({ type: 'ok', requestId: 'r2' })))
      .toEqual({ type: 'ok', requestId: 'r2' })
    expect(JSON.parse(encodeSftpServer({ type: 'error', requestId: 'r3', message: 'boom' })))
      .toEqual({ type: 'error', requestId: 'r3', message: 'boom' })
    expect(JSON.parse(encodeSftpServer({ type: 'error', message: 'no host' })))
      .toEqual({ type: 'error', message: 'no host' })
  })

  it('round-trips every client message shape through encode/decode', () => {
    const messages: Parameters<typeof encodeSftpClient>[0][] = [
      { type: 'list', requestId: 'r1', path: '/tmp' },
      { type: 'mkdir', requestId: 'r2', path: '/tmp/new' },
      { type: 'rename', requestId: 'r3', from: '/a', to: '/b' },
      { type: 'delete', requestId: 'r4', path: '/a', isDirectory: false }
    ]
    for (const msg of messages) {
      expect(decodeSftpClient(encodeSftpClient(msg))).toEqual(msg)
    }
  })

  it('round-trips every server message shape through encode/decode', () => {
    const entries = [{ name: 'dir', type: 'directory' as const, size: 0, mtime: 200, mode: 0o755 }]
    const messages: Parameters<typeof encodeSftpServer>[0][] = [
      { type: 'listing', requestId: 'r1', path: '/', entries },
      { type: 'ok', requestId: 'r2' },
      { type: 'error', requestId: 'r3', message: 'boom' },
      { type: 'error', message: 'connection failed' }
    ]
    for (const msg of messages) {
      expect(decodeSftpServer(encodeSftpServer(msg))).toEqual(msg)
    }
  })

  it('drops unknown or malformed client messages', () => {
    expect(decodeSftpClient(JSON.stringify({ type: 'bogus', requestId: 'r1' }))).toBeNull()
    expect(decodeSftpClient(JSON.stringify({ type: 'list', path: '/tmp' }))).toBeNull() // missing requestId
    expect(decodeSftpClient(JSON.stringify({ type: 'list', requestId: 'r1' }))).toBeNull() // missing path
    expect(decodeSftpClient(JSON.stringify({ type: 'rename', requestId: 'r1', from: '/a' }))).toBeNull() // missing to
    expect(decodeSftpClient(JSON.stringify({ type: 'delete', requestId: 'r1', path: '/a' }))).toBeNull() // missing isDirectory
    expect(decodeSftpClient('not json')).toBeNull()
  })

  it('drops unknown or malformed server messages', () => {
    expect(decodeSftpServer(JSON.stringify({ type: 'bogus', requestId: 'r1' }))).toBeNull()
    expect(decodeSftpServer(JSON.stringify({ type: 'listing', requestId: 'r1', path: '/tmp' }))).toBeNull() // missing entries
    expect(decodeSftpServer(JSON.stringify({
      type: 'listing',
      requestId: 'r1',
      path: '/tmp',
      entries: [{ name: 'x' }]
    }))).toBeNull() // entry missing fields
    expect(decodeSftpServer(JSON.stringify({ type: 'ok' }))).toBeNull() // missing requestId
    expect(decodeSftpServer(JSON.stringify({ type: 'error' }))).toBeNull() // missing message
    expect(decodeSftpServer('not json')).toBeNull()
  })
})
