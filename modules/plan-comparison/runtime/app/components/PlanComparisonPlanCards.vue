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
 *
 * A `null` window means the plan publishes no such cap at all (OpenDesign Go
 * sells one monthly pool), so the card shows a dash instead of inventing one.
 */
function windowValue(plan: PlanCard, window: '5h' | 'weekly' | 'monthly'): string {
  if (plan.limitPercent) return `${plan.limitPercent[window]}%`
  const limit = plan.limits[window]
  return limit == null ? '—' : usd(limit)
}

/** Pool plans grant one shared allowance; OpenCode Go sells per-model limits. */
function creditLabel(plan: PlanCard): string {
  if (plan.funding === 'pool') return '/mo shared pool'
  return plan.creditIsPerModel ? '/mo max per model' : '/mo credit'
}

const ROWS: Array<{ label: string, value: (plan: PlanCard) => string }> = [
  { label: 'Price', value: plan => `${usd(plan.price)}/mo` },
  { label: '5-hour limit', value: plan => windowValue(plan, '5h') },
  { label: 'Weekly limit', value: plan => windowValue(plan, 'weekly') },
  { label: 'Monthly limit', value: plan => windowValue(plan, 'monthly') },
  // Command Code caps most models well below the headline credit ($20 of a
  // $100 GOAT pool), so the range is the number that matters per model.
  { label: 'Per-model cap', value: plan => plan.creditRange ? `${usd(plan.creditRange.min)}–${usd(plan.creditRange.max)}` : '' },
  { label: 'Models with credit', value: plan => String(plan.modelCount) }
]
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <UCard
      v-for="plan in planCards"
      :key="plan.id"
      :ui="{ body: 'gap-y-1.5' }"
    >
      <div class="flex items-baseline gap-2">
        <span class="flex items-center gap-2 font-semibold text-highlighted">
          <span
            class="inline-block size-2.5 shrink-0 rounded-sm"
            :style="{ background: planColor(plan.id) }"
          />
          {{ plan.label }}
        </span>
        <!-- Vendor's own plan name, shown only when it differs ("Go Plan"). -->
        <span
          v-if="plan.name !== plan.label"
          class="truncate text-xs text-muted"
        >
          {{ plan.name }}
        </span>
      </div>

      <p class="text-3xl font-bold text-highlighted">
        {{ usd(plan.monthlyCredit) }}<span class="text-sm font-normal text-muted">{{ creditLabel(plan) }}</span>
      </p>

      <dl class="mt-2 space-y-0.5 text-[13px] text-muted">
        <div
          v-for="row in ROWS.filter(candidate => candidate.value(plan))"
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
