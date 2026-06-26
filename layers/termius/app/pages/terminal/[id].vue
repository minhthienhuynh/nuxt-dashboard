<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import type { SessionStatus } from '../../utils/terminal-status'

definePageMeta({ layout: 'terminal' })

const route = useRoute()
const hostId = computed(() => String(route.params.id))

// One independent session per window — no tabs, no shared workspace.
const label = ref(hostId.value)
const status = ref<SessionStatus>('connecting')
const term = useTemplateRef<{ reconnect: () => void, disconnect: () => void, clear: () => void }>('term')

onMounted(async () => {
  try {
    const host = await $fetch<{ label: string }>(`/api/hosts/${hostId.value}`)
    label.value = host.label
  } catch {
    // keep the id as the label
  }
})

useHead(() => ({ title: `${label.value} — Terminal` }))
</script>

<template>
  <div class="flex flex-col h-screen bg-default text-default">
    <TerminalToolbar
      :label="label"
      :status="status"
      @reconnect="term?.reconnect()"
      @disconnect="term?.disconnect()"
      @clear="term?.clear()"
    />
    <div class="flex-1 min-h-0 p-2">
      <TerminalView
        ref="term"
        :host-id="hostId"
        @status="status = $event"
      />
    </div>
  </div>
</template>
