<script setup lang="ts">
import type { Website, PhpExtensionInfo } from '~/types'

const props = defineProps<{
  website: Website | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  updated: []
}>()

const { data: allExtensions } = useFetch<PhpExtensionInfo[]>('/api/php-extensions', {
  lazy: true,
  default: () => [],
  query: computed(() => ({ php: props.website?.phpVersion ?? '' }))
})

const enabledIds = ref<Set<number>>(new Set())
const searchExt = ref('')
const loading = ref(false)

watch(open, () => {
  if (open.value && props.website?.extensions) {
    enabledIds.value = new Set(
      props.website.extensions
        .filter(e => e.enabled)
        .map(e => e.extensionId)
    )
  }
})

const filteredExtensions = computed(() => {
  if (!searchExt.value) return allExtensions.value ?? []
  const q = searchExt.value.toLowerCase()
  return (allExtensions.value ?? []).filter(ext =>
    ext.name.toLowerCase().includes(q)
  )
})

function toggleExtension(id: number) {
  const next = new Set(enabledIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  enabledIds.value = next
}

function selectAll() {
  enabledIds.value = new Set((allExtensions.value ?? []).map(e => e.id))
}

function deselectAll() {
  enabledIds.value = new Set()
}

async function onSave() {
  if (!props.website) return
  loading.value = true
  try {
    await $fetch(`/api/websites/${props.website.id}/extensions`, {
      method: 'PUT',
      body: { extensionIds: [...enabledIds.value] }
    })
    emit('updated')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Manage PHP Extensions">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-(--ui-text-dimmed)">
          Configure extensions for <strong>{{ website?.name }}</strong>
          (PHP {{ website?.phpVersion }})
        </p>

        <UInput
          v-model="searchExt"
          icon="i-lucide-search"
          placeholder="Search extensions..."
        />

        <div class="flex gap-2">
          <UButton
            size="xs"
            variant="outline"
            label="Select All"
            @click="selectAll"
          />
          <UButton
            size="xs"
            variant="outline"
            label="Deselect All"
            @click="deselectAll"
          />
        </div>

        <div class="max-h-72 overflow-y-auto space-y-1">
          <div
            v-for="ext in filteredExtensions"
            :key="ext.id"
            class="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-(--ui-bg-elevated) cursor-pointer"
            @click="toggleExtension(ext.id)"
          >
            <UCheckbox :model-value="enabledIds.has(ext.id)" />
            <div class="flex items-center gap-2 flex-1">
              <span class="text-sm font-medium">{{ ext.name }}</span>
              <UBadge :label="ext.type" variant="soft" size="xs" />
            </div>
          </div>
        </div>

        <div class="text-sm text-(--ui-text-dimmed)">
          {{ enabledIds.size }} extension(s) enabled
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <UButton variant="outline" label="Cancel" @click="open = false" />
          <UButton
            label="Save Changes"
            color="primary"
            :loading="loading"
            @click="onSave"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
