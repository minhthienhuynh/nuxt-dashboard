<script setup lang="ts">
import type { ProxyConfig, ServiceStatus } from '~/types'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')
const USelect = resolveComponent('USelect')
const UInput = resolveComponent('UInput')
const UTextarea = resolveComponent('UTextarea')

const toast = useToast()

const { data: proxy, refresh: refreshProxy } = await useFetch<ProxyConfig>('/api/proxy', { lazy: true })

// ── Caddyfile ──────────────────────────────────────────────

const caddyfileContent = ref('')
const caddyfileLoaded = ref(false)
const caddyfileEditOpen = ref(false)
const editingCaddyfile = ref('')
const savingCaddyfile = ref(false)

async function loadCaddyfile() {
  try {
    const result = await $fetch<{ content: string, exists: boolean }>('/api/proxy/caddyfile')
    caddyfileContent.value = result.exists ? result.content : ''
    caddyfileLoaded.value = true
  } catch {
    caddyfileContent.value = ''
    caddyfileLoaded.value = true
  }
}

function openCaddyfileEdit() {
  editingCaddyfile.value = caddyfileContent.value
  caddyfileEditOpen.value = true
}

async function saveCaddyfile() {
  savingCaddyfile.value = true
  try {
    await $fetch('/api/proxy/caddyfile', {
      method: 'PUT',
      body: { content: editingCaddyfile.value }
    })
    caddyfileContent.value = editingCaddyfile.value
    caddyfileEditOpen.value = false
    toast.add({ title: 'Caddyfile saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save Caddyfile', color: 'error' })
  } finally {
    savingCaddyfile.value = false
  }
}

// ── Proxy settings ─────────────────────────────────────────

const proxyEditOpen = ref(false)
const editingProxy = reactive<ProxyConfig>({
  id: 0,
  type: 'caddy',
  httpPort: 80,
  httpsPort: 443,
  adminPort: 2019,
  domain: '*.test',
  updatedAt: ''
})

const statusColor: Record<string, 'green' | 'gray' | 'red'> = {
  running: 'green',
  stopped: 'gray',
  error: 'red'
}

const proxyTypeOptions = computed(() => [
  { label: 'Caddy', value: 'caddy' }
])

const proxyStatus = computed<ServiceStatus>(() => {
  const p = proxy.value as (ProxyConfig & { status?: ServiceStatus }) | null
  return p?.status || 'stopped'
})

function openProxyEdit() {
  if (proxy.value) {
    Object.assign(editingProxy, proxy.value)
  }
  proxyEditOpen.value = true
}

async function saveProxy() {
  try {
    await $fetch('/api/proxy', { method: 'PUT', body: editingProxy })
    await refreshProxy()
    proxyEditOpen.value = false
    toast.add({ title: 'Proxy settings saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save proxy settings', color: 'error' })
  }
}

async function deployProxy() {
  try {
    await $fetch('/api/proxy/deploy', { method: 'POST' })
    await refreshProxy()
    if (proxyLogsOpen.value) {
      proxyLogConnect('/api/proxy/logs/stream')
    }
    toast.add({ title: 'Caddy deployed', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to deploy Caddy', color: 'error' })
  }
}

async function stopProxy() {
  try {
    await $fetch('/api/proxy/stop', { method: 'POST' })
    await refreshProxy()
    toast.add({ title: 'Caddy stopped', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to stop Caddy', color: 'error' })
  }
}

// ── Logs ───────────────────────────────────────────────────

const { lines: proxyLogLines, connected: proxyLogConnected, connect: proxyLogConnect, disconnect: proxyLogDisconnect } = useContainerLogs()

const proxyLogsOpen = ref(false)

const { data: siteConfigs } = await useFetch<{ sites: { name: string; content: string }[] }>('/api/proxy/sites', { lazy: true })

function openProxyLogs() {
  proxyLogsOpen.value = true
  proxyLogConnect('/api/proxy/logs/stream')
}

function closeProxyLogs() {
  proxyLogsOpen.value = false
  proxyLogDisconnect()
}

onMounted(() => loadCaddyfile())
</script>

<template>
  <UDashboardPanel id="services">
    <template #header>
      <UDashboardNavbar title="Web Server">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Caddy Status Banner -->
      <div class="mb-6 p-4 rounded-lg border border-default bg-elevated/30">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-globe" class="size-5 text-primary" />
            <h3 class="text-sm font-semibold">
              Caddy Web Server
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
              @click="deployProxy"
            />
            <UButton
              v-else
              size="xs"
              color="amber"
              icon="i-lucide-square"
              label="Stop"
              @click="stopProxy"
            />
            <UButton
              size="xs"
              variant="outline"
              icon="i-lucide-file-text"
              label="Logs"
              @click="openProxyLogs"
            />
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-settings"
              label="Settings"
              @click="openProxyEdit"
            />
          </div>
        </div>
        <div class="text-xs text-muted mb-2">
          Caddy v2 — auto HTTPS, reverse proxy, Caddyfile configuration
        </div>
        <div class="flex items-center gap-4 text-sm">
          <span class="text-muted">Domain: <strong class="text-default">{{ proxy?.domain || '*.test' }}</strong></span>
          <span class="text-muted">HTTP: <strong class="text-default">{{ proxy?.httpPort || 80 }}</strong></span>
          <span class="text-muted">HTTPS: <strong class="text-default">{{ proxy?.httpsPort || 443 }}</strong></span>
          <span class="text-muted">Admin: <strong class="text-default">{{ proxy?.adminPort || 2019 }}</strong></span>
        </div>
      </div>

      <!-- Caddyfile Section -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold">
            Caddyfile
          </h3>
          <UButton
            size="xs"
            variant="outline"
            icon="i-lucide-pencil"
            label="Edit"
            @click="openCaddyfileEdit"
          />
        </div>
        <div v-if="!caddyfileLoaded" class="text-sm text-muted">
          Loading Caddyfile...
        </div>
        <pre v-else class="text-xs bg-default/50 rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono">{{ caddyfileContent || 'No Caddyfile configured yet.' }}</pre>
      </div>

      <!-- Site Configs Section -->
      <div>
        <h3 class="text-sm font-semibold mb-3 flex items-center gap-2">
          Site Configs
          <UBadge size="xs" variant="subtle">{{ siteConfigs?.sites?.length ?? 0 }}</UBadge>
        </h3>
        <div v-if="!siteConfigs?.sites?.length" class="text-sm text-muted">
          No site configs yet. Add a website from the
          <NuxtLink to="/websites" class="text-primary hover:underline">Websites</NuxtLink> page.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="site in siteConfigs.sites"
            :key="site.name"
            class="p-3 rounded-lg border border-default hover:border-primary/50 transition-colors"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium">{{ site.name }}</span>
              <UBadge size="xs" variant="subtle">.conf</UBadge>
            </div>
            <pre class="text-xs font-mono whitespace-pre-wrap break-all bg-default/30 rounded p-2 max-h-32 overflow-auto">{{ site.content }}</pre>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Proxy Settings Modal -->
  <UModal v-model:open="proxyEditOpen" title="Proxy Settings">
    <template #body>
      <div class="space-y-3 p-4">
        <div>
          <label class="text-sm font-medium">Proxy Type</label>
          <USelect v-model="editingProxy.type" :items="proxyTypeOptions" class="mt-1" />
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

  <!-- Caddyfile Edit Modal -->
  <UModal v-model:open="caddyfileEditOpen" title="Edit Caddyfile">
    <template #body>
      <div class="p-4">
        <UTextarea
          v-model="editingCaddyfile"
          :rows="20"
          class="font-mono text-xs"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 p-4">
        <UButton label="Cancel" variant="outline" @click="caddyfileEditOpen = false" />
        <UButton
          label="Save & Reload"
          color="primary"
          :loading="savingCaddyfile"
          @click="saveCaddyfile"
        />
      </div>
    </template>
  </UModal>

  <!-- Proxy Logs Modal -->
  <UModal v-model:open="proxyLogsOpen" title="Proxy Logs" @close="closeProxyLogs">
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
</template>
