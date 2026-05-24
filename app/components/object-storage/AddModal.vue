<script setup lang="ts">
import type { ServiceTypeInfo } from '~/types'

const props = defineProps<{
  serviceTypes: ServiceTypeInfo[]
}>()

const emit = defineEmits<{
  created: []
}>()

const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const storageTypeOptions = computed(() =>
  props.serviceTypes
    .filter(t => t.category === 'storage')
    .map(t => ({ label: t.name, value: t.key }))
)

const selectedType = computed(() =>
  props.serviceTypes.find(t => t.key === creating.serviceTypeKey)
)

const creating = reactive({
  serviceTypeKey: 'rustfs',
  containerName: ''
})

async function createService() {
  try {
    await $fetch('/api/services', {
      method: 'POST',
      body: {
        serviceTypeKey: creating.serviceTypeKey,
        containerName: creating.containerName || undefined
      }
    })
    open.value = false
    creating.serviceTypeKey = 'rustfs'
    creating.containerName = ''
    emit('created')
    toast.add({ title: 'Storage service created', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to create storage service', color: 'error' })
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Add Storage Service">
    <template #body>
      <div class="space-y-3 p-4">
        <div>
          <label class="text-sm font-medium">Service Type</label>
          <USelect v-model="creating.serviceTypeKey" :items="storageTypeOptions" class="mt-1" />
        </div>
        <div>
          <label class="text-sm font-medium">Container Name (optional)</label>
          <UInput v-model="creating.containerName" class="mt-1" placeholder="auto-generated if empty" />
        </div>
        <div v-if="selectedType?.requiredEnv && Object.keys(selectedType.requiredEnv).length">
          <label class="text-sm font-medium">Default Environment Variables</label>
          <div class="mt-1 p-2 rounded bg-default/50 text-xs font-mono space-y-1">
            <div v-for="(_val, key) in selectedType.requiredEnv" :key="key">
              <span class="text-primary">{{ key }}</span>=<span class="text-muted">{{ _val }}</span>
            </div>
          </div>
          <p class="text-xs text-muted mt-1">
            Auto-set with defaults if not overridden.
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 p-4">
        <UButton label="Cancel" variant="outline" @click="open = false" />
        <UButton label="Create" color="primary" @click="createService" />
      </div>
    </template>
  </UModal>
</template>
