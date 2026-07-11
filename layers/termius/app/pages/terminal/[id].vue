<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { formatSshTarget } from '../../utils/terminal'
import type { SessionStatus } from '../../utils/terminal-status'
import type { Group, Host, HostWithRelations, SSHSnippet } from '../../types/ssh'
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
  requestHistory: () => void
  paste: (command: string) => void
  runCommand: (command: string) => void
}>('term')

// --- Appearance slideover ---------------------------------------------------
const appearanceOpen = ref(false)

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

// Close the slideover first, then paste/run on the next tick so the terminal is
// focused after the dialog has released its focus trap (the panel also prevents
// close-auto-focus from returning focus to the toolbar trigger).
function onPaste(command: string) {
  historyOpen.value = false
  nextTick(() => term.value?.paste(command))
}

function onRun(command: string) {
  historyOpen.value = false
  nextTick(() => term.value?.runCommand(command))
}

// --- Snippets slideover -----------------------------------------------------
const snippetsOpen = ref(false)
const snippetsLoading = ref(false)
const snippetsLoaded = ref(false)
const snippets = ref<SSHSnippet[]>([])

async function fetchSnippets() {
  snippetsLoading.value = true
  try {
    // Global snippets plus this host's own.
    snippets.value = await $fetch<SSHSnippet[]>(`/api/snippets?hostId=${encodeURIComponent(hostId.value)}`)
    snippetsLoaded.value = true
  } catch {
    snippets.value = []
  } finally {
    snippetsLoading.value = false
  }
}

function toggleSnippets() {
  if (snippetsOpen.value) {
    snippetsOpen.value = false
    return
  }
  snippetsOpen.value = true
  if (!snippetsLoaded.value) fetchSnippets()
}

// Close the slideover first, then paste/run on the next tick so the terminal is
// focused after the dialog has released its focus trap (the panel also prevents
// close-auto-focus from returning focus to the toolbar trigger).
function onSnippetPaste(command: string) {
  snippetsOpen.value = false
  nextTick(() => term.value?.paste(command))
}

function onSnippetRun(command: string) {
  snippetsOpen.value = false
  nextTick(() => term.value?.runCommand(command))
}

// Delete a snippet from the panel, confirmed via the shared modal. Refresh the
// list (from the API) after a successful delete so it disappears.
const snippetDeleteOpen = ref(false)
const snippetDeleteId = ref<string | null>(null)
const snippetDeleteLabel = ref('')

function onSnippetDelete(snippet: SSHSnippet) {
  snippetDeleteId.value = snippet.id
  snippetDeleteLabel.value = snippet.label
  snippetDeleteOpen.value = true
}

// --- Save a shell-history entry as a snippet --------------------------------
// The snippet form needs the host + group lists for its scope selects; loaded
// lazily the first time the user saves a snippet. The current host is the
// default scope.
const snippetFormOpen = ref(false)
const snippetPrefillCommand = ref('')
const hosts = ref<Host[]>([])
const groups = ref<Group[]>([])

async function onHistorySave(command: string) {
  snippetPrefillCommand.value = command
  if (!hosts.value.length || !groups.value.length) {
    try {
      const [h, g] = await Promise.all([
        $fetch<Host[]>('/api/hosts'),
        $fetch<Group[]>('/api/groups')
      ])
      hosts.value = h
      groups.value = g
    } catch {
      // leave whatever loaded; the form still opens with the prefilled command
    }
  }
  historyOpen.value = false
  snippetFormOpen.value = true
}

// After creating a snippet, invalidate the cached list so the snippets panel
// shows the new entry on next open.
async function onSnippetSaved() {
  snippetsLoaded.value = false
  if (snippetsOpen.value) await fetchSnippets()
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
      @snippets="toggleSnippets()"
      @appearance="appearanceOpen = true"
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
      @save="onHistorySave"
    />

    <TerminalSnippetsPanel
      v-model:open="snippetsOpen"
      :loading="snippetsLoading"
      :snippets="snippets"
      @paste="onSnippetPaste"
      @run="onSnippetRun"
      @refresh="fetchSnippets"
      @delete="onSnippetDelete"
    />

    <SnippetsFormModal
      v-model:open="snippetFormOpen"
      :hosts="hosts"
      :groups="groups"
      :prefill-command="snippetPrefillCommand"
      :default-host-id="hostId"
      @saved="onSnippetSaved"
    />

    <ConfirmDeleteModal
      :id="snippetDeleteId"
      v-model:open="snippetDeleteOpen"
      resource="snippets"
      noun="snippet"
      :label="snippetDeleteLabel"
      @deleted="fetchSnippets"
    >
      <template #warning>
        This removes the saved command. It does not affect any host.
      </template>
    </ConfirmDeleteModal>

    <TerminalAppearancePanel v-model:open="appearanceOpen" />
  </div>
</template>
