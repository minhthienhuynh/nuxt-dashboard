<script setup lang="ts">
import { computed, ref } from 'vue'
import type { HistoryError } from '#shared/terminal-protocol'

const props = defineProps<{
  loading: boolean
  entries: string[]
  error: HistoryError | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  // Paste a command into the terminal without running it (user can edit first).
  paste: [command: string]
  // Run a command immediately.
  run: [command: string]
  // Re-fetch the history from the remote host.
  refresh: []
}>()

const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.entries
  return props.entries.filter(entry => entry.toLowerCase().includes(q))
})

const errorMessage: Record<HistoryError, string> = {
  'unsupported-shell': 'Shell history is only available for bash and zsh sessions.',
  'not-found': 'No shell history was found on this host.',
  'probe-failed': 'Could not read the shell history. Try refreshing.'
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Shell history"
    description="Commands from the remote shell — most recent first"
  >
    <template #body>
      <div class="flex flex-col gap-3 h-full">
        <div class="flex items-center gap-2">
          <UInput
            v-model="query"
            icon="i-lucide-search"
            placeholder="Filter commands…"
            size="sm"
            class="flex-1"
            :disabled="loading || !!error"
          />
          <UTooltip text="Refresh">
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="subtle"
              size="sm"
              :loading="loading"
              aria-label="Refresh history"
              @click="emit('refresh')"
            />
          </UTooltip>
        </div>

        <div v-if="loading" class="flex justify-center py-8">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
        </div>

        <div
          v-else-if="error"
          class="flex flex-col items-center gap-2 py-8 text-center text-sm text-dimmed"
        >
          <UIcon name="i-lucide-info" class="size-6" />
          <p>{{ errorMessage[error] }}</p>
        </div>

        <p v-else-if="filtered.length === 0" class="py-8 text-center text-sm text-dimmed">
          No matching commands.
        </p>

        <ul v-else class="flex-1 min-h-0 overflow-y-auto divide-y divide-default">
          <li
            v-for="(command, index) in filtered"
            :key="`${index}-${command}`"
            class="group flex items-center gap-2 py-1.5"
          >
            <button
              type="button"
              class="flex-1 min-w-0 truncate text-left font-mono text-xs text-toned hover:text-highlighted"
              :title="command"
              @click="emit('paste', command)"
            >
              {{ command }}
            </button>
            <UTooltip text="Run">
              <UButton
                icon="i-lucide-play"
                color="neutral"
                variant="ghost"
                size="xs"
                class="opacity-0 group-hover:opacity-100"
                aria-label="Run command"
                @click="emit('run', command)"
              />
            </UTooltip>
          </li>
        </ul>
      </div>
    </template>
  </USlideover>
</template>
