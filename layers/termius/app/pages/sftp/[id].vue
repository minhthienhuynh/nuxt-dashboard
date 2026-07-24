<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatSshTarget } from '../../utils/terminal'
import type { HostWithRelations } from '../../types/ssh'

definePageMeta({ layout: 'terminal' })

const route = useRoute()
const hostId = computed(() => String(route.params.id))

// One independent session per window, same as the terminal page. Falls back to
// the raw id until the host loads (mirrors pages/terminal/[id].vue).
const target = ref(hostId.value)

onMounted(async () => {
  try {
    const host = await $fetch<HostWithRelations>(`/api/hosts/${hostId.value}?relations=true`)
    target.value = formatSshTarget({ username: host.identity?.username, address: host.address, port: host.port })
  } catch {
    // keep the id as the target
  }
})

useHead(() => ({ title: `${target.value} — SFTP` }))
</script>

<template>
  <div class="flex flex-col h-screen bg-default text-default">
    <div class="flex items-center gap-2 px-3 py-1.5 border-b border-default bg-elevated/40 text-sm">
      <UTooltip text="Hosts">
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          size="xs"
          to="/hosts"
          aria-label="Back to hosts"
        />
      </UTooltip>
      <UIcon name="i-lucide-folder-open" class="size-4 text-dimmed shrink-0" />
      <span class="text-highlighted font-medium truncate">{{ target }}</span>
    </div>

    <div class="flex-1 min-h-0 p-2">
      <SftpBrowser :host-id="hostId" />
    </div>
  </div>
</template>
