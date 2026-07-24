// WebSocket message protocol for the SFTP control bridge — a JSON text-frame
// envelope, request/response with correlation ids (unlike the single-stream
// terminal protocol, SFTP has several concurrent operations in flight). Shared
// by both ends: the Nitro server (`server/routes/api/sftp.ts`) and the browser
// client (`useSftpConnection`) import these types and codecs so the wire
// contract has a single source of truth and cannot drift between sides.

export type SftpEntryType = 'file' | 'directory' | 'symlink' | 'other'

export interface SftpEntry {
  name: string
  type: SftpEntryType
  size: number
  // Modification time, epoch seconds (matches ssh2's raw SFTP attrs).
  mtime: number
  // POSIX permission bits.
  mode: number
}

export type SftpClientMessage
  = | { type: 'list', requestId: string, path: string }
    | { type: 'mkdir', requestId: string, path: string }
    | { type: 'rename', requestId: string, from: string, to: string }
    | { type: 'delete', requestId: string, path: string, isDirectory: boolean }

export type SftpServerMessage
  // `path` is the resolved absolute remote path (the request may have sent a
  // relative path like '.' for the initial directory), so the client always
  // has an absolute path to build the breadcrumb and child paths from.
  = | { type: 'listing', requestId: string, path: string, entries: SftpEntry[] }
    | { type: 'ok', requestId: string }
    // requestId is absent for connection-level errors (e.g. unknown host)
    // raised before any client request exists.
    | { type: 'error', requestId?: string, message: string }

export function encodeSftpClient(msg: SftpClientMessage): string {
  return JSON.stringify(msg)
}

export function encodeSftpServer(msg: SftpServerMessage): string {
  return JSON.stringify(msg)
}

function isEntryType(value: unknown): value is SftpEntryType {
  return value === 'file' || value === 'directory' || value === 'symlink' || value === 'other'
}

function isEntry(value: unknown): value is SftpEntry {
  if (!value || typeof value !== 'object') return false
  const e = value as Record<string, unknown>
  return typeof e.name === 'string'
    && isEntryType(e.type)
    && typeof e.size === 'number'
    && typeof e.mtime === 'number'
    && typeof e.mode === 'number'
}

// Parse and validate a client frame. Returns null for malformed or unknown
// messages so the caller can ignore them rather than trust arbitrary input.
export function decodeSftpClient(raw: string): SftpClientMessage | null {
  const m = parseObject(raw)
  if (!m) return null
  if (typeof m.requestId !== 'string') return null

  if (m.type === 'list' && typeof m.path === 'string') {
    return { type: 'list', requestId: m.requestId, path: m.path }
  }
  if (m.type === 'mkdir' && typeof m.path === 'string') {
    return { type: 'mkdir', requestId: m.requestId, path: m.path }
  }
  if (m.type === 'rename' && typeof m.from === 'string' && typeof m.to === 'string') {
    return { type: 'rename', requestId: m.requestId, from: m.from, to: m.to }
  }
  if (m.type === 'delete' && typeof m.path === 'string' && typeof m.isDirectory === 'boolean') {
    return { type: 'delete', requestId: m.requestId, path: m.path, isDirectory: m.isDirectory }
  }
  return null
}

// Parse and validate a server frame. Returns null for malformed or unknown
// messages so the client can ignore them rather than act on arbitrary input.
export function decodeSftpServer(raw: string): SftpServerMessage | null {
  const m = parseObject(raw)
  if (!m) return null

  if (m.type === 'listing' && typeof m.requestId === 'string' && typeof m.path === 'string' && Array.isArray(m.entries) && m.entries.every(isEntry)) {
    return { type: 'listing', requestId: m.requestId, path: m.path, entries: m.entries as SftpEntry[] }
  }
  if (m.type === 'ok' && typeof m.requestId === 'string') {
    return { type: 'ok', requestId: m.requestId }
  }
  if (m.type === 'error' && typeof m.message === 'string') {
    return typeof m.requestId === 'string'
      ? { type: 'error', requestId: m.requestId, message: m.message }
      : { type: 'error', message: m.message }
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
