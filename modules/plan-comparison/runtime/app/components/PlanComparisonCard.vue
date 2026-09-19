<script setup lang="ts">
import { computed } from 'vue'
import { usePlanComparisonDatabase } from '../composables/usePlanComparisonDatabase'

const {
  status,
  error,
  fetchedAt,
  rolledBack,
  resetting,
  resetCache,
  hideOldModels,
  oldBefore,
  hideLowIntel,
  intelThreshold,
  sortOption,
  planCards,
  creditRows,
  dotRows,
  skippedModelNames,
  noRequestModelNames
} = usePlanComparisonDatabase()

const STALE_AFTER_MS = 24 * 60 * 60 * 1000

function ageText(fromIso: string, now: number): string {
  const ms = now - Date.parse(fromIso)
  if (Number.isNaN(ms) || ms < 0) return 'vừa xong'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

const syncText = computed(() => {
  if (!fetchedAt.value) return 'Đang tải dữ liệu...'
  const date = new Date(fetchedAt.value)
  const when = Number.isNaN(date.getTime())
    ? `Dữ liệu lúc ${fetchedAt.value}`
    : `Dữ liệu lúc ${date.toLocaleString('vi-VN')} (${ageText(fetchedAt.value, Date.now())})`
  return rolledBack.value ? `${when} — đã khôi phục từ backup` : when
})

const isOldData = computed(() => {
  if (!fetchedAt.value) return false
  const ms = Date.now() - Date.parse(fetchedAt.value)
  return !Number.isNaN(ms) && ms > STALE_AFTER_MS
})
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Không tải được dữ liệu so sánh"
      :description="error.message"
    />

    <div v-if="status === 'pending'" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <USkeleton v-for="i in 3" :key="i" class="h-44 rounded-lg" />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2 text-[13px] text-dimmed">
        <span>{{ syncText }}</span>
        <UBadge
          v-if="isOldData"
          color="warning"
          variant="subtle"
          label="Dữ liệu đã cũ"
        />
        <UButton
          size="xs"
          variant="ghost"
          :loading="resetting"
          label="Cập nhật dữ liệu"
          @click="resetCache()"
        />
      </div>

      <PlanComparisonPlanCards :plan-cards="planCards" />

      <PlanComparisonFilterBar
        v-model:sort-option="sortOption"
        v-model:hide-old-models="hideOldModels"
        v-model:old-before="oldBefore"
        v-model:hide-low-intel="hideLowIntel"
        v-model:intel-threshold="intelThreshold"
      />

      <PlanComparisonCreditBarChart :rows="creditRows" :skipped="skippedModelNames" />

      <PlanComparisonRequestDotChart :rows="dotRows" :no-request="noRequestModelNames" />
    </template>
  </div>
</template>
