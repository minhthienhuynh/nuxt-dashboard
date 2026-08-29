<script setup lang="ts">
import { VisAxis, VisBulletLegend, VisPlotband, VisScatterSelectors, VisScatter, VisTooltip, VisXYContainer } from '@unovis/vue'
import { Scale } from '@unovis/ts'
import type { EnrichedModelRow } from '../composables/usePlanComparisonDatabase'
import { escapeHtml, PLAN_COMPARISON_PLANS } from '../plan-colors'

const props = defineProps<{
  rows: EnrichedModelRow[]
  noRequest: string[]
}>()

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
const { width } = useElementSize(cardRef)

const ROW_H = 30
const chartHeight = computed(() => props.rows.length * ROW_H + 72)
const yDomain = computed<[number, number]>(() => [-0.5, Math.max(props.rows.length - 0.5, 0.5)])
const zebraRows = computed(() => props.rows.map((_, i) => i).filter(i => i % 2 === 0))
const tickValues = computed(() => props.rows.map((_, i) => i))

// Matches the prototype: log scale for requests, domain derived from the data so
// newly synced models outside the old fixed range stay visible.
const logScale = Scale.scaleLog()

// Round a positive value outward to the nearest 1× or 3× decade (…, 100, 300, 1000, …)
function niceLogBound(value: number, direction: 'floor' | 'ceil'): number {
  const base = 10 ** Math.floor(Math.log10(value))
  const triple = 3 * base
  if (direction === 'floor') {
    if (value >= triple) return triple
    if (value >= base) return base
    return 10 ** (Math.floor(Math.log10(value)) - 1)
  }
  if (value <= base) return base
  if (value <= triple) return triple
  return 10 ** (Math.floor(Math.log10(value)) + 1)
}

const xDomain = computed<[number, number]>(() => {
  if (!points.value.length) return [1, 10]
  let min = Infinity
  let max = 0
  for (const point of points.value) {
    min = Math.min(min, point.request)
    max = Math.max(max, point.request)
  }
  return [niceLogBound(min, 'floor'), niceLogBound(max, 'ceil')]
})

const xTicks = computed<number[]>(() => {
  const [lo, hi] = xDomain.value
  const ticks: number[] = []
  for (let t = lo; t <= hi;) {
    ticks.push(t)
    const k = Math.floor(Math.log10(t))
    t = t < 3 * 10 ** k ? 3 * 10 ** k : 10 ** (k + 1)
  }
  return ticks
})

const legendItems = computed(() => PLAN_COMPARISON_PLANS.map(plan => ({ name: plan.label, color: plan.color })))

interface DotPoint {
  label: string
  planLabel: string
  planColor: string
  request: number
  credit: number
  rowIndex: number
}

const points = computed<DotPoint[]>(() => {
  const result: DotPoint[] = []
  props.rows.forEach((row, rowIndex) => {
    for (const plan of PLAN_COMPARISON_PLANS) {
      const funding = row[plan.key]
      if (funding.request == null || funding.credit == null) continue
      result.push({
        label: row.label,
        planLabel: plan.label,
        planColor: plan.color,
        request: funding.request,
        credit: funding.credit,
        rowIndex
      })
    }
  })
  return result
})

const xRequest = (d: DotPoint) => d.request
const yRow = (d: DotPoint) => d.rowIndex
// Marker diameter encodes credit by area (r ~ sqrt(credit)), same as the prototype.
const sizeFromCredit = (d: DotPoint) => Math.sqrt(d.credit) * 2.7
const colorByPlan = (d: DotPoint) => d.planColor

const xTickFormat = (value: number) => value.toLocaleString('vi-VN')
const yTickFormat = (value: number) => props.rows[Math.round(value)]?.label ?? ''

// Shorter animation for snappier filter/sort transitions
const DURATION = 200

// The scatter datum bound to each point is a `ScatterPoint` wrapper that spreads
// the original `DotPoint`, so the tooltip can read its fields directly.
const scatterTriggers = {
  [VisScatterSelectors.point]: (d: DotPoint) => {
    if (d.credit == null) return null
    return `<b>${escapeHtml(d.label)}</b><br>`
      + `${d.planLabel}: $${d.credit} credit · ${d.request.toLocaleString('vi-VN')} request/tháng`
  }
}
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: 'px-0! pb-3!' }">
    <template #header>
      <div class="space-y-1 px-4">
        <p class="text-lg font-semibold text-highlighted">
          2. Hai loại quota trên cùng một hàng
        </p>
        <p class="text-[13px] text-muted">
          Vị trí ngang = request/tháng (log), đường kính điểm = credit/tháng (diện tích tỉ lệ thuận).
          Hover vào điểm để xem chi tiết từng gói.
          <template v-if="noRequest.length">
            Bỏ {{ noRequest.length }} model không bên nào công bố request: {{ noRequest.join(', ') }}.
          </template>
        </p>
        <VisBulletLegend :items="legendItems" class="justify-center" orientation="horizontal" />
      </div>
    </template>

    <div class="relative w-full" :style="{ height: `${chartHeight}px` }">
      <VisXYContainer
        :key="rows.length"
        :data="points"
        :width="width"
        :x-scale="logScale"
        :x-domain="xDomain"
        y-direction="south"
        :y-domain="yDomain"
        :padding="{ top: 8 }"
        :duration="DURATION"
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

        <VisScatter
          :x="xRequest"
          :y="yRow"
          :size="sizeFromCredit"
          :color="colorByPlan"
          :duration="DURATION"
          cursor="pointer"
        />

        <VisAxis type="x" :tick-format="xTickFormat" :tick-values="xTicks" />
        <VisAxis type="y" :tick-format="yTickFormat" :tick-values="tickValues" />

        <VisTooltip :triggers="scatterTriggers" />
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
