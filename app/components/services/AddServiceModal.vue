<script setup lang="ts">
import type { ServiceTypeInfo } from '~/types'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{
  serviceTypes?: ServiceTypeInfo[]
}>()

const emit = defineEmits<{
  added: []
}>()

const selectedTypeKey = ref('')
const containerName = ref('')
const isSubmitting = ref(false)
const error = ref('')

const typeOptions = computed(() =>
  (props.serviceTypes || []).map(t => ({
    label: `${t.name} (${t.category})`,
    value: t.key
  }))
)

const selectedType = computed(() =>
  props.serviceTypes?.find(t => t.key === selectedTypeKey.value)
)

async function handleAdd() {
  if (!selectedTypeKey.value) return
  error.value = ''

  try {
    isSubmitting.value = true
    await $fetch('/api/services', {
      method: 'POST',
      body: {
        serviceTypeKey: selectedTypeKey.value,
        containerName: containerName.value || undefined
      }
    })
    selectedTypeKey.value = ''
    containerName.value = ''
    emit('added')
  } catch (e: unknown) {
    const err = e as { statusMessage?: string, message?: string }
    error.value = err?.statusMessage || err?.message || 'Failed to add service'
  } finally {
    isSubmitting.value = false
  }
}

function onClose() {
  selectedTypeKey.value = ''
  containerName.value = ''
  error.value = ''
}
</script>

<template>
  <UModal v-model:open="open" title="Add Service" @close="onClose">
    <template #body>
      <div class="space-y-4 p-4">
        <div v-if="error" class="text-sm text-error bg-error/10 p-2 rounded">
          {{ error }}
        </div>

        <div>
          <label class="text-sm font-medium">Service Type</label>
          <USelect
            v-model="selectedTypeKey"
            :items="typeOptions"
            placeholder="Select service type..."
            class="mt-1"
            searchable
          />
        </div>

        <div>
          <label class="text-sm font-medium">Container Name <span class="text-muted">(optional)</span></label>
          <UInput v-model="containerName" placeholder="Auto-generated if empty" class="mt-1" />
        </div>

        <div v-if="selectedType?.defaultImage" class="text-xs text-muted">
          Image: {{ selectedType.defaultImage }}
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 p-4">
        <UButton label="Cancel" variant="outline" @click="open = false" />
        <UButton
          label="Add Service"
          color="primary"
          :disabled="!selectedTypeKey || isSubmitting"
          @click="handleAdd"
        />
      </div>
    </template>
  </UModal>
</template>
