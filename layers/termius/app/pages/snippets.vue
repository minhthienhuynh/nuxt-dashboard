<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Group, Host, SSHSnippet } from '../types/ssh'

definePageMeta({ layout: 'dashboard' })

// --- Data -------------------------------------------------------------------
const { data: snippets, refresh } = await useFetch<SSHSnippet[]>('/api/snippets', { default: () => [], lazy: true })
// Hosts and groups power the scope select and resolve a snippet's scope names.
const { data: hosts } = await useFetch<Host[]>('/api/hosts', { default: () => [], lazy: true })
const { data: groups } = await useFetch<Group[]>('/api/groups', { default: () => [], lazy: true })

const hostLabelById = computed(() => new Map(hosts.value.map(h => [h.id, h.label])))

// --- Search -----------------------------------------------------------------
const search = ref('')

const visibleSnippets = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return snippets.value
  return snippets.value.filter(s =>
    s.label.toLowerCase().includes(q) || s.command.toLowerCase().includes(q))
})

// Scope badges for a snippet: "Global" when no host links, else each host name.
interface ScopeBadge { key: string, label: string, icon: string }
function scopeBadges(snippet: SSHSnippet): ScopeBadge[] {
  if (!snippet.hosts.length) {
    return [{ key: 'global', label: 'Global', icon: 'i-lucide-globe' }]
  }
  return snippet.hosts.map(link => ({
    key: `h-${link.hostId}`,
    label: hostLabelById.value.get(link.hostId) ?? 'Unknown host',
    icon: 'i-lucide-server'
  }))
}

// --- Create / edit ----------------------------------------------------------
const modalOpen = ref(false)
const editing = ref<SSHSnippet | null>(null)

function addSnippet() {
  editing.value = null
  modalOpen.value = true
}

function editSnippet(snippet: SSHSnippet) {
  editing.value = snippet
  modalOpen.value = true
}

// --- Delete -----------------------------------------------------------------
const deleteOpen = ref(false)
const deleteId = ref<string | null>(null)
const deleteLabel = ref('')

function deleteSnippet(snippet: SSHSnippet) {
  deleteId.value = snippet.id
  deleteLabel.value = snippet.label
  deleteOpen.value = true
}

function menuItems(snippet: SSHSnippet) {
  return [[
    { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => editSnippet(snippet) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => deleteSnippet(snippet) }
  ]]
}
</script>

<template>
  <UDashboardPanel id="snippets">
    <UDashboardNavbar title="Snippets">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>
    </UDashboardNavbar>

    <div class="flex flex-col flex-1 min-h-0 p-4">
      <div class="flex items-center gap-2 pb-3">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Find a snippet…"
          class="flex-1"
        />
        <UButton label="New snippet" icon="i-lucide-plus" @click="addSnippet" />
      </div>

      <div
        v-if="visibleSnippets.length"
        class="grid grid-cols-1 lg:grid-cols-2 gap-3"
      >
        <div
          v-for="snippet in visibleSnippets"
          :key="snippet.id"
          class="group relative flex items-start gap-3 p-4 rounded-lg border border-default transition-colors hover:border-primary hover:bg-primary/5"
        >
          <div class="flex items-center justify-center size-10 rounded-md bg-primary/10 text-primary shrink-0">
            <UIcon name="i-lucide-square-terminal" class="size-5" />
          </div>

          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-highlighted truncate">
              {{ snippet.label }}
            </p>
            <p class="mt-1 text-xs text-dimmed font-mono truncate" :title="snippet.command">
              {{ snippet.command }}
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-1">
              <UBadge
                v-for="badge in scopeBadges(snippet)"
                :key="badge.key"
                :icon="badge.icon"
                :label="badge.label"
                size="xs"
                color="neutral"
                variant="subtle"
              />
            </div>
          </div>

          <UDropdownMenu :items="menuItems(snippet)">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="Snippet actions"
              @click.stop
            />
          </UDropdownMenu>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-12 text-dimmed">
        <UIcon name="i-lucide-square-terminal" class="size-10 mb-3" />
        <p class="text-sm mb-3">
          {{ search ? 'No snippets match your search.' : 'No snippets yet.' }}
        </p>
        <UButton
          v-if="!search"
          label="New snippet"
          icon="i-lucide-plus"
          variant="soft"
          @click="addSnippet"
        />
      </div>
    </div>

    <SnippetsFormModal
      v-model:open="modalOpen"
      :snippet="editing"
      :hosts="hosts"
      :groups="groups"
      @saved="refresh"
    />

    <ConfirmDeleteModal
      :id="deleteId"
      v-model:open="deleteOpen"
      resource="snippets"
      noun="snippet"
      :label="deleteLabel"
      @deleted="refresh"
    >
      <template #warning>
        This removes the saved command. It does not affect any host.
      </template>
    </ConfirmDeleteModal>
  </UDashboardPanel>
</template>
