import { describe, expect, it } from 'vitest'
import { decodeClient, decodeServer, encodeClient, encodeServer } from '../../shared/terminal-protocol'

describe('terminal protocol', () => {
  it('encodes server messages to JSON', () => {
    expect(JSON.parse(encodeServer({ type: 'data', data: 'hi' }))).toEqual({ type: 'data', data: 'hi' })
    expect(JSON.parse(encodeServer({ type: 'error', message: 'boom' }))).toEqual({ type: 'error', message: 'boom' })
    expect(JSON.parse(encodeServer({ type: 'exit', code: 0 }))).toEqual({ type: 'exit', code: 0 })
  })

  it('encodes client messages to JSON', () => {
    expect(JSON.parse(encodeClient({ type: 'input', data: 'ls\n' }))).toEqual({ type: 'input', data: 'ls\n' })
    expect(JSON.parse(encodeClient({ type: 'resize', cols: 120, rows: 40 }))).toEqual({ type: 'resize', cols: 120, rows: 40 })
  })

  it('decodes a valid input message', () => {
    expect(decodeClient(JSON.stringify({ type: 'input', data: 'ls\n' }))).toEqual({ type: 'input', data: 'ls\n' })
  })

  it('decodes a valid resize message', () => {
    expect(decodeClient(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }))).toEqual({ type: 'resize', cols: 120, rows: 40 })
  })

  it('round-trips input through encode/decode shape', () => {
    const decoded = decodeClient(JSON.stringify({ type: 'input', data: 'echo hi' }))
    expect(decoded).toEqual({ type: 'input', data: 'echo hi' })
  })

  it('drops unknown or malformed client messages', () => {
    expect(decodeClient(JSON.stringify({ type: 'bogus' }))).toBeNull()
    expect(decodeClient(JSON.stringify({ type: 'resize', cols: 'x', rows: 1 }))).toBeNull()
    expect(decodeClient(JSON.stringify({ type: 'input' }))).toBeNull()
    expect(decodeClient('not json')).toBeNull()
  })

  it('decodes valid server messages', () => {
    expect(decodeServer(JSON.stringify({ type: 'data', data: 'out' }))).toEqual({ type: 'data', data: 'out' })
    expect(decodeServer(JSON.stringify({ type: 'error', message: 'boom' }))).toEqual({ type: 'error', message: 'boom' })
    expect(decodeServer(JSON.stringify({ type: 'exit', code: 0 }))).toEqual({ type: 'exit', code: 0 })
    expect(decodeServer(JSON.stringify({ type: 'exit' }))).toEqual({ type: 'exit' })
  })

  it('round-trips server messages through encode/decode', () => {
    expect(decodeServer(encodeServer({ type: 'data', data: 'x' }))).toEqual({ type: 'data', data: 'x' })
    expect(decodeServer(encodeServer({ type: 'error', message: 'e' }))).toEqual({ type: 'error', message: 'e' })
  })

  it('drops unknown or malformed server messages', () => {
    expect(decodeServer(JSON.stringify({ type: 'bogus' }))).toBeNull()
    expect(decodeServer(JSON.stringify({ type: 'data' }))).toBeNull()
    expect(decodeServer(JSON.stringify({ type: 'error', message: 1 }))).toBeNull()
    expect(decodeServer('not json')).toBeNull()
  })
})
