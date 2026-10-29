<script setup lang="ts">
import type { PlanCard } from '../composables/usePlanComparisonDatabase'
import { planColor } from '../plan-colors'

defineProps<{
  planCards: PlanCard[]
}>()

/** Whole-dollar formatting; the percentage windows need one decimal ($7.50). */
function usd(value: number): string {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

/**
 * OpenCode Go sizes its windows as a share of each model's own monthly limit
 * ("5-hour — 20% of the monthly limit; weekly — 50%; monthly — 100%"), so a
 * flat dollar figure only holds for the models whose limit matches the plan
 * pool. The plan carries the fractions; per-model dollars live in the charts.
 */
function windowValue(plan: PlanCard, window: '5h' | 'weekly' | 'monthly'): string {
  if (!plan.limitPercent) return usd(plan.limits[window])
  return `${plan.limitPercent[window]}%`
}

const ROWS: Array<{ label: string, value: (plan: PlanCard) => string }> = [
  { label: 'Price', value: plan => `${usd(plan.price)}/mo` },
  { label: '5-hour limit', value: plan => windowValue(plan, '5h') },
  { label: 'Weekly limit', value: plan => windowValue(plan, 'weekly') },
  { label: 'Monthly limit', value: plan => windowValue(plan, 'monthly') },
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
