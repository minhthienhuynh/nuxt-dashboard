<script setup lang="ts">
import { computed } from 'vue'
import type { SSHKey } from '../../types/ssh'

const props = defineProps<{
  sshKey: SSHKey
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

// A short, non-secret reference to the public key — enough to tell keys apart
// without rendering the full blob.
const publicKeyPreview = computed(() => {
  const key = props.sshKey.publicKey.trim()
  return key.length > 40 ? `${key.slice(0, 40)}…` : key
})

const menuItems = computed(() => [[
  { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => emit('edit') },
  { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => emit('delete') }
]])
</script>

<template>
  <div class="group relative flex items-center gap-3 p-4 rounded-lg border border-default transition-colors hover:border-primary hover:bg-primary/5">
    <div class="flex items-center justify-center size-10 rounded-md bg-primary/10 text-primary shrink-0">
      <UIcon name="i-lucide-key-round" class="size-5" />
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <p class="text-sm font-semibold text-highlighted truncate">
          {{ sshKey.label }}
        </p>
        <UBadge
          :label="sshKey.keyType"
          size="xs"
          color="neutral"
          variant="subtle"
        />
      </div>
      <p class="text-xs text-dimmed font-mono truncate">
        {{ publicKeyPreview }}
      </p>
    </div>

    <UDropdownMenu :items="menuItems">
      <UButton
        icon="i-lucide-ellipsis-vertical"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="Key actions"
        @click.stop
      />
    </UDropdownMenu>
  </div>
</template>
