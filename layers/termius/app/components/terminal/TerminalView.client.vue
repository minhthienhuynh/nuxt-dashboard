<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import { terminalTheme } from '../../utils/terminal-theme'
import { FONT_SIZE_DEFAULT, clampFontSize } from '../../utils/terminal'
import type { SessionStatus } from '../../utils/terminal-status'

const props = defineProps<{
  hostId: string
  address: string
}>()

const emit = defineEmits<{
  status: [status: SessionStatus]
}>()

const container = ref<HTMLElement | null>(null)
let term: Terminal | null = null
let fit: FitAddon | null = null
let search: SearchAddon | null = null
let webgl: WebglAddon | null = null
let ws: WebSocket | null = null
let resizeObserver: ResizeObserver | null = null
// While true the session is closed and the next keystroke reconnects instead of
// being forwarded to the (dead) socket.
let awaitingReconnect = false

const colorMode = useColorMode()
// Persisted across sessions; client-only component so no SSR/hydration concern.
const fontSize = useLocalStorage('terminal:fontSize', FONT_SIZE_DEFAULT)

// --- Search overlay ---------------------------------------------------------
const searchOpen = ref(false)
const searchQuery = ref('')
const searchInput = ref<{ inputRef?: HTMLInputElement, $el?: HTMLElement } | HTMLInputElement | null>(null)

const SEARCH_OPTS = {
  decorations: {
    matchBackground: '#a16207',
    activeMatchBackground: '#facc15',
    matchOverviewRuler: '#eab308',
    activeMatchColorOverviewRuler: '#facc15'
  }
} as const

function runSearch(incremental: boolean) {
  if (!search) return
  if (!searchQuery.value) {
    search.clearDecorations()
    return
  }
  search.findNext(searchQuery.value, { ...SEARCH_OPTS, incremental })
}

function findPrev() {
  if (search && searchQuery.value) search.findPrevious(searchQuery.value, SEARCH_OPTS)
}

function openSearch() {
  searchOpen.value = true
  nextTick(() => {
    const el = searchInput.value
    const node = el instanceof HTMLElement ? el : (el?.inputRef ?? el?.$el?.querySelector?.('input') ?? null)
    node?.focus()
  })
}

function closeSearch() {
  searchOpen.value = false
  searchQuery.value = ''
  search?.clearDecorations()
  term?.focus()
}

function toggleSearch() {
  if (searchOpen.value) closeSearch()
  else openSearch()
}

// --- Font size --------------------------------------------------------------
function zoomIn() {
  fontSize.value = clampFontSize(fontSize.value + 1)
}
function zoomOut() {
  fontSize.value = clampFontSize(fontSize.value - 1)
}
function zoomReset() {
  fontSize.value = FONT_SIZE_DEFAULT
}

watch(fontSize, (size) => {
  if (!term) return
  term.options.fontSize = size
  fit?.fit() // re-fit; the resulting onResize forwards new cols/rows to the PTY
})

watch(() => colorMode.value, (mode) => {
  if (!term) return
  term.options.theme = terminalTheme(mode === 'light' ? 'light' : 'dark')
  webgl?.clearTextureAtlas() // rebuild the GPU glyph atlas with the new colors
})

// --- Connection -------------------------------------------------------------
function setStatus(status: SessionStatus) {
  emit('status', status)
}

function send(msg: Record<string, unknown>) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function enterClosed() {
  if (awaitingReconnect) return
  awaitingReconnect = true
  const addr = props.address || props.hostId
  term?.write(`\r\n\x1b[90mSSH ${addr}: session closed\x1b[0m\r\n\x1b[90mPress any key to reconnect\x1b[0m\r\n`)
}

function connect() {
  awaitingReconnect = false
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
      enterClosed()
    } else if (msg.type === 'exit') {
      setStatus('closed')
      enterClosed()
    }
  }
  ws.onclose = () => {
    setStatus('closed')
    enterClosed()
  }
  ws.onerror = () => {
    setStatus('error')
    enterClosed()
  }
}

// Detach handlers BEFORE closing: close() is async, so an un-detached old
// socket's onclose/onmessage would fire after reconnect() opened a new one,
// racing the new session's status and writing stale output.
function closeSocket() {
  if (!ws) return
  ws.onopen = null
  ws.onmessage = null
  ws.onclose = null
  ws.onerror = null
  ws.close()
  ws = null
}

// onclose is detached by closeSocket, so show the reconnect prompt explicitly.
function disconnect() {
  closeSocket()
  setStatus('closed')
  enterClosed()
}

function reconnect() {
  closeSocket()
  term?.reset() // fresh screen for the new session (clear keeps the stale prompt line)
  connect()
}

function clear() {
  term?.clear()
}

defineExpose({ reconnect, disconnect, clear, search: toggleSearch, zoomIn, zoomOut, zoomReset })

onMounted(async () => {
  // Wait a tick so the (non-root) container ref is reliably populated under
  // Nuxt's client-only mounting.
  await nextTick()
  if (!container.value) return
  term = new Terminal({
    cursorBlink: true,
    fontFamily: 'monospace',
    fontSize: fontSize.value,
    theme: terminalTheme(colorMode.value === 'light' ? 'light' : 'dark'),
    allowProposedApi: true
  })
  fit = new FitAddon()
  search = new SearchAddon()
  term.loadAddon(fit)
  term.loadAddon(search)
  term.loadAddon(new WebLinksAddon((_event, uri) => window.open(uri, '_blank', 'noopener')))
  term.open(container.value)

  // GPU renderer (must load after open()). Falls back to the DOM renderer when
  // WebGL2 is unavailable (throws) or its context is lost.
  try {
    const addon = new WebglAddon()
    addon.onContextLoss(() => {
      addon.dispose()
      webgl = null
    })
    term.loadAddon(addon)
    webgl = addon
  } catch {
    // WebGL2 unavailable — keep the default DOM renderer.
    webgl = null
  }

  fit.fit()

  // Intercept zoom / search shortcuts and press-any-key reconnect before xterm
  // handles the key (so the browser does not zoom and dead-socket input is gated).
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true

    if (awaitingReconnect) {
      // Let modifier shortcuts (copy, refresh, …) and bare modifier keys through
      // so the closed-session text stays selectable/copyable; reconnect on the
      // next normal key.
      if (e.metaKey || e.ctrlKey || e.altKey || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return true
      reconnect()
      return false
    }

    const mod = e.metaKey || e.ctrlKey
    if (mod && !e.altKey) {
      if (e.key === 'f') {
        e.preventDefault()
        toggleSearch()
        return false
      }
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
        return false
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomOut()
        return false
      }
      if (e.key === '0') {
        e.preventDefault()
        zoomReset()
        return false
      }
    }
    return true
  })

  term.onData(data => send({ type: 'input', data }))
  term.onResize(({ cols, rows }) => send({ type: 'resize', cols, rows }))

  resizeObserver = new ResizeObserver(() => fit?.fit())
  resizeObserver.observe(container.value)

  connect()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  closeSocket()
  term?.dispose()
})
</script>

<template>
  <div class="relative size-full">
    <div ref="container" class="size-full" />

    <div
      v-if="searchOpen"
      class="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-md border border-default bg-elevated px-1.5 py-1 shadow-lg"
    >
      <UInput
        ref="searchInput"
        v-model="searchQuery"
        placeholder="Search…"
        size="xs"
        :ui="{ base: 'w-40' }"
        @update:model-value="runSearch(true)"
        @keydown.enter.prevent="runSearch(false)"
        @keydown.shift.enter.prevent="findPrev"
        @keydown.esc.prevent="closeSearch"
      />
      <UButton
        icon="i-lucide-chevron-up"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Previous match"
        @click="findPrev"
      />
      <UButton
        icon="i-lucide-chevron-down"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Next match"
        @click="runSearch(false)"
      />
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Close search"
        @click="closeSearch"
      />
    </div>
  </div>
</template>
