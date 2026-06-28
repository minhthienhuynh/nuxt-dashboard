<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { formatSshTarget } from '../../utils/terminal'
import type { SessionStatus } from '../../utils/terminal-status'
import type { HostWithRelations } from '../../types/ssh'

definePageMeta({ layout: 'terminal' })

const route = useRoute()
const hostId = computed(() => String(route.params.id))

// One independent session per window — no tabs, no shared workspace.
const target = ref(hostId.value)
const address = ref('')
const status = ref<SessionStatus>('connecting')
const term = useTemplateRef<{ reconnect: () => void, disconnect: () => void, clear: () => void, search: () => void, zoomIn: () => void, zoomOut: () => void, zoomReset: () => void }>('term')

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
      />
    </div>
  </div>
</template>
