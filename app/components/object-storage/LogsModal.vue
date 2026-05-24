<script setup lang="ts">
import type { InfrastructureService } from '~/types'

const props = defineProps<{
  service: InfrastructureService | null
}>()

const open = defineModel<boolean>('open', { default: false })
const { lines, connected, connect, disconnect } = useContainerLogs()

const serviceName = computed(() =>
  props.service?.serviceType?.name || props.service?.containerName || ''
)

watch(open, (val) => {
  if (val && props.service) {
    connect(`/api/services/${props.service.id}/logs/stream`)
  } else {
    disconnect()
  }
})

watch(() => props.service, () => {
  if (open.value && props.service) {
    disconnect()
    connect(`/api/services/${props.service.id}/logs/stream`)
  }
})
</script>

<template>
  <UModal v-model:open="open" :title="`Logs: ${serviceName}`">
    <template #body>
      <div class="p-4">
        <div class="flex items-center gap-2 mb-3">
          <UBadge :color="connected ? 'success' : 'neutral'" variant="subtle" size="xs">
            {{ connected ? 'Live' : 'Connecting...' }}
          </UBadge>
        </div>
        <pre class="text-xs bg-default/50 rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono">{{ lines.join('\n') || 'Waiting for logs...' }}</pre>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 p-4">
        <UButton label="Close" variant="outline" @click="open = false" />
      </div>
    </template>
  </UModal>
</template>
