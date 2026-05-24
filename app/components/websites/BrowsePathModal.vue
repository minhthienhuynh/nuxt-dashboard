<script setup lang="ts">
const modelValue = defineModel<string>('modelValue', { default: '' })
const open = defineModel<boolean>('open', { default: false })

interface DirEntry {
  name: string
  isDirectory: boolean
}

const currentPath = ref('')
const parentPath = ref('')
const entries = ref<DirEntry[]>([])
const loading = ref(false)
const selectedPath = ref('')

async function browsePath(path: string) {
  loading.value = true
  try {
    const data = await $fetch<{ path: string, parentPath: string | null, entries: DirEntry[] }>(
      '/api/browse-path',
      { query: { path } }
    )
    currentPath.value = data.path
    parentPath.value = data.parentPath || ''
    entries.value = data.entries
    selectedPath.value = data.path
  } catch {
    // Keep current state on error
  } finally {
    loading.value = false
  }
}

watch(open, async () => {
  if (open.value) {
    const startPath = modelValue.value || '~/Workspaces'
    await browsePath(startPath)
  }
})

function navigateTo(dir: string) {
  browsePath(dir)
}

function goUp() {
  if (parentPath.value) {
    browsePath(parentPath.value)
  }
}

function confirm() {
  modelValue.value = selectedPath.value
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" title="Browse Directory">
    <template #body>
      <div class="space-y-3">
        <div class="flex items-center gap-2 text-sm">
          <UButton
            icon="i-lucide-arrow-up"
            variant="ghost"
            size="xs"
            :disabled="!parentPath"
            @click="goUp"
          />
          <code class="text-xs bg-(--ui-bg-elevated) px-2 py-1 rounded flex-1 truncate">
            {{ currentPath }}
          </code>
        </div>

        <div class="border border-default rounded-lg max-h-72 overflow-y-auto">
          <div v-if="loading" class="p-4 text-center text-sm text-(--ui-text-dimmed)">
            Loading...
          </div>
          <div v-else-if="entries.length === 0" class="p-4 text-center text-sm text-(--ui-text-dimmed)">
            No directories found
          </div>
          <div
            v-for="entry in entries"
            :key="entry.name"
            class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-(--ui-bg-elevated) text-sm"
            :class="{ 'bg-(--ui-bg-elevated)': selectedPath === `${currentPath}/${entry.name}` }"
            @click="selectedPath = `${currentPath}/${entry.name}`"
          >
            <UIcon name="i-lucide-folder" class="size-4 text-(--ui-text-dimmed)" />
            <span>{{ entry.name }}</span>
            <UButton
              icon="i-lucide-arrow-right"
              variant="ghost"
              size="xs"
              class="ml-auto"
              @click.stop="navigateTo(`${currentPath}/${entry.name}`)"
            />
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <UButton variant="outline" label="Cancel" @click="open = false" />
          <UButton label="Select" color="primary" @click="confirm" />
        </div>
      </div>
    </template>
  </UModal>
</template>
