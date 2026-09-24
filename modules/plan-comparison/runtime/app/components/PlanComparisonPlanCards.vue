<script setup lang="ts">
import type { PlanCard } from '../composables/usePlanComparisonDatabase'
import { planColor } from '../plan-colors'

defineProps<{
  planCards: PlanCard[]
}>()

function usd(value: number): string {
  return `$${value.toLocaleString('en-US')}`
}

const ROWS: Array<{ label: string, value: (plan: PlanCard) => string }> = [
  { label: 'Price', value: plan => `${usd(plan.price)}/mo` },
  { label: '5-hour limit', value: plan => usd(plan.limits['5h']) },
  { label: 'Weekly limit', value: plan => usd(plan.limits.weekly) },
  { label: 'Monthly limit', value: plan => usd(plan.limits.monthly) },
  { label: 'Models with credit', value: plan => String(plan.modelCount) }
]
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <UCard
      v-for="plan in planCards"
      :key="plan.id"
      :ui="{ body: 'gap-y-1.5' }"
    >
      <div class="flex items-center gap-2 font-semibold text-highlighted">
        <span
          class="inline-block size-2.5 rounded-sm"
          :style="{ background: planColor(plan.id) }"
        />
        {{ plan.name }}
      </div>

      <p class="text-3xl font-bold text-highlighted">
        {{ usd(plan.monthlyCredit) }}<span class="text-sm font-normal text-muted">/mo credit</span>
      </p>

      <dl class="mt-2 space-y-0.5 text-[13px] text-muted">
        <div
          v-for="row in ROWS"
          :key="row.label"
          class="flex items-center justify-between gap-3"
        >
          <dt class="whitespace-nowrap">
            {{ row.label }}
          </dt>
          <dd class="whitespace-nowrap text-default">
            {{ row.value(plan) }}
          </dd>
        </div>
      </dl>
    </UCard>
  </div>
</template>
