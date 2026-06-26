<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { SessionStatus } from '../../utils/terminal-status'

const props = defineProps<{
  hostId: string
}>()

const emit = defineEmits<{
  status: [status: SessionStatus]
}>()

const container = ref<HTMLElement | null>(null)
let term: Terminal | null = null
let fit: FitAddon | null = null
let ws: WebSocket | null = null
let resizeObserver: ResizeObserver | null = null

function setStatus(status: SessionStatus) {
  emit('status', status)
}

function send(msg: Record<string, unknown>) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function connect() {
  setStatus('connecting')
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${proto}://${location.host}/api/terminal?hostId=${encodeURIComponent(props.hostId)}`)

  ws.onopen = () => {
    setStatus('connected')
    fit?.fit()
    if (term) send({ type: 'resize', cols: term.cols, rows: term.rows })
  }
  ws.onmessage = (event) => {
    let msg: { type?: string, data?: string, message?: string }
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }
    if (msg.type === 'data' && typeof msg.data === 'string') {
      term?.write(msg.data)
    } else if (msg.type === 'error') {
      term?.write(`\r\n\x1b[31m${msg.message ?? 'Error'}\x1b[0m\r\n`)
      setStatus('error')
    } else if (msg.type === 'exit') {
      setStatus('closed')
    }
  }
  ws.onclose = () => setStatus('closed')
  ws.onerror = () => setStatus('error')
}

function disconnect() {
  if (!ws) return
  // Detach handlers BEFORE closing: close() is async, so an un-detached old
  // socket's onclose/onmessage would fire after reconnect() opened a new one,
  // racing the new session's status and writing stale output (or writing to a
  // disposed terminal on unmount).
  ws.onopen = null
  ws.onmessage = null
  ws.onclose = null
  ws.onerror = null
  ws.close()
  ws = null
}

function reconnect() {
  disconnect()
  connect()
}

function clear() {
  term?.clear()
}

defineExpose({ reconnect, disconnect, clear })

onMounted(async () => {
  // Wait a tick so the (non-root) container ref is reliably populated under
  // Nuxt's client-only mounting.
  await nextTick()
  if (!container.value) return
  term = new Terminal({ cursorBlink: true, fontFamily: 'monospace', fontSize: 13 })
  fit = new FitAddon()
  term.loadAddon(fit)
  term.open(container.value)
  fit.fit()

  term.onData(data => send({ type: 'input', data }))
  term.onResize(({ cols, rows }) => send({ type: 'resize', cols, rows }))

  resizeObserver = new ResizeObserver(() => fit?.fit())
  resizeObserver.observe(container.value)

  connect()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  disconnect()
  term?.dispose()
})
</script>

<template>
  <div class="size-full">
    <div ref="container" class="size-full" />
  </div>
</template>
