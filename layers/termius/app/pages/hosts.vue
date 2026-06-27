<script setup lang="ts">
import { computed, ref } from 'vue'
import { buildGroupTree, filterHostsByGroup, filterHostsBySearch } from '../utils/hosts'
import { openTerminalWindow } from '../utils/terminal-windows'
import type { Group, GroupSelection, Host, HostWithRelations, Identity, SSHKey, Tag } from '../types/ssh'

// --- Data -------------------------------------------------------------------
const { data: groups, refresh: refreshGroups } = await useFetch<Group[]>('/api/groups', { default: () => [], lazy: true })
const { data: identities } = await useFetch<Identity[]>('/api/identities', { default: () => [], lazy: true })
const { data: sshKeys } = await useFetch<SSHKey[]>('/api/ssh-keys', { default: () => [], lazy: true })
const { data: tags } = await useFetch<Tag[]>('/api/tags', { default: () => [], lazy: true })

const tagFilter = ref(ALL_TAGS)
const { data: hosts, refresh: refreshHosts } = await useFetch<Host[]>(
  () => (tagFilter.value && tagFilter.value !== ALL_TAGS ? `/api/hosts?tag=${encodeURIComponent(tagFilter.value)}` : '/api/hosts'),
  { default: () => [], lazy: true }
)

// --- Navigation + filtering -------------------------------------------------
const selection = ref<GroupSelection>('all')
const search = ref('')
const view = ref<'grid' | 'list'>('grid')
const viewItems = [
  { label: 'Grid', value: 'grid', icon: 'i-lucide-layout-grid' },
  { label: 'List', value: 'list', icon: 'i-lucide-list' }
]

const tree = computed(() => buildGroupTree(groups.value))
const isSearching = computed(() => search.value.trim().length > 0)
const tagActive = computed(() => tagFilter.value !== ALL_TAGS)
// Search and tag filter are both flat/global views: hide the group cards (their
// counts would be wrong against the tag-filtered host list) and show a flat
// list of matching hosts.
const isFiltered = computed(() => isSearching.value || tagActive.value)
const groupById = computed(() => new Map(groups.value.map(g => [g.id, g])))

// Host count per group (incl. descendants), computed once per data change so
// the template doesn't re-traverse the tree for every card.
const groupCounts = computed(() => {
  const map = new Map<string, number>()
  for (const g of groups.value) map.set(g.id, filterHostsByGroup(hosts.value, g.id, tree.value).length)
  return map
})

// Group cards for the current level: root groups at "all", child groups when a
// group is open. Hidden while filtering (search/tag are global).
const childGroups = computed<Group[]>(() => {
  if (isFiltered.value) return []
  if (selection.value === 'all') return groups.value.filter(g => g.parentId == null)
  if (selection.value === 'ungrouped') return []
  return groups.value.filter(g => g.parentId === selection.value)
})

const ungroupedCount = computed(() => hosts.value.filter(h => h.groupId == null).length)
const showUngroupedCard = computed(() => selection.value === 'all' && !isFiltered.value && ungroupedCount.value > 0)

const visibleHosts = computed(() => {
  const scoped = isFiltered.value ? hosts.value : filterHostsByGroup(hosts.value, selection.value, tree.value)
  return filterHostsBySearch(scoped, search.value)
})

// Breadcrumb trail (after the leading "All hosts"): the path from root to the
// open group, or a single "Ungrouped" crumb. Shown whenever not at the root.
const crumbs = computed<{ id: GroupSelection, name: string }[]>(() => {
  if (selection.value === 'ungrouped') return [{ id: 'ungrouped', name: 'Ungrouped' }]
  const path: { id: GroupSelection, name: string }[] = []
  let cur = groupById.value.get(selection.value)
  while (cur) {
    path.unshift({ id: cur.id, name: cur.name })
    cur = cur.parentId ? groupById.value.get(cur.parentId) : undefined
  }
  return path
})

const inGroup = computed(() => selection.value !== 'all' && !isFiltered.value)

const tagItems = computed(() => [
  { label: 'All tags', value: ALL_TAGS },
  ...tags.value.map(t => ({ label: t.name, value: t.name }))
])

// A single "New" dropdown holds both create actions.
const newMenu = [[
  { label: 'New host', icon: 'i-lucide-server', onSelect: () => addHost() },
  { label: 'New group', icon: 'i-lucide-group', onSelect: () => addGroup() }
]]

function openGroup(id: GroupSelection) {
  selection.value = id
  search.value = ''
}

// --- Detail drawer ----------------------------------------------------------
const selectedHostId = ref<string | null>(null)
const detailOpen = ref(false)

function openDetail(host: Host) {
  selectedHostId.value = host.id
  detailOpen.value = true
}

// Each Connect opens a new browser tab dedicated to one host (one SSH session
// per tab); re-connecting focuses the existing tab without reloading it (which
// would kill the live session). See utils/terminal-windows.
function connect(id: string) {
  openTerminalWindow(id)
}

// --- Host create / edit -----------------------------------------------------
const hostModalOpen = ref(false)
const editingHost = ref<Host | null>(null)

function addHost() {
  editingHost.value = null
  hostModalOpen.value = true
}

function editHost(host: Host) {
  editingHost.value = host
  hostModalOpen.value = true
}

// --- Group create / edit ----------------------------------------------------
const groupModalOpen = ref(false)
const editingGroup = ref<Group | null>(null)

function addGroup() {
  editingGroup.value = null
  groupModalOpen.value = true
}

function editGroup(group: Group) {
  editingGroup.value = group
  groupModalOpen.value = true
}

// --- Delete -----------------------------------------------------------------
const deleteOpen = ref(false)
const deleteResource = ref<'hosts' | 'groups'>('hosts')
const deleteId = ref<string | null>(null)
const deleteLabel = ref('')

function deleteHost(host: Host) {
  deleteResource.value = 'hosts'
  deleteId.value = host.id
  deleteLabel.value = host.label
  deleteOpen.value = true
}

function deleteGroup(group: Group) {
  deleteResource.value = 'groups'
  deleteId.value = group.id
  deleteLabel.value = group.name
  deleteOpen.value = true
}

async function onDeleted() {
  detailOpen.value = false
  selectedHostId.value = null
  await Promise.all([refreshHosts(), refreshGroups()])
  // Reset to root if the open group no longer exists (it, or an ancestor, was
  // deleted), otherwise the view would be stranded on a missing group.
  if (selection.value !== 'all' && selection.value !== 'ungrouped' && !groupById.value.has(selection.value)) {
    selection.value = 'all'
  }
}

function onDetailEdit(host: HostWithRelations) {
  detailOpen.value = false
  editHost(host)
}

function onDetailDelete(host: HostWithRelations) {
  detailOpen.value = false
  deleteHost(host)
}
</script>

<template>
  <UDashboardPanel id="hosts">
    <UDashboardNavbar title="Hosts">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>
    </UDashboardNavbar>

    <div class="flex flex-col flex-1 min-h-0">
      <!-- Search -->
      <div class="px-4 pt-4">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Find a host or ssh user@hostname…"
          size="lg"
          class="w-full"
        />
      </div>

      <!-- Toolbar -->
      <div class="flex items-center gap-2 px-4 py-3">
        <UDropdownMenu :items="newMenu">
          <UButton icon="i-lucide-plus" aria-label="New host or group" />
        </UDropdownMenu>

        <div class="flex-1" />

        <USelect
          v-model="tagFilter"
          :items="tagItems"
          icon="i-lucide-tag"
          size="sm"
          class="w-40"
        />
        <USelect
          v-model="view"
          :items="viewItems"
          size="sm"
          class="w-28"
        />
      </div>

      <!-- Breadcrumb -->
      <div v-if="inGroup" class="flex items-center gap-1.5 px-4 pb-3 text-sm">
        <UButton
          label="All hosts"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="soft"
          size="xs"
          @click="openGroup('all')"
        />
        <template v-for="(c, i) in crumbs" :key="c.id">
          <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed shrink-0" />
          <button
            type="button"
            class="font-medium transition-colors"
            :class="i === crumbs.length - 1 ? 'text-primary' : 'text-toned hover:text-highlighted'"
            @click="openGroup(c.id)"
          >
            {{ c.name }}
          </button>
        </template>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
        <!-- Groups -->
        <section v-if="childGroups.length || showUngroupedCard">
          <h3 class="text-xs font-semibold text-dimmed uppercase tracking-wide mb-2">
            Groups
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <HostsGroupCard
              v-for="g in childGroups"
              :key="g.id"
              :name="g.name"
              :count="groupCounts.get(g.id) ?? 0"
              @open="openGroup(g.id)"
              @edit="editGroup(g)"
              @delete="deleteGroup(g)"
            />
            <HostsGroupCard
              v-if="showUngroupedCard"
              name="Ungrouped"
              icon="i-lucide-folder-minus"
              :count="ungroupedCount"
              @open="openGroup('ungrouped')"
              @edit="() => {}"
              @delete="() => {}"
            />
          </div>
        </section>

        <!-- Hosts -->
        <section>
          <h3 class="text-xs font-semibold text-dimmed uppercase tracking-wide mb-2">
            Hosts
          </h3>
          <div
            v-if="visibleHosts.length"
            :class="view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3' : 'flex flex-col gap-2'"
          >
            <HostsCard
              v-for="host in visibleHosts"
              :key="host.id"
              :host="host"
              :group-name="host.groupId ? groupById.get(host.groupId)?.name : null"
              @select="openDetail(host)"
              @connect="connect(host.id)"
            />
          </div>
          <div v-else class="flex flex-col items-center justify-center py-12 text-dimmed">
            <UIcon name="i-lucide-server-off" class="size-10 mb-3" />
            <p class="text-sm">
              {{ isSearching ? 'No hosts match your search.' : 'No hosts here yet.' }}
            </p>
          </div>
        </section>
      </div>
    </div>

    <HostsDetail
      v-model:open="detailOpen"
      :host-id="selectedHostId"
      @connect="connect"
      @edit="onDetailEdit"
      @delete="onDetailDelete"
    />

    <HostsFormModal
      v-model:open="hostModalOpen"
      :host="editingHost"
      :groups="groups"
      :identities="identities"
      :ssh-keys="sshKeys"
      @saved="refreshHosts"
    />

    <HostsGroupFormModal
      v-model:open="groupModalOpen"
      :group="editingGroup"
      :groups="groups"
      @saved="refreshGroups"
    />

    <HostsDeleteModal
      :id="deleteId"
      v-model:open="deleteOpen"
      :resource="deleteResource"
      :label="deleteLabel"
      @deleted="onDeleted"
    />
  </UDashboardPanel>
</template>
