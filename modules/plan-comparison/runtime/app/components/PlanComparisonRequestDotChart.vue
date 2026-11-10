<script setup lang="ts">
import { VisAxis, VisBulletLegend, VisPlotband, VisScatter, VisXYContainer } from '@unovis/vue'
import { Scale } from '@unovis/ts'
import type { EnrichedModelRow } from '../composables/usePlanComparisonDatabase'
import type { PlanComparisonPlanMeta } from '../plan-colors'
import { usePlanSeries } from '../usePlanSeries'
import { AXIS_TICK_SEPARATOR, thinTicks } from '../plan-chart-axis'
import { usePlanComparisonChartFrame } from '../usePlanComparisonChartFrame'
import { usePlanChartHover } from '../usePlanChartHover'
import '../plan-chart.css'

const props = defineProps<{
  rows: EnrichedModelRow[]
  noRequest: string[]
  /** Checked plans, in registry order: one dot series per entry. */
  plans: PlanComparisonPlanMeta[]
}>()

// Dot size is the usage the plan's pool funds on that model, so a cheaper model
// gets a smaller dot instead of reading as a separate wallet. The header says it
// once; the legend stays plain.
const { legend } = usePlanSeries(() => props.plans)

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
  yTickFormat
} = usePlanComparisonChartFrame(() => props.rows)

const chartHeight = computed(() => props.rows.length * rowBandHeight.value + 72)

// Unovis marks the plot aria-hidden, so the chart needs a name of its own or a
// screen reader gets a figure with nothing in it.
const chartSummary = computed(() =>
  `Scatter chart: ${props.rows.length} models and ${props.plans.length} plans. Horizontal position is requests per month on a log scale, dot size is the usage value a plan funds on that model; open a model for exact values.`
)

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
    for (const plan of props.plans) {
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
        <h2 class="text-lg font-semibold text-highlighted">
          2. Requests per month vs monthly value
        </h2>
        <p class="text-[13px] text-muted">
          Horizontal position = requests per month (log scale). Dot size = the monthly
          value the plan funds on that model, area-proportional and spent in proportion
          across models. Hover a dot or a model name for its specs and what each checked
          plan funds it with.
          <template v-if="noRequest.length">
            Left out of this chart because no request count is published:
            {{ noRequest.join(', ') }}.
          </template>
        </p>
        <VisBulletLegend :items="legend" class="justify-center" orientation="horizontal" />
      </div>
    </template>

    <div
      v-if="rows.length"
      ref="chartRef"
      class="relative w-full"
      role="img"
      :aria-label="chartSummary"
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
        :plans="plans"
        :x="hovered.x"
        :y="hovered.y"
        @close="close"
        @content-enter="onTooltipPointerEnter"
        @content-leave="onTooltipPointerLeave"
      />
    </div>
    <p v-else class="px-4 py-10 text-center text-sm text-muted">
      No model matches these filters. Widen them above — the release cutoff or the
      Intelligence Index threshold — to bring models back.
    </p>
  </UCard>
</template>
