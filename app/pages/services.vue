<script setup lang="ts">
import type { InfrastructureService, ServiceTypeInfo, ProxyConfig } from '~/types'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')
const USelect = resolveComponent('USelect')
const UInput = resolveComponent('UInput')

const { data: services, status, refresh } = await useFetch<InfrastructureService[]>('/api/services', { lazy: true })
const { data: serviceTypes } = await useFetch<ServiceTypeInfo[]>('/api/services?types=only', { lazy: true })
const { data: proxy, refresh: refreshProxy } = await useFetch<ProxyConfig>('/api/proxy', { lazy: true })

const isAddModalOpen = ref(false)
const proxyEditOpen = ref(false)
const editingProxy = reactive({ type: 'caddy', httpPort: 80, httpsPort: 443, adminPort: 8080, domain: '*.test' } as ProxyConfig)

const statusColor: Record<string, 'green' | 'gray' | 'red'> = {
  running: 'green',
  stopped: 'gray',
  error: 'red'
}

const proxyTypes = ['caddy', 'traefik', 'nginx']

function openProxyEdit() {
  if (proxy.value) {
    Object.assign(editingProxy, proxy.value)
  }
  proxyEditOpen.value = true
}

async function saveProxy() {
  await $fetch('/api/proxy', { method: 'PUT', body: editingProxy })
  await refreshProxy()
  proxyEditOpen.value = false
}

function onServiceAdded() {
  isAddModalOpen.value = false
  refresh()
}

async function syncContainers() {
  const result = await $fetch('/api/containers/sync', { method: 'POST' })
  if ((result as any).updated.length > 0 || (result as any).missing.length > 0) {
    alert(`Synced: ${(result as any).updated.length} updated, ${(result as any).missing.length} missing`)
  }
  refresh()
}

async function startService(service: InfrastructureService) {
  await $fetch(`/api/services/${service.id}/start`, { method: 'POST' })
  refresh()
}

async function stopService(service: InfrastructureService) {
  await $fetch(`/api/services/${service.id}/stop`, { method: 'POST' })
  refresh()
}

async function deleteService(id: number) {
  await $fetch(`/api/services/${id}`, { method: 'DELETE' })
  refresh()
}
</script>

<template>
  <UDashboardPanel id="services">
    <template #header>
      <UDashboardNavbar title="Services">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Proxy section -->
      <div class="mb-6 p-4 rounded-lg border border-default bg-elevated/30">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-network" class="size-5 text-primary" />
            <h3 class="text-sm font-semibold">
              Reverse Proxy
            </h3>
          </div>
          <UButton
            size="xs"
            variant="outline"
            label="Configure"
            icon="i-lucide-settings"
            @click="openProxyEdit"
          />
        </div>
        <div class="flex items-center gap-4 text-sm text-muted">
          <span>Type: <strong class="text-default">{{ proxy?.type || 'caddy' }}</strong></span>
          <span>HTTP: <strong class="text-default">{{ proxy?.httpPort || 80 }}</strong></span>
          <span>HTTPS: <strong class="text-default">{{ proxy?.httpsPort || 443 }}</strong></span>
          <span>Domain: <strong class="text-default">{{ proxy?.domain || '*.test' }}</strong></span>
        </div>
      </div>

      <!-- Add Service + Sync buttons -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold">
          Infrastructure Services
        </h3>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            label="Sync"
            @click="syncContainers"
          />
          <UButton
            size="xs"
            label="Add Service"
            icon="i-lucide-plus"
            color="primary"
            @click="isAddModalOpen = true"
          />
        </div>
      </div>

      <!-- Services list -->
      <div v-if="status === 'pending'" class="text-sm text-muted">
        Loading...
      </div>
      <div v-else-if="!services?.length" class="text-sm text-muted p-4 text-center border rounded-lg border-dashed">
        No infrastructure services added yet. Click "Add Service" to add one.
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="svc in services"
          :key="svc.id"
          class="p-3 rounded-lg border border-default hover:border-primary/50 transition-colors"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <UIcon :name="svc.serviceType?.category === 'database' ? 'i-lucide-database' : 'i-lucide-box'" class="size-4 text-muted" />
              <span class="text-sm font-medium">{{ svc.containerName }}</span>
            </div>
            <UBadge :color="statusColor[svc.status]" variant="subtle" size="xs">
              {{ svc.status }}
            </UBadge>
          </div>
          <div class="text-xs text-muted mb-2">
            {{ svc.serviceType?.name }}
          </div>
          <div v-if="svc.ports?.length" class="text-xs text-muted mb-2">
            Ports: {{ svc.ports.map((p: any) => `${p.hostPort}:${p.containerPort}`).join(', ') }}
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1">
              <UButton
                v-if="svc.status !== 'running'"
                size="xs"
                color="green"
                variant="ghost"
                icon="i-lucide-play"
                @click="startService(svc)"
              />
              <UButton
                v-else
                size="xs"
                color="amber"
                variant="ghost"
                icon="i-lucide-square"
                @click="stopService(svc)"
              />
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-trash"
                color="error"
                @click="deleteService(svc.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Proxy Edit Modal -->
  <UModal v-model:open="proxyEditOpen" title="Proxy Settings">
    <template #body>
      <div class="space-y-3 p-4">
        <div>
          <label class="text-sm font-medium">Proxy Type</label>
          <USelect v-model="editingProxy.type" :items="proxyTypes" class="mt-1" />
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="text-sm font-medium">HTTP Port</label>
            <UInput v-model.number="editingProxy.httpPort" type="number" class="mt-1" />
          </div>
          <div>
            <label class="text-sm font-medium">HTTPS Port</label>
            <UInput v-model.number="editingProxy.httpsPort" type="number" class="mt-1" />
          </div>
          <div>
            <label class="text-sm font-medium">Admin Port</label>
            <UInput v-model.number="editingProxy.adminPort" type="number" class="mt-1" />
          </div>
        </div>
        <div>
          <label class="text-sm font-medium">Domain</label>
          <UInput v-model="editingProxy.domain" class="mt-1" />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 p-4">
        <UButton label="Cancel" variant="outline" @click="proxyEditOpen = false" />
        <UButton label="Save" color="primary" @click="saveProxy" />
      </div>
    </template>
  </UModal>

  <!-- Add Service Modal -->
  <ServicesAddModal v-model:open="isAddModalOpen" :service-types="serviceTypes" @added="onServiceAdded" />
</template>
