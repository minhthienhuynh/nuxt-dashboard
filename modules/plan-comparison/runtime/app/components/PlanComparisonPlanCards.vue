<script setup lang="ts">
import type { PlanCard } from '../composables/usePlanComparisonDatabase'
import { planColor } from '../plan-colors'

defineProps<{
  planCards: PlanCard[]
}>()

function usd(value: number): string {
  return `$${value.toLocaleString('vi-VN')}`
}
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
        {{ usd(plan.monthlyCredit) }}<span class="text-sm font-normal text-muted">/tháng credit</span>
      </p>

      <dl class="mt-2 space-y-0.5 text-[13px] text-muted">
        <div class="flex items-center justify-between gap-3">
          <dt class="whitespace-nowrap">
            Giá
          </dt>
          <dd class="whitespace-nowrap text-default">
            {{ usd(plan.price) }}/tháng
          </dd>
        </div>

        <div class="flex items-center justify-between gap-3">
          <dt class="whitespace-nowrap">
            Giới hạn 5 giờ
          </dt>
          <dd class="whitespace-nowrap text-default">
            {{ usd(plan.limits['5h']) }}
          </dd>
        </div>

        <div class="flex items-center justify-between gap-3">
          <dt class="whitespace-nowrap">
            Giới hạn tuần
          </dt>
          <dd class="whitespace-nowrap text-default">
            {{ usd(plan.limits.weekly) }}
          </dd>
        </div>

        <div class="flex items-center justify-between gap-3">
          <dt class="whitespace-nowrap">
            Giới hạn tháng
          </dt>
          <dd class="whitespace-nowrap text-default">
            {{ usd(plan.limits.monthly) }}
          </dd>
        </div>

        <div class="flex items-center justify-between gap-3">
          <dt class="whitespace-nowrap">
            Số model có credit
          </dt>
          <dd class="whitespace-nowrap text-default">
            {{ plan.modelCount }}
          </dd>
        </div>
      </dl>
    </UCard>
  </div>
</template>
