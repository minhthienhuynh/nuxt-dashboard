export type PlanComparisonPlanKey = 'cmd' | 'goat' | 'go' | 'od' | 'th' | 'th-office'

export interface PlanComparisonPlanMeta {
  key: PlanComparisonPlanKey
  planId: string
  label: string
  color: string
}

// Order matches the bar/tooltip series order: Command Code Go, Command Code
// GOAT, OpenCode Go, OpenDesign Go, Token Harbor Agent, Token Harbor Office.
export const PLAN_COMPARISON_PLANS: PlanComparisonPlanMeta[] = [
  { key: 'cmd', planId: 'cmd-go', label: 'Command Code Go', color: '#10b981' },
  { key: 'goat', planId: 'cmd-goat', label: 'Command Code GOAT', color: '#2563eb' },
  { key: 'go', planId: 'oc-go', label: 'OpenCode Go', color: '#bdc053' },
  { key: 'od', planId: 'od-go', label: 'OpenDesign Go', color: '#8b5cf6' },
  { key: 'th', planId: 'th-agent', label: 'Token Harbor Agent', color: '#0f766e' },
  { key: 'th-office', planId: 'th-office', label: 'Token Harbor Office', color: '#d97706' }
]

/**
 * Legend rows for the plans a chart draws. Labels stay plain — the plan name is
 * the whole distinction; see `PlanLimitsPercent` in types.ts for the shared-pool
 * note.
 */
export function planLegendItems(plans: PlanComparisonPlanMeta[]): { name: string, color: string }[] {
  return plans.map(plan => ({ name: plan.label, color: plan.color }))
}

export function planColor(planId: string): string {
  return PLAN_COMPARISON_PLANS.find(plan => plan.planId === planId)?.color ?? 'var(--ui-border-accented)'
}
