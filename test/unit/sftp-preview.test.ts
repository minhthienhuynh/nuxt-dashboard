import { describe, expect, it } from 'vitest'
import { looksBinary } from '../../layers/termius/app/utils/sftp-preview'

function bufferFrom(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer
}

function textBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer
}

describe('looksBinary', () => {
  it('treats plain text as non-binary', () => {
    expect(looksBinary(textBuffer('hello world\nsecond line\n'))).toBe(false)
  })

  it('treats an empty buffer as non-binary', () => {
    expect(looksBinary(bufferFrom([]))).toBe(false)
  })

  it('treats tabs, newlines and carriage returns as text, not control bytes', () => {
    expect(looksBinary(textBuffer('col1\tcol2\r\nrow2\tvalue\r\n'))).toBe(false)
  })

  it('treats a single NUL byte as a definitive binary signal', () => {
    const bytes = new TextEncoder().encode('mostly text').buffer
    const withNul = new Uint8Array(bytes.byteLength + 1)
    withNul.set(new Uint8Array(bytes), 0)
    withNul[bytes.byteLength] = 0
    expect(looksBinary(withNul.buffer)).toBe(true)
  })

  it('treats a buffer dominated by control bytes as binary', () => {
    const bytes = Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? 1 : 2))
    expect(looksBinary(bufferFrom(bytes))).toBe(true)
  })

  it('stays under the threshold for a small amount of control bytes mixed into text', () => {
    const text = new TextEncoder().encode('a'.repeat(100))
    const bytes = new Uint8Array(text.length + 2)
    bytes.set(text, 0)
    bytes[text.length] = 1
    bytes[text.length + 1] = 2
    expect(looksBinary(bytes.buffer)).toBe(false)
  })

  it('only samples the first 8000 bytes for large buffers', () => {
    const size = 20000
    const bytes = new Uint8Array(size).fill(97) // 'a', all text
    // Binary content beyond the sampled window must not affect the result.
    bytes.fill(1, 9000)
    expect(looksBinary(bytes.buffer)).toBe(false)
  })
})
