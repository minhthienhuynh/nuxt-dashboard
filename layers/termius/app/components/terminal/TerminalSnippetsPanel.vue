<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SSHSnippet } from '../../types/ssh'

const props = defineProps<{
  loading: boolean
  snippets: SSHSnippet[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  // Paste a command into the terminal without running it (user can edit first).
  paste: [command: string]
  // Run a command immediately.
  run: [command: string]
  // Re-fetch the applicable snippets from the API.
  refresh: []
  // Request deletion of a snippet (parent confirms + calls the API).
  delete: [snippet: SSHSnippet]
}>()

const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.snippets
  return props.snippets.filter(s =>
    s.label.toLowerCase().includes(q) || s.command.toLowerCase().includes(q))
})

// Paste/run close the slideover, after which the parent focuses the terminal.
// Stop reka-ui from restoring focus to the toolbar trigger on close so that
// focus (the terminal input) is not stolen back.
function onCloseAutoFocus(event: Event) {
  event.preventDefault()
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Snippets"
    description="Saved commands for this host — double-click to paste, run to execute"
    :content="{ onCloseAutoFocus }"
  >
    <template #body>
      <div class="flex flex-col gap-3 h-full">
        <div class="flex items-center gap-2">
          <UInput
            v-model="query"
            icon="i-lucide-search"
            placeholder="Filter snippets…"
            size="sm"
            class="flex-1"
            :disabled="loading"
          />
          <UTooltip text="Refresh">
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="subtle"
              size="sm"
              :loading="loading"
              aria-label="Refresh snippets"
              @click="emit('refresh')"
            />
          </UTooltip>
        </div>

        <div v-if="loading" class="flex justify-center py-8">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
        </div>

        <div
          v-else-if="snippets.length === 0"
          class="flex flex-col items-center gap-2 py-8 text-center text-sm text-dimmed"
        >
          <UIcon name="i-lucide-square-terminal" class="size-6" />
          <p>No snippets for this host yet. Add some from the Snippets page.</p>
        </div>

        <p v-else-if="filtered.length === 0" class="py-8 text-center text-sm text-dimmed">
          No matching snippets.
        </p>

        <ul v-else class="flex-1 min-h-0 overflow-y-auto divide-y divide-default">
          <li
            v-for="snippet in filtered"
            :key="snippet.id"
            class="group flex items-center gap-2 py-2"
          >
            <button
              type="button"
              class="flex-1 min-w-0 text-left"
              :title="`${snippet.command}\n\nDouble-click to paste`"
              @dblclick="emit('paste', snippet.command)"
            >
              <span class="block truncate text-xs font-medium text-toned group-hover:text-highlighted">
                {{ snippet.label }}
              </span>
              <span class="block truncate font-mono text-xs text-dimmed">
                {{ snippet.command }}
              </span>
            </button>
            <UTooltip text="Run">
              <UButton
                icon="i-lucide-play"
                color="neutral"
                variant="ghost"
                size="xs"
                class="opacity-0 group-hover:opacity-100"
                aria-label="Run snippet"
                @click="emit('run', snippet.command)"
              />
            </UTooltip>
            <UTooltip text="Delete">
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                class="opacity-0 group-hover:opacity-100"
                aria-label="Delete snippet"
                @click="emit('delete', snippet)"
              />
            </UTooltip>
          </li>
        </ul>
      </div>
    </template>
  </USlideover>
</template>
