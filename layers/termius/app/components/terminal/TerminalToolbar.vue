<script setup lang="ts">
import type { SessionStatus } from '../../utils/terminal-status'

defineProps<{
  target: string
  status: SessionStatus
}>()

const emit = defineEmits<{
  reconnect: []
  disconnect: []
  clear: []
  search: []
  history: []
  zoomIn: []
  zoomOut: []
  zoomReset: []
}>()

// Status is shown as an icon only; the text is exposed via tooltip, not a label.
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
      <UTooltip :text="statusLabel[status]">
        <UIcon name="i-lucide-circle" class="size-2.5 shrink-0" :class="statusColor[status]" />
      </UTooltip>
      <span class="text-highlighted font-medium truncate">{{ target }}</span>
    </div>

    <div class="flex items-center gap-1 shrink-0">
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

      <span class="mx-1 h-4 w-px bg-default" aria-hidden="true" />

      <UTooltip text="Zoom out (⌘−)">
        <UButton
          icon="i-lucide-zoom-out"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Zoom out"
          @click="emit('zoomOut')"
        />
      </UTooltip>
      <UTooltip text="Reset zoom (⌘0)">
        <UButton
          icon="i-lucide-type"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Reset zoom"
          @click="emit('zoomReset')"
        />
      </UTooltip>
      <UTooltip text="Zoom in (⌘+)">
        <UButton
          icon="i-lucide-zoom-in"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Zoom in"
          @click="emit('zoomIn')"
        />
      </UTooltip>
      <UTooltip text="Search (⌘F)">
        <UButton
          icon="i-lucide-search"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Search"
          @click="emit('search')"
        />
      </UTooltip>
      <UTooltip text="Shell history">
        <UButton
          icon="i-lucide-history"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="status !== 'connected'"
          aria-label="Shell history"
          @click="emit('history')"
        />
      </UTooltip>

      <span class="mx-1 h-4 w-px bg-default" aria-hidden="true" />

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
