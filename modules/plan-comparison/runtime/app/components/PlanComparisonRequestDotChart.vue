<script setup lang="ts">
import { VisAxis, VisBulletLegend, VisPlotband, VisScatter, VisXYContainer } from '@unovis/vue'
import { Scale } from '@unovis/ts'
import type { EnrichedModelRow } from '../composables/usePlanComparisonDatabase'
import { PLAN_COMPARISON_PLANS } from '../plan-colors'
import { AXIS_TICK_SEPARATOR, thinTicks } from '../plan-chart-axis'
import { usePlanComparisonChartFrame } from '../usePlanComparisonChartFrame'
import { usePlanChartHover } from '../usePlanChartHover'
import '../plan-chart.css'

const props = defineProps<{
  rows: EnrichedModelRow[]
  noRequest: string[]
}>()

const {
  cardRef,
  chartRef,
  width,
  axis,
  tickLabels,
  rowBandHeight,
  yDomain,
  zebraRows,
  tickValues,
  yTickFormat,
  legendItems
} = usePlanComparisonChartFrame(() => props.rows)

const chartHeight = computed(() => props.rows.length * rowBandHeight.value + 72)

// Hover (or tap on touch) a model — its y-axis label or any of its dots — for
// the spec tooltip.
const { hovered, onPointerMove, onPointerLeave, onPointerUp, onTooltipPointerEnter, onTooltipPointerLeave, close } = usePlanChartHover(
  () => props.rows,
  () => tickLabels.value,
  () => chartRef.value ?? null
)

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

// Log decades collide on phones ("1,000" is 40px wide), so thin them to the
// container's tick budget instead of letting Unovis draw overlapping labels.
const visibleXTicks = computed(() => thinTicks(xTicks.value, axis.value.xTickBudget))

interface DotPoint {
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
const sizeFromCredit = (d: DotPoint) => Math.sqrt(d.credit) * 3.3
const colorByPlan = (d: DotPoint) => d.planColor

const xTickFormat = (value: number) => value.toLocaleString('en-US')

// Shorter animation for snappier filter/sort transitions
const DURATION = 200
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: 'px-0! pb-3!' }">
    <template #header>
      <div class="space-y-1 px-4">
        <p class="text-lg font-semibold text-highlighted">
          2. Both quota types on one row
        </p>
        <p class="text-[13px] text-muted">
          Horizontal position = requests/mo (log scale), dot diameter = credit/mo (area-proportional).
          Hover a dot or model name to see its specs and per-plan funding.
          <template v-if="noRequest.length">
            {{ noRequest.length }} models without a published request count are omitted: {{ noRequest.join(', ') }}.
          </template>
        </p>
        <VisBulletLegend :items="legendItems" class="justify-center" orientation="horizontal" />
      </div>
    </template>

    <div
      ref="chartRef"
      class="relative w-full"
      :style="{ 'height': `${chartHeight}px`, '--pc-tick-font-size': `${axis.fontSize}px` }"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
      @pointerup="onPointerUp"
    >
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
        />

        <VisAxis
          type="x"
          :tick-format="xTickFormat"
          :tick-values="visibleXTicks"
          :tick-text-font-size="`${axis.fontSize}px`"
          tick-text-hide-overlapping
        />
        <VisAxis
          type="y"
          :tick-format="yTickFormat"
          :tick-values="tickValues"
          :tick-text-width="axis.labelWidth"
          tick-text-fit-mode="wrap"
          :tick-text-separator="AXIS_TICK_SEPARATOR"
          :tick-text-font-size="`${axis.fontSize}px`"
        />
      </VisXYContainer>

      <PlanComparisonModelInfo
        v-if="hovered"
        :row="hovered.row"
        :x="hovered.x"
        :y="hovered.y"
        @close="close"
        @content-enter="onTooltipPointerEnter"
        @content-leave="onTooltipPointerLeave"
      />
    </div>
  </UCard>
</template>
