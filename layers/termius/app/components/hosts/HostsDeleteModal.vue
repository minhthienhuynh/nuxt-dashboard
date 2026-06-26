<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  resource: 'hosts' | 'groups'
  id: string | null
  label?: string
}>()

const emit = defineEmits<{
  deleted: []
}>()

const open = defineModel<boolean>('open', { default: false })

const isGroup = computed(() => props.resource === 'groups')
const noun = computed(() => (isGroup.value ? 'group' : 'host'))

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
      <p v-if="isGroup" class="text-sm text-toned mb-4">
        Hosts in this group are kept — they become ungrouped rather than deleted.
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
