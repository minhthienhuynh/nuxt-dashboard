<script setup lang="ts">
import { DEFAULT_INTEL_THRESHOLD, DEFAULT_OLD_BEFORE } from '../composables/usePlanComparisonDatabase'
import { SORT_OPTIONS } from '../composables/usePlanComparisonSort'
import type { SortOptionId } from '../composables/usePlanComparisonSort'

const sortOption = defineModel<SortOptionId>('sortOption', { required: true })
const hideOldModels = defineModel<boolean>('hideOldModels', { required: true })
const oldBefore = defineModel<string>('oldBefore', { required: true })
const hideLowIntel = defineModel<boolean>('hideLowIntel', { required: true })
const intelThreshold = defineModel<number>('intelThreshold', { required: true })

const SORT_LABELS: Record<SortOptionId, string> = {
  'newest': 'Newest',
  'oldest': 'Oldest',
  'name-asc': 'Name A→Z',
  'name-desc': 'Name Z→A',
  'context-desc': 'Largest context',
  'intelligence-desc': 'Most intelligent',
  'speed-desc': 'Fastest',
  'cheapest': 'Cheapest',
  'priciest': 'Priciest'
}

const SORT_HINTS: Record<SortOptionId, string> = {
  'newest': 'Newest launch date first.',
  'oldest': 'Oldest launch date first.',
  'name-asc': 'Name A→Z.',
  'name-desc': 'Name Z→A.',
  'context-desc': 'Largest context window first.',
  'intelligence-desc': 'Highest Intelligence Index first.',
  'speed-desc': 'Fastest measured output first.',
  'cheapest': 'Cheapest input $/1M tok first.',
  'priciest': 'Priciest input $/1M tok first.'
}

const sortItems = (Object.keys(SORT_OPTIONS) as SortOptionId[])
  .map(id => ({ label: SORT_LABELS[id], value: id }))

function onOldBeforeInput(value: string) {
  oldBefore.value = value || DEFAULT_OLD_BEFORE
}

function onIntelThresholdInput(value: string | number) {
  const n = Number(value)
  intelThreshold.value = value === '' || Number.isNaN(n) ? DEFAULT_INTEL_THRESHOLD : n
}
</script>

<template>
  <UCard :ui="{ body: 'flex flex-col gap-3' }">
    <div class="flex flex-wrap items-center gap-2">
      <label class="flex items-center gap-2 text-sm text-muted">
        Sort
        <USelect v-model="sortOption" :items="sortItems" class="w-44" />
      </label>
      <span class="text-[13px] text-dimmed">
        {{ SORT_HINTS[sortOption] }} Models missing data sort last.
      </span>
    </div>

    <label class="flex w-fit items-center gap-2 text-sm whitespace-nowrap text-muted">
      <USwitch v-model="hideOldModels" size="sm" />
      Hide old models (launched before
      <UInput
        type="date"
        :model-value="oldBefore"
        size="sm"
        class="w-36"
        @update:model-value="onOldBeforeInput($event as string)"
      />
      )
    </label>

    <label class="flex w-fit items-center gap-2 text-sm whitespace-nowrap text-muted">
      <USwitch v-model="hideLowIntel" size="sm" />
      Hide models with Intelligence &lt;
      <UInput
        type="number"
        :model-value="intelThreshold"
        size="sm"
        class="w-20"
        min="0"
        @update:model-value="onIntelThresholdInput"
      />
    </label>
  </UCard>
</template>
