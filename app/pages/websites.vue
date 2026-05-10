<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Website } from '~/types'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UIcon = resolveComponent('UIcon')

const table = useTemplateRef('table')

const columnFilters = ref([{
  id: 'name',
  value: ''
}])
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

const { data, status, refresh } = await useFetch<Website[]>('/api/websites', {
  lazy: true
})

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

function getRowActions(row: { original: Website }) {
  return [
    {
      type: 'label' as const,
      label: 'Actions'
    },
    {
      label: 'Edit',
      icon: 'i-lucide-pencil',
      onSelect() {
        editTarget.value = row.original
        isAddModalOpen.value = true
      }
    },
    {
      label: 'Manage Extensions',
      icon: 'i-lucide-puzzle',
      onSelect() {
        selectedWebsite.value = row.original
        isExtensionsModalOpen.value = true
      }
    },
    {
      type: 'separator' as const
    },
    {
      label: 'Delete',
      icon: 'i-lucide-trash',
      color: 'error' as const,
      onSelect() {
        selectedWebsite.value = row.original
        isDeleteModalOpen.value = true
      }
    }
  ]
}

const columns: TableColumn<Website>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    filterFn: 'includesString'
  },
  {
    accessorKey: 'domain',
    header: 'Domain',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-1.5' }, [
        h(UIcon, { name: 'i-lucide-globe', class: 'size-4 text-(--ui-text-dimmed)' }),
        h('span', row.original.domain)
      ])
  },
  {
    accessorKey: 'phpVersion',
    header: 'PHP',
    cell: ({ row }) =>
      h(UBadge, {
        color: phpVersionColor(row.original.phpVersion),
        variant: 'subtle',
        size: 'sm'
      }, () => row.original.phpVersion)
  },
  {
    accessorKey: 'port',
    header: 'Port'
  },
  {
    accessorKey: 'sslEnabled',
    header: 'SSL',
    cell: ({ row }) =>
      h(UBadge, {
        color: row.original.sslEnabled ? 'green' : 'gray',
        variant: 'subtle',
        size: 'sm'
      }, () => row.original.sslEnabled ? 'Enabled' : 'Disabled')
  },
  {
    accessorKey: 'status',
    header: 'Status',
    filterFn: 'equals',
    cell: ({ row }) =>
      h(UBadge, {
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
      h(UButton, {
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
      h('div', { class: 'text-right' },
        h(UDropdownMenu, {
          content: { align: 'end' },
          items: getRowActions(row)
        }, () =>
          h(UButton, {
            icon: 'i-lucide-ellipsis-vertical',
            color: 'neutral',
            variant: 'ghost',
            class: 'ml-auto'
          })
        )
      )
  }
]

// Status filter
const statusFilter = ref('all')

watch(() => statusFilter.value, (newVal) => {
  if (!table?.value?.tableApi) return

  const statusColumn = table.value.tableApi.getColumn('status')
  if (!statusColumn) return

  if (newVal === 'all') {
    statusColumn.setFilterValue(undefined)
  } else {
    statusColumn.setFilterValue(newVal)
  }
})

// PHP version filter
const phpVersionFilter = ref('all')
const phpVersions = ['8.4', '8.3', '8.2', '8.1', '8.0', '7.4', '7.3', '7.2', '7.1', '7.0', '5.6']

watch(() => phpVersionFilter.value, (newVal) => {
  if (!table?.value?.tableApi) return

  const phpColumn = table.value.tableApi.getColumn('phpVersion')
  if (!phpColumn) return

  if (newVal === 'all') {
    phpColumn.setFilterValue(undefined)
  } else {
    phpColumn.setFilterValue(newVal)
  }
})

// Search filter
const search = computed({
  get: (): string => {
    return (table.value?.tableApi?.getColumn('name')?.getFilterValue() as string) || ''
  },
  set: (value: string) => {
    table.value?.tableApi?.getColumn('name')?.setFilterValue(value || undefined)
  }
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
  <UDashboardPanel id="websites">
    <template #header>
      <UDashboardNavbar title="Websites">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          v-model="search"
          class="max-w-sm"
          icon="i-lucide-search"
          placeholder="Search websites..."
        />

        <div class="flex flex-wrap items-center gap-1.5">
          <UButton
            label="Add Website"
            icon="i-lucide-plus"
            color="primary"
            size="sm"
            @click="editTarget = null; isAddModalOpen = true"
          />

          <USelect
            v-model="statusFilter"
            :items="[
              { label: 'All Status', value: 'all' },
              { label: 'Running', value: 'running' },
              { label: 'Stopped', value: 'stopped' },
              { label: 'Error', value: 'error' }
            ]"
            placeholder="Filter status"
            class="min-w-28"
          />
          <USelect
            v-model="phpVersionFilter"
            :items="[{ label: 'All PHP versions', value: 'all' }, ...phpVersions.map(v => ({ label: `PHP ${v}`, value: v }))]"
            placeholder="Filter PHP"
            class="min-w-28"
          />
        </div>
      </div>

      <UTable
        ref="table"
        v-model:column-filters="columnFilters"
        v-model:pagination="pagination"
        :pagination-options="{
          getPaginationRowModel: getPaginationRowModel()
        }"
        class="shrink-0"
        :data="data"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0'
        }"
      />

      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          {{ table?.tableApi?.getFilteredRowModel().rows.length || 0 }} website(s)
        </div>

        <div class="flex items-center gap-1.5">
          <UPagination
            :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="table?.tableApi?.getState().pagination.pageSize"
            :total="table?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
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
