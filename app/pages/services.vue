<script setup lang="ts">
import type { InfrastructureService, ServiceTypeInfo, ProxyConfig, SyncResult, ServiceStatus } from '~/types'

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

const proxyTypes = ['caddy']

const proxyMeta = computed(() => {
  const t = proxy.value?.type
  if (t === 'caddy') {
    return { label: 'Caddy', icon: 'i-lucide-globe', desc: 'Caddy v2 — auto HTTPS, Caddyfile', adminPort: 2019 }
  }
  return { label: 'Caddy', icon: 'i-lucide-globe', desc: 'Caddy v2 — auto HTTPS, Caddyfile', adminPort: 2019 }
})

const proxyTypeOptions = computed(() => [
  { label: 'Caddy', value: 'caddy' }
])

function getProxyDesc(t: string) {
  switch (t) {
    case 'caddy': return 'Caddy v2 — auto HTTPS, Caddyfile'
    case 'traefik': return 'Traefik v3 — dynamic YAML, dashboard'
    case 'nginx': return 'Nginx — fastcgi_pass + proxy_pass'
    default: return ''
  }
}

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

const proxyStatus = computed<ServiceStatus>(() =>
  (proxy.value as any)?.status || 'stopped'
)

const { lines: proxyLogLines, connected: proxyLogConnected, connect: proxyLogConnect, disconnect: proxyLogDisconnect } = useContainerLogs()

const proxyLogsOpen = ref(false)
const serviceLogsOpen = ref(false)
const serviceLogTarget = ref<InfrastructureService | null>(null)
const { lines: svcLogLines, connected: svcLogConnected, connect: svcLogConnect, disconnect: svcLogDisconnect } = useContainerLogs()

function openProxyLogs() {
  proxyLogsOpen.value = true
  proxyLogConnect('/api/proxy/logs/stream')
}

function closeProxyLogs() {
  proxyLogsOpen.value = false
  proxyLogDisconnect()
}

function openServiceLogs(svc: InfrastructureService) {
  serviceLogTarget.value = svc
  serviceLogsOpen.value = true
  svcLogConnect(`/api/services/${svc.id}/logs/stream`)
}

function closeServiceLogs() {
  serviceLogsOpen.value = false
  serviceLogTarget.value = null
  svcLogDisconnect()
}

async function deployProxy() {
  await $fetch('/api/proxy/deploy', { method: 'POST' })
  refreshProxy()
  refresh()
}

async function stopProxy() {
  await $fetch('/api/proxy/stop', { method: 'POST' })
  refreshProxy()
  refresh()
}

async function syncContainers() {
  const result = await $fetch<SyncResult>('/api/containers/sync', { method: 'POST' })
  const toast = useToast()
  toast.add({
    title: 'Sync completed',
    description: `${result.running.length} running, ${result.stopped.length} stopped, ${result.missing.length} missing`,
    color: result.missing.length > 0 ? 'warning' : 'success'
  })
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
            <UIcon :name="proxyMeta.icon" class="size-5 text-primary" />
            <h3 class="text-sm font-semibold">
              Web Server / Proxy — {{ proxyMeta.label }}
            </h3>
            <UBadge :color="statusColor[proxyStatus]" variant="subtle" size="xs">
              {{ proxyStatus }}
            </UBadge>
          </div>
          <div class="flex items-center gap-1.5">
            <UButton
              v-if="proxyStatus !== 'running'"
              size="xs"
              color="green"
              icon="i-lucide-play"
              label="Deploy"
              class="cursor-pointer"
              @click="deployProxy"
            />
            <UButton
              v-else
              size="xs"
              color="amber"
              icon="i-lucide-square"
              label="Stop"
              class="cursor-pointer"
              @click="stopProxy"
            />
            <UButton
              size="xs"
              variant="outline"
              icon="i-lucide-file-text"
              label="Logs"
              class="cursor-pointer"
              @click="openProxyLogs"
            />
            <UButton
              size="xs"
              variant="ghost"
              label="Configure"
              icon="i-lucide-settings"
              class="cursor-pointer"
              @click="openProxyEdit"
            />
          </div>
        </div>
        <div class="text-xs text-muted mb-2">
          {{ proxyMeta.desc }}
        </div>
        <div class="flex items-center gap-4 text-sm">
          <span class="text-muted">Domain: <strong class="text-default">{{ proxy?.domain || '*.test' }}</strong></span>
          <span class="text-muted">HTTP: <strong class="text-default">{{ proxy?.httpPort || 80 }}</strong></span>
          <span class="text-muted">HTTPS: <strong class="text-default">{{ proxy?.httpsPort || 443 }}</strong></span>
          <span v-if="proxyMeta.adminPort" class="text-muted">Admin: <strong class="text-default">{{ proxy?.adminPort || proxyMeta.adminPort }}</strong></span>
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
            class="cursor-pointer"
            @click="syncContainers"
          />
          <UButton
            size="xs"
            label="Add Service"
            icon="i-lucide-plus"
            color="primary"
            class="cursor-pointer"
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
                class="cursor-pointer"
                @click="startService(svc)"
              />
              <UButton
                v-else
                size="xs"
                color="amber"
                variant="ghost"
                icon="i-lucide-square"
                class="cursor-pointer"
                @click="stopService(svc)"
              />
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-file-text"
                class="cursor-pointer"
                @click="openServiceLogs(svc)"
              />
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-trash"
                color="error"
                class="cursor-pointer"
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
          <USelect v-model="editingProxy.type" :items="proxyTypeOptions" class="mt-1" />
        </div>
        <div class="text-xs text-muted">
          {{ getProxyDesc(editingProxy.type) }}
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
          <UInput v-model="editingProxy.domain" class="mt-1" placeholder="*.test" />
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

  <!-- Proxy Logs Modal -->
  <UModal v-model:open="proxyLogsOpen" :title="`Logs: ${proxy?.type || 'caddy'}`" @close="closeProxyLogs">
    <template #body>
      <div class="p-4">
        <div class="flex items-center gap-2 mb-3">
          <UBadge :color="proxyLogConnected ? 'green' : 'gray'" variant="subtle" size="xs">
            {{ proxyLogConnected ? 'Live' : 'Connecting...' }}
          </UBadge>
        </div>
        <pre class="text-xs bg-default/50 rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono">{{ proxyLogLines.join('\n') || 'Waiting for logs...' }}</pre>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 p-4">
        <UButton label="Close" variant="outline" @click="closeProxyLogs" />
      </div>
    </template>
  </UModal>

  <!-- Service Logs Modal -->
  <UModal v-model:open="serviceLogsOpen" :title="`Logs: ${serviceLogTarget?.containerName || ''}`" @close="closeServiceLogs">
    <template #body>
      <div class="p-4">
        <div class="flex items-center gap-2 mb-3">
          <UBadge :color="svcLogConnected ? 'green' : 'gray'" variant="subtle" size="xs">
            {{ svcLogConnected ? 'Live' : 'Connecting...' }}
          </UBadge>
        </div>
        <pre class="text-xs bg-default/50 rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono">{{ svcLogLines.join('\n') || 'Waiting for logs...' }}</pre>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 p-4">
        <UButton label="Close" variant="outline" @click="closeServiceLogs" />
      </div>
    </template>
  </UModal>
</template>
