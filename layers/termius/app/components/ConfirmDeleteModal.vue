<script setup lang="ts">
import { computed } from 'vue'

// Shared delete-confirmation modal for any REST resource. Replaces the
// near-identical HostsDeleteModal/KeychainDeleteModal: confirm → DELETE the
// resource → toast → emit('deleted'). The warning copy (which differs per
// resource) is supplied by the caller via the #warning slot.
const props = defineProps<{
  resource: string
  id: string | null
  label?: string
  // Display noun for the title/toasts; falls back to a built-in map, then 'item'.
  noun?: string
}>()

const emit = defineEmits<{
  deleted: []
}>()

const open = defineModel<boolean>('open', { default: false })

const NOUNS: Record<string, string> = {
  'hosts': 'host',
  'groups': 'group',
  'tags': 'tag',
  'ssh-keys': 'key',
  'identities': 'identity'
}

const noun = computed(() => props.noun ?? NOUNS[props.resource] ?? 'item')

const toast = useToast()

async function onConfirm() {
  if (!props.id) return
  try {
    await $fetch(`/api/${props.resource}/${props.id}`, { method: 'DELETE' })
    toast.add({ title: `Deleted ${noun.value}`, color: 'success' })
    open.value = false
    emit('deleted')
  } catch {
    toast.add({ title: `Could not delete ${noun.value}`, color: 'error' })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Delete ${noun}${label ? ` “${label}”` : ''}`"
    description="This action cannot be undone."
  >
    <template #body>
      <div class="text-sm text-toned mb-4">
        <slot name="warning" :resource="resource" :noun="noun" />
      </div>

      <div class="flex justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="subtle"
          @click="open = false"
        />
        <UButton
          label="Delete"
          color="error"
          loading-auto
          @click="onConfirm"
        />
      </div>
    </template>
  </UModal>
</template>
