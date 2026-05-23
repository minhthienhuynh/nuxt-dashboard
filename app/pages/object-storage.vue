<script setup lang="ts">
import type { InfrastructureService, ServiceTypeInfo } from '~/types'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')

const toast = useToast()

const statusColor: Record<string, 'green' | 'gray' | 'red'> = {
  running: 'green',
  stopped: 'gray',
  error: 'red'
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
</script>

<template>
  <UDashboardPanel id="object-storage">
    <template #header>
      <UDashboardNavbar title="Object Storage">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="!storageServices.length" class="text-center py-16">
        <UIcon name="i-lucide-hard-drive" class="size-12 text-muted mx-auto mb-4" />
        <p class="text-sm text-muted mb-4">
          No storage services configured yet.
        </p>
        <UButton label="Add Service" color="primary" icon="i-lucide-plus" />
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
                color="green"
                icon="i-lucide-play"
                label="Start"
                @click="startService(svc)"
              />
              <UButton
                v-else
                size="xs"
                color="amber"
                icon="i-lucide-square"
                label="Stop"
                @click="stopService(svc)"
              />
              <UButton
                size="xs"
                variant="outline"
                icon="i-lucide-file-text"
                label="Logs"
              />
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-settings"
                label="Settings"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="red"
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
</template>
