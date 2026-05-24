<script setup lang="ts">
import { format, isToday } from 'date-fns'
import type { MailpitMessage } from '~/types'

const props = defineProps<{
  messages: MailpitMessage[]
  loading: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
}>()
</script>

<template>
  <div class="overflow-y-auto divide-y divide-default">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>
    <div v-else-if="messages.length === 0" class="flex flex-col items-center justify-center py-12 gap-2 text-muted">
      <UIcon name="i-lucide-mail" class="size-12" />
      <p class="text-sm">No emails captured yet</p>
      <p class="text-xs">Emails sent to Mailpit will appear here</p>
    </div>
    <div
      v-for="msg in messages"
      :key="msg.ID"
      class="p-4 sm:px-6 text-sm cursor-pointer border-l-2 transition-colors border-bg hover:border-primary hover:bg-primary/5"
      :class="!msg.Read ? 'text-highlighted' : 'text-toned'"
      @click="emit('select', msg.ID)"
    >
      <div class="flex items-center justify-between" :class="[!msg.Read && 'font-semibold']">
        <div class="flex items-center gap-3 min-w-0">
          <span class="truncate">{{ msg.From?.Name || msg.From?.Address || 'Unknown' }}</span>
          <UChip v-if="!msg.Read" />
        </div>
        <span class="shrink-0 text-xs ml-2">{{ isToday(new Date(msg.Created)) ? format(new Date(msg.Created), 'HH:mm') : format(new Date(msg.Created), 'dd MMM') }}</span>
      </div>
      <p class="truncate" :class="[!msg.Read && 'font-semibold']">
        {{ msg.Subject || '(no subject)' }}
      </p>
      <p class="text-dimmed line-clamp-1 text-xs">
        {{ msg.Snippet }}
      </p>
    </div>
  </div>
</template>
