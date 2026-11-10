import { computed } from 'vue'
import { planLegendItems } from './plan-colors'
import type { PlanComparisonPlanMeta } from './plan-colors'

/**
 * The legend rows for the plans a chart draws. Both charts derive it from the
 * same registry, so an unchecked plan leaves the bars, the dots and the legend
 * together.
 */
export function usePlanSeries(plans: () => PlanComparisonPlanMeta[]) {
  return { legend: computed(() => planLegendItems(plans())) }
}
