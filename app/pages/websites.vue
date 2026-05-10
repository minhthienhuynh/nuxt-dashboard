<script setup lang="ts">
import { resolveComponent, h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import {
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable
} from '@tanstack/table-core'
import type { Website } from '~/types'

const { data: websites, refresh } = useFetch<Website[]>('/api/websites', {
  lazy: true,
  default: () => []
})

const search = ref('')
const filterPhpVersion = ref('')
const filterStatus = ref('')

const phpVersions = ['8.4', '8.3', '8.2', '8.1', '8.0', '7.4', '7.3', '7.2', '7.1', '7.0', '5.6']
const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Running', value: 'running' },
  { label: 'Stopped', value: 'stopped' },
  { label: 'Error', value: 'error' }
]

// Modals state
const isAddModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const isExtensionsModalOpen = ref(false)
const selectedWebsite = ref<Website | null>(null)
const editTarget = ref<Website | null>(null)

const statusColor: Record<string, 'green' | 'gray' | 'red'> = {
  running: 'green',
  stopped: 'gray',
  error: 'red'
}

function phpVersionColor(v: string) {
  const major = Number(v.split('.')[0])
  const minor = Number(v.split('.')[1])
  if (major >= 8) return 'green'
  if (major === 7 && minor >= 2) return 'amber'
  return 'red'
}

const columns: TableColumn<Website>[] = [
  {
    id: 'name',
    header: 'Name',
    accessorFn: (row) => row.name
  },
  {
    id: 'domain',
    header: 'Domain',
    accessorFn: (row) => row.domain,
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-1.5' }, [
        h(resolveComponent('UIcon'), { name: 'i-lucide-globe', class: 'size-4 text-(--ui-text-dimmed)' }),
        h('span', row.original.domain)
      ])
  },
  {
    id: 'phpVersion',
    header: 'PHP',
    accessorFn: (row) => row.phpVersion,
    cell: ({ row }) =>
      h(resolveComponent('UBadge'), {
        color: phpVersionColor(row.original.phpVersion),
        variant: 'subtle',
        size: 'sm'
      }, () => row.original.phpVersion)
  },
  {
    id: 'port',
    header: 'Port',
    accessorFn: (row) => row.port
  },
  {
    id: 'ssl',
    header: 'SSL',
    accessorFn: (row) => row.sslEnabled,
    cell: ({ row }) =>
      h(resolveComponent('UBadge'), {
        color: row.original.sslEnabled ? 'green' : 'gray',
        variant: 'subtle',
        size: 'sm'
      }, () => row.original.sslEnabled ? 'Enabled' : 'Disabled')
  },
  {
    id: 'status',
    header: 'Status',
    accessorFn: (row) => row.status,
    cell: ({ row }) =>
      h(resolveComponent('UBadge'), {
        color: statusColor[row.original.status],
        variant: 'subtle',
        size: 'sm'
      }, () => row.original.status)
  },
  {
    id: 'extensions',
    header: 'Extensions',
    accessorFn: (row) => row.extensions?.length ?? 0,
    cell: ({ row }) =>
      h(resolveComponent('UButton'), {
        color: 'neutral',
        variant: 'ghost',
        size: 'xs',
        label: `${row.original.extensions?.length ?? 0} extensions`,
        onClick: () => {
          selectedWebsite.value = row.original
          isExtensionsModalOpen.value = true
        }
      })
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) =>
      h(resolveComponent('UDropdownMenu'), {
        items: [
          {
            label: 'Edit',
            icon: 'i-lucide-pencil',
            onSelect: () => {
              editTarget.value = row.original
              isAddModalOpen.value = true
            }
          },
          {
            label: 'Manage Extensions',
            icon: 'i-lucide-puzzle',
            onSelect: () => {
              selectedWebsite.value = row.original
              isExtensionsModalOpen.value = true
            }
          },
          {
            label: 'Delete',
            icon: 'i-lucide-trash',
            color: 'error',
            onSelect: () => {
              selectedWebsite.value = row.original
              isDeleteModalOpen.value = true
            }
          }
        ]
      })
  }
]

// Filter data
const filteredWebsites = computed(() => {
  let result = websites.value ?? []

  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(
      (w) => w.name.toLowerCase().includes(q) || w.domain.toLowerCase().includes(q)
    )
  }

  if (filterPhpVersion.value) {
    result = result.filter((w) => w.phpVersion === filterPhpVersion.value)
  }

  if (filterStatus.value) {
    result = result.filter((w) => w.status === filterStatus.value)
  }

  return result
})

const table = useVueTable({
  get data() { return filteredWebsites.value },
  columns,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel()
})

function onCreated() {
  isAddModalOpen.value = false
  editTarget.value = null
  refresh()
}

function onDeleted() {
  isDeleteModalOpen.value = false
  selectedWebsite.value = null
  refresh()
}

function onExtensionsUpdated() {
  isExtensionsModalOpen.value = false
  selectedWebsite.value = null
  refresh()
}
</script>

<template>
  <UDashboardPanel id="websites" :growth="1">
    <template #header>
      <UDashboardNavbar title="Websites">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #trailing>
          <UButton
            label="Add Website"
            icon="i-lucide-plus"
            color="primary"
            size="sm"
            @click="isAddModalOpen = true"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #default>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search websites..."
            class="max-w-sm"
          />
          <USelect
            v-model="filterStatus"
            :items="statusOptions"
            placeholder="Filter by status"
            class="max-w-40"
          />
          <USelect
            v-model="filterPhpVersion"
            :items="[{ label: 'All PHP versions', value: '' }, ...phpVersions.map(v => ({ label: `PHP ${v}`, value: v }))]"
            placeholder="Filter by PHP"
            class="max-w-44"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 p-4">
        <UTable :table="table" />

        <div v-if="table.getRowCount() === 0" class="text-center py-8 text-(--ui-text-dimmed)">
          No websites found.
        </div>

        <div
          v-if="table.getPageCount() > 1"
          class="flex items-center justify-between"
        >
          <span class="text-sm text-(--ui-text-dimmed)">
            {{ table.getRowCount() }} website(s)
          </span>
          <UPagination
            :page="table.getState().pagination.pageIndex + 1"
            :total="table.getPageCount()"
            @update:page="(p: number) => table.setPageIndex(p - 1)"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

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

  <WebsitesExtensionsModal
    v-model:open="isExtensionsModalOpen"
    :website="selectedWebsite"
    @updated="onExtensionsUpdated"
  />
</template>
