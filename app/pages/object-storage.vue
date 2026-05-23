<script setup lang="ts">
import type { InfrastructureService, ServiceTypeInfo } from '~/types'

const toast = useToast()

const statusColor: Record<string, 'success' | 'neutral' | 'error'> = {
  running: 'success',
  stopped: 'neutral',
  error: 'error'
}

const { data: services, refresh: refreshServices } = await useFetch<InfrastructureService[]>('/api/services', { lazy: true })
const { data: serviceTypes } = await useFetch<ServiceTypeInfo[]>('/api/services?types=only', { lazy: true })

const storageServices = computed(() =>
  (services.value || []).filter(s =>
    s.serviceType?.category === 'storage'
  )
)

function getTypeInfo(service: InfrastructureService): ServiceTypeInfo | undefined {
  return serviceTypes.value?.find(t => t.id === service.serviceTypeId)
}

function parsePorts(service: InfrastructureService): { hostPort: string, containerPort: string }[] {
  if (!service.ports?.length) {
    const typeInfo = getTypeInfo(service)
    if (typeInfo?.defaultPorts?.length) {
      return typeInfo.defaultPorts.map(p => ({ hostPort: p.hostPort, containerPort: p.containerPort }))
    }
    return []
  }
  return service.ports.map(p => ({ hostPort: p.hostPort, containerPort: p.containerPort }))
}

async function startService(svc: InfrastructureService) {
  try {
    await $fetch(`/api/services/${svc.id}/start`, { method: 'POST' })
    await refreshServices()
    toast.add({ title: `${svc.serviceType?.name || svc.containerName} started`, color: 'success' })
  } catch {
    toast.add({ title: `Failed to start ${svc.serviceType?.name || svc.containerName}`, color: 'error' })
  }
}

async function stopService(svc: InfrastructureService) {
  try {
    await $fetch(`/api/services/${svc.id}/stop`, { method: 'POST' })
    await refreshServices()
    toast.add({ title: `${svc.serviceType?.name || svc.containerName} stopped`, color: 'success' })
  } catch {
    toast.add({ title: `Failed to stop ${svc.serviceType?.name || svc.containerName}`, color: 'error' })
  }
}

async function deleteService(svc: InfrastructureService) {
  if (!window.confirm(`Delete ${svc.serviceType?.name || svc.containerName}? This action cannot be undone.`)) return
  try {
    await $fetch(`/api/services/${svc.id}`, { method: 'DELETE' })
    await refreshServices()
    toast.add({ title: `${svc.serviceType?.name || svc.containerName} deleted`, color: 'success' })
  } catch {
    toast.add({ title: `Failed to delete ${svc.serviceType?.name || svc.containerName}`, color: 'error' })
  }
}

// ── Logs ───────────────────────────────────────────────────

const { lines: logsLines, connected: logsConnected, connect: logsConnect, disconnect: logsDisconnect } = useContainerLogs()

const logsOpen = ref(false)
const logsServiceName = ref('')

function openLogs(svc: InfrastructureService) {
  logsServiceName.value = svc.serviceType?.name || svc.containerName
  logsOpen.value = true
  logsConnect(`/api/services/${svc.id}/logs/stream`)
}

function closeLogs() {
  logsOpen.value = false
  logsDisconnect()
}

// ── Add Service ─────────────────────────────────────────────

const addOpen = ref(false)
const storageTypeOptions = computed(() =>
  (serviceTypes.value || [])
    .filter(t => t.category === 'storage')
    .map(t => ({ label: t.name, value: t.key }))
)
const selectedType = computed(() =>
  serviceTypes.value?.find(t => t.key === creating.serviceTypeKey)
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
    await refreshServices()
    addOpen.value = false
    creating.serviceTypeKey = 'rustfs'
    creating.containerName = ''
    toast.add({ title: 'Storage service created', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to create storage service', color: 'error' })
  }
}

// ── Settings ────────────────────────────────────────────────

const settingsOpen = ref(false)
const settingsSvc = ref<InfrastructureService | null>(null)
const editingEnvVars = ref<{ key: string, value: string }[]>([])
const editingPorts = ref<{ hostPort: string, containerPort: string }[]>([])
const editingVolumes = ref<{ source: string, target: string }[]>([])

function openSettings(svc: InfrastructureService) {
  settingsSvc.value = svc
  editingEnvVars.value = (svc.envVars || []).map(e => ({ key: e.key, value: e.isSecret ? '' : e.value }))
  editingPorts.value = (svc.ports || []).map(p => ({ hostPort: p.hostPort, containerPort: p.containerPort }))
  editingVolumes.value = (svc.volumes || []).map(v => ({ source: v.source, target: v.target }))
  settingsOpen.value = true
}

async function saveSettings() {
  if (!settingsSvc.value) return
  try {
    await $fetch(`/api/services/${settingsSvc.value.id}`, {
      method: 'PUT',
      body: {
        envVars: editingEnvVars.value.filter(e => e.key),
        ports: editingPorts.value.filter(p => p.hostPort && p.containerPort),
        volumes: editingVolumes.value.filter(v => v.source && v.target)
      }
    })
    await refreshServices()
    settingsOpen.value = false
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
  <UDashboardPanel id="object-storage">
    <template #header>
      <UDashboardNavbar title="Object Storage">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #trailing>
          <UButton
            v-if="storageServices.length"
            label="Add Service"
            color="primary"
            icon="i-lucide-plus"
            size="xs"
            @click="addOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="!storageServices.length" class="text-center py-16">
        <UIcon name="i-lucide-hard-drive" class="size-12 text-muted mx-auto mb-4" />
        <p class="text-sm text-muted mb-4">
          No storage services configured yet.
        </p>
        <UButton
          label="Add Service"
          color="primary"
          icon="i-lucide-plus"
          @click="addOpen = true"
        />
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="svc in storageServices"
          :key="svc.id"
          class="p-4 rounded-lg border border-default bg-elevated/30"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-hard-drive" class="size-5 text-primary" />
              <h3 class="text-sm font-semibold">
                {{ svc.serviceType?.name || 'Storage' }}
              </h3>
              <UBadge
                :color="statusColor[svc.status || 'stopped']"
                variant="subtle"
                size="xs"
              >
                {{ svc.status || 'stopped' }}
              </UBadge>
            </div>
            <div class="flex items-center gap-1.5">
              <UButton
                v-if="svc.status !== 'running'"
                size="xs"
                color="success"
                icon="i-lucide-play"
                label="Start"
                @click="startService(svc)"
              />
              <UButton
                v-else
                size="xs"
                color="warning"
                icon="i-lucide-square"
                label="Stop"
                @click="stopService(svc)"
              />
              <UButton
                size="xs"
                variant="outline"
                icon="i-lucide-file-text"
                label="Logs"
                @click="openLogs(svc)"
              />
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-settings"
                label="Settings"
                @click="openSettings(svc)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash"
                @click="deleteService(svc)"
              />
            </div>
          </div>
          <div class="text-xs text-muted mb-2">
            {{ svc.serviceType?.defaultImage || 'Custom' }} — container: {{ svc.containerName }}
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(port, i) in parsePorts(svc)"
              :key="i"
              class="text-xs bg-default/50 rounded px-2 py-0.5"
            >
              {{ port.hostPort }}:{{ port.containerPort }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add Service Modal -->
  <UModal v-model:open="addOpen" title="Add Storage Service">
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
        <UButton label="Cancel" variant="outline" @click="addOpen = false" />
        <UButton label="Create" color="primary" @click="createService" />
      </div>
    </template>
  </UModal>

  <!-- Logs Modal -->
  <UModal v-model:open="logsOpen" :title="`Logs: ${logsServiceName}`" @close="closeLogs">
    <template #body>
      <div class="p-4">
        <div class="flex items-center gap-2 mb-3">
          <UBadge :color="logsConnected ? 'success' : 'neutral'" variant="subtle" size="xs">
            {{ logsConnected ? 'Live' : 'Connecting...' }}
          </UBadge>
        </div>
        <pre class="text-xs bg-default/50 rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono">{{ logsLines.join('\n') || 'Waiting for logs...' }}</pre>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 p-4">
        <UButton label="Close" variant="outline" @click="closeLogs" />
      </div>
    </template>
  </UModal>

  <!-- Settings Modal -->
  <UModal v-model:open="settingsOpen" title="Service Settings">
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
        <UButton label="Cancel" variant="outline" @click="settingsOpen = false" />
        <UButton label="Save" color="primary" @click="saveSettings" />
      </div>
    </template>
  </UModal>
</template>
