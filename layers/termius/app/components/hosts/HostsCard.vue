<script setup lang="ts">
import type { Host } from '../../types/ssh'

defineProps<{
  host: Host
  groupName?: string | null
}>()

const emit = defineEmits<{
  select: []
  connect: []
}>()

const osIcon: Record<string, string> = {
  linux: 'i-lucide-server',
  macos: 'i-lucide-apple',
  windows: 'i-lucide-app-window',
  other: 'i-lucide-monitor'
}
</script>

<template>
  <div
    class="group flex items-center gap-3 p-3 rounded-lg border border-default cursor-pointer transition-colors hover:border-primary hover:bg-primary/5"
    @click="emit('select')"
  >
    <UIcon :name="osIcon[host.os ?? 'other'] ?? 'i-lucide-monitor'" class="size-8 text-dimmed shrink-0" />

    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold text-highlighted truncate">
        {{ host.label }}
      </p>
      <p class="text-xs text-dimmed truncate">
        {{ host.address }}:{{ host.port }}
      </p>
      <UBadge
        v-if="groupName"
        :label="groupName"
        size="xs"
        color="neutral"
        variant="subtle"
        class="mt-1"
      />
    </div>

    <UButton
      label="Connect"
      icon="i-lucide-terminal"
      size="xs"
      color="primary"
      variant="soft"
      @click.stop="emit('connect')"
    />
  </div>
</template>
