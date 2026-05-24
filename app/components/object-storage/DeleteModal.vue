<script setup lang="ts">
import type { InfrastructureService } from '~/types'

const props = defineProps<{
  service: InfrastructureService | null
}>()

const emit = defineEmits<{
  deleted: []
}>()

const open = defineModel<boolean>('open', { default: false })
const toast = useToast()
const loading = ref(false)

async function onDelete() {
  if (!props.service) return
  loading.value = true
  try {
    await $fetch(`/api/services/${props.service.id}`, { method: 'DELETE' })
    open.value = false
    emit('deleted')
    toast.add({
      title: `${props.service.serviceType?.name || props.service.containerName} deleted`,
      color: 'success'
    })
  } catch {
    toast.add({
      title: `Failed to delete ${props.service.serviceType?.name || props.service.containerName}`,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Delete Service">
    <template #body>
      <div class="space-y-4 p-4">
        <p>
          Are you sure you want to delete
          <strong>{{ service?.serviceType?.name || service?.containerName }}</strong>?
        </p>
        <p class="text-sm text-(--ui-text-dimmed)">
          This action cannot be undone. Any data associated with this service will be permanently lost.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 p-4">
        <UButton label="Cancel" variant="outline" @click="open = false" />
        <UButton
          label="Delete"
          color="error"
          :loading="loading"
          @click="onDelete"
        />
      </div>
    </template>
  </UModal>
</template>
