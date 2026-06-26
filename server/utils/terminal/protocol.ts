// WebSocket message protocol for the terminal bridge — a JSON text-frame
// envelope, one channel per session.

export type ServerMessage
  = | { type: 'data', data: string }
    | { type: 'error', message: string }
    | { type: 'exit', code?: number }

export type ClientMessage
  = | { type: 'input', data: string }
    | { type: 'resize', cols: number, rows: number }

export function encodeServer(msg: ServerMessage): string {
  return JSON.stringify(msg)
}

// Parse and validate a client frame. Returns null for malformed or unknown
// messages so the caller can ignore them rather than trust arbitrary input.
export function decodeClient(raw: string): ClientMessage | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const m = parsed as Record<string, unknown>

  if (m.type === 'input' && typeof m.data === 'string') {
    return { type: 'input', data: m.data }
  }
  if (m.type === 'resize' && typeof m.cols === 'number' && typeof m.rows === 'number') {
    return { type: 'resize', cols: m.cols, rows: m.rows }
  }
  return null
}
