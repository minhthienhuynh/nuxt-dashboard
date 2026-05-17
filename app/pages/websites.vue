<script setup lang="ts">
import { dash } from 'radash'
import type { Website, SyncResult } from '~/types'
import { getTypeLabel, getTypeColor } from '~/constants/website-types'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')
const UModal = resolveComponent('UModal')
const UInput = resolveComponent('UInput')
const USelect = resolveComponent('USelect')

// ── Real-time Docker events ─────────────────────────────────

const { connected, containerStates, connect, disconnect } = useDockerEvents()

onMounted(() => connect('container'))
onUnmounted(() => disconnect())

function containerNameFromWebsite(name: string) {
  return `website-${dash(name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9\s-]/g, ''))}`
}

function liveStatus(w: Website): string {
  const cname = containerNameFromWebsite(w.name)
  return containerStates.value[cname] || w.status
}

const { data, status: loading, refresh } = await useFetch<Website[]>('/api/websites', {
  lazy: true
})

// ── Filters ────────────────────────────────────────────────

const searchQuery = ref('')
const phpVersionFilter = ref('all')
const phpVersions = ['8.4', '8.3', '8.2', '8.1', '8.0', '7.4', '7.3', '7.2', '7.1', '7.0', '5.6']

const filteredWebsites = computed(() => {
  let list = data.value ?? []
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(w => w.name.toLowerCase().includes(q) || w.domain.toLowerCase().includes(q))
  }
  if (phpVersionFilter.value !== 'all') {
    list = list.filter(w => w.phpVersion === phpVersionFilter.value)
  }
  return list
})

// ── Selection ─────────────────────────────────────────────

const selectedId = ref<number | null>(null)

const selectedWebsite = computed(() =>
  data.value?.find(w => w.id === selectedId.value) ?? null
)

// Auto-select first website
watchEffect(() => {
  if (!selectedId.value && filteredWebsites.value.length > 0 && filteredWebsites.value[0]) {
    selectedId.value = filteredWebsites.value[0].id
  }
})

// ── Actions ────────────────────────────────────────────────

const deploying = ref<Set<number>>(new Set())
const { lines: logLines, connected: logConnected, connect: logConnect, disconnect: logDisconnect } = useContainerLogs()
const syncing = ref(false)

function statusColor(s: string) {
  return s === 'running' ? 'text-green-500' : s === 'error' ? 'text-red-500' : 'text-gray-400'
}

function phpBadgeColor(v: string) {
  const major = Number(v.split('.')[0])
  const minor = Number(v.split('.')[1])
  if (major >= 8) return 'green'
  if (major === 7 && minor >= 2) return 'amber'
  return 'red'
}

async function deployWebsite(w: Website) {
  deploying.value = new Set(deploying.value).add(w.id)
  try {
    await $fetch(`/api/websites/${w.id}/deploy`, { method: 'POST' })
    await refresh()
    if (selectedId.value === w.id) {
      logConnect(`/api/websites/${w.id}/logs/stream`)
    }
  } finally {
    const next = new Set(deploying.value)
    next.delete(w.id)
    deploying.value = next
  }
}

async function stopWebsite(w: Website) {
  deploying.value = new Set(deploying.value).add(w.id)
  try {
    await $fetch(`/api/websites/${w.id}/stop`, { method: 'POST' })
    await refresh()
  } finally {
    const next = new Set(deploying.value)
    next.delete(w.id)
    deploying.value = next
  }
}

async function restartWebsite(w: Website) {
  deploying.value = new Set(deploying.value).add(w.id)
  try {
    await $fetch(`/api/websites/${w.id}/restart`, { method: 'POST' })
    await refresh()
    if (selectedId.value === w.id) {
      logConnect(`/api/websites/${w.id}/logs/stream`)
    }
  } finally {
    const next = new Set(deploying.value)
    next.delete(w.id)
    deploying.value = next
  }
}

async function rebuildWebsite(w: Website) {
  deploying.value = new Set(deploying.value).add(w.id)
  try {
    await $fetch(`/api/websites/${w.id}/rebuild`, { method: 'POST' })
    await refresh()
    if (selectedId.value === w.id) {
      logConnect(`/api/websites/${w.id}/logs/stream`)
    }
  } finally {
    const next = new Set(deploying.value)
    next.delete(w.id)
    deploying.value = next
  }
}

function openInTab(url: string) {
  window.open(url, '_blank')
}

// Auto-connect log stream when selected website changes
watch(selectedId, (id) => {
  if (id) {
    logConnect(`/api/websites/${id}/logs/stream`)
  } else {
    logDisconnect()
  }
}, { immediate: true })

// Auto-scroll to bottom when new lines arrive
const logContainerEl = ref<HTMLElement | null>(null)
watch(() => logLines.value.length, () => {
  nextTick(() => {
    const el = logContainerEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
})

// ── Modals ─────────────────────────────────────────────────

const isAddModalOpen = ref(false)
const isDeleteModalOpen = ref(false)

const editTarget = ref<Website | null>(null)

function openEdit(w: Website) {
  editTarget.value = w
  isAddModalOpen.value = true
}

function openDelete(w: Website) {
  isDeleteModalOpen.value = true
}

async function onCreated(id: number) {
  isAddModalOpen.value = false
  editTarget.value = null
  deploying.value = new Set(deploying.value).add(id)
  await refresh()
  // Auto-deploy the newly created website
  const w = data.value?.find(w => w.id === id)
  if (w) {
    try {
      await $fetch(`/api/websites/${id}/deploy`, { method: 'POST' })
      await refresh()
    } catch { /* deploy failed — user can retry manually */ }
  }
  const next = new Set(deploying.value)
  next.delete(id)
  deploying.value = next
}

function onDeleted() {
  isDeleteModalOpen.value = false
  selectedId.value = null
  refresh()
}

async function syncContainers() {
  syncing.value = true
  try {
    const result = await $fetch<SyncResult>('/api/containers/sync', { method: 'POST' })
    const toast = useToast()
    toast.add({
      title: 'Sync completed',
      description: `${result.running.length} running, ${result.stopped.length} stopped, ${result.missing.length} missing`,
      color: result.missing.length > 0 ? 'warning' : 'success'
    })
    refresh()
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="websites">
    <template #header>
      <UDashboardNavbar title="Websites">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex h-full">
        <!-- ═══ Left: Website List ═══ -->
        <div class="w-64 shrink-0 border-r border-default flex flex-col">
          <!-- Toolbar -->
          <div class="p-3 space-y-2 border-b border-default">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="Search..."
              size="xs"
            />
            <USelect
              v-model="phpVersionFilter"
              :items="[{ label: 'All PHP', value: 'all' }, ...phpVersions.map(v => ({ label: `PHP ${v}`, value: v }))]"
              placeholder="Filter PHP"
              size="xs"
            />
            <div class="flex gap-1.5">
              <div
                class="size-2 rounded-full shrink-0 self-center"
                :class="connected ? 'bg-green-500' : 'bg-gray-300'"
                :title="connected ? 'Live' : 'Disconnected'"
              />
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-refresh-cw"
                :label="syncing ? '...' : 'Sync'"
                :disabled="syncing"
                @click="syncContainers"
              />
              <UButton
                label="Add"
                icon="i-lucide-plus"
                color="primary"
                size="xs"
                class="flex-1"
                @click="editTarget = null; isAddModalOpen = true"
              />
            </div>
          </div>

          <!-- List -->
          <div class="flex-1 overflow-y-auto">
            <div v-if="loading === 'pending'" class="p-4 text-sm text-muted text-center">
              Loading...
            </div>
            <div v-else-if="!filteredWebsites.length" class="p-4 text-sm text-muted text-center">
              No websites
            </div>
            <div
              v-for="w in filteredWebsites"
              :key="w.id"
              class="flex items-center border-b border-default/50 hover:bg-elevated/50 transition-colors cursor-pointer"
              :class="selectedId === w.id ? 'bg-elevated border-r-2 border-r-primary' : ''"
              @click="selectedId = w.id"
            >
              <div class="flex-1 min-w-0 px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <UIcon
                    v-if="deploying.has(w.id)"
                    name="i-lucide-loader-circle"
                    class="size-3.5 shrink-0 text-primary animate-spin"
                  />
                  <span
                    v-else
                    class="size-2 rounded-full shrink-0"
                    :class="statusColor(liveStatus(w))"
                  />
                  <span class="text-sm font-medium truncate">{{ w.name }}</span>
                </div>
                <div class="text-xs text-muted truncate ml-4 mt-0.5">
                  {{ w.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') }}:php-{{ w.phpVersion }}-{{ (w.type || 'php-fpm').replace('php-', '') }}
                </div>
              </div>
              <div class="flex items-center shrink-0 pr-2 gap-0.5" @click.stop>
                <UTooltip v-if="liveStatus(w) === 'running' && !deploying.has(w.id)" text="Open in browser">
                  <UButton
                    size="xs"
                    variant="ghost"
                    icon="i-lucide-link"
                    class="cursor-pointer"
                    @click="openInTab(`http://${w.domain}`)"
                  />
                </UTooltip>
                <UTooltip v-if="!deploying.has(w.id)" text="Rebuild">
                  <UButton
                    size="xs"
                    variant="ghost"
                    icon="i-lucide-hammer"
                    class="cursor-pointer"
                    @click="rebuildWebsite(w)"
                  />
                </UTooltip>
                <UTooltip v-if="liveStatus(w) === 'running' && !deploying.has(w.id)" text="Restart">
                  <UButton
                    size="xs"
                    variant="ghost"
                    icon="i-lucide-refresh-cw"
                    class="cursor-pointer"
                    @click="restartWebsite(w)"
                  />
                </UTooltip>
                <UTooltip v-if="liveStatus(w) === 'running'" text="Stop">
                  <UButton
                    size="xs"
                    color="amber"
                    variant="ghost"
                    icon="i-lucide-square"
                    class="cursor-pointer"
                    :loading="deploying.has(w.id)"
                    @click="stopWebsite(w)"
                  />
                </UTooltip>
                <UTooltip v-else text="Deploy">
                  <UButton
                    size="xs"
                    color="green"
                    variant="ghost"
                    icon="i-lucide-play"
                    class="cursor-pointer"
                    :loading="deploying.has(w.id)"
                    @click="deployWebsite(w)"
                  />
                </UTooltip>
                <UTooltip text="Delete">
                  <UButton
                    size="xs"
                    variant="ghost"
                    icon="i-lucide-trash"
                    color="error"
                    class="cursor-pointer"
                    @click="selectedId = w.id; openDelete(w)"
                  />
                </UTooltip>
              </div>
            </div>
          </div>

          <!-- Count -->
          <div class="p-2 border-t border-default text-xs text-muted text-center">
            {{ filteredWebsites.length }} website(s)
          </div>
        </div>

        <!-- ═══ Right: Detail ═══ -->
        <div class="flex-1 overflow-y-auto">
          <template v-if="selectedWebsite">
            <div class="p-6">
              <!-- Header -->
              <div class="flex items-center justify-between mb-5">
                <div class="flex items-center gap-3">
                  <h2 class="text-lg font-semibold">
                    {{ selectedWebsite.name }}
                  </h2>
                  <UBadge
                    v-if="deploying.has(selectedWebsite.id)"
                    color="primary"
                    variant="subtle"
                    size="sm"
                  >
                    <span class="inline-flex items-center gap-1">
                      <UIcon name="i-lucide-loader-circle" class="size-3 animate-spin" />
                      Deploying...
                    </span>
                  </UBadge>
                  <UBadge
                    v-else
                    :color="liveStatus(selectedWebsite) === 'running' ? 'green' : liveStatus(selectedWebsite) === 'error' ? 'red' : 'gray'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ liveStatus(selectedWebsite) }}
                  </UBadge>
                </div>
                <div class="flex items-center gap-1.5">
                  <UTooltip v-if="liveStatus(selectedWebsite) === 'running' && !deploying.has(selectedWebsite.id)" text="Open in browser">
                    <UButton
                      size="xs"
                      variant="ghost"
                      icon="i-lucide-link"
                      class="cursor-pointer"
                      @click="openInTab(`http://${selectedWebsite.domain}`)"
                    />
                  </UTooltip>
                  <UTooltip v-if="!deploying.has(selectedWebsite.id)" text="Rebuild">
                    <UButton
                      size="xs"
                      variant="ghost"
                      icon="i-lucide-hammer"
                      class="cursor-pointer"
                      @click="rebuildWebsite(selectedWebsite)"
                    />
                  </UTooltip>
                  <UTooltip v-if="liveStatus(selectedWebsite) === 'running' && !deploying.has(selectedWebsite.id)" text="Restart">
                    <UButton
                      size="xs"
                      variant="ghost"
                      icon="i-lucide-refresh-cw"
                      class="cursor-pointer"
                      @click="restartWebsite(selectedWebsite)"
                    />
                  </UTooltip>
                  <UTooltip v-if="liveStatus(selectedWebsite) === 'running'" text="Stop">
                    <UButton
                      size="xs"
                      color="amber"
                      variant="ghost"
                      icon="i-lucide-square"
                      class="cursor-pointer"
                      :loading="deploying.has(selectedWebsite.id)"
                      @click="stopWebsite(selectedWebsite)"
                    />
                  </UTooltip>
                  <UTooltip v-else text="Deploy">
                    <UButton
                      size="xs"
                      color="green"
                      variant="ghost"
                      icon="i-lucide-play"
                      class="cursor-pointer"
                      :loading="deploying.has(selectedWebsite.id)"
                      @click="deployWebsite(selectedWebsite)"
                    />
                  </UTooltip>
                  <UTooltip text="Edit">
                    <UButton
                      size="xs"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      class="cursor-pointer"
                      @click="openEdit(selectedWebsite)"
                    />
                  </UTooltip>
                </div>
              </div>

              <!-- Info Grid -->
              <div class="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
                <div>
                  <div class="text-xs text-muted mb-0.5">
                    Domain
                  </div>
                  <div class="text-sm font-medium flex items-center gap-1.5">
                    <UIcon name="i-lucide-globe" class="size-3.5 text-muted" />
                    {{ selectedWebsite.domain }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-muted mb-0.5">
                    Port
                  </div>
                  <div class="text-sm font-medium">
                    {{ selectedWebsite.port }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-muted mb-0.5">
                    Type
                  </div>
                  <UBadge
                    :color="getTypeColor(selectedWebsite.type)"
                    variant="subtle"
                    size="xs"
                  >
                    {{ getTypeLabel(selectedWebsite.type) }}
                  </UBadge>
                </div>
                <div>
                  <div class="text-xs text-muted mb-0.5">
                    PHP Version
                  </div>
                  <UBadge
                    :color="phpBadgeColor(selectedWebsite.phpVersion)"
                    variant="subtle"
                    size="xs"
                  >
                    {{ selectedWebsite.phpVersion }}
                  </UBadge>
                </div>
                <div>
                  <div class="text-xs text-muted mb-0.5">
                    SSL
                  </div>
                  <UBadge
                    :color="selectedWebsite.sslEnabled ? 'green' : 'gray'"
                    variant="subtle"
                    size="xs"
                  >
                    {{ selectedWebsite.sslEnabled ? 'Enabled' : 'Disabled' }}
                  </UBadge>
                </div>
                <div>
                  <div class="text-xs text-muted mb-0.5">
                    Extensions
                  </div>
                  <div v-if="selectedWebsite.extensions?.length" class="flex flex-wrap gap-1">
                    <UBadge
                      v-for="ext in selectedWebsite.extensions"
                      :key="ext.id"
                      :color="ext.enabled ? 'green' : 'gray'"
                      variant="subtle"
                      size="xs"
                    >
                      {{ ext.extension?.name ?? `#${ext.extensionId}` }}
                    </UBadge>
                  </div>
                  <div v-else class="text-sm text-muted">
                    None
                  </div>
                </div>
                <div class="col-span-2">
                  <div class="text-xs text-muted mb-0.5">
                    Document Root
                  </div>
                  <div class="text-sm font-mono text-sm bg-default/50 rounded px-2 py-1">
                    {{ selectedWebsite.documentRoot }}
                  </div>
                </div>
              </div>

              <!-- Logs inline -->
              <div class="border-t border-default pt-4">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-sm font-semibold">
                    Recent Logs
                  </h4>
                  <UBadge
                    :color="logConnected ? 'green' : 'gray'"
                    variant="subtle"
                    size="xs"
                  >
                    {{ logConnected ? 'Live' : 'Disconnected' }}
                  </UBadge>
                </div>
                <div
                  ref="logContainerEl"
                  class="bg-default/20 rounded-lg p-3 max-h-60 overflow-auto font-mono"
                >
                  <div v-if="!logConnected && logLines.length === 0" class="text-sm text-muted text-center py-4">
                    Connecting...
                  </div>
                  <pre
                    v-else
                    class="text-xs whitespace-pre-wrap break-all"
                  >{{ logLines.join('\n') }}</pre>
                </div>
              </div>
            </div>
          </template>

          <!-- No selection placeholder -->
          <div v-else class="flex items-center justify-center h-full">
            <div class="text-center text-muted">
              <UIcon name="i-lucide-monitor" class="size-12 mx-auto mb-3 opacity-30" />
              <p class="text-sm">
                Select a website to view details
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modals -->
  <WebsitesAddModal
    v-model:open="isAddModalOpen"
    :website="editTarget"
    @created="onCreated"
  />

  <WebsitesDeleteModal
    v-model:open="isDeleteModalOpen"
    :website="selectedWebsite"
    @deleted="onDeleted"
  />
</template>
