<script setup lang="ts">
import { ref, watch } from 'vue'
import { format } from 'date-fns'
import type { HostWithRelations } from '../../types/ssh'

const props = defineProps<{
  hostId: string | null
}>()

const emit = defineEmits<{
  connect: [hostId: string]
  sftp: [hostId: string]
  edit: [host: HostWithRelations]
  delete: [host: HostWithRelations]
}>()

const open = defineModel<boolean>('open', { default: false })

const host = ref<HostWithRelations | null>(null)
const loading = ref(false)

// Load the host with its relations whenever the drawer opens for a host.
// Guard against out-of-order responses: if the selected host changed while a
// request was in flight, discard the stale result.
watch([open, () => props.hostId], async ([isOpen, id]) => {
  if (!isOpen || !id) return
  loading.value = true
  host.value = null
  try {
    const result = await $fetch<HostWithRelations>(`/api/hosts/${id}?relations=true`)
    if (props.hostId === id) host.value = result
  } finally {
    if (props.hostId === id) loading.value = false
  }
}, { immediate: true })
</script>

<template>
  <USlideover v-model:open="open" :title="host?.label ?? 'Host'" :description="host?.address">
    <template #body>
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
      </div>

      <div v-else-if="host" class="space-y-6">
        <div class="flex flex-wrap gap-2">
          <UButton
            label="Connect"
            icon="i-lucide-terminal"
            color="primary"
            @click="emit('connect', host.id)"
          />
          <UButton
            label="SFTP"
            icon="i-lucide-folder-open"
            color="neutral"
            variant="subtle"
            @click="emit('sftp', host.id)"
          />
          <UButton
            label="Edit"
            icon="i-lucide-pencil"
            color="neutral"
            variant="subtle"
            @click="emit('edit', host)"
          />
          <UButton
            label="Delete"
            icon="i-lucide-trash-2"
            color="error"
            variant="subtle"
            @click="emit('delete', host)"
          />
        </div>

        <dl class="space-y-3 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-dimmed">
              Address
            </dt>
            <dd class="text-highlighted text-right">
              {{ host.address }}:{{ host.port }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-dimmed">
              OS
            </dt>
            <dd class="text-highlighted text-right">
              {{ host.os ?? '—' }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-dimmed">
              Group
            </dt>
            <dd class="text-highlighted text-right">
              {{ host.group?.name ?? 'Ungrouped' }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-dimmed">
              Identity
            </dt>
            <dd class="text-highlighted text-right">
              {{ host.identity ? `${host.identity.username} (${host.identity.authType})` : '—' }}
            </dd>
          </div>
        </dl>

        <div v-if="host.tags.length">
          <p class="text-xs font-semibold text-dimmed uppercase mb-2">
            Tags
          </p>
          <div class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="link in host.tags"
              :key="link.tagId"
              :label="link.tag.name"
              color="neutral"
              variant="subtle"
            />
          </div>
        </div>

        <div v-if="host.history.length">
          <p class="text-xs font-semibold text-dimmed uppercase mb-2">
            Recent connections
          </p>
          <ul class="space-y-1 text-sm">
            <li
              v-for="entry in host.history.slice(0, 5)"
              :key="entry.id"
              class="flex justify-between gap-4"
            >
              <span class="text-toned">{{ format(new Date(entry.startedAt), 'dd MMM HH:mm') }}</span>
              <span class="text-dimmed">{{ entry.status }}</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </USlideover>
</template>
