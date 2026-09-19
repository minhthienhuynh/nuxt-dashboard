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
  'newest': 'Mới nhất',
  'oldest': 'Cũ nhất',
  'name-asc': 'Tên A→Z',
  'name-desc': 'Tên Z→A',
  'context-desc': 'Context lớn nhất',
  'intelligence-desc': 'Thông minh nhất',
  'speed-desc': 'Nhanh nhất',
  'cheapest': 'Rẻ nhất',
  'priciest': 'Đắt nhất'
}

const SORT_HINTS: Record<SortOptionId, string> = {
  'newest': 'Mới nhất trước (theo ngày launchedAt).',
  'oldest': 'Cũ nhất trước (theo ngày launchedAt).',
  'name-asc': 'Tên A→Z, số so theo giá trị: GLM-5.2 trước GLM-5.10.',
  'name-desc': 'Tên Z→A.',
  'context-desc': 'Context lớn nhất trước, trùng thì tên A→Z.',
  'intelligence-desc': 'Intelligence Index cao nhất trước, trùng điểm thì tên A→Z.',
  'speed-desc': 'Nhanh nhất trước (Tok/s đo thực tế).',
  'cheapest': 'Rẻ nhất trước (theo giá Input $/1M tok).',
  'priciest': 'Đắt nhất trước (theo giá Input $/1M tok).'
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
        Sắp xếp
        <USelect v-model="sortOption" :items="sortItems" class="w-44" />
      </label>
      <span class="text-[13px] text-dimmed">
        {{ SORT_HINTS[sortOption] }} Model thiếu dữ liệu xếp cuối bảng.
      </span>
    </div>

    <label class="flex w-fit items-center gap-2 text-sm whitespace-nowrap text-muted">
      <USwitch v-model="hideOldModels" size="sm" />
      Ẩn model cũ (launched trước
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
      Ẩn model có Intel &lt;
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
