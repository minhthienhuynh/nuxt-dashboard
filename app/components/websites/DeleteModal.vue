<script setup lang="ts">
import type { Website } from '~/types'

const props = defineProps<{
  website: Website | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  deleted: []
}>()

const loading = ref(false)

async function onDelete() {
  if (!props.website) return
  loading.value = true
  try {
    await $fetch(`/api/websites/${props.website.id}`, { method: 'DELETE' })
    emit('deleted')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Delete Website">
    <template #body>
      <div class="space-y-4">
        <p>
          Are you sure you want to delete
          <strong>{{ website?.name }}</strong>
          (<code>{{ website?.domain }}</code>)?
        </p>
        <p class="text-sm text-(--ui-text-dimmed)">
          This action cannot be undone. All extensions configuration for this website will also be deleted.
        </p>

        <div class="flex justify-end gap-3">
          <UButton variant="outline" label="Cancel" @click="open = false" />
          <UButton
            label="Delete"
            color="error"
            :loading="loading"
            @click="onDelete"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
