<script setup lang="ts">
import { usePlanComparisonDatabase } from '../composables/usePlanComparisonDatabase'

const {
  status,
  error,
  hideOldModels,
  oldBefore,
  hideLowAA,
  aaThreshold,
  sortOption,
  planCards,
  creditRows,
  dotRows,
  skippedModelNames,
  noRequestModelNames
} = usePlanComparisonDatabase()
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
      <PlanComparisonPlanCards :plan-cards="planCards" />

      <PlanComparisonFilterBar
        v-model:sort-option="sortOption"
        v-model:hide-old-models="hideOldModels"
        v-model:old-before="oldBefore"
        v-model:hide-low-a-a="hideLowAA"
        v-model:aa-threshold="aaThreshold"
      />

      <PlanComparisonCreditBarChart :rows="creditRows" :skipped="skippedModelNames" />

      <PlanComparisonRequestDotChart :rows="dotRows" :no-request="noRequestModelNames" />
    </template>
  </div>
</template>
