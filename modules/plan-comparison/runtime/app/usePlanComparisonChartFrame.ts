// Shared chart scaffolding for the two plan-comparison charts.
//
// Both charts measure their container, derive axis geometry, build two-line
// tick labels, compute the same y domain/bands, and style ticks/tooltips
// identically. This frame owns all of that; each chart keeps only its own
// geometry (bar band height vs. dot row height + log x ticks).
import { computed, useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'
import type { EnrichedModelRow } from './composables/usePlanComparisonDatabase'
import { PLAN_COMPARISON_PLANS } from './plan-colors'
import {
  chartAxisLayout,
  rowHeightForLabels,
  tickLabel
} from './plan-chart-axis'

export function usePlanComparisonChartFrame(rows: () => EnrichedModelRow[]) {
  const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
  const chartRef = useTemplateRef<HTMLElement | null>('chartRef')
  const { width } = useElementSize(cardRef)
  const axis = computed(() => chartAxisLayout(width.value ?? 0))

  // Long model names wrap onto at most two lines on phones, and the row band
  // follows the tallest label so nothing runs over the neighbouring row
  // (see plan-chart-axis.ts).
  const tickLabels = computed(() => rows().map(row => tickLabel(row.label, axis.value)))
  const rowBandHeight = computed(() => rowHeightForLabels(tickLabels.value, axis.value))
  const yDomain = computed<[number, number]>(() => [-0.5, Math.max(rows().length - 0.5, 0.5)])
  const zebraRows = computed(() => rows().map((_, i) => i).filter(i => i % 2 === 0))
  const tickValues = computed(() => rows().map((_, i) => i))
  const yTickFormat = (value: number) => tickLabels.value[Math.round(value)] ?? ''

  const legendItems = PLAN_COMPARISON_PLANS.map(plan => ({ name: plan.label, color: plan.color }))

  return {
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
  }
}
