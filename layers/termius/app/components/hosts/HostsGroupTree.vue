<script setup lang="ts">
import { computed } from 'vue'
import type { Group, GroupNode, GroupSelection } from '../../types/ssh'

const props = defineProps<{
  tree: GroupNode[]
}>()

const emit = defineEmits<{
  edit: [group: Group]
  delete: [group: Group]
}>()

const selection = defineModel<GroupSelection>({ default: 'all' })

interface FlatGroup {
  group: GroupNode
  depth: number
}

// Pre-order flatten so the tree renders as indented rows (no recursive
// component needed). Depth drives the left padding.
const flat = computed<FlatGroup[]>(() => {
  const out: FlatGroup[] = []
  const walk = (nodes: GroupNode[], depth: number) => {
    for (const group of nodes) {
      out.push({ group, depth })
      walk(group.children, depth + 1)
    }
  }
  walk(props.tree, 0)
  return out
})

const virtualItems: { value: GroupSelection, label: string, icon: string }[] = [
  { value: 'all', label: 'All hosts', icon: 'i-lucide-server' },
  { value: 'ungrouped', label: 'Ungrouped', icon: 'i-lucide-folder-minus' }
]
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
      <button
        v-for="item in virtualItems"
        :key="item.value"
        type="button"
        class="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-left transition-colors"
        :class="selection === item.value ? 'bg-primary/10 text-primary' : 'text-toned hover:bg-elevated/50'"
        @click="selection = item.value"
      >
        <UIcon :name="item.icon" class="size-4 shrink-0" />
        <span class="truncate">{{ item.label }}</span>
      </button>

      <USeparator class="my-1" />

      <div
        v-for="{ group, depth } in flat"
        :key="group.id"
        class="group flex items-center gap-1 rounded-md transition-colors"
        :class="selection === group.id ? 'bg-primary/10' : 'hover:bg-elevated/50'"
      >
        <button
          type="button"
          class="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-sm text-left"
          :class="selection === group.id ? 'text-primary' : 'text-toned'"
          :style="{ paddingLeft: `${depth * 12 + 8}px` }"
          @click="selection = group.id"
        >
          <UIcon name="i-lucide-folder" class="size-4 shrink-0" />
          <span class="truncate">{{ group.name }}</span>
        </button>
        <div class="flex items-center opacity-0 group-hover:opacity-100 pr-1">
          <UButton
            icon="i-lucide-pencil"
            size="xs"
            color="neutral"
            variant="ghost"
            aria-label="Edit group"
            @click="emit('edit', group)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="neutral"
            variant="ghost"
            aria-label="Delete group"
            @click="emit('delete', group)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
