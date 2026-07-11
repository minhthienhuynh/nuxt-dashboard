<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GroupNode, Host } from '../../types/ssh'

// One node of the group tree in the snippet host-scope picker. Renders a
// tri-state checkbox for the group plus an expand control to reveal child
// groups (recursively). Groups are a selection aid: checking one selects every
// host in the group and its descendant groups. Only host ids are ever emitted.
const props = defineProps<{
  node: GroupNode
  // Direct hosts per group id (built once by the parent).
  hostsByGroup: Map<string, Host[]>
  // The shared set of selected host ids.
  modelValue: string[]
  // Nesting depth for indentation.
  depth?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [ids: string[]]
}>()

const expanded = ref(false)

// Every host id under this group and its descendant groups.
function subtreeHostIds(node: GroupNode): string[] {
  const ids = (props.hostsByGroup.get(node.id) ?? []).map(h => h.id)
  for (const child of node.children) ids.push(...subtreeHostIds(child))
  return ids
}

const subtree = computed(() => subtreeHostIds(props.node))

// Tri-state: true (all selected), 'indeterminate' (some), false (none/empty).
const checkboxState = computed<boolean | 'indeterminate'>(() => {
  if (subtree.value.length === 0) return false
  const selected = new Set(props.modelValue)
  const inSel = subtree.value.filter(id => selected.has(id))
  if (inSel.length === 0) return false
  return inSel.length === subtree.value.length ? true : 'indeterminate'
})

// Clicking selects the whole subtree unless it is already fully selected, in
// which case it clears it. (Ignore the emitted value; decide from current state.)
function onToggle() {
  const selected = new Set(props.modelValue)
  const selectAll = checkboxState.value !== true
  for (const id of subtree.value) {
    if (selectAll) selected.add(id)
    else selected.delete(id)
  }
  emit('update:modelValue', [...selected])
}

const hasChildren = computed(() => props.node.children.length > 0)
const indent = computed(() => `${(props.depth ?? 0) * 1}rem`)
</script>

<template>
  <div>
    <div class="flex items-center gap-1 py-0.5" :style="{ paddingLeft: indent }">
      <UButton
        v-if="hasChildren"
        :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="expanded ? 'Collapse group' : 'Expand group'"
        @click="expanded = !expanded"
      />
      <span v-else class="w-6 shrink-0" aria-hidden="true" />

      <UCheckbox
        :model-value="checkboxState"
        size="sm"
        @update:model-value="onToggle"
      >
        <template #label>
          <span class="inline-flex items-center gap-1.5">
            <UIcon :name="expanded ? 'i-lucide-folder-open' : 'i-lucide-folder'" class="size-4 shrink-0 text-dimmed" />
            {{ node.name }}
          </span>
        </template>
      </UCheckbox>
    </div>

    <template v-if="expanded && hasChildren">
      <SnippetsHostScopeGroup
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :hosts-by-group="hostsByGroup"
        :model-value="modelValue"
        :depth="(depth ?? 0) + 1"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </template>
  </div>
</template>
