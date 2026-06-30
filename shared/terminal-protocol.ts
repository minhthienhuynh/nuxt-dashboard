// WebSocket message protocol for the terminal bridge — a JSON text-frame
// envelope, one channel per session. Shared by both ends: the Nitro server
// (`server/routes/api/terminal.ts`) and the browser client
// (`TerminalView.client.vue`) import these types and codecs so the wire
// contract has a single source of truth and cannot drift between sides.

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

export function encodeClient(msg: ClientMessage): string {
  return JSON.stringify(msg)
}

// Parse and validate a client frame. Returns null for malformed or unknown
// messages so the caller can ignore them rather than trust arbitrary input.
export function decodeClient(raw: string): ClientMessage | null {
  const m = parseObject(raw)
  if (!m) return null

  if (m.type === 'input' && typeof m.data === 'string') {
    return { type: 'input', data: m.data }
  }
  if (m.type === 'resize' && typeof m.cols === 'number' && typeof m.rows === 'number') {
    return { type: 'resize', cols: m.cols, rows: m.rows }
  }
  return null
}

// Parse and validate a server frame. Returns null for malformed or unknown
// messages so the client can ignore them rather than act on arbitrary input.
export function decodeServer(raw: string): ServerMessage | null {
  const m = parseObject(raw)
  if (!m) return null

  if (m.type === 'data' && typeof m.data === 'string') {
    return { type: 'data', data: m.data }
  }
  if (m.type === 'error' && typeof m.message === 'string') {
    return { type: 'error', message: m.message }
  }
  if (m.type === 'exit') {
    return typeof m.code === 'number' ? { type: 'exit', code: m.code } : { type: 'exit' }
  }
  return null
}

function parseObject(raw: string): Record<string, unknown> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  return parsed as Record<string, unknown>
}
