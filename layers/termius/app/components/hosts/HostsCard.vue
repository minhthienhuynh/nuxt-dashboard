<script setup lang="ts">
import type { Host } from '../../types/ssh'

const props = defineProps<{
  host: Host
  groupName?: string | null
  // In list view the card drops its box border (rows are separated by the
  // container's divider lines instead).
  list?: boolean
}>()

const emit = defineEmits<{
  select: []
  connect: []
  sftp: []
}>()

// Brand icon + color for the host's detected OS (see utils/os.ts).
const os = computed(() => osMeta(props.host.os))
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :aria-label="`Open ${host.label}`"
    :class="[
      'group flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary',
      list ? '' : 'rounded-lg border border-default hover:border-primary'
    ]"
    @click="emit('select')"
    @keydown.enter="emit('select')"
    @keydown.space.prevent="emit('select')"
  >
    <UIcon
      :name="os.icon"
      class="size-8 shrink-0"
      :class="{ 'text-dimmed': !os.color }"
      :style="os.color ? { color: os.color } : undefined"
    />

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

    <div class="flex items-center gap-1.5 shrink-0">
      <UTooltip text="SFTP">
        <UButton
          icon="i-lucide-folder-open"
          size="xs"
          color="neutral"
          variant="soft"
          aria-label="Open SFTP"
          @click.stop="emit('sftp')"
        />
      </UTooltip>
      <UButton
        label="Connect"
        icon="i-lucide-terminal"
        size="xs"
        color="primary"
        variant="soft"
        @click.stop="emit('connect')"
      />
    </div>
  </div>
</template>
