import { describe, expect, it } from 'vitest'
import { decodeClient, encodeServer } from '../../server/utils/terminal/protocol'

describe('terminal protocol', () => {
  it('encodes server messages to JSON', () => {
    expect(JSON.parse(encodeServer({ type: 'data', data: 'hi' }))).toEqual({ type: 'data', data: 'hi' })
    expect(JSON.parse(encodeServer({ type: 'error', message: 'boom' }))).toEqual({ type: 'error', message: 'boom' })
    expect(JSON.parse(encodeServer({ type: 'exit', code: 0 }))).toEqual({ type: 'exit', code: 0 })
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

  it('drops unknown or malformed messages', () => {
    expect(decodeClient(JSON.stringify({ type: 'bogus' }))).toBeNull()
    expect(decodeClient(JSON.stringify({ type: 'resize', cols: 'x', rows: 1 }))).toBeNull()
    expect(decodeClient(JSON.stringify({ type: 'input' }))).toBeNull()
    expect(decodeClient('not json')).toBeNull()
  })
})
