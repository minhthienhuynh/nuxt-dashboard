// WebSocket message protocol for the terminal bridge — a JSON text-frame
// envelope, one channel per session. Shared by both ends: the Nitro server
// (`server/routes/api/terminal.ts`) and the browser client
// (`TerminalView.client.vue`) import these types and codecs so the wire
// contract has a single source of truth and cannot drift between sides.

// Why a shell-history request can fail, surfaced to the client so the panel can
// explain the situation instead of showing an empty list.
export type HistoryError = 'unsupported-shell' | 'not-found' | 'probe-failed'

export type ServerMessage
  = | { type: 'data', data: string }
    | { type: 'error', message: string }
    | { type: 'exit', code?: number }
    | { type: 'history', entries: string[] }
    | { type: 'history', error: HistoryError }

export type ClientMessage
  = | { type: 'input', data: string }
    | { type: 'resize', cols: number, rows: number }
    | { type: 'history' }

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
  if (m.type === 'history') {
    return { type: 'history' }
  }
  return null
}

function isHistoryError(value: unknown): value is HistoryError {
  return value === 'unsupported-shell' || value === 'not-found' || value === 'probe-failed'
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
  if (m.type === 'history') {
    if (Array.isArray(m.entries) && m.entries.every(e => typeof e === 'string')) {
      return { type: 'history', entries: m.entries as string[] }
    }
    if (isHistoryError(m.error)) {
      return { type: 'history', error: m.error }
    }
    return null
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
