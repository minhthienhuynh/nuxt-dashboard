<script setup lang="ts">
import type { InfrastructureService, ServiceTypeInfo } from '~/types'

const toast = useToast()

const rebuilding = ref<Set<number>>(new Set())

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

async function rebuildServiceAction(svc: InfrastructureService) {
  rebuilding.value = new Set(rebuilding.value).add(svc.id)
  try {
    await $fetch(`/api/services/${svc.id}/rebuild`, { method: 'POST' })
    await refreshServices()
    toast.add({ title: `${svc.serviceType?.name || svc.containerName} rebuilt successfully`, color: 'success' })
  } catch {
    toast.add({ title: `Failed to rebuild ${svc.serviceType?.name || svc.containerName}`, color: 'error' })
  } finally {
    rebuilding.value = new Set(rebuilding.value)
    rebuilding.value.delete(svc.id)
  }
}

// ── Modals ──────────────────────────────────────────────────

const addOpen = ref(false)
const deleteOpen = ref(false)
const selectedForDelete = ref<InfrastructureService | null>(null)
const logsOpen = ref(false)
const logsSvc = ref<InfrastructureService | null>(null)
const settingsOpen = ref(false)
const settingsSvc = ref<InfrastructureService | null>(null)

function confirmDelete(svc: InfrastructureService) {
  selectedForDelete.value = svc
  deleteOpen.value = true
}

function openLogs(svc: InfrastructureService) {
  logsSvc.value = svc
  logsOpen.value = true
}

function openSettings(svc: InfrastructureService) {
  settingsSvc.value = svc
  settingsOpen.value = true
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
                icon="i-lucide-hammer"
                label="Rebuild"
                :loading="rebuilding.has(svc.id)"
                @click="rebuildServiceAction(svc)"
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
                @click="confirmDelete(svc)"
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

  <!-- Modals -->
  <ObjectStorageAddModal
    v-model:open="addOpen"
    :service-types="serviceTypes || []"
    @created="refreshServices()"
  />
  <ObjectStorageDeleteModal
    v-model:open="deleteOpen"
    :service="selectedForDelete"
    @deleted="refreshServices()"
  />
  <ObjectStorageLogsModal
    v-model:open="logsOpen"
    :service="logsSvc"
  />
  <ObjectStorageSettingsModal
    v-model:open="settingsOpen"
    :service="settingsSvc"
    @updated="refreshServices()"
  />
</template>
