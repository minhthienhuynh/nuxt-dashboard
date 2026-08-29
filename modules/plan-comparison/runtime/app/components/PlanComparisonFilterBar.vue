<script setup lang="ts">
import { SORT_OPTIONS } from '../composables/usePlanComparisonSort'
import type { SortOptionId } from '../composables/usePlanComparisonSort'

const sortOption = defineModel<SortOptionId>('sortOption', { required: true })
const hideOldModels = defineModel<boolean>('hideOldModels', { required: true })
const oldBefore = defineModel<string>('oldBefore', { required: true })
const hideLowAA = defineModel<boolean>('hideLowAA', { required: true })
const aaThreshold = defineModel<number>('aaThreshold', { required: true })

const SORT_LABELS: Record<SortOptionId, string> = {
  'newest': 'Mới nhất',
  'oldest': 'Cũ nhất',
  'name-asc': 'Tên A→Z',
  'name-desc': 'Tên Z→A',
  'context-desc': 'Context lớn nhất',
  'aa-desc': 'AA cao nhất',
  'tps-desc': 'Nhanh nhất',
  'cheapest': 'Rẻ nhất',
  'priciest': 'Đắt nhất'
}

const SORT_HINTS: Record<SortOptionId, string> = {
  'newest': 'Mới nhất trước (theo release_date).',
  'oldest': 'Cũ nhất trước (theo release_date).',
  'name-asc': 'Tên A→Z, số so theo giá trị: GLM-5.2 trước GLM-5.10.',
  'name-desc': 'Tên Z→A.',
  'context-desc': 'Context lớn nhất trước, trùng thì tên A→Z.',
  'aa-desc': 'AA cao nhất trước, trùng điểm thì tên A→Z.',
  'tps-desc': 'Nhanh nhất trước (Tok/s).',
  'cheapest': 'Rẻ nhất trước (giá hiệu dụng 800 in / provider out / 50K cache).',
  'priciest': 'Đắt nhất trước (giá hiệu dụng 800 in / provider out / 50K cache).'
}

const sortItems = (Object.keys(SORT_OPTIONS) as SortOptionId[])
  .map(id => ({ label: SORT_LABELS[id], value: id }))

function onOldBeforeInput(value: string) {
  oldBefore.value = value || '2026-06-01'
}

function onAaThresholdInput(value: string | number) {
  const n = Number(value)
  aaThreshold.value = value === '' || Number.isNaN(n) ? 50 : n
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

    <label class="flex items-center gap-2 text-sm whitespace-nowrap text-muted">
      <USwitch v-model="hideOldModels" size="sm" />
      Ẩn model cũ (phát hành trước
      <UInput
        type="date"
        :model-value="oldBefore"
        size="sm"
        class="w-36"
        @update:model-value="onOldBeforeInput($event as string)"
      />
      )
    </label>

    <label class="flex items-center gap-2 text-sm whitespace-nowrap text-muted">
      <USwitch v-model="hideLowAA" size="sm" />
      Ẩn model có AA &lt;
      <UInput
        type="number"
        :model-value="aaThreshold"
        size="sm"
        class="w-20"
        min="0"
        max="100"
        @update:model-value="onAaThresholdInput"
      />
    </label>
  </UCard>
</template>
