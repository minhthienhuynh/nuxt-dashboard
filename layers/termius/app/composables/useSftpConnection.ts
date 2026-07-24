import { onBeforeUnmount, onMounted, ref } from 'vue'
import { decodeSftpServer, encodeSftpClient } from '#shared/sftp-protocol'
import type { SftpClientMessage, SftpEntry, SftpServerMessage } from '#shared/sftp-protocol'
import type { SessionStatus } from '../utils/terminal-status'

interface Pending {
  resolve: () => void
  reject: (err: Error) => void
}

// Manages the SFTP control WebSocket for one host: connection status, the
// current remote directory and its listing, and request/response operations
// (list/mkdir/rename/delete) correlated by requestId — unlike the terminal's
// single data stream, SFTP has several concurrent operations in flight, so
// each call returns a promise settled when its correlated reply arrives.
export function useSftpConnection(hostId: string) {
  const status = ref<SessionStatus>('connecting')
  const currentPath = ref('.')
  const entries = ref<SftpEntry[]>([])
  // True while a listing request is in flight — covers both the automatic
  // initial/reconnect listing and explicit navigate()/refresh() calls, so the
  // UI has one source of truth for "is the directory view loading" regardless
  // of who triggered it.
  const loading = ref(false)
  // Connection-level error (no requestId, e.g. unknown host) — distinct from a
  // per-operation error, which rejects that operation's promise instead.
  const error = ref<string | null>(null)

  let ws: WebSocket | null = null
  const pending = new Map<string, Pending>()

  function nextRequestId(): string {
    return crypto.randomUUID()
  }

  function settlePendingWithError(err: Error) {
    for (const p of pending.values()) p.reject(err)
    pending.clear()
  }

  function sendRequest(requestId: string, msg: SftpClientMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws?.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'))
        return
      }
      pending.set(requestId, { resolve, reject })
      ws.send(encodeSftpClient(msg))
    })
  }

  function handleMessage(msg: SftpServerMessage) {
    if (msg.type === 'listing') {
      currentPath.value = msg.path
      entries.value = msg.entries
      const p = pending.get(msg.requestId)
      pending.delete(msg.requestId)
      p?.resolve()
      return
    }
    if (msg.type === 'ok') {
      const p = pending.get(msg.requestId)
      pending.delete(msg.requestId)
      p?.resolve()
      return
    }
    // error
    if (msg.requestId) {
      const p = pending.get(msg.requestId)
      pending.delete(msg.requestId)
      p?.reject(new Error(msg.message))
      return
    }
    // Connection-level error raised before any request exists (e.g. unknown
    // host) — the socket closes right after, which settles any pending ops.
    error.value = msg.message
  }

  function connect() {
    error.value = null
    status.value = 'connecting'
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${location.host}/api/sftp?hostId=${encodeURIComponent(hostId)}`)

    ws.onopen = () => {
      status.value = 'connected'
      // Re-list the last known directory (home on first connect, since
      // currentPath starts at '.') so a reconnect stays where the user was.
      void list(currentPath.value)
    }
    ws.onmessage = (event) => {
      const msg = decodeSftpServer(event.data)
      if (msg) handleMessage(msg)
    }
    ws.onclose = () => {
      status.value = 'closed'
      settlePendingWithError(new Error('Connection closed'))
    }
    ws.onerror = () => {
      status.value = 'error'
    }
  }

  // Detach handlers before closing: close() is async, so an un-detached old
  // socket's onclose could fire after reconnect() opened a new one, racing the
  // new session's status.
  function closeSocket() {
    if (!ws) return
    ws.onopen = null
    ws.onmessage = null
    ws.onclose = null
    ws.onerror = null
    ws.close()
    ws = null
  }

  function reconnect() {
    closeSocket()
    settlePendingWithError(new Error('Reconnecting'))
    connect()
  }

  async function list(path: string): Promise<void> {
    loading.value = true
    try {
      const requestId = nextRequestId()
      await sendRequest(requestId, { type: 'list', requestId, path })
    } finally {
      loading.value = false
    }
  }

  function mkdir(path: string): Promise<void> {
    const requestId = nextRequestId()
    return sendRequest(requestId, { type: 'mkdir', requestId, path })
  }

  function rename(from: string, to: string): Promise<void> {
    const requestId = nextRequestId()
    return sendRequest(requestId, { type: 'rename', requestId, from, to })
  }

  function remove(path: string, isDirectory: boolean): Promise<void> {
    const requestId = nextRequestId()
    return sendRequest(requestId, { type: 'delete', requestId, path, isDirectory })
  }

  // Re-list the current directory, e.g. after a mutation.
  function refresh(): Promise<void> {
    return list(currentPath.value)
  }

  onMounted(connect)
  onBeforeUnmount(() => {
    closeSocket()
    settlePendingWithError(new Error('Unmounted'))
  })

  return { status, currentPath, entries, loading, error, list, mkdir, rename, remove, refresh, reconnect }
}
