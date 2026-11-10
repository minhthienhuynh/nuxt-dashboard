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
  selectedPlans,
  creditRows,
  dotRows,
  planSelection,
  selectedModelCount,
  togglePlan,
  skippedModelNames,
  noRequestModelNames
} = usePlanComparisonDatabase()

const STALE_AFTER_MS = 24 * 60 * 60 * 1000

function ageText(fromIso: string, now: number): string {
  const ms = now - Date.parse(fromIso)
  if (Number.isNaN(ms) || ms < 0) return 'just now'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/**
 * "9 Nov 2026, 07:43 UTC" — month first spelled out so nobody has to guess
 * whether 11/9 is November 9th or the 11th of September, and the zone spelled
 * out so the timestamp means the same thing to every reader.
 */
function fetchedLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const formatted = date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  })
  return `${formatted} UTC`
}

const syncText = computed(() => {
  if (!fetchedAt.value) return 'Loading data...'
  const when = `Data from ${fetchedLabel(fetchedAt.value)} (${ageText(fetchedAt.value, Date.now())})`
  return rolledBack.value ? `${when} — restored from backup` : when
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
      title="Failed to load comparison data"
      :description="error.message"
    />

    <div v-if="status === 'pending'" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <USkeleton v-for="i in 4" :key="i" class="h-44 rounded-lg" />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2 text-[13px] text-dimmed">
        <span>{{ syncText }}</span>
        <UBadge
          v-if="isOldData"
          color="warning"
          variant="subtle"
          label="Data is stale"
        />
        <span class="text-muted">
          {{ selectedModelCount }} model{{ selectedModelCount === 1 ? '' : 's' }} in the charts
        </span>
        <UButton
          size="xs"
          variant="ghost"
          :loading="resetting"
          label="Refresh data"
          @click="resetCache()"
        />
      </div>

      <PlanComparisonPlanCards
        :plan-cards="planCards"
        :selection="planSelection"
        @toggle="togglePlan"
      />

      <PlanComparisonFilterBar
        v-model:sort-option="sortOption"
        v-model:hide-old-models="hideOldModels"
        v-model:old-before="oldBefore"
        v-model:hide-low-intel="hideLowIntel"
        v-model:intel-threshold="intelThreshold"
      />

      <PlanComparisonCreditBarChart
        :rows="creditRows"
        :skipped="skippedModelNames"
        :plans="selectedPlans"
      />

      <PlanComparisonRequestDotChart
        :rows="dotRows"
        :no-request="noRequestModelNames"
        :plans="selectedPlans"
      />
    </template>
  </div>
</template>
