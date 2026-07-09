<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { formatSshTarget } from '../../utils/terminal'
import type { SessionStatus } from '../../utils/terminal-status'
import type { HostWithRelations } from '../../types/ssh'
import type { HistoryError } from '#shared/terminal-protocol'

definePageMeta({ layout: 'terminal' })

const route = useRoute()
const hostId = computed(() => String(route.params.id))

// One independent session per window — no tabs, no shared workspace.
const target = ref(hostId.value)
const address = ref('')
const status = ref<SessionStatus>('connecting')
const term = useTemplateRef<{
  reconnect: () => void
  disconnect: () => void
  clear: () => void
  search: () => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
  requestHistory: () => void
  paste: (command: string) => void
  runCommand: (command: string) => void
}>('term')

// --- Shell history slideover ------------------------------------------------
const historyOpen = ref(false)
const historyLoading = ref(false)
// Entries are cached until Refresh or a reconnect so re-opening the panel is
// instant rather than re-fetching every time.
const historyLoaded = ref(false)
const historyEntries = ref<string[]>([])
const historyError = ref<HistoryError | null>(null)

function fetchHistory() {
  if (status.value !== 'connected') {
    historyLoading.value = false
    historyError.value = 'probe-failed'
    return
  }
  historyLoading.value = true
  historyError.value = null
  term.value?.requestHistory()
}

function toggleHistory() {
  if (historyOpen.value) {
    historyOpen.value = false
    return
  }
  historyOpen.value = true
  if (!historyLoaded.value) fetchHistory()
}

function onHistoryResult(result: { entries: string[] } | { error: HistoryError }) {
  historyLoading.value = false
  historyLoaded.value = true
  if ('entries' in result) {
    historyEntries.value = result.entries
    historyError.value = null
  } else {
    historyEntries.value = []
    historyError.value = result.error
  }
}

function onPaste(command: string) {
  term.value?.paste(command)
  historyOpen.value = false
}

function onRun(command: string) {
  term.value?.runCommand(command)
  historyOpen.value = false
}

// A new shell (after reconnect) may have different history — invalidate the
// cache so the next open re-fetches.
watch(status, (s) => {
  if (s !== 'connected') historyLoaded.value = false
})

onMounted(async () => {
  try {
    // Load relations so the toolbar can show user@host:port (the username lives
    // on the linked identity, not the host).
    const host = await $fetch<HostWithRelations>(`/api/hosts/${hostId.value}?relations=true`)
    address.value = host.address
    target.value = formatSshTarget({ username: host.identity?.username, address: host.address, port: host.port })
  } catch {
    // keep the id as the target
  }
})

useHead(() => ({ title: `${target.value} — Terminal` }))
</script>

<template>
  <div class="flex flex-col h-screen bg-default text-default">
    <TerminalToolbar
      :target="target"
      :status="status"
      @reconnect="term?.reconnect()"
      @disconnect="term?.disconnect()"
      @clear="term?.clear()"
      @search="term?.search()"
      @history="toggleHistory()"
      @zoom-in="term?.zoomIn()"
      @zoom-out="term?.zoomOut()"
      @zoom-reset="term?.zoomReset()"
    />
    <div class="flex-1 min-h-0 p-2">
      <TerminalView
        ref="term"
        :host-id="hostId"
        :address="address"
        @status="status = $event"
        @history-result="onHistoryResult"
      />
    </div>

    <TerminalHistoryPanel
      v-model:open="historyOpen"
      :loading="historyLoading"
      :entries="historyEntries"
      :error="historyError"
      @paste="onPaste"
      @run="onRun"
      @refresh="fetchHistory"
    />
  </div>
</template>
