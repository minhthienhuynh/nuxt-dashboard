<script setup lang="ts">
import type { SessionStatus } from '../../utils/terminal-status'

defineProps<{
  label: string
  status: SessionStatus
}>()

const emit = defineEmits<{
  reconnect: []
  disconnect: []
  clear: []
}>()

const statusLabel: Record<SessionStatus, string> = {
  connecting: 'Connecting…',
  connected: 'Connected',
  closed: 'Disconnected',
  error: 'Error'
}

const statusColor: Record<SessionStatus, string> = {
  connecting: 'text-warning',
  connected: 'text-success',
  closed: 'text-muted',
  error: 'text-error'
}
</script>

<template>
  <div class="flex items-center justify-between gap-4 px-3 py-1.5 border-b border-default bg-elevated/40 text-sm">
    <div class="flex items-center gap-2 min-w-0">
      <UIcon name="i-lucide-circle" class="size-2.5 shrink-0" :class="statusColor[status]" />
      <span class="text-toned shrink-0">{{ statusLabel[status] }}</span>
      <span class="text-highlighted font-medium truncate">{{ label }}</span>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <UTooltip text="Reconnect">
        <UButton
          icon="i-lucide-rotate-cw"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Reconnect"
          @click="emit('reconnect')"
        />
      </UTooltip>
      <UTooltip text="Disconnect">
        <UButton
          icon="i-lucide-power"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Disconnect"
          @click="emit('disconnect')"
        />
      </UTooltip>
      <UTooltip text="Clear">
        <UButton
          icon="i-lucide-eraser"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Clear"
          @click="emit('clear')"
        />
      </UTooltip>
    </div>
  </div>
</template>
