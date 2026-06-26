<script setup lang="ts">
import { computed, ref } from 'vue'
import { buildGroupTree, filterHostsByGroup, filterHostsBySearch } from '../utils/hosts'
import type { Group, GroupSelection, Host, HostWithRelations, Identity, Tag } from '../types/ssh'

// --- Data -------------------------------------------------------------------
const { data: groups, refresh: refreshGroups } = await useFetch<Group[]>('/api/groups', { default: () => [], lazy: true })
const { data: identities } = await useFetch<Identity[]>('/api/identities', { default: () => [], lazy: true })
const { data: tags } = await useFetch<Tag[]>('/api/tags', { default: () => [], lazy: true })

// Reka UI (USelect) forbids an empty-string item value, so the "All tags"
// option uses a non-empty sentinel rather than '' to mean "no filter".
const ALL_TAGS = '__all__'
const tagFilter = ref(ALL_TAGS)
// Tag filtering is done server-side (relations live in the DB); group + search
// are client-side over the returned flat list.
const { data: hosts, refresh: refreshHosts } = await useFetch<Host[]>(
  () => (tagFilter.value && tagFilter.value !== ALL_TAGS ? `/api/hosts?tag=${encodeURIComponent(tagFilter.value)}` : '/api/hosts'),
  { default: () => [], lazy: true }
)

// --- Derived state ----------------------------------------------------------
const selection = ref<GroupSelection>('all')
const search = ref('')

const tree = computed(() => buildGroupTree(groups.value))

const visibleHosts = computed(() =>
  filterHostsBySearch(filterHostsByGroup(hosts.value, selection.value, tree.value), search.value))

const groupNameById = computed(() => {
  const map = new Map<string, string>()
  for (const g of groups.value) map.set(g.id, g.name)
  return map
})

const tagItems = computed(() => [
  { label: 'All tags', value: ALL_TAGS },
  ...tags.value.map(t => ({ label: t.name, value: t.name }))
])

// --- Detail drawer ----------------------------------------------------------
const selectedHostId = ref<string | null>(null)
const detailOpen = ref(false)

function openDetail(host: Host) {
  selectedHostId.value = host.id
  detailOpen.value = true
}

function connect(id: string) {
  navigateTo(`/terminal/${id}`)
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
  const wasGroup = deleteResource.value === 'groups'
  const removedId = deleteId.value
  detailOpen.value = false
  selectedHostId.value = null
  // A deleted group's hosts become ungrouped, so refresh both lists.
  await Promise.all([refreshHosts(), refreshGroups()])
  if (wasGroup && selection.value === removedId) selection.value = 'all'
}

// Detail-drawer actions re-use the host create/edit/delete flows.
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
  <UDashboardPanel
    id="hosts-groups"
    :default-size="20"
    :min-size="15"
    :max-size="30"
    resizable
  >
    <UDashboardNavbar title="Groups">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>
      <template #right>
        <UButton
          icon="i-lucide-folder-plus"
          size="sm"
          color="neutral"
          variant="ghost"
          aria-label="Add group"
          @click="addGroup"
        />
      </template>
    </UDashboardNavbar>

    <HostsGroupTree
      v-model="selection"
      :tree="tree"
      @edit="editGroup"
      @delete="deleteGroup"
    />
  </UDashboardPanel>

  <UDashboardPanel id="hosts-list">
    <UDashboardNavbar title="Hosts">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>
      <template #right>
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search hosts..."
          size="sm"
        />
        <USelect
          v-model="tagFilter"
          :items="tagItems"
          size="sm"
          class="w-36"
        />
        <UButton
          label="Add host"
          icon="i-lucide-plus"
          size="sm"
          @click="addHost"
        />
      </template>
    </UDashboardNavbar>

    <div class="flex-1 overflow-y-auto p-4">
      <div
        v-if="visibleHosts.length"
        class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
      >
        <HostsCard
          v-for="host in visibleHosts"
          :key="host.id"
          :host="host"
          :group-name="host.groupId ? groupNameById.get(host.groupId) : null"
          @select="openDetail(host)"
          @connect="connect(host.id)"
        />
      </div>
      <div v-else class="flex flex-col items-center justify-center py-16 text-dimmed">
        <UIcon name="i-lucide-server-off" class="size-12 mb-3" />
        <p class="text-sm">
          No hosts here yet.
        </p>
      </div>
    </div>
  </UDashboardPanel>

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
</template>
