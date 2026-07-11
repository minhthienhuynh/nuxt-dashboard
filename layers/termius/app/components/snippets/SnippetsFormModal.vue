<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import * as z from 'zod'
import { buildGroupTree } from '../../utils/hosts'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Group, Host, SSHSnippet } from '../../types/ssh'

const props = defineProps<{
  snippet?: SSHSnippet | null
  // Hosts are the persisted scope; groups organize the top-of-form tree used to
  // bulk-select hosts (grouping itself is not persisted).
  hosts: Host[]
  groups: Group[]
  // Create-mode prefill (e.g. "save as snippet" from shell history): pre-fills
  // the command and pre-selects a host in the scope. Ignored when editing.
  prefillCommand?: string
  defaultHostId?: string | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { default: false })

const isEdit = computed(() => !!props.snippet)

const schema = z.object({
  label: z.string().min(1, 'Required'),
  command: z.string().min(1, 'Required'),
  // Persisted host scope. Empty means global.
  hostIds: z.array(z.string()).optional()
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({})

watch(open, (isOpen) => {
  if (!isOpen) return
  state.label = props.snippet?.label ?? ''
  // In create mode a prefill command (from shell history) seeds the field;
  // editing always uses the snippet's own command.
  state.command = props.snippet?.command ?? props.prefillCommand ?? ''
  // Edit: preload the snippet's current host links. Create: pre-select the
  // default host (save-as-snippet) if any, else empty (global).
  state.hostIds = props.snippet
    ? props.snippet.hosts.map(l => l.hostId)
    : (props.defaultHostId ? [props.defaultHostId] : [])
})

// --- Group tree (top) -------------------------------------------------------
const groupTree = computed(() => buildGroupTree(props.groups))

// Direct hosts per group id, built once for the recursive tree nodes.
const hostsByGroup = computed(() => {
  const map = new Map<string, Host[]>()
  for (const host of props.hosts) {
    if (!host.groupId) continue
    const list = map.get(host.groupId) ?? []
    list.push(host)
    map.set(host.groupId, list)
  }
  return map
})

// Ensure a defined array for v-model bindings.
const selectedHostIds = computed({
  get: () => state.hostIds ?? [],
  set: (ids: string[]) => {
    state.hostIds = ids
  }
})

// --- Flat host list (bottom) ------------------------------------------------
// Carry each host's OS icon/color so the checkbox label can show a brand glyph.
const hostItems = computed(() => props.hosts.map((h) => {
  const os = osMeta(h.os)
  return { label: h.label, value: h.id, icon: os.icon, color: os.color }
}))

const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const d = event.data
  // Always send hostIds so edits reconcile the scope (an empty array clears the
  // links, making the snippet global).
  const payload = {
    label: d.label,
    command: d.command,
    hostIds: d.hostIds ?? []
  }

  try {
    if (isEdit.value && props.snippet) {
      await $fetch(`/api/snippets/${props.snippet.id}`, { method: 'PUT', body: payload })
    } else {
      await $fetch('/api/snippets', { method: 'POST', body: payload })
    }
    toast.add({ title: isEdit.value ? 'Snippet updated' : 'Snippet created', color: 'success' })
    open.value = false
    emit('saved')
  } catch {
    toast.add({ title: 'Could not save snippet', color: 'error' })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? 'Edit snippet' : 'New snippet'"
    :description="isEdit ? 'Update this command snippet.' : 'Save a reusable command.'"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Label" name="label">
          <UInput
            v-model="state.label"
            placeholder="Restart nginx"
            autofocus
            class="w-full"
          />
        </UFormField>

        <UFormField label="Command" name="command">
          <UTextarea
            v-model="state.command"
            :rows="3"
            placeholder="sudo systemctl restart nginx"
            class="w-full font-mono"
          />
        </UFormField>

        <UFormField label="Hosts" name="hostIds">
          <div class="rounded-md border border-default divide-y divide-default">
            <!-- Top: nested group tree to bulk-select hosts -->
            <div v-if="groupTree.length" class="max-h-40 overflow-y-auto p-2">
              <SnippetsHostScopeGroup
                v-for="node in groupTree"
                :key="node.id"
                v-model="selectedHostIds"
                :node="node"
                :hosts-by-group="hostsByGroup"
              />
            </div>

            <!-- Bottom: flat list of every host -->
            <div v-if="hostItems.length" class="max-h-40 overflow-y-auto p-3">
              <UCheckboxGroup
                v-model="selectedHostIds"
                :items="hostItems"
                value-key="value"
                size="sm"
              >
                <template #label="{ item }">
                  <span class="inline-flex items-center gap-1.5">
                    <UIcon
                      :name="item.icon"
                      class="size-4 shrink-0"
                      :class="{ 'text-dimmed': !item.color }"
                      :style="item.color ? { color: item.color } : undefined"
                    />
                    {{ item.label }}
                  </span>
                </template>
              </UCheckboxGroup>
            </div>
            <p v-else class="p-3 text-sm text-dimmed">
              No hosts yet.
            </p>
          </div>
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            :label="isEdit ? 'Save' : 'Create'"
            color="primary"
            type="submit"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
