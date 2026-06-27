<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  resource: 'ssh-keys' | 'identities'
  id: string | null
  label?: string
}>()

const emit = defineEmits<{
  deleted: []
}>()

const open = defineModel<boolean>('open', { default: false })

const isKey = computed(() => props.resource === 'ssh-keys')
const noun = computed(() => (isKey.value ? 'key' : 'identity'))

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
      <p class="text-sm text-toned mb-4">
        <template v-if="isKey">
          Identities using this key keep existing — they lose the key reference rather than being deleted.
        </template>
        <template v-else>
          Hosts using this identity keep existing — they become credential-less rather than being deleted.
        </template>
      </p>

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
