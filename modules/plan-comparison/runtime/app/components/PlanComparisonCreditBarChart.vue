<script setup lang="ts">
import { VisAxis, VisBulletLegend, VisGroupedBar, VisPlotband, VisXYContainer } from '@unovis/vue'
import type { EnrichedModelRow } from '../composables/usePlanComparisonDatabase'
import type { PlanComparisonPlanMeta } from '../plan-colors'
import { usePlanSeries } from '../usePlanSeries'
import { AXIS_TICK_SEPARATOR } from '../plan-chart-axis'
import { usePlanComparisonChartFrame } from '../usePlanComparisonChartFrame'
import { usePlanChartHover } from '../usePlanChartHover'
import '../plan-chart.css'

const props = defineProps<{
  rows: EnrichedModelRow[]
  skipped: string[]
  /** Checked plans, in registry order: one bar per entry. */
  plans: PlanComparisonPlanMeta[]
}>()

// Every plan here is one shared pool, so a bar is the usage that pool funds on
// the model ("if this model used all of it") — the same number the dot chart
// sizes its markers with. The header explains that once; the legend stays plain.
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

const BAR_H = 16
// One bar per plan defines the visual band; a taller label (name wrapped onto
// two lines) grows the row band instead of overlapping the next.
const bandHeight = computed(() => Math.max(props.plans.length * BAR_H, rowBandHeight.value))
const chartHeight = computed(() => props.rows.length * bandHeight.value + 60)

// Hover (or tap on touch) a model — its y-axis label or any of its bars — for
// the spec tooltip.
const { hovered, onPointerMove, onPointerLeave, onPointerUp, onTooltipPointerEnter, onTooltipPointerLeave, close } = usePlanChartHover(
  () => props.rows,
  () => tickLabels.value,
  () => chartRef.value ?? null
)

const xIndex = (_d: EnrichedModelRow, i: number) => i

// Computed, not captured: the accessor list IS the series list, so it has to
// follow the checked plans — a stale array here keeps drawing the bars of a plan
// the reader unchecked.
const yAccessors = computed(() => props.plans.map(plan => (d: EnrichedModelRow) => d[plan.key].credit ?? 0))

const barColor = (_d: EnrichedModelRow, accessorIndex: number) =>
  props.plans[accessorIndex]?.color ?? 'var(--ui-border-accented)'

const xTickFormat = (value: number) => `$${value}`
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: 'px-0! pb-3!' }">
    <template #header>
      <div class="space-y-1 px-4">
        <p class="text-lg font-semibold text-highlighted">
          1. Monthly value per model
        </p>
        <p class="text-[13px] text-muted">
          Bar length = what a plan funds on that model per month — its share of the plan's
          pool at the model's own rate, scaled to the largest bar. A pool is spent in
          proportion, so a month on one model is not what another model gets. Hover a bar
          or a model name for its specs and what each checked plan funds it with.
          <template v-if="skipped.length">
            No plan funds: {{ skipped.join(', ') }}.
          </template>
        </p>
        <VisBulletLegend :items="legend" class="justify-center" />
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

        <VisAxis
          type="x"
          :tick-format="xTickFormat"
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
  </UCard>
</template>
