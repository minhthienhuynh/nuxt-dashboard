<script setup lang="ts">
defineProps<{
  name: string
  count: number
  icon?: string
  // In list view the card drops its box border (rows are separated by the
  // container's divider lines instead).
  list?: boolean
}>()

const emit = defineEmits<{
  open: []
  edit: []
  delete: []
}>()
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :aria-label="`Open ${name}`"
    :class="[
      'group relative flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary',
      list ? '' : 'rounded-lg border border-default hover:border-primary'
    ]"
    @click="emit('open')"
    @keydown.enter="emit('open')"
    @keydown.space.prevent="emit('open')"
  >
    <div class="flex items-center justify-center size-10 rounded-md bg-primary/10 text-primary shrink-0">
      <UIcon :name="icon ?? 'i-lucide-group'" class="size-5" />
    </div>

    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold text-highlighted truncate">
        {{ name }}
      </p>
      <p class="text-xs text-dimmed">
        {{ count }} host{{ count === 1 ? '' : 's' }}
      </p>
    </div>

    <div class="absolute top-1.5 right-1.5 flex opacity-0 group-hover:opacity-100">
      <UButton
        icon="i-lucide-pencil"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="Edit group"
        @click.stop="emit('edit')"
      />
      <UButton
        icon="i-lucide-trash-2"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="Delete group"
        @click.stop="emit('delete')"
      />
    </div>
  </div>
</template>
