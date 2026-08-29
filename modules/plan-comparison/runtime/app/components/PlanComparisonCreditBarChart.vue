<script setup lang="ts">
import { VisAxis, VisBulletLegend, VisGroupedBarSelectors, VisGroupedBar, VisPlotband, VisTooltip, VisXYContainer } from '@unovis/vue'
import type { EnrichedModelRow } from '../composables/usePlanComparisonDatabase'
import { escapeHtml, PLAN_COMPARISON_PLANS } from '../plan-colors'

const props = defineProps<{
  rows: EnrichedModelRow[]
  skipped: string[]
}>()

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
const { width } = useElementSize(cardRef)

const BAR_H = 16
const chartHeight = computed(() => props.rows.length * 3 * BAR_H + 60)
const yDomain = computed<[number, number]>(() => [-0.5, Math.max(props.rows.length - 0.5, 0.5)])
const zebraRows = computed(() => props.rows.map((_, i) => i).filter(i => i % 2 === 0))
const tickValues = computed(() => props.rows.map((_, i) => i))

const legendItems = PLAN_COMPARISON_PLANS.map(plan => ({ name: plan.label, color: plan.color }))

const xIndex = (_d: EnrichedModelRow, i: number) => i

const yAccessors = PLAN_COMPARISON_PLANS.map(plan => (d: EnrichedModelRow) => d[plan.key].credit ?? 0)

const barColor = (_d: EnrichedModelRow, accessorIndex: number) =>
  PLAN_COMPARISON_PLANS[accessorIndex]?.color ?? 'var(--ui-border-accented)'

const xTickFormat = (value: number) => `$${value}`
const yTickFormat = (value: number) => props.rows[Math.round(value)]?.label ?? ''

const barTriggers = {
  [VisGroupedBarSelectors.bar]: (d: EnrichedModelRow, i: number) => {
    const planIndex = i % PLAN_COMPARISON_PLANS.length
    const plan = PLAN_COMPARISON_PLANS[planIndex]
    if (!plan) return null
    const funding = d[plan.key]
    if (funding.credit == null) return null
    const request = funding.request == null
      ? 'không công bố'
      : `${funding.request.toLocaleString('vi-VN')} request/tháng`
    return `<b>${escapeHtml(d.label)}</b><br>${plan.label}: $${funding.credit} credit/tháng<br>→ ${request}`
  }
}
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: 'px-0! pb-3!' }">
    <template #header>
      <div class="space-y-1 px-4">
        <p class="text-lg font-semibold text-highlighted">
          1. Credit/tháng + số request/tháng theo model
        </p>
        <p class="text-[13px] text-muted">
          Độ dài cột = credit tối đa/tháng. Hover vào cột để xem số request/tháng tương ứng
          ("—" = provider không công bố). Số trong ngoặc sau tên model = điểm AA ("—" = chưa có điểm).
          <template v-if="skipped.length">
            Bỏ qua {{ skipped.join(', ') }} vì không được cấp credit ở gói nào.
          </template>
        </p>
        <VisBulletLegend :items="legendItems" class="justify-center" />
      </div>
    </template>

    <div class="relative w-full" :style="{ height: `${chartHeight}px` }">
      <VisXYContainer
        :key="rows.length"
        :data="rows"
        :width="width"
        y-direction="south"
        :y-domain="yDomain"
        :padding="{ top: 8 }"
        class="h-full"
      >
        <VisPlotband
          v-for="i in zebraRows"
          :key="i"
          axis="y"
          :from="i - 0.5"
          :to="i + 0.5"
          color="var(--ui-bg-elevated)"
        />

        <VisGroupedBar
          orientation="horizontal"
          :x="xIndex"
          :y="yAccessors"
          :color="barColor"
          :bar-min-height="0"
          :rounded-corners="4"
          :group-padding="0.25"
          :bar-padding="0.2"
        />

        <VisAxis type="x" :tick-format="xTickFormat" />
        <VisAxis type="y" :tick-format="yTickFormat" :tick-values="tickValues" />

        <VisTooltip :triggers="barTriggers" />
      </VisXYContainer>
    </div>
  </UCard>
</template>

<style scoped>
.unovis-xy-container {
  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);

  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
