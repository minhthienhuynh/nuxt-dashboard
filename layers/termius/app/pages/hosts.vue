<script setup lang="ts">
import { computed, ref } from 'vue'
import { DEFAULT_HOST_SORT, HOST_SORT_OPTIONS, buildGroupTree, filterHostsByGroup, filterHostsBySearch, isHostSort, sortHosts } from '../utils/hosts'
import { openTerminalWindow } from '../utils/terminal-windows'
import type { Group, GroupSelection, Host, HostSort, HostWithRelations, Identity, SSHKey, Tag } from '../types/ssh'

definePageMeta({ layout: 'dashboard' })

// --- Data -------------------------------------------------------------------
const { data: groups, refresh: refreshGroups } = await useFetch<Group[]>('/api/groups', { default: () => [], lazy: true })
const { data: identities, refresh: refreshIdentities } = await useFetch<Identity[]>('/api/identities', { default: () => [], lazy: true })
const { data: sshKeys } = await useFetch<SSHKey[]>('/api/ssh-keys', { default: () => [], lazy: true })
const { data: tags, refresh: refreshTags } = await useFetch<Tag[]>('/api/tags', { default: () => [], lazy: true })

// Selected tag names; empty means "all". Multiple tags AND together server-side.
const tagFilter = ref<string[]>([])
const { data: hosts, refresh: refreshHosts } = await useFetch<Host[]>(
  () => {
    const qs = tagFilter.value.map(t => `tag=${encodeURIComponent(t)}`).join('&')
    return qs ? `/api/hosts?${qs}` : '/api/hosts'
  },
  { default: () => [], lazy: true }
)

// --- Navigation + filtering -------------------------------------------------
const selection = ref<GroupSelection>('all')
const search = ref('')
const view = ref<'grid' | 'list'>('grid')
const viewItems = [
  { label: 'Grid', value: 'grid', icon: 'i-lucide-layout-grid' },
  { label: 'List', value: 'list', icon: 'i-lucide-layout-list' }
] as const

// Icon for the dropdown trigger reflects the active view.
const currentViewIcon = computed(() => viewItems.find(i => i.value === view.value)?.icon)
const viewMenu = computed(() => [
  viewItems.map(item => ({
    label: item.label,
    icon: item.icon,
    type: 'checkbox' as const,
    checked: view.value === item.value,
    onSelect: () => { view.value = item.value }
  }))
])

// Persisted sort, applied only after mount so the first client render matches
// the server (default order) — applying localStorage during SSR would cause a
// hydration mismatch.
const sort = useLocalStorage<HostSort>('hosts:sort', DEFAULT_HOST_SORT)
const mounted = useMounted()
// Fall back to the default for a stale/unknown stored value.
const activeSort = computed(() =>
  mounted.value && isHostSort(sort.value) ? sort.value : DEFAULT_HOST_SORT)
const currentSortIcon = computed(() => HOST_SORT_OPTIONS.find(o => o.value === activeSort.value)?.icon)
const sortMenu = computed(() => [
  HOST_SORT_OPTIONS.map(o => ({
    label: o.label,
    icon: o.icon,
    type: 'checkbox' as const,
    checked: activeSort.value === o.value,
    onSelect: () => { sort.value = o.value }
  }))
])

const tree = computed(() => buildGroupTree(groups.value))
const isSearching = computed(() => search.value.trim().length > 0)
const tagActive = computed(() => tagFilter.value.length > 0)
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
  const searched = filterHostsBySearch(scoped, search.value)
  return sortHosts(searched, activeSort.value)
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

// Breadcrumb items: every ancestor (All hosts + parent groups) is a clickable
// link for navigating up; only the current group (last crumb) is plain text.
const crumbItems = computed(() => {
  const path = crumbs.value
  return [
    { label: 'All hosts', class: 'cursor-pointer', onClick: () => openGroup('all') },
    ...path.map((c, i) =>
      i === path.length - 1
        ? { label: c.name }
        : { label: c.name, class: 'cursor-pointer', onClick: () => openGroup(c.id) })
  ]
})

const inGroup = computed(() => selection.value !== 'all' && !isFiltered.value)

// The real group currently open (not "all"/"ungrouped"), used to pre-select the
// group when creating a host/group from inside it.
const currentGroupId = computed(() =>
  selection.value !== 'all' && selection.value !== 'ungrouped' ? selection.value : null)

const tagItems = computed(() => tags.value.map(t => t.name))

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

// Saving a host may find-or-create tags, so refresh the tag list (filter
// options) alongside the hosts. It also creates/updates an Identity server-side
// (see HostsFormModal.resolveIdentityId), so refresh identities too — otherwise
// editing the just-saved host can't resolve its identity and would duplicate it.
async function onHostSaved() {
  await Promise.all([refreshHosts(), refreshTags(), refreshIdentities()])
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
const deleteResource = ref<'hosts' | 'groups' | 'tags'>('hosts')
const deleteId = ref<string | null>(null)
const deleteLabel = ref('')

function deleteTag(name: string) {
  const tag = tags.value.find(t => t.name === name)
  if (!tag) return
  deleteResource.value = 'tags'
  deleteId.value = tag.id
  deleteLabel.value = name
  deleteOpen.value = true
}

// --- Tag rename -------------------------------------------------------------
const tagEditOpen = ref(false)
const editingTag = ref<Tag | null>(null)

function editTag(name: string) {
  const tag = tags.value.find(t => t.name === name)
  if (!tag) return
  editingTag.value = tag
  tagEditOpen.value = true
}

async function onTagRenamed(newName: string) {
  // Rewrite an active filter pointing at the renamed tag, de-duped in case the
  // new name is already selected. Host rows carry no tag data, so the list only
  // needs the reactive refetch the filter change triggers — just refresh tags.
  const oldName = editingTag.value?.name
  if (oldName) tagFilter.value = [...new Set(tagFilter.value.map(t => (t === oldName ? newName : t)))]
  await refreshTags()
}

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
  // Tag delete doesn't change host rows: drop it from the filter (the reactive
  // query refetches if it was active) and refresh only the tag list.
  if (deleteResource.value === 'tags') {
    tagFilter.value = tagFilter.value.filter(t => t !== deleteLabel.value)
    await refreshTags()
    return
  }
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
        <UDropdownMenu :items="newMenu" :content="{ align: 'start', side: 'right' }">
          <UButton icon="i-lucide-plus" aria-label="New host or group" />
        </UDropdownMenu>

        <div class="flex-1" />

        <USelectMenu
          v-model="tagFilter"
          :items="tagItems"
          multiple
          :color="tagActive ? 'primary' : 'neutral'"
          variant="outline"
          size="sm"
          aria-label="Filter by tag"
          :ui="{ base: 'px-1.5!', content: 'min-w-52', trailingIcon: 'hidden', itemTrailingIcon: 'hidden' }"
        >
          <!-- Icon-only trigger: render the tag icon in-flow (not via the `icon`
               prop, which reserves leading padding) so the trigger stays square
               like the view/sort buttons. -->
          <template #default>
            <UIcon name="i-lucide-tag" class="size-4 shrink-0" :class="tagActive ? 'text-primary' : 'text-dimmed'" />
          </template>

          <template #item-leading="{ item }">
            <UIcon
              :name="tagFilter.includes(String(item)) ? 'i-lucide-circle-check' : 'i-lucide-circle'"
              class="size-4 shrink-0"
              :class="tagFilter.includes(String(item)) ? 'text-primary' : 'text-dimmed'"
            />
          </template>

          <template #item-trailing="{ item }">
            <span class="inline-flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Rename tag"
                @pointerdown.stop
                @click.stop="editTag(String(item))"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                aria-label="Delete tag"
                @pointerdown.stop
                @click.stop="deleteTag(String(item))"
              />
            </span>
          </template>

          <template v-if="tagItems.length" #content-bottom>
            <div class="p-1 border-t border-default">
              <UButton
                label="Clear selection"
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                block
                :disabled="!tagFilter.length"
                @click="tagFilter = []"
              />
            </div>
          </template>
        </USelectMenu>
        <UDropdownMenu :items="viewMenu">
          <UButton
            :icon="currentViewIcon"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Change view"
          />
        </UDropdownMenu>
        <UDropdownMenu :items="sortMenu">
          <UButton
            :icon="currentSortIcon"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Sort hosts"
          />
        </UDropdownMenu>
      </div>

      <!-- Breadcrumb -->
      <div v-if="inGroup" class="px-4 pb-3">
        <UBreadcrumb :items="crumbItems" />
      </div>

      <div class="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
        <!-- Groups -->
        <section v-if="childGroups.length || showUngroupedCard">
          <h3 class="text-xs font-semibold text-dimmed uppercase tracking-wide mb-2">
            Groups
          </h3>
          <div :class="view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3' : 'flex flex-col divide-y divide-default'">
            <HostsGroupCard
              v-for="g in childGroups"
              :key="g.id"
              :name="g.name"
              :count="groupCounts.get(g.id) ?? 0"
              :list="view === 'list'"
              @open="openGroup(g.id)"
              @edit="editGroup(g)"
              @delete="deleteGroup(g)"
            />
            <HostsGroupCard
              v-if="showUngroupedCard"
              name="Ungrouped"
              icon="i-lucide-folder-minus"
              :count="ungroupedCount"
              :list="view === 'list'"
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
            :class="view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3' : 'flex flex-col divide-y divide-default'"
          >
            <HostsCard
              v-for="host in visibleHosts"
              :key="host.id"
              :host="host"
              :group-name="host.groupId ? groupById.get(host.groupId)?.name : null"
              :list="view === 'list'"
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
      :tags="tags"
      :default-group-id="currentGroupId"
      @saved="onHostSaved"
    />

    <HostsGroupFormModal
      v-model:open="groupModalOpen"
      :group="editingGroup"
      :groups="groups"
      :default-parent-id="currentGroupId"
      @saved="refreshGroups"
    />

    <HostsTagEditModal
      v-model:open="tagEditOpen"
      :tag="editingTag"
      @saved="onTagRenamed"
    />

    <ConfirmDeleteModal
      :id="deleteId"
      v-model:open="deleteOpen"
      :resource="deleteResource"
      :label="deleteLabel"
      @deleted="onDeleted"
    >
      <template #warning>
        <template v-if="deleteResource === 'groups'">
          Hosts in this group are kept — they become ungrouped rather than deleted.
        </template>
      </template>
    </ConfirmDeleteModal>
  </UDashboardPanel>
</template>
