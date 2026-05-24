<script setup lang="ts">
import type { InfrastructureService } from '~/types'

const props = defineProps<{
  service: InfrastructureService | null
}>()

const emit = defineEmits<{
  updated: []
}>()

const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const editingEnvVars = ref<{ key: string, value: string }[]>([])
const editingPorts = ref<{ hostPort: string, containerPort: string }[]>([])
const editingVolumes = ref<{ source: string, target: string }[]>([])

watch(open, (val) => {
  if (val && props.service) {
    editingEnvVars.value = (props.service.envVars || []).map(e => ({ key: e.key, value: e.isSecret ? '' : e.value }))
    editingPorts.value = (props.service.ports || []).map(p => ({ hostPort: p.hostPort, containerPort: p.containerPort }))
    editingVolumes.value = (props.service.volumes || []).map(v => ({ source: v.source, target: v.target }))
  }
})

async function saveSettings() {
  if (!props.service) return
  try {
    await $fetch(`/api/services/${props.service.id}`, {
      method: 'PUT',
      body: {
        envVars: editingEnvVars.value.filter(e => e.key),
        ports: editingPorts.value.filter(p => p.hostPort && p.containerPort),
        volumes: editingVolumes.value.filter(v => v.source && v.target)
      }
    })
    open.value = false
    emit('updated')
    toast.add({ title: 'Service settings saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save settings', color: 'error' })
  }
}

function addEnvVar() {
  editingEnvVars.value.push({ key: '', value: '' })
}
function removeEnvVar(index: number) {
  editingEnvVars.value.splice(index, 1)
}
function addPort() {
  editingPorts.value.push({ hostPort: '', containerPort: '' })
}
function removePort(index: number) {
  editingPorts.value.splice(index, 1)
}
function addVolume() {
  editingVolumes.value.push({ source: '', target: '' })
}
function removeVolume(index: number) {
  editingVolumes.value.splice(index, 1)
}
</script>

<template>
  <UModal v-model:open="open" title="Service Settings">
    <template #body>
      <div class="space-y-4 p-4">
        <!-- Env Vars -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium">Environment Variables</label>
            <UButton
              size="xs"
              variant="outline"
              icon="i-lucide-plus"
              label="Add"
              @click="addEnvVar"
            />
          </div>
          <div
            v-if="!editingEnvVars.length"
            class="text-xs text-muted"
          >
            No env vars configured.
          </div>
          <div
            v-for="(env, i) in editingEnvVars"
            :key="i"
            class="flex items-center gap-2 mb-2"
          >
            <UInput
              v-model="env.key"
              placeholder="KEY"
              class="flex-1"
              size="xs"
            />
            <UInput
              v-model="env.value"
              placeholder="value"
              class="flex-1"
              size="xs"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              @click="removeEnvVar(i)"
            />
          </div>
        </div>

        <!-- Ports -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium">Ports</label>
            <UButton
              size="xs"
              variant="outline"
              icon="i-lucide-plus"
              label="Add"
              @click="addPort"
            />
          </div>
          <div
            v-if="!editingPorts.length"
            class="text-xs text-muted"
          >
            No ports configured.
          </div>
          <div
            v-for="(port, i) in editingPorts"
            :key="i"
            class="flex items-center gap-2 mb-2"
          >
            <UInput
              v-model="port.hostPort"
              placeholder="Host port"
              size="xs"
              class="w-28"
            />
            <span class="text-xs text-muted">:</span>
            <UInput
              v-model="port.containerPort"
              placeholder="Container port"
              size="xs"
              class="w-28"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              @click="removePort(i)"
            />
          </div>
        </div>

        <!-- Volumes -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium">Volumes</label>
            <UButton
              size="xs"
              variant="outline"
              icon="i-lucide-plus"
              label="Add"
              @click="addVolume"
            />
          </div>
          <div
            v-if="!editingVolumes.length"
            class="text-xs text-muted"
          >
            No volumes configured.
          </div>
          <div
            v-for="(vol, i) in editingVolumes"
            :key="i"
            class="flex items-center gap-2 mb-2"
          >
            <UInput
              v-model="vol.source"
              placeholder="Source"
              size="xs"
              class="flex-1"
            />
            <span class="text-xs text-muted">:</span>
            <UInput
              v-model="vol.target"
              placeholder="Target"
              size="xs"
              class="flex-1"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              @click="removeVolume(i)"
            />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 p-4">
        <UButton label="Cancel" variant="outline" @click="open = false" />
        <UButton label="Save" color="primary" @click="saveSettings" />
      </div>
    </template>
  </UModal>
</template>
